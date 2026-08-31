/* =====================================================================
 *  test-tier-cashback.js — MIJOZ DARAJASI va CASHBACK sinovi
 *
 *  NEGA BU SINOV BOR:
 *    Bu qism to'g'ridan-to'g'ri PULGA tegishli — mijozga qancha cashback
 *    qaytishini va qachondan bepul yetkazish berilishini belgilaydi.
 *    Bu yerdagi xato yo mijozni aldaydi (va'da qilingandan kam berish),
 *    yo do'konga zarar keltiradi (ko'p berish).
 *
 *    Ilgari shu joyda AYNAN shunday xato bor edi: to'rt daraja e'lon
 *    qilingan, har biriga `cashbackX` (×1…×3) va `discount` (2–5%)
 *    yozilgan edi — lekin ikkalasi ham HECH QAYERDA qo'llanmagan.
 *    Ya'ni mijozga ko'rsatilgan imtiyoz berilmasdi. Sinov shuning
 *    qaytalanmasligini qo'riqlaydi.
 *
 *  QANDAY ISHLAYDI:
 *    `index.html` dan `<script id="vip-stories-2026-js">` bloki ajratib
 *    olinadi va minimal DOM stub bilan bajariladi — ya'ni nusxa emas,
 *    HAQIQATDA YUBORILADIGAN kod sinaladi.
 *
 *  ISHGA TUSHIRISH:  node .github/test-tier-cashback.js
 * ===================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

/* ---------------------------------------------------------------- *
 * 1) VIP qatlamini ajratib olamiz
 * ---------------------------------------------------------------- */
/* ⚠️ Blokni AJRATIB OLISH — qator BOSHIDAN izlanadi.
 * Oddiy `indexOf` ishonchsiz: agar marker satri biror IZOHDA ham uchrasa,
 * qidiruv izohni topib, keyingi `</script>` gacha MUTLAQO boshqa kodni
 * kesib olardi (bu xato bir marta sodir bo'ldi). Shuning uchun marker
 * qator boshida bo'lishi va AYNAN bitta bo'lishi tekshiriladi. */
const MARK = '<script id="vip-stories-2026-js">';
const lineRe = /^<script id="vip-stories-2026-js">$/gm;
const hits = HTML.match(lineRe) || [];
if (hits.length !== 1) {
  console.error('❌ `vip-stories-2026-js` bloki ' + hits.length + ' marta topildi (1 bo\'lishi kerak).');
  process.exit(1);
}
lineRe.lastIndex = 0;
const m0 = lineRe.exec(HTML);
const bodyStart = m0.index + MARK.length;
const close = HTML.indexOf('</script>', bodyStart);
if (close < 0) { console.error('❌ blok yopilmagan.'); process.exit(1); }
const LAYER_SRC = HTML.slice(bodyStart, close);

/* ---------------------------------------------------------------- *
 * 2) Minimal DOM stub
 * ---------------------------------------------------------------- */
function makeEl(id) {
  const el = {
    id: id || '', tagName: 'DIV', value: '', innerHTML: '', innerText: '',
    textContent: '', style: { setProperty() {}, cssText: '' }, attrs: {},
    _cls: new Set(),
    classList: {
      add(c) { el._cls.add(c); }, remove(c) { el._cls.delete(c); },
      contains(c) { return el._cls.has(c); },
      toggle(c, on) {
        if (on === undefined) { el._cls.has(c) ? el._cls.delete(c) : el._cls.add(c); }
        else if (on) { el._cls.add(c); } else { el._cls.delete(c); }
      }
    },
    setAttribute(k, v) { el.attrs[k] = String(v); },
    getAttribute(k) { return Object.prototype.hasOwnProperty.call(el.attrs, k) ? el.attrs[k] : null; },
    appendChild(c) { return c; }, insertBefore(c) { return c; },
    insertAdjacentHTML() {}, addEventListener() {}, removeEventListener() {},
    closest() { return null; },
    querySelector() { return makeEl(''); }, querySelectorAll() { return []; },
    remove() {}
  };
  return el;
}

const documentStub = {
  readyState: 'complete',
  body: makeEl('body'),
  getElementById() { return null; },          // VIP.render() jimgina chiqib ketadi
  createElement() { return makeEl(''); },
  querySelector() { return null; },
  querySelectorAll() { return []; },
  addEventListener() {}
};

const windowStub = {
  document: documentStub,
  history: { pushState() {}, back() {} },
  addEventListener() {},
  matchMedia() { return { matches: false }; },
  localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
  productsDB: [],
  currentUser: 5105291033,
  myProfile: {},
  _hap() {}
};

const ctx = vm.createContext(Object.assign(windowStub, {
  window: windowStub,
  document: documentStub,
  console: { log() {}, warn() {}, error() {} },
  setTimeout: (fn, ms) => { const t = setTimeout(fn, ms); if (t.unref) t.unref(); return t; },
  clearTimeout, setInterval: () => 0, clearInterval,
  Map, Set, Math, Date, JSON, Number, Array, Object, String, RegExp,
  isFinite, parseInt, parseFloat, encodeURIComponent, decodeURIComponent
}));

try {
  vm.runInContext(LAYER_SRC, ctx, { filename: 'vip-stories-2026-js' });
} catch (e) {
  console.error('❌ VIP qatlami bajarilmadi:', e.message);
  process.exit(1);
}

const VIP = ctx.VIP || (ctx.window && ctx.window.VIP);
if (!VIP) { console.error('❌ window.VIP yaratilmadi.'); process.exit(1); }

/* ---------------------------------------------------------------- *
 * 3) Sinov mexanizmi
 * ---------------------------------------------------------------- */
let pass = 0;
const fails = [];
function t(name, fn) {
  try { fn(); pass++; console.log('  ✅ ' + name); }
  catch (e) { fails.push([name, e]); console.log('  ❌ ' + name + '\n       ' + e.message); }
}
function eq(a, b, msg) {
  if (a !== b) throw new Error((msg || 'teng emas') + ': kutilgan ' + JSON.stringify(b) + ', olingan ' + JSON.stringify(a));
}
function ok(v, msg) { if (!v) throw new Error(msg || 'rost emas'); }

/** Yetkazilgan buyurtmalar ro'yxati yasaydi. */
function orders(...totals) {
  return totals.map((x, i) => ({ id: i + 1, total: x, status: 'yetkazildi' }));
}

/* ================================================================ *
 * 1) IKKI DARAJA — na kam, na ko'p
 * ================================================================ */
console.log('\n=== 1) Darajalar tuzilishi ===');

t('aynan IKKI daraja bor', () => {
  eq(VIP.TIERS.length, 2, 'daraja soni');
  eq(VIP.TIERS[0].id, 'ordinary');
  eq(VIP.TIERS[1].id, 'vip');
});

t('REGRESSIYA: ishlatilmaydigan maydonlar QAYTIB KELMAGAN', () => {
  // `cashbackX` va `discount` mijozga ko'rsatilib, hech qachon
  // qo'llanmagan edi — ular qaytib kelmasligi kerak.
  VIP.TIERS.forEach((x) => {
    ok(!('cashbackX' in x), x.id + ': cashbackX qaytib kelgan');
    ok(!('discount' in x), x.id + ': discount qaytib kelgan');
    ok(!('minOrders' in x), x.id + ': minOrders qaytib kelgan');
  });
});

t('har darajada HAQIQIY rate va freeDelivery bor', () => {
  VIP.TIERS.forEach((x) => {
    eq(typeof x.rate, 'number', x.id + ': rate');
    eq(typeof x.freeDelivery, 'number', x.id + ': freeDelivery');
  });
});

t('xo\'jayin so\'ragan aniq qiymatlar', () => {
  const [ord, vip] = VIP.TIERS;
  eq(ord.rate, 0.008, 'oddiy cashback');
  eq(ord.freeDelivery, 3000000, 'oddiy bepul yetkazish');
  eq(vip.rate, 0.01, 'VIP cashback');
  eq(vip.freeDelivery, 2400000, 'VIP bepul yetkazish');
  eq(vip.minSpent, 3000000, 'VIP chegarasi');
});

/* ================================================================ *
 * 2) DARAJA HISOBI — faqat summa bo'yicha
 * ================================================================ */
console.log('\n=== 2) Daraja hisobi ===');

t('yangi mijoz — oddiy', () => {
  const s = VIP.compute([]);
  eq(s.tier.id, 'ordinary');
  eq(s.isVip, false);
  eq(s.spent, 0);
});

t('2.9 mln — hali oddiy', () => {
  const s = VIP.compute(orders(2900000));
  eq(s.tier.id, 'ordinary');
  eq(s.isVip, false);
  eq(s.needSom, 100000, 'VIP bo\'lishga qolgan summa');
});

t('aynan 3 mln — VIP', () => {
  const s = VIP.compute(orders(3000000));
  eq(s.tier.id, 'vip');
  eq(s.isVip, true);
  eq(s.needSom, 0);
});

t('3 mln dan ortiq — VIP', () => {
  const s = VIP.compute(orders(1500000, 1600000));
  eq(s.spent, 3100000);
  eq(s.tier.id, 'vip');
  eq(s.isVip, true);
});

t('REGRESSIYA: KO\'P ARZON buyurtma VIP qilmaydi', () => {
  // Ilgari daraja «summa YOKI xarid SONI» bo'yicha berilardi —
  // 12 ta arzon buyurtma bergan mijoz eng yuqori darajaga chiqardi.
  const s = VIP.compute(orders(...new Array(20).fill(50000)));   // 20 ta x 50k = 1 mln
  eq(s.spent, 1000000);
  eq(s.tier.id, 'ordinary', '20 ta buyurtma VIP qilmasligi kerak');
  eq(s.isVip, false);
});

t('faqat YETKAZILGAN buyurtmalar hisoblanadi', () => {
  const list = [
    { id: 1, total: 5000000, status: 'kutilmoqda' },
    { id: 2, total: 5000000, status: 'bekor_qilingan' },
    { id: 3, total: 100000, status: 'yetkazildi' }
  ];
  const s = VIP.compute(list);
  eq(s.spent, 100000, 'faqat yetkazilgani');
  eq(s.tier.id, 'ordinary');
});

t('admin qo\'lda VIP qila oladi', () => {
  const s = VIP.compute([], 'vip');
  eq(s.tier.id, 'vip');
  eq(s.isVip, true);
  eq(s.manual, 'vip');
});

t('qo\'lda berilgan daraja darajani PASAYTIRMAYDI', () => {
  const s = VIP.compute(orders(9000000), 'ordinary');
  eq(s.tier.id, 'vip', 'haqiqiy daraja saqlanishi kerak');
});

t('progress 0..100 orasida', () => {
  [0, 500000, 1500000, 2999999, 3000000, 9000000].forEach((v) => {
    const s = VIP.compute(orders(v));
    ok(s.progress >= 0 && s.progress <= 100, v + ' uchun progress: ' + s.progress);
  });
});

/* ================================================================ *
 * 3) CASHBACK ULUSHI — endi HAQIQATAN qo'llanadi
 * ================================================================ */
console.log('\n=== 3) Cashback ulushi ===');

t('cashbackRate darajaga qarab o\'zgaradi', () => {
  VIP.state = VIP.compute([]);
  eq(VIP.cashbackRate(), 0.008, 'oddiy mijoz');
  VIP.state = VIP.compute(orders(3000000));
  eq(VIP.cashbackRate(), 0.01, 'VIP mijoz');
});

t('holat yo\'q bo\'lsa — xavfsiz standart (0.8%)', () => {
  VIP.state = null;
  eq(VIP.cashbackRate(), 0.008);
});

t('ratePct chiroyli foiz qaytaradi (ortiqcha nol yo\'q)', () => {
  eq(VIP.ratePct(VIP.TIERS[0]), '0.8');
  eq(VIP.ratePct(VIP.TIERS[1]), '1');
});

t('bepul yetkazish chegarasi darajaga qarab', () => {
  VIP.state = VIP.compute([]);
  eq(VIP.freeDeliveryTarget(), 3000000, 'oddiy');
  VIP.state = VIP.compute(orders(3000000));
  eq(VIP.freeDeliveryTarget(), 2400000, 'VIP');
});

t('holat yo\'q bo\'lsa yetkazish chegarasi 3 mln', () => {
  VIP.state = null;
  eq(VIP.freeDeliveryTarget(), 3000000);
});

/* ================================================================ *
 * 4) HAQIQIY PUL HISOBI — mijoz qancha oladi
 * ================================================================ */
console.log('\n=== 4) Cashback summasi (haqiqiy misollar) ===');

function earned(payable, isVip) {
  VIP.state = VIP.compute(isVip ? orders(3000000) : []);
  return Math.round(payable * VIP.cashbackRate());
}

t('oddiy mijoz, 500 000 so\'m -> 4 000 so\'m (0.8%)', () => {
  eq(earned(500000, false), 4000);
});
t('VIP mijoz, 500 000 so\'m -> 5 000 so\'m (1%)', () => {
  eq(earned(500000, true), 5000);
});
t('oddiy mijoz, 2 400 000 so\'m -> 19 200 so\'m', () => {
  eq(earned(2400000, false), 19200);
});
t('VIP mijoz, 2 400 000 so\'m -> 24 000 so\'m', () => {
  eq(earned(2400000, true), 24000);
});
t('VIP oddiydan 1.25 barobar ko\'p oladi', () => {
  eq(earned(1000000, true) / earned(1000000, false), 1.25);
});

/* ================================================================ *
 * 5) MANBA MATNI — ko'rsatilgan imtiyoz HAQIQIY bo'lishi kerak
 * ================================================================ */
console.log('\n=== 5) Kod matni tekshiruvlari ===');

t('cashback buyurtmada SAQLANGAN ulush bilan beriladi', () => {
  // To'lovda «1% qaytadi» deb ko'rsatib, keyin 0.8% berib qo'ymaslik uchun
  ok(HTML.indexOf('rateForOrder') !== -1, 'rateForOrder funksiyasi yo\'q');
  ok(HTML.indexOf('cbRate: cbRate') !== -1, 'buyurtmaga cbRate yozilmaydi');
  ok(HTML.indexOf('cashbackBaseOf(o) * rateForOrder(o)') !== -1,
    'cashback eski qat\'iy ulush bilan hisoblanyapti');
});

t('«Ustuvor xizmat» va\'dasi OLIB TASHLANGAN', () => {
  // Bu imtiyoz hech qanday kodda qo'llanmagan — mijozga bajarilmaydigan
  // va'da berilardi (`cashbackX`/`discount` xatosining aynan o'zi).
  // Darajaning imtiyozi FAQAT ikkita: bepul yetkazish va cashback.
  //
  // ⚠️ Tekshiruv IZOHLARDA emas, KODDA olib boriladi: «Ustuvor xizmat»
  // iborasi izohda tarixiy sabab sifatida qolishi mumkin, lekin
  // `perkHTML(...)` chaqiruvlari orasida bo'lmasligi kerak.
  const calls = LAYER_SRC.split('\n')
    .map((l) => l.trim())
    .filter((l) => l.indexOf("perkHTML('") === 0);
  eq(calls.length, 2, 'kartada aynan 2 ta imtiyoz bo\'lishi kerak');
  calls.forEach((c) => {
    ok(c.indexOf('Ustuvor') === -1, '«Ustuvor» imtiyozi qaytib kelgan: ' + c);
    ok(c.indexOf('\\u26A1') === -1, 'chaqmoq imtiyozi qaytib kelgan: ' + c);
  });
  ok(calls[0].indexOf('freeDelivery') !== -1, '1-imtiyoz bepul yetkazish emas');
  ok(calls[1].indexOf('Cashback') !== -1, '2-imtiyoz cashback emas');
});

t('to\'lov oynasida «sizga qaytadi» bloki bor', () => {
  ok(HTML.indexOf('cbp-earn') !== -1, 'cbp-earn bloki yo\'q');
  ok(HTML.indexOf('cashback qaytadi') !== -1, 'matn yo\'q');
});

t('naqd to\'lov tasdig\'ida ham cashback ko\'rinadi', () => {
  ok(HTML.indexOf('_cbEarnLine') !== -1, 'naqd dialogda cashback yo\'q');
});

t('qisilib qolgan blok TUZATILGAN', () => {
  // `margin: -8px` bloki tepadagi karta ostiga tortib qo'yardi
  ok(HTML.indexOf('margin: -8px 0 20px') === -1, 'salbiy margin qaytib kelgan');
  ok(HTML.indexOf('flex-wrap: wrap; justify-content: space-between') !== -1,
    'cbp-sum o\'ralishi yoqilmagan');
  ok(HTML.indexOf("so'm &nbsp;·&nbsp; Cashback") === -1,
    '&nbsp; qaytib kelgan (matn bo\'linmaydi)');
});

t('ombor va aksiya panelida ALMASHTIRGICH tugma', () => {
  ok(HTML.indexOf('Belgilashni bekor qilish') !== -1, 'bekor qilish matni yo\'q');
  ok(HTML.indexOf('inv-selall-btn') !== -1, 'ombor tugmasi id\'siz');
  ok(HTML.indexOf('bd-selall-btn') !== -1, 'aksiya tugmasi id\'siz');
});

/* ---------------------------------------------------------------- *
 * Xulosa
 * ---------------------------------------------------------------- */
console.log('\n======================================================');
console.log(`${pass}/${pass + fails.length} sinov o'tdi`);
if (fails.length) {
  console.log('\nYIQILGANLAR:');
  fails.forEach(([n, e]) => console.log('  • ' + n + ': ' + e.message));
  process.exit(1);
}
console.log('✅ Daraja va cashback mantig\'i — toza');
