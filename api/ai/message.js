const styleNames = {
  romantic: "رومانسية دافئة وصادقة",
  apology: "اعتذار صادق ومسؤول من غير ضغط على الطرف الآخر",
  friendship: "صداقة وامتنان",
  birthday: "عيد ميلاد مبهج وشخصي"
};

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(503).json({ error: "مساعد الرسائل محتاج مفتاح OPENAI_API_KEY في إعدادات Vercel. باقي الموقع يشتغل عادي من غيره." });
  let body;
  try { body = typeof req.body === "string" ? JSON.parse(req.body) : req.body; }
  catch { return res.status(400).json({ error: "بيانات الرسالة غير صالحة." }); }
  const toName = String(body?.toName || "الشخص الغالي").trim().slice(0, 60);
  const fromName = String(body?.fromName || "").trim().slice(0, 60);
  const occasion = String(body?.occasion || "بدون مناسبة").trim().slice(0, 80);
  const style = styleNames[body?.style] || styleNames.romantic;
  const currentMessage = String(body?.currentMessage || "").trim().slice(0, 1800);
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: "Bearer " + apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.85,
        max_tokens: 550,
        messages: [
          { role: "system", content: "أنت كاتب رسائل شخصية بارع. اكتب رسالة عربية باللهجة المصرية الطبيعية، أصلية ومحددة وليست مبتذلة. لا تضف مقدمة أو عنوانًا أو علامات اقتباس. لا تدّعِ تفاصيل لم يذكرها المستخدم. لا تتجاوز 150 كلمة." },
          { role: "user", content: `اكتب رسالة ${style}. اسم المرسل: ${fromName || "غير محدد"}. اسم المستلم: ${toName}. المناسبة: ${occasion}. النص الحالي للاستلهام فقط وليس شرطًا نسخه: ${currentMessage || "لا يوجد"}.` }
        ]
      })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error("AI message generation failed:", response.status, JSON.stringify(data).slice(0, 300));
      return res.status(502).json({ error: "تعذر توليد الرسالة الآن. حاول مرة أخرى بعد قليل." });
    }
    const message = String(data.choices?.[0]?.message?.content || "").trim().slice(0, 1800);
    if (!message) return res.status(502).json({ error: "المساعد لم يرجع رسالة. جرّب مرة أخرى." });
    return res.status(200).json({ message });
  } catch (error) {
    console.error("AI message endpoint error:", error.message);
    return res.status(502).json({ error: "تعذر الاتصال بمساعد الرسائل." });
  }
}
