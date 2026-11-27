
/* ═══════════════════════════════════════════════════════════════════
   🔐 Avto A1 — KIRISH (ilova va brauzer). Telegram ichida bu qatlam
   ishlamaydi (u yerda Telegram o'zi tasdiqlaydi; raqam tasdig'i va
   «Hisob» kartasi — a1-account qatlamida).

   🪪 YAGONA HISOB: asosiy hisob — Telegram ID. Mini app, ilova va sayt
   BITTA hisobda: profil rasmi, buyurtmalar, keshbek, savat, javoblar.
   1) Raqam bilan kirish (asosiy): raqam -> Worker /login-phone -> botga
      3 ta 2 xonali tugma boradi -> ekrandagi raqam tanlanadi ->
      /tg-login-poll AYNAN Telegram hisobi tokenini beradi.
   2) «Telegram orqali kirish» havolasi — raqam hali bog'lanmagan bo'lsa
      (bot keyin raqamni so'raydi -> keyingi safar 1-yo'l ishlaydi).
   3) Telegram'i yo'q mijoz — telefon + parol (Firebase Email/Password).
   Bu qurilmadagi eski (anonim/parolli) hisobda buyurtma yoki keshbek
   bo'lsa — Telegram hisobiga BIRLASHTIRISH taklif qilinadi (/merge-legacy:
   ikkala hisob ham isbotlangan). Boshqa qurilmalar /session orqali ko'chadi.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
    'use strict';
    var $ = function (id) { return document.getElementById(id); };
    var DOMAIN = 'tel.avtoa1.app';
    var OFF_KEY = 'a1_pw_off_until';
    var TG_BOT = 'avtoa1bot';
    var inTelegram = function () { try { return !!(window.tg && tg.initData); } catch (e) { return false; } };
    var auth = function () { try { return (window.firebase && firebase.auth) ? firebase.auth() : null; } catch (e) { return null; } };
    var digitsOf = function (v) { return String(v || '').replace(/[^0-9]/g, ''); };
    var emailOf = function (digits) { return digits + '@' + DOMAIN; };
    var isTgUid = function (u) { return /^[1-9]\d{2,19}$/.test(String(u == null ? '' : u)); };
    var hap = function (k) { try { if (k === 'ok') Haptics.success(); else Haptics.warning(); } catch (e) {} };
    var pwOff = function () { try { return Date.now() < (parseInt(localStorage.getItem(OFF_KEY), 10) || 0); } catch (e) { return false; } };
    var setPwOff = function () { try { localStorage.setItem(OFF_KEY, String(Date.now() + 6 * 3600 * 1000)); } catch (e) {} };
    var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
    var fmt = function (n) { return String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); };
    var proxy = function () { try { return typeof TG_PROXY !== 'undefined' ? TG_PROXY : ''; } catch (e) { return ''; } };
    // Worker'ga POST (vaqt chegarasi bilan). { status, data } — tarmoq xatosida throw.
    var post = async function (path, body, ms) {
        var ctl = null; try { ctl = new AbortController(); } catch (e) {}
        var timer = ctl ? setTimeout(function () { try { ctl.abort(); } catch (e) {} }, ms || 15000) : null;
        try {
            var resp = await fetch(proxy() + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}), signal: ctl ? ctl.signal : undefined });
            var data = await resp.json().catch(function () { return null; });
            return { status: resp.status, data: data || {} };
        } finally { if (timer) clearTimeout(timer); }
    };
    window._a1Post = post;
    window._a1IsTgUid = isTgUid;

    if (inTelegram()) return;

    /* ── Xato / maslahat ko'rsatish ── */
    var fieldOf = function (el) { return el && (el.closest ? el.closest('.login-field') : null) || (el && el.parentNode); };
    window._loginSetErr = function (id, msg) {
        var el = $(id), err = $('err-' + id), f = fieldOf(el);
        if (f) f.classList.add('has-err');
        if (err) err.textContent = msg || '';
    };
    window._loginClearErr = function (id) { var f = fieldOf($(id)); if (f) f.classList.remove('has-err'); };
    function setHint(t) { var h = $('login-hint'); if (!h) return; h.textContent = t || ''; h.hidden = !t; }

    /* ── Rejimlar: phone (asosiy) / login / register; linkMode — eski hisobni saqlash ── */
    var mode = 'phone', upgrade = false, linkMode = false, closable = false;
    var TXT = {
        phone: { t: 'Kirish', s: 'Telefon raqamingizni kiriting \u2014 Telegram orqali tasdiqlaymiz. Telegram\u2019dagi mini app bilan bitta hisob: buyurtmalar, keshbek va savat.', b: 'Davom etish' },
        link: { t: 'Hisobingizni saqlang', s: 'Raqamingizni kiriting \u2014 Telegram orqali tasdiqlaymiz. Bu qurilmadagi buyurtmalar va keshbek Telegram hisobingizga o\u2018tadi.', b: 'Davom etish' },
        register: { t: 'Ro\u2018yxatdan o\u2018tish', s: 'Telegram\u2019siz: ism, telefon raqam va o\u2018zingiz o\u2018ylab topgan parol. Keyingi safar raqam va parol bilan kirasiz.', b: 'Ro\u2018yxatdan o\u2018tish' },
        login: { t: 'Parol bilan kirish', s: 'Telefon raqamingiz va parolingizni kiriting.', b: 'Kirish' },
        upgrade: { t: 'Parol o\u2018rnating', s: 'Hisobingiz xavfsizligi uchun parol o\u2018ylab toping. Buyurtmalar va keshbek saqlanib qoladi.', b: 'Parolni saqlash' }
    };
    function paint() {
        var key = mode === 'phone' ? (linkMode ? 'link' : 'phone') : ((mode === 'register' && upgrade) ? 'upgrade' : mode);
        var t = document.querySelector('#login-screen .login-title'); if (t) t.textContent = TXT[key].t;
        var s = document.querySelector('#login-screen .login-sub'); if (s) s.textContent = TXT[key].s;
        var b = $('login-submit-btn'); if (b && b.dataset.busy !== '1') b.textContent = TXT[key].b;
        var seg = $('login-mode');
        if (seg) { seg.hidden = mode === 'phone'; seg.querySelectorAll('button').forEach(function (x) { var on = x.getAttribute('data-m') === mode; x.classList.toggle('on', on); x.setAttribute('aria-selected', on ? 'true' : 'false'); }); }
        var show = function (id, on) { var e = $(id); if (e) e.hidden = !on; };
        show('login-name-field', mode === 'register');
        show('login-pass-field', mode !== 'phone');
        show('login-pass2-field', mode === 'register');
        show('login-forgot', mode === 'login');
        show('login-pw-alt', mode === 'phone');
        show('login-phone-alt', mode !== 'phone');
        show('login-close', closable);
        var cardEl = document.querySelector('#login-screen .login-card'); if (cardEl) cardEl.classList.toggle('is-closable', closable);
        var p = $('login-pass'); if (p) p.setAttribute('autocomplete', mode === 'login' ? 'current-password' : 'new-password');
        var ph = $('login-phone'); if (ph) ph.setAttribute('enterkeyhint', mode === 'phone' ? 'go' : 'next');
        ['login-name', 'login-phone', 'login-pass', 'login-pass2'].forEach(window._loginClearErr);
    }
    function setMode(m) { mode = m; setHint(''); paint(); }
    window._loginSetMode = function (m) { setMode(m === 'login' ? 'login' : 'register'); try { Haptics.tap && Haptics.tap(); } catch (e) {} };
    window._loginToggleEye = function () {
        var on = $('login-pass') && $('login-pass').type === 'password';
        ['login-pass', 'login-pass2'].forEach(function (id) { var e = $(id); if (e) e.type = on ? 'text' : 'password'; });
        var b = document.querySelector('#login-screen .login-eye'); if (b) { b.classList.toggle('on', on); b.setAttribute('aria-label', on ? 'Parolni yashirish' : 'Parolni ko\u2018rsatish'); }
    };
    window._loginForgot = function () {
        var msg = 'Raqamingiz Telegram\u2019ga ulangan bo\u2018lsa, parol kerak emas: \u00ab\u2190 Raqam bilan kirish\u00bb ni bosing va Telegram\u2019da tasdiqlang.\n\nTelegram bo\u2018lmasa \u2014 do\u2018kon bilan bog\u2018laning, raqamingizni tekshirib yangi parol o\u2018rnatishga yordam beramiz.';
        try {
            if (window.ShopInfo && ShopInfo.tgUrl && window.confirm(msg + '\n\nDo\u2018konga Telegram orqali yozasizmi?')) { window.a1OpenExternal ? a1OpenExternal(ShopInfo.tgUrl()) : (location.href = ShopInfo.tgUrl()); return; }
            if (!(window.ShopInfo && ShopInfo.tgUrl)) window.alert(msg);
        } catch (e) { try { window.alert(msg); } catch (e2) {} }
    };

    /* ── Firebase xato kodlari → tushunarli matn ── */
    function explain(e) {
        var c = (e && e.code) || '';
        if (/email-already-in-use|credential-already-in-use|provider-already-linked/.test(c)) return ['login-phone', 'Bu raqam allaqachon ro\u2018yxatdan o\u2018tgan \u2014 \u00abKirish\u00bb orqali kiring', 'login'];
        if (/invalid-credential|wrong-password|user-not-found|invalid-login-credentials|invalid-email/.test(c)) return ['login-pass', 'Telefon raqam yoki parol noto\u2018g\u2018ri'];
        if (/too-many-requests/.test(c)) return ['login-pass', 'Juda ko\u2018p urinish. Birozdan keyin qayta urinib ko\u2018ring'];
        if (/network-request-failed/.test(c)) return ['login-phone', 'Internet aloqasini tekshiring'];
        if (/weak-password/.test(c)) return ['login-pass', 'Parol kamida 6 ta belgidan iborat bo\u2018lsin'];
        if (/user-disabled/.test(c)) return ['login-phone', 'Bu hisob bloklangan. Do\u2018kon bilan bog\u2018laning'];
        return ['login-phone', 'Xatolik yuz berdi. Qayta urinib ko\u2018ring'];
    }

    function busy(on, label) {
        var b = $('login-submit-btn'); if (!b) return;
        b.dataset.busy = on ? '1' : '0';
        b.classList.toggle('is-loading', on);
        if (on) b.textContent = label || (mode === 'login' ? 'Kirilmoqda\u2026' : 'Saqlanmoqda\u2026'); else paint();
    }

    function hideScreen() {
        var ls = $('login-screen'); if (!ls) return;
        ls.classList.add('login-leaving');
        setTimeout(function () { ls.classList.add('hidden'); ls.classList.remove('login-leaving'); }, 280);
    }

    /* ── Muvaffaqiyatli kirishdan keyin: profil, ro'yxat hodisasi, ma'lumotlarni yuklash ── */
    async function finish(u, name, phone, isNew) {
        var prevUser = window.currentUser;
        var DB = (typeof db !== 'undefined' && db.ref) ? db : (window.firebase && firebase.database ? firebase.database() : null);
        if (!isNew && DB) {
            try {
                var snap = await DB.ref('users/' + u.uid + '/profile').once('value');
                var pr = snap.val() || {};
                if (pr.name) name = pr.name;
                if (!phone && pr.phone) phone = pr.phone;
            } catch (e) {}
        }
        name = name || 'Mijoz';
        try { localStorage.setItem('avto_a1_user', JSON.stringify({ id: u.uid, name: name, phone: phone })); } catch (e) {}
        // Boshqa hisobdan (yoki boshqa uid bilan) ma'lumotlar allaqachon yuklangan bo'lsa —
        // tinglovchilarni tozalash uchun sahifani qayta ochamiz (eng ishonchli yo'l).
        if (prevUser && String(prevUser) !== String(u.uid) && window._a1UserInited) {
            hap('ok');
            try { sessionStorage.setItem('a1_welcome', name); } catch (e) {}
            location.reload();
            return;
        }
        window.currentUser = u.uid;
        try { myProfile.name = name; myProfile.phone = phone; } catch (e) {}
        if (DB) {
            var w = isNew ? DB.ref('users/' + u.uid + '/profile').update({ name: name, phone: phone })
                          : (phone ? DB.ref('users/' + u.uid + '/profile').update({ phone: phone }) : Promise.resolve());
            if (isNew) {
                try { localStorage.setItem('avto_registration_pending', JSON.stringify({ uid: String(u.uid), name: name, phone: phone })); } catch (e) {}
                w.then(function () { if (window._registerCustomerOnce) return window._registerCustomerOnce({ name: name, phone: phone }); })
                 .catch(function (e) { if (window._dwarn) window._dwarn('[profil] ro\u2018yxatdan o\u2018tish yozilmadi:', e); });
            } else { w.catch(function () {}); }
        }
        // Parolli hisob raqamini indekslaymiz (Telegram'da «birlashtiraymi?» taklifi uchun)
        if (!isTgUid(u.uid)) { try { sessionCheck(u, true); } catch (e) {} }
        hap('ok');
        hideScreen();
        busy(false);
        panel(null);
        try { updateProfileUI(); } catch (e) {}
        try { showToast((isNew ? 'Xush kelibsiz, ' : 'Qaytganingiz bilan, ') + name + '!', 'success'); } catch (e) {}
        if (!window._a1UserInited) { try { initUserData(); } catch (e) {} }
        try { if (window.a1AccountRefresh) window.a1AccountRefresh(); } catch (e) {}
    }

    /* ── Asosiy tugma: «Davom etish» (raqam) / «Kirish» / «Ro'yxatdan o'tish» ── */
    window.manualLogin = async function () {
        var b = $('login-submit-btn'); if (b && b.dataset.busy === '1') return;
        if (mode === 'phone') { await phoneContinue(); return; }
        var name = ($('login-name') || {}).value ? $('login-name').value.trim() : '';
        var phone = ($('login-phone') || {}).value ? $('login-phone').value.trim() : '';
        var pass = ($('login-pass') || {}).value || '';
        var pass2 = ($('login-pass2') || {}).value || '';
        var d = digitsOf(phone);
        var ok = true, first = null;
        var bad = function (id, msg) { window._loginSetErr(id, msg); ok = false; if (!first) first = id; };
        if (mode === 'register' && !name) bad('login-name', 'Ismingizni kiriting');
        if (d.length < 12) bad('login-phone', 'To\u2018liq raqam kiriting: +998 90 123 45 67');
        if (pass.length < 6) bad('login-pass', 'Parol kamida 6 ta belgidan iborat bo\u2018lsin');
        else if (mode === 'register' && pass !== pass2) bad('login-pass2', 'Parollar bir xil emas');
        if (!ok) { hap('err'); try { $(first).focus(); } catch (e) {} return; }

        var A = auth();
        if (!A) { window._manualLoginLegacy && window._manualLoginLegacy(); return; }
        busy(true);
        try { await window._authSettled(); } catch (e) {}
        var email = emailOf(d), u = null;
        try {
            if (mode === 'register') {
                var cur = A.currentUser;
                if (cur && cur.isAnonymous) {
                    // Anonim hisob parolli hisobga aylanadi — uid va barcha ma'lumotlar saqlanadi
                    var cred = firebase.auth.EmailAuthProvider.credential(email, pass);
                    u = (await cur.linkWithCredential(cred)).user;
                } else {
                    u = (await A.createUserWithEmailAndPassword(email, pass)).user;
                }
            } else {
                u = (await A.signInWithEmailAndPassword(email, pass)).user;
            }
        } catch (e) {
            if (e && e.code === 'auth/operation-not-allowed') {
                // Firebase Console'da Email/Password hali yoqilmagan — eski yo'l (ilova to'xtamasin)
                if (window._dwarn) window._dwarn('[auth] Email/Password provayderi yoqilmagan — anonim kirishga o\u2018tildi');
                setPwOff();
                busy(false);
                if (upgrade) { hideScreen(); return; }
                if ($('login-name') && !$('login-name').value.trim()) $('login-name').value = 'Mijoz';
                if (window._manualLoginLegacy) window._manualLoginLegacy();
                return;
            }
            var x = explain(e);
            busy(false);
            if (x[2]) { mode = x[2]; paint(); }
            window._loginSetErr(x[0], x[1]);
            hap('err');
            return;
        }
        try { await finish(u, name, phone, mode === 'register'); } catch (e) { busy(false); }
    };

    /* ── Karta ichidagi panellar (kutish / tanlov / birlashtirish) ── */
    function panel(id) {
        var card = document.querySelector('#login-screen .login-card'); if (!card) return;
        ['login-tg-wait', 'login-choice', 'login-merge'].forEach(function (k) { var e = $(k); if (e) { e.hidden = k !== id; e.classList.toggle('lp-on', k === id); } });
        card.classList.toggle('lp-panel', !!id);
    }

    /* ── 1) RAQAM BILAN KIRISH ── */
    var hex = function (n) { var a = new Uint8Array(n); crypto.getRandomValues(a); return Array.prototype.map.call(a, function (b) { return ('0' + b.toString(16)).slice(-2); }).join(''); };
    async function phoneContinue() {
        var d = digitsOf(($('login-phone') || {}).value);
        if (d.length === 9) d = '998' + d;
        if (d.length !== 12) { window._loginSetErr('login-phone', 'To\u2018liq raqam kiriting: +998 90 123 45 67'); hap('err'); try { $('login-phone').focus(); } catch (e) {} return; }
        setHint('');
        busy(true, 'Tekshirilmoqda\u2026');
        var nonce = hex(16), r;
        try { r = await post('/login-phone', { phone: '+' + d, nonce: nonce }, 15000); }
        catch (e) { busy(false); window._loginSetErr('login-phone', 'Internet aloqasini tekshiring'); hap('err'); return; }
        busy(false);
        var data = r.data || {};
        if (r.status === 404) {
            // Worker hali yangilanmagan — raqam bo'yicha kirish yo'q: Telegram havolasi yoki parol
            choiceShow('old');
            return;
        }
        if (r.status === 429) { window._loginSetErr('login-phone', 'Juda ko\u2018p urinish. ' + Math.max(1, Math.ceil((Number(data.retryAfter) || 900) / 60)) + ' daqiqadan keyin qayta urinib ko\u2018ring'); hap('err'); return; }
        if (r.status === 403 && data.blocked) { window._loginSetErr('login-phone', 'Bu hisob bloklangan. Do\u2018kon bilan bog\u2018laning'); hap('err'); return; }
        if (!(r.status >= 200 && r.status < 300) || !data.ok) { window._loginSetErr('login-phone', 'Xatolik yuz berdi. Qayta urinib ko\u2018ring'); hap('err'); return; }
        if (data.method === 'match') { matchStart(nonce, String(data.code || ''), String(data.phone || '')); return; }
        if (data.method === 'password') {
            setMode('login');
            setHint('Bu raqam parol bilan ro\u2018yxatdan o\u2018tgan \u2014 parolingizni kiriting.');
            try { $('login-pass').focus(); } catch (e) {}
            return;
        }
        choiceShow(data.reason === 'unreachable' ? 'unreachable' : 'new');
    }
    function choiceShow(kind) {
        var w = $('login-choice'); if (!w) return;
        var h = w.querySelector('h3'), p = w.querySelector('p');
        if (kind === 'unreachable') {
            h.textContent = 'Bot sizga yoza olmadi';
            p.textContent = 'Telegram\u2019da @' + TG_BOT + ' to\u2018xtatilgan bo\u2018lishi mumkin. \u00abTelegram orqali kirish\u00bb ni bosing \u2014 bot qayta ochiladi va kirishni tasdiqlaysiz.';
        } else if (kind === 'old') {
            h.textContent = 'Telegram orqali kiring';
            p.textContent = 'Telegram\u2019dagi botimiz kirishni bir bosishda tasdiqlaydi. Telegram\u2019ingiz bo\u2018lmasa \u2014 parol bilan ro\u2018yxatdan o\u2018ting.';
        } else {
            h.textContent = 'Raqam hali Telegram\u2019ga ulanmagan';
            p.textContent = 'Bir marta Telegram orqali kiring \u2014 bot raqamingizni so\u2018raydi va keyingi safar shu raqam bilan bir bosishda kirasiz.';
        }
        panel('login-choice');
        hap('light');
    }

    /* ── Telegram'da tasdiqlashni kutish (raqam / havola) ── */
    var tgf = null;
    var codeOf = function (nonce) { return String(parseInt(nonce.slice(0, 6), 16) % 9000 + 1000); };
    var tgLink = function (f) { return 'https://t.me/' + TG_BOT + (f && f.kind === 'link' ? '?start=login_' + f.nonce : ''); };
    // APK (Capacitor) — tizim Telegram ilovasini ochadi. Brauzer/PWA — YANGI oynada:
    // joriy sahifa (va tasdiqni kutish) yopilib ketmasin.
    var openExt = function (u) {
        try {
            if (window.A1_APP && !window.A1_PWA && window.a1OpenExternal) { a1OpenExternal(u); return; }
            // ('noopener' bermaymiz: u bilan window.open doim null qaytaradi)
            var w = window.open(u, '_blank');
            if (w) { try { w.opener = null; } catch (e) {} }
            else if (window.a1OpenExternal) a1OpenExternal(u);
        } catch (e) { try { location.href = u; } catch (e2) {} }
    };
    window._a1OpenTelegram = openExt;
    var openTg = function () { openExt(tgLink(tgf)); };
    var TG_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M21.4 4.2 2.9 11.3c-1.3.5-1.2 1.3-.2 1.6l4.7 1.5 1.8 5.6c.2.6.4.8.9.8.4 0 .6-.2.9-.5l2.3-2.2 4.8 3.5c.9.5 1.5.2 1.7-.8l3.1-14.6c.3-1.3-.5-1.9-1.5-1.5zM9.8 14.6l-.4 3.8-1.4-4.6 10.3-6.5-8.5 7.3z"/></svg>';
    var BACK_SVG = '<svg class="lp-back" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    function tgUI() {
        var card = document.querySelector('#login-screen .login-card'); if (!card || $('login-tg-btn')) return;
        var btn = $('login-submit-btn');
        // Kichik maslahat (neytral) — sarlavha ostida
        var sub = card.querySelector('.login-sub');
        if (sub && !$('login-hint')) { var hn = document.createElement('p'); hn.id = 'login-hint'; hn.className = 'login-hint'; hn.hidden = true; sub.parentNode.insertBefore(hn, sub.nextSibling); }
        var wrap = document.createElement('div'); wrap.className = 'login-tg-box';
        wrap.innerHTML = '<div class="login-or"><span>yoki</span></div>' +
            '<button type="button" class="login-tg" id="login-tg-btn">' + TG_SVG + 'Telegram orqali kirish</button>' +
            '<p class="login-tg-hint">Telegram\u2019dagi mini app bilan bir xil hisob: rasm, buyurtmalar va keshbek.</p>';
        if (btn && btn.parentNode) btn.parentNode.insertBefore(wrap, btn.nextSibling);
        // Matnli o'tish tugmalari (raqam <-> parol)
        var alt1 = document.createElement('button'); alt1.type = 'button'; alt1.id = 'login-pw-alt'; alt1.className = 'login-alt';
        alt1.textContent = 'Telegram\u2019im yo\u2018q \u2014 parol bilan';
        alt1.onclick = function () { setMode('login'); try { Haptics.tap && Haptics.tap(); } catch (e) {} };
        var alt2 = document.createElement('button'); alt2.type = 'button'; alt2.id = 'login-phone-alt'; alt2.className = 'login-alt'; alt2.hidden = true;
        // «←» belgisi ba'zi shriftlarda «▯» bo'lib chiqadi — SVG chevron
        alt2.innerHTML = BACK_SVG + 'Raqam bilan kirish (Telegram orqali)';
        alt2.onclick = function () { setMode('phone'); try { Haptics.tap && Haptics.tap(); } catch (e) {} };
        if (btn && btn.parentNode) { btn.parentNode.insertBefore(alt2, btn.nextSibling); btn.parentNode.insertBefore(alt1, btn.nextSibling); }
        // Profil -> «Telegram bilan bog'lash» dan ochilganda: yopish
        var cl = document.createElement('button'); cl.type = 'button'; cl.id = 'login-close'; cl.className = 'login-close'; cl.hidden = true; cl.setAttribute('aria-label', 'Yopish');
        cl.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';
        cl.onclick = function () { tgStop(); closable = false; linkMode = false; mode = 'phone'; paint(); hideScreen(); };
        card.insertBefore(cl, card.firstChild);
        // Kutish paneli
        var w = document.createElement('div'); w.id = 'login-tg-wait'; w.hidden = true;
        w.innerHTML = '<div class="tgw-ic">' + TG_SVG + '</div>' +
            '<h3 id="tgw-h">Telegram\u2019da tasdiqlang</h3><p id="tgw-p"></p>' +
            '<div class="tgw-code" id="tgw-box"><small id="tgw-lbl">Tekshiruv kodi</small><b id="tgw-code">0000</b></div>' +
            '<p class="tgw-st" id="tgw-st">Tasdiq kutilmoqda\u2026</p>' +
            '<button type="button" class="login-tg" id="tgw-open">Telegram\u2019ni ochish</button>' +
            '<button type="button" class="login-forgot" id="tgw-cancel">Bekor qilish</button>';
        card.appendChild(w);
        // Tanlov paneli (raqam hali ulanmagan)
        var c = document.createElement('div'); c.id = 'login-choice'; c.className = 'login-panel'; c.hidden = true;
        c.innerHTML = '<div class="tgw-ic">' + TG_SVG + '</div><h3></h3><p></p>' +
            '<button type="button" class="login-tg" id="lc-tg">' + TG_SVG + 'Telegram orqali kirish</button>' +
            '<button type="button" class="login-sec" id="lc-pw">Telegram\u2019siz ro\u2018yxatdan o\u2018tish</button>' +
            '<button type="button" class="login-forgot" id="lc-back">' + BACK_SVG + 'Raqamni o\u2018zgartirish</button>';
        card.appendChild(c);
        // Birlashtirish paneli
        var m = document.createElement('div'); m.id = 'login-merge'; m.className = 'login-panel'; m.hidden = true;
        m.innerHTML = '<div class="tgw-ic is-gold"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/></svg></div>' +
            '<h3>Hisoblarni birlashtiraymi?</h3><p id="lm-p"></p>' +
            '<button type="button" class="login-tg is-gold" id="lm-yes">Ha, birlashtirish</button>' +
            '<button type="button" class="login-forgot" id="lm-no">Yo\u2018q, faqat kirish</button>';
        card.appendChild(m);
        $('login-tg-btn').onclick = function () { tgStart(); };
        $('tgw-open').onclick = openTg;
        $('tgw-cancel').onclick = function () { tgStop(); };
        $('lc-tg').onclick = function () { tgStart(); };
        $('lc-pw').onclick = function () { panel(null); setMode('register'); try { $('login-name').focus(); } catch (e) {} };
        $('lc-back').onclick = function () { panel(null); try { $('login-phone').focus(); } catch (e) {} };
    }
    function tgStatus(t, bad) { var e = $('tgw-st'); if (e) { e.textContent = t; e.classList.toggle('bad', !!bad); } }
    function tgStop(msg) {
        if (tgf) { clearTimeout(tgf.t); tgf = null; }
        panel(null);
        if (msg) window._loginSetErr('login-phone', msg);
    }
    function waitPaint(f, masked) {
        var match = f.kind === 'match';
        $('tgw-h').textContent = match ? 'Telegram\u2019da raqamni tanlang' : 'Telegram\u2019da tasdiqlang';
        $('tgw-p').innerHTML = match
            ? '@' + TG_BOT + ' sizga xabar yubordi' + (masked ? ' (' + esc(masked) + ')' : '') + '. Shu <b>raqamni</b> bosing:'
            : 'Botda <b>\u00ab\u2705 Ha, kirish\u00bb</b> tugmasini bosing va shu yerga qayting.';
        $('tgw-lbl').textContent = match ? 'Ekrandagi raqam' : 'Tekshiruv kodi';
        $('tgw-code').textContent = match ? f.code : codeOf(f.nonce);
        $('tgw-box').classList.toggle('is-match', match);
        tgStatus('Tasdiq kutilmoqda\u2026');
    }
    function matchStart(nonce, code, masked) {
        tgStop();
        tgf = { nonce: nonce, kind: 'match', code: code, started: Date.now(), t: 0, busy: false, link: linkMode };
        waitPaint(tgf, masked);
        panel('login-tg-wait');
        hap('ok');
        tgf.t = setTimeout(tgPoll, 2000);
    }
    function tgStart() {
        tgStop();
        tgf = { nonce: hex(16), kind: 'link', started: Date.now(), t: 0, busy: false, link: linkMode };
        waitPaint(tgf, '');
        panel('login-tg-wait');
        try { Haptics.tap && Haptics.tap(); } catch (e) {}
        openTg();
        tgf.t = setTimeout(tgPoll, 2500);
    }
    async function tgPoll() {
        var f = tgf; if (!f || f.busy) return;
        if (Date.now() - f.started > 5 * 60 * 1000) { tgStop('Vaqt tugadi. Qayta urinib ko\u2018ring'); return; }
        f.busy = true;
        try {
            var r = await post('/tg-login-poll', { nonce: f.nonce, match: f.kind === 'match' }, 12000);
            var data = r.data;
            if (f !== tgf) return;
            if (r.status === 404 && !data.ok) { tgStop('Telegram orqali kirish hali yoqilmagan. Telefon va parol bilan kiring'); return; }
            if (r.status === 410) { tgStop('Tasdiq eskirgan. Qayta urinib ko\u2018ring'); return; }
            if (r.status === 403 && data.denied) {
                hap('err');
                tgStop(data.reason === 'bad' ? 'Telegram\u2019da boshqa raqam tanlandi \u2014 xavfsizlik uchun so\u2018rov bekor qilindi. Qayta urinib ko\u2018ring'
                    : data.reason === 'unreachable' ? 'Telegram\u2019ga yuborib bo\u2018lmadi \u2014 \u00abTelegram orqali kirish\u00bb ni bosing'
                    : 'Kirish Telegram\u2019da rad etildi');
                return;
            }
            if (r.status === 403 && data.blocked) { tgStop('Bu hisob bloklangan. Do\u2018kon bilan bog\u2018laning'); return; }
            if (data && data.ok && data.token) {
                tgf = null;
                await onTgToken(data, f);
                return;
            }
        } catch (e) {
            if (f === tgf) tgStatus('Internet aloqasini tekshiring\u2026', true);
        } finally { f.busy = false; }
        if (f === tgf) f.t = setTimeout(tgPoll, document.hidden ? 4000 : 2000);
    }
    // Telegram'dan qaytganda — darhol tekshiramiz
    document.addEventListener('visibilitychange', function () {
        if (!document.hidden && tgf && !tgf.busy) { clearTimeout(tgf.t); tgPoll(); }
    });

    /* ── Telegram tasdiqladi: (kerak bo'lsa) birlashtirish -> kirish ── */
    async function readCounts(uid) {
        // Shu qurilmada yuklangan ma'lumot shu uid'niki bo'lsa — o'shani olamiz
        var c = { orders: 0, cashback: 0, cart: 0 };
        if (window._a1UserInited && String(window.currentUser) === String(uid)) {
            try { c.orders = (window.myOrders || []).length; } catch (e) {}
            try { c.cashback = window.Phase2 && Phase2.balance ? Math.max(0, Number(Phase2.balance()) || 0) : 0; } catch (e) {}
            try { c.cart = (typeof cart !== 'undefined' && cart) ? Object.keys(cart).length : 0; } catch (e) {}
            return c;
        }
        try {
            var DB = firebase.database();
            var snap = await Promise.race([DB.ref('users/' + uid).once('value'), new Promise(function (res) { setTimeout(function () { res(null); }, 5000); })]);
            var v = snap && snap.val ? (snap.val() || {}) : {};
            var o = v.orders; c.orders = Array.isArray(o) ? o.filter(Boolean).length : (o ? Object.keys(o).length : 0);
            var p2 = v.phase2 || {}; c.cashback = Math.max(0, (Number(p2.cashbackTotal) || 0) + (Number(p2.cashbackRefunded) || 0) - (Number(p2.cashbackSpent) || 0));
            c.cart = v.cart ? Object.keys(v.cart).length : 0;
        } catch (e) {}
        return c;
    }
    async function legacySnapshot() {
        var A = auth(), cur = A && A.currentUser;
        if (!cur || isTgUid(cur.uid)) return null;
        var tok = null;
        try { tok = await cur.getIdToken(); } catch (e) {}
        if (!tok) return null;
        var c = await readCounts(cur.uid);
        return { uid: cur.uid, token: tok, orders: c.orders, cashback: c.cashback, cart: c.cart, valuable: c.orders > 0 || c.cashback > 0 || c.cart > 0 };
    }
    function askMerge(legacy, tgName) {
        return new Promise(function (resolve) {
            var parts = [];
            if (legacy.orders) parts.push('<b>' + legacy.orders + ' ta buyurtma</b>');
            if (legacy.cashback) parts.push('<b>' + fmt(legacy.cashback) + ' so\u2018m keshbek</b>');
            if (legacy.cart && !legacy.orders) parts.push('savatda ' + legacy.cart + ' ta tovar');
            $('lm-p').innerHTML = 'Bu qurilmadagi hisobda ' + (parts.join(' va ') || 'ma\u2019lumotlar') + ' bor. Ularni ' +
                (tgName ? '<b>' + esc(tgName) + '</b> \u2014 ' : '') + 'Telegram hisobingizga o\u2018tkazaymi? Keyin Telegram, ilova va saytda bitta hisob bo\u2018ladi.';
            panel('login-merge');
            hap('light');
            var done = function (v) { $('lm-yes').onclick = $('lm-no').onclick = null; resolve(v); };
            $('lm-yes').onclick = function () { done(true); };
            $('lm-no').onclick = function () { done(false); };
        });
    }
    async function mergeLegacy(u, legacyToken) {
        for (var attempt = 0; attempt < 2; attempt++) {
            try {
                var tok = await u.getIdToken();
                var r = await post('/merge-legacy', { idToken: tok, legacyIdToken: legacyToken }, 30000);
                if (r.status === 200 && r.data.ok) return { ok: true, data: r.data };
                if (r.data && r.data.retryable && attempt === 0) { await new Promise(function (res) { setTimeout(res, 4000); }); continue; }
                return { ok: false, error: (r.data && r.data.error) || ('HTTP ' + r.status) };
            } catch (e) {
                if (attempt === 0) continue;
                return { ok: false, error: 'internet' };
            }
        }
        return { ok: false, error: 'qayta urinib ko\u2018ring' };
    }
    async function onTgToken(data, f) {
        var A = auth();
        var legacy = null;
        try { legacy = await legacySnapshot(); } catch (e) {}
        var doMerge = false;
        if (legacy) {
            if (f.link) doMerge = true;                       // mijozning o'zi «hisobni saqlash/bog'lash» ni tanlagan
            else if (legacy.valuable) doMerge = await askMerge(legacy, data.name);
        }
        panel('login-tg-wait');
        tgStatus('Kirilmoqda\u2026');
        var u = null;
        try {
            var cred = await A.signInWithCustomToken(data.token);
            u = (cred && cred.user) || A.currentUser;
        } catch (e) {
            tgStop('Kirib bo\u2018lmadi \u2014 internetni tekshirib qayta urinib ko\u2018ring');
            return;
        }
        try { localStorage.setItem('a1_had_account', '1'); } catch (e) {}
        if (doMerge && legacy) {
            tgStatus('Hisoblar birlashtirilmoqda\u2026');
            var res = await mergeLegacy(u, legacy.token);
            var note;
            if (res.ok) {
                var d = res.data || {}, bits = [];
                if (d.orders) bits.push(d.orders + ' ta buyurtma');
                if (d.cashback) bits.push(fmt(d.cashback) + ' so\u2018m keshbek');
                note = 'ok|\uD83D\uDD17 Hisoblar birlashtirildi' + (bits.length ? ': ' + bits.join(', ') : '');
            } else {
                note = 'warn|Hisoblar birlashtirilmadi (' + res.error + '). Do\u2018kon bilan bog\u2018laning \u2014 qo\u2018lda birlashtirib beramiz.';
            }
            try { sessionStorage.setItem('a1_notice', note); } catch (e) {}
        }
        await finish(u, data.name || '', '', false);
    }

    /* ── 🔁 /session: bu qurilmadagi eski hisob boshqa joyda birlashtirilgan bo'lsa — Telegram hisobiga o'tamiz ── */
    var sessP = null;
    function sessionCheck(u, force) {
        if (sessP && !force) return sessP;
        sessP = (async function () {
            if (!u || isTgUid(u.uid)) return false;
            var tok; try { tok = await u.getIdToken(); } catch (e) { return false; }
            var r; try { r = await post('/session', { idToken: tok }, 10000); } catch (e) { return false; }
            var red = r && r.data && r.data.redirect;
            if (!(r.status === 200 && red && red.token && isTgUid(red.uid))) return false;
            try { await auth().signInWithCustomToken(red.token); } catch (e) { return false; }
            var saved = {}; try { saved = JSON.parse(localStorage.getItem('avto_a1_user') || '{}') || {}; } catch (e) {}
            saved.id = red.uid;
            try {
                localStorage.setItem('avto_a1_user', JSON.stringify(saved));
                sessionStorage.setItem('a1_notice', 'ok|\uD83D\uDD17 Hisobingiz Telegram hisobiga birlashtirilgan \u2014 endi hamma joyda bitta hisob');
            } catch (e) {}
            location.reload();
            return true;
        })();
        return sessP;
    }
    window.a1SessionCheck = function () { var A = auth(); return sessionCheck(A && A.currentUser, true); };
    // Worker «bu uid birlashtirilgan» (409 redirect) desa — darhol ko'chamiz
    (function hookWorkerPost() {
        var orig = window._workerPost;
        if (typeof orig !== 'function' || orig.__a1acct) return;
        var w = async function () {
            var r = await orig.apply(this, arguments);
            try { if (r && r.resp && r.resp.status === 409 && r.data && r.data.redirect) window.a1SessionCheck(); } catch (e) {}
            return r;
        };
        w.__a1acct = 1;
        window._workerPost = w;
    })();

    /* ── Profil -> «Telegram bilan bog'lash» ── */
    window.a1LinkTelegram = function () {
        var ls = $('login-screen'); if (!ls) return;
        var A = auth(), cur = A && A.currentUser;
        linkMode = true; closable = true; upgrade = !!(cur && cur.isAnonymous); mode = 'phone';
        try {
            var ph = (typeof myProfile !== 'undefined' && myProfile && myProfile.phone) ? myProfile.phone : '';
            if (!ph) { var sv = JSON.parse(localStorage.getItem('avto_a1_user') || '{}') || {}; ph = sv.phone || ''; }
            if (ph && digitsOf(ph).length >= 9 && $('login-phone')) { $('login-phone').value = ph; try { window._loginFormatPhone($('login-phone')); } catch (e) {} }
        } catch (e) {}
        setHint('');
        panel(null);
        paint();
        ls.classList.remove('hidden');
        try { Haptics.tap && Haptics.tap(); } catch (e) {}
    };

    /* ── Hisobdan chiqish ── */
    window.a1Logout = function () {
        var go = function () {
            try { localStorage.removeItem('avto_a1_user'); localStorage.removeItem('avto_registration_pending'); } catch (e) {}
            var A = auth();
            Promise.resolve(A ? A.signOut() : null).catch(function () {}).then(function () { location.reload(); });
        };
        try { if (window.confirm('Hisobdan chiqasizmi? Qayta kirish uchun telefon raqamingiz kerak bo\u2018ladi (Telegram orqali tasdiqlanadi).')) go(); } catch (e) { go(); }
    };
    function logoutRow() {
        var app = $('pfx-app'); if (!app || $('a1-logout-grp')) return;
        var g = document.createElement('div'); g.className = 'pfx-grp a1-logout-grp'; g.id = 'a1-logout-grp';
        g.innerHTML = '<button type="button" class="a1-logout-btn" onclick="a1Logout()">Hisobdan chiqish</button>';
        app.parentNode.insertBefore(g, app.nextSibling);
    }

    /* ── Ekranni boshlash ── */
    function notices() {
        try {
            var wn = sessionStorage.getItem('a1_welcome');
            if (wn) { sessionStorage.removeItem('a1_welcome'); setTimeout(function () { try { showToast('Qaytganingiz bilan, ' + wn + '!', 'success'); } catch (e) {} }, 900); }
            var nt = sessionStorage.getItem('a1_notice');
            if (nt) {
                sessionStorage.removeItem('a1_notice');
                var i = nt.indexOf('|'), kind = nt.slice(0, i), text = nt.slice(i + 1);
                setTimeout(function () { try { showToast(text, kind === 'ok' ? 'success' : 'warning'); } catch (e) {} }, 1600);
            }
        } catch (e) {}
    }
    function start() {
        var ls = $('login-screen'); if (!ls) return;
        tgUI();
        logoutRow();
        notices();
        mode = 'phone';
        paint();
        if (window.currentUser && window._authSettled) {
            window._authSettled().then(function (u) {
                if (!u || isTgUid(u.uid)) return;           // Telegram hisobi — hammasi joyida
                sessionCheck(u).then(function (moved) {
                    if (moved || !u.isAnonymous || pwOff()) return;
                    // Avval anonim (parolsiz) kirgan mijoz — hisobni saqlash: Telegram (birlashtirib) yoki parol
                    var saved = {}; try { saved = JSON.parse(localStorage.getItem('avto_a1_user') || '{}'); } catch (e) {}
                    upgrade = true; linkMode = true; mode = 'phone';
                    if ($('login-name') && saved.name) $('login-name').value = saved.name;
                    if ($('login-phone') && saved.phone) { $('login-phone').value = saved.phone; try { window._loginFormatPhone($('login-phone')); } catch (e) {} }
                    paint();
                    ls.classList.remove('hidden');
                });
            });
        }
    }
    // Ma'lumotlar yuklanganini belgilaymiz (hisob almashtirishda qayta yuklash uchun)
    var origInit = window.initUserData;
    if (typeof origInit === 'function' && !origInit.__pw) {
        window.initUserData = function () { window._a1UserInited = true; return origInit.apply(this, arguments); };
        window.initUserData.__pw = 1;
    }
    try { if (window.currentUser) { window._a1UserInited = true; localStorage.setItem('a1_had_account', '1'); } } catch (e) {}
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();

