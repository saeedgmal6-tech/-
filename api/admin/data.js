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
  if (req.method === "POST") {
    res.setHeader("Set-Cookie", "lahzetna_admin=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0");
    return res.status(200).json({ ok: true });
  }
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  if (!authorized(req)) return res.status(401).json({ error: "سجّل الدخول من جديد." });

  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return res.status(503).json({ error: "باقي إعداد واحد: أضف SUPABASE_SERVICE_ROLE_KEY في Vercel Environment Variables، باستخدام المفتاح السري من Supabase. لا تضعه في الواجهة الأمامية." });

  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const [visitCountResult, visits7Result, visitsResult, pendingOrdersResult, approvedOrdersResult] = await Promise.all([
    db.from("site_visits").select("*", { count: "exact", head: true }),
    db.from("site_visits").select("*", { count: "exact", head: true }).gte("created_at", since),
    db.from("site_visits").select("id,path,referrer,created_at").order("created_at", { ascending: false }).limit(300),
    db.from("gift_orders").select("id,slug,gift,payer_phone,payment_reference,amount_cents,status,created_at")
      .eq("status", "awaiting_review").order("created_at", { ascending: false }).limit(100),
    db.from("gift_orders").select("id,amount_cents", { count: "exact" }).eq("status", "approved")
  ]);

  // Read gifts in pages so the admin dashboard isn't silently capped at the newest 300.
  const allGifts = [];
  let giftsError = null;
  const pageSize = 500;
  for (let from = 0; ; from += pageSize) {
    const result = await db.from("gifts").select("*").order("created_at", { ascending: false }).range(from, from + pageSize - 1);
    if (result.error) { giftsError = result.error; break; }
    const batch = result.data || [];
    allGifts.push(...batch);
    if (batch.length < pageSize) break;
  }

  const firstError = giftsError || visitCountResult.error || visits7Result.error || visitsResult.error || pendingOrdersResult.error || approvedOrdersResult.error;
  if (firstError) {
    const missingVisits = String(firstError.message || "").toLowerCase().includes("site_visits");
    return res.status(503).json({ error: missingVisits ? "جدول الزيارات لسه مش متجهز. شغّل ملف supabase/admin-analytics.sql في SQL Editor ثم حدّث الصفحة." : "تعذر قراءة بيانات Supabase: " + firstError.message });
  }
  const visits = visitsResult.data || [];
  const approvedOrders = approvedOrdersResult.data || [];
  const totalRevenueCents = approvedOrders.reduce((sum, order) => sum + Number(order.amount_cents || 0), 0);
  const counts = new Map();
  for (const visit of visits) counts.set(visit.path, (counts.get(visit.path) || 0) + 1);
  const topPaths = [...counts.entries()].map(([path, count]) => ({ path, count })).sort((a, b) => b.count - a.count).slice(0, 8);
  return res.status(200).json({
    stats: { totalVisits: visitCountResult.count || 0, visits7d: visits7Result.count || 0, totalGifts: allGifts.length, approvedOrders: approvedOrdersResult.count || 0, totalRevenueCents },
    gifts: allGifts,
    pendingOrders: pendingOrdersResult.data || [],
    visits,
    topPaths
  });
}
