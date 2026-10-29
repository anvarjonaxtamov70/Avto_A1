/* =====================================================================
   test-admin-reset.js — «BOTNI TOZALASH» (Worker /admin-reset + ilova)
   ---------------------------------------------------------------------
   Haqiqiy cloudflare-worker.js va index.html dagi haqiqiy bloklar sinaladi.
   Firebase RTDB SOXTA, lekin so'rovlarni haqiqiydek bajaradi:
   orderBy="$key" + startAt + limitToFirst (sahifalash), shallow, ETag/412,
   ko'p yo'lli PATCH'da ota/bola yo'l taqiqi. Google JWK va Telegram — soxta.
   Qo'riqlanadigan narsalar:
     1) «Mijoz» qoidasi (ism + raqam) — ilova bloki (a1-customer-rule-js).
     2) Faqat admin + alohida parol; noto'g'ri parol limiti (5 / 15 daq);
        rad etilganda hech narsa o'chmaydi.
     3) full: buyurtma, keshbek, statistika, xabarlar o'chadi; tovar/narx/
        ombor va ismi+raqami bor mijozlar (ro'yxatdan o'tgan holida) qoladi;
        ismi yoki raqami yo'qlar izlari bilan o'chadi; sahifalash hech kimni
        tashlab ketmaydi; har qadam 50 subrequest byudjetida; keyin «yangi
        mijoz» xabari qayta kelmaydi; yangi buyurtma va keshbek toza boshlanadi.
     4) incomplete: faqat ismi yoki raqami yo'qlar (buyurtmasi borlari qoladi),
        ilova yashirgan to'plam bilan server o'chirgani AYNAN bir xil.
     5) ADMIN_RESET_PASSWORD secret parolni almashtiradi.
     6) Ilova: phase2.resetAt kelsa telefondagi eski keshbek/bildirishnoma
        nolga tushadi va serverga qaytib yozilmaydi (a1-phase2-js).
   Ishga tushirish: node .github/test-admin-reset.js
   ===================================================================== */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const nodeCrypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const BOT_TOKEN = '123:TEST_TOKEN_FOR_ORDER_FLOW';
const ADMINS = ['5105291033', '483425630', '5302078'];
const PROJECT = 'avtoa1shop';
// ⚠️ Repo OCHIQ: haqiqiy parol bu yerda ham YOZILMAYDI. Sinov Worker secret
//    (ADMIN_RESET_PASSWORD) orqali o'z parolini beradi; standart parol yo'li
//    alohida tekshiriladi (5-bo'lim).
const PASSWORD = 'sinov-uchun-parol-2026';
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

/* ---------------------------------------------------------------------
 *  index.html dan blokni ajratib olish (qator boshida, AYNAN bitta)
 * --------------------------------------------------------------------- */
function scriptBlock(id) {
  const open = '<script id="' + id + '">';
  const re = new RegExp('^' + open.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'gm');
  const hits = HTML.match(re) || [];
  if (hits.length !== 1) { console.error('❌ `' + id + '` bloki ' + hits.length + ' marta topildi (1 bo\'lishi kerak).'); process.exit(1); }
  re.lastIndex = 0;
  const m = re.exec(HTML);
  const start = m.index + open.length;
  const end = HTML.indexOf('</script>', start);
  if (end < 0) { console.error('❌ `' + id + '` yopilmagan'); process.exit(1); }
  return HTML.slice(start, end);
}

const RULE_SRC = scriptBlock('a1-customer-rule-js');
const ruleCtx = vm.createContext({ window: {} });
vm.runInContext(RULE_SRC, ruleCtx, { filename: 'a1-customer-rule-js' });
const ruleInfo = (u) => JSON.parse(JSON.stringify(ruleCtx.window._a1CustomerInfo(u)));
const ruleComplete = (u) => ruleCtx.window._a1IsCompleteCustomer(u);

/* ---------------------------------------------------------------------
 *  SOXTA RTDB (so'rovlar bilan)
 * --------------------------------------------------------------------- */
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
    if (v === null || v === undefined) {
      // Haqiqiy RTDB kabi: yo'q yo'lni o'chirish hech narsa yaratmaydi, bo'shab qolgan ota tugunlar yo'qoladi.
      const chain = [this.root];
      for (let i = 0; i < parts.length - 1; i++) {
        const next = chain[i][parts[i]];
        if (!next || typeof next !== 'object') return;
        chain.push(next);
      }
      delete chain[chain.length - 1][parts[parts.length - 1]];
      for (let i = chain.length - 1; i > 0; i--) {
        if (Object.keys(chain[i]).length) break;
        delete chain[i - 1][parts[i - 1]];
      }
      return;
    }
    let n = this.root;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!n[parts[i]] || typeof n[parts[i]] !== 'object') n[parts[i]] = {};
      n = n[parts[i]];
    }
    n[parts[parts.length - 1]] = v;
  }
  etag(p) { return '"' + nodeCrypto.createHash('sha1').update(JSON.stringify(this.get(p))).digest('hex') + '"'; }
  read(p) { return render(clone(this.get(p))); }
}

// RTDB kalit tartibi (hujjatdagi ta'rif bo'yicha, Worker'dan mustaqil yozilgan):
// 32-bitli butun son kalitlar oldin (son bo'yicha), qolganlari satr bo'yicha.
function int32Key(k) {
  if (!/^(0|-?[1-9][0-9]*)$/.test(k)) return null;
  const n = Number(k);
  return n >= -(2 ** 31) && n <= 2 ** 31 - 1 ? n : null;
}
function keyOrder(a, b) {
  const x = int32Key(a), y = int32Key(b);
  if (x !== null || y !== null) {
    if (x === null) return 1;
    if (y === null) return -1;
    return x - y;
  }
  return a === b ? 0 : (a < b ? -1 : 1);
}
const queries = [];
function applyQuery(raw, q) {
  if (q.get('shallow') === 'true') {
    if (raw === null || typeof raw !== 'object') return raw;
    const o = {};
    for (const k of Object.keys(raw)) o[k] = true;
    return o;
  }
  const orderBy = q.get('orderBy');
  if (!orderBy || raw === null || typeof raw !== 'object') return raw;
  const by = JSON.parse(orderBy);
  const valOf = (k) => (by === '$key' ? k : (raw[k] && typeof raw[k] === 'object' ? raw[k][by] : undefined));
  const cmp = (a, b) => (by === '$key' ? keyOrder(a, b) : (a < b ? -1 : a > b ? 1 : 0));
  let keys = Object.keys(raw).sort((a, b) => (by === '$key' ? keyOrder(a, b) : cmp(valOf(a), valOf(b)) || keyOrder(a, b)));
  if (q.has('equalTo')) { const e = JSON.parse(q.get('equalTo')); keys = keys.filter((k) => valOf(k) === e); }
  if (q.has('startAt')) { const s = JSON.parse(q.get('startAt')); keys = keys.filter((k) => valOf(k) !== undefined && cmp(valOf(k), s) >= 0); }
  if (q.has('endAt')) { const e = JSON.parse(q.get('endAt')); keys = keys.filter((k) => valOf(k) !== undefined && cmp(valOf(k), e) <= 0); }
  if (q.has('limitToFirst')) keys = keys.slice(0, Number(q.get('limitToFirst')));
  if (q.has('limitToLast')) keys = keys.slice(-Number(q.get('limitToLast')));
  const o = {};
  for (const k of keys) o[k] = raw[k];
  return o;
}

/* ---------------------------------------------------------------------
 *  Kalitlar va SOXTA fetch
 * --------------------------------------------------------------------- */
const svc = nodeCrypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const google = nodeCrypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const GOOGLE_JWK = Object.assign(google.publicKey.export({ format: 'jwk' }), { kid: 'test-kid-1', alg: 'RS256', use: 'sig' });
function b64url(buf) { return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function idTokenFor(uid) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', kid: 'test-kid-1', typ: 'JWT' }));
  const payload = b64url(JSON.stringify({
    aud: PROJECT, iss: 'https://securetoken.google.com/' + PROJECT, sub: uid, user_id: uid,
    iat: now - 10, exp: now + 3600, auth_time: now - 10,
  }));
  const sig = nodeCrypto.sign('RSA-SHA256', Buffer.from(header + '.' + payload), google.privateKey);
  return header + '.' + payload + '.' + b64url(sig);
}

const DB_URL = 'https://test-rtdb.example';
let db, tgCalls, msgSeq, fetchCount = 0;
function resetWorld(data) { db = new FakeDB(data); tgCalls = []; msgSeq = 1000; queries.length = 0; }
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
    return jsonResponse({ ok: true, result: { message_id: ++msgSeq } });
  }
  if (url.startsWith(DB_URL)) {
    const u = new URL(url);
    const p = decodeURIComponent(u.pathname.replace(/\.json$/, '')).replace(/^\/+/, '');
    const h = new Headers(opts.headers || {});
    if (h.get('Authorization') !== 'Bearer test-access-token') return jsonResponse({ error: 'auth' }, 401);
    if (method === 'GET') {
      const headers = {};
      if (h.get('X-Firebase-ETag') === 'true') headers.ETag = db.etag(p);
      queries.push(p + u.search);
      return jsonResponse(render(applyQuery(clone(db.get(p)), u.searchParams)), 200, headers);
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

function hmac(key, msg) { return nodeCrypto.createHmac('sha256', key).update(msg).digest(); }
function initDataFor(uid, firstName) {
  const params = new URLSearchParams();
  params.set('auth_date', String(Math.floor(Date.now() / 1000)));
  params.set('query_id', 'AAH' + uid);
  params.set('user', JSON.stringify({ id: Number(uid), first_name: firstName || 'Test' }));
  const pairs = [];
  for (const [k, v] of params) pairs.push(k + '=' + v);
  pairs.sort();
  params.set('hash', hmac(hmac('WebAppData', BOT_TOKEN), pairs.join('\n')).toString('hex'));
  return params.toString();
}

let worker, env;
async function call(route, body, envOverride) {
  const req = new Request('https://worker.test' + route, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '10.0.0.1' },
    body: JSON.stringify(body),
  });
  fetchCount = 0;
  const res = await worker.fetch(req, envOverride || env, undefined);
  let data = null;
  try { data = await res.json(); } catch (_) {}
  return { status: res.status, data, fetches: fetchCount };
}

/** Ilova (a1-admin-reset-js) kabi: `done` bo'lguncha `cursor` bilan takrorlaydi. */
async function resetLoop(cred, mode, password, envOverride) {
  let cursor = '';
  const sum = { calls: 0, scanned: 0, deleted: 0, cleaned: 0, keptWithOrders: 0, maxFetches: 0, total: null };
  for (let i = 0; i < 100; i++) {
    const r = await call('/admin-reset', Object.assign({ mode, password, confirm: 'TOZALASH', cursor }, cred), envOverride);
    sum.calls++;
    sum.maxFetches = Math.max(sum.maxFetches, r.fetches);
    if (r.status !== 200 || !r.data.ok) return Object.assign(sum, { error: r });
    if (typeof r.data.total === 'number') sum.total = r.data.total;
    for (const k of ['scanned', 'deleted', 'cleaned', 'keptWithOrders']) sum[k] += r.data.page[k];
    if (r.data.done) return sum;
    if (!r.data.cursor || r.data.cursor === cursor) return Object.assign(sum, { error: 'kursor oldinga siljimadi' });
    cursor = r.data.cursor;
  }
  return Object.assign(sum, { error: 'cheksiz sikl' });
}

const ADMIN_TG = { initData: initDataFor(ADMINS[0], 'Anvar') };

/* ---------------------------------------------------------------------
 *  Ma'lumotlar
 * --------------------------------------------------------------------- */
const PRODUCTS = [
  { id: 1, name: 'Porshen', price: 100000, stock: 5, rating: 4.5 },
  { id: 3, name: 'Moy filtri', price: 30000, stock: 7, sizes: [{ size: 'Nexia', stock: 4 }] },
];
const STATIC_NODES = {
  catalog: { chevrolet: { name: 'Chevrolet', models: { nexia: 'Nexia 3' } } },
  settings: { ui: { cardStyle: 'market' }, shopInfo: { phones: ['+998882893030'], updatedAt: 1 } },
  banners: { b1: { img: 'https://x/1.png', order: 1, active: true } },
  stories: { aksiyalar: { m1: { type: 'photo', file: 'abc' } } },
  bts_branches: { t1: { name: 'Toshkent' } },
  ai_bulk_requests: { [ADMINS[0]]: { usd_rate: 12800, markup_pct: 20 } },
  ai_admin_tasks: { t1: { action: 'generate_desc', needs_processing: true } },
  admins: { [ADMINS[1]]: true },
  blocked_users: { '777000909': { name: 'Blok', at: 1 } },
};

// To'liq mijozlar (qoladi)
const ALI = '777000111';      // Telegram, bot orqali ro'yxatdan o'tgan
const VERIFIED = '777000222'; // profilda raqam yo'q, lekin tasdiqlangan (verify) raqam bor
const LEGACY_OK = 'apk_12345'; // eski ilova ID'si, ismi va raqami bor
const BIG_TG = '6000000001';  // 32-bitdan katta Telegram ID
// To'liq emas (o'chadi)
const NO_PHONE = '777000333';   // Mini App'ni ochgan, raqam bermagan (firstName bor)
const LANG_ONLY = '777000444';  // botda faqat til tanlagan
const PLACEHOLDER = '777000555'; // ism o'rnida zaxira yorliq
const BAD_PHONE = '777000666';  // raqam o'rnida «Kiritilmagan»
const ANON = 'AnonUid0000000000000000000001'; // ilovani ochib ketgan anonim
const PHONE_ONLY = '6000000002';   // kontakt ulashgan, lekin ismi yo'q
const BLOCKED_INC = '777000909';   // bloklangan va to'liq emas

function seed() {
  const users = {
    [ALI]: {
      profile: { uid: Number(ALI), name: 'Ali', phone: '+998 90 111 22 33', address: 'Toshkent', lang: 'uz', username: '@ali', registrationCompletedAt: 1, vip: { manual: 'vip' } },
      verify: { phone: '+998901112233', at: 1, src: 'bot' },
      cart: { '3': 1 }, wishlist: [1], addresses: [{ title: 'Uy', text: 'Chilonzor' }], my_car: 'chevy-Nexia 3',
      story_seen: { 'aksiyalar__m1': 1 },
      phase2: {
        theme: 'light', themeSwitched: true, lang: 'uz', wishlistCount: 1,
        cashbackTotal: 9000, cashbackSpent: 1000, cashbackRefunded: 500, cashback: 8500,
        cashbackHistory: [{ date: 1, amount: 9000, type: 'earn' }], notifications: [{ id: 'n1', title: 'Eski' }],
        achievements: { first: 1 }, achSeen: 1, warranties: [{ id: 'w1' }],
        loyaltyProjection: { version: 7, cashbackTotal: 9000 }, processedOrders: { o1_v1: { st: 'yetkazildi' } },
        referralCode: 'ALI42',
      },
      orders: { o1: { id: 'o1', uid: ALI, status: 'yetkazildi', total: 900000 } },
    },
    [VERIFIED]: { profile: { name: 'Vali', firstName: 'Vali' }, verify: { phone: '+998935550011', at: 1 }, orders: { o2: { id: 'o2', status: 'kutilmoqda', total: 30000 } } },
    [LEGACY_OK]: { profile: { name: 'Olim', phone: '901234567' }, phase2: { cashbackTotal: 100 } },
    [BIG_TG]: { profile: { firstName: 'Bobur', phone: '+998977770000' } },
    [ADMINS[0]]: { profile: { lang: 'uz', lastGreetedDay: '2026-10-29' }, orders: { t1: { id: 't1', status: 'yetkazildi', total: 1000 } } },
    [NO_PHONE]: { profile: { uid: Number(NO_PHONE), firstName: 'Sardor', username: "Yo'q" }, cart: { '1': 2 } },
    [LANG_ONLY]: { profile: { lang: 'ru' } },
    [PLACEHOLDER]: { profile: { name: 'Nomsiz mijoz', phone: '+998901000001' } },
    [BAD_PHONE]: { profile: { name: 'Jasur', phone: 'Kiritilmagan' }, verify: { phone: '12' } },
    [ANON]: { phase2: { theme: 'dark' }, cart: { '3': 1 } },
    [PHONE_ONLY]: { profile: { phone: '+998935551234' }, verify: { phone: '+998935551234', at: 1, src: 'bot' } },
    [BLOCKED_INC]: { profile: { firstName: 'Blok' } },
  };
  // Sahifalash uchun ko'p foydalanuvchi: 32-bitli, katta va satr kalitlar aralash
  for (let i = 0; i < 45; i++) {
    users[String(700000000 + i)] = { profile: { name: 'Mijoz ' + i + ' Aka', phone: '+99890' + String(1000000 + i) } };
    users[String(7000000000 + i)] = { profile: { firstName: 'Tg' + i } };            // raqam yo'q -> o'chadi
    users['anon' + String(i).padStart(3, '0') + 'xxxxxxxxxxxxxxxxxxxxx'] = { phase2: { theme: 'dark' } }; // o'chadi
  }
  return Object.assign({
    products: PRODUCTS,
    users,
    orders: { [ALI + '_o1']: { id: 'o1', uid: ALI, status: 'yetkazildi', total: 900000 }, [VERIFIED + '_o2']: { id: 'o2', uid: VERIFIED, status: 'kutilmoqda' } },
    order_chats: { [ALI]: { o1: { m1: { sender: 'mijoz', text: 'Salom', time: 1 } } } },
    order_attempts: { [ALI]: { a1: { state: 'committed' } } },
    order_state: { [ALI + '_o1']: { current: 'yetkazildi', version: 3 } },
    order_tg: { [ALI + '_o1']: { msgs: { [ADMINS[0]]: 11 } } },
    order_tg_index: { abcabcabcabcabcabcab: { orderKey: ALI + '_o1', uid: ALI, orderId: 'o1' } },
    loyalty_accounts: { [ALI]: { version: 7, earned: 9000, spent: 1000, refunded: 500, ops: { x: {} } } },
    notification_outbox: {
      [ALI + '_o1']: { type: 'order_created', retryAt: 5 },
      [ALI + '_o1_status_1']: { type: 'order_status', retryAt: 6 },
      ['new_customer_' + ALI]: { type: 'new_customer', uid: ALI, state: 'sent' },
      ['new_customer_' + NO_PHONE]: { type: 'new_customer', uid: NO_PHONE, state: 'sent' },
    },
    admin_notifications: { ['new_customer_' + ALI]: { id: 'new_customer_' + ALI, uid: ALI, type: 'new_customer', createdAt: 1 } },
    admin_notification_reads: { [ADMINS[0]]: { ['new_customer_' + ALI]: true } },
    customer_registrations: {
      [ALI]: { uid: ALI, registeredAt: 1, name: 'Ali', notify: true },
      [VERIFIED]: { uid: VERIFIED, registeredAt: 2, name: 'Vali', notify: true },
      [NO_PHONE]: { uid: NO_PHONE, registeredAt: 3, name: 'Sardor', notify: true },
    },
    customer_registration_pending: { [LANG_ONLY]: { uid: LANG_ONLY, state: 'incomplete' } },
    ai_requests: { [ALI]: { chats: { c1: { messages: [{ sender: 'user', text: 'Narxi?' }] } } }, [NO_PHONE]: { messages: [{ text: 'hi' }] } },
    story_views: { aksiyalar__m1: { [ALI]: { t: 1, n: 'Ali' }, [NO_PHONE]: { t: 2, n: 'Sardor' } } },
    story_replies: { aksiyalar__m1: { [ALI]: { r1: { t: 1, x: 'Zo\'r' } } } },
    story_reply_index: { k1: { sid: 'aksiyalar__m1', uid: ALI, rid: 'r1' } },
    reviews: { '1': { [ALI]: { rating: 5, text: 'Zo\'r', userName: 'Ali' } } },
    broadcasts: { b1: { text: 'Aksiya', sent: 10 } },
    referrals: { [ALI]: { count: 1 } },
    refcodes: { ALI42: ALI },
    notify_requests: { '3': { [ALI]: { at: 1 }, [ANON]: { at: 2 } } },
    phone_index: {
      '998901112233': { uid: ALI, at: 1, src: 'bot' },
      '998935551234': { uid: PHONE_ONLY, at: 1, src: 'bot' },
    },
    phone_pw: { '998901000001': { uid: PLACEHOLDER, at: 1 } },
    uid_redirect: { LegacyOfSardor0000000000001: { to: NO_PHONE, at: 1 }, LegacyOfAli000000000000001: { to: ALI, at: 1 } },
    deleted_accounts: { '777000999': { at: 1, orders: 0 } },
    audit_log: { '1700000000000_1234': { kind: 'mutation', uid: 1 } },
    pending_actions: { tok1: { status: 'pending' } },
  }, clone(STATIC_NODES));
}

const COMPLETE_KEEP = [ALI, VERIFIED, LEGACY_OK, BIG_TG];
const INCOMPLETE = [NO_PHONE, LANG_ONLY, PLACEHOLDER, BAD_PHONE, ANON, PHONE_ONLY, BLOCKED_INC];

async function main() {
  // ===== 1) «Mijoz» qoidasi (ilova bloki) =====
  console.log('▶ 1) «Mijoz» qoidasi — ism + raqam (a1-customer-rule-js)');
  eq(ruleInfo({ profile: { name: 'Ali', phone: '+998 90 111 22 33' } }), { name: 'Ali', phone: '+998 90 111 22 33', complete: true }, 'ism + raqam = mijoz');
  eq(ruleComplete({ profile: { firstName: 'Ali', phone: '901112233' } }), true, 'Telegram ismi (firstName) ham ism; 9 xonali raqam');
  eq(ruleInfo({ profile: { name: 'Vali' }, verify: { phone: '+998935550011' } }), { name: 'Vali', phone: '+998935550011', complete: true }, 'tasdiqlangan raqam profilda bo\'lmasa ham hisoblanadi');
  eq(ruleComplete({ profile: { name: 'Nomsiz mijoz', phone: '+998901000001' } }), false, '«Nomsiz mijoz» — ism emas');
  eq(ruleComplete({ profile: { name: 'Noma\u2019lum', phone: '+998901000001' } }), false, '«Noma’lum» (boshqa apostrof) — ism emas');
  eq(ruleComplete({ profile: { name: 'Jasur', phone: 'Kiritilmagan' } }), false, '«Kiritilmagan» — raqam emas');
  eq(ruleComplete({ profile: { name: 'Jasur', phone: '12345' } }), false, 'qisqa raqam — raqam emas');
  eq(ruleComplete({ profile: { name: '   ', phone: '+998901000001' } }), false, 'bo\'sh ism');
  eq(ruleComplete({ profile: { lang: 'uz' } }), false, 'faqat til tanlagan');
  eq(ruleComplete({ phase2: { theme: 'dark' } }), false, 'profilsiz (anonim) foydalanuvchi');
  eq(ruleComplete(null), false, 'bo\'sh yozuv');
  eq(ruleComplete({ profile: { name: 'Ali', phone: 998901112233 } }), true, 'raqam son ko\'rinishida saqlangan');

  const tmp = path.join(os.tmpdir(), 'avto_worker_reset_' + process.pid + '.mjs');
  fs.copyFileSync(path.join(ROOT, 'cloudflare-worker.js'), tmp);
  worker = (await import('file://' + tmp)).default;
  env = {
    BOT_TOKEN,
    FIREBASE_CLIENT_EMAIL: 'svc@test.iam.gserviceaccount.com',
    FIREBASE_PRIVATE_KEY: svc.privateKey.export({ type: 'pkcs8', format: 'pem' }),
    FIREBASE_DB_URL: DB_URL,
    FIREBASE_PROJECT_ID: PROJECT,
    ADMIN_IDS: ADMINS.join(','),
    ADMIN_ALERT_CHAT_ID: ADMINS[0],
    ADMIN_RESET_PASSWORD: PASSWORD,
  };

  // ===== 2) Ruxsat va parol =====
  console.log('▶ 2) Faqat admin + alohida parol');
  resetWorld(seed());
  const before = JSON.stringify(db.root);
  let r = await call('/admin-reset', { mode: 'full', password: PASSWORD, confirm: 'TOZALASH' });
  eq(r.status, 401, 'kimligisiz — 401');
  r = await call('/admin-reset', { initData: initDataFor(ALI, 'Ali'), mode: 'full', password: PASSWORD, confirm: 'TOZALASH' });
  eq([r.status, r.data.error], [403, 'faqat admin'], 'oddiy mijoz to\'g\'ri parol bilan ham tozalay olmaydi');
  r = await call('/admin-reset', Object.assign({ mode: 'all', password: PASSWORD, confirm: 'TOZALASH' }, ADMIN_TG));
  eq(r.status, 400, 'noma\'lum mode — 400');
  r = await call('/admin-reset', Object.assign({ mode: 'full', password: PASSWORD }, ADMIN_TG));
  eq(r.status, 400, 'tasdiqsiz (confirm) — 400');
  r = await call('/admin-reset', Object.assign({ mode: 'full', confirm: 'TOZALASH' }, ADMIN_TG));
  eq(r.status, 400, 'parolsiz — 400');
  const lefts = [];
  for (let i = 0; i < 5; i++) {
    r = await call('/admin-reset', Object.assign({ mode: 'full', password: PASSWORD.toUpperCase(), confirm: 'TOZALASH' }, ADMIN_TG));
    lefts.push([r.status, r.data.wrongPassword, r.data.attemptsLeft]);
  }
  eq(lefts, [[403, true, 4], [403, true, 3], [403, true, 2], [403, true, 1], [403, true, 0]], 'noto\'g\'ri parol (katta-kichik harf ham farq qiladi) — qolgan urinishlar soni');
  r = await call('/admin-reset', Object.assign({ mode: 'full', password: PASSWORD, confirm: 'TOZALASH' }, ADMIN_TG));
  ok(r.status === 429 && r.data.retryAfter > 0, '5 ta xatodan keyin to\'g\'ri parol ham 15 daqiqa qabul qilinmaydi (429)');
  db.set('login_rate/admin_reset_' + ADMINS[0], null);
  const afterFails = JSON.parse(JSON.stringify(db.root));
  delete afterFails.login_rate;
  eq(JSON.stringify(afterFails), before, 'rad etilgan urinishlarda hech narsa o\'chmadi');
  db.set('login_rate/admin_reset_' + ADMINS[0], { windowStart: Date.now() - 16 * 60 * 1000, count: 5 });
  r = await call('/admin-reset', Object.assign({ mode: 'incomplete', password: 'xato', confirm: 'TOZALASH' }, ADMIN_TG));
  eq([r.status, r.data.attemptsLeft], [403, 4], '15 daqiqadan keyin hisob qaytadan boshlanadi');

  // ===== 3) full — botni tozalash =====
  console.log('▶ 3) full — buyurtma, keshbek, statistika, xabarlar o\'chadi');
  resetWorld(seed());
  db.set('login_rate/ip_x', { windowStart: 1, count: 1 });
  const userCount = Object.keys(db.get('users')).length;
  const t0 = Date.now();
  let s = await resetLoop(ADMIN_TG, 'full', PASSWORD);
  ok(!s.error, 'tozalash xatosiz tugadi ' + (s.error ? JSON.stringify(s.error.data || s.error) : ''));
  eq(s.total, userCount, 'jami foydalanuvchilar soni ko\'rsatildi');
  eq(s.scanned, userCount, 'sahifalash: har bir foydalanuvchi aynan bir marta ko\'rildi');
  ok(s.calls >= 3, 'mijozlar bir necha sahifada ishlandi (' + s.calls + ' qadam)');
  ok(s.maxFetches <= LIMIT, 'har qadam 50 subrequest byudjetida (eng ko\'pi ' + s.maxFetches + ')');
  const userReads = queries.filter((q) => /^users(\?|$)/.test(q));
  ok(userReads.some((q) => /orderBy=%22%24key%22/.test(q) && /limitToFirst=50/.test(q)), 'users sahifalab (50 tadan) o\'qildi');
  ok(userReads.every((q) => /limitToFirst=|shallow=true/.test(q)), 'users daraxti hech qachon butunligicha yuklanmadi');
  eq(db.read('products'), render(normalize(clone(PRODUCTS))), 'tovarlar, narxlar, reyting va ombor qoldig\'i o\'zgarmadi');
  for (const k of Object.keys(STATIC_NODES)) eq(db.read(k), render(normalize(clone(STATIC_NODES[k]))), k + ' o\'zgarmadi');
  for (const node of ['orders', 'order_chats', 'order_attempts', 'order_state', 'order_tg', 'order_tg_index', 'loyalty_accounts',
    'admin_notifications', 'admin_notification_reads', 'ai_requests', 'story_views', 'story_replies', 'story_reply_index',
    'reviews', 'broadcasts', 'referrals', 'refcodes']) {
    eq(db.read(node), null, node + ' o\'chdi');
  }
  eq(Object.keys(db.read('notification_outbox') || {}).sort(), ['new_customer_' + ALI, 'new_customer_' + NO_PHONE].sort(),
    'navbatdan buyurtma hodisalari o\'chdi, «yangi mijoz» claim\'lari qoldi (Telegram dublikati yo\'q)');
  ok(db.read('login_rate/ip_x') && db.read('deleted_accounts/777000999') && db.read('pending_actions/tok1'), 'limit, o\'chirilgan hisoblar izi va AI tasdiqlari tegilmadi');
  const audit = Object.values(db.read('audit_log') || {}).filter((a) => a && a.kind === 'admin_reset');
  ok(audit.length === 1 && audit[0].by === ADMINS[0] && audit[0].mode === 'full', 'jurnalga kim va qachon tozalagani yozildi');
  ok(db.read('audit_log/1700000000000_1234'), 'eski jurnal yozuvlari saqlandi');

  const ali = db.read('users/' + ALI);
  eq(ali.profile, { uid: Number(ALI), name: 'Ali', phone: '+998 90 111 22 33', address: 'Toshkent', lang: 'uz', username: '@ali', registrationCompletedAt: 1, vip: { manual: 'vip' } }, 'profil (ism, raqam, manzil, til, qo\'lda VIP) to\'liq saqlandi');
  ok(ali.verify && ali.verify.phone === '+998901112233' && db.read('phone_index/998901112233/uid') === ALI, 'tasdiqlangan raqam va kirish indeksi saqlandi');
  ok(ali.cart && ali.wishlist && ali.addresses && ali.my_car && ali.story_seen, 'savat, sevimlilar, manzillar, mashina saqlandi');
  eq(ali.orders, undefined, 'mijozning buyurtmalari o\'chdi');
  const p2 = Object.assign({}, ali.phase2);
  ok(p2.resetAt >= t0, 'ilova uchun phase2.resetAt belgisi qo\'yildi');
  delete p2.resetAt;
  eq(p2, { theme: 'light', themeSwitched: true, lang: 'uz', wishlistCount: 1 }, 'phase2: faqat mavzu/til qoldi — keshbek, tarix, bildirishnoma, yutuq, kafolat o\'chdi');
  eq(db.read('customer_registrations/' + ALI), { uid: ALI, registeredAt: 1, name: 'Ali', notify: false }, 'ro\'yxatdan o\'tganlik saqlandi (notify:false — qayta e\'lon qilinmaydi)');
  eq(db.read('customer_registrations/' + LEGACY_OK), null, 'markeri yo\'q mijozga yarim marker yaratilmadi');
  eq(db.read('users/' + VERIFIED + '/orders'), null, 'faol buyurtma ham o\'chdi');
  ok(db.read('users/' + VERIFIED + '/profile/name') === 'Vali', 'faqat tasdiqlangan raqami bor mijoz qoldi');
  ok(db.read('users/' + LEGACY_OK + '/profile/name') === 'Olim' && db.read('users/' + LEGACY_OK + '/phase2/cashbackTotal') === null, 'eski ilova ID\'li mijoz qoldi, keshbeki o\'chdi');
  ok(db.read('users/' + BIG_TG + '/profile/firstName') === 'Bobur', '32-bitdan katta ID\'li mijoz qoldi');
  ok(db.read('users/' + ADMINS[0] + '/profile/lang') === 'uz' && db.read('users/' + ADMINS[0] + '/orders') === null, 'admin (raqamsiz bo\'lsa ham) o\'chmadi, sinov buyurtmalari o\'chdi');
  for (const uid of INCOMPLETE) eq(db.read('users/' + uid), null, 'ismi yoki raqami yo\'q o\'chdi: ' + uid);
  for (let i = 0; i < 45; i++) {
    if (!db.read('users/' + (700000000 + i) + '/profile/phone')) ok(false, 'to\'liq mijoz qolishi kerak edi: ' + (700000000 + i));
    if (db.read('users/' + (7000000000 + i)) !== null) ok(false, 'raqamsiz o\'chishi kerak edi: ' + (7000000000 + i));
  }
  eq(s.deleted, INCOMPLETE.length + 90, 'o\'chirilganlar soni to\'g\'ri');
  eq(s.cleaned, COMPLETE_KEEP.length + 45 + 1, 'yangilangan mijozlar soni to\'g\'ri (admin bilan)');
  eq(db.read('customer_registrations/' + NO_PHONE), null, 'o\'chganning ro\'yxatdan o\'tish markeri o\'chdi');
  eq(db.read('customer_registration_pending/' + LANG_ONLY), null, 'o\'chganning pending markeri o\'chdi');
  eq(db.read('phone_index/998935551234'), null, 'o\'chganning raqam indeksi o\'chdi');
  eq(db.read('phone_pw/998901000001'), null, 'o\'chganning parolli hisob indeksi o\'chdi');
  eq(db.read('uid_redirect/LegacyOfSardor0000000000001'), null, 'o\'chganga yo\'naltirish o\'chdi');
  ok(db.read('uid_redirect/LegacyOfAli000000000000001/to') === ALI, 'qolgan mijozga yo\'naltirish saqlandi');
  eq(db.read('notify_requests/3'), { [ALI]: { at: 1 } }, '«kelganda xabar ber»: o\'chganniki o\'chdi, mijozniki qoldi');
  ok(db.read('blocked_users/' + BLOCKED_INC), 'blok belgisi saqlandi (qaytib kirsa ham bloklangan)');

  // Takror bosish xavfsiz (idempotent)
  const snapAfter = JSON.stringify(Object.assign({}, db.root, { audit_log: null, users: null }));
  s = await resetLoop(ADMIN_TG, 'full', PASSWORD);
  ok(!s.error && s.deleted === 0, 'qayta bosish xavfsiz: o\'chiriladigan hech kim qolmagan');
  eq(JSON.stringify(Object.assign({}, db.root, { audit_log: null, users: null })), snapAfter, 'qayta bosish boshqa ma\'lumotga tegmadi');

  // Tozalashdan keyin: «yangi mijoz» xabari qayta kelmaydi
  tgCalls.length = 0;
  r = await call('/customer-register', { initData: initDataFor(ALI, 'Ali'), profile: { name: 'Ali', phone: '+998901112233' } });
  ok(r.status === 200 && r.data.ok, 'mijoz ilovani ochdi — ro\'yxatdan o\'tgan holda');
  eq([tgCalls.length, db.read('admin_notifications')], [0, null], 'adminga «Yangi mijoz» xabari qayta kelmadi, inbox bo\'sh qoldi');

  // Tozalashdan keyin: yangi buyurtma toza boshlanadi, eski keshbek qaytmaydi
  r = await call('/order-commit', {
    initData: initDataFor(ALI, 'Ali'), attemptId: 'att_after_reset_01', items: [{ id: '1', size: '', qty: 1 }],
    customer: { name: 'Ali', phone: '+998901112233', address: 'Toshkent' },
    delivery: { method: 'courier', address: 'Toshkent' }, payment: { method: 'Naqd pul (yetkazilganda)' },
    cashbackRequested: 5000,
  });
  ok(r.status === 201 && r.data.ok, 'tozalashdan keyin yangi buyurtma ishlaydi (201) ' + (r.status === 201 ? '' : r.status + ' ' + JSON.stringify(r.data)));
  eq(r.data.order && r.data.order.cashbackUsed, 0, 'eski keshbek (8 500 so\'m) qaytib tirilmadi');
  eq(Object.keys(db.read('users/' + ALI + '/orders') || {}).length, 1, 'mijozda faqat yangi buyurtma');

  // ===== 3b) Sahifa chegarasidagi mijoz QOLSA ham hech kim tashlab ketilmaydi =====
  // startAt kursorning o'zini ham qaytaradi (inclusive); u o'chgan bo'lsa — qaytarmaydi.
  // Yuqoridagi holatda chegara mijozlari o'chib ketardi, bu yerda hammasi qoladi.
  console.log('▶ 3b) Sahifalash: chegaradagi mijoz qoladi (32-bitli, katta va satr kalitlar)');
  const pagedUsers = {};
  for (let i = 0; i < 60; i++) pagedUsers[String(800000000 + i)] = { profile: { name: 'M' + i, phone: '+99890' + (2000000 + i) }, orders: { a: { id: 'a', status: 'yetkazildi', total: 1 } } };
  for (let i = 0; i < 40; i++) pagedUsers[String(6000000100 + i)] = { profile: { firstName: 'B' + i, phone: '+99891' + (3000000 + i) } };
  for (let i = 0; i < 30; i++) pagedUsers['user_' + String(i).padStart(3, '0')] = { profile: { name: 'S' + i, phone: '90' + (4000000 + i) } };
  resetWorld({ users: pagedUsers });
  s = await resetLoop(ADMIN_TG, 'incomplete', PASSWORD);
  eq([s.error || null, s.scanned, s.deleted, s.calls], [null, 130, 0, 3], 'incomplete: 130 ta to\'liq mijoz — hammasi ko\'rildi, hech kim o\'chmadi, 3 sahifa');
  s = await resetLoop(ADMIN_TG, 'full', PASSWORD);
  eq([s.error || null, s.scanned, s.cleaned, s.deleted], [null, 130, 130, 0], 'full: 130 ta mijoz — hammasi aynan bir marta tozalandi');
  const missed = Object.keys(db.read('users') || {}).filter((uid) => !db.read('users/' + uid + '/phase2/resetAt') || db.read('users/' + uid + '/orders'));
  eq(missed, [], 'sahifa chegarasidagilar ham tozalandi');

  // ===== 4) incomplete — faqat ismi yoki raqami yo'qlar =====
  console.log('▶ 4) incomplete — Mijozlar oynasidagi «O\'chirish»');
  resetWorld(seed());
  const INC_WITH_ORDER = '777000777';
  db.set('users/' + INC_WITH_ORDER, { profile: { firstName: 'Buyurtmachi' }, orders: { x1: { id: 'x1', status: 'yetkazildi', total: 5 } } });
  db.set('story_views/aksiyalar__m1/' + NO_PHONE, { t: 2, n: 'Sardor' });
  db.set('story_replies/aksiyalar__m1/' + NO_PHONE + '/r9', { t: 1, x: 'Narxi?' });
  db.set('story_reply_index/k9', { sid: 'aksiyalar__m1', uid: NO_PHONE, rid: 'r9' });
  db.set('reviews/3/' + NO_PHONE, { rating: 1, text: 'x' });
  db.set('loyalty_accounts/' + NO_PHONE, { earned: 0 });
  db.set('admin_notifications/new_customer_' + NO_PHONE, { id: 'new_customer_' + NO_PHONE, uid: NO_PHONE, type: 'new_customer' });
  const all = db.read('users');
  const expectDeleted = Object.keys(all).filter((uid) => !ADMINS.includes(uid) && !ruleComplete(all[uid]) &&
    !(all[uid].orders && Object.keys(all[uid].orders).length)).sort();
  const ordersBefore = db.read('orders');
  s = await resetLoop({ idToken: idTokenFor(ADMINS[1]) }, 'incomplete', PASSWORD);
  ok(!s.error, 'ilovadagi admin (Firebase idToken) bilan ishladi ' + (s.error ? JSON.stringify(s.error.data || s.error) : ''));
  ok(s.maxFetches <= LIMIT, 'har qadam 50 subrequest byudjetida (eng ko\'pi ' + s.maxFetches + ')');
  const left = db.read('users');
  const actuallyDeleted = Object.keys(all).filter((uid) => !left[uid]).sort();
  eq(actuallyDeleted, expectDeleted, 'server o\'chirgani = ilova yashirgani (bitta qoida)');
  eq(s.deleted, expectDeleted.length, 'o\'chirilganlar soni');
  eq(s.keptWithOrders, 1, 'buyurtmasi bor (ismi yo\'q) foydalanuvchi qoldi va hisobotda aytildi');
  ok(left[INC_WITH_ORDER] && left[INC_WITH_ORDER].orders, 'buyurtma tarixi buzilmadi');
  ok(left[ADMINS[0]], 'admin o\'chmadi');
  eq(db.read('orders'), ordersBefore, 'buyurtmalar tegilmadi');
  ok(db.read('loyalty_accounts/' + ALI) && db.read('users/' + ALI + '/phase2/cashbackTotal') === 9000 && db.read('users/' + ALI + '/orders/o1'), 'mijozlarning keshbek va buyurtmalari tegilmadi');
  ok(db.read('admin_notifications/new_customer_' + ALI) && db.read('broadcasts/b1') && db.read('story_views/aksiyalar__m1/' + ALI), 'statistika va xabarlar tegilmadi');
  eq(db.read('customer_registrations/' + ALI + '/notify'), true, 'mijozlarning markeriga tegilmadi');
  eq([db.read('story_views/aksiyalar__m1/' + NO_PHONE), db.read('story_replies/aksiyalar__m1/' + NO_PHONE), db.read('story_reply_index/k9'),
    db.read('reviews/3/' + NO_PHONE), db.read('ai_requests/' + NO_PHONE), db.read('loyalty_accounts/' + NO_PHONE),
    db.read('admin_notifications/new_customer_' + NO_PHONE), db.read('customer_registrations/' + NO_PHONE)],
  [null, null, null, null, null, null, null, null], 'o\'chganning storis, sharh, AI, keshbek, inbox va marker izlari o\'chdi');
  ok(db.read('notification_outbox/new_customer_' + NO_PHONE), 'Telegram claim\'i qoldi (qaytsa «yangi mijoz» dublikati bo\'lmaydi)');
  ok(db.read('story_reply_index/k1') && db.read('reviews/1/' + ALI), 'boshqalarning storis javobi va sharhi joyida');

  // ===== 5) Standart parol (faqat xesh) va secret bilan almashtirish =====
  console.log('▶ 5) Standart parol xeshi va ADMIN_RESET_PASSWORD secret');
  const WORKER_SRC = fs.readFileSync(path.join(ROOT, 'cloudflare-worker.js'), 'utf8');
  const defHash = (WORKER_SRC.match(/const ADMIN_RESET_DEFAULT_SHA256 = "([^"]*)"/) || [])[1] || '';
  ok(/^[0-9a-f]{64}$/.test(defHash), 'Worker\'da standart parolning faqat SHA-256 xeshi turadi');
  ok(!HTML.includes(defHash), 'ilovaga (index.html) parol xeshi ham tushmagan');
  resetWorld(seed());
  const envDefault = Object.assign({}, env);
  delete envDefault.ADMIN_RESET_PASSWORD;
  r = await call('/admin-reset', Object.assign({ mode: 'incomplete', password: PASSWORD, confirm: 'TOZALASH' }, ADMIN_TG), envDefault);
  eq([r.status, r.data.wrongPassword], [403, true], 'secret bo\'lmasa standart parol ishlaydi (boshqa parol rad etiladi)');
  const usersBefore = JSON.stringify(db.read('users'));
  const env2 = Object.assign({}, env, { ADMIN_RESET_PASSWORD: 'Yangi-Parol-2026' });
  r = await call('/admin-reset', Object.assign({ mode: 'incomplete', password: PASSWORD, confirm: 'TOZALASH' }, ADMIN_TG), env2);
  eq([r.status, r.data.wrongPassword], [403, true], 'secret almashtirilgach eski parol ishlamaydi');
  eq(JSON.stringify(db.read('users')), usersBefore, 'rad etilganda mijozlarga tegilmadi');
  s = await resetLoop(ADMIN_TG, 'incomplete', 'Yangi-Parol-2026', env2);
  ok(!s.error && s.deleted > 0, 'secretdagi yangi parol ishlaydi');

  // ===== 6) Ilova: phase2.resetAt =====
  console.log('▶ 6) Ilova: telefondagi eski keshbek va bildirishnomalar (a1-phase2-js)');
  await phase2Tests();

  try { fs.unlinkSync(tmp); } catch (_) {}
  console.log('\n' + passed + ' ta tekshiruv o\'tdi, ' + failed + ' ta xato');
  if (failed) {
    console.error('\n❌ Botni tozalash sinovi MUVAFFAQIYATSIZ:\n - ' + fails.join('\n - '));
    process.exit(1);
  }
  console.log('✅ Botni tozalash (Worker + ilova) — toza');
}

/* ---------------------------------------------------------------------
 *  Phase2 bloki minimal DOM bilan
 * --------------------------------------------------------------------- */
function makeEl(id) {
  const el = {
    id: id || '', tagName: 'DIV', value: '', innerHTML: '', textContent: '', className: '',
    style: { setProperty() {}, cssText: '' }, attrs: {}, children: [], _cls: new Set(), parentNode: null,
    classList: {
      add(c) { el._cls.add(c); }, remove(c) { el._cls.delete(c); }, contains(c) { return el._cls.has(c); },
      toggle(c, on) { if (on === undefined ? !el._cls.has(c) : on) el._cls.add(c); else el._cls.delete(c); },
    },
    setAttribute(k, v) { el.attrs[k] = String(v); }, getAttribute(k) { return k in el.attrs ? el.attrs[k] : null; },
    removeAttribute(k) { delete el.attrs[k]; },
    appendChild(c) { el.children.push(c); return c; }, insertBefore(c) { return c; }, removeChild(c) { return c; },
    insertAdjacentHTML() {}, addEventListener() {}, removeEventListener() {},
    closest() { return null; }, querySelector() { return null; }, querySelectorAll() { return []; },
    remove() {}, focus() {}, getBoundingClientRect() { return { top: 0, left: 0, width: 0, height: 0 }; },
  };
  return el;
}
function loadPhase2(stored) {
  const store = Object.assign({}, stored ? { avto_phase2: JSON.stringify(stored) } : {});
  const updates = [];
  const documentStub = {
    readyState: 'complete', body: makeEl('body'), head: makeEl('head'), documentElement: makeEl('html'),
    getElementById() { return null; }, createElement() { return makeEl(''); },
    querySelector() { return null; }, querySelectorAll() { return []; }, addEventListener() {},
  };
  const firebaseStub = {
    database() {
      return { ref(p) { return { update(patch) { updates.push({ path: p, patch: JSON.parse(JSON.stringify(patch)) }); return Promise.resolve(); } }; } };
    },
  };
  const win = {
    document: documentStub, firebase: firebaseStub,
    localStorage: { getItem(k) { return k in store ? store[k] : null; }, setItem(k, v) { store[k] = String(v); }, removeItem(k) { delete store[k]; } },
    matchMedia() { return { matches: false }; }, addEventListener() {}, requestAnimationFrame(fn) { return 0; },
    innerWidth: 390, innerHeight: 800, myOrders: [], productsDB: [], currentUser: null,
  };
  const ctx = vm.createContext(Object.assign(win, {
    window: win, document: documentStub, firebase: firebaseStub, localStorage: win.localStorage,
    console: { log() {}, warn() {}, error() {} },
    setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {},
    Promise, Map, Set, Math, Date, JSON, Number, Array, Object, String, RegExp, Error,
    isFinite, isNaN, parseInt, parseFloat, encodeURIComponent, decodeURIComponent,
  }));
  vm.runInContext(scriptBlock('a1-phase2-js'), ctx, { filename: 'a1-phase2-js' });
  if (!ctx.window.Phase2) throw new Error('window.Phase2 yaratilmadi');
  return { P: ctx.window.Phase2, updates, store };
}

const tick = () => new Promise((resolve) => setImmediate(resolve));   // Firebase update() tugashi (P._writing)
const hasId = (list, id) => (list || []).some((n) => n && n.id === id);

async function phase2Tests() {
  const STALE = {
    theme: 'light', themeSwitched: true, cashbackTotal: 9000, cashbackSpent: 1000, cashbackRefunded: 500,
    cashbackHistory: [{ date: 1, amount: 9000, type: 'earn' }], notifications: [{ id: 'old', title: 'Eski', date: 1, read: false }],
    achievements: { stale_ach: 1 }, achSeen: 1, processedOrders: { o1_v1: { st: 'yetkazildi' } }, warranties: [{ id: 'w1' }],
  };
  let loaded;
  try { loaded = loadPhase2(STALE); } catch (e) { ok(false, 'Phase2 bloki bajarilmadi: ' + e.message); return; }
  const { P, updates, store } = loaded;
  eq(P.balance(), 8500, 'tozalashgacha: telefonda eski balans (8 500)');
  P.uid = 'U1';
  P.flush();
  await tick();
  const early = updates.pop();
  ok(early && !('notifications' in early.patch) && !('cashbackHistory' in early.patch),
    'serverdagi holat o\'qilmaguncha eski bildirishnoma/keshbek tarixi serverga yozilmaydi');
  const T = 1761800000000;
  P.sync({ phase2: { theme: 'light', themeSwitched: true, resetAt: T } }, 'U1', []);
  await tick();
  eq(P.balance(), 0, 'resetAt keldi — balans 0');
  eq([P.state.cashbackTotal, P.state.cashbackSpent, P.state.cashbackRefunded], [0, 0, 0], 'keshbek hisoblagichlari nolga tushdi');
  ok(!hasId(P.state.notifications, 'old') && P.state.cashbackHistory.length === 0, 'eski bildirishnoma va keshbek tarixi tozalandi');
  ok(!P.state.achievements.stale_ach && !Object.keys(P.state.processedOrders).length && !P.state.warranties.length, 'eski yutuq, ishlangan buyurtmalar va kafolatlar tozalandi');
  eq([P.state.theme, P.state.themeSwitched, P.state.resetAt], ['light', true, T], 'mavzu saqlandi, resetAt eslab qolindi');
  const saved = JSON.parse(store.avto_phase2);
  ok(saved.resetAt === T && saved.cashbackTotal === 0 && !hasId(saved.notifications, 'old'), 'telefon xotirasi ham yangilandi');
  updates.length = 0;
  P.flush();
  await tick();
  const after = updates.pop();
  ok(after && Array.isArray(after.patch.notifications) && !hasId(after.patch.notifications, 'old') &&
    Array.isArray(after.patch.cashbackHistory) && after.patch.cashbackHistory.length === 0,
  'keyingi yozuvda eski ma\'lumot serverga QAYTMAYDI');
  P.sync({ phase2: { theme: 'light', resetAt: T, cashbackTotal: 700, notifications: { sa_1: { id: 'sa_1', title: 'Javob', date: 2 } } } }, 'U1', []);
  await tick();
  ok(P.balance() === 700 && hasId(P.state.notifications, 'sa_1'), 'xuddi shu resetAt — yangi server ma\'lumoti odatdagidek qabul qilinadi');
  // resetAt yo'q — odatdagi xatti-harakat o'zgarmagan
  const plain = loadPhase2(STALE);
  plain.P.sync({ phase2: { theme: 'dark', cashbackTotal: 9000, cashbackSpent: 1000, cashbackRefunded: 500 } }, 'U2', []);
  await tick();
  ok(plain.P.balance() === 8500 && hasId(plain.P.state.notifications, 'old') && plain.P.state.theme === 'dark', 'tozalanmagan mijozda hech narsa o\'zgarmadi');
}

main().catch((e) => { console.error(e); process.exit(1); });
