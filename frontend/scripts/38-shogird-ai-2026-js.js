
(function shogirdAi() {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var E = function (s) { return (window.escHtml ? window.escHtml(s) : String(s == null ? '' : s)); };

  /** ⚠️ `db` asosiy skriptda `const` bilan e'lon qilingan — u `window` ga
   *  TUSHMAYDI (`window.db` doim undefined). Keyingi skriptdan u NOM bilan
   *  o'qiladi. Boshqa kech qatlamlar ham aynan shu yo'ldan foydalanadi. */
  function DB() {
    try { if (typeof db !== 'undefined' && db) return db; } catch (e) {}
    try {
      if (window.firebase && window.firebase.apps && window.firebase.apps.length) {
        return window.firebase.database();
      }
    } catch (e) {}
    return null;
  }

  // Ma'lumot sxemasi (qoidalar O'ZGARMAYDI — hammasi ai_requests/<uid> ichida):
  //   ai_requests/<uid>/active                     -> faol suhbat id
  //   ai_requests/<uid>/needs_processing            -> bot uchun signal
  //   ai_requests/<uid>/chats/<id>/{title,createdAt,updatedAt,messages}
  var S = { uid: null, chatId: null, chats: {}, attach: null, busy: false, ref: null, statRef: null };
  window._sgState = S;

  function base() { return 'ai_requests/' + S.uid; }
  function newId() { return 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  // ===================================================================
  // ONLAYN INDIKATORI
  // ===================================================================
  // Bot har ~30 sekundda `bot_status` ga {online, ts} yozadi. 90 sekunddan
  // ko'p vaqt o'tsa — oflayn deb hisoblaymiz (bir-ikki o'tkazib yuborilgan
  // yozuv indikatorni bekorga qizartirmasin).
  var STALE_MS = 90000;
  function paintStatus(ts) {
    var m = $('aiChatModal'), tx = $('sg-stat-tx');
    if (!m || !tx) return;
    var fresh = ts && (Date.now() - Number(ts) < STALE_MS);
    m.classList.toggle('is-online', !!fresh);
    m.classList.toggle('is-offline', !fresh);
    tx.textContent = fresh ? 'Onlayn — javob beradi' : 'Oflayn — javob kechikadi';
  }
  function watchStatus() {
    try {
      if (S.statRef) { S.statRef.off('value'); S.statRef = null; }
      S.statRef = DB().ref('bot_status');
      S.statRef.on('value', function (s) {
        var v = s.val() || {};
        paintStatus(v.ts);
      }, function () { paintStatus(0); });
    } catch (e) { paintStatus(0); }
  }

  // ===================================================================
  // RASM BIRIKTIRISH
  // ===================================================================
  window.aiClearAttach = function () {
    S.attach = null;
    var b = $('sg-attach'); if (b) b.style.display = 'none';
    var f = $('sg-file'); if (f) f.value = '';
  };

  window.aiPickImage = function (ev) {
    var file = ev && ev.target && ev.target.files && ev.target.files[0];
    if (!file) return;
    if (!/^image\//.test(file.type)) { showToast('Faqat rasm yuborish mumkin', 'warning'); return; }
    if (file.size > 8 * 1024 * 1024) { showToast("Rasm 8 MB dan kichik bo'lsin", 'warning'); return; }

    var box = $('sg-attach'), img = $('sg-attach-img'), tx = $('sg-attach-tx');
    if (box) box.style.display = 'flex';
    if (img) { try { img.src = URL.createObjectURL(file); } catch (e) {} }
    if (tx) tx.textContent = 'Yuklanmoqda… 0%';
    S.attach = { pending: true, url: '' };

    // Mavjud yuklovchidan foydalanamiz (admin rasm yuklashda ishlatiladi) —
    // u ochiq HTTPS havola qaytaradi, vision model aynan shuni kutadi.
    if (typeof window.uploadFileWithProgress !== 'function') {
      if (tx) tx.textContent = 'Yuklash imkoni yo\u2018q';
      S.attach = null;
      return;
    }
    window.uploadFileWithProgress(file, function (pct) {
      if (tx) tx.textContent = 'Yuklanmoqda… ' + pct + '%';
    }).then(function (url) {
      S.attach = { pending: false, url: url };
      if (tx) tx.textContent = 'Rasm tayyor';
    }).catch(function () {
      S.attach = null;
      if (tx) tx.textContent = 'Yuklanmadi — qayta urinib ko\u2018ring';
      showToast('Rasm yuklanmadi', 'warning');
    });
  };

  // ===================================================================
  // SUHBATLAR (yangi chat + tarix)
  // ===================================================================
  function chatList() {
    var out = [];
    for (var id in S.chats) {
      if (Object.prototype.hasOwnProperty.call(S.chats, id) && S.chats[id]) {
        out.push({ id: id, c: S.chats[id] });
      }
    }
    out.sort(function (a, b) {
      return (Number(b.c.updatedAt || b.c.createdAt || 0) - Number(a.c.updatedAt || a.c.createdAt || 0));
    });
    return out;
  }

  function msgsOf(c) {
    var raw = c && c.messages;
    if (!raw) return [];
    if (Array.isArray(raw)) return raw.filter(Boolean);
    return Object.keys(raw).map(function (k) { return raw[k]; }).filter(Boolean);
  }

  function titleFor(c) {
    if (c && c.title) return c.title;
    var m = msgsOf(c);
    for (var i = 0; i < m.length; i++) {
      if (m[i] && m[i].sender === 'user' && m[i].text) return String(m[i].text).slice(0, 40);
    }
    return 'Yangi suhbat';
  }

  function fmtWhen(ms) {
    var d = new Date(Number(ms) || Date.now());
    var now = new Date();
    var sameDay = d.toDateString() === now.toDateString();
    var hh = ('0' + d.getHours()).slice(-2), mm = ('0' + d.getMinutes()).slice(-2);
    if (sameDay) return hh + ':' + mm;
    return ('0' + d.getDate()).slice(-2) + '.' + ('0' + (d.getMonth() + 1)).slice(-2) + ' ' + hh + ':' + mm;
  }

  window.aiToggleHistory = function () {
    var m = $('aiChatModal');
    if (!m) return;
    var open = !m.classList.contains('hist-open');
    m.classList.toggle('hist-open', open);
    var b = $('sg-hist-btn'); if (b) b.classList.toggle('on', open);
    try { if (window._hap) window._hap('light'); } catch (e) {}
    if (open) renderHistory();
  };

  function renderHistory() {
    var box = $('sg-hist-list');
    if (!box) return;
    var list = chatList();
    if (!list.length) {
      box.innerHTML = '<div style="padding:14px 12px; font-size:12px; color:var(--text-muted); text-align:center;">Hozircha suhbat yo\u2018q</div>';
      return;
    }
    box.innerHTML = list.map(function (x) {
      var n = msgsOf(x.c).length;
      return '<div class="sg-hrow' + (x.id === S.chatId ? ' on' : '') + '" onclick="aiSelectChat(\'' + E(x.id) + '\')">' +
        '<div class="sg-hrow-tx"><b>' + E(titleFor(x.c)) + '</b>' +
          '<span>' + fmtWhen(x.c.updatedAt || x.c.createdAt) + ' \u00B7 ' + n + ' xabar</span></div>' +
        '<button class="sg-hrow-del" aria-label="O\u2018chirish" onclick="event.stopPropagation(); aiDeleteChat(\'' + E(x.id) + '\')">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg>' +
        '</button></div>';
    }).join('');
  }

  window.aiNewChat = function () {
    if (!S.uid) return;
    var id = newId();
    var now = Date.now();
    S.chatId = id;
    S.chats[id] = { title: '', createdAt: now, updatedAt: now, messages: [] };
    window.aiClearAttach();
    var m = $('aiChatModal');
    if (m) { m.classList.remove('hist-open'); }
    var b = $('sg-hist-btn'); if (b) b.classList.remove('on');
    try { if (window._hap) window._hap('success'); } catch (e) {}
    // Faol suhbatni darhol yozamiz — bot ham shu suhbatga javob beradi.
    try {
      DB().ref(base()).update({ active: id });
      DB().ref(base() + '/chats/' + id).update({ createdAt: now, updatedAt: now });
    } catch (e) {}
    paint();
    renderHistory();
  };

  window.aiSelectChat = function (id) {
    if (!S.chats[id]) return;
    S.chatId = id;
    var m = $('aiChatModal'); if (m) m.classList.remove('hist-open');
    var b = $('sg-hist-btn'); if (b) b.classList.remove('on');
    try { DB().ref(base()).update({ active: id }); } catch (e) {}
    try { if (window._hap) window._hap('light'); } catch (e) {}
    paint();
  };

  window.aiDeleteChat = function (id) {
    var doDel = function () {
      delete S.chats[id];
      try { DB().ref(base() + '/chats/' + id).remove(); } catch (e) {}
      if (S.chatId === id) {
        var rest = chatList();
        if (rest.length) { S.chatId = rest[0].id; try { DB().ref(base()).update({ active: S.chatId }); } catch (e) {} }
        else { window.aiNewChat(); return; }
      }
      paint();
      renderHistory();
    };
    var q = 'Bu suhbat o\u2018chirilsinmi?';
    if (typeof tg !== 'undefined' && tg.showConfirm) tg.showConfirm(q, function (ok) { if (ok) doDel(); });
    else if (confirm(q)) doDel();
  };

  // ===================================================================
  // CHIZISH
  // ===================================================================
  var TIPS = ['Moybor filtr bormi?', 'Nexia uchun kalotka', 'Gazel porshen narxi', 'Rasm bo\u2018yicha topish'];

  function helloHTML() {
    return '<div class="sg-hello">' +
      '<div class="sg-h-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 4.6L18.5 9.5 13.9 11.4 12 16l-1.9-4.6L5.5 9.5l4.6-1.9L12 3z"/><path d="M18 15l.9 2.1L21 18l-2.1.9L18 21l-.9-2.1L15 18l2.1-.9L18 15z"/></svg></div>' +
      '<h3>Assalomu alaykum!</h3>' +
      '<p>Men Shogird \u2014 zapchast tanlashda yordam beraman.<br>Nomini yozing yoki <b>rasmini yuboring</b>.</p>' +
      '<div class="sg-tips">' + TIPS.map(function (t) {
        return '<span class="sg-tip" onclick="aiTip(\'' + E(t).replace(/'/g, '&#39;') + '\')">' + E(t) + '</span>';
      }).join('') + '</div></div>';
  }

  window.aiTip = function (t) {
    var i = $('ai-chat-input');
    if (!i) return;
    if (/rasm/i.test(t)) { var f = $('sg-file'); if (f) f.click(); return; }
    i.value = t; autosize(); i.focus();
  };

  function prodHTML(ids) {
    if (!ids || !ids.length) return '';
    var list = window.productsDB || [];
    var out = '';
    for (var i = 0; i < ids.length; i++) {
      var p = null;
      for (var j = 0; j < list.length; j++) { if (list[j] && list[j].id == ids[i]) { p = list[j]; break; } }
      if (!p) continue;
      out += '<div class="sg-prod" onclick="closeModal(); setTimeout(function(){ openProduct(' + p.id + '); }, 280);">' +
        '<img src="' + E(p.img || '') + '" alt="" loading="lazy" decoding="async" onerror="this.style.visibility=\'hidden\'">' +
        '<div class="sg-prod-tx"><b>' + E(p.name || '') + '</b>' +
        '<span>' + (Number(p.price) || 0).toLocaleString() + " so'm</span></div></div>";
    }
    return out;
  }

  function paint() {
    var box = $('ai-chat-box');
    if (!box) return;
    var msgs = msgsOf(S.chats[S.chatId]);
    if (!msgs.length) {
      box.innerHTML = helloHTML();
      return;
    }
    var html = '';
    for (var i = 0; i < msgs.length; i++) {
      var m = msgs[i] || {};
      var me = m.sender === 'user';
      var img = m.image ? '<img class="sg-mimg" src="' + E(m.image) + '" alt="" loading="lazy" decoding="async">' : '';
      // ⚠️ Matn ESCAPE qilinadi. Ilgari `m.text` to'g'ridan innerHTML ga
      //    tushardi — bu XSS yo'li edi (AI javobi ham, mijoz matni ham).
      html += '<div class="sg-msg ' + (me ? 'sg-me' : 'sg-bot') + '">' + img +
        E(m.text || '').replace(/\n/g, '<br>') +
        (me ? '' : prodHTML(m.found_products)) +
        '<span class="sg-time">' + fmtWhen(m.time) + '</span></div>';
    }
    if (S.busy) html += '<div class="sg-typing"><i></i><i></i><i></i></div>';
    box.innerHTML = html;
    box.scrollTop = box.scrollHeight;
  }
  window._sgPaint = paint;

  // ===================================================================
  // YUBORISH
  // ===================================================================
  function autosize() {
    var i = $('ai-chat-input');
    if (!i) return;
    i.style.height = 'auto';
    i.style.height = Math.min(110, i.scrollHeight) + 'px';
  }

  window.sendAiMessage = function () {
    var input = $('ai-chat-input');
    if (!input || !S.uid) return;
    var text = String(input.value || '').trim();
    var img = (S.attach && !S.attach.pending && S.attach.url) ? S.attach.url : '';
    if (S.attach && S.attach.pending) { showToast('Rasm hali yuklanmoqda…', 'warning'); return; }
    if (!text && !img) return;
    if (!text && img) text = 'Bu qanday zapchast? Menga mos variantni toping.';

    if (!S.chatId || !S.chats[S.chatId]) window.aiNewChat();

    var c = S.chats[S.chatId];
    var msgs = msgsOf(c);
    var rec = { sender: 'user', text: text, time: Date.now() };
    if (img) rec.image = img;
    msgs.push(rec);
    c.messages = msgs;
    c.updatedAt = Date.now();
    if (!c.title) c.title = text.slice(0, 40);

    input.value = ''; autosize();
    window.aiClearAttach();
    S.busy = true;
    paint();

    // Faqat SHU suhbatni yozamiz (butun tugunni emas) — trafik kam.
    try {
      DB().ref(base() + '/chats/' + S.chatId).update({
        title: c.title, messages: msgs, updatedAt: c.updatedAt,
        createdAt: c.createdAt || c.updatedAt
      });
      DB().ref(base()).update({ active: S.chatId, needs_processing: true });
    } catch (e) {
      S.busy = false; paint();
      showToast('Yuborilmadi — internetni tekshiring', 'warning');
    }
  };

  // ===================================================================
  // OCHISH / TINGLASH
  // ===================================================================
  window.openAiChat = function () {
    var m = $('aiChatModal');
    if (!m) return;
    S.uid = window.currentUser || null;
    if (!S.uid) { showToast('Iltimos, avval tizimga kiring', 'warning'); return; }
    if (!DB()) { showToast("Bazaga ulanilmadi — internetni tekshiring", 'warning'); return; }

    window._shogirdReturnFocus = document.activeElement;
    m.style.display = 'flex';
    m.classList.remove('hist-open');
    try { activeModal = 'aiChatModal'; } catch (e) { window.activeModal = 'aiChatModal'; }
    document.body.style.overflow = 'hidden';
    try { window.history.pushState({ modal: 'aiChatModal' }, ''); } catch (e) {}
    try { if (tg && tg.BackButton) tg.BackButton.show(); } catch (e) {}
    (window.requestAnimationFrame || function (fn) { fn(); })(function () {
      var firstControl = m.querySelector('.sg-x');
      if (!firstControl) return;
      try { firstControl.focus({ preventScroll: true }); } catch (e) { firstControl.focus(); }
    });

    watchStatus();

    var inp = $('ai-chat-input');
    if (inp && !inp._sgWired) {
      inp._sgWired = 1;
      inp.addEventListener('input', autosize);
      inp.addEventListener('keydown', function (e) {
        // Enter — yuborish, Shift+Enter — yangi qator
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); window.sendAiMessage(); }
      });
    }

    // Suhbatlarni tinglaymiz
    try {
      if (S.ref) { S.ref.off('value'); S.ref = null; }
      S.ref = DB().ref(base());
      window._aiChatRef = S.ref;      // popstate shu nom bilan uzadi
      S.ref.on('value', function (snap) {
        var d = snap.val() || {};
        S.chats = (d.chats && typeof d.chats === 'object') ? d.chats : {};

        // ⚠️ ESKI SXEMADAN KO'CHIRISH: ilgari bitta cheksiz ro'yxat bor edi
        //    (`ai_requests/<uid>/messages`). Uni yo'qotmaymiz — birinchi
        //    ochilishda alohida suhbatga aylantiramiz.
        if (!Object.keys(S.chats).length && d.messages) {
          var old = Array.isArray(d.messages) ? d.messages
            : Object.keys(d.messages).map(function (k) { return d.messages[k]; });
          old = (old || []).filter(Boolean);
          if (old.length) {
            var oid = newId(), t0 = Date.now();
            S.chats[oid] = { title: 'Oldingi suhbat', createdAt: t0, updatedAt: t0, messages: old };
            S.chatId = oid;
            try {
              DB().ref(base() + '/chats/' + oid).update(S.chats[oid]);
              DB().ref(base()).update({ active: oid });
            } catch (e) {}
          }
        }

        if (d.active && S.chats[d.active]) S.chatId = d.active;
        if (!S.chatId || !S.chats[S.chatId]) {
          var l = chatList();
          if (l.length) S.chatId = l[0].id;
        }
        if (!S.chatId) { window.aiNewChat(); return; }

        // Bot javob berdimi — «yozayapti» ni o'chiramiz
        var mm = msgsOf(S.chats[S.chatId]);
        if (mm.length && mm[mm.length - 1] && mm[mm.length - 1].sender !== 'user') S.busy = false;
        if (d.needs_processing === false && S.busy) {
          // bot qabul qildi, javob hali yo'q — kutamiz
        }
        paint();
        if ($('aiChatModal').classList.contains('hist-open')) renderHistory();
      });
    } catch (e) {}

    paint();
  };

  // Modal yopilganda tinglovchilarni uzamiz (popstate `_aiChatRef` ni uzadi,
  // biz status tinglovchisini ham uzishimiz kerak).
  window.addEventListener('popstate', function () {
    var m = $('aiChatModal');
    if (m && m.style.display === 'none') {
      if (S.statRef) { try { S.statRef.off('value'); } catch (e) {} S.statRef = null; }
      S.busy = false;
      var returnFocus = window._shogirdReturnFocus;
      window._shogirdReturnFocus = null;
      if (returnFocus && returnFocus.isConnected && typeof returnFocus.focus === 'function') {
        (window.requestAnimationFrame || function (fn) { fn(); })(function () {
          try { returnFocus.focus({ preventScroll: true }); } catch (e) { returnFocus.focus(); }
        });
      }
    }
  });
})();
