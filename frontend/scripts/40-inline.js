
(function () {
  'use strict';
  if (window.BrandManager) return;

  function fb() { return (window.firebase && firebase.database) ? firebase.database() : null; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }
  function toast(msg, type) { try { if (typeof showToast === 'function') showToast(msg, type || 'success'); } catch (e) {} }
  function slugify(s) {
    return String(s || '').toLowerCase().trim()
      .replace(/['’`]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40);
  }

  // ---- Firebase <-> TREE konvertatsiya ----
  function fbToTree(obj) {
    if (!obj || typeof obj !== 'object') return null;
    var arr = Object.keys(obj).map(function (k) {
      var b = obj[k] || {};
      var key = b.brand || k;
      var models = [];
      if (b.models && typeof b.models === 'object') {
        models = Object.keys(b.models).map(function (ms) {
          var m = b.models[ms] || {};
          return { slug: ms, name: m.name || ms, chip: m.chip || m.name || ms, carName: m.carName, img: m.img || '', order: (m.order != null ? m.order : 999) };
        }).sort(function (a, b) { return a.order - b.order; });
      }
      return {
        brand: key, title: b.title || key, sub: b.sub || '', logo: b.logo || '',
        modelsSection: key + '-models',
        modelsTitle: b.modelsTitle || ((b.title || key) + ' modellari'),
        chipGroup: b.chipGroup || (b.title || key),
        order: (b.order != null ? b.order : 999),
        models: models
      };
    }).sort(function (a, b) { return a.order - b.order; });
    return arr.length ? arr : null;
  }
  function treeToFb(tree) {
    var obj = {};
    (tree || []).forEach(function (b, bi) {
      var models = {};
      (b.models || []).forEach(function (m, mi) {
        models[m.slug] = { name: m.name, chip: m.chip || m.name, order: mi };
        if (m.carName) models[m.slug].carName = m.carName;
        if (m.img) models[m.slug].img = m.img;
      });
      obj[b.brand] = {
        brand: b.brand, title: b.title, sub: b.sub || '', logo: b.logo || '',
        modelsTitle: b.modelsTitle || (b.title + ' modellari'),
        chipGroup: b.chipGroup || b.title, order: bi, models: models
      };
    });
    return obj;
  }

  function currentTree() {
    return (window.CATALOG_TREE && window.CATALOG_TREE.length) ? window.CATALOG_TREE : [];
  }
  function allSlugs(tree) {
    var s = {};
    (tree || []).forEach(function (b) { (b.models || []).forEach(function (m) { s[m.slug] = true; }); });
    return s;
  }
  function allBrandKeys(tree) {
    var s = {};
    (tree || []).forEach(function (b) { s[b.brand] = true; });
    return s;
  }
  function uniqueKey(base, taken) {
    base = base || 'x';
    var k = base, i = 2;
    while (taken[k]) { k = base + '-' + i; i++; }
    return k;
  }

  var editingKey = null; // null = yangi marka

  // ---- Ro'yxat ----
  function renderList() {
    var box = document.getElementById('bm-list');
    if (!box) return;
    var tree = currentTree();
    if (!tree.length) { box.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:20px;">Hali marka yo\'q. "Yangi marka" bilan qo\'shing.</p>'; return; }
    box.innerHTML = tree.map(function (b) {
      var logo = b.logo
        ? '<img class="bm-logo" src="' + esc(b.logo) + '" alt="" onerror="this.style.display=\'none\'">'
        : '<div class="bm-logo-empty">' + esc((b.title || '?').charAt(0).toUpperCase()) + '</div>';
      var cnt = (b.models || []).length;
      return '<div class="bm-brand-row" role="button" tabindex="0" onclick="BrandManager.openBrandEdit(\'' + esc(b.brand) + '\')">' +
        logo +
        '<div style="flex:1; min-width:0;">' +
          '<div style="font-weight:800; color:#fff; font-size:15px;">' + esc(b.title) + '</div>' +
          '<div style="font-size:12px; color:var(--text-muted); margin-top:2px;">' + cnt + ' ta model</div>' +
        '</div>' +
        '<div style="color:var(--text-muted); font-size:20px;">›</div>' +
      '</div>';
    }).join('');
  }

  // ---- Model qatori ----
  function modelRowHTML(name, slug, img) {
    var thumb = img
      ? '<img src="' + esc(img) + '" alt="" onerror="this.style.display=\'none\'">'
      : '<span class="bm-m-img-plus">＋<i>rasm</i></span>';
    return '<div class="bm-model-row" data-slug="' + esc(slug || '') + '" data-img="' + esc(img || '') + '" style="display:flex; gap:10px; margin-bottom:8px; align-items:center;">' +
      '<label class="bm-m-imgbtn" title="Model rasmi (ixtiyoriy)">' + thumb +
        '<input type="file" accept="image/png,image/jpeg,image/jpg,image/webp,image/heic,image/heif" onchange="BrandManager.uploadModelImg(event, this)" style="position:absolute; inset:0; opacity:0; cursor:pointer;">' +
      '</label>' +
      '<input type="text" class="admin-input bm-m-name" placeholder="Model nomi (mas: Cobalt)" value="' + esc(name || '') + '" style="flex:1;">' +
      '<button type="button" onclick="this.closest(\'.bm-model-row\').remove()" style="background:rgba(255,69,58,0.2); color:#ff453a; border:1px solid rgba(255,69,58,0.5); border-radius:10px; padding:0 14px; height:46px; cursor:pointer; font-weight:bold; font-size:16px; flex-shrink:0;">×</button>' +
    '</div>';
  }

  var BrandManager = {
    open: function () {
      renderList();
      if (typeof openModal === 'function') openModal('brandManagerModal');
    },

    openBrandEdit: function (brandKey) {
      editingKey = brandKey || null;
      var tree = currentTree();
      var b = brandKey ? tree.filter(function (x) { return x.brand === brandKey; })[0] : null;

      var titleEl = document.getElementById('bm-edit-title');
      if (titleEl) titleEl.textContent = b ? ('Tahrirlash: ' + b.title) : 'Yangi marka';
      var t = document.getElementById('bm-title'); if (t) t.value = b ? (b.title || '') : '';
      var lu = document.getElementById('bm-logo-url'); if (lu) lu.value = b ? (b.logo || '') : '';
      var upt = document.getElementById('bm-logo-uptext'); if (upt) upt.textContent = 'Emblema rasm yuklash';
      this.renderLogoPreview();

      var mb = document.getElementById('bm-models');
      if (mb) {
        if (b && b.models && b.models.length) {
          mb.innerHTML = b.models.map(function (m) { return modelRowHTML(m.name, m.slug, m.img); }).join('');
        } else {
          mb.innerHTML = modelRowHTML('', '', '');
        }
      }
      var del = document.getElementById('bm-delete-btn');
      if (del) del.style.display = b ? 'block' : 'none';

      if (typeof openModal === 'function') openModal('brandEditModal');
    },

    addModelRow: function () {
      var mb = document.getElementById('bm-models');
      if (mb) mb.insertAdjacentHTML('beforeend', modelRowHTML('', '', ''));
    },

    renderLogoPreview: function () {
      var url = (document.getElementById('bm-logo-url') || {}).value || '';
      var box = document.getElementById('bm-logo-preview');
      if (!box) return;
      box.innerHTML = url
        ? '<img src="' + esc(url) + '" alt="" style="width:76px; height:76px; object-fit:contain; background:rgba(255,255,255,0.06); border:1px solid var(--glass-border); border-radius:16px; padding:8px;" onerror="this.style.display=\'none\'">'
        : '';
    },

    uploadLogo: function (event) {
      var file = event.target && event.target.files && event.target.files[0];
      event.target.value = '';
      if (!file) return;
      if (typeof uploadFileWithProgress !== 'function') { toast('Yuklash moduli topilmadi', 'warning'); return; }
      var upt = document.getElementById('bm-logo-uptext');
      if (upt) upt.textContent = 'Yuklanmoqda… 0%';
      uploadFileWithProgress(file, function (pct) { if (upt) upt.textContent = 'Yuklanmoqda… ' + pct + '%'; })
        .then(function (url) {
          var lu = document.getElementById('bm-logo-url'); if (lu) lu.value = url;
          if (upt) upt.textContent = '✅ Emblema yuklandi';
          BrandManager.renderLogoPreview();
          toast('Emblema yuklandi', 'success');
        })
        .catch(function (err) {
          if (upt) upt.textContent = 'Emblema rasm yuklash';
          toast((err && err.message) ? err.message : 'Yuklash xatosi', 'warning');
        });
    },

    uploadModelImg: function (event, inputEl) {
      var file = event.target && event.target.files && event.target.files[0];
      event.target.value = '';
      if (!file) return;
      if (typeof uploadFileWithProgress !== 'function') { toast('Yuklash moduli topilmadi', 'warning'); return; }
      var row = inputEl.closest('.bm-model-row');
      var btn = inputEl.closest('.bm-m-imgbtn');
      var setThumb = function (html) {
        if (!btn) return;
        var inp = btn.querySelector('input');   // file input'ni saqlab qolamiz
        btn.innerHTML = html;
        if (inp) btn.appendChild(inp);
      };
      setThumb('<span class="bm-m-img-plus" style="font-size:11px;">…</span>');
      uploadFileWithProgress(file).then(function (url) {
        if (row) row.setAttribute('data-img', url);
        setThumb('<img src="' + esc(url) + '" alt="">');
        toast('Rasm yuklandi', 'success');
      }).catch(function (err) {
        setThumb('<span class="bm-m-img-plus">＋<i>rasm</i></span>');
        toast((err && err.message) ? err.message : 'Yuklash xatosi', 'warning');
      });
    },

    saveBrand: function () {
      var title = ((document.getElementById('bm-title') || {}).value || '').trim();
      var logo = ((document.getElementById('bm-logo-url') || {}).value || '').trim();
      if (!title) { toast('Marka nomini kiriting', 'warning'); return; }

      // Klon (JSON deep copy) — yozish muvaffaqiyatli bo'lmaguncha jonli TREE ga tegmaymiz
      var tree = JSON.parse(JSON.stringify(currentTree()));
      var takenBrandKeys = allBrandKeys(tree);
      var takenSlugs = allSlugs(tree);

      var brandKey = editingKey;
      if (!brandKey) {
        // Yangi marka — noyob kalit
        delete takenBrandKeys[slugify(title)];
        brandKey = uniqueKey(slugify(title) || 'marka', allBrandKeys(tree));
      }

      // Model qatorlarini o'qiymiz
      var rows = Array.prototype.slice.call(document.querySelectorAll('#bm-models .bm-model-row'));
      var models = [];
      var seen = {};
      for (var i = 0; i < rows.length; i++) {
        var nm = (rows[i].querySelector('.bm-m-name').value || '').trim();
        if (!nm) continue; // bo'sh qatorni tashlab yuboramiz
        var mImg = (rows[i].getAttribute('data-img') || '').trim();
        var slug = (rows[i].getAttribute('data-slug') || '').trim();
        if (!slug) {
          // Yangi model — brandKey asosida noyob slug
          var base = brandKey + '-' + (slugify(nm) || 'model');
          slug = uniqueKey(base, mergeTaken(takenSlugs, seen));
        }
        if (seen[slug]) continue; // dublikatni o'tkazib yuboramiz
        seen[slug] = true;
        // "chip" (qisqa yorliq) endi alohida maydon emas — nomdan olinadi.
        var mObj = { slug: slug, name: nm, chip: nm };
        if (mImg) mObj.img = mImg;
        models.push(mObj);
      }
      if (!models.length) { toast('Kamida 1 ta model kiriting', 'warning'); return; }

      // 🏷 Izoh (brend kartasi ostidagi matn) — model nomlaridan AVTOMATIK.
      var sub = models.slice(0, 3).map(function (m) { return m.name; }).join(', ') + (models.length > 3 ? '...' : '');

      var brandObj = {
        brand: brandKey, title: title, sub: sub, logo: logo,
        modelsSection: brandKey + '-models',
        modelsTitle: title + ' modellari',
        chipGroup: title,
        models: models
      };

      // Klonga qo'shamiz/almashtiramiz
      var idx = -1;
      for (var j = 0; j < tree.length; j++) { if (tree[j].brand === brandKey) { idx = j; break; } }
      if (idx >= 0) { brandObj.order = idx; tree[idx] = brandObj; }
      else { brandObj.order = tree.length; tree.push(brandObj); }

      var database = fb();
      if (!database) { toast('Internetni tekshiring', 'warning'); return; }

      database.ref('catalog').set(treeToFb(tree))
        .then(function () {
          toast('✅ Saqlandi', 'success');
          // Listener ham yangilaydi; darhol ko'rsatish uchun mahalliy ham qo'llaymiz
          window.CATALOG_TREE = tree;
          if (window.buildCatalog) window.buildCatalog();
          try { if (typeof renderProducts === 'function') renderProducts(); } catch (e) {}
          renderList();
          if (typeof closeModal === 'function') closeModal();
        })
        .catch(function (err) {
          if (err && (err.code === 'PERMISSION_DENIED' || /permission/i.test(err.message || ''))) {
            toast('Ruxsat yo\'q — Firebase qoidalarini joriy qiling (deploy-rules)', 'warning');
          } else {
            toast('Saqlashda xato. Qayta urinib ko\'ring.', 'warning');
          }
        });
    },

    deleteBrand: function () {
      if (!editingKey) return;
      var doDelete = function () {
        var tree = JSON.parse(JSON.stringify(currentTree())).filter(function (b) { return b.brand !== editingKey; });
        var database = fb();
        if (!database) { toast('Internetni tekshiring', 'warning'); return; }
        database.ref('catalog').set(treeToFb(tree))
          .then(function () {
            toast('Marka o\'chirildi', 'success');
            window.CATALOG_TREE = tree;
            if (window.buildCatalog) window.buildCatalog();
            try { if (typeof renderProducts === 'function') renderProducts(); } catch (e) {}
            renderList();
            if (typeof closeModal === 'function') closeModal();
          })
          .catch(function (err) {
            if (err && (err.code === 'PERMISSION_DENIED' || /permission/i.test(err.message || ''))) {
              toast('Ruxsat yo\'q — Firebase qoidalarini joriy qiling', 'warning');
            } else { toast('O\'chirishda xato', 'warning'); }
          });
      };
      try {
        if (window.tg && tg.showConfirm) {
          tg.showConfirm('Bu markani va uning modellarini katalogdan o\'chirasizmi? (Tovarlar bazada qoladi)', function (ok) { if (ok) doDelete(); });
        } else if (confirm('Bu markani o\'chirasizmi?')) { doDelete(); }
      } catch (e) { doDelete(); }
    }
  };

  function mergeTaken(a, b) { var o = {}; for (var k in a) o[k] = true; for (var j in b) o[j] = true; return o; }

  window.BrandManager = BrandManager;

  // ---- Firebase 'catalog' listener: admin o'zgartirsa hammada darhol yangilanadi ----
  function startCatalogListener() {
    var database = fb();
    if (!database) { setTimeout(startCatalogListener, 500); return; }
    try {
      database.ref('catalog').on('value', function (snap) {
        try {
          var t = fbToTree(snap.val());
          if (t && t.length) {
            window.CATALOG_TREE = t;
            if (window.buildCatalog) window.buildCatalog();
            try { if (typeof renderProducts === 'function') renderProducts(); } catch (e) {}
          }
        } catch (e) {}
      }, function (err) {
        // Ruxsat yo'q yoki tarmoq — SEED (hardcoded CATALOG_TREE) bilan davom etamiz.
      });
    } catch (e) {}
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startCatalogListener);
  } else {
    startCatalogListener();
  }
})();
