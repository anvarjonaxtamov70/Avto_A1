
/* ═══ SILLIQLIK: ilova ochilgandan keyin fonda qayta chizishlar "pirillamasin" ═══
   1) Kesh bilan kirilgan bo'lsa va keyin server javobi kelsa — tovarlar tartibi
      ALMASHMAYDI (avval har safar qayta aralashtirilib, kartalar sakrardi).
   2) Ochiq turgan ro'yxat fonda qayta chizilsa (admin katalogni o'zgartirdi,
      karta uslubi yangilandi va h.k.) — kartalar qaytadan "o'chib-yonib" suzib
      chiqmaydi, joyida jimgina yangilanadi. Yangi qo'shilganlar (skroll) odatdagidek. */
(function () {
    'use strict';
    // 1) Barqaror tartib
    if (typeof window._sortDisplayDB === 'function') {
        var _origSort = window._sortDisplayDB;
        window._sortDisplayDB = function (items) {
            var out = _origSort.apply(this, arguments);
            try {
                if (window._catalogFresh && !window.__a1FreshOrdered) {
                    window.__a1FreshOrdered = true;
                    var prev = (typeof displayDB !== 'undefined' && Array.isArray(displayDB)) ? displayDB : null;
                    if (window._catalogPaintedFromCache && prev && prev.length && Array.isArray(out)) {
                        var pos = {}; prev.forEach(function (p, i) { if (p) pos[p.id] = i; });
                        var fresh = [], kept = [];
                        out.forEach(function (p) { (p && pos.hasOwnProperty(p.id) ? kept : fresh).push(p); });
                        kept.sort(function (a, b) { return pos[a.id] - pos[b.id]; });
                        out = fresh.concat(kept);
                    }
                }
            } catch (e) {}
            return out;
        };
    }
    // 2) Fondagi qayta chizishda kartalar qayta "suzib chiqmaydi"
    function settle(containers) {
        containers.forEach(function (c) {
            c.querySelectorAll('.luxury-card').forEach(function (el) {
                if (!el.classList.contains('active')) el.classList.add('reveal-item', 'active');
            });
        });
    }
    function wrapRender() {
        if (typeof window.renderProducts !== 'function' || window.renderProducts.__a1s) return;
        var _orig = window.renderProducts;
        var w = function () {
            var shown = [];
            try {
                document.querySelectorAll('#home-products, .items-grid').forEach(function (c) {
                    if (c.querySelector('.luxury-card.active')) shown.push(c);
                });
            } catch (e) {}
            var r = _orig.apply(this, arguments);
            try { if (shown.length) settle(shown); } catch (e) {}
            return r;
        };
        w.__a1s = true;
        window.renderProducts = w;
    }
    wrapRender();
    // Boshqa qatlamlar keyinroq o'rab olsa ham — tashqi qavat biz bo'lamiz
    document.addEventListener('DOMContentLoaded', wrapRender);
    window.addEventListener('a1-ready', wrapRender);
})();
