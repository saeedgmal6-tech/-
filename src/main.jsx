import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { createClient } from "@supabase/supabase-js";
import {
  ArrowLeft, ArrowUpLeft, Heart, Sparkles, Gift, Camera, CalendarDays,
  Link2, MessageCircle, ChevronLeft, ChevronRight, Check, Copy, Eye,
  Plus, Trash2, ImagePlus, WandSparkles, Music2, LockKeyhole, Menu, X,
  Clock3, Stars, Flower2, CircleHelp, ExternalLink, Upload, Share2
} from "lucide-react";
import "./styles.css";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
const supabase = SUPABASE_URL && SUPABASE_KEY ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;

const themes = [
  { id: "rose", name: "وردي رومانسي", emoji: "🌷", bg: "linear-gradient(145deg,#fff0f2,#ffe2e8)", accent: "#b83f65" },
  { id: "night", name: "ليلة تحت النجوم", emoji: "🌙", bg: "linear-gradient(145deg,#191c3c,#37345f)", accent: "#e9c7ff" },
  { id: "cream", name: "دفء وحنين", emoji: "🤍", bg: "linear-gradient(145deg,#fff8e9,#f5e7d1)", accent: "#95663f" },
  { id: "garden", name: "حديقة حب", emoji: "🌿", bg: "linear-gradient(145deg,#edf6e9,#d5e7d0)", accent: "#487b52" },
];
const occasions = ["بدون مناسبة", "عيد ميلاد", "ذكرى سنوية", "عيد الحب", "اعتذار من القلب", "مجرد إني بحبك"];
const localKey = "lahzetna_gifts_v1";

function readLocal() {
  try { return JSON.parse(localStorage.getItem(localKey) || "[]"); } catch { return []; }
}
function saveLocal(items) { localStorage.setItem(localKey, JSON.stringify(items)); }
function slug() { return Math.random().toString(36).slice(2, 7) + Date.now().toString(36).slice(-5); }
function fmtDate(value) {
  if (!value) return "";
  try { return new Date(value + "T12:00:00").toLocaleDateString("ar-EG", {year:"numeric",month:"long",day:"numeric"}); } catch { return value; }
}
function App() {
  const [page, setPage] = useState("home");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [gifts, setGifts] = useState(readLocal);
  const [activeGift, setActiveGift] = useState(null);
  const [toast, setToast] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "حكايتنا لسه مكملة", fromName: "", toName: "", message: "في وسط كل الأيام العادية، إنت أجمل حاجة حصلتلي. كل لحظة معاك بتستاهل تتحكي، وكل ذكرى بينا ليها مكان خاص في قلبي. ❤️",
    date: "", occasion: "مجرد إني بحبك", theme: "rose", photos: [], cover: "", music: false
  });
  const [giftLoading, setGiftLoading] = useState(false);

  useEffect(() => {
    const path = window.location.pathname;
    const match = path.match(/^\/g\/([^/]+)/);
    if (match) {
      loadGift(match[1]);
    }
  }, []);

  useEffect(() => { saveLocal(gifts); }, [gifts]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  async function loadGift(id) {
    setGiftLoading(true);
    let found = null;
    if (supabase) {
      const { data, error } = await supabase.from("gifts").select("*").eq("slug", id).maybeSingle();
      if (!error && data) found = data;
    }
    if (!found) found = readLocal().find(g => g.slug === id) || null;
    setActiveGift(found);
    setPage("view");
    setGiftLoading(false);
  }

  const theme = themes.find(t => t.id === form.theme) || themes[0];
  const setField = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  async function handlePhoto(event) {
    const picked = Array.from(event.target.files || []);
    if (!picked.length) return;
    const available = Math.max(0, 5 - form.photos.length);
    const chosen = picked.slice(0, available);
    const readFiles = await Promise.all(chosen.map(file => new Promise(resolve => {
      if (!file.type.startsWith("image/")) return resolve(null);
      const reader = new FileReader();
      reader.onload = () => {
        const image = new Image();
        image.onload = () => {
          // Resize/compress uploads to keep the local demo and database payload manageable.
          const maxSide = 1400;
          const ratio = Math.min(1, maxSide / Math.max(image.width, image.height));
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(image.width * ratio));
          canvas.height = Math.max(1, Math.round(image.height * ratio));
          const ctx = canvas.getContext("2d");
          if (!ctx) return resolve({ name: file.name, data: reader.result });
          ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
          resolve({ name: file.name, data: canvas.toDataURL("image/jpeg", 0.78) });
        };
        image.onerror = () => resolve(null);
        image.src = reader.result;
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    })));
    const valid = readFiles.filter(Boolean);
    setForm(prev => ({ ...prev, photos: [...prev.photos, ...valid], cover: prev.cover || valid[0]?.data || "" }));
    event.target.value = "";
  }

  async function createGift(e) {
    e?.preventDefault();
    if (!form.toName.trim() || !form.fromName.trim() || !form.message.trim()) {
      setToast("اكتب اسم المُهدى إليه واسمك والرسالة الأول.");
      return;
    }
    setSaving(true);
    const record = {
      slug: slug(),
      title: form.title.trim() || `هدية إلى ${form.toName}`,
      from_name: form.fromName.trim(),
      to_name: form.toName.trim(),
      message: form.message.trim(),
      date: form.date || null,
      occasion: form.occasion,
      theme: form.theme,
      photos: form.photos.map(p => p.data),
      cover: form.cover || form.photos[0]?.data || "",
      music: !!form.music,
      created_at: new Date().toISOString()
    };
    let persisted = false;
    if (supabase) {
      const { data, error } = await supabase.from("gifts").insert(record).select().single();
      if (!error && data) {
        setGifts(prev => [data, ...prev.filter(g => g.slug !== data.slug)]);
        setActiveGift(data);
        persisted = true;
      } else {
        console.error("Supabase save failed:", error);
      }
    }
    if (!persisted) {
      const localRecord = { ...record, id: record.slug, storage_mode: "local" };
      setGifts(prev => [localRecord, ...prev.filter(g => g.slug !== localRecord.slug)]);
      setActiveGift(localRecord);
    }
    setSaving(false);
    setPage("success");
    window.history.pushState({}, "", `/g/${record.slug}`);
    if (!persisted) setToast("اتعملت معاينة محفوظة على الجهاز. فعّل Supabase علشان الرابط يفتح عند أي شخص.");
  }

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const shareUrl = activeGift ? `${baseUrl}/g/${activeGift.slug}` : "";
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setToast("تم نسخ رابط الهدية");
    } catch {
      window.prompt("انسخ الرابط من هنا:", shareUrl);
    }
  }
  function whatsappShare() {
    const text = `عملتلك هدية مخصوص من قلبي ❤️\n${shareUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  }
  function openGift(gift) {
    setActiveGift(gift);
    setPage("view");
    window.history.pushState({}, "", `/g/${gift.slug}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function startCreate() {
    setActiveGift(null);
    setPage("create");
    window.history.pushState({}, "", "/");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function goHome() {
    setPage("home");
    setActiveGift(null);
    window.history.pushState({}, "", "/");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const giftTheme = themes.find(t => t.id === (activeGift?.theme || "rose")) || themes[0];

  return (
    <div className="app" dir="rtl">
      <header className="topbar">
        <div className="nav-shell">
          <button className="brand" onClick={goHome} aria-label="لحظتنا الرئيسية">
            <span className="brand-mark"><Heart size={22} fill="currentColor" /></span>
            <span className="brand-text"><strong>لحظتنا</strong><small>LAHZETNA</small></span>
          </button>
          <nav className={mobileMenu ? "nav-links open" : "nav-links"}>
            <button onClick={goHome}>الرئيسية</button>
            <button onClick={() => {setPage("how");setMobileMenu(false)}}>إزاي بتشتغل؟</button>
            <button onClick={() => {setPage("mygifts");setMobileMenu(false)}}>هداياي</button>
            <button className="nav-cta" onClick={startCreate}>اصنع هديتك <ArrowLeft size={16}/></button>
          </nav>
          <button className="menu-toggle" onClick={() => setMobileMenu(!mobileMenu)} aria-label="القائمة">{mobileMenu ? <X/> : <Menu/>}</button>
        </div>
      </header>

      {page === "home" && <Home gifts={gifts} startCreate={startCreate} openGift={openGift} setPage={setPage} />}
      {page === "how" && <How startCreate={startCreate} />}
      {page === "create" && <CreatePage form={form} setField={setField} themes={themes} theme={theme} handlePhoto={handlePhoto} createGift={createGift} saving={saving} />}
      {page === "success" && <Success gift={activeGift} shareUrl={shareUrl} copyLink={copyLink} whatsappShare={whatsappShare} startCreate={startCreate} openGift={() => openGift(activeGift)} />}
      {page === "view" && <GiftView gift={activeGift} theme={giftTheme} loading={giftLoading} goHome={goHome} startCreate={startCreate} />}
      {page === "mygifts" && <MyGifts gifts={gifts} openGift={openGift} startCreate={startCreate} setGifts={setGifts} setToast={setToast} />}
      <footer className="footer">
        <div className="footer-inner">
          <button className="brand footer-brand" onClick={goHome}><span className="brand-mark"><Heart size={20} fill="currentColor"/></span><span className="brand-text"><strong>لحظتنا</strong><small>LAHZETNA</small></span></button>
          <p>لأن أجمل المشاعر تستاهل تتقال بطريقة مختلفة. <Heart size={13} fill="currentColor"/></p>
          <span className="copyright">صُنعت بحب © {new Date().getFullYear()}</span>
        </div>
      </footer>
      {toast && <div className="toast"><Check size={17}/>{toast}</div>}
    </div>
  );
}

function Home({ gifts, startCreate, openGift, setPage }) {
  return <>
    <main>
      <section className="hero section-wrap">
        <div className="hero-copy">
          <div className="eyebrow"><Sparkles size={15}/> هدية مختلفة.. ذكرى تعيش</div>
          <h1>مش مجرد هدية،<br/><span>دي حكاية بينكم.</span></h1>
          <p className="hero-lead">حوّل مشاعرك وذكرياتكم لهدية رقمية شخصية، فيها كلامك وصوركم وتفاصيلكم الصغيرة — وشاركها برابط من القلب.</p>
          <div className="hero-actions">
            <button className="btn btn-primary" onClick={startCreate}>ابدأ اصنع هديتك <ArrowLeft size={18}/></button>
            <button className="btn btn-quiet" onClick={() => setPage("how")}><Eye size={17}/> شوف إزاي بتشتغل</button>
          </div>
          <div className="hero-trust"><span className="avatars"><i>♥</i><i>✿</i><i>∞</i></span><span>كل قصة حب ليها طريقتها</span><span className="trust-dot">•</span><span>تفاصيل من اختيارك</span></div>
        </div>
        <div className="hero-art">
          <div className="float-tag tag-top"><Heart size={15} fill="currentColor"/> معمول مخصوص ليك</div>
          <div className="polaroid polaroid-back"><div className="abstract-photo photo-2"><Flower2 size={50}/></div><span>little moments</span></div>
          <div className="polaroid polaroid-front"><div className="abstract-photo photo-1"><div className="sun-glow"></div><Heart size={60} fill="currentColor"/></div><div className="polaroid-caption"><strong>حكايتنا</strong><small>أجمل صدفة في حياتي</small></div></div>
          <div className="floating-heart fh1">♡</div><div className="floating-heart fh2">✦</div><div className="float-tag tag-bottom"><Sparkles size={14}/> ذكرى بتفضل</div>
          <div className="hero-orbit"></div>
        </div>
        <div className="hero-bottom-note"><span className="note-line"></span> لحظات صغيرة.. مشاعر كبيرة <span className="note-line"></span></div>
      </section>

      <section className="feature-strip section-wrap">
        <div className="feature-item"><span className="feature-icon pink"><Heart size={20}/></span><div><strong>من القلب للقلب</strong><small>رسالتك بكلامك أنت</small></div></div>
        <div className="feature-item"><span className="feature-icon peach"><Camera size={20}/></span><div><strong>صور وذكرياتكم</strong><small>خلي اللحظات تحكي</small></div></div>
        <div className="feature-item"><span className="feature-icon lilac"><Link2 size={20}/></span><div><strong>رابط خاص</strong><small>شاركها في ثانية</small></div></div>
        <div className="feature-item"><span className="feature-icon green"><LockKeyhole size={20}/></span><div><strong>تفاصيلك باختيارك</strong><small>صممها زي ما تحب</small></div></div>
      </section>

      <section className="section-wrap how-preview">
        <div className="section-heading"><div><span className="eyebrow">بكل بساطة</span><h2>هدية من 3 خطوات</h2></div><button className="text-link" onClick={() => setPage("how")}>اعرف أكتر <ArrowLeft size={16}/></button></div>
        <div className="steps-grid">
          <div className="step-card"><span className="step-number">01</span><div className="step-visual visual-one"><Heart size={38} fill="currentColor"/><Sparkles className="spark spark-a"/><Sparkles className="spark spark-b"/></div><h3>احكي حكايتكم</h3><p>اكتب الأسماء والرسالة والتاريخ اللي ليه معنى عندكم.</p></div>
          <div className="step-card"><span className="step-number">02</span><div className="step-visual visual-two"><Camera size={36}/><Flower2 className="flower-small"/></div><h3>اختار شكلها</h3><p>ضيف صوركم واختار الثيم اللي شبه إحساسك.</p></div>
          <div className="step-card"><span className="step-number">03</span><div className="step-visual visual-three"><Link2 size={36}/><Heart className="link-heart" fill="currentColor"/></div><h3>شارك اللحظة</h3><p>أنشئ رابط هديتك وابعته للشخص اللي يستاهلها.</p></div>
        </div>
      </section>

      <section className="section-wrap themes-section">
        <div className="section-heading centered"><span className="eyebrow">كل حكاية وليها لون</span><h2>اختار الجو اللي شبهكم</h2><p>من ورد رقيق لليلة مليانة نجوم، خليك صاحب التفاصيل.</p></div>
        <div className="theme-showcase">
          <div className="theme-show theme-rose"><span>🌷</span><strong>وردي رومانسي</strong><small>حنية ودفا</small></div>
          <div className="theme-show theme-night"><span>🌙</span><strong>ليلة تحت النجوم</strong><small>لحظة مش شبه أي لحظة</small></div>
          <div className="theme-show theme-cream"><span>🤍</span><strong>دفء وحنين</strong><small>بساطة من القلب</small></div>
          <div className="theme-show theme-garden"><span>🌿</span><strong>حديقة حب</strong><small>بداية حكاية جديدة</small></div>
        </div>
        <div className="center-button"><button className="btn btn-primary" onClick={startCreate}>يلا نعمل هدية <ArrowLeft size={18}/></button></div>
      </section>

      <section className="closing-cta section-wrap">
        <div className="closing-decoration deco-left">✦</div><div className="closing-decoration deco-right">♡</div>
        <span className="eyebrow"><Heart size={14} fill="currentColor"/> كلمة واحدة ممكن تفرق</span>
        <h2>في كلام كتير بيتحس،<br/>بس مستني طريقة يتقال بيها.</h2>
        <p>ابدأ هديتك دلوقتي وخلي الشخص اللي بتحبه يبتسم.</p>
        <button className="btn btn-light" onClick={startCreate}>اصنع لحظتكم <ArrowLeft size={18}/></button>
      </section>
      {gifts.length > 0 && <section className="section-wrap recent-section"><div className="section-heading"><div><span className="eyebrow">رجوع لذكرياتك</span><h2>هداياك الأخيرة</h2></div><button className="text-link" onClick={() => setPage("mygifts")}>كل الهدايا <ArrowLeft size={16}/></button></div><div className="recent-grid">{gifts.slice(0,3).map(g => <button className="recent-card" key={g.slug} onClick={() => openGift(g)}><span className="recent-emoji">{(themes.find(t=>t.id===g.theme)||themes[0]).emoji}</span><strong>{g.title || `هدية إلى ${g.to_name}`}</strong><small>إلى {g.to_name}</small><ArrowLeft size={16}/></button>)}</div></section>}
    </main>
  </>;
}

function How({ startCreate }) {
  return <main className="inner-page section-wrap">
    <div className="page-intro"><span className="eyebrow"><Sparkles size={15}/> حكايتك تبدأ هنا</span><h1>إزاي بتشتغل <span>لحظتنا؟</span></h1><p>في خطوات بسيطة، تقدر تعمل هدية شخصية بتفاصيلكم وتوصلها للشخص اللي بتحبه.</p></div>
    <div className="how-list">
      {[
        ["01","اكتب تفاصيلكم","اختار عنوان للهدية، واكتب اسمك واسم الشخص ورسالة من قلبك. ممكن كمان تضيف تاريخ مميز أو مناسبة."],
        ["02","ضيف صوركم واختار الثيم","ارفع لحد 5 صور، واختار من الثيمات المتاحة عشان شكل الهدية يبقى على ذوقك."],
        ["03","راجع الهدية قبل ما تنشئها","شوف معاينة التصميم وعدّل أي تفصيلة قبل الحفظ."],
        ["04","شارك الرابط","بعد الإنشاء هتاخد رابط خاص تقدر تنسخه أو تبعته مباشرة على واتساب."]
      ].map(([n,t,d])=><div className="how-row" key={n}><span className="how-number">{n}</span><div><h3>{t}</h3><p>{d}</p></div><Heart className="how-heart" size={22}/></div>)}
    </div>
    <div className="notice"><LockKeyhole size={20}/><div><strong>خصوصية هديتك</strong><p>النسخة المحلية تحفظ الهدايا على نفس الجهاز فقط. علشان الروابط تفتح عند أي شخص ويكون الحفظ دائمًا على الإنترنت، لازم تفعيل Supabase من إعدادات المشروع.</p></div></div>
    <div className="center-button"><button className="btn btn-primary" onClick={startCreate}>ابدأ إنشاء هديتك <ArrowLeft size={18}/></button></div>
  </main>;
}

function CreatePage({ form, setField, themes, theme, handlePhoto, createGift, saving }) {
  const [preview, setPreview] = useState(false);
  return <main className="create-page section-wrap">
    <div className="page-intro compact"><span className="eyebrow"><WandSparkles size={15}/> تفاصيل من اختيارك</span><h1>اصنع <span>هديتك الخاصة</span></h1><p>خد وقتك، كل تفصيلة صغيرة بتخلي الهدية شبهكم أكتر.</p></div>
    <div className="builder-layout">
      <form className="builder-form" onSubmit={createGift}>
        <div className="form-section">
          <div className="form-section-title"><span className="form-icon"><Heart size={19}/></span><div><h2>الحكاية بتبدأ بمين؟</h2><p>خلينا نعرف الهدية لمين ومن مين.</p></div></div>
          <label>عنوان الهدية<input value={form.title} onChange={e=>setField("title",e.target.value)} placeholder="مثلاً: حكايتنا لسه مكملة" maxLength={90}/></label>
          <div className="field-grid"><label>اسمك<input value={form.fromName} onChange={e=>setField("fromName",e.target.value)} placeholder="اسمك" required maxLength={60}/></label><label>اسم الشخص<input value={form.toName} onChange={e=>setField("toName",e.target.value)} placeholder="اسم حبيبك" required maxLength={60}/></label></div>
          <label>المناسبة<select value={form.occasion} onChange={e=>setField("occasion",e.target.value)}>{occasions.map(o=><option key={o}>{o}</option>)}</select></label>
          <label>التاريخ المميز <span className="optional">(اختياري)</span><div className="input-icon"><CalendarDays size={18}/><input type="date" value={form.date} onChange={e=>setField("date",e.target.value)}/></div></label>
        </div>
        <div className="form-section">
          <div className="form-section-title"><span className="form-icon"><MessageCircle size={19}/></span><div><h2>رسالتك من القلب</h2><p>اكتب الكلام اللي نفسك الشخص ده يسمعه منك.</p></div></div>
          <label>الرسالة<textarea value={form.message} onChange={e=>setField("message",e.target.value)} rows={6} maxLength={1800} required placeholder="اكتب رسالتك هنا..."/></label>
          <div className="textarea-foot"><span>خليها بكلامك، ده اللي بيفرق ❤️</span><span>{form.message.length}/1800</span></div>
        </div>
        <div className="form-section">
          <div className="form-section-title"><span className="form-icon"><Camera size={19}/></span><div><h2>صور بتحكي</h2><p>ضيف لحد 5 صور من الذكريات اللي بتحبوها.</p></div></div>
          <label className="upload-box"><input type="file" accept="image/*" multiple onChange={handlePhoto} hidden/><span className="upload-icon"><ImagePlus size={25}/></span><strong>اضغط لاختيار الصور</strong><small>JPG أو PNG — حتى 5 صور</small><span className="upload-button"><Upload size={15}/> اختار الصور</span></label>
          {form.photos.length > 0 && <div className="uploaded-grid">{form.photos.map((p,i)=><div className="uploaded-photo" key={i}><img src={p.data} alt={`صورة ${i+1}`}/><button type="button" onClick={()=>setField("photos",form.photos.filter((_,j)=>i!==j))} aria-label="حذف الصورة"><Trash2 size={15}/></button></div>)}</div>}
          <label className="check-row"><input type="checkbox" checked={form.music} onChange={e=>setField("music",e.target.checked)}/><span className="check-custom"><Check size={13}/></span><span><strong>إظهار لمسة موسيقية في التصميم</strong><small>عرض رمز موسيقى زخرفي (لا يشغّل صوتًا تلقائيًا).</small></span><Music2 size={19}/></label>
        </div>
        <div className="form-section">
          <div className="form-section-title"><span className="form-icon"><Flower2 size={19}/></span><div><h2>اختار الثيم</h2><p>خلي شكل الهدية يعكس إحساسك.</p></div></div>
          <div className="theme-options">{themes.map(t=><button type="button" key={t.id} className={`theme-option ${form.theme===t.id?"selected":""} option-${t.id}`} onClick={()=>setField("theme",t.id)}><span className="theme-swatch">{t.emoji}</span><span>{t.name}</span>{form.theme===t.id&&<Check size={16}/>}</button>)}</div>
        </div>
        <div className="builder-actions"><button type="button" className="btn btn-outline" onClick={()=>setPreview(!preview)}><Eye size={17}/>{preview?"إخفاء المعاينة":"معاينة الهدية"}</button><button type="submit" className="btn btn-primary" disabled={saving}>{saving?"جاري الحفظ...":"أنشئ هديتي"} <ArrowLeft size={17}/></button></div>
        {preview && <div className="mobile-preview"><GiftPreview form={form} theme={theme}/></div>}
      </form>
      <aside className="preview-column"><div className="preview-sticky"><div className="preview-label"><Eye size={16}/> معاينة مباشرة</div><GiftPreview form={form} theme={theme}/><p className="preview-tip"><Sparkles size={15}/> المعاينة بتتغير مع كل تعديل.</p></div></aside>
    </div>
  </main>;
}

function GiftPreview({ form, theme }) {
  return <div className={`gift-preview preview-${form.theme}`} style={{background:theme.bg, "--gift-accent":theme.accent}}>
    <div className="preview-topline"><span>LAHZETNA</span><Heart size={16} fill="currentColor"/></div>
    <div className="preview-content">
      <span className="preview-kicker">{form.occasion || "هدية من القلب"}</span>
      <div className="preview-heart"><Heart size={34} fill="currentColor"/></div>
      <h3>{form.title || "حكايتنا لسه مكملة"}</h3>
      <div className="preview-names"><span>{form.fromName || "اسمك"}</span><Heart size={13} fill="currentColor"/><span>{form.toName || "اسم حبيبك"}</span></div>
      {form.cover ? <img className="preview-cover" src={form.cover} alt="صورة الهدية"/> : <div className="preview-placeholder"><Flower2 size={34}/><span>ذكرياتكم هنا</span></div>}
      <p className="preview-message">{form.message || "رسالتك من القلب هتظهر هنا..."}</p>
      {form.date && <div className="preview-date"><CalendarDays size={14}/>{fmtDate(form.date)}</div>}
      {form.music && <div className="preview-music"><Music2 size={13}/> لمسة موسيقية</div>}
      <div className="preview-signature">صُنعت بحب <Heart size={11} fill="currentColor"/></div>
    </div>
  </div>;
}

function Success({ gift, shareUrl, copyLink, whatsappShare, startCreate, openGift }) {
  if (!gift) return <div className="inner-page section-wrap"><h1>مفيش هدية محددة</h1><button className="btn btn-primary" onClick={startCreate}>ابدأ من جديد</button></div>;
  const localOnly = gift.storage_mode === "local";
  return <main className="success-page section-wrap">
    <div className="success-icon"><Check size={36}/></div><span className="eyebrow">لحظة حلوة اتعملت</span>
    <h1>هديتك بقت <span>جاهزة ❤️</span></h1>
    <p className="success-lead">هدية مخصوصة من {gift.from_name} إلى {gift.to_name}. تقدر تشوفها وتشارك رابطها.</p>
    <div className="success-card"><GiftPreview form={{title:gift.title,fromName:gift.from_name,toName:gift.to_name,message:gift.message,date:gift.date,occasion:gift.occasion,theme:gift.theme,cover:gift.cover,photos:(gift.photos||[]).map(data=>({data})),music:gift.music}} theme={themes.find(t=>t.id===gift.theme)||themes[0]}/></div>
    <div className="share-panel"><div className="share-heading"><Link2 size={19}/><div><strong>رابط هديتك</strong><small>انسخه وابعته للشخص اللي بتحبه</small></div></div><div className="share-link-row"><span>{shareUrl}</span><button onClick={copyLink} className="copy-btn"><Copy size={16}/> نسخ</button></div><button className="btn whatsapp-btn" onClick={whatsappShare}><MessageCircle size={19}/> مشاركة على واتساب</button>
      {localOnly && <div className="warning-note"><CircleHelp size={17}/><span>الحفظ الحالي على نفس الجهاز فقط. علشان الرابط يفتح من موبايل الشخص التاني، فعّل قاعدة بيانات Supabase واتبع ملف README.</span></div>}
    </div>
    <div className="success-actions"><button className="btn btn-outline" onClick={openGift}><Eye size={17}/> عرض الهدية</button><button className="btn btn-primary" onClick={startCreate}><Plus size={17}/> اعمل هدية تانية</button></div>
  </main>;
}

function GiftView({ gift, theme, loading, goHome, startCreate }) {
  if (loading) return <main className="view-page section-wrap"><div className="loader"></div><p>بنفتح هديتك...</p></main>;
  if (!gift) return <main className="not-found section-wrap"><span className="not-found-icon">♡</span><h1>الهدية دي مش موجودة</h1><p>ممكن الرابط غلط، أو الهدية محفوظة على جهاز تاني ولسه قاعدة البيانات مش متفعّلة.</p><button className="btn btn-primary" onClick={goHome}>ارجع للرئيسية</button></main>;
  const photos = Array.isArray(gift.photos) ? gift.photos : [];
  return <main className="view-page section-wrap">
    <div className="view-top"><button className="text-link" onClick={goHome}><ChevronRight size={17}/> الرئيسية</button><span><Heart size={14} fill="currentColor"/> لحظتنا</span></div>
    <article className={`full-gift full-${gift.theme||"rose"}`} style={{background:theme.bg,"--gift-accent":theme.accent}}>
      <div className="full-gift-inner">
        <div className="full-brand"><Heart size={18} fill="currentColor"/> LAHZETNA</div>
        <span className="full-kicker">{gift.occasion || "هدية من القلب"}</span>
        <div className="full-heart"><Heart size={50} fill="currentColor"/></div>
        <h1>{gift.title || "حكايتنا لسه مكملة"}</h1>
        <div className="full-names"><span>{gift.from_name}</span><Heart size={18} fill="currentColor"/><span>{gift.to_name}</span></div>
        {(gift.cover || photos.length>0) && <img className="full-cover" src={gift.cover || photos[0]} alt="ذكرى خاصة"/>}
        <div className="full-message">{gift.message}</div>
        {gift.date && <div className="full-date"><CalendarDays size={16}/>{fmtDate(gift.date)}</div>}
        {photos.length > 1 && <div className="full-gallery">{photos.slice(0,5).map((p,i)=><img key={i} src={typeof p==="string"?p:p.data} alt={`ذكرى ${i+1}`}/>)}</div>}
        {gift.music && <div className="preview-music"><Music2 size={14}/> لمسة موسيقية</div>}
        <div className="full-signature">اتعملت بكل حب <Heart size={14} fill="currentColor"/></div>
      </div>
    </article>
    <div className="view-bottom"><p>كل لحظة حلوة تستاهل تتفتكر.</p><button className="btn btn-primary" onClick={startCreate}>اصنع هدية زي دي <ArrowLeft size={17}/></button></div>
  </main>;
}

function MyGifts({ gifts, openGift, startCreate, setGifts, setToast }) {
  function removeGift(gift) {
    if (!window.confirm("متأكد إنك عايز تحذف الهدية دي من الجهاز؟")) return;
    setGifts(prev=>prev.filter(g=>g.slug!==gift.slug));
    if (supabase) supabase.from("gifts").delete().eq("slug",gift.slug).then(({error})=>{if(error) console.error(error);});
    setToast("تم حذف الهدية من القائمة");
  }
  return <main className="inner-page section-wrap mygifts-page">
    <div className="page-intro"><span className="eyebrow"><Heart size={15}/> ذكرياتك</span><h1>هدايا <span>لحظتنا</span></h1><p>كل هدية عملتها هتلاقيها هنا على الجهاز ده.</p></div>
    {gifts.length===0 ? <div className="empty-state"><span className="empty-heart"><Gift size={34}/></span><h2>لسه مفيش هدايا</h2><p>أول هدية ممكن تكون بداية ذكرى جميلة.</p><button className="btn btn-primary" onClick={startCreate}>اصنع أول هدية <ArrowLeft size={17}/></button></div> :
      <div className="gifts-grid">{gifts.map(g=><div className="gift-list-card" key={g.slug}><button className={`gift-list-cover cover-${g.theme||"rose"}`} onClick={()=>openGift(g)}>{g.cover?<img src={g.cover} alt=""/>:<Heart size={40} fill="currentColor"/>}<span>{(themes.find(t=>t.id===g.theme)||themes[0]).emoji}</span></button><div className="gift-list-body"><small>إلى {g.to_name}</small><h3>{g.title||`هدية إلى ${g.to_name}`}</h3><p>{g.message?.slice(0,90)}{(g.message||"").length>90?"…":""}</p><div className="gift-list-actions"><button onClick={()=>openGift(g)}><Eye size={15}/> عرض</button><button onClick={()=>{navigator.clipboard?.writeText(`${window.location.origin}/g/${g.slug}`).then(()=>setToast("تم نسخ الرابط")).catch(()=>window.prompt("انسخ الرابط",`${window.location.origin}/g/${g.slug}`));}}><Copy size={15}/> نسخ الرابط</button><button className="delete-action" onClick={()=>removeGift(g)} aria-label="حذف"><Trash2 size={15}/></button></div></div></div>)}</div>}
  </main>;
}

createRoot(document.getElementById("root")).render(<App />);
