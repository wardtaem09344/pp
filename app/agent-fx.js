/* Agent-mode backdrop: animated, colourful code that types itself out and reacts to clicks, touches and typing.
   Public API: window.AgentFX.set(true|false). Everything is inert (no timers, no listeners doing work) while off. */
(function () {
  'use strict';
  const canvas = document.getElementById('codeBg');
  if (!canvas || !canvas.getContext) { window.AgentFX = { set() {} }; return; }
  canvas.setAttribute('dir', 'ltr');
  const ctx = canvas.getContext('2d');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const SNIPPETS = [
    'const agent = await run({ task, tools: ["search", "files", "shell"] });',
    'for (const step of plan) { await execute(step); }',
    'def build(path): return open(path).read().strip()',
    'if (result.code !== 0) { retry(result.stderr); }',
    'import { diff } from "./lib/diff.js";',
    'fetch("/api/agent/files").then(r => r.json())',
    '<div class="card"><h1>Hello</h1></div>',
    'git commit -m "feat: agent edits files"',
    'SELECT id, title FROM chats ORDER BY updated DESC;',
    'const sum = (a, b) => a + b; // 42',
    'while (!done) { think(); act(); observe(); }',
    'export default function App() { return <Chat mode="agent" />; }',
    'npm install express && node server.js',
    '.glow { box-shadow: 0 0 24px #6c71ff; }',
    'try { await fs.writeFile(file, text); } catch (e) { log(e); }',
    'class Planner { next(state) { return this.model.ask(state); } }',
    'python3 main.py --input data.csv --out report.md',
    'let tokens = text.split(/\\s+/).map(w => w.length);',
    'return files.filter(f => f.changed).map(f => f.path);',
    'async function main() { await agent.start(); }',
    '#!/usr/bin/env bash\nset -e',
    'patch(file, { search: "old", replace: "new" });',
    'console.log("done", Date.now());',
    'const [a, b] = await Promise.all([load(1), load(2)]);',
  ].flatMap(s => s.split('\n'));
  const KW = /^(const|let|var|function|return|if|else|for|while|await|async|import|from|export|default|class|def|try|catch|new|SELECT|FROM|ORDER|BY|git|npm|node|python3|set)$/;

  let on = false, raf = 0, last = 0, W = 0, H = 0, dpr = 1, charW = 8, rowH = 18, fontPx = 13;
  let hue = 220, energy = 0, lines = [], ripples = [], ptr = null, spawnAcc = 0, dark = false, ro = null;

  const rand = (a, b) => a + Math.random() * (b - a);
  const isDark = () => document.documentElement.classList.contains('dark');
  function tokenize(text) {
    const out = []; const re = /("[^"]*"|'[^']*'|`[^`]*`|\/\/.*$|#.*$|\b\d+\b|[A-Za-z_$][\w$]*|\s+|.)/g; let m;
    while ((m = re.exec(text))) {
      const tk = m[0]; let k = 'p';
      if (/^["'`]/.test(tk)) k = 's'; else if (/^(\/\/|#)/.test(tk) && tk.length > 1) k = 'c'; else if (/^\d+$/.test(tk)) k = 'n'; else if (KW.test(tk)) k = 'k'; else if (/^[A-Za-z_$]/.test(tk)) k = 'i'; else if (/^\s+$/.test(tk)) k = 'w';
      out.push([tk, k]);
    }
    return out;
  }
  const KIND_HUE = { k: 280, s: 130, n: 30, c: 200, i: 215, p: 240, w: 0 };
  function resize() {
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = Math.max(1, Math.round(r.width)); H = Math.max(1, Math.round(r.height));
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    fontPx = W < 600 ? 12 : 13; rowH = fontPx + 6;
    ctx.font = fontPx + 'px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'; ctx.direction = 'ltr'; ctx.textAlign = 'left';
    charW = ctx.measureText('M').width || 8;
  }
  function spawn(x, y, fast) {
    const text = SNIPPETS[(Math.random() * SNIPPETS.length) | 0];
    const maxLines = W < 600 ? 46 : 84;
    if (lines.length >= maxLines) lines.shift();
    const width = text.length * charW;
    lines.push({
      x: x != null ? Math.max(8, Math.min(W - width - 8, x - width / 2)) : rand(-width * 0.2, Math.max(8, W - width * 0.8)),
      y: y != null ? y : rand(0, H + 40),
      text, tokens: tokenize(text), age: 0, ttl: rand(5, 11), cps: fast ? rand(60, 110) : rand(14, 34),
      vy: -rand(6, 22), off: rand(0, 140),
    });
  }
  function boostAt(x, y) {
    let b = 0;
    for (const rp of ripples) {
      const d = Math.hypot(x - rp.x, y - rp.y), ring = rp.r;
      const k = Math.exp(-Math.pow(d - ring, 2) / (2 * 70 * 70)) * (1 - rp.t / rp.life);
      if (k > b) b = k;
    }
    if (ptr) { const d = Math.hypot(x - ptr.x, y - ptr.y); if (d < 120) b = Math.max(b, (1 - d / 120) * 0.6); }
    return b;
  }
  function frame(ts) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (ts - (last || ts)) / 1000); last = ts;
    energy = Math.max(0, energy - dt * 1.2);
    hue = (hue + dt * (14 + energy * 40)) % 360;
    const speed = 1 + Math.min(energy, 6) * 0.45;
    spawnAcc += dt * (5 + energy * 9);
    while (spawnAcc >= 1) { spawnAcc -= 1; spawn(null, rand(0, H), energy > 0.5); }
    ctx.clearRect(0, 0, W, H);
    ctx.font = fontPx + 'px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'; ctx.direction = 'ltr'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    for (const rp of ripples) { rp.t += dt; rp.r += dt * 520; }
    ripples = ripples.filter(r => r.t < r.life);
    const sat = dark ? 85 : 78, lig = dark ? 66 : 42;
    for (let i = lines.length - 1; i >= 0; i--) {
      const L = lines[i]; L.age += dt * speed; L.y += L.vy * dt * speed;
      if (L.age > L.ttl || L.y < -rowH) { lines.splice(i, 1); continue; }
      const fadeIn = Math.min(1, L.age / 0.5), fadeOut = Math.min(1, (L.ttl - L.age) / 1.6);
      const bst = boostAt(L.x + (L.text.length * charW) / 2, L.y);
      const a = Math.min(1, (dark ? 0.5 : 0.34) * fadeIn * fadeOut + bst * 0.75);
      if (a < 0.02) continue;
      const typed = Math.min(L.text.length, Math.floor(L.age * L.cps * (1 + bst * 2)));
      const jx = bst > 0.35 ? (Math.random() - 0.5) * 2.2 * bst : 0;
      ctx.globalAlpha = a;
      if (bst > 0.3) { ctx.shadowBlur = 10 * bst; } else if (ctx.shadowBlur) ctx.shadowBlur = 0;
      let cx = L.x + jx, n = 0;
      for (const [tk, k] of L.tokens) {
        if (n >= typed) break;
        const part = tk.length > typed - n ? tk.slice(0, typed - n) : tk;
        if (k !== 'w') {
          const h = (hue + L.off + KIND_HUE[k]) % 360;
          const col = `hsl(${h | 0} ${sat}% ${lig + (bst > 0.3 ? 8 : 0)}%)`;
          ctx.fillStyle = col; if (bst > 0.3) ctx.shadowColor = col;
          ctx.fillText(part, cx, L.y);
        }
        cx += part.length * charW; n += part.length;
      }
      /* blinking caret while the line is still being typed */
      if (typed < L.text.length && ((ts / 300) | 0) % 2 === 0) { ctx.shadowBlur = 0; ctx.fillStyle = `hsl(${hue | 0} 90% ${lig}%)`; ctx.fillRect(cx + 1, L.y + 1, 2, fontPx); }
    }
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
  }
  function drawStatic() {
    resize(); ctx.clearRect(0, 0, W, H); lines = [];
    const n = W < 600 ? 22 : 40;
    for (let i = 0; i < n; i++) { spawn(null, rand(0, H)); const L = lines[lines.length - 1]; L.age = 99; L.ttl = 999; }
    ctx.font = fontPx + 'px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'; ctx.direction = 'ltr'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    const sat = dark ? 85 : 78, lig = dark ? 66 : 42;
    for (const L of lines) { ctx.globalAlpha = 0.3; let cx = L.x; for (const [tk, k] of L.tokens) { if (k !== 'w') { ctx.fillStyle = `hsl(${((hue + L.off + KIND_HUE[k]) % 360) | 0} ${sat}% ${lig}%)`; ctx.fillText(tk, cx, L.y); } cx += tk.length * charW; } }
    ctx.globalAlpha = 1; lines = [];
  }
  function local(e) { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  function poke(x, y, power) {
    ripples.push({ x, y, r: 0, t: 0, life: 1.1 });
    energy = Math.min(8, energy + power);
    for (let i = 0; i < 4; i++) spawn(x + rand(-90, 90), y + rand(-30, 50), true);
  }
  function onDown(e) {
    if (!on || reduce.matches) return;
    if (e.target.closest && e.target.closest('.popover,.modal,.admin-view')) return;
    const p = local(e); if (p.x < 0 || p.y < 0 || p.x > W || p.y > H) return;
    poke(p.x, p.y, 2.2);
  }
  function onMove(e) { if (!on || reduce.matches) return; ptr = local(e); }
  function onLeave() { ptr = null; }
  function onType() {
    if (!on || reduce.matches) return;
    const box = document.getElementById('composer'); const r = box ? box.getBoundingClientRect() : null; const cr = canvas.getBoundingClientRect();
    energy = Math.min(8, energy + 0.9);
    const cx = r ? r.left - cr.left + r.width * Math.random() : W / 2, cy = r ? r.top - cr.top + (Math.random() - 0.5) * 20 : H / 2;
    ripples.push({ x: cx, y: cy, r: 0, t: 0, life: 0.8 });
    spawn(cx + rand(-120, 120), cy - rand(10, 120), true);
  }
  function start() {
    dark = isDark(); resize();
    if (reduce.matches) { drawStatic(); return; }
    if (raf) return; last = 0;
    if (!lines.length) for (let i = 0; i < (W < 600 ? 14 : 30); i++) { spawn(null, rand(0, H)); const L = lines[lines.length - 1]; L.age = rand(0, L.ttl * 0.6); }
    raf = requestAnimationFrame(frame);
  }
  function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; setTimeout(() => { if (!on) ctx.clearRect(0, 0, canvas.width, canvas.height); }, 600); }

  document.addEventListener('pointerdown', onDown, { passive: true });
  document.addEventListener('pointermove', onMove, { passive: true });
  document.documentElement.addEventListener('mouseleave', onLeave);
  const inp = document.getElementById('input'); if (inp) { inp.addEventListener('input', onType); inp.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { if (on && !reduce.matches) poke(W / 2, H - 120, 3); } }); }
  document.addEventListener('visibilitychange', () => { if (!on) return; if (document.hidden) { cancelAnimationFrame(raf); raf = 0; } else start(); });
  new MutationObserver(() => { dark = isDark(); if (on && reduce.matches) drawStatic(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  if (window.ResizeObserver) { ro = new ResizeObserver(() => { if (on) { resize(); if (reduce.matches) drawStatic(); } }); ro.observe(canvas); }

  window.AgentFX = {
    set(v) { v = !!v; if (v === on) return; on = v; if (on) start(); else stop(); },
    poke(x, y, p) { if (on && !reduce.matches) poke(x, y, p || 2); },
  };
})();
