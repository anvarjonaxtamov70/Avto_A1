
/* ═══════════════════════════════════════════════════════════════════
   iOS 26 · Avto A1 — Tovar qo'shish / Tahrirlash (#addProductModal, #editModal)
   Eski funksiyalar (saqlash, yuklash, AI, ovoz, skaner) o'zgarmaydi —
   bu qatlam faqat ko'rinishni boshqaradi: segmentlar, flash kaliti,
   rasm plitkalari, jonli ko'rinish va kategoriya sanog'i.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
    'use strict';
    var $ = function (id) { return document.getElementById(id); };
    var MODAL = { add: 'addProductModal', edit: 'editModal' };
    var hap = function (k) { try { if (typeof window._hap === 'function') window._hap(k || 'selection'); } catch (e) {} };
    var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
    var num = function (v) { return (typeof window.parsePrice === 'function') ? window.parsePrice(v) : (parseInt(String(v || '').replace(/[^\d]/g, ''), 10) || 0); };
    var fmt = function (n) { return String(Math.round(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); };
    var urls = function (k) { try { return window.readImgUrls(k); } catch (e) { return []; } };
    var ph = function (t) { try { return window._brandPlaceholder(t); } catch (e) { return ''; } };
    var dirty = function () { window._formDirty = true; };
    var SV = function (d, w) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (w || 2) + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>'; };
    var IC = {
        x: SV('<path d="M7 7l10 10M17 7L7 17"/>', 2.8),
        star: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 3.2l2.6 5.5 6 .8-4.4 4.1 1.1 5.9L12 16.6l-5.3 2.9 1.1-5.9-4.4-4.1 6-.8z"/></svg>',
        flame: SV('<path d="M12 22c4.4 0 7-2.9 7-6.8 0-3.9-2.6-6.4-4.4-8.7-.4 2-1.4 3.2-2.6 3.8C12 7 10.6 4.3 8.4 2.5 8.6 6 5 8.7 5 14.9 5 19 7.6 22 12 22z"/>', 2.2),
        warn: SV('<path d="M12 3l9.5 17h-19z"/><path d="M12 10v4.5M12 17.5v.01"/>', 2.2)
    };

    /* ── Segment boshqaruvi (yashirin <select> bilan sinxron) ── */
    function syncSegs(k) {
        var m = $(MODAL[k]); if (!m) return;
        m.querySelectorAll('.tf-seg[data-for]').forEach(function (seg) {
            var sel = $(seg.getAttribute('data-for')); if (!sel) return;
            seg.querySelectorAll('button[data-v]').forEach(function (b) {
                var on = b.getAttribute('data-v') === sel.value;
                b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false');
            });
        });
    }
    document.addEventListener('click', function (e) {
        var b = e.target.closest && e.target.closest('.tf-seg[data-for] button[data-v]'); if (!b) return;
        var seg = b.parentElement, sel = $(seg.getAttribute('data-for')); if (!sel) return;
        if (sel.value !== b.getAttribute('data-v')) {
            sel.value = b.getAttribute('data-v');
            sel.dispatchEvent(new Event('change', { bubbles: true }));
            dirty(); hap('selection');
        }
        var k = seg.closest('#editModal') ? 'edit' : 'add';
        syncSegs(k);
    });

    /* ── Qoldiq stepper ── */
    window.tfStep = function (id, d) {
        var i = $(id); if (!i) return;
        var v = Math.max(0, (parseInt(i.value, 10) || 0) + d);
        i.value = v; i.dispatchEvent(new Event('input', { bubbles: true })); hap('selection');
    };

    /* ── Flash chegirma kaliti ── */
    function flashEls(k) { return { card: $(k + '-tf-flash'), sw: $(k + '-tf-flash-sw'), fp: $(k + '-flash-price'), fh: $(k + '-flash-hours') }; }
    window.tfFlash = function (k, on) {
        var f = flashEls(k); if (!f.card) return;
        f.card.classList.toggle('on', !!on);
        if (on) {
            if (f.fh && !f.fh.value) f.fh.value = 24;
            setTimeout(function () { try { f.fp && f.fp.focus({ preventScroll: true }); } catch (e) {} }, 260);
        } else { if (f.fp) f.fp.value = ''; if (f.fh) f.fh.value = ''; }
        tfHoursSync(k); dirty(); hap('light');
        window.updateLivePreview && window.updateLivePreview(k);
    };
    window.tfHours = function (k, h) {
        var f = flashEls(k); if (!f.fh) return;
        f.fh.value = h; tfHoursSync(k); dirty(); hap('selection');
    };
    function tfHoursSync(k) {
        var f = flashEls(k), box = $(k + '-tf-hours'); if (!box || !f.fh) return;
        var v = parseFloat(String(f.fh.value).replace(',', '.')) || 0;
        box.querySelectorAll('.tf-pill').forEach(function (p) { p.classList.toggle('on', Number(p.getAttribute('data-h')) === v); });
    }
    window.tfHoursSync = tfHoursSync;
    function syncFlash(k) {
        var f = flashEls(k); if (!f.sw) return;
        var on = !!((f.fp && f.fp.value.trim()) || (f.fh && f.fh.value.trim()));
        f.sw.checked = on; f.card.classList.toggle('on', on); tfHoursSync(k);
    }

    /* ── Ishlab chiqarilgan joy — inline uslublarni olib tashlaymiz ── */
    var origSelectOrigin = window.selectOrigin;
    if (typeof origSelectOrigin === 'function' && !origSelectOrigin.__tf) {
        window.selectOrigin = function (el, type) {
            var r = origSelectOrigin.apply(this, arguments);
            var box = $(type + '-origin-chips');
            if (box && box.classList.contains('tf-seg')) box.querySelectorAll('.origin-chip').forEach(function (c) { c.removeAttribute('style'); });
            return r;
        };
        window.selectOrigin.__tf = 1;
    }

    /* ── Rasm plitkalari ── */
    function photosState(k) {
        var wrap = $(k + '-tf-photos'), box = $(k + '-img-previews'); if (!wrap || !box) return;
        var n = box.children.length;
        wrap.classList.toggle('is-empty', n === 0);
        wrap.classList.toggle('is-full', urls(k).length >= 3 && !box.querySelector('.up-prog'));
    }
    window.updateImgPreviews = function (k) {
        var list = urls(k), box = $(k + '-img-previews');
        if (box) {
            box.innerHTML = list.map(function (u, i) {
                var main = i === 0;
                return '<div class="tf-thumb' + (main ? ' is-main' : '') + '">' +
                    '<button type="button" class="tf-thumb-img" ' + (main ? 'aria-label="Asosiy rasm"' : 'onclick="setMainImg(\'' + k + '\',' + i + ')" aria-label="Asosiy qilish"') + '>' +
                    '<img src="' + esc(u) + '" alt="" loading="lazy" onerror="this.closest(\'.tf-thumb\').classList.add(\'is-bad\');this.src=window._brandPlaceholder(\'Xato\')"></button>' +
                    (main ? '<span class="tf-badge">' + IC.star + 'Asosiy</span>' : '<span class="tf-badge tf-badge-n">' + (i + 1) + '</span>') +
                    '<button type="button" class="tf-del" onclick="removeImg(\'' + k + '\',' + i + ')" aria-label="Rasmni o\u2018chirish">' + IC.x + '</button>' +
                    '</div>';
            }).join('');
        }
        photosState(k);
        if (typeof window.updateLivePreview === 'function') window.updateLivePreview(k);
    };
    ['add', 'edit'].forEach(function (k) {
        var box = $(k + '-img-previews');
        if (box && window.MutationObserver) new MutationObserver(function () { photosState(k); }).observe(box, { childList: true });
    });

    /* ── Jonli ko'rinish (mijoz kartasi) ── */
    window.updateLivePreview = function (k) {
        var box = $(k + '-live-preview'); if (!box) return;
        var v = function (id) { var e = $(k + '-' + id); return e ? e.value.trim() : ''; };
        var name = v('name'), price = num(v('price')), code = v('code'), img = urls(k)[0] || '';
        var fp = num(v('flash-price')), fh = parseFloat(String(v('flash-hours')).replace(',', '.')) || 0;
        if (!name && !price && !img) {
            box.innerHTML = '<div class="tf-pv-empty"><span>' + SV('<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>', 1.8) + '</span>Rasm, nom va narxni kiriting — mijozga qanday ko\u2018rinishi shu yerda chiqadi</div>';
            return;
        }
        var flashOk = fp > 0 && price > 0 && fp < price && fh > 0;
        var flashBad = fp > 0 && price > 0 && fp >= price;
        var pct = flashOk ? Math.round((1 - fp / price) * 100) : 0;
        var mainName = (name || 'Tovar nomi').split('\u00b7')[0].trim();
        box.innerHTML =
            '<div class="tf-pv">' +
                '<div class="tf-pv-img"><img src="' + esc(img || ph('Rasm')) + '" alt="" onerror="this.src=window._brandPlaceholder(\'Rasm\')">' +
                    (flashOk ? '<span class="tf-pv-pct">\u2212' + pct + '%</span>' : '') + '</div>' +
                '<div class="tf-pv-tx">' +
                    '<b' + (name ? '' : ' class="dim"') + '>' + esc(mainName) + '</b>' +
                    (code ? '<span class="tf-pv-code">' + esc(code) + '</span>' : '') +
                    '<div class="tf-pv-pr">' +
                        (flashOk ? '<strong class="hot">' + fmt(fp) + ' so\u2018m</strong><s>' + fmt(price) + '</s>' : '<strong>' + fmt(price) + ' so\u2018m</strong>') +
                    '</div>' +
                    (flashOk ? '<span class="tf-pv-timer">' + IC.flame + fmt(fh) + ' soat davomida</span>' : '') +
                    (flashBad ? '<span class="tf-pv-warn">' + IC.warn + 'Flash narx asl narxdan kam bo\u2018lishi kerak</span>' : '') +
                '</div>' +
            '</div>';
    };

    /* ── Kategoriya sanog'i ── */
    function syncCats(k) {
        var box = $(k + '-model-chips'), out = $(k + '-tf-catn'); if (!box || !out) return;
        var n = box.querySelectorAll('.model-chip.selected').length;
        out.textContent = n ? n + ' ta tanlandi' : '';
    }
    ['add', 'edit'].forEach(function (k) {
        var box = $(k + '-model-chips'); if (!box) return;
        box.addEventListener('click', function (e) {
            if (!e.target.closest('.model-chip')) return;
            setTimeout(function () { syncCats(k); }, 0); dirty(); hap('selection');
        });
    });

    /* ── Hammasini sinxronlash ── */
    var stripEmoji = function (s) { return String(s || '').replace(/[\u2600-\u27BF\uFE0F\u200D]|[\uD83C-\uDBFF][\uDC00-\uDFFF]/g, '').replace(/\s+/g, ' ').trim(); };
    function tidy(k) {
        // Kategoriya guruh nomlaridagi emoji (ba'zi qurilmalarda «▯» bo'lib chiqadi) olib tashlanadi
        document.querySelectorAll('#' + k + '-model-chips .apx-sub').forEach(function (h) { var t = stripEmoji(h.textContent); if (t !== h.textContent) h.textContent = t; });
        // Razmer qatorlari — qisqa, kesilmaydigan placeholderlar
        document.querySelectorAll('#' + MODAL[k] + ' .tf-sizes .size-input-row').forEach(function (r) {
            var a = r.querySelector('.size-name'), b = r.querySelector('.size-stock');
            if (a) a.setAttribute('placeholder', 'mas: 92.5'); if (b) b.setAttribute('placeholder', '0');
        });
    }
    function sync(k) {
        syncSegs(k); syncFlash(k); photosState(k); syncCats(k); tidy(k);
        var box = $(k + '-origin-chips'); if (box) box.querySelectorAll('.origin-chip').forEach(function (c) { c.removeAttribute('style'); });
    }
    function toTop(k) { var m = $(MODAL[k]); if (m) m.scrollTop = 0; }
    window.tfSync = sync;

    function wrap(name, after) {
        var f = window[name];
        if (typeof f !== 'function' || f.__tf) return;
        var w = function () { var r = f.apply(this, arguments); try { after.apply(this, arguments); } catch (e) {} return r; };
        w.__tf = 1; window[name] = w;
    }
    function install() {
        wrap('resetAddForm', function () { sync('add'); });
        wrap('fillAddFormFromProduct', function () { sync('add'); });
        wrap('openAddProduct', function () { sync('add'); toTop('add'); });
        wrap('cloneProductFromEdit', function () { sync('add'); toTop('add'); });
        wrap('addSizeField', function () { tidy('add'); });
        wrap('addEditSizeField', function () { tidy('edit'); });
        wrap('buildCatalog', function () { tidy('add'); tidy('edit'); });
        wrap('toggleProductTypeFields', function () { syncSegs('add'); });
        wrap('toggleEditProductTypeFields', function () { syncSegs('edit'); });
        wrap('openEditModal', function () {
            var idEl = $('edit-id'), id = idEl ? idEl.value : '';
            var list = (typeof productsDB !== 'undefined' && Array.isArray(productsDB)) ? productsDB : (window.productsDB || []);
            var p = list.find(function (x) { return String(x.id) === String(id); });
            // Birlik ilgari tahrirlashda yuklanmas edi — endi tovarniki tiklanadi
            var u = $('edit-unit'); if (u && p) u.value = p.unit === 'komplekt' ? 'komplekt' : 'dona';
            var sub = $('edit-tf-sub');
            if (sub) sub.textContent = p ? ((p.is_draft ? 'Qoralama' : 'Katalogda') + (p.code ? ' \u00b7 ' + p.code : '') + ' \u00b7 ID ' + p.id) : 'O\u2018zgartiring va saqlang';
            sync('edit'); toTop('edit');
            window._formDirty = false;
        });
    }
    install();
    window.addEventListener('load', function () { install(); sync('add'); sync('edit'); });
    sync('add'); sync('edit');
    try { window.updateLivePreview('add'); } catch (e) {}
})();

/* ── Tovar oynasi: galereya balandligi rasm nisbatiga moslanadi (Uzum uslubi) ── */
(function () {
    function fit() {
        var M = document.getElementById('productModal'); if (!M) return;
        var hd = M.querySelector('.pm-img-header'); if (!hd) return;
        var im = M.querySelector('.a7-slide img:not(.a1-ph)') || M.querySelector('.a7-slide img');
        var W = hd.clientWidth || window.innerWidth;
        var set = function (img) {
            if (!img || !img.naturalWidth) return false;
            var h = W * img.naturalHeight / img.naturalWidth;
            h = Math.max(W * 0.62, Math.min(h, W * 1.45, window.innerHeight * 0.78));
            hd.style.setProperty('--a1-gh', Math.round(h) + 'px');
            return true;
        };
        hd.style.setProperty('--a1-gh', Math.round(Math.min(W, window.innerHeight * 0.78)) + 'px');
        M.querySelectorAll('.a7-slide:first-child img').forEach(function (x) {
            if (!set(x)) x.addEventListener('load', function () { set(x); }, { once: true });
        });
        void im;
    }
    function wrap() {
        var o = window.openProduct;
        if (typeof o !== 'function' || o.__a1gh) return;
        var w = function () { var r = o.apply(this, arguments); try { fit(); setTimeout(fit, 60); } catch (e) {} return r; };
        w.__a1gh = 1; for (var k in o) { try { w[k] = o[k]; } catch (e) {} } window.openProduct = w;
    }
    wrap(); window.addEventListener('load', function () { wrap(); setTimeout(wrap, 1500); });
    window.addEventListener('resize', fit);
})();

/* ── Android ilova (APK): kirish ekrani matni va belgisi ── */
(function () {
    if (!window.A1_APP) return;
    var ls = document.getElementById('login-screen'); if (!ls || ls.__a1app) return; ls.__a1app = 1;
    var brand = document.createElement('div'); brand.className = 'a1-app-brand';
    brand.innerHTML = '<i>A1</i><b>Avto A1<svg viewBox="0 0 24 24" aria-label="Rasmiy do\u2018kon"><path fill="currentColor" d="M12 1.5l2.6 1.9 3.2-.1 1 3 2.6 1.9-1 3.1 1 3.1-2.6 1.9-1 3-3.2-.1L12 22.5l-2.6-1.9-3.2.1-1-3-2.6-1.9 1-3.1-1-3.1 2.6-1.9 1-3 3.2.1z"/><path d="M7.8 12.3l2.8 2.8 5.6-5.8" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></b><span>Ehtiyot qismlar do\u2018koni</span>';
    ls.insertBefore(brand, ls.firstChild);
    var t = ls.querySelector('.login-title'); if (t) t.textContent = 'Ro\u2018yxatdan o\u2018tish';
    var sub = ls.querySelector('.login-sub'); if (sub) sub.textContent = 'Ism va telefon raqamingizni kiriting \u2014 buyurtmalar, keshbek va yetkazib berish shu raqamga bog\u2018lanadi.';
    var btn = document.getElementById('login-submit-btn'); if (btn && !btn.dataset.busy) btn.textContent = 'Davom etish';
})();

