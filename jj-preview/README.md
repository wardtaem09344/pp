# ward-aiseek

تطبيق دردشة عربي بعدة نماذج، مع بحث وقراءة فعلية للإنترنت عبر دوال Vercel.

- `index.html` الواجهة
- `connection.js` إعدادات الاتصال (الرابط والرمز والجهاز). يمكن تجاوزها بمتغيرات البيئة `AISEEK_URL` و`AISEEK_TOKEN` و`AISEEK_DEVICE_INFO`
- `api/chat.js` وسيط الدردشة (يتجاوز CORS ويخبّئ الرمز)
- `api/search.js` بحث متوازٍ (DuckDuckGo وBing وويكيبيديا وGDELT)
- `api/read.js` فتح الصفحة وقراءة نصها (مع قارئ بديل للصفحات المحجوبة)
- `api/config.js` يعلن للواجهة توفر البحث والقراءة

اختياري: `PROXY_KEY` لحماية الدوال بمفتاح.
