/* =====================================================================
   test-stories.js — STORIES (iOS 26 qatlami) sinovi
   ---------------------------------------------------------------------
   1) Worker /media: Telegram doim `application/octet-stream` qaytaradi va
      file_path ko'pincha kengaytmasiz. Ilgari video shunday ketardi (iOS
      Safari uni ba'zan o'ynatmasdi). Endi: ishora (t=v), "sehrli" baytlar,
      keyingi Range uchun eslab qolish; muvaffaqiyatli javob — bir yillik
      `immutable` kesh, xato — `no-store`.
   2) MP4 "faststart" (index.html dagi HAQIQIY funksiya): `moov` boshiga
      ko'chadi, har bir chunk offset AYNAN o'sha baytlarga ko'rsatadi,
      ikkinchi o'tish hech narsa o'zgartirmaydi, tanilmagan fayl — tegilmaydi.
   3) Integratsiya: tarix (Telegram «Orqaga») tarmoqlari, `_key` saqlanishi,
      halqalar poygasi tuzatilgani, composer faststart'ni chaqirishi,
      Firebase qoidalari (faqat egasi yozadi, faqat admin o'qiydi).
   Ishga tushirish: node .github/test-stories.js
   ===================================================================== */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
let passed = 0, failed = 0;
const fails = [];
function ok(c, m) { if (c) passed++; else { failed++; fails.push(m); console.error('  ❌ ' + m); } }

// ---------------------------------------------------------------------
//  Soxta Telegram (getFile + fayl serveri, Range bilan)
// ---------------------------------------------------------------------
const BOT_TOKEN = '123:TEST_TOKEN_FOR_STORIES';
const FILES = {};          // file_id -> { path, bytes }
let getFileCalls = 0;
function mp4Bytes(size) {
  const b = new Uint8Array(size);
  b.set([0, 0, 0, 0x18], 0); b.set(Buffer.from('ftypmp42'), 4);
  for (let i = 24; i < size; i++) b[i] = i % 251;
  return b;
}
globalThis.fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input.url;
  const opts = init || {};
  if (url.startsWith('https://api.telegram.org/bot' + BOT_TOKEN + '/getFile')) {
    getFileCalls++;
    const id = new URL(url).searchParams.get('file_id');
    const f = FILES[id];
    return new Response(JSON.stringify(f ? { ok: true, result: { file_path: f.path } } : { ok: false }), { status: 200 });
  }
  const pre = 'https://api.telegram.org/file/bot' + BOT_TOKEN + '/';
  if (url.startsWith(pre)) {
    const p = url.slice(pre.length);
    const f = Object.values(FILES).find((x) => x.path === p);
    if (!f) return new Response('nf', { status: 404 });
    const h = new Headers(opts.headers || {});
    const range = h.get('Range');
    if (range) {
      const m = /^bytes=(\d+)-(\d*)$/.exec(range);
      const s = Number(m[1]), e = m[2] ? Math.min(Number(m[2]), f.bytes.length - 1) : f.bytes.length - 1;
      return new Response(f.bytes.slice(s, e + 1), { status: 206, headers: { 'Content-Type': 'application/octet-stream', 'Content-Range': 'bytes ' + s + '-' + e + '/' + f.bytes.length, 'Content-Length': String(e - s + 1) } });
    }
    return new Response(f.bytes, { status: 200, headers: { 'Content-Type': 'application/octet-stream', 'Content-Length': String(f.bytes.length) } });
  }
  throw new Error('kutilmagan fetch: ' + url);
};

async function media(worker, env, q, range) {
  const req = new Request('https://worker.test/media?' + q, { headers: range ? { Range: range } : {} });
  const res = await worker.fetch(req, env, undefined);
  const body = new Uint8Array(await res.arrayBuffer());
  return { status: res.status, ct: res.headers.get('Content-Type'), cc: res.headers.get('Cache-Control'), cr: res.headers.get('Content-Range'), body };
}

// ---------------------------------------------------------------------
//  MP4 sintetik fayl: ftyp + mdat + moov(trak(mdia(minf(stbl(stco + co64)))))
// ---------------------------------------------------------------------
function box(type, ...parts) {
  const len = 8 + parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(len);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, len); out.set(Buffer.from(type, 'latin1'), 4);
  let o = 8; for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}
function u32s(...v) { const b = new Uint8Array(v.length * 4); const dv = new DataView(b.buffer); v.forEach((x, i) => dv.setUint32(i * 4, x)); return b; }
function makeMp4(moovFirst) {
  const ftyp = box('ftyp', Buffer.from('isom'), u32s(512), Buffer.from('isomiso2mp41'));
  const payload = new Uint8Array(4000);
  for (let i = 0; i < payload.length; i++) payload[i] = (i * 7 + 3) % 256;
  const mdat = box('mdat', payload);
  const chunkRel = [0, 1000, 2500];            // mdat ichidagi joylar
  const build = (mdatStart) => {
    const offs = chunkRel.map((r) => mdatStart + 8 + r);
    const stco = box('stco', u32s(0, offs.length, ...offs));
    const hi = new Uint8Array(16); const dv = new DataView(hi.buffer);
    dv.setUint32(0, 0); dv.setUint32(4, offs[1]); dv.setUint32(8, 0); dv.setUint32(12, offs[2]);
    const co64 = box('co64', u32s(0, 2), hi);
    return box('moov', box('mvhd', new Uint8Array(20)), box('trak', box('mdia', box('minf', box('stbl', stco))), box('mdia', box('minf', box('stbl', co64)))));
  };
  if (moovFirst) {
    const probe = build(0);
    const moov = build(ftyp.length + probe.length);
    return Buffer.concat([ftyp, moov, mdat]);
  }
  const moov = build(ftyp.length);
  return Buffer.concat([ftyp, mdat, moov]);
}
function offsetsOf(b) {
  const out = [];
  const walk = (s, e) => {
    let o = s;
    while (o + 8 <= e) {
      const dv = new DataView(b.buffer, b.byteOffset);
      const n = dv.getUint32(o), t = String.fromCharCode(b[o + 4], b[o + 5], b[o + 6], b[o + 7]);
      if (t === 'stco') { const c = dv.getUint32(o + 12); for (let k = 0; k < c; k++) out.push(dv.getUint32(o + 16 + k * 4)); }
      if (t === 'co64') { const c = dv.getUint32(o + 12); for (let k = 0; k < c; k++) out.push(dv.getUint32(o + 16 + k * 8) * 4294967296 + dv.getUint32(o + 20 + k * 8)); }
      if (['moov', 'trak', 'mdia', 'minf', 'stbl'].includes(t)) walk(o + 8, o + n);
      o += n;
    }
  };
  walk(0, b.length);
  return out;
}
function topOrder(b) { const r = []; let o = 0; while (o + 8 <= b.length) { const n = new DataView(b.buffer, b.byteOffset).getUint32(o); r.push(String.fromCharCode(b[o + 4], b[o + 5], b[o + 6], b[o + 7])); o += n; } return r.join(','); }

async function main() {
  // ===== 1) Worker /media =====
  console.log('▶ 1) Worker /media: Content-Type va kesh');
  const tmp = path.join(os.tmpdir(), 'avto_worker_media_' + process.pid + '.mjs');
  fs.copyFileSync(path.join(ROOT, 'cloudflare-worker.js'), tmp);
  const worker = (await import('file://' + tmp)).default;
  const env = { BOT_TOKEN };
  FILES.vid = { path: 'videos/file_42', bytes: mp4Bytes(200000) };      // kengaytmasiz!
  FILES.img = { path: 'thumbnails/file_7', bytes: Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]) };
  FILES.mov = { path: 'videos/file_9.MOV', bytes: mp4Bytes(5000) };
  let r = await media(worker, env, 'id=vid', 'bytes=0-');
  ok(r.status === 206 && r.ct === 'video/mp4', 'kengaytmasiz video — baytlardan "video/mp4" (' + r.ct + ')');
  ok(r.body.length === 200000 && r.body[30] === 30 % 251, 'tana o\'zgarmay to\'liq uzatildi (tee buzmadi)');
  ok(/max-age=31536000/.test(r.cc) && /immutable/.test(r.cc), 'muvaffaqiyatli javob — bir yillik immutable kesh');
  r = await media(worker, env, 'id=vid', 'bytes=100000-100099');
  ok(r.status === 206 && r.ct === 'video/mp4' && r.body.length === 100, 'fayl o\'rtasidan Range — eslab qolingan tur (' + r.ct + ')');
  ok(r.cr === 'bytes 100000-100099/200000', 'Content-Range uzatiladi');
  r = await media(worker, env, 'id=img');
  ok(r.ct === 'image/jpeg', 'muqova (JPEG) — "image/jpeg" (' + r.ct + ')');
  FILES.vid2 = { path: 'videos/file_43', bytes: mp4Bytes(1000) };
  r = await media(worker, env, 'id=vid2&t=v', 'bytes=500-');
  ok(r.ct === 'video/mp4', 'ilova ishorasi t=v — o\'rtadan boshlangan Range ham video/mp4');
  r = await media(worker, env, 'id=mov', 'bytes=0-');
  ok(r.ct === 'video/quicktime', '.MOV kengaytmasi — video/quicktime (avvalgidek)');
  r = await media(worker, env, 'id=yoq');
  ok(r.status === 404, 'noma\'lum file_id — 404');
  const before = getFileCalls;
  await media(worker, env, 'id=vid', 'bytes=0-99');
  ok(getFileCalls === before, 'file_path keshlangan — getFile qayta chaqirilmadi');
  try { fs.unlinkSync(tmp); } catch (_) {}

  // ===== 2) MP4 faststart (index.html dagi haqiqiy funksiya) =====
  console.log('▶ 2) MP4 faststart');
  const m = HTML.match(/function a1FastStartBytes\(b\) \{[\s\S]*?\n    \}\n/);
  ok(!!m, 'a1FastStartBytes index.html da bor');
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext((m ? m[0] : '') + '\nthis.f = a1FastStartBytes;', ctx);
  const f = ctx.f;
  const slow = new Uint8Array(makeMp4(false));
  ok(topOrder(slow) === 'ftyp,mdat,moov', 'sinov fayli: indeks oxirida (' + topOrder(slow) + ')');
  const fast = f(slow);
  ok(fast && topOrder(fast) === 'ftyp,moov,mdat', 'faststart: moov boshida (' + (fast && topOrder(fast)) + ')');
  ok(fast && fast.length === slow.length, 'hajm o\'zgarmadi (qayta kodlash yo\'q)');
  const a = offsetsOf(slow), b = fast ? offsetsOf(fast) : [];
  let same = a.length === b.length && a.length === 5;
  for (let i = 0; same && i < a.length; i++) for (let j = 0; j < 12; j++) if (slow[a[i] + j] !== fast[b[i] + j]) { same = false; break; }
  ok(same, 'har bir stco/co64 offset AYNAN o\'sha baytlarga ko\'rsatadi (' + a.length + ' ta)');
  ok(fast && f(fast) === null, 'ikkinchi o\'tish — o\'zgarish yo\'q (allaqachon tez)');
  ok(f(new Uint8Array(makeMp4(true))) === null, 'boshidanoq faststart fayl — tegilmaydi');
  ok(f(Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8, 9])) === null, 'tanilmagan fayl — tegilmaydi (asl yuklanadi)');
  const frag = Buffer.concat([box('ftyp', Buffer.from('iso5')), box('moof', new Uint8Array(8)), box('mdat', new Uint8Array(8)), box('moov', new Uint8Array(8))]);
  ok(f(new Uint8Array(frag)) === null, 'fragmentli (moof) fayl — tegilmaydi');

  // ===== 3) Integratsiya =====
  console.log('▶ 3) integratsiya');
  ok(/current === '__story__'/.test(HTML) && /_a1svHideFromHistory/.test(HTML), 'Telegram «Orqaga» storisni yopadi (popstate tarmog\'i)');
  ok(/current === '__storyins__'/.test(HTML) && /_a1svInsHideFromHistory/.test(HTML), '«Orqaga» avval statistika oynasini yopadi');
  ok(/Object\.assign\(\{\}, node\[k\], \{ _key: k \}\)/.test(HTML), 'stories tinglovchisi Firebase kalitini (_key) saqlaydi');
  ok(/_storySeenEarly\(cat, it\)/.test(HTML), 'halqalar poygasi: erta "ko\'rilgan" tekshiruvi');
  ok(/window\._a1FastStart\(file\)/.test(HTML), 'composer videoni yuklashdan oldin faststart qiladi');
  const layerAt = HTML.indexOf('<script id="a1-stories-26-js">');
  const oldAt = HTML.indexOf('window.startStories = (playlistId, caption) =>');
  ok(layerAt > oldAt && oldAt > 0, 'yangi qatlam eski ko\'ruvchidan KEYIN yuklanadi (startStories almashadi)');
  const layer = HTML.slice(layerAt, HTML.indexOf('</script>', layerAt));
  ok(!/backdrop-filter/.test(layer), 'ko\'ruvchi JS hech qayerda backdrop-filter qo\'ymaydi');
  ok(/tierLow\(\)/.test(layer) && /lowData\(\)/.test(layer), 'zaif telefon / sekin tarmoq tarmoqlari bor');
  const css = HTML.slice(HTML.indexOf('<style id="a1-stories-26">'), HTML.indexOf('</style>', HTML.indexOf('<style id="a1-stories-26">')));
  ok(!/backdrop-filter/.test(css.replace(/\/\*[\s\S]*?\*\//g, '')), 'ko\'ruvchi CSS da backdrop-filter yo\'q (video ustida blur — qotish sababi edi)');
  ok(/html\[data-perf="low"\] #a1sv \.a1sv-bd/.test(css), 'zaif telefonda xira fon (blur) o\'chadi');

  // Firebase qoidalari
  const rules = JSON.parse(fs.readFileSync(path.join(ROOT, 'database.rules.json'), 'utf8').replace(/^\s*\/\/.*$/gm, ''));
  const R = rules.rules;
  const owner = 'auth != null && auth.uid === $uid';
  ok(R.story_views && R.story_views.$sid.$uid['.write'] === owner, 'story_views: faqat egasi yozadi');
  ok(R.story_views && /5105291033/.test(R.story_views['.read']) && !R.story_views.$sid.$uid['.read'], 'story_views: faqat admin o\'qiydi');
  ok(R.story_replies && R.story_replies.$sid.$uid.$rid['.write'] === owner + ' && !data.exists()', 'story_replies: egasi faqat YANGI yozuv qo\'shadi');
  ok(R.story_replies && R.story_replies.$sid.$uid['.read'] === owner, 'story_replies: mijoz o\'z javoblarini o\'qiydi');
  ok(R.story_replies && R.story_replies.$sid.$uid.$rid.$other['.validate'] === false, 'story_replies: ortiqcha maydon rad');
  ok(R.users.$uid.story_seen && R.users.$uid.story_seen['.write'] === owner, 'users/$uid/story_seen: faqat egasi');
  ok(!R.users.$uid['.write'], 'users/$uid darajasida umumiy .write YO\'Q (pul maydonlari himoyada)');

  console.log('\n' + passed + ' ta tekshiruv o\'tdi, ' + failed + ' ta xato');
  if (failed) {
    console.error('\n❌ Stories sinovi MUVAFFAQIYATSIZ:\n - ' + fails.join('\n - '));
    process.exit(1);
  }
  console.log('✅ Stories — toza');
}
main().catch((e) => { console.error(e); process.exit(1); });
