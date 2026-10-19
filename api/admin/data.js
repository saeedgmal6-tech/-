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
  const [giftsResult, visitCountResult, visits7Result, visitsResult] = await Promise.all([
    db.from("gifts").select("id,slug,title,from_name,to_name,message,occasion,created_at").order("created_at", { ascending: false }).limit(300),
    db.from("site_visits").select("*", { count: "exact", head: true }),
    db.from("site_visits").select("*", { count: "exact", head: true }).gte("created_at", since),
    db.from("site_visits").select("id,path,referrer,created_at").order("created_at", { ascending: false }).limit(300)
  ]);
  const firstError = giftsResult.error || visitCountResult.error || visits7Result.error || visitsResult.error;
  if (firstError) {
    const missingVisits = String(firstError.message || "").toLowerCase().includes("site_visits");
    return res.status(503).json({ error: missingVisits ? "جدول الزيارات لسه مش متجهز. شغّل ملف supabase/admin-analytics.sql في SQL Editor ثم حدّث الصفحة." : "تعذر قراءة بيانات Supabase: " + firstError.message });
  }
  const visits = visitsResult.data || [];
  const counts = new Map();
  for (const visit of visits) counts.set(visit.path, (counts.get(visit.path) || 0) + 1);
  const topPaths = [...counts.entries()].map(([path, count]) => ({ path, count })).sort((a, b) => b.count - a.count).slice(0, 8);
  return res.status(200).json({
    stats: { totalVisits: visitCountResult.count || 0, visits7d: visits7Result.count || 0, totalGifts: giftsResult.data?.length || 0 },
    gifts: giftsResult.data || [],
    visits,
    topPaths
  });
}
