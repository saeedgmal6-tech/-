export default function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const walletNumber = String(process.env.ORANGE_CASH_NUMBER || "").trim();
  if (!walletNumber) return res.status(503).json({ error: "رقم محفظة الاستقبال لم يتم ضبطه بعد." });
  return res.status(200).json({ walletNumber });
}
