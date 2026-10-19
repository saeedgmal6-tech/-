import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return res.status(204).end();
  const body = req.body || {};
  const path = typeof body.path === "string" ? body.path.slice(0, 500) : "/";
  if (!path.startsWith("/") || path === "/admin" || path.startsWith("/api/")) return res.status(204).end();
  const referrer = typeof body.referrer === "string" ? body.referrer.slice(0, 1000) : "";
  const userAgent = String(req.headers["user-agent"] || "").slice(0, 500);
  try {
    const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { error } = await db.from("site_visits").insert({ path, referrer, user_agent: userAgent });
    if (error) console.error("Visit tracking failed:", error.message);
  } catch (error) {
    console.error("Visit tracking failed:", error?.message || error);
  }
  return res.status(204).end();
}
