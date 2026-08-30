/* =====================================================================
 *  test-ai-chat.js — «SHOGIRD» AI CHAT sinovi
 *
 *  NEGA BU SINOV BOR:
 *    AI chat mijoz bilan bevosita gaplashadigan joy. Bu yerdagi xato
 *    ikki xil zarar keltiradi:
 *      • mijoz javob olmaydi va chiqib ketadi (savdo yo'qoladi);
 *      • AI javobi to'g'ridan-to'g'ri `innerHTML` ga tushsa — XSS.
 *    Ilgari matn AYNAN shunday, escape qilinmasdan chiqarilardi.
 *
 *    Bundan tashqari «suhbatlar» mantiqi (yangi chat / tarix / o'chirish)
 *    va onlayn indikatori — jimgina buziladigan qismlar.
 *
 *  QANDAY ISHLAYDI:
 *    `index.html` dan `<script id="shogird-ai-2026-js">` bloki ajratib
 *    olinadi va soxta DOM + soxta Firebase bilan bajariladi. Ya'ni
 *    nusxa emas, HAQIQATDA YUBORILADIGAN kod sinaladi.
 *
 *  ISHGA TUSHIRISH:  node .github/test-ai-chat.js
 * ===================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

const MARK = '<script id="shogird-ai-2026-js">';
const start = HTML.indexOf(MARK);
if (start < 0) {
  console.error('❌ `shogird-ai-2026-js` skript bloki topilmadi.');
  process.exit(1);
}
const bodyStart = start + MARK.length;
const LAYER_SRC = HTML.slice(bodyStart, HTML.indexOf('</script>', bodyStart));

/* ---------------------------------------------------------------- *
 * Soxta DOM
 * ---------------------------------------------------------------- */
function makeEl(id) {
  const el = {
    id: id || '', value: '', innerHTML: '', innerText: '', textContent: '',
    scrollTop: 0, scrollHeight: 500, style: {}, files: [],
    _cls: new Set(),
    classList: {
      add(c) { el._cls.add(c); }, remove(c) { el._cls.delete(c); },
      contains(c) { return el._cls.has(c); },
      toggle(c, on) {
        if (on === undefined) { el._cls.has(c) ? el._cls.delete(c) : el._cls.add(c); }
        else if (on) { el._cls.add(c); } else { el._cls.delete(c); }
      }
    },
    addEventListener() {}, removeEventListener() {}, focus() {}, click() { el._clicked = 1; },
    querySelector() { return null; }, querySelectorAll() { return []; }
  };
  return el;
}

const REG = new Map();
['aiChatModal', 'ai-chat-box', 'ai-chat-input', 'sg-stat', 'sg-stat-tx', 'sg-hist',
  'sg-hist-btn', 'sg-hist-list', 'sg-attach', 'sg-attach-img', 'sg-attach-tx',
  'sg-file', 'sg-send', 'sg-ava'].forEach((id) => REG.set(id, makeEl(id)));

const documentStub = {
  body: makeEl('body'),
  getElementById(id) { return REG.get(id) || null; },
  createElement() { return makeEl(''); },
  addEventListener() {}
};

/* ---------------------------------------------------------------- *
 * Soxta Firebase — yozuvlarni yozib boradi
 * ---------------------------------------------------------------- */
const WRITES = [];
const LISTENERS = {};
function makeRef(p) {
  return {
    path: p,
    update(o) { WRITES.push(['update', p, o]); return Promise.resolve(); },
    set(o) { WRITES.push(['set', p, o]); return Promise.resolve(); },
    remove() { WRITES.push(['remove', p, null]); return Promise.resolve(); },
    on(ev, cb) { LISTENERS[p] = cb; return cb; },
    off() { delete LISTENERS[p]; }
  };
}
const dbStub = { ref: (p) => makeRef(p) };

const TOASTS = [];
const windowStub = {
  document: documentStub,
  history: { pushState() {}, back() {} },
  addEventListener() {},
  currentUser: 5105291033,
  productsDB: [{ id: 7, name: 'Moybor Filtr', price: 120000, img: 'https://x/i.png' }],
  escHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[c]);
  },
  _hap() {},
  uploadFileWithProgress(file, onp) {
    if (onp) onp(50);
    return windowStub.__uploadFails
      ? Promise.reject(new Error('fail'))
      : Promise.resolve('https://img.example/ok.jpg');
  },
  openProduct() {},
  closeModal() {}
};

const ctx = vm.createContext(Object.assign(windowStub, {
  window: windowStub,
  document: documentStub,
  db: dbStub,
  tg: { showConfirm(q, cb) { cb(true); }, BackButton: { show() {} } },
  activeModal: null,
  showToast: (m, t) => TOASTS.push([m, t || 'success']),
  console: { log() {}, warn() {}, error() {} },
  setTimeout: (fn, ms) => { const t = setTimeout(fn, ms); if (t.unref) t.unref(); return t; },
  clearTimeout, Map, Set, Math, Date, JSON, Number, Array, Object, String, RegExp,
  isFinite, parseInt, parseFloat, URL: { createObjectURL: () => 'blob:x' },
  Promise
}));

try {
  vm.runInContext(LAYER_SRC, ctx, { filename: 'shogird-ai-2026-js' });
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

const modal = REG.get('aiChatModal');
const box = REG.get('ai-chat-box');
const S = W._sgState;

function reset() {
  WRITES.length = 0; TOASTS.length = 0;
  S.uid = 5105291033; S.chats = {}; S.chatId = null; S.attach = null; S.busy = false;
  modal._cls.clear(); box.innerHTML = '';
  REG.get('ai-chat-input').value = '';
}

/* ================================================================ *
 * 1) TEPADAGI BO'SH JOY — asosiy shikoyat
 * ================================================================ */
console.log('\n=== 1) Tepadagi qora bo\'shliq ===');

t('modal paddingi id bo\'yicha nolga tushirilgan', () => {
  ok(/#aiChatModal\.modal-standard\s*\{[^}]*padding:\s*0\s*!important/.test(HTML),
    'padding: 0 !important yo\'q');
});
t('«dasta» chizig\'i (::before) o\'chirilgan', () => {
  ok(HTML.indexOf('#aiChatModal.modal-standard::before { display: none !important; }') !== -1);
});
t('xavfsiz zona SARLAVHAGA berilgan (bo\'sh joyga emas)', () => {
  ok(/\.sg-head\s*\{[\s\S]*?padding-top:\s*calc\(12px \+ env\(safe-area-inset-top/.test(HTML),
    'sarlavhada safe-area yo\'q');
});
t('pastdagi panel ham xavfsiz zonani hisobga oladi', () => {
  ok(/\.sg-foot\s*\{[\s\S]*?padding-bottom:\s*calc\(10px \+ env\(safe-area-inset-bottom/.test(HTML));
});
t('REGRESSIYA: 100px o\'lik pastki joy QAYTIB KELMAGAN', () => {
  const i = HTML.indexOf('id="aiChatModal"');
  const seg = HTML.slice(i, i + 4000);
  ok(seg.indexOf('padding-bottom:100px') === -1, 'eski hack qaytdi');
  ok(seg.indexOf('position:absolute; bottom:0') === -1, 'panel yana absolute');
});

/* ================================================================ *
 * 2) MARKUP — yetishmayotgan funksiyalar
 * ================================================================ */
console.log('\n=== 2) Markup: yangi imkoniyatlar ===');

t('rasm biriktirish tugmasi va fayl kiritishi bor', () => {
  ok(HTML.indexOf('id="sg-file"') !== -1, 'file input yo\'q');
  ok(HTML.indexOf('accept="image/*"') !== -1, 'accept yo\'q');
  ok(HTML.indexOf('aiPickImage(event)') !== -1, 'onchange ulanmagan');
});
t('«yangi suhbat» tugmasi bor', () => ok(HTML.indexOf('onclick="aiNewChat()"') !== -1));
t('«suhbatlar tarixi» tugmasi bor', () => ok(HTML.indexOf('onclick="aiToggleHistory()"') !== -1));
t('onlayn indikatori bor', () => {
  ok(HTML.indexOf('id="sg-stat"') !== -1);
  ok(HTML.indexOf('class="sg-dot"') !== -1);
});
t('#ai-chat-box id SAQLANGAN (touch-scroll ro\'yxati uchun)', () => {
  ok(HTML.indexOf('id="ai-chat-box"') !== -1, 'id o\'zgartirilgan — skroll buziladi');
  ok(HTML.indexOf("'#ai-chat-box, #story-content") !== -1, 'whitelist buzilgan');
});
t('input endi textarea (ko\'p qatorli)', () => {
  ok(/<textarea id="ai-chat-input"/.test(HTML), 'textarea emas');
});

/* ================================================================ *
 * 3) ONLAYN / OFLAYN INDIKATORI
 * ================================================================ */
console.log('\n=== 3) Onlayn indikatori ===');

function fireStatus(ts) {
  reset();
  W.openAiChat();
  const cb = LISTENERS['bot_status'];
  ok(cb, 'bot_status tinglovchisi ulanmagan');
  cb({ val: () => ({ online: true, ts: ts }) });
}

t('yangi yurak urishi -> ONLAYN', () => {
  fireStatus(Date.now());
  ok(modal._cls.has('is-online'), 'is-online sinfi yo\'q');
  ok(!modal._cls.has('is-offline'));
  ok(/Onlayn/.test(REG.get('sg-stat-tx').textContent), REG.get('sg-stat-tx').textContent);
});

t('eski yurak urishi (2 daqiqa) -> OFLAYN', () => {
  fireStatus(Date.now() - 120000);
  ok(modal._cls.has('is-offline'), 'is-offline yo\'q');
  ok(!modal._cls.has('is-online'));
  ok(/Oflayn/.test(REG.get('sg-stat-tx').textContent));
});

t('yurak urishi umuman yo\'q -> OFLAYN', () => {
  fireStatus(0);
  ok(modal._cls.has('is-offline'));
});

t('bir-ikki o\'tkazib yuborilgan yozuv indikatorni buzmaydi (60s)', () => {
  fireStatus(Date.now() - 60000);
  ok(modal._cls.has('is-online'), '60 sekundda hali onlayn bo\'lishi kerak');
});

/* ================================================================ *
 * 4) SUHBATLAR — yangi chat / tanlash / o'chirish
 * ================================================================ */
console.log('\n=== 4) Suhbatlar ===');

t('yangi suhbat yaratiladi va faol bo\'ladi', () => {
  reset();
  W.aiNewChat();
  ok(S.chatId, 'chatId yo\'q');
  ok(S.chats[S.chatId], 'suhbat yaratilmadi');
  const act = WRITES.find((w) => w[2] && w[2].active === S.chatId);
  ok(act, 'faol suhbat bazaga yozilmadi');
});

t('yangi suhbat OCHIQ tarix panelini yopadi', () => {
  reset();
  modal._cls.add('hist-open');
  W.aiNewChat();
  ok(!modal._cls.has('hist-open'));
});

t('suhbat tanlanganda faol suhbat o\'zgaradi', () => {
  reset();
  S.chats = {
    a: { title: 'Bir', createdAt: 1, updatedAt: 1, messages: [] },
    b: { title: 'Ikki', createdAt: 2, updatedAt: 2, messages: [] }
  };
  S.chatId = 'a';
  W.aiSelectChat('b');
  eq(S.chatId, 'b');
  ok(WRITES.some((w) => w[2] && w[2].active === 'b'));
});

t('mavjud bo\'lmagan suhbatni tanlash e\'tiborsiz qoldiriladi', () => {
  reset();
  S.chats = { a: { messages: [] } }; S.chatId = 'a';
  W.aiSelectChat('yoq');
  eq(S.chatId, 'a');
});

t('suhbat o\'chiriladi va boshqasiga o\'tadi', () => {
  reset();
  S.chats = {
    a: { title: 'Bir', createdAt: 1, updatedAt: 1, messages: [] },
    b: { title: 'Ikki', createdAt: 2, updatedAt: 2, messages: [] }
  };
  S.chatId = 'a';
  W.aiDeleteChat('a');
  ok(!S.chats.a, 'o\'chirilmadi');
  eq(S.chatId, 'b', 'boshqa suhbatga o\'tmadi');
  ok(WRITES.some((w) => w[0] === 'remove' && /chats\/a$/.test(w[1])));
});

t('oxirgi suhbat o\'chirilsa YANGISI yaratiladi', () => {
  reset();
  S.chats = { a: { messages: [] } }; S.chatId = 'a';
  W.aiDeleteChat('a');
  ok(S.chatId && S.chatId !== 'a', 'yangi suhbat yaratilmadi');
  ok(S.chats[S.chatId]);
});

t('tarix paneli almashtirgich sifatida ishlaydi', () => {
  reset();
  W.aiToggleHistory();
  ok(modal._cls.has('hist-open'));
  W.aiToggleHistory();
  ok(!modal._cls.has('hist-open'));
});

/* ================================================================ *
 * 5) ESKI SXEMADAN KO'CHIRISH — suhbat yo'qolmasligi kerak
 * ================================================================ */
console.log('\n=== 5) Eski suhbatni saqlab qolish ===');

t('eski cheksiz ro\'yxat alohida suhbatga aylanadi', () => {
  reset();
  W.openAiChat();
  const cb = LISTENERS['ai_requests/5105291033'];
  ok(cb, 'suhbat tinglovchisi yo\'q');
  cb({
    val: () => ({
      messages: [
        { sender: 'user', text: 'salom', time: 1 },
        { sender: 'bot', text: 'assalomu alaykum', time: 2 }
      ]
    })
  });
  const ids = Object.keys(S.chats);
  eq(ids.length, 1, 'ko\'chirilmadi');
  eq(S.chats[ids[0]].title, 'Oldingi suhbat');
  eq(S.chats[ids[0]].messages.length, 2, 'xabarlar yo\'qoldi');
});

t('Firebase LUG\'AT ko\'rinishida qaytarsa ham ishlaydi', () => {
  reset();
  W.openAiChat();
  const cb = LISTENERS['ai_requests/5105291033'];
  cb({
    val: () => ({
      active: 'z',
      chats: { z: { title: 'T', createdAt: 1, updatedAt: 2, messages: { 0: { sender: 'user', text: 'a', time: 1 } } } }
    })
  });
  eq(S.chatId, 'z');
  ok(box.innerHTML.indexOf('sg-me') !== -1, 'xabar chizilmadi');
});

/* ================================================================ *
 * 6) XABAR YUBORISH
 * ================================================================ */
console.log('\n=== 6) Xabar yuborish ===');

t('bo\'sh xabar yuborilmaydi', () => {
  reset();
  W.aiNewChat();
  WRITES.length = 0;
  REG.get('ai-chat-input').value = '   ';
  W.sendAiMessage();
  eq(WRITES.length, 0, 'bo\'sh xabar yuborildi');
});

t('matn yuboriladi va bot uchun signal qo\'yiladi', () => {
  reset();
  W.aiNewChat();
  WRITES.length = 0;
  REG.get('ai-chat-input').value = 'moybor filtr bormi';
  W.sendAiMessage();
  const msgW = WRITES.find((w) => w[2] && w[2].messages);
  ok(msgW, 'xabar yozilmadi');
  eq(msgW[2].messages[msgW[2].messages.length - 1].text, 'moybor filtr bormi');
  const sig = WRITES.find((w) => w[2] && w[2].needs_processing === true);
  ok(sig, 'needs_processing qo\'yilmadi');
});

t('faqat SHU suhbat yoziladi (butun tugun emas)', () => {
  reset();
  W.aiNewChat();
  const cid = S.chatId;
  WRITES.length = 0;
  REG.get('ai-chat-input').value = 'test';
  W.sendAiMessage();
  const msgW = WRITES.find((w) => w[2] && w[2].messages);
  ok(msgW[1].indexOf('/chats/' + cid) !== -1, 'yo\'l noto\'g\'ri: ' + msgW[1]);
});

t('sarlavha birinchi xabardan olinadi', () => {
  reset();
  W.aiNewChat();
  REG.get('ai-chat-input').value = 'Nexia uchun kalotka kerak';
  W.sendAiMessage();
  eq(S.chats[S.chatId].title, 'Nexia uchun kalotka kerak');
});

t('yuborilgandan keyin «yozayapti» ko\'rinadi', () => {
  reset();
  W.aiNewChat();
  REG.get('ai-chat-input').value = 'salom';
  W.sendAiMessage();
  ok(S.busy, 'busy qo\'yilmadi');
  ok(box.innerHTML.indexOf('sg-typing') !== -1, 'nuqtalar chizilmadi');
});

t('bot javob bergach «yozayapti» o\'chadi', () => {
  reset();
  W.openAiChat();
  S.busy = true;
  LISTENERS['ai_requests/5105291033']({
    val: () => ({
      active: 'q',
      chats: { q: { messages: [{ sender: 'user', text: 'a', time: 1 }, { sender: 'bot', text: 'b', time: 2 }] } }
    })
  });
  eq(S.busy, false, 'busy o\'chmadi');
});

/* ================================================================ *
 * 7) RASM
 * ================================================================ */
console.log('\n=== 7) Rasm yuborish ===');

function pick(type, size) {
  reset();
  W.aiNewChat();
  W.aiPickImage({ target: { files: [{ type: type || 'image/jpeg', size: size || 1000, name: 'a.jpg' }] } });
}

t('rasm tanlanganda yuklash boshlanadi', () => {
  pick();
  ok(S.attach, 'attach holati yo\'q');
  eq(REG.get('sg-attach').style.display, 'flex');
});

t('yuklash jarayoni foizda ko\'rsatiladi', () => {
  pick();
  // Soxta yuklovchi darhol 50% xabar beradi — foydalanuvchi kutayotganini
  // bilib turishi kerak (aks holda «osilib qoldi» deb o'ylardi).
  ok(/50%/.test(REG.get('sg-attach-tx').textContent),
    'foiz ko\'rsatilmadi: ' + REG.get('sg-attach-tx').textContent);
});

/* Yuklash NATIJASI asinxron keladi — u 11-bo'limda, izolyatsiyada
   tekshiriladi (global holat boshqa sinovlar bilan aralashmasin). */

t('rasm bo\'lmagan fayl rad etiladi', () => {
  pick('application/pdf');
  ok(TOASTS.some((x) => x[1] === 'warning'), 'ogohlantirish yo\'q');
  ok(!S.attach, 'pdf qabul qilindi');
});

t('juda katta rasm rad etiladi', () => {
  pick('image/jpeg', 9 * 1024 * 1024);
  ok(TOASTS.some((x) => x[1] === 'warning'));
  ok(!S.attach);
});

t('yuklanmagan rasm bilan yuborishga urinish to\'xtatiladi', () => {
  reset();
  W.aiNewChat();
  S.attach = { pending: true, url: '' };
  WRITES.length = 0;
  REG.get('ai-chat-input').value = 'qara';
  W.sendAiMessage();
  eq(WRITES.length, 0, 'yuklanmagan rasm bilan yuborildi');
  ok(TOASTS.some((x) => x[1] === 'warning'));
});

t('rasm + matn yuboriladi (image maydoni bilan)', () => {
  reset();
  W.aiNewChat();
  S.attach = { pending: false, url: 'https://img.example/ok.jpg' };
  WRITES.length = 0;
  REG.get('ai-chat-input').value = 'bu nima';
  W.sendAiMessage();
  const w = WRITES.find((x) => x[2] && x[2].messages);
  const last = w[2].messages[w[2].messages.length - 1];
  eq(last.image, 'https://img.example/ok.jpg');
  eq(last.text, 'bu nima');
});

t('matnsiz rasm ham yuboriladi (savol o\'zi qo\'shiladi)', () => {
  reset();
  W.aiNewChat();
  S.attach = { pending: false, url: 'https://img.example/ok.jpg' };
  WRITES.length = 0;
  REG.get('ai-chat-input').value = '';
  W.sendAiMessage();
  const w = WRITES.find((x) => x[2] && x[2].messages);
  const last = w[2].messages[w[2].messages.length - 1];
  eq(last.image, 'https://img.example/ok.jpg');
  ok(last.text && last.text.length > 5, 'savol matni qo\'shilmadi');
});

t('yuborilgandan keyin biriktirma tozalanadi', () => {
  reset();
  W.aiNewChat();
  S.attach = { pending: false, url: 'https://img.example/ok.jpg' };
  REG.get('ai-chat-input').value = 'x';
  W.sendAiMessage();
  ok(!S.attach, 'biriktirma qolib ketdi');
  eq(REG.get('sg-attach').style.display, 'none');
});

t('rasm chatda ko\'rsatiladi (lazy)', () => {
  reset();
  S.chats = { a: { messages: [{ sender: 'user', text: 'q', image: 'https://i/x.jpg', time: 1 }] } };
  S.chatId = 'a';
  W._sgPaint();
  ok(box.innerHTML.indexOf('sg-mimg') !== -1, 'rasm chizilmadi');
  ok(box.innerHTML.indexOf('loading="lazy"') !== -1, 'lazy emas');
});

/* ================================================================ *
 * 8) XSS — eng muhim regressiya
 * ================================================================ */
console.log('\n=== 8) XSS himoyasi ===');

t('mijoz matni ESCAPE qilinadi', () => {
  reset();
  S.chats = { a: { messages: [{ sender: 'user', text: '<img src=x onerror=alert(1)>', time: 1 }] } };
  S.chatId = 'a';
  W._sgPaint();
  ok(box.innerHTML.indexOf('<img src=x onerror') === -1, 'XSS o\'tdi!');
  ok(box.innerHTML.indexOf('&lt;img') !== -1, 'escape qilinmadi');
});

t('AI javobi ham ESCAPE qilinadi', () => {
  reset();
  S.chats = { a: { messages: [{ sender: 'bot', text: '<script>alert(1)</script>', time: 1 }] } };
  S.chatId = 'a';
  W._sgPaint();
  ok(box.innerHTML.indexOf('<script>alert') === -1, 'XSS o\'tdi!');
});

t('tovar nomi ham ESCAPE qilinadi', () => {
  reset();
  W.productsDB = [{ id: 9, name: '<b>Xato</b>', price: 1000, img: '' }];
  S.chats = { a: { messages: [{ sender: 'bot', text: 'mana', found_products: [9], time: 1 }] } };
  S.chatId = 'a';
  W._sgPaint();
  ok(box.innerHTML.indexOf('<b>Xato</b>') === -1, 'tovar nomi escape qilinmadi');
});

t('yangi qator <br> ga aylanadi (lekin teg emas)', () => {
  reset();
  S.chats = { a: { messages: [{ sender: 'bot', text: 'bir\nikki', time: 1 }] } };
  S.chatId = 'a';
  W._sgPaint();
  ok(box.innerHTML.indexOf('bir<br>ikki') !== -1);
});

/* ================================================================ *
 * 9) BO'SH HOLAT VA TARTIB
 * ================================================================ */
console.log('\n=== 9) Bo\'sh holat va tartib ===');

t('bo\'sh suhbatda salomlashish va taklif chiplari', () => {
  reset();
  W.aiNewChat();
  ok(box.innerHTML.indexOf('sg-hello') !== -1, 'salomlashish yo\'q');
  ok(box.innerHTML.indexOf('sg-tip') !== -1, 'taklif chiplari yo\'q');
});

t('tarix eng yangi suhbatdan boshlanadi', () => {
  reset();
  S.chats = {
    old: { title: 'Eski', createdAt: 1, updatedAt: 1000, messages: [] },
    fresh: { title: 'Yangi', createdAt: 2, updatedAt: 9000, messages: [] }
  };
  S.chatId = 'old';
  W.aiToggleHistory();
  const h = REG.get('sg-hist-list').innerHTML;
  ok(h.indexOf('Yangi') < h.indexOf('Eski'), 'tartib teskari');
});

t('DB yo\'q bo\'lsa chat ochilmaydi va ogohlantiradi', () => {
  reset();
  const saved = ctx.db;
  ctx.db = null;
  TOASTS.length = 0;
  W.openAiChat();
  ok(TOASTS.some((x) => x[1] === 'warning'), 'ogohlantirish yo\'q');
  ctx.db = saved;
});

/* ================================================================ *
 * 10) BOT TOMONI (bot.py) — shartnoma
 * ================================================================ */
console.log('\n=== 10) Bot tomoni shartnomasi ===');

const BOT = fs.readFileSync(path.join(ROOT, 'bot', 'bot.py'), 'utf8');

t('bot yurak urishini yozadi', () => {
  ok(BOT.indexOf('fb_url("bot_status")') !== -1, 'bot_status yozilmaydi');
  ok(/last_beat[\s\S]{0,200}>= 30/.test(BOT), '30 sekundlik chegara yo\'q');
});
t('bot faol suhbatni topadi', () => {
  ok(BOT.indexOf('_mini_active_chat') !== -1);
  ok(BOT.indexOf('chats/{active}') !== -1, 'yangi sxema yo\'lisiz');
});
t('bot ESKI sxema bilan mos qoladi', () => {
  ok(/return f"ai_requests\/\{uid\}", _mini_msgs\(data\.get\("messages"\)\)/.test(BOT),
    'eski yo\'lga qaytish yo\'q');
});
t('bot rasmni vision modelga uzatadi', () => {
  ok(BOT.indexOf('last_img') !== -1, 'rasm o\'qilmaydi');
  ok(/"type": "image_url"[\s\S]{0,120}last_img/.test(BOT), 'vision shakli yo\'q');
  ok(BOT.indexOf('use_model = GROQ_VISION_MODEL') !== -1, 'vision model tanlanmaydi');
});
t('bot javobni AYNAN o\'sha suhbatga yozadi', () => {
  ok(BOT.indexOf('fb_url(chat_path)') !== -1, 'chat_path ishlatilmaydi');
});

t('qoidalarda bot_status bor va mijoz yoza olmaydi', () => {
  const R = fs.readFileSync(path.join(ROOT, 'database.rules.json'), 'utf8');
  const clean = R.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
  const d = JSON.parse(clean);
  const bs = d.rules.bot_status;
  ok(bs, 'bot_status qoidasi yo\'q');
  eq(bs['.write'], false, 'mijoz yozishi mumkin!');
  ok(String(bs['.read']).indexOf('auth != null') !== -1, 'o\'qish ochiq qolgan');
});

/* ---------------------------------------------------------------- *
 * Xulosa
 * ---------------------------------------------------------------- */
/* ================================================================ *
 * 11) RASM YUKLASH NATIJASI — asinxron, IZOLYATSIYADA
 * ---------------------------------------------------------------- *
 * Har holat alohida bajariladi va natijasi kutiladi. Ilgari bu
 * tekshiruvlar oxirida birgalikda ishlardi va global holat boshqa
 * sinovlar tomonidan o'zgartirilib, «yolg'on yiqilish» berardi.
 * ================================================================ */
function pickIso(fails_) {
  reset();
  W.aiNewChat();
  W.__uploadFails = !!fails_;
  W.aiPickImage({ target: { files: [{ type: 'image/jpeg', size: 1000, name: 'a.jpg' }] } });
}

function finish() {
  console.log('\n======================================================');
  console.log(`${pass}/${pass + fails.length} sinov o'tdi`);
  if (fails.length) {
    console.log('\nYIQILGANLAR:');
    fails.forEach(([n, e]) => console.log('  • ' + n + ': ' + e.message));
    process.exit(1);
  }
  console.log('✅ AI chat qatlami — mantiq toza');
}

console.log('\n=== 11) Rasm yuklash natijasi (asinxron) ===');
pickIso(false);
setTimeout(function () {
  t('yuklash tugagach havola SAQLANADI', () => {
    ok(S.attach, 'biriktirma yo\'qoldi');
    eq(S.attach.pending, false, 'pending o\'chmadi');
    eq(S.attach.url, 'https://img.example/ok.jpg', 'havola saqlanmadi');
    ok(/tayyor/i.test(REG.get('sg-attach-tx').textContent),
      'holat matni yangilanmadi: ' + REG.get('sg-attach-tx').textContent);
  });

  pickIso(true);
  setTimeout(function () {
    t('yuklash XATO bo\'lsa biriktirma bekor qilinadi', () => {
      W.__uploadFails = false;
      ok(!S.attach, 'xatoda ham biriktirma qoldi');
      ok(TOASTS.some((x) => x[1] === 'warning'), 'ogohlantirish yo\'q');
      ok(/qayta urinib/i.test(REG.get('sg-attach-tx').textContent),
        'xato matni ko\'rsatilmadi');
    });
    finish();
  }, 25);
}, 25);
