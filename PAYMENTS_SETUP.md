# إعداد الدفع المدفوع في لحظتنا

## ما الذي تم تنفيذه؟
- سعر إنشاء الهدية ثابت من الخادم: 20 جنيه مصري (2000 قرش)، ولا يمكن تغييره من المتصفح.
- يبدأ الدفع من Paymob Unified Checkout باستخدام معرّف تكامل محفظة Orange Cash.
- الهدية لا تُحفظ في جدول الهدايا العامة ولا تظهر في الأرشيف إلا بعد وصول إشعار دفع صحيح والتحقق من HMAC والمبلغ والعملة ومعرّف التكامل.
- صفحة العودة تتحقق من حالة الدفع من الخادم؛ إعادة التوجيه وحدها لا تعتبر إثبات دفع.

## 1. تجهيز قاعدة البيانات
افتح Supabase SQL Editor ونفّذ كامل الملف `supabase/payments.sql`.
الرابط المباشر: https://github.com/saeedgmal6-tech/-/blob/main/supabase/payments.sql

## 2. تفعيل Paymob
1. أنشئ/فعّل حساب تاجر Paymob من https://accept.paymob.com/ وأكمل إجراءات التحقق.
2. اطلب تفعيل **Orange Cash / Mobile Wallets** على حساب التاجر.
3. من لوحة Paymob > Developers / Payment Integrations، انسخ رقم **Integration ID** الخاص بالمحافظ (Live للاستخدام الفعلي، Test للاختبار).
4. من إعدادات API Keys، جهّز **Secret Key** و**Public Key** و**HMAC Secret**.
5. اضبط Transaction Processed Callback URL لمحفظة الدفع إلى:
   `https://lahzetna.vercel.app/api/payments/webhook`
   يجب أن يرسل Paymob إشعار POST إلى هذا العنوان، ويجب اختبار HMAC بإشعار حقيقي/اختباري قبل الإطلاق.

## 3. متغيرات Vercel
من Project Settings > Environment Variables، أضف هذه المتغيرات إلى Production وPreview وDevelopment حسب الحاجة:
- `PAYMOB_SECRET_KEY` — Secret Key، النوع Sensitive
- `PAYMOB_PUBLIC_KEY` — Public Key
- `PAYMOB_WALLET_INTEGRATION_ID` — رقم تكامل Orange Cash Wallet
- `PAYMOB_HMAC_SECRET` — HMAC Secret، النوع Sensitive

لا تضع أي مفاتيح سرية في ملفات الواجهة أو GitHub أو رسائل عامة. بعد الإضافة أعد النشر.

## 4. اختبار آمن قبل استقبال أموال حقيقية
- ابدأ بمفاتيح Test وIntegration ID تجريبي إن كانت متاحة لحسابك.
- تأكد أن Paymob يرسل callback موقّعًا إلى `/api/payments/webhook`.
- اختبر نجاح الدفع وفشله، وتأكد أن الهدية لا تظهر في `/admin` قبل الدفع، وتظهر بعد تأكيد callback فقط.
- لا تحول Live قبل تأكيد تفعيل طريقة المحفظة ومطابقة إعداد HMAC.

## ملاحظة مهمة عن وصول الأرباح للمحفظة
دعم Orange Cash كطريقة يدفع بها الزائر لا يعني تلقائيًا أن تسوية أرباح التاجر ستصل إلى محفظة Orange Cash الشخصية. طريقة وموعد تسوية الأموال يعتمدان على اتفاق حساب التاجر مع Paymob؛ أكّد معهم صراحةً هل يمكن تسوية المبالغ إلى Orange Cash، وما الرسوم. لا تفترض أن التحويل للمحفظة مدعوم لمجرد ظهور Orange Cash كطريقة دفع.

## المتغيرات الحالية الأخرى
يلزم أن يكون `VITE_SUPABASE_URL` و`SUPABASE_SERVICE_ROLE_KEY` صحيحين في Vercel. لا تكشف قيمة Service Role Key؛ هذا المفتاح يتيح صلاحيات واسعة على قاعدة البيانات.
