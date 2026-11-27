
(function () {
    'use strict';
    var root = document.documentElement, ua = navigator.userAgent || '';
    if (root.classList.contains('a1-app')) return;                 // allaqachon ilova
    var KEY = 'a1_inst_hint_until';
    var later = function (days) { try { localStorage.setItem(KEY, String(Date.now() + days * 864e5)); } catch (e) {} };
    var snoozed = function () { try { return Date.now() < (parseInt(localStorage.getItem(KEY), 10) || 0); } catch (e) { return true; } };
    var inTelegram = function () { try { return !!((window.tg && tg.initData) || window.TelegramWebviewProxy || /Telegram/i.test(ua)); } catch (e) { return false; } };
    var isIOS = root.classList.contains('a1-ios');
    var isSafari = isIOS && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA\//.test(ua);
    var deferred = null;
    window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferred = e; });

    var SHARE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-label="Ulashish"><path d="M12 15V3M7.5 7.5 12 3l4.5 4.5"/><path d="M8 10H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2h-2"/></svg>';
    function show() {
        if (document.getElementById('a1-inst')) return;
        var ls = document.getElementById('login-screen');
        if (ls && !ls.classList.contains('hidden')) { setTimeout(show, 4000); return; }   // avval ro'yxatdan o'tsin
        var b = document.createElement('div'); b.id = 'a1-inst'; b.setAttribute('role', 'dialog'); b.setAttribute('aria-label', 'Ilovani o\u2018rnatish');
        var body = deferred
            ? '<span>Telefoningizga ilova sifatida o\u2018rnating \u2014 tezroq ochiladi.</span>'
            : '<span>Pastdagi ' + SHARE + ' <b style="display:inline;font-size:inherit">Ulashish</b> \u2192 \u00abBosh ekranga qo\u2018shish\u00bb (\u00abНа экран «Домой»\u00bb).</span>';
        b.innerHTML = '<img src="icons/icon-192.png" alt=""><div class="tx"><b>Avto A1 ilovasi</b>' + body + '</div>' +
            (deferred ? '<button type="button" class="go">O\u2018rnatish</button>' : '') +
            '<button type="button" class="x" aria-label="Yopish">\u2715</button>';
        document.body.appendChild(b);
        requestAnimationFrame(function () { requestAnimationFrame(function () { b.classList.add('on'); }); });
        var close = function (days) { later(days); b.classList.remove('on'); setTimeout(function () { b.remove(); }, 450); };
        b.querySelector('.x').onclick = function () { close(14); };
        var go = b.querySelector('.go');
        if (go) go.onclick = function () {
            var d = deferred; deferred = null;
            if (!d) return close(14);
            d.prompt(); (d.userChoice || Promise.resolve()).then(function () { close(60); });
        };
    }
    function maybe() {
        if (snoozed() || inTelegram()) return;
        if (isSafari || deferred) show();
    }
    window.addEventListener('load', function () { setTimeout(maybe, 6000); });
})();
