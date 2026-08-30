/* =====================================================================
 *  test-promo-layer.js — BOSH SAHIFA FILTRLARI + OMMAVIY AKSIYA sinovi
 *
 *  NEGA BU SINOV BOR:
 *    Bu qatlam PUL bilan ishlaydi — narxni o'zgartiradi va bir marta
 *    bosishda o'nlab tovarga chegirma qo'yadi. Bu yerdagi xato bir
 *    sonni emas, butun katalog narxini buzadi. Brauzersiz sinash
 *    imkoni yo'q edi, shuning uchun eng xatoga moyil SOF mantiq
 *    tekshiriladi:
 *
 *      • MINGGA YAXLITLASH — 321 260 -> 321 000, 321 501 -> 322 000.
 *      • CHEGIRMA ASL NARXDAN hisoblanadi (foizlar bir-biriga
 *        KO'PAYIB ketmasligi kerak: 10% ni ikki marta qo'llash
 *        19% bermasin).
 *      • «Aksiya» filtri `_sortDisplayDB` dagi tartib bilan AYNI
 *        to'plamni ko'rsatishi (chegirma YOKI muddati o'tmagan flash).
 *      • Ikkala chip o'chirilganda oddiy «Ommabop tovarlar» mantig'i
 *        QAYTISHI (mijoz hammasini yana ko'ra olishi).
 *
 *  QANDAY ISHLAYDI:
 *    `index.html` dan `<script id="home-filters-bulk-discount-js">`
 *    bloki va `window._roundSom` yordamchisi AJRATIB OLINADI hamda
 *    minimal DOM stub bilan bajariladi. Ya'ni sinov nusxani emas,
 *    HAQIQATDA YUBORILADIGAN kodni tekshiradi.
 *
 *  ISHGA TUSHIRISH:  node .github/test-promo-layer.js
 * ===================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

/* ---------------------------------------------------------------- *
 * 1) Sinaladigan kodni index.html dan ajratib olamiz
 * ---------------------------------------------------------------- */
const MARK = '<script id="home-filters-bulk-discount-js">';
const start = HTML.indexOf(MARK);
if (start < 0) {
  console.error('❌ `home-filters-bulk-discount-js` skript bloki topilmadi.');
  process.exit(1);
}
const bodyStart = start + MARK.length;
const LAYER_SRC = HTML.slice(bodyStart, HTML.indexOf('</script>', bodyStart));

// `_roundSom` asosiy skriptda — uni alohida ajratamiz (qatlam unga tayanadi).
const ROUND_RE = /window\._roundSom\s*=\s*function[\s\S]*?\n\};/;
const roundMatch = HTML.match(ROUND_RE);
if (!roundMatch) {
  console.error('❌ `window._roundSom` topilmadi.');
  process.exit(1);
}
const ROUND_SRC = roundMatch[0];

/* ---------------------------------------------------------------- *
 * 2) Minimal DOM stub
 * ---------------------------------------------------------------- */
function makeEl(id) {
  const el = {
    id: id || '', tagName: 'DIV', value: '', innerHTML: '', innerText: '',
    textContent: '', style: {}, attrs: {},
    _cls: new Set(),
    classList: {
      add(c) { el._cls.add(c); },
      remove(c) { el._cls.delete(c); },
      contains(c) { return el._cls.has(c); },
      toggle(c, on) {
        if (on === undefined) { el._cls.has(c) ? el._cls.delete(c) : el._cls.add(c); }
        else if (on) { el._cls.add(c); } else { el._cls.delete(c); }
      }
    },
    setAttribute(k, v) { el.attrs[k] = String(v); },
    getAttribute(k) { return Object.prototype.hasOwnProperty.call(el.attrs, k) ? el.attrs[k] : null; },
    closest() { return null; },
    addEventListener() {}, removeEventListener() {},
    querySelector() { return null; }, querySelectorAll() { return []; },
    insertAdjacentHTML(pos, h) { el.innerHTML += h; },
    remove() {}
  };
  return el;
}

const REGISTRY = new Map();
['home-products', 'home-title', 'hf-promo', 'hf-stock', 'scroll-loader',
  'bd-list', 'bd-preview', 'bd-count', 'bd-pct', 'bd-hours', 'bd-search',
  'adminModal', 'bulkDiscountModal'].forEach(id => REGISTRY.set(id, makeEl(id)));

const documentStub = {
  readyState: 'complete',
  body: makeEl('body'),
  getElementById(id) { return REGISTRY.get(id) || null; },
  createElement() { return makeEl(''); },
  querySelector() { return null; },
  querySelectorAll() { return []; },
  addEventListener() {}
};

const CALLS = [];
const TOASTS = [];

const windowStub = {
  document: documentStub,
  history: { pushState() {}, back() {} },
  addEventListener() {},
  productsDB: [],
  escHtml(s) { return String(s == null ? '' : s); },
  cardHTML(p) { CALLS.push('card:' + p.id); return '<div data-pid="' + p.id + '"></div>'; },
  renderProducts() { CALLS.push('origRender'); },
  loadMoreProducts(i) { CALLS.push('origLoadMore:' + i); },
  _hap() {},
  _afterBulk() { CALLS.push('afterBulk'); }
};

const ctx = vm.createContext(Object.assign(windowStub, {
  window: windowStub,
  document: documentStub,
  console,
  showToast: (m, t) => { TOASTS.push([m, t || 'success']); },
  setTimeout: (fn, ms) => { const t = setTimeout(fn, ms); if (t.unref) t.unref(); return t; },
  clearTimeout, Map, Set, Math, Date, JSON, Number, Array, Object, String,
  isFinite, parseInt, parseFloat,
  // Qatlam `limitCount` ga yozadi (global `let` ni taqlid qilamiz)
  limitCount: 12,
  Promise
}));

try {
  vm.runInContext(ROUND_SRC, ctx, { filename: '_roundSom' });
  vm.runInContext(LAYER_SRC, ctx, { filename: 'home-filters-bulk-discount-js' });
} catch (e) {
  console.error('❌ Qatlam bajarilmadi:', e.message);
  process.exit(1);
}
const W = ctx;

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

const NOW = Date.now();

/* ================================================================ *
 * 1) MINGGA YAXLITLASH — xo'jayin aynan shuni so'radi
 * ================================================================ */
console.log('\n=== 1) Narxni mingga yaxlitlash ===');

t('321 260 -> 321 000 (pastga)', () => eq(W._roundSom(321260), 321000));
t('321 501 -> 322 000 (tepaga)', () => eq(W._roundSom(321501), 322000));
t('321 500 -> 322 000 (aynan yarmi tepaga)', () => eq(W._roundSom(321500), 322000));
t('321 499 -> 321 000', () => eq(W._roundSom(321499), 321000));
t('312 000 + 3% = 321 360 -> 321 000', () => eq(W._roundSom(312000 * 1.03), 321000));
t('yumaloq son o\'zgarmaydi', () => eq(W._roundSom(200000), 200000));
t('500 dan kichik -> 0', () => eq(W._roundSom(400), 0));
t('noto\'g\'ri qiymat -> 0', () => {
  eq(W._roundSom(0), 0);
  eq(W._roundSom(-5000), 0);
  eq(W._roundSom(NaN), 0);
  eq(W._roundSom(undefined), 0);
});

/* ================================================================ *
 * 2) CHEGIRMA HISOBI — asl narxdan, ko'paymasin
 * ================================================================ */
console.log('\n=== 2) Chegirma hisobi (asl narxdan) ===');

t('oddiy tovarga 10%: 200 000 -> 180 000', () => {
  eq(W._bdNewPrice({ id: 1, price: 200000 }, 10), 180000);
});

t('3% chegirma yaxlitlanadi: 312 000 -> 303 000', () => {
  // 312000 * 0.97 = 302 640 -> 303 000
  eq(W._bdNewPrice({ id: 1, price: 312000 }, 3), 303000);
});

t('ALLAQACHON aksiyada bo\'lsa — ASL narxdan hisoblanadi', () => {
  // Asl 200 000, hozir 180 000 (−10%). Yana 10% qo'llasak natija
  // 180 000 dan emas, 200 000 dan hisoblanishi kerak.
  const p = { id: 1, price: 180000, oldPrice: 200000 };
  eq(W._bdBasePrice(p), 200000, 'asl narx');
  eq(W._bdNewPrice(p, 10), 180000, 'natija o\'zgarmasligi kerak');
});

t('REGRESSIYA: foizlar bir-biriga KO\'PAYMAYDI (idempotent)', () => {
  // Bir xil foizni ketma-ket 3 marta qo'llash bir xil natija bersin.
  let p = { id: 1, price: 500000 };
  for (let i = 0; i < 3; i++) {
    const np = W._bdNewPrice(p, 15);
    if (np) { p = { id: 1, price: np, oldPrice: W._bdBasePrice(p) }; }
  }
  eq(p.oldPrice, 500000, 'asl narx saqlanishi kerak');
  eq(p.price, 425000, '15% BIR marta qo\'llanishi kerak');
});

t('boshqa foizga o\'tish asl narxdan qayta hisoblanadi', () => {
  const p = { id: 1, price: 180000, oldPrice: 200000 };  // −10%
  eq(W._bdNewPrice(p, 20), 160000, '200 000 dan 20%');
});

t('juda katta foiz rad etiladi (>=90)', () => {
  eq(W._bdNewPrice({ id: 1, price: 200000 }, 90), 0);
  eq(W._bdNewPrice({ id: 1, price: 200000 }, 150), 0);
});

t('yaxlitlashdan keyin narx o\'zgarmasa — qo\'llanmaydi', () => {
  // 1 000 so'mga 3% = 970 -> yaxlitlansa 1 000, ya'ni o'zgarish yo'q
  eq(W._bdNewPrice({ id: 1, price: 1000 }, 3), 0);
});

t('narxi yo\'q tovar yiqitmaydi', () => {
  eq(W._bdNewPrice({ id: 1 }, 10), 0);
  eq(W._bdNewPrice(null, 10), 0);
});

/* ================================================================ *
 * 3) «AKSIYADA» aniqlash — tartib bilan bir xil bo'lishi kerak
 * ================================================================ */
console.log('\n=== 3) «Aksiyada» predikati ===');

t('chegirmali tovar aksiyada', () => {
  ok(W._isPromoProduct({ price: 90000, oldPrice: 100000 }));
});
t('muddati o\'tmagan flash aksiyada', () => {
  ok(W._isPromoProduct({ price: 90000, flashUntil: NOW + 60000 }));
});
t('muddati O\'TGAN flash aksiya EMAS', () => {
  ok(!W._isPromoProduct({ price: 90000, flashUntil: NOW - 60000 }));
});
t('oddiy tovar aksiya emas', () => {
  ok(!W._isPromoProduct({ price: 90000 }));
});
t('oldPrice narxdan KICHIK bo\'lsa aksiya emas', () => {
  ok(!W._isPromoProduct({ price: 100000, oldPrice: 90000 }));
});

/* ================================================================ *
 * 4) BOSH SAHIFA CHIP'LARI
 * ================================================================ */
console.log('\n=== 4) Bosh sahifa filtr chip\'lari ===');

W.productsDB = [
  { id: 1, name: 'Aksiyali, sotuvda', price: 90000, oldPrice: 100000, stock: 5 },
  { id: 2, name: 'Aksiyali, tugagan', price: 90000, oldPrice: 100000, stock: 0 },
  { id: 3, name: 'Oddiy, sotuvda', price: 100000, stock: 3 },
  { id: 4, name: 'Oddiy, tugagan', price: 100000, stock: 0 },
  { id: 5, name: 'Flash, sotuvda', price: 80000, flashUntil: NOW + 60000, stock: 2 }
];

function pidsInGrid() {
  const html = REGISTRY.get('home-products').innerHTML;
  return (html.match(/data-pid="(\d+)"/g) || []).map(s => parseInt(s.replace(/\D/g, ''), 10));
}

t('boshida chip\'lar o\'chiq va sarlavha «Ommabop tovarlar»', () => {
  eq(W._homeFilter.discount, false);
  eq(W._homeFilter.instock, false);
  eq(REGISTRY.get('home-title').textContent, 'Ommabop tovarlar');
});

t('«Aksiya» chipi faqat aksiyadagilarni ko\'rsatadi', () => {
  W._homeToggle('discount');
  const ids = pidsInGrid();
  eq(ids.length, 3, 'aksiyadagi 3 ta (1, 2, 5)');
  ok(ids.indexOf(1) !== -1 && ids.indexOf(2) !== -1 && ids.indexOf(5) !== -1);
  ok(ids.indexOf(3) === -1 && ids.indexOf(4) === -1, 'oddiylar chiqmasin');
  ok(REGISTRY.get('hf-promo').classList.contains('on'), 'chip yoqilgan ko\'rinishi');
  eq(REGISTRY.get('home-title').textContent, 'Aksiyadagi tovarlar');
});

t('ikkala chip birga — aksiyada VA sotuvda bor', () => {
  W._homeToggle('instock');
  const ids = pidsInGrid();
  eq(ids.length, 2, 'faqat 1 va 5');
  ok(ids.indexOf(2) === -1, 'tugagan aksiya chiqmasin');
  eq(REGISTRY.get('home-title').textContent, 'Aksiya · Sotuvda bor');
});

t('faqat «Sotuvda bor»', () => {
  W._homeToggle('discount');           // aksiyani o'chiramiz
  const ids = pidsInGrid();
  eq(ids.length, 3, 'qoldiqli 3 ta (1, 3, 5)');
  ok(ids.indexOf(4) === -1);
  eq(REGISTRY.get('home-title').textContent, 'Sotuvda bor tovarlar');
});

t('IKKALASI o\'chirilsa — oddiy «Ommabop tovarlar» mantig\'i QAYTADI', () => {
  CALLS.length = 0;
  W._homeToggle('instock');
  eq(W._homeFilter.discount, false);
  eq(W._homeFilter.instock, false);
  ok(CALLS.indexOf('origRender') !== -1, 'asl renderProducts chaqirilishi kerak');
  eq(REGISTRY.get('home-title').textContent, 'Ommabop tovarlar');
  ok(!REGISTRY.get('hf-promo').classList.contains('on'));
  ok(!REGISTRY.get('hf-stock').classList.contains('on'));
});

t('_homeReset ham hammasini tiklaydi', () => {
  W._homeToggle('discount');
  CALLS.length = 0;
  W._homeReset();
  eq(W._homeFilter.discount, false);
  ok(CALLS.indexOf('origRender') !== -1);
});

t('mos tovar bo\'lmasa — bo\'sh holat va tozalash tugmasi', () => {
  const saved = W.productsDB;
  W.productsDB = [{ id: 9, name: 'Oddiy', price: 1000, stock: 1 }];
  W._homeToggle('discount');
  const html = REGISTRY.get('home-products').innerHTML;
  ok(html.indexOf('_homeReset') !== -1, 'tozalash tugmasi bo\'lishi kerak');
  ok(html.indexOf('data-pid') === -1, 'karta bo\'lmasligi kerak');
  W._homeReset();
  W.productsDB = saved;
});

/* ================================================================ *
 * 5) CHEKSIZ SKROLL — filtr rejimida aralashmasligi kerak
 * ================================================================ */
console.log('\n=== 5) Cheksiz skroll himoyasi ===');

t('filtr O\'CHIQ bo\'lsa — asl loadMoreProducts ishlaydi', () => {
  W._homeReset();
  CALLS.length = 0;
  W.loadMoreProducts(12);
  ok(CALLS.indexOf('origLoadMore:12') !== -1);
});

t('filtr YOQILGAN bo\'lsa — qo\'shimcha yuklash BLOKLANADI', () => {
  W._homeToggle('discount');
  CALLS.length = 0;
  W.loadMoreProducts(24);
  ok(CALLS.indexOf('origLoadMore:24') === -1, 'filtrsiz tovar qo\'shilmasligi kerak');
  W._homeReset();
});

t('bloklanganda limitCount qaytariladi (ro\'yxat cho\'zilib ketmasin)', () => {
  W._homeToggle('discount');
  W.limitCount = 36;          // skroll oshirib qo'ygan holat
  W.loadMoreProducts(24);     // startIndex = oldingi limit
  eq(W.limitCount, 24, 'limitCount tiklanishi kerak');
  W._homeReset();
});

t('renderProducts o\'rami filtrlangan ko\'rinishni SAQLAYDI', () => {
  // Firebase yangilanishi / flash taymeri renderProducts() chaqiradi —
  // filtr yuvilib ketmasligi kerak.
  W._homeToggle('discount');
  W.renderProducts();
  const ids = pidsInGrid();
  ok(ids.indexOf(3) === -1, 'oddiy tovar qaytib kelmasligi kerak');
  W._homeReset();
});

/* ================================================================ *
 * 6) ADMIN — OMMAVIY AKSIYA PANELI
 * ================================================================ */
console.log('\n=== 6) Ommaviy aksiya paneli ===');

t('ko\'rinadigan ro\'yxat qoralamani chiqarmaydi', () => {
  W.productsDB = [
    { id: 1, name: 'Bor', price: 100000 },
    { id: 2, name: 'Qoralama', price: 100000, is_draft: true }
  ];
  REGISTRY.get('bd-search').value = '';
  W._bdState.filter = 'all';
  const v = W._bdVisibleItems();
  eq(v.length, 1);
  eq(v[0].id, 1);
});

t('«Aksiyada» / «Aksiyasiz» filtrlari', () => {
  W.productsDB = [
    { id: 1, name: 'Aksiyali', price: 90000, oldPrice: 100000 },
    { id: 2, name: 'Oddiy', price: 100000 }
  ];
  W._bdState.filter = 'promo';
  eq(W._bdVisibleItems().length, 1);
  eq(W._bdVisibleItems()[0].id, 1);
  W._bdState.filter = 'plain';
  eq(W._bdVisibleItems()[0].id, 2);
  W._bdState.filter = 'all';
});

t('qidiruv nom va kod bo\'yicha ishlaydi', () => {
  W.productsDB = [
    { id: 1, name: 'Moybor filtr', code: 'A1-100', price: 100000 },
    { id: 2, name: 'Tormoz kolodka', code: 'A1-200', price: 100000 }
  ];
  REGISTRY.get('bd-search').value = 'moybor';
  eq(W._bdVisibleItems().length, 1);
  REGISTRY.get('bd-search').value = 'a1-200';
  eq(W._bdVisibleItems()[0].id, 2);
  REGISTRY.get('bd-search').value = '';
});

t('«Hammasini belgilash» ko\'rinayotganlarni belgilaydi', () => {
  W.productsDB = [
    { id: 1, name: 'Bir', price: 100000 },
    { id: 2, name: 'Ikki', price: 200000 },
    { id: 3, name: 'Uch', price: 300000 }
  ];
  W.bdClearSelection();
  W.bdSelectAllVisible();
  eq(W._bdSelectedIds().length, 3);
});

t('qidiruv yoqilganda «Hammasini belgilash» FAQAT ko\'ringanini oladi', () => {
  W.bdClearSelection();
  REGISTRY.get('bd-search').value = 'bir';
  W.bdSelectAllVisible();
  const ids = W._bdSelectedIds();
  eq(ids.length, 1, 'ko\'rinmayotgan tovar belgilanmasligi kerak');
  eq(ids[0], 1);
  REGISTRY.get('bd-search').value = '';
  W.bdClearSelection();
});

t('tozalash tanlovni bo\'shatadi', () => {
  W.bdSelectAllVisible();
  ok(W._bdSelectedIds().length > 0);
  W.bdClearSelection();
  eq(W._bdSelectedIds().length, 0);
});

t('foizsiz qo\'llashga urinish ogohlantiradi', () => {
  W.bdSelectAllVisible();
  REGISTRY.get('bd-pct').value = '';
  TOASTS.length = 0;
  W.bdApply();
  ok(TOASTS.some(x => x[1] === 'warning'), 'ogohlantirish kerak');
});

t('tovar belgilanmasa qo\'llashga urinish ogohlantiradi', () => {
  W.bdClearSelection();
  REGISTRY.get('bd-pct').value = '10';
  TOASTS.length = 0;
  W.bdApply();
  ok(TOASTS.some(x => x[1] === 'warning'));
});

t('oldindan ko\'rish yaxlitlangan ANIQ narxni ko\'rsatadi', () => {
  W.productsDB = [{ id: 1, name: 'Test', price: 312000 }];
  W.bdClearSelection();
  W.bdSelectAllVisible();
  REGISTRY.get('bd-pct').value = '3';
  REGISTRY.get('bd-hours').value = '';
  W.bdPreview();
  const html = REGISTRY.get('bd-preview').innerHTML;
  ok(html.indexOf('303 000') !== -1 || html.indexOf('303,000') !== -1,
    'yaxlitlangan narx ko\'rinishi kerak, olingan: ' + html);
  ok(html.indexOf('muddatsiz') !== -1, 'muddat holati ko\'rinishi kerak');
});

t('muddat kiritilsa oldindan ko\'rishda aks etadi', () => {
  REGISTRY.get('bd-hours').value = '24';
  W.bdPreview();
  ok(REGISTRY.get('bd-preview').innerHTML.indexOf('24') !== -1);
  REGISTRY.get('bd-hours').value = '';
});

t('allaqachon aksiyadagilar haqida OGOHLANTIRADI', () => {
  W.productsDB = [{ id: 1, name: 'Aksiyali', price: 90000, oldPrice: 100000 }];
  W.bdClearSelection();
  W.bdSelectAllVisible();
  REGISTRY.get('bd-pct').value = '10';
  W.bdPreview();
  ok(REGISTRY.get('bd-preview').innerHTML.indexOf('allaqachon aksiyada') !== -1);
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
console.log('✅ Aksiya va filtr qatlami — mantiq toza');
