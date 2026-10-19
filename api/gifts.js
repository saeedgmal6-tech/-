import { createClient } from "@supabase/supabase-js";

const themes = new Set(["rose","night","cream","garden","sunset","lavender","ocean","midnight"]);
const maxBodyChars = 3_800_000;

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  let record;
  try {
    record = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ error: "بيانات الهدية غير صالحة." });
  }
  if (!record || typeof record !== "object" || JSON.stringify(record).length > maxBodyChars) {
    return res.status(413).json({ error: "حجم الصور كبير جدًا. قلّل عدد الصور أو حجمها وحاول مرة أخرى." });
  }

  const clean = {
    slug: String(record.slug || ""),
    title: String(record.title || "حكايتنا لسه مكملة").slice(0, 120),
    from_name: String(record.from_name || "").trim(),
    to_name: String(record.to_name || "").trim(),
    message: String(record.message || "").trim(),
    date: record.date || null,
    occasion: String(record.occasion || "مجرد إني بحبك").slice(0, 100),
    theme: themes.has(record.theme) ? record.theme : "rose",
    photos: Array.isArray(record.photos) ? record.photos.slice(0, 5).filter(x => typeof x === "string") : [],
    cover: typeof record.cover === "string" ? record.cover : "",
    music: Boolean(record.music),
    created_at: new Date().toISOString()
  };
  if (!/^[a-z0-9]{6,40}$/i.test(clean.slug) ||
      clean.from_name.length < 1 || clean.from_name.length > 60 ||
      clean.to_name.length < 1 || clean.to_name.length > 60 ||
      clean.message.length < 1 || clean.message.length > 1800) {
    return res.status(400).json({ error: "راجع الاسم والرسالة وحاول مرة تانية." });
  }

  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return res.status(503).json({ error: "حفظ الهدايا على الموقع غير مفعّل حاليًا. حاول لاحقًا." });

  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await db.from("gifts").insert(clean).select("*").single();
  if (error) {
    if (error.code === "23505") return res.status(409).json({ error: "الهدية دي محفوظة بالفعل." });
    console.error("Gift archive save failed:", error.message);
    return res.status(500).json({ error: "مقدرناش نحفظ الهدية في أرشيف الموقع. حاول مرة أخرى." });
  }
  return res.status(201).json({ gift: data });
}
