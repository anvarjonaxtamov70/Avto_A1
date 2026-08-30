/* =====================================================================
 *  test-auth-guard.js — XAVFSIZ ULANISH (AUTH) QOTIB QOLMASLIGI sinovi
 *
 *  NEGA BU SINOV BOR (haqiqiy nosozlik):
 *    Admin panelda «Xavfsiz ulanish tekshirilmoqda…» ABADIY turib
 *    qolgan va ilova ma'lumot yuklamagan. Sabab: `window._authReady`
 *    ichidagi `fetch(TG_PROXY + '/auth')` da VAQT CHEGARASI yo'q edi.
 *    `fetch` ning o'zida timeout YO'Q — Worker javob bermay «osilib»
 *    qolsa, promise HECH QACHON hal bo'lmaydi. Pastda esa
 *    `initUserData()` aynan shu promise'ni `await` qiladi:
 *
 *        try { window._authOk = !!(await window._authReady); } ...
 *
 *    Ya'ni bitta javob bermagan so'rov savat, buyurtmalar, profil —
 *    hammasini to'xtatib qo'yardi va indikator qotib qolardi.
 *
 *  BU SINOV NIMANI KAFOLATLAYDI:
 *    1. `_authReady` HAR QANDAY holatda hal bo'ladi (hatto `fetch`
 *       umuman javob bermasa ham) — cheklangan vaqt ichida.
 *    2. Javob bermaganda qiymat `false` bo'ladi (ilova davom etadi).
 *    3. Auth muvaffaqiyatli bo'lsa `true` va indikator YASHIL.
 *    4. Indikator hech qachon «tekshirilmoqda» holatida qotib
 *       qolmaydi — auth qatlami butunlay sinsa ham 13 s dan keyin
 *       XATO va SABAB ko'rsatiladi.
 *    5. Indikator `window.openModal` MAVJUD BO'LMASA ham ishlaydi
 *       (aynan shu bog'liqlik xatoni yashirib turgan edi).
 *
 *  QANDAY ISHLAYDI:
 *    `index.html` dan IKKI bo'lak AYNAN o'zi ajratib olinadi:
 *      • auth bloki (`window._authReady = (async function ...`)
 *      • indikator bloki (`var authSettled = false;` ...)
 *    Har bir holat uchun TOZA `vm` konteksti quriladi. Vaqt 50 barobar
 *    TEZLASHTIRILADI (`setTimeout` ms/50), shuning uchun 12 sekundlik
 *    chegara sinovda ~240 ms bo'ladi — mantiq o'zgarmaydi, sinov tez.
 *
 *  ISHGA TUSHIRISH:  node .github/test-auth-guard.js
 * ===================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

/* ---------------------------------------------------------------- *
 * 1) Kodni ajratib olamiz — markerlar AYNAN BITTA bo'lishi shart
 * ---------------------------------------------------------------- */
function sliceOnce(startRe, startLit, endLit, label) {
  const hits = HTML.match(startRe) || [];
  if (hits.length !== 1) {
    console.error('❌ `' + label + '` boshlanish markeri ' + hits.length
      + ' marta topildi (1 bo\'lishi kerak).');
    process.exit(1);
  }
  const i = HTML.indexOf(startLit);
  const j = HTML.indexOf(endLit, i);
  if (i < 0 || j < 0) {
    console.error('❌ `' + label + '` bo\'lagi kesib olinmadi.');
    process.exit(1);
  }
  return HTML.slice(i, j + endLit.length);
}

/* Auth bo'lagi: boshlanish — `_authReady` ta'rifi, tugash — undan keyingi
 * bo'lim sarlavhasi. Tugash markeri sifatida `    ]);` ni OLMAYMIZ: agar
 * kimdir `Promise.race` kafolatini o'chirsa, kesish umuman ishlamay
 * qolardi va sinov XATONI ko'rsatmasdan «kesib olinmadi» deb yiqilardi.
 * Bo'lim sarlavhasi esa har holatda joyida turadi — shunda sinov
 * MANTIQNI tekshiradi. */
const AUTH_START = '    window._authReady = (async function signInToFirebase() {';
const AUTH_END = '🔐 ADMIN TEKSHIRUVI (himoya darajasi';
const AUTH_SRC = sliceOnce(
  /^    window\._authReady = \(async function signInToFirebase\(\) \{$/gm,
  AUTH_START, AUTH_END, 'auth bloki'
).replace(/\/\/[^\n]*$/, '');   // oxirgi chala izoh satrini kesamiz

const IND_START = '  var authSettled = false;';
const IND_END = "  // Chip'lar boshlang'ich holati";
const IND_SRC = sliceOnce(
  /^  var authSettled = false;$/gm,
  IND_START, IND_END, 'indikator bloki'
);

/* ---------------------------------------------------------------- *
 * 2) Sinov mexanizmi
 * ---------------------------------------------------------------- */
let pass = 0;
const fails = [];
async function t(name, fn) {
  try { await fn(); pass++; console.log('  ✅ ' + name); }
  catch (e) { fails.push([name, e]); console.log('  ❌ ' + name + '\n       ' + e.message); }
}
function eq(a, b, msg) {
  if (a !== b) throw new Error((msg || 'teng emas') + ': kutilgan '
    + JSON.stringify(b) + ', olingan ' + JSON.stringify(a));
}
function ok(v, msg) { if (!v) throw new Error(msg || 'rost emas'); }
function has(hay, needle, msg) {
  const s = String(hay);
  if (s.indexOf(needle) === -1) {
    // Uzun bo'laklarni to'liq bosmaymiz — CI jurnalini ko'mib tashlaydi.
    const shown = s.length > 180 ? s.slice(0, 180) + '…' : s;
    throw new Error((msg || 'matn ichida yo\'q') + ': «' + needle
      + '» topilmadi. Bor matn: «' + shown + '»');
  }
}

/* Vaqtni tezlashtirish koeffitsienti: 12000 ms -> 240 ms */
const SPEED = 50;
const real = (ms) => Math.max(1, Math.ceil(ms / SPEED));
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/* ---------------------------------------------------------------- *
 * 3) Muhit (DOM + Firebase + Telegram) stub'i
 * ---------------------------------------------------------------- */
function makeEl(id) {
  const el = {
    id: id || '', textContent: '', innerHTML: '', style: {}, attrs: {},
    _cls: new Set(),
    classList: {
      add(c) { el._cls.add(c); },
      remove(...cs) { cs.forEach(c => el._cls.delete(c)); },
      contains(c) { return el._cls.has(c); },
      toggle(c, on) {
        if (on === undefined) { el._cls.has(c) ? el._cls.delete(c) : el._cls.add(c); }
        else if (on) { el._cls.add(c); } else { el._cls.delete(c); }
      }
    },
    setAttribute(k, v) { el.attrs[k] = String(v); },
    getAttribute(k) { return k in el.attrs ? el.attrs[k] : null; },
    closest(sel) { return sel === '#' + el.id ? el : null; },
    addEventListener() {}, removeEventListener() {},
    querySelector() { return null; }, querySelectorAll() { return []; }
  };
  return el;
}

/**
 * Sinov muhitini quradi.
 * @param {object} o
 *   o.initData     — Telegram initData (bo'sh satr = Telegram tashqarisi)
 *   o.fetchMode    — 'hang' | 'ok' | 'reject' | 'badjson'
 *   o.runAuth      — auth blokini bajarish (false bo'lsa `_authReady` buzuq)
 *   o.brokenReady  — `_authReady` o'rniga hech qachon hal bo'lmaydigan promise
 *   o.withOpenModal— `window.openModal` mavjudmi
 */
function buildEnv(o) {
  const state = { fetchCalls: 0, aborted: 0, signedIn: 0, clickHandlers: [] };
  const els = {
    'auth-status': makeEl('auth-status'),
    'auth-text': makeEl('auth-text'),
    'home-products': makeEl('home-products'),
    'home-title': makeEl('home-title'),
    'hf-promo': makeEl('hf-promo'),
    'hf-stock': makeEl('hf-stock')
  };

  let fbUser = null;
  const firebase = {
    auth: function () {
      return {
        get currentUser() { return fbUser; },
        signInWithCustomToken: async function () {
          state.signedIn++;
          fbUser = { uid: '5105291033' };
          return { user: fbUser };
        }
      };
    }
  };

  const documentStub = {
    readyState: 'complete',
    body: makeEl('body'),
    getElementById(id) { return els[id] || null; },
    createElement() { return makeEl(''); },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    addEventListener(type, fn, capture) {
      if (type === 'click') state.clickHandlers.push({ fn, capture: !!capture });
    }
  };

  function fetchStub(url, opts) {
    state.fetchCalls++;
    if (o.fetchMode === 'reject') return Promise.reject(new Error('network down'));
    if (o.fetchMode === 'ok') {
      return Promise.resolve({ json: async () => ({ ok: true, token: 'CUSTOM_TOKEN' }) });
    }
    if (o.fetchMode === 'badjson') {
      return Promise.resolve({ json: async () => ({ ok: false }) });
    }
    // 'hang' — HECH QACHON hal bo'lmaydi (haqiqiy nosozlik shu edi)
    if (opts && opts.signal && opts.signal.addEventListener) {
      opts.signal.addEventListener('abort', () => { state.aborted++; });
    }
    return new Promise(function () { /* abadiy */ });
  }

  const win = {
    document: documentStub,
    firebase,
    tg: { initData: o.initData === undefined ? 'query_id=X&user=%7B%7D&hash=abc' : o.initData },
    TG_PROXY: 'https://worker.example.workers.dev',
    _dwarn() {},
    addEventListener() {}
  };
  if (o.withOpenModal) {
    win.openModal = function (id) { state.openedModal = id; return id; };
  }

  const ctx = vm.createContext(Object.assign(win, {
    window: win,
    console: { log() {}, warn() {}, error() {} },
    fetch: fetchStub,
    AbortController,
    Promise, Error, JSON, Date, Math, Object, String, Number, Array, Set, Map,
    isFinite, parseInt, parseFloat,
    showToast() {},
    // ⏱️ TEZLASHTIRILGAN VAQT — mantiq o'zgarmaydi, faqat masshtab.
    //    ⚠️ `unref()` QILMAYMIZ: qayta urinish oralig'i ham shu timer'da,
    //    unref qilinsa Node hodisa halqasini bo'sh deb bilib, sinov
    //    o'rtasida JIMGINA chiqib ketadi (bir marta shunday bo'ldi).
    setTimeout: (fn, ms) => setTimeout(fn, real(ms || 0)),
    clearTimeout: (h) => clearTimeout(h)
  }));

  if (o.runAuth !== false) {
    vm.runInContext(AUTH_SRC, ctx, { filename: 'auth-block' });
  }
  if (o.brokenReady) {
    win._authReady = new Promise(function () { /* abadiy hal bo'lmaydi */ });
  }
  vm.runInContext(IND_SRC, ctx, { filename: 'auth-indicator' });

  return { ctx, win, els, state };
}

/* ================================================================ *
 *  SINOVLAR
 * ================================================================ */
(async function main() {

  /* -------------------------------------------------------------- *
   * 1) STATIK: chegaralanmagan `fetch` qaytib kelmasin (regressiya)
   * -------------------------------------------------------------- */
  console.log('\n=== 1) Statik tekshiruv: fetch chegaralanganmi ===');

  await t('auth blokida `await fetch(` TO\'G\'RIDAN-TO\'G\'RI ishlatilmaydi', () => {
    ok(AUTH_SRC.indexOf('await fetch(') === -1,
      'chegarasiz `await fetch(` qaytib kelgan — Worker osilsa ilova qotib qoladi');
  });

  await t('`fetchWithTimeout` yordamchisi bor', () => {
    has(AUTH_SRC, 'function fetchWithTimeout(');
    has(AUTH_SRC, 'await fetchWithTimeout(');
  });

  await t('so\'rov haqiqatan bekor qilinadi (AbortController)', () => {
    has(AUTH_SRC, 'AbortController');
    has(AUTH_SRC, 'ctl.abort()');
  });

  await t('oxirgi kafolat — Promise.race bilan umumiy chegara', () => {
    has(AUTH_SRC, 'Promise.race([');
    ok(/r\(false\); \}, 12000\)/.test(AUTH_SRC), '12000 ms umumiy chegara topilmadi');
  });

  await t('indikator 13 s dan keyin «kutilmoqda»ni XATOga aylantiradi', () => {
    ok(/\}, 13000\);/.test(IND_SRC), '13000 ms kafolat topilmadi');
    has(IND_SRC, 'authTimedOut = true');
  });

  /* -------------------------------------------------------------- *
   * 2) ASOSIY NOSOZLIK: Worker javob bermaydi (fetch osilib qoladi)
   * -------------------------------------------------------------- */
  console.log('\n=== 2) Worker javob bermasa (haqiqiy nosozlik) ===');

  {
    const env = buildEnv({ fetchMode: 'hang' });

    await t('boshida indikator halol «tekshirilmoqda» deydi', () => {
      has(env.els['auth-text'].textContent, 'tekshirilmoqda');
      ok(!env.els['auth-status'].classList.contains('bad'), 'hali xato deb belgilanmasin');
      ok(!env.els['auth-status'].classList.contains('ok'), 'hali yashil bo\'lmasin');
    });

    let settledValue = 'HAL BO\'LMADI';
    env.win._authReady.then(v => { settledValue = v; }, () => { settledValue = 'REJECT'; });

    // Umumiy chegara 12 000 ms -> 240 ms. Ehtiyot uchun 500 ms kutamiz.
    await sleep(500);

    await t('`_authReady` MAJBURAN hal bo\'ldi (abadiy kutmaydi)', () => {
      ok(settledValue !== 'HAL BO\'LMADI',
        'promise hal bo\'lmadi — `initUserData()` shu yerda abadiy kutib qolardi');
      eq(settledValue, false, 'javob bo\'lmaganda qiymat');
    });

    await t('har bir urinish bekor qilindi (so\'rov osilib qolmadi)', () => {
      ok(env.state.aborted >= 1, 'abort chaqirilmadi: ' + env.state.aborted);
    });

    await t('qayta urinish 2 marta bo\'ldi (Telegram ichida)', () => {
      eq(env.state.fetchCalls, 2, 'fetch chaqirilishlar soni');
    });

    await t('indikator «tekshirilmoqda»da QOTIB QOLMADI', () => {
      ok(env.els['auth-text'].textContent.indexOf('tekshirilmoqda') === -1,
        'indikator hali ham kutish holatida: «' + env.els['auth-text'].textContent + '»');
    });

    await t('indikator QIZIL va SABABINI yozadi', () => {
      ok(env.els['auth-status'].classList.contains('bad'), '«bad» klassi qo\'yilmadi');
      has(env.els['auth-text'].textContent, 'javob bermadi');
      has(env.els['auth-text'].textContent, 'joriy QILMANG');
    });
  }

  /* -------------------------------------------------------------- *
   * 3) MUVAFFAQIYATLI AUTH — yashil holat
   * -------------------------------------------------------------- */
  console.log('\n=== 3) Auth ishlaganda ===');

  {
    const env = buildEnv({ fetchMode: 'ok' });
    const v = await env.win._authReady;

    await t('`_authReady` -> true', () => eq(v, true));
    await t('custom token bilan kirildi', () => eq(env.state.signedIn, 1));
    await t('bitta so\'rov kifoya (keraksiz qayta urinish yo\'q)', () => {
      eq(env.state.fetchCalls, 1);
    });

    env.win._authStatusRefresh();
    await t('indikator YASHIL va uid ko\'rsatiladi', () => {
      ok(env.els['auth-status'].classList.contains('ok'), '«ok» klassi yo\'q');
      has(env.els['auth-text'].textContent, 'ishlayapti');
      has(env.els['auth-text'].textContent, '5105291033');
      ok(!env.els['auth-status'].classList.contains('bad'), 'ayni paytda «bad» bo\'lmasin');
    });
  }

  /* -------------------------------------------------------------- *
   * 4) TELEGRAM TASHQARISI (initData yo'q) — tez va aniq javob
   * -------------------------------------------------------------- */
  console.log('\n=== 4) Telegram tashqarisida ochilsa ===');

  {
    const env = buildEnv({ initData: '', fetchMode: 'hang' });
    const v = await env.win._authReady;

    await t('darhol false (kutib turmaydi)', () => eq(v, false));
    await t('so\'rov umuman yuborilmaydi', () => eq(env.state.fetchCalls, 0));

    await sleep(30);
    await t('sabab aniq: Telegram ichidan ochish kerak', () => {
      ok(env.els['auth-status'].classList.contains('bad'));
      has(env.els['auth-text'].textContent, 'Telegram tashqarisida');
    });
  }

  /* -------------------------------------------------------------- *
   * 5) TARMOQ XATOSI va NOTO'G'RI JAVOB
   * -------------------------------------------------------------- */
  console.log('\n=== 5) Tarmoq xatosi / noto\'g\'ri javob ===');

  {
    const env = buildEnv({ fetchMode: 'reject' });
    const v = await env.win._authReady;
    await t('fetch reject bo\'lsa — false, yiqilmaydi', () => eq(v, false));
    await t('2 marta urinib ko\'rdi', () => eq(env.state.fetchCalls, 2));
  }

  {
    const env = buildEnv({ fetchMode: 'badjson' });
    const v = await env.win._authReady;
    await t('Worker {ok:false} qaytarsa — false', () => eq(v, false));
    await t('token yo\'q bo\'lsa kirishga urinmaydi', () => eq(env.state.signedIn, 0));
  }

  /* -------------------------------------------------------------- *
   * 6) AUTH QATLAMI BUTUNLAY SINSA — 13 s kafolati
   * -------------------------------------------------------------- */
  console.log('\n=== 6) `_authReady` hal bo\'lmasa ham indikator gapiradi ===');

  {
    const env = buildEnv({ runAuth: false, brokenReady: true, fetchMode: 'hang' });

    await t('boshida «tekshirilmoqda»', () => {
      has(env.els['auth-text'].textContent, 'tekshirilmoqda');
    });

    // 13 000 ms -> 260 ms. 500 ms kutamiz.
    await sleep(500);

    await t('13 s dan keyin XATO deb ko\'rsatiladi (abadiy kutmaydi)', () => {
      ok(env.els['auth-status'].classList.contains('bad'), '«bad» qo\'yilmadi');
      ok(env.els['auth-text'].textContent.indexOf('tekshirilmoqda') === -1,
        'hali ham kutish holatida');
      has(env.els['auth-text'].textContent, 'vaqtida javob bermadi');
    });
  }

  /* -------------------------------------------------------------- *
   * 7) `openModal` BO'LMASA HAM ishlaydi — asl xatoning sababi
   * -------------------------------------------------------------- */
  console.log('\n=== 7) `openModal` mavjud bo\'lmasa ===');

  {
    const env = buildEnv({ withOpenModal: false, fetchMode: 'ok' });

    await t('qatlam `openModal` bo\'lmasa ham yiqilmadi', () => {
      eq(typeof env.win._authStatusRefresh, 'function');
      eq(typeof env.win.openModal, 'undefined');
    });

    await env.win._authReady;
    await sleep(60);

    await t('indikator `openModal` SIZ ham o\'zi bo\'yaladi', () => {
      ok(env.els['auth-status'].classList.contains('ok'),
        'modal o\'ramisiz bo\'yalmadi — aynan shu xato edi: «'
        + env.els['auth-text'].textContent + '»');
    });

    await t('admin tugmasi bosilishi capture fazasida tinglanadi', () => {
      const cap = env.state.clickHandlers.filter(h => h.capture);
      ok(cap.length >= 1, 'capture fazasidagi tinglovchi qo\'yilmagan');
    });
  }

  {
    const env = buildEnv({ withOpenModal: true, fetchMode: 'ok' });
    await t('`openModal` bor bo\'lsa — o\'ram qo\'yiladi va asli chaqiriladi', () => {
      eq(typeof env.win.openModal, 'function');
      eq(env.win.openModal('adminModal'), 'adminModal');
      eq(env.state.openedModal, 'adminModal');
    });
  }

  /* -------------------------------------------------------------- *
   * 8) `initUserData` haqiqatan shu promise'ni kutadi (bog'liqlik)
   * -------------------------------------------------------------- */
  console.log('\n=== 8) Bog\'liqlik: ilova yuklanishi auth\'ga bog\'langan ===');

  await t('`initUserData` ichida `await window._authReady` bor', () => {
    has(HTML, 'window._authOk = !!(await window._authReady)');
  });

  await t('katalog o\'qishi auth\'ga bog\'lanmagan (tovarlar baribir ko\'rinadi)', () => {
    const rules = JSON.parse(
      fs.readFileSync(path.join(ROOT, 'database.rules.json'), 'utf8')
        .replace(/^\s*\/\/.*$/gm, '')
    );
    eq(rules.rules.products['.read'], true, 'products .read');
  });

  /* -------------------------------------------------------------- */
  console.log('\n======================================================');
  if (fails.length) {
    console.log('❌ ' + fails.length + ' sinov YIQILDI (' + pass + ' o\'tdi)');
    fails.forEach(([n, e]) => console.log('   • ' + n + ' — ' + e.message));
    process.exit(1);
  }
  console.log(pass + '/' + pass + ' sinov o\'tdi');
  console.log('✅ Auth qotib qolmaydi — indikator ham, ilova ham');
})().catch(e => {
  console.error('❌ Sinov ishlamadi:', e && e.stack || e);
  process.exit(1);
});
