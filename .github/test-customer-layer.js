/* =====================================================================
 *  test-customer-layer.js — mijoz tomoni qatlamining MANTIQ sinovi
 *
 *  NEGA BU SINOV BOR:
 *    `index.html` — 26 000 satrli yagona fayl va uni brauzersiz sinash
 *    imkoni yo'q edi. Lekin eng xatoga moyil qismlar — SOF mantiq:
 *      • «mening mashinam» ni katalog kategoriyasiga moslash
 *        (GAZ alohida qoida, "Malibu" -> "malibu1/malibu2" prefiksi),
 *      • filtr + saralash (barqarorlik, razmerli tovar qoldig'i),
 *      • «ishlab chiqarilgan joy» ni normallashtirish.
 *    Bularda xato bo'lsa mijoz o'z mashinasiga mos qismni TOPMAYDI —
 *    ya'ni to'g'ridan-to'g'ri savdo yo'qoladi.
 *
 *  QANDAY ISHLAYDI:
 *    `index.html` dan `<script id="customer-boost-2026-js">` bloki
 *    AJRATIB OLINADI va minimal DOM stub bilan bajariladi. Ya'ni sinov
 *    nusxani emas, HAQIQATDA YUBORILADIGAN kodni tekshiradi.
 *
 *  ISHGA TUSHIRISH:  node .github/test-customer-layer.js
 * ===================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

/* ---------------------------------------------------------------- *
 * 1) Qatlam skriptini ajratib olamiz
 * ---------------------------------------------------------------- */
/* ⚠️ Blokni AJRATIB OLISH — qator BOSHIDAN izlanadi.
 * Oddiy `indexOf` ishonchsiz: agar marker satri biror IZOHDA ham uchrasa,
 * qidiruv izohni topib, keyingi `</script>` gacha MUTLAQO boshqa kodni
 * kesib olardi (bu xato bir marta sodir bo'ldi). Shuning uchun marker
 * qator boshida bo'lishi va AYNAN bitta bo'lishi tekshiriladi. */
const MARK = '<script id="customer-boost-2026-js">';
const lineRe = /^<script id="customer-boost-2026-js">$/gm;
const hits = HTML.match(lineRe) || [];
if (hits.length !== 1) {
  console.error('❌ `customer-boost-2026-js` bloki ' + hits.length + ' marta topildi (1 bo\'lishi kerak).');
  process.exit(1);
}
lineRe.lastIndex = 0;
const m0 = lineRe.exec(HTML);
const bodyStart = m0.index + MARK.length;
const close = HTML.indexOf('</script>', bodyStart);
if (close < 0) { console.error('❌ blok yopilmagan.'); process.exit(1); }
const LAYER_SRC = HTML.slice(bodyStart, close);

/* ---------------------------------------------------------------- *
 * 2) Minimal DOM stub — qatlam boot() paytida yiqilmasligi uchun
 * ---------------------------------------------------------------- */
function makeEl(id, cls) {
  const el = {
    id: id || '',
    tagName: 'DIV',
    _cls: new Set(String(cls || '').split(/\s+/).filter(Boolean)),
    style: {},
    children: [],
    innerHTML: '',
    textContent: '',
    attrs: {},
    classList: {
      add(c) { el._cls.add(c); },
      remove(c) { el._cls.delete(c); },
      contains(c) { return el._cls.has(c); },
      toggle(c, on) { if (on === undefined) { el._cls.has(c) ? el._cls.delete(c) : el._cls.add(c); } else if (on) { el._cls.add(c); } else { el._cls.delete(c); } }
    },
    setAttribute(k, v) { el.attrs[k] = String(v); },
    getAttribute(k) { return Object.prototype.hasOwnProperty.call(el.attrs, k) ? el.attrs[k] : null; },
    appendChild(c) { el.children.push(c); return c; },
    insertBefore(c) { el.children.unshift(c); return c; },
    insertAdjacentHTML(pos, h) { el.innerHTML += h; },
    addEventListener() {},
    removeEventListener() {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
    remove() {}
  };
  return el;
}

const REGISTRY = new Map();          // id -> element
const GRIDS = [];                    // `-parts` gridlari

const documentStub = {
  readyState: 'complete',
  body: makeEl('body'),
  getElementById(id) { return REGISTRY.get(id) || null; },
  createElement(tag) { const e = makeEl(''); e.tagName = String(tag).toUpperCase(); return e; },
  querySelector(sel) {
    const all = documentStub.querySelectorAll(sel);
    return all.length ? all[0] : null;
  },
  querySelectorAll(sel) {
    if (sel === '.items-grid[id$="-parts"]') return GRIDS;
    return [];
  },
  addEventListener() {}
};

const storage = {};
const windowStub = {
  innerWidth: 390,
  innerHeight: 780,
  document: documentStub,
  localStorage: {
    getItem(k) { return Object.prototype.hasOwnProperty.call(storage, k) ? storage[k] : null; },
    setItem(k, v) { storage[k] = String(v); },
    removeItem(k) { delete storage[k]; }
  },
  history: { pushState() {}, back() {} },
  addEventListener() {},
  matchMedia() { return { matches: false }; },
  productRatings: {},
  productsDB: []
};

/* Qatlam o'raydigan (wrap qiladigan) mavjud funksiyalarni oldindan
 * e'lon qilamiz — shunda wrapper'lar o'rnatiladi va sinaladi. */
const CALLS = [];
windowStub.cardHTML = function (p) {
  CALLS.push('cardHTML');
  return '<div class="luxury-card" data-pid="' + p.id + '">' +
         '<div class="info"><h4>' + p.name + '</h4>' +
         '<button class="btn-add-cart">narx</button></div></div>';
};
windowStub._sfsApply = function (items) { CALLS.push('origSfsApply'); return items; };
windowStub._sfsState = { sort: 'relevance', instock: false, discount: false };
windowStub._sfsIsDefault = function () {
  const s = windowStub._sfsState;
  return s.sort === 'relevance' && !s.instock && !s.discount;
};
windowStub._sfsReset = function () { CALLS.push('origSfsReset'); };
windowStub._sfsSyncToolbar = function () { CALLS.push('origSfsSync'); };
windowStub.renderProducts = function () { CALLS.push('origRender'); };
windowStub.showSection = function () { CALLS.push('origShowSection'); };
windowStub.openProduct = function () { CALLS.push('origOpenProduct'); };
windowStub.saveMyCar = function (v) { CALLS.push('origSaveMyCar'); return v; };
windowStub.myCarLabel = function (v) {
  const i = String(v).indexOf('-');
  return i < 0 ? v : String(v).slice(i + 1);
};

const ctx = vm.createContext(Object.assign(windowStub, {
  window: windowStub,
  document: documentStub,
  localStorage: windowStub.localStorage,
  history: windowStub.history,
  console,
  setTimeout: (fn, ms) => { const t = setTimeout(fn, ms); if (t.unref) t.unref(); return t; },
  clearTimeout,
  Map,
  Set,
  Math,
  Date,
  JSON,
  Number,
  Array,
  Object,
  String,
  isFinite,
  parseInt,
  parseFloat
}));

try {
  vm.runInContext(LAYER_SRC, ctx, { filename: 'customer-boost-2026-js' });
} catch (e) {
  console.error('❌ Qatlam skripti bajarilmadi:', e.message);
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
  const A = JSON.stringify(a), B = JSON.stringify(b);
  if (A !== B) throw new Error((msg || 'teng emas') + '\n       kutilgan: ' + B + '\n       olingan : ' + A);
}
function ok(v, msg) { if (!v) throw new Error(msg || 'rost bo\'lishi kerak'); }

/* ---------------------------------------------------------------- *
 * 4) MENING MASHINAM -> KATEGORIYA MOSLIGI
 * ---------------------------------------------------------------- */
console.log('\n=== 1) Mashina slug nomzodlari ===');
t('GAZ markasiz slug beradi (kategoriya "gazel-biznes")', () => {
  eq(W._carSlugCandidates('gaz-Gazel Biznes'), ['gazel-biznes', 'gazelbiznes']);
});
t('GAZ Volga', () => {
  eq(W._carSlugCandidates('gaz-Volga 31105'), ['volga-31105', 'volga31105']);
});
t('GAZ Sobol (bir so\'z)', () => {
  eq(W._carSlugCandidates('gaz-Sobol'), ['sobol']);
});
t('Chevrolet marka bilan', () => {
  eq(W._carSlugCandidates('chevy-Cobalt'), ['chevy-cobalt']);
});
t('Chevrolet bo\'shliqli model', () => {
  eq(W._carSlugCandidates('chevy-Nexia 3'), ['chevy-nexia3', 'chevy-nexia-3']);
});
t('Bo\'sh qiymat', () => {
  eq(W._carSlugCandidates(''), []);
  eq(W._carSlugCandidates('gaz-'), []);
});

console.log('\n=== 2) Tovar mashinaga mosmi ===');
const P_GAZEL = { id: 1, name: 'Porshen', categories: ['gazel-biznes', 'gazel-next'] };
const P_COBALT = { id: 2, name: 'Kalotka', categories: ['chevy-cobalt'] };
const P_MALIBU2 = { id: 3, name: 'Fara', categories: ['chevy-malibu2'] };
const P_CAPTIVA3 = { id: 4, name: 'Opora', categories: ['chevy-captiva3'] };
const P_OLD = { id: 5, name: 'Eski', category: 'daewoo-tico' };

t('Gazel Biznes -> gazel-biznes tovari', () => ok(W._carMatches(P_GAZEL, 'gaz-Gazel Biznes')));
t('Gazel Biznes -> Cobalt tovari EMAS', () => ok(!W._carMatches(P_COBALT, 'gaz-Gazel Biznes')));
t('Cobalt -> chevy-cobalt', () => ok(W._carMatches(P_COBALT, 'chevy-Cobalt')));
t('Malibu -> malibu2 (prefiks)', () => ok(W._carMatches(P_MALIBU2, 'chevy-Malibu')));
t('Captiva -> captiva3 (prefiks)', () => ok(W._carMatches(P_CAPTIVA3, 'chevy-Captiva')));
t('Tico -> eski `category` maydoni ham tekshiriladi', () => {
  ok(W._carMatches(P_OLD, 'daewoo-Tico'));
  ok(!W._carMatches(P_OLD, 'daewoo-Matiz'));
});
t('Mashina belgilanmagan -> hamma tovar mos (filtrlamaymiz)', () => {
  ok(W._carMatches(P_COBALT, ''));
});
t('Kategoriyasiz tovar mos kelmaydi', () => {
  ok(!W._carMatches({ id: 9, name: 'X' }, 'chevy-Cobalt'));
});

/* ---------------------------------------------------------------- *
 * 5) ISHLAB CHIQARILGAN JOY
 * ---------------------------------------------------------------- */
console.log('\n=== 3) Ishlab chiqarilgan joy ===');
t('"Xitoy (Zavodskoy)" -> "Xitoy"', () => eq(W._originShort('Xitoy (Zavodskoy)'), 'Xitoy'));
t('Original / Rossiya', () => {
  eq(W._originShort('Original'), 'Original');
  eq(W._originShort('Rossiya'), 'Rossiya');
});
t('Ruscha variantlar', () => {
  eq(W._originShort('Россия'), 'Rossiya');
  eq(W._originShort('Китай'), 'Xitoy');
  eq(W._originShort('Оригинал'), 'Original');
});
t('Bo\'sh -> bo\'sh', () => eq(W._originShort(''), ''));
t('_originMatches', () => {
  ok(W._originMatches({ origin: 'Xitoy (Zavodskoy)' }, 'Xitoy'));
  ok(!W._originMatches({ origin: 'Original' }, 'Xitoy'));
  ok(W._originMatches({ origin: 'Original' }, ''), 'kalit bo\'sh -> hammasi mos');
  ok(!W._originMatches({}, 'Original'));
});
t('Belgi HTML xavfsiz (XSS)', () => {
  const h = W._originBadgeHTML('<img src=x onerror=alert(1)>');
  ok(h.indexOf('<img') < 0, 'teg qochirilmadi: ' + h);
  ok(h.indexOf('&lt;img') >= 0, 'escape qilinmagan: ' + h);
});

/* ---------------------------------------------------------------- *
 * 6) FILTR + SARALASH DVIGATELI
 * ---------------------------------------------------------------- */
console.log('\n=== 4) Filtr va saralash ===');
const ITEMS = [
  { id: 1, name: 'A', price: 300000, stock: 5, categories: ['chevy-cobalt'], origin: 'Original' },
  { id: 2, name: 'B', price: 100000, stock: 0, categories: ['chevy-cobalt'], origin: 'Xitoy (Zavodskoy)' },
  { id: 3, name: 'C', price: 200000, stock: 2, categories: ['gazel-biznes'], origin: 'Rossiya',
    oldPrice: 260000 },
  { id: 4, name: 'D', product_type: 'razmerli', price: 50000,
    sizes: [{ size: '1', stock: 0 }, { size: '2', stock: 0 }], categories: ['chevy-cobalt'] },
  { id: 5, name: 'E', price: 400000, categories: ['chevy-cobalt'] }  // stock YO'Q -> 10 deb hisoblanadi
];
const ids = (arr) => arr.map((x) => x.id);

t('Filtrsiz — tartib saqlanadi', () => {
  eq(ids(W._applyFilterSort(ITEMS, {})), [1, 2, 3, 4, 5]);
});
t('«Sotuvda bor» — tugaganlar chiqib ketadi', () => {
  // 2 (stock 0) va 4 (razmerlar 0+0) chiqib ketadi; 5 da stock yo'q -> 10
  eq(ids(W._applyFilterSort(ITEMS, { instock: true })), [1, 3, 5]);
});
t('«Chegirmali»', () => {
  eq(ids(W._applyFilterSort(ITEMS, { discount: true })), [3]);
});
t('Origin bo\'yicha', () => {
  eq(ids(W._applyFilterSort(ITEMS, { origin: 'Xitoy' })), [2]);
  eq(ids(W._applyFilterSort(ITEMS, { origin: 'Original' })), [1]);
});
t('Mening mashinam bo\'yicha', () => {
  W.localStorage.setItem('avto_my_car', 'chevy-Cobalt');
  eq(ids(W._applyFilterSort(ITEMS, { mycar: true })), [1, 2, 4, 5]);
  W.localStorage.setItem('avto_my_car', 'gaz-Gazel Biznes');
  eq(ids(W._applyFilterSort(ITEMS, { mycar: true })), [3]);
  W.localStorage.removeItem('avto_my_car');
});
t('Narx bo\'yicha o\'sish / kamayish', () => {
  eq(ids(W._applyFilterSort(ITEMS, { sort: 'price-asc' })), [4, 2, 3, 1, 5]);
  eq(ids(W._applyFilterSort(ITEMS, { sort: 'price-desc' })), [5, 1, 3, 2, 4]);
});
t('Razmer narxi berilgan bo\'lsa eng arzoni olinadi', () => {
  const p = { id: 9, product_type: 'razmerli', price: 999999,
              sizes: [{ size: 'a', price: 70000, stock: 1 }, { size: 'b', price: 90000, stock: 1 }] };
  eq(W._cbPriceOf(p), 70000);
});
t('Saralash BARQAROR (teng narxda sakramaydi)', () => {
  const same = [{ id: 1, price: 100 }, { id: 2, price: 100 }, { id: 3, price: 100 }];
  eq(ids(W._applyFilterSort(same, { sort: 'price-asc' })), [1, 2, 3]);
});
t('Filtrlar birga ishlaydi', () => {
  W.localStorage.setItem('avto_my_car', 'chevy-Cobalt');
  eq(ids(W._applyFilterSort(ITEMS, { mycar: true, instock: true, sort: 'price-desc' })), [5, 1]);
  W.localStorage.removeItem('avto_my_car');
});
t('Massiv bo\'lmasa o\'zi qaytadi (yiqilmaydi)', () => {
  eq(W._applyFilterSort(null, {}), null);
  eq(W._applyFilterSort(undefined, {}), undefined);
});
t('Razmerli tovar qoldig\'i razmerlardan yig\'iladi', () => {
  eq(W._cbStockOf(ITEMS[3]), 0);
  eq(W._cbStockOf({ product_type: 'razmerli', sizes: [{ stock: 3 }, { stock: 4 }] }), 7);
  eq(W._cbStockOf({ stock: 2 }), 2);
  eq(W._cbStockOf({}), 10, 'stock yo\'q -> 10 (mavjud xatti-harakat saqlanadi)');
});

/* ---------------------------------------------------------------- *
 * 7) QIDIRUV BILAN YAGONA DVIGATEL
 * ---------------------------------------------------------------- */
console.log('\n=== 5) Qidiruv ham AYNI dvigatelni ishlatadi ===');
t('_sfsApply yangi dvigatelga yo\'naltirildi', () => {
  W._sfsState = { sort: 'price-asc', instock: false, discount: false };
  eq(ids(W._sfsApply(ITEMS)), [4, 2, 3, 1, 5]);
});
t('_sfsApply da «relevance» saralamaydi', () => {
  W._sfsState = { sort: 'relevance' };
  eq(ids(W._sfsApply(ITEMS)), [1, 2, 3, 4, 5]);
});
t('_sfsIsDefault yangi chiplarni hisobga oladi', () => {
  W._sfsState = { sort: 'relevance', instock: false, discount: false };
  ok(W._sfsIsDefault(), 'standart holat bo\'lishi kerak');
  W._sfsState.mycar = true;
  ok(!W._sfsIsDefault(), 'mycar yoqilgan -> standart EMAS');
  W._sfsState.mycar = false;
  W._sfsState.origin = 'Original';
  ok(!W._sfsIsDefault(), 'origin tanlangan -> standart EMAS');
  W._sfsState = { sort: 'relevance', instock: false, discount: false };
});
t('_sfsReset yangi chiplarni ham tozalaydi', () => {
  W._sfsState = { sort: 'relevance', mycar: true, origin: 'Xitoy' };
  W._sfsReset();
  ok(!W._sfsState.mycar && !W._sfsState.origin, 'tozalanmadi');
});

/* ---------------------------------------------------------------- *
 * 8) KARTOCHKAGA BELGI QO'SHILISHI
 * ---------------------------------------------------------------- */
console.log('\n=== 6) Kartochka TEGILMAGANLIGI ===');
t('kartochka HTML\'i O\'ZGARMAYDI (origin bo\'lsa ham)', () => {
  const h = W.cardHTML({ id: 1, name: 'Porshen', origin: 'Original' });
  ok(h.indexOf('card-origin') < 0,
     'kartochkaga belgi qo\'shilgan — ko\'rinish o\'zgaradi: ' + h);
  ok(h.indexOf('<h4>Porshen</h4>') > 0, 'kartochka buzilgan');
});
t('origin belgisi TOVAR OYNASI uchun tayyor', () => {
  // Kartochkada emas, `#pm-origin` da ishlatiladi.
  const b = W._originBadgeHTML('Xitoy (Zavodskoy)');
  ok(b.indexOf('card-origin') > 0 && b.indexOf('o-xitoy') > 0, b);
  ok(W._originBadgeHTML('') === '', 'bo\'sh origin -> bo\'sh belgi');
});

/* ---------------------------------------------------------------- *
 * 9) O'RAMALAR ASL FUNKSIYANI CHAQIRADI
 * ---------------------------------------------------------------- */
console.log('\n=== 7) O\'ramalar (wrapper) asl kodni buzmaydi ===');
t('renderProducts asl versiyani chaqiradi', () => {
  CALLS.length = 0;
  W.renderProducts();
  ok(CALLS.indexOf('origRender') >= 0, 'asl renderProducts chaqirilmadi');
});
t('showSection asl versiyani chaqiradi', () => {
  CALLS.length = 0;
  W.showSection('katalog-menu');
  ok(CALLS.indexOf('origShowSection') >= 0);
});
t('openProduct asl versiyani chaqiradi', () => {
  CALLS.length = 0;
  W.openProduct(1);
  ok(CALLS.indexOf('origOpenProduct') >= 0);
});
t('saveMyCar asl versiyani chaqiradi va qiymat qaytadi', () => {
  CALLS.length = 0;
  eq(W.saveMyCar('chevy-Cobalt'), 'chevy-Cobalt');
  ok(CALLS.indexOf('origSaveMyCar') >= 0);
});
t('_sfsSyncToolbar asl versiyani chaqiradi', () => {
  CALLS.length = 0;
  W._sfsSyncToolbar(false, 0, 0);
  ok(CALLS.indexOf('origSfsSync') >= 0);
});

/* ---------------------------------------------------------------- *
 * 10) BO'LIM ID'SINI TOPISH
 * ---------------------------------------------------------------- */
console.log('\n=== 8) «Mening mashinam» bo\'limini topish ===');
t('aniq mos bo\'lim', () => {
  REGISTRY.clear(); GRIDS.length = 0;
  const g = makeEl('chevy-cobalt-parts', 'items-grid hidden');
  REGISTRY.set(g.id, g); GRIDS.push(g);
  eq(W._myCarSectionId('chevy-Cobalt'), 'chevy-cobalt-parts');
});
t('prefiks bo\'yicha (Malibu -> malibu1)', () => {
  REGISTRY.clear(); GRIDS.length = 0;
  const g = makeEl('chevy-malibu1-parts', 'items-grid hidden');
  GRIDS.push(g);   // getElementById('chevy-malibu-parts') YO'Q
  eq(W._myCarSectionId('chevy-Malibu'), 'chevy-malibu1-parts');
});
t('mos bo\'lim yo\'q -> bo\'sh satr', () => {
  REGISTRY.clear(); GRIDS.length = 0;
  eq(W._myCarSectionId('chevy-Cobalt'), '');
});
t('mashina belgilanmagan -> bo\'sh satr', () => {
  eq(W._myCarSectionId(''), '');
});

/* ---------------------------------------------------------------- *
 * 11) CSS QATLAMI — TEJAMKORLIK QO'RIQCHILARI
 *
 * Bu bo'lim REGRESSIYAGA qarshi. Bir marta shu qatlamda kartochka
 * rasmi `object-fit: contain` ga o'zgartirilgan va `.img-wrap` ga
 * `radial-gradient` fon qo'yilgan edi. Natijada:
 *   • fayldagi «karta parallaksi» (har skroll kadrida rasmga
 *     `scale(1.08) translate3d(...)`) letterbox chegaralarini
 *     ko'rsatib, rasm kartadan «uzilib» suzardi;
 *   • gradient fon + transform + mask uch qatlamni har kadrda qayta
 *     aralashtirishga majbur qilib, TELEFONNI QIZDIRARDI (iPhone 17
 *     Pro Max'da ham).
 * Shu sababli kartochka ko'rinishiga tegish TAQIQLANADI.
 * ---------------------------------------------------------------- */
console.log('\n=== 9) CSS tejamkorlik qo\'riqchilari ===');

const CSS_BLOCK = (() => {
  const at = HTML.indexOf('<style id="customer-boost-2026">');
  return at < 0 ? '' : HTML.slice(at, HTML.indexOf('</style>', at));
})();

t('qatlam CSS bloki mavjud', () => {
  ok(CSS_BLOCK.length > 500, 'CSS bloki topilmadi');
  ok(CSS_BLOCK.indexOf('#pmz') >= 0, 'zoom qatlami CSS topilmadi');
  ok(CSS_BLOCK.indexOf('.cfs-bar') >= 0, 'katalog filtr paneli CSS topilmadi');
  ok(CSS_BLOCK.indexOf('#mycar-shortcut') >= 0, 'mening mashinam yorlig\'i CSS topilmadi');
});

/* CSS ni HAQIQIY qoidalarga ajratamiz. Izohlar avval olib tashlanadi —
 * aks holda izoh ichidagi «object-fit: contain» so'zi soxta ogohlantirish
 * berardi (birinchi urinishda aynan shunday bo'lgan). */
const CSS_RULES = (() => {
  const clean = CSS_BLOCK.replace(/\/\*[\s\S]*?\*\//g, '');
  const out = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(clean))) {
    out.push({ sel: m[1].trim().replace(/\s+/g, ' '), body: m[2] });
  }
  return out;
})();

t('CSS qoidalari o\'qildi', () => {
  ok(CSS_RULES.length > 15, 'qoidalar ajratilmadi: ' + CSS_RULES.length);
});

t('REGRESSIYA: qatlam TOVAR KARTOCHKASIGA umuman tegmaydi', () => {
  const forbidden = ['.luxury-card', '.similar-card', '.search-item'];
  const hits = CSS_RULES.filter((r) => forbidden.some((f) => r.sel.indexOf(f) >= 0));
  ok(hits.length === 0,
     'Kartochkaga tegilgan: ' + hits.map((h) => h.sel).join(' | ') +
     '\n       Sabab: fayldagi «karta parallaksi» har skroll kadrida rasmga ' +
     'scale(1.08) qo\'llaydi va `cover` + mask\'ga tayanadi. Tegilsa rasm ' +
     'ajralib turadi VA telefon qiziydi.');
});

t('REGRESSIYA: hech bir qoidada `object-fit` yo\'q', () => {
  const hits = CSS_RULES.filter((r) => /object-fit/.test(r.body));
  ok(hits.length === 0, 'object-fit qaytib kelgan: ' + hits.map((h) => h.sel).join(' | '));
});

t('REGRESSIYA: `will-change` faqat `#pmz.open` ostida', () => {
  const hits = CSS_RULES.filter((r) => /will-change/.test(r.body));
  ok(hits.length > 0, 'will-change umuman yo\'q — zoom silliq ishlamaydi');
  hits.forEach((h) => {
    ok(h.sel.indexOf('#pmz.open') >= 0,
       'doimiy will-change: «' + h.sel + '» — brauzer GPU qatlamini ' +
       'hech qachon bo\'shatmaydi (batareya va xotira isrofi)');
  });
});

t('REGRESSIYA: doimiy ko\'rinadigan elementda `backdrop-filter` yo\'q', () => {
  // `.pmz-tip` tovar oynasida DOIM turadi — blur qatlami ham doim mavjud
  // bo'lardi. Bu faylda blur ataylab kamaytirilgan (25px -> 10px).
  const hits = CSS_RULES.filter((r) => /backdrop-filter/.test(r.body));
  ok(hits.length === 0,
     'backdrop-filter topildi: ' + hits.map((h) => h.sel).join(' | ') +
     ' — bu faylda blur ataylab kamaytirilgan, qimmat qatlam qo\'shmang');
});

t('lite rejim (zaif telefon) hisobga olingan', () => {
  ok(CSS_BLOCK.indexOf('html.lite') >= 0,
     'html.lite uchun animatsiya o\'chirilmagan');
});

t('REGRESSIYA: `cardHTML` o\'ralmaydi', () => {
  // Kartochkaga qo'shimcha element balandlikni o'zgartiradi
  // (`h4 { min-height: 2.6em }` narx tugmalarini bir chizqda ushlaydi)
  // va uzun ro'yxatda har kartaga ortiqcha DOM tugun qo'shadi.
  ok(LAYER_SRC.indexOf('window.cardHTML = function') < 0,
     '`cardHTML` qayta o\'ralgan — kartochka ko\'rinishi o\'zgaradi');
});

t('katalog paneli standart holatda kartalarni QAYTA CHIZMAYDI', () => {
  // Bu ham isish manbai edi: har renderda barcha <img> qayta dekod
  // qilinardi va parallaks kuzatuvi qaytadan qurilardi.
  ok(LAYER_SRC.indexOf('catIsDefault()') >= 0 &&
     LAYER_SRC.indexOf('insertAdjacentHTML(\'afterbegin\'') >= 0,
     'standart holatda faqat panel qo\'yilishi kerak, innerHTML qayta ' +
     'yozilmasligi kerak');
});

/* ---------------------------------------------------------------- */
console.log('\n' + '='.repeat(54));
console.log(pass + '/' + (pass + fails.length) + ' sinov o\'tdi');
if (fails.length) {
  console.log('\nYIQILGANLAR:');
  fails.forEach(([n, e]) => console.log('  • ' + n + ': ' + e.message));
  process.exit(1);
}
console.log('✅ Mijoz tomoni qatlami — mantiq toza');
process.exit(0);
