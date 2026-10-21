/* =====================================================================
 *  test-order-client.js — Mini App buyurtma qatlami (index.html)
 *
 *  index.html dan HAQIQIY kod bo'laklari kesib olinadi (nusxa emas) va
 *  toza `vm` kontekstida bajariladi. Qo'riqlanadi:
 *    1. Eskirgan initData (>50 daq) yuborilmaydi — idToken ishlatiladi;
 *       401 bo'lsa yangi idToken bilan BIR MARTA qayta uriladi.
 *    2. Yangi Worker (notify:"server") — brauzer adminga xabar YUBORMAYDI
 *       (dublikat bo'lmasin); eski Worker — BARCHA adminlarga yuboradi.
 *    3. Bekor qilish / qaytarish tasdiqsiz bajarilmaydi.
 *    4. Eski Worker fallback xabarida tovarlar ro'yxati bor (itemDetails).
 *    5. Mijoz faqat "kutilmoqda" buyurtmani bekor qila oladi; tugma faqat
 *       shunda ko'rinadi.
 *
 *  ISHGA TUSHIRISH:  node .github/test-order-client.js
 * ===================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
function slice(startLit, endLit, label) {
  const i = HTML.indexOf(startLit);
  if (i < 0 || HTML.indexOf(startLit, i + 1) >= 0) { console.error('❌ marker topilmadi/takror: ' + label); process.exit(1); }
  const j = HTML.indexOf(endLit, i);
  if (j < 0) { console.error('❌ oxiri topilmadi: ' + label); process.exit(1); }
  return HTML.slice(i, j);
}
const AUTH = slice('    window._initDataAgeSec = function', '    // 🔐 Auth kafolati', 'auth');
const STATUS = slice('// ✅ Tasdiq oynasi', '    function openModal(id) {', 'changeOrderStatus');
const CHECKOUT = slice('window.confirmOrder = async (paymentMethod) => {', '// 📦 1. VIZUAL KUZATUV', 'confirmOrder');
const CANCEL = slice('window._renderOrderCancel = function', '// 📦 3. KUZATUV', 'cancelMyOrder');

let passed = 0, failed = 0;
function ok(c, m) { if (c) passed++; else { failed++; console.error('  ❌ ' + m); } }

function initData(ageSec) {
  return 'auth_date=' + (Math.floor(Date.now() / 1000) - ageSec) + '&user=%7B%22id%22%3A1%7D&hash=x';
}

function makeCtx(opts) {
  opts = opts || {};
  const calls = { fetch: [], tg: [], toasts: [], confirms: [], admin: 0 };
  const responses = (opts.responses || []).slice();
  const elements = {};
  const el = (id) => elements[id] || (elements[id] = { innerHTML: '', innerText: '', style: {}, classList: { add() {}, remove() {} } });
  const ctx = {
    console, URLSearchParams, JSON, Promise, Object, Array, String, Number, Math, Date, setTimeout,
    TG_PROXY: 'https://w.test',
    ADMIN_IDS: [5105291033, 483425630, 5302078],
    ADMIN_ID: 5105291033,
    currentUser: opts.currentUser || '777',
    tg: { initData: opts.initData === undefined ? initData(60) : opts.initData, initDataUnsafe: {}, close() {}, openTelegramLink() {},
      showConfirm: undefined, showAlert(t) { calls.toasts.push('ALERT:' + t); } },
    firebase: { auth: () => ({ currentUser: opts.noFirebase ? null : { getIdToken: async (force) => (force ? 'fresh-token' : 'cached-token') } }) },
    fetch: async (url, init) => {
      const body = JSON.parse(init.body);
      calls.fetch.push({ url, body });
      const r = responses.length ? responses.shift() : { status: 200, data: { ok: true } };
      return { ok: r.status >= 200 && r.status < 300, status: r.status, json: async () => r.data };
    },
    showToast: (t) => calls.toasts.push(t),
    tgProxySend: async (p) => { calls.tg.push(p); return { ok: true }; },
    escTg: (s) => String(s), escHtml: (s) => String(s),
    document: { getElementById: el, querySelector: () => ({ innerText: '📦 Buyurtmalar' }) },
    localStorage: { _s: {}, getItem(k) { return this._s[k] || null; }, setItem(k, v) { this._s[k] = v; }, removeItem(k) { delete this._s[k]; } },
    navigator: {},
    confirm: (t) => { calls.confirms.push(t); return opts.confirm !== false; },
    alert: (t) => calls.toasts.push('ALERT:' + t),
    getTimelineHTML: (s) => 'TL:' + s,
    renderMyOrders: () => {},
    openAdminOrders: () => { calls.admin++; },
    openCustomerSpecificOrders: () => {},
    cart: { '1||': 2 }, productsDB: [{ id: 1, name: 'Porshen', price: 100000 }],
    myProfile: { name: 'Ali', phone: '+998901112233', address: 'Toshkent' }, userName: 'Ali',
    saveLocalCart() {}, updateCartBadge() {}, shootConfetti() {},
    myOrders: opts.myOrders || [],
  };
  ctx.window = ctx;
  ctx._invalidateUsersCache = () => {};
  ctx._orderItemsSummary = () => ({ lines: '', total: 0 });
  ctx._orderAttemptId = () => 'attempt_test_123';
  ctx._orderAttemptClear = () => {};
  ctx.allFetchedOrders = opts.allFetchedOrders || [];
  vm.createContext(ctx);
  vm.runInContext(AUTH + '\n' + STATUS + '\n' + CHECKOUT + '\n' + CANCEL, ctx);
  return { ctx, calls, elements };
}

(async function main() {
  // ===== 1) initData yangiligi =====
  console.log('▶ 1) auth kredential');
  let t = makeCtx({ initData: initData(60) });
  let c = await t.ctx._authCred();
  ok(c && c.initData, 'yangi initData ishlatiladi');
  t = makeCtx({ initData: initData(2 * 3600) });
  c = await t.ctx._authCred();
  ok(c && c.idToken === 'cached-token', 'eskirgan initData o\'rniga idToken (' + JSON.stringify(c) + ')');
  c = await t.ctx._authCred({ preferToken: true });
  ok(c && c.idToken === 'fresh-token', 'preferToken — majburan yangilangan token');
  t = makeCtx({ initData: initData(2 * 3600), noFirebase: true });
  c = await t.ctx._authCred();
  ok(c && c.initData, 'token yo\'q bo\'lsa — baribir initData (server sababini aytadi)');
  t = makeCtx({ initData: '', noFirebase: true });
  ok((await t.ctx._authCred()) === null, 'hech narsa yo\'q — null');

  // ===== 2) 401 da qayta urinish =====
  console.log('▶ 2) _workerPost 401 -> idToken');
  t = makeCtx({ initData: initData(60), responses: [{ status: 401, data: { ok: false, error: 'initData eskirgan' } }, { status: 200, data: { ok: true } }] });
  let r = await t.ctx._workerPost('/order-status', { a: 1, initData: 'begona' });
  ok(t.calls.fetch.length === 2, 'ikki marta yuborildi');
  ok(t.calls.fetch[0].body.initData && !t.calls.fetch[0].body.idToken, '1-urinish initData bilan');
  ok(t.calls.fetch[1].body.idToken === 'fresh-token' && !t.calls.fetch[1].body.initData, '2-urinish YANGI idToken bilan, initData olib tashlandi');
  ok(t.calls.fetch[0].body.initData !== 'begona', 'chaqiruvchi bergan kredential ishlatilmaydi');
  ok(r.resp.status === 200, 'natija — ikkinchi javob');

  // ===== 3) Checkout: notify server / eski Worker =====
  console.log('▶ 3) confirmOrder xabarlari');
  const order = { id: 'o1', code: 'A1-XYZ', uid: '777', status: 'kutilmoqda', total: 200000, itemDetails: [{ name: 'Porshen', qty: 2, unitPrice: 100000, lineTotal: 200000 }] };
  t = makeCtx({ responses: [{ status: 201, data: { ok: true, committed: true, order, notify: 'server' } }] });
  r = await t.ctx.confirmOrder('Naqd pul');
  ok(r && r.ok === true, 'buyurtma o\'tdi');
  ok(t.calls.fetch[0].url === 'https://w.test/order-commit', '/order-commit ga yuborildi');
  ok(t.calls.tg.length === 0, 'yangi Worker: brauzer Telegram xabar YUBORMADI (dublikat yo\'q)');
  t = makeCtx({ responses: [{ status: 201, data: { ok: true, committed: true, order } }] });
  r = await t.ctx.confirmOrder('Naqd pul');
  const toAdmins = t.calls.tg.filter((p) => [5105291033, 483425630, 5302078].includes(p.chat_id)).map((p) => p.chat_id);
  ok(toAdmins.length === 3, 'eski Worker: UCHALA adminga yuborildi (ilgari faqat bittasiga) — ' + JSON.stringify(toAdmins));
  t = makeCtx({ responses: [{ status: 401, data: { ok: false, error: 'initData eskirgan' } }, { status: 401, data: { ok: false, error: 'x' } }] });
  r = await t.ctx.confirmOrder('Naqd pul');
  ok(r.ok === false && t.calls.toasts.some((m) => /qayta oching/.test(m)), '401: tushunarli xabar');

  // ===== 4) Admin holat o'zgartirishi =====
  console.log('▶ 4) changeOrderStatus');
  const afo = [{ uI: '777', id: 'o1', code: 'A1-XYZ', status: 'yetkazildi', total: 200000, itemDetails: order.itemDetails }];
  t = makeCtx({ allFetchedOrders: afo, confirm: false, currentUser: '5105291033' });
  await t.ctx.changeOrderStatus('777', 'o1', 'bekor_qilingan');
  ok(t.calls.fetch.length === 0, 'qaytarishdan voz kechilsa — so\'rov yuborilmaydi');
  ok(/QAYTARILDI/.test(t.calls.confirms[0] || ''), 'tasdiq matni "qaytarildi" deydi');
  t = makeCtx({ allFetchedOrders: afo, currentUser: '5105291033', responses: [{ status: 200, data: { ok: true, notify: 'server' } }] });
  await t.ctx.changeOrderStatus('777', 'o1', 'bekor_qilingan');
  ok(t.calls.fetch.length === 1 && t.calls.fetch[0].body.status === 'bekor_qilingan', 'tasdiqdan keyin yuborildi');
  ok(t.calls.tg.length === 0, 'yangi Worker: brauzer xabar yubormadi');
  const afo2 = [{ uI: '777', id: 'o1', code: 'A1-XYZ', status: 'kutilmoqda', total: 200000, items: { l_abc: 2 }, itemDetails: order.itemDetails }];
  t = makeCtx({ allFetchedOrders: afo2, currentUser: '5105291033', responses: [{ status: 200, data: { ok: true } }] });
  await t.ctx.changeOrderStatus('777', 'o1', 'qabul');
  ok(t.calls.confirms.length === 0, 'qabul — tasdiqsiz');
  const adm = t.calls.tg.filter((p) => p.parse_mode === 'HTML').map((p) => p.chat_id);
  ok(adm.length === 2 && !adm.includes(5105291033), 'eski Worker: boshqa 2 adminga (o\'ziga emas)');
  const cust = t.calls.tg.find((p) => String(p.chat_id) === '777');
  ok(cust && /Porshen/.test(cust.text), 'mijoz xabarida tovar nomi bor (ilgari "l_<hash>" sabab bo\'sh edi)');
  t = makeCtx({ allFetchedOrders: afo2, currentUser: '5105291033', responses: [{ status: 409, data: { ok: false, error: "status o'tishi mumkin emas" } }] });
  await t.ctx.changeOrderStatus('777', 'o1', 'qabul');
  ok(t.calls.admin === 1, '409: ro\'yxat qayta yuklandi (eskirgan ko\'rinish)');
  ok(t.calls.toasts.some((m) => /o'tishi mumkin emas/.test(m)), '409: serverning aniq sababi ko\'rsatildi');
  t = makeCtx({ allFetchedOrders: afo2, currentUser: '5105291033', responses: [{ status: 200, data: { ok: true, notify: 'server', restockSkipped: [{ id: '9', name: 'Eski filtr' }] } }] });
  await t.ctx.changeOrderStatus('777', 'o1', 'bekor_qilingan');
  ok(t.calls.toasts.some((m) => /QAYTARILMADI[\s\S]*Eski filtr/.test(m)), 'qaytarilmagan tovar adminga ko\'rsatildi');

  // ===== 5) Mijozning bekor qilishi =====
  console.log('▶ 5) cancelMyOrder');
  const mine = { id: 'o5', code: 'A1-5', status: 'kutilmoqda' };
  t = makeCtx({ myOrders: [mine] });
  t.ctx._renderOrderCancel(mine);
  ok(/Buyurtmani bekor qilish/.test(t.elements['od-cancel-box'].innerHTML), 'kutilmoqda — tugma ko\'rinadi');
  t.ctx._renderOrderCancel({ id: 'o6', status: 'qabul' });
  ok(t.elements['od-cancel-box'].innerHTML === '', 'qabul qilingan — tugma YO\'Q');
  t = makeCtx({ myOrders: [{ ...mine }], responses: [{ status: 200, data: { ok: true } }] });
  await t.ctx.cancelMyOrder('o5');
  ok(t.calls.fetch[0].body.uid === '777' && t.calls.fetch[0].body.status === 'bekor_qilingan' && t.calls.fetch[0].body.orderId === 'o5', 'o\'z uid si bilan bekor so\'rovi');
  ok(t.ctx.myOrders[0].status === 'bekor_qilingan', 'mahalliy holat yangilandi');
  t = makeCtx({ myOrders: [{ ...mine }], confirm: false });
  await t.ctx.cancelMyOrder('o5');
  ok(t.calls.fetch.length === 0, 'voz kechilsa — so\'rov yo\'q');
  t = makeCtx({ myOrders: [{ ...mine }], responses: [{ status: 409, data: { ok: false, error: 'x', currentStatus: 'qabul' } }] });
  await t.ctx.cancelMyOrder('o5');
  ok(t.ctx.myOrders[0].status === 'qabul' && t.elements['od-cancel-box'].innerHTML === '', '409: holat yangilandi, tugma yo\'qoldi');
  t = makeCtx({ myOrders: [{ id: 'o7', status: 'yolda' }] });
  await t.ctx.cancelMyOrder('o7');
  ok(t.calls.fetch.length === 0, 'yo\'ldagi buyurtma — so\'rov ham yuborilmaydi');

  console.log('\n' + passed + ' ta tekshiruv o\'tdi, ' + failed + ' ta xato');
  if (failed) { console.error('❌ Mini App buyurtma qatlami sinovi MUVAFFAQIYATSIZ'); process.exit(1); }
  console.log('✅ Mini App buyurtma qatlami — toza');
})().catch((e) => { console.error(e); process.exit(1); });
