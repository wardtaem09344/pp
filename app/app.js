/* ChatGPT-style clone — vanilla JS */
(() => {
'use strict';

/* ---------------- API base ---------------- */
const LOCAL = new Set(['localhost', '127.0.0.1', '[::1]']);
const RAW = window.__API_BASE__ || '';
const UNRESOLVED = RAW.startsWith('__PORT_');
const API = UNRESOLVED ? (LOCAL.has(location.hostname) && location.port !== '8000' ? 'http://localhost:8000' : '') : RAW.replace(/\/$/, '');
/* Authentication is an opaque bearer token in memory or secure HttpOnly cookie.
   The visitor hash is navigation only and NEVER a session credential. */
let MEM_TOKEN = '';
function readVid() { const m = location.hash.match(/#\/v\/([\w-]+)/); return m ? m[1] : ''; }
let VID = readVid() || ('v' + Math.random().toString(36).slice(2, 14));
if (!readVid()) {
  history.replaceState(null, '', '#/v/' + VID + (location.hash.match(/^#\/c\//) ? '/' + location.hash.slice(1) : ''));
}
const getToken = () => MEM_TOKEN;
const setToken = (t) => { MEM_TOKEN = t || ''; };
const api = (path, opts = {}) => fetch(API + path, { credentials: 'same-origin', ...opts, headers: { 'Content-Type': 'application/json', 'X-Visitor-Id': VID, ...(getToken() ? { Authorization: 'Bearer ' + getToken() } : {}), ...(opts.headers || {}) } });
const mediaUrl = (n) => `${API}/api/media/${n}`;

/* ---------------- Icons ---------------- */
const S = (p, w = 20, extra = '') => `<svg width="${w}" height="${w}" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" ${extra}>${p}</svg>`;
const ICONS = {
  logo: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" aria-label="Logo"><path d="M12 2.8l7.9 4.6v9.2L12 21.2l-7.9-4.6V7.4z"/><path d="M12 7.4l3.95 2.3v4.6L12 16.6l-3.95-2.3V9.7z"/><path d="M12 2.8v4.6M19.9 7.4l-3.95 2.3M19.9 16.6l-3.95-2.3M12 21.2v-4.6M4.1 16.6l3.95-2.3M4.1 7.4l3.95 2.3"/></svg>`,
  sidebar: S('<rect x="2.75" y="3.75" width="14.5" height="12.5" rx="3"/><path d="M7.5 3.75v12.5"/>'),
  newchat: S('<path d="M9.5 3.5H6a3 3 0 0 0-3 3v7.5a3 3 0 0 0 3 3h7.5a3 3 0 0 0 3-3v-3.5"/><path d="M14.9 2.6a1.6 1.6 0 0 1 2.3 2.3L10.5 11.6l-3 .8.8-3z"/>'),
  search: S('<circle cx="9" cy="9" r="5.75"/><path d="M13.25 13.25L17 17"/>'),
  library: S('<rect x="3" y="3" width="14" height="14" rx="3"/><circle cx="7.5" cy="7.5" r="1.4"/><path d="M17 12.5l-3.6-3.6L5 17"/>'),
  gpts: S('<circle cx="6" cy="6" r="2.6"/><circle cx="14" cy="6" r="2.6"/><circle cx="6" cy="14" r="2.6"/><circle cx="14" cy="14" r="2.6"/>'),
  folder: S('<path d="M2.75 6.25a2 2 0 0 1 2-2h3l1.8 2h5.7a2 2 0 0 1 2 2v6.5a2 2 0 0 1-2 2H4.75a2 2 0 0 1-2-2z"/><path d="M10 9.5v4M8 11.5h4"/>'),
  menu: S('<path d="M3.5 6.5h13M3.5 13.5h8"/>'),
  chevron: S('<path d="M5.5 8l4.5 4.5L14.5 8"/>', 16),
  cmd: S('<path d="M2.75 4.75a2 2 0 0 1 2-2h10.5a2 2 0 0 1 2 2v7.5a2 2 0 0 1-2 2H4.75a2 2 0 0 1-2-2z"/><path d="M6 13.25v2.5M14 13.25v2.5M2.75 8h14.5"/>', 16),
  fileCode: S('<path d="M4.75 2.75h6l4.5 4.5v9a1.75 1.75 0 0 1-1.75 1.75H4.75A1.75 1.75 0 0 1 3 16.25V4.5a1.75 1.75 0 0 1 1.75-1.75z"/><path d="M10.75 2.75v4.5h4.5M7.5 11l-1.25 1.75L7.5 14.5M12.5 11l1.25 1.75L12.5 14.5"/>', 16),
  code: S('<path d="M6.75 5.5L3 10l3.75 4.5M13.25 5.5L17 10l-3.75 4.5"/>', 15),
  play: S('<path d="M6.5 4.5l9 5.5-9 5.5z" fill="currentColor" stroke="none"/>', 14),
  share: S('<path d="M10 12.5V3M6.5 6.25L10 2.75l3.5 3.5"/><path d="M5 9.5H4.5a1.75 1.75 0 0 0-1.75 1.75v4.5c0 .97.78 1.75 1.75 1.75h11c.97 0 1.75-.78 1.75-1.75v-4.5c0-.97-.78-1.75-1.75-1.75H15"/>'),
  temp: S('<path d="M10 2.75a7.25 7.25 0 1 1-6.9 5" stroke-dasharray="2.2 2.4"/><path d="M10 6v4l2.5 1.5"/>'),
  dots: S('<circle cx="4.5" cy="10" r="1.1" fill="currentColor"/><circle cx="10" cy="10" r="1.1" fill="currentColor"/><circle cx="15.5" cy="10" r="1.1" fill="currentColor"/>'),
  dotsV: S('<circle cx="10" cy="4.5" r="1.1" fill="currentColor"/><circle cx="10" cy="10" r="1.1" fill="currentColor"/><circle cx="10" cy="15.5" r="1.1" fill="currentColor"/>'),
  plus: S('<path d="M10 4v12M4 10h12"/>'),
  mic: S('<rect x="7.25" y="2.75" width="5.5" height="9" rx="2.75"/><path d="M4.5 9.5a5.5 5.5 0 0 0 11 0M10 15v2.5"/>'),
  voice: `<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><rect x="3" y="8" width="2" height="4" rx="1"/><rect x="7" y="5" width="2" height="10" rx="1"/><rect x="11" y="3" width="2" height="14" rx="1"/><rect x="15" y="7" width="2" height="6" rx="1"/></svg>`,
  arrowup: S('<path d="M10 16V4.5M5 9.5l5-5 5 5"/>', 20, 'stroke-width="2"'),
  arrowdown: S('<path d="M10 4v11.5M5 10.5l5 5 5-5"/>', 18, 'stroke-width="1.8"'),
  stop: `<svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><rect x="1" y="1" width="12" height="12" rx="2.5"/></svg>`,
  x: S('<path d="M5 5l10 10M15 5L5 15"/>', 16),
  image: S('<rect x="2.75" y="3.75" width="14.5" height="12.5" rx="2.5"/><circle cx="7" cy="8" r="1.4"/><path d="M17.25 13l-4-4-8.5 7.25"/>'),
  clip: S('<path d="M15.5 9.25l-5.6 5.6a3.5 3.5 0 0 1-4.95-4.95l6.2-6.2a2.33 2.33 0 0 1 3.3 3.3l-6.2 6.2a1.17 1.17 0 0 1-1.65-1.65l5.6-5.6"/>'),
  download: S('<path d="M10 3.25v9.5M6 9l4 4 4-4M3.75 16.5h12.5"/>'),
  diff: S('<path d="M6 3.5v13M3.5 6H8.5M3.5 14h5M14 3.5v13M11.5 10h5"/>'),
  bulb: S('<path d="M7.25 14.5h5.5M8 17.25h4M10 2.75a5 5 0 0 0-3 9c.6.45 1 1.1 1 1.85v.9h4v-.9c0-.75.4-1.4 1-1.85a5 5 0 0 0-3-9z"/>'),
  telescope: S('<path d="M3 12.5l10.5-6 1.75 3L4.75 15.5z"/><path d="M13.5 6.5l2.6-1.5 1.75 3-2.6 1.5M8.75 13.5L7 18M10.25 12.6L12.5 18"/>'),
  globe: S('<circle cx="10" cy="10" r="7.25"/><path d="M2.75 10h14.5M10 2.75c2 2.1 2.9 4.5 2.9 7.25S12 15.15 10 17.25C8 15.15 7.1 12.75 7.1 10S8 4.85 10 2.75z"/>'),
  more: S('<circle cx="4.5" cy="10" r="1.1" fill="currentColor"/><circle cx="10" cy="10" r="1.1" fill="currentColor"/><circle cx="15.5" cy="10" r="1.1" fill="currentColor"/>'),
  copy: S('<rect x="6.75" y="6.75" width="10.5" height="10.5" rx="2.25"/><path d="M13.25 6.75V5A2.25 2.25 0 0 0 11 2.75H5A2.25 2.25 0 0 0 2.75 5v6A2.25 2.25 0 0 0 5 13.25h1.75"/>', 18),
  check: S('<path d="M4.5 10.5l3.5 3.5 7.5-8"/>', 18),
  edit: S('<path d="M12.6 3.9a1.9 1.9 0 0 1 2.7 2.7l-8.8 8.8-3.6.9.9-3.6z"/><path d="M11.25 5.25l3.5 3.5"/>', 18),
  up: S('<path d="M6.25 9.25v7.5h-2.5v-7.5zM6.25 9.25l3-6.25c1.1 0 2 .9 2 2v2.75h4.1c1 0 1.75.9 1.6 1.9l-1 6c-.15.8-.8 1.35-1.6 1.35H6.25"/>', 18),
  down: S('<path d="M6.25 10.75v-7.5h-2.5v7.5zM6.25 10.75l3 6.25c1.1 0 2-.9 2-2v-2.75h4.1c1 0 1.75-.9 1.6-1.9l-1-6c-.15-.8-.8-1.35-1.6-1.35H6.25"/>', 18),
  upF: `<svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor"><path d="M3 9h3.5v8H3zM7.5 9l3-6.5c1.2 0 2.2 1 2.2 2.2V7.5h3.6c1.1 0 1.9 1 1.7 2.1l-1 6c-.2.9-.9 1.4-1.7 1.4H7.5z"/></svg>`,
  downF: `<svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor"><path d="M3 11h3.5V3H3zM7.5 11l3 6.5c1.2 0 2.2-1 2.2-2.2V12.5h3.6c1.1 0 1.9-1 1.7-2.1l-1-6c-.2-.9-.9-1.4-1.7-1.4H7.5z"/></svg>`,
  speaker: S('<path d="M3 7.75v4.5h3l4.25 3.5V4.25L6 7.75z"/><path d="M13.25 7.25a3.9 3.9 0 0 1 0 5.5M15.5 5a7 7 0 0 1 0 10"/>', 18),
  regen: S('<path d="M16.25 10a6.25 6.25 0 1 1-1.83-4.42"/><path d="M16.25 3.5v3.5h-3.5"/>', 18),
  shareSm: S('<path d="M10 12.5V3M6.5 6.25L10 2.75l3.5 3.5"/><path d="M5 9.5H4.5a1.75 1.75 0 0 0-1.75 1.75v4.5c0 .97.78 1.75 1.75 1.75h11c.97 0 1.75-.78 1.75-1.75v-4.5c0-.97-.78-1.75-1.75-1.75H15"/>', 18),
  pencil: S('<path d="M12.6 3.9a1.9 1.9 0 0 1 2.7 2.7l-8.8 8.8-3.6.9.9-3.6z"/>', 18),
  trash: S('<path d="M3.5 5.5h13M8 5.5V4a1.25 1.25 0 0 1 1.25-1.25h1.5A1.25 1.25 0 0 1 12 4v1.5M5 5.5l.75 10.25A1.75 1.75 0 0 0 7.5 17.25h5a1.75 1.75 0 0 0 1.75-1.5L15 5.5"/>', 18),
  pin: S('<path d="M12.5 2.75l4.75 4.75-2.5 1-3 3 .25 3.5-1.25 1.25L7.5 13 3.5 17M7.5 13L4 9.5l1.25-1.25 3.5.25 3-3z"/>', 18),
  archive: S('<rect x="2.75" y="3.5" width="14.5" height="4" rx="1.25"/><path d="M4 7.5v7.25a1.75 1.75 0 0 0 1.75 1.75h8.5A1.75 1.75 0 0 0 16 14.75V7.5M8 11h4"/>', 18),
  gear: S('<circle cx="10" cy="10" r="2.5"/><path d="M10 2.75l1.3 1.6 2-.45.6 2 1.95.75-.45 2L16.75 10l-1.35 1.35.45 2-1.95.75-.6 2-2-.45L10 17.25l-1.3-1.6-2 .45-.6-2-1.95-.75.45-2L3.25 10 4.6 8.65l-.45-2 1.95-.75.6-2 2 .45z"/>', 18),
  sparkle: S('<path d="M10 2.75l1.6 4.4 4.65 1.6-4.65 1.6L10 14.75 8.4 10.35 3.75 8.75 8.4 7.15z"/><path d="M15.5 13.5l.6 1.65 1.65.6-1.65.6-.6 1.65-.6-1.65-1.65-.6 1.65-.6z"/>', 18),
  user: S('<circle cx="10" cy="7" r="3.25"/><path d="M3.75 16.75a6.25 6.25 0 0 1 12.5 0"/>', 18),
  help: S('<circle cx="10" cy="10" r="7.25"/><path d="M7.9 7.75a2.15 2.15 0 0 1 4.2.6c0 1.4-2.1 1.9-2.1 3.15M10 14.25v.01"/>', 18),
  logout: S('<path d="M12.5 3.5h2a1.75 1.75 0 0 1 1.75 1.75v9.5a1.75 1.75 0 0 1-1.75 1.75h-2M8 13.75L4.25 10 8 6.25M4.5 10h8"/>', 18),
  sun: S('<circle cx="10" cy="10" r="3.25"/><path d="M10 2.5v1.5M10 16v1.5M2.5 10H4M16 10h1.5M4.7 4.7l1.05 1.05M14.25 14.25l1.05 1.05M4.7 15.3l1.05-1.05M14.25 5.75l1.05-1.05"/>', 18),
  moon: S('<path d="M16.5 11.75A6.75 6.75 0 0 1 8.25 3.5a6.75 6.75 0 1 0 8.25 8.25z"/>', 18),
  lang: S('<path d="M3 4.75h8M7 3v1.75M9.5 4.75c-.6 3.25-2.75 5.5-6 6.75M5.25 7.5c.85 1.65 2.25 2.9 4 3.75M10.5 17l3.25-7.75L17 17M11.6 14.5h4.3"/>', 18),
  db: S('<ellipse cx="10" cy="4.75" rx="6.25" ry="2"/><path d="M3.75 4.75v10.5c0 1.1 2.8 2 6.25 2s6.25-.9 6.25-2V4.75M3.75 10c0 1.1 2.8 2 6.25 2s6.25-.9 6.25-2"/>', 18),
  chat: S('<path d="M4 14.5l-1.25 2.75 3.5-1.25A7.25 7.25 0 1 0 4 14.5z"/>', 18),
  doc: S('<path d="M5.75 2.75h5.5l3.5 3.5v9.5a1.5 1.5 0 0 1-1.5 1.5h-7.5a1.5 1.5 0 0 1-1.5-1.5v-11.5a1.5 1.5 0 0 1 1.5-1.5z"/><path d="M11 2.75v3.75h3.75M7.25 10.5h5.5M7.25 13.5h3.5"/>', 18),
  agent: S('<rect x="2.75" y="4.75" width="14.5" height="10.5" rx="3"/><path d="M7 4.75V3a1.25 1.25 0 0 1 1.25-1.25h3.5A1.25 1.25 0 0 1 13 3v1.75"/><path d="M7 9h6M7 11.5h4"/>', 20),
  agentRun: S('<rect x="3.25" y="5.75" width="13.5" height="9.5" rx="2.75"/><circle cx="10" cy="10.5" r="2.2"/><path d="M10 12.7v2.55M5.4 10.5H3.25M16.75 10.5H14.6"/>', 20),
  eye: S('<path d="M1.75 10s3-5.75 8.25-5.75S18.25 10 18.25 10 15.25 15.75 10 15.75 1.75 10 1.75 10z"/><circle cx="10" cy="10" r="2.5"/>', 18),
  chevSide: S('<path d="M8 5.5l4.5 4.5L8 14.5"/>', 16),
};
const icon = (n) => ICONS[n] || '';
const iconSz = (n, px) => icon(n).replace(/width="\d+" height="\d+"/, `width="${px}" height="${px}"`);
function hydrateIcons(root = document) { root.querySelectorAll('[data-icon]').forEach(el => { if (!el.dataset.done) { el.innerHTML = icon(el.dataset.icon); el.dataset.done = 1; } }); }

/* ---------------- i18n ---------------- */
const STR = {
  ar: {
    new_chat: 'دردشة جديدة', search_chats: 'البحث في الدردشات', library: 'المكتبة', gpts: 'GPTs', new_project: 'مشروع جديد',
    chats: 'الدردشات', user_name: 'مستخدم', plan_free: 'مجاني', upgrade: 'ترقية', share: 'مشاركة',
    open_sidebar: 'فتح الشريط الجانبي', close_sidebar: 'إغلاق الشريط الجانبي', temp_chat: 'تشغيل الدردشة المؤقتة',
    add_files: 'إضافة ملفات والمزيد', dictate: 'إملاء', placeholder: 'اسأل عن أي شيء', placeholder_img: 'صِف صورة أو عدّل صورة',
    disclaimer: 'قد يرتكب ChatGPT أخطاءً. تحقق من المعلومات المهمة.',
    welcome: ['بماذا يمكنني المساعدة؟', 'ما الذي يدور في ذهنك اليوم؟', 'من أين نبدأ؟', 'جاهز عندما تكون جاهزاً.', 'ما الجدول اليوم؟'],
    temp_title: 'دردشة مؤقتة', temp_note: 'تخفي الواجهة هذه الدردشة أثناء الجلسة وتحاول حذفها عند الانتقال. قد تبقى بيانات على الخادم إذا أُغلقت الصفحة؛ وتخضع معالجة الرسائل لسياسة مزوّد النموذج.',
    add_photos: 'إضافة صور وملفات', create_image: 'إنشاء صورة', thinking: 'فكّر لفترة أطول', deep_research: 'بحث متعمق', web_search: 'بحث في الويب', more: 'المزيد',
    agent_tools_head: 'أدوات الوكيل', tool_write: 'الكتابة', tool_write_sub: 'إنشاء نص أو مسودة', tool_edit: 'التحرير والتعديل', tool_edit_sub: 'تحسين نص أو ملف موجود', tool_code: 'كتابة الأكواد', tool_code_sub: 'إنشاء أو تعديل ملفات برمجية', tool_command: 'تنفيذ أوامر', tool_command_sub: 'تشغيل أمر ضمن بيئة الوكيل',
    preset_write: 'ساعدني في كتابة النص التالي. اسألني عن التفاصيل الناقصة عند الحاجة:\n', preset_edit: 'ساعدني في تحرير النص أو الملف التالي وتحسينه. سأضيف المحتوى أو التفاصيل بعد ذلك:\n', preset_code: 'اكتب أو عدّل الكود المطلوب. وضّح الملفات والتغييرات، ثم اختبرها إن أمكن:\n', preset_command: 'أريد تنفيذ أمر ضمن بيئة المشروع. اشرح الأمر المقترح وآثاره قبل تشغيل أي أمر يغيّر الملفات أو البيئة:\n',
    image_chip: 'صورة', think_chip: 'تفكير', search_chip: 'بحث', research_chip: 'بحث متعمق',
    copy: 'نسخ', copied: 'تم النسخ', edit: 'تعديل الرسالة', good: 'رد جيد', bad: 'رد سيئ', read: 'قراءة بصوت عالٍ', stop_read: 'إيقاف', regen: 'إعادة المحاولة', share_msg: 'مشاركة',
    cancel: 'إلغاء', send: 'إرسال', copy_code: 'نسخ الرمز', code_copied: 'تم النسخ',
    rename: 'إعادة التسمية', delete: 'حذف', pin: 'تثبيت الدردشة', unpin: 'إلغاء التثبيت', archive: 'أرشفة',
    del_title: 'هل تريد حذف الدردشة؟', del_body: (t) => `سيؤدي هذا إلى حذف <strong>${t}</strong>.`, del_hint: 'لن تتمكن من التراجع عن هذا الإجراء.',
    no_chats: 'لا توجد دردشات بعد', search_ph: 'البحث في الدردشات...', today: 'اليوم', yesterday: 'أمس', prev7: 'آخر 7 أيام', prev30: 'آخر 30 يوماً', older: 'أقدم',
    no_results: 'لا توجد نتائج', settings: 'الإعدادات', personalize: 'التخصيص', help: 'المساعدة', logout: 'تسجيل الخروج', upgrade_plan: 'ترقية الخطة',
    general: 'عام', data: 'عناصر التحكم في البيانات', theme: 'المظهر', language: 'اللغة', sys: 'النظام', dark: 'داكن', light: 'فاتح',
    delete_all: 'حذف جميع الدردشات', delete_all_btn: 'حذف الكل', del_all_title: 'مسح سجل الدردشة؟', del_all_body: 'سيتم حذف جميع الدردشات نهائياً.',
    model_head: 'النماذج المتصلة فعليًا', no_verified_models: 'لا توجد نماذج مؤكدة', connect_provider: 'اربط مزودًا ثم اختبر النماذج', m1: 'GPT-5.1', m1s: 'ذكي ومتعدد الاستخدامات', m2: 'GPT-5 mini', m2s: 'سريع للمهام اليومية', m3: 'Claude Sonnet', m3s: 'نموذج بديل للكتابة والبرمجة', m4: 'Grok', m4s: 'مباشر وسريع البديهة', m5: 'DeepSeek', m5s: 'قوي في البرمجة والتحليل', m6: 'Qwen', m6s: 'متعدد اللغات من Alibaba', m7: 'Gemini Flash', m7s: 'سريع من جوجل',
    err: 'حدث خطأ أثناء إنشاء الرد.', retry: 'إعادة المحاولة', creating_image: 'جارٍ إنشاء الصورة…', thinking_lbl: 'يفكر',
    shared: 'تم نسخ المحادثة إلى الحافظة', soon: 'هذه الميزة غير متاحة في هذه النسخة', mic_na: 'الإملاء الصوتي غير مدعوم في هذا المتصفح',
    lib_title: 'المكتبة', lib_empty: 'الصور التي تنشئها ستظهر هنا', stopped: 'تم الإيقاف', upgrade_t: 'ترقية خطتك', upgrade_b: 'تختلف الميزات والحصص حسب الخطة وتُفرض من الخادم.',
    gpts_t: 'GPTs', proj_t: 'المشاريع', ok: 'حسناً', archived: 'تمت الأرشفة',
    searching: 'جارٍ البحث في الويب', reading: (n) => `جارٍ قراءة ${n} مصادر`, sources: 'المصادر', sources_n: (n) => `${n} مصادر`, citations: 'الاستشهادات',
    thought_for: (s) => `فكّر لمدة ${s} ث`, research_lbl: 'بحث متعمق', research_plan: 'خطة البحث', research_read: 'قراءة المصادر', research_write: 'كتابة التقرير',
    research_done: (m, n) => `اكتمل البحث في ${m} · ${n} مصادر`, research_running: 'جارٍ البحث المتعمق…', searched_for: 'بحث عن',
    sug_image: 'إنشاء صورة', sug_summ: 'تلخيص نص', sug_write: 'المساعدة في الكتابة', sug_news: 'آخر الأخبار', sug_research: 'بحث متعمق', sug_analyze: 'تحليل الصور',
    p_summ: 'لخّص لي هذا النص في نقاط واضحة:\n', p_write: 'ساعدني في كتابة ', p_news: 'ما أبرز الأخبار اليوم؟',
    voice_listen: 'جارٍ الاستماع…', voice_think: 'جارٍ التفكير…', voice_speak: 'يتحدث…', voice_na: 'الوضع الصوتي يحتاج متصفحاً يدعم التعرف على الكلام (مثل Chrome) والسماح للميكروفون.', voice_tap: 'اضغط على الدائرة للتحدث',
    /* auth */
    login_title: 'مرحباً بك مجدداً', signup_title: 'أنشئ حسابك', login_sub: 'سجّل الدخول للمتابعة إلى حسابك', signup_sub: 'سجّل مجاناً وابدأ الدردشة فوراً',
    f_name: 'الاسم', f_email: 'البريد الإلكتروني', f_pass: 'كلمة المرور', login_btn: 'تسجيل الدخول', signup_btn: 'إنشاء حساب',
    no_account: 'ليس لديك حساب؟', has_account: 'لديك حساب بالفعل؟', err_bad: 'البريد الإلكتروني أو كلمة المرور غير صحيحة', err_exists: 'هذا البريد مسجّل مسبقاً', err_invalid: 'تأكد من البريد وكلمة مرور من 10 أحرف على الأقل', working: 'جارٍ المعالجة…',
    /* mode toggle + agent */
    mode_chat: 'المحادثة', mode_agent: 'وكيل',
    welcome_agent: 'بماذا يساعدك الوكيل اليوم؟', agent_ph: 'صف المهمة وسيتولى الوكيل التنفيذ…',
    agent_panel: 'نشاط الوكيل', agent_plan: 'التخطيط', agent_search: 'البحث في الويب', agent_read: 'قراءة المصادر', agent_write: 'كتابة النتيجة',
    agent_task: 'المهمة', agent_done: 'اكتملت المهمة', agent_live: 'يعمل الآن', lines: 'سطر', show_code: 'الكود', hide_code: 'إخفاء الكود', preview: 'معاينة فوري', preview_title: 'معاينة',
    download: 'تنزيل', download_all: 'تنزيل الكل (ZIP)', files_made: (n) => `الملفات (${n})`, show_diff: 'عرض التغييرات', hide_diff: 'إخفاء التغييرات', edited: 'تم التعديل', created: 'تم الإنشاء', before_after: 'قبل / بعد', diff_none: 'لا فرق في المحتوى', diff_more: 'تم اقتطاع باقي الفروقات', dl_fail: 'تعذّر تنزيل الملف', reading_file: 'قراءة ملف', edit_failed: 'تعذّر تطبيق التعديل', agent_thinking: 'يفكّر', think_notes: 'ملاحظات التفكير', wide_search: 'تفكير وبحث موسّع', searching_wide: 'يبحث بشكل أوسع…', queries_n: (n) => `${n} استعلامات`, agent_exec: 'تنفيذ أمر', no_src_dd: 'لا مصادر', sources_open: 'عرض المصادر',
    sug_trip: 'خطط رحلة كاملة', sug_compare: 'قارن خيارات', sug_report: 'تقرير بحثي',
    p_trip: 'خطط لي رحلة 5 أيام إلى إسطنبول بميزانية متوسطة، مع جدول يومي وتقدير التكاليف', p_compare: 'قارن أفضل 3 هواتف سعرها أقل من 500 دولار هذا العام مع مزايا وعيوب كل واحد', p_report: 'اكتب لي تقريراً بحثياً عن أثر الذكاء الاصطناعي على سوق العمل في العالم العربي',
    /* admin */
    admin_title: 'لوحة التحكم', admin_overview: 'نظرة عامة', admin_users: 'المستخدمون', admin_chats: 'الدردشات', admin_settings: 'الإعدادات',
    stat_users: 'المستخدمون', stat_chats: 'الدردشات', stat_messages: 'الرسائل', stat_images: 'الصور المُنشأة', stat_searches: 'عمليات البحث', stat_research: 'أبحاث متعمقة', stat_agent: 'مهام الوكيل',
    role_owner: 'مالك', role_user: 'مستخدم', col_email: 'البريد', col_name: 'الاسم', col_role: 'الدور', col_joined: 'الانضمام', col_chats: 'الدردشات', col_msgs: 'الرسائل', col_title: 'العنوان',
    user_delete: 'حذف', user_reset: 'إعادة تعيين كلمة المرور', user_makeowner: 'ترقية إلى مالك', user_makeuser: 'تحويل إلى مستخدم', reset_done: 'كلمة المرور الجديدة', del_user_q: 'حذف هذا المستخدم وكل دردشاته؟',
    admin_sysprompt: 'التوجيه العام للنماذج (System Prompt)', admin_models: 'النماذج المتاحة', admin_keys: 'مفاتيح الـ API (تُحفظ على الخادم فقط)',
    key_gemini: 'مفتاح Gemini', key_aiseek: 'رمز ai-seek', save: 'حفظ', saved: 'تم الحفظ', change_pw: 'تغيير كلمة المرور', current_pw: 'كلمة المرور الحالية', new_pw: 'كلمة المرور الجديدة',
    pw_changed: 'تم تغيير كلمة المرور', pw_wrong: 'كلمة المرور الحالية غير صحيحة', view_chat: 'عرض', admin_recent: 'أحدث المستخدمين', no_data: 'لا توجد بيانات',
  },
  en: {
    new_chat: 'New chat', search_chats: 'Search chats', library: 'Library', gpts: 'GPTs', new_project: 'New project',
    chats: 'Chats', user_name: 'User', plan_free: 'Free', upgrade: 'Upgrade', share: 'Share',
    open_sidebar: 'Open sidebar', close_sidebar: 'Close sidebar', temp_chat: 'Turn on temporary chat',
    add_files: 'Add files and more', dictate: 'Dictate', placeholder: 'Ask anything', placeholder_img: 'Describe or edit an image',
    disclaimer: 'ChatGPT can make mistakes. Check important info.',
    welcome: ['What can I help with?', 'What’s on your mind today?', 'Where should we begin?', 'Ready when you are.', 'What’s on the agenda today?'],
    temp_title: 'Temporary Chat', temp_note: 'The interface hides this chat during the session and attempts deletion when navigating away. Data can remain on the server if the page closes; model-provider processing follows its own policy.',
    add_photos: 'Add photos & files', create_image: 'Create image', thinking: 'Think longer', deep_research: 'Deep research', web_search: 'Web search', more: 'More',
    agent_tools_head: 'Agent tools', tool_write: 'Writing', tool_write_sub: 'Create a draft or text', tool_edit: 'Edit and revise', tool_edit_sub: 'Improve existing text or files', tool_code: 'Write code', tool_code_sub: 'Create or edit code files', tool_command: 'Run commands', tool_command_sub: 'Run a command in the agent environment',
    preset_write: 'Help me write the following. Ask for missing details when needed:\n', preset_edit: 'Help me revise and improve the following text or file. I will add the content or details next:\n', preset_code: 'Write or modify the requested code. Explain the files and changes, then test them if possible:\n', preset_command: 'I want to run a command in the project environment. Explain the proposed command and its effects before running anything that changes files or the environment:\n',
    image_chip: 'Image', think_chip: 'Think', search_chip: 'Search', research_chip: 'Research',
    copy: 'Copy', copied: 'Copied', edit: 'Edit message', good: 'Good response', bad: 'Bad response', read: 'Read aloud', stop_read: 'Stop', regen: 'Try again', share_msg: 'Share',
    cancel: 'Cancel', send: 'Send', copy_code: 'Copy code', code_copied: 'Copied',
    rename: 'Rename', delete: 'Delete', pin: 'Pin chat', unpin: 'Unpin', archive: 'Archive',
    del_title: 'Delete chat?', del_body: (t) => `This will delete <strong>${t}</strong>.`, del_hint: 'This action can’t be undone.',
    no_chats: 'No chats yet', search_ph: 'Search chats...', today: 'Today', yesterday: 'Yesterday', prev7: 'Previous 7 days', prev30: 'Previous 30 days', older: 'Older',
    no_results: 'No results', settings: 'Settings', personalize: 'Personalization', help: 'Help', logout: 'Log out', upgrade_plan: 'Upgrade plan',
    general: 'General', data: 'Data controls', theme: 'Theme', language: 'Language', sys: 'System', dark: 'Dark', light: 'Light',
    delete_all: 'Delete all chats', delete_all_btn: 'Delete all', del_all_title: 'Clear your chat history?', del_all_body: 'All chats will be permanently deleted.',
    model_head: 'Verified connected models', no_verified_models: 'No verified models', connect_provider: 'Connect a provider and test its models', m1: 'GPT-5.1', m1s: 'Smart and versatile', m2: 'GPT-5 mini', m2s: 'Fast for everyday tasks', m3: 'Claude Sonnet', m3s: 'Alternative for writing & code', m4: 'Grok', m4s: 'Direct and quick', m5: 'DeepSeek', m5s: 'Strong at code & analysis', m6: 'Qwen', m6s: 'Multilingual by Alibaba', m7: 'Gemini Flash', m7s: 'Fast, by Google',
    err: 'Something went wrong while generating the response.', retry: 'Retry', creating_image: 'Creating image…', thinking_lbl: 'Thinking',
    shared: 'Conversation copied to clipboard', soon: 'This feature isn’t available in this clone', mic_na: 'Dictation isn’t supported in this browser',
    lib_title: 'Library', lib_empty: 'Images you create will show up here', stopped: 'Stopped', upgrade_t: 'Upgrade your plan', upgrade_b: 'Features and usage limits differ by plan and are enforced by the server.',
    gpts_t: 'GPTs', proj_t: 'Projects', ok: 'OK', archived: 'Archived',
    searching: 'Searching the web', reading: (n) => `Reading ${n} sources`, sources: 'Sources', sources_n: (n) => `${n} sources`, citations: 'Citations',
    thought_for: (s) => `Thought for ${s}s`, research_lbl: 'Deep research', research_plan: 'Research plan', research_read: 'Reading sources', research_write: 'Writing report',
    research_done: (m, n) => `Research completed in ${m} · ${n} sources`, research_running: 'Researching…', searched_for: 'Searched for',
    sug_image: 'Create image', sug_summ: 'Summarize text', sug_write: 'Help me write', sug_news: 'Latest news', sug_research: 'Deep research', sug_analyze: 'Analyze images',
    p_summ: 'Summarize this text in clear bullet points:\n', p_write: 'Help me write ', p_news: 'What are the top news stories today?',
    voice_listen: 'Listening…', voice_think: 'Thinking…', voice_speak: 'Speaking…', voice_na: 'Voice mode needs a browser with speech recognition (like Chrome) and microphone access.', voice_tap: 'Tap the orb to talk',
    /* auth */
    login_title: 'Welcome back', signup_title: 'Create your account', login_sub: 'Log in to continue to your account', signup_sub: 'Sign up free and start chatting',
    f_name: 'Name', f_email: 'Email', f_pass: 'Password', login_btn: 'Log in', signup_btn: 'Sign up',
    no_account: 'Don’t have an account?', has_account: 'Already have an account?', err_bad: 'Wrong email or password', err_exists: 'This email is already registered', err_invalid: 'Check the email and use a password of 6+ characters', working: 'Working…',
    /* mode toggle + agent */
    mode_chat: 'Chat', mode_agent: 'Agent',
    welcome_agent: 'What should Agent work on?', agent_ph: 'Describe the task and the agent will handle it…',
    agent_panel: 'Agent activity', agent_plan: 'Planning', agent_search: 'Searching the web', agent_read: 'Reading sources', agent_write: 'Writing result',
    agent_task: 'Task', agent_done: 'Task completed', agent_live: 'Working', lines: 'lines', show_code: 'Code', hide_code: 'Hide code', preview: 'Preview', preview_title: 'Preview',
    download: 'Download', download_all: 'Download all (ZIP)', files_made: (n) => `Files (${n})`, show_diff: 'Show changes', hide_diff: 'Hide changes', edited: 'Edited', created: 'Created', before_after: 'Before / After', diff_none: 'No difference in content', diff_more: 'Remaining differences truncated', dl_fail: 'Could not download the file', reading_file: 'Reading file', edit_failed: 'Edit could not be applied', agent_thinking: 'Thinking', think_notes: 'Thinking notes', wide_search: 'Thinking + wider search', searching_wide: 'Searching more widely…', queries_n: (n) => `${n} queries`, agent_exec: 'Run command', no_src_dd: 'No sources', sources_open: 'Show sources',
    sug_trip: 'Plan a full trip', sug_compare: 'Compare options', sug_report: 'Research report',
    p_trip: 'Plan a 5-day trip to Istanbul on a mid budget, with a daily schedule and cost estimates', p_compare: 'Compare the best 3 phones under $500 this year with pros and cons', p_report: 'Write me a research report on AI’s impact on the job market in the Arab world',
    /* admin */
    admin_title: 'Admin dashboard', admin_overview: 'Overview', admin_users: 'Users', admin_chats: 'Chats', admin_settings: 'Settings',
    stat_users: 'Users', stat_chats: 'Chats', stat_messages: 'Messages', stat_images: 'Images created', stat_searches: 'Web searches', stat_research: 'Deep research', stat_agent: 'Agent tasks',
    role_owner: 'Owner', role_user: 'User', col_email: 'Email', col_name: 'Name', col_role: 'Role', col_joined: 'Joined', col_chats: 'Chats', col_msgs: 'Messages', col_title: 'Title',
    user_delete: 'Delete', user_reset: 'Reset password', user_makeowner: 'Make owner', user_makeuser: 'Make user', reset_done: 'New password', del_user_q: 'Delete this user and all their chats?',
    admin_sysprompt: 'System prompt for models', admin_models: 'Available models', admin_keys: 'API keys (stored server-side only)',
    key_gemini: 'Gemini key', key_aiseek: 'ai-seek token', save: 'Save', saved: 'Saved', change_pw: 'Change password', current_pw: 'Current password', new_pw: 'New password',
    pw_changed: 'Password changed', pw_wrong: 'Current password is wrong', view_chat: 'View', admin_recent: 'Recent users', no_data: 'No data',
  },
};
const PREFS = {}; let prefTimer;
const store = { get(k, d) { return PREFS[k] ?? d; }, set(k, v) { PREFS[k] = v; clearTimeout(prefTimer); prefTimer = setTimeout(() => api('/api/prefs', { method: 'PUT', body: JSON.stringify(PREFS) }).catch(() => {}), 300); } };
let LANG = store.get('lang', 'ar');
const t = (k, ...a) => { const v = STR[LANG][k]; return typeof v === 'function' ? v(...a) : (v ?? k); };

/* ---------------- State ---------------- */
const MODELS = [{id:'fast',ver:'',name:t('no_verified_models'),sub:t('connect_provider'),brand:t('no_verified_models'),allowed:false,empty:true}];
let capabilities = null, activeRunId = null;
const state = {
  chats: [], chatId: null, messages: [], model: store.get('model', 'fast'), tools: [], mode: store.get('mode', 'chat'),
  attachments: [], ctrl: null, streaming: false, temp: false, tempIds: new Set(), theme: store.get('theme', 'system'),
  feedback: {}, speakingId: null, user: null,
};

/* ---------------- DOM ---------------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const appEl = $('#app'), input = $('#input'), sendBtn = $('#sendBtn'), thread = $('#thread'), msgsEl = $('#messages');
const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const isMobile = () => matchMedia('(max-width:767px)').matches;

/* ---------------- Theme & language ---------------- */
function applyTheme() {
  const dark = state.theme === 'dark' || (state.theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
}
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
function applyLang() {
  document.documentElement.lang = LANG; document.documentElement.dir = LANG === 'ar' ? 'rtl' : 'ltr';
  $$('[data-t]').forEach(el => el.textContent = t(el.dataset.t));
  setPlaceholder(); setWelcome(); renderChatList(); updateModelBtn(); renderToolChip(); renderSuggestions(); renderModeToggle(); renderAuthTexts(); renderProfileBits();
}
let welcomeIdx = Math.floor(Math.random() * 5);
function setWelcome() {
  const h = $('#welcomeTitle');
  if (state.temp) { h.innerHTML = `${esc(t('temp_title'))}<p class="temp-note">${esc(t('temp_note'))}</p>`; }
  else if (state.mode === 'agent') h.textContent = t('welcome_agent');
  else h.textContent = t('welcome')[welcomeIdx % t('welcome').length];
}
function setPlaceholder() {
  const ph = { image: t('placeholder_img'), search: LANG === 'ar' ? 'ابحث في الويب' : 'Search the web', research: LANG === 'ar' ? 'ما الذي تريد البحث فيه بعمق؟' : 'Get a detailed report', think: t('placeholder') };
  if (state.mode === 'agent') { input.placeholder = t('agent_ph'); return; }
  const pri = hasTool('image') ? 'image' : hasTool('research') ? 'research' : hasTool('search') ? 'search' : hasTool('think') ? 'think' : '';
  input.placeholder = ph[pri] || t('placeholder');
}

/* ---------------- Mode toggle (chat / agent) ---------------- */
function applyAgentMode() {
  const on = state.mode === 'agent';
  appEl.classList.toggle('agent-mode', on);
  /* animated code backdrop intentionally disabled: agent mode stays visually calm */
}
function renderModeToggle() {
  applyAgentMode();
  const tg = $('#modeToggle'); if (!tg) return;
  tg.classList.toggle('agent', state.mode === 'agent');
  $$('.mode-opt', tg).forEach(b => b.classList.toggle('on', b.dataset.m === state.mode));
  const thumb = $('#modeThumb');
  const agentBtn = tg.querySelector('.mode-opt[data-m=agent]');
  if (state.mode === 'agent') { thumb.style.width = agentBtn.offsetWidth + 'px'; thumb.style.transform = `translateX(${tg.dir === 'rtl' || document.documentElement.dir === 'rtl' ? agentBtn.offsetLeft - tg.querySelector('.mode-opt[data-m=chat]').offsetLeft : agentBtn.offsetLeft - tg.querySelector('.mode-opt[data-m=chat]').offsetLeft}px)`; }
  else thumb.style.transform = 'translateX(0)';
  const w = state.mode === 'agent' ? agentBtn.offsetWidth : tg.querySelector('.mode-opt[data-m=chat]').offsetWidth;
  thumb.style.width = w + 'px';
}
function setMode(m) {
  if (state.mode === m) return;
  state.mode = m; store.set('mode', m);
  appEl.classList.add('mode-switching'); clearTimeout(setMode._t); setMode._t = setTimeout(() => appEl.classList.remove('mode-switching'), 900);
  renderModeToggle(); setWelcome(); setPlaceholder(); renderSuggestions();
}
$('#modeToggle')?.addEventListener('click', (e) => { const b = e.target.closest('.mode-opt'); if (b) setMode(b.dataset.m); });

/* ---------------- Tooltip ---------------- */
const tip = $('#tooltip'); let tipTimer;
document.addEventListener('mouseover', (e) => {
  const el = e.target.closest('[data-tip]'); clearTimeout(tipTimer); tip.classList.remove('show');
  if (!el || matchMedia('(hover:none)').matches) return;
  tipTimer = setTimeout(() => {
    tip.textContent = t(el.dataset.tip) || el.dataset.tip; const r = el.getBoundingClientRect();
    tip.style.left = '0px'; tip.style.top = '0px'; tip.classList.add('show');
    const tr = tip.getBoundingClientRect();
    let left = r.left + r.width / 2 - tr.width / 2; left = Math.max(6, Math.min(innerWidth - tr.width - 6, left));
    let top = r.bottom + 6; if (top + tr.height > innerHeight - 6) top = r.top - tr.height - 6;
    tip.style.left = left + 'px'; tip.style.top = top + 'px';
  }, 350);
});
document.addEventListener('mousedown', () => { clearTimeout(tipTimer); tip.classList.remove('show'); });

/* ---------------- Toast ---------------- */
function toast(msg) {
  const el = document.createElement('div'); el.className = 'toast'; el.innerHTML = `${icon('check')}<span>${esc(msg)}</span>`;
  $('#toast-layer').appendChild(el); setTimeout(() => { el.style.transition = 'opacity .2s'; el.style.opacity = 0; setTimeout(() => el.remove(), 200); }, 1800);
}
async function copyText(s) {
  try { await navigator.clipboard.writeText(s); return true; } catch {
    const ta = document.createElement('textarea'); ta.value = s; ta.style.position = 'fixed'; ta.style.opacity = 0; document.body.appendChild(ta); ta.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch {} ta.remove(); return ok;
  }
}

/* ---------------- Popovers ---------------- */
let openPop = null;
function closePop() { if (openPop) { openPop.anchor?.classList.remove('open', 'menu-open'); openPop.el.remove(); openPop = null; } }
function popover(anchor, items, { align = 'start', side = 'bottom', width } = {}) {
  closePop();
  const el = document.createElement('div'); el.className = 'popover'; el.setAttribute('role', 'menu'); if (width) el.style.minWidth = width + 'px';
  el.innerHTML = items.map((it, i) => {
    if (it === '-') return '<div class="pop-sep"></div>';
    if (it.head) return `<div class="pop-head">${esc(it.head)}</div>`;
    if (it.html) return it.html;
    return `<button class="pop-item ${it.danger ? 'danger' : ''}" data-i="${i}" role="menuitem">${it.icon ? `<span class="pi-ico">${icon(it.icon)}</span>` : ''}<span class="pi-main">${esc(it.label)}${it.sub ? `<span class="pi-sub">${esc(it.sub)}</span>` : ''}</span>${it.checked ? `<span class="pi-check">${icon('check')}</span>` : ''}${it.right ? `<span class="pi-check" style="color:var(--text3)">${it.right}</span>` : ''}</button>`;
  }).join('');
  $('#popover-layer').appendChild(el);
  const r = anchor.getBoundingClientRect(), pr = el.getBoundingClientRect(); const rtl = document.documentElement.dir === 'rtl';
  let top = side === 'top' ? r.top - pr.height - 8 : r.bottom + 6;
  if (top + pr.height > innerHeight - 8) top = Math.max(8, r.top - pr.height - 8);
  if (top < 8) top = 8;
  let left = (align === 'start') !== rtl ? r.left : r.right - pr.width;
  left = Math.max(8, Math.min(innerWidth - pr.width - 8, left));
  el.style.top = top + 'px'; el.style.left = left + 'px';
  el.addEventListener('click', (e) => { const b = e.target.closest('[data-i]'); if (!b) return; const it = items[+b.dataset.i]; closePop(); it.run && it.run(); });
  openPop = { el, anchor }; anchor.classList.add('open');
  el.querySelector('.pop-item')?.focus({ preventScroll: true });
  return el;
}
document.addEventListener('mousedown', (e) => { if (openPop && !openPop.el.contains(e.target) && !openPop.anchor.contains(e.target)) closePop(); });
window.addEventListener('resize', closePop);

/* ---------------- Modals ---------------- */
function modal(html, cls = '') {
  const scrim = document.createElement('div'); scrim.className = 'modal-scrim';
  scrim.innerHTML = `<div class="modal ${cls}" role="dialog" aria-modal="true">${html}</div>`;
  $('#modal-layer').appendChild(scrim); hydrateIcons(scrim);
  const close = () => { scrim.remove(); document.removeEventListener('keydown', onKey, true); };
  const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
  document.addEventListener('keydown', onKey, true);
  scrim.addEventListener('mousedown', (e) => { if (e.target === scrim) close(); });
  scrim.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', close));
  return { el: scrim.firstElementChild, close };
}
function confirmModal({ title, body, okLabel, danger = true, onOk }) {
  const m = modal(`<div class="modal-h">${esc(title)}</div><div class="modal-b">${body}</div><div class="modal-f"><button class="btn btn-secondary" data-close>${esc(t('cancel'))}</button><button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-ok>${esc(okLabel)}</button></div>`);
  m.el.querySelector('[data-ok]').addEventListener('click', () => { m.close(); onOk(); });
  m.el.querySelector('[data-ok]').focus();
}
function lightbox(src) {
  const scrim = document.createElement('div'); scrim.className = 'modal-scrim'; scrim.style.cursor = 'zoom-out';
  scrim.innerHTML = `<img class="lightbox" src="${src}" alt="">`; $('#modal-layer').appendChild(scrim);
  const close = () => { scrim.remove(); document.removeEventListener('keydown', k); }; const k = (e) => e.key === 'Escape' && close();
  scrim.addEventListener('click', close); document.addEventListener('keydown', k);
}

/* ---------------- Sidebar / chat list ---------------- */
function toggleSidebar() {
  if (isMobile()) { appEl.classList.toggle('mobile-open'); return; }
  appEl.classList.toggle('collapsed'); store.set('collapsed', appEl.classList.contains('collapsed') ? '1' : '0');
}
if (store.get('collapsed', '0') === '1') appEl.classList.add('collapsed');

async function loadChats() {
  try { const r = await api('/api/chats'); if (r.ok) state.chats = await r.json(); } catch (e) { console.warn(e); }
  renderChatList();
}
function renderChatList() {
  const list = $('#chatList');
  const chats = state.chats.filter(c => !state.tempIds.has(c.id));
  if (!chats.length) { list.innerHTML = `<div class="chat-empty">${esc(t('no_chats'))}</div>`; return; }
  list.innerHTML = chats.map(c => `<div class="chat-item ${c.id === state.chatId ? 'active' : ''}" data-id="${c.id}" role="link" tabindex="0">
      ${c.pinned ? `<span class="ci-pin">${iconSz('pin', 14)}</span>` : ''}
      <span class="ci-title" dir="auto">${esc(c.title || t('new_chat'))}</span>
      <button class="ci-more" aria-label="خيارات">${icon('dots')}</button></div>`).join('');
}
$('#chatList').addEventListener('click', (e) => {
  const item = e.target.closest('.chat-item'); if (!item) return;
  const id = item.dataset.id;
  if (e.target.closest('.ci-more')) { e.stopPropagation(); chatMenu(e.target.closest('.ci-more'), id, item); return; }
  if (item.querySelector('input')) return;
  openChat(id);
});
$('#chatList').addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.classList.contains('chat-item')) openChat(e.target.dataset.id); });

function topMenu(anchor) {
  const items = [
    { icon: 'newchat', label: t('new_chat'), run: () => newChat() },
    { icon: 'temp', label: state.temp ? (LANG === 'ar' ? 'إيقاف الدردشة المؤقتة' : 'Turn off temporary chat') : t('temp_chat'),
      checked: state.temp, run: () => { const temp = $('#tempBtn'); if (temp) temp.click(); } },
  ];
  if (state.chatId && !state.temp) items.push('-', { icon: 'shareSm', label: t('share'), run: () => shareChat(state.chatId) });
  popover(anchor, items, { align: 'end', width: 260 });
}

function chatMenu(anchor, id, item) {
  const c = state.chats.find(x => x.id === id); if (!c) return;
  item?.classList.add('menu-open');
  popover(anchor, [
    { icon: 'shareSm', label: t('share'), run: () => shareChat(id) },
    { icon: 'pencil', label: t('rename'), run: () => startRename(id) },
    { icon: 'pin', label: c.pinned ? t('unpin') : t('pin'), run: async () => { await api(`/api/chats/${id}`, { method: 'PATCH', body: JSON.stringify({ pinned: c.pinned ? 0 : 1 }) }); loadChats(); } },
    { icon: 'archive', label: t('archive'), run: () => { toast(t('archived')); } },
    '-',
    { icon: 'trash', label: t('delete'), danger: true, run: () => askDelete(id) },
  ], { align: 'start' });
  if (openPop) openPop.anchor = item || anchor;
}
function startRename(id) {
  const item = $(`.chat-item[data-id="${id}"]`); const c = state.chats.find(x => x.id === id); if (!item || !c) return;
  const title = item.querySelector('.ci-title'); const inp = document.createElement('input'); inp.className = 'ci-edit'; inp.value = c.title || ''; inp.dir = 'auto';
  title.replaceWith(inp); inp.focus(); inp.select();
  let done = false;
  const finish = async (save) => {
    if (done) return; done = true;
    const v = inp.value.trim();
    if (save && v && v !== c.title) { c.title = v; await api(`/api/chats/${id}`, { method: 'PATCH', body: JSON.stringify({ title: v }) }); }
    renderChatList(); if (id === state.chatId) document.title = c.title;
  };
  inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') finish(true); if (e.key === 'Escape') finish(false); });
  inp.addEventListener('blur', () => finish(true));
}
function askDelete(id) {
  const c = state.chats.find(x => x.id === id);
  confirmModal({ title: t('del_title'), body: `<p>${t('del_body', esc(c?.title || ''))}</p><p style="color:var(--text2)">${esc(t('del_hint'))}</p>`, okLabel: t('delete'), onOk: async () => {
    await api(`/api/chats/${id}`, { method: 'DELETE' }); state.chats = state.chats.filter(x => x.id !== id);
    if (id === state.chatId) newChat(); else renderChatList();
  } });
}
async function shareChat(id) {
  let msgs = state.messages;
  if (id !== state.chatId) { try { const r = await api(`/api/chats/${id}`); msgs = (await r.json()).messages; } catch { return; } }
  const c = state.chats.find(x => x.id === id);
  const txt = `# ${c?.title || ''}\n\n` + msgs.map(m => `${m.role === 'user' ? '**You:**' : '**ChatGPT:**'}\n${m.content || ''}`).join('\n\n');
  if (await copyText(txt)) toast(t('shared'));
}

/* ---------------- Routing ---------------- */
function setRoute(id) { const h = `#/v/${VID}` + (id ? `/c/${id}` : ''); if (location.hash !== h) history.replaceState(null, '', h); }
function routeFromHash() { const m = location.hash.match(/#\/v\/[\w-]+(?:\/c\/([\w-]+))?/); return (m && m[1]) || null; }

async function cleanupTemp() {
  if (state.temp && state.chatId && state.tempIds.has(state.chatId)) { api(`/api/chats/${state.chatId}`, { method: 'DELETE' }); }
}
function newChat({ keepTemp = false } = {}) {
  stopStream(); cleanupTemp(); closeSources(); closeAgentPanel();
  if (!keepTemp && state.temp) { state.temp = false; $('#tempBtn').classList.remove('on'); }
  state.chatId = null; state.messages = []; state.attachments = []; renderAttachments();
  welcomeIdx++; setWelcome(); renderMessages(); setRoute(null); renderChatList(); updateChrome();
  document.title = 'ChatGPT'; appEl.classList.remove('mobile-open');
  input.value = ''; autoGrow(); if (!isMobile()) input.focus();
}
async function openChat(id) {
  if (id === state.chatId) { appEl.classList.remove('mobile-open'); return; }
  stopStream(); cleanupTemp(); closeSources(); closeAgentPanel(); if (state.temp) { state.temp = false; $('#tempBtn').classList.remove('on'); }
  appEl.classList.remove('mobile-open');
  try {
    const r = await api(`/api/chats/${id}`); if (!r.ok) throw new Error('nf');
    const d = await r.json(); state.chatId = id; state.messages = d.messages; document.title = d.chat.title || 'ChatGPT';
    setRoute(id); renderChatList(); renderMessages(); updateChrome(); scrollBottom(true);
  } catch { newChat(); }
}
function updateChrome() {
  const has = state.messages.length > 0;
  appEl.classList.toggle('has-thread', has);
  $('#moreBtn')?.classList.remove('hidden');
  $('#shareBtn')?.classList.add('hidden');
  $('#tempBtn')?.classList.add('hidden');
  updateModelBtn();
  syncQuickTools();
}

/* ---------------- Markdown ---------------- */
marked.setOptions({ gfm: true, breaks: false });
const renderer = new marked.Renderer();
renderer.code = function (code, lang) {
  if (typeof code === 'object') { lang = code.lang; code = code.text; }
  const l = (lang || '').trim().split(/\s/)[0];
  let html; try { html = l && hljs.getLanguage(l) ? hljs.highlight(code, { language: l }).value : hljs.highlightAuto(code).value; } catch { html = esc(code); }
  return `<pre><div class="code-head"><span>${esc(l || 'code')}</span><button class="code-copy" data-copy-code>${iconSz('copy', 14)}<span>${esc(t('copy_code'))}</span></button></div><code class="hljs">${html}</code></pre>`;
};
renderer.table = function (header, body) {
  if (typeof header === 'object' && header.header) { return `<div class="table-wrap">${marked.Renderer.prototype.table.call(this, header)}</div>`; }
  return `<div class="table-wrap"><table><thead>${header}</thead><tbody>${body}</tbody></table></div>`;
};
renderer.link = function (href, title, text) {
  if (typeof href === 'object') { title = href.title; text = this.parser ? this.parser.parseInline(href.tokens) : href.text; href = href.href; }
  return `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer"${title ? ` title="${esc(title)}"` : ''}>${text}</a>`;
};
function md(src, sources) {
  src = src || ''; const math = []; const cites = [];
  // protect code blocks/inline code from math extraction
  const codes = []; src = src.replace(/(```[\s\S]*?(?:```|$)|`[^`\n]+`)/g, (m) => { codes.push(m); return `\u0000C${codes.length - 1}\u0000`; });
  const put = (tex, display) => { math.push({ tex, display }); return `MATHX${math.length - 1}XMATH`; };
  src = src.replace(/\$\$([\s\S]+?)\$\$/g, (_, x) => put(x, true))
           .replace(/\\\[([\s\S]+?)\\\]/g, (_, x) => put(x, true))
           .replace(/\\\(([\s\S]+?)\\\)/g, (_, x) => put(x, false));
  if (sources && sources.length) src = src.replace(/(?:\s?\[(\d{1,2})\](?!\())+/g, (m) => {
    const ids = [...new Set([...m.matchAll(/\[(\d{1,2})\]/g)].map(x => +x[1]).filter(n => n >= 1 && n <= sources.length))];
    if (!ids.length) return m; cites.push(ids); return ` CITEX${cites.length - 1}XCITE`;
  });
  src = src.replace(/\u0000C(\d+)\u0000/g, (_, i) => codes[+i]);
  let html = DOMPurify.sanitize(marked.parse(src, { renderer }), { ADD_ATTR: ['target', 'data-copy-code'] });
  if (math.length) html = html.replace(/MATHX(\d+)XMATH/g, (_, i) => {
    const m = math[+i]; if (!m) return '';
    try { return window.katex ? katex.renderToString(m.tex, { displayMode: m.display, throwOnError: false, output: 'html' }) : esc(m.tex); } catch { return esc(m.tex); }
  });
  if (cites.length) html = html.replace(/CITEX(\d+)XCITE/g, (_, i) => {
    const ids = cites[+i]; const s0 = sources[ids[0] - 1];
    return `<a class="cite" href="${esc(s0.url)}" target="_blank" rel="noopener" data-cite="${ids.join(',')}">${esc(shortDomain(s0.domain))}${ids.length > 1 ? `<span class="cite-more">+${ids.length - 1}</span>` : ''}</a>`;
  });
  return html;
}
function shortDomain(d) { d = (d || '').replace(/^www\./, ''); const p = d.split('.'); if (p.length > 2 && p[p.length - 1].length === 2 && ['co', 'com', 'org', 'gov', 'net', 'ac', 'edu'].includes(p[p.length - 2])) return p.slice(-3).join('.'); return p.length > 2 ? p.slice(-2).join('.') : d; }
const fav = (d) => `https://www.google.com/s2/favicons?domain=${encodeURIComponent(d)}&sz=64`;

/* ---------------- Render messages ---------------- */
function userMsgHTML(m) {
  const imgs = (m.images || []).map(n => `<img src="${n.startsWith('data:') ? n : mediaUrl(n)}" alt="" data-zoom>`).join('');
  return `<div class="msg msg-user" data-id="${m.id || ''}">
    ${imgs ? `<div class="user-imgs">${imgs}</div>` : ''}
    ${m.content ? `<div class="bubble" dir="auto">${esc(m.content)}</div>` : ''}
    <div class="msg-actions">
      <button class="act" data-a="copy" data-tip="copy">${icon('copy')}</button>
      <button class="act" data-a="edit" data-tip="edit">${icon('edit')}</button>
    </div></div>`;
}
function asstActions(m) {
  const fb = state.feedback[m.id];
  return `<div class="msg-actions">
    <button class="act" data-a="copy" data-tip="copy">${icon('copy')}</button>
    ${fb !== 'down' ? `<button class="act ${fb === 'up' ? 'on' : ''}" data-a="up" data-tip="good">${icon(fb === 'up' ? 'upF' : 'up')}</button>` : ''}
    ${fb !== 'up' ? `<button class="act ${fb === 'down' ? 'on' : ''}" data-a="down" data-tip="bad">${icon(fb === 'down' ? 'downF' : 'down')}</button>` : ''}
    <button class="act ${state.speakingId === m.id ? 'on' : ''}" data-a="read" data-tip="${state.speakingId === m.id ? 'stop_read' : 'read'}">${icon('speaker')}</button>
    <button class="act" data-a="share" data-tip="share_msg">${icon('shareSm')}</button>
    <button class="act" data-a="regen" data-tip="regen">${icon('regen')}</button>
    ${sourcesBtnHTML(m)}
  </div>`;
}
const TOOL_LABELS = {
  ar: { calculate: 'حساب', list_files: 'عرض الملفات', read_file: 'قراءة ملف', write_file: 'كتابة ملف', edit_file: 'تعديل ملف', validate_file: 'فحص ملف', generate_image: 'إنشاء صورة', fetch_page: 'فتح صفحة ويب', search_web: 'بحث في الويب', update_workflow: 'تحديث خطة العمل' },
  en: { calculate: 'Calculating', list_files: 'Listing files', read_file: 'Reading a file', write_file: 'Writing a file', edit_file: 'Editing a file', validate_file: 'Checking a file', generate_image: 'Creating an image', fetch_page: 'Opening a web page', search_web: 'Searching the web', update_workflow: 'Updating the work plan' },
};
function toolLabel(name) { return (TOOL_LABELS[LANG] || TOOL_LABELS.en)[name] || name; }
function asstBodyHTML(m) {
  let h = '';
  (m.images || []).forEach(n => { h += `<img class="gen-img" src="${mediaUrl(n)}" alt="" data-zoom>`; });
  if (m.content) h += md(m.content, m.meta?.sources);
  return h;
}
function fmtDur(sec) { sec = Math.max(1, Math.round(sec || 0)); if (sec < 60) return LANG === 'ar' ? `${sec} ث` : `${sec}s`; const mm = Math.floor(sec / 60), ss = sec % 60; return LANG === 'ar' ? `${mm} د ${ss ? ss + ' ث' : ''}`.trim() : `${mm}m${ss ? ' ' + ss + 's' : ''}`; }
/* agent step renderer — inline in chat: thinking notes, terminal cards, file cards with diff + download */
const AG_EXT_HTML = /\.(html?|svg)$/i;
function diffHTML(st) {
  const rows = (st.diff || []).map(d => d.t === '@'
    ? `<div class="dl hunk"><span class="ln"></span><span class="sg">⋯</span><span class="tx"></span></div>`
    : `<div class="dl ${d.t === '+' ? 'add' : d.t === '-' ? 'del' : 'ctx'}"><span class="ln">${d.t === '+' ? (d.b ?? '') : (d.a ?? '')}</span><span class="sg">${d.t === ' ' ? '' : d.t === '+' ? '+' : '−'}</span><span class="tx">${esc(d.s)}</span></div>`).join('');
  return `<div class="ag-diff" dir="ltr"><div class="ag-diff-h"><span>${esc(t('before_after'))}</span><span class="ag-diffstat"><b class="add">+${st.added || 0}</b><b class="del">−${st.removed || 0}</b></span></div>${rows || `<div class="dl ctx"><span class="ln"></span><span class="sg"></span><span class="tx">${esc(t('diff_none'))}</span></div>`}${st.truncated ? `<div class="dl hunk"><span class="ln"></span><span class="sg">⋯</span><span class="tx">${esc(t('diff_more'))}</span></div>` : ''}</div>`;
}
function fileCardHTML(s, opts = {}) {
  const isEdit = s.kind === 'edit';
  const stat = isEdit ? `<span class="ag-diffstat"><b class="add">+${s.added || 0}</b><b class="del">−${s.removed || 0}</b></span>` : `<span class="ag-tag">${esc(t(s.isNew === false ? 'edited' : 'created'))}</span>`;
  const p = esc(s.path);
  return `<div class="ag-step"><div class="ag-file ${isEdit ? 'is-edit' : ''}" data-path="${p}"><div class="ag-file-head">${iconSz('fileCode', 16)}<code dir="ltr">${p}</code>${stat}<span class="ag-lines">${esc(String(s.lines))} ${esc(t('lines'))}</span><span class="ag-file-btns">`
    + (isEdit ? `<button type="button" class="ag-btn" data-agf="diff" data-path="${p}" aria-expanded="true">${iconSz('diff', 14)}<span>${esc(t('hide_diff'))}</span></button>` : '')
    + `<button type="button" class="ag-btn" data-agf="code" data-path="${p}">${iconSz('code', 14)}<span>${esc(t('show_code'))}</span></button>`
    + (AG_EXT_HTML.test(s.path) ? `<button type="button" class="ag-btn" data-agf="preview" data-path="${p}">${iconSz('play', 14)}<span>${esc(t('preview'))}</span></button>` : '')
    + `<button type="button" class="ag-btn primary" data-agf="download" data-path="${p}" aria-label="${esc(t('download'))} ${p}">${iconSz('download', 14)}<span>${esc(t('download'))}</span></button></span></div>${isEdit ? diffHTML(s) : ''}</div></div>`;
}
function agStepHTML(s, i, isLast, compact) {
  if (s.kind === 'think') return `<div class="ag-think">${iconSz('bulb', 14)}<span dir="auto">${esc(s.text)}</span></div>`;
  if (s.kind === 'cmd') return `<div class="ag-step"><div class="ag-term"><div class="ag-term-head">${iconSz('cmd', 14)}<code dir="ltr">${esc(s.cmd)}</code><span class="ag-exit ${s.code === 0 ? 'ok' : 'bad'}">${s.code === 0 ? '✓' : s.code === -1 ? '…' : '✗ ' + esc(String(s.code))}</span></div>${s.out ? `<pre class="ag-term-out" dir="ltr">${esc(String(s.out).slice(0, 1200))}${String(s.out).length > 1200 ? '\n…' : ''}</pre>` : ''}</div></div>`;
  if (s.kind === 'read_file') return `<div class="ag-note">${iconSz('fileCode', 14)}<span>${esc(t('reading_file'))}</span><code dir="ltr">${esc(s.path)}</code></div>`;
  if (s.kind === 'edit_failed') return `<div class="ag-note warn">${iconSz('pencil', 14)}<span>${esc(t('edit_failed'))}</span><code dir="ltr">${esc(s.path)}</code></div>`;
  if (s.kind === 'file' || s.kind === 'edit') {
    if (compact) return `<div class="ag-note">${iconSz('fileCode', 14)}<span>${esc(t(s.kind === 'edit' ? 'edited' : 'created'))}</span><code dir="ltr">${esc(s.path)}</code>${s.kind === 'edit' ? `<span class="ag-diffstat"><b class="add">+${s.added || 0}</b><b class="del">−${s.removed || 0}</b></span>` : ''}</div>`;
    return fileCardHTML(s);
  }
  const lbl = s.kind === 'plan' ? t('agent_plan') : s.kind === 'search' ? t('agent_search') : s.kind === 'write' ? t('agent_write') : s.kind === 'start' ? t('agent_task') : (s.label || '');
  return `<div class="rs-step ${isLast ? 'on' : 'done'}"><span class="rs-dot"></span><div><div class="rs-lbl">${iconSz(s.kind === 'plan' ? 'bulb' : s.kind === 'search' ? 'search' : s.kind === 'start' ? 'agent' : 'pencil', 14)} ${esc(lbl)}${isLast ? '<span class="ag-live-dot"></span>' : ''}</div>${s.kind === 'plan' && s.plan ? `<div class="rs-q" dir="auto">${esc(s.plan.slice(0, 300))}</div>` : ''}${s.kind === 'search' && s.q ? `<div class="rs-q" dir="auto">${esc(s.q)}</div>` : ''}${s.domains && s.domains.length ? `<div class="rs-favs">${s.domains.slice(0, 8).map(d => `<span class="rs-src"><img src="${fav(d)}" alt="">${esc(shortDomain(d))}</span>`).join('')}</div>` : ''}</div></div>`;
}
/* the files an agent run produced (latest state per path) + download-all */
function agFilesOf(steps) {
  const map = new Map();
  (steps || []).forEach(st => { if ((st.kind === 'file' || st.kind === 'edit') && st.path) map.set(st.path, st); });
  return [...map.values()];
}
function agFilesHTML(steps) {
  const files = agFilesOf(steps); if (!files.length) return '';
  return `<div class="ag-files"><div class="ag-files-head"><span>${iconSz('fileCode', 16)} ${esc(t('files_made', files.length))}</span>${files.length > 1 ? `<button type="button" class="ag-btn primary" data-agf="zip">${iconSz('download', 14)}<span>${esc(t('download_all'))}</span></button>` : ''}</div>${files.map(f => fileCardHTML(f)).join('')}</div>`;
}
function statusHTML(m) {
  const meta = m.meta || {};
  if (meta.mode === 'agent') {
    const n = (meta.sources || []).length; const stp = meta.steps || [];
    const label = meta.status === 'completed_unverified' ? (LANG === 'ar' ? 'انتهت الاستجابة دون تحقق مستقل' : 'Response finished, not independently verified') : meta.status && meta.status !== 'completed' ? meta.status : t('agent_done');
    return `<div class="apex-strategy" dir="auto">${esc(meta.strategy?.strategy || '')} · ${esc((meta.strategy?.profiles || []).join(' + '))}</div><details class="research-done agent-done"><summary>${icon('agentRun')}<span>${esc(label)} · ${esc(fmtDur(meta.seconds))}${n ? ' · ' + esc(t('sources_n', n)) : ''}</span>${icon('chevron')}</summary>
      <div class="rs-body">${stp.map((st, i) => agStepHTML(st, i, false, true)).join('')}</div></details>${agFilesHTML(stp)}`;
  }
  if (meta.mode === 'search' && meta.think) {
    const n = (meta.sources || []).length;
    return `<details class="research-done"><summary>${icon('bulb')}<span>${esc(t('wide_search'))} · ${esc(fmtDur(meta.seconds))}${n ? ' · ' + esc(t('sources_n', n)) : ''}</span>${icon('chevron')}</summary>
      <div class="rs-body"><div class="think-summary-note">${LANG === 'ar' ? 'ملخص النشاط: يعرض استعلامات البحث والمصادر التي استُخدمت، وليس التفكير الداخلي الخاص.' : 'Activity summary: shows the search queries and sources used, not private internal reasoning.'}</div>
      ${(meta.queries || []).map(q => `<div class="rs-q">${iconSz('search', 14)}<span dir="auto">${esc(q)}</span></div>`).join('')}
      <div class="rs-favs">${(meta.sources || []).slice(0, 12).map(s => `<a href="${esc(s.url)}" target="_blank" rel="noopener" class="rs-src"><img src="${fav(s.domain)}" alt="">${esc(shortDomain(s.domain))}</a>`).join('')}</div></div></details>`;
  }
  if (meta.mode === 'research') {
    const n = (meta.sources || []).length;
    return `<details class="research-done"><summary>${icon('telescope')}<span>${esc(t('research_done', fmtDur(meta.seconds), n))}</span>${icon('chevron')}</summary>
      <div class="rs-body">${(meta.queries || []).map(q => `<div class="rs-q">${iconSz('search', 14)}<span dir="auto">${esc(q)}</span></div>`).join('')}
      <div class="rs-favs">${(meta.sources || []).map(s => `<a href="${esc(s.url)}" target="_blank" rel="noopener" class="rs-src"><img src="${fav(s.domain)}" alt="">${esc(shortDomain(s.domain))}</a>`).join('')}</div></div></details>`;
  }
  if (meta.seconds && !meta.mode) return `<div class="thought-done">${esc(t('thought_for', meta.seconds))}</div>`;
  return '';
}
function asstMsgHTML(m, last) {
  return `<div class="msg msg-assistant ${last ? 'last' : ''}" data-id="${m.id || ''}"><div class="msg-status">${statusHTML(m)}</div><div class="md" dir="${m.content ? 'auto' : document.documentElement.dir}">${asstBodyHTML(m)}</div>${asstActions(m)}</div>`;
}
function sourcesBtnHTML(m) {
  const src = m.meta?.sources || []; if (!src.length) return '';
  const favs = src.slice(0, 3).map(s => `<img src="${fav(s.domain)}" alt="">`).join('');
  return `<button class="src-btn" data-a="sources" aria-expanded="false"><span class="favs">${favs}</span><span>${esc(t('sources'))}</span><span class="src-chev">${iconSz('chevron', 14)}</span></button>`;
}
function renderMessages() {
  const lastA = [...state.messages].reverse().find(m => m.role === 'assistant');
  msgsEl.innerHTML = state.messages.map(m => m.role === 'user' ? userMsgHTML(m) : asstMsgHTML(m, m === lastA && state.messages[state.messages.length - 1] === m)).join('');
}

/* agent file buttons: show code / diff inline, live preview modal, download */
function agFindStep(btn) {
  const msgEl = btn.closest('.msg'); if (!msgEl) return null;
  const m = state.messages.find(x => x.id === msgEl.dataset.id);
  const steps = (m && m.meta && m.meta.steps) || [];
  const path = btn.dataset.path;
  return [...steps].reverse().find(x => (x.kind === 'file' || x.kind === 'edit') && x.path === path) || null;
}
function saveBlob(blob, name) {
  const url = URL.createObjectURL(blob); const a = document.createElement('a');
  a.href = url; a.download = name; a.rel = 'noopener'; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
async function agDownload(path, st) {
  try {
    if (!state.chatId) throw new Error('no chat');
    const r = await api(`/api/agent/${encodeURIComponent(state.chatId)}/file?path=${encodeURIComponent(path)}`);
    if (r.status === 401) { authFail(); return; }
    if (!r.ok) throw new Error('HTTP ' + r.status);
    saveBlob(await r.blob(), path.split('/').pop() || 'file');
  } catch {
    if (st && typeof st.content === 'string' && st.content && st.content.length < 60000) saveBlob(new Blob([st.content], { type: 'text/plain;charset=utf-8' }), path.split('/').pop() || 'file');
    else toast(t('dl_fail'));
  }
}
async function agDownloadAll() {
  try {
    const r = await api(`/api/agent/${encodeURIComponent(state.chatId)}/zip`);
    if (r.status === 401) { authFail(); return; }
    if (!r.ok) throw new Error('HTTP ' + r.status);
    saveBlob(await r.blob(), 'agent-files.zip');
  } catch { toast(t('dl_fail')); }
}
function handleAgFileBtn(btn) {
  const act = btn.dataset.agf;
  if (act === 'zip') { agDownloadAll(); return; }
  const path = btn.dataset.path;
  const st = agFindStep(btn);
  if (act === 'download') { agDownload(path, st); return; }
  const card = btn.closest('.ag-file');
  if (act === 'diff') {
    const d = card && card.querySelector('.ag-diff'); if (!d) return;
    const hide = !d.classList.toggle('collapsed');
    btn.setAttribute('aria-expanded', String(hide));
    btn.querySelector('span').textContent = t(hide ? 'hide_diff' : 'show_diff');
    return;
  }
  if (!st) { toast(t('err')); return; }
  if (act === 'code') {
    let block = card.querySelector('.ag-code');
    const lab = btn.querySelector('span');
    if (block) { block.remove(); lab.textContent = t('show_code'); return; }
    block = document.createElement('pre');
    block.className = 'ag-code';
    block.dir = 'ltr';
    block.textContent = st.content;
    card.appendChild(block);
    lab.textContent = t('hide_code');
  } else if (act === 'preview') {
    const m = modal(`<div class="modal-h" style="display:flex;justify-content:space-between;align-items:center"><span>${icon('play')} ${esc(t('preview_title'))} — <code dir="ltr">${esc(path)}</code></span><button class="icon-btn" data-close aria-label="close">${icon('x')}</button></div><iframe class="prev-frame" sandbox="allow-scripts allow-modals allow-popups" srcdoc="${esc(st.content)}"></iframe>`, 'wide');
    m.el.querySelector('[data-close]').focus();
  }
}

/* message action handling */
msgsEl.addEventListener('click', async (e) => {
  const z = e.target.closest('[data-zoom]'); if (z) { lightbox(z.src); return; }
  const cc = e.target.closest('[data-copy-code]');
  if (cc) { const code = cc.closest('pre').querySelector('code').innerText; if (await copyText(code)) { const sp = cc.querySelector('span'); cc.firstElementChild?.remove?.(); cc.insertAdjacentHTML('afterbegin', iconSz('check', 14)); sp.textContent = t('code_copied'); setTimeout(() => { cc.firstElementChild.outerHTML = iconSz('copy', 14); sp.textContent = t('copy_code'); }, 1800); } return; }
  const agf = e.target.closest('[data-agf]');
  if (agf) { handleAgFileBtn(agf); return; }
  const b = e.target.closest('.act,[data-a]'); if (!b) return;
  const msgEl = b.closest('.msg'); const id = msgEl.dataset.id; const m = state.messages.find(x => x.id === id); if (!m) return;
  const a = b.dataset.a;
  if (a === 'copy') { if (await copyText(m.content || '')) { b.innerHTML = icon('check'); setTimeout(() => b.innerHTML = icon('copy'), 1600); } }
  else if (a === 'edit') startEdit(msgEl, m);
  else if (a === 'up' || a === 'down') { state.feedback[id] = state.feedback[id] === a ? null : a; refreshActions(msgEl, m); if (state.feedback[id]) toast(LANG === 'ar' ? 'شكراً لملاحظاتك' : 'Thanks for your feedback'); }
  else if (a === 'read') readAloud(m, msgEl);
  else if (a === 'share') { if (await copyText(m.content || '')) toast(t('copied')); }
  else if (a === 'regen') regenMenu(b);
  else if (a === 'sources') toggleSources(m, msgEl, b.closest('.src-btn') || b);
});
msgsEl.addEventListener('click', (e) => { const c = e.target.closest('.cite'); if (c && e.button === 0 && !e.ctrlKey && !e.metaKey) { /* default: open link */ } });
/* citation hover card */
let citeCard = null, citeTimer;
msgsEl.addEventListener('mouseover', (e) => {
  const c = e.target.closest('.cite'); if (!c) return; clearTimeout(citeTimer);
  const msgEl = c.closest('.msg'); const m = state.messages.find(x => x.id === msgEl?.dataset.id); const src = m?.meta?.sources; if (!src) return;
  const ids = c.dataset.cite.split(',').map(Number);
  citeTimer = setTimeout(() => {
    if (!c.isConnected) return;
    citeCard?.remove(); citeCard = document.createElement('div'); citeCard.className = 'cite-card';
    citeCard.innerHTML = ids.map(i => src[i - 1]).filter(Boolean).map(s => `<a href="${esc(s.url)}" target="_blank" rel="noopener" class="cc-item"><span class="cc-dom"><img src="${fav(s.domain)}" alt="">${esc(s.domain)}</span><span class="cc-title" dir="auto">${esc(s.title)}</span><span class="cc-snip" dir="auto">${esc(s.snippet || '')}</span></a>`).join('');
    document.body.appendChild(citeCard);
    const r = c.getBoundingClientRect(), cr = citeCard.getBoundingClientRect();
    let left = Math.max(8, Math.min(innerWidth - cr.width - 8, r.left + r.width / 2 - cr.width / 2)); let top = r.top - cr.height - 8; if (top < 8) top = r.bottom + 8;
    citeCard.style.left = left + 'px'; citeCard.style.top = top + 'px';
    citeCard.addEventListener('mouseenter', () => clearTimeout(citeTimer)); citeCard.addEventListener('mouseleave', () => { citeTimer = setTimeout(() => { citeCard?.remove(); citeCard = null; }, 150); });
  }, 250);
});
msgsEl.addEventListener('mouseout', (e) => { if (e.target.closest('.cite')) { clearTimeout(citeTimer); citeTimer = setTimeout(() => { citeCard?.remove(); citeCard = null; }, 200); } });

/* agent side activity panel */
let agentPanelLive = null;
function openAgentPanel() {
  closeSources(); closeAgentPanel();
  agentPanelLive = { steps: [] };
  const panel = document.createElement('aside'); panel.className = 'sources-panel agent-panel'; panel.id = 'agentPanel';
  panel.innerHTML = `<div class="sp-head"><span>${icon('agentRun')} ${esc(t('agent_panel'))}</span><button class="icon-btn" data-ap-close aria-label="close">${icon('x')}</button></div><div class="sp-body" id="agPanelBody"></div>`;
  appEl.appendChild(panel); appEl.classList.add('sp-open');
  panel.querySelector('[data-ap-close]').onclick = closeAgentPanel;
}
function updateAgentPanel() {
  const body = $('#agPanelBody'); if (!body || !agentPanelLive) return;
  agentPanelLive.steps = agentPanelLive.steps || [];
  body.innerHTML = agentPanelLive.steps.map((s, i) => `<div class="rs-step ${i === agentPanelLive.steps.length - 1 ? 'on' : 'done'}"><span class="rs-dot"></span><div><div class="rs-lbl">${iconSz(s.icon || 'search', 14)} ${esc(s.label)}${i === agentPanelLive.steps.length - 1 ? '<span class="ag-live-dot"></span>' : ''}</div>${s.extra ? `<div class="rs-q" dir="auto">${esc(s.extra)}</div>` : ''}${s.domains && s.domains.length ? `<div class="rs-favs">${s.domains.slice(0, 10).map(d => `<span class="rs-src"><img src="${fav(d)}" alt="">${esc(shortDomain(d))}</span>`).join('')}</div>` : ''}</div></div>`).join('') || `<div class="ad-loading">${icon('agentRun')} <span class="thinking-lbl">${esc(t('agent_live'))}…</span></div>`;
  body.scrollTop = body.scrollHeight;
}
function pushAgentPanelStep(step) { if (agentPanelLive) { agentPanelLive.steps.push(step); updateAgentPanel(); } }
function finishAgentPanel() { if (agentPanelLive) { agentPanelLive.done = true; updateAgentPanel(); } }
function closeAgentPanel() { $('#agentPanel')?.remove(); agentPanelLive = null; }

/* sources: opens as a dropdown list right under the message */
function toggleSources(m, msgEl, btn) {
  let dd = msgEl.querySelector('.src-drop');
  if (dd) { const open = dd.classList.toggle('open'); btn.classList.toggle('open', open); btn.setAttribute('aria-expanded', String(open)); return; }
  const src = m.meta?.sources || [];
  const used = new Set([...(m.content || '').matchAll(/\[(\d{1,2})\]/g)].map(x => +x[1]));
  const all = src.map((s, i) => ({ ...s, n: i + 1 }));
  const cited = all.filter(s => used.has(s.n)), more = all.filter(s => !used.has(s.n));
  const item = (s) => `<a class="sp-item" href="${esc(s.url)}" target="_blank" rel="noopener"><span class="sp-dom"><img src="${fav(s.domain)}" alt=""><span>${esc(s.domain)}</span></span><span class="sp-title" dir="auto">${esc(s.title)}</span>${s.snippet ? `<span class="sp-snip" dir="auto">${esc(s.snippet)}</span>` : ''}</a>`;
  dd = document.createElement('div'); dd.className = 'src-drop';
  dd.innerHTML = `<div class="src-drop-in"><div class="src-list">${cited.length ? `<div class="sp-group">${esc(t('citations'))}</div>${cited.map(item).join('')}` : ''}${more.length ? `<div class="sp-group">${esc(cited.length ? t('more') : t('sources'))}</div>${more.map(item).join('')}` : ''}${!src.length ? `<div class="sp-group">${esc(t('no_src_dd'))}</div>` : ''}</div></div>`;
  const acts = msgEl.querySelector('.msg-actions'); (acts || msgEl).after(dd);
  requestAnimationFrame(() => requestAnimationFrame(() => { dd.classList.add('open'); btn.classList.add('open'); btn.setAttribute('aria-expanded', 'true'); }));
}
function closeSources() { $('#sourcesPanel')?.remove(); appEl.classList.remove('sp-open'); }
function refreshActions(msgEl, m) { const old = msgEl.querySelector('.msg-actions'); const tmp = document.createElement('div'); tmp.innerHTML = asstActions(m); old.replaceWith(tmp.firstElementChild); if (msgEl.querySelector('.src-drop.open')) { const sb = msgEl.querySelector('.src-btn'); if (sb) { sb.classList.add('open'); sb.setAttribute('aria-expanded', 'true'); } } }
function readAloud(m, msgEl) {
  if (!('speechSynthesis' in window)) { toast(t('soon')); return; }
  if (state.speakingId === m.id) { speechSynthesis.cancel(); state.speakingId = null; refreshActions(msgEl, m); return; }
  speechSynthesis.cancel();
  const plain = (msgEl.querySelector('.md').innerText || '').slice(0, 6000);
  const u = new SpeechSynthesisUtterance(plain); u.lang = /[\u0600-\u06FF]/.test(plain) ? 'ar' : 'en-US';
  u.onend = u.onerror = () => { state.speakingId = null; const el = $(`.msg[data-id="${m.id}"]`); el && refreshActions(el, m); };
  state.speakingId = m.id; refreshActions(msgEl, m); speechSynthesis.speak(u);
}
function regenMenu(anchor) {
  popover(anchor, [
    { head: t('regen') },
    ...MODELS.map(md_ => ({ icon: 'sparkle', label: t(md_.name), sub: t(md_.sub), checked: md_.id === state.model, run: () => { setModel(md_.id); send({ regenerate: true }); } })),
  ], { side: 'top', width: 260 });
}
function startEdit(msgEl, m) {
  if (state.streaming) return;
  msgEl.innerHTML = `<div class="edit-box"><textarea dir="auto">${esc(m.content || '')}</textarea><div class="edit-actions"><button class="btn btn-secondary" data-e="cancel">${esc(t('cancel'))}</button><button class="btn btn-primary" data-e="send">${esc(t('send'))}</button></div></div>`;
  msgEl.style.alignItems = 'stretch';
  const ta = msgEl.querySelector('textarea'); const grow = () => { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 400) + 'px'; }; grow(); ta.addEventListener('input', grow);
  ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length);
  msgEl.querySelector('[data-e=cancel]').onclick = () => renderMessages();
  msgEl.querySelector('[data-e=send]').onclick = () => { const v = ta.value.trim(); if (!v) return; send({ text: v, editId: m.id }); };
  ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); msgEl.querySelector('[data-e=send]').click(); } if (e.key === 'Escape') renderMessages(); });
}

/* ---------------- Scrolling ---------------- */
let stick = true;
thread.addEventListener('scroll', () => {
  const dist = thread.scrollHeight - thread.scrollTop - thread.clientHeight;
  stick = dist < 80; $('#scrollDown').classList.toggle('hidden', dist < 200);
  appEl.classList.toggle('scrolled', thread.scrollTop > 4);
});
function scrollBottom(force) { if (force || stick) thread.scrollTop = thread.scrollHeight; }

/* ---------------- Composer ---------------- */
function autoGrow() {
  input.dir = input.value.trim() ? 'auto' : document.documentElement.dir;
  input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 216) + 'px';
  const multi = input.value.includes('\n') || input.scrollHeight > 40 || state.attachments.length > 0;
  $('#composer').classList.toggle('multi', multi && !isMobile() ? input.scrollHeight > 40 || input.value.includes('\n') : multi);
  updateSend();
}
function updateSend() {
  const has = input.value.trim().length > 0 || state.attachments.length > 0;
  sendBtn.classList.toggle('busy', state.streaming); sendBtn.classList.toggle('ready', !state.streaming && has); sendBtn.classList.toggle('voice', !state.streaming && !has);
  sendBtn.setAttribute('aria-label', state.streaming ? 'Stop' : has ? t('send') : 'Voice');
  sendBtn.dataset.tip = state.streaming ? (LANG === 'ar' ? 'إيقاف البث' : 'Stop streaming') : has ? t('send') : (LANG === 'ar' ? 'استخدام الوضع الصوتي' : 'Use voice mode');
  if (!STR[LANG][sendBtn.dataset.tip]) STR[LANG][sendBtn.dataset.tip] = sendBtn.dataset.tip;
}
input.addEventListener('input', autoGrow);
input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && !isMobile()) { e.preventDefault(); if (!state.streaming) send(); }
});
$('#composer').addEventListener('submit', (e) => { e.preventDefault(); if (!state.streaming) send(); });
$('#composer').addEventListener('click', (e) => { if (e.target === e.currentTarget || e.target.classList.contains('input-box') || e.target.classList.contains('comp-row')) input.focus(); });
sendBtn.addEventListener('click', () => {
  if (state.streaming) { stopStream(); return; }
  if (sendBtn.classList.contains('voice')) { voiceMode(); return; }
  send();
});

/* attachments */
const fileInput = $('#fileInput');
fileInput.addEventListener('change', () => { addFiles([...fileInput.files]); fileInput.value = ''; });
function addFiles(files) {
  if (!capabilities?.features?.vision) { toast(LANG === 'ar' ? 'تحليل المرفقات غير موصول حاليًا' : 'Image attachments are not configured'); return; }
  files.filter(f => f.type.startsWith('image/')).slice(0, 4 - state.attachments.length).forEach(f => {
    const rd = new FileReader(); rd.onload = () => downscale(rd.result).then(d => { state.attachments.push(d); renderAttachments(); }); rd.readAsDataURL(f);
  });
}
function downscale(dataUrl, max = 1600) {
  return new Promise(res => { const img = new Image(); img.onload = () => {
    const s = Math.min(1, max / Math.max(img.width, img.height)); if (s === 1 && dataUrl.length < 3e6) return res(dataUrl);
    const c = document.createElement('canvas'); c.width = img.width * s; c.height = img.height * s; c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); res(c.toDataURL('image/jpeg', .88));
  }; img.onerror = () => res(dataUrl); img.src = dataUrl; });
}
function renderAttachments() {
  const row = $('#attachRow'); row.classList.toggle('hidden', !state.attachments.length);
  row.innerHTML = state.attachments.map((d, i) => `<div class="att"><img src="${d}" alt=""><button type="button" data-rm="${i}" aria-label="remove">${iconSz('x', 12)}</button></div>`).join('');
  autoGrow();
}
$('#attachRow').addEventListener('click', (e) => { const b = e.target.closest('[data-rm]'); if (b) { state.attachments.splice(+b.dataset.rm, 1); renderAttachments(); } });
input.addEventListener('paste', (e) => { const fs = [...(e.clipboardData?.files || [])]; if (fs.length) { e.preventDefault(); addFiles(fs); } });
const comp = $('#composer');
['dragenter', 'dragover'].forEach(ev => document.addEventListener(ev, (e) => { if (e.dataTransfer?.types?.includes('Files')) { e.preventDefault(); comp.classList.add('drag'); } }));
['dragleave', 'drop'].forEach(ev => document.addEventListener(ev, (e) => { if (ev === 'drop') { e.preventDefault(); addFiles([...(e.dataTransfer?.files || [])]); } comp.classList.remove('drag'); }));

/* tools */
const TOOLS = { image: { chip: 'image_chip', icon: 'image' }, think: { chip: 'think_chip', icon: 'bulb' }, search: { chip: 'search_chip', icon: 'globe' }, research: { chip: 'research_chip', icon: 'telescope' } };
/* tools are multi-select: Thinking can be combined with Search (wider, deeper search) */
const hasTool = (k) => state.tools.includes(k);
function startImageGeneration() {
  const configured = !!capabilities?.features?.image_generation &&
    capabilities?.tools?.some(tool => tool.name === 'generate_image');
  if (!configured) {
    toast(LANG === 'ar'
      ? 'توليد الصور يحتاج خطة Pro أو Ultra وإعداد Gemini على الخادم.'
      : 'Image generation requires a Pro/Ultra plan and Gemini configured on the server.');
    return;
  }
  // The chat/image endpoint intentionally rejects direct image requests. Route
  // through the real agent tool instead, which returns a saved downloadable file.
  setMode('agent');
  state.tools = [];
  renderToolChip();
  fillPrompt(LANG === 'ar'
    ? 'أنشئ صورة باستخدام أداة توليد الصور الفعلية بناءً على الوصف التالي. احفظها في images/generated.png وأعطني رابط تنزيل الملف. إذا فشلت الأداة، اذكر الفشل ولا تدّعِ نجاحًا.\n\n'
    : 'Generate an image using the actual image-generation tool from the prompt below. Save it as images/generated.png and provide the download link. If the tool fails, report the failure without claiming success.\n\n');
}
function toolIsAvailable(name) {
  return Array.isArray(capabilities?.tools) && capabilities.tools.some(tool => tool.name === name);
}
function toggleTool(k) {
  if (k === 'image') { startImageGeneration(); return; }
  if (k === 'search' && !toolIsAvailable('search_web')) {
    toast(LANG === 'ar' ? 'بحث الويب غير مهيأ: يلزم مفتاح Brave Search على الخادم.' : 'Web search is not configured: a server-side Brave Search key is required.');
    return;
  }
  if (k === 'research' && !toolIsAvailable('search_web') && !toolIsAvailable('fetch_page')) {
    toast(LANG === 'ar' ? 'البحث المتعمق غير متاح في الخطة أو إعدادات الخادم الحالية.' : 'Deep research is unavailable for this plan or server configuration.');
    return;
  }
  if (state.mode === 'agent') setMode('chat');
  if (hasTool(k)) state.tools = state.tools.filter(x => x !== k);
  else {
    state.tools = state.tools.filter(x => x !== 'image');
    if (k === 'search') state.tools = state.tools.filter(x => x !== 'research');
    if (k === 'research') state.tools = state.tools.filter(x => x !== 'search');
    state.tools.push(k);
  }
  renderToolChip(); setPlaceholder(); input.focus();
}
function setTool(k) {
  if (k === 'image') { startImageGeneration(); return; }
  if (k === 'search' && !toolIsAvailable('search_web')) {
    toast(LANG === 'ar' ? 'بحث الويب غير مهيأ: يلزم مفتاح Brave Search على الخادم.' : 'Web search is not configured: a server-side Brave Search key is required.');
    return;
  }
  if (k === 'research' && !toolIsAvailable('search_web') && !toolIsAvailable('fetch_page')) {
    toast(LANG === 'ar' ? 'البحث المتعمق غير متاح في الخطة أو إعدادات الخادم الحالية.' : 'Deep research is unavailable for this plan or server configuration.');
    return;
  }
  state.tools = k ? [k] : [];
  renderToolChip(); setPlaceholder(); input.focus();
}
function clearTool(k) { state.tools = k ? state.tools.filter(x => x !== k) : []; renderToolChip(); setPlaceholder(); }
function renderToolChip() {
  const box = $('#toolChips');
  if (box) box.innerHTML = state.tools.map(k => `<button type="button" class="tool-chip" data-act="clear-tool" data-tool="${k}" aria-label="${esc(t(TOOLS[k].chip))}"><span data-icon="${TOOLS[k].icon}">${icon(TOOLS[k].icon)}</span><span>${esc(t(TOOLS[k].chip))}</span><span class="chip-x">${iconSz('x', 12)}</span></button>`).join('');
  syncQuickTools();
}
function syncQuickTools() {
  $('.top-tool').forEach(b => {
    const active = hasTool(b.dataset.tool);
    b.classList.toggle('active', active);
    b.setAttribute('aria-pressed', String(active));
  });
}
function moreToolsMenu(anchor) {
  popover(anchor, [
    { head: t('agent_tools_head') },
    { icon: 'pencil', label: t('tool_write'), sub: t('tool_write_sub'), run: () => startAgentPreset('write') },
    { icon: 'edit', label: t('tool_edit'), sub: t('tool_edit_sub'), run: () => startAgentPreset('edit') },
    { icon: 'code', label: t('tool_code'), sub: t('tool_code_sub'), run: () => startAgentPreset('code') },
    { icon: 'cmd', label: t('tool_command'), sub: t('tool_command_sub'), run: () => startAgentPreset('command') },
  ], { side: isMobile() ? 'top' : 'bottom', width: 280 });
}
function startAgentPreset(kind) {
  const prompts = { write: t('preset_write'), edit: t('preset_edit'), code: t('preset_code'), command: t('preset_command') };
  setMode('agent');
  fillPrompt(prompts[kind] || '');
}
function plusMenu(anchor) {
  popover(anchor, [
    { head: LANG === 'ar' ? 'إضافة إلى المحادثة' : 'Add to chat' },
    { icon: 'clip', label: t('add_photos'), run: () => { if (!capabilities?.features?.vision) { toast(LANG === 'ar' ? 'تحليل المرفقات غير موصول حاليًا' : 'Image attachments are not configured'); return; } fileInput.click(); } },
    '-',
    { icon: 'globe', label: t('web_search'), checked: hasTool('search'), run: () => toggleTool('search') },
    { icon: 'telescope', label: t('deep_research'), checked: hasTool('research'), run: () => toggleTool('research') },
    { icon: 'bulb', label: t('thinking'), checked: hasTool('think'), run: () => toggleTool('think') },
    '-',
    { icon: 'image', label: t('create_image'), checked: hasTool('image'), run: () => toggleTool('image') },
    '-',
    { icon: 'more', label: t('more'), right: icon('chevSide'), run: () => moreToolsMenu(anchor) },
  ], { side: isMobile() ? 'top' : 'bottom', width: 260 });
}

/* dictation */
let rec = null;
function dictate() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { toast(t('mic_na')); return; }
  if (rec) { rec.stop(); return; }
  rec = new SR(); rec.lang = LANG === 'ar' ? 'ar-SA' : 'en-US'; rec.interimResults = true; rec.continuous = false;
  const base = input.value ? input.value + ' ' : '';
  rec.onresult = (e) => { input.value = base + [...e.results].map(r => r[0].transcript).join(''); autoGrow(); };
  rec.onend = rec.onerror = () => { rec = null; appEl.classList.remove('listening'); };
  appEl.classList.add('listening');
  try { rec.start(); } catch { rec = null; appEl.classList.remove('listening'); toast(t('mic_na')); }
}

/* ---------------- Suggestions ---------------- */
const SUGS = [
  { k: 'sug_image', icon: 'image', c: '#35ae47', run: () => setTool('image') },
  { k: 'sug_summ', icon: 'doc', c: '#ea8444', run: () => fillPrompt(t('p_summ')) },
  { k: 'sug_news', icon: 'globe', c: '#76d0eb', run: () => { setTool('search'); fillPrompt(t('p_news')); } },
  { k: 'sug_write', icon: 'pencil', c: '#cb8bd0', run: () => fillPrompt(t('p_write')) },
  { k: 'sug_research', icon: 'telescope', c: '#6c71ff', run: () => setTool('research') },
];
const SUGS_AGENT = [
  { k: 'sug_trip', icon: 'agentRun', c: '#f59e0b', run: () => fillPrompt(t('p_trip')) },
  { k: 'sug_compare', icon: 'telescope', c: '#6c71ff', run: () => fillPrompt(t('p_compare')) },
  { k: 'sug_report', icon: 'doc', c: '#0ea5a4', run: () => fillPrompt(t('p_report')) },
];
function fillPrompt(v) { input.value = v; autoGrow(); input.focus(); input.setSelectionRange(v.length, v.length); }
function renderSuggestions() {
  const list = state.mode === 'agent' ? SUGS_AGENT : SUGS;
  $('#suggestions').innerHTML = list.map((g, i) => `<button class="sug ${state.mode === 'agent' ? 'sug-agent' : ''}" data-sug="${i}"><span style="color:${g.c}">${iconSz(g.icon, 16)}</span><span>${esc(t(g.k))}</span></button>`).join('');
}
$('#suggestions').addEventListener('click', (e) => { const b = e.target.closest('[data-sug]'); if (b) (state.mode === 'agent' ? SUGS_AGENT : SUGS)[+b.dataset.sug].run(); });

/* ---------------- Voice mode ---------------- */
function voiceMode() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const ov = document.createElement('div'); ov.className = 'voice-ov';
  ov.innerHTML = `<div class="v-top"><span class="v-model">ChatGPT</span></div><button class="v-orb" aria-label="talk"><span></span></button><p class="v-status"></p>
    <div class="v-ctrls"><button class="v-btn" data-v="mic" aria-label="mic">${icon('mic')}</button><button class="v-btn v-close" data-v="close" aria-label="close">${icon('x')}</button></div>`;
  document.body.appendChild(ov);
  const status = ov.querySelector('.v-status'), orb = ov.querySelector('.v-orb');
  let alive = true, r = null, muted = false;
  const setS = (k, cls) => { status.textContent = t(k); ov.dataset.state = cls; };
  const close = () => { alive = false; try { r && r.abort(); } catch {} speechSynthesis?.cancel(); ov.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => e.key === 'Escape' && close(); document.addEventListener('keydown', onKey);
  ov.querySelector('[data-v=close]').onclick = close;
  if (!SR) { status.textContent = t('voice_na'); ov.dataset.state = 'idle'; return; }
  const listen = () => {
    if (!alive || muted) { setS('voice_tap', 'idle'); return; }
    r = new SR(); r.lang = LANG === 'ar' ? 'ar-SA' : 'en-US'; r.interimResults = false; let got = false;
    r.onresult = async (e) => {
      got = true; const text = [...e.results].map(x => x[0].transcript).join(' ').trim(); if (!text || !alive) return listen();
      setS('voice_think', 'think'); const a = await send({ text });
      if (!alive) return; const plain = (a?.content || '').replace(/[#*_`>|\[\]()-]/g, ' ').replace(/\s+/g, ' ').slice(0, 2500);
      if (!plain || !('speechSynthesis' in window)) return listen();
      const u = new SpeechSynthesisUtterance(plain); u.lang = /[\u0600-\u06FF]/.test(plain) ? 'ar' : 'en-US';
      u.onend = u.onerror = () => listen(); setS('voice_speak', 'speak'); speechSynthesis.speak(u);
    };
    r.onerror = () => { if (alive) setS('voice_tap', 'idle'); };
    r.onend = () => { if (alive && !got && ov.dataset.state === 'listen') setS('voice_tap', 'idle'); };
    try { r.start(); setS('voice_listen', 'listen'); } catch { setS('voice_na', 'idle'); }
  };
  orb.onclick = () => { if (ov.dataset.state === 'speak') { speechSynthesis.cancel(); } else if (ov.dataset.state === 'idle') { muted = false; listen(); } };
  ov.querySelector('[data-v=mic]').onclick = (e) => { muted = !muted; e.currentTarget.classList.toggle('off', muted); if (muted) { try { r && r.abort(); } catch {} setS('voice_tap', 'idle'); } else listen(); };
  listen();
}

/* ---------------- Model ---------------- */
function setModel(id) { const m = MODELS.find(x => x.id === id); if (!m) return; if (m.empty) return toast(t('no_verified_models')); if (m.allowed === false) return openPlans(); state.model = id; store.set('model', id); updateModelBtn(); }
function updateModelBtn() {
  const m = MODELS.find(x => x.id === state.model) || MODELS[0];
  const version = $('#modelVer');
  const name = $('.model-name');
  if (version) { version.textContent = m?.ver || ''; version.classList.toggle('hidden', !m?.ver); }
  if (name) name.textContent = m?.brand || (LANG === 'ar' ? 'النماذج' : 'Models');
}
function modelMenu(anchor) {
  // Only show models the current account is allowed to use; the server remains
  // authoritative, but the picker should not offer options guaranteed to 403.
  const available = MODELS.filter(m => !m.empty && m.allowed !== false);
  const items = [
    { head: LANG === 'ar' ? 'اختيار النموذج' : 'Choose a model' },
    ...available.map(m => ({
      label: m.brand || m.label || m.name,
      sub: (m.provider ? String(m.provider).toUpperCase() + ' · ' : '') + (m.sub || ''),
      checked: m.id === state.model,
      run: () => setModel(m.id),
    })),
  ];
  if (!available.length) items.push({ label: t('no_verified_models'), sub: t('connect_provider'), disabled: true });
  popover(anchor, items, { width: 320, side: isMobile() ? 'top' : 'bottom' });
}

/* ---------------- Sending & streaming ---------------- */
function stopStream() {
  if (activeRunId) api('/api/runs/' + encodeURIComponent(activeRunId) + '/cancel', {method:'POST',body:'{}'}).catch(() => {});
  if (state.ctrl) { state.ctrl.abort(); state.ctrl = null; }
}
async function send({ text, regenerate = false, editId = null } = {}) {
  if (state.streaming) return;
  if (!MODELS.some(m => m.id === state.model && !m.empty && m.allowed !== false)) { toast(t('no_verified_models')); return; }
  const content = regenerate ? '' : (text ?? input.value).trim();
  const images = regenerate || editId ? [] : [...state.attachments];
  if (!regenerate && !content && !images.length) return;
  const mode = state.mode === 'agent' ? 'agent' : hasTool('image') ? 'image' : hasTool('research') ? 'research' : hasTool('search') ? 'search' : 'chat';
  const thinkOn = hasTool('think') && mode !== 'image';

  // optimistic UI
  if (regenerate) {
    if (state.messages.length && state.messages[state.messages.length - 1].role === 'assistant') state.messages.pop();
  } else if (editId) {
    const i = state.messages.findIndex(m => m.id === editId); if (i >= 0) state.messages.splice(i);
    state.messages.push({ id: 'tmp-u', role: 'user', content, images: [] });
  } else {
    state.messages.push({ id: 'tmp-u', role: 'user', content, images });
    input.value = ''; state.attachments = []; renderAttachments(); autoGrow();
  }
  const asst = { id: 'tmp-a', role: 'assistant', content: '', images: [], meta: {} };
  state.messages.push(asst);
  updateChrome(); renderMessages();
  const aEl = msgsEl.lastElementChild; const body = aEl.querySelector('.md'); body.dir = document.documentElement.dir; aEl.querySelector('.msg-actions').style.visibility = 'hidden';
  const statusEl = aEl.querySelector('.msg-status'); const live = { queries: [], domains: [], phase: '', steps: [] };
  const drawAgent = () => {
    const think = live.steps.length && live.steps[live.steps.length - 1].kind === 'think';
    statusEl.innerHTML = `<div class="research-card agent-card"><div class="rc-head">${icon('agentRun')}<span class="thinking-lbl">${esc(think ? t('agent_thinking') + '…' : t('agent_live'))}</span><span class="rc-time" id="rcTime">${fmtDur((Date.now() - tStart) / 1000)}</span></div>
      ${live.steps.map((s, i) => agStepHTML(s, i, i === live.steps.length - 1)).join('')}</div>`;
  };
  const drawLive = () => {
    if (mode === 'search') {
      statusEl.innerHTML = `<div class="live-status"><span class="thinking-lbl">${thinkOn ? iconSz('bulb', 15) + ' ' : ''}${esc(live.domains.length ? t('reading', live.domains.length) : thinkOn ? t('searching_wide') : t('searching'))}</span>
        ${live.domains.length ? `<div class="fav-row">${live.domains.slice(0, 8).map(d => `<img src="${fav(d)}" alt="" title="${esc(d)}">`).join('')}</div>` : ''}
        ${live.queries.length ? `<div class="q-row">${live.queries.map(q => `<span class="q-pill">${iconSz('search', 13)}<span dir="auto">${esc(q)}</span></span>`).join('')}</div>` : ''}</div>`;
    } else if (mode === 'research') {
      const st = (on, done, label, extra = '') => `<div class="rs-step ${on ? 'on' : ''} ${done ? 'done' : ''}"><span class="rs-dot"></span><div><div class="rs-lbl">${esc(label)}</div>${extra}</div></div>`;
      const ph = live.phase;
      statusEl.innerHTML = `<div class="research-card"><div class="rc-head">${icon('telescope')}<span class="thinking-lbl">${esc(t('research_running'))}</span><span class="rc-time" id="rcTime"></span></div>
        ${st(ph === 'search', ph === 'read' || ph === 'write', t('research_plan'), live.queries.map(q => `<div class="rs-q">${iconSz('search', 13)}<span dir="auto">${esc(q)}</span></div>`).join(''))}
        ${st(ph === 'read', ph === 'write', t('research_read'), live.domains.length ? `<div class="rs-favs">${live.domains.map(d => `<span class="rs-src"><img src="${fav(d)}" alt="">${esc(shortDomain(d))}</span>`).join('')}</div>` : '')}
        ${st(ph === 'write', false, t('research_write'))}</div>`;
    }
  };
  const tStart = Date.now();
  body.innerHTML = mode === 'image' ? `<div class="img-loading">${esc(t('creating_image'))}</div>` : (thinkOn && mode === 'chat' ? `<span class="thinking-lbl">${esc(t('thinking_lbl'))}…</span>` : (mode === 'chat' || mode === 'agent' ? '<span class="dot-pulse"></span>' : ''));
  if (mode === 'search' || mode === 'research') drawLive();
  if (mode === 'agent') { live.steps = []; asst.meta.steps = live.steps; drawAgent(); }
  const timer = (mode === 'research' || mode === 'agent') ? setInterval(() => { const el = $('#rcTime', aEl); if (el) el.textContent = fmtDur((Date.now() - tStart) / 1000); }, 1000) : null;
  stick = true; requestAnimationFrame(() => { const um = aEl.previousElementSibling; if (um) thread.scrollTop = Math.max(0, um.offsetTop - 16); else scrollBottom(true); });

  state.streaming = true; updateSend();
  const ctrl = new AbortController(); state.ctrl = ctrl;
  let raf = 0; const paint = () => { raf = 0; body.dir = 'auto'; body.classList.add('streaming'); body.innerHTML = md(asst.content, asst.meta.sources); scrollBottom(); };
  let errored = false, errorMessage = '';
  try {
    const res = await api('/api/chat', { method: 'POST', signal: ctrl.signal, body: JSON.stringify({ chat_id: state.chatId, message: content, images, model: state.model, mode, think: thinkOn, regenerate, edit_message_id: editId }) });
    if (res.status === 401) { authFail(); throw new Error('unauth'); }
    if (!res.ok || !res.body) {
      const failure = await res.json().catch(() => ({}));
      const detail = failure.detail || failure.error || {};
      errorMessage = typeof detail === 'string' ? detail : detail.message || detail.code || ('HTTP ' + res.status);
      throw new Error(errorMessage);
    }
    const reader = res.body.getReader(); const dec = new TextDecoder(); let buf = '';
    while (true) {
      const { value, done } = await reader.read(); if (done) break;
      buf += dec.decode(value, { stream: true });
      let idx;
      while ((idx = buf.indexOf('\n\n')) >= 0) {
        const chunk = buf.slice(0, idx); buf = buf.slice(idx + 2);
        const ev = (chunk.match(/^event: (.*)$/m) || [])[1]; const dl = (chunk.match(/^data: (.*)$/m) || [])[1]; if (!ev || !dl) continue;
        const data = JSON.parse(dl);
        if (ev === 'meta') {
          activeRunId = data.run_id || null;
          const um = [...state.messages].reverse().find(m => m.role === 'user');
          if (um && data.user_msg_id) { um.id = data.user_msg_id; const ue = aEl.previousElementSibling; if (ue) ue.dataset.id = um.id; }
          asst.id = data.assistant_msg_id; aEl.dataset.id = asst.id;
          if (data.new) {
            state.chatId = data.chat_id; setRoute(data.chat_id); if (state.temp) state.tempIds.add(data.chat_id);
            state.chats.unshift({ id: data.chat_id, title: (content || t('image_chip')).split('\n')[0].slice(0, 40), pinned: 0, updated: Date.now() / 1000 });
            renderChatList();
          }
        } else if (ev === 'strategy') {
          asst.meta.strategy = data;
          if (mode === 'agent') { live.steps.push({kind:'plan',plan: data.strategy + ' · ' + data.profiles.join(' + ')}); drawAgent(); }
        } else if (ev === 'tool') {
          if (mode === 'agent') {
            const lbl = toolLabel(data.name);
            if (data.status === 'started') live.steps.push({ kind: 'think', text: lbl + '…', tool: data.name, pending: true });
            else {
              const open = [...live.steps].reverse().find(x => x.pending && x.tool === data.name);
              const text = (data.status === 'succeeded' ? '✓ ' : '✗ ') + lbl + (data.error ? ' — ' + data.error : '');
              if (open) { open.text = text; open.pending = false; } else live.steps.push({ kind: 'think', text });
            }
            drawAgent(); scrollBottom();
          }
        } else if (ev === 'evaluation') {
          asst.meta.evaluation = data; asst.meta.status = data.status;
        } else if (ev === 'done') {
          asst.meta.status = data.status;
        } else if (ev === 'delta') {
          if (!asst.content && (mode === 'search')) statusEl.innerHTML = '';
          if (!asst.content && thinkOn && mode === 'chat' && !asst.meta.seconds) statusEl.innerHTML = '';
          asst.content += data.t; if (!raf) raf = requestAnimationFrame(paint);
        }
        else if (ev === 'step') {
          if (mode === 'agent') {
            if (data.kind === 'agent_start') live.steps.push({ kind: 'start' });
            if (data.kind === 'read_file') live.steps.push({ kind: 'read_file', path: data.path, lines: data.lines });
            if (data.kind === 'edit_failed') live.steps.push({ kind: 'edit_failed', path: data.path });
            if (data.kind === 'edit') live.steps.push({ ...data });
            if (data.kind === 'plan') live.steps.push({ kind: 'plan', plan: data.plan || '' });
            if (data.kind === 'search') live.steps.push({ kind: 'search', q: data.q });
            if (data.kind === 'read' || data.kind === 'read_page') live.steps.push({ kind: 'read', domains: data.domains });
            if (data.kind === 'cmd') live.steps.push({ kind: 'cmd', cmd: data.cmd, code: -1 });
            if (data.kind === 'cmd_done') { const c = live.steps[live.steps.length - 1]; if (c && c.kind === 'cmd' && c.cmd === data.cmd) { c.code = data.code; c.out = data.out; } }
            if (data.kind === 'file') live.steps.push({ ...data });
            if (data.kind === 'write') live.steps.push({ kind: 'write' });
            drawAgent(); scrollBottom();
          } else {
            if (data.kind === 'search') { live.queries.push(data.q); live.phase = 'search'; }
            if (data.kind === 'read') { live.domains = data.domains; live.phase = 'read'; }
            if (data.kind === 'write') live.phase = 'write';
            drawLive(); scrollBottom();
          }
        }
        else if (ev === 'think') { if (mode === 'agent' && data.text) { live.steps.push({ kind: 'think', text: data.text }); drawAgent(); scrollBottom(); } }
        else if (ev === 'sources') { asst.meta.sources = data.sources; asst.meta.mode = mode; }
        else if (ev === 'thought') { asst.meta.seconds = data.seconds; if (mode !== 'research') statusEl.innerHTML = `<div class="thought-done">${esc(t('thought_for', data.seconds))}</div>`; }
        else if (ev === 'image') { asst.images.push(data.name); body.innerHTML = `<img class="gen-img" src="${mediaUrl(data.name)}" alt="" data-zoom>`; const im = body.querySelector('img'); im.onload = () => scrollBottom(); }
        else if (ev === 'title') { const c = state.chats.find(x => x.id === state.chatId); if (c) { c.title = data.title; document.title = data.title; renderChatList(); const ti = $(`.chat-item[data-id="${c.id}"] .ci-title`); ti && ti.classList.add('typing-title'); } }
        else if (ev === 'error') { errored = true; errorMessage = data.message || data.code || t('err'); }
      }
    }
  } catch (err) {
    if (err.name !== 'AbortError') { errored = true; console.error(err); }
  } finally {
    if (raf) cancelAnimationFrame(raf); if (timer) clearInterval(timer);
    if (mode === 'research') { asst.meta.mode = 'research'; asst.meta.queries = live.queries; if (!asst.meta.seconds) asst.meta.seconds = Math.round((Date.now() - tStart) / 1000); }
    if (mode === 'search' && thinkOn) { asst.meta.mode = 'search'; asst.meta.think = true; asst.meta.queries = asst.meta.queries || live.queries; if (!asst.meta.seconds) asst.meta.seconds = Math.round((Date.now() - tStart) / 1000); }
    if (mode === 'agent') { asst.meta.mode = 'agent'; asst.meta.queries = live.queries; asst.meta.steps = live.steps; if (!asst.meta.seconds) asst.meta.seconds = Math.round((Date.now() - tStart) / 1000); }
    state.streaming = false; state.ctrl = null; activeRunId = null; updateSend();
    body.classList.remove('streaming');
    if (asst.content) { body.innerHTML = md(asst.content, asst.meta.sources); statusEl.innerHTML = statusHTML(asst); }
    else statusEl.innerHTML = '';
    if (!asst.content && !asst.images.length) body.innerHTML = '';
    if (errored && !asst.content && !asst.images.length) {
      state.messages.pop();
      aEl.querySelector('.msg-actions').remove();
      body.innerHTML = `<div class="err-box"><span>${esc(errorMessage || t('err'))}</span><button class="btn btn-secondary" id="retryBtn">${esc(t('retry'))}</button></div>`;
      $('#retryBtn').onclick = () => { aEl.remove(); send({ regenerate: true }); };
    } else if (!asst.content && !asst.images.length) {
      state.messages.pop(); aEl.remove();
    } else {
      $$('.msg-assistant.last').forEach(x => x.classList.remove('last')); aEl.classList.add('last');
      const acts = aEl.querySelector('.msg-actions'); acts.style.visibility = ''; refreshActions(aEl, asst);
    }
    const c = state.chats.find(x => x.id === state.chatId); if (c) { c.updated = Date.now() / 1000; state.chats.sort((a, b) => (b.pinned - a.pinned) || (b.updated - a.updated)); renderChatList(); }
    updateChrome();
  }
  return asst;
}

/* ---------------- Search modal ---------------- */
function groupLabel(ts) {
  const d = new Date(ts * 1000), now = new Date(); const day = 864e5; const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (d >= start) return t('today'); if (d >= start - day) return t('yesterday'); if (d >= start - 7 * day) return t('prev7'); if (d >= start - 30 * day) return t('prev30'); return t('older');
}
function openSearch() {
  appEl.classList.remove('mobile-open');
  const m = modal(`<div class="search-top"><input id="sq" placeholder="${esc(t('search_ph'))}" dir="auto"><button class="icon-btn" data-close aria-label="close">${icon('x')}</button></div><div class="search-res" id="sres"></div>`, 'search-modal');
  const q = m.el.querySelector('#sq'), res = m.el.querySelector('#sres'); let sel = 0, items = [];
  const draw = (chats, query) => {
    items = [{ new: true }, ...chats]; let html = `<button class="sr-item ${sel === 0 ? 'sel' : ''}" data-k="0">${icon('newchat')}<span>${esc(t('new_chat'))}</span></button>`;
    let g = null;
    chats.forEach((c, i) => { const gl = groupLabel(c.updated); if (gl !== g) { g = gl; html += `<div class="sr-group">${esc(gl)}</div>`; } html += `<button class="sr-item ${sel === i + 1 ? 'sel' : ''}" data-k="${i + 1}">${icon('chat')}<span style="min-width:0"><span dir="auto">${esc(c.title)}</span></span></button>`; });
    if (query && !chats.length) html += `<div class="sr-group">${esc(t('no_results'))}</div>`;
    res.innerHTML = html;
  };
  draw(state.chats.filter(c => !state.tempIds.has(c.id)), '');
  let tm; q.addEventListener('input', () => { clearTimeout(tm); tm = setTimeout(async () => { sel = 0; const v = q.value.trim(); if (!v) return draw(state.chats, ''); try { const r = await api('/api/chats?q=' + encodeURIComponent(v)); draw(await r.json(), v); } catch {} }, 150); });
  const go = (k) => { const it = items[k]; m.close(); if (!it) return; if (it.new) newChat(); else openChat(it.id); };
  res.addEventListener('click', (e) => { const b = e.target.closest('[data-k]'); b && go(+b.dataset.k); });
  q.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, Math.min(items.length - 1, sel + (e.key === 'ArrowDown' ? 1 : -1))); $$('.sr-item', res).forEach(b => b.classList.toggle('sel', +b.dataset.k === sel)); $(`.sr-item[data-k="${sel}"]`, res)?.scrollIntoView({ block: 'nearest' }); }
    if (e.key === 'Enter') go(sel);
  });
  setTimeout(() => q.focus(), 30);
}

/* ---------------- Library ---------------- */
async function openLibrary() {
  appEl.classList.remove('mobile-open');
  const m = modal(`<div class="modal-h"><span>${esc(t('lib_title'))}</span><button class="icon-btn" data-close>${icon('x')}</button></div><div class="modal-b"><div id="libBody" class="lib-empty">…</div></div>`, 'settings-modal');
  const imgs = [];
  for (const c of state.chats.slice(0, 40)) { try { const r = await api(`/api/chats/${c.id}`); const d = await r.json(); d.messages.forEach(x => x.role === 'assistant' && (x.images || []).forEach(n => imgs.push(n))); } catch {} }
  const lb = m.el.querySelector('#libBody'); if (!lb) return;
  if (!imgs.length) { lb.textContent = t('lib_empty'); return; }
  lb.className = 'lib-grid'; lb.innerHTML = imgs.map(n => `<img src="${mediaUrl(n)}" alt="">`).join('');
  lb.addEventListener('click', (e) => e.target.tagName === 'IMG' && lightbox(e.target.src));
}

/* ---------------- Settings ---------------- */
function openSettings(tab = 'general') {
  const m = modal(`<div class="modal-h"><span>${esc(t('settings'))}</span><button class="icon-btn" data-close>${icon('x')}</button></div>
    <div class="settings-body"><div class="settings-tabs">
      <button class="st-tab" data-tab="general">${icon('gear')}<span>${esc(t('general'))}</span></button>
      <button class="st-tab" data-tab="data">${icon('db')}<span>${esc(t('data'))}</span></button>
    </div><div class="settings-pane" id="stPane"></div></div>`, 'settings-modal');
  const pane = m.el.querySelector('#stPane');
  const themeLbl = () => t({ system: 'sys', dark: 'dark', light: 'light' }[state.theme]);
  const draw = (tb) => {
    $$('.st-tab', m.el).forEach(b => b.classList.toggle('on', b.dataset.tab === tb));
    if (tb === 'general') pane.innerHTML = `
      <div class="st-row"><span>${esc(t('theme'))}</span><button class="st-sel" id="stTheme">${esc(themeLbl())} ${icon('chevron')}</button></div>
      <div class="st-row"><span>${esc(t('language'))}</span><button class="st-sel" id="stLang">${LANG === 'ar' ? 'العربية' : 'English'} ${icon('chevron')}</button></div>`;
    else pane.innerHTML = `<div class="st-row"><span>${esc(t('delete_all'))}</span><button class="btn btn-danger" id="stDelAll">${esc(t('delete_all_btn'))}</button></div>`;
    const th = pane.querySelector('#stTheme'), lg = pane.querySelector('#stLang'), da = pane.querySelector('#stDelAll');
    th && th.addEventListener('click', () => popover(th, ['system', 'dark', 'light'].map(v => ({ label: t({ system: 'sys', dark: 'dark', light: 'light' }[v]), checked: state.theme === v, run: () => { state.theme = v; store.set('theme', v); applyTheme(); draw('general'); } })), { align: 'end' }));
    lg && lg.addEventListener('click', () => popover(lg, [['ar', 'العربية'], ['en', 'English']].map(([v, l]) => ({ label: l, checked: LANG === v, run: () => { LANG = v; store.set('lang', v); applyLang(); renderMessages(); m.close(); openSettings('general'); } })), { align: 'end' }));
    da && da.addEventListener('click', () => confirmModal({ title: t('del_all_title'), body: `<p>${esc(t('del_all_body'))}</p>`, okLabel: t('delete_all_btn'), onOk: async () => { await api('/api/chats', { method: 'DELETE' }); state.chats = []; m.close(); newChat(); } }));
  };
  m.el.querySelectorAll('.st-tab').forEach(b => b.addEventListener('click', () => draw(b.dataset.tab)));
  draw(tab);
}
function infoModal(title, body) { const m = modal(`<div class="modal-h"><span>${esc(title)}</span><button class="icon-btn" data-close>${icon('x')}</button></div><div class="modal-b"><p>${esc(body)}</p></div><div class="modal-f"><button class="btn btn-primary" data-close>${esc(t('ok'))}</button></div>`); }
async function openPlans() {
  const m = modal(`<div class="modal-h"><span>${esc(LANG==='ar'?'الخطط والاستخدام':'Plans & usage')}</span><button class="icon-btn" data-close aria-label="Close">${icon('x')}</button></div><div class="modal-b apex-plan-body" aria-live="polite">${esc(t('working'))}</div>`, 'apex-wide');
  const body = m.el.querySelector('.apex-plan-body');
  try {
    const r = await api('/api/plans'); if (!r.ok) throw new Error('Plans unavailable');
    const d = await r.json(), ar = LANG==='ar';
    const rows = [
      ['messages',ar?'الرسائل / يوم':'Messages / day'],
      ['agent',ar?'مهام الوكيل / يوم':'Agent tasks / day'],
      ['research',ar?'بحث متعمق / يوم':'Research / day'],
      ['steps',ar?'خطوات النموذج / مهمة':'Model steps / task'],
      ['concurrent',ar?'مهام متزامنة':'Concurrent tasks'],
      ['files',ar?'ملفات / مهمة':'Files / task'],
      ['file_bytes',ar?'بايت / ملف':'Bytes / file'],
      ['context',ar?'حجم السياق (أحرف)':'Context (characters)'],
      ['memory',ar?'ذاكرة اختيارية':'Opt-in memory'],
      ['resume',ar?'استئناف المهام':'Resume tasks'],
    ];
    body.innerHTML = `<p class="apex-note">${esc(ar?'خطتك الحالية: ':'Current plan: ')}<strong>${esc(d.current.toUpperCase())}</strong> · ${esc(ar?'تُصفّر الحصص عند 00:00 UTC':'Quotas reset at 00:00 UTC')}</p><div class="apex-table-scroll" tabindex="0" aria-label="Plan comparison"><table class="apex-plan-table"><thead><tr><th>${esc(ar?'الميزة':'Feature')}</th>${Object.entries(d.plans).map(([id,p])=>`<th class="${d.current===id?'current':''}">${esc(p.label)}${d.current===id?`<small>${esc(ar?'خطتك':'Current')}</small>`:''}</th>`).join('')}</tr></thead><tbody>${rows.map(([key,label])=>`<tr><th scope="row">${esc(label)}</th>${Object.values(d.plans).map(p=>`<td>${typeof p[key]==='boolean' ? (p[key]?(ar?'متاح':'Yes'):(ar?'غير متاح':'No')) : Number(p[key]).toLocaleString()}</td>`).join('')}</tr>`).join('')}</tbody></table></div><div class="apex-usage">${['messages','agent','research'].map(k=>`<div><span>${esc(rows.find(r=>r[0]===k)[1])}</span><strong>${d.usage[k]||0} / ${d.plans[d.current][k]}</strong><progress max="${Math.max(1,d.plans[d.current][k])}" value="${d.usage[k]||0}"></progress></div>`).join('')}</div><p class="apex-note">${esc(ar?'تُفرض القيود من الخادم. يعيّن المالك الخطط من لوحة التحكم. الدفع الإلكتروني غير موصول، وتوفر الأدوات يعتمد أيضًا على إعداد خدماتها.':'Limits are enforced on the server. The owner assigns plans in Admin. No payment processor is connected. Tool availability also depends on provider configuration.')}</p>`;
    const hint=document.createElement('p');hint.className='apex-note apex-scroll-hint';hint.textContent=ar?'مرّر الجدول أفقيًا لرؤية جميع الخطط.':'Scroll the table horizontally to see every plan.';body.querySelector('.apex-table-scroll')?.before(hint);
  } catch (e) { body.textContent = e.message; }
}
async function openRuns() {
  const m = modal(`<div class="modal-h"><span>APEX · ${esc(LANG==='ar'?'المهام':'Runs')}</span><button class="icon-btn" data-close aria-label="Close">${icon('x')}</button></div><div class="modal-b apex-runs" aria-live="polite"></div>`, 'apex-wide');
  const body = m.el.querySelector('.apex-runs');
  const draw = async () => {
    const r = await api('/api/runs'); if (!r.ok) { body.textContent=LANG==='ar'?'تعذّر تحميل المهام':'Could not load tasks'; return; }
    const runs = await r.json();
    body.innerHTML = `<button class="btn btn-secondary" data-refresh>${esc(LANG==='ar'?'تحديث':'Refresh')}</button>` + (runs.map(run=>`<article class="apex-run"><div><strong dir="auto">${esc(run.objective.slice(0,140))}</strong><p><span class="apex-status">${esc(run.status)}</span> · <code>${esc(JSON.parse(run.strategy).strategy)}</code></p></div><div class="apex-run-actions"><button class="btn btn-secondary" data-inspect="${run.id}">${esc(LANG==='ar'?'الأدلة':'Evidence')}</button>${['queued','running'].includes(run.status)?`<button class="btn btn-secondary" data-cancel="${run.id}">${esc(LANG==='ar'?'إلغاء':'Cancel')}</button>`:''}${['interrupted','failed'].includes(run.status)&&capabilities?.features.resume?`<button class="btn btn-secondary" data-resume="${run.id}">${esc(LANG==='ar'?'استئناف':'Resume')}</button>`:''}</div></article>`).join('') || `<p>${esc(LANG==='ar'?'لا توجد مهام بعد. ابدأ برسالة أو مهمة وكيل.':'No tasks yet. Start with a message or agent task.')}</p>`);
    body.querySelector('[data-refresh]').onclick=draw;
    body.querySelectorAll('[data-cancel]').forEach(b=>b.onclick=async()=>{await api('/api/runs/'+b.dataset.cancel+'/cancel',{method:'POST',body:'{}'});await draw();});
    body.querySelectorAll('[data-inspect]').forEach(b=>b.onclick=async()=>{
      const r=await api('/api/runs/'+b.dataset.inspect); const d=await r.json(); if(!r.ok)return;
      const detail=modal(`<div class="modal-h"><span>APEX · evidence</span><button class="icon-btn" data-close aria-label="Close">${icon('x')}</button></div><div class="modal-b apex-evidence"></div>`,'apex-wide');
      const target=detail.el.querySelector('.apex-evidence');
      const pre=document.createElement('pre');pre.dir='ltr';pre.textContent=JSON.stringify({status:d.status,strategy:d.strategy,task_graph:d.task_graph,events:d.events},null,2);target.appendChild(pre);
    });
    body.querySelectorAll('[data-resume]').forEach(b=>b.onclick=async()=>{
      b.disabled=true;
      try {const r=await api('/api/runs/'+b.dataset.resume+'/resume',{method:'POST',body:'{}'});if(!r.ok){const e=await r.json();toast(typeof e.detail==='string'?e.detail:JSON.stringify(e.detail));return;}const reader=r.body.getReader();while(!(await reader.read()).done){}await draw();}finally{b.disabled=false;}
    });
  };
  await draw();
}
async function openMemory() {
  const ar=LANG==='ar';
  const m=modal(`<div class="modal-h"><span>${esc(ar?'الذاكرة والخصوصية':'Memory & privacy')}</span><button class="icon-btn" data-close aria-label="Close">${icon('x')}</button></div><div class="modal-b apex-memory"></div>`,'apex-wide');
  const body=m.el.querySelector('.apex-memory');
  if(!capabilities?.features.memory){body.innerHTML=`<p>${esc(ar?'الذاكرة الاختيارية متاحة في Pro وUltra. لا تُحفظ تفضيلاتك تلقائيًا.':'Opt-in memory is available in Pro and Ultra. Preferences are not saved automatically.')}</p>`;return;}
  body.innerHTML=`<p>${esc(ar?'الذاكرة معزولة لكل حساب. فعّل الاسترجاع والتعلم المحدود من تحقق الأدوات، أو أوقفه واحذف أي سجل.':'Memory is account-isolated. Enable retrieval and narrowly scoped tool-validation lessons, or disable it and delete any entry.')}</p><label class="apex-consent"><input type="checkbox" id="memoryEnabled" ${PREFS.memory_opt_in?'checked':''}>${esc(ar?'أوافق على استرجاع الذاكرة وحفظ ملاحظات التحقق':'I consent to memory retrieval and storing validation observations')}</label><label for="memoryText">${esc(ar?'تفضيل أحفظه بإرادتي':'An explicit preference to save')}</label><textarea id="memoryText" maxlength="2000" rows="3"></textarea><button class="btn btn-primary" id="memorySave">${esc(t('save'))}</button><p role="status" id="memoryStatus"></p><div id="memoryList"></div>`;
  $('#memoryEnabled',body).onchange=e=>store.set('memory_opt_in',e.target.checked);
  const refresh=async()=>{const r=await api('/api/memory');if(!r.ok)return;const rows=await r.json();$('#memoryList',body).innerHTML=rows.map(x=>`<article class="apex-run"><div><p dir="auto">${esc(x.text)}</p><small>${esc(x.scope)} · ${esc(x.provenance)} · ${x.confidence}</small></div><button class="btn btn-secondary" data-del-memory="${x.id}">${esc(t('delete'))}</button></article>`).join('');body.querySelectorAll('[data-del-memory]').forEach(b=>b.onclick=async()=>{await api('/api/memory/'+b.dataset.delMemory,{method:'DELETE'});refresh();});};
  $('#memorySave',body).onclick=async()=>{const text=$('#memoryText',body).value.trim();if(!text)return;const r=await api('/api/memory',{method:'POST',body:JSON.stringify({scope:'preference',text,consent:true})});$('#memoryStatus',body).textContent=r.ok?t('saved'):t('err');if(r.ok){$('#memoryText',body).value='';refresh();}};
  await refresh();
}
function profileMenu(anchor) {
  const u = state.user || {};
  const items = [
    { html: `<div class="pop-email">${icon('user')}<span dir="ltr">${esc(u.email || '')} · ${esc(u.plan || 'Free')}</span></div>` },
    '-',
  ];
  if (u.role === 'owner') items.push({ icon: 'gear', label: t('admin_title'), run: () => openAdmin() });
  items.push(
    { icon: 'sparkle', label: t('upgrade_plan'), run: () => openPlans() },
    { icon: 'agentRun', label: 'APEX runs', run: () => openRuns() },
    { icon: 'db', label: LANG === 'ar' ? 'الذاكرة والخصوصية' : 'Memory & privacy', run: () => openMemory() },
    { icon: 'user', label: t('personalize'), run: () => openSettings('general') },
    { icon: 'gear', label: t('settings'), run: () => openSettings('general') },
    '-',
    { icon: 'help', label: t('help'), run: () => toast(t('soon')) },
    { icon: 'logout', label: t('logout'), run: async () => { try { await api('/api/auth/logout', { method: 'POST' }); } catch {} authFail(); } },
  );
  popover(anchor, items, { side: 'top', width: 260 });
}

/* ---------------- Global actions ---------------- */
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  const a = b.dataset.act;
  switch (a) {
    case 'plans': openPlans(); break;
    case 'runs': openRuns(); break;
    case 'toggle-sidebar': toggleSidebar(); break;
    case 'close-sidebar-mobile': appEl.classList.remove('mobile-open'); break;
    case 'new-chat': case 'home': newChat(); break;
    case 'search': openSearch(); break;
    case 'library': openLibrary(); break;
    case 'gpts': infoModal(t('gpts_t'), t('soon')); break;
    case 'projects': infoModal(t('proj_t'), t('soon')); break;
    case 'profile-menu': profileMenu(b); break;
    case 'model-menu': if (openPop?.anchor === b) closePop(); else modelMenu(b); break;
    case 'plus-menu': if (openPop?.anchor === b) closePop(); else plusMenu(b); break;
    case 'clear-tool': clearTool(b.dataset.tool); break;
    case 'quick-tool': toggleTool(b.dataset.tool); break;
    case 'dictate': dictate(); break;
    case 'scroll-bottom': thread.scrollTo({ top: thread.scrollHeight, behavior: 'smooth' }); break;
    case 'share': state.chatId && shareChat(state.chatId); break;
    case 'chat-more': topMenu(b); break;
    case 'temp': state.temp = !state.temp; b.classList.toggle('on', state.temp); b.dataset.tip = state.temp ? (LANG === 'ar' ? 'إيقاف الدردشة المؤقتة' : 'Turn off temporary chat') : 'temp_chat'; STR[LANG][b.dataset.tip] ||= b.dataset.tip; setWelcome(); break;
  }
});
document.addEventListener('keydown', (e) => {
  const mod = e.ctrlKey || e.metaKey;
  if (mod && e.key.toLowerCase() === 'k') { e.preventDefault(); openSearch(); }
  else if (mod && e.shiftKey && e.key.toLowerCase() === 'o') { e.preventDefault(); newChat(); }
  else if (mod && e.shiftKey && e.key.toLowerCase() === 's') { e.preventDefault(); toggleSidebar(); }
  else if (e.key === 'Escape') { if (openPop) closePop(); else if (state.streaming) stopStream(); }
  else if (!mod && !e.altKey && e.key.length === 1 && document.activeElement === document.body && !$('#modal-layer').children.length) input.focus();
});
window.addEventListener('hashchange', () => { const id = routeFromHash(); if (id && id !== state.chatId) openChat(id); else if (!id && state.chatId) newChat(); });
window.addEventListener('beforeunload', cleanupTemp);

/* ---------------- Auth ---------------- */
let authMode = 'login';
function renderAuthTexts() {
  const s = $('#authScreen'); if (!s) return;
  const signup = authMode === 'signup';
  $('#authTitle').textContent = signup ? t('signup_title') : t('login_title');
  $('#authSub').textContent = signup ? t('signup_sub') : t('login_sub');
  $('#authNameWrap').classList.toggle('hidden', !signup);
  $('#authEmailLbl').textContent = t('f_email');
  $('#authPassLbl').textContent = t('f_pass');
  $('#authNameLbl').textContent = t('f_name');
  $('#authBtn').textContent = signup ? t('signup_btn') : t('login_btn');
  const sw = $('#authSwitch');
  sw.innerHTML = signup ? `${esc(t('has_account'))} <a href="#" id="authSw">${esc(t('login_btn'))}</a>` : `${esc(t('no_account'))} <a href="#" id="authSw">${esc(t('signup_btn'))}</a>`;
  $('#authSw').onclick = (e) => { e.preventDefault(); authMode = authMode === 'login' ? 'signup' : 'login'; renderAuthTexts(); };
}
function showAuth() {
  $('#authScreen').classList.remove('hidden'); $('#app').classList.add('hidden');
  renderAuthTexts();
  setTimeout(() => $('#authEmail').focus(), 50);
}
function hideAuth() { $('#authScreen').classList.add('hidden'); $('#app').classList.remove('hidden'); }
$('#authForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = $('#authErr'); err.classList.add('hidden');
  const btn = $('#authBtn'); btn.disabled = true; btn.textContent = t('working');
  const body = { email: $('#authEmail').value.trim(), password: $('#authPass').value };
  if (authMode === 'signup') body.name = $('#authName').value.trim();
  try {
    const r = await api('/api/auth/' + (authMode === 'signup' ? 'signup' : 'login'), { method: 'POST', body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { err.textContent = d.detail?.message || (d.detail?.code ? d.detail.code : t(d.error === 'exists' ? 'err_exists' : d.error === 'invalid' ? 'err_invalid' : 'err_bad')); err.classList.remove('hidden'); return; }
    setToken(d.token); state.user = d.user;
    hideAuth(); await onAuthed();
  } catch {
    err.textContent = t('err_bad'); err.classList.remove('hidden');
  } finally { btn.disabled = false; btn.textContent = authMode === 'signup' ? t('signup_btn') : t('login_btn'); }
});
function authFail() { setToken(''); state.user = null; state.messages=[]; state.chats=[]; state.chatId=null; capabilities=null; activeRunId=null; renderMessages(); renderChatList(); showAuth(); }
function setModelCatalogue(rows) {
  if (!Array.isArray(rows) || !rows.length) return false;
  const cleaned = rows.filter(m => m && m.id && (m.label || m.name)).map(m => ({
    ...m,
    brand: m.label || m.name,
    ver: '',
    name: m.label || m.name,
    sub: ({
      fast: LANG === 'ar' ? 'سريع' : 'Fast',
      standard: LANG === 'ar' ? 'متوازن' : 'Balanced',
      advanced: LANG === 'ar' ? 'متقدم' : 'Advanced',
    })[m.tier] || (LANG === 'ar' ? 'نموذج متصل' : 'Connected model'),
  }));
  if (!cleaned.length) return false;
  MODELS.splice(0, MODELS.length, ...cleaned);
  if (!MODELS.find(m => m.id === state.model && m.allowed)) {
    state.model = MODELS.find(m => m.allowed)?.id || MODELS[0].id || 'fast';
  }
  updateModelBtn();
  return true;
}
async function loadModelCatalogue() {
  let loaded = false;
  try {
    const r = await api('/api/capabilities');
    if (r.ok) {
      const data = await r.json();
      if (data && typeof data === 'object') capabilities = data;
      loaded = setModelCatalogue(data?.models);
    }
  } catch {}
  // The dedicated endpoint avoids losing the picker if another capability (such
  // as tool inventory) fails while the verified model catalogue is available.
  if (!loaded) {
    try {
      const r = await api('/api/models');
      if (r.ok) {
        const data = await r.json();
        loaded = setModelCatalogue(data?.models);
      }
    } catch {}
  }
  if (!loaded) {
    MODELS.splice(0, MODELS.length, {
      id: 'fast', ver: '', name: t('no_verified_models'),
      sub: t('connect_provider'), brand: t('no_verified_models'),
      allowed: false, empty: true,
    });
    state.model = 'fast';
    updateModelBtn();
  }
}
async function onAuthed() {
  await loadModelCatalogue();
  renderProfileBits();
  try { const r = await api('/api/prefs'); if (r.ok) { const p = await r.json(); Object.assign(PREFS, p || {}); } } catch {}
  LANG = PREFS.lang || LANG; state.theme = PREFS.theme || state.theme;
  if (MODELS.find(m => m.id === PREFS.model && m.allowed)) state.model = PREFS.model;
  if (PREFS.collapsed === '1') appEl.classList.add('collapsed');
  applyTheme(); applyLang(); updateModelBtn(); updateSend(); renderModeToggle(); autoGrow();
  await loadChats();
  const id = routeFromHash(); if (id) openChat(id);
  if (!isMobile()) input.focus();
}
function renderProfileBits() {
  const u = state.user;
  $$('.avatar').forEach(a => { if (u) a.textContent = (u.name || u.email)[0].toUpperCase(); });
  $$('.profile-name').forEach(el => { if (u) el.textContent = u.name || u.email; });
  $$('.profile-plan, .plan-pill').forEach(el => { if (u) el.textContent = (u.plan || 'free').replace(/^./, c=>c.toUpperCase()); });
}

/* ---------------- Admin dashboard ---------------- */
function openAdmin() {
  const v = $('#adminView'); if (!v || state.user?.role !== 'owner') return;
  v.classList.remove('hidden');
  hydrateIcons(v);
  $$('#adminView [data-t]').forEach(el => el.textContent = t(el.dataset.t));
  $$('#adminView .at-tab').forEach(b => b.classList.toggle('on', b.dataset.atab === 'overview'));
  adminTab('overview');
}
$('#adminClose').addEventListener('click', () => $('#adminView').classList.add('hidden'));
async function adminTab(tab) {
  const pane = $('#adminPane');
  $$('#adminView .at-tab').forEach(b => b.classList.toggle('on', b.dataset.atab === tab));
  pane.innerHTML = '<div class="ad-loading">…</div>';
  try {
    if (tab === 'overview') {
      const r = await api('/api/admin/stats'); const d = await r.json();
      const cards = [['stat_users', d.users], ['stat_chats', d.chats], ['stat_messages', d.messages], ['stat_images', d.images], ['stat_searches', d.searches], ['stat_research', d.research], ['stat_agent', d.agent]];
      pane.innerHTML = `<div class="ad-cards">${cards.map(([k, v]) => `<div class="ad-card"><span class="ad-num">${v ?? 0}</span><span class="ad-lbl">${esc(t(k))}</span></div>`).join('')}</div>
        <div class="ad-h">${esc(t('admin_recent'))}</div>
        <div class="ad-table"><table><thead><tr><th>${esc(t('col_email'))}</th><th>${esc(t('col_name'))}</th><th>${esc(t('col_role'))}</th><th>${esc(t('col_joined'))}</th></tr></thead>
        <tbody>${(d.recent || []).map(u => `<tr><td dir="ltr">${esc(u.email)}</td><td>${esc(u.name)}</td><td>${esc(u.role === 'owner' ? t('role_owner') : t('role_user'))}</td><td>${new Date(u.created * 1000).toLocaleDateString()}</td></tr>`).join('')}</tbody></table></div>`;
    }
    else if (tab === 'users') {
      const r = await api('/api/admin/users'); const users = await r.json();
      const me = state.user;
      pane.innerHTML = `<div class="ad-table"><table><thead><tr><th>${esc(t('col_email'))}</th><th>${esc(t('col_name'))}</th><th>${esc(t('col_role'))}</th><th>${esc(t('col_chats'))}</th><th></th></tr></thead><tbody>
        ${users.map(u => `<tr data-uid="${u.id}"><td dir="ltr">${esc(u.email)}</td><td>${esc(u.name)}</td><td>${esc(u.role === 'owner' ? t('role_owner') : t('role_user'))}</td><td>${u.chats}</td>
        <td class="ad-acts"><label>Plan <select data-plan-user="${u.id}" aria-label="Plan for ${esc(u.email)}">${['free','plus','pro','ultra'].map(p=>`<option value="${p}" ${u.plan===p?'selected':''}>${p}</option>`).join('')}</select></label><button class="ad-btn" data-ua="role" data-uid="${u.id}">${esc(u.role === 'owner' ? t('user_makeuser') : t('user_makeowner'))}</button>
        <button class="ad-btn" data-ua="reset" data-uid="${u.id}">${esc(t('user_reset'))}</button>
        ${u.id !== me.id ? `<button class="ad-btn ad-danger" data-ua="del" data-uid="${u.id}">${esc(t('user_delete'))}</button>` : ''}</td></tr>`).join('')}
      </tbody></table></div>`;
      pane.querySelectorAll('[data-plan-user]').forEach(select => select.addEventListener('change', async () => {
        const r = await api('/api/admin/users/' + select.dataset.planUser, {method:'PATCH',body:JSON.stringify({plan:select.value})});
        if (!r.ok) return toast(LANG==='ar'?'تعذر تعديل الخطة':'Plan update failed');
        if (select.dataset.planUser === state.user.id) { state.user.plan = select.value; await onAuthed(); }
        toast(t('saved'));
      }));
      pane.querySelectorAll('[data-ua]').forEach(b => b.addEventListener('click', async () => {
        const uid = b.dataset.uid, act = b.dataset.ua;
        if (act === 'role') { const u = users.find(x => x.id === uid); await api('/api/admin/users/' + uid, { method: 'PATCH', body: JSON.stringify({ role: u.role === 'owner' ? 'user' : 'owner' }) }); adminTab('users'); }
        if (act === 'reset') { const r = await api(`/api/admin/users/${uid}/reset`, { method: 'POST' }); const d = await r.json(); if (d.password) confirmModal({ title: t('reset_done'), body: `<p dir="ltr" style="font-family:var(--mono)">${esc(d.password)}</p>`, okLabel: t('ok'), danger: false, onOk: () => {} }); }
        if (act === 'del') confirmModal({ title: t('user_delete'), body: `<p>${esc(t('del_user_q'))}</p>`, okLabel: t('user_delete'), onOk: async () => { await api('/api/admin/users/' + uid, { method: 'DELETE' }); adminTab('users'); } });
      }));
    }
    else if (tab === 'chats') {
      const r = await api('/api/admin/chats'); const chats = await r.json();
      if (!chats.length) { pane.innerHTML = `<div class="ad-empty">${esc(t('no_data'))}</div>`; return; }
      pane.innerHTML = `<div class="ad-table"><table><thead><tr><th>${esc(t('col_title'))}</th><th>${esc(t('col_email'))}</th><th>${esc(t('col_msgs'))}</th><th></th></tr></thead><tbody>
        ${chats.map(c => `<tr><td dir="auto">${esc(c.title || '—')}</td><td dir="ltr">${esc(c.email)}</td><td>${c.msgs}</td>
        <td class="ad-acts"><button class="ad-btn" data-ca="view" data-cid="${c.id}">${esc(t('view_chat'))}</button> <button class="ad-btn ad-danger" data-ca="del" data-cid="${c.id}">${esc(t('user_delete'))}</button></td></tr>`).join('')}
      </tbody></table></div>`;
      pane.querySelectorAll('[data-ca]').forEach(b => b.addEventListener('click', async () => {
        if (b.dataset.ca === 'del') { await api('/api/admin/chats/' + b.dataset.cid, { method: 'DELETE' }); adminTab('chats'); return; }
        const r = await api('/api/admin/chats/' + b.dataset.cid + '/full'); const c = await r.json();
        const body = c.messages.map(m => `<div class="ad-msg"><b>${m.role === 'user' ? '👤' : '🤖'}</b><span>${esc((m.content || '').slice(0, 500))}</span></div>`).join('');
        modal(`<div class="modal-h"><span dir="auto">${esc(c.title || '')}</span><button class="icon-btn" data-close>${icon('x')}</button></div><div class="modal-b" style="max-height:60vh;overflow-y:auto">${body || t('no_data')}</div>`);
      }));
    }
    else if (tab === 'settings') {
      const r = await api('/api/admin/settings'); const s = await r.json();
      pane.innerHTML = `<div class="ad-set"><h2>APEX configuration</h2><p>${esc(s.configuration || '')}</p><p>${esc(s.providerReady ? (LANG==='ar'?'المزوّد موصول':'Provider configured') : (LANG==='ar'?'المزوّد غير موصول':'Provider not configured'))}</p><p dir="ltr">${esc((s.models||[]).map(m=>m.label).join(', ') || 'No model configured')}</p><p dir="ltr">GEMINI_API_KEY / OPENAI_API_KEY · FAST_MODEL · STANDARD_MODEL · ADVANCED_MODEL · DATABASE_URL</p><p>${esc(LANG==='ar'?'لا تعرض الواجهة مفاتيح الخادم أو تسمح بتجاوز قيود الخطط.':'Server secrets are never exposed; plan enforcement stays on the backend.')}</p><label>${esc(t('current_pw'))}<input id="apexCurrent" type="password" autocomplete="current-password"></label><label>${esc(t('new_pw'))}<input id="apexNext" type="password" minlength="10" autocomplete="new-password"></label><button class="btn btn-primary" id="apexPassword">${esc(t('change_pw'))}</button><p id="apexPwStatus" role="status"></p></div>`;
      $('#apexPassword',pane).onclick = async () => {
        const r = await api('/api/auth/password',{method:'POST',body:JSON.stringify({current:$('#apexCurrent',pane).value,next:$('#apexNext',pane).value})});
        $('#apexPwStatus',pane).textContent = r.ok ? (LANG==='ar'?'تم التغيير. سجل الدخول مجددًا.':'Changed. Please sign in again.') : (LANG==='ar'?'تحقق من كلمة المرور الحالية والجديدة (10 أحرف على الأقل).':'Check current password and minimum 10-character new password.');
        if (r.ok) { setToken(''); state.user=null; }
      };
      const refresh=document.createElement('button');refresh.className='btn btn-secondary';refresh.textContent=LANG==='ar'?'اختبار النماذج المتصلة':'Verify connected models';pane.querySelector('.ad-set').appendChild(refresh);
      refresh.onclick=async()=>{refresh.disabled=true;try{const r=await api('/api/admin/models/refresh',{method:'POST',body:'{}'});const d=await r.json();if(!r.ok)throw new Error(d.detail?.message||d.detail||'Discovery failed');toast((LANG==='ar'?'نماذج مكتشفة: ':'Discovered: ')+d.discovered.length);await onAuthed();await adminTab('settings');}catch(e){toast(String(e.message));}finally{refresh.disabled=false;}};
      return;
    }
  } catch { pane.innerHTML = `<div class="ad-empty">${esc(t('no_data'))}</div>`; }
}
$$('#adminView .at-tab').forEach(b => b.addEventListener('click', () => adminTab(b.dataset.atab)));

/* ---------------- Init ---------------- */
hydrateIcons(); applyTheme(); applyLang(); updateSend(); autoGrow(); renderModeToggle();
if (window.ResizeObserver) new ResizeObserver(() => renderModeToggle()).observe($('#modeToggle'));
(async () => {
  try {
    const health=await (await api('/api/health')).json();
    const note=document.createElement('p');note.className='apex-connection';note.id='apexConnection';note.setAttribute('role','status');
    note.textContent=health.configuration_complete ? '' : health.storage==='sqlite-development' && !LOCAL.has(location.hostname) ? 'هذه النسخة تحتاج ربط قاعدة بيانات دائمة ومزوّد النماذج قبل تفعيلها للإنتاج.' : !health.provider_ready ? 'مزوّد الذكاء الاصطناعي غير مهيّأ بعد. الحسابات والخطط متاحة؛ لن تظهر ردود وهمية.' : '';
    if(note.textContent) $('#authScreen .auth-card').appendChild(note);
  } catch {}
  try {
    const r = await api('/api/auth/me');
    if (r.ok) { state.user = (await r.json()).user; hideAuth(); await onAuthed(); }
    else authFail();
  } catch { authFail(); }
})();
})();
