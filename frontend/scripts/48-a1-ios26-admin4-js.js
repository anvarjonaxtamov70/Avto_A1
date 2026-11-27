
(function () {
    'use strict';
    var $ = function (id) { return document.getElementById(id); };
    var SV = function (d, w) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (w || 2) + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>'; };
    var IC = {
        x: SV('<path d="M6 6l12 12M18 6L6 18"/>', 2.6),
        back: SV('<path d="M15 5l-7 7 7 7"/>', 2.6),
        tag: SV('<path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.6" cy="7.6" r="1.4"/>', 2),
        pct: SV('<path d="M19 5L5 19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>', 2.2),
        undo: SV('<path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>', 2),
        search: SV('<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>', 2.2),
        box: SV('<path d="M21 8l-9-5-9 5 9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/>', 1.7),
        plus: SV('<path d="M12 5v14M5 12h14"/>', 2.8),
        minus: SV('<path d="M6 12h12"/>', 3),
        image: SV('<rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="8.5" cy="8.5" r="1.6"/><path d="M21 15l-5-5L5 21"/>', 1.8),
        camera: SV('<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>', 2.2),
        check: SV('<path d="M5 12.5l4.5 4.5L19 7.5"/>', 2.6),
        eye: SV('<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>', 2),
        trash: SV('<path d="M4 7h16M10 11v6M14 11v6M5.5 7l1 12.5a2 2 0 0 0 2 1.5h7a2 2 0 0 0 2-1.5L18.5 7M9 7V4.5h6V7"/>', 2),
        play: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15l13-7.5z"/></svg>',
        video: SV('<rect x="3" y="6" width="13" height="12" rx="3"/><path d="M16 10.5l5-3v9l-5-3z"/>', 2),
        photo: SV('<rect x="3" y="4" width="18" height="16" rx="4"/><circle cx="9" cy="10" r="1.8"/><path d="M21 16l-5-5-9 9"/>', 2)
    };
    var RIC = {
        aksiyalar: IC.pct,
        bugun: SV('<path d="M13 2L4.5 13.5H12L11 22l8.5-11.5H12z"/>', 2),
        mijozlar: SV('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18.5 14a6.5 6.5 0 0 1 3 6"/>', 2),
        dostavka: SV('<path d="M3 6.5h11v9H3zM14 10h3.6l3 3v2.5H14"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17.5" cy="17.5" r="1.8"/>', 1.9),
        kafolat: SV('<path d="M12 3l7 3v5.5c0 4.4-3 8-7 9.5-4-1.5-7-5.1-7-9.5V6z"/><path d="M8.8 12.2l2.2 2.2 4.3-4.4"/>', 2),
        lokatsiya: SV('<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>', 2),
        tolov: SV('<rect x="2.5" y="5" width="19" height="14" rx="3"/><path d="M2.5 10h19M6.5 15h4"/>', 2),
        aloqa: SV('<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>', 2),
        def: SV('<circle cx="12" cy="12" r="8.5"/>', 2)
    };
    var hap = function (k) { try { if (window._hap) window._hap(k || 'selection'); } catch (e) {} };
    var el = function (tag, cls, html) { var n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; };
    var stripEmoji = function (s) { return String(s || '').replace(/[\u2600-\u27BF\uFE0F\u200D]|[\uD83C-\uDBFF][\uDC00-\uDFFF]|\uFF0B/g, '').replace(/\s+/g, ' ').trim(); };
    var db = function () { try { return (typeof productsDB !== 'undefined' && Array.isArray(productsDB)) ? productsDB : (window.productsDB || []); } catch (e) { return window.productsDB || []; } };

    /* ── 1. Umumiy varaq sarlavhasi ── */
    function chrome(id, o) {
        var m = $(id); if (!m) return null;
        if (m.__a4) return m;
        var hd = m.querySelector(':scope > .modal-header'); if (!hd) return null;
        var h2 = hd.querySelector('h2'); if (!h2) return null;
        m.__a4 = 1; m.classList.add('a4-sheet');
        if (o.title) h2.textContent = o.title;
        h2.removeAttribute('style');
        var tt = el('div', 'a4-tt', '<div class="a4-eb"><span class="a4-mono">A1</span>' + o.eb + '</div>');
        hd.insertBefore(tt, h2); tt.appendChild(h2);
        if (o.sub) { var p = el('p', 'a4-sub'); p.textContent = o.sub; if (o.subId) p.id = o.subId; tt.appendChild(p); }
        var cb = hd.querySelector('.close-btn'); if (cb) { cb.innerHTML = o.back ? IC.back : IC.x; cb.removeAttribute('style'); }
        return m;
    }

    /* ── 2. Ommaviy aksiya ── */
    function bulkSetup() {
        var m = chrome('bulkDiscountModal', { title: 'Ommaviy aksiya', eb: 'Avto A1 · Aksiya', back: true });
        if (!m || m.__a4b) return; 
        var panel = m.querySelector('.bd-panel'), pct = $('bd-pct'), hrs = $('bd-hours'), prev = $('bd-preview'), srch = $('bd-search'),
            chips = $('bd-filter-chips'), selall = $('bd-selall-btn'), cnt = $('bd-count'), list = $('bd-list');
        if (!panel || !pct || !hrs || !prev || !srch || !chips || !list) return;
        m.__a4b = 1;
        var apply = panel.querySelector('[onclick*="bdApply"]'), cancel = panel.querySelector('[onclick*="bdCancelDiscount"]');
        var clear = m.querySelector('[onclick*="bdClearSelection"]');
        var wrap = el('div', 'a4-bd');

        // Chegirma
        wrap.appendChild(el('div', 'a4-gh', 'Chegirma'));
        var c1 = el('div', 'a4-card');
        c1.appendChild(el('div', 'a4-hero',
            '<span class="a4-hero-ic">' + IC.pct + '</span>' +
            '<span class="a4-hero-tx"><b id="a4-pct-v">0%</b><span id="a4-pct-s"></span></span>' +
            '<span class="a4-hero-sel"><b id="a4-sel-v">0</b><span>tanlangan</span><button type="button" id="a4-sel-clr" hidden>Tozalash</button></span>'));
        c1.appendChild(el('div', 'a4-hr'));
        var p1 = el('div', 'a4-pills');
        panel.querySelectorAll('.bd-quick[data-pct]').forEach(function (b) { b.removeAttribute('style'); p1.appendChild(b); });
        c1.appendChild(p1);
        c1.appendChild(el('div', 'a4-hr'));
        var f1 = el('label', 'a4-field', '<span>Boshqa foiz</span>');
        pct.removeAttribute('style'); pct.setAttribute('placeholder', '0'); pct.setAttribute('inputmode', 'numeric');
        f1.appendChild(pct); f1.appendChild(el('em', '', '%'));
        c1.appendChild(f1);
        wrap.appendChild(c1);

        // Muddat
        wrap.appendChild(el('div', 'a4-gh', 'Muddat'));
        var c2 = el('div', 'a4-card');
        var p2 = el('div', 'a4-pills');
        var inf = el('button', 'a4-pill on', 'Cheksiz'); inf.type = 'button'; inf.id = 'a4-inf';
        inf.addEventListener('click', function () { hrs.value = ''; window.bdPreview && window.bdPreview(); hap('light'); });
        p2.appendChild(inf);
        panel.querySelectorAll('.bd-quick[data-h]').forEach(function (b) { b.removeAttribute('style'); p2.appendChild(b); });
        c2.appendChild(p2);
        c2.appendChild(el('div', 'a4-hr'));
        var f2 = el('label', 'a4-field', '<span>Aniq muddat</span>');
        hrs.removeAttribute('style'); hrs.setAttribute('placeholder', '\u2014'); hrs.setAttribute('inputmode', 'numeric');
        f2.appendChild(hrs); f2.appendChild(el('em', '', 'soat'));
        c2.appendChild(f2);
        wrap.appendChild(c2);

        // Natija
        var h3 = el('div', 'a4-gh', 'Natija'); h3.id = 'a4-res-h'; h3.hidden = true; wrap.appendChild(h3);
        var c3 = el('div', 'a4-card'); c3.id = 'a4-res-c'; c3.hidden = true; prev.removeAttribute('style'); c3.appendChild(prev); wrap.appendChild(c3);

        // Tovarlar
        var sw = el('div', 'a4-search', IC.search);
        srch.removeAttribute('style'); srch.setAttribute('placeholder', 'Tovar nomi yoki kodi'); sw.appendChild(srch);
        wrap.appendChild(sw);
        chips.removeAttribute('style'); chips.classList.add('a4-seg');
        chips.querySelectorAll('.chip').forEach(function (c) { c.removeAttribute('style'); c.textContent = stripEmoji(c.textContent); });
        wrap.appendChild(chips);
        var tools = el('div', 'a4-tools');
        if (cnt) { cnt.removeAttribute('style'); tools.appendChild(cnt); }
        if (clear) clear.remove();
        if (selall) { selall.removeAttribute('style'); tools.appendChild(selall); }
        wrap.appendChild(tools);

        var clr = wrap.querySelector('#a4-sel-clr');
        if (clr) clr.addEventListener('click', function () { hap('light'); if (window.bdClearSelection) window.bdClearSelection(); });
        m.insertBefore(wrap, panel);
        // eski konteynerlar (bo'sh qoldi)
        var oldTools = srch && list.previousElementSibling;
        panel.remove();
        Array.prototype.slice.call(m.children).forEach(function (ch) {
            if (ch !== wrap && ch !== list && !ch.classList.contains('modal-header') && !ch.querySelector('input,button,#bd-list') && !ch.textContent.trim()) ch.remove();
        });
        void oldTools;

        // Pastki panel
        var dock = el('div', 'a4-dock');
        if (cancel) { cancel.removeAttribute('style'); cancel.className = 'a4-btn sec'; cancel.innerHTML = IC.undo + '<span>Olib tashlash</span>'; cancel.setAttribute('aria-label', 'Belgilanganlardan aksiyani olib tashlash'); dock.appendChild(cancel); }
        if (apply) { apply.removeAttribute('style'); apply.className = 'a4-btn pri'; apply.id = 'a4-apply'; apply.innerHTML = IC.tag + '<span>Qo\u2018yish</span>'; dock.appendChild(apply); }
        m.appendChild(dock);

        // Butun qator bosiladi
        list.addEventListener('click', function (e) {
            if (e.target.closest('input')) return;
            var row = e.target.closest('.inventory-item'); if (!row) return;
            var cb = row.querySelector('input.inv-check'); if (cb) cb.click();
        });
    }

    function bulkSync() {
        var pctEl = $('bd-pct'), hrsEl = $('bd-hours'); if (!pctEl) return;
        var v = parseFloat(pctEl.value) || 0, h = parseFloat((hrsEl || {}).value) || 0;
        var n = 0; try { n = (window._bdSelectedIds ? window._bdSelectedIds() : []).length; } catch (e) {}
        var pv = $('a4-pct-v'), ps = $('a4-pct-s'), sv = $('a4-sel-v'), ap = $('a4-apply'), inf = $('a4-inf');
        if (pv) { pv.textContent = v ? ('\u2212' + v + '%') : '0%'; pv.classList.toggle('on', !!v); }
        if (ps) ps.textContent = v ? (h ? (h >= 24 && h % 24 === 0 ? (h / 24) + ' kun davomida' : h + ' soat davomida') : 'Muddatsiz') : '';
        var rh = $('a4-res-h'), rc = $('a4-res-c'); if (rh && rc) { rh.hidden = rc.hidden = !(n && v); }
        if (sv) sv.textContent = String(n);
        var clr = $('a4-sel-clr'); if (clr) clr.hidden = !n;
        var cn = $('bd-count'); if (cn) { var vis = 0; try { vis = window._bdVisibleItems().length; } catch (e) {} cn.textContent = vis + ' ta tovar'; }
        if (inf) inf.classList.toggle('on', !h);
        if (ap) {
            ap.classList.toggle('off', !(n && v && v < 90));
            var s = ap.querySelector('span'); if (s) s.textContent = (n && v) ? ('Qo\u2018yish \u00B7 \u2212' + v + '%') : 'Qo\u2018yish';
        }
    }

    function bulkRows() {
        var list = $('bd-list'); if (!list) return;
        var all = db();
        list.querySelectorAll('.inventory-item').forEach(function (row) {
            if (row.__a4) return; row.__a4 = 1;
            var cb = row.querySelector('input.inv-check'); if (!cb) return;
            var mm = /bdToggle\(this,\s*(-?\d+)\)/.exec(cb.getAttribute('onchange') || '');
            var p = mm ? all.find(function (x) { return x && x.id === parseInt(mm[1], 10); }) : null;
            var src = p ? (p.img || (Array.isArray(p.images) && p.images[0]) || p.image || '') : '';
            var th = el('i', 'a4-th', src ? '' : IC.box);
            if (src) { var im = new Image(); im.alt = ''; im.loading = 'lazy'; im.decoding = 'async'; im.src = src; im.onerror = function () { th.innerHTML = IC.box; }; th.appendChild(im); }
            cb.insertAdjacentElement('afterend', th);
        });
    }

    function wrapBulk() {
        if (typeof window.openBulkDiscount === 'function' && !window.openBulkDiscount.__a4) {
            var o = window.openBulkDiscount;
            window.openBulkDiscount = function () { bulkSetup(); var r = o.apply(this, arguments); bulkSync(); return r; };
            window.openBulkDiscount.__a4 = 1;
        }
        if (typeof window.bdPreview === 'function' && !window.bdPreview.__a4) {
            var p = window.bdPreview;
            window.bdPreview = function () { var r = p.apply(this, arguments); try { bulkSync(); } catch (e) {} return r; };
            window.bdPreview.__a4 = 1;
        }
        if (typeof window.renderBulkDiscount === 'function' && !window.renderBulkDiscount.__a4) {
            var rb = window.renderBulkDiscount;
            window.renderBulkDiscount = function () { var r = rb.apply(this, arguments); try { bulkRows(); } catch (e) {} return r; };
            window.renderBulkDiscount.__a4 = 1;
        }
    }

    /* ── 3. Markalar + Yangi marka ── */
    function brandListSetup() {
        var m = chrome('brandManagerModal', { title: 'Markalar', eb: 'Avto A1 · Katalog', sub: 'Mashina markalari, modellar va emblemalar' });
        if (!m || m.__a4b) return; m.__a4b = 1;
        var intro = m.querySelector(':scope > div:not(.modal-header) > p'); if (intro) intro.classList.add('a4-intro');
        var add = m.querySelector('[onclick*="openBrandEdit(null)"]');
        if (add) { add.removeAttribute('style'); add.classList.add('a4-addbrand'); add.innerHTML = IC.plus + '<span>Yangi marka</span>'; }
        var list = $('bm-list');
        if (list && !list.previousElementSibling.classList.contains('a4-gh')) list.insertAdjacentElement('beforebegin', el('div', 'a4-gh', 'Barcha markalar'));
    }

    function brandEditSetup() {
        var m = chrome('brandEditModal', { eb: 'Avto A1 · Katalog', sub: 'Emblema, nom va modellar', subId: 'a4-bm-sub' });
        if (!m || m.__a4b) return;
        var groups = m.querySelectorAll('.admin-form-group'); if (groups.length < 3) return;
        m.__a4b = 1;
        var labels = [['Emblema', 'Shaffof fonli PNG eng yaxshi ko\u2018rinadi. Rasm yuklansa, link o\u2018zi qo\u2018yiladi.'],
                      ['Marka nomi', 'Izoh modellardan avtomatik tuziladi.'],
                      ['Modellar', 'Har bir model katalogda alohida bo\u2018lim bo\u2018ladi. Rasm \u2014 ixtiyoriy.']];
        groups.forEach(function (g, i) {
            var head = g.querySelector('.apx-head');
            var card = el('div', 'a4-card');
            Array.prototype.slice.call(g.children).forEach(function (ch) { if (ch !== head) card.appendChild(ch); });
            if (i === 0) {
                var up = card.querySelector('.apx-upload'), pv = $('bm-logo-preview');
                if (up) {
                    up.removeAttribute('style'); up.style.position = 'relative';
                    var lw = el('div', 'a4-logo-wrap'), lg = el('div', 'a4-logo', IC.image);
                    if (pv) { pv.removeAttribute('style'); lg.appendChild(pv); }
                    lw.appendChild(lg); lw.appendChild(el('span', 'a4-up-badge', IC.camera));
                    var tx = el('div', 'a4-up-tx');
                    var t = up.querySelector('.apx-up-t'), s = up.querySelector('.apx-up-s');
                    if (t) tx.appendChild(t); if (s) { s.textContent = 'Galereyadan tanlang'; tx.appendChild(s); }
                    up.insertBefore(lw, up.firstChild); up.insertBefore(tx, lw.nextSibling);
                    var ch = el('span', 'a4-chev'); up.insertBefore(ch, tx.nextSibling);
                    up.insertAdjacentElement('afterend', el('div', 'a4-hr'));
                }
            }
            if (i === 2) {
                var add = card.querySelector('[onclick*="addModelRow"]');
                if (add) { add.removeAttribute('style'); add.className = 'a4-addrow'; add.innerHTML = '<i>' + IC.plus + '</i>Model qo\u2018shish'; }
            }
            g.appendChild(el('div', 'a4-gh', labels[i][0]));
            g.appendChild(card);
            g.appendChild(el('div', 'a4-gf', labels[i][1]));
        });
        var del = $('bm-delete-btn'); if (del) del.textContent = 'Markani o\u2018chirish';
        var save = m.querySelector('.sticky-admin-footer .btn-checkout'); if (save) { save.removeAttribute('style'); save.innerHTML = IC.check + '<span>Saqlash</span>'; }
        var mb = $('bm-models');
        if (mb && window.MutationObserver) new MutationObserver(modelRows).observe(mb, { childList: true });
    }

    function modelRows() {
        var mb = $('bm-models'); if (!mb) return;
        mb.querySelectorAll('.bm-model-row').forEach(function (r) {
            var pl = r.querySelector('.bm-m-img-plus'); if (pl && !pl.__a4) { pl.__a4 = 1; pl.innerHTML = IC.camera; }
            var b = r.querySelector(':scope > button'); if (b && !b.__a4) { b.__a4 = 1; b.innerHTML = IC.minus; b.setAttribute('aria-label', 'Modelni olib tashlash'); }
        });
    }

    function brandSync() {
        var t = $('bm-edit-title'), s = $('a4-bm-sub'); if (!t || !s) return;
        var edit = /^Tahrirlash:\s*/.test(t.textContent);
        if (edit) { var nm = t.textContent.replace(/^Tahrirlash:\s*/, ''); t.textContent = nm; s.textContent = 'Markani tahrirlash'; }
        else s.textContent = 'Emblema, nom va modellar';
        modelRows();
    }

    function wrapBrand() {
        var B = window.BrandManager; if (!B || B.__a4) return; B.__a4 = 1;
        if (typeof B.open === 'function') { var o = B.open; B.open = function () { brandListSetup(); return o.apply(this, arguments); }; }
        if (typeof B.openBrandEdit === 'function') { var e = B.openBrandEdit; B.openBrandEdit = function () { brandEditSetup(); var r = e.apply(this, arguments); brandSync(); return r; }; }
        if (typeof B.addModelRow === 'function') { var a = B.addModelRow; B.addModelRow = function () { var r = a.apply(this, arguments); modelRows(); return r; }; }
    }

    /* ── 4. Stories boshqaruvi ── */
    function ringsList() { try { return (window.AvtoStories && window.AvtoStories.RINGS) || []; } catch (e) { return []; } }
    function storiesSetup() {
        chrome('adminStoriesModal', { title: 'Stories', eb: 'Avto A1 · Stories', sub: 'Bosh sahifadagi halqalar', back: true });
        var box = $('admin-stories-list');
        if (box && !box.__a4o && window.MutationObserver) { box.__a4o = 1; new MutationObserver(storiesPaint).observe(box, { childList: true }); }
    }
    function compose(key) { hap('medium'); try { window.AvtoStories.openComposer(key || null, 'adminStoriesModal'); } catch (e) {} }

    function storiesPaint() {
        var box = $('admin-stories-list'); if (!box) return;
        var sum = box.querySelector('.st2-sum:not([data-a4])'), empty = box.querySelector('.st2-empty:not([data-a4])');
        if (!sum && !empty) return;
        if (sum) sum.setAttribute('data-a4', '1');
        if (empty) {
            empty.setAttribute('data-a4', '1');
            var ic = empty.querySelector('.ic'); if (ic) ic.innerHTML = /O.qib bo.lmadi/.test(empty.textContent) ? SV('<path d="M12 8v5M12 16.5v.2"/><circle cx="12" cy="12" r="9"/>', 2.2) : IC.photo;
        }
        var R = ringsList(), byTitle = {}, cnt = {};
        R.forEach(function (r) { byTitle[r.title] = r; cnt[r.key] = 0; });
        box.querySelectorAll('.st2-card[data-cat]').forEach(function (c) { var k = c.getAttribute('data-cat'); cnt[k] = (cnt[k] || 0) + 1; });

        // "Yangi story" tugmasi
        var nb = $('st2-new-btn');
        if (nb && !nb.__a4) {
            nb.__a4 = 1;
            var ic2 = nb.querySelector('.st2-ab-ic'); if (ic2) ic2.innerHTML = '<i>' + IC.plus + '</i>';
            var t2 = nb.querySelector('.st2-ab-tx i'); if (t2) t2.textContent = 'Rasm yoki video \u2014 bir necha soniyada';
            nb.appendChild(el('span', 'a4-chev'));
        }
        // Halqalar qamrovi
        if (R.length && nb && !box.querySelector('.a4-rings')) {
            var gh = el('div', 'a4-gh', 'Halqalar');
            var rs = el('div', 'a4-rings');
            R.forEach(function (r) {
                var n = cnt[r.key] || 0, b = el('button', 'a4-ring' + (n ? ' on' : ''));
                b.type = 'button';
                b.innerHTML = '<span class="a4-ring-o"><i>' + (RIC[r.key] || RIC.def) + '</i><em>' + (n || '+') + '</em></span><span>' + r.title + '</span>';
                b.setAttribute('aria-label', r.title + ': ' + n + ' ta storis');
                b.addEventListener('click', function (e) {
                    e.stopPropagation();
                    var g = n ? box.querySelector('.st2-group[data-cat="' + r.key + '"]') : null;
                    if (g) { hap(); g.scrollIntoView({ behavior: 'smooth', block: 'start' }); } else compose(r.key);
                });
                rs.appendChild(b);
            });
            nb.insertAdjacentElement('afterend', rs);
            nb.insertAdjacentElement('afterend', gh);
            var gf = el('div', 'a4-gf', 'Bo\u2018sh halqani bossangiz \u2014 shu bo\u2018limga story qo\u2018shasiz.');
            rs.insertAdjacentElement('afterend', gf);
        }
        // Bo'limlar → iOS ro'yxat
        box.querySelectorAll('.st2-group').forEach(function (g) {
            if (g.__a4) return; g.__a4 = 1;
            var bt = g.querySelector('b'), em = g.querySelector('em');
            var title = bt ? bt.textContent : '', r = byTitle[title];
            var next = g.nextElementSibling, key = (next && next.getAttribute('data-cat')) || (r && r.key) || '';
            if (!r) r = R.filter(function (x) { return x.key === key; })[0];
            g.setAttribute('data-cat', key);
            g.innerHTML = '<i class="a4-gi">' + (RIC[key] || RIC.def) + '</i><b></b><em></em>';
            g.querySelector('b').textContent = title; g.querySelector('em').textContent = em ? em.textContent : '';
            var add = el('button', 'a4-gadd', IC.plus + 'Qo\u2018shish'); add.type = 'button';
            add.addEventListener('click', function (e) { e.stopPropagation(); compose(key); });
            g.appendChild(add);
            var ul = el('div', 'a4-slist');
            while (g.nextElementSibling && g.nextElementSibling.classList.contains('st2-card')) ul.appendChild(g.nextElementSibling);
            g.insertAdjacentElement('afterend', ul);
        });
        // Kartalar
        box.querySelectorAll('.st2-card').forEach(function (c) {
            if (c.__a4) return; c.__a4 = 1;
            c.style.opacity = ''; c.style.transform = '';
            var pl = c.querySelector('.st2-play'); if (pl) pl.innerHTML = IC.play;
            var meta = c.querySelector('.st2-meta');
            if (meta) {
                var type = '', when = '', src = '', isNew = false;
                meta.querySelectorAll('.st2-chip').forEach(function (ch) {
                    var t = stripEmoji(ch.textContent);
                    if (ch.classList.contains('is-new')) isNew = true;
                    else if (t === 'Video' || t === 'Rasm') type = t;
                    else if (/oldin|hozir|bugun|kecha/i.test(t)) when = t;
                    else src = t;
                });
                meta.innerHTML = '<span class="a4-m1">' + (isNew ? '<em>Yangi</em>' : '') + '<span></span></span>' +
                    '<span class="a4-m2">' + (type === 'Video' ? IC.video : IC.photo) + '<span></span></span>';
                meta.querySelector('.a4-m1 > span').textContent = when;
                meta.querySelector('.a4-m2 > span').textContent = [type, src].filter(Boolean).join(' \u00B7 ');
            }
            var ey = c.querySelector('.st2-mini[data-open]'); if (ey) ey.innerHTML = IC.eye;
            var tr = c.querySelector('.st2-mini[data-del]'); if (tr) tr.innerHTML = IC.trash;
            var th = c.querySelector('.st2-thumb'); if (th && !th.querySelector('img')) th.childNodes.forEach(function (n) { if (n.nodeType === 3) n.textContent = ''; });
        });
        if (!box.querySelector('.a4-pad')) box.appendChild(el('div', 'a4-pad'));
    }

    function wrapStories() {
        var S = window.AvtoStories; if (!S || S.__a4) return; S.__a4 = 1;
        if (typeof S.openAdmin === 'function') { var o = S.openAdmin; S.openAdmin = function () { storiesSetup(); return o.apply(this, arguments); }; }
        storiesSetup();
    }

    function init() {
        wrapBulk(); wrapBrand(); wrapStories();
        bulkSetup(); brandListSetup(); brandEditSetup();
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
    window.addEventListener('load', init);
})();
