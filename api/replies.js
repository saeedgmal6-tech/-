import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const dbClient = () => {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
};
const validSlug = value => /^[a-z0-9]{6,40}$/i.test(String(value || ""));
const hash = value => crypto.createHash("sha256").update(String(value)).digest("hex");

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const db = dbClient();
  if (!db) return res.status(503).json({ error: "خدمة الردود تحتاج إعداد قاعدة البيانات." });

  if (req.method === "POST") {
    const body = req.body || {};
    const slug = String(body.slug || "");
    const reaction = String(body.reaction || "❤️");
    const message = String(body.message || "").trim().slice(0, 500);
    if (!validSlug(slug) || !["❤️","🥹","😍","🤍","🫶","💌"].includes(reaction)) {
      return res.status(400).json({ error: "بيانات الرد غير صحيحة." });
    }
    const { data: gift, error: giftError } = await db.from("gifts").select("slug").eq("slug", slug).maybeSingle();
    if (giftError || !gift) return res.status(404).json({ error: "الهدية غير موجودة أو لم تُنشر بعد." });
    const { error } = await db.from("gift_replies").insert({ slug, reaction, message });
    if (error) {
      console.error("Gift reply insert failed:", error.message);
      return res.status(503).json({ error: "جدول الردود غير جاهز. شغّل ملف supabase/feature-upgrades.sql ثم حاول مرة أخرى." });
    }
    return res.status(201).json({ ok: true });
  }

  if (req.method === "GET") {
    const slug = String(req.query?.slug || "");
    const key = String(req.query?.key || "");
    if (!validSlug(slug) || !/^[a-f0-9]{64}$/i.test(key)) return res.status(400).json({ error: "رابط إدارة الردود غير صالح." });
    const { data: owner, error: ownerError } = await db.from("gift_owner_keys").select("token_hash").eq("slug", slug).maybeSingle();
    if (ownerError || !owner || !crypto.timingSafeEqual(Buffer.from(owner.token_hash, "hex"), Buffer.from(hash(key), "hex"))) {
      return res.status(403).json({ error: "مفتاح الإدارة غير صحيح على هذا الجهاز. استخدم الجهاز الذي أنشأت منه الهدية." });
    }
    const { data, error } = await db.from("gift_replies").select("id,reaction,message,created_at").eq("slug", slug).order("created_at", { ascending: false }).limit(100);
    if (error) return res.status(503).json({ error: "تعذر تحميل الردود. تأكد من تشغيل ملف ترقية قاعدة البيانات." });
    return res.status(200).json({ replies: data || [] });
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Method not allowed" });
}
