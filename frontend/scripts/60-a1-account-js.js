
/* ═══════════════════════════════════════════════════════════════════
   🪪 YAGONA HISOB — profil «Hisob» kartasi va raqam tasdig'i
   • Telegram (mini app): «Raqamni tasdiqlash» -> Telegram'ning o'z
     oynasi (requestContact). Javob Telegram imzosi bilan Worker'da
     tekshiriladi (/phone-verify); bo'lmasa bot kontakt xabarini o'zi
     tasdiqlaydi. Shundan keyin ilova/saytda SHU raqam bilan Telegram
     hisobiga kiriladi. Ilovada parolli hisobi bo'lsa — paroli bilan
     shu yerda birlashtiriladi (/merge-legacy).
   • Ilova/sayt: Telegram hisobi bo'lmasa — «Telegram bilan bog'lash»;
     raqam tasdiqlanmagan bo'lsa — botda raqamni ulashish.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
    'use strict';
    var W = window, D = document;
    var $ = function (id) { return D.getElementById(id); };
    var TG_BOT = 'avtoa1bot';
    var PROMPT_KEY = 'a1_phone_prompt_until';
    var isTgUid = W._a1IsTgUid || function (u) { return /^[1-9]\d{2,19}$/.test(String(u == null ? '' : u)); };
    var inTG = function () { try { return !!(typeof tg !== 'undefined' && tg && tg.initData); } catch (e) { return false; } };
    var auth = function () { try { return (W.firebase && firebase.auth) ? firebase.auth() : null; } catch (e) { return null; } };
    var authUid = function () { var A = auth(); var u = A && A.currentUser; return u ? String(u.uid) : ''; };
    var DBX = function () { try { return (typeof db !== 'undefined' && db && db.ref) ? db : (W.firebase && firebase.database ? firebase.database() : null); } catch (e) { return null; } };
    var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
    var toast = function (m, k) { try { if (typeof W.showToast === 'function') W.showToast(m, k || 'success'); } catch (e) {} };
    var hap = function (k) { try { if (typeof W._hap === 'function') W._hap(k || 'light'); } catch (e) {} };
    var fmt = function (n) { return String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); };
    var post = function (path, body, ms) { return W._a1Post ? W._a1Post(path, body, ms) : Promise.reject(new Error('post')); };
    var fmtPhone = function (p) {
        var d = String(p || '').replace(/[^0-9]/g, '');
        return d.length === 12 && d.indexOf('998') === 0 ? '+998 ' + d.slice(3, 5) + ' ' + d.slice(5, 8) + ' ' + d.slice(8, 10) + ' ' + d.slice(10) : (d ? '+' + d : '');
    };
    var IC = {
        tg: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21.4 4.2 2.9 11.3c-1.3.5-1.2 1.3-.2 1.6l4.7 1.5 1.8 5.6c.2.6.4.8.9.8.4 0 .6-.2.9-.5l2.3-2.2 4.8 3.5c.9.5 1.5.2 1.7-.8l3.1-14.6c.3-1.3-.5-1.9-1.5-1.5z"/></svg>',
        phone: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M17 1H7C5.9 1 5 1.9 5 3v18c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V3c0-1.1-.9-2-2-2zm-5 21c-.8 0-1.5-.7-1.5-1.5S11.2 19 12 19s1.5.7 1.5 1.5S12.8 22 12 22zm5-4H7V4h10v14z"/></svg>',
        link: '<svg viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/></svg>',
        ck: '<svg class="pfa-ck" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.3 4.3L19 7.2" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
        trash: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 3h6l1 2h4v2H4V5h4l1-2zm-3 6h12l-.8 11.1A2 2 0 0 1 15.2 22H8.8a2 2 0 0 1-2-1.9L6 9zm4 2v8h1.6v-8H10zm2.4 0v8H14v-8h-1.6z"/></svg>',
        doc: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-1 15l-4-4 1.4-1.4 2.6 2.6 5.6-5.6L18 9l-7 7z"/></svg>',
        x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>'
    };
    // Sayt manzili (privacy.html shu yerda) — ilova ham, mini app ham shu domendan ochiladi
    var SITE = (function () { try { return location.origin + location.pathname.replace(/[^/]*$/, ''); } catch (e) { return 'https://anvarjonaxtamov70.github.io/Avto_A1/'; } })();

    /* ── Tasdiqlangan raqam (users/{uid}/verify) — jonli ── */
    var VER = null, verLoaded = false, verRef = null, verUid = '';
    function watchVerify() {
        var uid = authUid(), d = DBX();
        if (!uid || !d || uid === verUid) return;
        if (verRef) { try { verRef.off(); } catch (e) {} }
        verUid = uid; verLoaded = false; VER = null;
        verRef = d.ref('users/' + uid + '/verify');
        verRef.on('value', function (s) {
            var was = !!(VER && VER.phone), first = !verLoaded;
            VER = s.val() || null; verLoaded = true;
            render();
            if (first && inTG() && !(VER && VER.phone)) setTimeout(maybePrompt, 7000);
            if (!was && VER && VER.phone && W._a1VerifyWaiting) { W._a1VerifyWaiting = false; toast('\u2705 Raqam tasdiqlandi \u2014 endi ilova va saytda shu raqam bilan kirasiz', 'success'); }
        }, function () { verLoaded = true; render(); });
    }

    /* ── Profil → «Hisob» ── */
    function row(act, icon, color, label, valHtml) {
        return '<button type="button" class="pfx-row" data-acct="' + act + '"><span class="pfx-ic" style="--ic:' + color + '">' + icon + '</span>' +
            '<span class="pfx-lbl">' + label + '</span><span class="pfx-val">' + valHtml + '</span>' + (act !== 'none' ? '<span class="pfx-chev" aria-hidden="true">\u203A</span>' : '') + '</button>';
    }
    function render() {
        var grp = $('pfx-acct'), sec = $('pfx-acct-sec'), foot = $('pfx-acct-foot');
        if (!grp) return;
        var uid = authUid();
        if (!uid) { grp.hidden = sec.hidden = foot.hidden = true; return; }
        var tgAcc = isTgUid(uid), phone = VER && VER.phone ? String(VER.phone) : '';
        var html = '';
        if (tgAcc) html += row('none', IC.tg, '#2AABEE', 'Telegram hisobi', '<span class="pfa-ok">Ulangan' + IC.ck + '</span>');
        else html += row('link', IC.link, '#2AABEE', 'Telegram hisobi', '<span class="pfa-warn">Ulash</span>');
        if (tgAcc) html += row(phone ? 'none' : 'verify', IC.phone, '#34c759', 'Telefon raqam', phone ? esc(fmtPhone(phone)) + '<span class="pfa-ok">' + IC.ck + '</span>' : (verLoaded ? '<span class="pfa-warn">Tasdiqlash</span>' : ''));
        html += row('privacy', IC.doc, '#8e8e93', 'Maxfiylik siyosati', '');
        // Admin hisobi ilova ichidan o'chirilmaydi (do'kon boshqaruvi yo'qolmasin)
        if (!(typeof W.isAdmin === 'function' && W.isAdmin())) html += row('delete', IC.trash, '#ff453a', '<span class="pfa-del">Hisobni o\u2018chirish</span>', '');
        grp.innerHTML = html;
        foot.textContent = tgAcc
            ? (phone ? 'Telegram, ilova va saytda bitta hisob \u2014 istalgan joyda shu raqam bilan kirasiz.' : 'Raqamni tasdiqlang: ilova va saytda shu raqam bilan Telegram hisobingizga kirasiz.')
            : 'Telegram bilan bog\u2018lang \u2014 buyurtmalar, keshbek va savat Telegram\u2019dagi mini app bilan birlashadi.';
        grp.hidden = sec.hidden = foot.hidden = false;
    }
    D.addEventListener('click', function (e) {
        var b = e.target && e.target.closest ? e.target.closest('#pfx-acct [data-acct]') : null;
        if (!b) return;
        var act = b.getAttribute('data-acct');
        hap('light');
        if (act === 'link') { if (typeof W.a1LinkTelegram === 'function') W.a1LinkTelegram(); return; }
        if (act === 'verify') { startVerify(); return; }
        if (act === 'privacy') { W.a1OpenPrivacy(); return; }
        if (act === 'delete') { deleteFlow(); return; }
    });

    /* ── 📄 Hujjat (maxfiylik siyosati) — ilova ichida ochiladi ── */
    var DOC = null;
    // ⚠️ iframe.src ni almashtirish brauzer tarixiga yozuv qo'shadi — keyin «Orqaga»
    //    ilova o'rniga yashirin iframe ichida yurardi. Shuning uchun har ochilishda
    //    YANGI iframe (birinchi yuklanish tarixga yozilmaydi), yopilganda — olib tashlanadi.
    function openDoc(url, title) {
        if (!DOC) {
            DOC = D.createElement('div'); DOC.id = 'a1doc'; DOC.setAttribute('role', 'dialog'); DOC.setAttribute('aria-modal', 'true');
            DOC.innerHTML = '<div class="ad-bar"><b></b><button type="button" aria-label="Yopish">' + IC.x + '</button></div>';
            D.body.appendChild(DOC);
            DOC.querySelector('button').onclick = closeDoc;
        }
        var old = DOC.querySelector('iframe'); if (old) old.parentNode.removeChild(old);
        var fr = D.createElement('iframe');
        fr.setAttribute('title', title || '');
        fr.setAttribute('referrerpolicy', 'no-referrer');
        fr.src = url;
        DOC.appendChild(fr);
        DOC.querySelector('b').textContent = title || '';
        DOC.classList.add('on');
        hap('light');
    }
    function closeDoc() {
        if (!DOC || !DOC.classList.contains('on')) return false;
        DOC.classList.remove('on');
        var fr = DOC.querySelector('iframe'); if (fr) fr.parentNode.removeChild(fr);
        return true;
    }
    W.a1CloseDoc = closeDoc;
    // Sahifa ilova mavzusida (qorong'i/yorug') ochiladi
    W.a1OpenPrivacy = function () {
        var th = D.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
        openDoc(SITE + 'privacy.html?theme=' + th, 'Maxfiylik siyosati');
    };

    /* ── 🗑 Hisobni o'chirish (Google Play talabi) — ikki bosqichli tasdiq ── */
    function afterDeleted() {
        toast('Hisobingiz o\u2018chirildi', 'success');
        try { localStorage.clear(); } catch (e) {}
        try { sessionStorage.clear(); } catch (e) {}
        var A = auth();
        Promise.resolve(A ? A.signOut() : null).catch(function () {}).then(function () {
            setTimeout(function () {
                if (inTG()) { try { tg.close(); return; } catch (e) {} }
                location.reload();
            }, 1400);
        });
    }
    function deleteFlow() {
        var bal = 0;
        try { bal = W.Phase2 && Phase2.balance ? Math.max(0, Math.round(Number(Phase2.balance()) || 0)) : 0; } catch (e) {}
        var step = 0;
        sheet({
            icon: IC.trash, color: '#ff453a', danger: true,
            title: 'Hisobni o\u2018chirasizmi?',
            html: 'Profil, raqam, manzillar, savat, sevimlilar, storis javoblari va ' +
                (bal ? '<b>' + fmt(bal) + ' so\u2018m keshbek</b>' : 'keshbek') + ' butunlay o\u2018chadi. ' +
                'Buyurtmalar tarixi hisob-kitob va kafolat uchun ismingiz va raqamingizsiz saqlanadi.<br><br><b>Bu amalni qaytarib bo\u2018lmaydi.</b>',
            primary: 'Hisobni o\u2018chirish', secondary: 'Bekor qilish',
            onPrimary: async function (api) {
                if (step === 0) { step = 1; api.label('Ha, butunlay o\u2018chirish'); hap('warning'); return; }
                api.error('');
                api.busy(true, 'O\u2018chirilmoqda\u2026');
                var r = null;
                try { r = W._workerPost ? await W._workerPost('/account-delete', { confirm: 'DELETE' }) : null; } catch (e) { r = null; }
                var code = r && r.resp ? r.resp.status : 0, d = (r && r.data) || {};
                if (code === 200 && d.ok) { api.close(true); afterDeleted(); return; }
                api.busy(false);
                api.error(code === 409 && d.activeOrders ? 'Faol buyurtmangiz bor \u2014 yetkazilgach yoki bekor qilingach o\u2018chira olasiz.'
                    : code === 404 ? 'Server hali yangilanmagan \u2014 do\u2018kon bilan bog\u2018laning.'
                    : 'O\u2018chirilmadi \u2014 internetni tekshirib qayta urinib ko\u2018ring.');
            }
        });
    }
    W.a1DeleteAccount = deleteFlow;

    /* ── Oyna (bottom sheet) ── */
    var SH = null;
    function sheet(o) {
        return new Promise(function (resolve) {
            if (!SH) {
                SH = D.createElement('div'); SH.id = 'a1acct'; SH.setAttribute('role', 'dialog'); SH.setAttribute('aria-modal', 'true');
                SH.innerHTML = '<div class="aa-dim"></div><div class="aa-sheet"><div class="aa-ic"></div><h3></h3><p></p><div class="aa-in"></div><button type="button" class="aa-pri"></button><button type="button" class="aa-sec"></button></div>';
                D.body.appendChild(SH);
            }
            var ic = SH.querySelector('.aa-ic'), inBox = SH.querySelector('.aa-in'), pri = SH.querySelector('.aa-pri'), sec = SH.querySelector('.aa-sec');
            ic.innerHTML = o.icon || IC.phone; ic.style.setProperty('--aa-ic', o.color || '#34c759');
            SH.querySelector('h3').textContent = o.title || '';
            SH.querySelector('p').innerHTML = o.html || '';
            inBox.innerHTML = (o.input ? '<input type="' + (o.input.type || 'text') + '" autocomplete="' + (o.input.autocomplete || 'off') + '" placeholder="' + esc(o.input.placeholder || '') + '">' : '') + '<div class="aa-err"></div>';
            pri.textContent = o.primary || 'OK'; pri.disabled = false;
            pri.classList.toggle('aa-dan', !!o.danger);
            sec.textContent = o.secondary || 'Yopish'; sec.disabled = false;
            var locked = false, closed = false;
            var close = function (v) {
                if (closed) return;
                closed = true;
                SH.classList.remove('in');
                setTimeout(function () { SH.classList.remove('on'); }, 260);
                pri.onclick = sec.onclick = null; SH.querySelector('.aa-dim').onclick = null;
                resolve(v);
            };
            var api = {
                value: function () { var i = inBox.querySelector('input'); return i ? i.value : ''; },
                error: function (t) { var e = inBox.querySelector('.aa-err'); if (e) e.textContent = t || ''; },
                busy: function (on, t) { pri.disabled = !!on; pri.textContent = on ? (t || 'Kuting\u2026') : (api.primary || o.primary || 'OK'); },
                label: function (t) { api.primary = t; pri.textContent = t; },
                // Uzib bo'lmaydigan amal ketayotganda oyna yopilmasin (Orqaga, fon, «Bekor»)
                lock: function (on) { locked = !!on; sec.disabled = locked; },
                close: close
            };
            pri.onclick = function () { if (o.onPrimary) o.onPrimary(api); else close(true); };
            sec.onclick = function () { if (!locked) close(false); };
            SH.querySelector('.aa-dim').onclick = function () { if (!locked) close(false); };
            SH.classList.add('on');
            requestAnimationFrame(function () { requestAnimationFrame(function () { SH.classList.add('in'); }); });
            hap('light');
            if (o.input) setTimeout(function () { try { inBox.querySelector('input').focus(); } catch (e) {} }, 380);
        });
    }

    /* ── Raqamni tasdiqlash ── */
    function openBotPhone() {
        var u = 'https://t.me/' + TG_BOT + '?start=phone';
        W._a1VerifyWaiting = true;
        try { if (inTG() && tg.openTelegramLink) { tg.openTelegramLink(u); return; } } catch (e) {}
        try { if (typeof W._a1OpenTelegram === 'function') { W._a1OpenTelegram(u); return; } } catch (e) {}
        try { W.open(u, '_blank'); } catch (e) {}
    }
    function canRequestContact() {
        try { return inTG() && typeof tg.requestContact === 'function' && (!tg.isVersionAtLeast || tg.isVersionAtLeast('6.9')); } catch (e) { return false; }
    }
    function startVerify() {
        if (!isTgUid(authUid())) { if (typeof W.a1LinkTelegram === 'function') W.a1LinkTelegram(); return; }
        if (!canRequestContact()) { openBotPhone(); toast('Botda \u00ab\uD83D\uDCF1 Raqamni yuborish\u00bb tugmasini bosing', 'info'); return; }
        try {
            tg.requestContact(function (shared, res) {
                if (!shared) { toast('Raqam ulashilmadi', 'info'); return; }
                W._a1VerifyWaiting = true;
                var raw = res && typeof res.response === 'string' ? res.response : '';
                if (!raw) return;   // bot kontakt xabarini o'zi tasdiqlaydi (verify tinglovchisi xabar beradi)
                post('/phone-verify', { initData: tg.initData, contact: raw }, 15000).then(function (r) {
                    if (r.status === 200 && r.data && r.data.ok) {
                        W._a1VerifyWaiting = false;
                        VER = { phone: r.data.phone }; render();
                        toast('\u2705 Raqam tasdiqlandi \u2014 endi ilova va saytda shu raqam bilan kirasiz', 'success');
                        if (r.data.legacy && r.data.legacy.method === 'password') setTimeout(function () { offerPasswordMerge(r.data.phone); }, 700);
                    }
                }, function () {});
            });
        } catch (e) { openBotPhone(); }
    }

    /* ── Ilovadagi parolli hisobni Telegram hisobiga qo'shish (paroli bilan isbotlanadi) ── */
    async function legacyTokenByPassword(phone, pass) {
        var digits = String(phone || '').replace(/[^0-9]/g, '');
        var name = 'a1legacy';
        var app2 = null;
        try { app2 = (firebase.apps || []).filter(function (a) { return a.name === name; })[0] || firebase.initializeApp(firebase.app().options, name); } catch (e) { app2 = null; }
        if (!app2) throw new Error('app');
        var A2 = app2.auth();
        try { await A2.setPersistence(firebase.auth.Auth.Persistence.NONE); } catch (e) {}
        var cred = await A2.signInWithEmailAndPassword(digits + '@tel.avtoa1.app', pass);
        var tok = await cred.user.getIdToken();
        try { await A2.signOut(); } catch (e) {}
        return tok;
    }
    function offerPasswordMerge(phone) {
        sheet({
            icon: IC.link, color: '#c9a84c',
            title: 'Ilovadagi hisobni qo\u2018shamizmi?',
            html: 'Ilova yoki saytda <b>' + esc(fmtPhone(phone)) + '</b> raqami bilan parolli hisobingiz bor. Parolini kiriting \u2014 buyurtmalar va keshbek shu Telegram hisobiga o\u2018tadi.',
            input: { type: 'password', placeholder: 'Ilovadagi parol', autocomplete: 'current-password' },
            primary: 'Birlashtirish', secondary: 'Keyinroq',
            onPrimary: async function (api) {
                var pass = api.value();
                if (pass.length < 6) { api.error('Parol kamida 6 ta belgi'); return; }
                api.error(''); api.busy(true, 'Birlashtirilmoqda\u2026');
                var tok;
                try { tok = await legacyTokenByPassword(phone, pass); }
                catch (e) {
                    api.busy(false);
                    api.error(/too-many/.test((e && e.code) || '') ? 'Juda ko\u2018p urinish \u2014 keyinroq' : /network/.test((e && e.code) || '') ? 'Internetni tekshiring' : 'Parol noto\u2018g\u2018ri');
                    return;
                }
                var r;
                try { r = await post('/merge-legacy', { initData: tg.initData, legacyIdToken: tok }, 30000); }
                catch (e) { api.busy(false); api.error('Internetni tekshiring'); return; }
                if (r.status === 200 && r.data && r.data.ok) {
                    api.close(true);
                    var d = r.data, bits = [];
                    if (d.orders) bits.push(d.orders + ' ta buyurtma');
                    if (d.cashback) bits.push(fmt(d.cashback) + ' so\u2018m keshbek');
                    hap('success');
                    toast('\uD83D\uDD17 Hisoblar birlashtirildi' + (bits.length ? ': ' + bits.join(', ') : ''), 'success');
                    return;
                }
                api.busy(false);
                api.error((r.data && r.data.error) ? String(r.data.error) : 'Birlashtirilmadi \u2014 qayta urinib ko\u2018ring');
            }
        });
    }

    /* ── Mini app: bir martalik taklif (7 kunda bir) ── */
    var prompted = false;
    function maybePrompt() {
        if (prompted || !inTG() || !verLoaded || (VER && VER.phone) || !isTgUid(authUid())) return;
        var until = 0; try { until = parseInt(localStorage.getItem(PROMPT_KEY), 10) || 0; } catch (e) {}
        if (Date.now() < until) return;
        prompted = true;
        var tries = 0;
        (function wait() {
            // Boshqa oyna ochiq bo'lsa (savat, tovar, storis) — xalaqit bermaymiz
            var busyUi = false;
            try {
                busyUi = !!(typeof activeModal !== 'undefined' && activeModal) || D.documentElement.classList.contains('a1sv-lock') ||
                    !!(D.getElementById('welcome-screen') && D.getElementById('welcome-screen').offsetParent);
            } catch (e) {}
            if (busyUi && tries++ < 20) { setTimeout(wait, 6000); return; }
            if (VER && VER.phone) return;
            try { localStorage.setItem(PROMPT_KEY, String(Date.now() + 7 * 24 * 3600 * 1000)); } catch (e) {}
            sheet({
                icon: IC.phone, color: '#34c759',
                title: 'Raqamingizni tasdiqlang',
                html: 'Bir marta tasdiqlasangiz, <b>Avto A1 ilovasi va saytida</b> shu raqam bilan Telegram hisobingizga kirasiz \u2014 buyurtmalar va keshbek hamma joyda bitta.',
                primary: 'Raqamni ulashish', secondary: 'Keyinroq'
            }).then(function (yes) { if (yes) startVerify(); });
        })();
    }

    /* ── Ulash ── */
    function onAuth() { watchVerify(); render(); }
    (function hook() {
        var A = auth();
        if (!A) { setTimeout(hook, 900); return; }
        A.onAuthStateChanged(function () { onAuth(); });
    })();
    // Kirish/hisob almashganda (finish) — tinglovchini ham, kartani ham yangilaydi
    W.a1AccountRefresh = function () { watchVerify(); render(); };
    W.a1VerifyPhone = startVerify;
    W.a1Sheet = sheet;   // boshqa oynalar ham shu pastki oynadan foydalanadi (masalan «Botni tozalash»)
    W.a1CloseSheet = function () { if (SH && SH.classList.contains('on')) { var b = SH.querySelector('.aa-sec'); if (b) b.click(); return true; } return false; };
})();
