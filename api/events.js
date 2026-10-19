import { createClient } from "@supabase/supabase-js";

const allowed = new Set(["gift_start", "payment_submitted", "gift_view", "reply_submitted"]);
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return res.status(204).end();
  const body = req.body || {};
  const event = String(body.event || "");
  if (!allowed.has(event)) return res.status(204).end();
  const slug = /^[a-z0-9]{6,40}$/i.test(String(body.slug || "")) ? String(body.slug) : null;
  try {
    const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { error } = await db.from("site_events").insert({ event, slug });
    if (error) console.error("Event tracking failed:", error.message);
  } catch (error) { console.error("Event tracking failed:", error?.message || error); }
  return res.status(204).end();
}
