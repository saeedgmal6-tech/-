import { put, list } from "@vercel/blob";

const allowedThemes = new Set(["rose", "night", "cream", "garden", "sunset", "lavender", "ocean"]);
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
const giftPath = slug => `gifts/${slug}.json`;

export const config = { api: { bodyParser: { sizeLimit: "4mb" } } };

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "GET" && req.query?.health === "1") {
    try {
      await list({ prefix: "gifts/", limit: 1 });
      return res.status(200).json({ databaseReachable: true, storage: "vercel-blob" });
    } catch (error) {
      console.error("Blob health check failed:", error?.message || error);
      return res.status(503).json({ databaseReachable: false, storage: "vercel-blob", error: "تعذر الاتصال بمساحة حفظ الهدايا." });
    }
  }

  if (req.method === "POST") {
    const body = req.body || {};
    const slug = String(body.slug || "");
    const fromName = String(body.from_name || "").trim();
    const toName = String(body.to_name || "").trim();
    const message = String(body.message || "").trim();
    if (!/^[a-z0-9]{6,40}$/i.test(slug) || !fromName || !toName || !message) {
      return res.status(400).json({ error: "بيانات الهدية غير مكتملة أو غير صحيحة." });
    }
    if (fromName.length > 60 || toName.length > 60 || message.length > 1800) {
      return res.status(400).json({ error: "راجع طول الأسماء والرسالة؛ الحد الأقصى للاسم 60 حرفًا والرسالة 1800 حرف." });
    }
    const selectedTheme = String(body.theme || "rose");
    const photos = Array.isArray(body.photos) ? body.photos : [];
    const metaIndex = photos.findIndex(item => item && typeof item === "object" && item.__lahzetna_meta);
    if (metaIndex >= 0 && photos[metaIndex].__lahzetna_meta) photos[metaIndex].__lahzetna_meta.theme = selectedTheme;
    const record = {
      ...body,
      slug,
      title: String(body.title || "حكايتنا لسه مكملة").slice(0, 120),
      from_name: fromName,
      to_name: toName,
      message,
      date: body.date || null,
      occasion: String(body.occasion || "مجرد إني بحبك").slice(0, 80),
      theme: allowedThemes.has(selectedTheme) ? selectedTheme : "rose",
      photos,
      cover: typeof body.cover === "string" ? body.cover : "",
      music: Boolean(body.music),
      created_at: new Date().toISOString()
    };
    try {
      const existing = await list({ prefix: giftPath(slug), limit: 1 });
      if (existing.blobs.some(blob => blob.pathname === giftPath(slug))) {
        return res.status(409).json({ error: "رابط الهدية مستخدم بالفعل. اضغط إنشاء مرة تانية." });
      }
      const blob = await put(giftPath(slug), JSON.stringify(record), {
        access: "public",
        addRandomSuffix: false,
        contentType: "application/json",
        cacheControlMaxAge: 60
      });
      return res.status(201).json({ gift: metadata(record), storageUrl: blob.url });
    } catch (error) {
      console.error("Gift save failed:", error?.message || error);
      return res.status(503).json({ error: "تعذر حفظ الهدية حاليًا. حاول مرة أخرى بعد لحظات." });
    }
  }

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "طريقة الطلب غير مدعومة." });
  }
  const slug = String(req.query?.slug || "");
  if (!/^[a-z0-9]{6,40}$/i.test(slug)) return res.status(400).json({ error: "رابط الهدية غير صالح." });
  try {
    const matches = await list({ prefix: giftPath(slug), limit: 1 });
    const blob = matches.blobs.find(item => item.pathname === giftPath(slug));
    if (!blob) return res.status(404).json({ error: "الهدية غير موجودة أو لم تُنشر بعد." });
    const response = await fetch(blob.url, { cache: "no-store" });
    if (!response.ok) throw new Error("Gift blob returned " + response.status);
    const data = await response.json();
    const gift = metadata(data);
    if (gift.expires_at && new Date(gift.expires_at + "T23:59:59").getTime() < Date.now()) {
      return res.status(410).json({ expired: true, gift: teaser(gift), error: "انتهت صلاحية الهدية." });
    }
    if (gift.open_at && Date.parse(gift.open_at) > Date.now()) {
      return res.status(200).json({ gift: teaser(gift), scheduled: true });
    }
    return res.status(200).json({ gift });
  } catch (error) {
    console.error("Gift fetch failed:", error?.message || error);
    return res.status(503).json({ error: "تعذر استرجاع الهدية حاليًا." });
  }
}
