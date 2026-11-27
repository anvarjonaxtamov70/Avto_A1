
(function homeFiltersAndBulkDiscount() {
  'use strict';

  // ===================================================================
  // 0) UMUMIY YORDAMCHILAR
  // ===================================================================

  /** `displayDB` — global `let`, shuning uchun `window.displayDB` YO'Q.
   *  Keyingi skriptdan u NOM bilan o'qiladi (leksik global). Topilmasa —
   *  `productsDB` dan zaxira ro'yxat yasaymiz. */
  function homeBaseList() {
    try {
      if (typeof displayDB !== 'undefined' && Array.isArray(displayDB)) return displayDB;
    } catch (e) {}
    return (window.productsDB || [])
      .filter(function (p) { return p && !p.is_draft; })
      .slice().reverse();
  }

  /** 🏷 Aksiyada? — chegirma YOKI muddati o'tmagan flash.
   *  Bu `_sortDisplayDB` dagi `isPromo` bilan AYNI qoida: bosh sahifada
   *  aksiyalar tepaga chiqadi, chip ham AYNI to'plamni ko'rsatadi. */
  function isPromo(p) {
    if (!p) return false;
    var disc = p.oldPrice && Number(p.oldPrice) > Number(p.price);
    var flash = p.flashUntil && Number(p.flashUntil) > Date.now();
    return !!(disc || flash);
  }

  function stockTotal(p) {
    if (!p) return 0;
    if (p.product_type === 'razmerli' && Array.isArray(p.sizes)) {
      return p.sizes.reduce(function (a, s) { return a + (parseInt(s && s.stock, 10) || 0); }, 0);
    }
    return (p.stock !== undefined) ? (Number(p.stock) || 0) : 10;
  }

  function fmtSom(n) { return (Number(n) || 0).toLocaleString(); }

  // ===================================================================
  // 1) MIJOZ TOMONI — BOSH SAHIFA FILTR CHIP'LARI
  // ===================================================================
  var HF = { discount: false, instock: false };
  window._homeFilter = HF;

  function hfActive() { return HF.discount || HF.instock; }

  /** Sarlavha matni holatni AYTIB turadi — mijoz nimani ko'rayotganini
   *  taxmin qilmasligi kerak. */
  function hfTitle() {
    if (HF.discount && HF.instock) return 'Aksiya · Sotuvda bor';
    if (HF.discount) return 'Aksiyadagi tovarlar';
    if (HF.instock) return 'Sotuvda bor tovarlar';
    return 'Ommabop tovarlar';
  }

  function hfSyncChips() {
    var a = document.getElementById('hf-promo');
    var b = document.getElementById('hf-stock');
    if (a) a.classList.toggle('on', HF.discount);
    if (b) b.classList.toggle('on', HF.instock);
    var t = document.getElementById('home-title');
    if (t) t.textContent = hfTitle();
  }

  /** Filtrlangan ro'yxat. Aksiya uchun `isPromo` (flash ham hisobga olinadi),
   *  qoldiq uchun `stockTotal`. */
  function hfFiltered() {
    return homeBaseList().filter(function (p) {
      if (!p) return false;
      if (HF.discount && !isPromo(p)) return false;
      if (HF.instock && stockTotal(p) <= 0) return false;
      return true;
    });
  }

  /** Gridni filtr bo'yicha qayta bo'yaydi. Filtr o'chiq bo'lsa — TEGMAYDI
   *  (asl `renderProducts` natijasi o'z holida qoladi). */
  function hfPaint() {
    hfSyncChips();
    if (!hfActive()) return false;
    var grid = document.getElementById('home-products');
    if (!grid) return false;

    var shown = hfFiltered();
    if (!shown.length) {
      var msg = HF.discount
        ? "Hozircha aksiyadagi tovar yo'q"
        : "Sotuvda tovar qolmadi";
      grid.innerHTML = '<div style="grid-column:span 2; text-align:center; padding:34px 18px; color:var(--text-muted); font-size:13px;">'
        + '<div style="font-size:34px; margin-bottom:10px;">🏷</div>' + msg
        + '<div style="margin-top:12px;"><span class="cfs-chip" onclick="window._homeReset()">Filtrni tozalash</span></div>'
        + '</div>';
    } else {
      grid.innerHTML = shown.map(function (x) { return window.cardHTML(x); }).join('');
    }
    // Filtr rejimida hamma mos tovar birdan ko'rsatiladi — «yana yuklash» yo'q.
    var ld = document.getElementById('scroll-loader');
    if (ld) ld.classList.add('hidden');
    try { if (typeof initReveal === 'function') setTimeout(initReveal, 60); } catch (e) {}
    return true;
  }

  window._homeToggle = function (key) {
    if (key !== 'discount' && key !== 'instock') return;
    HF[key] = !HF[key];
    try { if (window._hap) window._hap('light'); } catch (e) {}
    if (hfActive()) {
      hfPaint();
    } else {
      // ✅ Ikkala tugma o'chdi — ODDIY «Ommabop tovarlar» mantig'i qaytadi.
      //    `renderProducts()` gridni `displayDB.slice(0, limitCount)` dan
      //    qayta quradi, ya'ni aksiya-tepada tartibi ham tiklanadi.
      hfSyncChips();
      if (typeof window.renderProducts === 'function') window.renderProducts();
    }
  };

  window._homeReset = function () {
    HF.discount = false; HF.instock = false;
    hfSyncChips();
    if (typeof window.renderProducts === 'function') window.renderProducts();
  };

  // — `renderProducts` ustidan o'ram —
  // Firebase yangilanishi, flash taymeri (har sekundda) va savat/reyting
  // yangilanishlari `renderProducts()` ni chaqiradi. O'ram bo'lmasa
  // filtrlangan ko'rinish JIMGINA yuvilib, to'liq ro'yxat qaytardi.
  if (typeof window.renderProducts === 'function') {
    var _rpOrig = window.renderProducts;
    window.renderProducts = function () {
      var r = _rpOrig.apply(this, arguments);
      try { hfPaint(); } catch (e) {}
      return r;
    };
  }

  // — Cheksiz skroll o'rami —
  // `loadMoreProducts` filtrsiz `displayDB` dan qo'shadi. Filtr yoqilganda
  // u ishlasa, mos kelmaydigan tovarlar ro'yxatga suqilib kirardi.
  if (typeof window.loadMoreProducts === 'function') {
    var _lmOrig = window.loadMoreProducts;
    window.loadMoreProducts = function (startIndex) {
      if (hfActive()) {
        // Filtr rejimida mos tovarlar HAMMASI birdan ko'rsatilgan — qo'shimcha
        // yuklash kerak emas. `_maybeLoadMoreOnScroll` chaqiruvdan OLDIN
        // `limitCount += 12` qilib qo'ygan, shuning uchun uni qaytaramiz:
        // aks holda filtr o'chirilgach ro'yxat keraksiz uzun bo'lib chiqardi.
        try {
          if (typeof startIndex === 'number' && typeof limitCount !== 'undefined') {
            limitCount = startIndex;
          }
        } catch (e) {}
        return;
      }
      return _lmOrig.apply(this, arguments);
    };
  }

  // ===================================================================
  // 2) ADMIN TOMONI — OMMAVIY AKSIYA
  // ===================================================================
  var BD = { sel: {}, filter: 'all' };
  window._bdState = BD;

  function bdPct() {
    var el = document.getElementById('bd-pct');
    var v = parseFloat(el ? el.value : '');
    return (isFinite(v) && v > 0) ? v : 0;
  }
  function bdHours() {
    var el = document.getElementById('bd-hours');
    var v = parseFloat(el ? el.value : '');
    return (isFinite(v) && v > 0) ? v : 0;
  }

  /** Chegirma HAMISHA ASL narxdan hisoblanadi.
   *
   *  ⚠️ NEGA MUHIM: tovar allaqachon aksiyada bo'lsa, uning `price`i
   *  tushirilgan. Agar chegirmani `price` dan hisoblasak, foizlar
   *  BIR-BIRIGA KO'PAYIB ketadi (10% ikki marta = 19%) va asl narx
   *  yo'qoladi. `oldPrice` bor bo'lsa — asl narx AYNAN u. Shu sababli
   *  bir xil foizni qayta-qayta qo'llash xavfsiz (natija o'zgarmaydi). */
  function basePriceOf(p) {
    if (p && p.oldPrice && Number(p.oldPrice) > Number(p.price)) return Number(p.oldPrice);
    return Number(p && p.price) || 0;
  }
  window._bdBasePrice = basePriceOf;

  /** Yangi (chegirmali) narxni hisoblaydi. `0` — «qo'llanmaydi» degani.
   *
   *  Bitta manba: oldindan ko'rish (preview) ham, haqiqiy yozish ham
   *  AYNI shu funksiyani chaqiradi — shunda xo'jayin ko'rgan raqam
   *  saqlanadigan raqamdan farq qilmaydi. */
  window._bdNewPrice = function (p, pct) {
    var base = basePriceOf(p);
    if (!(base > 0) || !(pct > 0) || pct >= 90) return 0;
    var np = window._roundSom(base * (1 - pct / 100));
    if (np <= 0 || np >= base) return 0;   // yaxlitlashdan keyin o'zgarmadi
    return np;
  };
  window._isPromoProduct = isPromo;

  window._bdVisibleItems = function () {
    var el = document.getElementById('bd-search');
    var q = (el ? el.value : '').toLowerCase().trim();
    return (window.productsDB || []).filter(function (p) {
      if (!p || p.is_draft) return false;               // qoralama aksiyaga chiqmaydi
      if (BD.filter === 'promo' && !isPromo(p)) return false;
      if (BD.filter === 'plain' && isPromo(p)) return false;
      if (q) {
        var n = (p.name || '').toLowerCase();
        var c = (p.code || '').toLowerCase();
        if (n.indexOf(q) === -1 && c.indexOf(q) === -1) return false;
      }
      return true;
    });
  };

  function bdSelectedIds() {
    return Object.keys(BD.sel)
      .map(function (k) { return parseInt(k, 10); })
      .filter(function (id) {
        return (window.productsDB || []).some(function (p) { return p && p.id === id; });
      });
  }
  window._bdSelectedIds = bdSelectedIds;

  window.bdSetFilter = function (el, f) {
    BD.filter = f;
    try {
      document.querySelectorAll('#bd-filter-chips .inv-fchip').forEach(function (c) {
        c.classList.toggle('selected', c === el);
      });
    } catch (e) {}
    window.renderBulkDiscount();
  };

  window.bdSetPct = function (v) {
    var el = document.getElementById('bd-pct');
    if (el) el.value = v;
    try {
      document.querySelectorAll('#bulkDiscountModal .bd-quick[data-pct]').forEach(function (b) {
        b.classList.toggle('on', parseFloat(b.getAttribute('data-pct')) === v);
      });
    } catch (e) {}
    try { if (window._hap) window._hap('light'); } catch (e) {}
    window.bdPreview();
  };

  window.bdSetHours = function (v) {
    var el = document.getElementById('bd-hours');
    // Ayni tugma qayta bosilsa — bekor qiladi (muddatsizga qaytadi)
    var same = el && parseFloat(el.value) === v;
    if (el) el.value = same ? '' : v;
    try {
      document.querySelectorAll('#bulkDiscountModal .bd-quick[data-h]').forEach(function (b) {
        b.classList.toggle('on', !same && parseFloat(b.getAttribute('data-h')) === v);
      });
    } catch (e) {}
    try { if (window._hap) window._hap('light'); } catch (e) {}
    window.bdPreview();
  };

  /** Qo'llashdan OLDIN aniq natijani ko'rsatadi — xo'jayin taxmin
   *  qilmasligi kerak. Yaxlitlash ham shu yerda ko'rinadi. */
  window.bdPreview = function () {
    var box = document.getElementById('bd-preview');
    if (!box) return;
    var ids = bdSelectedIds();
    var pct = bdPct();
    var h = bdHours();

    if (!ids.length) { box.innerHTML = "Tovarlarni belgilang, so'ng foizni kiriting."; return; }
    if (!pct) { box.innerHTML = '<b>' + ids.length + " ta tovar belgilandi.</b> Endi chegirma foizini kiriting."; return; }
    if (pct >= 90) { box.innerHTML = "⚠️ Foiz 90 dan kichik bo'lishi kerak."; return; }

    // Namuna uchun birinchi belgilangan tovar
    var first = (window.productsDB || []).find(function (p) { return p && p.id === ids[0]; });
    var lines = '<b>' + ids.length + ' ta tovarga −' + pct + '% chegirma</b>';
    if (first) {
      var base = basePriceOf(first);
      var np = window._bdNewPrice(first, pct);
      lines += '<div style="margin-top:6px;">Masalan «' + window.escHtml(first.name || '') + '»: '
        + '<span class="bd-old">' + fmtSom(base) + '</span> → '
        + '<span class="bd-new">' + fmtSom(np || base) + " so'm</span></div>";
    }
    lines += '<div style="margin-top:6px; color:var(--text-muted);">Narxlar mingga yaxlitlanadi. '
      + (h ? ('Muddat: <b>' + h + ' soat</b>.') : 'Muddat: <b>muddatsiz</b>.') + '</div>';

    var already = ids.filter(function (id) {
      var p = (window.productsDB || []).find(function (x) { return x && x.id === id; });
      return isPromo(p);
    }).length;
    if (already) {
      lines += '<div style="margin-top:6px; color:#ff9f0a;">' + already
        + " ta tovar allaqachon aksiyada — chegirma ASL narxdan qayta hisoblanadi.</div>";
    }
    box.innerHTML = lines;
  };

  window.renderBulkDiscount = function () {
    var c = document.getElementById('bd-list');
    if (!c) return;
    var items = window._bdVisibleItems();

    var cnt = document.getElementById('bd-count');
    if (cnt) {
      var n = bdSelectedIds().length;
      cnt.innerText = items.length + " ta ko'rinmoqda" + (n ? (' · ' + n + ' belgilandi') : '');
    }
    // Tugma matni holatga qarab (belgilash / bekor qilish)
    var sb = document.getElementById('bd-selall-btn');
    if (sb) {
      var allOn = items.length > 0 && items.every(function (p) { return p && p.id != null && BD.sel[p.id]; });
      sb.innerText = allOn ? "Belgilashni bekor qilish" : "Hammasini belgilash";
    }

    if (!items.length) {
      c.innerHTML = '<p style="text-align:center; color:gray; margin:30px 0;">Tovar topilmadi.</p>';
      window.bdPreview();
      return;
    }

    c.innerHTML = items.map(function (p) {
      var on = !!BD.sel[p.id];
      var promo = isPromo(p);
      var base = basePriceOf(p);
      var priceHtml = promo
        ? '<span class="bd-old">' + fmtSom(base) + '</span> <span class="bd-new">' + fmtSom(p.price) + " so'm</span>"
        : (fmtSom(p.price) + " so'm");
      var pct = promo && base > 0
        ? Math.round((1 - Number(p.price) / base) * 100) : 0;
      var badge = promo ? '<span class="bd-has">−' + pct + '%</span>' : '';
      return '<div class="inventory-item' + (on ? ' inv-selected' : '') + '">'
        + '<div style="display:flex; align-items:center; flex:1; min-width:0;">'
        + '<input type="checkbox" class="inv-check" ' + (on ? 'checked' : '')
        + ' onchange="bdToggle(this,' + p.id + ')">'
        + '<div class="inv-info"><h4>' + window.escHtml(p.name || '') + badge + '</h4>'
        + '<p>' + priceHtml + '</p></div>'
        + '</div>'
        + '</div>';
    }).join('');
    window.bdPreview();
  };

  window.bdToggle = function (el, id) {
    if (el.checked) BD.sel[id] = true; else delete BD.sel[id];
    var card = el.closest('.inventory-item');
    if (card) card.classList.toggle('inv-selected', el.checked);
    try { if (window._hap) window._hap('selection'); } catch (e) {}
    var cnt = document.getElementById('bd-count');
    if (cnt) {
      var items = window._bdVisibleItems();
      var n = bdSelectedIds().length;
      cnt.innerText = items.length + " ta ko'rinmoqda" + (n ? (' · ' + n + ' belgilandi') : '');
    }
    window.bdPreview();
  };

  /** ☑️ Ko'rinayotgan BARCHA tovarni belgilaydi — «barcha tovarga aksiya»
   *  uchun asosiy yo'l (filtrni «Hammasi» qilib shuni bosish kifoya). */
  window.bdSelectAllVisible = function () {
    var items = window._bdVisibleItems();
    if (!items.length) { showToast("Belgilash uchun tovar yo'q", "warning"); return; }
    // Ombordagi kabi ALMASHTIRGICH: qayta bosilsa bekor qiladi.
    var allOn = items.every(function (p) { return p && p.id != null && BD.sel[p.id]; });
    if (allOn) {
      items.forEach(function (p) { if (p && p.id != null) delete BD.sel[p.id]; });
      try { if (window._hap) window._hap('light'); } catch (e) {}
      showToast("Belgilash bekor qilindi", "success");
    } else {
      items.forEach(function (p) { if (p && p.id != null) BD.sel[p.id] = true; });
      try { if (window._hap) window._hap('success'); } catch (e) {}
      showToast(items.length + " ta tovar belgilandi", "success");
    }
    window.renderBulkDiscount();
  };

  window.bdClearSelection = function () {
    BD.sel = {};
    window.renderBulkDiscount();
  };

  window.openBulkDiscount = function () {
    if (!(window.isAdmin && window.isAdmin())) {
      showToast("Bu bo'lim faqat administrator uchun", "warning");
      return;
    }
    var am = document.getElementById('adminModal');
    if (am) am.style.display = 'none';
    var m = document.getElementById('bulkDiscountModal');
    if (!m) return;
    m.style.display = 'flex';
    // ⚠️ `activeModal` — asosiy skriptdagi global `let`. `window.activeModal`
    //    ga yozish UNI O'ZGARTIRMAYDI (let window'ga tushmaydi), natijada
    //    «orqaga» tugmasi va cheksiz skroll to'xtatuvi ishlamay qolardi.
    //    Shu sababli NOM bilan yozamiz — boshqa admin panellari ham shunday.
    try { activeModal = 'bulkDiscountModal'; } catch (e) { window.activeModal = 'bulkDiscountModal'; }
    try { window.history.pushState({ modal: 'bulkDiscountModal' }, ""); } catch (e) {}

    BD.sel = {}; BD.filter = 'all';
    var s = document.getElementById('bd-search'); if (s) s.value = '';
    var p = document.getElementById('bd-pct'); if (p) p.value = '';
    var h = document.getElementById('bd-hours'); if (h) h.value = '';
    try {
      document.querySelectorAll('#bulkDiscountModal .bd-quick').forEach(function (b) { b.classList.remove('on'); });
      document.querySelectorAll('#bd-filter-chips .inv-fchip').forEach(function (c) {
        c.classList.toggle('selected', c.getAttribute('data-f') === 'all');
      });
    } catch (e) {}
    window.renderBulkDiscount();
  };

  // — Yozish: bitta o'qish + bitta yozish (indeks siljish xatosi yo'q) —
  //   `_rewriteProductsSafely` avval BAZADAN eng so'nggi holatni o'qiydi,
  //   o'zgarishni id bo'yicha qo'llaydi va bir marta yozadi. Shu sababli
  //   xotiradagi eskirgan nusxa boshqa o'zgarishlarni yuvib ketmaydi.
  //
  //   `mutate(p)` tovarni JOYIDA o'zgartiradi va o'zgartirdi/yo'q degan
  //   mantiqiy qiymat qaytaradi (hisoblash uchun). Qaytgan qiymat tovar
  //   O'RNIGA ishlatilmaydi — massivda hamisha `p` qoladi.
  function bdWrite(mutate, buildMsg) {
    if (typeof window._rewriteProductsSafely !== 'function') {
      showToast("Saqlash funksiyasi topilmadi", "warning");
      return;
    }
    var changed = 0;
    window._rewriteProductsSafely(function (fresh) {
      fresh.forEach(function (p) {
        if (!p) return;
        try { if (mutate(p)) changed++; } catch (e) {}
      });
      return fresh;
    }).then(function () {
      showToast(buildMsg(changed), "success");
      BD.sel = {};
      // Mijoz ko'rinishini ham yangilaymiz (aksiya tovarlari tepaga chiqadi)
      if (typeof window._afterBulk === 'function') {
        try { window._afterBulk(); } catch (e) {}
      }
      window.renderBulkDiscount();
    }).catch(function (e) {
      showToast("Saqlashda xato — qayta urinib ko'ring", "warning");
      try { if (window._dwarn) window._dwarn('[aksiya] yozish xatosi:', e); } catch (_) {}
    });
  }

  window.bdApply = function () {
    var ids = bdSelectedIds();
    if (!ids.length) { showToast("Avval tovarlarni belgilang", "warning"); return; }
    var pct = bdPct();
    if (!pct) { showToast("Chegirma foizini kiriting", "warning"); return; }
    if (pct >= 90) { showToast("Foiz 90 dan kichik bo'lsin", "warning"); return; }
    var h = bdHours();
    var until = h > 0 ? (Date.now() + Math.round(h * 3600000)) : 0;

    var doIt = function () {
      bdWrite(function (p) {
        if (ids.indexOf(p.id) === -1) return false;
        var base = basePriceOf(p);
        // Yaxlitlashdan keyin narx o'zgarmasa yoki nolga tushsa — tegmaymiz.
        var np = window._bdNewPrice(p, pct);
        if (!np) return false;
        p.oldPrice = base;
        p.price = np;
        if (until > 0) p.flashUntil = until; else delete p.flashUntil;
        return true;
      }, function (n) {
        var msg = n + " ta tovarga −" + pct + "% aksiya qo'yildi";
        if (n < ids.length) msg += " (" + (ids.length - n) + " ta o'tkazildi)";
        return msg;
      });
    };

    var q = ids.length + " ta tovarga −" + pct + "% chegirma qo'yilsinmi?"
      + (h ? (" Muddat: " + h + " soat.") : " Muddat: muddatsiz.");
    if (typeof tg !== 'undefined' && tg.showConfirm) tg.showConfirm(q, function (ok) { if (ok) doIt(); });
    else if (confirm(q)) doIt();
  };

  window.bdCancelDiscount = function () {
    var ids = bdSelectedIds();
    if (!ids.length) { showToast("Avval tovarlarni belgilang", "warning"); return; }
    var doIt = function () {
      bdWrite(function (p) {
        if (ids.indexOf(p.id) === -1) return false;
        if (!(p.oldPrice && Number(p.oldPrice) > Number(p.price))) return false;
        // Asl narxni tiklaymiz va chegirma belgilarini olib tashlaymiz.
        p.price = Number(p.oldPrice);
        delete p.oldPrice;
        delete p.flashUntil;
        return true;
      }, function (n) {
        return n
          ? (n + " ta tovarning aksiyasi bekor qilindi, asl narx tiklandi")
          : "Belgilangan tovarlarda aksiya yo'q edi";
      });
    };
    var q = ids.length + " ta tovarning aksiyasi bekor qilinsinmi? Asl narx tiklanadi.";
    if (typeof tg !== 'undefined' && tg.showConfirm) tg.showConfirm(q, function (ok) { if (ok) doIt(); });
    else if (confirm(q)) doIt();
  };

  // ===================================================================
  // 3) 🔐 XAVFSIZ ULANISH (AUTH) HOLATI — admin panelda ko'rinadi
  // ---------------------------------------------------------------------
  // NEGA KERAK: baza qoidalari `auth` ga tayanadi. Ilgari auth haqiqatan
  // ishlayotganini bilishning yo'li yo'q edi — qoidalarni joriy qilib,
  // ilova sinsagina bilinardi (mijozlar buyurtma bera olmay qolardi).
  // Endi admin panelni ochish kifoya: yashil bo'lsa — joriy qilish
  // xavfsiz, qizil bo'lsa — TO'XTAB, sababni o'qish kerak.
  // ===================================================================
  // Uch holat: kutilmoqda / ishlayapti / yo'q.
  //   ⚠️ «Kutilmoqda» ABADIY qolmasligi kerak — ilgari aynan shunday
  //      bo'lgan. Shuning uchun 13 sekunddan keyin javob kelmasa,
  //      bu ham XATO deb hisoblanadi va sababi yoziladi.
  var authSettled = false;
  var authTimedOut = false;

  window._authStatusRefresh = function () {
    var box = document.getElementById('auth-status');
    var tx = document.getElementById('auth-text');
    var detail = document.getElementById('auth-detail');
    if (!box || !tx) return;
    function setDetail(message) {
      if (box.dataset) box.dataset.detail = message;
      box.setAttribute('aria-label', message);
      if (detail) detail.textContent = message;
    }

    var uid = null;
    try {
      var u = (window.firebase && firebase.auth && firebase.auth().currentUser) || null;
      uid = u && u.uid ? String(u.uid) : null;
    } catch (e) {}

    box.classList.remove('ok', 'bad');

    if (uid) {
      box.classList.add('ok');
      tx.textContent = 'Xavfsiz ulanish ishlayapti (ID: ' + uid + '). Baza qoidalarini joriy qilish mumkin.';
      setDetail('Xavfsiz ulanish ishlayapti. Firebase Auth ID: ' + uid);
      return;
    }

    // Hali javob kelmagan va vaqt ham tugamagan — halol «kutilmoqda»
    if (!authSettled && !authTimedOut) {
      tx.textContent = 'Xavfsiz ulanish tekshirilmoqda…';
      setDetail('Xavfsiz ulanish tekshirilmoqda…');
      return;
    }

    box.classList.add('bad');
    var sabab;
    if (!(window.tg && window.tg.initData)) {
      sabab = "Telegram tashqarisida ochilgan (initData yo'q) — Mini App'ni "
        + 'Telegram ichidan, bot orqali oching.';
    } else if (authTimedOut && !authSettled) {
      sabab = 'Worker /auth vaqtida javob bermadi — Cloudflare Worker '
        + "deploy qilinmagan yoki tarmoq sekin bo'lishi mumkin.";
    } else {
      sabab = 'Worker /auth javob bermadi — Cloudflare Worker deploy '
        + "qilinmagan yoki BOT_TOKEN sozlanmagan bo'lishi mumkin.";
    }
    tx.textContent = "Xavfsiz ulanish YO'Q. " + sabab + ' Baza qoidalarini hozir joriy QILMANG.';
    setDetail(sabab + ' Baza qoidalarini hozir joriy qilmang.');
  };

  window._authStatusTap = function () {
    try { window._authStatusRefresh(); } catch (e) {}
    var box = document.getElementById('auth-status');
    var detail = document.getElementById('auth-detail');
    if (!box || !detail) return;
    var open = !detail.classList.contains('show');
    detail.classList.toggle('show', open);
    box.setAttribute('aria-expanded', open ? 'true' : 'false');
  };

  // ── HOLATNI YANGILASH — BIR NECHTA MUSTAQIL YO'L ─────────────────
  //
  // ⚠️ ILGARI faqat `openModal` ustiga o'ram qo'yilgan edi va indikator
  //    «Tekshirilmoqda…» holatida QOTIB qolardi. Sabab: `openModal`
  //    fayl bo'ylab BESH joyda o'raladi (23972, 24133, 24858, 25670 va
  //    bu yer) va ularning ba'zilari KECHIKTIRIB (setTimeout /
  //    DOMContentLoaded) o'rnatiladi. Ya'ni bizning o'ramimiz
  //    o'rnatilmasligi yoki chetlab o'tilishi mumkin.
  //
  //    Endi indikator `openModal` ga UMUMAN bog'liq emas: element
  //    sahifa yuklanganda ham bo'yaladi. Modal ochilishini kutmaymiz —
  //    `#auth-status` statik HTML ichida, ya'ni boshidan DOM da bor.
  function paintNow() { try { window._authStatusRefresh(); } catch (e) {} }

  // 1) Darhol (auth hali tayyor bo'lmasa ham — «yo'q» deb ko'rsatadi)
  paintNow();

  // 2) Auth tugagach — asosiy yo'l
  function settle() { authSettled = true; paintNow(); }
  try {
    if (window._authReady && typeof window._authReady.then === 'function') {
      window._authReady.then(settle, settle);
    } else {
      // `_authReady` umuman yo'q (qatlam tartibi buzilgan) — kutmaymiz
      settle();
    }
  } catch (e) { settle(); }

  // 3) ABADIY «kutilmoqda» bo'lmasligi kafolati: 13 sekunddan keyin
  //    javob kelmasa — xato deb ko'rsatamiz va sababini yozamiz.
  //    (Auth'ning o'z chegarasi 12 s — shundan bir oz keyin tekshiramiz.)
  setTimeout(function () {
    if (!authSettled) { authTimedOut = true; paintNow(); }
  }, 13000);

  // 4) Zaxira: auth kechikishi mumkin (Worker javobi, sekin tarmoq).
  //    Bir necha marta qayta tekshiramiz, keyin to'xtaydi (interval YO'Q —
  //    batareyani yemasin).
  [1200, 3500, 8000].forEach(function (ms) { setTimeout(paintNow, ms); });

  // 5) Admin tugmasi bosilganda — qanday ochilishidan qat'i nazar
  //    (capture fazasida, ya'ni boshqa handlerlar to'xtatsa ham ishlaydi)
  try {
    document.addEventListener('click', function (e) {
      try {
        var t = e.target;
        if (t && t.closest && t.closest('#nav-admin')) setTimeout(paintNow, 80);
      } catch (_) {}
    }, true);
  } catch (e) {}

  // 6) Qo'shimcha: `openModal` o'rami (mavjud bo'lsa) — eski yo'l ham qoladi
  if (typeof window.openModal === 'function') {
    var _omOrig = window.openModal;
    window.openModal = function (id) {
      var r = _omOrig.apply(this, arguments);
      if (id === 'adminModal') {
        paintNow();
        try { Promise.resolve(window._authReady).then(paintNow).catch(function () {}); } catch (e) {}
      }
      return r;
    };
  }

  // Chip'lar boshlang'ich holati (sarlavha matni to'g'ri turishi uchun)
  try { hfSyncChips(); } catch (e) {}
})();
