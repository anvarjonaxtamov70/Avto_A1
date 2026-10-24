/* =====================================================================
 *  test-reviews.js — "XARID QILGANMI?" TEKSHIRUVI (baholash ochilishi)
 *
 *  HAQIQIY NOSOZLIK: yangi (server) buyurtmalarda `items` kalitlari hash
 *  ("l_<sha>"), mahsulot id esa `itemDetails[].id` da. Eski kod kalitni
 *  "id||variant" deb o'qirdi -> tovarni OLGAN mijoz ham baho qoldira olmasdi.
 *
 *  KAFOLATLAYDI:
 *    1. Yangi formatdagi yetkazilgan buyurtma -> baholash ochiladi.
 *    2. Eski formatdagi ("id||Universal") buyurtma ham ishlaydi.
 *    3. Yetkazilmagan / bekor qilingan buyurtma -> baholash YO'Q.
 *    4. Hash kalit ("l_...") hech qachon mahsulot id deb olinmaydi.
 *
 *  ISHGA TUSHIRISH:  node .github/test-reviews.js
 * ===================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const m = HTML.match(/<script id="a1-reviews-v2-js">([\s\S]*?)<\/script>/);
if (!m) { console.error('❌ <script id="a1-reviews-v2-js"> topilmadi'); process.exit(1); }

function run(orders) {
  const noop = () => {};
  const document = { getElementById: () => null, addEventListener: noop, querySelector: () => null, documentElement: { classList: { contains: () => false } } };
  const window = { document, myOrders: orders, addEventListener: noop, currentUser: 777 };
  window.window = window;
  const ctx = vm.createContext(Object.assign(window, { setTimeout: noop, setInterval: noop, Promise, JSON, Math, Date, String, Number, Object, Array }));
  vm.runInContext(m[1], ctx);
  return ctx;
}

let fails = 0, n = 0;
function ok(label, cond) { n++; if (!cond) { fails++; console.error('❌ ' + label); } }

const fresh = { id: '1', status: 'yetkazildi', items: { l_0123456789abcdef0123456789abcdef01234567: 1 }, itemDetails: [{ id: 'P1', name: 'Svecha', qty: 1 }, { id: 42, name: 'Kristovina', qty: 2 }] };
const legacy = { id: '2', status: 'yetkazildi', items: { 'P9||Universal': 1, 'P8||Gentra': 2 } };
const onWay = { id: '3', status: 'yolda', itemDetails: [{ id: 'P5' }] };
const cancelled = { id: '4', status: 'bekor_qilingan', itemDetails: [{ id: 'P6' }] };

const w = run([fresh, legacy, onWay, cancelled]);
ok('Yangi format: P1 xarid qilingan', w._a1HasBought('P1') === true);
ok('Yangi format: raqamli id (42) ham topiladi', w._a1HasBought(42) === true && w._a1HasBought('42') === true);
ok('Eski format: P9 xarid qilingan', w._a1HasBought('P9') === true);
ok('Eski format: variantli P8 xarid qilingan', w._a1HasBought('P8') === true);
ok('Yo\'ldagi buyurtma: baholash yo\'q', w._a1HasBought('P5') === false);
ok('Bekor qilingan: baholash yo\'q', w._a1HasBought('P6') === false);
ok('Hash kalit mahsulot id emas', w._a1HasBought('l_0123456789abcdef0123456789abcdef01234567') === false);
ok('Sotib olinmagan tovar: yo\'q', w._a1HasBought('PX') === false);
ok('Buyurtmalar bo\'sh: xato bermaydi', run([])._a1HasBought('P1') === false);
ok('A1Rate API mavjud', typeof w.A1Rate.openOrder === 'function' && typeof w.A1Rate.openProduct === 'function');
ok('loadProductReviews yangi oqimga ulangan', typeof w.loadProductReviews === 'function');

if (fails) { console.error('\n❌ ' + fails + ' / ' + n + ' tekshiruv yiqildi'); process.exit(1); }
console.log('✅ Baholash: xarid tekshiruvi — ' + n + ' tekshiruv o\'tdi');
