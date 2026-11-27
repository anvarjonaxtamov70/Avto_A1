
/* =====================================================================
   MIJOZ TOMONI QATLAMI — mantiq
   Hamma narsa `window` ga chiqariladi, shunda Node'dagi sinov aynan
   SHU kodni tekshira oladi (nusxa emas).
   ===================================================================== */
(function customerBoost2026() {
  'use strict';

  /* ------------------------------------------------------------------ *
   * 0) KICHIK YORDAMCHILAR
   * ------------------------------------------------------------------ */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c];
    });
  }
  function num(v, d) { var n = Number(v); return isFinite(n) ? n : (d || 0); }

  /* ------------------------------------------------------------------ *
   * 1) FILTR + SARALASH — YAGONA DVIGATEL
   *
   * ⚠️ Ilgari bu mantiq FAQAT qidiruvda (`_sfsApply`) bor edi. Katalog
   *    uchun ikkinchi nusxa yozsak, vaqt o'tib ikkisi ajralib ketardi
   *    (bir joyda "arzoni oldin" boshqacha ishlardi). Shuning uchun
   *    umumiy dvigatel yasab, `_sfsApply` ni ham SHUNGA yo'naltiramiz.
   * ------------------------------------------------------------------ */
  function priceOf(p) {
    // Razmerli tovarda razmerga alohida narx berilgan bo'lsa — eng arzoni.
    if (p && p.product_type === 'razmerli' && Array.isArray(p.sizes) && p.sizes.length) {
      var nums = p.sizes.map(function (s) { return Number(s && s.price); })
                        .filter(function (n) { return n > 0; });
      if (nums.length) return Math.min.apply(null, nums);
    }
    return num(p && p.price, 0);
  }
  function stockOf(p) {
    if (p && p.product_type === 'razmerli' && Array.isArray(p.sizes)) {
      return p.sizes.reduce(function (a, s) { return a + (parseInt(s && s.stock, 10) || 0); }, 0);
    }
    return (p && p.stock !== undefined) ? num(p.stock, 0) : 10;
  }
  function ratingOf(p) {
    var r = (window.productRatings && p && window.productRatings[p.id]) || null;
    return r ? num(r.avg, 0) : num(p && parseFloat(p.rating), 0);
  }
  function hasDiscount(p) {
    return !!(p && p.oldPrice && Number(p.oldPrice) > Number(p.price));
  }
  function createdOf(p) {
    return num(p && (p.createdAt || p.created_at || p.ts || p.id), 0);
  }
  window._cbPriceOf = priceOf;
  window._cbStockOf = stockOf;

  /**
   * Ro'yxatga filtr va BARQAROR saralashni qo'llaydi.
   * state: { sort, instock, discount, mycar, origin }
   *   sort: 'default' | 'relevance' | 'price-asc' | 'price-desc' | 'rating' | 'new'
   *   ('default' va 'relevance' — saralamaslik, kelgan tartib saqlanadi)
   */
  window._applyFilterSort = function (items, state) {
    if (!Array.isArray(items)) return items;
    var st = state || {};
    var car = st.mycar ? window._myCarValue() : '';
    var out = items.filter(function (p) {
      if (!p) return false;
      if (st.instock && stockOf(p) <= 0) return false;
      if (st.discount && !hasDiscount(p)) return false;
      if (st.mycar && car && !window._carMatches(p, car)) return false;
      if (st.origin && !window._originMatches(p, st.origin)) return false;
      return true;
    });
    var s = st.sort || 'default';
    if (s !== 'default' && s !== 'relevance') {
      // Barqaror saralash: teng qiymatda asl tartib saqlanadi (sakramaydi).
      out = out.map(function (p, i) { return { p: p, i: i }; });
      out.sort(function (a, b) {
        var d = 0;
        if (s === 'price-asc') d = priceOf(a.p) - priceOf(b.p);
        else if (s === 'price-desc') d = priceOf(b.p) - priceOf(a.p);
        else if (s === 'rating') d = ratingOf(b.p) - ratingOf(a.p);
        else if (s === 'new') d = createdOf(b.p) - createdOf(a.p);
        return d !== 0 ? d : (a.i - b.i);
      });
      out = out.map(function (o) { return o.p; });
    }
    return out;
  };

  // 🔗 Qidiruv ham AYNI dvigatelni ishlatadi (ikki xil natija bo'lmasin).
  //    `_sfsState` shakli mos: { sort:'relevance', instock, discount }.
  if (typeof window._sfsApply === 'function') {
    window._sfsApply = function (items) {
      return window._applyFilterSort(items, window._sfsState || {});
    };
  }

  /* ------------------------------------------------------------------ *
   * 2) «MENING MASHINAM» MOSLIGI
   *
   * Profilda `my_car` "chevy-Cobalt" ko'rinishida saqlanadi, katalog
   * kategoriyalari esa "chevy-cobalt" slug'i. GAZ esa alohida: kalit
   * `gaz`, kategoriya esa "gazel-biznes" / "volga-31105" / "sobol".
   * Shuning uchun bir nechta nomzod slug yasab, PREFIKS bo'yicha
   * solishtiramiz — shunda "chevy-malibu" ham "chevy-malibu1" ga,
   * "chevy-captiva" ham "chevy-captiva3" ga tushadi.
   * ------------------------------------------------------------------ */
  window._myCarValue = function () {
    try { return localStorage.getItem('avto_my_car') || ''; } catch (e) { return ''; }
  };

  window._carSlugCandidates = function (val) {
    var v = String(val || '').trim();
    if (!v) return [];
    var i = v.indexOf('-');
    var key = i < 0 ? '' : v.slice(0, i).toLowerCase();
    var model = (i < 0 ? v : v.slice(i + 1)).toLowerCase().trim();
    if (!model) return [];
    var dashed = model.replace(/\s+/g, '-');
    var nospace = model.replace(/\s+/g, '');
    var out = [];
    if (key === 'gaz' || !key) {
      // GAZ: kategoriya markasiz — "gazel-biznes", "volga-31105", "sobol"
      out.push(dashed, nospace);
    } else {
      out.push(key + '-' + nospace, key + '-' + dashed);
    }
    // Takrorlanmasin
    return out.filter(function (x, idx) { return x && out.indexOf(x) === idx; });
  };

  window._carMatches = function (product, carVal) {
    var cands = window._carSlugCandidates(carVal);
    if (!cands.length) return true;          // mashina belgilanmagan -> filtrlamaymiz
    var cats = [];
    if (product) {
      if (Array.isArray(product.categories)) cats = cats.concat(product.categories);
      if (product.category) cats.push(product.category);
    }
    for (var i = 0; i < cats.length; i++) {
      var c = String(cats[i] || '').toLowerCase();
      if (!c) continue;
      for (var j = 0; j < cands.length; j++) {
        if (c.indexOf(cands[j]) === 0) return true;
      }
    }
    return false;
  };

  /** `my_car` uchun mavjud katalog bo'limi id'sini topadi (yoki ''). */
  window._myCarSectionId = function (carVal) {
    var cands = window._carSlugCandidates(carVal || window._myCarValue());
    if (!cands.length || typeof document === 'undefined') return '';
    for (var i = 0; i < cands.length; i++) {
      if (document.getElementById(cands[i] + '-parts')) return cands[i] + '-parts';
    }
    // Aniq mos yo'q — prefiks bo'yicha birinchi mos bo'limni olamiz
    // (mas. "chevy-malibu" -> "chevy-malibu1-parts").
    var grids = document.querySelectorAll('.items-grid[id$="-parts"]');
    for (var g = 0; g < grids.length; g++) {
      var gid = grids[g].id;
      for (var k = 0; k < cands.length; k++) {
        if (gid.indexOf(cands[k]) === 0) return gid;
      }
    }
    return '';
  };

  /* ------------------------------------------------------------------ *
   * 3) «ISHLAB CHIQARILGAN JOY»
   * ------------------------------------------------------------------ */
  var ORIGIN_KEYS = ['Original', 'Rossiya', 'Xitoy'];

  /** "Xitoy (Zavodskoy)" -> "Xitoy". Noma'lum qiymat o'zi qaytadi. */
  window._originShort = function (o) {
    var s = String(o || '').trim();
    if (!s) return '';
    var l = s.toLowerCase();
    if (l.indexOf('original') === 0 || l.indexOf('оригинал') === 0) return 'Original';
    if (l.indexOf('rossiya') === 0 || l.indexOf('росси') === 0) return 'Rossiya';
    if (l.indexOf('xitoy') === 0 || l.indexOf('kitoy') === 0 || l.indexOf('кита') === 0) return 'Xitoy';
    return s.length > 16 ? s.slice(0, 16) : s;
  };

  window._originMatches = function (product, key) {
    if (!key) return true;
    return window._originShort(product && product.origin) === key;
  };

  var ORIGIN_ICON = {
    Original: '<svg viewBox="0 0 24 24" width="10" height="10" fill="currentColor"><path d="M12 2l2.4 5.6L20 10l-5.6 2.4L12 18l-2.4-5.6L4 10l5.6-2.4z"/></svg>',
    Rossiya: '', Xitoy: ''
  };

  window._originBadgeHTML = function (origin) {
    var k = window._originShort(origin);
    if (!k) return '';
    var cls = (k === 'Original') ? 'o-original'
            : (k === 'Rossiya') ? 'o-rossiya'
            : (k === 'Xitoy') ? 'o-xitoy' : 'o-xitoy';
    return '<div class="card-origin ' + cls + '">' + (ORIGIN_ICON[k] || '') + esc(k) + '</div>';
  };

  /* ------------------------------------------------------------------ *
   * 4) KARTOCHKA — ATAYLAB O'RALMAYDI
   *
   * ⚠️ `cardHTML` ni o'rab, kartochkaga «origin» belgisi qo'shilgan edi.
   *    Olib tashlandi: kartochka ko'rinishi shu faylda tejamkorlik bilan
   *    sozlangan va unga har qanday qo'shimcha element:
   *      • balandlikni o'zgartiradi (narx tugmalari bir chizqda turmaydi —
   *        `h4 { min-height: 2.6em }` aynan shu uchun qo'yilgan),
   *      • har kartada qo'shimcha DOM tugun = uzun ro'yxatda ortiqcha yuk.
   *
   *    «Ishlab chiqarilgan joy» endi FAQAT tovar oynasida (`#pm-origin`)
   *    va FILTRDA ko'rinadi — mijoz uchun foyda saqlanadi, kartochka
   *    esa tegilmaydi.
   * ------------------------------------------------------------------ */

  /* ------------------------------------------------------------------ *
   * 5) TOVAR OYNASI: origin chipi + rasmga zoom ishorasi
   * ------------------------------------------------------------------ */
  function decorateProductModal(p) {
    // origin chipi — `#pm-code` dan keyin
    var host = document.getElementById('pm-origin');
    if (!host) {
      var codeEl = document.getElementById('pm-code');
      if (codeEl && codeEl.parentNode) {
        host = document.createElement('div');
        host.id = 'pm-origin';
        codeEl.parentNode.insertBefore(host, codeEl.nextSibling);
      }
    }
    if (host) {
      var b = window._originBadgeHTML(p && p.origin);
      host.innerHTML = b;
      host.style.display = b ? 'block' : 'none';
    }
    // «Kattalashtirish uchun bosing» ishorasi
    var cont = document.querySelector('#productModal .pm-slider-container');
    if (cont && !cont.querySelector('.pmz-tip')) {
      var tip = document.createElement('div');
      tip.className = 'pmz-tip';
      tip.innerHTML = '<svg viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0A4.5 4.5 0 1 1 14 9.5 4.5 4.5 0 0 1 9.5 14zM12 10h-2v2H9v-2H7V9h2V7h1v2h2v1z"/></svg>Kattalashtirish';
      cont.appendChild(tip);
    }
  }

  if (typeof window.openProduct === 'function') {
    var _origOpenProduct = window.openProduct;
    window.openProduct = function (id) {
      var r = _origOpenProduct.apply(this, arguments);
      try {
        var list = window.productsDB || [];
        var p = null;
        for (var i = 0; i < list.length; i++) {
          if (list[i] && String(list[i].id) === String(id)) { p = list[i]; break; }
        }
        decorateProductModal(p);
      } catch (e) {}
      return r;
    };
  }

  /* ------------------------------------------------------------------ *
   * 6) KATALOG FILTR/SARALASH PANELI
   *
   * ⚠️ MUHIM TUZILISH FAKTI: `#<mashina>-parts` elementi AYNI PAYTDA
   *    bo'lim (`#content-area` ning bevosita bolasi) VA tovar gridi.
   *    Shu sababli panelni grid ICHIGA, birinchi element qilib
   *    qo'yamiz (`grid-column: span 2`). Panelni gridдan TASHQARIGA
   *    qo'ysak, u barcha ekranlarda ko'rinib qolardi.
   *
   *    `renderProducts()` grid `innerHTML` ini qayta yozadi, ya'ni
   *    panel o'chadi — shuning uchun u har renderdan KEYIN qayta
   *    qo'yiladi. Tejash uchun FAQAT ko'rinib turgan bo'lim
   *    bezatiladi (32 ta bo'limning hammasi emas).
   * ------------------------------------------------------------------ */
  var CAT = { sort: 'default', instock: false, discount: false, origin: '' };
  window._catState = CAT;

  function catIsDefault() {
    return CAT.sort === 'default' && !CAT.instock && !CAT.discount && !CAT.origin;
  }

  /** Bo'lim uchun asosiy (filtrsiz) tovar ro'yxati. */
  function baseListFor(catName) {
    var src = null;
    // `displayDB` — global `let`, keyingi skriptdan NOM bilan o'qiladi
    // (window.displayDB YO'Q, chunki `let` window'ga tushmaydi).
    try { if (typeof displayDB !== 'undefined' && Array.isArray(displayDB)) src = displayDB; } catch (e) {}
    if (!src) {
      src = (window.productsDB || []).filter(function (p) { return p && !p.is_draft; })
                                     .slice().reverse();
    }
    return src.filter(function (x) {
      if (!x) return false;
      return x.category === catName ||
             (Array.isArray(x.categories) && x.categories.indexOf(catName) >= 0);
    });
  }

  function toolbarHTML(total, shown) {
    var opts = [
      ['default', 'Tavsiya etilgan'],
      ['price-asc', 'Avval arzoni'],
      ['price-desc', 'Avval qimmati'],
      ['rating', 'Reyting bo\'yicha'],
      ['new', 'Avval yangisi']
    ].map(function (o) {
      return '<option value="' + o[0] + '"' + (CAT.sort === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
    }).join('');

    var countTx = (shown !== total)
      ? '<b>' + shown + '</b> / ' + total + ' ta'
      : '<b>' + total + '</b> ta tovar';

    var originChips = ORIGIN_KEYS.map(function (k) {
      return '<span class="cfs-chip' + (CAT.origin === k ? ' on' : '') +
             '" onclick="window._catSetOrigin(\'' + k + '\')">' + k + '</span>';
    }).join('');

    return '' +
      '<div class="cfs-bar">' +
        '<div class="cfs-row">' +
          '<span class="cfs-count">' + countTx + '</span>' +
          '<span class="cfs-sort-wrap">' +
            '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M3 18h6v-2H3v2zM3 6v2h18V6H3zm0 7h12v-2H3v2z"/></svg>' +
            '<select class="cfs-sort" aria-label="Saralash" onchange="window._catSetSort(this.value)">' + opts + '</select>' +
          '</span>' +
        '</div>' +
        '<div class="cfs-row">' +
          '<span class="cfs-chip' + (CAT.instock ? ' on' : '') + '" onclick="window._catToggle(\'instock\')">Sotuvda bor</span>' +
          '<span class="cfs-chip' + (CAT.discount ? ' on' : '') + '" onclick="window._catToggle(\'discount\')">Chegirmali</span>' +
          originChips +
          (catIsDefault() ? '' : '<button class="cfs-reset" onclick="window._catReset()">Tozalash</button>') +
        '</div>' +
      '</div>';
  }

  function emptyHTML(total) {
    if (typeof window._emptyState !== 'function') {
      return '<div style="grid-column:span 2;text-align:center;color:gray;padding:30px 10px;">' +
             'Filtrga mos tovar yo\'q.</div>';
    }
    return '<div style="grid-column: span 2;">' + window._emptyState({
      title: 'Filtrga mos tovar yo\'q',
      desc: 'Bu bo\'limda ' + total + ' ta tovar bor, lekin tanlangan filtrlarga mos kelmadi.',
      btnText: 'Filtrlarni tozalash',
      btnAction: 'window._catReset()'
    }) + '</div>';
  }

  /** Ko'rinib turgan `-parts` bo'limini topadi. */
  function visiblePartsGrid() {
    var grids = document.querySelectorAll('.items-grid[id$="-parts"]');
    for (var i = 0; i < grids.length; i++) {
      if (!grids[i].classList.contains('hidden')) return grids[i];
    }
    return null;
  }

  /** Grid ichidagi mavjud panelni olib tashlaydi (dublikat bo'lmasin). */
  function removeBar(grid) {
    for (var i = 0; i < grid.children.length; i++) {
      if (grid.children[i].className &&
          String(grid.children[i].className).indexOf('cfs-bar') >= 0) {
        grid.removeChild(grid.children[i]);
        return;
      }
    }
  }

  function decorateGrid(grid) {
    if (!grid || !grid.id) return;
    var catName = grid.id.replace(/-parts$/, '');
    var base = baseListFor(catName);
    // Bu mashina uchun tovar umuman yo'q -> panel keraksiz, asl
    // «hali tovarlar yo'q» holatini o'z holiga qoldiramiz.
    if (!base.length) return;
    if (typeof window.cardHTML !== 'function') return;

    // ⚡ TEJAMKOR YO'L — filtr TEGILMAGAN bo'lsa kartalarni QAYTA CHIZMAYMIZ.
    //
    //    ⚠️ NEGA MUHIM: asl `renderProducts()` kartalarni allaqachon
    //    chizib qo'yadi. Ilgari bu funksiya ustidan `innerHTML` ni QAYTA
    //    yozardi, ya'ni har renderda:
    //      • barcha <img> lar yangidan yaratilib QAYTA DEKOD qilinardi,
    //      • parallaks kuzatuvi (`_scanParallax`) qaytadan qurilardi,
    //      • reveal animatsiyasi qaytadan ishga tushardi.
    //    `renderProducts` 14 joydan chaqiriladi — natijada telefon
    //    bekorga qizardi. Endi standart holatda faqat PANEL qo'yiladi.
    if (catIsDefault()) {
      removeBar(grid);                                   // hisoblagichni yangilaymiz
      grid.insertAdjacentHTML('afterbegin', toolbarHTML(base.length, base.length));
      return;
    }

    // Filtr/saralash AKTIV — bu holda qayta chizishga majburmiz.
    var shown = window._applyFilterSort(base, CAT);
    var body = shown.length
      ? shown.map(function (x) { return window.cardHTML(x); }).join('')
      : emptyHTML(base.length);
    grid.innerHTML = toolbarHTML(base.length, shown.length) + body;
    try { if (typeof initReveal === 'function') setTimeout(initReveal, 60); } catch (e) {}
  }
  window._catDecorateVisible = function () { decorateGrid(visiblePartsGrid()); };

  window._catSetSort = function (v) {
    CAT.sort = v || 'default';
    try { if (window._hap) window._hap('light'); } catch (e) {}
    window._catDecorateVisible();
  };
  window._catToggle = function (key) {
    CAT[key] = !CAT[key];
    try { if (window._hap) window._hap('light'); } catch (e) {}
    window._catDecorateVisible();
  };
  window._catSetOrigin = function (k) {
    CAT.origin = (CAT.origin === k) ? '' : k;   // qayta bosilsa o'chadi
    try { if (window._hap) window._hap('light'); } catch (e) {}
    window._catDecorateVisible();
  };
  window._catReset = function () {
    CAT.sort = 'default'; CAT.instock = false; CAT.discount = false; CAT.origin = '';
    window._catDecorateVisible();
  };

  // `renderProducts` gridni qayta yozadi -> panelni qaytaramiz.
  if (typeof window.renderProducts === 'function') {
    var _origRenderProducts = window.renderProducts;
    window.renderProducts = function () {
      var r = _origRenderProducts.apply(this, arguments);
      try { window._catDecorateVisible(); } catch (e) {}
      try { syncMyCarShortcut(); } catch (e) {}
      return r;
    };
  }

  // Bo'lim ochilganda panelni qo'yamiz.
  if (typeof window.showSection === 'function') {
    var _origShowSection = window.showSection;
    window.showSection = function (id) {
      var r = _origShowSection.apply(this, arguments);
      try {
        if (String(id || '').slice(-6) === '-parts') {
          var g = document.getElementById(id);
          if (g) decorateGrid(g);
        }
      } catch (e) {}
      return r;
    };
  }

  /* ------------------------------------------------------------------ *
   * 7) QIDIRUV PANELIGA «mening mashinam» + «origin» chiplari
   *    Mavjud `#sfs-toolbar` ga qo'shimcha chiplar qo'shamiz.
   * ------------------------------------------------------------------ */
  window._sfsSetOrigin = function (k) {
    window._sfsState = window._sfsState || {};
    window._sfsState.origin = (window._sfsState.origin === k) ? '' : k;
    if (typeof window.searchProducts === 'function') window.searchProducts();
  };
  window._sfsToggleMyCar = function () {
    window._sfsState = window._sfsState || {};
    window._sfsState.mycar = !window._sfsState.mycar;
    if (typeof window.searchProducts === 'function') window.searchProducts();
  };

  function extendSearchToolbar() {
    var chips = document.querySelector('#sfs-toolbar .sfs-chips');
    if (!chips || chips.getAttribute('data-boosted') === '1') return;
    chips.setAttribute('data-boosted', '1');

    var car = window._myCarValue();
    var html = '';
    if (car && typeof window.myCarLabel === 'function') {
      html += '<span class="cfs-chip" id="sfs-chip-mycar" onclick="window._sfsToggleMyCar()">🚗 ' +
              esc(window.myCarLabel(car)) + '</span>';
    }
    html += ORIGIN_KEYS.map(function (k) {
      return '<span class="cfs-chip sfs-origin" data-o="' + k +
             '" onclick="window._sfsSetOrigin(\'' + k + '\')">' + k + '</span>';
    }).join('');
    chips.insertAdjacentHTML('beforeend', html);
  }

  function syncSearchToolbar() {
    var st = window._sfsState || {};
    var mc = document.getElementById('sfs-chip-mycar');
    if (mc) mc.classList.toggle('on', !!st.mycar);
    document.querySelectorAll('#sfs-toolbar .sfs-origin').forEach(function (c) {
      c.classList.toggle('on', st.origin === c.getAttribute('data-o'));
    });
  }

  if (typeof window._sfsSyncToolbar === 'function') {
    var _origSfsSync = window._sfsSyncToolbar;
    window._sfsSyncToolbar = function (visible) {
      var r = _origSfsSync.apply(this, arguments);
      try {
        if (visible) { extendSearchToolbar(); syncSearchToolbar(); }
      } catch (e) {}
      return r;
    };
  }
  // `_sfsIsDefault` yangi chiplarni ham hisobga olsin («Tozalash» ko'rinishi).
  if (typeof window._sfsIsDefault === 'function') {
    var _origIsDefault = window._sfsIsDefault;
    window._sfsIsDefault = function () {
      var st = window._sfsState || {};
      return _origIsDefault.apply(this, arguments) && !st.mycar && !st.origin;
    };
  }
  if (typeof window._sfsReset === 'function') {
    var _origSfsReset = window._sfsReset;
    window._sfsReset = function () {
      var st = window._sfsState || {};
      st.mycar = false; st.origin = '';
      return _origSfsReset.apply(this, arguments);
    };
  }

  /* ------------------------------------------------------------------ *
   * 8) BOSH SAHIFA: «MENING MASHINAM» YORLIG'I
   *    Profilda mashina belgilangan bo'lsa, bitta bosishda o'sha
   *    mashinaning butun katalogi ochiladi.
   *    (Filtr emas, YO'NALTIRISH — bosh sahifadagi sahifalash
   *     mexanizmiga tegmaydi, ya'ni regressiya xavfi yo'q.)
   * ------------------------------------------------------------------ */
  function ensureMyCarShortcut() {
    var el = document.getElementById('mycar-shortcut');
    if (el) return el;
    var menu = document.getElementById('main-menu');
    if (!menu) return null;
    el = document.createElement('div');
    el.id = 'mycar-shortcut';
    el.setAttribute('role', 'button');
    el.innerHTML =
      '<span class="mcs-ic"><svg viewBox="0 0 24 24"><path d="M18.92 5.01C18.72 4.42 18.16 4 17.5 4h-11c-.66 0-1.21.42-1.42 1.01L3 11v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 15c-.83 0-1.5-.67-1.5-1.5S5.67 12 6.5 12s1.5.67 1.5 1.5S7.33 15 6.5 15zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 10l1.5-4.5h11L19 10H5z"/></svg></span>' +
      '<span class="mcs-tx"><b id="mcs-name"></b><i>Mashinamga mos qismlarni ko\'rish</i></span>' +
      '<span class="mcs-go">›</span>';
    el.onclick = function () {
      var sid = window._myCarSectionId();
      if (!sid) return;
      try { if (window._hap) window._hap('light'); } catch (e) {}
      if (typeof window.showSection === 'function') window.showSection(sid);
      if (typeof window.updateNav === 'function') window.updateNav('nav-catalog');
    };
    menu.insertBefore(el, menu.firstChild);
    return el;
  }

  // Oxirgi qo'llangan qiymat — bekorga DOM ga yozmaslik uchun.
  // `renderProducts` 14 joydan chaqiriladi, mashina esa kamdan-kam
  // o'zgaradi; har safar `textContent` yozish keraksiz ish edi.
  var _lastCarApplied = null;

  function syncMyCarShortcut(force) {
    var car = window._myCarValue();
    if (!force && car === _lastCarApplied) return;   // o'zgarmagan — ish yo'q
    var el = ensureMyCarShortcut();
    if (!el) return;
    _lastCarApplied = car;
    var sid = car ? window._myCarSectionId(car) : '';
    if (!car || !sid) { el.classList.remove('show'); return; }
    var nm = document.getElementById('mcs-name');
    if (nm) {
      nm.textContent = (typeof window.myCarLabel === 'function')
        ? window.myCarLabel(car) : car;
    }
    el.classList.add('show');
  }
  window._syncMyCarShortcut = syncMyCarShortcut;

  // Mashina o'zgarganda yorliq ham yangilanadi.
  if (typeof window.saveMyCar === 'function') {
    var _origSaveMyCar = window.saveMyCar;
    window.saveMyCar = function () {
      var r = _origSaveMyCar.apply(this, arguments);
      // `force` — mashina aynan hozir o'zgardi, tekshiruvni chetlab o'tamiz.
      try { syncMyCarShortcut(true); } catch (e) {}
      return r;
    };
  }

  /* ------------------------------------------------------------------ *
   * 9) RASMNI KATTALASHTIRISH (lightbox + pinch/double-tap zoom)
   *
   * Telegram WebView'da fixed qatlam ustida "native" pinch ishonchsiz,
   * shuning uchun pointer hodisalari bilan O'ZIMIZ hisoblaymiz:
   *   • 2 barmoq  -> masshtab (barmoqlar orasidagi masofa nisbati)
   *   • 1 barmoq  -> surish (faqat kattalashtirilganda)
   *   • ikki marta bosish -> 1x <-> 2.6x
   *   • bir marta bosish (kattalashtirilmagan holda) -> yopish
   * ------------------------------------------------------------------ */
  var Z = {
    el: null, img: null, count: null, hint: null,
    scale: 1, tx: 0, ty: 0, natW: 0, natH: 0,
    pointers: null, startDist: 0, startScale: 1,
    startMid: null, startTx: 0, startTy: 0,
    lastTap: 0, downAt: 0, downX: 0, downY: 0, moved: false,
    srcs: [], index: 0
  };
  var MIN_SCALE = 1, MAX_SCALE = 5;

  function buildZoom() {
    if (Z.el) return Z.el;
    var d = document.createElement('div');
    d.id = 'pmz';
    d.innerHTML =
      '<div id="pmz-count"></div>' +
      '<button id="pmz-close" aria-label="Yopish">×</button>' +
      '<img id="pmz-img" alt="">' +
      '<div id="pmz-hint">Ikki marta bosing yoki ikki barmoq bilan kattalashtiring</div>';
    document.body.appendChild(d);
    Z.el = d;
    Z.img = d.querySelector('#pmz-img');
    Z.count = d.querySelector('#pmz-count');
    Z.hint = d.querySelector('#pmz-hint');
    Z.pointers = new Map();

    d.querySelector('#pmz-close').addEventListener('click', function (e) {
      e.stopPropagation(); closeZoom();
    });

    Z.img.addEventListener('load', function () {
      Z.natW = Z.img.naturalWidth || 0;
      Z.natH = Z.img.naturalHeight || 0;
      resetTransform();
    });
    // Katta rasm yuklanmasa: tekshirilgan original (ImgBB bo'lsa Worker /img),
    // u ham bo'lmasa brend placeholder. ImgBB xato rasmi hech qachon chiqmaydi.
    Z.img.addEventListener('error', function () {
      var raw = Z.srcs[Z.index];
      var step = Z.img.getAttribute('data-step') || '0';
      if (step === '0') {
        Z.img.setAttribute('data-step', '1');
        var safe = window._safeImg ? window._safeImg(raw) : raw;
        if (safe && safe !== Z.img.src) { Z.img.src = safe; return; }
      }
      if (step !== '2') {
        Z.img.setAttribute('data-step', '2');
        if (window._brandPlaceholder) Z.img.src = window._brandPlaceholder('A1');
      }
    });

    d.addEventListener('pointerdown', onDown);
    d.addEventListener('pointermove', onMove);
    d.addEventListener('pointerup', onUp);
    d.addEventListener('pointercancel', onUp);
    // Sahifa orqasidagi skroll/zoom "sizib" ketmasin
    d.addEventListener('wheel', function (e) { e.preventDefault(); }, { passive: false });
    return d;
  }

  function baseSize() {
    // `max-width/height: 100%` bilan brauzer rasmni ekranga moslaydi —
    // haqiqiy joylashgan o'lchamni o'zimiz hisoblaymiz.
    var vw = window.innerWidth || 360, vh = window.innerHeight || 640;
    if (!Z.natW || !Z.natH) return { w: vw, h: vh };
    var k = Math.min(vw / Z.natW, vh / Z.natH, 1);
    // Juda kichik rasm bo'lsa ham ekranga to'ldiramiz (lekin cho'zmaymiz)
    if (k <= 0) k = 1;
    return { w: Z.natW * k, h: Z.natH * k };
  }

  function applyTransform() {
    var b = baseSize();
    var w = b.w * Z.scale, h = b.h * Z.scale;
    // Chegaralar: rasm ekrandan "qochib" ketmasin
    var vw = window.innerWidth || 360, vh = window.innerHeight || 640;
    var maxX = Math.max(0, (w - vw) / 2), maxY = Math.max(0, (h - vh) / 2);
    Z.tx = Math.max(-maxX, Math.min(maxX, Z.tx));
    Z.ty = Math.max(-maxY, Math.min(maxY, Z.ty));
    Z.img.style.width = b.w + 'px';
    Z.img.style.height = b.h + 'px';
    Z.img.style.transform =
      'translate(' + (-b.w / 2 + Z.tx) + 'px,' + (-b.h / 2 + Z.ty) + 'px) scale(' + Z.scale + ')';
    Z.img.style.transformOrigin = (b.w / 2) + 'px ' + (b.h / 2) + 'px';
  }
  function resetTransform() {
    Z.scale = 1; Z.tx = 0; Z.ty = 0;
    Z.img.style.transition = 'none';
    applyTransform();
  }
  function animateTo(scale, tx, ty) {
    Z.img.style.transition = 'transform .22s ease';
    Z.scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale));
    Z.tx = tx; Z.ty = ty;
    applyTransform();
    setTimeout(function () { if (Z.img) Z.img.style.transition = 'none'; }, 240);
  }

  function dist(a, b) {
    var dx = a.x - b.x, dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }
  function pts() {
    var out = [];
    Z.pointers.forEach(function (v) { out.push(v); });
    return out;
  }

  function onDown(e) {
    Z.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    var p = pts();
    if (p.length === 1) {
      Z.downAt = Date.now(); Z.downX = e.clientX; Z.downY = e.clientY; Z.moved = false;
      Z.startTx = Z.tx; Z.startTy = Z.ty;
    } else if (p.length === 2) {
      Z.startDist = dist(p[0], p[1]) || 1;
      Z.startScale = Z.scale;
      Z.startTx = Z.tx; Z.startTy = Z.ty;
      Z.moved = true;
      if (Z.hint) Z.hint.style.opacity = '0';
    }
  }

  function onMove(e) {
    if (!Z.pointers.has(e.pointerId)) return;
    Z.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    var p = pts();
    if (p.length >= 2) {
      var d = dist(p[0], p[1]) || 1;
      Z.scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, Z.startScale * (d / Z.startDist)));
      Z.img.style.transition = 'none';
      applyTransform();
      return;
    }
    if (p.length === 1) {
      var dx = e.clientX - Z.downX, dy = e.clientY - Z.downY;
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) Z.moved = true;
      if (Z.scale > 1.01) {
        Z.tx = Z.startTx + dx; Z.ty = Z.startTy + dy;
        Z.img.style.transition = 'none';
        applyTransform();
      } else if (dy > 70 && Math.abs(dy) > Math.abs(dx)) {
        // Kattalashtirilmagan holda pastga tortish -> yopish
        closeZoom();
      }
    }
  }

  function onUp(e) {
    Z.pointers.delete(e.pointerId);
    if (Z.pointers.size > 0) return;

    var quick = (Date.now() - Z.downAt) < 300 && !Z.moved;
    if (quick) {
      var now = Date.now();
      if (now - Z.lastTap < 300) {
        // Ikki marta bosish — kattalashtirish / qaytarish
        Z.lastTap = 0;
        if (Z.scale > 1.01) animateTo(1, 0, 0);
        else animateTo(2.6, 0, 0);
        if (Z.hint) Z.hint.style.opacity = '0';
        return;
      }
      Z.lastTap = now;
      // Bitta bosish: kattalashtirilmagan bo'lsa yopamiz (kechikish bilan,
      // chunki ikkinchi bosish kelishi mumkin).
      setTimeout(function () {
        if (Z.lastTap && Date.now() - Z.lastTap >= 280 && Z.scale <= 1.01) closeZoom();
      }, 300);
      return;
    }
    // Barmoq uzilgach masshtab 1 dan kichik bo'lsa tiklaymiz
    if (Z.scale < 1.02) animateTo(1, 0, 0);
  }

  // Zoom uchun katta (≈1200px x DPR) rasm weserv orqali olinadi: ImgBB xato
  // bersa weserv ham xato qaytaradi (ImgBB reklama rasmini emas), hajm esa
  // 1.5-3 MB li originaldan bir necha barobar kichik.
  function zoomSrc(raw) {
    try {
      if (typeof raw === 'string' && /^https?:\/\//i.test(raw) && raw.indexOf('/img?u=') === -1 && window._thumb) return window._thumb(raw, 1200);
    } catch (e) {}
    return raw;
  }

  function updateCount() {
    if (!Z.count) return;
    Z.count.textContent = (Z.srcs.length > 1)
      ? (Z.index + 1) + ' / ' + Z.srcs.length : '';
  }

  window.openZoom = function (srcs, index) {
    if (typeof document === 'undefined') return;
    buildZoom();
    Z.srcs = Array.isArray(srcs) ? srcs.filter(Boolean) : [];
    if (!Z.srcs.length) return;
    Z.index = Math.max(0, Math.min(Z.srcs.length - 1, index || 0));
    Z.natW = Z.natH = 0;
    Z.img.setAttribute('data-step', '0');
    Z.img.src = zoomSrc(Z.srcs[Z.index]);
    updateCount();
    if (Z.hint) Z.hint.style.opacity = '1';
    Z.el.classList.add('open');
    resetTransform();

    // 🧭 NAVIGATSIYA — ilovaning MAVJUD naqshi bo'yicha (`__scanner__`,
    //    `__mappicker__` bilan bir xil):
    //      • `activeModal` ni '__zoom__' qilib belgilaymiz,
    //      • tarixga bitta yozuv qo'shamiz.
    //    Telegram «Nazad» bosilganda ilovaning `popstate` handleri
    //    '__zoom__' holatini ko'radi, FAQAT shu qatlamni yopadi va
    //    oldingi oynani (tovar kartochkasini) tiklaydi.
    //
    //    ⚠️ NEGA O'ZIMIZNING `popstate` handlerimiz YO'Q: hodisa
    //    tinglovchilari RO'YXATGA OLINGAN TARTIBDA ishlaydi. Bizning
    //    qatlam eng oxirida yuklanadi, ya'ni ilovaning handleri BIRINCHI
    //    ishlaydi va u `activeModal === 'productModal'` deb tovar oynasini
    //    ham yopib yuborardi. Natijada «Nazad» bitta emas, IKKI oynani
    //    yopardi.
    try {
      window._zoomPrevActive = (typeof activeModal !== 'undefined') ? activeModal : null;
      if (typeof activeModal !== 'undefined') activeModal = '__zoom__';
      window.history.pushState({ modal: '__zoom__' }, '');
      Z._pushed = true;
      if (typeof updateBtns === 'function') updateBtns();
    } catch (e) { Z._pushed = false; }
  };

  /** Qatlamni FAQAT yashiradi (tarixga tegmaydi).
   *  Ilovaning `popstate` handleri aynan shuni chaqiradi. */
  window._closeZoomOverlay = function () {
    if (!Z.el) return;
    Z.el.classList.remove('open');
    Z._pushed = false;
    if (Z.pointers) Z.pointers.clear();
  };

  /** Yopish (× tugmasi, bosish, pastga tortish).
   *  Yagona yo'l: `history.back()` -> ilovaning popstate handleri hal qiladi. */
  function closeZoom() {
    if (!Z.el || !Z.el.classList.contains('open')) return;
    if (Z._pushed) {
      Z._pushed = false;
      try { window.history.back(); return; } catch (e) {}
    }
    window._closeZoomOverlay();
  }
  window.closeZoom = closeZoom;

  /** Tovar oynasidagi rasmga "bosish" (surish EMAS) -> zoom ochiladi. */
  function wireSliderZoom() {
    var slider = document.getElementById('pm-slider-wrapper');
    if (!slider || slider.getAttribute('data-zoom') === '1') return;
    slider.setAttribute('data-zoom', '1');
    var sx = 0, sy = 0, st = 0;
    slider.addEventListener('pointerdown', function (e) {
      sx = e.clientX; sy = e.clientY; st = Date.now();
    });
    slider.addEventListener('pointerup', function (e) {
      // Gorizontal surish (rasmlar orasida o'tish) bilan chalkashmasin
      if (Date.now() - st > 350) return;
      if (Math.abs(e.clientX - sx) > 10 || Math.abs(e.clientY - sy) > 10) return;
      var imgs = slider.querySelectorAll('img');
      if (!imgs.length) return;
      var srcs = [], idx = 0;
      for (var i = 0; i < imgs.length; i++) {
        // Zoom uchun ORIGINAL rasm (data-full), thumbnail emas
        srcs.push(imgs[i].getAttribute('data-full') || imgs[i].src);
        if (imgs[i] === e.target) idx = i;
      }
      // Bosilgan rasm aniqlanmasa — ko'rinib turganini olamiz
      if (e.target && e.target.tagName !== 'IMG') {
        var w = slider.clientWidth || 1;
        idx = Math.round(slider.scrollLeft / w);
      }
      window.openZoom(srcs, idx);
    });
  }

  /* ------------------------------------------------------------------ *
   * 10) ISHGA TUSHIRISH
   * ------------------------------------------------------------------ */
  function boot() {
    try { wireSliderZoom(); } catch (e) {}
    try { syncMyCarShortcut(); } catch (e) {}
    try { window._catDecorateVisible(); } catch (e) {}
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
  // Ma'lumot Firebase'dan kechroq kelishi mumkin — yorliqni yana bir marta
  // tekshiramiz (mashina profil bilan birga yuklanadi).
  setTimeout(boot, 1500);
  setTimeout(syncMyCarShortcut, 4000);
})();
