
(function () {
    'use strict';
    /* ——— Bosh sahifa chrome: `#main-menu` ko'rinsa (yoki qidiruv ochiq bo'lsa) body.is-home ——— */
    function syncHome() {
        var mm = document.getElementById('main-menu');
        var ca = document.getElementById('content-area');
        var home = !mm || !ca || ca.classList.contains('hidden') || !mm.classList.contains('hidden');
        if (document.body.classList.contains('is-home') !== home) document.body.classList.toggle('is-home', home);
    }
    document.body.classList.add('is-home');
    try {
        var mo = new MutationObserver(syncHome);
        ['main-menu', 'content-area'].forEach(function (id) {
            var el = document.getElementById(id);
            if (el) mo.observe(el, { attributes: true, attributeFilter: ['class'] });
        });
    } catch (e) {}
    syncHome();

    /* ——— ⛔ Bloklangan foydalanuvchi: `blocked_users/{uid}` bo'lsa ilova yopiladi ——— */
    var ref = null, shown = false;
    function isAdminUid(uid) {
        try { if (typeof ADMIN_IDS !== 'undefined' && ADMIN_IDS.map(String).indexOf(String(uid)) !== -1) return true; } catch (e) {}
        return false;
    }
    function show() {
        if (shown) return;
        shown = true;
        var o = document.createElement('div');
        o.id = 'blockedScreen';
        o.setAttribute('role', 'alertdialog');
        o.innerHTML = '<div><div class="bk-ic"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM4 12a8 8 0 0 1 12.9-6.3L5.7 16.9A7.9 7.9 0 0 1 4 12zm8 8a7.9 7.9 0 0 1-4.9-1.7L18.3 7.1A8 8 0 0 1 12 20z"/></svg></div>' +
            '<h2>Kirish cheklangan</h2><p>Hisobingiz administrator tomonidan bloklangan. Ilova va botdan foydalanib bo\u2018lmaydi.</p></div>';
        document.body.appendChild(o);
        document.body.classList.add('is-blocked');
        try { if (window.tg && tg.MainButton) tg.MainButton.hide(); } catch (e) {}
    }
    function hide() {
        if (!shown) return;
        shown = false;
        var o = document.getElementById('blockedScreen');
        if (o) o.parentNode.removeChild(o);
        document.body.classList.remove('is-blocked');
    }
    function attach(uid) {
        try { if (ref) ref.off(); } catch (e) {}
        ref = null;
        if (!uid || !/^\d+$/.test(String(uid)) || isAdminUid(uid)) { hide(); return; }
        var d = (typeof db !== 'undefined' && db) ? db : (window.firebase && firebase.database ? firebase.database() : null);
        if (!d) return;
        ref = d.ref('blocked_users/' + uid);
        ref.on('value', function (snap) { if (snap && snap.exists()) show(); else hide(); }, function () {});
    }
    window._blockGateAttach = attach;   // diagnostika uchun
    var tries = 0;
    (function wait() {
        if (!(window.firebase && firebase.auth && firebase.apps && firebase.apps.length)) {
            if (++tries < 60) setTimeout(wait, 250);
            return;
        }
        try { firebase.auth().onAuthStateChanged(function (u) { attach(u ? u.uid : null); }); } catch (e) {}
    })();
})();
