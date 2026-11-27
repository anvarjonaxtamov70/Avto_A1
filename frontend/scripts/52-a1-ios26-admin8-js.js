
(function () {
    'use strict';
    function $(id) { return document.getElementById(id); }
    function hap(k) { try { if (typeof window._hap === 'function') window._hap(k); } catch (e) {} }

    /* ── 1) Buyurtmalar: "Yangi" bo'limi ── */
    var ORD = /openAdminOrderDetail\('([^']*)',\s*'([^']*)'\)/;
    var filter = 'barchasi', autoNew = false;
    function keys() { return window._a6NewKeys || null; }
    function isNew(o) { var k = keys(); return !!(k && o && k[o.uI + '_' + o.id] && (o.status || 'kutilmoqda') === 'kutilmoqda'); }
    function newList() { return (window.allFetchedOrders || []).filter(isNew); }

    function patch() {
        if (typeof window._aoFilterBar === 'function' && !window._aoFilterBar.__a8) {
            var fb = window._aoFilterBar;
            window._aoFilterBar = function () {
                filter = 'barchasi';
                var h = fb.apply(this, arguments), i = h.indexOf('</button>');
                if (i < 0) return h;
                var chip = '<button type="button" role="tab" aria-selected="false" class="ao-chip a8-chip-new" style="--c:#ff453a" onclick="filterAdminOrders(\'yangi\', this)">' +
                    '<i class="ao-dot"></i><span>Yangi</span><b class="ao-cnt" data-cnt="yangi"></b></button>';
                return h.slice(0, i + 9) + chip + h.slice(i + 9);
            };
            window._aoFilterBar.__a8 = true;
        }
        if (typeof window.filterAdminOrders === 'function' && !window.filterAdminOrders.__a8) {
            var fo = window.filterAdminOrders;
            window.filterAdminOrders = function (status, btn) {
                filter = status;
                if (status !== 'yangi') return fo.apply(this, arguments);
                if (!window.allFetchedOrders) return;
                document.querySelectorAll('#adminOrdersModal .ao-chip').forEach(function (b) { b.classList.remove('is-active'); b.setAttribute('aria-selected', 'false'); });
                if (btn) {
                    btn.classList.add('is-active'); btn.setAttribute('aria-selected', 'true');
                    try { btn.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' }); } catch (e) {}
                    hap('selection');
                }
                if (typeof window.renderAdminOrdersUI === 'function') window.renderAdminOrdersUI(newList());
            };
            window.filterAdminOrders.__a8 = true;
        }
        if (typeof window._aoUpdateCounts === 'function' && !window._aoUpdateCounts.__a8) {
            var uc = window._aoUpdateCounts;
            window._aoUpdateCounts = function () { var r = uc.apply(this, arguments); counts(); return r; };
            window._aoUpdateCounts.__a8 = true;
        }
    }
    function counts() {
        var n = newList().length;
        document.querySelectorAll('#adminOrdersModal .ao-cnt[data-cnt="yangi"]').forEach(function (el) { el.textContent = n ? n : ''; });
        var chip = document.querySelector('#adminOrdersModal .a8-chip-new'); if (chip) chip.classList.toggle('a8-live', n > 0);
        if (autoNew && n > 0 && chip && window.allFetchedOrders) {
            autoNew = false;
            setTimeout(function () { window.filterAdminOrders('yangi', chip); }, 0);
        }
    }
    function tag() {
        document.querySelectorAll('#adminOrdersModal .ao-o').forEach(function (card) {
            var m = ORD.exec(card.getAttribute('onclick') || ''); if (!m) return;
            var on = isNew({ uI: m[1], id: m[2], status: (card.className.match(/ao-st-(\S+)/) || [])[1] });
            if (card.classList.contains('a8-new') === on) return;
            card.classList.toggle('a8-new', on);
            var nm = card.querySelector('.ao-o-name'), t = card.querySelector('.a8-tag');
            if (on && nm && !t) { t = document.createElement('span'); t.className = 'a8-tag'; t.textContent = 'Yangi'; var vip = nm.querySelector('.cst-vip-slot'); nm.insertBefore(t, vip || null); }
            if (!on && t) t.remove();
        });
    }
    var q = false;
    function soon() { if (q) return; q = true; setTimeout(function () { q = false; patch(); tag(); counts(); }, 50); }
    function watchOrders() {
        var m = $('adminOrdersModal'); if (!m || m.__a8) return; m.__a8 = true;
        new MutationObserver(function (ms) {
            for (var i = 0; i < ms.length; i++) {
                var a = ms[i].addedNodes;
                for (var j = 0; j < a.length; j++) if (!(a[j].classList && a[j].classList.contains('a8-tag'))) { soon(); return; }
            }
        }).observe(m, { childList: true, subtree: true });
    }
    window.addEventListener('a6-new', function () {
        counts(); tag();
        var m = $('adminOrdersModal');
        if (filter === 'yangi' && m && getComputedStyle(m).display !== 'none' && typeof window.renderAdminOrdersUI === 'function') window.renderAdminOrdersUI(newList());
    });
    // Boshqaruv markazidagi "N ta yangi" kartasidan kirilsa — darhol "Yangi" bo'limi
    document.addEventListener('click', function (e) {
        var c = e.target.closest && e.target.closest('#adminModal .ap2-hero-orders');
        if (c) autoNew = c.classList.contains('a6-has');
    }, true);

    /* ── 2) Story oynasi: sodda iOS ── */
    var RI = {
        aksiyalar: '<path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
        bugun: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
        mijozlar: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
        dostavka: '<path d="M1 4h14v12H1zM15 9h4l3 3v4h-7"/><circle cx="6" cy="18.5" r="2"/><circle cx="18" cy="18.5" r="2"/>',
        kafolat: '<path d="M12 2l8 3v6c0 5-3.4 9.4-8 11-4.6-1.6-8-6-8-11V5z"/><path d="M9 12l2 2 4-4"/>',
        lokatsiya: '<path d="M12 22s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12z"/><circle cx="12" cy="10" r="2.5"/>',
        tolov: '<rect x="2" y="5" width="20" height="14" rx="3"/><path d="M2 10h20"/>',
        aloqa: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/>'
    };
    function svg(p) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>'; }
    var LINK = svg('<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>');

    function ph(id, t) { var el = $(id); if (el && el.getAttribute('placeholder') !== t) el.setAttribute('placeholder', t); }
    function group(block) {
        if (!block || block.querySelector(':scope > .a8-grp')) return;
        var f = block.querySelectorAll(':scope > .st2-field'); if (!f.length) return;
        var g = document.createElement('div'); g.className = 'a8-grp'; block.insertBefore(g, f[0]);
        f.forEach(function (x) { g.appendChild(x); });
    }
    function linkToggle(wrapId, label) {
        var w = $(wrapId); if (!w || w.__a8) return; w.__a8 = true;
        var inp = w.querySelector('input'); if (inp && inp.value) return;
        w.classList.add('a8-shut');
        var b = document.createElement('button'); b.type = 'button'; b.className = 'a8-link'; b.innerHTML = LINK + label;
        b.addEventListener('click', function () { w.classList.remove('a8-shut'); b.remove(); hap('selection'); var i = w.querySelector('input'); if (i) i.focus(); });
        w.parentNode.insertBefore(b, w);
    }
    function story() {
        var M = $('storyComposerModal'); if (!M) return;
        if (!M.__a8) {
            M.__a8 = true; M.classList.add('a8c');
            var cb = M.querySelector('.st2-hd .close-btn'); if (cb) cb.innerHTML = svg('<path d="M6 6l12 12M18 6L6 18"/>').replace('stroke-width="2"', 'stroke-width="3"');
            var body = $('story-composer-body');
            if (body) new MutationObserver(function () { storyBody(); }).observe(body, { childList: true, subtree: true });
        }
        storyBody();
    }
    var busy = false;
    function storyBody() {
        if (busy) return; busy = true;
        try {
            var body = $('story-composer-body'); if (!body) return;
            var bl = body.querySelectorAll(':scope > .st2-block');
            if (bl[0]) { var l0 = bl[0].querySelector('.st2-lbl'); if (l0 && !l0.classList.contains('a8-hide')) l0.classList.add('a8-hide'); }
            if (bl[1]) { var l1 = bl[1].querySelector('.st2-lbl'); if (l1 && l1.textContent !== 'Bo\'lim') l1.textContent = 'Bo\'lim'; }
            if (bl[2]) { var l2 = bl[2].querySelector('.st2-lbl'); if (l2 && l2.textContent !== 'Matn') l2.textContent = 'Matn'; group(bl[2]); }
            ph('st2-caption', 'Yozuv (ixtiyoriy)');
            ph('st2-link', 'Havola yoki tovar kodi (ixtiyoriy)');
            ph('st2-img-url', 'https://...');
            ph('st2-vid-url', 'Video havolasi (mp4)');
            ph('st2-vid-poster', 'Muqova rasmi havolasi (ixtiyoriy)');
            var uw = $('st2-url-wrap'); if (uw) group(uw);
            linkToggle('st2-img-url-wrap', 'Havola orqali qo\'shish');
            var iw = $('st2-img-url-wrap'); if (iw && !iw.querySelector('.a8-grp')) { var g = document.createElement('div'); g.className = 'a8-grp'; var f = iw.querySelector('input'); if (f) { iw.insertBefore(g, f); g.appendChild(f); } }
            body.querySelectorAll('.st2-ring[data-ring]').forEach(function (r) {
                var sp = r.querySelector(':scope > span'), k = r.getAttribute('data-ring');
                if (sp && !sp.__a8 && RI[k]) { sp.__a8 = true; sp.innerHTML = svg(RI[k]); }
            });
        } finally { busy = false; }
    }

    function init() { patch(); watchOrders(); story(); }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
    window.addEventListener('load', function () { init(); setTimeout(init, 1500); });
    new MutationObserver(function () { if ($('storyComposerModal') && !$('storyComposerModal').__a8) story(); if ($('adminOrdersModal') && !$('adminOrdersModal').__a8) watchOrders(); })
        .observe(document.body, { childList: true });
})();
