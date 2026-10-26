/* =====================================================================
   test-order-flow.js — BUYURTMA OQIMINING TO'LIQ SINOVI (Worker)
   ---------------------------------------------------------------------
   Haqiqiy cloudflare-worker.js import qilinadi (nusxa emas). Tashqi
   xizmatlar SOXTA, lekin haqiqiy xatti-harakat bilan:
     • Firebase RTDB  — ETag / If-Match (412), massiv <-> obyekt;
     • Google OAuth   — access_token;
     • Telegram API   — har chaqiruv yoziladi, xato berdirish mumkin.
   Qo'riqlanadigan narsalar (hammasi haqiqiy nosozliklardan):
     1) Yangi buyurtma BARCHA adminlarga tugmali kartochka bilan boradi
        (ilgari faqat ADMIN_IDS[0], tugmasiz, mijoz brauzeridan).
     2) Takroriy so'rov dublikat xabar bermaydi.
     3) Holat o'zgarsa kartochkalar yangilanadi, mijozga xabar boradi.
     4) Bot HMAC imzosi: to'g'ri — o'tadi; buzuq/eski/begona — rad.
     5) Mijoz faqat "kutilmoqda" buyurtmani bekor qila oladi.
     6) Qaytarish (yetkazildi -> bekor): stok + cashback qaytadi.
     7) Eski (legacy) buyurtma holatini o'zgartirish mumkin (ilgari 404).
     8) O'chirilgan tovar bekor qilishni BLOKLAMAYDI.
     9) Telegram vaqtincha ishlamasa — /order-notify faqat yetmaganlarga.
    9b) Mijoz xabari KO'PI BILAN BIR MARTA (yakuniy yozuv yo'qolsa ham —
        ilgari "qabul qilindi" ikki marta kelardi); 429 — qayta yuboriladi.
    9c) notifyMode:"split" + /order-deliver; Cloudflare bepul rejasi
        byudjeti (bitta so'rovga 50 ta tashqi fetch) oshib ketmaydi.
   Ishga tushirish: node .github/test-order-flow.js
   ===================================================================== */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const nodeCrypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const BOT_TOKEN = '123:TEST_TOKEN_FOR_ORDER_FLOW';
const ADMINS = ['5105291033', '483425630', '5302078'];
const CUSTOMER = '777000111';
const OTHER = '777000222';

let passed = 0, failed = 0;
const fails = [];
function ok(cond, msg) {
  if (cond) { passed++; }
  else { failed++; fails.push(msg); console.error('  ❌ ' + msg); }
}
function eq(a, b, msg) {
  const A = JSON.stringify(a), B = JSON.stringify(b);
  ok(A === B, msg + '  (kutilgan ' + B + ', chiqdi ' + A + ')');
}

// ---------------------------------------------------------------------
//  SOXTA RTDB
// ---------------------------------------------------------------------
function clone(v) { return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); }
function normalize(v) {
  // Firebase massivni obyekt sifatida saqlaydi; o'qishda zich raqamli
  // kalitlarni yana massivga aylantiradi.
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
  constructor(data) { this.root = normalize(clone(data)) || {}; this.writes = []; }
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
    this.writes.push(p);
  }
  etag(p) { return '"' + nodeCrypto.createHash('sha1').update(JSON.stringify(this.get(p))).digest('hex') + '"'; }
  read(p) { return render(clone(this.get(p))); }
}

// ---------------------------------------------------------------------
//  SOXTA fetch
// ---------------------------------------------------------------------
const DB_URL = 'https://test-rtdb.example';
let db, tgCalls, tgFail, tgThrow, dbFail, msgSeq;
// Har bir chaqiruvdagi tashqi fetch soni (Cloudflare bepul rejasi: 50 ta).
let fetchCount = 0;
function resetWorld(data) {
  db = new FakeDB(data);
  tgCalls = [];
  tgFail = null;   // (method, payload) => null | {status, description}
  tgThrow = null;  // (method, payload) => true — fetch tarmoq xatosi tashlaydi
  dbFail = null;   // (method, path, body) => null | HTTP status
  msgSeq = 1000;
}
function jsonResponse(obj, status, headers) {
  return new Response(JSON.stringify(obj), { status: status || 200, headers: Object.assign({ 'Content-Type': 'application/json' }, headers || {}) });
}
globalThis.fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input.url;
  const opts = init || {};
  const method = String(opts.method || 'GET').toUpperCase();
  fetchCount++;
  if (url.startsWith('https://oauth2.googleapis.com/token')) {
    return jsonResponse({ access_token: 'test-access-token', expires_in: 3600 });
  }
  if (url.startsWith('https://api.telegram.org/bot')) {
    const tail = url.slice('https://api.telegram.org/bot'.length);
    const tgMethod = tail.slice(tail.indexOf('/') + 1);
    const payload = JSON.parse(opts.body || '{}');
    tgCalls.push({ method: tgMethod, payload });
    if (tgThrow && tgThrow(tgMethod, payload)) throw new Error('network connection lost');
    const f = tgFail && tgFail(tgMethod, payload);
    if (f) return jsonResponse({ ok: false, description: f.description || 'fail' }, f.status || 500);
    return jsonResponse({ ok: true, result: { message_id: ++msgSeq } });
  }
  if (url.startsWith(DB_URL)) {
    const u = new URL(url);
    const p = decodeURIComponent(u.pathname.replace(/\.json$/, ''));
    const h = new Headers(opts.headers || {});
    if (h.get('Authorization') !== 'Bearer test-access-token') return jsonResponse({ error: 'auth' }, 401);
    const dbErr = dbFail && dbFail(method, p, opts.body);
    if (dbErr) return jsonResponse({ error: 'injected' }, dbErr);
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
function initDataFor(uid, ageSeconds, firstName) {
  const authDate = Math.floor(Date.now() / 1000) - (ageSeconds || 0);
  const params = new URLSearchParams();
  params.set('auth_date', String(authDate));
  params.set('query_id', 'AAH' + uid);
  params.set('user', JSON.stringify({ id: Number(uid), first_name: firstName || 'Test' }));
  const pairs = [];
  for (const [k, v] of params) pairs.push(k + '=' + v);
  pairs.sort();
  const secret = hmac('WebAppData', BOT_TOKEN);
  params.set('hash', hmac(secret, pairs.join('\n')).toString('hex'));
  return params.toString();
}
function botAuth(route, actor, fields, tsOverride) {
  const ts = tsOverride || Math.floor(Date.now() / 1000);
  const key = nodeCrypto.createHash('sha256').update('avto-a1-bot-auth|' + BOT_TOKEN).digest();
  const msg = ['a1bot', route, String(ts), String(actor)].concat(fields.map(String)).join('|');
  return { ts, actor: String(actor), sig: hmac(key, msg).toString('hex') };
}

let worker, env;
async function call(route, body) {
  const req = new Request('https://worker.test' + route, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
      { id: 2, name: 'Klapan', price: 50000, stock: 10, product_type: 'razmerli',
        sizes: [{ size: '92.5', stock: 4 }, { size: '93', stock: 2 }] },
      { id: 3, name: 'Moy filtri', price: 30000, stock: 7 },
    ],
    users: {
      [CUSTOMER]: { profile: { name: 'Ali', phone: '+998901112233', lang: 'uz' } },
      [OTHER]: { profile: { name: 'Vali', phone: '+998905556677', lang: 'ru' } },
    },
  };
}

async function placeOrder(uid, items, attemptId) {
  return call('/order-commit', {
    initData: initDataFor(uid),
    attemptId: attemptId || ('att_' + uid + '_' + Math.random().toString(36).slice(2, 10)),
    items,
    customer: { name: uid === CUSTOMER ? 'Ali' : 'Vali', phone: '+998901112233', address: 'Toshkent' },
    delivery: { method: 'courier', address: 'Chilonzor 5' },
    payment: { method: 'Naqd pul (yetkazilganda)' },
  });
}
async function setStatus(actorUid, uid, orderId, status, extra) {
  return call('/order-status', Object.assign({ initData: initDataFor(actorUid, 0, 'Anvar'), uid, orderId, status }, extra || {}));
}
async function botStatus(actor, uid, orderId, status, expectedFrom, tamper) {
  const auth = botAuth('order-status', actor, [uid, orderId, status, expectedFrom || '']);
  if (tamper) tamper(auth);
  const body = { uid, orderId, status, botAuth: auth };
  if (expectedFrom) body.expectedFrom = expectedFrom;
  return call('/order-status', body);
}
const stockOf = (idx) => db.read('products/' + idx + '/stock');

// ---------------------------------------------------------------------
async function main() {
  const tmp = path.join(os.tmpdir(), 'avto_worker_' + process.pid + '.mjs');
  fs.copyFileSync(path.join(ROOT, 'cloudflare-worker.js'), tmp);
  worker = (await import('file://' + tmp)).default;
  const { privateKey } = nodeCrypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  env = {
    BOT_TOKEN,
    FIREBASE_CLIENT_EMAIL: 'svc@test.iam.gserviceaccount.com',
    FIREBASE_PRIVATE_KEY: privateKey.export({ type: 'pkcs8', format: 'pem' }),
    FIREBASE_DB_URL: DB_URL,
    ADMIN_IDS: ADMINS.join(','),
  };

  // ===== 1) Yangi buyurtma -> BARCHA adminlarga tugmali kartochka =====
  console.log('▶ 1) yangi buyurtma bildirishnomasi');
  resetWorld(baseData());
  const r1 = await placeOrder(CUSTOMER, [{ id: '1', size: '', qty: 2 }], 'attempt_one_123');
  eq(r1.status, 201, 'buyurtma yaratildi (201)');
  ok(r1.data && r1.data.notify === 'server', 'javobda notify:"server" bor (ilova o\'zi yubormaydi)');
  const o1 = r1.data.order;
  const key1 = CUSTOMER + '_' + o1.id;
  const sends1 = tgBy('sendMessage');
  const adminSends = sends1.filter((c) => ADMINS.includes(String(c.payload.chat_id)));
  eq(adminSends.map((c) => String(c.payload.chat_id)).sort(), ADMINS.slice().sort(), 'UCHALA adminga ham kartochka ketdi');
  ok(adminSends.every((c) => c.payload.reply_markup && c.payload.reply_markup.inline_keyboard.length === 2), 'kartochkada tugmalar bor');
  ok(adminSends[0].payload.text.includes('YANGI BUYURTMA') && adminSends[0].payload.text.includes('Porshen'), 'kartochkada mahsulot nomi bor');
  ok(adminSends[0].payload.text.includes('200 000'), 'kartochkada jami summa bor');
  const cust1 = sends1.filter((c) => String(c.payload.chat_id) === CUSTOMER);
  eq(cust1.length, 1, 'mijozga bitta tasdiq ketdi');
  ok(cust1[0].payload.text.includes(o1.code), 'mijoz xabarida buyurtma kodi bor');
  const ob1 = db.read('notification_outbox/' + key1);
  ok(ob1 && ob1.delivered === true && ob1.state === 'sent', 'outbox yetkazildi deb belgilandi');
  eq(Object.keys(db.read('order_tg/' + key1 + '/msgs') || {}).sort(), ADMINS.slice().sort(), 'har admin kartochkasi message_id saqlandi');
  eq(stockOf(0), 3, 'stok serverda kamaydi (5 -> 3)');

  // ===== 2) Takroriy so'rov — dublikat xabar YO'Q =====
  console.log('▶ 2) takroriy so\'rov');
  const before = tgCalls.length;
  const r1b = await placeOrder(CUSTOMER, [{ id: '1', size: '', qty: 2 }], 'attempt_one_123');
  eq(r1b.status, 200, 'takror -> 200');
  eq(r1b.data.order.id, o1.id, 'takror o\'sha buyurtmani qaytardi');
  eq(tgCalls.length, before, 'takror Telegram xabar YUBORMADI');
  eq(stockOf(0), 3, 'takror stokni ikkinchi marta kamaytirmadi');

  // ===== 3) Admin (Mini App) qabul qiladi -> kartochkalar yangilanadi =====
  console.log('▶ 3) admin holatni o\'zgartiradi');
  tgCalls = [];
  const r3 = await setStatus(ADMINS[1], CUSTOMER, o1.id, 'qabul');
  eq(r3.status, 200, 'qabul -> 200');
  ok(r3.data.notify === 'server', 'holat javobida notify:"server"');
  const edits = tgBy('editMessageText');
  eq(edits.length, 3, 'uchala admin kartochkasi tahrirlandi');
  ok(edits.every((c) => c.payload.reply_markup.inline_keyboard[0][0].callback_data.startsWith('ord:y:')), 'keyingi tugma — "Yo\'lga chiqdi"');
  ok(edits[0].payload.text.includes('Qabul qilindi') && edits[0].payload.text.includes('Anvar'), 'kartochkada yangi holat va kim o\'zgartirgani');
  const cust3 = tgBy('sendMessage').filter((c) => String(c.payload.chat_id) === CUSTOMER);
  eq(cust3.length, 1, 'mijozga holat xabari ketdi');
  ok(cust3[0].payload.text.includes('qabul qilindi') && cust3[0].payload.text.includes('Porshen'), 'mijoz xabarida tovarlar ro\'yxati bor (ilgari bo\'sh edi)');
  eq(db.read('users/' + CUSTOMER + '/orders/' + o1.id + '/status'), 'qabul', 'mijoz ro\'yxati yangilandi');
  eq(db.read('orders/' + key1 + '/status'), 'qabul', 'markaziy yozuv yangilandi');
  // takroriy bosish
  tgCalls = [];
  const r3b = await setStatus(ADMINS[0], CUSTOMER, o1.id, 'qabul');
  ok(r3b.status === 200 && r3b.data.duplicate === true, 'qayta bosish — duplicate, xato emas');
  eq(tgCalls.length, 0, 'qayta bosish yangi xabar yubormadi');

  // ===== 4) Bot HMAC imzosi =====
  console.log('▶ 4) bot imzosi');
  const bad = await botStatus(ADMINS[0], CUSTOMER, o1.id, 'yolda', '', (a) => { a.sig = a.sig.replace(/^./, (c) => (c === 'a' ? 'b' : 'a')); });
  eq(bad.status, 401, 'buzuq imzo -> 401');
  const stale = await call('/order-status', { uid: CUSTOMER, orderId: o1.id, status: 'yolda',
    botAuth: botAuth('order-status', ADMINS[0], [CUSTOMER, o1.id, 'yolda', ''], Math.floor(Date.now() / 1000) - 3600) });
  eq(stale.status, 401, 'eski imzo -> 401');
  const notAdmin = await botStatus(CUSTOMER, CUSTOMER, o1.id, 'yolda');
  eq(notAdmin.status, 403, 'admin bo\'lmagan actor -> 403');
  const swapped = await call('/order-status', { uid: CUSTOMER, orderId: o1.id, status: 'bekor_qilingan',
    botAuth: botAuth('order-status', ADMINS[0], [CUSTOMER, o1.id, 'yolda', '']) });
  eq(swapped.status, 401, 'imzolangan maydonni almashtirish -> 401');
  eq(db.read('orders/' + key1 + '/status'), 'qabul', 'rad etilgan so\'rovlar hech narsa o\'zgartirmadi');
  const wrongFrom = await botStatus(ADMINS[0], CUSTOMER, o1.id, 'yolda', 'kutilmoqda');
  eq(wrongFrom.status, 409, 'expectedFrom mos emas -> 409');
  const good = await botStatus(ADMINS[0], CUSTOMER, o1.id, 'yolda', 'qabul');
  eq(good.status, 200, 'to\'g\'ri imzo -> holat o\'zgardi');
  eq(db.read('orders/' + key1 + '/status'), 'yolda', 'bot orqali yolda');
  const skip = await botStatus(ADMINS[0], CUSTOMER, o1.id, 'kutilmoqda');
  eq(skip.status, 409, 'orqaga (yolda -> kutilmoqda) o\'tish taqiqlangan');

  // ===== 5) Mijozning bekor qilishi =====
  console.log('▶ 5) mijoz bekor qilishi');
  const late = await setStatus(CUSTOMER, CUSTOMER, o1.id, 'bekor_qilingan');
  eq(late.status, 409, 'yo\'ldagi buyurtmani mijoz bekor qila olmaydi');
  const r5 = await placeOrder(CUSTOMER, [{ id: '2', size: '92.5', qty: 3 }], 'attempt_two_123');
  eq(r5.status, 201, '2-buyurtma yaratildi');
  const o2 = r5.data.order;
  eq(db.read('products/1/sizes/0/stock'), 1, 'razmer stoki kamaydi (4 -> 1)');
  const foreign = await setStatus(OTHER, CUSTOMER, o2.id, 'bekor_qilingan');
  eq(foreign.status, 403, 'begona mijoz bekor qila olmaydi');
  const accept = await setStatus(CUSTOMER, CUSTOMER, o2.id, 'qabul');
  eq(accept.status, 403, 'mijoz o\'zi qabul qila olmaydi');
  tgCalls = [];
  const self = await setStatus(CUSTOMER, CUSTOMER, o2.id, 'bekor_qilingan');
  eq(self.status, 200, 'mijoz kutilmoqda buyurtmani bekor qildi');
  eq(db.read('products/1/sizes/0/stock'), 4, 'razmer stoki qaytdi (1 -> 4)');
  const alerts = tgBy('sendMessage').filter((c) => ADMINS.includes(String(c.payload.chat_id)));
  eq(alerts.length, 3, 'uchala adminga "mijoz bekor qildi" ogohlantirishi');
  ok(alerts[0].payload.text.includes('Mijoz buyurtmani bekor qildi'), 'ogohlantirish matni');
  ok(alerts[0].payload.reply_parameters && alerts[0].payload.reply_parameters.message_id, 'ogohlantirish kartochkaga javob sifatida');
  const selfMsg = tgBy('sendMessage').filter((c) => String(c.payload.chat_id) === CUSTOMER);
  ok(selfMsg.length === 1 && selfMsg[0].payload.text.includes('bekor qildingiz'), 'mijozga "siz bekor qildingiz" xabari');
  eq(tgBy('editMessageText').length, 3, 'kartochkalar "bekor" holatiga yangilandi');
  eq(tgBy('editMessageText')[0].payload.reply_markup.inline_keyboard, [], 'bekor kartochkada tugma qolmadi');

  // ===== 6) Yetkazildi -> Qaytarish =====
  console.log('▶ 6) yetkazildi va qaytarish');
  const d = await setStatus(ADMINS[0], CUSTOMER, o1.id, 'yetkazildi');
  eq(d.status, 200, 'yetkazildi');
  const earned = db.read('loyalty_accounts/' + CUSTOMER + '/earned');
  ok(earned > 0, 'cashback berildi (' + earned + ')');
  tgCalls = [];
  const ret = await setStatus(ADMINS[0], CUSTOMER, o1.id, 'bekor_qilingan');
  eq(ret.status, 200, 'yetkazilgan buyurtmani qaytarish mumkin (ilgari taqiqlangan edi)');
  eq(stockOf(0), 5, 'qaytarilgan tovar omborga qaytdi (3 -> 5)');
  eq(db.read('loyalty_accounts/' + CUSTOMER + '/reversed'), earned, 'berilgan cashback qaytarib olindi');
  const retMsg = tgBy('sendMessage').filter((c) => String(c.payload.chat_id) === CUSTOMER);
  ok(retMsg.length === 1 && retMsg[0].payload.text.includes('qaytarildi'), 'mijozga "qaytarildi" xabari');
  const again = await setStatus(ADMINS[0], CUSTOMER, o1.id, 'qabul');
  eq(again.status, 409, 'bekor qilingandan keyin hech qayerga o\'tib bo\'lmaydi');

  // ===== 7) Eski (legacy) buyurtma =====
  console.log('▶ 7) eski buyurtma');
  const legacyData = baseData();
  legacyData.users[OTHER].orders = [
    { id: 1700000000001, code: 'A1-OLD01', status: 'kutilmoqda', total: 100000, items: { '2||92_dot_5': 2 }, date: '01.01.2025', time: '10:00' },
    { id: 1700000000002, code: 'A1-OLD02', status: 'qabul', total: 30000, items: { '3||Universal': 1 } },
  ];
  legacyData.products[1].sizes[0].stock = 1;
  resetWorld(legacyData);
  const l1 = await setStatus(ADMINS[0], OTHER, '1700000000002', 'yolda');
  eq(l1.status, 200, 'eski buyurtma holati o\'zgardi (ilgari 404 edi)');
  const usersOrders = db.read('users/' + OTHER + '/orders');
  const legacyArr = Array.isArray(usersOrders) ? usersOrders : Object.values(usersOrders);
  eq(legacyArr.find((o) => o.code === 'A1-OLD02').status, 'yolda', 'mijoz ro\'yxatidagi eski yozuv yangilandi');
  eq(legacyArr.find((o) => o.code === 'A1-OLD01').status, 'kutilmoqda', 'qo\'shni eski buyurtmaga tegilmadi');
  ok(db.read('orders/' + OTHER + '_1700000000002/legacyAdopted') === true, 'markaziy yozuv yaratildi');
  const ruMsg = tgBy('sendMessage').filter((c) => String(c.payload.chat_id) === OTHER);
  ok(ruMsg.length === 1 && ruMsg[0].payload.text.includes('в пути'), 'mijozga O\'Z TILIDA (rus) xabar');
  const l2 = await setStatus(ADMINS[0], OTHER, '1700000000001', 'bekor_qilingan');
  eq(l2.status, 200, 'eski buyurtmani bekor qilish');
  eq(db.read('products/1/sizes/0/stock'), 3, 'eski "92_dot_5" razmeri to\'g\'ri tiklandi (1 -> 3)');

  // ===== 7b) Eski buyurtma — pul xavfsizligi (review topilmalari) =====
  console.log('▶ 7b) eski buyurtma: cashback ikki marta qaytmasligi');
  const lg = baseData();
  lg.users[CUSTOMER].orders = [
    // eski oqimda bekor qilingan, cashback eski mijoz kodi tomonidan QAYTARILGAN
    { id: 1700000000010, code: 'A1-C1', status: 'bekor_qilingan', total: 100000, cashbackUsed: 20000, items: { '1||Universal': 1 } },
    // eski oqimda yetkazilgan (cashback eski kod bilan berilgan)
    { id: 1700000000011, code: 'A1-D1', status: 'yetkazildi', total: 100000, items: { '1||Universal': 1 } },
    // eski "kutilmoqda" (aslida berilgan bo'lishi mumkin)
    { id: 1700000000012, code: 'A1-K1', status: 'kutilmoqda', total: 50000, items: { '3': 2, '1||Gazel Biznes': 1 } },
  ];
  lg.users[CUSTOMER].phase2 = { cashbackTotal: 5000, cashbackSpent: 20000, cashbackRefunded: 20000 };
  resetWorld(lg);
  const dupCust = await setStatus(CUSTOMER, CUSTOMER, '1700000000010', 'bekor_qilingan');
  eq(dupCust.status, 403, 'mijoz eski buyurtmani bekor qila olmaydi');
  tgCalls = [];
  const dupAdm = await setStatus(ADMINS[0], CUSTOMER, '1700000000010', 'bekor_qilingan');
  ok(dupAdm.status === 200 && dupAdm.data.duplicate === true, 'eski bekor buyurtmaga takror — duplicate');
  const acct = db.read('loyalty_accounts/' + CUSTOMER);
  ok(!acct || !acct.refunded || acct.refunded === 20000, 'cashback IKKINCHI marta qaytarilmadi (refunded=' + (acct && acct.refunded) + ')');
  eq(tgCalls.length, 0, 'takror — mijozga yana "bekor qilindi" xabari ketmadi');
  const retLegacy = await setStatus(ADMINS[0], CUSTOMER, '1700000000011', 'bekor_qilingan');
  eq(retLegacy.status, 409, 'eski oqimda yetkazilgan buyurtmani qaytarish bloklandi');
  eq(stockOf(0), 5, 'bloklangan qaytarish stokka tegmadi');
  const selfLegacy = await setStatus(CUSTOMER, CUSTOMER, '1700000000012', 'bekor_qilingan');
  eq(selfLegacy.status, 403, 'mijoz eski "kutilmoqda" buyurtmani ham bekor qila olmaydi');
  const admLegacy = await setStatus(ADMINS[0], CUSTOMER, '1700000000012', 'bekor_qilingan');
  eq(admLegacy.status, 200, 'admin eski buyurtmani bekor qila oladi');
  eq(stockOf(2), 9, '"||" siz eski kalit ("3") omborga qaytdi (7 -> 9)');
  eq(stockOf(0), 6, 'razmersiz tovardagi mashina nomi ("1||Gazel Biznes") umumiy stokka qaytdi');
  const toKut = await setStatus(ADMINS[0], CUSTOMER, '1700000000011', 'kutilmoqda');
  eq(toKut.status, 409, 'hech qaysi holatdan "kutilmoqda" ga o\'tib bo\'lmaydi');

  // ===== 7c) Mashina modeli tanlangan razmersiz tovar =====
  console.log('▶ 7c) mashina modeli tanlovi');
  resetWorld(baseData());
  const car = await placeOrder(CUSTOMER, [{ id: '1', size: 'Gazel Biznes', qty: 1 }, { id: '1', size: 'Gazel Next', qty: 1 }], 'attempt_car_123');
  eq(car.status, 201, 'mashina tanlangan oddiy tovar SOTIB OLINADI (ilgari 400 edi)');
  eq(stockOf(0), 3, 'umumiy stokdan ayirildi (5 -> 3)');
  const carCard = tgBy('sendMessage').find((c) => String(c.payload.chat_id) === ADMINS[0]);
  ok(carCard && carCard.payload.text.includes('Gazel Biznes') && carCard.payload.text.includes('Gazel Next'), 'kartochkada mashina modeli ko\'rinadi');
  eq(Object.keys(car.data.order.items).length, 2, 'ikki mashina — ikki alohida qator');
  const carCancel = await setStatus(ADMINS[0], CUSTOMER, car.data.order.id, 'bekor_qilingan');
  ok(carCancel.status === 200 && stockOf(0) === 5, 'bekor qilinganda stok to\'liq qaytdi');

  // ===== 7d) Kartochka HTML'i rad etilsa — oddiy matn =====
  console.log('▶ 7d) kartochka zaxira yo\'li');
  resetWorld(baseData());
  tgFail = (m, p) => (m === 'sendMessage' && p.parse_mode === 'HTML' && ADMINS.includes(String(p.chat_id))
    ? { status: 400, description: "Bad Request: can't parse entities" } : null);
  const pf = await placeOrder(CUSTOMER, [{ id: '1', size: '', qty: 1 }], 'attempt_parse_123');
  const plainCards = tgBy('sendMessage').filter((c) => ADMINS.includes(String(c.payload.chat_id)) && !c.payload.parse_mode);
  eq(plainCards.length, 3, 'HTML rad etilsa — uchala adminga ODDIY MATN kartochka ketdi');
  ok(plainCards[0].payload.reply_markup && !/<b>/.test(plainCards[0].payload.text), 'oddiy matnda teg yo\'q, tugmalar bor');
  ok(db.read('notification_outbox/' + CUSTOMER + '_' + pf.data.order.id).delivered === true, 'yetkazildi');
  tgFail = null;
  resetWorld(baseData());
  const longName = '&'.repeat(100);
  const lr = await call('/order-commit', { initData: initDataFor(CUSTOMER), attemptId: 'attempt_long_123',
    items: [{ id: '1', size: '', qty: 1 }],
    customer: { name: longName, phone: '+998901112233', address: '&'.repeat(300) },
    delivery: { method: 'courier', address: '&'.repeat(300), note: '&'.repeat(500) }, payment: { method: 'Naqd' } });
  eq(lr.status, 201, 'juda uzun maydonli buyurtma');
  const longCards = tgBy('sendMessage').filter((c) => ADMINS.includes(String(c.payload.chat_id)));
  ok(longCards.length === 3 && longCards.every((c) => c.payload.text.length <= 4096), 'juda uzun kartochka ham yetib bordi (<=4096)');

  // ===== 8) O'chirilgan tovar bekor qilishni bloklamaydi =====
  console.log('▶ 8) o\'chirilgan tovar');
  resetWorld(baseData());
  const r8 = await placeOrder(CUSTOMER, [{ id: '3', size: '', qty: 1 }, { id: '1', size: '', qty: 1 }], 'attempt_del_123');
  const o8 = r8.data.order;
  db.set('products/2', null);   // Moy filtri o'chirildi
  const c8 = await setStatus(ADMINS[0], CUSTOMER, o8.id, 'bekor_qilingan');
  eq(c8.status, 200, 'o\'chirilgan tovar bo\'lsa ham bekor qilindi');
  ok(Array.isArray(c8.data.restockSkipped) && c8.data.restockSkipped[0].id === '3', 'o\'tkazib yuborilgan qator adminga ko\'rsatildi');
  eq(stockOf(0), 5, 'qolgan tovar stoki tiklandi');

  // ===== 9) Telegram vaqtincha ishlamasa — qayta urinish =====
  console.log('▶ 9) Telegram nosozligi va /order-notify');
  resetWorld(baseData());
  tgFail = (m, p) => (m === 'sendMessage' && String(p.chat_id) === ADMINS[2] ? { status: 502, description: 'Bad Gateway' } : null);
  const r9 = await placeOrder(CUSTOMER, [{ id: '1', size: '', qty: 1 }], 'attempt_fail_123');
  const key9 = CUSTOMER + '_' + r9.data.order.id;
  const ob9 = db.read('notification_outbox/' + key9);
  ok(ob9.delivered === false && ob9.state === 'retry', 'yetmagan xabar "retry" holatida qoldi');
  ok(ob9.retryAt > Date.now(), 'keyingi urinish vaqti (retryAt) belgilandi');
  ok(ob9.done['admin_' + ADMINS[0]] === true && !ob9.done['admin_' + ADMINS[2]], 'kimga yetgani alohida belgilandi');
  tgFail = null;
  tgCalls = [];
  const badNotify = await call('/order-notify', { outboxKey: key9, botAuth: botAuth('order-notify', ADMINS[0], ['boshqa']) });
  eq(badNotify.status, 401, '/order-notify imzosiz/buzuq -> 401');
  const n9 = await call('/order-notify', { outboxKey: key9, botAuth: botAuth('order-notify', ADMINS[0], [key9]) });
  eq(n9.status, 200, '/order-notify ishladi');
  const resent = tgBy('sendMessage').map((c) => String(c.payload.chat_id));
  eq(resent, [ADMINS[2]], 'faqat yetmagan adminga qayta yuborildi (dublikat yo\'q)');
  ok(db.read('notification_outbox/' + key9).delivered === true, 'endi yetkazildi');
  ok(db.read('notification_outbox/' + key9).retryAt == null, 'yetkazilgach retryAt o\'chdi (watchdog indeksidan chiqdi)');
  const n9b = await call('/order-notify', { outboxKey: key9, botAuth: botAuth('order-notify', ADMINS[0], [key9]) });
  ok(n9b.data.state === 'delivered', 'yetkazilganini qayta yubormaydi');
  // Ko'p urinishdan keyin voz kechadi (abadiy indeksda qolmaydi)
  resetWorld(baseData());
  tgFail = (m, p) => (String(p.chat_id) === ADMINS[1] ? { status: 502, description: 'down' } : null);
  const r9g = await placeOrder(CUSTOMER, [{ id: '1', size: '', qty: 1 }], 'attempt_giveup_123');
  const key9g = CUSTOMER + '_' + r9g.data.order.id;
  for (let i = 0; i < 8; i++) {
    db.set('notification_outbox/' + key9g + '/leaseUntil', 0);
    await call('/order-notify', { outboxKey: key9g, botAuth: botAuth('order-notify', ADMINS[0], [key9g]) });
  }
  const ob9g = db.read('notification_outbox/' + key9g);
  ok(ob9g.state === 'gave_up' && ob9g.retryAt == null, '8 urinishdan keyin voz kechildi, retryAt o\'chdi');
  // Worker 8-urinishda "o'ldirilgan" (attempts=8, retryAt qolgan) — /order-notify uni yakunlaydi
  db.set('notification_outbox/' + key9g + '/retryAt', Date.now() - 1000);
  db.set('notification_outbox/' + key9g + '/state', 'sending');
  const stuck = await call('/order-notify', { outboxKey: key9g, botAuth: botAuth('order-notify', ADMINS[0], [key9g]) });
  ok(stuck.data.state === 'gave_up' && db.read('notification_outbox/' + key9g + '/retryAt') == null, 'osilib qolgan yozuv indeksdan chiqarildi');
  // Ikki xil mashina — umumiy stokdan oshib ketmaydi
  resetWorld(baseData());
  const over = await placeOrder(CUSTOMER, [{ id: '1', size: 'Gazel Biznes', qty: 3 }, { id: '1', size: 'Gazel Next', qty: 3 }], 'attempt_over_123');
  ok(over.status === 409 && over.data.error === 'stock', 'ikki mashina birga stokdan oshsa — rad (oversell yo\'q)');
  eq(stockOf(0), 5, 'rad etilganda stok o\'zgarmadi');
  tgFail = null;
  // Bloklangan mijoz (403) — abadiy qayta urinmaydi
  resetWorld(baseData());
  tgFail = (m, p) => (String(p.chat_id) === CUSTOMER ? { status: 403, description: 'Forbidden: bot was blocked by the user' } : null);
  const r9c = await placeOrder(CUSTOMER, [{ id: '1', size: '', qty: 1 }], 'attempt_block_123');
  const ob9c = db.read('notification_outbox/' + CUSTOMER + '_' + r9c.data.order.id);
  ok(ob9c.delivered === true && String(ob9c.done.customer).startsWith('err:'), 'botni bloklagan mijoz — doimiy xato, qayta urinilmaydi');

  // ===== 9b) Mijoz xabari KO'PI BILAN BIR MARTA (dublikat "qabul qilindi") =====
  console.log('▶ 9b) mijoz xabari ikki marta ketmaydi');
  const custSends = () => tgBy('sendMessage').filter((c) => String(c.payload.chat_id) === CUSTOMER);
  const notifyAgain = async (key) => {
    db.set('notification_outbox/' + key + '/leaseUntil', 0);
    return call('/order-notify', { outboxKey: key, botAuth: botAuth('order-notify', ADMINS[0], [key]) });
  };
  // a) Xabar ketdi, lekin YAKUNIY yozuv yo'qoldi (ilgari: watchdog qayta yuborardi)
  resetWorld(baseData());
  dbFail = (m, p, b) => (m === 'PUT' && p.startsWith('/notification_outbox/') && String(b || '').includes('"finishedAt"') ? 503 : null);
  const r9d = await placeOrder(CUSTOMER, [{ id: '1', size: '', qty: 1 }], 'attempt_dup_123');
  eq(r9d.status, 201, 'buyurtma yaratildi');
  const key9d = CUSTOMER + '_' + r9d.data.order.id;
  eq(custSends().length, 1, 'mijozga birinchi xabar ketdi');
  eq(db.read('notification_outbox/' + key9d + '/done/customer'), 'sending', 'yuborishdan OLDIN "sending" belgisi bazada');
  dbFail = null;
  await notifyAgain(key9d);
  eq(custSends().length, 1, 'yakuniy yozuv yo\'qolsa ham watchdog mijozga QAYTA yubormadi');
  ok(db.read('notification_outbox/' + key9d).delivered === true, 'keyingi urinish yozuvni yakunladi');
  eq(tgBy('sendMessage').filter((c) => ADMINS.includes(String(c.payload.chat_id))).length, 3, 'adminlarga ham dublikat ketmadi');
  // b) Belgini yozib bo'lmadi — bu safar YUBORILMAYDI, keyingi urinish yuboradi
  resetWorld(baseData());
  dbFail = (m, p) => (m === 'PATCH' && /\/notification_outbox\/[^/]+\/done$/.test(p) ? 503 : null);
  const r9e = await placeOrder(CUSTOMER, [{ id: '1', size: '', qty: 1 }], 'attempt_mark_123');
  const key9e = CUSTOMER + '_' + r9e.data.order.id;
  eq(custSends().length, 0, 'belgi yozilmasa mijozga yuborilmadi (dublikat xavfi yo\'q)');
  ok(db.read('notification_outbox/' + key9e).state === 'retry', 'hodisa qayta urinishga qoldi');
  dbFail = null;
  await notifyAgain(key9e);
  eq(custSends().length, 1, 'keyingi urinish mijozga BIR marta yubordi');
  // c) Telegram 429 (javob keldi — xabar yetmagan) — qayta yuboriladi
  resetWorld(baseData());
  tgFail = (m, p) => (String(p.chat_id) === CUSTOMER ? { status: 429, description: 'Too Many Requests' } : null);
  const r9f = await placeOrder(CUSTOMER, [{ id: '1', size: '', qty: 1 }], 'attempt_429_123');
  const key9f = CUSTOMER + '_' + r9f.data.order.id;
  ok(!db.read('notification_outbox/' + key9f + '/done/customer'), '429 dan keyin belgi olib tashlandi');
  tgFail = null;
  await notifyAgain(key9f);
  eq(custSends().length, 2, '429 — keyingi urinish mijozga qayta yubordi (1 rad etilgan + 1 yetgan)');
  ok(db.read('notification_outbox/' + key9f + '/done/customer') === true, 'endi yetkazildi');
  // d) Tarmoq uzildi (yetganmi — noma'lum) — dublikatdan ko'ra yo'qotish
  resetWorld(baseData());
  tgThrow = (m, p) => String(p.chat_id) === CUSTOMER;
  const r9g2 = await placeOrder(CUSTOMER, [{ id: '1', size: '', qty: 1 }], 'attempt_net_123');
  const key9g2 = CUSTOMER + '_' + r9g2.data.order.id;
  tgThrow = null;
  ok(String(db.read('notification_outbox/' + key9g2 + '/done/customer')).startsWith('uncertain'), 'noaniq natija belgilandi');
  ok(db.read('notification_outbox/' + key9g2).delivered === true, 'noaniq mijoz xabari qayta urinishga sabab bo\'lmadi');
  // e) Matnlar: "yuborildi" va "qabul qilindi" endi bir-biriga o'xshamaydi
  resetWorld(baseData());
  const r9h = await placeOrder(CUSTOMER, [{ id: '1', size: '', qty: 1 }], 'attempt_txt_123');
  const created = custSends()[0].payload.text;
  ok(!/qabul qilindi/i.test(created) && /yuborildi/.test(created), 'yangi buyurtma xabari "qabul qilindi" demaydi');
  tgCalls = [];
  await setStatus(ADMINS[0], CUSTOMER, r9h.data.order.id, 'qabul');
  const accepted = custSends()[0].payload.text;
  ok(/qabul qilindi/.test(accepted) && accepted.split('\n')[0] !== created.split('\n')[0], 'admin qabul qilgandagi xabar boshqacha boshlanadi');
  const ruText = await (async () => {
    resetWorld(baseData());
    const r = await placeOrder(OTHER, [{ id: '1', size: '', qty: 1 }], 'attempt_ru_123');
    return tgBy('sendMessage').filter((c) => String(c.payload.chat_id) === OTHER)[0].payload.text;
  })();
  ok(!/принят/i.test(ruText) && /отправлен/.test(ruText), 'ruscha matn ham "принят" demaydi');

  // ===== 9c) notifyMode:"split" + /order-deliver + subrequest byudjeti =====
  console.log('▶ 9c) alohida yetkazish (split) va byudjet');
  const LIMIT = 50;   // Cloudflare bepul rejasi: bitta so'rovga 50 ta tashqi fetch
  const many = baseData();
  for (let i = 0; i < 12; i++) many.products.push({ id: 100 + i, name: 'Tovar ' + i, price: 1000, stock: 9 });
  resetWorld(many);
  const items12 = Array.from({ length: 12 }, (_, i) => ({ id: String(100 + i), size: '', qty: 1 }));
  const sp = await call('/order-commit', {
    initData: initDataFor(CUSTOMER), attemptId: 'attempt_split_123', items: items12, notifyMode: 'split',
    customer: { name: 'Ali', phone: '+998901112233', address: 'Toshkent' },
    delivery: { method: 'courier', address: 'Chilonzor 5' }, payment: { method: 'Naqd' },
  });
  eq(sp.status, 201, '12 tovarli buyurtma yaratildi (ilgari limitga urilib 503 berardi)');
  ok(sp.fetches <= 45, '12 tovarli buyurtma byudjetga sig\'di (' + sp.fetches + ' <= 45)');
  const spKey = CUSTOMER + '_' + sp.data.order.id;
  eq(sp.data.deliver, spKey, 'javobda deliver kaliti bor');
  eq(tgCalls.length, 0, 'split rejimida buyurtma so\'rovi xabar YUBORMADI');
  const prodsAfter = db.read('products');
  ok(prodsAfter.some((p) => p && p._orderReservations), 'band belgilari hali turibdi (fonda tozalanadi)');
  const foreignDeliver = await call('/order-deliver', { initData: initDataFor(OTHER), outboxKey: spKey });
  eq(foreignDeliver.status, 403, 'begona mijoz boshqaning xabarini turta olmaydi');
  eq(tgCalls.length, 0, 'rad etilgan turtish hech narsa yubormadi');
  const dl = await call('/order-deliver', { initData: initDataFor(CUSTOMER), outboxKey: spKey });
  ok(dl.status === 200 && dl.data.queued === true, '/order-deliver ishladi');
  ok(dl.fetches <= 45, 'yetkazish alohida byudjetga sig\'di (' + dl.fetches + ' <= 45)');
  eq(tgBy('sendMessage').filter((c) => ADMINS.includes(String(c.payload.chat_id))).length, 3, 'uchala adminga kartochka');
  eq(custSends().length, 1, 'mijozga bitta xabar');
  ok(db.read('notification_outbox/' + spKey).delivered === true, 'yetkazildi');
  ok(!db.read('products').some((p) => p && p._orderReservations), 'band belgilari fonda tozalandi');
  const dl2 = await call('/order-deliver', { initData: initDataFor(CUSTOMER), outboxKey: spKey });
  ok(dl2.status === 200 && tgBy('sendMessage').length === 4, 'qayta turtish dublikat yubormadi');
  tgCalls = [];
  const ss = await call('/order-status', { initData: initDataFor(ADMINS[0], 0, 'Anvar'), uid: CUSTOMER, orderId: sp.data.order.id, status: 'qabul', notifyMode: 'split' });
  ok(ss.status === 200 && ss.data.deliver === spKey + '_status_1', 'holat javobida deliver kaliti');
  ok(ss.fetches <= 16, 'qabul — kam so\'rov (' + ss.fetches + ' <= 16; ilgari ~25 + xabarlar)');
  eq(tgCalls.length, 0, 'split: holat so\'rovi xabar yubormadi');
  const sd = await call('/order-deliver', { initData: initDataFor(ADMINS[0], 0, 'Anvar'), outboxKey: ss.data.deliver });
  eq(sd.status, 200, 'admin istalgan hodisani turta oladi');
  eq(tgBy('editMessageText').length, 3, 'kartochkalar yangilandi');
  eq(custSends().length, 1, 'mijozga holat xabari');
  tgCalls = [];
  const sc = await call('/order-status', { initData: initDataFor(ADMINS[0], 0, 'Anvar'), uid: CUSTOMER, orderId: sp.data.order.id, status: 'bekor_qilingan', notifyMode: 'split' });
  ok(sc.status === 200 && sc.fetches <= LIMIT - 5, '12 tovarli bekor qilish byudjetga sig\'di (' + sc.fetches + ')');
  ok(db.read('products').filter((p) => p && p._orderOperations).length > 0, 'tiklash belgilari hali turibdi (fonda tozalanadi)');
  eq(Number(db.read('products/5/stock')), 9, 'bekor qilinganda stok qaytdi');
  const scd = await call('/order-deliver', { initData: initDataFor(ADMINS[0], 0, 'Anvar'), outboxKey: sc.data.deliver });
  ok(scd.fetches <= LIMIT - 5, 'bekor xabari + tozalash byudjetga sig\'di (' + scd.fetches + ')');
  ok(!db.read('products').some((p) => p && p._orderOperations), 'tiklash belgilari fonda tozalandi');
  // Eski ilova (notifyMode yo'q) — 1 tovar: hammasi BITTA so'rovda, limitdan past
  resetWorld(baseData());
  const legacy1 = await placeOrder(CUSTOMER, [{ id: '1', size: '', qty: 1 }], 'attempt_leg1_123');
  ok(legacy1.fetches <= LIMIT - 8, 'eski oqim: buyurtma + xabarlar bitta so\'rovda byudjetga sig\'di (' + legacy1.fetches + ')');
  ok(db.read('notification_outbox/' + CUSTOMER + '_' + legacy1.data.order.id).delivered === true, 'eski oqim: darhol yetkazildi');
  // Eski ilova — ko'p tovar: xabar watchdog'ga qoldiriladi (limit o'rtasida uzilmasin)
  resetWorld(many);
  const legacy12 = await placeOrder(CUSTOMER, items12, 'attempt_leg12_123');
  ok(legacy12.status === 201 && legacy12.fetches <= LIMIT, 'eski oqim: 12 tovar ham limitdan oshmadi (' + legacy12.fetches + ')');
  eq(tgCalls.length, 0, 'eski oqim + ko\'p tovar: xabar watchdog\'ga qoldi');
  const lk = CUSTOMER + '_' + legacy12.data.order.id;
  ok(db.read('notification_outbox/' + lk).retryAt > Date.now(), 'watchdog uchun retryAt bor');
  const lw = await notifyAgain(lk);
  ok(lw.fetches <= LIMIT && db.read('notification_outbox/' + lk).delivered === true, 'watchdog yetkazdi (' + lw.fetches + ')');

  // ===== 10) Eskirgan initData =====
  console.log('▶ 10) eskirgan initData');
  const oldInit = await call('/order-status', { initData: initDataFor(ADMINS[0], 2 * 3600), uid: CUSTOMER, orderId: '1', status: 'qabul' });
  ok(oldInit.status === 401 && /eskirgan/.test(oldInit.data.error), 'eski initData -> 401 (ilova idToken bilan qayta uradi)');

  // ===== 11) Tugmalar (bot.py bilan bir xil bo'lishi SHART) =====
  console.log('▶ 11) tugmalar');
  const tmpSrc = fs.readFileSync(path.join(ROOT, 'cloudflare-worker.js'), 'utf8');
  const fnSrc = tmpSrc.slice(tmpSrc.indexOf('function orderAdminKeyboard('), tmpSrc.indexOf('function orderDeliveryLabel('));
  const orderAdminKeyboard = new Function(fnSrc + '; return orderAdminKeyboard;')();
  const EXPECTED = JSON.parse(fs.readFileSync(path.join(__dirname, 'order-keyboards.json'), 'utf8'));
  for (const st of Object.keys(EXPECTED)) {
    eq(orderAdminKeyboard(st, 'abc123'), EXPECTED[st], 'tugmalar: ' + st);
  }

  // ===== 12) Bot imzosi — Python bilan moslik vektori =====
  const vec = botAuth('order-status', '5105291033', ['111', 'ord-1', 'qabul', ''], 1700000000);
  eq(vec.sig, EXPECTED_VECTOR_SIG, 'HMAC vektori (bot/tests/test_order_buttons.py da ham shu)');

  try { fs.unlinkSync(tmp); } catch (_) {}
  console.log('\n' + passed + ' ta tekshiruv o\'tdi, ' + failed + ' ta xato');
  if (failed) {
    console.error('\n❌ Buyurtma oqimi sinovi MUVAFFAQIYATSIZ:\n - ' + fails.join('\n - '));
    process.exit(1);
  }
  console.log('✅ Buyurtma oqimi (Worker) — toza');
}

// BOT_TOKEN = '123:TEST_TOKEN_FOR_ORDER_FLOW', ts = 1700000000
const EXPECTED_VECTOR_SIG = '389a5039a4c7236130d95c78ba2adcc001d48f2b0e990f0a84ac3b907f552678';

main().catch((e) => { console.error(e); process.exit(1); });
