
(function () {
    'use strict';
    var $ = function (id) { return document.getElementById(id); };
    var SV = function (d, w) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (w || 2) + '" stroke-linecap="round" stroke-linejoin="round">' + d + '</svg>'; };
    var IC = {
        x: SV('<path d="M6 6l12 12M18 6L6 18"/>', 2.6),
        cart: SV('<path d="M3 4h2.2l2.3 11.1a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 8H6.3"/><circle cx="10" cy="20.3" r="1.3"/><circle cx="17.5" cy="20.3" r="1.3"/>', 1.7),
        grid: SV('<rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2"/><rect x="13.5" y="13.5" width="7" height="7" rx="2"/>', 2),
        shield: SV('<path d="M12 3l7 3v5.5c0 4.4-3 8-7 9.5-4-1.5-7-5.1-7-9.5V6z"/><path d="M8.8 12.2l2.2 2.2 4.3-4.4"/>', 2),
        clock: SV('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>', 2),
        truck: SV('<path d="M3 6.5h11v9H3zM14 10h3.6l3 3v2.5H14"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17.5" cy="17.5" r="1.8"/>', 1.9),
        chev: SV('<path d="M9 6l6 6-6 6"/>', 2.4),
        heart: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>'
    };
    var RING = '<svg class="a3-art-ring" viewBox="0 0 150 150" aria-hidden="true"><circle cx="75" cy="75" r="72"/><circle class="b" cx="75" cy="75" r="62"/></svg>';
    var art = function (icon) {
        return '<div class="a3-art" aria-hidden="true"><div class="a3-art-glow"></div>' + RING +
            '<div class="a3-art-tile">' + icon + '</div><span class="a3-art-badge">A1</span></div>';
    };
    var fmt = function (n) { return String(Math.round(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); };
    var wl = function () { try { return (typeof wishlist !== 'undefined' && Array.isArray(wishlist)) ? wishlist : (window.wishlist || []); } catch (e) { return window.wishlist || []; } };
    var db = function () { try { return (typeof productsDB !== 'undefined' && Array.isArray(productsDB)) ? productsDB : (window.productsDB || []); } catch (e) { return window.productsDB || []; } };

    /* Saqlanganlar — yagona manba: ro'yxatdagi, bazada HALI MAVJUD, takrorlanmagan tovarlar.
       (O'chirilgan tovar id'lari wishlist'da qolib ketadi — ularni sanamaymiz.) */
    window.a1WishItems = function () {
        var ids = wl(), all = db(), seen = {}, out = [];
        if (!all.length) return null; // baza hali yuklanmagan
        ids.forEach(function (id) {
            if (seen[id]) return; seen[id] = 1;
            var p = all.find(function (x) { return x.id === id; });
            if (p) out.push(p);
        });
        return out;
    };

    /* ── 1. Savat: sarlavha + bo'sh holat ── */
    function cartChrome() {
        ['cartModal', 'checkoutModal', 'coPayModal'].forEach(function (id) {
            var m = $(id); if (!m) return;
            var b = m.querySelector(':scope > .modal-header > .close-btn');
            if (b && !b.__a3) { b.__a3 = 1; b.innerHTML = IC.x; }
        });
    }
    function paintCart() {
        var m = $('cartModal'), c = $('cart-items-container'); if (!m || !c) return;
        cartChrome();
        var empty = !!c.querySelector('.co-empty');
        m.classList.toggle('co-is-empty', empty);
        if (!empty) return;
        var wi = window.a1WishItems(), n = wi ? wi.length : 0;
        c.innerHTML = '<div class="a3-empty">' + art(IC.cart) +
            '<h3>Savatingiz hozircha bo\u2018sh</h3>' +
            '<p>Mashinangizga mos original ehtiyot qismlarni katalogdan tanlang \u2014 qolganini Avto A1 o\u2018zi hal qiladi.</p>' +
            '<button type="button" class="a3-cta" onclick="closeModal(); showCatalog();">' + IC.grid + 'Katalogga o\u2018tish</button>' +
            (n ? '<button type="button" class="a3-link" onclick="closeModal(); setTimeout(function(){ showWishlist(); }, 320);">Saqlanganlar (' + n + ')' + IC.chev + '</button>' : '') +
            '<div class="a3-perks">' +
                '<div class="a3-perk"><i>' + IC.shield + '</i><div><b>100% original qismlar</b><small>Har bir tovar sotuvdan oldin tekshiriladi</small></div></div>' +
                '<div class="a3-perk"><i>' + IC.clock + '</i><div><b>14 kun kafolat</b><small>Nuqson bo\u2018lsa \u2014 bepul almashtiramiz</small></div></div>' +
                '<div class="a3-perk"><i>' + IC.truck + '</i><div><b>1\u20132 kunda yetkazish</b><small>Samarqand bo\u2018ylab tez va ishonchli</small></div></div>' +
            '</div></div>';
    }
    var origCart = window.renderCartItems;
    if (typeof origCart === 'function' && !origCart.__a3) {
        window.renderCartItems = function () { var r = origCart.apply(this, arguments); try { paintCart(); } catch (e) {} return r; };
        window.renderCartItems.__a3 = 1;
    }
    cartChrome();

    /* ── 2. Qidiruv: iOS 26 qidiruv sahifasi (X, so'nggi qidiruvlar, bo'limlar) ── */
    (function search() {
        var inp = $('searchInput'); if (!inp || inp.__a3) return; inp.__a3 = 1;
        var box = inp.closest('.search-input-container'); if (!box) return;
        var body = document.body, scan = $('scanSearchBtn');
        inp.setAttribute('enterkeyhint', 'search');
        inp.setAttribute('autocomplete', 'off');
        inp.setAttribute('autocorrect', 'off');
        inp.setAttribute('spellcheck', 'false');

        var S = function (d) { return SV(d, 1.9); };
        var SI = {
            clock: SV('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>', 2),
            fill: SV('<path d="M17 17L7 7M7 15V7h8"/>', 2.2),
            car: SV('<path d="M5 16.5h14M6.5 16.5V19M17.5 16.5V19M4.5 16.5l1.3-5.2A2 2 0 0 1 7.7 9.8h8.6a2 2 0 0 1 1.9 1.5l1.3 5.2v0"/><circle cx="8" cy="13.6" r=".6"/><circle cx="16" cy="13.6" r=".6"/>', 1.9),
            bulb: SV('<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z"/>', 1.9),
            motor: S('<path d="M4 10h3l2-2h5l2 2h2v3h2v-2h1v6h-1v-2h-2v3h-3l-2 2H9l-2-2H4z"/>'),
            brake: S('<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3"/><path d="M12 3.5v3M20.5 12h-3M12 20.5v-3M3.5 12h3"/>'),
            piston: S('<rect x="6" y="3.5" width="12" height="8" rx="1.5"/><path d="M6 6.5h12M6 9h12M12 11.5v5"/><circle cx="12" cy="18.5" r="2"/>'),
            shaft: S('<path d="M3 12h18"/><rect x="6" y="9" width="3" height="6" rx="1"/><rect x="15" y="9" width="3" height="6" rx="1"/><path d="M11 10.5h2v3h-2z"/>'),
            seal: S('<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="5"/>'),
            head: S('<rect x="3.5" y="7" width="17" height="9" rx="1.5"/><circle cx="8" cy="11.5" r="1.6"/><circle cx="12" cy="11.5" r="1.6"/><circle cx="16" cy="11.5" r="1.6"/><path d="M6 16v2M18 16v2"/>'),
            shock: S('<path d="M12 2.5v3M12 18.5v3"/><rect x="9" y="5.5" width="6" height="5" rx="1"/><path d="M8 12.5l8 1.2M8 14.6l8 1.2M8 16.7l8 1.2"/>'),
            lamp: S('<path d="M13 5.5c4 0 7 2.9 7 6.5s-3 6.5-7 6.5c-1 0-1.5-.6-1.5-1.5v-10c0-.9.5-1.5 1.5-1.5z"/><path d="M3.5 8.5h5M3.5 12h5M3.5 15.5h5"/>')
        };
        var CATS = [
            ['Motor', 'Dvigatel qismlari', SI.motor], ['Tormoz', 'Kolodka, disk', SI.brake],
            ['Porshen', 'Porshen, halqa', SI.piston], ['Val', 'Raspred, kolenval', SI.shaft],
            ['Salnik', 'Zichlagichlar', SI.seal], ['Galovka', 'Blok kallagi', SI.head],
            ['Amortizator', 'Yurish qismi', SI.shock], ['Fara', 'Chiroqlar', SI.lamp]
        ];
        var CARS = ['Cobalt', 'Nexia', 'Gentra', 'Lacetti', 'Spark', 'Damas', 'Matiz', 'Malibu'];
        var RK = 'a1_recent_search';
        var recents = function () { try { var a = JSON.parse(localStorage.getItem(RK) || '[]'); return Array.isArray(a) ? a.slice(0, 6) : []; } catch (e) { return []; } };
        var esc = function (t) { return String(t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
        var remember = function () {
            var q = inp.value.trim(); if (q.length < 2) return;
            var a = recents().filter(function (x) { return x.toLowerCase() !== q.toLowerCase(); });
            a.unshift(q.slice(0, 60));
            try { localStorage.setItem(RK, JSON.stringify(a.slice(0, 6))); } catch (e) {}
        };
        var hap = function () { try { if (window.Telegram && Telegram.WebApp && Telegram.WebApp.HapticFeedback) Telegram.WebApp.HapticFeedback.selectionChanged(); else if (navigator.vibrate) navigator.vibrate(6); } catch (e) {} };

        /* Sarlavha (katta iOS title) — maydon ustida */
        var head = document.createElement('div');
        head.className = 'a1s-head';
        box.parentNode.insertBefore(head, box);
        /* Bo'sh so'rov paneli — maydon ostida */
        var panel = document.createElement('div');
        panel.id = 'a1s-panel';
        var qc = $('quick-chips');
        (qc || box).parentNode.insertBefore(panel, (qc || box).nextSibling);

        /* X — qidiruvdan chiqish */
        var cb = document.createElement('button');
        cb.type = 'button'; cb.className = 'a1s-close'; cb.setAttribute('aria-label', 'Qidiruvni yopish'); cb.innerHTML = IC.x;
        box.appendChild(cb);

        var paintHead = function () {
            var n = db().length;
            head.innerHTML = '<div class="a1s-eyebrow"><span class="wl-mono">A1</span>Avto A1 qidiruvi</div><h1>Qidiruv</h1>' +
                '<p>' + (n ? fmt(n) + ' ta original ehtiyot qism ichidan' : 'Ehtiyot qism, marka yoki mashina nomi') + '</p>';
        };
        var paintPanel = function () {
            var r = recents(), h = '';
            if (r.length) {
                h += '<div class="a1s-sec"><div class="a1s-sec-h"><b>So\u2018nggi qidiruvlar</b><button type="button" data-a1s="clear">Tozalash</button></div><div class="a1s-list">' +
                    r.map(function (q) { return '<button type="button" class="a1s-row" data-q="' + esc(q) + '">' + SI.clock + '<span>' + esc(q) + '</span>' + SI.fill + '</button>'; }).join('') +
                    '</div></div>';
            }
            h += '<div class="a1s-sec"><div class="a1s-sec-h"><b>Mashhur bo\u2018limlar</b></div><div class="a1s-grid">' +
                CATS.map(function (c) { return '<button type="button" class="a1s-tile" data-q="' + c[0] + '"><i>' + c[2] + '</i><div>' + c[0] + '<small>' + c[1] + '</small></div></button>'; }).join('') +
                '</div></div>';
            h += '<div class="a1s-sec"><div class="a1s-sec-h"><b>Mashinangiz bo\u2018yicha</b></div><div class="a1s-cars">' +
                CARS.map(function (c) { return '<button type="button" class="a1s-car" data-q="' + c + '">' + SI.car + c + '</button>'; }).join('') +
                '</div></div>';
            h += '<div class="a1s-tip">' + SI.bulb + '<span>Xato yozsangiz ham topamiz: \u201cmator\u201d, \u201ckalodka\u201d, \u201claseti\u201d \u2014 Avto A1 tushunadi.</span></div>';
            panel.innerHTML = h;
        };
        panel.addEventListener('click', function (e) {
            var b = e.target.closest('button'); if (!b) return;
            hap();
            if (b.getAttribute('data-a1s') === 'clear') { try { localStorage.removeItem(RK); } catch (x) {} paintPanel(); return; }
            var q = b.getAttribute('data-q'); if (!q) return;
            inp.value = q;
            try { window.searchProducts(); } catch (x) {}
            remember(); sync();
            inp.blur();
        });

        var active = function () { try { return typeof searchActive !== 'undefined' && !!searchActive; } catch (e) { return false; } };
        var wasOn = false;
        var sync = function () {
            var on = active();
            var empty = inp.value.trim() === '';
            box.classList.toggle('a1s-scan', !!(scan && !scan.classList.contains('hidden')));
            box.classList.toggle('a1s-has', !empty);
            body.classList.toggle('a1-srch', on);
            body.classList.toggle('a1s-empty', on && empty);
            if (on && !wasOn) {
                paintHead(); paintPanel();
                var sc = box.closest('.container') || document.scrollingElement;
                try { if (sc) sc.scrollTop = 0; } catch (e) {}
            }
            if (on && empty && wasOn) paintPanel();
            wasOn = on;
        };

        var wrap = function (name) {
            var f = window[name]; if (typeof f !== 'function' || f.__a3s) return;
            var g = function () { var r = f.apply(this, arguments); try { sync(); } catch (e) {} return r; };
            g.__a3s = 1; window[name] = g;
        };
        wrap('searchProducts'); wrap('exitSearch'); wrap('clearSearch'); wrap('applyQuickSearch');

        inp.addEventListener('focus', function () { setTimeout(sync, 0); });
        inp.addEventListener('input', sync);
        inp.addEventListener('blur', function () { if (inp.value.trim().length >= 2) remember(); setTimeout(sync, 0); });
        inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { remember(); inp.blur(); } });
        var res = $('search-results');
        if (res) res.addEventListener('click', function () { remember(); }, true);
        window.addEventListener('popstate', function () { setTimeout(sync, 0); });
        // Maydon tepaga yopishganda (sticky) ostiga fon beriladi — sarlavhani yopmaydi
        // Qaysi element skroll qilishidan qat'i nazar: sarlavha maydon ostiga kirib ketsa — "yopishgan"
        var stuckRaf = 0;
        function stuck() {
            stuckRaf = 0;
            if (!body.classList.contains('a1-srch')) { box.classList.remove('a1s-stuck'); return; }
            var stickTop = parseFloat(getComputedStyle(box).top) || 0;
            var bt = box.getBoundingClientRect().top;
            box.classList.toggle('a1s-stuck', bt <= stickTop + 1 && head.getBoundingClientRect().bottom < bt);
        }
        window.a1sStuck = stuck;
        document.addEventListener('scroll', function () { if (!stuckRaf) stuckRaf = requestAnimationFrame(stuck); }, { passive: true, capture: true });

        cb.addEventListener('pointerdown', function (e) { e.preventDefault(); });
        cb.addEventListener('click', function () {
            hap();
            inp.blur(); body.classList.remove('search-focused');
            // pushState qilingan qidiruv holatini to'g'ri yopamiz (Telegram BackButton bilan bir xil yo'l)
            if (active()) {
                try { history.back(); } catch (e) {}
                setTimeout(function () { if (active()) { try { window.exitSearch(); } catch (e) {} } sync(); }, 260);
            } else sync();
        });
        sync();
    })();

    /* ── 4. Saqlanganlar ── */
    function paintWish() {
        var c = $('wishlist-items-container'), sub = $('wl-sub'); if (!c) return;
        var items = window.a1WishItems() || [];
        if (!items.length) {
            if (sub) sub.textContent = 'Yoqqan tovarlaringiz shu yerda turadi';
            c.innerHTML = '<div class="a3-empty">' + art(IC.heart) +
                '<h3>Hali hech narsa saqlanmagan</h3>' +
                '<p>Tovar kartasidagi <span class="a3-heart">' + IC.heart + '</span> belgisini bosing \u2014 u shu yerda saqlanadi va narxi tushsa bilib turasiz.</p>' +
                '<button type="button" class="a3-cta" onclick="showCatalog()">' + IC.grid + 'Katalogni ko\u2018rish</button></div>';
            return;
        }
        // Takroriy id'lar ikki marta karta bo'lib chiqmasin — sanoq bilan bir xil bo'lsin
        if (typeof window.cardHTML === 'function' && c.children.length !== items.length) c.innerHTML = items.map(function (p) { return window.cardHTML(p); }).join('');
        var sum = items.reduce(function (s, p) { return s + (Number(p.price) || 0); }, 0);
        if (sub) sub.innerHTML = '<b>' + items.length + ' ta tovar</b><span class="dot">\u00b7</span>' + fmt(sum) + ' so\u2018m';
    }
    var origWish = window.renderWishlist;
    if (typeof origWish === 'function' && !origWish.__a3) {
        window.renderWishlist = function () { var r = origWish.apply(this, arguments); try { paintWish(); } catch (e) {} return r; };
        window.renderWishlist.__a3 = 1;
    }

    /* ── 5. Tab bar ostidagi "scroll edge" xiralik qatlami ── */
    (function edge() {
        if ($('a1-tab-edge')) return;
        var e = document.createElement('div'); e.id = 'a1-tab-edge'; e.setAttribute('aria-hidden', 'true');
        document.body.appendChild(e);
        var root = document.documentElement;
        var setRGB = function () {
            var light = root.getAttribute('data-theme') === 'light';
            root.style.setProperty('--a3-page-rgb', light ? '244,245,247' : '10,10,11');
        };
        setRGB();
        try { new MutationObserver(setRGB).observe(root, { attributes: true, attributeFilter: ['data-theme'] }); } catch (x) {}
    })();
})();
