import crypto from "node:crypto";
import { list } from "@vercel/blob";

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

  try {
    const result = await list({ prefix: "gifts/", limit: 1000 });
    const gifts = await Promise.all(result.blobs.map(async blob => {
      const response = await fetch(blob.url);
      return response.ok ? response.json() : null;
    }));
    const cleanGifts = gifts.filter(Boolean);
    return res.status(200).json({
      stats: { totalVisits: 0, visits7d: 0, totalGifts: cleanGifts.length },
      funnel: { giftStarts: 0, paymentSubmissions: 0, giftViews: 0, replies: 0 },
      replies: [], gifts: cleanGifts, visits: [], topPaths: []
    });
  } catch (error) {
    console.error("Admin Blob read failed:", error?.message || error);
    return res.status(503).json({ error: "تعذر تحميل بيانات لوحة الإدارة حاليًا." });
  }
}
