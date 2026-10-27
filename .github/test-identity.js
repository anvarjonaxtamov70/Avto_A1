/* =====================================================================
   test-identity.js — YAGONA HISOB va STORIS JAVOBLARI (Worker)
   ---------------------------------------------------------------------
   Haqiqiy cloudflare-worker.js import qilinadi. Firebase RTDB (ETag/412),
   Google OAuth/JWK (Firebase idToken imzosi) va Telegram — SOXTA.
   Qo'riqlanadigan narsalar:
     1) /login-phone: raqam Telegram'ga bog'langan bo'lsa — 3 ta raqamli
        tugma (bittasi to'g'ri) + «Men emasman»; limit; bot bloklangan.
     2) /tg-login-poll: rad etilsa darhol 403 (ilova kutib qolmaydi),
        tasdiqlansa Telegram ID uchun token.
     3) /phone-verify: Telegram imzosi, faqat O'Z raqami, indeks.
     4) /merge-legacy: eski hisobdagi buyurtma (holat mashinasi, admin
        kartochkasi tugmalari, chat), keshbek (amal kalitlari bilan),
        profil, savat — Telegram hisobiga; takror — dublikatsiz; keyin
        qaytarish (bekor) keshbekni TO'G'RI qaytarib oladi.
     5) /session: birlashtirilgan eski sessiya -> Telegram hisobi tokeni;
        eski uid nomidan yangi buyurtma — 409 redirect.
     6) /story-reply + /story-answer: admin har bir mijozga javob bera oladi.
     7) /upload: ilovadagi admin Firebase idToken bilan.
   Ishga tushirish: node .github/test-identity.js
   ===================================================================== */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const nodeCrypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const BOT_TOKEN = '123:TEST_TOKEN_FOR_ORDER_FLOW';
const ADMINS = ['5105291033', '483425630', '5302078'];
const TG = '777000111';        // Telegram mijoz (asosiy hisob)
const TG2 = '777000333';
const LEGACY = 'LegacyAnonUid000000000000001';   // ilovadagi eski hisob
const PROJECT = 'avtoa1shop';
const LIMIT = 50;

let passed = 0, failed = 0;
const fails = [];
function ok(cond, msg) {
  if (cond) passed++;
  else { failed++; fails.push(msg); console.error('  ❌ ' + msg); }
}
function eq(a, b, msg) {
  const A = JSON.stringify(a), B = JSON.stringify(b);
  ok(A === B, msg + '  (kutilgan ' + B + ', chiqdi ' + A + ')');
}

// ---------------------------------------------------------------------
//  SOXTA RTDB (test-order-flow.js dagi bilan bir xil xatti-harakat)
// ---------------------------------------------------------------------
function clone(v) { return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); }
function normalize(v) {
  if (v === null || typeof v !== 'object') return v;
  if (Array.isArray(v)) {
    const o = {};
    v.forEach((x, i) => { if (x !== null && x !== undefined) o[String(i)] = normalize(x); });
    return Object.keys(o).length ? o : null;
  }
  const o = {};
  for (const k of Object.keys(v)) {
    const n = normalize(v[k]);
    if (n !== null && n !== undefined) o[k] = n;
  }
  return Object.keys(o).length ? o : null;
}
function render(v) {
  if (v === null || typeof v !== 'object') return v;
  const keys = Object.keys(v);
  const allInt = keys.length && keys.every((k) => /^(0|[1-9]\d*)$/.test(k));
  if (allInt) {
    const max = Math.max(...keys.map(Number));
    if (max < keys.length * 2) {
      const arr = new Array(max + 1).fill(null);
      keys.forEach((k) => { arr[Number(k)] = render(v[k]); });
      return arr;
    }
  }
  const o = {};
  keys.forEach((k) => { o[k] = render(v[k]); });
  return o;
}
class FakeDB {
  constructor(data) { this.root = normalize(clone(data)) || {}; }
  parts(p) { return String(p).split('/').filter(Boolean); }
  get(p) {
    let n = this.root;
    for (const k of this.parts(p)) { if (!n || typeof n !== 'object') return null; n = n[k]; }
    return n === undefined ? null : n;
  }
  set(p, val) {
    const parts = this.parts(p);
    const v = normalize(clone(val));
    if (!parts.length) { this.root = v || {}; return; }
    let n = this.root;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!n[parts[i]] || typeof n[parts[i]] !== 'object') n[parts[i]] = {};
      n = n[parts[i]];
    }
    const last = parts[parts.length - 1];
    if (v === null || v === undefined) delete n[last]; else n[last] = v;
  }
  etag(p) { return '"' + nodeCrypto.createHash('sha1').update(JSON.stringify(this.get(p))).digest('hex') + '"'; }
  read(p) { return render(clone(this.get(p))); }
}

// ---------------------------------------------------------------------
//  Kalitlar: service account (custom token) va "Google" (idToken imzosi)
// ---------------------------------------------------------------------
const svc = nodeCrypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const google = nodeCrypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const GOOGLE_JWK = Object.assign(google.publicKey.export({ format: 'jwk' }), { kid: 'test-kid-1', alg: 'RS256', use: 'sig' });

function b64url(buf) { return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function idTokenFor(uid, extra) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', kid: 'test-kid-1', typ: 'JWT' }));
  const payload = b64url(JSON.stringify(Object.assign({
    aud: PROJECT, iss: 'https://securetoken.google.com/' + PROJECT, sub: uid, user_id: uid,
    iat: now - 10, exp: now + 3600, auth_time: now - 10,
  }, extra || {})));
  const sig = nodeCrypto.sign('RSA-SHA256', Buffer.from(header + '.' + payload), google.privateKey);
  return header + '.' + payload + '.' + b64url(sig);
}
function decodeCustomToken(t) {
  const p = String(t || '').split('.');
  return p.length === 3 ? JSON.parse(Buffer.from(p[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')) : null;
}

// ---------------------------------------------------------------------
//  SOXTA fetch
// ---------------------------------------------------------------------
const DB_URL = 'https://test-rtdb.example';
let db, tgCalls, tgFail, msgSeq, fetchCount = 0;
function resetWorld(data) { db = new FakeDB(data); tgCalls = []; tgFail = null; msgSeq = 1000; }
function jsonResponse(obj, status, headers) {
  return new Response(JSON.stringify(obj), { status: status || 200, headers: Object.assign({ 'Content-Type': 'application/json' }, headers || {}) });
}
globalThis.fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input.url;
  const opts = init || {};
  const method = String(opts.method || 'GET').toUpperCase();
  fetchCount++;
  if (url.startsWith('https://oauth2.googleapis.com/token')) return jsonResponse({ access_token: 'test-access-token', expires_in: 3600 });
  if (url.startsWith('https://www.googleapis.com/service_accounts/v1/jwk/securetoken')) {
    return jsonResponse({ keys: [GOOGLE_JWK] }, 200, { 'Cache-Control': 'public, max-age=3600' });
  }
  if (url.startsWith('https://api.telegram.org/bot')) {
    const tail = url.slice('https://api.telegram.org/bot'.length);
    const tgMethod = tail.slice(tail.indexOf('/') + 1).split('?')[0];
    let payload = {};
    try { payload = JSON.parse(opts.body || '{}'); } catch (_) {}
    tgCalls.push({ method: tgMethod, payload });
    const f = tgFail && tgFail(tgMethod, payload);
    if (f) return jsonResponse({ ok: false, description: f.description || 'fail' }, f.status || 500);
    return jsonResponse({ ok: true, result: { message_id: ++msgSeq } });
  }
  if (url.startsWith(DB_URL)) {
    const u = new URL(url);
    const p = decodeURIComponent(u.pathname.replace(/\.json$/, ''));
    const h = new Headers(opts.headers || {});
    if (h.get('Authorization') !== 'Bearer test-access-token') return jsonResponse({ error: 'auth' }, 401);
    if (method === 'GET') {
      const headers = {};
      if (h.get('X-Firebase-ETag') === 'true') headers.ETag = db.etag(p);
      return jsonResponse(db.read(p), 200, headers);
    }
    if (method === 'PUT') {
      const im = h.get('If-Match');
      if (im && im !== db.etag(p)) return jsonResponse({ error: 'etag' }, 412);
      const val = JSON.parse(opts.body);
      db.set(p, val);
      return jsonResponse(val);
    }
    if (method === 'PATCH') {
      const val = JSON.parse(opts.body);
      // Haqiqiy RTDB: ko'p yo'lli yangilanishda yo'llar bir-birining ota/bolasi bo'lolmaydi.
      const keys = Object.keys(val).map((k) => (p + '/' + k).split('/').filter(Boolean).join('/'));
      for (const a of keys) for (const b of keys) {
        if (a !== b && b.indexOf(a + '/') === 0) return jsonResponse({ error: 'overlap: ' + a + ' / ' + b }, 400);
      }
      for (const k of Object.keys(val)) db.set(p + '/' + k, val[k]);
      return jsonResponse(val);
    }
    return jsonResponse({ error: 'method' }, 405);
  }
  throw new Error('kutilmagan fetch: ' + url);
};

// ---------------------------------------------------------------------
//  Yordamchilar
// ---------------------------------------------------------------------
function hmac(key, msg) { return nodeCrypto.createHmac('sha256', key).update(msg).digest(); }
function signParams(params) {
  const pairs = [];
  for (const [k, v] of params) pairs.push(k + '=' + v);
  pairs.sort();
  const secret = hmac('WebAppData', BOT_TOKEN);
  params.set('hash', hmac(secret, pairs.join('\n')).toString('hex'));
  return params.toString();
}
function initDataFor(uid, firstName, username) {
  const params = new URLSearchParams();
  params.set('auth_date', String(Math.floor(Date.now() / 1000)));
  params.set('query_id', 'AAH' + uid);
  const user = { id: Number(uid), first_name: firstName || 'Test' };
  if (username) user.username = username;
  params.set('user', JSON.stringify(user));
  return signParams(params);
}
function contactFor(userId, phone, ageSeconds) {
  const params = new URLSearchParams();
  params.set('contact', JSON.stringify({ user_id: Number(userId), phone_number: phone, first_name: 'Ali' }));
  params.set('auth_date', String(Math.floor(Date.now() / 1000) - (ageSeconds || 0)));
  return signParams(params);
}
function botAuth(route, actor, fields) {
  const ts = Math.floor(Date.now() / 1000);
  const key = nodeCrypto.createHash('sha256').update('avto-a1-bot-auth|' + BOT_TOKEN).digest();
  const msg = ['a1bot', route, String(ts), String(actor)].concat(fields.map(String)).join('|');
  return { ts, actor: String(actor), sig: hmac(key, msg).toString('hex') };
}
const sha = (s) => nodeCrypto.createHash('sha256').update(String(s)).digest('hex');
const shortOf = (orderKey) => sha('order-tg|' + orderKey).slice(0, 20);
const nonce = () => nodeCrypto.randomBytes(16).toString('hex');

let worker, env;
async function call(route, body, headers) {
  const req = new Request('https://worker.test' + route, {
    method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json', 'CF-Connecting-IP': '10.0.0.1' }, headers || {}),
    body: JSON.stringify(body),
  });
  fetchCount = 0;
  const res = await worker.fetch(req, env, undefined);
  let data = null;
  try { data = await res.json(); } catch (_) {}
  return { status: res.status, data, fetches: fetchCount };
}
const tgBy = (m) => tgCalls.filter((c) => c.method === m);

function baseData() {
  return {
    products: [
      { id: 1, name: 'Porshen', price: 100000, stock: 5 },
      { id: 3, name: 'Moy filtri', price: 30000, stock: 7 },
    ],
    users: {
      [TG]: { profile: { name: 'Ali', lang: 'uz', username: '@ali_tg' }, wishlist: [1], cart: { '3': 1 } },
      [TG2]: { profile: { name: 'Vali', lang: 'uz' } },
    },
  };
}

async function main() {
  const tmp = path.join(os.tmpdir(), 'avto_worker_identity_' + process.pid + '.mjs');
  fs.copyFileSync(path.join(ROOT, 'cloudflare-worker.js'), tmp);
  worker = (await import('file://' + tmp)).default;
  env = {
    BOT_TOKEN,
    FIREBASE_CLIENT_EMAIL: 'svc@test.iam.gserviceaccount.com',
    FIREBASE_PRIVATE_KEY: svc.privateKey.export({ type: 'pkcs8', format: 'pem' }),
    FIREBASE_DB_URL: DB_URL,
    FIREBASE_PROJECT_ID: PROJECT,
    ADMIN_IDS: ADMINS.join(','),
  };

  // ===== 1) /login-phone =====
  console.log('▶ 1) /login-phone — raqam bo\'yicha kirish');
  resetWorld(baseData());
  let r = await call('/login-phone', { phone: '+998 90 111 22 33', nonce: nonce() });
  eq([r.status, r.data && r.data.method], [200, 'telegram'], 'bog\'lanmagan raqam -> Telegram orqali kirish');
  db.set('phone_pw/998901112233', { uid: LEGACY, at: Date.now() });
  r = await call('/login-phone', { phone: '901112233', nonce: nonce() });
  eq(r.data && r.data.method, 'password', 'parolli hisob bor -> parol bilan');
  db.set('phone_index/998901112233', { uid: TG, at: Date.now(), src: 'bot' });
  const n1 = nonce();
  r = await call('/login-phone', { phone: '+998901112233', nonce: n1 });
  eq([r.status, r.data.method], [200, 'match'], 'Telegram\'ga bog\'langan -> raqamni tanlash');
  const sent = tgBy('sendMessage').pop();
  ok(sent && sent.payload.chat_id === TG, 'xabar AYNAN o\'sha Telegram hisobiga ketdi');
  const kb = sent.payload.reply_markup.inline_keyboard;
  const picks = kb[0].map((b) => b.text);
  eq(picks.length, 3, '3 ta raqam tugmasi');
  ok(new Set(picks).size === 3 && picks.every((c) => /^[1-9]\d$/.test(c)), 'raqamlar turli va 2 xonali');
  ok(picks.indexOf(r.data.code) !== -1, 'ekrandagi raqam tugmalar orasida');
  ok(kb[1][0].callback_data === 'tgl:no:' + n1, '«Men emasman» tugmasi');
  ok(kb.flat().every((b) => Buffer.byteLength(b.callback_data) <= 64), 'callback_data 64 baytdan oshmaydi');
  ok(/\*\*\*/.test(sent.payload.text) && sent.payload.text.indexOf('901112233') === -1, 'xabarda raqam yashirilgan');
  eq(db.read('tg_login_req/' + n1 + '/uid'), TG, 'so\'rov yozildi (server-only)');
  ok(r.fetches <= LIMIT, '/login-phone byudjetda (' + r.fetches + ')');
  r = await call('/login-phone', { phone: '+998901112233', nonce: n1 });
  eq(r.status, 409, 'ayni nonce qayta ishlatilmaydi');
  for (let i = 0; i < 4; i++) await call('/login-phone', { phone: '+998901112233', nonce: nonce() });
  r = await call('/login-phone', { phone: '+998901112233', nonce: nonce() });
  eq(r.status, 429, 'bitta raqamga 15 daqiqada 5 tadan ko\'p so\'rov — 429');
  // Bot bloklangan (403) -> Telegram havolasi orqali
  resetWorld(baseData());
  db.set('phone_index/998905556677', { uid: TG2, at: Date.now() });
  tgFail = (m) => (m === 'sendMessage' ? { status: 403, description: 'Forbidden: bot was blocked by the user' } : null);
  const n2 = nonce();
  r = await call('/login-phone', { phone: '+998905556677', nonce: n2 });
  eq([r.data.method, r.data.reason], ['telegram', 'unreachable'], 'bot bloklangan -> Telegram havolasi');
  tgFail = null;
  // Bloklangan mijoz (alohida uid: Worker blok holatini 30 s keshlaydi)
  db.set('phone_index/998907778899', { uid: '777000444', at: Date.now() });
  db.set('blocked_users/777000444', true);
  r = await call('/login-phone', { phone: '+998907778899', nonce: nonce() });
  eq(r.status, 403, 'bloklangan mijozga kirish so\'rovi yuborilmaydi');
  // IP limiti
  resetWorld(baseData());
  for (let i = 0; i < 20; i++) await call('/login-phone', { phone: '+99890000' + String(1000 + i), nonce: nonce() }, { 'CF-Connecting-IP': '10.9.9.9' });
  r = await call('/login-phone', { phone: '+998900009999', nonce: nonce() }, { 'CF-Connecting-IP': '10.9.9.9' });
  eq(r.status, 429, 'bitta IP dan soatiga 20 tadan ko\'p — 429');

  // ===== 2) /tg-login-poll (raqam bo'yicha) =====
  console.log('▶ 2) /tg-login-poll');
  resetWorld(baseData());
  db.set('phone_index/998901112233', { uid: TG, at: Date.now() });
  const n3 = nonce();
  await call('/login-phone', { phone: '+998901112233', nonce: n3 });
  r = await call('/tg-login-poll', { nonce: n3, match: true });
  eq(r.data, { ok: true, pending: true }, 'tasdiq kutilmoqda');
  db.set('tg_login_req/' + n3 + '/state', 'bad');
  r = await call('/tg-login-poll', { nonce: n3, match: true });
  eq([r.status, r.data.denied, r.data.reason], [403, true, 'bad'], 'noto\'g\'ri raqam tanlandi -> darhol 403');
  const n4 = nonce();
  await call('/login-phone', { phone: '+998901112233', nonce: n4 });
  db.set('tg_login/' + n4, { uid: TG, name: 'Ali', at: Date.now(), phoneVerified: true });   // bot yozadi
  r = await call('/tg-login-poll', { nonce: n4, match: true });
  ok(r.status === 200 && r.data.token && r.data.uid === TG, 'tasdiqlandi -> token');
  eq(decodeCustomToken(r.data.token).uid, TG, 'token AYNAN Telegram ID uchun');
  eq(r.data.phoneVerified, true, 'raqam tasdiqlangani qaytdi');
  eq(db.read('tg_login/' + n4), null, 'kirish yozuvi bir martalik');
  eq(db.read('tg_login_req/' + n4), null, 'so\'rov tozalandi');
  r = await call('/tg-login-poll', { nonce: n4, match: true });
  ok(!r.data.token, 'ikkinchi so\'rov token olmaydi');

  // ===== 3) /phone-verify =====
  console.log('▶ 3) /phone-verify');
  resetWorld(baseData());
  r = await call('/phone-verify', { initData: initDataFor(TG, 'Ali'), contact: contactFor(TG, '998901112233') });
  ok(r.status === 200 && r.data.phone === '+998901112233', 'o\'z raqami tasdiqlandi');
  eq(db.read('phone_index/998901112233/uid'), TG, 'raqam -> Telegram ID indeksi');
  eq(db.read('users/' + TG + '/verify/phone'), '+998901112233', 'users/{uid}/verify');
  eq(db.read('users/' + TG + '/profile/phone'), '+998901112233', 'bo\'sh profil raqami to\'ldirildi');
  eq(r.data.legacy, null, 'eski hisob yo\'q');
  r = await call('/phone-verify', { initData: initDataFor(TG, 'Ali'), contact: contactFor(TG2, '998905556677') });
  eq(r.status, 403, 'boshqa odamning kontakti rad etiladi');
  const forged = contactFor(TG, '998901112233').replace(/hash=[0-9a-f]+/, 'hash=' + '0'.repeat(64));
  r = await call('/phone-verify', { initData: initDataFor(TG, 'Ali'), contact: forged });
  eq(r.status, 401, 'soxta imzo rad etiladi');
  r = await call('/phone-verify', { initData: initDataFor(TG, 'Ali'), contact: contactFor(TG, '998901112233', 7200) });
  eq(r.status, 401, 'eskirgan kontakt rad etiladi');
  db.set('phone_pw/998901112233', { uid: LEGACY, at: Date.now() });
  r = await call('/phone-verify', { initData: initDataFor(TG, 'Ali'), contact: contactFor(TG, '+998 90 111 22 33') });
  eq(r.data.legacy && r.data.legacy.method, 'password', 'ilovada parolli hisob bor -> birlashtirish taklifi');
  r = await call('/phone-verify', { idToken: idTokenFor(LEGACY), contact: contactFor(TG, '998901112233') });
  eq(r.status, 403, 'Telegram\'siz hisob raqam tasdiqlay olmaydi');

  // ===== 4) /session =====
  console.log('▶ 4) /session');
  resetWorld(baseData());
  r = await call('/session', { idToken: idTokenFor(LEGACY, { email: '998901112233@tel.avtoa1.app' }) });
  eq([r.status, r.data.kind, r.data.phone], [200, 'legacy', '+998901112233'], 'parolli eski hisob');
  eq(db.read('phone_pw/998901112233/uid'), LEGACY, 'parolli hisob raqami indekslandi');
  r = await call('/session', { idToken: idTokenFor(TG) });
  eq(r.data.kind, 'telegram', 'Telegram uid sessiyasi');
  r = await call('/session', { idToken: 'buzuq.token.x' });
  eq(r.status, 401, 'buzuq idToken rad etiladi');

  // ===== 5) /merge-legacy — TO'LIQ ko'chirish =====
  console.log('▶ 5) /merge-legacy — eski hisob Telegram hisobiga');
  resetWorld(baseData());
  db.set('users/' + LEGACY + '/profile', { name: 'Ali (ilova)', phone: '+998901112233', address: 'Chilonzor 5' });
  db.set('users/' + LEGACY + '/cart', { '1': 2, '3': 5 });
  db.set('users/' + LEGACY + '/wishlist', [3, 1]);
  db.set('users/' + LEGACY + '/story_seen', { 'reklama__a1': Date.now() - 1000 });
  db.set('users/' + LEGACY + '/my_car', 'Gazel Biznes');
  const legTok = idTokenFor(LEGACY);
  // a) eski hisobdan haqiqiy server buyurtmasi
  r = await call('/order-commit', {
    idToken: legTok, attemptId: 'att_legacy_00001', items: [{ id: '1', size: '', qty: 1 }],
    customer: { name: 'Ali', phone: '+998901112233', address: 'Chilonzor 5' },
    delivery: { method: 'courier', address: 'Chilonzor 5' }, payment: { method: 'Naqd pul (yetkazilganda)' },
  });
  eq(r.status, 201, 'eski hisobdan buyurtma');
  const orderId = r.data.order.id;
  const oldKey = LEGACY + '_' + orderId;
  const newKey = TG + '_' + orderId;
  ok(db.read('order_tg/' + oldKey + '/msgs/' + ADMINS[0]), 'adminlarga kartochka ketdi');
  // b) admin yetkazdi -> eski hisobga keshbek
  for (const st of ['qabul', 'yolda', 'yetkazildi']) {
    r = await call('/order-status', { initData: initDataFor(ADMINS[0], 'Anvar'), uid: LEGACY, orderId, status: st });
    ok(r.status === 200, 'holat ' + st);
  }
  const earnedOld = db.read('loyalty_accounts/' + LEGACY).earned;
  ok(earnedOld === 800, 'eski hisobga keshbek berildi (' + earnedOld + ')');
  // c) eski (server'dan oldingi) buyurtma + chat
  db.set('users/' + LEGACY + '/orders/leg_1', { id: 'OLD-1', total: 50000, status: 'yetkazildi' });
  db.set('order_chats/' + LEGACY + '/' + orderId + '/m1', { sender: 'mijoz', text: 'Qachon keladi?', time: '10:00' });
  tgCalls = [];
  // d) birlashtirish: Telegram initData + eski hisob tokeni
  r = await call('/merge-legacy', { initData: initDataFor(TG, 'Ali'), legacyIdToken: legTok });
  ok(r.status === 200 && r.data.merged === true, 'birlashtirildi');
  eq([r.data.uid, r.data.orders, r.data.cashback], [TG, 2, 800], 'natija: 2 ta buyurtma, 800 so\'m');
  ok(r.fetches <= LIMIT, 'birlashtirish byudjetda (' + r.fetches + ')');
  const moved = db.read('orders/' + newKey);
  ok(moved && moved.uid === TG && moved.mergedFrom === LEGACY, 'markaziy buyurtma yangi kalitda, uid = Telegram ID');
  eq(db.read('orders/' + oldKey), null, 'eski markaziy kalit o\'chdi');
  eq(db.read('order_state/' + newKey + '/current'), 'yetkazildi', 'holat mashinasi ko\'chdi');
  eq(db.read('order_state/' + oldKey), null, 'eski holat yozuvi o\'chdi');
  ok(db.read('order_tg/' + newKey + '/msgs/' + ADMINS[0]), 'admin kartochkalari (tahrirlash uchun) ko\'chdi');
  eq(db.read('order_tg_index/' + shortOf(oldKey) + '/orderKey'), newKey, 'ESKI kartochka tugmasi yangi buyurtmaga ishlaydi');
  eq(db.read('order_tg_index/' + shortOf(newKey) + '/uid'), TG, 'yangi kalit indeksi');
  ok(db.read('users/' + TG + '/orders/' + orderId), 'mijoz proyeksiyasi ko\'chdi');
  ok(db.read('users/' + TG + '/orders/leg_1') || Object.values(db.read('users/' + TG + '/orders') || {}).some((o) => o && o.id === 'OLD-1'), 'eski (legacy) buyurtma ham ko\'chdi');
  eq(db.read('order_chats/' + TG + '/' + orderId + '/m1/text'), 'Qachon keladi?', 'buyurtma chati ko\'chdi');
  eq(db.read('users/' + LEGACY), null, 'eski hisob tuguni o\'chdi');
  const accT = db.read('loyalty_accounts/' + TG);
  eq(accT.earned, 800, 'keshbek Telegram hisobiga qo\'shildi');
  const earnNew = 'earn_' + sha(newKey).slice(0, 36);
  ok(accT.ops[earnNew] && accT.ops[earnNew].amount === 800, 'keshbek amali YANGI buyurtma kaliti bilan');
  ok(accT.ops['merge_' + LEGACY], 'merge amali (idempotentlik)');
  eq(db.read('loyalty_accounts/' + LEGACY), null, 'eski keshbek hisobi o\'chdi');
  eq(db.read('users/' + TG + '/phase2/cashbackTotal'), 800, 'ilovadagi balans proyeksiyasi');
  eq(db.read('users/' + TG + '/profile/name'), 'Ali', 'Telegram profili ustun (ism)');
  eq(db.read('users/' + TG + '/profile/phone'), '+998901112233', 'bo\'sh raqam eski hisobdan');
  eq(db.read('users/' + TG + '/profile/address'), 'Chilonzor 5', 'bo\'sh manzil eski hisobdan');
  // (RTDB raqamli kalitli savatni MASSIV qilib qaytaradi — Worker ikkalasini ham tushunishi shart)
  eq(db.get('users/' + TG + '/cart'), { '1': 2, '3': 1 }, 'savat birlashdi (Telegram hisobidagi miqdor saqlanadi)');
  eq(db.read('users/' + TG + '/wishlist'), [1, 3], 'sevimlilar takrorsiz birlashdi');
  eq(db.read('users/' + TG + '/my_car'), 'Gazel Biznes', 'mening mashinam');
  ok(db.read('users/' + TG + '/story_seen/reklama__a1') > 0, 'ko\'rilgan storislar');
  eq(db.read('uid_redirect/' + LEGACY + '/to'), TG, 'uid_redirect yozildi');
  eq(db.read('account_merges/' + LEGACY + '/orders'), 2, 'birlashtirish jurnali');
  ok(db.read('users/' + TG + '/phase2/notifications/merge_' + LEGACY), 'ilova ichida bildirishnoma');
  ok(tgBy('sendMessage').some((c) => c.payload.chat_id === TG && /birlashtirildi/.test(c.payload.text)), 'mijozga Telegram xabari');
  // e) takroriy so'rov — dublikatsiz
  r = await call('/merge-legacy', { initData: initDataFor(TG, 'Ali'), legacyIdToken: legTok });
  ok(r.status === 200 && r.data.duplicate === true, 'takror -> dublikat (ikki marta qo\'shilmaydi)');
  eq(db.read('loyalty_accounts/' + TG).earned, 800, 'keshbek baribir 800');
  // f) Ko'chgan buyurtmani admin QAYTARADI (yetkazildi -> bekor): keshbek to'g'ri qaytariladi
  const stockBefore = db.read('products/0/stock');
  r = await call('/order-status', { botAuth: botAuth('order-status', ADMINS[0], [TG, orderId, 'bekor_qilingan', '']), uid: TG, orderId, status: 'bekor_qilingan' });
  eq(r.status, 200, 'ko\'chgan buyurtmani bot tugmasi bilan qaytarish');
  const accAfter = db.read('loyalty_accounts/' + TG);
  eq(accAfter.reversed, 800, 'berilgan keshbek qaytarib olindi (amal kaliti mos)');
  eq(db.read('products/0/stock'), stockBefore + 1, 'tovar omborga qaytdi');
  eq(db.read('orders/' + newKey + '/status'), 'bekor_qilingan', 'holat yangilandi');
  // takroriy «yetkazildi» keshbekni ikkinchi marta bermasligini ham tekshiramiz (amal kaliti qayta nomlangan)
  ok(Object.keys(accAfter.ops).filter((k) => k.indexOf('earn_') === 0).length === 1, 'earn amali bitta (ikki marta berilmagan)');
  // g) eski sessiya nomidan yangi buyurtma — 409 redirect; /session — Telegram tokeni
  r = await call('/order-commit', {
    idToken: legTok, attemptId: 'att_legacy_00002', items: [{ id: '3', size: '', qty: 1 }],
    customer: { name: 'Ali' }, delivery: { method: 'pickup' }, payment: { method: 'Naqd pul (yetkazilganda)' },
  });
  eq([r.status, r.data.redirect], [409, true], 'birlashgan eski uid nomidan buyurtma -> 409 redirect');
  r = await call('/session', { idToken: legTok });
  ok(r.data.redirect && r.data.redirect.uid === TG && decodeCustomToken(r.data.redirect.token).uid === TG, '/session -> Telegram hisobi tokeni (boshqa qurilma o\'zi ko\'chadi)');
  // h) boshqa hisobga qayta birlashtirib bo'lmaydi
  r = await call('/merge-legacy', { initData: initDataFor(TG2, 'Vali'), legacyIdToken: legTok });
  eq(r.status, 409, 'boshqa Telegram hisobiga qayta birlashtirib bo\'lmaydi');

  // ===== 6) /merge-legacy — himoya =====
  console.log('▶ 6) /merge-legacy — himoya');
  resetWorld(baseData());
  const leg2 = 'LegacyAnonUid000000000000002';
  db.set('users/' + leg2 + '/profile', { name: 'X' });
  r = await call('/merge-legacy', { initData: initDataFor(TG, 'Ali') });
  eq(r.status, 400, 'legacyIdToken yo\'q -> 400');
  r = await call('/merge-legacy', { idToken: idTokenFor(leg2), legacyIdToken: idTokenFor(leg2) });
  eq(r.status, 403, 'Telegram\'siz hisob boshqa hisobni o\'ziga birlashtira olmaydi');
  r = await call('/merge-legacy', { initData: initDataFor(TG, 'Ali'), legacyIdToken: idTokenFor(TG2) });
  eq(r.status, 400, 'Telegram hisobini «eski» deb birlashtirib bo\'lmaydi');
  r = await call('/merge-legacy', { initData: initDataFor(TG, 'Ali'), from: leg2, to: TG });
  eq(r.status, 403, 'mijoz admin rejimidan foydalana olmaydi');
  db.set('orders/' + leg2 + '_X1', { id: 'X1', uid: leg2, status: 'qabul', total: 1 });
  db.set('order_state/' + leg2 + '_X1', { current: 'qabul', version: 1, pending: { from: 'qabul', target: 'yolda', leaseUntil: Date.now() + 30000 } });
  r = await call('/merge-legacy', { initData: initDataFor(TG, 'Ali'), legacyIdToken: idTokenFor(leg2) });
  eq([r.status, r.data.retryable], [409, true], 'holat o\'zgarishi bajarilayotganda -> 409 (keyinroq)');
  ok(db.read('users/' + leg2), 'rad etilganda hech narsa ko\'chmadi');
  db.set('order_state/' + leg2 + '_X1/pending', null);
  r = await call('/merge-legacy', { from: leg2, to: TG, botAuth: botAuth('merge-legacy', ADMINS[1], [leg2, TG]) });
  ok(r.status === 200 && r.data.merged, 'admin (bot imzosi) birlashtira oladi');
  eq(db.read('orders/' + TG + '_X1/uid'), TG, 'admin birlashtirishida ham buyurtma ko\'chdi');

  // ===== 7) /story-reply + /story-answer =====
  console.log('▶ 7) storis javoblari');
  resetWorld(baseData());
  db.set('users/' + TG + '/verify', { phone: '+998901112233', at: Date.now() });
  tgCalls = [];
  r = await call('/story-reply', { initData: initDataFor(TG, 'Ali', 'ali_tg'), sid: 'reklama__k1', x: 'Narxi qancha?', cap: 'Reklama · 1-storis' });
  ok(r.status === 200 && r.data.rid, 'Telegram mijoz javobi saqlandi');
  const rep = db.read('story_replies/reklama__k1/' + TG + '/' + r.data.rid);
  ok(rep && rep.x === 'Narxi qancha?' && rep.n === 'Ali' && rep.ph === '+998901112233' && rep.pv === 1, 'javobda ism va TASDIQLANGAN raqam');
  const cards = tgBy('sendMessage');
  eq(cards.length, 3, 'barcha adminlarga kartochka');
  const btn = cards[0].payload.reply_markup.inline_keyboard[0];
  ok(/^sra:[0-9a-f]{20}$/.test(btn[0].callback_data), '«✍️ Javob yozish» tugmasi');
  ok(btn[1] && btn[1].url === 'https://t.me/ali_tg', 'Telegram username tugmasi');
  ok(/\+998901112233/.test(cards[0].payload.text) && /tg:\/\/user\?id=777000111/.test(cards[0].payload.text), 'kartochkada raqam va mention');
  const short = btn[0].callback_data.slice(4);
  eq(db.read('story_reply_index/' + short + '/uid'), TG, 'javob indeksi');
  // Ilovadagi (Telegram'siz) mijoz
  const appUid = 'AppOnlyUid0000000000000000001';
  db.set('users/' + appUid + '/profile', { name: 'Sardor', phone: '+998935554433' });
  tgCalls = [];
  r = await call('/story-reply', { idToken: idTokenFor(appUid), sid: 'reklama__k1', x: 'Bormi?', via: 'app' });
  ok(r.status === 200, 'ilovadagi mijoz javobi');
  const appCard = tgBy('sendMessage')[0];
  ok(appCard && /\+998935554433/.test(appCard.payload.text) && /Ilova/.test(appCard.payload.text), 'admin raqamni ko\'radi (Telegram\'i yo\'q mijoz ham)');
  const appShort = appCard.payload.reply_markup.inline_keyboard[0][0].callback_data.slice(4);
  r = await call('/story-reply', { idToken: idTokenFor(appUid), sid: 'reklama__k1' });
  eq(r.status, 400, 'bo\'sh javob — 400');
  r = await call('/story-reply', { idToken: idTokenFor(appUid), sid: 'a/b', x: 'x' });
  eq(r.status, 400, 'noto\'g\'ri sid — 400');
  // Admin javobi (bot orqali)
  tgCalls = [];
  const ans = 'Narxi 120 000 so\'m, bor.';
  r = await call('/story-answer', { short, text: ans, botAuth: botAuth('story-answer', ADMINS[0], [short, ans]) });
  ok(r.status === 200 && r.data.telegram === 'sent', 'admin javobi — Telegram mijozga yetdi');
  const thread = db.read('story_replies/reklama__k1/' + TG) || {};
  ok(Object.values(thread).some((x) => x && x.s === 1 && x.x === ans), 'javob storis suhbatida (ilovada ko\'rinadi)');
  ok(db.read('users/' + TG + '/phase2/notifications/sa_' + r.data.id), 'ilova ichida 🔔 bildirishnoma');
  ok(tgBy('sendMessage').some((c) => c.payload.chat_id === TG && c.payload.text.indexOf('120 000') !== -1), 'Telegram xabari');
  tgCalls = [];
  r = await call('/story-answer', { short: appShort, text: 'Ha, bor', botAuth: botAuth('story-answer', ADMINS[0], [appShort, 'Ha, bor']) });
  ok(r.status === 200 && r.data.telegram === 'skip', 'Telegram\'siz mijozga — faqat ilovada');
  ok(db.read('users/' + appUid + '/phase2/notifications/sa_' + r.data.id), 'Telegram\'siz mijoz ilovada javobni oladi');
  r = await call('/story-answer', { short, text: 'x', botAuth: botAuth('story-answer', TG, [short, 'x']) });
  eq(r.status, 403, 'admin bo\'lmagan bot imzosi — rad');
  r = await call('/story-answer', { short, text: 'boshqa matn', botAuth: botAuth('story-answer', ADMINS[0], [short, 'x']) });
  eq(r.status, 401, 'imzo matnga bog\'langan (matnni almashtirib bo\'lmaydi)');
  r = await call('/story-answer', { initData: initDataFor(ADMINS[2], 'Admin'), sid: 'reklama__k1', uid: appUid, text: 'Ilovadan javob' });
  eq(r.status, 200, 'admin ilova ichidan ham javob bera oladi');
  r = await call('/story-answer', { initData: initDataFor(TG, 'Ali'), sid: 'reklama__k1', uid: appUid, text: 'spam' });
  eq(r.status, 403, 'mijoz boshqa mijozga «do\'kon nomidan» yoza olmaydi');
  // Birlashgan hisobga javob — yangi hisobga boradi
  db.set('uid_redirect/' + appUid, { to: TG2, at: Date.now() });
  r = await call('/story-answer', { short: appShort, text: 'Yangi hisobga', botAuth: botAuth('story-answer', ADMINS[0], [appShort, 'Yangi hisobga']) });
  eq(r.data.uid, TG2, 'birlashtirilgan mijozga javob Telegram hisobiga boradi');

  // ===== 8) /upload — ilovadagi admin idToken bilan =====
  console.log('▶ 8) /upload (idToken)');
  const up = async (tok) => {
    const req = new Request('https://worker.test/upload?kind=video', { method: 'POST', headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' }, body: '{}' });
    const res = await worker.fetch(req, env, undefined);
    return { status: res.status, data: await res.json().catch(() => null) };
  };
  r = await up(idTokenFor(ADMINS[0]));
  eq([r.status, r.data && r.data.error], [400, 'multipart kerak'], 'admin idToken -> auth o\'tdi (keyingi tekshiruvgacha yetdi)');
  r = await up(idTokenFor(TG));
  eq(r.status, 403, 'admin bo\'lmagan idToken -> 403');
  r = await up('aaaaaaaaaaaaaaaaaaaaaaaa.bbbb.cccc');
  eq(r.status, 401, 'buzuq token -> 401');
  const pre = await worker.fetch(new Request('https://worker.test/upload', { method: 'OPTIONS' }), env, undefined);
  ok(/Authorization/.test(pre.headers.get('Access-Control-Allow-Headers') || ''), 'CORS: Authorization ruxsat etilgan');

  // ===== 9) Firebase qoidalari (statik; emulator sinovi PR tavsifida) =====
  console.log('▶ 9) database.rules.json');
  const rules = JSON.parse(fs.readFileSync(path.join(ROOT, 'database.rules.json'), 'utf8').replace(/^\s*\/\/.*$/gm, '')).rules;
  for (const node of ['phone_index', 'phone_pw', 'tg_login_req', 'login_rate', 'uid_redirect', 'account_merges', 'story_reply_index', 'tg_login']) {
    ok(rules[node] && rules[node]['.read'] === false && rules[node]['.write'] === false, node + ': faqat server');
  }
  const uidRules = rules.users.$uid;
  ok(!uidRules.verify && !uidRules['.write'], 'users/$uid/verify ga mijoz yoza olmaydi (grant yo\'q)');
  ok(/data\.val\(\)/.test(uidRules.profile.vip.manual['.validate']), 'profile/vip/manual: mijoz o\'zini VIP qila olmaydi');

  try { fs.unlinkSync(tmp); } catch (_) {}
  console.log('\n' + passed + ' ta tekshiruv o\'tdi, ' + failed + ' ta xato');
  if (failed) {
    console.error('\n❌ Yagona hisob sinovi MUVAFFAQIYATSIZ:\n - ' + fails.join('\n - '));
    process.exit(1);
  }
  console.log('✅ Yagona hisob va storis javoblari (Worker) — toza');
}

main().catch((e) => { console.error(e); process.exit(1); });
