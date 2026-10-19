import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

function authorized(req) {
  const cookie = String(req.headers.cookie || "").split(";").map(x => x.trim()).find(x => x.startsWith("lahzetna_admin="));
  if (!cookie) return false;
  const token = cookie.slice("lahzetna_admin=".length);
  const [payload, signature] = token.split(".");
  if (!payload || !signature || !process.env.ADMIN_SESSION_SECRET || !process.env.ADMIN_USERNAME) return false;
  const expected = crypto.createHmac("sha256", process.env.ADMIN_SESSION_SECRET).update(payload).digest("base64url");
  const a = Buffer.from(signature), b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return data.u === process.env.ADMIN_USERNAME && data.exp > Date.now();
  } catch { return false; }
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!authorized(req)) return res.status(401).json({ error: "سجّل الدخول إلى لوحة الإدارة أولًا." });
  const { orderId, action, reason } = req.body || {};
  if (!orderId || !["approve", "reject"].includes(action)) return res.status(400).json({ error: "طلب مراجعة غير صالح." });
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return res.status(503).json({ error: "إعداد قاعدة البيانات غير مكتمل." });
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: order, error: lookupError } = await db.from("gift_orders")
    .select("id,slug,gift,status").eq("id", orderId).maybeSingle();
  if (lookupError || !order) return res.status(404).json({ error: "طلب الدفع غير موجود." });
  if (order.status !== "awaiting_review") return res.status(409).json({ error: "تمت مراجعة الطلب بالفعل." });

  if (action === "reject") {
    const { error } = await db.from("gift_orders").update({
      status: "rejected", reviewed_at: new Date().toISOString(),
      rejection_reason: String(reason || "لم يتم تأكيد التحويل").slice(0, 300)
    }).eq("id", orderId).eq("status", "awaiting_review");
    if (error) return res.status(500).json({ error: "تعذر رفض الطلب." });
    return res.status(200).json({ ok: true, status: "rejected" });
  }

  const { error: giftError } = await db.from("gifts").insert({ ...order.gift, created_at: new Date().toISOString() });
  if (giftError && giftError.code !== "23505") {
    console.error("Manual approval gift insert failed:", giftError.message);
    return res.status(500).json({ error: "تعذر نشر الهدية. لم يتم إنهاء مراجعة الطلب." });
  }
  const { error: updateError } = await db.from("gift_orders").update({
    status: "approved", reviewed_at: new Date().toISOString()
  }).eq("id", orderId).eq("status", "awaiting_review");
  if (updateError) return res.status(500).json({ error: "تم حفظ الهدية لكن تعذر تحديث حالة الطلب. حدّث لوحة الإدارة قبل إعادة المحاولة." });
  return res.status(200).json({ ok: true, status: "approved", giftUrl: "https://lahzetna.vercel.app/g/" + order.slug });
}
