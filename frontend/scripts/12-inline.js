
(function () {
  'use strict';
  // ⭐ YAGONA MANBA — yangi model qo'shish uchun shu ro'yxatga bitta qator qo'shing.
  var CATALOG_TREE = [
    { brand: 'gaz', title: 'GAZ / VOLGA', sub: 'Gazel, Volga va boshqalar',
      logo: 'https://i.postimg.cc/VLj18zjV/orig-(4).png',
      modelsSection: 'gaz-models', modelsTitle: 'GAZ modellari', chipGroup: '🚛 GAZ / Volga / Sobol',
      models: [
        { slug: 'gazel-biznes', name: 'Gazel Biznes', chip: 'Biznes' },
        { slug: 'gazel-next', name: 'Gazel Next', chip: 'Next' },
        { slug: 'gazel-eski', name: 'Gazel Eski', chip: 'Eski' },
        { slug: 'volga-2401', name: 'Volga 2401', chip: 'V2401' },
        { slug: 'volga-2410', name: 'Volga 2410', chip: 'V2410' },
        { slug: 'volga-3110', name: 'Volga 3110', chip: 'V3110' },
        { slug: 'volga-31105', name: 'Volga 31105', chip: 'V31105' },
        { slug: 'volga-31029', name: 'Volga 31029', chip: 'V31029' },
        { slug: 'sobol', name: 'Sobol', chip: 'Sobol' }
      ] },
    { brand: 'chevrolet', title: 'CHEVROLET', sub: 'Cobalt, Gentra, Spark...',
      logo: 'https://i.postimg.cc/NMgBNSyD/8h0a-Bn9L-1F0s-Hy-WEZSLfnhaqer-Kq-Kxj0Rp-SDjapvv-0z-LWJcn-SH19DCH-In-KOCt-N4s-Wd6Q9b4KGl-NDJp0vc-Ow.png',
      modelsSection: 'chevrolet-models', modelsTitle: 'Chevrolet modellari', chipGroup: '🚘 Chevrolet',
      models: [
        { slug: 'chevy-damas', name: 'Damas', chip: 'Damas' },
        { slug: 'chevy-cobalt', name: 'Cobalt', chip: 'Cobalt' },
        { slug: 'chevy-gentra', name: 'Gentra', chip: 'Gentra' },
        { slug: 'chevy-lacetti', name: 'Lacetti', chip: 'Lacetti' },
        { slug: 'chevy-malibu1', name: 'Malibu 1', chip: 'Malibu 1' },
        { slug: 'chevy-malibu2', name: 'Malibu 2', chip: 'Malibu 2' },
        { slug: 'chevy-tracker2', name: 'Tracker 2', chip: 'Tracker 2' },
        { slug: 'chevy-nexia3', name: 'Nexia 3', chip: 'Nexia 3' },
        { slug: 'chevy-spark', name: 'Spark', chip: 'Spark' },
        { slug: 'chevy-onix', name: 'Onix', chip: 'Onix' },
        { slug: 'chevy-captiva1', name: 'Captiva 1', chip: 'Captiva 1' },
        { slug: 'chevy-captiva2', name: 'Captiva 2', chip: 'Captiva 2' },
        { slug: 'chevy-captiva3', name: 'Captiva 3', chip: 'Captiva 3' },
        { slug: 'chevy-captiva4', name: 'Captiva 4', chip: 'Captiva 4' },
        { slug: 'chevy-labo', name: 'Labo', chip: 'Labo' },
        { slug: 'chevy-matiz', name: 'Matiz', chip: 'Matiz', carName: 'Matiz (Chevy)' },
        { slug: 'chevy-epica', name: 'Epica', chip: 'Epica' }
      ] },
    { brand: 'daewoo', title: 'DAEWOO', sub: 'Nexia, Matiz, Tico',
      logo: 'https://i.postimg.cc/7Y4dS02Y/Daewoo-logo.png',
      modelsSection: 'daewoo-models', modelsTitle: 'Daewoo modellari', chipGroup: '🚕 Daewoo',
      models: [
        { slug: 'daewoo-nexia1', name: 'Nexia 1', chip: 'Nexia 1' },
        { slug: 'daewoo-nexia2', name: 'Nexia 2', chip: 'Nexia 2' },
        { slug: 'daewoo-matiz', name: 'Matiz', chip: 'Matiz' },
        { slug: 'daewoo-tico', name: 'Tico', chip: 'Tico' }
      ] },
    { brand: 'uaz', title: 'UAZ', sub: 'Patriot, Hunter',
      logo: 'https://i.postimg.cc/yxr763cn/orig-(5).png',
      modelsSection: 'uaz-models', modelsTitle: 'UAZ modellari', chipGroup: '🚙 UAZ',
      models: [
        { slug: 'uaz-patriot', name: 'Patriot', chip: 'Patriot' },
        { slug: 'uaz-hunter', name: 'Hunter', chip: 'Hunter' }
      ] }
  ];
  window.CATALOG_TREE = (window.CATALOG_TREE && window.CATALOG_TREE.length) ? window.CATALOG_TREE : CATALOG_TREE;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (ch) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch];
    });
  }

  // slug -> ko'rinadigan nom — TREE dan qayta quriladi (marka/model o'zgarganda yangilanadi)
  function rebuildCarNames(TREE) {
    var CAR = {};
    (TREE || []).forEach(function (b) {
      (b.models || []).forEach(function (m) { CAR[m.slug] = m.carName || m.name; });
    });
    window.CAR_NAMES = CAR;
  }
  rebuildCarNames(window.CATALOG_TREE);

  var CHEVRON = '<div class="luxury-model-arrow"><svg class="uic" aria-hidden="true"><use href="#i-chevron"></use></svg></div>';

  function buildCatalog() {
    var ca = document.getElementById('content-area');
    if (!ca) return;
    var TREE = (window.CATALOG_TREE && window.CATALOG_TREE.length) ? window.CATALOG_TREE : CATALOG_TREE;
    rebuildCarNames(TREE);

    // 1) Brend kartalari
    var bw = document.getElementById('brand-cards-wrap');
    if (bw) {
      // 🍏 iOS 26: ixcham guruhlangan ro'yxat (ilgari har marka katta alohida karta edi)
      bw.innerHTML = '<div class="a1b-list">' + TREE.map(function (b, i) {
        var n = (b.models && b.models.length) || 0;
        return '<div class="a1b-row" role="button" tabindex="0" style="--i:' + i + '" onclick="showSection(\'' + b.modelsSection + '\')" ' +
            'onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();this.click();}">' +
          '<span class="a1b-logo"><img src="' + esc(b.logo) + '" alt="" loading="lazy" decoding="async"></span>' +
          '<span class="a1b-tx"><b>' + esc(b.title) + '</b>' + (b.sub ? '<i>' + esc(b.sub) + '</i>' : '') + '</span>' +
          (n ? '<span class="a1b-n">' + n + '</span>' : '') +
          '<span class="a1b-chev"><svg viewBox="0 0 8 13" aria-hidden="true"><path d="M1.5 1.5 6.5 6.5 1.5 11.5"/></svg></span></div>';
      }).join('') + '</div>';
    }

    // 2) Model ro'yxatlari (#<brand>-models) + mahsulot gridlari (#<slug>-parts)
    TREE.forEach(function (b) {
      var ms = document.getElementById(b.modelsSection);
      if (!ms) {
        ms = document.createElement('div');
        ms.id = b.modelsSection;
        ms.className = 'hidden';
        ms.style.padding = '0 20px';
        ca.appendChild(ms);
      }
      ms.innerHTML = '<div class="section-title" style="margin-top: 0; padding: 0; margin-bottom: 15px;">' + esc(b.modelsTitle) + '</div>' +
        b.models.map(function (m) {
          var thumb = m.img ? '<img class="lux-model-thumb" src="' + esc(m.img) + '" alt="" loading="lazy" onerror="this.style.display=\'none\'">' : '';
          return '<div class="luxury-model-item" role="button" tabindex="0" onclick="showSection(\'' + m.slug + '-parts\')">' +
            '<div style="display:flex; align-items:center; gap:12px; min-width:0; flex:1;">' + thumb + '<h3>' + esc(m.name) + '</h3></div>' +
            CHEVRON + '</div>';
        }).join('');

      b.models.forEach(function (m) {
        var gid = m.slug + '-parts';
        // ⚠️ Faqat MAVJUD bo'lmasa yaratamiz — renderProducts to'ldirgan
        //    gridni O'CHIRIB YUBORMASLIK uchun (idempotent).
        if (!document.getElementById(gid)) {
          var g = document.createElement('div');
          g.id = gid;
          g.className = 'items-grid hidden';
          ca.appendChild(g);
        }
      });
    });

    // 3) Admin kategoriya chip'lari (add + edit modallar)
    var chipsHTML = TREE.map(function (b) {
      return '<div class="apx-sub" style="font-size:12px; color:var(--text-muted); font-weight:bold; margin:12px 0 8px;">' + esc(b.chipGroup) + '</div>' +
        '<div style="display: flex; flex-wrap: wrap; gap: 8px; padding-bottom: 12px; border-bottom: 1px dashed rgba(255,255,255,0.05);">' +
        b.models.map(function (m) {
          return '<span class="cat-chip model-chip" data-val="' + esc(m.slug) + '" onclick="toggleChip(this)">' + esc(m.chip) + '</span>';
        }).join('') + '</div>';
    }).join('');
    var ac = document.getElementById('add-model-chips'); if (ac) ac.innerHTML = chipsHTML;
    var ec = document.getElementById('edit-model-chips'); if (ec) ec.innerHTML = chipsHTML;
  }
  window.buildCatalog = buildCatalog;

  // Darhol quramiz — #<slug>-parts grid'lar renderProducts()dan OLDIN mavjud bo'lishi shart.
  try { buildCatalog(); } catch (e) { try { console.error('buildCatalog xato:', e); } catch (_) {} }
  // Modallar (chip konteynerlari) kechroq parse bo'lgani uchun DOM tayyor bo'lganда qayta quramiz.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { try { buildCatalog(); } catch (e) {} });
  } else {
    try { buildCatalog(); } catch (e) {}
  }
})();
