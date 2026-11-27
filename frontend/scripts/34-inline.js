
(function offlineAndErrors() {
    'use strict';

    // ───────────────────────────────────────────────────────────
    // 1) TARMOQ HOLATI LAVHASI
    // ───────────────────────────────────────────────────────────
    var banner = null;
    var hideT = null;

    function ensureBanner() {
        if (banner && banner.parentNode) return banner;
        banner = document.getElementById('net-banner');
        if (!banner) {
            banner = document.createElement('div');
            banner.id = 'net-banner';
            banner.innerHTML = '<span class="nb-dot"></span><span class="nb-text"></span>';
            document.body.appendChild(banner);
        }
        return banner;
    }

    /**
     * @param {string} text  ko'rsatiladigan matn
     * @param {boolean} good yashil (aloqa bor) yoki sariq (aloqa yo'q)
     * @param {number} [autoHide] shu millisekunddan keyin o'zi yashiriladi
     */
    function showBanner(text, good, autoHide) {
        try {
            var b = ensureBanner();
            b.querySelector('.nb-text').textContent = text;
            if (good) b.classList.add('online'); else b.classList.remove('online');
            b.classList.add('show');
            if (hideT) { clearTimeout(hideT); hideT = null; }
            if (autoHide) hideT = setTimeout(hideBanner, autoHide);
        } catch (e) {}
    }
    function hideBanner() {
        try { if (banner) banner.classList.remove('show'); } catch (e) {}
    }

    window._netBanner = { show: showBanner, hide: hideBanner };

    function onOffline() {
        showBanner("Internet aloqasi yo'q — ma'lumot yangilanmayapti", false);
    }
    function onOnline() {
        showBanner('Aloqa tiklandi', true, 2600);
    }

    try {
        window.addEventListener('offline', onOffline);
        window.addEventListener('online', onOnline);
        // Ilova offline holatda ochilgan bo'lsa — darhol aytamiz
        if (navigator && navigator.onLine === false) setTimeout(onOffline, 400);
    } catch (e) {}

    // ───────────────────────────────────────────────────────────
    // 2) GLOBAL XATO USHLAGICH
    //    Ilova "jimgina o'lib qolmasin". Foydalanuvchiga eng ko'pi
    //    30 soniyada bir marta xabar beriladi.
    // ───────────────────────────────────────────────────────────
    window._lastErrors = window._lastErrors || [];
    var lastToastAt = 0;
    var TOAST_GAP = 30000;

    function record(kind, msg, extra) {
        try {
            window._lastErrors.push({
                kind: kind,
                msg: String(msg || '').slice(0, 300),
                where: String((extra && extra.where) || '').slice(0, 200),
                at: new Date().toISOString()
            });
            if (window._lastErrors.length > 10) window._lastErrors.shift();
            if (window._dwarn) window._dwarn('[xato/' + kind + ']', msg, extra || '');
        } catch (e) {}
    }

    function maybeToast() {
        try {
            // Aloqa yo'q bo'lsa — tarmoq lavhasi allaqachon tushuntirib turadi
            if (navigator && navigator.onLine === false) return;
            var now = Date.now();
            if (now - lastToastAt < TOAST_GAP) return;
            lastToastAt = now;
            if (typeof window.showToast === 'function') {
                window.showToast('Nimadir ishlamadi — qayta urinib ko\'ring', 'warning');
            }
        } catch (e) {}
    }

    try {
        window.addEventListener('error', function (e) {
            // Rasm/skript YUKLANMASA — bu boshqa hodisa (`e.target` bor).
            // Rasmlar uchun allaqachon alohida fallback bor, takrorlamaymiz.
            if (e && e.target && e.target !== window && e.target.tagName) return;
            record('error', (e && e.message) || 'noma\'lum xato', {
                where: e ? ((e.filename || '') + ':' + (e.lineno || 0)) : ''
            });
            maybeToast();
        });

        window.addEventListener('unhandledrejection', function (e) {
            var r = e && e.reason;
            var msg = (r && (r.message || r.code)) || String(r || 'promise rad etildi');
            record('promise', msg, {});
            maybeToast();
        });
    } catch (e) {}

    // ───────────────────────────────────────────────────────────
    // 3) SERVICE WORKER
    // ───────────────────────────────────────────────────────────
    (function registerSW() {
        try {
            if (!('serviceWorker' in navigator)) return;
            if (location.protocol !== 'https:') return;   // lokal fayl/HTTP — kerak emas

            var off = false;
            try { off = localStorage.getItem('avto_nosw') === '1'; } catch (e) {}

            if (off) {
                // 🛟 O'chirish kaliti: ro'yxatdan chiqaramiz va keshlarni tozalaymiz
                navigator.serviceWorker.getRegistrations().then(function (rs) {
                    rs.forEach(function (r) { r.unregister(); });
                }).catch(function () {});
                try {
                    if (window.caches && caches.keys) {
                        caches.keys().then(function (ks) { ks.forEach(function (k) { caches.delete(k); }); });
                    }
                } catch (e) {}
                if (window._dlog) window._dlog('[sw] o\'chirildi (avto_nosw=1)');
                return;
            }

            // Ro'yxatga olishni sahifa yuklangandan KEYIN qilamiz —
            // birinchi chizishga xalaqit bermasin.
            var go = function () {
                navigator.serviceWorker.register('sw.js')
                    .then(function (reg) {
                        if (window._dlog) window._dlog('[sw] yoqildi, scope:', reg.scope);
                    })
                    .catch(function (err) {
                        // Ishlamasa ilova AVVALGIDEK ishlashda davom etadi
                        if (window._dwarn) window._dwarn('[sw] yoqilmadi:', err);
                    });
            };
            if (document.readyState === 'complete') setTimeout(go, 1200);
            else window.addEventListener('load', function () { setTimeout(go, 1200); });
        } catch (e) {}
    })();

    if (window._dlog) window._dlog('%c[Qatlam 2026.18] Offline + xato ushlash + kesh', 'color:#C9A84C;font-weight:bold;');
})();
