
/* «Bu model uchun hozircha tovar yo'q» — iOS 26 uslubidagi ekran.
   _a1FillGridNow bo'sh model uchun window._a1ModelEmpty(slug) ni chaqiradi. */
(function () {
    'use strict';
    var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
    var SV = function (d, w) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (w || 2) + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>'; };
    var IC = {
        send: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M21.4 4.2 2.9 11.3c-1.3.5-1.2 1.3-.2 1.6l4.7 1.5 1.8 5.6c.2.6.4.8.9.8.4 0 .6-.2.9-.5l2.3-2.2 4.8 3.5c.9.5 1.5.2 1.7-.8l3.1-14.6c.3-1.3-.5-1.9-1.5-1.5z"/></svg>',
        phone: SV('<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>'),
        search: SV('<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>', 2.2),
        car: SV('<path d="M5 11l1.5-4.5A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.5L19 11"/><path d="M5 11h14a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1z"/><circle cx="7.5" cy="14" r="1"/><circle cx="16.5" cy="14" r="1"/>', 1.8),
        grid: SV('<rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2"/><rect x="13.5" y="13.5" width="7" height="7" rx="2"/>'),
        chev: '<svg class="me-chev" viewBox="0 0 8 13" aria-hidden="true"><path d="M1.5 1.5 6.5 6.5 1.5 11.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
    };
    function find(slug) {
        var T = window.CATALOG_TREE || [];
        for (var i = 0; i < T.length; i++) {
            var ms = T[i].models || [];
            for (var j = 0; j < ms.length; j++) if (ms[j].slug === slug) return { b: T[i], m: ms[j] };
        }
        return null;
    }
    function countFor(slug) {
        try {
            var list = (typeof displayDB !== 'undefined' && Array.isArray(displayDB)) ? displayDB : [];
            var n = 0;
            for (var i = 0; i < list.length; i++) { var x = list[i]; if (x && (x.category === slug || (x.categories && x.categories.indexOf(slug) !== -1))) n++; }
            return n;
        } catch (e) { return 0; }
    }
    function phone() { try { return (window.ShopInfo && ShopInfo.mainPhone()) || '+998 88 289 30 30'; } catch (e) { return '+998 88 289 30 30'; } }

    window._a1MeAsk = function (slug) {
        var f = find(slug), nm = f ? ((f.b.title || '') + ' ' + (f.m.name || '')).trim() : slug;
        var text = 'Assalomu alaykum! ' + nm + ' uchun ehtiyot qism kerak edi: ';
        try { if (window._hap) window._hap('light'); } catch (e) {}
        if (window.ShopInfo && ShopInfo.openTg) ShopInfo.openTg(text);
    };
    window._a1MeSearch = function () {
        var si = document.getElementById('searchInput');
        if (si) { try { si.focus(); if (typeof searchProducts === 'function') searchProducts(); } catch (e) {} }
    };
    window._a1MeOpen = function (slug) {
        try { if (window._hap) window._hap('selection'); } catch (e) {}
        if (typeof showSection === 'function') showSection(slug + '-parts');
        var c = document.querySelector('.container'); if (c) c.scrollTop = 0;
    };

    window._a1ModelEmpty = function (slug) {
        var f = find(slug);
        var brand = f ? f.b : {}, model = f ? f.m : { name: (window.CAR_NAMES && CAR_NAMES[slug]) || slug };
        var art = model.img || brand.logo;
        var tel = 'tel:' + String(phone()).replace(/[^\d+]/g, '');
        var others = ((brand.models) || []).filter(function (m) { return m.slug !== slug; })
            .map(function (m) { return { m: m, n: countFor(m.slug) }; })
            .filter(function (x) { return x.n > 0; })
            .sort(function (a, b) { return b.n - a.n; }).slice(0, 10);
        var brandName = String(brand.title || '').split('/')[0].trim();
        return '<div class="me-wrap">' +
            '<div class="me-hero">' +
                '<div class="me-art' + (art ? '' : ' no-img') + '">' + (art ? '<img src="' + esc(art) + '" alt="" loading="lazy" decoding="async" onerror="this.parentNode.classList.add(\'no-img\');this.outerHTML=\'' + IC.car.replace(/"/g, '&quot;').replace(/'/g, "\\'") + '\'">' : IC.car) + '</div>' +
                '<div class="me-tx"><div class="me-eb">' + esc(brandName || 'Avto A1') + '</div>' +
                    '<h3>' + esc(model.name || slug) + '</h3>' +
                    '<span class="me-st"><i></i>Tovarlar tez orada</span></div>' +
            '</div>' +
            '<p class="me-lead">Bu model uchun qismlar hali katalogga qo\u2018shilmagan. Kerakli qismni yozing \u2014 topib, narxi va muddatini aytamiz.</p>' +
            '<div class="me-gh">Nima qilamiz?</div>' +
            '<div class="me-card">' +
                '<button type="button" class="me-row is-pri" onclick="_a1MeAsk(\'' + esc(slug) + '\')"><span class="me-ic" style="--c:#2AABEE">' + IC.send + '</span><span class="me-rt"><b>Qismni so\u2018rash</b><span>Telegram\u2019da yozing \u2014 olib kelib beramiz</span></span>' + IC.chev + '</button>' +
                '<a class="me-row" href="' + esc(tel) + '"><span class="me-ic" style="--c:#30d158">' + IC.phone + '</span><span class="me-rt"><b>Qo\u2018ng\u2018iroq qilish</b><span>' + esc(phone()) + '</span></span>' + IC.chev + '</a>' +
                '<button type="button" class="me-row" onclick="_a1MeSearch()"><span class="me-ic" style="--c:#0a84ff">' + IC.search + '</span><span class="me-rt"><b>Qism nomidan qidirish</b><span>Boshqa modelga mos qismlar ham chiqadi</span></span>' + IC.chev + '</button>' +
            '</div>' +
            (others.length ? '<div class="me-gh">' + esc(brandName ? brandName + ' \u2014 tovari bor modellar' : 'Tovari bor modellar') + '</div><div class="me-chips">' +
                others.map(function (x) { return '<button type="button" class="me-chip" onclick="_a1MeOpen(\'' + esc(x.m.slug) + '\')"><em>' + x.n + '</em>' + esc(x.m.name) + '</button>'; }).join('') + '</div>' : '') +
            '<button type="button" class="me-all" onclick="showCatalog()">' + IC.grid + 'Butun katalog</button>' +
        '</div>';
    };
})();
