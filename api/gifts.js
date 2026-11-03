import { createClient } from "@supabase/supabase-js";

const allowedThemes = new Set(["rose", "night", "cream", "garden"]);
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

function getDatabase() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const db = getDatabase();
  if (!db) return res.status(503).json({ error: "إعدادات قاعدة البيانات ناقصة على الخادم. راجع VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY في Vercel." });

  if (req.method === "GET" && req.query?.health === "1") {
    const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    try {
      const response = await fetch(url.replace(/\\/$/, "") + "/auth/v1/health", {
        headers: { apikey: process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY }
      });
      return res.status(200).json({ databaseReachable: true, authStatus: response.status });
    } catch (error) {
      console.error("Supabase connectivity diagnostic:", error?.cause?.code || "", error?.cause?.message || error?.message || "");
      return res.status(503).json({
        databaseReachable: false,
        errorCode: error?.cause?.code || "FETCH_FAILED",
        error: "الخادم غير قادر على الوصول إلى مشروع Supabase. راجع حالة المشروع وإعدادات عنوانه."
      });
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
    if (metaIndex >= 0 && photos[metaIndex].__lahzetna_meta) {
      photos[metaIndex].__lahzetna_meta.theme = selectedTheme;
    }
    const record = {
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
      music: Boolean(body.music)
    };
    try {
      const { data, error } = await db.from("gifts").insert(record).select("*").single();
      if (error) {
        console.error("Gift creation database error:", error.message, error.code || "");
        if (error.code === "42501") return res.status(403).json({ error: "قاعدة البيانات رفضت الحفظ. لازم تفعيل سياسة السماح بإنشاء الهدايا للزوار." });
        if (error.code === "23505") return res.status(409).json({ error: "حصل تعارض في رابط الهدية. اضغط إنشاء مرة تانية." });
        if (error.code === "23514") return res.status(400).json({ error: "في اختيار غير مدعوم في قاعدة البيانات. جرّب ثيم مختلف." });
        return res.status(400).json({ error: error.message || "قاعدة البيانات رفضت حفظ الهدية." });
      }
      return res.status(201).json({ gift: metadata(data) });
    } catch (error) {
      console.error("Gift creation request failed:", error?.message || error);
      return res.status(503).json({ error: "تعذر الاتصال بقاعدة البيانات حاليًا. حاول بعد لحظات." });
    }
  }

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "طريقة الطلب غير مدعومة." });
  }
  const slug = String(req.query?.slug || "");
  if (!/^[a-z0-9]{6,40}$/i.test(slug)) return res.status(400).json({ error: "رابط الهدية غير صالح." });
  try {
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
  } catch (error) {
    console.error("Gift fetch failed:", error?.message || error);
    return res.status(503).json({ error: "تعذر الاتصال بقاعدة البيانات حاليًا." });
  }
}
