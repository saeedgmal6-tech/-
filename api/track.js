import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const hash = value => crypto.createHash("sha256").update(String(value)).digest("hex");
const validSlug = value => /^[a-z0-9]{6,40}$/i.test(String(value || ""));
const events = new Set(["gift_start", "payment_submitted", "gift_view", "reply_submitted"]);
const reactions = new Set(["❤️", "🥹", "😍", "🤍", "🫶", "💌"]);

export default async function handler(req, res) {
  const mode = String(req.query?.mode || "");
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return mode === "events" ? res.status(204).end() : res.status(503).json({ error: "قاعدة البيانات غير متاحة حاليًا." });
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  if (mode === "events") {
    if (req.method !== "POST") return res.status(405).end();
    const body = req.body || {};
    const event = String(body.event || "");
    if (!events.has(event)) return res.status(204).end();
    const slug = validSlug(body.slug) ? String(body.slug) : null;
    const { error } = await db.from("site_events").insert({ event, slug });
    if (error) console.error("Event tracking failed:", error.message);
    return res.status(204).end();
  }

  if (mode === "replies" && req.method === "POST") {
    const body = req.body || {};
    const slug = String(body.slug || "");
    const reaction = String(body.reaction || "❤️");
    const message = String(body.message || "").trim().slice(0, 500);
    if (!validSlug(slug) || !reactions.has(reaction)) return res.status(400).json({ error: "بيانات الرد غير صحيحة." });
    const { data: gift, error: giftError } = await db.from("gifts").select("slug").eq("slug", slug).maybeSingle();
    if (giftError || !gift) return res.status(404).json({ error: "الهدية غير موجودة أو لم تُنشر بعد." });
    const { error } = await db.from("gift_replies").insert({ slug, reaction, message });
    if (error) {
      console.error("Gift reply insert failed:", error.message);
      return res.status(503).json({ error: "جدول الردود غير جاهز. شغّل ملف supabase/feature-upgrades.sql ثم حاول مرة أخرى." });
    }
    return res.status(201).json({ ok: true });
  }

  if (mode === "replies" && req.method === "GET") {
    const slug = String(req.query?.slug || "");
    const ownerKey = String(req.query?.key || "");
    if (!validSlug(slug) || !/^[a-f0-9]{64}$/i.test(ownerKey)) return res.status(400).json({ error: "رابط إدارة الردود غير صالح." });
    const { data: owner, error: ownerError } = await db.from("gift_owner_keys").select("token_hash").eq("slug", slug).maybeSingle();
    const suppliedHash = hash(ownerKey);
    if (ownerError || !owner || !/^[a-f0-9]{64}$/i.test(String(owner.token_hash || "")) || !crypto.timingSafeEqual(Buffer.from(owner.token_hash, "hex"), Buffer.from(suppliedHash, "hex"))) {
      return res.status(403).json({ error: "مفتاح الإدارة غير صحيح على هذا الجهاز. استخدم الجهاز الذي أنشأت منه الهدية." });
    }
    const { data, error } = await db.from("gift_replies").select("id,reaction,message,created_at").eq("slug", slug).order("created_at", { ascending: false }).limit(100);
    if (error) return res.status(503).json({ error: "تعذر تحميل الردود. تأكد من تشغيل ملف ترقية قاعدة البيانات." });
    return res.status(200).json({ replies: data || [] });
  }

  if (mode) return res.status(404).json({ error: "المسار غير موجود." });
  if (req.method !== "POST") return res.status(405).end();
  const body = req.body || {};
  const path = typeof body.path === "string" ? body.path.slice(0, 500) : "/";
  if (!path.startsWith("/") || path === "/admin" || path.startsWith("/api/")) return res.status(204).end();
  const referrer = typeof body.referrer === "string" ? body.referrer.slice(0, 1000) : "";
  const userAgent = String(req.headers["user-agent"] || "").slice(0, 500);
  const { error } = await db.from("site_visits").insert({ path, referrer, user_agent: userAgent });
  if (error) console.error("Visit tracking failed:", error.message);
  return res.status(204).end();
}
