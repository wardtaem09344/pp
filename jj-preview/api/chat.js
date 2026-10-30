// وسيط الدردشة: يمرّر الطلب إلى الخدمة الأصلية بالرمز المحفوظ في connection.js
// ويعيد البث (SSE) إلى المتصفح كما هو. هذا يتجاوز حظر CORS الذي يمنع الاتصال المباشر.
const C = require('../connection.js');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST فقط' });


  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = null; } }
  if (!body || typeof body !== 'object') return res.status(400).json({ error: 'جسم الطلب غير صالح' });

  const headers = {
    'Content-Type': 'application/json',
    Accept: 'text/event-stream',
    'x-app-id': C.appId,
    'x-access-token': C.token,
  };
  if (C.deviceInfo) headers['x-device-info'] = C.deviceInfo;

  const ac = new AbortController();
  res.on('close', () => ac.abort());

  let up;
  try {
    up = await fetch(C.url, { method: 'POST', headers, body: JSON.stringify(body), signal: ac.signal });
  } catch (e) {
    return res.status(502).json({ error: 'تعذّر الوصول للخدمة الأصلية: ' + (e && e.message) });
  }

  res.status(up.status);
  res.setHeader('Content-Type', up.headers.get('content-type') || 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('X-Accel-Buffering', 'no');

  if (!up.body) return res.end(await up.text());
  const reader = up.body.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(Buffer.from(value));
    }
  } catch { /* انقطع الاتصال */ }
  res.end();
};
