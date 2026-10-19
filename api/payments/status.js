import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const slug = String(req.query?.slug || "");
  if (!/^[a-z0-9]{6,40}$/i.test(slug)) return res.status(400).json({ error: "طلب غير صالح." });
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return res.status(503).json({ error: "خدمة الدفع غير مفعلة." });
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: order, error } = await db.from("gift_orders").select("status,slug").eq("slug", slug).maybeSingle();
  if (error) return res.status(500).json({ error: "تعذر التحقق من حالة الدفع." });
  if (!order) return res.status(404).json({ status: "not_found" });
  if (order.status !== "paid") return res.status(200).json({ status: order.status });
  const { data: gift, error: giftError } = await db.from("gifts").select("*").eq("slug", slug).maybeSingle();
  if (giftError) return res.status(500).json({ error: "تعذر تحميل الهدية." });
  return res.status(200).json({ status: "paid", gift });
}
