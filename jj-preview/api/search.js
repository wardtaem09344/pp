// بحث حقيقي في الإنترنت من الخادم: عدة محركات بالتوازي دون انتظار الأبطأ.
// POST { query } أو GET ?q=  →  { results:[{title,url,content,date,prov}] }
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

const clean = (s) =>
  String(s || '')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#0?39;|&#x27;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (m, n) => String.fromCharCode(+n))
    .replace(/\s+/g, ' ').trim();

async function get(url, ms, headers) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': UA, 'Accept-Language': 'ar,en;q=0.8', ...(headers || {}) },
      signal: ac.signal,
      redirect: 'follow',
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.text();
  } finally { clearTimeout(t); }
}

async function ddg(q) {
  const h = await get('https://html.duckduckgo.com/html/?q=' + encodeURIComponent(q), 4500);
  const out = [];
  for (const b of h.split('class="result__a"').slice(1)) {
    const m = /href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/.exec(b);
    if (!m) continue;
    let u = m[1].replace(/&amp;/g, '&');
    const mm = /uddg=([^&]+)/.exec(u);
    if (mm) u = decodeURIComponent(mm[1]);
    else if (u.startsWith('//')) u = 'https:' + u;
    if (!/^https?:\/\//.test(u) || /duckduckgo\.com\/(y\.js|l\/)/.test(u)) continue;
    const sn = /class="result__snippet"[^>]*>([\s\S]*?)<\/a>/.exec(b);
    out.push({ title: clean(m[2]), url: u, content: clean(sn && sn[1]), date: '' });
  }
  return out;
}

async function bing(q) {
  const h = await get('https://www.bing.com/search?count=10&setlang=ar&q=' + encodeURIComponent(q), 4500);
  const out = [];
  for (const b of h.split('<li class="b_algo"').slice(1)) {
    const m = /<h2[^>]*><a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/.exec(b);
    if (!m) continue;
    let u = m[1].replace(/&amp;/g, '&');
    const ck = /[?&]u=a1([^&]+)/.exec(u);
    if (ck) { try { u = Buffer.from(ck[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'); } catch {} }
    if (!/^https?:\/\//.test(u)) continue;
    const sn = /<p[^>]*>([\s\S]*?)<\/p>/.exec(b);
    out.push({ title: clean(m[2]), url: u, content: clean(sn && sn[1]), date: '' });
  }
  return out;
}

async function wiki(q) {
  const langs = /[؀-ۿ]/.test(q) ? ['ar', 'en'] : ['en', 'ar'];
  const parts = await Promise.all(langs.map(async (l) => {
    try {
      const t = await get(
        `https://${l}.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&generator=search&gsrsearch=${encodeURIComponent(q)}&gsrlimit=3&prop=extracts|info&exintro=1&explaintext=1&exchars=500&exlimit=max&inprop=url`,
        4000
      );
      const j = JSON.parse(t);
      return (j.query?.pages || []).sort((a, b) => a.index - b.index)
        .map((p) => ({ title: p.title, url: p.fullurl, content: (p.extract || '').trim(), date: '' }));
    } catch { return []; }
  }));
  return parts.flat();
}

async function gdelt(q) {
  const t = await get(
    `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(q)}&mode=ArtList&maxrecords=8&format=json&sort=DateDesc&timespan=14d`,
    4000
  );
  const j = JSON.parse(t);
  return (j.articles || []).map((x) => {
    const d = /^(\d{4})(\d{2})(\d{2})/.exec(x.seendate || '');
    return { title: x.title, url: x.url, content: '', date: d ? `${d[1]}/${d[2]}/${d[3]}` : '' };
  });
}

async function bingNews(q) {
  const h = await get('https://www.bing.com/news/search?format=rss&setlang=ar&q=' + encodeURIComponent(q), 4500);
  const out = [];
  for (const b of h.split('<item>').slice(1, 11)) {
    const tag = (n) => { const m = new RegExp('<' + n + '>([\\s\\S]*?)</' + n + '>').exec(b); return m ? clean(m[1].replace(/<!\\[CDATA\\[|\\]\\]>/g, '')) : ''; };
    let u = tag('link').replace(/&amp;/g, '&');
    const mm = /[?&]url=([^&]+)/.exec(u);
    if (mm) { try { u = decodeURIComponent(mm[1]); } catch {} }
    if (!/^https?:\/\//.test(u)) continue;
    const d = new Date(tag('pubDate'));
    out.push({ title: tag('title'), url: u, content: tag('description'), date: isNaN(d) ? '' : d.toISOString().slice(0, 10).replace(/-/g, '/') });
  }
  return out;
}

// اختياري: ضع TAVILY_API_KEY في متغيرات بيئة Vercel لإضافة Tavily (نتائج بمحتوى جاهز)
async function tavily(q) {
  const key = process.env.TAVILY_API_KEY;
  if (!key) return [];
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 5000);
  try {
    const r = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
      body: JSON.stringify({ query: q, max_results: 8, search_depth: 'basic' }),
      signal: ac.signal,
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json();
    return (j.results || []).map((x) => ({ title: x.title, url: x.url, content: x.content || '', date: (x.published_date || '').slice(0, 10).replace(/-/g, '/') }));
  } finally { clearTimeout(t); }
}

const PROVS = [['Tavily', tavily], ['Bing', bing], ['BingNews', bingNews], ['DuckDuckGo', ddg], ['Wikipedia', wiki], ['GDELT', gdelt]];

module.exports = async (req, res) => {

  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch { b = null; } }
  const q = String((b && b.query) || (req.query && req.query.q) || '').replace(/\s+/g, ' ').trim().slice(0, 200);
  if (!q) return res.status(400).json({ error: 'عبارة البحث فارغة' });

  const bag = [];
  const report = [];
  await new Promise((resolve) => {
    let pend = PROVS.length, grace = null, cap = null, over = false;
    const end = () => { if (over) return; over = true; clearTimeout(grace); clearTimeout(cap); resolve(); };
    cap = setTimeout(end, 5500);
    PROVS.forEach(([name, fn], i) => {
      fn(q)
        .then((v) => { if (!over) { report.push({ name, ok: true, count: v.length }); v.forEach((x) => bag.push({ ...x, prov: name, rank: i })); } })
        .catch((e) => { if (!over) report.push({ name, ok: false, error: e && e.message }); })
        .finally(() => {
          if (--pend === 0) end();
          else if (bag.length >= 5 && !grace) grace = setTimeout(end, 700); // لا ننتظر أبطأ محرك
        });
    });
  });

  const seen = new Set();
  // تناوب بين المصادر (الأول من كل مصدر ثم الثاني...) حتى تظهر الأخبار الحديثة في أول النتائج
  const pos = {};
  bag.forEach((x) => { x.pos = pos[x.prov] = (pos[x.prov] || 0) + 1; });
  const results = bag.slice().sort((a, b) => a.pos - b.pos || a.rank - b.rank).filter((x) => {
    if (!x.url || !x.title) return false;
    const k = x.url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  }).slice(0, 24);

  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({ query: q, results, report });
};
