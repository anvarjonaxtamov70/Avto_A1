
(function orderLoader() {
    'use strict';

    var MIN_SPIN = 2000;   // soatcha KAMIDA shuncha aylanadi (mijoz ko'rib qolsin)
    var HOLD_OK  = 1150;   // pticha ekranda turadigan vaqt
    var el = null;
    var t0 = 0;
    // show(text, {minSpin, hold, sub}) — joriy seans sozlamasi. Admin holat
    // o'zgartirishida qisqaroq (u kuniga o'nlab marta bosadi), buyurtmada — to'liq.
    var curMin = MIN_SPIN, curHold = HOLD_OK;

    function reduced() {
        try {
            if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return true;
        } catch (e) {}
        return false;
    }

    function build() {
        if (el && el.parentNode) return el;
        el = document.createElement('div');
        el.id = 'ordl';
        el.setAttribute('role', 'status');
        el.setAttribute('aria-live', 'polite');
        el.innerHTML =
            '<div class="ordl-box">' +
                '<div class="ordl-ring">' +
                    '<i></i><b></b><s></s>' +
                    '<span class="ordl-mark">' +
                        '<svg viewBox="0 0 92 92" aria-hidden="true">' +
                            '<circle cx="46" cy="46" r="24"></circle>' +
                            '<path class="ordl-p-ok" d="M34 47l9 9 17-18"></path>' +
                        '</svg>' +
                    '</span>' +
                '</div>' +
                '<div class="ordl-tx">Buyurtma yuborilmoqda...</div>' +
                '<div class="ordl-sub" hidden></div>' +
            '</div>';
        document.body.appendChild(el);
        return el;
    }

    function setText(s) {
        if (!el) return;
        var t = el.querySelector('.ordl-tx');
        if (t) t.textContent = s;
    }

    function setSub(s) {
        if (!el) return;
        var t = el.querySelector('.ordl-sub');
        if (!t) return;
        t.textContent = s || '';
        t.hidden = !s;
    }

    /** Belgi shaklini almashtiramiz: pticha (ok) yoki krestcha (xato). */
    function setMark(ok) {
        if (!el) return;
        var p = el.querySelector('.ordl-mark path');
        if (!p) return;
        p.setAttribute('d', ok ? 'M34 47l9 9 17-18' : 'M37 37l18 18M55 37l-18 18');
    }

    function show(text, opts) {
        build();
        opts = opts || {};
        curMin = opts.minSpin != null ? Math.max(0, +opts.minSpin || 0) : MIN_SPIN;
        curHold = opts.hold != null ? Math.max(250, +opts.hold || 0) : HOLD_OK;
        el.classList.remove('is-ok', 'is-err');
        el.classList.add('show', 'is-load');
        setText(text || "Buyurtma yuborilmoqda...");
        setSub(opts.sub || '');
        t0 = Date.now();
        // Eski (qotib qoladigan) overlay bilan ustma-ust chiqmasin
        try {
            var old = document.getElementById('order-loading-overlay');
            if (old) old.classList.remove('active');
        } catch (e) {}
        // Bu belgi `_showSuccessCheck` ni to'xtatadi — ikki xil pticha
        // ustma-ust tushib xunuk ko'rinardi.
        window._ordlActive = true;
    }

    function hide() {
        window._ordlActive = false;
        if (!el) return;
        el.classList.remove('show', 'is-load', 'is-ok', 'is-err');
    }

    /**
     * Yuklashni tugatadi: soatcha kamida MIN_SPIN aylanib bo'lgach ptichaga
     * o'tadi, keyin yopiladi.
     * @param {boolean} ok  muvaffaqiyatmi
     * @returns {Promise} animatsiya TO'LIQ tugagach hal bo'ladi
     */
    function finish(ok, text) {
        if (!el || !el.classList.contains('show')) return Promise.resolve();
        var rm = reduced();
        var minSpin = rm ? Math.min(250, curMin) : curMin;
        var hold = rm ? Math.min(450, curHold) : curHold;
        var wait = Math.max(0, minSpin - (Date.now() - t0));

        return new Promise(function (resolve) {
            setTimeout(function () {
                try {
                    setMark(!!ok);
                    el.classList.remove('is-load');
                    el.classList.add(ok ? 'is-ok' : 'is-err');
                    setText(text || (ok ? "Buyurtma qabul qilindi!" : "Xatolik yuz berdi"));
                    window._ordlCheckShown = Date.now();
                    if (typeof window._hap === 'function') window._hap(ok ? 'success' : 'warning');
                } catch (e) {}
                setTimeout(function () { hide(); resolve(); }, hold);
            }, wait);
        });
    }

    window._ordLoader = { show: show, hide: hide, finish: finish };

    /* ------------------------------------------------------------------
     * Eski ptichani IKKI MARTA ko'rsatmaslik.
     * `confirmOrder` o'ramasi (15189-qator atrofida) muvaffaqiyatdan keyin
     * `_showSuccessCheck()` chaqiradi. Bizning yuklovchi o'z ptichasini
     * ko'rsatadi, shuning uchun eskisini o'tkazib yuboramiz — aks holda
     * ikki xil belgi ustma-ust tushadi (va eskisi `html.lite` tufayli
     * qotib ham turadi).
     * ------------------------------------------------------------------ */
    (function dedupeSuccessCheck() {
        function wrap() {
            if (window._ordlDeduped) return;
            var orig = window._showSuccessCheck;
            if (typeof orig !== 'function') return;
            window._ordlDeduped = true;
            window._showSuccessCheck = function () {
                if (window._ordlActive) return;                                  // hozir bizning yuklovchi ishlayapti
                if (window._ordlCheckShown && (Date.now() - window._ordlCheckShown) < 4000) return;
                return orig.apply(this, arguments);
            };
        }
        wrap();
        setTimeout(wrap, 1200);
        setTimeout(wrap, 3000);
    })();

    if (window._dlog) window._dlog('%c[Qatlam 2026.12] To\'lov yuklovchisi yuklandi', 'color:#C9A84C;font-weight:bold;');
})();
