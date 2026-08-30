/* =====================================================================
 *  test-smart-search.js — CHIDAMLI QIDIRUV sinovi
 *
 *  NEGA BU SINOV BOR:
 *    Mijoz tovar nomini sal xato yozsa, tovar chiqmay qolsa — SAVDO
 *    YO'QOLADI va buni hech kim sezmaydi (mijoz shunchaki chiqib
 *    ketadi). Ya'ni bu jimgina pul yo'qotadigan qism.
 *
 *    Shu sababli bu yerda AYNIQSA ikki narsa qo'riqlanadi:
 *      1) xato yozilgan nom TOPILISHI;
 *      2) REGRESSIYA — ilgari ishlagan oddiy so'rovlar buzilmasligi
 *         va begona tovar chiqib qolmasligi (noto'g'ri natija xato
 *         yozuvdan ham yomon).
 *
 *  QANDAY ISHLAYDI:
 *    `index.html` dan `<script id="smart-search-2026-js">` bloki
 *    ajratib olinadi va bajariladi — nusxa emas, HAQIQATDA
 *    YUBORILADIGAN kod sinaladi.
 *
 *  ISHGA TUSHIRISH:  node .github/test-smart-search.js
 * ===================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

/* ⚠️ Blokni AJRATIB OLISH — qator BOSHIDAN izlanadi.
 * Oddiy `indexOf` ishonchsiz: agar marker satri biror IZOHDA ham uchrasa,
 * qidiruv izohni topib, keyingi `</script>` gacha MUTLAQO boshqa kodni
 * kesib olardi (bu xato bir marta sodir bo'ldi). Shuning uchun marker
 * qator boshida bo'lishi va AYNAN bitta bo'lishi tekshiriladi. */
const MARK = '<script id="smart-search-2026-js">';
const lineRe = /^<script id="smart-search-2026-js">$/gm;
const hits = HTML.match(lineRe) || [];
if (hits.length !== 1) {
  console.error('❌ `smart-search-2026-js` bloki ' + hits.length + ' marta topildi (1 bo\'lishi kerak).');
  process.exit(1);
}
lineRe.lastIndex = 0;
const m0 = lineRe.exec(HTML);
const bodyStart = m0.index + MARK.length;
const close = HTML.indexOf('</script>', bodyStart);
if (close < 0) { console.error('❌ blok yopilmagan.'); process.exit(1); }
const LAYER_SRC = HTML.slice(bodyStart, close);

const windowStub = { productsDB: [] };
const ctx = vm.createContext(Object.assign(windowStub, {
  window: windowStub,
  console: { log() {}, warn() {}, error() {} },
  Map, Set, Math, Date, JSON, Number, Array, Object, String, RegExp,
  isFinite, parseInt, parseFloat
}));

try {
  vm.runInContext(LAYER_SRC, ctx, { filename: 'smart-search-2026-js' });
} catch (e) {
  console.error('❌ Qatlam bajarilmadi:', e.message);
  process.exit(1);
}
const W = ctx;

/* ---------------------------------------------------------------- *
 * Sinov mexanizmi
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

/* Sinov katalogi — haqiqiy nomlarga o'xshash */
const CATALOG = [
  { id: 1, name: "Porshen To'plami · Gazel Biznes", code: 'A1-101', desc: 'Original porshen', categories: ['gazel-biznes'], stock: 5 },
  { id: 2, name: 'Kalotka Oldi', code: 'A1-102', desc: 'Tormoz kalotkasi', categories: ['chevy-cobalt'], stock: 3 },
  { id: 3, name: 'Amortizator Orqa', code: 'A1-103', desc: 'Xodovoy qism', categories: ['daewoo-nexia'], stock: 0 },
  { id: 4, name: 'Moybor Filtr', code: 'A1-104', desc: 'Motor moyi filtri', categories: ['chevy-cobalt'], aliases: 'maslo, масло, moy, oil', stock: 8 },
  { id: 5, name: "Fara Chap", code: 'A1-105', desc: 'Old chiroq', categories: ['gazel-biznes'], stock: 2 },
  { id: 6, name: 'Podshipnik Stupitsa', code: 'A1-106', desc: 'G\'ildirak podshipnigi', categories: ['uaz-patriot'], stock: 4 },
  { id: 7, name: 'Radiator Sovutish', code: 'A1-107', desc: 'Motorni sovutish', categories: ['chevy-lacetti'], stock: 1 },
  { id: 8, name: 'Qoralama tovar', code: 'A1-999', desc: 'Bu chiqmasligi kerak', categories: ['x'], stock: 5, is_draft: true }
];
W.productsDB = CATALOG;

/** Qidirib, topilgan id'larni qaytaradi. */
function find(q) { return W._smartMatch(q).map((p) => p.id); }
/** Birinchi natijaning id'si (moslik bo'yicha eng yuqori). */
function top(q) { const r = find(q); return r.length ? r[0] : null; }

/* ================================================================ *
 * 1) NORMALLASHTIRISH
 * ================================================================ */
console.log('\n=== 1) Matnni normallashtirish ===');

t('katta harf va bo\'sh joy', () => eq(W._sNorm('  PORSHEN  '), 'porshen'));

t('apostrofning HAR XIL ko\'rinishi bir xil bo\'ladi', () => {
  const forms = ["to'plami", 'to\u2018plami', 'to\u2019plami', 'to`plami', 'to\u02bbplami', 'toplami'];
  const first = W._sNorm(forms[0]);
  forms.forEach((f) => eq(W._sNorm(f), first, f));
  eq(first, 'toplami');
});

t('kirill -> lotin', () => {
  eq(W._sNorm('поршень'), 'porshen');
  eq(W._sNorm('колодка'), 'kolodka');
  eq(W._sNorm('масло'), 'maslo');
});

t('o\'zbek kirill harflari', () => {
  eq(W._sNorm('қўл'), 'qol');
  eq(W._sNorm('ғилдирак'), 'gildirak');
});

t('tinish belgilari bo\'sh joyga aylanadi', () => {
  eq(W._sNorm('Porshen · Gazel/Biznes (2024)'), 'porshen gazel biznes 2024');
});

/* ================================================================ *
 * 2) FONETIK KALIT
 * ================================================================ */
console.log('\n=== 2) Fonetik kalit ===');

t('x va h bir sinfda (xodovoy / hodovoy)', () => {
  eq(W._sFold('xodovoy'), W._sFold('hodovoy'));
});
t('q va k bir sinfda (kalotka / qalotka)', () => {
  eq(W._sFold('kalotka'), W._sFold('qalotka'));
});
t('s, sh, ts, c bir sinfda (kolsa / kolca)', () => {
  eq(W._sFold('kolsa'), W._sFold('kolca'));
});
t('j va z bir sinfda', () => {
  eq(W._sFold('jiguli'), W._sFold('ziguli'));
});
t('takroriy harflar siqiladi (kollsa -> kolsa)', () => {
  eq(W._sFold('kollsa'), W._sFold('kolsa'));
});
t('BOSHQA so\'zlar ARALASHIB ketmaydi', () => {
  ok(W._sFold('porshen') !== W._sFold('kalotka'), 'porshen va kalotka bir xil bo\'lib qoldi');
  ok(W._sFold('fara') !== W._sFold('radiator'));
});

/* ================================================================ *
 * 3) XATO MASOFASI
 * ================================================================ */
console.log('\n=== 3) Xato masofasi (Levenshtein) ===');

t('bir xil so\'z -> 0', () => eq(W._sLev('porshen', 'porshen', 2), 0));
t('bitta harf xato -> 1', () => eq(W._sLev('porshen', 'porshan', 2), 1));
t('bitta harf tushib qolgan -> 1', () => eq(W._sLev('porshen', 'porshn', 2), 1));
t('chegaradan oshsa tez chiqadi', () => ok(W._sLev('porshen', 'radiator', 2) > 2));
t('uzunlik farqi katta bo\'lsa darhol rad etadi', () => ok(W._sLev('a', 'abcdefgh', 2) > 2));

/* ================================================================ *
 * 4) ANIQ MOSLIK — REGRESSIYA (ilgari ishlagani buzilmasin)
 * ================================================================ */
console.log('\n=== 4) Aniq moslik (regressiya) ===');

t('to\'g\'ri yozilgan nom topiladi', () => ok(find('porshen').indexOf(1) !== -1));
t('kod bo\'yicha topiladi', () => eq(top('A1-104'), 4));
t('tavsif bo\'yicha topiladi', () => ok(find('tormoz').indexOf(2) !== -1));
t('kategoriya bo\'yicha topiladi', () => ok(find('cobalt').indexOf(2) !== -1));
t('QORALAMA tovar HECH QACHON chiqmaydi', () => {
  ['qoralama', 'A1-999', 'chiqmasligi'].forEach((q) => {
    ok(find(q).indexOf(8) === -1, q + ' uchun qoralama chiqdi');
  });
});
t('bo\'sh so\'rov — hammasi (qoralamasiz)', () => {
  const r = find('');
  ok(r.indexOf(8) === -1, 'qoralama chiqdi');
  eq(r.length, 7);
});

/* ================================================================ *
 * 5) SO'Z TARTIBI — ilgari ishlamagan holat
 * ================================================================ */
console.log('\n=== 5) So\'z tartibi va ko\'p so\'zli so\'rov ===');

t('«porshen gazel» topiladi', () => ok(find('porshen gazel').indexOf(1) !== -1));
t('REGRESSIYA TUZATILDI: «gazel porshen» ham topiladi', () => {
  // Ilgari butun so'rov bitta bo'lak sifatida izlanardi — teskari
  // tartib ISHLAMASDI.
  ok(find('gazel porshen').indexOf(1) !== -1, 'teskari tartib ishlamadi');
});
t('«gazel porshun» (xato + tartib) ham topiladi', () => {
  // Ilgari sinonim jadvali BUTUN so'rovga qo'llanardi — shu sababli
  // yolg'iz «porshun» ishlardi, «gazel porshun» esa YO'Q.
  ok(find('gazel porshun').indexOf(1) !== -1, 'so\'z bo\'yicha sinonim ishlamadi');
});

/* ================================================================ *
 * 6) XATO YOZILGAN NOM — asosiy talab
 * ================================================================ */
console.log('\n=== 6) Xato yozilgan nomlar ===');

const TYPOS = [
  ['porshun', 1], ['porshin', 1], ['porshan', 1], ['porshn', 1], ['поршень', 1],
  ['kalodka', 2], ['kolodka', 2], ['kalotki', 2], ['qalotka', 2], ['колодка', 2],
  ['amartizator', 3], ['amortizatr', 3], ['amartisator', 3],
  ['maslo', 4], ['масло', 4], ['moy', 4], ['moybor', 4], ['moybar', 4],
  ['chirol', 5], ['fara', 5], ['fora', 5],
  ['padshipnik', 6], ['podshipnk', 6], ['подшипник', 6],
  ['radyator', 7], ['radiatr', 7], ['радиатор', 7]
];

TYPOS.forEach(([q, id]) => {
  t('«' + q + '» -> #' + id, () => {
    const r = find(q);
    ok(r.indexOf(id) !== -1, 'topilmadi. Natija: [' + r.join(', ') + ']');
  });
});

/* ================================================================ *
 * 7) QO'LDA KIRITILGAN SINONIMLAR
 * ================================================================ */
console.log('\n=== 7) Qo\'lda kiritilgan qidiruv so\'zlari ===');

t('«oil» -> Moybor Filtr (aliases orqali)', () => eq(top('oil'), 4));
t('sinonim KUCHLI signal (birinchi o\'rinda)', () => eq(top('maslo'), 4));
t('sinonimi yo\'q tovar «oil» bo\'yicha chiqmaydi', () => {
  ok(find('oil').indexOf(1) === -1);
});

/* ================================================================ *
 * 8) TARTIBLASH — eng mos birinchi
 * ================================================================ */
console.log('\n=== 8) Moslik bo\'yicha tartiblash ===');

t('nomda mos kelgani tavsifda mos kelganidan YUQORI', () => {
  // «motor» so'zi #7 va #4 tavsifida bor, lekin hech kimning NOMIDA yo'q.
  // «radiator» esa #7 nomida bor -> u birinchi bo'lishi kerak.
  eq(top('radiator'), 7);
});

t('aniq kod eng yuqorida', () => eq(top('A1-102'), 2));

t('sotuvda bor tovar teng balda tepada', () => {
  // #3 (amortizator) qoldig'i 0. Sotuvdagi tovar bilan teng bal olsa,
  // sotuvdagisi tepada bo'lishi kerak.
  const r = W._smartMatch('amortizator');
  ok(r.length > 0);
  eq(r[0].id, 3, 'nomda mos kelgani baribir birinchi bo\'lishi kerak');
});

/* ================================================================ *
 * 9) NOTO'G'RI NATIJA BO'LMASLIGI (eng muhim regressiya)
 * ================================================================ */
console.log('\n=== 9) Begona natija chiqmasligi ===');

t('butunlay boshqa so\'z HECH NARSA topmaydi', () => {
  ['zzzzzz', 'kompyuter', 'telefon qopqogi'].forEach((q) => {
    const r = find(q);
    eq(r.length, 0, q + ' uchun begona natija: [' + r.join(', ') + ']');
  });
});

t('qisqa so\'rovda fuzzy SHOVQIN qilmaydi', () => {
  // 1-2 harfli so'rovda xato masofasi ishlamasligi kerak — aks holda
  // hamma tovar mos kelib ketardi.
  const r = find('zz');
  eq(r.length, 0, 'qisqa so\'rov begona natija berdi: [' + r.join(', ') + ']');
});

t('«fara» so\'rovi radiatorni keltirmaydi', () => {
  ok(find('fara').indexOf(7) === -1);
});

/* ================================================================ *
 * 10) INDEKS KESHI
 * ================================================================ */
console.log('\n=== 10) Indeks keshi ===');

t('nom o\'zgarsa natija O\'ZI yangilanadi', () => {
  ok(find('porshen').indexOf(1) !== -1, 'boshlang\'ich holat');
  CATALOG[0].name = 'Kolenval Gazel Biznes';
  ok(find('kolenval').indexOf(1) !== -1, 'yangi nom bo\'yicha topilmadi');
  CATALOG[0].name = "Porshen To'plami · Gazel Biznes";
  ok(find('porshen').indexOf(1) !== -1, 'eski nom tiklanmadi');
});

t('indeks tovar OBYEKTIGA yozilmaydi (bazaga tushmasligi uchun)', () => {
  find('porshen');
  const keys = Object.keys(CATALOG[0]);
  const bad = keys.filter((k) => k.startsWith('_s') || k === '_si' || k === '_idx');
  eq(bad.length, 0, 'tovarga texnik maydon qo\'shildi: ' + bad.join(', '));
});

t('keshni tozalash funksiyasi ishlaydi', () => {
  W._smartSearchReset();
  ok(find('porshen').indexOf(1) !== -1, 'tozalangandan keyin ham ishlashi kerak');
});

/* ================================================================ *
 * 11) TEZLIK
 * ================================================================ */
console.log('\n=== 11) Tezlik ===');

t('200 tovarda 50 so\'rov < 400ms', () => {
  const big = [];
  for (let i = 0; i < 200; i++) {
    big.push({
      id: 1000 + i, name: 'Tovar ' + i + " Nomi To'plami", code: 'B-' + i,
      desc: 'Tavsif matni ' + i + ' motor qism', categories: ['chevy-cobalt'], stock: i % 5
    });
  }
  const saved = W.productsDB;
  W.productsDB = big;
  W._smartSearchReset();
  const qs = ['porshun', 'kalodka', 'tovar', 'nomi', 'zzzz'];
  const t0 = Date.now();
  for (let i = 0; i < 50; i++) W._smartMatch(qs[i % qs.length]);
  const ms = Date.now() - t0;
  W.productsDB = saved;
  W._smartSearchReset();
  ok(ms < 400, 'juda sekin: ' + ms + 'ms');
  console.log('       (' + ms + 'ms — 200 tovar x 50 so\'rov)');
});

/* ================================================================ *
 * 12) MANBA TEKSHIRUVLARI
 * ================================================================ */
console.log('\n=== 12) Ulanish tekshiruvlari ===');

t('searchProducts smart qidiruvni ishlatadi', () => {
  ok(HTML.indexOf('window._smartMatch(qRaw)') !== -1, 'ulanmagan');
});
t('qatlam yuklanmasa eski yo\'l saqlanadi', () => {
  ok(HTML.indexOf("typeof window._smartMatch === 'function'") !== -1, 'zaxira yo\'l yo\'q');
});
t('admin formasida qidiruv so\'zlari maydoni bor', () => {
  ok(HTML.indexOf('id="add-aliases"') !== -1, 'add formasi');
  ok(HTML.indexOf('id="edit-aliases"') !== -1, 'edit formasi');
});
t('aliases saqlanadi va formaga qaytariladi', () => {
  ok(HTML.indexOf('aliases: pAliases') !== -1, 'yangi tovarda saqlanmaydi');
  ok(HTML.indexOf("getElementById('edit-aliases')") !== -1, 'tahrirda o\'qilmaydi');
  ok(HTML.indexOf('editAliasEl.value = p.aliases') !== -1, 'formaga qaytarilmaydi');
});
t('yangi tovar formasi tozalanganda aliases ham tozalanadi', () => {
  ok(HTML.indexOf("'add-desc','add-aliases'") !== -1, 'tozalash ro\'yxatida yo\'q');
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
console.log('✅ Chidamli qidiruv — mantiq toza');
