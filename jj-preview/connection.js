// ملف الاتصال بخدمة الذكاء الاصطناعي.
// يُستخدم على الخادم فقط (api/chat.js). موقعه خارج مجلد public فلا يُقدَّم للمتصفح ولا يراه المستخدم.
// يمكن تجاوز أي قيمة من متغيرات البيئة في Vercel:
//   AISEEK_URL, AISEEK_TOKEN, AISEEK_DEVICE_INFO

module.exports = {
  url: process.env.AISEEK_URL || 'https://ai-seek.thebetter.ai/v4/chat/send',
  appId: 'ai-seek',
  token:
    process.env.AISEEK_TOKEN ||
    'eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJBUy1YNkNZUiIsImF1ZCI6ImFpLXNlZWsiLCJwcm92aWRlciI6InV1aWQiLCJpc3MiOiJhaS1zZWVrIiwiZXhwIjoyMDkzMTk5ODY1LCJpYXQiOjE3Nzc4Mzk4NjV9.w2wlNLg2S-om4xqWmakO2tEUjiPjxtGwFozmoI217VUu7KGC1O3qaL7KdyEIBYrGxIZV3lMWospZPPgVOYJjOeDgKBFnhg1_7NRKfmCEum_0moUEqH6dGFtQUQixDi63k63wv6GhOs1Sorj6hLzdBxX6NHU6otOo6brls5UNYbc',
  deviceInfo:
    process.env.AISEEK_DEVICE_INFO ||
    'appIdentifier=ai.chatbot.ask.chat.deep.seek.assistant.search.free;appVersion=2.7.1-26042486;deviceType=android;deviceCountry=EG;appCountry=eg;local=ar_EG;language=ar;timezone=Asia/Baghdad;brand=POCO;model=2311DRK48G;androidId=6a33f4473da78ff9',
};
