export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const mode = String(req.query?.mode || "");
  if (mode === "events" || (!mode && req.method === "POST")) return res.status(204).end();
  if (mode === "replies") {
    return res.status(410).json({ error: "نظام الردود قيد إعادة التجهيز بعد نقل التخزين." });
  }
  return res.status(204).end();
}
