// فتح صفحة ويب فعليًا وقراءة نصها (مقالات، مجلات، صفحات كاملة).
// POST { url, max? }  →  { title, url, text }
const net = require('net');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

function blocked(u) {
  let x;
  try { x = new URL(u); } catch { return true; }
  if (!/^https?:$/.test(x.protocol)) return true;
  const h = x.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal')) return true;
  if (net.isIP(h) && (/^(127\.|10\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(h) || h === '::1' || /^(fc|fd|fe80)/i.test(h))) return true;
  return false;
}

const ent = (s) =>
  s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#0?39;|&#x27;|&apos;/g, "'").replace(/&nbsp;/g, ' ').replace(/&laquo;/g, '«').replace(/&raquo;/g, '»')
    .replace(/&#(\d+);/g, (m, n) => { try { return String.fromCodePoint(+n); } catch { return ' '; } });

function extract(html) {
  const title = ent(((/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html) || [])[1] || '').replace(/\s+/g, ' ').trim());
  const h = html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|noscript|svg|iframe|template|form|nav|footer|aside|button|select)\b[\s\S]*?<\/\1>/gi, ' ');
  const pick = (tag) => { const m = new RegExp('<' + tag + '\\b[^>]*>([\\s\\S]*?)</' + tag + '>', 'i').exec(h); return m ? m[1] : ''; };
  let body = pick('article');
  if (body.length < 800) body = pick('main');
  if (body.length < 800) { const m = /<body[^>]*>([\s\S]*)<\/body>/i.exec(h); body = m ? m[1] : h; }
  const text = body
    .replace(/<\/(p|div|li|h[1-6]|tr|section|blockquote|pre|table|ul|ol)>|<br\s*\/?>/gi, '\n')
    .replace(/<(?:[^>"']|"[^"]*"|'[^']*')*>/g, ' ') // يتجاوز > داخل قيم الخصائص
    .split('\n')
    .map((l) => ent(l).replace(/\s+/g, ' ').trim())
    .filter((l) => l.length >= 25 && (l.match(/[{}\[\]\\"|]/g) || []).length / l.length < 0.06)
    .join('\n');
  return { title, text };
}

async function fetchText(url, ms) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.5', 'Accept-Language': 'ar,en;q=0.8' },
      signal: ac.signal,
      redirect: 'follow',
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const ct = r.headers.get('content-type') || '';
    if (/pdf|image\/|video\/|audio\/|zip|octet-stream/i.test(ct)) throw new Error('نوع غير نصي: ' + ct.split(';')[0]);
    const buf = await r.arrayBuffer();
    const cut = buf.slice(0, 2500000);
    let cs = (/charset=([\w-]+)/i.exec(ct) || [])[1];
    let html;
    try { html = new TextDecoder(cs || 'utf-8').decode(cut); } catch { html = new TextDecoder('utf-8').decode(cut); }
    if (!cs) {
      const m = /<meta[^>]+charset=["']?([\w-]+)/i.exec(html.slice(0, 3000));
      if (m && !/utf-?8/i.test(m[1])) { try { html = new TextDecoder(m[1]).decode(cut); } catch {} }
    }
    return { html, plain: /text\/plain/i.test(ct) };
  } finally { clearTimeout(t); }
}

module.exports = async (req, res) => {

  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch { b = null; } }
  const url = String((b && b.url) || (req.query && req.query.url) || '').trim();
  const max = Math.max(500, Math.min(20000, +((b && b.max) || 6000) || 6000));
  if (!url || blocked(url)) return res.status(400).json({ error: 'رابط غير صالح' });

  res.setHeader('Cache-Control', 'no-store');
  let title = '', text = '', err = '';
  try {
    const { html, plain } = await fetchText(url, 7000);
    if (plain) text = html.trim();
    else ({ title, text } = extract(html));
  } catch (e) { err = (e && e.message) || 'فشل'; }

  // الصفحة محجوبة أو فارغة (تعتمد على جافاسكربت أو تمنع الخوادم): جرّب قارئًا بديلًا
  if (text.length < 300) {
    try {
      const { html } = await fetchText('https://r.jina.ai/' + url, 8000);
      if (html.trim().length > text.length) { text = html.trim(); err = ''; }
    } catch (e) { err = err || (e && e.message) || 'فشل'; }
  }

  if (/Just a moment|Performing security verification|Attention Required|Enable JavaScript and cookies|Verify you are human|CAPTCHA/i.test(text.slice(0, 700)) && text.length < 2500) {
    text = ''; err = 'الموقع يحجب الزوار الآليين (صفحة تحقق)';
  }
  if (!text) return res.status(200).json({ url, error: err || 'صفحة فارغة' });
  res.status(200).json({ url, title, text: text.slice(0, max) });
};
