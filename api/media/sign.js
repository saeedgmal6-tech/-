import crypto from "node:crypto";

const BUCKET = "lahzetna-media";
const ALLOWED_AUDIO = new Set(["audio/mpeg","audio/mp4","audio/x-m4a","audio/aac","audio/wav","audio/x-wav","audio/ogg","audio/webm","audio/3gpp"]);
const ALLOWED_VIDEO = new Set(["video/mp4","video/webm","video/quicktime","video/3gpp","video/x-matroska"]);

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const url = String(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "").replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return res.status(503).json({ error: "رفع الصوت والفيديو يحتاج إعدادات Supabase مكتملة." });

  let body;
  try { body = typeof req.body === "string" ? JSON.parse(req.body) : req.body; }
  catch { return res.status(400).json({ error: "بيانات الملف غير صالحة." }); }
  const mediaType = body?.mediaType === "audio" ? "audio" : body?.mediaType === "video" ? "video" : "";
  const mimeType = String(body?.contentType || "").toLowerCase();
  const size = Number(body?.size || 0);
  const limit = mediaType === "audio" ? 25 * 1024 * 1024 : 35 * 1024 * 1024;
  if (!mediaType || !(mediaType === "audio" ? ALLOWED_AUDIO : ALLOWED_VIDEO).has(mimeType)) {
    return res.status(415).json({ error: "نوع الملف غير مدعوم. استخدم MP3/M4A/WAV/OGG للصوت أو MP4/WebM للفيديو." });
  }
  if (!Number.isFinite(size) || size < 1 || size > limit) {
    return res.status(413).json({ error: `حجم الملف أكبر من الحد المسموح: ${mediaType === "audio" ? 25 : 35} ميجابايت.` });
  }

  const headers = { apikey: key, Authorization: "Bearer " + key, "Content-Type": "application/json" };
  try {
    const bucketResponse = await fetch(url + "/storage/v1/bucket", {
      method: "POST",
      headers,
      body: JSON.stringify({
        id: BUCKET, name: BUCKET, public: true,
        file_size_limit: 35 * 1024 * 1024,
        allowed_mime_types: [...ALLOWED_AUDIO, ...ALLOWED_VIDEO]
      })
    });
    if (!bucketResponse.ok && bucketResponse.status !== 409) {
      const details = await bucketResponse.text().catch(() => "");
      if (!/already exists|duplicate/i.test(details)) {
        console.error("Supabase media bucket setup failed:", bucketResponse.status, details.slice(0, 300));
        return res.status(503).json({ error: "تعذر تجهيز مساحة تخزين الملفات. حاول مرة أخرى بعد قليل." });
      }
    }

    const originalName = String(body.fileName || "media").split(/[\\/]/).pop().replace(/[^a-zA-Z0-9._-]/g, "_").slice(-90) || "media";
    const path = `${mediaType}/${crypto.randomUUID()}-${originalName}`;
    const signResponse = await fetch(url + "/storage/v1/object/upload/sign/" + BUCKET + "/" + path.split("/").map(encodeURIComponent).join("/") + "?upsert=true", {
      method: "POST", headers, body: JSON.stringify({ upsert: true })
    });
    const signed = await signResponse.json().catch(() => ({}));
    if (!signResponse.ok || !signed.token) {
      console.error("Supabase signed upload failed:", signResponse.status, JSON.stringify(signed).slice(0, 300));
      return res.status(503).json({ error: "تعذر إنشاء رابط رفع آمن للملف." });
    }
    return res.status(200).json({
      path, token: signed.token,
      publicUrl: url + "/storage/v1/object/public/" + BUCKET + "/" + path.split("/").map(encodeURIComponent).join("/")
    });
  } catch (error) {
    console.error("Media upload signing error:", error.message);
    return res.status(503).json({ error: "تعذر الاتصال بتخزين الملفات. تحقق من الإنترنت وحاول مرة أخرى." });
  }
}
