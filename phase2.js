/* ============================================================
   AVTO A1 — PHASE 2 MODULE
   🎁 Bonus/Cashback · 🏆 Achievement · 📊 Analitika ·
   🔗 Referral · 🔔 Bildirishnomalar · 🌙 Dark/Light · 🛡 Kafolat
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
    var CASHBACK_RATE = 0.005;    // har xariddan 0.5% cashback
    var REFERRAL_BONUS = 20000;   // referral uchun ikki tomonga ham bonus (so'm)
    var WARRANTY_DAYS = 14;       // standart kafolat muddati (kun)
    var DAY = 86400000;
    var reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

    /* ----------------------- Holat ----------------------- */
    function defaultState() {
        return {
            theme: 'dark',
            cashback: 0,
            cashbackTotal: 0,
            cashbackHistory: [],
            achievements: {},   // {id: unlockedTimestamp}
            achSeen: 0,         // foydalanuvchi ko'rgan yutuqlar soni (badge uchun)
            referralCode: '',
            referredBy: '',
            referrals: [],      // [{uid, date}]
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
    function timeAgo(ts) {
        var d = Date.now() - ts;
        if (d < 60000) return 'hozir';
        if (d < 3600000) return Math.floor(d / 60000) + ' daqiqa oldin';
        if (d < DAY) return Math.floor(d / 3600000) + ' soat oldin';
        if (d < DAY * 7) return Math.floor(d / DAY) + ' kun oldin';
        return new Date(ts).toLocaleDateString('uz-UZ');
    }

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
        if (!P.uid || !hasFB()) return;
        P._writing = true;
        try {
            firebase.database().ref('users/' + P.uid + '/phase2').set(clean(P.state))
                .then(function () { P._writing = false; })
                .catch(function () { P._writing = false; });
        } catch (e) { P._writing = false; }
    }
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
        P.state.notifications.unshift({
            id: 'n' + Date.now() + Math.floor(Math.random() * 999),
            icon: icon, title: title, text: text, date: Date.now(), read: false
        });
        if (P.state.notifications.length > 60) P.state.notifications.length = 60;
        if (!opts.silent) save();
        updateBell(true);
    }
    function unreadCount() { return P.state.notifications.filter(function (n) { return !n.read; }).length; }
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
    P.markAllRead = function () {
        P.state.notifications.forEach(function (n) { n.read = true; });
        save(); updateBell(false); renderNotifs();
    };
    function renderNotifs() {
        var box = document.getElementById('p2-notif-list');
        if (!box) return;
        var n = P.state.notifications;
        if (!n.length) { box.innerHTML = emptyHTML('🔔', "Hozircha bildirishnoma yo'q"); return; }
        box.innerHTML = n.map(function (x) {
            return '<div class="p2-notif ' + (x.read ? '' : 'unread') + '">' +
                '<div class="p2-notif-ic">' + (x.icon || '🔔') + '</div>' +
                '<div style="flex:1;min-width:0;"><div class="p2-notif-title">' + esc(x.title) + '</div>' +
                '<div class="p2-notif-text">' + esc(x.text) + '</div>' +
                '<div class="p2-notif-time">' + timeAgo(x.date) + '</div></div></div>';
        }).join('');
    }
    P.openNotifs = function () {
        renderNotifs();
        if (typeof openModal === 'function') openModal('p2NotifModal');
        setTimeout(function () { P.state.notifications.forEach(function (n) { n.read = true; }); save(); updateBell(false); }, 900);
    };

    /* ============================================================
       🎁 2. BONUS / CASHBACK
       ============================================================ */
    function addCashback(amount, note, type) {
        amount = Math.round(amount);
        if (!amount) return;
        if (type === 'spend') {
            P.state.cashback = Math.max(0, P.state.cashback - amount);
        } else {
            P.state.cashback += amount;
            P.state.cashbackTotal += amount;
        }
        P.state.cashbackHistory.unshift({ date: Date.now(), amount: amount, type: type || 'earn', note: note || '' });
        if (P.state.cashbackHistory.length > 80) P.state.cashbackHistory.length = 80;
    }

    P.openCashback = function () {
        var box = document.getElementById('p2-cashback-body');
        if (box) {
            var h = P.state.cashbackHistory;
            box.innerHTML =
                '<div class="p2-cashback-card" style="margin-bottom:18px;">' +
                '<div class="p2-cb-icon">🎁</div>' +
                '<div class="p2-cb-label">Cashback balansi</div>' +
                '<div class="p2-cb-balance">' + fmtSom(P.state.cashback) + ' <small>so\'m</small></div>' +
                '<div class="p2-cb-sub">Jami yig\'ilgan: ' + fmtSom(P.state.cashbackTotal) + " so'm · har xariddan " + (+(CASHBACK_RATE * 100).toFixed(2)) + '%</div>' +
                '</div>' +
                '<div style="background:rgba(48,209,88,0.10);border:1px solid rgba(48,209,88,0.25);border-radius:14px;padding:13px 15px;margin-bottom:18px;font-size:12px;color:var(--text-muted);line-height:1.5;">' +
                '💡 Cashback har bir buyurtmangizdan avtomatik yig\'iladi. Keyingi xaridda operatorga aytib, balansingizdan foydalanishingiz mumkin.</div>' +
                '<div class="p2-sec-title">📜 Tarix</div>' +
                (h.length ? h.map(function (x) {
                    var sign = x.type === 'spend' ? '−' : '+';
                    var col = x.type === 'spend' ? 'var(--accent-red,#ff453a)' : '#30d158';
                    return '<div style="display:flex;justify-content:space-between;align-items:center;padding:11px 0;border-bottom:1px solid var(--glass-border);">' +
                        '<div><div style="font-size:13px;font-weight:700;color:var(--text-main,#fff);">' + esc(x.note || (x.type === 'spend' ? 'Sarflandi' : 'Cashback')) + '</div>' +
                        '<div style="font-size:11px;color:var(--text-muted);">' + new Date(x.date).toLocaleDateString('uz-UZ') + '</div></div>' +
                        '<div style="font-size:15px;font-weight:800;color:' + col + ';">' + sign + fmtSom(x.amount) + '</div></div>';
                }).join('') : emptyHTML('🎁', "Hali cashback yig'ilmagan. Birinchi xaridingizni qiling!"));
        }
        if (typeof openModal === 'function') openModal('p2CashbackModal');
    };

    /* ============================================================
       🛡 7. KAFOLAT KUZATUVI
       ============================================================ */
    function createWarranties(order) {
        if (!order || !order.items) return;
        var start = order.id || Date.now();
        Object.keys(order.items).forEach(function (fullId) {
            var baseId = String(fullId).split('||')[0];
            var p = findProduct(baseId);
            var name = p ? p.name : 'Mahsulot';
            var size = String(fullId).split('||')[1];
            if (size && size !== 'Universal' && size !== 'undefined') name += ' (' + size + ')';
            P.state.warranties.unshift({
                id: 'w' + start + baseId,
                name: name, code: order.code || ('#' + order.id),
                start: start, days: WARRANTY_DAYS, qty: order.items[fullId], notified: false
            });
        });
        if (P.state.warranties.length > 60) P.state.warranties.length = 60;
    }
    function warrStatus(w) {
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
                pushNotif('🛡', 'Kafolat tugamoqda', w.name + ' kafolati ' + s.remDays + ' kundan keyin tugaydi.', { silent: true });
            }
        });
        if (changed) save();
    }
    P.openWarranty = function () {
        var box = document.getElementById('p2-warr-body');
        if (box) {
            var ws = P.state.warranties.slice().sort(function (a, b) { return (b.start) - (a.start); });
            if (!ws.length) { box.innerHTML = emptyHTML('🛡', "Hali kafolatli mahsulot yo'q. Xarid qilganingizda kafolat avtomatik kuzatiladi."); }
            else {
                box.innerHTML =
                    '<div style="font-size:12px;color:var(--text-muted);margin-bottom:16px;line-height:1.5;">Har bir xaridingizga <b style="color:var(--luxury-gold);">' + WARRANTY_DAYS + ' kun</b> kafolat beriladi. Quyida muddatlarni kuzating.</div>' +
                    ws.map(function (w) {
                        var s = warrStatus(w);
                        var pillTxt = s.state === 'expired' ? 'Tugagan' : (s.state === 'soon' ? s.remDays + ' kun qoldi' : s.remDays + ' kun');
                        var col = s.state === 'expired' ? '#ff453a' : (s.state === 'soon' ? '#ff9f0a' : '#30d158');
                        return '<div class="p2-warr"><div class="p2-warr-top">' +
                            '<div><div class="p2-warr-name">' + esc(w.name) + (w.qty > 1 ? ' ×' + w.qty : '') + '</div>' +
                            '<div class="p2-warr-code">Buyurtma: ' + esc(w.code) + '</div></div>' +
                            '<span class="p2-warr-pill ' + s.state + '">' + pillTxt + '</span></div>' +
                            '<div class="p2-warr-track"><div class="p2-warr-fill" data-w="' + s.pct + '" style="background:' + col + ';"></div></div>' +
                            '<div class="p2-warr-meta"><span>Boshlangan: ' + new Date(w.start).toLocaleDateString('uz-UZ') + '</span>' +
                            '<span>Tugaydi: ' + new Date(s.end).toLocaleDateString('uz-UZ') + '</span></div></div>';
                    }).join('');
                animateFills('#p2-warr-body .p2-warr-fill', 'w');
            }
        }
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
        { id: 'referral_1', ic: '🤝', t: "Do'st keltirgan", d: "Do'stingizni taklif qiling", goal: function (c) { return Math.min(1, c.referrals); }, test: function (c) { return c.referrals >= 1; } },
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
            referrals: (P.state.referrals || []).length,
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
        var c = String(cat);
        if (/motor/i.test(c)) return 'Motor';
        if (/tashqi/i.test(c)) return 'Tashqi';
        if (/xadav|xodav|salon/i.test(c)) return 'Xadavoy';
        if (/part/i.test(c)) return 'Ehtiyot qism';
        if (/tormoz/i.test(c)) return 'Tormoz';
        return c.split('-').slice(-1)[0].replace(/^\w/, function (m) { return m.toUpperCase(); });
    }
    P.openAnalytics = function () {
        var box = document.getElementById('p2-an-body');
        if (box) {
            var a = computeAnalytics();
            if (!a.totalOrders) { box.innerHTML = emptyHTML('📊', "Analitika uchun ma'lumot yo'q. Birinchi buyurtmangizdan keyin statistikangiz shu yerda paydo bo'ladi."); }
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
       🔗 6. REFERRAL
       ============================================================ */
    function genCode(uid) {
        var base = Math.abs(parseInt(uid) || Date.now()).toString(36).toUpperCase();
        return 'A1' + base.slice(-5).padStart(5, '0');
    }
    function ensureReferralCode() {
        if (!P.uid) return;
        if (!P.state.referralCode) {
            P.state.referralCode = genCode(P.uid);
            saveLocal();
            saveRemote();
        }
        // kod -> uid xaritasi (referral ishlashi uchun)
        if (hasFB()) {
            try { firebase.database().ref('refcodes/' + P.state.referralCode).set(P.uid); } catch (e) {}
        }
    }
    P.shareReferral = function () {
        var code = P.state.referralCode;
        var msg = "🚗 Avto A1 — sifatli avto ehtiyot qismlar!\nMening taklif kodim: " + code + "\nRo'yxatdan o'tib, ikkalamiz ham " + fmtSom(REFERRAL_BONUS) + " so'm bonus olamiz!";
        try {
            if (window.tg && tg.openTelegramLink) {
                tg.openTelegramLink('https://t.me/share/url?url=' + encodeURIComponent('https://t.me/') + '&text=' + encodeURIComponent(msg));
                return;
            }
        } catch (e) {}
        if (navigator.share) { navigator.share({ text: msg }).catch(function () {}); }
        else if (navigator.clipboard) { navigator.clipboard.writeText(msg); toast('Taklif matni nusxalandi!', 'success'); }
        hap('light');
    };
    P.copyReferral = function () {
        if (navigator.clipboard) { navigator.clipboard.writeText(P.state.referralCode); toast('Kod nusxalandi!', 'success'); hap('selection'); }
    };
    P.redeemReferral = function () {
        var inp = document.getElementById('p2-ref-input');
        if (!inp) return;
        var code = (inp.value || '').trim().toUpperCase();
        if (!code) { toast('Kodni kiriting', 'warning'); return; }
        if (P.state.referredBy) { toast('Siz allaqachon kod kiritgansiz', 'warning'); return; }
        if (code === P.state.referralCode) { toast("O'z kodingizni kirita olmaysiz", 'warning'); return; }
        if (!hasFB()) { toast('Internetni tekshiring', 'warning'); return; }
        firebase.database().ref('refcodes/' + code).once('value').then(function (snap) {
            var refUid = snap.val();
            if (!refUid || String(refUid) === String(P.uid)) { toast("Kod noto'g'ri", 'warning'); return; }
            // O'zimizga bonus
            P.state.referredBy = code;
            addCashback(REFERRAL_BONUS, "Referral bonus (kod: " + code + ")", 'earn');
            pushNotif('🤝', 'Referral bonus!', fmtSom(REFERRAL_BONUS) + " so'm bonus hisobingizga qo'shildi.", { silent: true });
            save();
            // Taklif qilgan odamga ham bonus (xavfsiz transaction)
            try {
                var refBalRef = firebase.database().ref('users/' + refUid + '/phase2/cashback');
                refBalRef.transaction(function (v) { return (v || 0) + REFERRAL_BONUS; });
                var refTotRef = firebase.database().ref('users/' + refUid + '/phase2/cashbackTotal');
                refTotRef.transaction(function (v) { return (v || 0) + REFERRAL_BONUS; });
                firebase.database().ref('users/' + refUid + '/phase2/referrals').transaction(function (arr) {
                    arr = arr || []; arr.push({ uid: P.uid, date: Date.now() }); return arr;
                });
                firebase.database().ref('users/' + refUid + '/phase2/notifications').transaction(function (arr) {
                    arr = arr || [];
                    arr.unshift({ id: 'n' + Date.now(), icon: '🤝', title: 'Yangi referral!', text: "Do'stingiz kodingizni ishlatdi. +" + fmtSom(REFERRAL_BONUS) + " so'm bonus!", date: Date.now(), read: false });
                    return arr;
                });
            } catch (e) {}
            toast('✅ ' + fmtSom(REFERRAL_BONUS) + " so'm bonus oldingiz!", 'success');
            hap('success');
            confettiBurst();
            evaluateAchievements();
            renderProfile();
            P.openReferral();
        }).catch(function () { toast('Xatolik yuz berdi', 'warning'); });
    };
    P.openReferral = function () {
        ensureReferralCode();
        var box = document.getElementById('p2-ref-body');
        if (box) {
            var refs = P.state.referrals || [];
            box.innerHTML =
                '<div class="p2-ref-code-box">' +
                '<div style="font-size:12px;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;font-weight:700;">Sizning taklif kodingiz</div>' +
                '<div class="p2-ref-code">' + esc(P.state.referralCode || '...') + '</div>' +
                '<div style="font-size:12px;color:#30d158;font-weight:700;">Har bir do\'st uchun ' + fmtSom(REFERRAL_BONUS) + " so'm bonus 🎁</div>" +
                '<div style="display:flex;gap:8px;margin-top:14px;">' +
                '<button onclick="Phase2.copyReferral()" style="flex:1;background:rgba(255,255,255,0.08);border:1px solid var(--glass-border);color:var(--text-main,#fff);padding:11px;border-radius:12px;font-weight:700;font-size:13px;cursor:pointer;">📋 Nusxa</button>' +
                '<button onclick="Phase2.shareReferral()" style="flex:1;background:linear-gradient(135deg,#30d158,#1fa845);border:none;color:#fff;padding:11px;border-radius:12px;font-weight:800;font-size:13px;cursor:pointer;">📤 Ulashish</button>' +
                '</div></div>' +
                (P.state.referredBy ?
                    '<div style="background:rgba(48,209,88,0.10);border:1px solid rgba(48,209,88,0.25);border-radius:14px;padding:13px 15px;font-size:13px;color:#30d158;font-weight:700;margin-bottom:16px;">✓ Siz <b>' + esc(P.state.referredBy) + '</b> kodi orqali kirdingiz</div>'
                    :
                    '<div style="background:var(--surface-2,rgba(255,255,255,0.04));border:1px solid var(--glass-border);border-radius:14px;padding:15px;margin-bottom:16px;">' +
                    '<div style="font-size:13px;font-weight:700;color:var(--text-main,#fff);margin-bottom:4px;">Do\'stingizning kodi bormi?</div>' +
                    '<div style="font-size:11px;color:var(--text-muted);margin-bottom:10px;">Kodni kiriting va ' + fmtSom(REFERRAL_BONUS) + " so'm bonus oling</div>" +
                    '<div class="p2-ref-input"><input id="p2-ref-input" class="search-box" placeholder="A1XXXXX" style="flex:1;padding:11px 14px;border-radius:12px;text-transform:uppercase;">' +
                    '<button onclick="Phase2.redeemReferral()" class="btn-checkout" style="width:auto;padding:0 18px;border-radius:12px;font-size:13px;">Tasdiqlash</button></div></div>') +
                '<div class="p2-sec-title">👥 Taklif qilganlaringiz (' + refs.length + ')</div>' +
                (refs.length ? refs.map(function (r) {
                    return '<div style="display:flex;justify-content:space-between;align-items:center;padding:11px 0;border-bottom:1px solid var(--glass-border);">' +
                        '<div style="font-size:13px;color:var(--text-main,#fff);font-weight:600;">👤 ID: ' + esc(String(r.uid).slice(-6)) + '</div>' +
                        '<div style="font-size:12px;color:#30d158;font-weight:800;">+' + fmtSom(REFERRAL_BONUS) + '</div></div>';
                }).join('') : emptyHTML('🤝', "Hali hech kimni taklif qilmadingiz"));
        }
        if (typeof openModal === 'function') openModal('p2ReferralModal');
    };

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
    function animateFills(sel, attr) {
        requestAnimationFrame(function () {
            document.querySelectorAll(sel).forEach(function (el) {
                requestAnimationFrame(function () { el.style.width = (el.getAttribute('data-' + attr) || 0) + '%'; });
            });
        });
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
            tile('🔗', 'Referral', 'Phase2.openReferral()', '') +
            tile('🛡', 'Kafolat', 'Phase2.openWarranty()', warrBadgeHTML()) +
            tile('🔔', 'Xabarlar', 'Phase2.openNotifs()', '<span class="p2-tile-badge" id="p2-tile-notif-badge"></span>') +
            tile(P.state.theme === 'light' ? '🌙' : '☀️', 'Mavzu', 'Phase2.toggleTheme(event)', '') +
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
        header.style.position = 'sticky';
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
            modal('p2NotifModal', '🔔 Bildirishnomalar',
                '<button onclick="Phase2.markAllRead()" style="background:none;border:none;color:var(--luxury-gold);font-size:12px;font-weight:700;cursor:pointer;margin-bottom:10px;align-self:flex-end;">Hammasini o\'qilgan deb belgilash</button>' +
                '<div class="p2-modal-scroll" id="p2-notif-list"></div>') +
            modal('p2AchievementsModal', '🏆 Yutuqlar', '<div class="p2-modal-scroll" id="p2-ach-body"></div>') +
            modal('p2AnalyticsModal', '📊 Shaxsiy analitika', '<div class="p2-modal-scroll" id="p2-an-body"></div>') +
            modal('p2ReferralModal', '🔗 Referral dasturi', '<div class="p2-modal-scroll" id="p2-ref-body"></div>') +
            modal('p2WarrantyModal', '🛡 Kafolat kuzatuvi', '<div class="p2-modal-scroll" id="p2-warr-body"></div>') +
            modal('p2CashbackModal', '🎁 Cashback', '<div class="p2-modal-scroll" id="p2-cashback-body"></div>') +
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
            '<div class="modal-header"><h2>' + title + '</h2><button class="close-btn" onclick="closeModal()">×</button></div>' +
            inner + '</div>';
    }

    /* ============================================================
       INTEGRATSIYA HOOK'LARI
       ============================================================ */
    // Buyurtma berilganda chaqiriladi (confirmOrder ichidan)
    P.onOrderPlaced = function (order, productsDB) {
        if (productsDB) P.productsDB = productsDB;
        if (!order) return;
        // orderni mahalliy ro'yxatga ham qo'shamiz (sync gacha)
        if (!P.orders.some(function (o) { return o.id === order.id; })) P.orders.unshift(order);
        var earned = Math.round((order.total || 0) * CASHBACK_RATE);
        if (earned > 0) {
            addCashback(earned, 'Buyurtma ' + (order.code || '#' + order.id), 'earn');
            pushNotif('🎁', 'Cashback qo\'shildi', '+' + fmtSom(earned) + " so'm cashback hisobingizga tushdi.", { silent: true });
        }
        pushNotif('📦', 'Buyurtma qabul qilindi', 'Buyurtmangiz ' + (order.code || '') + ' rasmiylashtirildi. Rahmat!', { silent: true });
        createWarranties(order);
        save();
        evaluateAchievements();
        renderProfile();
        toast('🎁 +' + fmtSom(earned) + " so'm cashback!", 'success');
    };

    // Firebase'dan ma'lumot kelganda (mavjud listener ichidan)
    P.sync = function (data, uid, productsDB) {
        if (uid) P.uid = uid;
        if (productsDB) P.productsDB = productsDB;
        if (data) {
            P.orders = toArray(data.orders);
            P.wishlistCount = toArray(data.wishlist).length;
            if (data.phase2 && !P._writing) {
                // Remote source-of-truth, lekin maydonlarni ehtiyotkorlik bilan birlashtiramiz
                var r = data.phase2;
                P.state.cashback = (typeof r.cashback === 'number') ? r.cashback : P.state.cashback;
                P.state.cashbackTotal = (typeof r.cashbackTotal === 'number') ? r.cashbackTotal : P.state.cashbackTotal;
                if (r.cashbackHistory) P.state.cashbackHistory = toArray(r.cashbackHistory);
                if (r.achievements) P.state.achievements = r.achievements;
                if (r.referralCode) P.state.referralCode = r.referralCode;
                if (r.referredBy) P.state.referredBy = r.referredBy;
                if (r.referrals) P.state.referrals = toArray(r.referrals);
                if (r.notifications) P.state.notifications = toArray(r.notifications);
                if (r.warranties) P.state.warranties = toArray(r.warranties);
                if (typeof r.themeSwitched === 'boolean') P.state.themeSwitched = r.themeSwitched;
                if (r.theme) P.state.theme = r.theme;
                saveLocal();
            }
        }
        applyTheme(P.state.theme);
        ensureReferralCode();
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
                ensureReferralCode();
            }
            if ((window.currentUser && P.uid) || tries > 40) clearInterval(iv);
        }, 500);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
