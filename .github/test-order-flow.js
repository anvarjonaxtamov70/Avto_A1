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
let db, tgCalls, tgFail, msgSeq;
function resetWorld(data) {
  db = new FakeDB(data);
  tgCalls = [];
  tgFail = null;   // (method, payload) => null | {status, description}
  msgSeq = 1000;
}
function jsonResponse(obj, status, headers) {
  return new Response(JSON.stringify(obj), { status: status || 200, headers: Object.assign({ 'Content-Type': 'application/json' }, headers || {}) });
}
globalThis.fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input.url;
  const opts = init || {};
  const method = String(opts.method || 'GET').toUpperCase();
  if (url.startsWith('https://oauth2.googleapis.com/token')) {
    return jsonResponse({ access_token: 'test-access-token', expires_in: 3600 });
  }
  if (url.startsWith('https://api.telegram.org/bot')) {
    const tail = url.slice('https://api.telegram.org/bot'.length);
    const tgMethod = tail.slice(tail.indexOf('/') + 1);
    const payload = JSON.parse(opts.body || '{}');
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
  const res = await worker.fetch(req, env, undefined);
  let data = null;
  try { data = await res.json(); } catch (_) {}
  return { status: res.status, data };
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
  const n9b = await call('/order-notify', { outboxKey: key9, botAuth: botAuth('order-notify', ADMINS[0], [key9]) });
  ok(n9b.data.state === 'delivered', 'yetkazilganini qayta yubormaydi');
  // Bloklangan mijoz (403) — abadiy qayta urinmaydi
  resetWorld(baseData());
  tgFail = (m, p) => (String(p.chat_id) === CUSTOMER ? { status: 403, description: 'Forbidden: bot was blocked by the user' } : null);
  const r9c = await placeOrder(CUSTOMER, [{ id: '1', size: '', qty: 1 }], 'attempt_block_123');
  const ob9c = db.read('notification_outbox/' + CUSTOMER + '_' + r9c.data.order.id);
  ok(ob9c.delivered === true && String(ob9c.done.customer).startsWith('err:'), 'botni bloklagan mijoz — doimiy xato, qayta urinilmaydi');

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
