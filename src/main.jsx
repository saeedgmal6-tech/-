import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { createClient } from "@supabase/supabase-js";
import {
  ArrowLeft, ArrowUpLeft, Heart, Sparkles, Gift, Camera, CalendarDays,
  Link2, MessageCircle, ChevronLeft, ChevronRight, Check, Copy, Eye,
  Plus, Trash2, ImagePlus, WandSparkles, Music2, LockKeyhole, Menu, X,
  Clock3, Stars, Flower2, CircleHelp, ExternalLink, Upload, Share2, Video
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
  { id: "sunset", name: "غروب دافئ", emoji: "🌅", bg: "linear-gradient(145deg,#fff0df,#f8c6b8)", accent: "#a94f42" },
  { id: "lavender", name: "لافندر هادئ", emoji: "🪻", bg: "linear-gradient(145deg,#f4edff,#ded2f7)", accent: "#7655a5" },
  { id: "ocean", name: "نسمة بحر", emoji: "🌊", bg: "linear-gradient(145deg,#e4f7fb,#c5e6ef)", accent: "#276c83" },
  { id: "midnight", name: "منتصف الليل", emoji: "✨", bg: "linear-gradient(145deg,#171827,#343653)", accent: "#f2d6a2" },
];
const occasions = ["بدون مناسبة", "عيد ميلاد", "ذكرى سنوية", "عيد الحب", "خطوبة", "زواج", "اعتذار من القلب", "اشتياق", "صداقة", "عيد الأم", "مجرد إني بحبك"];
const localKey = "lahzetna_gifts_v1";

function readLocal() {
  try { return JSON.parse(localStorage.getItem(localKey) || "[]"); } catch { return []; }
}
function saveLocal(items) { localStorage.setItem(localKey, JSON.stringify(items)); }
function decodeGiftRecord(gift) {
  if (!gift || typeof gift !== "object") return gift;
  const storedPhotos = Array.isArray(gift.photos) ? gift.photos : [];
  const metadataEntry = storedPhotos.find(item => item && typeof item === "object" && item.__lahzetna_meta);
  const meta = metadataEntry?.__lahzetna_meta || {};
  return {
    ...gift,
    ...meta,
    photos: storedPhotos.filter(item => typeof item === "string" || (item && typeof item === "object" && item.data && !item.__lahzetna_meta))
  };
}
function bytesToBase64(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
function base64ToBytes(value) {
  return Uint8Array.from(atob(value), char => char.charCodeAt(0));
}
async function encryptGiftPayload(payload, password) {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const material = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveKey"]);
  const key = await crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: 250000, hash: "SHA-256" }, material, { name: "AES-GCM", length: 256 }, false, ["encrypt"]);
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(JSON.stringify(payload)));
  return { version: 1, salt: bytesToBase64(salt), iv: bytesToBase64(iv), ciphertext: bytesToBase64(new Uint8Array(encrypted)) };
}
async function decryptGiftPayload(encrypted, password) {
  if (!encrypted || encrypted.version !== 1) throw new Error("بيانات الحماية غير صالحة.");
  const encoder = new TextEncoder();
  const material = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveKey"]);
  const key = await crypto.subtle.deriveKey({ name: "PBKDF2", salt: base64ToBytes(encrypted.salt), iterations: 250000, hash: "SHA-256" }, material, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: base64ToBytes(encrypted.iv) }, key, base64ToBytes(encrypted.ciphertext));
  return JSON.parse(new TextDecoder().decode(plain));
}
function slug() { return Math.random().toString(36).slice(2, 7) + Date.now().toString(36).slice(-5); }
function fmtDate(value) {
  if (!value) return "";
  try { return new Date(value + "T12:00:00").toLocaleDateString("ar-EG", {year:"numeric",month:"long",day:"numeric"}); } catch { return value; }
}
function App() {
  const [page, setPage] = useState(() => window.location.pathname === "/admin" ? "admin" : window.location.pathname === "/payment-return" ? "payment-return" : "home");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [gifts, setGifts] = useState(readLocal);
  const [activeGift, setActiveGift] = useState(null);
  const [pendingPayment, setPendingPayment] = useState(null);
  const [toast, setToast] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "حكايتنا لسه مكملة", fromName: "", toName: "", message: "في وسط كل الأيام العادية، إنت أجمل حاجة حصلتلي. كل لحظة معاك بتستاهل تتحكي، وكل ذكرى بينا ليها مكان خاص في قلبي. ❤️",
    date: "", occasion: "مجرد إني بحبك", theme: "rose", photos: [], cover: "", music: false, audioUrl: "", audioName: "", videoUrl: "", expiresAt: "", openAt: "", password: "", customAccent: "", fontFamily: "Cairo", payerPhone: "", transferReference: ""
  });
  const [giftLoading, setGiftLoading] = useState(false);

  useEffect(() => {
    const path = window.location.pathname;
    const match = path.match(/^\/g\/([^/]+)/);
    if (match) {
      loadGift(match[1]);
    }
  }, []);

  const lastTrackedView = useRef("");
  useEffect(() => {
    const path = window.location.pathname || "/";
    if (path === "/admin" || path.startsWith("/api/")) return;
    if (path.startsWith("/g/") && page !== "view") return;
    const viewKey = path + "|" + page;
    if (lastTrackedView.current === viewKey) return;
    lastTrackedView.current = viewKey;
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path, referrer: document.referrer || "" }),
      keepalive: true
    }).catch(() => {});
  }, [page]);

  useEffect(() => { saveLocal(gifts); }, [gifts]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (page !== "payment-return") return;
    const slugFromUrl = new URLSearchParams(window.location.search).get("slug") || "";
    if (!slugFromUrl) {
      setToast("رابط متابعة الدفع غير صحيح.");
      setPage("home");
      return;
    }
    let stopped = false;
    let attempts = 0;
    const checkStatus = async () => {
      attempts += 1;
      try {
        const response = await fetch(`/api/payments/status?slug=${encodeURIComponent(slugFromUrl)}`, { cache: "no-store" });
        const result = await response.json();
        if (stopped) return;
        if (response.ok && result.status === "paid" && result.gift) {
          stopped = true;
          const publishedGift = decodeGiftRecord(result.gift);
          setActiveGift(publishedGift);
          setGifts(prev => [publishedGift, ...prev.filter(g => g.slug !== publishedGift.slug)]);
          window.history.replaceState({}, "", `/g/${result.gift.slug}`);
          setPage("success");
          return;
        }
        if (result.status === "failed" || result.status === "not_found") {
          stopped = true;
          setToast("الدفع لم يتأكد. لو المبلغ اتخصم، تواصل مع الدعم قبل إعادة الدفع.");
          setPage("home");
          window.history.replaceState({}, "", "/");
          return;
        }
      } catch {}
      if (attempts >= 40 && !stopped) {
        stopped = true;
        setToast("الدفع لسه قيد التأكيد. افتح هداياي بعد لحظات أو تواصل مع الدعم لو المبلغ اتخصم.");
        setPage("home");
        window.history.replaceState({}, "", "/");
      }
    };
    checkStatus();
    const timer = setInterval(checkStatus, 2500);
    return () => { stopped = true; clearInterval(timer); };
  }, [page]);

  async function loadGift(id) {
    setGiftLoading(true);
    let found = null;
    if (supabase) {
      const { data, error } = await supabase.from("gifts").select("*").eq("slug", id).maybeSingle();
      if (!error && data) found = decodeGiftRecord(data);
    }
    if (!found) found = decodeGiftRecord(readLocal().find(g => g.slug === id) || null);
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

  async function handleMediaUpload(event, field) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const isAudio = field === "audioUrl";
    const allowed = isAudio ? file.type.startsWith("audio/") : file.type.startsWith("video/");
    const maxSize = isAudio ? 25 * 1024 * 1024 : 35 * 1024 * 1024;
    if (!allowed) { setToast(isAudio ? "اختار ملف صوتي MP3 أو M4A أو WAV أو OGG." : "اختار ملف فيديو صالح."); return; }
    if (file.size > maxSize) { setToast(`حجم الملف أكبر من الحد المسموح (${isAudio ? "25" : "35"} ميجابايت).`); return; }
    if (!supabase) { setToast("رفع الملفات يحتاج اتصال قاعدة بيانات Supabase. جرّب تحديث الصفحة."); return; }
    setSaving(true);
    try {
      const signResponse = await fetch("/api/media/sign", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fileName: file.name, contentType: file.type, size: file.size, mediaType: isAudio ? "audio" : "video" }) });
      const signed = await signResponse.json().catch(() => ({}));
      if (!signResponse.ok || !signed.path || !signed.token) throw new Error(signed.error || "تعذر تجهيز رفع الملف.");
      const { error } = await supabase.storage.from("lahzetna-media").uploadToSignedUrl(signed.path, signed.token, file, { contentType: file.type, upsert: true });
      if (error) throw error;
      setField(field, signed.publicUrl);
      if (isAudio) setField("audioName", file.name);
      setToast(isAudio ? "تم رفع الصوت بنجاح" : "تم رفع الفيديو بنجاح");
    } catch (error) {
      setToast(error.message || "فشل رفع الملف. حاول بملف أصغر.");
    } finally { setSaving(false); }
  }

  async function createGift(e) {
    e?.preventDefault();
    if (!form.toName.trim() || !form.fromName.trim() || !form.message.trim()) {
      setToast("اكتب اسم المُهدى إليه واسمك والرسالة الأول.");
      return;
    }
    if (!/^(?:\+?20)?0?1[0125][0-9]{8}$/.test(String(form.payerPhone || "").replace(/[\s()-]/g, ""))) {
      setToast("اكتب رقم موبايل مصري صحيح علشان نراجع التحويل.");
      return;
    }
    if (String(form.transferReference || "").trim().length < 4) {
      setToast("اكتب رقم العملية الظاهر في رسالة تحويل أورنج كاش.");
      return;
    }
    if (form.password && form.password.length < 4) { setToast("كلمة مرور الهدية لازم تكون 4 أحرف على الأقل."); return; }
    setSaving(true);
    const privatePayload = { message: form.message.trim(), photos: form.photos.map(p => p.data), cover: form.cover || form.photos[0]?.data || "", audio_url: form.audioUrl || "", audio_name: form.audioName || "", video_url: form.videoUrl || "" };
    let securePayload = null;
    try { if (form.password) securePayload = await encryptGiftPayload(privatePayload, form.password); }
    catch { setSaving(false); setToast("تعذر تشفير محتوى الهدية على هذا المتصفح."); return; }
    const record = {
      slug: slug(),
      title: form.title.trim() || `هدية إلى ${form.toName}`,
      from_name: form.fromName.trim(),
      to_name: form.toName.trim(),
      message: form.password ? "الهدية دي محمية بكلمة مرور ❤️" : form.message.trim(),
      date: form.date || null,
      occasion: form.occasion,
      theme: form.theme,
      photos: form.password ? [] : form.photos.map(p => p.data),
      cover: form.password ? "" : (form.cover || form.photos[0]?.data || ""),
      music: !!form.music,
      audio_url: form.password ? "" : (form.audioUrl || ""),
      audio_name: form.password ? "" : (form.audioName || ""),
      video_url: form.password ? "" : (form.videoUrl || ""),
      expires_at: form.expiresAt || null,
      open_at: form.openAt || null,
      custom_accent: form.customAccent || "",
      font_family: form.fontFamily || "Cairo",
      locked: !!form.password,
      secure_payload: securePayload
    };
    try {
      const response = await fetch("/api/payments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gift: record, phone: form.payerPhone, reference: form.transferReference })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.orderId) {
        setSaving(false);
        setToast(result.error || "تعذر تسجيل طلب الدفع. حاول مرة أخرى.");
        return;
      }
      setPendingPayment(result);
      setSaving(false);
      setPage("manual-payment");
    } catch {
      setSaving(false);
      setToast("تعذر الاتصال ببوابة الدفع. تحقق من الإنترنت وحاول مرة أخرى.");
    }
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
  function copyGiftForEditing(gift) {
    setForm({
      title: gift.title || "حكايتنا لسه مكملة",
      fromName: gift.from_name || "",
      toName: gift.to_name || "",
      message: gift.message || "",
      date: gift.date || "",
      occasion: gift.occasion || "مجرد إني بحبك",
      theme: gift.theme || "rose",
      photos: (gift.photos || []).slice(0, 5).map((photo, i) => ({ name: `photo-${i + 1}.jpg`, data: typeof photo === "string" ? photo : photo.data })),
      cover: gift.cover || "",
      music: !!gift.music,
      audioUrl: gift.audio_url || "",
      audioName: gift.audio_name || "",
      videoUrl: gift.video_url || "",
      expiresAt: gift.expires_at || "",
      password: "",
      customAccent: gift.custom_accent || "",
      fontFamily: gift.font_family || "Cairo",
      payerPhone: "",
      transferReference: ""
    });
    setActiveGift(null);
    setPage("create");
    window.history.pushState({}, "", "/");
    window.scrollTo({ top: 0, behavior: "smooth" });
    setToast("جهزت نسخة قابلة للتعديل. هتحتاج تسجل طلب دفع جديد لنشر النسخة.");
  }

  function goHome() {
    setPage("home");
    setActiveGift(null);
    window.history.pushState({}, "", "/");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const giftTheme = themes.find(t => t.id === (activeGift?.theme || "rose")) || themes[0];

  if (page === "admin") return <AdminPage />;

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
      {page === "create" && <CreatePage form={form} setField={setField} themes={themes} theme={theme} handlePhoto={handlePhoto} handleMediaUpload={handleMediaUpload} createGift={createGift} saving={saving} />}
      {page === "success" && <Success gift={activeGift} shareUrl={shareUrl} copyLink={copyLink} whatsappShare={whatsappShare} startCreate={startCreate} openGift={() => openGift(activeGift)} />}
      {page === "view" && <GiftView gift={activeGift} theme={giftTheme} loading={giftLoading} goHome={goHome} startCreate={startCreate} />}
      {page === "payment-return" && <PaymentReturn goHome={goHome} />}
      {page === "manual-payment" && <ManualPaymentPage pendingPayment={pendingPayment} goHome={goHome} />}
      {page === "mygifts" && <MyGifts gifts={gifts} openGift={openGift} startCreate={startCreate} setGifts={setGifts} setToast={setToast} copyGiftForEditing={copyGiftForEditing} />}
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

function WalletNumber() {
  const [walletNumber, setWalletNumber] = useState("");
  const [walletError, setWalletError] = useState("");
  useEffect(() => {
    fetch("/api/payments/config", { cache: "no-store" })
      .then(async response => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "رقم المحفظة غير متاح حاليًا.");
        setWalletNumber(data.walletNumber || "");
      })
      .catch(error => setWalletError(error.message || "تعذر تحميل رقم المحفظة."));
  }, []);
  if (walletNumber) return <span className="wallet-number-row">حوّل إلى: <b dir="ltr">{walletNumber}</b> <button type="button" className="btn btn-outline" onClick={() => navigator.clipboard?.writeText(walletNumber)}>نسخ الرقم</button></span>;
  return <span>{walletError || "جاري تحميل رقم محفظة الاستقبال..."}</span>;
}

function CreatePage({ form, setField, themes, theme, handlePhoto, handleMediaUpload, createGift, saving }) {
  const [preview, setPreview] = useState(false);
  const [messageStyle, setMessageStyle] = useState("romantic");
  const messageIdeas = {
    romantic: "يا " + (form.toName || "أجمل شخص") + "، وجودك في حياتي بيخلّي أبسط الأيام مختلفة. كل ذكرى معاك غالية، ونفسي نفضل نخلق لحظات جديدة نفتكرها طول العمر. بحبك أكتر من الكلام ❤️",
    apology: "يمكن الكلام مش كفاية، بس حابب أقولك إنك غالي عندي وإن زعلك بيفرق معايا. أتمنى نقدر نتكلم ونفهم بعض، لأن وجودك في حياتي يستاهل إني أحاول من قلبي. 🤍",
    friendship: "في ناس وجودها بيخلّي الدنيا أهون وأجمل، وإنت من الناس دي. شكرًا على كل موقف حلو وكل ضحكة وكل ذكرى. أتمنى تفضل أيامنا مليانة حاجات حلوة سوا 💛",
    birthday: "كل سنة وإنت طيب يا أجمل هدية في الدنيا! أتمنى سنتك الجديدة تكون مليانة راحة وفرح ونجاحات، وتحقق فيها كل اللي نفسك فيه. وجودك لوحده سبب للفرحة 🎂",
    anniversary: "كل سنة وإحنا أقرب لبعض، وكل ذكرى بينا بتأكدلي إن أجمل اختياراتي كانت إني عرفتك. نفسي نفضل نكبر سوا ونحتفل بكل لحظة جاية ❤️",
    longing: "وحشتني تفاصيلك الصغيرة، كلامك وضحكتك ووجودك اللي بيخلّي اليوم أهدى. مهما بعدتنا الأيام، مكانك جوا قلبي ثابت 🤍",
    wedding: "النهارده بداية فصل جديد من حكايتنا، بوعدك أكون سند وونس وأمان، ونبني مع بعض أيام نحب نفتكرها طول العمر 💍",
    mother: "كل سنة وإنتِ طيبة يا أحن قلب. مهما قلت مش هقدر أوفيكي حقك، ربنا يديمك نعمة في حياتنا ويديكي راحة وفرحة على قد قلبك ❤️",
    thanks: "يمكن مش بقولها كتير، بس وجودك فارق معايا جدًا. شكرًا إنك كنت موجود، وشكرًا على كل مرة خففت عني من غير ما تحس 💛",
    encouragement: "أنا مؤمن بيك وبكل خطوة بتاخدها، حتى لو الطريق طويل. خدها يوم بيوم، وافتكر إنك أقوى مما تتخيل وإنك تستاهل كل خير ✨"
  };
  const applyMessageIdea = () => setField("message", messageIdeas[messageStyle]);
  return <main className="create-page section-wrap">
    <div className="page-intro compact"><span className="eyebrow"><WandSparkles size={15}/> تفاصيل من اختيارك</span><h1>اصنع <span>هديتك الخاصة</span></h1><p>خد وقتك، كل تفصيلة صغيرة بتخلي الهدية شبهكم أكتر.</p></div>
    <div className="builder-layout">
      <form className="builder-form" onSubmit={createGift}>
        <div className="form-section">
          <div className="form-section-title"><span className="form-icon"><Heart size={19}/></span><div><h2>الحكاية بتبدأ بمين؟</h2><p>خلينا نعرف الهدية لمين ومن مين.</p></div></div>
          <label>عنوان الهدية<input value={form.title} onChange={e=>setField("title",e.target.value)} placeholder="مثلاً: حكايتنا لسه مكملة" maxLength={90}/></label>
          <div className="field-grid"><label>اسمك<input value={form.fromName} onChange={e=>setField("fromName",e.target.value)} placeholder="اسمك" required maxLength={60}/></label><label>اسم الشخص<input value={form.toName} onChange={e=>setField("toName",e.target.value)} placeholder="اسم حبيبك" required maxLength={60}/></label></div>
          <div className="payment-price-note"><span>سعر إنشاء الهدية</span><strong>20 جنيه مصري</strong><small>حوّل المبلغ إلى رقم أورنج كاش الموضح أدناه أولًا، ثم اكتب بيانات التحويل. لن تُنشر الهدية إلا بعد مراجعة الدفع والموافقة عليه.</small><WalletNumber /></div>
          <label>رقم الموبايل اللي حوّلت منه<input type="tel" inputMode="tel" autoComplete="tel" value={form.payerPhone || ""} onChange={e=>setField("payerPhone",e.target.value)} placeholder="01xxxxxxxxx" required maxLength={15}/><span className="optional">رقم المحفظة التي أرسلت منها مبلغ الـ20 جنيه.</span></label>
          <label>رقم العملية / مرجع التحويل<input type="text" value={form.transferReference || ""} onChange={e=>setField("transferReference",e.target.value)} placeholder="اكتب رقم العملية من رسالة أورنج كاش" required maxLength={100}/><span className="optional">اكتب رقم العملية كما ظهر في رسالة تأكيد التحويل.</span></label>
          <label>المناسبة<select value={form.occasion} onChange={e=>setField("occasion",e.target.value)}>{occasions.map(o=><option key={o}>{o}</option>)}</select></label>
          <label>التاريخ المميز <span className="optional">(اختياري)</span><div className="input-icon"><CalendarDays size={18}/><input type="date" value={form.date} onChange={e=>setField("date",e.target.value)}/></div></label>
        </div>
        <div className="form-section">
          <div className="form-section-title"><span className="form-icon"><MessageCircle size={19}/></span><div><h2>رسالتك من القلب</h2><p>اكتب الكلام اللي نفسك الشخص ده يسمعه منك.</p></div></div>
          <div className="message-assistant">
            <div className="message-assistant-head"><WandSparkles size={17}/><strong>ساعدني أبدأ الرسالة</strong><small>اقتراحات جاهزة تقدر تعدلها بكلامك</small></div>
            <div className="message-idea-controls">
              <select aria-label="نوع الرسالة" value={messageStyle} onChange={e=>setMessageStyle(e.target.value)}>
                <option value="romantic">رومانسية</option><option value="apology">اعتذار</option><option value="friendship">صداقة وامتنان</option><option value="birthday">عيد ميلاد</option><option value="anniversary">ذكرى سنوية</option><option value="longing">اشتياق</option><option value="wedding">زواج وخطوبة</option><option value="mother">عيد الأم</option><option value="thanks">شكر وامتنان</option><option value="encouragement">تشجيع ودعم</option>
              </select>
              <button type="button" className="btn btn-outline" onClick={applyMessageIdea}>استخدم الاقتراح</button>
            </div>
          </div>
          <label>الرسالة<textarea value={form.message} onChange={e=>setField("message",e.target.value)} rows={6} maxLength={1800} required placeholder="اكتب رسالتك هنا..."/></label>
          <div className="textarea-foot"><span>خليها بكلامك، ده اللي بيفرق ❤️</span><span>{form.message.length}/1800</span></div>
        </div>
        <div className="form-section">
          <div className="form-section-title"><span className="form-icon"><Camera size={19}/></span><div><h2>صور بتحكي</h2><p>ضيف لحد 5 صور من الذكريات اللي بتحبوها.</p></div></div>
          <label className="upload-box"><input type="file" accept="image/*" multiple onChange={handlePhoto} hidden/><span className="upload-icon"><ImagePlus size={25}/></span><strong>اضغط لاختيار الصور</strong><small>JPG أو PNG — حتى 5 صور</small><span className="upload-button"><Upload size={15}/> اختار الصور</span></label>
          {form.photos.length > 0 && <div className="uploaded-grid">{form.photos.map((p,i)=><div className="uploaded-photo" key={i}><img src={p.data} alt={`صورة ${i+1}`}/><button type="button" onClick={()=>setField("photos",form.photos.filter((_,j)=>i!==j))} aria-label="حذف الصورة"><Trash2 size={15}/></button></div>)}</div>}
          <div className="media-upload-card"><h3><Music2 size={18}/> صوتك أو أغنيتك الكاملة</h3><p>ارفع تسجيل بصوتك أو أغنية MP3/M4A/WAV. المستلم يقدر يشغلها من داخل الرسالة.</p><label className="upload-box compact-upload"><input type="file" accept="audio/*" onChange={e=>handleMediaUpload(e,"audioUrl")} hidden/><span className="upload-icon"><Upload size={22}/></span><strong>{form.audioName || "اختار ملف صوتي"}</strong><small>حتى 25 ميجابايت · التشغيل بزر واضح</small><span className="upload-button">رفع الصوت</span></label>{form.audioUrl && <div className="media-preview-row"><audio controls preload="metadata" src={form.audioUrl}/><button type="button" className="btn btn-outline" onClick={()=>{setField("audioUrl","");setField("audioName","");}}>حذف الصوت</button></div>}</div>
          <div className="media-upload-card"><h3><Video size={18}/> فيديو خاص (اختياري)</h3><p>مقطع فيديو قصير يظهر مع الرسالة.</p><label className="upload-box compact-upload"><input type="file" accept="video/*" onChange={e=>handleMediaUpload(e,"videoUrl")} hidden/><span className="upload-icon"><Upload size={22}/></span><strong>{form.videoUrl ? "تم اختيار الفيديو" : "اختار فيديو"}</strong><small>حتى 35 ميجابايت</small><span className="upload-button">رفع الفيديو</span></label>{form.videoUrl && <div className="media-preview-row"><video controls preload="metadata" src={form.videoUrl}/><button type="button" className="btn btn-outline" onClick={()=>setField("videoUrl","")}>حذف الفيديو</button></div>}</div>
          <label className="check-row"><input type="checkbox" checked={form.music} onChange={e=>setField("music",e.target.checked)}/><span className="check-custom"><Check size={13}/></span><span><strong>إظهار لمسة موسيقية في التصميم</strong><small>لحن هادئ اختياري بجانب الصوت المرفوع.</small></span><Music2 size={19}/></label>
        </div>
        <div className="form-section">
          <div className="form-section-title"><span className="form-icon"><Flower2 size={19}/></span><div><h2>اختار الثيم</h2><p>خلي شكل الهدية يعكس إحساسك.</p></div></div>
          <div className="theme-options">{themes.map(t=><button type="button" key={t.id} className={`theme-option ${form.theme===t.id?"selected":""} option-${t.id}`} onClick={()=>setField("theme",t.id)}><span className="theme-swatch">{t.emoji}</span><span>{t.name}</span>{form.theme===t.id&&<Check size={16}/>}</button>)}</div>
          <div className="designer-controls"><label>لون الهدية <input type="color" value={form.customAccent || theme.accent} onChange={e=>setField("customAccent",e.target.value)}/></label><label>الخط<select value={form.fontFamily || "Cairo"} onChange={e=>setField("fontFamily",e.target.value)}><option value="Cairo">Cairo</option><option value="Arial">Arial</option><option value="Tahoma">Tahoma</option><option value="Georgia">Georgia</option></select></label></div>
          <label>ميعاد فتح المفاجأة (اختياري)<input type="datetime-local" min={new Date().toISOString().slice(0,16)} value={form.openAt || ""} onChange={e=>setField("openAt",e.target.value)}/><span className="optional">قبل الموعد المحدد، صفحة الهدية هتعرض عدًّا تنازليًا. الميزة دي للعرض فقط وليست قفلًا أمنيًا.</span></label>
          <label>انتهاء صلاحية الرابط (اختياري)<input type="date" min={new Date().toISOString().slice(0,10)} value={form.expiresAt || ""} onChange={e=>setField("expiresAt",e.target.value)}/><span className="optional">بعد التاريخ المحدد، الموقع هيعرض إن الهدية انتهت صلاحيتها.</span></label>
          <label>كلمة مرور للهدية (اختياري)<input type="password" autoComplete="new-password" value={form.password || ""} onChange={e=>setField("password",e.target.value)} minLength={4} maxLength={80} placeholder="٤ أحرف على الأقل"/><span className="optional">محتوى الرسالة والصور والصوت والفيديو بيتشفّر قبل الإرسال، والمستلم يحتاج كلمة المرور لفتحه.</span></label>
        </div>
        <div className="builder-actions"><button type="button" className="btn btn-outline" onClick={()=>setPreview(!preview)}><Eye size={17}/>{preview?"إخفاء المعاينة":"معاينة الهدية"}</button><button type="submit" className="btn btn-primary" disabled={saving}>{saving?"جاري الحفظ...":"أنشئ هديتي"} <ArrowLeft size={17}/></button></div>
        {preview && <div className="mobile-preview"><GiftPreview form={form} theme={theme}/></div>}
      </form>
      <aside className="preview-column"><div className="preview-sticky"><div className="preview-label"><Eye size={16}/> معاينة مباشرة</div><GiftPreview form={form} theme={theme}/><p className="preview-tip"><Sparkles size={15}/> المعاينة بتتغير مع كل تعديل.</p></div></aside>
    </div>
  </main>;
}

function PaymentReturn({ goHome }) {
  return <main className="section-wrap payment-return-page">
    <div className="payment-wait-card">
      <div className="payment-wait-icon"><Clock3 size={30}/></div>
      <span className="eyebrow">لحظتنا · تأكيد الدفع</span>
      <h1>حالة الدفع</h1>
      <p>لو وصلت هنا من رابط قديم، افتح الموقع وراجع حالة طلبك من جديد.</p>
      <button className="btn btn-outline" onClick={goHome}>العودة للرئيسية</button>
    </div>
  </main>;
}

function ManualPaymentPage({ pendingPayment, goHome }) {
  const [status, setStatus] = useState("awaiting_review");
  useEffect(() => {
    if (!pendingPayment?.slug) return;
    let stopped = false;
    const check = async () => {
      try {
        const response = await fetch("/api/payments/status?slug=" + encodeURIComponent(pendingPayment.slug), { cache: "no-store" });
        const data = await response.json().catch(() => ({}));
        if (stopped) return;
        if (response.ok && data.status === "approved" && data.gift) {
          stopped = true;
          window.location.assign("/g/" + encodeURIComponent(data.gift.slug));
          return;
        }
        if (data.status === "rejected") { setStatus("rejected"); stopped = true; }
      } catch {}
    };
    check();
    const timer = setInterval(check, 7000);
    return () => { stopped = true; clearInterval(timer); };
  }, [pendingPayment?.slug]);
  return <main className="section-wrap payment-return-page">
    <div className="payment-wait-card">
      <div className="payment-wait-icon"><Clock3 size={30}/></div>
      <span className="eyebrow">لحظتنا · مراجعة التحويل</span>
      {status === "rejected" ? <>
        <h1>الطلب مرفوض</h1>
        <p>لم يتم اعتماد التحويل. راجع رقم العملية أو تواصل مع إدارة الموقع قبل إرسال طلب جديد.</p>
      </> : <>
        <h1>طلبك وصل للمراجعة</h1>
        <p>طلب إنشاء الهدية اتسجل، وهيتم مراجعته يدويًا. الهدية مش هتتنشر قبل الموافقة.</p>
        <div className="payment-wait-status"><span className="payment-pulse"></span> في انتظار مراجعة الدفع</div>
        {pendingPayment?.orderId && <p>رقم الطلب: <b dir="ltr">{pendingPayment.orderId}</b></p>}
        {pendingPayment?.walletNumber && <p>محفظة الاستقبال: <b dir="ltr">{pendingPayment.walletNumber}</b></p>}
      </>}
      <button className="btn btn-outline" onClick={goHome}>العودة للرئيسية</button>
    </div>
  </main>;
}

function GiftPreview({ form, theme }) {
  return <div className={`gift-preview preview-${form.theme}`} style={{background:theme.bg, "--gift-accent":form.customAccent || theme.accent,fontFamily:form.fontFamily || "Cairo"}}>
    <div className="preview-topline"><span>LAHZETNA</span><Heart size={16} fill="currentColor"/></div>
    <div className="preview-content">
      <span className="preview-kicker">{form.occasion || "هدية من القلب"}</span>
      <div className="preview-heart"><Heart size={34} fill="currentColor"/></div>
      <h3>{form.title || "حكايتنا لسه مكملة"}</h3>
      <div className="preview-names"><span>{form.fromName || "اسمك"}</span><Heart size={13} fill="currentColor"/><span>{form.toName || "اسم حبيبك"}</span></div>
      {form.cover ? <img className="preview-cover" src={form.cover} alt="صورة الهدية"/> : <div className="preview-placeholder"><Flower2 size={34}/><span>ذكرياتكم هنا</span></div>}
      <p className="preview-message">{form.message || "رسالتك من القلب هتظهر هنا..."}</p>
      {form.date && <div className="preview-date"><CalendarDays size={14}/>{fmtDate(form.date)}</div>}
      {(form.music || form.audioUrl) && <div className="preview-music"><Music2 size={13}/> {form.audioUrl ? "صوت أو أغنية مرفوعة" : "لمسة موسيقية"}</div>}
      {form.videoUrl && <div className="preview-music"><Video size={13}/> فيديو مرفق</div>}
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
  const [opened, setOpened] = useState(false);
  const [unlockPassword, setUnlockPassword] = useState("");
  const [unlockError, setUnlockError] = useState("");
  const [unlockedGift, setUnlockedGift] = useState(null);
  const [musicPlaying, setMusicPlaying] = useState(false);
  const [clockNow, setClockNow] = useState(Date.now());
  const audioContextRef = useRef(null);
  const melodyTimerRef = useRef(null);

  useEffect(() => {
    const clock = window.setInterval(() => setClockNow(Date.now()), 1000);
    setOpened(false);
    setUnlockPassword("");
    setUnlockError("");
    setUnlockedGift(null);
    setMusicPlaying(false);
    return () => {
      if (melodyTimerRef.current) window.clearInterval(melodyTimerRef.current);
      melodyTimerRef.current = null;
      const context = audioContextRef.current;
      audioContextRef.current = null;
      if (context && context.state !== "closed") context.close().catch(() => {});
      window.clearInterval(clock);
    };
  }, [gift?.slug]);

  function toggleMelody() {
    if (musicPlaying) {
      if (melodyTimerRef.current) window.clearInterval(melodyTimerRef.current);
      melodyTimerRef.current = null;
      const context = audioContextRef.current;
      audioContextRef.current = null;
      if (context && context.state !== "closed") context.close().catch(() => {});
      setMusicPlaying(false);
      return;
    }
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      window.alert("المتصفح لا يدعم تشغيل اللحن.");
      return;
    }
    const context = new AudioContextClass();
    audioContextRef.current = context;
    const notes = [523.25, 659.25, 783.99, 659.25, 587.33, 659.25, 523.25, 392.00];
    let index = 0;
    const playNote = () => {
      if (context.state === "closed") return;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = notes[index % notes.length];
      gain.gain.setValueAtTime(0.0001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.045, context.currentTime + 0.06);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.52);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.55);
      index += 1;
    };
    playNote();
    melodyTimerRef.current = window.setInterval(playNote, 650);
    setMusicPlaying(true);
  }

  if (loading) return <main className="view-page section-wrap"><div className="loader"></div><p>بنفتح هديتك...</p></main>;
  if (!gift) return <main className="not-found section-wrap"><span className="not-found-icon">♡</span><h1>الهدية دي مش موجودة</h1><p>ممكن الرابط غلط، أو الهدية محفوظة على جهاز تاني ولسه قاعدة البيانات مش متفعّلة.</p><button className="btn btn-primary" onClick={goHome}>ارجع للرئيسية</button></main>;
  if (gift.expires_at && new Date(`${gift.expires_at}T23:59:59`) < new Date()) return <main className="not-found section-wrap"><span className="not-found-icon">⌛</span><h1>انتهت صلاحية الهدية</h1><p>الرابط ده انتهت صلاحيته حسب التاريخ اللي اختاره صاحب الهدية.</p><button className="btn btn-primary" onClick={goHome}>ارجع للرئيسية</button></main>;
  if (gift.open_at && Date.parse(gift.open_at) > clockNow) {
    const remaining = Math.max(0, Math.floor((Date.parse(gift.open_at) - clockNow) / 1000));
    const days = Math.floor(remaining / 86400);
    const hours = Math.floor((remaining % 86400) / 3600);
    const minutes = Math.floor((remaining % 3600) / 60);
    const seconds = remaining % 60;
    return <main className="view-page section-wrap surprise-stage"><div className="view-top"><button className="text-link" onClick={goHome}><ChevronRight size={17}/> الرئيسية</button><span><Heart size={14} fill="currentColor"/> لحظتنا</span></div><section className={`surprise-envelope theme-${gift.theme || "rose"}`} style={{background:theme.bg,"--gift-accent":gift.custom_accent || theme.accent,fontFamily:gift.font_family || "Cairo"}}><div className="surprise-sparkles" aria-hidden="true">✦　♡　✦</div><div className="surprise-gift-icon"><Clock3 size={42}/></div><span className="full-kicker">المفاجأة مستنياك</span><h1>لسه شوية يا {gift.to_name} ❤️</h1><p>هدية مخصوصة من {gift.from_name} هتكون جاهزة في الموعد المحدد.</p><div className="reveal-countdown" dir="ltr"><span><b>{days}</b><small>يوم</small></span><span><b>{String(hours).padStart(2,"0")}</b><small>ساعة</small></span><span><b>{String(minutes).padStart(2,"0")}</b><small>دقيقة</small></span><span><b>{String(seconds).padStart(2,"0")}</b><small>ثانية</small></span></div><small>العدّ التنازلي بيتحدّث تلقائيًا.</small></section></main>;
  }
  const visibleGift = unlockedGift || gift;
  const photos = Array.isArray(visibleGift.photos) ? visibleGift.photos : [];
  const downloadGift = () => {
    const text = (visibleGift.title || "هدية من لحظتنا") + "\n\nإلى: " + (visibleGift.to_name || "") + "\nمن: " + (visibleGift.from_name || "") + "\nالمناسبة: " + (visibleGift.occasion || "") + "\n\n" + (visibleGift.message || "") + "\n\n" + (visibleGift.date ? "التاريخ: " + fmtDate(visibleGift.date) + "\n" : "") + "صُنعت بحب من لحظتنا";
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "lahzetna-gift.txt"; a.click();
    URL.revokeObjectURL(url);
  };
  if (!opened) return <main className="view-page section-wrap surprise-stage">
    <div className="view-top"><button className="text-link" onClick={goHome}><ChevronRight size={17}/> الرئيسية</button><span><Heart size={14} fill="currentColor"/> لحظتنا</span></div>
    <section className={`surprise-envelope theme-${gift.theme || "rose"}`} style={{background:theme.bg,"--gift-accent":gift.custom_accent || theme.accent,fontFamily:gift.font_family || "Cairo"}}>
      <div className="surprise-sparkles" aria-hidden="true">✦　♡　✦</div>
      <div className="surprise-gift-icon"><Gift size={44}/></div>
      <span className="full-kicker">{visibleGift.occasion || "هدية من القلب"}</span>
      <h1>فيه مفاجأة <span>{gift.to_name}</span> ❤️</h1>
      <p>رسالة مخصوصة من {gift.from_name}، اتعملت بكل حب علشان لحظتكم تبقى ذكرى.</p>
      <button className="surprise-open-btn" onClick={() => setOpened(true)}><Gift size={19}/> افتح مفاجأتك <Heart size={17} fill="currentColor"/></button>
      <small>اضغط وافتح رسالتك الخاصة</small>
    </section>
  </main>;

  if (gift.locked && !unlockedGift) return <main className="view-page section-wrap"><div className="view-top"><button className="text-link" onClick={goHome}><ChevronRight size={17}/> الرئيسية</button><span><Heart size={14} fill="currentColor"/> لحظتنا</span></div><section className="unlock-card"><div className="surprise-gift-icon"><LockKeyhole size={38}/></div><h1>الهدية دي عليها كلمة مرور</h1><p>اكتب كلمة المرور اللي صاحب الهدية بعتهالك علشان تفتح الرسالة والصور والصوت.</p><form onSubmit={async e=>{e.preventDefault();setUnlockError("");try{const content=await decryptGiftPayload(gift.secure_payload,unlockPassword);setUnlockedGift({...gift,...content,locked:false});}catch{setUnlockError("كلمة المرور مش صحيحة. جرّب تاني.");}}}><label>كلمة المرور<input type="password" value={unlockPassword} onChange={e=>setUnlockPassword(e.target.value)} autoComplete="current-password" required/></label>{unlockError&&<p className="unlock-error">{unlockError}</p>}<button className="btn btn-primary" type="submit">افتح الهدية <LockKeyhole size={16}/></button></form></section></main>;
  return <main className="view-page section-wrap">
    <div className="view-top"><button className="text-link" onClick={goHome}><ChevronRight size={17}/> الرئيسية</button><span><Heart size={14} fill="currentColor"/> لحظتنا</span></div>
    <article className={`full-gift full-${visibleGift.theme||"rose"}`} style={{background:theme.bg,"--gift-accent":visibleGift.custom_accent || theme.accent,fontFamily:visibleGift.font_family || "Cairo"}}>
      <div className="full-gift-inner">
        <div className="full-brand"><Heart size={18} fill="currentColor"/> LAHZETNA</div>
        <span className="full-kicker">{visibleGift.occasion || "هدية من القلب"}</span>
        <div className="full-heart"><Heart size={50} fill="currentColor"/></div>
        <h1>{visibleGift.title || "حكايتنا لسه مكملة"}</h1>
        <div className="full-names"><span>{visibleGift.from_name}</span><Heart size={18} fill="currentColor"/><span>{visibleGift.to_name}</span></div>
        {(visibleGift.cover || photos.length>0) && <img className="full-cover" src={visibleGift.cover || (typeof photos[0]==="string" ? photos[0] : photos[0]?.data)} alt="ذكرى خاصة"/>}
        <div className="full-message">{visibleGift.message}</div>
        {visibleGift.date && <div className="full-date"><CalendarDays size={16}/>{fmtDate(visibleGift.date)}</div>}
        {photos.length > 1 && <div className="full-gallery">{photos.slice(0,5).map((p,i)=><img key={i} src={typeof p==="string"?p:p.data} alt={`ذكرى ${i+1}`}/>)}</div>}
        {visibleGift.audio_url && <section className="gift-audio-panel"><h3><Music2 size={18}/> {visibleGift.audio_name || "رسالة صوتية أو أغنية"}</h3><p>اسمع الرسالة على راحتك ❤️</p><audio controls preload="metadata" src={visibleGift.audio_url}>المتصفح لا يدعم تشغيل الصوت.</audio></section>}
        {visibleGift.video_url && <section className="gift-video-panel"><video controls preload="metadata" playsInline src={visibleGift.video_url}>المتصفح لا يدعم تشغيل الفيديو.</video></section>}
        {visibleGift.music && <button type="button" className="preview-music melody-toggle" onClick={toggleMelody}><Music2 size={14}/> {musicPlaying ? "إيقاف اللحن" : "شغّل لحن هادئ"} {musicPlaying ? "Ⅱ" : "♫"}</button>}
        <div className="full-signature">اتعملت بكل حب <Heart size={14} fill="currentColor"/></div>
      </div>
    </article>
    <section className="gift-qr-panel">
      <div><span className="eyebrow"><Share2 size={14}/> خَلّي اللحظة أقرب</span><h2>شارك الهدية برمز QR</h2><p>امسح الرمز بكاميرا الموبايل لفتح رابط الهدية مباشرة.</p></div>
      <img src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=10&data=${encodeURIComponent(window.location.href)}`} alt="رمز QR لفتح الهدية" loading="lazy"/>
    </section>
    <div className="view-bottom"><p>كل لحظة حلوة تستاهل تتفتكر.</p><div className="view-bottom-actions"><button className="btn btn-outline" onClick={downloadGift}><Upload size={16}/> احفظ الرسالة كملف</button><button className="btn btn-primary" onClick={startCreate}>اصنع هدية زي دي <ArrowLeft size={17}/></button></div></div>
  </main>;
}

function MyGifts({ gifts, openGift, startCreate, setGifts, setToast, copyGiftForEditing }) {
  const [giftUrlInput, setGiftUrlInput] = useState("");
  const [importing, setImporting] = useState(false);
  async function importGift(event) {
    event.preventDefault();
    const value = giftUrlInput.trim();
    const match = value.match(/(?:\/g\/)?([a-z0-9]{6,40})\/?(?:\?.*)?$/i);
    const id = match?.[1];
    if (!id) { setToast("الصق رابط هدية صحيح من لحظتنا."); return; }
    setImporting(true);
    try {
      let found = readLocal().find(item => item.slug === id) || null;
      if (supabase) {
        const { data, error } = await supabase.from("gifts").select("*").eq("slug", id).maybeSingle();
        if (!error && data) found = decodeGiftRecord(data);
      }
      if (!found) throw new Error("مش لاقي الهدية. اتأكد إن الرابط صحيح وإن الهدية اتنشرت.");
      setGifts(prev => [found, ...prev.filter(item => item.slug !== found.slug)]);
      setGiftUrlInput("");
      setToast("اتضافت الهدية لقائمة هداياي على الجهاز ده.");
    } catch (error) { setToast(error.message || "تعذر استرجاع الهدية."); }
    finally { setImporting(false); }
  }
  function removeGift(gift) {
    if (!window.confirm("متأكد إنك عايز تحذف الهدية دي من الجهاز؟")) return;
    setGifts(prev=>prev.filter(g=>g.slug!==gift.slug));
    if (supabase) supabase.from("gifts").delete().eq("slug",gift.slug).then(({error})=>{if(error) console.error(error);});
    setToast("تم حذف الهدية من القائمة");
  }
  return <main className="inner-page section-wrap mygifts-page">
    <div className="page-intro"><span className="eyebrow"><Heart size={15}/> ذكرياتك</span><h1>هدايا <span>لحظتنا</span></h1><p>كل هدية عملتها هتلاقيها هنا على الجهاز ده.</p></div>
    <form className="gift-import-form" onSubmit={importGift}><label>استرجع هدية من رابطها<input value={giftUrlInput} onChange={e=>setGiftUrlInput(e.target.value)} placeholder="الصق رابط الهدية هنا" dir="ltr"/></label><button className="btn btn-outline" type="submit" disabled={importing}>{importing?"جاري الاسترجاع...":"إضافة لهداياي"}</button><small>مفيد لو فتحت الموقع من جهاز جديد؛ لازم يكون معاك رابط الهدية.</small></form>
    {gifts.length===0 ? <div className="empty-state"><span className="empty-heart"><Gift size={34}/></span><h2>لسه مفيش هدايا</h2><p>أول هدية ممكن تكون بداية ذكرى جميلة.</p><button className="btn btn-primary" onClick={startCreate}>اصنع أول هدية <ArrowLeft size={17}/></button></div> :
      <div className="gifts-grid">{gifts.map(g=><div className="gift-list-card" key={g.slug}><button className={`gift-list-cover cover-${g.theme||"rose"}`} onClick={()=>openGift(g)}>{g.cover?<img src={g.cover} alt=""/>:<Heart size={40} fill="currentColor"/>}<span>{(themes.find(t=>t.id===g.theme)||themes[0]).emoji}</span></button><div className="gift-list-body"><small>إلى {g.to_name}</small><h3>{g.title||`هدية إلى ${g.to_name}`}</h3><p>{g.message?.slice(0,90)}{(g.message||"").length>90?"…":""}</p><div className="gift-list-actions"><button onClick={()=>openGift(g)}><Eye size={15}/> عرض</button>{!g.locked && <button onClick={()=>copyGiftForEditing(g)}><WandSparkles size={15}/> تعديل كنسخة</button>}<button onClick={()=>{navigator.clipboard?.writeText(`${window.location.origin}/g/${g.slug}`).then(()=>setToast("تم نسخ الرابط")).catch(()=>window.prompt("انسخ الرابط",`${window.location.origin}/g/${g.slug}`));}}><Copy size={15}/> نسخ الرابط</button><button className="delete-action" onClick={()=>removeGift(g)} aria-label="حذف"><Trash2 size={15}/></button></div></div></div>)}</div>}
  </main>;
}


function AdminPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("messages");
  const [giftSearch, setGiftSearch] = useState("");
  const [reviewingOrderId, setReviewingOrderId] = useState("");
  const [reviewNotice, setReviewNotice] = useState("");

  async function loadDashboard() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/data", { credentials: "same-origin" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 401) { setAuthenticated(false); return; }
        throw new Error(data.error || "تعذر تحميل لوحة التحكم.");
      }
      setDashboard(data);
      setAuthenticated(true);
    } catch (err) {
      setError(err.message || "في مشكلة في الاتصال.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadDashboard(); }, []);

  async function login(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ username, password })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "اسم المستخدم أو كلمة المرور غير صحيحة.");
      setAuthenticated(true);
      setPassword("");
      await loadDashboard();
    } catch (err) {
      setError(err.message || "فشل تسجيل الدخول.");
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    await fetch("/api/admin/data", { method: "POST", credentials: "same-origin" }).catch(() => {});
    setAuthenticated(false);
    setDashboard(null);
    setUsername("");
    setPassword("");
  }

  async function reviewPayment(order, action) {
    const verb = action === "approve" ? "قبول ونشر الهدية" : "رفض طلب الدفع";
    if (!window.confirm("هل تريد " + verb + "؟")) return;
    setReviewingOrderId(order.id);
    setReviewNotice("");
    setError("");
    try {
      const response = await fetch("/api/admin/payment-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ orderId: order.id, action })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "تعذر تحديث الطلب.");
      setReviewNotice(action === "approve" ? "تمت الموافقة ونشر الهدية: " + data.giftUrl : "تم رفض طلب الدفع.");
      await loadDashboard();
    } catch (err) {
      setError(err.message || "تعذر مراجعة طلب الدفع.");
    } finally {
      setReviewingOrderId("");
    }
  }

  const dateText = value => value ? new Date(value).toLocaleString("ar-EG", { dateStyle: "medium", timeStyle: "short" }) : "—";
  const filteredGifts = (dashboard?.gifts || []).filter(gift => {
    const q = giftSearch.trim().toLocaleLowerCase();
    if (!q) return true;
    return [gift.title, gift.from_name, gift.to_name, gift.message, gift.occasion, gift.slug]
      .some(value => String(value || "").toLocaleLowerCase().includes(q));
  });

  return <main className="admin-shell" dir="rtl">
    <div className="admin-top">
      <a href="/" className="admin-brand"><span className="admin-brand-icon"><Heart size={22} fill="currentColor"/></span><span><strong>لحظتنا</strong><small>لوحة الإدارة</small></span></a>
      {authenticated && <div className="admin-top-actions"><button className="admin-btn admin-btn-ghost" onClick={loadDashboard} disabled={loading}><Clock3 size={16}/> تحديث</button><button className="admin-btn admin-btn-ghost" onClick={logout}>تسجيل الخروج</button></div>}
    </div>

    {!authenticated ? <section className="admin-login-card">
      <div className="admin-login-icon"><LockKeyhole size={28}/></div>
      <span className="admin-eyebrow">ADMIN ACCESS</span>
      <h1>أهلًا بيك في لوحة الإدارة</h1>
      <p>سجّل دخولك لمراجعة رسائل الهدايا وإحصائيات الزيارات.</p>
      <form onSubmit={login} className="admin-login-form">
        <label>اسم المستخدم<input autoComplete="username" value={username} onChange={e=>setUsername(e.target.value)} required placeholder="Username"/></label>
        <label>كلمة المرور<input autoComplete="current-password" type="password" value={password} onChange={e=>setPassword(e.target.value)} required placeholder="Password"/></label>
        {error && <div className="admin-error">{error}</div>}
        <button className="admin-btn admin-btn-primary" type="submit" disabled={loading}>{loading ? "جارٍ تسجيل الدخول..." : "دخول لوحة الإدارة"} <ArrowLeft size={17}/></button>
      </form>
      <a href="/" className="admin-back-link"><ArrowUpLeft size={15}/> الرجوع للموقع</a>
    </section> : <section className="admin-content">
      <div className="admin-heading"><div><span className="admin-eyebrow">OVERVIEW</span><h1>لوحة التحكم</h1><p>ملخص الهدايا والزيارات المسجلة على الموقع.</p></div><span className="admin-live"><i/> متصل</span></div>
      {error && <div className="admin-error admin-wide-error">{error}</div>}
      {dashboard && <>
        <div className="admin-stats">
          <article className="admin-stat"><span className="admin-stat-icon"><Eye size={19}/></span><small>إجمالي مشاهدات الصفحات</small><strong>{(dashboard.stats?.totalVisits || 0).toLocaleString("ar-EG")}</strong></article>
          <article className="admin-stat"><span className="admin-stat-icon"><Clock3 size={19}/></span><small>زيارات آخر 7 أيام</small><strong>{(dashboard.stats?.visits7d || 0).toLocaleString("ar-EG")}</strong></article>
          <article className="admin-stat"><span className="admin-stat-icon"><Gift size={19}/></span><small>إجمالي الهدايا</small><strong>{(dashboard.stats?.totalGifts || 0).toLocaleString("ar-EG")}</strong></article>
          <article className="admin-stat"><span className="admin-stat-icon"><MessageCircle size={19}/></span><small>رسائل محفوظة</small><strong>{(dashboard.stats?.totalGifts || 0).toLocaleString("ar-EG")}</strong></article>
          <article className="admin-stat"><span className="admin-stat-icon"><Check size={19}/></span><small>طلبات دفع معتمدة</small><strong>{(dashboard.stats?.approvedOrders || 0).toLocaleString("ar-EG")}</strong></article>
          <article className="admin-stat"><span className="admin-stat-icon"><Gift size={19}/></span><small>إجمالي المدفوعات المؤكدة</small><strong>{(Number(dashboard.stats?.totalRevenueCents || 0) / 100).toLocaleString("ar-EG")} ج.م</strong></article>
        </div>
        {reviewNotice && <div className="admin-review-notice">{reviewNotice}</div>}
        <section className="admin-panel admin-payment-panel">
          <div className="admin-panel-heading"><div><h2>طلبات الدفع المعلقة ({dashboard.pendingOrders?.length || 0})</h2><p>كل طلب هنا ينتظر مراجعتك. قبول الطلب ينشر الهدية، والرفض يمنع نشرها.</p></div></div>
          {!dashboard.pendingOrders?.length ? <div className="admin-empty">لا توجد طلبات دفع جديدة للمراجعة.</div> :
            <div className="admin-payment-list">{dashboard.pendingOrders.map(order => <article className="admin-payment-order" key={order.id}>
              <div className="admin-message-top"><div><strong>{order.gift?.title || "هدية من لحظتنا"}</strong><small>من {order.gift?.from_name || "—"} إلى {order.gift?.to_name || "—"}</small></div><time>{dateText(order.created_at)}</time></div>
              <div className="admin-gift-details"><span>المبلغ: {(Number(order.amount_cents || 2000) / 100).toLocaleString("ar-EG")} جنيه</span><span>رقم المحوّل: <b dir="ltr">{order.payer_phone || "—"}</b></span><span>رقم العملية: <b dir="ltr">{order.payment_reference || "—"}</b></span><span>رقم الطلب: <b dir="ltr">{String(order.id).slice(0,8)}</b></span></div>
              <p className="admin-payment-message">{order.gift?.message || ""}</p>
              <div className="admin-payment-actions"><button className="admin-btn admin-approve" disabled={!!reviewingOrderId} onClick={() => reviewPayment(order,"approve")}>{reviewingOrderId === order.id ? "جارٍ الحفظ..." : "قبول ونشر الهدية"} <Check size={16}/></button><button className="admin-btn admin-reject" disabled={!!reviewingOrderId} onClick={() => reviewPayment(order,"reject")}>رفض الطلب <X size={16}/></button></div>
            </article>)}</div>}
        </section>
        <div className="admin-tabs"><button className={tab==="messages"?"active":""} onClick={()=>setTab("messages")}><MessageCircle size={16}/> الرسائل والهدايا ({dashboard.gifts?.length || 0})</button><button className={tab==="visits"?"active":""} onClick={()=>setTab("visits")}><Eye size={16}/> سجل الزيارات</button></div>
        {tab === "messages" ? <div className="admin-panel">
          <div className="admin-panel-heading"><div><h2>كل الهدايا التي أنشأها المستخدمون</h2><p>إجمالي {((dashboard.gifts || []).length).toLocaleString("ar-EG")} هدية محفوظة في قاعدة البيانات، مرتبة من الأحدث للأقدم.</p></div></div>
          <input className="admin-gift-search" type="search" value={giftSearch} onChange={e=>setGiftSearch(e.target.value)} placeholder="ابحث بالاسم أو عنوان الهدية أو نص الرسالة..." aria-label="البحث في الهدايا"/>
          {!dashboard.gifts?.length ? <div className="admin-empty">لسه مفيش هدايا محفوظة في قاعدة البيانات. الهدايا التي تُحفظ على جهاز صاحبها فقط لن تظهر هنا.</div> : filteredGifts.length === 0 ? <div className="admin-empty">مفيش هدايا مطابقة للبحث.</div> : <div className="admin-message-list">{filteredGifts.map(gift=><article className="admin-message" key={gift.id || gift.slug}>
            {gift.cover && <a className="admin-gift-cover-link" href={"/g/"+encodeURIComponent(gift.slug)} target="_blank" rel="noreferrer"><img className="admin-gift-cover" src={gift.cover} alt={"غلاف "+(gift.title || "الهدية")} loading="lazy"/></a>}
            <div className="admin-message-top"><div><strong>{gift.title || "هدية من لحظتنا"}</strong><small>من {gift.from_name} إلى {gift.to_name}</small></div><time>{dateText(gift.created_at)}</time></div>
            <p>{gift.message}</p>
            <div className="admin-gift-details"><span>المناسبة: {gift.occasion || "بدون مناسبة"}</span><span>الثيم: {gift.theme || "rose"}</span><span>الصور: {Array.isArray(gift.photos) ? gift.photos.length.toLocaleString("ar-EG") : "0"}</span><span>{gift.date ? "التاريخ المميز: "+fmtDate(gift.date) : "بدون تاريخ مميز"}</span><span>{gift.music ? "🎵 موسيقى مفعّلة" : "بدون موسيقى"}</span></div>
            <div className="admin-message-bottom"><span>رابط الهدية: /g/{gift.slug}</span><a href={"/g/"+encodeURIComponent(gift.slug)} target="_blank" rel="noreferrer">فتح الهدية <ExternalLink size={14}/></a></div>
          </article>)}</div>}
        </div> : <div className="admin-panel">
          <div className="admin-panel-heading"><div><h2>سجل الزيارات</h2><p>مشاهدات الصفحات التي بدأ تسجيلها بعد تفعيل الميزة.</p></div></div>
          {!dashboard.visits?.length ? <div className="admin-empty">لم تُسجل زيارات بعد. افتح الصفحة الرئيسية في تبويب جديد لتجربة التتبع.</div> : <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>وقت الزيارة</th><th>الصفحة</th><th>المصدر</th></tr></thead><tbody>{dashboard.visits.map(v=><tr key={v.id}><td>{dateText(v.created_at)}</td><td dir="ltr">{v.path}</td><td>{v.referrer ? <span dir="ltr">{v.referrer}</span> : "مباشر"}</td></tr>)}</tbody></table></div>}
          {dashboard.topPaths?.length > 0 && <div className="admin-top-paths"><h3>أكثر الصفحات مشاهدة</h3>{dashboard.topPaths.map(item=><div key={item.path}><span dir="ltr">{item.path}</span><strong>{item.count.toLocaleString("ar-EG")}</strong></div>)}</div>}
        </div>}
        <p className="admin-footnote">الإحصائيات دي بتبدأ من وقت تفعيل تسجيل الزيارات، ومش بتسترجع زيارات قديمة.</p>
      </>}
      {loading && <div className="admin-loading">جارٍ تحديث البيانات…</div>}
    </section>}
  </main>;
}

createRoot(document.getElementById("root")).render(<App />);
