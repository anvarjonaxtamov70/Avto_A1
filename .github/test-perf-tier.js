/* =====================================================================
 *  test-perf-tier.js — ADAPTIV TEZLIK REJIMI (low / mid / high) sinovi
 *
 *  NIMANI KAFOLATLAYDI:
 *    1. Telegram Android User-Agent'idagi qurilma sinfi to'g'ri o'qiladi
 *       (model nomida qavs bo'lsa ham).
 *    2. AVERAGE bo'lsa grafik protsessor ham tekshiriladi va pastrog'i olinadi.
 *    3. Telegram sinfi yo'q Android: GPU / yadrolar / RAM bo'yicha daraja.
 *    4. Qo'lda tanlov ("To'liq" / "Yengil") avtomatikadan ustun.
 *    5. Qurilma imzosi telefon burilganda o'zgarmaydi.
 *    6. Qorovul natijasi 2 kundan keyin eskiradi.
 *    7. Qorovul bahosi: barqaror ~30 Hz (quvvat tejash) zaiflik emas.
 *    8. Boot: low -> lite+pf-weak; boshqalar -> vaqtinchalik lite, keyin yechiladi.
 *    9. Telegram oynasi xato bersa, rejim o'zi almashib ketmaydi.
 *
 *  QANDAY ISHLAYDI: index.html dan <script id="a1-perf-tier"> AYNAN o'zi
 *  ajratib olinadi va har holat uchun toza `vm` kontekstida ishga tushiriladi
 *  (soxta navigator / document / localStorage / WebGL).
 *
 *  ISHGA TUSHIRISH:  node .github/test-perf-tier.js
 * ===================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const m = HTML.match(/<script id="a1-perf-tier">([\s\S]*?)<\/script>/);
if (!m) { console.error('❌ <script id="a1-perf-tier"> topilmadi'); process.exit(1); }
const CODE = m[1];

const UA_AND = 'Mozilla/5.0 (Linux; Android 13; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36';
const tgUA = (model, cls) => UA_AND + ' Telegram-Android/11.3.3 (' + model + '; Android 13; SDK 33; ' + cls + ')';
const UA_IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148';

function makeClassList() {
  const set = new Set();
  return {
    add: (c) => set.add(c), remove: (c) => set.delete(c), contains: (c) => set.has(c),
    toggle: (c, f) => { const on = f === undefined ? !set.has(c) : !!f; if (on) set.add(c); else set.delete(c); return on; },
    toString: () => [...set].sort().join(' '),
  };
}

/** Toza muhit quradi va skriptni ishga tushiradi. */
function boot(opts) {
  const o = Object.assign({ ua: UA_AND, cores: 8, mem: 8, gpu: null, store: {}, w: 390, h: 844, tg: null, conn: null }, opts);
  const store = Object.assign({}, o.store);
  const attrs = {};
  const winL = {}, docL = {};
  let gpuCalls = 0;
  const documentElement = { classList: makeClassList(), setAttribute: (k, v) => { attrs[k] = String(v); }, getAttribute: (k) => attrs[k] };
  const document = {
    documentElement, styleSheets: [], hidden: false,
    addEventListener: (t, f) => { (docL[t] = docL[t] || []).push(f); },
    createElement: () => ({
      getContext: () => {
        gpuCalls++;
        if (o.gpu === false) return null;
        return {
          RENDERER: 1,
          getExtension: (n) => (n === 'WEBGL_debug_renderer_info' ? { UNMASKED_RENDERER_WEBGL: 2 } : (n === 'WEBGL_lose_context' ? { loseContext() {} } : null)),
          getParameter: () => o.gpu || 'Unknown',
        };
      },
    }),
  };
  const navigator = { userAgent: o.ua, hardwareConcurrency: o.cores, deviceMemory: o.mem, maxTouchPoints: 5, connection: o.conn };
  const window = {
    document, navigator,
    screen: { width: o.w, height: o.h },
    localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } },
    addEventListener: (t, f) => { (winL[t] = winL[t] || []).push(f); },
    requestAnimationFrame: () => 1, cancelAnimationFrame: () => {},
    setTimeout: () => 0, WeakSet,
    Telegram: o.tg ? { WebApp: o.tg } : undefined,
  };
  window.window = window;
  const ctx = vm.createContext(Object.assign(window, { Date, JSON, Math, String, Array, Object, parseFloat }));
  vm.runInContext(CODE, ctx);
  return { win: ctx, store, attrs, cls: () => documentElement.classList.toString(), gpuCalls: () => gpuCalls, fire: (t) => (winL[t] || []).forEach((f) => f()) };
}

let fails = 0, n = 0;
function eq(label, got, want) {
  n++;
  if (JSON.stringify(got) === JSON.stringify(want)) return;
  fails++; console.error('❌ ' + label + '\n     kutilgan: ' + JSON.stringify(want) + '\n     olingan:  ' + JSON.stringify(got));
}
const tier = (o) => boot(o).win.A1Perf.info().tier;

// 1) Telegram sinfi
eq('TG LOW -> low', tier({ ua: tgUA('Xiaomi Redmi 10A', 'LOW') }), 'low');
eq('TG HIGH -> high', tier({ ua: tgUA('Samsung SM-S928B', 'HIGH') }), 'high');
eq('Model nomida qavs: LOW o\'qiladi', tier({ ua: tgUA('Xiaomi Redmi Note 8 (2021)', 'LOW') }), 'low');
{ const b = boot({ ua: tgUA('Samsung SM-S928B', 'HIGH'), gpu: 'Mali-G52 MC2' }); eq('TG HIGH: GPU tekshirilmaydi', b.gpuCalls(), 0); }

// 2) AVERAGE + GPU
eq('AVERAGE + Mali-G52 -> low', tier({ ua: tgUA('Xiaomi Redmi 9', 'AVERAGE'), gpu: 'Mali-G52 MC2' }), 'low');
eq('AVERAGE + PowerVR GE8320 -> low', tier({ ua: tgUA('Tecno Spark', 'AVERAGE'), gpu: 'PowerVR Rogue GE8320' }), 'low');
eq('AVERAGE + Adreno 650 -> mid', tier({ ua: tgUA('Samsung SM-A346', 'AVERAGE'), gpu: 'Adreno (TM) 650' }), 'mid');
eq('AVERAGE + noma\'lum GPU -> mid', tier({ ua: tgUA('X', 'AVERAGE'), gpu: 'Unknown' }), 'mid');

// 3) Telegram sinfi yo'q
eq('iPhone -> high', tier({ ua: UA_IOS, cores: undefined, mem: undefined }), 'high');
eq('Android 4 yadro -> low', tier({ cores: 4, gpu: 'Adreno (TM) 650' }), 'low');
eq('Android Adreno 619 -> mid', tier({ gpu: 'Adreno (TM) 619' }), 'mid');
eq('Android Adreno 610 -> low', tier({ gpu: 'Adreno (TM) 610' }), 'low');
eq('Android Mali-G78 -> high', tier({ gpu: 'Mali-G78 MP14' }), 'high');
eq('Android WebGL yo\'q -> low', tier({ gpu: false }), 'low');
eq('Trafik tejash -> low', tier({ ua: tgUA('S', 'HIGH'), conn: { saveData: true } }), 'low');

// 4) Qo'lda tanlov ustun
eq('Pref "high" LOW telefonda -> high', tier({ ua: tgUA('R', 'LOW'), store: { a1_perf_pref: 'high' } }), 'high');
eq('Pref "low" kuchli telefonda -> low', tier({ ua: UA_IOS, store: { a1_perf_pref: 'low' } }), 'low');

// 5) Imzo burilganda o'zgarmaydi
eq('Imzo: portret = landshaft', boot({ w: 390, h: 844 }).win.A1Perf._t.signature(), boot({ w: 844, h: 390 }).win.A1Perf._t.signature());

// 6) Kesh muddati
{
  const sig = boot({}).win.A1Perf._t.signature();
  const day = 24 * 3600 * 1000;
  const old = JSON.stringify({ tier: 'low', at: Date.now() - 3 * day, ttl: 2 * day, sig, src: 'guard', reasons: [] });
  eq('Qorovul natijasi 3 kunda eskiradi', tier({ gpu: 'Mali-G78', store: { a1_perf_auto_v2: old } }), 'high');
  const fresh = JSON.stringify({ tier: 'low', at: Date.now() - 1 * day, ttl: 2 * day, sig, src: 'guard', reasons: [] });
  eq('Qorovul natijasi 1 kunda amal qiladi', tier({ gpu: 'Mali-G78', store: { a1_perf_auto_v2: fresh } }), 'low');
  const other = JSON.stringify({ tier: 'low', at: Date.now(), sig: 'boshqa', src: 'guard', reasons: [] });
  eq('Boshqa qurilma keshi ishlatilmaydi', tier({ gpu: 'Mali-G78', store: { a1_perf_auto_v2: other } }), 'high');
}

// 7) Qorovul bahosi
{
  const c = boot({}).win.A1Perf._t.classify;
  eq('60 fps -> good', c(60, 0), 'good');
  eq('120 fps -> good', c(120, 0), 'good');
  eq('Barqaror 30 Hz -> capped', c(30, 0.01), 'capped');
  eq('30 fps + qotish -> bad', c(30, 0.3), 'bad');
  eq('36 fps -> bad', c(36, 0), 'bad');
  eq('55 fps, 25% qotish -> bad', c(55, 0.25), 'bad');
}

// 8) Boot klasslari
{
  const lo = boot({ ua: tgUA('R', 'LOW') });
  eq('low boot klasslari', lo.cls(), 'lite perf-low pf-weak');
  const hi = boot({ ua: UA_IOS });
  eq('high: boot paytida vaqtinchalik lite', hi.cls(), 'lite');
  hi.win.__endBootLite();
  eq('high: boot tugagach lite yechiladi', hi.cls(), '');
  eq('data-perf atributi', hi.attrs['data-perf'], 'high');
  const mid = boot({ ua: tgUA('S', 'AVERAGE'), gpu: 'Adreno (TM) 650' });
  mid.win.__endBootLite();
  eq('mid klasslari', mid.cls(), 'perf-mid');
}

// 9) Telegram oynasi xato bersa — rejim o'zgarmaydi
{
  const tg = { isVersionAtLeast: () => true, showPopup: () => { throw new Error('WebAppPopupOpened'); } };
  const b = boot({ ua: UA_IOS, tg });
  b.win.A1Perf.openPicker();
  eq('Popup xatosi: pref o\'zgarmaydi', b.win.A1Perf.info().pref, 'auto');
  let picked = null;
  const tg2 = { isVersionAtLeast: () => true, showPopup: (p, cb) => { picked = p.buttons.map((x) => x.id); cb('low'); } };
  const b2 = boot({ ua: UA_IOS, tg: tg2 });
  b2.win.A1Perf.openPicker();
  eq('Popup tugmalari', picked, ['auto', 'low', 'high']);
  eq('Popup orqali "Yengil" tanlandi', [b2.win.A1Perf.info().pref, b2.win.A1Perf.info().tier, b2.store.a1_perf_pref], ['low', 'low', 'low']);
}

if (fails) { console.error('\n❌ ' + fails + ' / ' + n + ' tekshiruv yiqildi'); process.exit(1); }
console.log('✅ Adaptiv tezlik rejimi — ' + n + ' tekshiruv o\'tdi');
