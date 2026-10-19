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
  let body;
  try { body = typeof req.body === "string" ? JSON.parse(req.body) : req.body; }
  catch { return res.status(400).json({ error: "بيانات الرسالة غير صالحة." }); }
  const toName = String(body?.toName || "الشخص الغالي").trim().slice(0, 60);
  const fromName = String(body?.fromName || "").trim().slice(0, 60);
  const occasion = String(body?.occasion || "بدون مناسبة").trim().slice(0, 80);
  const style = styleNames[body?.style] || styleNames.romantic;
  const currentMessage = String(body?.currentMessage || "").trim().slice(0, 1800);
  if (!apiKey) {
    const fallback = {
      romantic: `يا ${toName}، يمكن الكلام مهما طال مش هيعرف يوصف مكانتك عندي. وجودك بيخلّي الأيام العادية أحلى، وكل ذكرى بينا بتفضل قريبة من قلبي. ${occasion !== "بدون مناسبة" ? "وفي " + occasion + "، " : ""}أتمنى أفضل سبب في ابتسامتك زي ما إنت سبب في حاجات كتير حلوة جوايا. ❤️`,
      apology: `يا ${toName}، أنا عارف إن الكلام لوحده مش كفاية، بس حابب أقولك إن مشاعرك مهمة عندي وإن زعلك مش حاجة أعدّيها كأنها عادية. أتمنى تديني فرصة أسمعك وأفهمك وأصلّح اللي أقدر عليه، من غير ما أضغط عليك. 🤍`,
      friendship: `يا ${toName}، وجودك في حياتي من الحاجات اللي بقدّرها بجد. شكرًا على كل مرة كنت فيها سند، وعلى الضحكة والكلام والذكريات اللي بتخلّي الدنيا أخف. أتمنى تفضل بينا المودة دي وتزيد مع الأيام. 💛`,
      birthday: `كل سنة وإنت طيب يا ${toName}! أتمنى سنتك الجديدة تكون أهدى على قلبك، وأوسع لأحلامك، ومليانة لحظات تستاهل تفتكرها وتبتسم. تستاهل كل خير وفرحة، ويارب اللي جاي يكون أجمل مما تتمنى. 🎂`
    };
    return res.status(200).json({ message: fallback[body?.style] || fallback.romantic, fallback: true, notice: "اتضاف اقتراح جاهز مخصص. لتفعيل الكتابة بالذكاء الاصطناعي فعليًا، أضف OPENAI_API_KEY في Vercel." });
  }
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
