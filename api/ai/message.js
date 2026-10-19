const suggestions = {
  romantic: (toName, occasion) => `يا ${toName}، يمكن الكلام مهما طال مش هيعرف يوصف مكانتك عندي. وجودك بيخلّي الأيام العادية أحلى، وكل ذكرى بينا بتفضل قريبة من قلبي. ${occasion !== "بدون مناسبة" ? "وفي " + occasion + "، " : ""}أتمنى أفضل سبب في ابتسامتك زي ما إنت سبب في حاجات كتير حلوة جوايا. ❤️`,
  apology: (toName) => `يا ${toName}، أنا عارف إن الكلام لوحده مش كفاية، بس حابب أقولك إن مشاعرك مهمة عندي وإن زعلك مش حاجة أعدّيها كأنها عادية. أتمنى تديني فرصة أسمعك وأفهمك وأصلّح اللي أقدر عليه، من غير ما أضغط عليك. 🤍`,
  friendship: (toName) => `يا ${toName}، وجودك في حياتي من الحاجات اللي بقدّرها بجد. شكرًا على كل مرة كنت فيها سند، وعلى الضحكة والكلام والذكريات اللي بتخلّي الدنيا أخف. أتمنى تفضل بينا المودة دي وتزيد مع الأيام. 💛`,
  birthday: (toName) => `كل سنة وإنت طيب يا ${toName}! أتمنى سنتك الجديدة تكون أهدى على قلبك، وأوسع لأحلامك، ومليانة لحظات تستاهل تفتكرها وتبتسم. تستاهل كل خير وفرحة، ويارب اللي جاي يكون أجمل مما تتمنى. 🎂`
};

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  let body;
  try { body = typeof req.body === "string" ? JSON.parse(req.body) : req.body; }
  catch { return res.status(400).json({ error: "بيانات الرسالة غير صالحة." }); }

  const toName = String(body?.toName || "الشخص الغالي").trim().slice(0, 60);
  const occasion = String(body?.occasion || "بدون مناسبة").trim().slice(0, 80);
  const style = suggestions[body?.style] ? body.style : "romantic";
  const message = suggestions[style](toName, occasion);
  return res.status(200).json({ message, suggestionsOnly: true });
}
