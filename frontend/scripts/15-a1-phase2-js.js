
/* ============================================================
   AVTO A1 — PHASE 2 MODULE
   🎁 Bonus/Cashback · 🏆 Achievement · 📊 Analitika ·
   🔔 Bildirishnomalar · 🌙 Dark/Light · 🛡 Kafolat
   ------------------------------------------------------------
   Mavjud ilovaga minimal teginish bilan integratsiya qilingan.
   Tashqi global'lar: firebase, window.currentUser, showToast,
   openModal, closeModal, _hap.  Hech biri majburiy emas (guard bor).
   ============================================================ */
(function () {
    'use strict';
    if (window.Phase2) return;

    /* ----------------------- Sozlamalar ----------------------- */
    var LS_KEY = 'avto_phase2';
    // 💳 CASHBACK ULUSHI — mijoz DARAJASIGA bog'liq (2026.09):
    //      Oddiy mijoz — 0.8%      VIP mijoz — 1%
    //    Ilgari bu bitta 1% edi va daraja umuman ta'sir qilmasdi
    //    (`VIP.cashbackMultiplier()` yozilgan, lekin chaqirilmagan).
    //    Haqiqiy qiymatlar `VIP.TIERS[].rate` da — bu yerda faqat zaxira.
    var CASHBACK_RATE = 0.008;    // zaxira/standart ulush (VIP qatlami yuklanmasa)

    /** Joriy mijoz uchun HAQIQIY ulush. VIP qatlami bo'lmasa — standart. */
    function cashbackRate() {
        try {
            if (window.VIP && window.VIP.cashbackRate) return window.VIP.cashbackRate();
        } catch (e) {}
        return CASHBACK_RATE;
    }

    /** Buyurtma uchun ulush: buyurtmada SAQLANGAN ulush ustuvor.
     *
     *  ⚠️ NEGA MUHIM: cashback yetkazilganda beriladi, ya'ni xariddan
     *  kunlar keyin. Agar o'sha paytdagi darajaga qarab hisoblasak,
     *  to'lov vaqtida «1% qaytadi» deb ko'rsatib, keyin 0.8% berib
     *  qo'yishimiz mumkin edi. Endi va'da qilingan ulush buyurtmaga
     *  yoziladi (`cbRate`) va aynan o'sha qo'llanadi. */
    function rateForOrder(o) {
        var r = o && Number(o.cbRate);
        if (isFinite(r) && r > 0 && r <= 0.5) return r;
        return cashbackRate();
    }
    window._cashbackRate = cashbackRate;
    var WARRANTY_DAYS = 14;       // standart kafolat muddati (kun)
    var DAY = 86400000;
    var reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

    /* ----------------------- Holat ----------------------- */
    function defaultState() {
        return {
            theme: 'dark',
            // 💰 CASHBACK LEGERI (MUHIM):
            //   cashbackTotal — umr bo'yi YIG'ILGAN (faqat o'sadi)
            //   cashbackSpent — umr bo'yi SARFLANGAN (faqat o'sadi)
            //   cashback      — HISOBLANADIGAN balans = cashbackTotal − cashbackSpent
            // Nega shunday: ilgari `cashback` to'g'ridan saqlanib, sinxronlashda
            // Math.max bilan birlashtirilardi. Math.max balansni FAQAT ko'tarardi —
            // ya'ni sarflash (kamayish) darhol "tirilib" qaytardi va cashbackni
            // ishlatish PRINSIPIAL imkonsiz edi. Ikki monoton hisoblagich esa
            // Math.max bilan xavfsiz birlashadi, balans esa ulardan chiqariladi.
            //   cashbackRefunded — umr bo'yi QAYTARILGAN (faqat o'sadi)
            //     Bekor qilingan buyurtmada ishlatilgan cashback shu yerga tushadi.
            //     ⚠️ NEGA ALOHIDA HISOBLAGICH: qaytarishni `cashbackTotal` ga
            //     qo'shib bo'lmaydi — u "umr bo'yi YIG'ILGAN" degan ma'noni
            //     bildiradi va profilda "Jami yig'ilgan" sifatida ko'rinadi,
            //     yutuqlar (cashback_100k) ham shundan hisoblanadi. Qaytarilgan
            //     pulni unga qo'shsak, mijoz hech narsa yig'masdan yutuq olardi.
            //     `cashbackSpent` ni kamaytirish ham mumkin emas: P.sync uni
            //     Math.max bilan birlashtiradi, ya'ni kamaytirish darhol
            //     "tirilib" qaytadi. Uchinchi MONOTON hisoblagich esa
            //     Math.max bilan xavfsiz birlashadi.
            //   balans = cashbackTotal + cashbackRefunded − cashbackSpent
            cashback: 0,
            cashbackTotal: 0,
            cashbackSpent: 0,
            cashbackRefunded: 0,
            cashbackHistory: [],
            achievements: {},   // {id: unlockedTimestamp}
            achSeen: 0,         // foydalanuvchi ko'rgan yutuqlar soni (badge uchun)
            // {orderId: {t, cb, st}} — cashback/kafolat berilgan buyurtmalar.
            //   st: 'yetkazildi' (berilgan) | 'bekor' (qaytarib olingan)
            processedOrders: {},
            notifications: [],  // [{id, icon, title, text, date, read}]
            warranties: [],     // [{id, name, code, start, days, qty, notified}]
            themeSwitched: false
        };
    }

    var P = {
        uid: null,
        productsDB: [],
        orders: [],
        wishlistCount: 0,
        state: defaultState(),
        adminNotifications: [],
        _adminNotificationReads: {},
        _adminNotificationUid: null,
        _adminNotificationRefs: null,
        _writing: false,
        _unlockQueue: []
    };
    window.Phase2 = P;

    /* ----------------------- Yordamchilar ----------------------- */
    function hasFB() { return typeof firebase !== 'undefined' && firebase.database; }
    function toast(m, t) { if (typeof showToast === 'function') showToast(m, t); }
    function hap(k) { if (typeof window._hap === 'function') window._hap(k); }
    function fmtSom(n) { return Math.round(n || 0).toLocaleString('ru-RU').replace(/,/g, ' '); }
    function fmtShort(n) {
        n = n || 0;
        if (n >= 1000000) return (n / 1000000).toFixed(n % 1000000 === 0 ? 0 : 1).replace('.0', '') + 'M';
        if (n >= 1000) return Math.round(n / 1000) + 'K';
        return String(n);
    }
    function toArray(v) { return Array.isArray(v) ? v : (v && typeof v === 'object' ? Object.values(v) : []); }
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }

    /* ----------------------- Yangi (fresh) ma'lumot manbalari -----------------------
       Asosiy ilovadagi myOrders/productsDB/wishlist 'let' bilan e'lon qilingani uchun
       ularni window orqali jonli o'qiymiz. Bu modal ochilganda har doim eng so'nggi
       ma'lumot bilan ishlashni kafolatlaydi (sync vaqtidan qat'i nazar).            */
    function getOrders() {
        if (Array.isArray(window.myOrders)) { P.orders = window.myOrders; return window.myOrders; }
        return Array.isArray(P.orders) ? P.orders : [];
    }
    function getProducts() {
        if (Array.isArray(window.productsDB) && window.productsDB.length) { P.productsDB = window.productsDB; return window.productsDB; }
        return Array.isArray(P.productsDB) ? P.productsDB : [];
    }
    function getWishCount() {
        if (typeof window.a1WishItems === 'function') { var wi = window.a1WishItems(); if (wi) return wi.length; }
        if (Array.isArray(window.wishlist)) return window.wishlist.length;
        return P.wishlistCount || 0;
    }

    /* ----------------------- Saqlash ----------------------- */
    function saveLocal() {
        try { localStorage.setItem(LS_KEY, JSON.stringify(P.state)); } catch (e) {}
    }
    function loadLocal() {
        try {
            var raw = localStorage.getItem(LS_KEY);
            if (raw) P.state = Object.assign(defaultState(), JSON.parse(raw));
        } catch (e) {}
    }
    function saveRemote() {
        if (!P.uid || !hasFB()) return Promise.resolve();
        P._writing = true;
        try {
            // 🔒 SERVER-AUTHORITATIVE: pul maydonlari (cashbackTotal/Spent/Refunded/
            //    cashback, loyaltyProjection, processedOrders ...) SERVER
            //    tomonidan (Worker) yoziladi. Yangi database.rules.json mijozga faqat
            //    KOSMETIK / jurnal maydonlarini yozishga ruxsat beradi. Shuning uchun
            //    `.set(butun state)` O'RNIGA faqat ruxsat etilgan kalitlarni `.update()`
            //    qilamiz (aks holda multi-path update TO'LIQ rad etilardi).
            var s = P.state || {};
            var patch = {};
            if (typeof s.theme !== 'undefined') patch.theme = s.theme;
            if (typeof s.themeSwitched !== 'undefined') patch.themeSwitched = !!s.themeSwitched;
            if (typeof s.lang !== 'undefined') patch.lang = s.lang;
            if (typeof s.wishlistCount !== 'undefined') patch.wishlistCount = s.wishlistCount;
            // Jurnallar serverdagi holat bir marta o'qilgandan KEYIN yoziladi: aks holda
            // admin tozalagan (phase2.resetAt) eski bildirishnoma/keshbek tarixi
            // telefondagi nusxadan serverga qaytib yozilishi mumkin edi.
            if (P._remoteSeen && typeof s.notifications !== 'undefined') patch.notifications = clean(s.notifications);
            if (P._remoteSeen && typeof s.cashbackHistory !== 'undefined') patch.cashbackHistory = clean(s.cashbackHistory);
            return firebase.database().ref('users/' + P.uid + '/phase2').update(patch)
                .then(function () { P._writing = false; })
                .catch(function () { P._writing = false; });
        } catch (e) { P._writing = false; return Promise.resolve(); }
    }
    // 🔐 Firebase yozuvi TUGASHINI kutish uchun (tg.close() oldidan ishlatiladi).
    // Telegramda ilova tez yopilgani uchun cashback yo'qolmasligi shu orqali kafolatlanadi.
    P.flush = function () {
        saveLocal();
        try { return saveRemote() || Promise.resolve(); } catch (e) { return Promise.resolve(); }
    };
    function save() { saveLocal(); saveRemote(); }
    function clean(obj) { try { return JSON.parse(JSON.stringify(obj)); } catch (e) { return obj; } }

    /* ============================================================
       🌙 1. DARK / LIGHT THEME
       ============================================================ */
    function applyTheme(t) {
        document.documentElement.setAttribute('data-theme', t === 'light' ? 'light' : 'dark');
        var btn = document.getElementById('p2-theme-btn');
        if (btn) btn.textContent = t === 'light' ? '🌙' : '☀️';
        // Telegram header rangini ham moslashtiramiz (mavjud bo'lsa)
        try {
            if (window.tg && tg.setHeaderColor) tg.setHeaderColor(t === 'light' ? '#eef1f6' : '#000000');
            if (window.tg && tg.setBackgroundColor) tg.setBackgroundColor(t === 'light' ? '#e9edf3' : '#000000');
        } catch (e) {}
    }

    P.toggleTheme = function (ev) {
        var next = (P.state.theme === 'light') ? 'dark' : 'light';
        P.state.theme = next;
        if (!P.state.themeSwitched) { P.state.themeSwitched = true; }
        rippleTheme(ev, next);
        hap('selection');
        save();
        setTimeout(evaluateAchievements, 60);
    };

    function rippleTheme(ev, next) {
        if (reduceMotion || !ev) { applyTheme(next); return; }
        var x = (ev.clientX != null) ? ev.clientX : window.innerWidth - 35;
        var y = (ev.clientY != null) ? ev.clientY : 35;
        var bg = (next === 'light') ? '#eef1f6' : '#0a0a0c';
        var r = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
        var el = document.createElement('div');
        el.id = 'p2-theme-ripple';
        el.style.cssText = 'left:' + (x - r) + 'px;top:' + (y - r) + 'px;width:' + (2 * r) + 'px;height:' + (2 * r) + 'px;background:' + bg + ';opacity:1;transition:transform .5s cubic-bezier(.2,.8,.2,1),opacity .35s ease .35s;';
        document.body.appendChild(el);
        // reflow keyin theme'ni almashtirib, ripple ostida silliq o'tkazamiz
        requestAnimationFrame(function () {
            el.style.transform = 'scale(1)';
            setTimeout(function () { applyTheme(next); }, 230);
            setTimeout(function () { el.style.opacity = '0'; }, 520);
            setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 900);
        });
    }

    /* ============================================================
       🔔 5. BILDIRISHNOMALAR
       ============================================================ */
    function pushNotif(icon, title, text, opts) {
        opts = opts || {};
        // 🧹 DUBLIKATGA QARSHI: ilgari har sync'da bir xil ogohlantirish qayta
        // qo'shilardi (kafolat «notified» bayrog'i serverda saqlanmaydi).
        // Endi: barqaror kalit (opts.key) yoki aynan bir xil sarlavha+matn bo'lsa — qo'shilmaydi.
        if ((P.state.notifications || []).some(function (n) {
            return n && ((opts.key && n.id === opts.key) || (n.title === title && n.text === text));
        })) return;
        P.state.notifications.unshift({
            id: opts.key || ('n' + Date.now() + Math.floor(Math.random() * 999)),
            icon: icon, title: title, text: text, date: Date.now(), read: false
        });
        if (P.state.notifications.length > 60) P.state.notifications.length = 60;
        if (!opts.silent) save();
        updateBell(true);
    }
    function allNotifications() {
        return (P.adminNotifications || []).concat(P.state.notifications || []).sort(function (a, b) {
            return Number(b.date || 0) - Number(a.date || 0);
        });
    }
    function unreadCount() { return allNotifications().filter(function (n) { return !n.read; }).length; }
    function updateBell(ring) {
        var badge = document.getElementById('p2-bell-badge');
        var c = unreadCount();
        if (badge) {
            badge.textContent = c > 9 ? '9+' : c;
            badge.classList.toggle('show', c > 0);
        }
        if (ring) {
            var b = document.getElementById('p2-bell-btn');
            if (b && !reduceMotion) { b.classList.remove('p2-bell-ring'); void b.offsetWidth; b.classList.add('p2-bell-ring'); }
        }
        var tb = document.getElementById('p2-tile-notif-badge');
        if (tb) { tb.textContent = c > 9 ? '9+' : c; tb.classList.toggle('show', c > 0); }
    }
    function markAdminNotificationsRead(items) {
        if (!P.uid || !hasFB() || !window.isAdmin || !window.isAdmin()) return Promise.resolve();
        var patch = {};
        var targets = [];
        (items || P.adminNotifications || []).forEach(function (n) {
            if (n && n._admin && !n.read && n.id) {
                patch[n.id] = true;
                targets.push(n);
            }
        });
        if (!Object.keys(patch).length) return Promise.resolve();
        return firebase.database().ref('admin_notification_reads/' + P.uid).update(patch).then(function () {
            // UI faqat server receipt tasdiqlagandan KEYIN o'qilgan ko'rinadi.
            targets.forEach(function (n) {
                n.read = true;
                P._adminNotificationReads[n.id] = true;
            });
            updateBell(false);
            renderNotifs();
        }).catch(function (e) {
            if (window._dwarn) window._dwarn('[admin-notifications] o\'qilgan holat yozilmadi:', e);
            updateBell(false);
            renderNotifs();
        });
    }
    function startAdminNotifications() {
        if (!P.uid || !hasFB() || !window.isAdmin || !window.isAdmin()) return;
        if (P._adminNotificationUid === P.uid) return;
        if (P._adminNotificationRefs) {
            try { P._adminNotificationRefs.events.off(); P._adminNotificationRefs.reads.off(); } catch (e) {}
        }
        P._adminNotificationUid = P.uid;
        var eventsRef = firebase.database().ref('admin_notifications').orderByChild('createdAt').limitToLast(200);
        var readsRef = firebase.database().ref('admin_notification_reads/' + P.uid);
        P._adminNotificationRefs = { events: eventsRef, reads: readsRef };
        var events = {};
        var reads = {};
        function applyAdminNotifications(ring) {
            var previousUnread = (P.adminNotifications || []).filter(function (n) { return !n.read; }).length;
            P._adminNotificationReads = reads;
            P.adminNotifications = Object.keys(events || {}).map(function (key) {
                var item = events[key] || {};
                return {
                    id: item.id || key,
                    icon: item.type === 'new_customer' ? '🆕' : '🔔',
                    title: item.title || 'Admin bildirishnomasi',
                    text: item.text || '',
                    date: Number(item.createdAt) || Date.now(),
                    read: reads[item.id || key] === true,
                    _admin: true
                };
            });
            var nextAdminUnread = P.adminNotifications.filter(function (n) { return !n.read; }).length;
            updateBell(ring && nextAdminUnread > previousUnread);
            var modal = document.getElementById('p2NotifModal');
            if (modal && !modal.classList.contains('hidden')) renderNotifs();
        }
        eventsRef.on('value', function (snap) {
            events = snap.val() || {};
            applyAdminNotifications(true);
        }, function (e) {
            if (window._dwarn) window._dwarn('[admin-notifications] o\'qilmadi:', e);
        });
        readsRef.on('value', function (snap) {
            reads = snap.val() || {};
            applyAdminNotifications(false);
        });
    }
    P.markAllRead = function () {
        P.state.notifications.forEach(function (n) { n.read = true; });
        markAdminNotificationsRead(P.adminNotifications);
        save(); updateBell(false); renderNotifs();
    };
    /* ——— 🍏 iOS 26 bildirishnoma markazi ———
       • Kun bo'yicha guruhlar (Bugun / Kecha / Oxirgi 7 kun / Avvalroq)
       • Har tur uchun rangli iOS ikonka (emoji o'rniga)
       • Bir xil xabarlar iOS kabi «stack» bo'lib bitta kartaga yig'iladi
       • Chapga surib o'chirish (faqat shaxsiy xabarlar) */
    var NF_SVG = {
        gift: '<path d="M20 12v9H4v-9"/><path d="M2 7h20v5H2z"/><path d="M12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 1 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 1 0 0-5C13 2 12 7 12 7z"/>',
        undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
        shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M12 8v4"/><path d="M12 16h.01"/>',
        user: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/>',
        truck: '<path d="M1 4h14v12H1z"/><path d="M15 9h4l3 3v4h-7V9z"/><circle cx="5.5" cy="18.5" r="2"/><circle cx="18.5" cy="18.5" r="2"/>',
        trophy: '<path d="M8 21h8M12 17v4"/><path d="M7 4h10v5a5 5 0 0 1-10 0V4z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>',
        users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
        bell: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>'
    };
    function nfKind(x) {
        var i = String(x.icon || ''), t = String(x.title || '');
        if (i.indexOf('🎁') > -1 || /cashback/i.test(t) && i.indexOf('↩') < 0) return ['gift', '#d4a72c'];
        if (i.indexOf('↩') > -1) return ['undo', '#ff453a'];
        if (i.indexOf('🛡') > -1) return ['shield', '#ff9f0a'];
        if (i.indexOf('🆕') > -1) return ['user', '#0a84ff'];
        if (i.indexOf('🏁') > -1 || /yetkaz/i.test(t)) return ['truck', '#30d158'];
        if (i.indexOf('🏆') > -1) return ['trophy', '#bf5af2'];
        return ['bell', '#c9a84c'];
    }
    function nfDayStart(ts) { var d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime(); }
    function nfBucket(ts) {
        var t0 = nfDayStart(Date.now()), d = nfDayStart(ts);
        if (d >= t0) return 'Bugun';
        if (d >= t0 - DAY) return 'Kecha';
        if (d >= t0 - DAY * 6) return 'Oxirgi 7 kun';
        return 'Avvalroq';
    }
    function nfTime(ts, bucket) {
        var d = Date.now() - ts, dt = new Date(ts);
        var hm = ('0' + dt.getHours()).slice(-2) + ':' + ('0' + dt.getMinutes()).slice(-2);
        if (bucket === 'Bugun') {
            if (d < 60000) return 'hozir';
            if (d < 3600000) return Math.floor(d / 60000) + ' daq oldin';
            return hm;
        }
        if (bucket === 'Kecha') return hm;
        return ('0' + dt.getDate()).slice(-2) + '.' + ('0' + (dt.getMonth() + 1)).slice(-2) + (dt.getFullYear() !== new Date().getFullYear() ? '.' + dt.getFullYear() : '');
    }
    function nfDedupeKey(n) {
        // Kafolat ogohlantirishida faqat «N kun» farq qiladi — bitta deb hisoblaymiz
        var t = String(n.text || '');
        if (n.title === 'Qaytarish muddati tugayapti') t = t.replace(/\d+\s*kundan/, '#kundan');
        return (n._admin ? 'a|' : 'u|') + n.title + '|' + t;
    }
    function dedupeLocalNotifs() {
        var seen = {}, before = (P.state.notifications || []).length;
        P.state.notifications = (P.state.notifications || []).filter(function (n) {
            if (!n) return false;
            var k = nfDedupeKey(n);
            if (seen[k]) return false;
            seen[k] = 1; return true;
        });
        return P.state.notifications.length !== before;
    }
    function renderNotifs() {
        var box = document.getElementById('p2-notif-list');
        if (!box) return;
        var n = allNotifications(), fresh = P._nfFresh || {};
        var sum = document.getElementById('p2-nf-sum');
        var newCount = n.filter(function (x) { return !x.read || fresh[x.id]; }).length;
        if (sum) sum.textContent = n.length ? (newCount ? newCount + ' ta yangi' : 'Hammasi o\u2018qilgan') : '';
        var mk = document.querySelector('#p2NotifModal .p2-markall-btn');
        if (mk) mk.style.display = n.some(function (x) { return !x.read; }) ? '' : 'none';
        if (!n.length) {
            box.innerHTML = '<div class="a1-empty"><span class="a1-empty-ic"><svg viewBox="0 0 24 24" aria-hidden="true">' + NF_SVG.bell + '</svg></span>' +
                '<b>Bildirishnoma yo\u2018q</b><p>Buyurtma holati, cashback va kafolat haqidagi xabarlar shu yerda chiqadi.</p></div>';
            return;
        }
        // Guruhlash: kun → bir xil xabarlar «stack»
        var groups = [], gmap = {};
        n.forEach(function (x) {
            var b = nfBucket(Number(x.date) || 0);
            if (!gmap[b]) { gmap[b] = { name: b, items: [], idx: {} }; groups.push(gmap[b]); }
            var g = gmap[b], k = nfDedupeKey(x);
            if (g.idx[k] != null) { g.items[g.idx[k]].dup.push(x); return; }
            g.idx[k] = g.items.length; g.items.push({ x: x, dup: [] });
        });
        var i = 0, anyLocal = false;
        var html = groups.map(function (g) {
            return '<div class="nf-day">' + g.name + '</div>' + g.items.map(function (it) {
                var x = it.x, all = [x].concat(it.dup), kind = nfKind(x);
                var isNew = all.some(function (y) { return !y.read || fresh[y.id]; });
                var local = !x._admin; if (local) anyLocal = true;
                var ids = all.map(function (y) { return String(y.id).replace(/[^\w-]/g, ''); }).join(',');
                return '<div class="nf-wrap' + (it.dup.length ? ' is-stack' : '') + '" style="--d:' + Math.min(i++, 12) + '" data-ids="' + ids + '" data-local="' + (local ? 1 : 0) + '">' +
                    (local ? '<div class="nf-del">O\u2018chirish</div>' : '') +
                    '<div class="nf' + (isNew ? ' is-new' : '') + '">' +
                    '<div class="nf-ic" style="--ic:' + kind[1] + '"><svg viewBox="0 0 24 24" aria-hidden="true">' + NF_SVG[kind[0]] + '</svg></div>' +
                    '<div class="nf-main"><div class="nf-top"><div class="nf-title">' + esc(x.title) + '</div>' +
                    (it.dup.length ? '<em class="nf-count">' + (it.dup.length + 1) + '</em>' : '') +
                    '<span class="nf-time">' + nfTime(Number(x.date) || 0, g.name) + '</span></div>' +
                    '<div class="nf-text">' + esc(x.text) + '</div></div></div></div>';
            }).join('');
        }).join('');
        if (anyLocal) html += '<p class="nf-hint">Xabarni o\u2018chirish uchun chapga suring</p>' +
            '<button type="button" class="nf-clear" onclick="Phase2.clearReadNotifs()">O\u2018qilganlarni tozalash</button>';
        box.innerHTML = html;
        bindNotifSwipe(box);
    }
    function bindNotifSwipe(box) {
        if (box._a1Swipe) return; box._a1Swipe = true;
        var el = null, wrap = null, x0 = 0, y0 = 0, dx = 0, lock = null;
        box.addEventListener('touchstart', function (e) {
            var w = e.target.closest && e.target.closest('.nf-wrap[data-local="1"]');
            if (!w || !e.touches || !e.touches[0]) { el = null; return; }
            wrap = w; el = w.querySelector('.nf'); x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; dx = 0; lock = null;
        }, { passive: true });
        box.addEventListener('touchmove', function (e) {
            if (!el || !e.touches || !e.touches[0]) return;
            var mx = e.touches[0].clientX - x0, my = e.touches[0].clientY - y0;
            if (lock === null) { if (Math.abs(mx) < 8 && Math.abs(my) < 8) return; lock = Math.abs(mx) > Math.abs(my) * 1.2 ? 'x' : 'y'; if (lock === 'x') el.style.transition = 'none'; }
            if (lock !== 'x') return;
            dx = Math.min(0, mx);
            el.style.transform = 'translateX(' + dx + 'px)';
            var del = wrap.querySelector('.nf-del'); if (del) del.style.opacity = Math.min(1, -dx / 50);
        }, { passive: true });
        function end() {
            if (!el) return;
            var e1 = el, w1 = wrap; el = null; e1.style.transition = '';
            if (lock === 'x' && dx < -Math.min(110, e1.offsetWidth * 0.32)) {
                e1.style.transform = 'translateX(-115%)';
                w1.style.overflow = 'hidden'; w1.style.height = w1.offsetHeight + 'px';
                requestAnimationFrame(function () { requestAnimationFrame(function () { w1.style.height = '0px'; w1.style.marginBottom = '0px'; w1.style.opacity = '0'; }); });
                try { if (window._hap) window._hap('light'); } catch (er) {}
                setTimeout(function () { P.deleteNotifs((w1.getAttribute('data-ids') || '').split(',')); }, 330);
            } else {
                e1.style.transform = '';
                var del = w1.querySelector('.nf-del'); if (del) del.style.opacity = '';
            }
        }
        box.addEventListener('touchend', end, { passive: true });
        box.addEventListener('touchcancel', end, { passive: true });
    }
    P.deleteNotifs = function (ids) {
        var set = {}; (ids || []).forEach(function (i) { if (i) set[i] = 1; });
        P.state.notifications = (P.state.notifications || []).filter(function (n) { return !(n && set[String(n.id).replace(/[^\w-]/g, '')]); });
        save(); updateBell(false); renderNotifs();
    };
    P.clearReadNotifs = function () {
        var go = function () {
            P.state.notifications = (P.state.notifications || []).filter(function (n) { return n && !n.read; });
            P._nfFresh = {};
            save(); updateBell(false); renderNotifs();
            try { if (window._hap) window._hap('success'); } catch (er) {}
        };
        var w = (typeof tg !== 'undefined' && tg) ? tg : null;
        try { if (w && w.showConfirm && w.isVersionAtLeast && w.isVersionAtLeast('6.2')) { w.showConfirm("O\u2018qilgan bildirishnomalar o\u2018chirilsinmi?", function (ok) { if (ok) go(); }); return; } } catch (er) {}
        if (window.confirm("O\u2018qilgan bildirishnomalar o\u2018chirilsinmi?")) go();
    };
    P.openNotifs = function () {
        if (dedupeLocalNotifs()) save();
        // Ochilgan paytdagi «yangi»larni eslab qolamiz — o'qilgan deb belgilansa ham
        // shu ochilish davomida tilla bilan ajralib turadi (iOS kabi).
        P._nfFresh = {};
        allNotifications().forEach(function (x) { if (!x.read) P._nfFresh[x.id] = 1; });
        renderNotifs();
        if (typeof openModal === 'function') openModal('p2NotifModal');
        setTimeout(function () {
            P.state.notifications.forEach(function (n) { n.read = true; });
            markAdminNotificationsRead(P.adminNotifications);
            save(); updateBell(false); renderNotifs();
        }, 900);
    };

    /* ============================================================
       🎁 2. BONUS / CASHBACK
       ============================================================ */
    /** Balansni ikki monoton hisoblagichdan qayta hisoblaydi (manba — leger). */
    function recalcBalance() {
        var earned = parseInt(P.state.cashbackTotal, 10) || 0;
        var spent = parseInt(P.state.cashbackSpent, 10) || 0;
        var refunded = parseInt(P.state.cashbackRefunded, 10) || 0;
        P.state.cashbackTotal = earned;
        P.state.cashbackSpent = spent;
        P.state.cashbackRefunded = refunded;
        P.state.cashback = Math.max(0, earned + refunded - spent);
        return P.state.cashback;
    }
    P.recalcBalance = recalcBalance;
    P.balance = function () { return recalcBalance(); };

    function addCashback(amount, note, type) {
        amount = Math.round(amount);
        if (!amount || amount < 0) return;
        // 🔒 SERVER-OWNED PUL: cashbackTotal/cashbackSpent/cashbackRefunded
        //    endi FAQAT server (Worker /order-commit, /order-status) tomonidan
        //    yoziladi va P.sync ularni serverdan o'qiydi. Ilgari bu funksiya
        //    o'sha hisoblagichlarni MAHALLIY oshirardi — natijada reconcileOrders
        //    server bergan cashback ustiga yana qo'shib, balans IKKI MARTA
        //    ko'rinardi. Endi bu yerda pul hisoblagichlariga TEGILMAYDI; faqat
        //    ko'rsatuv jurnali (cashbackHistory) yangilanadi.
        try {
            if (!Array.isArray(P.state.cashbackHistory)) P.state.cashbackHistory = [];
            P.state.cashbackHistory.unshift({ date: Date.now(), amount: amount, type: type || 'earn', note: note || '' });
            if (P.state.cashbackHistory.length > 80) P.state.cashbackHistory.length = 80;
        } catch (e) {}
        recalcBalance();
    }

    /**
     * Cashbackni SARFLASH — to'lov paytida chaqiriladi.
     * @returns {number} haqiqatda sarflangan summa (balansdan oshmaydi)
     */
    P.spendCashback = function (amount, note) {
        amount = Math.round(parseInt(amount, 10) || 0);
        var avail = recalcBalance();
        if (amount > avail) amount = avail;
        if (amount <= 0) return 0;
        addCashback(amount, note || 'Buyurtmada ishlatildi', 'spend');
        save();
        return amount;
    };
    /**
     * Bekor qilingan buyurtmada sarflangan cashbackni qaytarish (save QILMAYDI).
     * reconcileOrders tsikli ichida ishlatiladi — yozish tsikl oxirida bir marta.
     * @returns {number} qaytarilgan summa
     */
    function refundSpent(amount, note) {
        amount = Math.round(parseInt(amount, 10) || 0);
        if (amount <= 0) return 0;
        addCashback(amount, note || 'Bekor qilingan buyurtma — cashback qaytarildi', 'refund');
        return amount;
    }
    /**
     * Ommaviy API — tashqi kod uchun (darhol saqlaydi).
     * ⚠️ Ilgari bu funksiya YOZILGAN, lekin HECH QAYERDAN CHAQIRILMAGAN edi
     *    (o'lik kod) — shu sababli bekor qilingan buyurtmadagi cashback
     *    mijozga qaytmasdi. Endi bir xil mantiq `refundSpent` da va
     *    reconcileOrders undan foydalanadi.
     */
    P.refundSpentCashback = function (amount, note) {
        var n = refundSpent(amount, note);
        if (n > 0) save();
        return n;
    };

    P.openCashback = function () {
        var box = document.getElementById('p2-cashback-body');
        if (box) {
            var h = P.state.cashbackHistory || [];
            var CB_I = {
                gift: '<path d="M20 12v9H4v-9"/><path d="M2 7h20v5H2z"/><path d="M12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 1 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 1 0 0-5C13 2 12 7 12 7z"/>',
                cart: '<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.6 12.4a2 2 0 0 0 2 1.6h8.8a2 2 0 0 0 2-1.6L22 7H6"/>',
                undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
                info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>'
            };
            var sv = function (k) { return '<svg viewBox="0 0 24 24" aria-hidden="true">' + CB_I[k] + '</svg>'; };
            var MON = ['yan', 'fev', 'mar', 'apr', 'may', 'iyun', 'iyul', 'avg', 'sen', 'okt', 'noy', 'dek'];
            var dd = function (ts) { var d = new Date(ts); return d.getDate() + '-' + MON[d.getMonth()] + (d.getFullYear() !== new Date().getFullYear() ? ' ' + d.getFullYear() : ''); };
            var stats = [['' + fmtSom(P.state.cashbackTotal), 'Jami yig\u2018ilgan', '']];
            if (P.state.cashbackSpent > 0) stats.push([fmtSom(P.state.cashbackSpent), 'Sarflangan', '']);
            if (P.state.cashbackRefunded > 0) stats.push(['+' + fmtSom(P.state.cashbackRefunded), 'Qaytgan', 'is-up']);
            box.innerHTML = '<div class="a1-in">' +
                '<div class="a1-hero cb-hero" style="--d:0"><div class="cb-hero-ic">' + sv('gift') + '</div><div class="cb-lbl">Cashback balansi</div>' +
                '<div class="cb-bal">' + fmtSom(P.state.cashback) + ' <small>so\u2018m</small></div>' +
                '<div class="cb-rate">Har xariddan ' + (+(cashbackRate() * 100).toFixed(2)) + '% qaytadi</div>' +
                '<div class="cb-stats" style="--n:' + stats.length + '">' + stats.map(function (x) { return '<div class="cb-stat"><b class="' + x[2] + '">' + x[0] + '</b><span>' + x[1] + '</span></div>'; }).join('') + '</div></div>' +
                '<div class="a1-grp" style="--d:1;margin-top:12px"><div class="a1-row static" style="align-items:flex-start"><span class="a1-ic" style="--ic:#0a84ff">' + sv('info') + '</span>' +
                '<span class="a1-t" style="font-size:14.5px;line-height:1.42">Cashback buyurtma <b>qo\u2018lingizga yetkazilgach</b> hisobingizga tushadi. Keyingi xaridda <b>to\u2018lov oynasida</b> to\u2018g\u2018ridan-to\u2018g\u2018ri ishlatasiz.</span></div></div>' +
                '<div style="--d:2"><div class="a1-sec">Tarix</div>' +
                (h.length ? '<div class="a1-grp">' + h.map(function (x) {
                    var sp = x.type === 'spend', rf = x.type === 'refund';
                    var k = sp ? ['cart', '#ff453a'] : (rf ? ['undo', '#0a84ff'] : ['gift', '#d4a72c']);
                    var note = x.note || (sp ? 'To\u2018lovda ishlatildi' : 'Cashback');
                    return '<div class="a1-row static"><span class="a1-ic" style="--ic:' + k[1] + '">' + sv(k[0]) + '</span>' +
                        '<span class="a1-t" style="font-size:15px">' + esc(note) + '<small>' + dd(x.date) + '</small></span>' +
                        '<span class="cb-amt ' + (sp ? 'is-minus' : 'is-plus') + '">' + (sp ? '\u2212' : '+') + fmtSom(x.amount) + '</span></div>';
                }).join('') + '</div>'
                    : '<div class="a1-empty" style="padding-top:26px"><span class="a1-empty-ic">' + sv('gift') + '</span><b>Hali cashback yo\u2018q</b><p>Birinchi xaridingizni qiling — har buyurtmadan bonus yig\u2018iladi.</p></div>') +
                '</div></div>';
        }
        if (typeof openModal === 'function') openModal('p2CashbackModal');
    };

    /* ============================================================
       🛡 7. KAFOLAT KUZATUVI
       ============================================================ */
    // ⚠ Buyurtma ID endi «1729…-ab12cd34ef56» ko'rinishida (server) — matn.
    //    Ilgari `start = order.id` olinardi va «matn + son» qo'shilib, kafolat
    //    oynasida «NaN kun», «NaN-undefined» chiqardi. Endi haqiqiy vaqt olinadi.
    function tsOf(v) {
        if (typeof v === 'number' && isFinite(v) && v > 0) return v;
        var n = parseInt(String(v == null ? '' : v), 10);
        return (isFinite(n) && n > 1e11) ? n : 0;
    }
    function orderStart(o) { return tsOf(o && o.createdAt) || tsOf(o && o.id) || Date.now(); }
    function fixWarranties() {
        (P.state.warranties || []).forEach(function (w) { if (w && typeof w.start !== 'number') w.start = tsOf(w.start) || Date.now(); });
    }
    function createWarranties(order) {
        if (!order || !order.items) return;
        var start = orderStart(order);
        Object.keys(order.items).forEach(function (fullId) {
            var parts = String(fullId).split('||');
            var baseId = parts[0];
            var size = (parts[1] || '').replace(/_dot_/g, '.');
            var p = findProduct(baseId);
            var name = p ? p.name : 'Mahsulot';
            if (size && size !== 'Universal' && size !== 'undefined') name += ' (' + size + ')';
            var wid = 'w' + String(order.id) + '_' + baseId + (parts[1] ? '_' + parts[1] : '');
            if (P.state.warranties.some(function (w) { return w.id === wid; })) return; // takror emas
            P.state.warranties.unshift({
                id: wid,
                name: name, code: order.code || ('#' + order.id),
                start: start, days: WARRANTY_DAYS, qty: order.items[fullId], notified: false
            });
        });
        if (P.state.warranties.length > 80) P.state.warranties.length = 80;
    }
    function warrStatus(w) {
        if (typeof w.start !== 'number') w.start = tsOf(w.start) || Date.now();
        var end = w.start + (w.days || WARRANTY_DAYS) * DAY;
        var now = Date.now();
        var remMs = end - now;
        var remDays = Math.ceil(remMs / DAY);
        var pct = Math.max(0, Math.min(100, (remMs / ((w.days || WARRANTY_DAYS) * DAY)) * 100));
        var st = remMs <= 0 ? 'expired' : (remDays <= 3 ? 'soon' : 'active');
        return { remDays: remDays, pct: pct, state: st, end: end };
    }
    function checkExpiringWarranties() {
        var changed = false;
        P.state.warranties.forEach(function (w) {
            var s = warrStatus(w);
            if (s.state === 'soon' && !w.notified) {
                w.notified = true; changed = true;
                pushNotif('🛡', 'Qaytarish muddati tugayapti', w.name + ' — nosozlik uchun qaytarish muddati ' + s.remDays + ' kundan keyin tugaydi.', { silent: true, key: 'warr_' + w.id });
            }
        });
        if (changed) save();
    }
    /* ——— 🍏 iOS 26 kafolat kuzatuvi ———
       Umumiy halqa (faol / jami) + segment filtr + har tovar uchun mini-halqa
       (qolgan kun), bosilsa sanalar va «Muammo bormi?» tugmasi ochiladi. */
    var UZ_MON = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];
    function uzDate(ts) { var d = new Date(ts); return d.getDate() + '-' + UZ_MON[d.getMonth()] + (d.getFullYear() !== new Date().getFullYear() ? ' ' + d.getFullYear() : ''); }
    var WR_SVG = {
        shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
        check: '<path d="M20 6 9 17l-5-5"/>',
        chev: '<path d="M9 6l6 6-6 6"/>',
        chat: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
        doc: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M9 13h6M9 17h6"/>'
    };
    function wsvg(k, cls) { return '<svg class="' + (cls || 'a1-svg') + '" viewBox="0 0 24 24" aria-hidden="true">' + WR_SVG[k] + '</svg>'; }
    function renderWarr(anim) {
        var box = document.getElementById('p2-warr-body');
        if (!box) return;
        var ws = P.state.warranties.slice().sort(function (a, b) { return (b.start) - (a.start); });
        if (!ws.length) {
            box.innerHTML = '<div class="a1-empty"><span class="a1-empty-ic">' + wsvg('shield', '') + '</span><b>Hali kafolatli tovar yo\u2018q</b>' +
                '<p>Xarid qilganingizda har bir tovarning kafolat muddati shu yerda avtomatik kuzatiladi.</p>' +
                '<button type="button" class="a1-btn" onclick="openModal(\'trustModal\')">' + wsvg('doc', '') + 'Kafolat shartlari</button></div>';
            return;
        }
        var rows = ws.map(function (w) { return { w: w, s: warrStatus(w) }; });
        var live = rows.filter(function (r) { return r.s.state !== 'expired'; }).length;
        var soon = rows.filter(function (r) { return r.s.state === 'soon'; }).length;
        var exp = rows.length - live;
        var tab = P._warrTab || (live ? 'live' : 'all');
        if (tab === 'live' && !live) tab = 'all';
        P._warrTab = tab;
        var C = 238.76, off = C * (1 - (rows.length ? live / rows.length : 0));
        var h = '<div class="' + (anim ? 'a1-in' : '') + '">';
        h += '<div class="a1-hero" style="--d:0"><svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs><linearGradient id="wrGoldG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F6DC7E"/><stop offset=".55" stop-color="#D4AF37"/><stop offset="1" stop-color="#A8851F"/></linearGradient></defs></svg>' +
            '<div class="wr-hero"><div class="wr-big"><svg viewBox="0 0 86 86" aria-hidden="true"><circle class="t" cx="43" cy="43" r="38"/><circle class="v" cx="43" cy="43" r="38" style="--off:' + off.toFixed(2) + '"/></svg>' +
            '<b>' + live + '<small>faol</small></b></div>' +
            '<div class="wr-hero-tx"><b>Xarid qilgan tovarlaringiz</b><span>Har bir tovar ' + WARRANTY_DAYS + ' kun davomida himoyalangan</span><div class="wr-chips">' +
            '<span class="wr-chip" style="--c:#30d158"><i></i>' + (live - soon) + ' faol</span>' +
            (soon ? '<span class="wr-chip" style="--c:#ff9f0a"><i></i>' + soon + ' tugayapti</span>' : '') +
            (exp ? '<span class="wr-chip" style="--c:#8e8e93"><i></i>' + exp + ' tugagan</span>' : '') +
            '</div></div></div></div>';
        h += '<div class="a1-seg" role="tablist" style="--d:1">' +
            '<button type="button" role="tab" class="' + (tab === 'live' ? 'on' : '') + '" onclick="Phase2.warrTab(\'live\')">Faol<em>' + live + '</em></button>' +
            '<button type="button" role="tab" class="' + (tab === 'exp' ? 'on' : '') + '" onclick="Phase2.warrTab(\'exp\')">Tugagan<em>' + exp + '</em></button>' +
            '<button type="button" role="tab" class="' + (tab === 'all' ? 'on' : '') + '" onclick="Phase2.warrTab(\'all\')">Hammasi<em>' + rows.length + '</em></button></div>';
        var list = rows.filter(function (r) { return tab === 'all' || (tab === 'live' ? r.s.state !== 'expired' : r.s.state === 'expired'); });
        h += '<div class="a1-grp" style="--d:2">';
        if (!list.length) h += '<div class="wr-none">Bu bo\u2018limda tovar yo\u2018q</div>';
        h += list.map(function (r) {
            var w = r.w, s = r.s;
            var col = s.state === 'expired' ? '#8e8e93' : (s.state === 'soon' ? '#ff9f0a' : '#30d158');
            var pill = s.state === 'expired' ? 'Tugagan' : (s.state === 'soon' ? s.remDays + ' kun qoldi' : 'Faol');
            var dOff = (119.38 * (1 - s.pct / 100)).toFixed(2);
            var sub = s.state === 'expired' ? uzDate(s.end) + ' da tugagan' : uzDate(s.end) + ' gacha';
            return '<div class="wr-it' + (s.state === 'expired' ? ' is-expired' : '') + '">' +
                '<button type="button" class="wr-row" onclick="Phase2.warrToggle(this)" aria-expanded="false">' +
                '<span class="wr-dial" style="--c:' + col + '"><svg viewBox="0 0 46 46" aria-hidden="true"><circle class="t" cx="23" cy="23" r="19"/>' +
                (s.state === 'expired' ? '' : '<circle class="v" cx="23" cy="23" r="19" style="--off:' + dOff + '"/>') + '</svg>' +
                (s.state === 'expired' ? wsvg('check') : '<b>' + s.remDays + '<small>kun</small></b>') + '</span>' +
                '<span class="wr-tx"><b>' + esc(w.name) + (w.qty > 1 ? ' \u00D7' + esc(w.qty) : '') + '</b><small>' + esc(w.code) + ' \u00B7 ' + sub + '</small></span>' +
                '<span class="wr-pill" style="--c:' + col + '">' + pill + '</span>' +
                '<span class="wr-chev">' + wsvg('chev', '') + '</span></button>' +
                '<div class="wr-more"><div><div class="wr-more-in"><div class="wr-dates"><span>Boshlangan<b>' + uzDate(w.start) + '</b></span><span>' + (s.state === 'expired' ? 'Tugagan' : 'Tugaydi') + '<b>' + uzDate(s.end) + '</b></span></div>' +
                (s.state === 'expired'
                    ? '<button type="button" class="a1-btn wr-act" onclick="openModal(\'trustModal\')">' + wsvg('doc', '') + 'Kafolat shartlari</button>'
                    : '<button type="button" class="a1-btn is-gold wr-act" onclick="Phase2.warrHelp(\'' + esc(String(w.id).replace(/[^\w-]/g, '')) + '\')">' + wsvg('chat', '') + 'Muammo bormi? Yozing</button>') +
                '</div></div></div></div>';
        }).join('');
        h += '</div>';
        h += '<p class="a1-foot" style="--d:3">Kafolat muddati buyurtma berilgan kundan boshlab hisoblanadi.</p>';
        h += '<div class="a1-grp" style="--d:4;margin-top:18px"><button type="button" class="a1-row" onclick="openModal(\'trustModal\')"><span class="a1-ic" style="--ic:#5e5ce6">' + wsvg('doc') + '</span><span class="a1-t">Kafolat va qaytarish shartlari</span><span class="a1-chev"><svg viewBox="0 0 8 13" aria-hidden="true"><path d="M1.5 1.5 6.5 6.5 1.5 11.5"/></svg></span></button></div>';
        h += '</div>';
        box.innerHTML = h;
    }
    P.warrTab = function (t) { P._warrTab = t; renderWarr(false); try { if (window._hap) window._hap('selection'); } catch (e) {} };
    P.warrToggle = function (btn) {
        var it = btn && btn.closest('.wr-it'); if (!it) return;
        var open = it.classList.toggle('open'); btn.setAttribute('aria-expanded', open ? 'true' : 'false');
        try { if (window._hap) window._hap('light'); } catch (e) {}
    };
    P.warrHelp = function (id) {
        var w = P.state.warranties.filter(function (x) { return String(x.id).replace(/[^\w-]/g, '') === id; })[0];
        var msg = 'Assalomu alaykum! Kafolat bo\u2018yicha murojaat:\n' + (w ? w.name + (w.code ? ' (buyurtma ' + w.code + ')' : '') : '');
        if (window.ShopInfo) ShopInfo.openTg(msg);
    };
    P.openWarranty = function () {
        fixWarranties();
        P._warrTab = null;
        renderWarr(true);
        if (typeof openModal === 'function') openModal('p2WarrantyModal');
    };

    /* ============================================================
       🏆 3. ACHIEVEMENTS
       ============================================================ */
    var ACH = [
        { id: 'first_order', ic: '🚀', t: 'Birinchi qadam', d: 'Birinchi buyurtmangizni bering', goal: function (c) { return Math.min(1, c.orders); }, test: function (c) { return c.orders >= 1; } },
        { id: 'orders_5', ic: '🛒', t: 'Doimiy mijoz', d: '5 ta buyurtma bering', goal: function (c) { return c.orders / 5; }, test: function (c) { return c.orders >= 5; } },
        { id: 'orders_10', ic: '👑', t: 'Sodiq mijoz', d: '10 ta buyurtma bering', goal: function (c) { return c.orders / 10; }, test: function (c) { return c.orders >= 10; } },
        { id: 'spent_1m', ic: '💎', t: 'Million klubi', d: "1 000 000 so'm xarid qiling", goal: function (c) { return c.spent / 1000000; }, test: function (c) { return c.spent >= 1000000; } },
        { id: 'spent_5m', ic: '🏆', t: 'Premium xaridor', d: "5 000 000 so'm xarid qiling", goal: function (c) { return c.spent / 5000000; }, test: function (c) { return c.spent >= 5000000; } },
        { id: 'wish_5', ic: '❤️', t: 'Kollektsioner', d: '5 ta mahsulot saqlang', goal: function (c) { return c.wish / 5; }, test: function (c) { return c.wish >= 5; } },
        { id: 'cashback_100k', ic: '🎁', t: 'Bonus ovchisi', d: "100 000 so'm cashback to'plang", goal: function (c) { return c.cashbackTotal / 100000; }, test: function (c) { return c.cashbackTotal >= 100000; } },
        { id: 'night_owl', ic: '🌙', t: 'Tungi qush', d: 'Tungi rejimni sinab ko\'ring', goal: function (c) { return c.themeSwitched ? 1 : 0; }, test: function (c) { return !!c.themeSwitched; } }
    ];
    P._ACH = ACH;

    function computeContext() {
        var orders = getOrders();
        var delivered = orders.filter(function (o) { return o && o.status === 'yetkazildi'; });
        var spent = orders.reduce(function (s, o) { return s + (parseInt(o && o.total) || 0); }, 0);
        return {
            orders: orders.length,
            delivered: delivered.length,
            spent: spent,
            wish: getWishCount(),
            cashbackTotal: P.state.cashbackTotal,
            themeSwitched: P.state.themeSwitched
        };
    }
    function evaluateAchievements(showOverlay) {
        var c = computeContext();
        var newly = [];
        ACH.forEach(function (a) {
            if (!P.state.achievements[a.id] && a.test(c)) {
                P.state.achievements[a.id] = Date.now();
                newly.push(a);
            }
        });
        if (newly.length) {
            newly.forEach(function (a) {
                pushNotif('🏆', 'Yangi yutuq!', a.t + ' — ' + a.d, { silent: true });
                if (showOverlay !== false) P._unlockQueue.push(a);
            });
            save();
            if (showOverlay !== false) drainUnlockQueue();
            updateTileBadges();
        }
        return newly;
    }

    function drainUnlockQueue() {
        if (P._unlockShowing || !P._unlockQueue.length) return;
        var a = P._unlockQueue.shift();
        P._unlockShowing = true;
        var ov = document.getElementById('p2-unlock');
        if (!ov) { P._unlockShowing = false; return; }
        ov.querySelector('#p2-unlock-ic').textContent = a.ic;
        ov.querySelector('#p2-unlock-title').textContent = a.t;
        ov.querySelector('#p2-unlock-desc').textContent = a.d;
        ov.classList.add('show');
        var card = ov.querySelector('.p2-unlock-card');
        if (card && !reduceMotion) { card.style.animation = 'none'; void card.offsetWidth; card.style.animation = ''; }
        hap('success');
        confettiBurst();
    }
    P.closeUnlock = function () {
        var ov = document.getElementById('p2-unlock');
        if (ov) ov.classList.remove('show');
        P._unlockShowing = false;
        setTimeout(drainUnlockQueue, 400);
    };

    function confettiBurst() {
        if (reduceMotion) return;
        var colors = ['#D4AF37', '#007aff', '#ffffff', '#30d158', '#e5c07b', '#ff453a'];
        var n = 26;
        for (var i = 0; i < n; i++) {
            (function (i) {
                var c = document.createElement('div');
                c.className = 'p2-confetti';
                c.style.left = Math.random() * 100 + 'vw';
                c.style.background = colors[i % colors.length];
                if (Math.random() > 0.5) { c.style.borderRadius = '50%'; c.style.width = '11px'; c.style.height = '11px'; }
                c.style.animationDuration = (2 + Math.random() * 1.4) + 's';
                c.style.animationDelay = (Math.random() * 0.25) + 's';
                document.body.appendChild(c);
                setTimeout(function () { if (c.parentNode) c.parentNode.removeChild(c); }, 3800);
            })(i);
        }
    }

    P.openAchievements = function () {
        var box = document.getElementById('p2-ach-body');
        if (box) {
            var c = computeContext();
            var done = ACH.filter(function (a) { return P.state.achievements[a.id]; }).length;
            box.innerHTML =
                '<div style="text-align:center;margin-bottom:18px;">' +
                '<div style="font-size:34px;font-weight:900;color:var(--luxury-gold);">' + done + '<span style="font-size:18px;color:var(--text-muted);">/' + ACH.length + '</span></div>' +
                '<div style="font-size:12px;color:var(--text-muted);">yutuq ochildi</div></div>' +
                '<div class="p2-ach-grid">' +
                ACH.map(function (a) {
                    var un = P.state.achievements[a.id];
                    var prog = Math.max(0, Math.min(1, a.goal(c)));
                    return '<div class="p2-ach ' + (un ? 'unlocked' : '') + '">' +
                        '<div class="p2-ach-ic">' + a.ic + '</div>' +
                        '<div class="p2-ach-title">' + esc(a.t) + '</div>' +
                        '<div class="p2-ach-desc">' + esc(a.d) + '</div>' +
                        (un ? '<div class="p2-ach-date">✓ ' + new Date(un).toLocaleDateString('uz-UZ') + '</div>'
                            : '<div class="p2-ach-prog"><i data-p="' + (prog * 100) + '"></i></div>') +
                        '</div>';
                }).join('') + '</div>';
            requestAnimationFrame(function () {
                box.querySelectorAll('.p2-ach-prog > i').forEach(function (el) {
                    requestAnimationFrame(function () { el.style.width = (el.getAttribute('data-p') || 0) + '%'; });
                });
            });
        }
        if (typeof openModal === 'function') openModal('p2AchievementsModal');
        // Ko'rilgan deb belgilaymiz — badge yo'qoladi
        P.state.achSeen = unlockedAchCount();
        saveLocal(); saveRemote();
        updateTileBadges();
    };

    /* ============================================================
       📊 4. SHAXSIY ANALITIKA
       ============================================================ */
    function findProduct(id) {
        var db = getProducts();
        for (var i = 0; i < db.length; i++) { if (db[i] && String(db[i].id) === String(id)) return db[i]; }
        return null;
    }
    function computeAnalytics() {
        var orders = getOrders();
        var totalOrders = orders.length;
        var totalSpent = orders.reduce(function (s, o) { return s + (parseInt(o && o.total) || 0); }, 0);
        var avg = totalOrders ? totalSpent / totalOrders : 0;
        var now = new Date();
        var thisMonth = orders.reduce(function (s, o) {
            var d = new Date(o.id || 0);
            return (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) ? s + (parseInt(o.total) || 0) : s;
        }, 0);
        // Kategoriya bo'yicha
        var catMap = {}, prodMap = {};
        orders.forEach(function (o) {
            if (!o.items) return;
            Object.keys(o.items).forEach(function (fullId) {
                var baseId = String(fullId).split('||')[0];
                var p = findProduct(baseId);
                var qty = o.items[fullId] || 1;
                if (p) {
                    var cat = catLabel(p.category) || 'Boshqa';
                    catMap[cat] = (catMap[cat] || 0) + (p.price || 0) * qty;
                    var nm = p.name || ('#' + baseId);
                    prodMap[nm] = (prodMap[nm] || 0) + qty;
                }
            });
        });
        var cats = Object.keys(catMap).map(function (k) { return { name: k, amount: catMap[k] }; }).sort(function (a, b) { return b.amount - a.amount; }).slice(0, 5);
        var catMax = cats.reduce(function (m, c) { return Math.max(m, c.amount); }, 1);
        cats.forEach(function (c) { c.pct = (c.amount / catMax) * 100; });
        var top = Object.keys(prodMap).map(function (k) { return { name: k, qty: prodMap[k] }; }).sort(function (a, b) { return b.qty - a.qty; }).slice(0, 5);
        var topMax = top.reduce(function (m, c) { return Math.max(m, c.qty); }, 1);
        top.forEach(function (c) { c.pct = (c.qty / topMax) * 100; });
        // Oxirgi 6 oy
        var months = [];
        var mNames = ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyn', 'Iyl', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek'];
        for (var i = 5; i >= 0; i--) {
            var d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            months.push({ y: d.getFullYear(), m: d.getMonth(), label: mNames[d.getMonth()], amount: 0 });
        }
        orders.forEach(function (o) {
            var d = new Date(o.id || 0);
            months.forEach(function (mm) { if (mm.y === d.getFullYear() && mm.m === d.getMonth()) mm.amount += (parseInt(o.total) || 0); });
        });
        var monthMax = months.reduce(function (m, c) { return Math.max(m, c.amount); }, 1);
        months.forEach(function (mm) { mm.pct = (mm.amount / monthMax) * 100; });
        return { totalOrders: totalOrders, totalSpent: totalSpent, avg: avg, thisMonth: thisMonth, cats: cats, top: top, months: months };
    }
    function catLabel(cat) {
        if (!cat) return '';
        var c = String(cat).toLowerCase();
        // 🗣️ 6/9: kategoriya jargonini mijoz tiliga o'giramiz (yagona lug'at = CAT_DICT)
        var DICT = window.CAT_DICT || {};
        for (var key in DICT) {
            if (DICT.hasOwnProperty(key) && c.indexOf(key) !== -1) return DICT[key];
        }
        // Mos jargon topilmasa — oxirgi bo'lakni chiroyli ko'rsatamiz (masalan "chevy-cobalt" -> "Cobalt")
        return String(cat).split('-').slice(-1)[0].replace(/^\w/, function (m) { return m.toUpperCase(); });
    }
    P.openAnalytics = function () {
        var box = document.getElementById('p2-an-body');
        if (box) {
            var a = computeAnalytics();
            if (!a.totalOrders) { box.innerHTML = '<div class="a1-empty"><span class="a1-empty-ic"><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg></span><b>Hali statistika yo\u2018q</b><p>Birinchi buyurtmangizdan keyin xaridlaringiz, tejamingiz va sevimli kategoriyalaringiz shu yerda chiroyli grafiklarda ko\u2018rinadi.</p></div>'; }
            else {
                box.innerHTML =
                    '<div class="p2-an-stats">' +
                    '<div class="p2-an-card"><div class="p2-an-num" data-count="' + a.totalOrders + '">0</div><div class="p2-an-lbl">Jami buyurtma</div></div>' +
                    '<div class="p2-an-card"><div class="p2-an-num" data-count="' + a.totalSpent + '" data-som="1">0</div><div class="p2-an-lbl">Jami sarflangan</div></div>' +
                    '<div class="p2-an-card"><div class="p2-an-num" data-count="' + Math.round(a.avg) + '" data-som="1">0</div><div class="p2-an-lbl">O\'rtacha chek</div></div>' +
                    '<div class="p2-an-card"><div class="p2-an-num" data-count="' + a.thisMonth + '" data-som="1">0</div><div class="p2-an-lbl">Shu oy</div></div>' +
                    '</div>' +
                    '<div class="p2-sec-title">📈 Oylik sarf (6 oy)</div>' +
                    '<div class="p2-month-chart">' + a.months.map(function (m) {
                        return '<div class="p2-month-col"><div class="p2-month-bar" data-h="' + m.pct + '" title="' + fmtSom(m.amount) + " so'm\"></div><div class=\"p2-month-lbl\">" + m.label + '</div></div>';
                    }).join('') + '</div>' +
                    (a.cats.length ? '<div class="p2-sec-title">🗂 Kategoriyalar bo\'yicha</div>' + a.cats.map(function (c) {
                        return barRow(c.name, c.pct, fmtShort(c.amount));
                    }).join('') : '') +
                    (a.top.length ? '<div class="p2-sec-title">🔥 Eng ko\'p olingan</div>' + a.top.map(function (c) {
                        return barRow(c.name, c.pct, c.qty + ' ta');
                    }).join('') : '');
                // animatsiyalar
                requestAnimationFrame(function () {
                    box.querySelectorAll('.p2-an-num').forEach(function (el) {
                        animateCount(el, 0, parseInt(el.getAttribute('data-count')) || 0, 1100, el.getAttribute('data-som') === '1');
                    });
                    box.querySelectorAll('.p2-month-bar').forEach(function (el) {
                        requestAnimationFrame(function () { el.style.height = (el.getAttribute('data-h') || 0) + '%'; });
                    });
                    box.querySelectorAll('.p2-bar-fill').forEach(function (el) {
                        requestAnimationFrame(function () { el.style.width = (el.getAttribute('data-v') || 0) + '%'; });
                    });
                });
            }
        }
        if (typeof openModal === 'function') openModal('p2AnalyticsModal');
    };
    function barRow(name, pct, val) {
        return '<div class="p2-bar-row"><div class="p2-bar-name">' + esc(name) + '</div>' +
            '<div class="p2-bar-track"><div class="p2-bar-fill" data-v="' + pct + '"></div></div>' +
            '<div class="p2-bar-val">' + esc(val) + '</div></div>';
    }

    /* ============================================================
       ANIMATSIYA YORDAMCHILARI
       ============================================================ */
    function animateCount(el, from, to, dur, isSom) {
        if (reduceMotion || dur <= 0) { el.textContent = isSom ? fmtShort(to) : to.toLocaleString('ru-RU').replace(/,/g, ' '); return; }
        var start = null;
        function step(ts) {
            if (start === null) start = ts;
            var p = Math.min(1, (ts - start) / dur);
            var e = 1 - Math.pow(1 - p, 3); // easeOutCubic
            var val = Math.round(from + (to - from) * e);
            el.textContent = isSom ? fmtShort(val) : val.toLocaleString('ru-RU').replace(/,/g, ' ');
            if (p < 1) requestAnimationFrame(step);
            else el.textContent = isSom ? fmtShort(to) : to.toLocaleString('ru-RU').replace(/,/g, ' ');
        }
        requestAnimationFrame(step);
    }
    function emptyHTML(ic, txt) { return '<div class="p2-empty"><span class="ic">' + ic + '</span>' + esc(txt) + '</div>'; }

    /* ============================================================
       PROFIL HUB (profilga joylashtirish)
       ============================================================ */
    function renderProfile() {
        var section = document.getElementById('profile-section');
        if (!section) return;
        var anchor = document.getElementById('pf-stats-box');
        var hub = document.getElementById('p2-hub');
        if (!hub) {
            hub = document.createElement('div');
            hub.id = 'p2-hub';
            if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(hub, anchor.nextSibling);
            else (section.querySelector('div') || section).appendChild(hub);
        }
        hub.innerHTML =
            '<div class="p2-cashback-card" onclick="Phase2.openCashback()" style="cursor:pointer;">' +
            '<div class="p2-cb-icon">🎁</div>' +
            '<div class="p2-cb-label">Cashback balansi</div>' +
            '<div class="p2-cb-balance" id="p2-cb-bal">0 <small>so\'m</small></div>' +
            '<div class="p2-cb-sub">Jami yig\'ilgan: ' + fmtSom(P.state.cashbackTotal) + " so'm</div>" +
            '</div>' +
            '<div class="p2-grid">' +
            tile('🏆', 'Yutuqlar', 'Phase2.openAchievements()', achBadgeHTML()) +
            tile('📊', 'Analitika', 'Phase2.openAnalytics()', '') +
            tile('🛡', 'Tovarlar kafolati', 'Phase2.openWarranty()', warrBadgeHTML()) +
            tile('🔔', 'Xabarlar', 'Phase2.openNotifs()', '<span class="p2-tile-badge" id="p2-tile-notif-badge"></span>') +
            tile(P.state.theme === 'light' ? '🌙' : '☀️', 'Mavzu', 'Phase2.toggleTheme(event)', '') +
            (window.A1Perf ? tile('⚡', 'Ko\u2018rinish', 'A1Perf.openPicker()', '') : '') +
            '</div>';
        // balansni animatsiya bilan ko'rsatamiz
        var bal = document.getElementById('p2-cb-bal');
        if (bal) {
            requestAnimationFrame(function () {
                var n = P.state.cashback;
                animateCountSom(bal, 0, n, 1000);
            });
        }
        updateBell(false);
    }
    P.renderProfile = function () { try { renderProfile(); } catch (e) {} };

    function animateCountSom(el, from, to, dur) {
        if (reduceMotion) { el.innerHTML = fmtSom(to) + " <small>so'm</small>"; return; }
        var start = null;
        function step(ts) {
            if (start === null) start = ts;
            var p = Math.min(1, (ts - start) / dur);
            var e = 1 - Math.pow(1 - p, 3);
            el.innerHTML = fmtSom(from + (to - from) * e) + " <small>so'm</small>";
            if (p < 1) requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
    }
    function tile(ic, lbl, fn, badge) {
        return '<div class="p2-tile" onclick="' + fn + '">' + (badge || '') +
            '<div class="p2-tile-ic">' + ic + '</div><div class="p2-tile-lbl">' + lbl + '</div></div>';
    }
    function unlockedAchCount() { return ACH.filter(function (a) { return P.state.achievements[a.id]; }).length; }
    function unseenAchCount() { return Math.max(0, unlockedAchCount() - (P.state.achSeen || 0)); }
    function warrSoonCount() { return P.state.warranties.filter(function (w) { return warrStatus(w).state === 'soon'; }).length; }
    function achBadgeHTML() {
        var n = unseenAchCount();
        return '<span class="p2-tile-badge' + (n ? ' show' : '') + '" id="p2-tile-ach-badge" style="background:var(--luxury-gold);color:#000;">' + (n || '') + '</span>';
    }
    function warrBadgeHTML() {
        var n = warrSoonCount();
        return '<span class="p2-tile-badge' + (n ? ' show' : '') + '" id="p2-tile-warr-badge" style="background:#ff9f0a;">' + (n || '') + '</span>';
    }
    function updateTileBadges() {
        var a = document.getElementById('p2-tile-ach-badge');
        if (a) { var n = unseenAchCount(); a.textContent = n || ''; a.classList.toggle('show', n > 0); }
        var w = document.getElementById('p2-tile-warr-badge');
        if (w) { var m = warrSoonCount(); w.textContent = m || ''; w.classList.toggle('show', m > 0); }
    }

    /* ============================================================
       HEADER CONTROLS (qo'ng'iroq + mavzu tugmasi)
       ============================================================ */
    function injectHeaderControls() {
        var header = document.querySelector('.header');
        if (!header || document.getElementById('p2-bell-btn')) return;
        header.style.position = 'relative';  /* header QOTMAYDI — kontent bilan aylanadi */
        var theme = document.createElement('button');
        theme.id = 'p2-theme-btn';
        theme.className = 'p2-hdr-btn';
        theme.setAttribute('aria-label', 'Mavzu');
        theme.textContent = P.state.theme === 'light' ? '🌙' : '☀️';
        theme.onclick = function (e) { P.toggleTheme(e); };
        var bell = document.createElement('button');
        bell.id = 'p2-bell-btn';
        bell.className = 'p2-hdr-btn';
        bell.setAttribute('aria-label', 'Bildirishnomalar');
        bell.innerHTML = '🔔<span class="p2-bell-badge" id="p2-bell-badge">0</span>';
        bell.onclick = function () { P.openNotifs(); };
        header.appendChild(theme);
        header.appendChild(bell);
        updateBell(false);
    }

    /* ============================================================
       MODALLARNI YARATISH
       ============================================================ */
    function buildModals() {
        if (document.getElementById('p2NotifModal')) return;
        var html =
            modal('p2NotifModal', 'Bildirishnomalar',
                '<div class="nf-bar"><span class="nf-sum" id="p2-nf-sum"></span>' +
                '<button class="p2-markall-btn" onclick="Phase2.markAllRead()" aria-label="Hammasini o\'qilgan deb belgilash">' +
                    '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1.5 12.5l4 4L14 8"/><path d="M9.5 15.5l1 1L22.5 5"/></svg>' +
                    '<span>Hammasini o\'qildi</span>' +
                '</button></div>' +
                '<div class="p2-modal-scroll" id="p2-notif-list"></div>') +
            modal('p2AchievementsModal', 'Yutuqlar', '<div class="p2-modal-scroll" id="p2-ach-body"></div>') +
            modal('p2AnalyticsModal', 'Analitika', '<div class="p2-modal-scroll" id="p2-an-body"></div>') +
            modal('p2WarrantyModal', 'Tovarlar kafolati', '<div class="p2-modal-scroll" id="p2-warr-body"></div>') +
            modal('p2CashbackModal', 'Cashback', '<div class="p2-modal-scroll" id="p2-cashback-body"></div>') +
            '<div id="p2-unlock" onclick="Phase2.closeUnlock()">' +
            '<div class="p2-unlock-card" onclick="event.stopPropagation()">' +
            '<div class="p2-unlock-ic" id="p2-unlock-ic">🏆</div>' +
            '<div class="p2-unlock-kicker">Yangi yutuq ochildi</div>' +
            '<div class="p2-unlock-title" id="p2-unlock-title">Yutuq</div>' +
            '<div class="p2-unlock-desc" id="p2-unlock-desc"></div>' +
            '<button class="p2-unlock-btn" onclick="Phase2.closeUnlock()">Ajoyib! 🎉</button>' +
            '</div></div>';
        var wrap = document.createElement('div');
        wrap.id = 'p2-modals';
        wrap.innerHTML = html;
        document.body.appendChild(wrap);
    }
    function modal(id, title, inner) {
        return '<div class="modal-standard" id="' + id + '">' +
            '<div class="modal-header"><h2>' + title + '</h2><button class="close-btn" aria-label="Yopish" onclick="closeModal()">×</button></div>' +
            inner + '</div>';
    }

    /** Cashback hisoblanadigan summa: haqiqatda TO'LANGAN pul (cashback ustiga cashback yo'q). */
    function cashbackBaseOf(o) {
        if (!o) return 0;
        // payable — cashback chegirmasidan keyingi summa (yangi buyurtmalarda bor)
        if (o.payable != null) return parseInt(o.payable, 10) || 0;
        var t = parseInt(o.total, 10) || 0;
        var used = parseInt(o.cashbackUsed, 10) || 0;
        return Math.max(0, t - used);
    }

    // ============================================================
    // 🎁 CASHBACK VA KAFOLATNI HISOBLASH — FAQAT YETKAZIB BERILGANDA
    // ------------------------------------------------------------
    // ⚠️ ILGARI QANDAY XATO ISHLAGAN: bu funksiya buyurtmaning shunchaki
    //    MAVJUDLIGI uchun cashback berardi — status umuman tekshirilmasdi.
    //    Buyurtma 'kutilmoqda' holatida ham pul darhol hisobga tushardi;
    //    keyin bekor qilinsa ham QAYTARILMASDI. Ya'ni mijoz buyurtma berib,
    //    keyin bekor qilib, cashbackni o'zida qoldirib ketishi mumkin edi.
    //
    // ENDI:
    //   • cashback FAQAT admin 'yetkazildi' bosgandan keyin qo'shiladi
    //     (admin status yozadi -> mijozning users/{uid} listeneri ishga tushadi
    //      -> shu funksiya qayta hisoblaydi -> pul tushadi);
    //   • buyurtma bekor qilinsa — berilgan cashback QAYTARIB OLINADI va
    //     buyurtmada ishlatilgan cashback mijozga QAYTARILADI;
    //   • kafolat ham yetkazilgandan boshlanadi (14 kun qo'lga olgandan);
    //   • hisoblash bazasi — haqiqatda to'langan summa (payable).
    // ============================================================
    function reconcileOrders(orders) {
        if (!Array.isArray(orders) || !orders.length) return false;
        if (!P.state.processedOrders) P.state.processedOrders = {};
        var firstRun = (P._synced !== true);   // birinchi sync = eski buyurtmalar (jim catch-up)
        var changed = false;
        var sessionNew = [];
        var sessionRefund = 0;

        orders.forEach(function (o) {
            if (!o || o.id == null) return;
            var key = String(o.id);
            var entry = P.state.processedOrders[key];
            var status = String(o.status || 'kutilmoqda');

            // ---------- 1) BEKOR QILINGAN ----------
            // ⚠️ ILGARI QANDAY XATO ISHLAGAN (endi tuzatildi):
            //    blokning birinchi qatorida `if (!entry || entry.rv) return;`
            //    turardi. `entry` esa FAQAT buyurtma 'yetkazildi' bo'lganda
            //    yaratiladi (pastdagi 2-blokda). Cashback esa buyurtma
            //    BERILGANDA, ya'ni 'kutilmoqda' holatida sarflanadi.
            //    Demak eng ko'p uchraydigan holatda — "mijoz cashback bilan
            //    to'ladi, buyurtma yetkazilmasdan bekor qilinadi" — `entry`
            //    mavjud bo'lmasdi va funksiya SHU YERDA chiqib ketardi.
            //    Pastdagi "ishlatilgan cashbackni qaytarish" kodiga HECH QACHON
            //    yetib bormasdi => mijozning puli yo'qolardi.
            //
            // ENDI ikki amal BIR-BIRIDAN MUSTAQIL, har birining o'z belgisi bor:
            //    (a) `rv` — yetkazilgan deb BERILGAN cashbackni qaytarib olish
            //        (faqat pul berilgan bo'lsa ma'noli);
            //    (b) `ur` — buyurtmada ISHLATILGAN cashbackni QAYTARISH
            //        (entry bo'lmasa ham bajarilishi SHART — asosiy holat shu).
            if (status === 'bekor_qilingan') {
                var hadEntry = !!entry;
                if (!entry) entry = { t: Date.now(), cb: 0, st: 'bekor' };
                var didWork = false;

                // (a) Berilgan cashbackni qaytarib olamiz (agar berilgan bo'lsa)
                var back = parseInt(entry.cb, 10) || 0;
                if (back > 0 && !entry.rv) {
                    addCashback(back, 'Bekor qilingan buyurtma ' + (o.code || '#' + o.id), 'spend');
                    pushNotif('↩️', 'Cashback qaytarib olindi',
                        'Buyurtma ' + (o.code || '') + ' bekor qilindi — ' + fmtSom(back) + " so'm yechildi.", { silent: true });
                    didWork = true;
                }
                entry.cb = 0;
                entry.rv = 1;

                // (b) Buyurtmada ISHLATILGAN cashbackni mijozga QAYTARAMIZ
                var usedBack = parseInt(o.cashbackUsed, 10) || 0;
                if (usedBack > 0 && !entry.ur) {
                    refundSpent(usedBack, 'Bekor qilingan buyurtma ' + (o.code || '#' + o.id) + " — cashback qaytarildi");
                    pushNotif('🎁', 'Cashback qaytarildi',
                        'Buyurtma ' + (o.code || '') + ' bekor qilindi — ' + fmtSom(usedBack) +
                        " so'm hisobingizga qaytdi.", { silent: true });
                    sessionRefund += usedBack;
                    entry.ur = 1;
                    didWork = true;
                }
                entry.st = 'bekor';

                // Yozishni FAQAT kerak bo'lganda belgilaymiz — aks holda har
                // sinxronlashda Firebase'ga bekorga yozib turardik.
                if (didWork || !hadEntry) {
                    P.state.processedOrders[key] = entry;
                    changed = true;
                }
                return;
            }

            // ---------- 2) YETKAZILDI -> cashback + kafolat ----------
            if (status === 'yetkazildi') {
                if (entry && !entry.rv) return;                  // allaqachon berilgan
                // Buyurtmada saqlangan ulush (`cbRate`) ustuvor — to'lov vaqtida
                // ko'rsatilgan summa bilan AYNAN mos kelishi uchun.
                var earned = Math.round(cashbackBaseOf(o) * rateForOrder(o));
                if (earned > 0) addCashback(earned, 'Buyurtma ' + (o.code || '#' + o.id), 'earn');
                createWarranties(o);                             // kafolat qo'lga olgandan boshlanadi
                // `ur` (ishlatilgan cashback qaytarilgan) belgisini SAQLAB qolamiz.
                // Aks holda "bekor -> yana yetkazildi -> yana bekor" ketma-ketligida
                // belgi yo'qolib, cashback IKKI MARTA qaytarilishi mumkin edi.
                var _keepUr = (entry && entry.ur) ? 1 : 0;
                P.state.processedOrders[key] = { t: Date.now(), cb: earned, st: 'yetkazildi', ur: _keepUr };
                changed = true;
                if (firstRun) {
                    if (earned > 0) pushNotif('🎁', 'Cashback', '+' + fmtSom(earned) + " so'm — buyurtma " + (o.code || ''), { silent: true });
                } else {
                    sessionNew.push({ o: o, earned: earned });
                }
                return;
            }

            // ---------- 3) BOSHQA HOLATLAR (kutilmoqda / qabul / yo'lda) ----------
            // Ataylab HECH NARSA qilmaymiz va belgi ham qo'ymaymiz — shunda
            // yetkazilgan paytda yuqoridagi shart ishlaydi va pul o'shanda tushadi.
        });

        // processedOrders ro'yxatini cheklash — eng ESKI kalitlarni olib tashlaymiz.
        // ⚠️ Eslatma: ilgari `Object.keys` tartibiga tayanardi; endi vaqt bo'yicha
        //    saralaymiz, aks holda 200 dan oshganda hali ham kerakli kalit o'chib,
        //    o'sha buyurtma uchun cashback IKKI MARTA berilishi mumkin edi.
        var keys = Object.keys(P.state.processedOrders);
        if (keys.length > 400) {
            keys.sort(function (a, b) {
                return ((P.state.processedOrders[a] || {}).t || 0) - ((P.state.processedOrders[b] || {}).t || 0);
            });
            keys.slice(0, keys.length - 400).forEach(function (k) { delete P.state.processedOrders[k]; });
        }

        if (changed) {
            sessionNew.forEach(function (x) {
                pushNotif('🏁', 'Buyurtma yetkazildi',
                    'Buyurtma ' + (x.o.code || '') + ' qo\'lingizga yetdi. Rahmat!', { silent: true });
                if (x.earned > 0) {
                    pushNotif('🎁', 'Cashback qo\'shildi',
                        '+' + fmtSom(x.earned) + " so'm hisobingizga tushdi. Keyingi to'lovda ishlatishingiz mumkin.", { silent: true });
                }
            });
            save();
            if (sessionNew.length) {
                var tot = sessionNew.reduce(function (s, x) { return s + x.earned; }, 0);
                if (tot > 0) { toast('🎁 +' + fmtSom(tot) + " so'm cashback qo'shildi!", 'success'); confettiBurst(); hap('success'); }
            }
            if (sessionRefund > 0 && !firstRun) {
                toast('↩️ ' + fmtSom(sessionRefund) + " so'm cashback qaytarildi", 'success');
            }
        }
        return changed;
    }
    // Eski nom bilan ham chaqirsa ishlashi uchun (tashqi kod buzilmasin)
    P.processNewOrders = reconcileOrders;
    P.reconcileOrders = reconcileOrders;

    /* ============================================================
       INTEGRATSIYA HOOK'LARI
       ============================================================ */
    // Buyurtma berilganda chaqiriladi (confirmOrder ichidan — agar ishlasa).
    // Asosiy ishonchli yo'l: P.sync ichidagi processNewOrders.
    P.onOrderPlaced = function (order, productsDB) {
        if (productsDB) P.productsDB = productsDB;
        if (!order) return Promise.resolve();
        if (Array.isArray(window.myOrders) && !window.myOrders.some(function (o) { return o && o.id === order.id; })) {
            window.myOrders.unshift(order);
        }
        // ⚠️ Bu yerda cashback BERILMAYDI — buyurtma hozir 'kutilmoqda' holatida.
        //    reconcileOrders faqat statusni ko'radi; pul 'yetkazildi' bo'lganda tushadi.
        reconcileOrders([order]);
        evaluateAchievements();
        renderProfile();
        // 🔐 Firebase yozuvi tugashini kutib qaytaramiz — chaqiruvchi tg.close() oldidan kutishi mumkin
        return P.flush();
    };

    // Firebase'dan ma'lumot kelganda (mavjud listener ichidan)
    P.sync = function (data, uid, productsDB) {
        if (uid) P.uid = uid;
        if (P.uid) startAdminNotifications();
        if (productsDB) P.productsDB = productsDB;
        if (data) {
            P.orders = toArray(data.orders);
            P.wishlistCount = toArray(data.wishlist).length;
            if (!data.phase2) P._remoteSeen = true;
            if (data.phase2 && !P._writing) {
                // Remote source-of-truth, lekin maydonlarni ehtiyotkorlik bilan birlashtiramiz.
                // 🔐 Cashback YO'QOLMASLIGI uchun: lokal va remote qiymatlarning KATTASINI olamiz.
                // (Telegram ilovani tez yopgani uchun ba'zan remote eskiroq bo'lishi mumkin.)
                var r = data.phase2;
                // 🧹 ADMIN «BOTNI TOZALASH»: server `phase2.resetAt` yozadi. Telefondagi
                //    nusxa (keshbek, uning tarixi, bildirishnomalar, yutuqlar, kafolatlar)
                //    nolga tushadi — aks holda eski balans ko'rinib turar va keyingi
                //    save() bilan serverga qaytib yozilardi. Mavzu va til saqlanadi.
                if (Number(r.resetAt) > (Number(P.state.resetAt) || 0)) {
                    var keepUi = { theme: P.state.theme, themeSwitched: !!P.state.themeSwitched, resetAt: Number(r.resetAt) };
                    if (typeof P.state.lang !== 'undefined') keepUi.lang = P.state.lang;
                    P.state = Object.assign(defaultState(), keepUi);
                }
                // 💰 LEGERNI BIRLASHTIRISH (faqat MONOTON hisoblagichlar).
                // ⚠️ ILGARI: `cashback` (balans) Math.max bilan birlashtirilardi. Balans
                //    esa sarflanganda KAMAYADI — Math.max uni darhol eski (katta) qiymatga
                //    tiklab qo'yardi. Ya'ni cashbackni sarflash printsipial ishlamasdi.
                // ENDI: faqat "yig'ilgan" va "sarflangan" birlashtiriladi (ikkalasi ham
                //    faqat o'sadi -> Math.max to'g'ri), balans esa ulardan hisoblanadi.
                // 🔒 SERVER — PUL EGASI. Bu hisoblagichlarni to'g'ridan-to'g'ri
                //    serverdan olamiz (Math.max EMAS). Mijoz brauzeri ularni
                //    endi o'zgartirmaydi, server esa har commit/statusda ularni
                //    yozib boradi. To'g'ridan-to'g'ri o'zlashtirish eski (deploy
                //    oldidan mahalliy ikki marta hisoblangan) shishgan qiymatni
                //    ham keyingi sync'da haqiqiy server qiymatiga TEKISLAYDI.
                if (typeof r.cashbackTotal === 'number') P.state.cashbackTotal = Math.max(0, r.cashbackTotal);
                if (typeof r.cashbackSpent === 'number') P.state.cashbackSpent = Math.max(0, r.cashbackSpent);
                if (typeof r.cashbackRefunded === 'number') P.state.cashbackRefunded = Math.max(0, r.cashbackRefunded);
                // 🔄 Eski hisoblardan migratsiya: `cashbackSpent` hali yo'q, lekin remote
                //    `cashback` balansi yig'ilgandan kichik bo'lsa — ayirmasi sarflangan
                //    deb qabul qilinadi (mijoz pulini yo'qotmaydi).
                if (typeof r.cashbackSpent !== 'number' && typeof r.cashback === 'number' && typeof r.cashbackTotal === 'number') {
                    var impliedSpent = Math.max(0, (r.cashbackTotal || 0) - (r.cashback || 0));
                    P.state.cashbackSpent = Math.max(P.state.cashbackSpent || 0, impliedSpent);
                }
                recalcBalance();
                // cashbackHistory: ikkala manbani birlashtirib, takrorlarni olib tashlaymiz
                if (r.cashbackHistory) {
                    var remoteHist = toArray(r.cashbackHistory);
                    var localHist = Array.isArray(P.state.cashbackHistory) ? P.state.cashbackHistory : [];
                    var seen = {}, merged = [];
                    remoteHist.concat(localHist).forEach(function (h) {
                        if (!h) return;
                        var k = String(h.date) + '|' + String(h.amount) + '|' + String(h.type || '');
                        if (seen[k]) return; seen[k] = 1; merged.push(h);
                    });
                    merged.sort(function (a, b) { return (b.date || 0) - (a.date || 0); });
                    if (merged.length > 80) merged.length = 80;
                    P.state.cashbackHistory = merged;
                }
                if (r.achievements) P.state.achievements = Object.assign({}, r.achievements, P.state.achievements);
                if (typeof r.achSeen === 'number') P.state.achSeen = Math.max(P.state.achSeen || 0, r.achSeen);
                // processedOrders: ikkala manbani birlashtiramiz (cashback ikki marta berilmasligi uchun)
                if (r.processedOrders) P.state.processedOrders = Object.assign({}, r.processedOrders, P.state.processedOrders || {});
                if (r.notifications) P.state.notifications = toArray(r.notifications);
                if (r.warranties) P.state.warranties = toArray(r.warranties);
                if (typeof r.themeSwitched === 'boolean') P.state.themeSwitched = r.themeSwitched;
                if (r.theme) P.state.theme = r.theme;
                saveLocal();
                P._remoteSeen = true;
            }
        }
        applyTheme(P.state.theme);
        // 🎁 Buyurtmalarni qayta hisoblash: yetkazilganlarga cashback+kafolat,
        //    bekor qilinganlardan qaytarib olish (ishonchli yo'l — har sync'da).
        reconcileOrders(getOrders());
        updateBell(false);
        checkExpiringWarranties();
        // Birinchi sync'da overlay/confetti ko'rsatmaymiz (eski yutuqlar uchun), keyin ko'rsatamiz
        evaluateAchievements(P._synced === true);
        P._synced = true;
        updateTileBadges();
        // profil ochiq bo'lsa yangilaymiz
        var pf = document.getElementById('profile-section');
        if (pf && !pf.classList.contains('hidden')) renderProfile();
    };

    /* ============================================================
       ISHGA TUSHIRISH
       ============================================================ */
    function init() {
        loadLocal();
        applyTheme(P.state.theme);
        buildModals();
        injectHeaderControls();
        updateBell(false);
        // currentUser kechroq tayyor bo'lishi mumkin — kuzatib boramiz
        var tries = 0;
        var iv = setInterval(function () {
            tries++;
            if (window.currentUser && !P.uid) {
                P.uid = window.currentUser;
                startAdminNotifications();
            }
            if ((window.currentUser && P.uid) || tries > 40) clearInterval(iv);
        }, 500);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
