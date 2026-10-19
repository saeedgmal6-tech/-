import { createClient } from "@supabase/supabase-js";

const esc = value => String(value || "").replace(/[&<>"']/g, ch => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[ch]));
const meta = (html, selector, value) => {
  const tag = selector.startsWith("property=") ? "property" : "name";
  const name = selector.slice(selector.indexOf("=") + 1);
  const escaped = esc(value);
  const pattern = new RegExp('<meta\\s+' + tag + '="' + name + '"[^>]*>', "i");
  const replacement = '<meta ' + tag + '="' + name + '" content="' + escaped + '" />';
  return pattern.test(html) ? html.replace(pattern, replacement) : html.replace("</head>", "    " + replacement + "\n  </head>");
};

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();
  const slug = String(req.query?.slug || "");
  if (!/^[a-z0-9]{6,40}$/i.test(slug)) return res.status(404).end("الهدية غير موجودة");
  let title = "هدية من القلب | لحظتنا";
  let description = "فيه حكاية خاصة مستنياك على لحظتنا ❤️";
  let imageUrl = "https://lahzetna.vercel.app/icon.svg";
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && key) {
    try {
      const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
      const { data } = await db.from("gifts").select("title,from_name,to_name,message,cover,photos").eq("slug", slug).maybeSingle();
      if (data) {
        const photos = Array.isArray(data.photos) ? data.photos : [];
        const metaItem = photos.find(item => item && typeof item === "object" && item.__lahzetna_meta);
        const meta = metaItem?.__lahzetna_meta || {};
        const expired = meta.expires_at && new Date(meta.expires_at + "T23:59:59").getTime() < Date.now();
        const scheduled = meta.open_at && Date.parse(meta.open_at) > Date.now();
        if (!expired && !scheduled) {
          title = data.title || ("هدية إلى " + (data.to_name || "شخص مميز"));
          description = "هدية مخصوصة من " + (data.from_name || "شخص بيحبك") + " إلى " + (data.to_name || "شخص مميز") + " ❤️";
          if (typeof data.cover === "string" && data.cover.startsWith("https://")) imageUrl = data.cover;
        }
      }
    } catch (error) { console.error("Gift preview metadata lookup failed:", error?.message || error); }
  }
  let html;
  try {
    const response = await fetch("https://lahzetna.vercel.app/index.html", { cache: "no-store" });
    if (!response.ok) throw new Error("Could not load app shell");
    html = await response.text();
  } catch {
    html = '<!doctype html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>لحظتنا</title></head><body><div id="root"></div><script type="module" src="/src/main.jsx"></script></body></html>';
  }
  html = meta(html, "property=og:title", title);
  html = meta(html, "property=og:description", description);
  html = meta(html, "property=og:url", "https://lahzetna.vercel.app/g/" + slug);
  html = meta(html, "property=og:image", imageUrl);
  html = meta(html, "name=description", description);
  html = meta(html, "name=twitter:card", "summary_large_image");
  html = meta(html, "name=twitter:title", title);
  html = meta(html, "name=twitter:description", description);
  html = meta(html, "name=twitter:image", imageUrl);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
  return res.status(200).send(html);
}
