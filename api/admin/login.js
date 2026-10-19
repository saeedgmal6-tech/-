import crypto from "node:crypto";

function equal(a, b) {
  const left = Buffer.from(String(a || ""));
  const right = Buffer.from(String(b || ""));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

export default function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const expectedUser = process.env.ADMIN_USERNAME;
  const expectedPass = process.env.ADMIN_PASSWORD;
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!expectedUser || !expectedPass || !secret) {
    return res.status(503).json({ error: "إعدادات دخول الإدارة غير مكتملة على الخادم." });
  }
  const { username, password } = req.body || {};
  if (!equal(username, expectedUser) || !equal(password, expectedPass)) {
    return res.status(401).json({ error: "اسم المستخدم أو كلمة المرور غير صحيحة." });
  }
  const payload = Buffer.from(JSON.stringify({ u: expectedUser, exp: Date.now() + 8 * 60 * 60 * 1000 })).toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  res.setHeader("Set-Cookie", `lahzetna_admin=${payload}.${signature}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=28800`);
  return res.status(200).json({ ok: true });
}
