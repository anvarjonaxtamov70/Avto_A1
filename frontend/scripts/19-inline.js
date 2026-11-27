
  // 🔎 5/9 — QIDIRUV natijasi uchun SARALASH + FILTR mexanizmi
  (function searchFilterSort(){
    // Holat (faqat qidiruv natijasiga ta'sir qiladi)
    window._sfsState = window._sfsState || { sort: 'relevance', instock: false, discount: false };

    // — Tovardan narx/stok/reytingni xavfsiz olish (oddiy + razmerli) —
    function priceOf(p){
      if (p.product_type === 'razmerli' && Array.isArray(p.sizes) && p.sizes.length){
        var nums = p.sizes.map(function(s){ return Number(s.price); }).filter(function(n){ return n > 0; });
        if (nums.length) return Math.min.apply(null, nums);
      }
      return Number(p.price) || 0;
    }
    function stockOf(p){
      if (p.product_type === 'razmerli' && Array.isArray(p.sizes)){
        return p.sizes.reduce(function(a,s){ return a + (parseInt(s.stock) || 0); }, 0);
      }
      return (p.stock !== undefined ? Number(p.stock) : 10);
    }
    function ratingOf(p){
      var r = (window.productRatings && window.productRatings[p.id]) ? window.productRatings[p.id] : null;
      return r ? (Number(r.avg) || 0) : (parseFloat(p.rating) || 0);
    }
    function hasDiscount(p){
      return p.oldPrice && Number(p.oldPrice) > Number(p.price);
    }
    function createdOf(p){
      // Yangi-eski: aniq sana bo'lsa ishlatamiz, bo'lmasa id (kattaroq id = yangiroq)
      return Number(p.createdAt || p.created_at || p.ts || p.id) || 0;
    }

    window._sfsHasActiveFilters = function(){
      var s = window._sfsState;
      return !!(s.instock || s.discount);
    };
    window._sfsIsDefault = function(){
      var s = window._sfsState;
      return s.sort === 'relevance' && !s.instock && !s.discount;
    };

    // — Filtr + STABIL saralashni natija massiviga qo'llash —
    window._sfsApply = function(items){
      if (!Array.isArray(items)) return items;
      var s = window._sfsState;
      var out = items.filter(function(p){
        if (s.instock && stockOf(p) <= 0) return false;
        if (s.discount && !hasDiscount(p)) return false;
        return true;
      });
      if (s.sort !== 'relevance'){
        // Stabil saralash: asl tartibni indeks bilan saqlaymiz (teng qiymatда sakramaydi)
        out = out.map(function(p, i){ return { p: p, i: i }; });
        out.sort(function(a, b){
          var d = 0;
          if (s.sort === 'price-asc')  d = priceOf(a.p) - priceOf(b.p);
          else if (s.sort === 'price-desc') d = priceOf(b.p) - priceOf(a.p);
          else if (s.sort === 'rating') d = ratingOf(b.p) - ratingOf(a.p);
          else if (s.sort === 'new')    d = createdOf(b.p) - createdOf(a.p);
          return d !== 0 ? d : (a.i - b.i);
        });
        out = out.map(function(o){ return o.p; });
      }
      return out;
    };

    // — Toolbar'ni bir marta qurish (idempotent) —
    function buildToolbar(){
      var results = document.getElementById('search-results');
      if (!results) return null;
      var bar = document.getElementById('sfs-toolbar');
      if (bar) return bar;

      bar = document.createElement('div');
      bar.id = 'sfs-toolbar';
      bar.innerHTML =
        '<div class="sfs-row">' +
          '<span class="sfs-count" id="sfs-count"></span>' +
          '<span class="sfs-sort-wrap">' +
            '<svg class="ico" viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M3 18h6v-2H3v2zM3 6v2h18V6H3zm0 7h12v-2H3v2z"/></svg>' +
            '<select id="sfs-sort" aria-label="Saralash" onchange="window._sfsSetSort(this.value)">' +
              '<option value="relevance">Moslik bo\'yicha</option>' +
              '<option value="price-asc">Avval arzoni</option>' +
              '<option value="price-desc">Avval qimmati</option>' +
              '<option value="rating">Reyting bo\'yicha</option>' +
              '<option value="new">Avval yangisi</option>' +
            '</select>' +
          '</span>' +
        '</div>' +
        '<div class="sfs-row">' +
          '<div class="sfs-chips">' +
            '<span class="sfs-chip" id="sfs-chip-instock" onclick="window._sfsToggle(\'instock\')">' +
              '<svg class="ico" viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg> Sotuvda bor</span>' +
            '<span class="sfs-chip" id="sfs-chip-discount" onclick="window._sfsToggle(\'discount\')">' +
              '<svg class="ico" viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M12.79 21L3 11.21v2c0 .53.21 1.04.59 1.41l7.79 7.79c.78.78 2.05.78 2.83 0l6.21-6.21c.78-.78.78-2.05 0-2.83L12.79 21zm-.71-2.41l6.21-6.21-9.18-9.18C8.74 3.02 8.23 2.81 7.7 2.81h-5c-1.1 0-2 .9-2 2v5c0 .53.21 1.04.59 1.42l9.79 9.36zM4.2 5.71c0-.55.45-1 1-1s1 .45 1 1-.45 1-1 1-1-.45-1-1z"/></svg> Chegirmali</span>' +
          '</div>' +
          '<button class="sfs-reset" id="sfs-reset" onclick="window._sfsReset()">' +
            '<svg class="ico" viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true"><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/></svg> Tozalash</button>' +
        '</div>';
      // #search-results dan oldin joylaymiz (panel natija ustida turadi)
      results.parentNode.insertBefore(bar, results);
      return bar;
    }

    // — Toolbar ko'rinishi va matnlarini natija holatiga moslash —
    // visible: qidiruv aktiv va so'rov bo'sh emasmi; matched: filtrgacha topilgan; shown: filtrdan keyin ko'rinadigan
    window._sfsSyncToolbar = function(visible, matched, shown){
      var bar = buildToolbar();
      if (!bar) return;
      if (!visible){ bar.classList.remove('show'); return; }
      bar.classList.add('show');

      var sel = document.getElementById('sfs-sort');
      if (sel && sel.value !== window._sfsState.sort) sel.value = window._sfsState.sort;

      var ci = document.getElementById('sfs-chip-instock');
      var cd = document.getElementById('sfs-chip-discount');
      if (ci) ci.classList.toggle('active', window._sfsState.instock);
      if (cd) cd.classList.toggle('active', window._sfsState.discount);

      var cnt = document.getElementById('sfs-count');
      if (cnt){
        if (window._sfsHasActiveFilters() && shown !== matched){
          cnt.innerHTML = '<b>' + shown + '</b> / ' + matched + ' ta';
        } else {
          cnt.innerHTML = '<b>' + shown + '</b> ta topildi';
        }
      }
      var rb = document.getElementById('sfs-reset');
      if (rb) rb.classList.toggle('show', !window._sfsIsDefault());
    };

    // — Foydalanuvchi amallari: qayta qidiruvni chaqirib jonli yangilaydi —
    function rerun(){
      if (typeof window.searchProducts === 'function') window.searchProducts();
    }
    window._sfsSetSort = function(v){
      window._sfsState.sort = v || 'relevance';
      if (typeof window._hap === 'function') window._hap('light');
      rerun();
    };
    window._sfsToggle = function(key){
      window._sfsState[key] = !window._sfsState[key];
      if (typeof window._hap === 'function') window._hap('light');
      rerun();
    };
    window._sfsReset = function(){
      window._sfsState = { sort: 'relevance', instock: false, discount: false };
      var sel = document.getElementById('sfs-sort');
      if (sel) sel.value = 'relevance';
      rerun();
    };

    // Toolbar'ni oldindan tayyorlab qo'yamiz (DOM tayyor bo'lsa)
    if (document.readyState === 'loading'){
      document.addEventListener('DOMContentLoaded', buildToolbar);
    } else {
      buildToolbar();
    }
  })();
