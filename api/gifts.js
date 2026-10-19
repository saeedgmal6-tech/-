import { createClient } from "@supabase/supabase-js";

const metadata = row => {
  const photos = Array.isArray(row.photos) ? [...row.photos] : [];
  const index = photos.findIndex(item => item && typeof item === "object" && item.__lahzetna_meta);
  const meta = index >= 0 ? photos[index].__lahzetna_meta : {};
  const cleanPhotos = photos.filter(item => typeof item === "string" || (item && typeof item === "object" && item.data));
  return { ...row, photos: cleanPhotos, ...meta, locked: Boolean(meta.locked), secure_payload: meta.secure_payload || null };
};
const teaser = gift => ({
  slug: gift.slug, title: gift.title, from_name: gift.from_name, to_name: gift.to_name,
  occasion: gift.occasion, theme: gift.theme, date: gift.date, created_at: gift.created_at,
  open_at: gift.open_at || null, expires_at: gift.expires_at || null,
  custom_accent: gift.custom_accent || "", font_family: gift.font_family || "Cairo",
  locked: Boolean(gift.locked), message: gift.locked ? "الهدية دي محمية بكلمة مرور ❤️" : "",
  photos: [], cover: "", music: false, audio_url: "", video_url: "", timeline: []
});

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "إنشاء الهدايا يتم بعد مراجعة الدفع فقط." });
  }
  const slug = String(req.query?.slug || "");
  if (!/^[a-z0-9]{6,40}$/i.test(slug)) return res.status(400).json({ error: "رابط الهدية غير صالح." });
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return res.status(503).json({ error: "قاعدة البيانات غير متاحة حاليًا." });
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await db.from("gifts").select("*").eq("slug", slug).maybeSingle();
  if (error || !data) return res.status(404).json({ error: "الهدية غير موجودة أو لم تُنشر بعد." });
  const gift = metadata(data);
  if (gift.expires_at && new Date(gift.expires_at + "T23:59:59").getTime() < Date.now()) {
    return res.status(410).json({ expired: true, gift: teaser(gift), error: "انتهت صلاحية الهدية." });
  }
  if (gift.open_at && Date.parse(gift.open_at) > Date.now()) {
    return res.status(200).json({ gift: teaser(gift), scheduled: true });
  }
  return res.status(200).json({ gift });
}
