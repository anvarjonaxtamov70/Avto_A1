
(function storiesSeenAndRating() {
    'use strict';

    /* ================================================================== *
     * 1. ⭐ YULDUZ REYTING — YAGONA MANBA
     * ------------------------------------------------------------------
     * `cardHTML` ham, reytinglar keyin yuklanganda DOM'ga qo'shadigan kod
     * ham AYNAN shu funksiyani chaqiradi. Ilgari markup ikki joyda alohida
     * yozilgani uchun ular bir-biridan farq qilib qolgan edi.
     * ================================================================== */
    var FULL = '\u2605\u2605\u2605\u2605\u2605';   // ★★★★★

    window._starsHTML = function (avg, count, size) {
        var v = parseFloat(avg) || 0;
        if (v <= 0) return '';
        if (v > 5) v = 5;
        var pct = (v / 5) * 100;
        var rounded = Math.round(v * 10) / 10;
        // Butun son bo'lsa ".0" ko'rsatmaymiz (4.0 -> 4) — toza ko'rinish
        var label = (rounded % 1 === 0) ? String(rounded) : rounded.toFixed(1);
        var cls = 'cr-stars' + (size === 'big' ? ' cr-big' : '');
        return '<span class="card-rating" aria-label="Reyting ' + label + ' / 5">' +
            '<span class="' + cls + '" role="img">' +
                '<i>' + FULL + '</i>' +
                '<b style="width:' + pct.toFixed(1) + '%">' + FULL + '</b>' +
            '</span>' +
            '<span class="cr-val">' + label + '</span>' +
            (count ? '<i class="cr-cnt">(' + (parseInt(count, 10) || 0) + ')</i>' : '') +
        '</span>';
    };

    /* ================================================================== *
     * 2. 👁 HAR BIR STORIS ALOHIDA "KO'RILGAN"
     * ------------------------------------------------------------------
     * Ilgari faqat kategoriya bo'yicha timestamp saqlanardi, shuning uchun
     * halqani bosish bilanoq butun bo'lim "ko'rilgan" bo'lardi. Endi har bir
     * storis o'z kaliti bilan belgilanadi va halqa segmentlarga bo'linadi.
     * ================================================================== */
    var SEEN_KEY = 'avto_seen_story_items';
    var MAX_SEEN = 600;                 // xotira cheklovi (eng eskilari tashlanadi)
    var _seen = null;

    function loadSeen() {
        if (_seen) return _seen;
        try { _seen = JSON.parse(localStorage.getItem(SEEN_KEY) || '{}') || {}; }
        catch (e) { _seen = {}; }
        return _seen;
    }
    function saveSeen() {
        try {
            var m = loadSeen();
            var keys = Object.keys(m);
            if (keys.length > MAX_SEEN) {
                // eng eski (kichik timestamp) yozuvlarni tashlaymiz
                keys.sort(function (a, b) { return (m[a] || 0) - (m[b] || 0); });
                keys.slice(0, keys.length - MAX_SEEN).forEach(function (k) { delete m[k]; });
            }
            localStorage.setItem(SEEN_KEY, JSON.stringify(m));
        } catch (e) {}
    }

    /** Storisning BARQAROR kaliti (id -> src -> kategoriya:timestamp). */
    function storyKey(cat, item) {
        if (!item) return String(cat || '-');
        return String(item.id || item.story_id || item.src || ((cat || '-') + ':' + (item.timestamp || '')));
    }
    window._storyKey = storyKey;

    window._isStorySeen = function (cat, item) {
        return !!loadSeen()[storyKey(cat, item)];
    };
    window._markStorySeen = function (cat, item) {
        if (!item) return;
        var k = storyKey(cat, item);
        var m = loadSeen();
        if (m[k]) return;               // allaqachon belgilangan
        m[k] = Date.now();
        saveSeen();
        // Halqalarni darhol yangilaymiz (badge va segmentlar jonli o'zgaradi)
        try { if (window._refreshStoryRingsPublic) window._refreshStoryRingsPublic(); } catch (e) {}
    };

    /* ------------------------------------------------------------------ *
     * 3. ESKI (KATEGORIYA BO'YICHA) BELGILARNI KO'CHIRISH
     * Eski foydalanuvchida `avto_seen_stories` bor. U bo'yicha o'sha
     * vaqtdan OLDIN qo'shilgan storislarni ko'rilgan deb qabul qilamiz —
     * shunda yangilanishdan keyin hamma storis "yangi" bo'lib chiqmaydi.
     * ------------------------------------------------------------------ */
    (function migrateOldSeen() {
        try {
            if (localStorage.getItem('avto_seen_story_migrated') === '1') return;
            var old = JSON.parse(localStorage.getItem('avto_seen_stories') || '{}') || {};
            if (!Object.keys(old).length) {
                localStorage.setItem('avto_seen_story_migrated', '1');
                return;
            }
            window._oldSeenCats = old;   // STORIES_DB kelganda qo'llanadi
        } catch (e) {}
    })();

    window._applyOldSeenMigration = function (storiesDb) {
        try {
            var old = window._oldSeenCats;
            if (!old || !storiesDb) return;
            var m = loadSeen();
            Object.keys(storiesDb).forEach(function (cat) {
                var ts = old[cat] || 0;
                if (!ts) return;
                (storiesDb[cat] || []).forEach(function (it) {
                    if ((it.timestamp || 0) <= ts) {
                        var k = storyKey(cat, it);
                        if (!m[k]) m[k] = ts;
                    }
                });
            });
            saveSeen();
            window._oldSeenCats = null;
            localStorage.setItem('avto_seen_story_migrated', '1');
            if (window._refreshStoryRingsPublic) window._refreshStoryRingsPublic();
        } catch (e) {}
    };

    /* ================================================================== *
     * 4. YOPILISH ANIMATSIYASI (tap/✕ bilan yopilganda ham)
     * Ilgari faqat pastga surib yopishda animatsiya bor edi; ✕ yoki
     * "Batafsil" bilan yopilganda oyna shartta yo'qolardi.
     * ================================================================== */
    (function smoothClose() {
        function wrap() {
            if (typeof window.closeStoryViewer !== 'function' || window._svCloseWrapped) return;
            window._svCloseWrapped = true;
            var orig = window.closeStoryViewer;
            window.closeStoryViewer = function () {
                var viewer = document.getElementById('story-viewer');
                // Pastga surib yopish allaqachon o'z animatsiyasini o'ynatgan bo'lsa —
                // yoki oyna yopiq bo'lsa — to'g'ridan asl funksiyani chaqiramiz
                if (!viewer || viewer.style.display === 'none' ||
                    viewer.classList.contains('closing-down') || viewer._svClosing) {
                    return orig.apply(this, arguments);
                }
                var rm = false;
                try {
                    rm = (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
                        || document.documentElement.classList.contains('lite');
                } catch (e) {}
                if (rm) return orig.apply(this, arguments);

                viewer._svClosing = true;
                viewer.style.transition = 'transform .22s ease, opacity .22s ease';
                viewer.style.transform = 'scale(.9)';
                viewer.style.opacity = '0';
                var self = this, args = arguments;
                setTimeout(function () {
                    viewer.style.transition = '';
                    viewer._svClosing = false;
                    orig.apply(self, args);
                }, 210);
            };
        }
        wrap();
        setTimeout(wrap, 1200);
        setTimeout(wrap, 3000);
    })();

    if (window._dlog) window._dlog('%c[Qatlam 2026.08] Stories seen + yulduz reyting yuklandi', 'color:#C9A84C;font-weight:bold;');
})();
