export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).send("Method not allowed");
  }
  return res.status(410).send("Paid gift publishing is currently unavailable. Free gift creation remains available.");
}
