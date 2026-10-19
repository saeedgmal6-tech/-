import { createClient } from "@supabase/supabase-js";

const AMOUNT_CENTS = 2000;
const themes = new Set(["rose","night","cream","garden","sunset","lavender","ocean","midnight"]);

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const secretKey = process.env.PAYMOB_SECRET_KEY;
  const publicKey = process.env.PAYMOB_PUBLIC_KEY;
  const integrationId = process.env.PAYMOB_WALLET_INTEGRATION_ID;
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secretKey || !publicKey || !integrationId || !url || !serviceKey) {
    return res.status(503).json({ error: "الدفع الإلكتروني لم يُفعّل بعد. يلزم إعداد حساب Paymob ومفاتيح الدفع وقاعدة البيانات." });
  }

  let body;
  try { body = typeof req.body === "string" ? JSON.parse(req.body) : req.body; }
  catch { return res.status(400).json({ error: "بيانات الطلب غير صالحة." }); }

  const record = body?.gift;
  const phone = String(body?.phone || "").replace(/[\s()-]/g, "");
  if (!record || !/^(?:\+?20)?0?1[0125][0-9]{8}$/.test(phone)) {
    return res.status(400).json({ error: "اكتب رقم موبايل مصري صحيح لإتمام الدفع بالمحفظة." });
  }
  const gift = {
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
  if (!/^[a-z0-9]{6,40}$/i.test(gift.slug) || !gift.from_name || gift.from_name.length > 60 ||
      !gift.to_name || gift.to_name.length > 60 || !gift.message || gift.message.length > 1800 ||
      JSON.stringify(gift).length > 3_800_000) {
    return res.status(400).json({ error: "راجع بيانات الهدية أو قلّل حجم الصور." });
  }

  const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const orderId = crypto.randomUUID();
  const baseUrl = `https://${req.headers["x-forwarded-host"] || req.headers.host}`;
  const phoneInternational = phone.startsWith("+") ? phone : phone.startsWith("20") ? `+${phone}` : `+20${phone.replace(/^0/, "")}`;

  const { error: insertError } = await db.from("gift_orders").insert({
    id: orderId,
    slug: gift.slug,
    gift,
    amount_cents: AMOUNT_CENTS,
    currency: "EGP",
    status: "pending",
    payer_phone: phoneInternational
  });
  if (insertError) {
    console.error("Payment order insert failed:", insertError.message);
    return res.status(500).json({ error: "تعذر تجهيز الطلب. حاول مرة أخرى." });
  }

  let payment;
  try {
    const response = await fetch("https://accept.paymob.com/v1/intention/", {
      method: "POST",
      headers: { Authorization: `Token ${secretKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: AMOUNT_CENTS,
        currency: "EGP",
        payment_methods: [Number(integrationId)],
        items: [{ name: "إنشاء هدية رقمية - لحظتنا", amount: AMOUNT_CENTS, description: "هدية رقمية مخصصة", quantity: 1 }],
        billing_data: {
          apartment: "NA", first_name: gift.from_name.slice(0, 50), last_name: "Lahzetna",
          street: "NA", building: "NA", phone_number: phoneInternational,
          city: "Cairo", country: "EG", email: "customer@lahzetna.com",
          floor: "NA", state: "Cairo", postal_code: "NA"
        },
        special_reference: orderId,
        expiration: 1800,
        notification_url: `${baseUrl}/api/payments/webhook`,
        redirection_url: `${baseUrl}/payment-return?slug=${encodeURIComponent(gift.slug)}`,
        extras: { lahzetna_order_id: orderId, gift_slug: gift.slug }
      })
    });
    payment = await response.json();
    if (!response.ok || !payment.client_secret || !payment.id || !payment.intention_order_id) {
      console.error("Paymob intention failed:", JSON.stringify(payment).slice(0, 1000));
      await db.from("gift_orders").update({ status: "failed" }).eq("id", orderId);
      return res.status(502).json({ error: "بوابة الدفع لم تقبل إنشاء الطلب. تأكد من تفعيل محفظة Orange Cash في حساب Paymob." });
    }
  } catch (error) {
    console.error("Paymob request failed:", error.message);
    await db.from("gift_orders").update({ status: "failed" }).eq("id", orderId);
    return res.status(502).json({ error: "تعذر الاتصال ببوابة الدفع. حاول مرة أخرى." });
  }

  const { error: updateError } = await db.from("gift_orders").update({
    paymob_intention_id: payment.id,
    paymob_order_id: String(payment.intention_order_id)
  }).eq("id", orderId);
  if (updateError) {
    console.error("Could not save Paymob IDs:", updateError.message);
    return res.status(500).json({ error: "تعذر حفظ مرجع الدفع." });
  }

  const checkoutUrl = `https://accept.paymob.com/unifiedcheckout/?publicKey=${encodeURIComponent(publicKey)}&clientSecret=${encodeURIComponent(payment.client_secret)}`;
  return res.status(200).json({ checkoutUrl, orderId });
}
