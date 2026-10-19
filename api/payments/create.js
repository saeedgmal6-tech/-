import { createClient } from "@supabase/supabase-js";

const AMOUNT_CENTS = 2000;
const themes = new Set(["rose","night","cream","garden","sunset","lavender","ocean","midnight"]);

function normalizeGift(record) {
  return {
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
    music: Boolean(record.music)
  };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const walletNumber = String(process.env.ORANGE_CASH_NUMBER || "").trim();
  if (!url || !serviceKey || !walletNumber) {
    return res.status(503).json({ error: "إعدادات الطلبات اليدوية ناقصة. يلزم ضبط قاعدة البيانات ومفتاح الخادم ورقم محفظة الاستقبال في Vercel." });
  }
  let body;
  try { body = typeof req.body === "string" ? JSON.parse(req.body) : req.body; }
  catch { return res.status(400).json({ error: "بيانات الطلب غير صالحة." }); }

  const record = body?.gift;
  const phone = String(body?.phone || "").replace(/[\s()-]/g, "");
  const reference = String(body?.reference || "").trim();
  if (!record || !/^(?:\+?20)?0?1[0125][0-9]{8}$/.test(phone) || reference.length < 4 || reference.length > 100) {
    return res.status(400).json({ error: "اكتب رقم الموبايل ورقم العملية بشكل صحيح." });
  }
  const gift = normalizeGift(record);
  if (!/^[a-z0-9]{6,40}$/i.test(gift.slug) || !gift.from_name || gift.from_name.length > 60 ||
      !gift.to_name || gift.to_name.length > 60 || !gift.message || gift.message.length > 1800 ||
      JSON.stringify(gift).length > 3_800_000) {
    return res.status(400).json({ error: "راجع بيانات الهدية أو قلّل حجم الصور." });
  }

  const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: order, error } = await db.from("gift_orders").insert({
    slug: gift.slug,
    gift,
    amount_cents: AMOUNT_CENTS,
    currency: "EGP",
    status: "awaiting_review",
    payer_phone: phone,
    payment_reference: reference
  }).select("id,slug,created_at").single();

  if (error) {
    console.error("Manual payment order insert failed:", error.message);
    return res.status(500).json({ error: "تعذر تسجيل طلب الدفع. تأكد من إعداد جدول الطلبات في Supabase." });
  }

  // Optional instant Telegram alert. Notification failure never loses the payment request.
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (botToken && chatId) {
    const text = [
      "🔔 طلب دفع جديد - لحظتنا",
      "المبلغ: 20 جنيه",
      "من: " + gift.from_name,
      "إلى: " + gift.to_name,
      "رقم المحوّل: " + phone,
      "رقم العملية: " + reference,
      "راجع الطلب واقبله أو ارفضه من لوحة الإدارة:",
      "https://lahzetna.vercel.app/admin"
    ].join("\n");
    try {
      await fetch("https://api.telegram.org/bot" + botToken + "/sendMessage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text })
      });
    } catch (notifyError) {
      console.error("Telegram alert failed:", notifyError.message);
    }
  }
  return res.status(200).json({ ok: true, orderId: order.id, slug: order.slug, walletNumber });
}
