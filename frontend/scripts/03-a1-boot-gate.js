
    (function () {
        'use strict';
        var root = document.documentElement;
        root.classList.add('a1-boot');
        try { var s = JSON.parse(localStorage.getItem('avto_phase2') || '{}'); root.setAttribute('data-theme', s.theme === 'light' ? 'light' : 'dark'); }
        catch (e) { root.setAttribute('data-theme', 'dark'); }

        var T0 = Date.now();
        var CACHE_ENTER_MS = 8000;   // kesh bor, server javob bermayapti -> keshdan kiramiz
        var STATUS_MS = 6500;        // shundan keyin welcome'da holat matni
        var RETRY_MS = 15000;        // shundan keyin "Qayta urinish" tugmasi
        var FONT_CAP_MS = 3000;      // shriftlarni DOMContentLoaded'dan keyin ko'pi bilan kutish
        var QUIET_MS = 450;          // qayta chizishlar to'xtagach shuncha tinchlik
        var QUIET_CAP_MS = 3000;     // tinchlikni ko'pi bilan kutish
        var dclAt = 0, baseAt = 0, lastMut = 0, minUntil = 0, cbs = [], registered = false, finishing = false;

        window.__a1Booted = false;

        // (FPS qorovulining "ko'rinmas paytda qo'llash" navbati endi a1-perf-tier skripti ichida.)

        document.addEventListener('DOMContentLoaded', function () {
            dclAt = Date.now(); lastMut = dclAt;
            try {
                var mo = new MutationObserver(function () { lastMut = Date.now(); });
                ['home-products', 'main-slider', 'stories-list'].forEach(function (id) {
                    var el = document.getElementById(id); if (el) mo.observe(el, { childList: true });
                });
            } catch (e) {}
            try {
                if (document.fonts && document.fonts.load) {
                    document.fonts.load('600 16px Inter'); document.fonts.load('800 16px "Playfair Display"'); document.fonts.load('600 16px Montserrat');
                }
            } catch (e) {}
        });

        function fontsReady(now) {
            if (now - dclAt >= FONT_CAP_MS) return true;
            try {
                var l = document.querySelector('link[rel="stylesheet"][href*="fonts.googleapis"]');
                if (l && l.media !== 'all') return false;               // shrift CSS hali kelmadi
                return !document.fonts || document.fonts.status === 'loaded';
            } catch (e) { return true; }
        }
        function productsReady(now) {
            if (window._catalogFresh) return true;
            return !!window._catalogPaintedFromCache && (now - T0) >= CACHE_ENTER_MS;
        }

        var statusBox = null, statusTx = null, retryBtn = null;
        function ensureStatus() {
            if (statusBox) return true;
            var w = document.getElementById('welcome-screen'); if (!w) return false;
            statusBox = document.createElement('div'); statusBox.className = 'wl-status-box';
            statusTx = document.createElement('div'); statusTx.className = 'wl-status';
            retryBtn = document.createElement('button'); retryBtn.type = 'button'; retryBtn.className = 'wl-retry'; retryBtn.textContent = 'Qayta urinish';
            retryBtn.addEventListener('click', function () { try { location.reload(); } catch (e) {} });
            statusBox.appendChild(statusTx); statusBox.appendChild(retryBtn); w.appendChild(statusBox);
            return true;
        }
        function paintStatus(now) {
            var el = now - T0;
            if (el < STATUS_MS || !ensureStatus()) return;
            var w = document.getElementById('welcome-screen'); if (w) w.classList.add('wl-wait');
            var off = (typeof navigator.onLine === 'boolean' && !navigator.onLine);
            var txt = off ? 'Internet aloqasi yo\u2018q \u2014 ulanishni kutyapmiz\u2026'
                          : (el < 11000 ? 'Do\u2018kon tayyorlanmoqda\u2026' : 'Internet sust \u2014 biroz kuting\u2026');
            if (statusTx.textContent !== txt) statusTx.textContent = txt;
            statusBox.classList.add('on');
            if (el >= RETRY_MS) retryBtn.classList.add('on');
        }

        function finish() {
            if (finishing) return; finishing = true;
            clearInterval(timer);
            try { if (window.__endBootLite) window.__endBootLite(); } catch (e) {}
            // Uslublar (blur/soya) va kartalarning "suzib chiqishi" welcome ORTIDA tugasin
            var raf = window.requestAnimationFrame || function (f) { return setTimeout(f, 16); };
            raf(function () { raf(function () { setTimeout(function () {
                root.classList.remove('a1-boot');
                window.__a1Booted = true;
                if (statusBox) statusBox.classList.remove('on');
                var list = cbs.slice(); cbs.length = 0;
                list.forEach(function (f) { try { f(); } catch (e) {} });
                try { window.dispatchEvent(new CustomEvent('a1-ready')); } catch (e) {}
            }, 420); }); });
        }

        var timer = setInterval(function () {
            var now = Date.now();
            paintStatus(now);
            if (!registered || !dclAt || now < minUntil) return;
            if (!baseAt) {
                if (!fontsReady(now) || !productsReady(now)) return;
                baseAt = now;
            }
            if ((now - lastMut) >= QUIET_MS || (now - baseAt) >= QUIET_CAP_MS) finish();
        }, 100);

        /** startCinematicWelcome shu orqali yopiladi: kamida minMs + ilova tayyor bo'lgach. */
        window.__a1WhenReady = function (minMs, cb) {
            registered = true;
            minUntil = Math.max(minUntil, Date.now() + (minMs || 0));
            if (window.__a1Booted) { setTimeout(cb, 0); return; }
            cbs.push(cb);
        };
    })();
    