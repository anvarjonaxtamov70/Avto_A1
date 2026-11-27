
(function () {
    'use strict';
    function DB() { try { return (typeof db !== 'undefined' && db && db.ref) ? db : firebase.database(); } catch (e) { return null; } }
    function admin() { try { return typeof window.isAdmin === 'function' && window.isAdmin(); } catch (e) { return false; } }
    function okUrl(u) { return typeof u === 'string' && /^https:\/\//.test(u) && u.length <= 500; }

    // ── 1) uid → rasm xaritasi (admin oynalari allaqachon yuklagan users keshidan) ──
    var MAP = {}, mapFrom = null, loading = null;
    function fromSnap(snap) {
        if (!snap || snap === mapFrom) return;
        mapFrom = snap; var v = {}; try { v = snap.val() || {}; } catch (e) {}
        var m = {}; Object.keys(v).forEach(function (k) { var p = v[k] && v[k].profile; if (p && okUrl(p.avatar)) m[k] = p.avatar; });
        MAP = m;
    }
    function ensureMap() {
        var c = window._usersSnapCache;
        if (c && c.snap) { fromSnap(c.snap); return Promise.resolve(); }
        if (loading) return loading;
        if (typeof window._getUsersSnap !== 'function' || !admin()) return Promise.resolve();
        loading = window._getUsersSnap().then(fromSnap).catch(function () {}).then(function () { loading = null; });
        return loading;
    }
    function put(el, url) {
        if (!el) return;
        var img = el.querySelector(':scope > .a6-img');
        if (!url) { if (img) img.remove(); return; }
        if (img && img.getAttribute('src') === url) return;
        if (!img) { img = document.createElement('img'); img.className = 'a6-img'; img.alt = ''; img.decoding = 'async'; img.loading = 'lazy'; el.insertBefore(img, el.firstChild); }
        img.classList.remove('on');
        img.onload = function () { img.classList.add('on'); };
        img.onerror = function () { img.remove(); };
        img.src = url;
    }
    var ORD_RE = /openAdminOrderDetail\('([^']*)'/;
    function orderUid(card) {
        var s = card.querySelector('.cst-vip-slot[data-order-uid]'); if (s) return s.getAttribute('data-order-uid');
        var m = ORD_RE.exec(card.getAttribute('onclick') || ''); return m ? m[1] : '';
    }
    var lastUid = '';
    function paint() {
        var c = window._usersSnapCache; if (c && c.snap) fromSnap(c.snap);
        document.querySelectorAll('.cx-row[data-uid] > .cx-av').forEach(function (av) { put(av, MAP[av.parentNode.getAttribute('data-uid')]); });
        document.querySelectorAll('#adminOrdersModal .ao-o').forEach(function (card) { put(card.querySelector('.ao-av'), MAP[orderUid(card)]); });
        var h = document.getElementById('cdt-av'); if (h && lastUid) put(h, MAP[lastUid]);
    }
    var queued = false;
    function schedule() { if (queued) return; queued = true; setTimeout(function () { queued = false; ensureMap().then(paint); }, 60); }

    function watch() {
        ['adminCustomersModal', 'adminOrdersModal', 'customer-detail-body', 'customerDetailModal'].forEach(function (id) {
            var el = document.getElementById(id); if (!el || el.__a6) return; el.__a6 = true;
            new MutationObserver(function (muts) {
                for (var i = 0; i < muts.length; i++) {
                    var t = muts[i].target;
                    if (t.classList && t.classList.contains('a6-img')) continue;
                    var add = muts[i].addedNodes, own = true;
                    for (var j = 0; j < add.length; j++) if (!(add[j].classList && add[j].classList.contains('a6-img'))) own = false;
                    if (!own || !add.length) { schedule(); return; }
                }
            }).observe(el, { childList: true, subtree: true });
        });
        if (!document.__a6c) {
            document.__a6c = true;
            document.addEventListener('click', function (e) { var r = e.target.closest && e.target.closest('.cx-row[data-uid]'); if (r) lastUid = r.getAttribute('data-uid'); }, true);
        }
    }

    // ── 2) "N ta yangi" — markaziy orders/ dan jonli (status: kutilmoqda) ──
    var count = -1, ref = null, sub0 = null;
    function badge() {
        var card = document.querySelector('#adminModal .ap2-hero-orders'); if (!card) return null;
        var b = card.querySelector('.a6-new');
        if (!b) {
            b = document.createElement('span'); b.className = 'a6-new'; b.hidden = true; b.setAttribute('aria-live', 'polite');
            b.innerHTML = '<span class="a6-dot" aria-hidden="true"></span><span class="a6-n">0 ta yangi</span>';
            card.appendChild(b);
        }
        return b;
    }
    function show(n) {
        var prev = count; count = n;
        var b = badge(); if (!b) return;
        var card = b.parentNode, sub = card.querySelector('.ap2-hero-tx i');
        if (sub && sub0 === null) sub0 = sub.textContent;
        b.querySelector('.a6-n').textContent = (n > 99 ? '99+' : n) + ' ta yangi';
        b.hidden = n <= 0;
        card.classList.toggle('a6-has', n > 0);
        card.setAttribute('aria-label', 'Buyurtmalar' + (n > 0 ? ', ' + n + ' ta yangi' : ''));
        if (sub) { sub.textContent = n > 0 ? n + ' ta buyurtma kutmoqda' : sub0; sub.classList.toggle('a6-sub', n > 0); }
        if (prev >= 0 && n > prev) {
            b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop');
            try { if (typeof window._hap === 'function') window._hap('success'); } catch (e) {}
        }
    }
    function listen() {
        if (ref || !admin()) return;
        var d = DB(); if (!d) return;
        try {
            ref = d.ref('orders').orderByChild('status').equalTo('kutilmoqda');
            ref.on('value', function (s) {
                var keys = {}; s.forEach(function (c) { keys[c.key] = 1; var v = c.val() || {}; if (v.uid != null && v.id != null) keys[v.uid + '_' + v.id] = 1; });
                window._a6NewKeys = keys;
                try { window.dispatchEvent(new CustomEvent('a6-new', { detail: keys })); } catch (e) {}
                show(s.numChildren());
            }, function () { ref = null; });
        } catch (e) { ref = null; }
    }
    window.__a6show = show; // test uchun

    function init() { watch(); badge(); listen(); if (count >= 0) show(count); }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
    window.addEventListener('load', init);
    try { firebase.auth().onAuthStateChanged(function (u) { if (u) { if (ref) { try { ref.off(); } catch (e) {} ref = null; } listen(); } }); } catch (e) {}
    var n = 0, t = setInterval(function () { init(); if ((ref && document.querySelector('#adminModal .a6-new')) || ++n > 40) clearInterval(t); }, 1500);
})();
