
(function () {
    'use strict';
    var SVG = {
        x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
        pen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>',
        heart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linejoin="round"><path d="M12 20.5s-7.5-4.6-9.3-9.6C1.6 7.6 3.8 4 7.4 4c2 0 3.5 1.1 4.6 2.6C13.1 5.1 14.6 4 16.6 4c3.6 0 5.8 3.6 4.7 6.9-1.8 5-9.3 9.6-9.3 9.6z"/></svg>',
        scale: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18M7 21h10M5 7h14M5 7l-3 6a3 3 0 0 0 6 0zM19 7l-3 6a3 3 0 0 0 6 0z"/></svg>',
        bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>',
        chev: '<svg class="a7-chev" width="9" height="15" viewBox="0 0 9 15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M1.5 1.5l6 6-6 6"/></svg>',
        truck: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 4h14v12H1zM15 9h4l3 3v4h-7"/><circle cx="6" cy="18.5" r="2"/><circle cx="18" cy="18.5" r="2"/></svg>'
    };
    function $(id) { return document.getElementById(id); }
    function fmt(n) { n = Math.round(Number(n) || 0); return n.toLocaleString('ru-RU').replace(/\u00a0|,/g, ' '); }
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); }
    function hap(k) { try { if (typeof window._hap === 'function') window._hap(k); } catch (e) {} }
    function findP(id) { try { return (typeof productsDB !== 'undefined' ? productsDB : (window.productsDB || [])).find(function (x) { return x.id == id; }); } catch (e) { return null; } }
    function wl() { try { return typeof wishlist !== 'undefined' ? wishlist : (window.wishlist || []); } catch (e) { return []; } }

    var M = null, curId = null;
    function setup() {
        M = $('productModal'); if (!M || M.__a7) return !!M;
        M.__a7 = true; M.classList.add('a7');
        var hd = M.querySelector('.pm-img-header');
        var cl = M.querySelector('.pm-close-btn');
        if (cl) { cl.classList.add('a7-gl'); cl.innerHTML = SVG.x; cl.setAttribute('aria-label', 'Yopish'); }
        var tr = document.createElement('div'); tr.className = 'a7-tr';
        var heart = document.createElement('button'); heart.type = 'button'; heart.className = 'a7-gl a7-heart'; heart.innerHTML = SVG.heart; heart.setAttribute('aria-label', 'Saqlash');
        heart.addEventListener('click', function (e) {
            if (curId == null || typeof window.toggleWishlist !== 'function') return;
            var p = findP(curId); var id = p ? p.id : curId;
            try { window.toggleWishlist({ stopPropagation: function () {}, currentTarget: null, target: heart }, id); } catch (err) {}
            syncHeart(); heart.classList.remove('pop'); void heart.offsetWidth; heart.classList.add('pop');
        });
        tr.appendChild(heart);
        var ed = $('pm-edit-btn'); if (ed) { ed.classList.add('a7-gl'); ed.innerHTML = SVG.pen; ed.setAttribute('aria-label', 'Tahrirlash'); tr.appendChild(ed); }
        hd.appendChild(tr);
        var cnt = document.createElement('div'); cnt.className = 'a7-count'; hd.appendChild(cnt);

        var info = M.querySelector('.pm-info-section');
        var eb = info.querySelector('.pm-product-eyebrow'); if (eb) eb.innerHTML = '<span></span><b class="a7-mono">A1</b>Avto A1 tanlovi';
        var th = document.createElement('div'); th.className = 'a7-thumbs'; th.hidden = true; info.insertBefore(th, info.firstChild);
        var meta = info.querySelector('.pm-meta-row');
        var price = document.createElement('div'); price.className = 'a7-price'; price.id = 'a7-price';
        meta.parentNode.insertBefore(price, meta.nextSibling);
        var h1 = document.createElement('div'); h1.className = 'a7-h'; h1.innerHTML = '<b>Moslik va mavjudlik</b>';
        info.insertBefore(h1, info.querySelector('.pm-purchase-card'));
        var h2 = document.createElement('div'); h2.className = 'a7-h'; h2.innerHTML = '<b>Mahsulot haqida</b>';
        var dc = info.querySelector('.pm-description-card'); info.insertBefore(h2, dc);
        var more = document.createElement('button'); more.type = 'button'; more.className = 'a7-more'; more.textContent = 'Ko\'proq';
        more.addEventListener('click', function () { var d = $('pm-desc'); var open = d.classList.toggle('a7-clamp'); more.textContent = open ? 'Ko\'proq' : 'Kamroq'; hap('selection'); });
        dc.appendChild(more);
        var st = $('similar-title'); if (st) st.innerHTML = 'O\'xshash tovarlar<span class="a7-sub">Shu turkumdan Avto A1 tanlovi</span>';

        // Dinamik qismlar o'zgarganda qayta bezash
        new MutationObserver(function () { stock(); }).observe($('pm-stock'), { childList: true, subtree: true });
        var sl = $('pm-slider-wrapper');
        sl.addEventListener('scroll', function () { activeIdx(); }, { passive: true });
        return true;
    }

    function syncHeart() {
        var h = M && M.querySelector('.a7-heart'); if (!h) return;
        var p = findP(curId); var on = !!p && (wl().indexOf(p.id) !== -1 || wl().indexOf(String(p.id)) !== -1);
        h.classList.toggle('on', on); h.setAttribute('aria-pressed', on ? 'true' : 'false');
    }

    function gallery(p) {
        var sl = $('pm-slider-wrapper'); if (!sl) return;
        var imgs = Array.prototype.slice.call(sl.querySelectorAll(':scope > img'));
        imgs.forEach(function (im) {
            var s = document.createElement('div'); s.className = 'a7-slide';
            var bg = document.createElement('div'); bg.className = 'a7-blur'; bg.style.backgroundImage = 'url("' + String(im.getAttribute('src') || '').replace(/"/g, '%22') + '")';
            sl.insertBefore(s, im); s.appendChild(bg); s.appendChild(im);
            im.removeAttribute('loading');
        });
        sl.scrollLeft = 0;
        var all = sl.querySelectorAll('.a7-slide > img');
        var th = M.querySelector('.a7-thumbs');
        if (all.length > 1) {
            th.innerHTML = Array.prototype.map.call(all, function (im, i) {
                return '<button type="button" class="a7-th' + (i === 0 ? ' on' : '') + '" data-i="' + i + '" aria-label="' + (i + 1) + '-rasm"><img src="' + esc(im.getAttribute('src')) + '" alt="" loading="lazy"></button>';
            }).join('');
            th.hidden = false;
            th.onclick = function (e) { var b = e.target.closest('.a7-th'); if (!b) return; hap('selection'); sl.scrollTo({ left: sl.clientWidth * (+b.getAttribute('data-i')), behavior: 'smooth' }); };
        } else { th.innerHTML = ''; th.hidden = true; }
        M.classList.toggle('a7-multi', all.length > 1);
        activeIdx();
    }
    function activeIdx() {
        var sl = $('pm-slider-wrapper'); if (!sl || !M) return;
        var n = sl.querySelectorAll('.a7-slide').length, i = Math.round(sl.scrollLeft / (sl.clientWidth || 1));
        var c = M.querySelector('.a7-count'); if (c) { c.textContent = (i + 1) + ' / ' + n; c.classList.toggle('on', n > 1); }
        M.querySelectorAll('.a7-th').forEach(function (b, k) { b.classList.toggle('on', k === i); });
    }

    function priceCard(p) {
        var box = $('a7-price'); if (!box) return;
        var now = Number(p.price) || 0, old = Number(p.oldPrice) || 0, disc = old > now;
        var pct = disc ? Math.round((1 - now / old) * 100) : 0;
        var html = '<div class="a7-p-row"><span class="a7-p-now">' + fmt(now) + '<small>so\'m</small></span>' +
            (disc ? '<span class="a7-p-old">' + fmt(old) + '</span><span class="a7-p-off">−' + pct + '%</span>' : '') + '</div>' +
            '<div class="a7-p-meta">' + (disc ? '<span>Tejaysiz: <b>' + fmt(old - now) + ' so\'m</b></span>' : '') +
            '<span>' + SVG.truck + 'Tez yetkazib berish</span></div>';
        box.innerHTML = html;
        var f = $('pm-flash-cd'); if (f) { f.innerHTML = f.innerHTML.replace(/^\s*🔥\s*/, '').replace(/Flash chegirma tugashiga:?/, 'Aksiya tugashiga'); box.appendChild(f); }
        var lab = M.querySelector('.pm-sticky-label'); if (lab) lab.innerHTML = disc ? 'Narxi<s>' + fmt(old) + '</s>' : 'Narxi';
    }

    function stock() {
        var s = $('pm-stock'); if (!s || !M) return;
        var spans = s.querySelectorAll('#dynamic-stock-info > span, #pm-stock > span');
        spans.forEach(function (sp) {
            if (sp.__a7 === sp.textContent) return;
            var t = sp.textContent.replace(/^[\s✅❌]+/, '').trim(), no = /qolmagan/i.test(t);
            var m = /^(Sotuvda bor)(?::\s*(\d+)\s*ta)?/.exec(t);
            sp.className = 'a7-st' + (no ? ' no' : '');
            sp.removeAttribute('style');
            sp.innerHTML = no ? 'Sotuvda qolmagan' : (m && m[2] ? 'Sotuvda bor <em>· ' + m[2] + ' ta</em>' : esc(t));
            sp.__a7 = sp.textContent;
        });
        s.querySelectorAll('p').forEach(function (pp) { var t = pp.textContent, n = t.replace(/:\s*$/, ''); if (n !== t) pp.textContent = n; });
        s.querySelectorAll('.pm-size-btn').forEach(function (b) {
            var m = /selectSizeModel\(this,\s*(-?\d+)/.exec(b.getAttribute('onclick') || '');
            var z = !!m && +m[1] <= 0; if (b.classList.contains('a7-zero') !== z) b.classList.toggle('a7-zero', z);
        });
    }

    function desc() {
        var d = $('pm-desc'), mo = M.querySelector('.a7-more'); if (!d || !mo) return;
        d.classList.add('a7-clamp'); mo.textContent = 'Ko\'proq';
        requestAnimationFrame(function () { mo.classList.toggle('on', d.scrollHeight > d.clientHeight + 4); });
    }

    function extras() {
        var ex = $('pm-extra-actions'); if (!ex) return;
        var c = ex.querySelector('.btn-compare');
        if (c && !c.__a7) {
            c.__a7 = true; c.classList.add('a7-row'); c.removeAttribute('style');
            c.innerHTML = '<span class="a7-row-ic">' + SVG.scale + '</span><span class="a7-row-tx"><b><span class="off-t">Taqqoslashga qo\'shish</span><span class="on-t">Taqqoslashda</span></b>' +
                '<i>2 ta tovarni yonma-yon solishtiring</i></span><span class="a7-sw" aria-hidden="true"></span>';
        }
        var n = ex.querySelector('.btn-notify');
        if (n && !n.__a7) {
            n.__a7 = true; n.classList.add('a7-row'); n.removeAttribute('style');
            n.innerHTML = '<span class="a7-row-ic">' + SVG.bell + '</span><span class="a7-row-tx"><b>Kelganda xabar berish</b><i>Sotuvga kirishi bilan Telegram\'da aytamiz</i></span>' + SVG.chev;
        }
    }

    function similar() {
        var box = $('pm-similar-items'); if (!box) return;
        box.querySelectorAll('.similar-card').forEach(function (card) {
            if (card.__a7) return; card.__a7 = true;
            var m = /openProduct\((\d+)\)/.exec(card.getAttribute('onclick') || ''); var p = m && findP(m[1]); if (!p) return;
            var now = Number(p.price) || 0, old = Number(p.oldPrice) || 0;
            if (old > now) {
                var w = card.querySelector('.img-wrap'); if (w) { var o = document.createElement('span'); o.className = 'a7-off'; o.textContent = '−' + Math.round((1 - now / old) * 100) + '%'; w.appendChild(o); }
                var pr = card.querySelector('.price'); if (pr) { var s = document.createElement('span'); s.className = 'a7-old'; s.textContent = fmt(old) + ' so\'m'; pr.parentNode.insertBefore(s, pr.nextSibling); }
            }
            var pr2 = card.querySelector('.price'); if (pr2) pr2.textContent = fmt(now) + ' so\'m';
        });
    }

    function unit(p) {
        var u = $('pm-unit-badge'); if (!u) return;
        u.removeAttribute('style'); u.classList.toggle('a7-kit', p.unit === 'komplekt');
    }

    function decorate(id) {
        if (!setup()) return;
        var p = findP(id); if (!p) return;
        curId = id;
        try { gallery(p); } catch (e) {}
        try { unit(p); } catch (e) {}
        try { priceCard(p); } catch (e) {}
        try { stock(); } catch (e) {}
        try { desc(); } catch (e) {}
        try { extras(); } catch (e) {}
        try { similar(); } catch (e) {}
        try { syncHeart(); } catch (e) {}
        M.scrollTop = 0;
    }
    window.__a7decorate = decorate;

    function wrap() {
        if (typeof window.openProduct !== 'function' || window.openProduct.__a7) return;
        var orig = window.openProduct;
        var w = function (id) { var r = orig.apply(this, arguments); try { decorate(id); } catch (e) {} return r; };
        w.__a7 = true; window.openProduct = w;
        try { openProduct = w; } catch (e) {}
    }
    function init() { setup(); wrap(); }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
    window.addEventListener('load', function () { init(); setTimeout(wrap, 1500); });
})();
