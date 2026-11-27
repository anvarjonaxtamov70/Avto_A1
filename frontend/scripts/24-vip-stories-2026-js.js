
/* ============================================================================
   ✦ QATLAM 2026.06 — JS
   ----------------------------------------------------------------------------
   1) MODAL MARKUP — yangi oynalar DOM'ga qo'shiladi
   2) window.VIP        — mijoz darajasi tizimi (2026.09 dan IKKI daraja)
   3) window.AvtoStories — mini app ichidan story qo'yish + boshqarish
   4) O'NGGA TORTISH IMOSI — Telegram uslubida story composer'ni ochish
   5) MIJOZLAR — ro'yxatning to'liq qayta yozilishi
   ============================================================================ */
(function () {
    'use strict';

    /* ------------------------------------------------------------------ *
     * 0. UMUMIY YORDAMCHILAR
     * ------------------------------------------------------------------ */
    var E = function (s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
        });
    };
    var $ = function (id) { return document.getElementById(id); };
    var hap = function (k) { try { if (window._hap) window._hap(k); } catch (e) {} };
    var toast = function (m, t) { try { if (window.showToast) window.showToast(m, t); } catch (e) {} };
    var amAdmin = function () { try { return !!(window.isAdmin && window.isAdmin()); } catch (e) { return false; } };

    /* ⚠️ MUHIM NUANS — GLOBAL O'ZGARUVCHILARGA KIRISH
       Asosiy skriptdagi `const db`, `const ADMIN_ID`, `let myProfile`, `let activeModal`
       kabi e'lonlar `window` OBYEKTIGA TUSHMAYDI (top-level let/const global leksik
       muhitda yashaydi). Shuning uchun `window.db` — `undefined`. Quyidagi
       yordamchilar avval leksik bog'lanishni sinaydi, keyin zaxira yo'lni oladi. */

    /** Realtime Database — leksik `db`, aks holda firebase singleton'i. */
    function DB() {
        try { if (typeof db !== 'undefined' && db) return db; } catch (e) {}
        try {
            if (window.firebase && window.firebase.apps && window.firebase.apps.length) {
                return window.firebase.database();
            }
        } catch (e) {}
        return null;
    }

    /** Asosiy admin chat_id (bildirishnomalar uchun). */
    function adminChatId() {
        try { if (typeof ADMIN_ID !== 'undefined' && ADMIN_ID) return ADMIN_ID; } catch (e) {}
        try { if (typeof ADMIN_IDS !== 'undefined' && ADMIN_IDS && ADMIN_IDS.length) return ADMIN_IDS[0]; } catch (e) {}
        return null;
    }

    /** Joriy foydalanuvchi profili. */
    function myProfileSafe() {
        try { if (typeof myProfile !== 'undefined' && myProfile) return myProfile; } catch (e) {}
        return window.myProfile || null;
    }

    /** Ochiq oyna identifikatori — `activeModal` leksik o'zgaruvchisining o'zi. */
    function curModal() {
        try { if (typeof activeModal !== 'undefined') return activeModal; } catch (e) {}
        return window.activeModal || null;
    }
    var reduceMotion = function () {
        try {
            return (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
                || document.documentElement.classList.contains('lite');
        } catch (e) { return false; }
    };

    /** 1 250 000 -> "1.25 mln" / 320 000 -> "320 ming" — mayda yozuvni kamaytiradi. */
    function fmtShort(n) {
        n = parseInt(n, 10) || 0;
        if (n >= 1000000) {
            var m = n / 1000000;
            return (m >= 10 ? Math.round(m) : (Math.round(m * 10) / 10)) + ' mln';
        }
        if (n >= 1000) return Math.round(n / 1000) + ' ming';
        return String(n);
    }
    function fmtSom(n) {
        n = parseInt(n, 10) || 0;
        return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    }

    /** Buyurtmalarni massivga aylantiradi (baza array yoki object bo'lishi mumkin). */
    function ordersArr(o) {
        if (!o) return [];
        return Array.isArray(o) ? o.filter(Boolean) : Object.keys(o).map(function (k) { return o[k]; }).filter(Boolean);
    }

    /** Buyurtma vaqtini millisekundga keltiradi (id = Date.now(), yoki 'dd.mm.yyyy'). */
    function orderTime(o) {
        if (!o) return 0;
        var id = parseInt(o.id, 10);
        // id — Date.now() bo'lgani uchun 2001-yildan keyingi qiymat = vaqt tamg'asi
        if (id && id > 1000000000000) return id;
        if (o.createdAt && parseInt(o.createdAt, 10) > 1000000000000) return parseInt(o.createdAt, 10);
        if (o.date) {
            var p = String(o.date).split(/[.\/\-]/);
            if (p.length === 3) {
                var d = parseInt(p[0], 10), mo = parseInt(p[1], 10), y = parseInt(p[2], 10);
                if (y < 100) y += 2000;
                var t = new Date(y, (mo || 1) - 1, d || 1).getTime();
                if (!isNaN(t)) return t;
            }
        }
        return 0;
    }

    /** "3 kun oldin" ko'rinishidagi nisbiy vaqt. */
    function agoLabel(ms) {
        ms = parseInt(ms, 10) || 0;
        if (!ms) return '—';
        var d = Date.now() - ms;
        if (d < 0) d = 0;
        var min = Math.floor(d / 60000);
        if (min < 1) return 'hozir';
        if (min < 60) return min + ' daqiqa oldin';
        var h = Math.floor(min / 60);
        if (h < 24) return h + ' soat oldin';
        var day = Math.floor(h / 24);
        if (day === 1) return 'kecha';
        if (day < 30) return day + ' kun oldin';
        var mo = Math.floor(day / 30);
        if (mo < 12) return mo + ' oy oldin';
        return Math.floor(mo / 12) + ' yil oldin';
    }

    /** Raqamni 0'dan berilgan qiymatga sanab chiqaradi (KPI kartalari uchun). */
    function countUp(el, to, fmt, dur) {
        if (!el) return;
        to = parseInt(to, 10) || 0;
        fmt = fmt || function (v) { return String(v); };
        if (reduceMotion() || to === 0) { el.textContent = fmt(to); return; }
        var start = null; dur = dur || 850;
        function step(ts) {
            if (start === null) start = ts;
            var p = Math.min(1, (ts - start) / dur);
            var e = 1 - Math.pow(1 - p, 3);
            el.textContent = fmt(Math.round(to * e));
            if (p < 1) requestAnimationFrame(step);
            else el.textContent = fmt(to);
        }
        requestAnimationFrame(step);
    }

    /** Kartalarga bosqichma-bosqich (stagger) kirish animatsiyasi. */
    function stagger(nodes, step, max) {
        if (reduceMotion()) return;
        step = step || 45; max = max || 12;
        Array.prototype.forEach.call(nodes, function (n, i) {
            n.style.animationDelay = (Math.min(i, max) * step) + 'ms';
        });
    }

    /* Admin oynalarini ochishning YAGONA usuli — mavjud ilova qoidasiga mos:
       ota oyna yashiriladi, yangisi flex bo'ladi, history'ga pushState.
       (popstate handleri qaytishni o'zi hal qiladi — yuqorida ro'yxatga qo'shildi) */
    function openSheet(id, fromId) {
        if (fromId && $(fromId)) $(fromId).style.display = 'none';
        var m = $(id);
        if (!m) return false;
        m.style.display = 'flex';
        m.scrollTop = 0;
        document.body.style.overflow = 'hidden';
        // `activeModal` — leksik global; window nusxasini ham sinxron saqlaymiz
        window.activeModal = id;
        try { activeModal = id; } catch (e) {}
        window.history.pushState({ modal: id }, '');
        try { if (window.tg && tg.BackButton) tg.BackButton.show(); } catch (e) {}
        try { if (window.updateBtns) window.updateBtns(); } catch (e) {}
        return true;
    }

    /* ================================================================== *
     * 1. MODAL MARKUP — DOM'ga qo'shamiz
     * ------------------------------------------------------------------
     * HTML'ni bitta joyda saqlash uchun markup shu yerda. Uchala oyna
     * `.modal-standard` qobig'idan foydalanadi — mavjud dizayn tili,
     * mavjud popstate/BackButton mantig'i o'zgarmaydi.
     * ================================================================== */
    var MODALS_HTML =
        // ---------- Story composer ("tez story") ----------
        '<div class="modal-standard" id="storyComposerModal">' +
            '<div class="st2-hd">' +
                '<div><h2>Yangi story</h2><span>Rasm tanlang — 20 soniyada tayyor</span></div>' +
                '<button class="close-btn" aria-label="Yopish" onclick="closeModal()">&times;</button>' +
            '</div>' +
            '<div id="story-composer-body"></div>' +
            '<div class="st2-foot">' +
                '<button class="st2-save" id="st2-save-btn" type="button">Storisni joylash</button>' +
            '</div>' +
        '</div>' +
        // ---------- Stories admin boshqaruvi ----------
        '<div class="modal-standard" id="adminStoriesModal">' +
            '<div class="modal-header">' +
                '<h2 style="color:#ff2d92;">Stories</h2>' +
                '<button class="close-btn" aria-label="Yopish" style="font-size:24px;" onclick="closeModal()">&larr;</button>' +
            '</div>' +
            '<div id="admin-stories-list"></div>' +
        '</div>' +
        // ---------- Mijoz tafsiloti ----------
        '<div class="modal-standard" id="customerDetailModal">' +
            '<div class="st2-hd">' +
                '<div><h2 id="cdt-title">Mijoz</h2><span id="cdt-sub">Tafsilotlar</span></div>' +
                '<button class="close-btn" aria-label="Yopish" onclick="closeModal()">&times;</button>' +
            '</div>' +
            '<div id="customer-detail-body"></div>' +
        '</div>' +
        // ---------- VIP daraja tabrigi ----------
        '<div id="vipc-up"><div class="vipc-up-box">' +
            '<div class="vipc-up-ic" id="vipc-up-ic">&#128081;</div>' +
            '<h3 id="vipc-up-title">Tabriklaymiz!</h3>' +
            '<p id="vipc-up-text"></p>' +
            '<button class="vipc-up-btn" type="button" id="vipc-up-ok">Ajoyib!</button>' +
        '</div></div>' +
        // ---------- O'ngga tortish imosi paneli ----------
        '<div id="st2-peek">' +
            '<div class="st2-peek-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.2l1.1-1.7A1 1 0 0 1 9.6 3.8h4.8a1 1 0 0 1 .8.5L16.3 6h1.2A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5z"/><circle cx="12" cy="12.2" r="3.4"/></svg></div>' +
            '<div class="st2-peek-tx">Yangi<br>story</div>' +
        '</div>';

    function injectModals() {
        if ($('storyComposerModal')) return;
        var host = document.createElement('div');
        host.id = 'layer2026-modals';
        host.innerHTML = MODALS_HTML;
        document.body.appendChild(host);
        var ok = $('vipc-up-ok');
        if (ok) ok.onclick = function () { var b = $('vipc-up'); if (b) b.classList.remove('show'); };
        var vb = $('vipc-up');
        if (vb) vb.onclick = function (e) { if (e.target === vb) vb.classList.remove('show'); };
    }
    injectModals();

    /* ================================================================== *
     * 2. window.VIP — HAQIQIY, POG'ONALI VIP TIZIMI
     * ------------------------------------------------------------------
     * ILGARI NIMA BO'LGAN: `_updateVipStatus()` `.profile-header` klassini
     * izlardi, lekin profil ekrani inline stil bilan yozilgani uchun bu
     * klass hech qayerda yo'q edi -> funksiya har safar darhol `return`
     * qilardi. Ya'ni VIP yorlig'i HECH QACHON ko'rinmagan. Bundan tashqari
     * VIP hech qayerga saqlanmagani uchun admin ham, bot ham uni bilmasdi
     * va hech qanday imtiyoz bermasdi.
     *
     * ENDI:
     *   • ikki daraja (Oddiy mijoz / VIP mijoz) — FAQAT xarid summasi bo'yicha
     *   • profilda jonli karta: daraja, progress, keyingi darajaga qancha qolgani
     *   • HAQIQIY imtiyozlar (aynan ikkitasi, ikkalasi ham kodda qo'llanadi):
     *     bepul yetkazish chegarasi pasayadi va cashback ulushi oshadi
     *   • `users/{uid}/profile/vip` ga YOZILADI -> admin ro'yxatida ko'rinadi,
     *     segment bo'yicha filtr ishlaydi, bot ham o'qiy oladi
     *   • daraja ko'tarilganda tabrik + Telegram xabari (bir marta)
     *   • admin qo'lda VIP qilib qo'yishi mumkin (`profile.vip.manual`)
     * ================================================================== */
    /* ⚠️ 2026.09 — TO'RT DARAJA IKKIGA TUSHIRILDI.
     *
     * ILGARI: Bronza / Kumush / Oltin / Platina — «o'yinchoq» narvon.
     * Muammolari:
     *   • `cashbackX` (×1, ×1.5, ×2, ×3) HECH QAYERDA qo'llanmagan —
     *     `VIP.cashbackMultiplier()` yozilgan, lekin hech kim chaqirmagan.
     *     Ya'ni hamma bir xil 1% olardi, ko'paytiruvchi esa bezak edi.
     *   • `discount` (2%, 3%, 5%) ham HECH QACHON narxga qo'llanmagan —
     *     mijozga berilmaydigan «shaxsiy chegirma» va'da qilinardi.
     *   • Daraja «summa YOKI xarid SONI» bo'yicha berilardi, ya'ni 12 ta
     *     arzon buyurtma bergan mijoz Platina bo'lib qolardi.
     *
     * ENDI: ikki daraja, HAQIQIY va faqat SUMMA bo'yicha:
     *   Oddiy mijoz — bepul yetkazish 3 mln so'mdan, cashback 0.8%
     *   VIP mijoz   — bepul yetkazish 2.4 mln so'mdan, cashback 1%
     *                 (umumiy xaridi 3 mln so'mga yetganda)
     *
     * ⚠️ 2026.08 — VIP cashback 2% dan 1% ga tushirildi va «Ustuvor xizmat»
     *   imtiyozi OLIB TASHLANDI. Sabab: «ustuvor xizmat» hech qanday kodda
     *   qo'llanmagan — mijozga bajarilmaydigan va'da berilardi (bu ilgari
     *   `cashbackX`/`discount` bilan bo'lgan xatoning aynan o'zi).
     *   Endi darajaning FAQAT ikkita haqiqiy imtiyozi bor:
     *   bepul yetkazish chegarasi va cashback ulushi.
     *
     * `rate` — HAQIQATDA qo'llanadigan cashback ulushi (Phase2 o'qiydi).
     */
    var VIP_MIN_SPENT = 3000000;   // VIP bo'lish chegarasi (yetkazilgan buyurtmalar summasi)

    var TIERS = [
        {
            id: 'ordinary', name: 'Oddiy mijoz', icon: '\uD83D\uDED2', minSpent: 0,
            grad: 'linear-gradient(145deg,#eef2f7,#c3cad5 48%,#8b939f)', c1: '#dfe5ee',
            ink: '#1d2128', glow: 'rgba(160,170,185,.3)',
            soft: 'linear-gradient(160deg,rgba(200,208,220,.16),rgba(0,0,0,.3))',
            freeDelivery: 3000000, rate: 0.008
        },
        {
            id: 'vip', name: 'VIP mijoz', icon: '\uD83D\uDC8E', minSpent: VIP_MIN_SPENT,
            grad: 'linear-gradient(145deg,#F0D060,#C9A84C 45%,#96720A)', c1: '#F0D060',
            ink: '#2a2000', glow: 'rgba(201,168,76,.34)',
            soft: 'linear-gradient(160deg,rgba(201,168,76,.18),rgba(0,0,0,.3))',
            freeDelivery: 2400000, rate: 0.01
        }
    ];
    var TIER_BY_ID = {};
    TIERS.forEach(function (t) { TIER_BY_ID[t.id] = t; });

    var VIP = {
        TIERS: TIERS,
        /** Shu indeksdan boshlab VIP hisoblanadi (endi faqat 2-daraja). */
        VIP_FROM: 1
    };

    /** Buyurtma tarixidan daraja hisoblaydi. `manual` — admin qo'lda bergan daraja. */
    VIP.compute = function (orders, manual) {
        var arr = ordersArr(orders);
        var delivered = arr.filter(function (o) { return o && o.status === 'yetkazildi'; });
        var spent = delivered.reduce(function (s, o) { return s + (parseInt(o.total, 10) || 0); }, 0);
        var count = delivered.length;

        // Daraja FAQAT summa bo'yicha. Ilgari «summa YOKI xarid soni» edi —
        // shu sababli arzon buyurtmalarni ko'p bergan mijoz eng yuqori
        // darajaga chiqib ketardi.
        var idx = 0;
        for (var i = TIERS.length - 1; i >= 0; i--) {
            if (spent >= TIERS[i].minSpent) { idx = i; break; }
        }
        // Admin qo'lda ko'targan bo'lsa — pasaytirmaymiz
        if (manual && TIER_BY_ID[manual]) {
            var mIdx = TIERS.indexOf(TIER_BY_ID[manual]);
            if (mIdx > idx) idx = mIdx;
        }

        var tier = TIERS[idx];
        var next = TIERS[idx + 1] || null;
        var progress = 100, needSom = 0;
        if (next) {
            progress = next.minSpent > tier.minSpent
                ? Math.max(0, Math.min(100, Math.round(
                    (spent - tier.minSpent) / (next.minSpent - tier.minSpent) * 100)))
                : 100;
            needSom = Math.max(0, next.minSpent - spent);
        }
        return {
            tier: tier, tierIdx: idx, next: next, spent: spent, count: count,
            progress: progress, needSom: needSom, needOrd: 0,
            isVip: idx >= VIP.VIP_FROM, manual: manual || null,
            allOrders: arr.length
        };
    };

    /** Boshqa modullar uchun: joriy foydalanuvchi holati (kesh). */
    VIP.state = null;

    /** Bepul yetkazish chegarasi — savat progress bar shu qiymatni ishlatadi. */
    VIP.freeDeliveryTarget = function () {
        var s = VIP.state;
        return (s && s.tier) ? s.tier.freeDelivery : 3000000;
    };
    /** 💳 HAQIQIY cashback ulushi (Oddiy 0.008 / VIP 0.01).
     *
     *  ⚠️ Ilgari bu yerda `cashbackMultiplier()` bor edi va u HECH KIM
     *  tomonidan chaqirilmagan — ya'ni daraja cashback'ga umuman ta'sir
     *  qilmasdi. Endi Phase2 aynan shu funksiyani o'qiydi. */
    VIP.cashbackRate = function () {
        var s = VIP.state;
        return (s && s.tier && typeof s.tier.rate === 'number') ? s.tier.rate : 0.008;
    };
    /** Foiz ko'rinishida: 0.008 -> "0.8", 0.01 -> "1" (ortiqcha nol yo'q). */
    VIP.ratePct = function (tier) {
        var r = (tier && typeof tier.rate === 'number') ? tier.rate : VIP.cashbackRate();
        return String(+(r * 100).toFixed(2));
    };
    /** Buyurtma xabariga qo'shiladigan ustuvorlik belgisi (admin ko'rishi uchun). */
    VIP.orderTag = function () {
        var s = VIP.state;
        if (!s || !s.isVip) return '';
        return s.tier.icon + ' ' + s.tier.name.toUpperCase() + ' mijoz';
    };

    /** CSS o'zgaruvchilarini elementga o'rnatadi (daraja rangi). */
    function paintTier(el, tier) {
        if (!el || !tier) return;
        el.style.setProperty('--tier-grad', tier.grad);
        el.style.setProperty('--tier-1', tier.c1);
        el.style.setProperty('--tier-ink', tier.ink);
        el.style.setProperty('--tier-tx', tier.ink);
        el.style.setProperty('--tier-glow', tier.glow);
        el.style.setProperty('--tier-soft', tier.soft);
    }
    VIP.paintTier = paintTier;

    /** Profil ekranidagi VIP karta konteynerini topadi/yaratadi. */
    function vipBox() {
        var box = $('vip-card-box');
        if (box) return box;
        var stats = $('pf-stats-box');
        if (!stats || !stats.parentNode) return null;
        box = document.createElement('div');
        box.id = 'vip-card-box';
        // Statistika kartalaridan YUQORIDA — profil ochilganda birinchi ko'zga tushadi
        stats.parentNode.insertBefore(box, stats);
        return box;
    }

    function perkHTML(icon, text, on) {
        return '<div class="vipc-perk' + (on ? '' : ' off') + '"><span>' + icon + '</span><b>' + text + '</b></div>';
    }

    /** Profil VIP kartasini chizadi. */
    VIP.render = function () {
        var s = VIP.state;
        if (!s) return;
        var box = vipBox();
        if (!box) return;
        var t = s.tier, n = s.next;

        // Daraja endi FAQAT summa bo'yicha — «yoki N ta buyurtma» matni olib tashlandi.
        var nextTx = !n
            ? 'Siz VIP mijozimizsiz. Rahmat, ishonchingiz uchun!'
            : ('<b>' + n.name + '</b> bo\u2018lishga yana ' + fmtSom(s.needSom) + " so'm qoldi");

        box.innerHTML =
            '<div class="vipc-card" id="vipc-card" role="button" tabindex="0">' +
                '<div class="vipc-top">' +
                    '<div class="vipc-crown">' + t.icon + '</div>' +
                    '<div class="vipc-hd">' +
                        '<div class="vipc-kicker">Mijoz darajasi</div>' +
                        '<div class="vipc-tier">' + E(t.name) + (s.isVip ? ' &middot; VIP' : '') + '</div>' +
                    '</div>' +
                    '<div class="vipc-badge">' + fmtShort(s.spent) + " so'm</div>" +
                '</div>' +
                '<div class="vipc-prog">' +
                    '<div class="vipc-prog-t"><span>' + E(t.name) + '</span><b>' + (n ? n.name : 'Maksimal') + '</b></div>' +
                    '<div class="vipc-bar"><i id="vipc-bar-fill"></i></div>' +
                    '<div class="vipc-next">' + nextTx + '</div>' +
                '</div>' +
                '<div class="vipc-perks">' +
                    perkHTML('\uD83D\uDE9A', 'Shahar bo\u2018ylab bepul yetkazish ' + fmtShort(t.freeDelivery) + " so'mdan", true) +
                    perkHTML('\uD83C\uDF81', 'Cashback ' + VIP.ratePct(t) + '%', true) +
                '</div>' +
            '</div>';

        var card = $('vipc-card');
        paintTier(card, t);
        if (card) {
            card.onclick = function () { hap('light'); VIP.showDetails(); };
        }
        // Progress barni animatsiya bilan to'ldiramiz
        var fill = $('vipc-bar-fill');
        if (fill) {
            if (reduceMotion()) fill.style.width = s.progress + '%';
            else requestAnimationFrame(function () {
                requestAnimationFrame(function () { fill.style.width = s.progress + '%'; });
            });
        }

        // Avatardagi VIP halqasi — ILGARI O'LIK ELEMENT edi, endi ishlaydi
        var ring = $('pf-vip-ring');
        if (ring) {
            ring.style.display = s.isVip ? 'block' : 'none';
            ring.style.borderColor = t.c1;
        }
        // "A'zo bo'lgan sana" — ilgari hech qachon to'ldirilmagan
        var since = $('pf-member-since');
        if (since) {
            var sinceMs = VIP.sinceMs || 0;
            since.textContent = sinceMs
                ? (t.icon + ' ' + t.name + " a'zo &middot; " + new Date(sinceMs).toLocaleDateString('uz-UZ')).replace('&middot;', '·')
                : (t.icon + ' ' + t.name + ' daraja');
            since.style.color = t.c1;
        }
    };

    /**
     * Darajalar jadvali — kartani bosganda KARTA OSTIDA ochiladi/yopiladi.
     *
     * ⚠️ NEGA modal yoki `tg.showAlert` EMAS: `showAlert` uzun matnni kesib
     * tashlaydi (va ba'zi mijozlarda umuman ko'rinmaydi), `prompt`/`alert` esa
     * Telegram WebView'da bloklanishi mumkin. Ichki panel har joyda ishlaydi
     * va history/BackButton mantig'iga ham tegmaydi.
     */
    VIP.showDetails = function () {
        var s = VIP.state;
        if (!s) return;
        var box = $('vip-card-box');
        if (!box) return;
        var panel = $('vipc-ladder');
        if (panel) {                      // ochiq edi -> yopamiz
            // `parentNode` bo'lmasligi mumkin (VIP.render() konteynerni qayta chizsa
            // element hujjatdan uzilib qoladi) — shuning uchun himoyalangan o'chirish
            if (panel.parentNode) panel.parentNode.removeChild(panel);
            else if (panel.remove) panel.remove();
            return;
        }
        panel = document.createElement('div');
        panel.id = 'vipc-ladder';
        panel.style.cssText = 'margin-top:10px; border-radius:18px; overflow:hidden; ' +
            'background:var(--card-bg); border:1px solid var(--glass-border); animation:lyRise .35s both;';

        var rows = TIERS.map(function (t, i) {
            var done = i < s.tierIdx, now = i === s.tierIdx;
            var mark = done ? '\u2713' : (now ? '\u25B6' : '\u00B7');
            return '<div style="display:flex; gap:12px; align-items:flex-start; padding:14px 15px;' +
                (i ? ' border-top:1px solid var(--glass-border);' : '') +
                (now ? ' background:rgba(201,168,76,.09);' : '') + '">' +
                '<span style="flex:none; width:22px; text-align:center; font-size:14px; font-weight:800; color:' +
                    (now ? t.c1 : 'var(--text-muted)') + ';">' + mark + '</span>' +
                '<div style="flex:1; min-width:0;">' +
                    '<div style="font-size:14.5px; font-weight:800; color:' + (now ? t.c1 : 'var(--text-main)') + ';">' +
                        t.icon + ' ' + E(t.name) + (now ? " — sizdagi daraja" : '') + '</div>' +
                    '<div style="font-size:12px; color:var(--text-muted); margin-top:4px; line-height:1.5;">' +
                        (t.minSpent > 0
                            ? ('Shart: umumiy xaridingiz ' + fmtShort(t.minSpent) + " so'mga yetsa<br>")
                            : 'Barcha mijozlar uchun<br>') +
                        'Bepul yetkazish ' + fmtShort(t.freeDelivery) + " so'mdan &middot; cashback " + VIP.ratePct(t) + '%' +
                    '</div>' +
                '</div></div>';
        }).join('');

        panel.innerHTML = rows +
            '<div style="padding:14px 15px; border-top:1px solid var(--glass-border); ' +
            'font-size:12.5px; font-weight:700; color:var(--luxury-gold); text-align:center;">' +
            'Sizda: ' + fmtSom(s.spent) + " so'm &middot; " + s.count + ' ta yetkazilgan buyurtma</div>';
        box.appendChild(panel);
    };

    /* --- Firebase'ga saqlash: admin va bot VIP'ni ko'rishi uchun --- */
    function persist(s) {
        try {
            if (!window.currentUser || !DB()) return;
            var payload = {
                tier: s.tier.id,
                tierName: s.tier.name,
                level: s.tierIdx,
                isVip: s.isVip,
                spent: s.spent,
                orders: s.count,
                updatedAt: Date.now()
            };
            if (VIP.sinceMs) payload.since = VIP.sinceMs;
            // ⚠ CHEKSIZ SIKL TUZATISHI: bu yozuv users/{uid} tinglovchisini qayta
            //    ishga tushiradi -> profil qayta chiziladi -> yana persist(). Ilgari
            //    har safar yangi `updatedAt` bilan yozilgani uchun sikl hech qachon
            //    to'xtamasdi (ilova ro'yxatdan o'tishdan keyin qotib qolardi).
            //    Endi faqat daraja ma'lumoti HAQIQATAN o'zgarganda yoziladi.
            var sig = window.currentUser + '|' + JSON.stringify([payload.tier, payload.level, payload.isVip, payload.spent, payload.orders, payload.since || 0]);
            if (persist._sig === sig) return;
            persist._sig = sig;
            DB().ref('users/' + window.currentUser + '/profile/vip').update(payload).catch(function () {});
        } catch (e) {}
    }

    /** Daraja ko'tarilganda: tabrik oynasi + konfetti + Telegram xabari (bir marta). */
    function celebrate(s) {
        var KEY = 'avto_vip_tier_seen';
        var prev = null;
        try { prev = localStorage.getItem(KEY); } catch (e) {}
        var curIdx = String(s.tierIdx);
        if (prev === null) { try { localStorage.setItem(KEY, curIdx); } catch (e) {} return; }
        if (parseInt(prev, 10) >= s.tierIdx) return;   // pasaymadi/o'zgarmadi
        try { localStorage.setItem(KEY, curIdx); } catch (e) {}

        var t = s.tier;
        var box = $('vipc-up');
        if (box) {
            paintTier(box.querySelector('.vipc-up-box'), t);
            var ic = $('vipc-up-ic'); if (ic) ic.textContent = t.icon;
            var ti = $('vipc-up-title'); if (ti) ti.textContent = t.name + ' darajasi!';
            var tx = $('vipc-up-text');
            if (tx) {
                tx.innerHTML = 'Siz <b>' + E(t.name) + '</b> bo\'ldingiz.<br>' +
                    'Shahar bo\u2018ylab bepul yetkazish ' + fmtShort(t.freeDelivery) + " so'mdan, cashback " +
                    VIP.ratePct(t) + '%.';
            }
            box.classList.add('show');
        }
        hap('success');
        try { if (window.Phase2 && window.Phase2.confettiBurst) window.Phase2.confettiBurst(); } catch (e) {}

        // Telegram tabrigi — mijozning o'z chatiga
        try {
            if (window.tgProxySend && window.currentUser) {
                window.tgProxySend({
                    chat_id: window.currentUser,
                    parse_mode: 'HTML',
                    text: t.icon + ' <b>Tabriklaymiz!</b>\n\nSiz Avto A1 do\'konida <b>' + t.name +
                        '</b> darajasiga ko\'tarildingiz.\n\n' +
                        '\u2022 Shahar bo\u2018ylab bepul yetkazish: ' + fmtSom(t.freeDelivery) + " so'mdan\n" +
                        '\u2022 Cashback: ' + VIP.ratePct(t) + '%\n' +
                        '\nIshonchingiz uchun rahmat!'
                });
            }
        } catch (e) {}
    }

    /**
     * Asosiy kirish nuqtasi — `_updateVipStatus()` shu funksiyani chaqiradi.
     * Buyurtmalar har o'zgarganda (Firebase listener) ishlaydi.
     */
    VIP.refresh = function (orders) {
        try {
            var manual = null;
            try {
                var p = myProfileSafe();
                if (p && p.vip && p.vip.manual) manual = p.vip.manual;
            } catch (e) {}

            var s = VIP.compute(orders, manual);
            VIP.state = s;

            // "A'zo bo'lgan" sana — eng birinchi buyurtma vaqti
            var times = ordersArr(orders).map(orderTime).filter(function (t) { return t > 0; });
            VIP.sinceMs = times.length ? Math.min.apply(null, times) : 0;
            try {
                var _mp = myProfileSafe(); var pv = _mp && _mp.vip;
                if (pv && pv.since && (!VIP.sinceMs || pv.since < VIP.sinceMs)) VIP.sinceMs = pv.since;
            } catch (e) {}

            VIP.render();
            persist(s);
            celebrate(s);
        } catch (e) { if (window._dwarn) window._dwarn('[VIP] refresh xato:', e); }
    };

    /** Admin uchun: mijozning darajasini qo'lda o'rnatish/olib tashlash. */
    VIP.setManual = function (uid, tierId) {
        if (!DB()) return Promise.reject(new Error('DB yo\'q'));
        var ref = DB().ref('users/' + uid + '/profile/vip');
        if (!tierId) return ref.update({ manual: null, updatedAt: Date.now() });
        var t = TIER_BY_ID[tierId];
        if (!t) return Promise.reject(new Error('Noma\'lum daraja'));
        return ref.update({
            manual: tierId, tier: tierId, tierName: t.name,
            level: TIERS.indexOf(t), isVip: TIERS.indexOf(t) >= VIP.VIP_FROM,
            updatedAt: Date.now()
        });
    };

    window.VIP = VIP;
    // Profil ekrani ochilganda kartani qayta chizamiz (Phase2 hub'dan oldin turadi)
    try {
        var _origShowProfile = window.showProfile;
        if (typeof _origShowProfile === 'function' && !window._vipWrappedShowProfile) {
            window._vipWrappedShowProfile = true;
            window.showProfile = function () {
                var r = _origShowProfile.apply(this, arguments);
                try { if (VIP.state) VIP.render(); else VIP.refresh(window.myOrders || []); } catch (e) {}
                return r;
            };
        }
    } catch (e) {}









    /* ================================================================== *
     * 3. window.AvtoStories — MINI APP ICHIDAN STORY QO'YISH
     * ------------------------------------------------------------------
     * ILGARI NIMA BO'LGAN: story qo'yishning YAKKA yo'li Telegram boti edi —
     * admin rasm/videoni `#bugun` kabi caption bilan botga yuborishi kerak
     * edi (bot.py: handle_stories). Mini app ichida na qo'shish, na o'chirish,
     * na ro'yxatni ko'rish imkoni bor edi (faqat story ochilganda paydo
     * bo'ladigan bitta "O'chirish" tugmasi bor edi).
     *
     * ENDI: mini app ichidan to'g'ridan-to'g'ri `stories/{kategoriya}/{id}` ga
     * yoziladi — bot bilan BIR XIL sxema, shuning uchun ikkalasi ham
     * bir-birini to'liq tushunadi:
     *     { id, type:'image'|'video', src, poster, timestamp, caption?, link?, source? }
     *
     * MEDIA:
     *   • Rasm — ImgBB'ga yuklanadi (tovar rasmlari bilan bir xil yo'l),
     *     link doimiy, hech qachon eskirmaydi.
     *   • Video — brauzerdan Telegram'ga yuklash uchun bot tokeni kerak
     *     (u mijozda YO'Q, ataylab). Shuning uchun video HAVOLA bilan
     *     qo'shiladi; fayl bo'lsa bot orqali yuborish qulayroq va composer
     *     buni ochiq yozib turadi.
     * ================================================================== */
    var STORY_RINGS = [
        { key: 'aksiyalar', title: 'Aksiyalar',  icon: '\uD83D\uDD25' },
        { key: 'bugun',     title: 'Bugun',      icon: '\u26A1' },
        { key: 'mijozlar',  title: 'Mijozlar',   icon: '\uD83D\uDC65' },
        { key: 'dostavka',  title: 'Yetkazish',  icon: '\uD83D\uDE9A' },
        { key: 'kafolat',   title: 'Kafolat',    icon: '\uD83D\uDEE1' },
        { key: 'lokatsiya', title: 'Manzil',     icon: '\uD83D\uDCCD' },
        { key: 'tolov',     title: "To'lov",     icon: '\uD83D\uDCB3' },
        { key: 'aloqa',     title: 'Aloqa',      icon: '\uD83D\uDCDE' }
    ];
    var RING_BY_KEY = {};
    STORY_RINGS.forEach(function (r) { RING_BY_KEY[r.key] = r; });

    // Composer holati
    var C = { ring: 'bugun', type: '', src: '', poster: '', busy: false };
    // Admin ro'yxati holati
    var A = { rows: [], byCat: {}, total: 0 };

    var AvtoStories = {};
    AvtoStories.RINGS = STORY_RINGS;

    /* ---------------- 3.1 STORIES BAZASINI O'QISH ---------------- */
    function loadStories() {
        return new Promise(function (resolve, reject) {
            if (!DB()) return reject(new Error('Baza ulanmagan'));
            DB().ref('stories').once('value').then(function (snap) {
                var byCat = {}, rows = [], total = 0;
                if (snap.exists()) {
                    var data = snap.val();
                    Object.keys(data).forEach(function (cat) {
                        var items = data[cat];
                        if (!items || typeof items !== 'object') return;
                        var list = Object.keys(items).map(function (k) {
                            var it = items[k] || {};
                            return {
                                key: k,
                                cat: cat,
                                id: it.id != null ? it.id : k,
                                type: it.type === 'video' ? 'video' : 'image',
                                src: it.src || '',
                                poster: it.poster || '',
                                caption: it.caption || '',
                                link: it.link || '',
                                source: it.source || 'bot',
                                timestamp: parseInt(it.timestamp, 10) || 0
                            };
                        }).sort(function (a, b) { return b.timestamp - a.timestamp; });
                        byCat[cat] = list;
                        rows = rows.concat(list);
                        total += list.length;
                    });
                }
                rows.sort(function (a, b) { return b.timestamp - a.timestamp; });
                A.byCat = byCat; A.rows = rows; A.total = total;
                resolve();
            }).catch(reject);
        });
    }

    /* ---------------- 3.2 COMPOSER ("tez story") ---------------- */

    function ringPickerHTML() {
        return STORY_RINGS.map(function (r) {
            var cnt = (A.byCat[r.key] || []).length;
            return '<button type="button" class="st2-ring' + (C.ring === r.key ? ' on' : '') +
                '" data-ring="' + r.key + '">' +
                '<span>' + r.icon + '</span><i>' + E(r.title) + '</i>' +
                (cnt ? '<em class="st2-ring-cnt">' + cnt + '</em>' : '') +
                '</button>';
        }).join('');
    }

    function composerHTML() {
        return '' +
            // --- MEDIA ---
            '<div class="st2-block">' +
                '<p class="st2-lbl">1 &middot; Rasm yoki video</p>' +
                '<div class="st2-picks">' +
                    '<div class="st2-pick" id="st2-pick-img" role="button" tabindex="0">' +
                        '<span class="st2-pick-ic" id="st2-pick-img-ic">\uD83D\uDDBC</span>' +
                        '<b id="st2-pick-img-tx">Rasm</b><i>Galereyadan yuklash</i>' +
                    '</div>' +
                    '<div class="st2-pick" id="st2-pick-vid" role="button" tabindex="0">' +
                        '<span class="st2-pick-ic" id="st2-pick-vid-ic">\uD83C\uDFAC</span>' +
                        '<b id="st2-pick-vid-tx">Video</b><i id="st2-pick-vid-sub">Galereyadan &middot; 20 MB gacha</i>' +
                    '</div>' +
                '</div>' +
                // ⚠️ `display:none` EMAS: Telegram'ning ichki brauzerida (ayniqsa
                //    iOS WKWebView) yashirilgan input'ni `.click()` bilan ochish
                //    ba'zan UMUMAN ishlamaydi — galereya ochilmaydi. Shuning uchun
                //    input DOM'da "ko'rinadigan" (opacity:0, 1px) holatda turadi —
                //    tovar rasmlarida ishlab turgan usul bilan bir xil.
                '<input type="file" id="st2-file" accept="image/png,image/jpeg,image/jpg,image/heic,image/heif,image/webp" class="st2-hidden-file">' +
                '<input type="file" id="st2-file-vid" accept="video/mp4,video/quicktime,video/webm,video/*" class="st2-hidden-file">' +
                '<div class="st2-up hidden" id="st2-up">' +
                    '<i id="st2-up-bar"></i><span id="st2-up-tx">0%</span>' +
                    '<button type="button" class="st2-up-x" id="st2-up-x" aria-label="Bekor qilish" ' +
                        'onclick="window._st2CancelUpload && window._st2CancelUpload()">&times;</button>' +
                '</div>' +
                '<div class="st2-prev hidden" id="st2-prev"></div>' +
                '<div id="st2-url-wrap" style="display:none; margin-top:13px;">' +
                    '<p class="st2-hint" style="margin-top:0;">Video <b>galereyadan</b> yuklanadi \u2014 yuqoridagi \uD83C\uDFAC tugmasini bosing. ' +
                    'Tayyor havola bo\'lsa, pastga qo\'ying.</p>' +
                    '<label class="st2-field"><span>Yoki video havolasi (mp4)</span>' +
                    '<input type="text" class="st2-input" id="st2-vid-url" placeholder="https://..." autocomplete="off"></label>' +
                    '<label class="st2-field"><span>Muqova rasmi (ixtiyoriy)</span>' +
                    '<input type="text" class="st2-input" id="st2-vid-poster" placeholder="https://... (birinchi kadr)" autocomplete="off"></label>' +
                '</div>' +
                '<label class="st2-field" id="st2-img-url-wrap" style="margin-top:13px;"><span>Yoki rasm havolasi</span>' +
                '<input type="text" class="st2-input" id="st2-img-url" placeholder="https://..." autocomplete="off"></label>' +
            '</div>' +
            // --- BO'LIM ---
            '<div class="st2-block">' +
                '<p class="st2-lbl">2 &middot; Qaysi bo\'limga</p>' +
                '<div class="st2-rings" id="st2-rings">' + ringPickerHTML() + '</div>' +
            '</div>' +
            // --- MATN ---
            '<div class="st2-block">' +
                '<p class="st2-lbl">3 &middot; Matn (ixtiyoriy)</p>' +
                '<label class="st2-field"><span>Story ustidagi yozuv</span>' +
                '<textarea class="st2-input" id="st2-caption" rows="2" maxlength="160" placeholder="Masalan: Kalotkalarga 20% chegirma \u2014 faqat bugun"></textarea></label>' +
                '<label class="st2-field"><span>Havola (ixtiyoriy)</span>' +
                '<input type="text" class="st2-input" id="st2-link" placeholder="Tovar kodi yoki https://..." autocomplete="off"></label>' +
                '<p class="st2-hint">Havola qo\'ysangiz, story ostida <b>Batafsil</b> tugmasi chiqadi.</p>' +
            '</div>';
    }

    function setPickState() {
        var pi = $('st2-pick-img'), pv = $('st2-pick-vid');
        if (pi) pi.classList.toggle('on', C.type === 'image');
        if (pv) pv.classList.toggle('on', C.type === 'video');
        var uw = $('st2-url-wrap');
        if (uw) uw.style.display = (C.type === 'video') ? 'block' : 'none';
        var iw = $('st2-img-url-wrap');
        if (iw) iw.style.display = (C.type === 'video') ? 'none' : 'block';
    }

    function showProgress(pct, label) {
        var box = $('st2-up'), bar = $('st2-up-bar'), tx = $('st2-up-tx');
        if (!box) return;
        if (pct === null) { box.classList.add('hidden'); return; }
        box.classList.remove('hidden');
        if (bar) bar.style.width = Math.max(2, Math.min(100, pct)) + '%';
        if (tx) tx.textContent = label || (pct + '%');
        // "×" (bekor qilish) faqat haqiqiy yuklash davomida ko'rinadi
        var x = $('st2-up-x');
        if (x) x.style.display = _vidXhr ? 'flex' : 'none';
    }

    function showPreview(url, isVideo) {
        var box = $('st2-prev');
        if (!box) return;
        if (!url) { box.classList.add('hidden'); box.innerHTML = ''; return; }
        // Videoda MUQOVA (poster) bo'lsa qo'yamiz — qora ekran o'rniga birinchi
        // kadr darhol ko'rinadi (kutish hissi yo'qoladi).
        var posterAttr = (isVideo && C.poster) ? ' poster="' + E(C.poster) + '"' : '';
        box.innerHTML =
            '<span class="st2-prev-badge">' + (isVideo ? 'VIDEO' : 'RASM') + '</span>' +
            '<button type="button" class="st2-prev-clear" id="st2-prev-clear" aria-label="Tozalash">&times;</button>' +
            (isVideo
                ? '<video src="' + E(url) + '"' + posterAttr + ' playsinline muted controls preload="metadata"></video>'
                : '<img src="' + E(url) + '" alt="" onerror="this.style.opacity=.25;">');
        box.classList.remove('hidden');
        var cl = $('st2-prev-clear');
        if (cl) cl.onclick = function () {
            C.src = ''; C.poster = ''; C.type = '';
            showPreview('', false); setPickState();
            var iu = $('st2-img-url'); if (iu) iu.value = '';
            var vu = $('st2-vid-url'); if (vu) vu.value = '';
            var it = $('st2-pick-img-tx'); if (it) it.textContent = 'Rasm';
            var ii = $('st2-pick-img-ic'); if (ii) ii.textContent = '\uD83D\uDDBC';
            var vp2 = $('st2-vid-poster'); if (vp2) vp2.value = '';
            setVidPickUI('\uD83C\uDFAC', 'Video', 'Galereyadan &middot; 20 MB gacha');
            hap('light');
        };
    }

    /** Rasmni ImgBB'ga yuklaydi — mavjud `uploadFileWithProgress` orqali. */
    function uploadPhoto(file) {
        if (!file) return;
        if (typeof window.uploadFileWithProgress !== 'function') {
            toast('Rasm yuklash moduli topilmadi', 'warning');
            return;
        }
        var MAX = 20 * 1024 * 1024;
        if (file.size > MAX) {
            toast('Rasm juda katta (' + Math.round(file.size / 1048576) + ' MB). 20 MB gacha bo\'lsin.', 'warning');
            return;
        }
        var tx = $('st2-pick-img-tx'), ic = $('st2-pick-img-ic');
        if (tx) tx.textContent = 'Yuklanmoqda...';
        if (ic) ic.textContent = '\u23F3';
        showProgress(4, 'Rasm yuklanmoqda...');
        window.uploadFileWithProgress(file, function (p) { showProgress(p); })
            .then(function (url) {
                C.type = 'image'; C.src = url; C.poster = '';
                showProgress(null);
                showPreview(url, false);
                setPickState();
                if (tx) tx.textContent = 'Rasm tayyor';
                if (ic) ic.textContent = '\u2705';
                var iu = $('st2-img-url'); if (iu) iu.value = url;
                hap('success');
                toast('Rasm yuklandi', 'success');
            })
            .catch(function (err) {
                showProgress(null);
                if (tx) tx.textContent = 'Rasm';
                if (ic) ic.textContent = '\uD83D\uDDBC';
                toast('Rasm yuklanmadi: ' + ((err && err.message) || 'xatolik'), 'warning');
            });
    }

    /* ==================================================================
     * 🎬 VIDEONI GALEREYADAN YUKLASH
     * ------------------------------------------------------------------
     * ⚠️ ILGARI: mini app'dan storisga video QO'SHIB BO'LMASDI — admin faqat
     *    tashqi havola yozishi mumkin edi. Sabab: ImgBB video qabul qilmaydi,
     *    Telegram'ga to'g'ridan yuklash uchun esa bot tokeni kerak (u mijozda
     *    ataylab saqlanmaydi).
     *
     * ENDI: fayl Worker'ning /upload endpoint'iga boradi, Worker uni Telegram'ga
     *    yuklaydi va MUDDATSIZ `file_id` qaytaradi. /media proxy videoni
     *    Range (qism-qism) bilan uzatadi -> mijoz kutmaydi, video darhol
     *    o'ynay boshlaydi. Telegram avtomatik yasagan MUQOVA (thumbnail) ham
     *    olinadi -> ochilishda qora ekran emas, birinchi kadr ko'rinadi.
     *
     * 📏 CHEGARA — 20 MB. Bu bizning tanlovimiz emas: Telegram bot API
     *    `getFile` bilan faqat 20 MB gacha faylni o'qiy oladi, ya'ni kattasi
     *    yuklansa ham keyin KO'RSATIB BO'LMAYDI. Shuning uchun chegaradan
     *    oshgan faylni darhol rad etib, aniq yo'l ko'rsatamiz.
     * ================================================================== */
    var VIDEO_MAX = 20 * 1024 * 1024;

    function fmtMB(b) { return (Math.round((b / 1048576) * 10) / 10) + ' MB'; }

    function setVidPickUI(icon, text, sub) {
        var ic = $('st2-pick-vid-ic'), tx = $('st2-pick-vid-tx'), sb = $('st2-pick-vid-sub');
        if (ic) ic.textContent = icon;
        if (tx) tx.textContent = text;
        if (sb && sub != null) sb.innerHTML = sub;
    }

    /* ------------------------------------------------------------------ *
     * Yuklash holati — bekor qilish va "qotib qolishga" qarshi himoya
     * ------------------------------------------------------------------ */
    var _vidXhr = null;          // joriy so'rov (bekor qilish uchun)
    var _vidStallTimer = null;   // "javob yo'q" nazoratchisi

    function _clearVidStall() {
        if (_vidStallTimer) { clearTimeout(_vidStallTimer); _vidStallTimer = null; }
    }

    /** Yuklash UI'sini boshlang'ich holatga qaytaradi (HAR qanday yo'lda). */
    function _resetVidUI(msg, kind) {
        _clearVidStall();
        _vidXhr = null;
        showProgress(null);
        setVidPickUI('\uD83C\uDFAC', 'Video', 'Galereyadan &middot; 20 MB gacha');
        if (msg) toast(msg, kind || 'warning');
    }

    /**
     * ⏰ STALL NAZORATCHISI — "qotib qolish"ning oldini oladi.
     * Belgilangan vaqt ichida hech qanday harakat bo'lmasa, so'rovni
     * BEKOR qilamiz va UI'ni tozalaymiz. Ilgari bunday himoya yo'q edi:
     * yuklash to'xtab qolsa, mijoz 3 daqiqa "⏳ Yuklanmoqda..." ga qarab
     * turardi va ekran qotgandek ko'rinardi.
     */
    function _armVidStall(ms, reason) {
        _clearVidStall();
        _vidStallTimer = setTimeout(function () {
            _vidStallTimer = null;
            var x = _vidXhr;
            if (!x) return;
            try { x._st2Aborted = true; x.abort(); } catch (e) {}
            _resetVidUI(reason || 'Aloqa uzildi — qayta urinib ko\'ring');
        }, ms);
    }

    /** Admin "×" bosganda yuklashni bekor qiladi. */
    window._st2CancelUpload = function () {
        var x = _vidXhr;
        if (!x) { showProgress(null); return; }
        try { x._st2Aborted = true; x.abort(); } catch (e) {}
        hap('light');
        _resetVidUI('Yuklash bekor qilindi', 'info');
    };

    /**
     * Fayl HAQIQATAN video ekanini aniqlaydi.
     * ⚠️ Ba'zi Android galereyalari `file.type` ni BO'SH qaytaradi, iOS esa
     *    `.mov` uchun ba'zan noto'g'ri MIME beradi. Faqat MIME'ga tayanib
     *    bo'lmaydi — kengaytmani ham tekshiramiz. (Ilgari MIME bo'sh bo'lsa
     *    Worker faylni RASM deb Telegram'ga yuborardi va Telegram rad etardi.)
     */
    function _isVideoFile(file) {
        var t = String((file && file.type) || '').toLowerCase();
        if (t.indexOf('video/') === 0) return true;
        if (t.indexOf('image/') === 0) return false;
        var n = String((file && file.name) || '').toLowerCase();
        return /\.(mp4|mov|m4v|webm|3gp|3gpp|avi|mkv|qt|mpeg|mpg)$/.test(n);
    }

    function uploadVideo(file) {
        // 🛡️ Butun funksiya try/catch ichida: kutilmagan xato bo'lsa ham
        //    UI "⏳ Yuklanmoqda..." holatida QOTIB QOLMAYDI.
        try {
            _uploadVideoInner(file);
        } catch (e) {
            _resetVidUI('Yuklash boshlanmadi: ' + ((e && e.message) || String(e)));
        }
    }

    function _uploadVideoInner(file) {
        if (!file) return;
        if (!amAdmin()) { toast('Faqat admin', 'warning'); return; }

        // 0) Video ekanini tekshiramiz (rasm tanlansa — rasm yo'liga o'tkazamiz)
        if (!_isVideoFile(file)) {
            var mt = String(file.type || '').toLowerCase();
            if (mt.indexOf('image/') === 0) {
                toast('Bu rasm — rasm sifatida yuklayapman', 'info');
                C.type = 'image'; setPickState();
                uploadPhoto(file);
                return;
            }
            _resetVidUI('Bu fayl video emas. mp4 yoki mov tanlang.');
            return;
        }

        // 1) Hajm chegarasi — ochiq va aniq tushuntirish bilan
        if (file.size > VIDEO_MAX) {
            showProgress(null);
            setVidPickUI('\uD83C\uDFAC', 'Video', 'Galereyadan &middot; 20 MB gacha');
            var msg = 'Video juda katta: ' + fmtMB(file.size) + ' (chegara 20 MB).\n\n' +
                'Telegram bundan kattasini o\'ynatib bera olmaydi.\n\n' +
                'Yechim:\n' +
                '\u2022 Videoni qisqartiring (15\u201330 soniya odatda 20 MB ichida)\n' +
                '\u2022 Yoki videoni BOTGA yuboring: Telegram uni o\'zi siqadi. ' +
                'Izohiga #' + C.ring + ' yozsangiz, aynan shu bo\'limga tushadi.';
            try {
                if (window.tg && tg.showAlert) { tg.showAlert(msg); }
                else { toast('Video 20 MB dan katta (' + fmtMB(file.size) + ')', 'warning'); }
            } catch (e) { toast('Video 20 MB dan katta', 'warning'); }
            return;
        }

        // 2) initData bo'lmasa Worker rad etadi — oldindan aytamiz
        //    ⚠️ `window.tg` GA TAYANMAYMIZ: u yuqorida `let tg` bilan
        //    e'lon qilingani uchun uzoq vaqt `undefined` bo'lib turgan va
        //    aynan shu sabab video yuklash umuman boshlanmagan. Endi
        //    to'g'ridan leksik `tg` ni o'qiymiz (zaxira sifatida window ham).
        var initData = '';
        try {
            var _tg = (typeof tg !== 'undefined' && tg) ? tg : (window.tg || null);
            initData = (_tg && _tg.initData) ? _tg.initData : '';
        } catch (e) {}
        if (!initData) {
            // 📱 Ilova/saytdagi admin: Telegram orqali kirgan bo'lsa (uid = Telegram ID) —
            //    Worker /upload ga Firebase idToken bilan (Authorization: Bearer).
            var fu = null;
            try { fu = (window.firebase && firebase.auth) ? firebase.auth().currentUser : null; } catch (e) {}
            if (!fu || !/^[1-9]\d{2,19}$/.test(String(fu.uid))) {
                toast('Video yuklash uchun Telegram hisobi bilan kiring (Profil \u2192 Hisob)', 'warning');
                return;
            }
            setVidPickUI('\u23F3', 'Tayyorlanmoqda...', fmtMB(file.size));
            fu.getIdToken().then(function (tok) { _startVideoSend(file, '', tok); },
                function () { _resetVidUI('Sessiya eskirgan \u2014 ilovani qayta oching'); });
            return;
        }
        _startVideoSend(file, initData, '');
    }

    function _startVideoSend(file, initData, idToken) {
        setVidPickUI('\u23F3', 'Yuklanmoqda...', fmtMB(file.size));
        // ⚡ "FASTSTART": telefon videolarida `moov` (indeks) ko'pincha fayl OXIRIDA
        //    bo'ladi — mijozning brauzeri o'ynatishdan oldin avval oxirini, keyin
        //    boshini so'rardi (har so'rov ~1 s) va video 3-4 s qora turardi.
        //    Yuklashdan oldin indeks boshiga ko'chiriladi (qayta kodlashsiz, sifat
        //    o'zgarmaydi). Qatlam yo'q yoki fayl tanilmasa — asl fayl ketadi.
        if (typeof window._a1FastStart === 'function') {
            showProgress(2, 'Video tayyorlanmoqda...');
            window._a1FastStart(file).then(function (f) { _sendVideo(f || file, initData, false, idToken); },
                function () { _sendVideo(file, initData, false, idToken); });
            return;
        }
        showProgress(2, 'Video yuklanmoqda... 0%');
        _sendVideo(file, initData, false, idToken);
    }

    /* ==================================================================
     * VIDEONI YUBORISH — IKKI YO'L
     * ------------------------------------------------------------------
     * 1) STREAM (asosiy): initData `X-Init-Data` HEADER'ida, body'da faqat
     *    fayl. Worker body'ni ochmasdan to'g'ridan Telegram'ga uzatadi.
     *    Bu Worker'ning CPU cheklovi muammosini hal qiladi — ilgari 20 MB
     *    ni Worker xotirada parse qilardi va cheklovga urilib O'LARDI,
     *    mijozda esa progress 95% da qotib qolardi.
     *
     * 2) LEGACY (zaxira): initData body ichida. Agar Worker hali
     *    yangilanmagan bo'lsa (yangi `X-Init-Data` header'ini CORS'da
     *    ruxsat etmaydi -> so'rov umuman ketmaydi), avtomat shu yo'lga
     *    o'tamiz. Shunda admin "Worker deploy qil" degan xabarni kutmasdan
     *    ishlashda davom etadi.
     * ================================================================== */
    function _sendVideo(file, initData, legacy, idToken) {
        var fd = new FormData();
        var url;
        if (legacy) {
            fd.append('initData', initData);
            fd.append('file', file, file.name || 'story.mp4');
            url = TG_PROXY + '/upload';
        } else {
            // Telegram `sendVideo` maydon nomi AYNAN "video" bo'lishi shart
            fd.append('video', file, file.name || 'story.mp4');
            url = TG_PROXY + '/upload?kind=video';
        }

        var xhr = new XMLHttpRequest();
        _vidXhr = xhr;
        try {
            xhr.open('POST', url);
            if (!legacy) {
                if (idToken) xhr.setRequestHeader('Authorization', 'Bearer ' + idToken);
                else xhr.setRequestHeader('X-Init-Data', initData);
            }
        } catch (e) {
            _resetVidUI('So\'rov ochilmadi: ' + ((e && e.message) || String(e)));
            return;
        }
        xhr.timeout = 240000;   // 4 daqiqa — juda sekin internet uchun

        // Zaxira yo'lga o'tish kerakmi? (idToken bilan zaxira yo'q — u faqat initData'li eski Worker uchun)
        var _canFallback = !legacy && !idToken;
        var _fallback = function () {
            _clearVidStall();
            _vidXhr = null;
            showProgress(4, 'Qayta urinilmoqda...');
            _sendVideo(file, initData, true);
        };

        // Yuklash boshlanishini kutamiz (30s harakatsizlik -> uzilgan deb hisoblaymiz)
        _armVidStall(30000, 'Yuklash boshlanmadi — internetni tekshiring');

        // `_vidXhr` endi o'rnatildi — progress panelini qayta chizamiz, shunda
        // "×" (bekor qilish) tugmasi DARHOL ko'rinadi. (Ilgari u faqat birinchi
        // progress hodisasidan keyin paydo bo'lardi: sekin internetda mijoz
        // uzoq vaqt bekor qila olmasdi.)
        showProgress(legacy ? 4 : 2, 'Video yuklanmoqda... 0%');

        xhr.upload.onprogress = function (e) {
            if (!e.lengthComputable) return;
            var pct = Math.round((e.loaded / e.total) * 100);
            // Har harakatda nazoratchini qaytadan qo'yamiz
            _armVidStall(30000, 'Yuklash to\'xtab qoldi — qayta urinib ko\'ring');
            // 95% da to'xtatamiz: qolgani Telegram qayta ishlashi
            showProgress(Math.min(95, pct), pct < 100
                ? 'Yuklanmoqda... ' + pct + '% \u00B7 ' + fmtMB(e.loaded) + ' / ' + fmtMB(e.total)
                : 'Telegram qayta ishlayapti...');
        };

        // Fayl to'liq ketdi — endi SERVER javobini kutamiz.
        // Telegram katta videoni qayta ishlashi uzoq davom etishi mumkin,
        // shuning uchun nazoratchi oynasini kengaytiramiz.
        xhr.upload.onloadend = function () {
            showProgress(96, 'Telegram qayta ishlayapti...');
            _armVidStall(120000, 'Server javob bermadi — qayta urinib ko\'ring');
        };

        xhr.onload = function () {
            _clearVidStall();
            _vidXhr = null;
            var j = null;
            try { j = JSON.parse(xhr.responseText); } catch (e) {}

            if (xhr.status === 200 && j && j.ok && j.url) {
                C.type = 'video';
                C.src = j.url;
                C.poster = j.thumb_url || '';
                showProgress(null);
                showPreview(j.url, true);
                setPickState();
                var durTx = j.duration ? (j.duration + ' soniya') : fmtMB(j.size || file.size);
                setVidPickUI('\u2705', 'Video tayyor', durTx);
                // Havola maydonlarini ham to'ldiramiz (admin ko'rib turishi uchun)
                var vu = $('st2-vid-url'); if (vu) vu.value = j.url;
                var vp = $('st2-vid-poster'); if (vp && j.thumb_url) vp.value = j.thumb_url;
                hap('success');
                toast('Video yuklandi \u2705', 'success');
                return;
            }

            var err = (j && j.error) || ('HTTP ' + xhr.status);

            // Worker stream rejimini bilmaydi -> legacy'ga o'tamiz
            if (_canFallback && (xhr.status === 404 || xhr.status === 405 ||
                                 xhr.status === 501 || err === 'multipart kerak')) {
                _fallback();
                return;
            }

            showProgress(null);
            setVidPickUI('\uD83C\uDFAC', 'Video', 'Galereyadan &middot; 20 MB gacha');
            if (xhr.status === 413 || err === 'juda katta') {
                toast('Video 20 MB dan katta — qisqartiring', 'warning');
            } else if (xhr.status === 403 || err === 'ruxsat yoq') {
                toast('Ruxsat yo\'q — faqat admin yuklaydi', 'warning');
            } else if (xhr.status === 401) {
                toast('Sessiya eskirgan — ilovani yopib qayta oching', 'warning');
            } else if (xhr.status === 404) {
                toast('Server hali yangilanmagan (Worker deploy kerak). Hozircha havola qo\'ying.', 'warning');
            } else {
                toast('Video yuklanmadi: ' + err, 'warning');
            }
        };

        xhr.onerror = function () {
            if (xhr._st2Aborted) return;          // biz o'zimiz bekor qildik
            // CORS/tarmoq xatosi (status 0). Eng ehtimolli sabab: Worker eski
            // versiyada va `X-Init-Data` header'iga preflight ruxsat bermaydi.
            if (_canFallback) { _fallback(); return; }
            _resetVidUI('Tarmoq xatosi — internetni tekshiring');
        };

        xhr.ontimeout = function () {
            if (_canFallback) { _fallback(); return; }
            _resetVidUI('Yuklash juda uzoq davom etdi. Kichikroq video tanlang.');
        };

        xhr.onabort = function () {
            // `_st2CancelUpload` yoki stall nazoratchisi UI'ni allaqachon tozaladi
            _clearVidStall();
            if (_vidXhr === xhr) _vidXhr = null;
        };

        try {
            xhr.send(fd);
        } catch (e) {
            if (_canFallback) { _fallback(); return; }
            _resetVidUI('Yuborilmadi: ' + ((e && e.message) || String(e)));
        }
    }

    function wireComposer() {
        var file = $('st2-file');
        var pi = $('st2-pick-img'), pv = $('st2-pick-vid');
        if (pi) pi.onclick = function () { hap('light'); if (file) file.click(); };
        if (file) file.onchange = function () {
            var f = file.files && file.files[0];
            uploadPhoto(f);
            setTimeout(function () { try { file.value = ''; } catch (e) {} }, 1500);
        };
        // 🎬 VIDEO — endi GALEREYADAN yuklanadi (ilgari faqat havola yozish mumkin edi)
        var vfile = $('st2-file-vid');
        if (pv) pv.onclick = function () {
            hap('light');
            C.type = 'video';
            setPickState();
            if (vfile) vfile.click();
        };
        if (vfile) vfile.onchange = function () {
            var f = vfile.files && vfile.files[0];
            // ⚠️ MUHIM: input.value ni DARHOL tozalamaymiz. iOS WKWebView'da
            //    value tozalanganda tanlangan faylning vaqtinchalik nusxasi
            //    bo'shatilib, `f` O'QILMAYDIGAN bo'lib qolishi mumkin —
            //    natijada yuklash jimgina uzilardi. Avval yuklashni
            //    boshlaymiz, tozalashni keyingi navbatga qoldiramiz.
            uploadVideo(f);
            setTimeout(function () { try { vfile.value = ''; } catch (e) {} }, 1500);
        };

        var iu = $('st2-img-url');
        if (iu) iu.oninput = function () {
            var v = (iu.value || '').trim();
            if (/^https?:\/\//i.test(v)) { C.type = 'image'; C.src = v; showPreview(v, false); setPickState(); }
            else if (!v) { showPreview('', false); }
        };
        var vu2 = $('st2-vid-url');
        if (vu2) vu2.oninput = function () {
            var v = (vu2.value || '').trim();
            if (/^https?:\/\//i.test(v)) { C.type = 'video'; C.src = v; showPreview(v, true); setPickState(); }
            else if (!v) { showPreview('', false); }
        };
        var vp = $('st2-vid-poster');
        if (vp) vp.oninput = function () { C.poster = (vp.value || '').trim(); };

        var rings = $('st2-rings');
        if (rings) {
            rings.onclick = function (e) {
                var b = e.target.closest ? e.target.closest('.st2-ring') : null;
                if (!b) return;
                C.ring = b.getAttribute('data-ring');
                hap('selection');
                rings.innerHTML = ringPickerHTML();
            };
        }

        var save = $('st2-save-btn');
        if (save) save.onclick = saveStory;
        setPickState();
    }

    /** Storisni Firebase'ga yozadi (bot bilan bir xil sxema). */
    function saveStory() {
        if (C.busy) return;
        if (!amAdmin()) { toast('Bu amal faqat admin uchun', 'warning'); return; }
        if (!C.src) { toast('Avval rasm yuklang yoki video havolasini kiriting', 'warning'); return; }
        if (!/^https?:\/\//i.test(C.src)) { toast("Havola https:// bilan boshlanishi kerak", 'warning'); return; }
        if (!RING_BY_KEY[C.ring]) { toast("Bo'limni tanlang", 'warning'); return; }
        if (!DB()) { toast('Baza ulanmagan', 'warning'); return; }

        var capEl = $('st2-caption'), lnEl = $('st2-link');
        var caption = capEl ? (capEl.value || '').trim() : '';
        var link = lnEl ? (lnEl.value || '').trim() : '';

        var btn = $('st2-save-btn');
        C.busy = true;
        if (btn) { btn.disabled = true; btn.textContent = 'Joylanmoqda...'; }

        var now = Date.now();
        // ID: bot `message_id` ishlatadi; biz to'qnashmaslik uchun 'ma' prefiksi + vaqt
        var id = 'ma' + now;
        var rec = {
            id: id,
            type: C.type === 'video' ? 'video' : 'image',
            src: C.src,
            poster: C.poster || '',
            timestamp: now,
            source: 'miniapp'
        };
        if (caption) rec.caption = caption;
        if (link) rec.link = link;

        DB().ref('stories/' + C.ring + '/' + id).set(rec).then(function () {
            hap('success');
            toast('Story joylandi! Bosh sahifada ko\'rinadi.', 'success');
            // Keyingi story uchun formani tozalaymiz (bo'lim tanlovi saqlanadi)
            C.src = ''; C.poster = ''; C.type = '';
            // Adminga xabar (boshqa adminlar ham bilishi uchun)
            try {
                if (window.tgProxySend && adminChatId()) {
                    window.tgProxySend({
                        chat_id: adminChatId(),
                        parse_mode: 'HTML',
                        text: '\uD83D\uDCF8 <b>Mini app orqali yangi story</b>\n\n' +
                            'Bo\'lim: <b>#' + E(C.ring) + '</b>\nTuri: ' + rec.type +
                            (caption ? '\nMatn: ' + E(caption) : '')
                    });
                }
            } catch (e) {}
            // Bazani qayta o'qib, kelgan joyimizga qaytamiz.
            // Agar boshqaruv oynasidan kelgan bo'lsak — ro'yxat yangilangan holda ko'rinadi.
            var cameFrom = window._storyComposerFrom;
            loadStories().catch(function () {}).then(function () {
                window.history.back();
                if (cameFrom === 'adminStoriesModal') {
                    setTimeout(function () {
                        if (curModal() === 'adminStoriesModal') renderStoriesAdmin();
                    }, 120);
                }
            });
        }).catch(function (err) {
            toast('Saqlanmadi: ' + ((err && err.message) || 'ruxsat yo\'q'), 'warning');
        }).then(function () {
            C.busy = false;
            if (btn) { btn.disabled = false; btn.textContent = 'Storisni joylash'; }
        });
    }

    /**
     * Composer'ni ochadi.
     * @param {string} [ring]  boshlang'ich bo'lim
     * @param {string} [from]  qaysi oynadan ochildi (qaytish uchun)
     */
    AvtoStories.openComposer = function (ring, from) {
        if (!amAdmin()) { toast('Story qo\'yish faqat admin uchun', 'warning'); return; }
        if (ring && RING_BY_KEY[ring]) C.ring = ring;
        C.src = ''; C.poster = ''; C.type = ''; C.busy = false;
        window._storyComposerFrom = from || null;

        var body = $('story-composer-body');
        if (!body) return;
        body.innerHTML = composerHTML();
        openSheet('storyComposerModal', from || null);
        wireComposer();
        showProgress(null);
        showPreview('', false);
        // Bo'limlardagi mavjud storis sonini ko'rsatish uchun bazani fonda o'qiymiz
        loadStories().then(function () {
            var r = $('st2-rings');
            if (r && curModal() === 'storyComposerModal') r.innerHTML = ringPickerHTML();
        }).catch(function () {});
    };

    /* ---------------- 3.3 ADMIN BOSHQARUVI ---------------- */

    function storyCardHTML(s) {
        var isNew = (Date.now() - s.timestamp) < 86400000 * 2;   // 2 kundan yangi
        var thumb = s.type === 'video' ? (s.poster || '') : s.src;
        return '<div class="st2-card" data-cat="' + E(s.cat) + '" data-key="' + E(s.key) + '">' +
            '<div class="st2-thumb" data-open="1">' +
                (thumb ? '<img src="' + E(thumb) + '" alt="" loading="lazy" onerror="this.style.display=\'none\';">' : '\uD83C\uDFAC') +
                (s.type === 'video' ? '<i class="st2-play">\u25B6</i>' : '') +
            '</div>' +
            '<div class="st2-mid">' +
                '<b>' + E(s.caption || (RING_BY_KEY[s.cat] ? RING_BY_KEY[s.cat].title : s.cat) + ' storisi') + '</b>' +
                '<div class="st2-meta">' +
                    '<span class="st2-chip' + (s.type === 'video' ? ' is-vid' : '') + '">' +
                        (s.type === 'video' ? '\uD83C\uDFAC Video' : '\uD83D\uDDBC Rasm') + '</span>' +
                    '<span class="st2-chip">' + E(agoLabel(s.timestamp)) + '</span>' +
                    (isNew ? '<span class="st2-chip is-new">Yangi</span>' : '') +
                    (s.source === 'miniapp' ? '<span class="st2-chip">Ilovadan</span>' : '<span class="st2-chip">Botdan</span>') +
                '</div>' +
            '</div>' +
            '<div class="st2-acts">' +
                '<button type="button" class="st2-mini" data-open="1" aria-label="Ko\'rish">\uD83D\uDC41</button>' +
                '<button type="button" class="st2-mini is-del" data-del="1" aria-label="O\'chirish">\uD83D\uDDD1</button>' +
            '</div>' +
        '</div>';
    }

    function renderStoriesAdmin() {
        var box = $('admin-stories-list');
        if (!box) return;

        var cats = STORY_RINGS.filter(function (r) { return (A.byCat[r.key] || []).length > 0; });
        var newest = A.rows.length ? A.rows[0].timestamp : 0;

        var head =
            '<div class="st2-sum">' +
                '<div class="st2-sum-b"><b id="st2-k1">0</b><span>storis</span></div>' +
                '<div class="st2-sum-b"><b id="st2-k2">0</b><span>bo\'lim faol</span></div>' +
                '<div class="st2-sum-b"><b style="font-size:13px; line-height:1.5;">' + E(newest ? agoLabel(newest) : '—') + '</b><span>oxirgisi</span></div>' +
            '</div>' +
            '<button type="button" class="st2-add-btn" id="st2-new-btn">' +
                '<span class="st2-ab-ic">+</span>' +
                '<span class="st2-ab-tx"><b>Yangi story qo\'shish</b><i>Rasm tanlang, bo\'limni belgilang — tayyor</i></span>' +
            '</button>';

        var groups = cats.map(function (r) {
            var items = A.byCat[r.key] || [];
            return '<div class="st2-group">' + r.icon + ' <b>' + E(r.title) + '</b><em>' + items.length + '</em></div>' +
                items.map(storyCardHTML).join('');
        }).join('');

        if (!groups) {
            groups = '<div class="st2-empty"><span class="ic">\uD83D\uDCF8</span>' +
                '<b>Hali storis yo\'q</b>' +
                '<p>Birinchi storisni qo\'shsangiz, u bosh sahifadagi halqalarda darhol paydo bo\'ladi. ' +
                'Mijozlar uni Instagram kabi ko\'radi.</p></div>';
        }

        box.innerHTML = head + groups;

        countUp($('st2-k1'), A.total, function (v) { return String(v); });
        countUp($('st2-k2'), cats.length, function (v) { return String(v); });
        stagger(box.querySelectorAll('.st2-card'), 40, 14);

        var nb = $('st2-new-btn');
        if (nb) nb.onclick = function () { hap('medium'); AvtoStories.openComposer(null, 'adminStoriesModal'); };

        // Kartalardagi amallar
        box.onclick = function (e) {
            var card = e.target.closest ? e.target.closest('.st2-card') : null;
            if (!card) return;
            var cat = card.getAttribute('data-cat');
            var key = card.getAttribute('data-key');
            if (e.target.closest('[data-del]')) { deleteStory(cat, key, card); return; }
            if (e.target.closest('[data-open]')) { previewStory(cat, key); return; }
        };
    }

    /** Storisni ko'rish — mavjud story viewer'ni ishga soladi. */
    function previewStory(cat, key) {
        hap('light');
        try {
            // Boshqaruv oynasini yopmasdan viewer'ni ochamiz (viewer eng ustida)
            if (typeof window.startStories === 'function') {
                var cap = RING_BY_KEY[cat] ? RING_BY_KEY[cat].title : cat;
                window.startStories(cat, cap);
                return;
            }
        } catch (e) {}
        var s = (A.byCat[cat] || []).filter(function (x) { return x.key === key; })[0];
        if (s && s.src) window.open(s.src, '_blank');
    }

    function deleteStory(cat, key, cardEl) {
        if (!amAdmin()) { toast('Faqat admin', 'warning'); return; }
        var doDelete = function () {
            DB().ref('stories/' + cat + '/' + key).remove().then(function () {
                hap('success');
                toast('Storis o\'chirildi', 'success');
                A.byCat[cat] = (A.byCat[cat] || []).filter(function (x) { return x.key !== key; });
                A.rows = A.rows.filter(function (x) { return !(x.cat === cat && x.key === key); });
                A.total = Math.max(0, A.total - 1);
                if (cardEl && cardEl.parentNode) {
                    cardEl.style.transition = 'opacity .22s ease, transform .22s ease';
                    cardEl.style.opacity = '0';
                    cardEl.style.transform = 'translateX(-24px)';
                    setTimeout(renderStoriesAdmin, 230);
                } else { renderStoriesAdmin(); }
            }).catch(function (err) {
                toast('O\'chirilmadi: ' + ((err && err.message) || 'ruxsat yo\'q'), 'warning');
            });
        };
        var q = 'Ushbu storisni butunlay o\'chirasizmi?';
        try {
            if (window.tg && tg.showConfirm) { tg.showConfirm(q, function (ok) { if (ok) doDelete(); }); return; }
        } catch (e) {}
        if (confirm(q)) doDelete();
    }

    AvtoStories.openAdmin = function () {
        if (!amAdmin()) { toast('Bu bo\'lim faqat admin uchun', 'warning'); return; }
        var box = $('admin-stories-list');
        if (box) box.innerHTML = (window._skel ? window._skel(5, 78) : '<p style="text-align:center;">Yuklanmoqda...</p>');
        openSheet('adminStoriesModal', 'adminModal');
        loadStories().then(renderStoriesAdmin).catch(function (err) {
            if (box) {
                box.innerHTML = '<div class="st2-empty"><span class="ic">\u26A0\uFE0F</span><b>O\'qib bo\'lmadi</b>' +
                    '<p>' + E((err && err.message) || 'Bazaga ulanish xatosi') + '</p></div>';
            }
        });
    };

    window.AvtoStories = AvtoStories;

    /* ================================================================== *
     * 4. FAQAT STORIES LENTASIDA O'NGGA TORTISH + "MENING STORYIM"
     * ------------------------------------------------------------------
     * Imo butun sahifaga emas, faqat `#stories-list` lentasiga ulanadi.
     * Lenta chap boshida turganda o'ngga tortish composer'ni ochadi; shu
     * sabab katalog kartalari, vertikal scroll va tizim back imosi buzilmaydi.
     * ================================================================== */
    (function swipeRightToCompose() {
        var SKIP = 'input, textarea, select, button, a, [data-noswipe]';
        var EDGE = 26;      // ekran chetidan boshlangan imo — tizimga qoldiramiz
        var LOCK = 12;      // yo'nalishni aniqlash chegarasi
        var ARM = 88;       // shu masofadan keyin qo'yib yuborsa — ochiladi
        var MAX = 132;      // panel eng ko'p shuncha suriladi

        var sx = 0, sy = 0, dx = 0, dir = null, live = false, peek = null;

        function ready() {
            // Faqat admin, faqat oyna yopiq holatda, faqat kontent ekranida
            if (!amAdmin()) return false;
            if (curModal()) return false;
            try { if (typeof searchActive !== 'undefined' && searchActive) return false; } catch (e) {}
            var sv = $('story-viewer');
            if (sv && sv.style.display && sv.style.display !== 'none') return false;
            return true;
        }

        function panel() {
            if (!peek) peek = $('st2-peek');
            return peek;
        }

        function reset(open) {
            var p = panel();
            if (p) {
                p.style.transition = 'transform .24s cubic-bezier(.25,.9,.3,1), opacity .24s ease';
                p.style.transform = 'translateX(-100%)';
                p.style.opacity = '0';
                p.classList.remove('armed');
                setTimeout(function () {
                    if (!live) { p.classList.remove('show'); p.style.transition = ''; }
                }, 260);
            }
            live = false; dx = 0; dir = null;
            if (open) {
                hap('medium');
                setTimeout(function () { AvtoStories.openComposer(null, null); }, 60);
            }
        }

        function begin(e) {
            live = false; dir = null; dx = 0;
            if (!e.touches || e.touches.length !== 1) return;
            if (!ready()) return;
            var list = $('stories-list');
            if (!list) return;
            var scroller = (list.closest && list.closest('.stories-container')) || list;
            if ((scroller.scrollLeft || list.scrollLeft || 0) > 2) return; // faqat lentaning chap boshi
            var t = e.touches[0];
            if (t.clientX < EDGE) return;                       // tizim imosi zonasi
            if (e.target.closest && e.target.closest(SKIP)) return;
            sx = t.clientX; sy = t.clientY;
            live = true;
        }

        function bindStart() {
            var list = $('stories-list');
            if (!list || list.getAttribute('data-st2-swipe') === '1') return;
            list.setAttribute('data-st2-swipe', '1');
            list.addEventListener('touchstart', begin, { passive: true });
        }
        bindStart();
        setTimeout(bindStart, 900);
        setTimeout(bindStart, 2600);

        document.addEventListener('touchmove', function (e) {
            if (!live || !e.touches || e.touches.length !== 1) return;
            var mx = e.touches[0].clientX - sx;
            var my = e.touches[0].clientY - sy;
            if (dir === null && (Math.abs(mx) > LOCK || Math.abs(my) > LOCK)) {
                // ANIQ gorizontal VA ANIQ o'ngga bo'lishi shart
                dir = (mx > 0 && Math.abs(mx) > Math.abs(my) * 1.5) ? 'right' : 'no';
                if (dir === 'no') { live = false; return; }
                var p0 = panel();
                if (p0) { p0.classList.add('show'); p0.style.transition = 'none'; }
            }
            if (dir !== 'right') return;
            dx = Math.max(0, Math.min(MAX, mx));
            var p = panel();
            if (!p) return;
            var shift = -100 + (dx / MAX) * 100;
            p.style.transform = 'translateX(' + shift + '%)';
            p.style.opacity = String(Math.min(1, dx / 60));
            p.classList.toggle('armed', dx >= ARM);
        }, { passive: true });

        document.addEventListener('touchend', function () {
            if (!live) return;
            var open = (dir === 'right' && dx >= ARM);
            reset(open);
        }, { passive: true });

        document.addEventListener('touchcancel', function () { if (live) reset(false); }, { passive: true });
    })();

    /* ------------------------------------------------------------------ *
     * 4.2 STORIES LENTASIDAGI TELEGRAM-USLUBIDAGI "MENING STORYIM"
     * ------------------------------------------------------------------
     * Admin avatari ustidagi ko'k "+" — doim ko'rinadigan kirish nuqtasi.
     * Story bo'lmasa ham lenta admin uchun yashirilmaydi.
     * ------------------------------------------------------------------ */
    (function addStoryRing() {
        function build() {
            if (!amAdmin()) return;
            var list = $('stories-list');
            if (!list || $('st2-add-item')) return;
            var el = document.createElement('div');
            el.className = 'story-item st2-add';
            el.id = 'st2-add-item';
            el.setAttribute('role', 'button');
            el.setAttribute('tabindex', '0');
            el.setAttribute('aria-label', 'Yangi stories qo‘shish');
            el.innerHTML =
                '<div class="st2-add-ring"><i class="st2-add-orbit" aria-hidden="true"></i>' +
                    '<div class="st2-add-avatar"><b class="st2-add-plus" aria-hidden="true">' +
                        '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg></b></div>' +
                '</div><span>Qo\u2018shish</span>';
            var openComposer = function () { hap('medium'); AvtoStories.openComposer(null, null); };
            el.onclick = openComposer;
            el.onkeydown = function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openComposer(); } };
            list.insertBefore(el, list.firstChild);

            // Lenta yashirilib qolmasin (admin uchun "+" doim kerak)
            var force = function () {
                if (!amAdmin()) return;
                if (list.style.display === 'none') list.style.display = '';
            };
            force();
            try {
                new MutationObserver(force).observe(list, { attributes: true, attributeFilter: ['style'] });
            } catch (e) {
                setInterval(force, 2500);
            }
        }
        // Admin holati auth tugagach aniqlanadi — bir necha marta urinamiz
        build();
        setTimeout(build, 900);
        setTimeout(build, 2600);
        setTimeout(build, 6000);
    })();

    /* ------------------------------------------------------------------ *
     * 4.3 STORY VIEWER'da matn (caption) va "Batafsil" tugmasi
     * ------------------------------------------------------------------
     * Composer `caption` va `link` maydonlarini yozadi. Mavjud viewer ularni
     * bilmaydi, shuning uchun `playCurrentStory`'ni o'rab (wrap) qo'shimcha
     * qatlam chizamiz — asl funksiya mantiqiga tegmaymiz.
     * ------------------------------------------------------------------ */
    (function storyCaptionLayer() {
        function ensureNodes() {
            var viewer = $('story-viewer');
            if (!viewer) return null;
            var cap = $('st2-story-cap');
            if (!cap) {
                cap = document.createElement('div');
                cap.id = 'st2-story-cap';
                cap.style.cssText = 'position:absolute; left:0; right:0; bottom:96px; z-index:55; ' +
                    'padding:0 20px; box-sizing:border-box; display:none; pointer-events:none;';
                cap.innerHTML =
                    '<div id="st2-story-cap-tx" style="background:rgba(0,0,0,.55); backdrop-filter:blur(8px); ' +
                    'color:#fff; font-size:15px; font-weight:700; line-height:1.45; padding:12px 15px; ' +
                    'border-radius:15px; margin-bottom:10px; box-shadow:0 8px 24px rgba(0,0,0,.35);"></div>' +
                    '<button type="button" id="st2-story-link" style="display:none; pointer-events:auto; ' +
                    'width:100%; padding:14px; border:none; border-radius:15px; font-family:inherit; ' +
                    'font-size:15px; font-weight:800; cursor:pointer; background:#fff; color:#111;">Batafsil</button>';
                viewer.appendChild(cap);
            }
            return cap;
        }

        function paint() {
            var cap = ensureNodes();
            if (!cap) return;
            // `playCurrentStory` ichida ochilgan joriy storis (lokal o'zgaruvchi ko'prigi)
            var item = window._st2CurrentStoryItem || null;
            if (!item) { cap.style.display = 'none'; return; }
            var tx = $('st2-story-cap-tx'), lk = $('st2-story-link');
            var hasCap = !!(item.caption && String(item.caption).trim());
            var hasLink = !!(item.link && String(item.link).trim());
            if (!hasCap && !hasLink) { cap.style.display = 'none'; return; }
            cap.style.display = 'block';
            if (tx) {
                tx.style.display = hasCap ? 'block' : 'none';
                tx.textContent = hasCap ? String(item.caption) : '';
            }
            if (lk) {
                lk.style.display = hasLink ? 'block' : 'none';
                lk.onclick = function (e) {
                    e.stopPropagation();
                    var v = String(item.link).trim();
                    hap('medium');
                    if (/^https?:\/\//i.test(v)) {
                        try { if (window.tg && tg.openLink) { tg.openLink(v); return; } } catch (e2) {}
                        window.open(v, '_blank');
                    } else {
                        // Tovar kodi/ID — mahsulot oynasini ochamiz
                        try {
                            if (window.closeStoryViewer) window.closeStoryViewer();
                            var db2 = window.productsDB || [];
                            var p = db2.filter(function (x) {
                                return x && (String(x.id) === v || String(x.code || '').toLowerCase() === v.toLowerCase());
                            })[0];
                            if (p && window.openProduct) window.openProduct(p.id);
                            else toast('Tovar topilmadi: ' + v, 'warning');
                        } catch (e3) {}
                    }
                };
            }
        }

        function wrap() {
            if (typeof window.playCurrentStory !== 'function' || window._st2CapWrapped) return;
            window._st2CapWrapped = true;
            var orig = window.playCurrentStory;
            window.playCurrentStory = function () {
                var r = orig.apply(this, arguments);
                try { setTimeout(paint, 30); } catch (e) {}
                return r;
            };
            var origClose = window.closeStoryViewer;
            if (typeof origClose === 'function') {
                window.closeStoryViewer = function () {
                    var cap = $('st2-story-cap');
                    if (cap) cap.style.display = 'none';
                    return origClose.apply(this, arguments);
                };
            }
        }
        wrap();
        setTimeout(wrap, 1200);
    })();

    /* ================================================================== *
     * 5. MIJOZLAR — TO'LIQ QAYTA YOZILDI
     * ------------------------------------------------------------------
     * ILGARI NIMA BO'LGAN:
     *   • bitta tekis ro'yxat: ism (15px), ID (11px), telefon (13px),
     *     manzil (11px) — hammasi mayda va zich, o'qish qiyin;
     *   • qidiruvdan boshqa hech qanday filtr/saralash yo'q;
     *   • avatar, daraja belgisi, oxirgi xarid sanasi yo'q;
     *   • hech qanday amal yo'q (qo'ng'iroq, Telegram, tafsilot) — faqat
     *     buyurtmalar ro'yxatiga o'tish;
     *   • `${c.name}` to'g'ridan innerHTML'ga qo'yilardi — XSS xavfi;
     *   • statistika yo'q, VIP mijozni ajratib ko'rsatolmasdi.
     *
     * ENDI:
     *   • 4 ta KPI kartasi (raqamlar sanab chiqadi)
     *   • 6 ta segment: Hammasi / VIP / Faol / Yangi / Uxlagan / Xaridsiz
     *   • 3 xil saralash: summa, buyurtma soni, oxirgi xarid
     *   • yirik, aniq kartalar: avatar, daraja rangi, o'rin (#1 #2 #3),
     *     3 ta mini statistika, 4 ta amal tugmasi
     *   • bosqichma-bosqich (stagger) kirish animatsiyasi
     *   • butun matn `E()` bilan xavfsizlanadi
     *   • mijoz tafsiloti alohida oynada
     * ================================================================== */

    var CS = {
        all: [],            // barcha mijozlar
        view: [],           // filtrlangan + saralangan
        seg: 'all',
        sort: 'spent',      // spent | orders | recent
        q: '',
        limit: 20,
        loaded: false,
        animate: true      // kirish animatsiyasini FAQAT kerakli paytda yoqamiz
    };

    var SORTS = [
        { id: 'spent',  label: 'Eng ko\'p sarflagan' },
        { id: 'orders', label: 'Eng ko\'p buyurtma' },
        { id: 'recent', label: 'Oxirgi xaridi yangi' },
        { id: 'name',   label: 'Ism bo\'yicha (A-Z)' }
    ];

    var SEGS = [
        { id: 'all',      icon: '\uD83D\uDC65', label: 'Hammasi' },
        { id: 'vip',      icon: '\uD83D\uDC51', label: 'VIP' },
        { id: 'active',   icon: '\uD83D\uDD25', label: 'Faol' },
        { id: 'new',      icon: '\uD83C\uDD95', label: 'Yangi' },
        { id: 'sleeping', icon: '\uD83D\uDCA4', label: 'Uxlagan' },
        { id: 'noorder',  icon: '\uD83D\uDC64', label: 'Xaridsiz' },
        { id: 'blocked',  icon: '\u26D4', label: 'Bloklangan' }
    ];

    var DAY = 86400000;

    /** Firebase `users` snapshot'idan mijozlar ro'yxatini yasaydi. */
    function buildCustomers(snap) {
        var out = [];
        if (!snap || !snap.exists()) return out;
        var us = snap.val();
        Object.keys(us).forEach(function (uid) {
            var u = us[uid] || {};
            var p = u.profile || {};
            var arr = ordersArr(u.orders);
            var delivered = arr.filter(function (o) { return o && o.status === 'yetkazildi'; });
            var spent = delivered.reduce(function (s, o) { return s + (parseInt(o.total, 10) || 0); }, 0);
            var pending = arr.filter(function (o) {
                return o && o.status !== 'yetkazildi' && o.status !== 'bekor_qilingan';
            }).length;
            var times = arr.map(orderTime).filter(function (t) { return t > 0; });
            var last = times.length ? Math.max.apply(null, times) : 0;
            var first = times.length ? Math.min.apply(null, times) : 0;

            var manual = (p.vip && p.vip.manual) ? p.vip.manual : null;
            var v = VIP.compute(u.orders, manual);
            // 👥 Ism + raqam qoidasi (a1-customer-rule-js; Worker /admin-reset bilan bir xil).
            //    Raqam profilda bo'lmasa — tasdiqlangan (verify) raqam ko'rsatiladi.
            var info = window._a1CustomerInfo
                ? window._a1CustomerInfo(u)
                : { name: p.name || p.firstName || '', phone: p.phone || '', complete: true };

            out.push({
                uid: String(uid),
                name: info.name || 'Nomsiz mijoz',
                phone: info.phone,
                complete: info.complete,
                isAdmin: isAdminUid(uid),
                address: p.address || '',
                username: (p.username && p.username !== "Yo'q") ? String(p.username).replace(/^@/, '') : '',
                orders: arr.length,
                delivered: delivered.length,
                pending: pending,
                spent: spent,
                avg: delivered.length ? Math.round(spent / delivered.length) : 0,
                last: last,
                first: first,
                tier: v.tier,
                tierIdx: v.tierIdx,
                isVip: v.isVip,
                manual: manual,
                cartCount: u.cart ? Object.keys(u.cart).length : 0,
                wishCount: Array.isArray(u.wishlist) ? u.wishlist.length : (u.wishlist ? Object.keys(u.wishlist).length : 0),
                cashback: (u.phase2 && parseInt(u.phase2.cashback, 10)) || 0,
                blocked: !!(window._blockedMap && window._blockedMap[uid]),
                // 🚗 ⚠️ ILGARI XATO: bu yerda `u.my_car.model || u.my_car.name`
                //    yozilgan, ya'ni OBYEKT kutilardi. Ilova esa `my_car` ni
                //    MATN sifatida saqlaydi ("chevy-Nexia 3"). Natijada admin
                //    panelidagi "Mashinasi" ustuni DOIM bo'sh chiqardi.
                //    Endi ikkala format ham tushuniladi va o'qiladigan nomga
                //    aylantiriladi ("Chevrolet Nexia 3").
                car: (function () {
                    var mc = u.my_car;
                    if (!mc) return '';
                    if (typeof mc === 'string') {
                        return (typeof window.myCarLabel === 'function') ? window.myCarLabel(mc) : mc;
                    }
                    return mc.model || mc.name || '';
                })(),
                ordersRaw: arr
            });
        });
        return out;
    }

    function segMatch(c, seg) {
        var now = Date.now();
        switch (seg) {
            case 'vip':      return c.isVip;
            case 'active':   return c.last > 0 && (now - c.last) <= 30 * DAY;
            case 'new':      return c.first > 0 && (now - c.first) <= 14 * DAY;
            case 'sleeping': return c.orders > 0 && c.last > 0 && (now - c.last) > 60 * DAY;
            case 'noorder':  return c.orders === 0;
            case 'blocked':  return !!c.blocked;
            default:         return true;
        }
    }

    /* 🧹 Ismi yoki raqami yo'q foydalanuvchilar ro'yxatda KO'RSATILMAYDI (do'kon
       egasining talabi). CS.all esa to'liq qoladi — VIP belgilari va tafsilot uchun.
       O'chirsa bo'ladiganlar: admin emas va buyurtmasi yo'q (server ham shunday). */
    function shown(c) { return c.complete !== false; }
    function removable() {
        return CS.all.filter(function (c) { return !shown(c) && !c.isAdmin && !c.orders; }).length;
    }

    function applyFilters() {
        var q = CS.q.toLowerCase().trim();
        CS.view = CS.all.filter(function (c) {
            if (!shown(c)) return false;
            if (!segMatch(c, CS.seg)) return false;
            if (!q) return true;
            return c.name.toLowerCase().indexOf(q) !== -1
                || c.uid.toLowerCase().indexOf(q) !== -1
                || (c.phone || '').toLowerCase().indexOf(q) !== -1
                || (c.username || '').toLowerCase().indexOf(q) !== -1;
        });
        var s = CS.sort;
        CS.view.sort(function (a, b) {
            if (s === 'orders') return b.orders - a.orders || b.spent - a.spent;
            if (s === 'recent') return b.last - a.last || b.spent - a.spent;
            if (s === 'name')   return a.name.localeCompare(b.name, 'uz');
            return b.spent - a.spent || b.orders - a.orders;
        });
        CS.limit = 20;
    }

    /* ---------------- 5.1 KPI + asboblar ---------------- */


    function toolsHTML() {
        var sortLabel = (SORTS.filter(function (s) { return s.id === CS.sort; })[0] || SORTS[0]).label;
        return '<div class="cst-tools">' +
            '<div class="cst-search-wrap' + (CS.q ? ' has-text' : '') + '" id="cst-search-wrap">' +
                '<svg class="cst-search-ic" viewBox="0 0 24 24" fill="currentColor"><path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19z"/></svg>' +
                '<input type="text" class="cst-search" id="cst-q" placeholder="Ism, telefon yoki ID..." ' +
                    'value="' + E(CS.q) + '" autocomplete="off" inputmode="search">' +
                '<button type="button" class="cst-search-x" id="cst-q-x" aria-label="Tozalash">&times;</button>' +
            '</div>' +
            '<button type="button" class="cst-sort" id="cst-sort-btn" aria-label="' + E(sortLabel) + '" title="' + E(sortLabel) + '">' +
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
                '<line x1="4" y1="7" x2="16" y2="7"/><line x1="4" y1="12" x2="13" y2="12"/><line x1="4" y1="17" x2="10" y2="17"/>' +
                '<polyline points="17 14 20 17 17 20"/><line x1="20" y1="17" x2="20" y2="8"/></svg>' +
            '</button>' +
        '</div>';
    }

    function segsHTML() {
        return '<div class="cst-segs" id="cst-segs">' + SEGS.map(function (s) {
            var n = CS.all.filter(function (c) { return shown(c) && segMatch(c, s.id); }).length;
            return '<button type="button" class="cst-seg' + (CS.seg === s.id ? ' on' : '') + '" data-seg="' + s.id + '">' +
                s.icon + ' ' + E(s.label) + '<em>' + n + '</em></button>';
        }).join('') + '</div>';
    }

    /** Yashirilgan (ismi yoki raqami yo'q) foydalanuvchilarni bazadan o'chirish paneli. */
    function incompleteHTML() {
        var n = removable();
        if (!n) return '';
        return '<div class="cst-inc" id="cst-inc">' +
            '<span class="cst-inc-tx"><b>' + n + ' ta</b> foydalanuvchining ismi yoki raqami yo\u2018q \u2014 ro\u2018yxatda ko\u2018rsatilmaydi</span>' +
            '<button type="button" class="cst-inc-btn" id="cst-inc-del">O\u2018chirish</button></div>';
    }

    /* ---------------- 5.2 Mijoz kartasi ---------------- */


    function customerCardHTML(c, idx) {
        var initial = E((c.name || '?').trim().charAt(0).toUpperCase() || '?');
        var t = c.tier;
        return '<div class="cx-row' + (c.blocked ? ' is-blocked' : '') + '" role="button" tabindex="0" data-uid="' + E(c.uid) + '" ' +
                'style="--tier-grad:' + t.grad + '; --tier-1:' + t.c1 + '; --tier-tx:' + t.ink + ';">' +
            '<span class="cx-av">' + initial + '</span>' +
            '<span class="cx-mid">' +
                '<span class="cx-name"><span class="t">' + E(c.name) + '</span>' +
                    (c.isVip ? '<span class="cx-vip" title="VIP">\uD83D\uDC51</span>' : '') +
                    (c.blocked ? '<span class="cx-blk">Bloklangan</span>' : '') +
                '</span>' +
                '<span class="cx-phone">' + E(c.phone || 'Telefon yo\'q') + '</span>' +
            '</span>' +
            '<span class="cx-chev" aria-hidden="true">\u203A</span>' +
        '</div>';
    }

    /* ---------------- 5.3 Ro'yxatni chizish ---------------- */

    function renderList() {
        var box = $('cst-list');
        if (!box) return;
        if (!CS.view.length) {
            var msg = CS.q
                ? '"' + E(CS.q) + '" bo\'yicha mijoz topilmadi. Boshqa ism yoki telefon raqami bilan urinib ko\'ring.'
                : 'Bu segmentda mijoz yo\'q. Boshqa segmentni tanlab ko\'ring.';
            box.innerHTML = '<div class="cst-empty"><span class="ic">\uD83D\uDD0D</span><b>Natija yo\'q</b><p>' + msg + '</p></div>';
            return;
        }
        var visible = CS.view.slice(0, CS.limit);
        var html = '<p class="cx-count">' + CS.view.length + ' ta mijoz</p><div class="cx-group">' +
            visible.map(function (c, i) { return customerCardHTML(c, i); }).join('') + '</div>';
        if (CS.limit < CS.view.length) {
            html += '<div class="cst-more"><span><i></i>Yana ' +
                (CS.view.length - CS.limit) + ' ta mijoz &middot; pastga suring</span></div>';
        }
        box.innerHTML = html;
        // Animatsiya faqat segment/saralash/ochilishda — qidiruvda har harf bosilganda
        // kartalar qayta "sakrasa" ko'z charchaydi.
        if (CS.animate) { stagger(box.querySelectorAll('.cx-row'), 30, 12); CS.animate = false; }
        else {
            Array.prototype.forEach.call(box.querySelectorAll('.cx-row'), function (n) {
                n.style.animation = 'none';
            });
        }
    }

    function renderShell() {
        var box = $('admin-customers-list');
        if (!box) return;
        box.innerHTML = '<div class="cst-wrap">' + toolsHTML() + segsHTML() + incompleteHTML() +
            '<div id="cst-list"></div></div>';

        // 🧹 Ismi yoki raqami yo'q foydalanuvchilarni o'chirish (alohida parol, server tekshiradi)
        var incBtn = $('cst-inc-del');
        if (incBtn) incBtn.onclick = function () {
            if (!window.A1Reset) { toast('Ilovani yangilang', 'warning'); return; }
            hap('light');
            window.A1Reset.open('incomplete', { count: removable(), onDone: loadCustomers });
        };

        // KPI raqamlarini sanab chiqaramiz
        var d = $('cst-kpi-data');
        if (d) {
            countUp($('cst-k-total'),  d.getAttribute('data-total'),  function (v) { return String(v); });
            countUp($('cst-k-vip'),    d.getAttribute('data-vip'),    function (v) { return String(v); });
            countUp($('cst-k-active'), d.getAttribute('data-active'), function (v) { return String(v); });
            countUp($('cst-k-rev'),    d.getAttribute('data-rev'),    fmtShort, 1100);
        }

        // Qidiruv
        var q = $('cst-q'), wrap = $('cst-search-wrap'), qx = $('cst-q-x');
        if (q) {
            q.oninput = function () {
                CS.q = q.value || '';
                if (wrap) wrap.classList.toggle('has-text', CS.q.length > 0);
                applyFilters();
                renderList();
            };
        }
        if (qx) qx.onclick = function () {
            CS.q = '';
            if (q) { q.value = ''; q.focus(); }
            if (wrap) wrap.classList.remove('has-text');
            applyFilters(); renderList(); hap('light');
        };

        // Segmentlar
        var segs = $('cst-segs');
        if (segs) segs.onclick = function (e) {
            var b = e.target.closest ? e.target.closest('.cst-seg') : null;
            if (!b) return;
            CS.seg = b.getAttribute('data-seg');
            CS.animate = true;
            hap('selection');
            segs.querySelectorAll('.cst-seg').forEach(function (x) {
                x.classList.toggle('on', x.getAttribute('data-seg') === CS.seg);
            });
            applyFilters(); renderList();
            var m = $('adminCustomersModal'); if (m) m.scrollTop = Math.min(m.scrollTop, 220);
        };

        // Saralash — aylanma (har bosishda keyingi tartib)
        var sb = $('cst-sort-btn');
        if (sb) sb.onclick = function () {
            var ids = SORTS.map(function (s) { return s.id; });
            var i = ids.indexOf(CS.sort);
            var next = SORTS[(i + 1) % SORTS.length];
            CS.sort = next.id;
            CS.animate = true;
            hap('selection');
            sb.setAttribute('title', next.label);
            sb.setAttribute('aria-label', next.label);
            toast(next.label, 'info');
            applyFilters(); renderList();
        };

        // Karta amallari
        var list = $('cst-list');
        if (list) list.onclick = function (e) {
            var card = e.target.closest ? e.target.closest('.cx-row') : null;
            if (!card) return;
            var uid = card.getAttribute('data-uid');
            var c = CS.all.filter(function (x) { return x.uid === uid; })[0];
            if (!c) return;
            var actBtn = e.target.closest('[data-act]');
            if (!actBtn) { hap('light'); openCustomerDetail(c); return; }
            var act = actBtn.getAttribute('data-act');
            e.stopPropagation();
            if (act === 'orders') { hap('light'); goCustomerOrders(c); }
            else if (act === 'tg') { hap('light'); openTelegram(c); }
            else if (act === 'call') { hap('light'); callCustomer(c); }
            else if (act === 'vip') { toggleManualVip(c, actBtn); }
        };

        CS.animate = true;
        renderList();
    }

    /* ---------------- 5.4 Amallar ---------------- */

    function openTelegram(c) {
        // Bot username'ni "@ali" yoki (yo'q bo'lsa) "Yo'q" deb yozadi — faqat haqiqiy username
        var un = String(c.username || '').replace(/^@+/, '');
        if (!/^[A-Za-z0-9_]{4,32}$/.test(un)) un = '';
        var numeric = /^[1-9]\d{2,19}$/.test(String(c.uid || ''));
        if (!un && !numeric) {
            // Ilova/saytdagi (Telegram'siz) mijoz — Telegram yo'q: qo'ng'iroq qilamiz
            if (c.phone) { toast('Bu mijoz Telegram\u2019ga ulanmagan \u2014 qo\u2018ng\u2018iroq qilinmoqda', 'info'); callCustomer(c); }
            else toast('Bu mijoz Telegram\u2019ga ulanmagan va raqami yo\u2018q', 'warning');
            return;
        }
        var url = un ? ('https://t.me/' + un) : ('tg://user?id=' + c.uid);
        try {
            if (un && window.tg && tg.openTelegramLink && tg.initData) { tg.openTelegramLink(url); return; }
            if (un && window.tg && tg.openLink && tg.initData) { tg.openLink(url); return; }
        } catch (e) {}
        try { if (typeof window.a1OpenExternal === 'function' && window.A1_APP) { window.a1OpenExternal(url); return; } } catch (e) {}
        try { window.open(url, '_blank'); } catch (e) { toast('Ochib bo\'lmadi', 'warning'); }
    }

    function callCustomer(c) {
        if (!c.phone) { toast('Telefon raqami yo\'q', 'warning'); return; }
        var tel = 'tel:' + String(c.phone).replace(/[^0-9+]/g, '');
        try { window.location.href = tel; } catch (e) { toast(c.phone, 'info'); }
    }

    function goCustomerOrders(c) {
        if (typeof window.openCustomerSpecificOrders === 'function') {
            window.openCustomerSpecificOrders(c.uid, c.name);
        } else {
            toast('Buyurtmalar oynasi topilmadi', 'warning');
        }
    }

    /** Adminning qo'lda VIP belgilashi — darajalar aylanma tartibda o'zgaradi. */
    function toggleManualVip(c, btn) {
        if (!amAdmin()) { toast('Faqat admin', 'warning'); return; }
        // aylanma: yo'q -> VIP -> yo'q (endi ikki daraja bor)
        var next = !c.manual ? 'vip' : null;
        VIP.setManual(c.uid, next).then(function () {
            c.manual = next;
            // Darajani qayta hisoblaymiz (haqiqiy buyurtmalar + qo'lda berilgan)
            var recomputed = VIP.compute(c.ordersRaw, next);
            c.tier = recomputed.tier; c.tierIdx = recomputed.tierIdx; c.isVip = recomputed.isVip;
            hap('success');
            toast(next
                ? ('\uD83D\uDC51 ' + c.name + ' \u2192 ' + c.tier.name + ' (qo\'lda)')
                : (c.name + ' \u2014 qo\'lda daraja olib tashlandi'), 'success');
            if (btn) btn.classList.toggle('on', !!next);
            try { if (window._invalidateUsersCache) window._invalidateUsersCache(); } catch (e) {}
            applyFilters(); renderList();
        }).catch(function (err) {
            toast('Saqlanmadi: ' + ((err && err.message) || 'ruxsat yo\'q'), 'warning');
        });
    }

    /* ---------------- 5.5 Mijoz tafsiloti ---------------- */

    function statusLabel(s) {
        if (s === 'yetkazildi') return 'Yetkazildi';
        if (s === 'yolda') return "Yo'lda";
        if (s === 'qabul') return 'Qabul qilindi';
        if (s === 'bekor_qilingan') return 'Bekor qilingan';
        return 'Kutilmoqda';
    }

    function openCustomerDetail(c) {
        var t = c.tier;
        var ttl = $('cdt-title'), sub = $('cdt-sub');
        if (ttl) ttl.textContent = c.name;
        if (sub) sub.textContent = t.icon + ' ' + t.name + (c.isVip ? ' · VIP mijoz' : ' daraja');

        var recent = c.ordersRaw.slice().sort(function (a, b) { return orderTime(b) - orderTime(a); }).slice(0, 6);
        var v = VIP.compute(c.ordersRaw, c.manual);

        var nextTx = v.next
            ? (v.next.icon + ' ' + v.next.name + ' bo\u2018lishga ' + fmtSom(v.needSom) + " so'm qoldi")
            : 'VIP mijoz';

        var body = $('customer-detail-body');
        if (!body) return;
        var SV = {
            call: '<path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.5 0 1 .4 1 1V20c0 .6-.5 1-1 1-9.4 0-17-7.6-17-17 0-.6.5-1 1-1h3.5c.6 0 1 .4 1 1 0 1.2.2 2.4.6 3.6.1.3 0 .7-.2 1z"/>',
            tg: '<path d="M9.8 15.6l-.2 3.6c.4 0 .6-.2.8-.4l2-1.9 4.1 3c.8.4 1.3.2 1.5-.7l2.7-12.6c.2-1.1-.4-1.5-1.1-1.2L3.4 10.1c-1.1.4-1 1-.2 1.3l4.2 1.3 9.7-6.1c.5-.3.9-.1.5.2z"/>',
            msg: '<path d="M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2zM7 9h10v2H7zm6 5H7v-2h6zm4-6H7V6h10z"/>',
            box: '<path d="M20 2H4c-1 0-2 .9-2 2v3c0 .7.4 1.3 1 1.7V20c0 1.1 1.1 2 2 2h14c.9 0 2-.9 2-2V8.7c.6-.4 1-1 1-1.7V4c0-1.1-1-2-2-2zm-5 12H9v-2h6v2zm5-7H4V4h16v3z"/>',
            crown: '<path d="M5 16 3 5l5.5 5L12 4l3.5 6L21 5l-2 11zm14 3c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1v-1h14z"/>',
            block: '<path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM4 12a8 8 0 0 1 12.9-6.3L5.7 16.9A7.9 7.9 0 0 1 4 12zm8 8a7.9 7.9 0 0 1-4.9-1.7L18.3 7.1A8 8 0 0 1 12 20z"/>'
        };
        var svg = function (k) { return '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' + SV[k] + '</svg>'; };
        var qb = function (id, label, k, color) {
            return '<button type="button" class="cx-q" id="' + id + '" style="--qc:' + color + '"><span class="cx-q-ic">' + svg(k) + '</span><span class="cx-q-l">' + label + '</span></button>';
        };
        var kv = function (k, v, cls) {
            return '<div class="cx-kv"><span class="k">' + k + '</span><span class="v' + (cls ? ' ' + cls : '') + '">' + v + '</span></div>';
        };
        var telV = c.phone
            ? '<a class="cx-link" href="tel:' + E(String(c.phone).replace(/[^0-9+]/g, '')) + '">' + E(c.phone) + '</a>'
            : '\u2014';
        body.innerHTML =
            // --- HERO ---
            '<div class="cx-hero" id="cdt-hero">' +
                '<div class="cx-hav" id="cdt-av">' + E((c.name || '?').charAt(0).toUpperCase()) + '</div>' +
                '<h3 class="cx-hname">' + E(c.name) + '</h3>' +
                '<div class="cx-hphone">' + E(c.phone || 'Telefon yo\'q') + '</div>' +
                '<div class="cx-badges">' +
                    '<span class="cx-badge is-tier" id="cdt-tier-badge">' + t.icon + ' ' + E(t.name) + '</span>' +
                    (c.manual ? '<span class="cx-badge">Qo\'lda</span>' : '') +
                    (c.blocked ? '<span class="cx-badge is-blk">Bloklangan</span>' : '') +
                '</div>' +
            '</div>' +
            // --- TEZKOR AMALLAR ---
            '<div class="cx-quick">' +
                (c.phone ? qb('cdt-a-call', 'Qo\'ng\'iroq', 'call', '#30d158') : '') +
                qb('cdt-a-tg', 'Telegram', 'tg', '#0a84ff') +
                qb('cdt-a-msg', 'Xabar', 'msg', '#c9a84c') +
                qb('cdt-a-orders', 'Buyurtmalar', 'box', '#ff9f0a') +
            '</div>' +
            '<div id="cdt-msg-box" data-open="0"></div>' +
            // --- STATISTIKA ---
            '<p class="cx-sec">Statistika</p><div class="cx-grp">' +
                kv('Buyurtmalar', c.orders + ' ta' + (c.pending ? ' <em>\u00B7 ' + c.pending + ' faol</em>' : '')) +
                kv('Sarflagan', fmtSom(c.spent) + " so'm", 'gold') +
                kv('O\'rtacha chek', c.avg ? fmtSom(c.avg) + " so'm" : '\u2014') +
                kv('Cashback', fmtSom(c.cashback) + " so'm") +
                kv('Oxirgi xarid', E(c.last ? agoLabel(c.last) : '\u2014')) +
            '</div>' +
            // --- MA'LUMOT ---
            '<p class="cx-sec">Ma\'lumot</p><div class="cx-grp">' +
                kv('Telefon', telV) +
                kv('Telegram', c.username ? '@' + E(c.username) : '\u2014') +
                kv('ID', E(c.uid), 'mono') +
                kv('Manzil', E(c.address || '\u2014')) +
                (c.car ? kv('Mashinasi', E(c.car)) : '') +
                kv('Birinchi xarid', c.first ? E(new Date(c.first).toLocaleDateString('uz-UZ')) : '\u2014') +
            '</div>' +
            // --- DARAJA ---
            '<p class="cx-sec">Daraja</p><div class="cx-grp">' +
                kv('Hozirgi', t.icon + ' ' + E(t.name)) +
                kv('Keyingi', E(nextTx)) +
                kv('Imtiyoz', 'Bepul yetkazish ' + fmtShort(t.freeDelivery) + " so'mdan \u00B7 cashback " + VIP.ratePct(t) + '%') +
                kv('Savat / Saqlangan', c.cartCount + ' ta / ' + c.wishCount + ' ta') +
            '</div>' +
            // --- OXIRGI BUYURTMALAR ---
            '<p class="cx-sec">Oxirgi buyurtmalar</p><div class="cx-grp">' +
                (recent.length ? recent.map(function (o) {
                    return '<div class="cx-ord"><span class="cx-ord-c"><b>#' + E(o.code || o.id || '') + '</b>' +
                        '<span>' + E(o.date || agoLabel(orderTime(o))) + ' \u00B7 ' + E(statusLabel(o.status)) + '</span></span>' +
                        '<span class="cx-ord-s">' + fmtShort(o.total) + '</span></div>';
                }).join('') : '<div class="cx-kv"><span class="k">Hali buyurtma yo\'q</span></div>') +
            '</div>' +
            // --- BOSHQARUV ---
            '<p class="cx-sec">Boshqaruv</p><div class="cx-grp">' +
                '<button type="button" class="cx-act" id="cdt-a-vip"><span class="cx-ic" style="--ic:#c9a84c">' + svg('crown') + '</span><span class="cx-act-t">' +
                    (c.manual ? 'Qo\'lda VIPni olib tashlash' : 'Qo\'lda VIP qilish') + '</span><span class="cx-chev">\u203A</span></button>' +
                '<button type="button" class="cx-act is-danger" id="cdt-a-block"><span class="cx-ic" style="--ic:' + (c.blocked ? '#30d158' : '#ff453a') + '">' + svg('block') + '</span><span class="cx-act-t">' +
                    (c.blocked ? 'Blokdan chiqarish' : 'Bloklash') + '</span></button>' +
            '</div>' +
            '<p class="cx-foot">' + (c.blocked
                ? 'Bu mijoz bloklangan: botga yoza olmaydi, ilovani ocha olmaydi va buyurtma bera olmaydi.'
                : 'Bloklangan mijoz botdan va ilovadan foydalana olmaydi. Istalgan payt blokdan chiqarish mumkin.') + '</p>';

        paintTier($('cdt-hero'), t);
        paintTier($('cdt-av'), t);
        paintTier($('cdt-tier-badge'), t);

        var b;
        if ((b = $('cdt-a-orders'))) b.onclick = function () { hap('light'); goCustomerOrders(c); };
        if ((b = $('cdt-a-tg')))     b.onclick = function () { hap('light'); openTelegram(c); };
        if ((b = $('cdt-a-call')))   b.onclick = function () { hap('light'); callCustomer(c); };
        if ((b = $('cdt-a-msg')))    b.onclick = function () { sendDirectMessage(c); };
        if ((b = $('cdt-a-vip')))    b.onclick = function () {
            toggleManualVip(c, null);
            setTimeout(function () { openCustomerDetail(c); }, 350);
        };
        if ((b = $('cdt-a-block')))  b.onclick = function () { hap('light'); toggleBlock(c); };

        // ⚠️ Oyna ALLAQACHON ochiq bo'lsa (masalan VIP darajasi o'zgargandan keyin
        //    qayta chizilayotganda) yana pushState QILMAYMIZ — aks holda "orqaga"
        //    tugmasini ikki marta bosish kerak bo'lib qolardi.
        if (curModal() !== 'customerDetailModal') {
            openSheet('customerDetailModal', 'adminCustomersModal');
        } else {
            var m = $('customerDetailModal');
            if (m) m.scrollTop = 0;
        }
    }

    /** ⛔ Mijozni bloklash / blokdan chiqarish.
     *  Manba: `blocked_users/{uid}` (faqat admin yozadi). Ilova, Worker va bot
     *  shu tugunni o'qib, bloklangan foydalanuvchini to'xtatadi. */
    function isAdminUid(uid) {
        try {
            if (typeof ADMIN_IDS !== 'undefined' && ADMIN_IDS && ADMIN_IDS.map(String).indexOf(String(uid)) !== -1) return true;
        } catch (e) {}
        return false;
    }
    function toggleBlock(c) {
        if (!amAdmin()) { toast('Faqat admin', 'warning'); return; }
        if (!c.blocked && isAdminUid(c.uid)) { toast('Adminni bloklab bo\'lmaydi', 'warning'); return; }
        var q = c.blocked
            ? (c.name + ' blokdan chiqarilsinmi?')
            : (c.name + ' bloklansinmi? U botdan va ilovadan foydalana olmaydi.');
        var run = function () {
            var d = DB();
            if (!d) { toast('Baza ulanmagan', 'warning'); return; }
            var ref = d.ref('blocked_users/' + c.uid);
            var go = function () {
                var by = '';
                try { by = (window.firebase && firebase.auth().currentUser) ? firebase.auth().currentUser.uid : ''; } catch (e) {}
                var p = c.blocked ? ref.remove() : ref.set({
                    name: String(c.name || '').slice(0, 80),
                    phone: String(c.phone || '').slice(0, 30),
                    at: Date.now(),
                    by: String(by || '')
                });
                p.then(function () {
                    c.blocked = !c.blocked;
                    var m = window._blockedMap || (window._blockedMap = {});
                    if (c.blocked) m[c.uid] = true; else delete m[c.uid];
                    hap('success');
                    toast(c.blocked ? ('\u26D4 ' + c.name + ' bloklandi') : (c.name + ' blokdan chiqarildi'), 'success');
                    applyFilters(); renderList();
                    openCustomerDetail(c);
                }).catch(function (err) {
                    toast('Saqlanmadi: ' + ((err && (err.code || err.message)) || 'ruxsat yo\'q'), 'warning');
                });
            };
            if (window._ensureAuth) window._ensureAuth().then(go, go); else go();
        };
        try {
            if (window.tg && tg.showConfirm) { tg.showConfirm(q, function (ok) { if (ok) run(); }); return; }
        } catch (e) {}
        if (window.confirm(q)) run();
    }

    /**
     * Bot orqali shu mijozga to'g'ridan-to'g'ri xabar yuborish.
     *
     * ⚠️ `prompt()` ISHLATILMAYDI: Telegram WebView'da u ko'pincha bloklanadi
     * va hech narsa bo'lmaydi (admin xabar yuborilmaganini ham bilmaydi).
     * Shuning uchun tafsilot oynasi ichida haqiqiy matn maydoni ochiladi.
     */
    function sendDirectMessage(c) {
        var host = $('cdt-msg-box');
        if (!host) return;
        if (host.getAttribute('data-open') === '1') {   // ochiq edi -> yopamiz
            host.setAttribute('data-open', '0');
            host.innerHTML = '';
            return;
        }
        host.setAttribute('data-open', '1');
        host.innerHTML =
            '<div style="margin-top:10px; background:var(--card-bg); border:1px solid var(--glass-border); ' +
                'border-radius:17px; padding:15px; animation:lyRise .3s both;">' +
                '<label class="st2-field"><span>Xabar matni — ' + E(c.name) + '</span>' +
                '<textarea class="st2-input" id="cdt-msg-tx" rows="3" maxlength="900" ' +
                    'placeholder="Assalomu alaykum! Buyurtmangiz tayyor..."></textarea></label>' +
                '<button type="button" class="cdt-act gold" id="cdt-msg-send" style="width:100%;">' +
                    '\u2708 Yuborish</button>' +
            '</div>';
        var ta = $('cdt-msg-tx'), btn = $('cdt-msg-send');
        if (ta) ta.focus();
        if (!btn) return;
        btn.onclick = function () {
            var text = ta ? (ta.value || '').trim() : '';
            if (text.length < 2) { toast('Xabar matnini yozing', 'warning'); return; }
            if (!window.tgProxySend) { toast('Xabar yuborish moduli topilmadi', 'warning'); return; }
            btn.disabled = true;
            btn.textContent = 'Yuborilmoqda...';
            window.tgProxySend({
                chat_id: c.uid,
                parse_mode: 'HTML',
                text: '\uD83D\uDCAC <b>Avto A1</b>\n\n' + E(text)
            }).then(function (r) {
                // Worker javobi 200 bo'lmasa ham fetch reject qilmaydi — holatni tekshiramiz
                if (r && r.ok === false) throw new Error('rad etildi');
                hap('success');
                toast('Xabar yuborildi', 'success');
                host.setAttribute('data-open', '0');
                host.innerHTML = '';
            }).catch(function () {
                toast('Yuborilmadi — mijoz botni bloklagan bo\'lishi mumkin', 'warning');
                btn.disabled = false;
                btn.textContent = '\u2708 Yuborish';
            });
        };
    }

    /* ---------------- 5.6 Ochish + eski funksiyalarni ustidan yozish ---------------- */

    function openCustomers() {
        if (!amAdmin()) { toast('Bu bo\'lim faqat admin uchun', 'warning'); return; }
        var box = $('admin-customers-list');
        if (box) box.innerHTML = (window._skel ? window._skel(6, 96) : '<p style="text-align:center;">Yuklanmoqda...</p>');
        // Eski (mayda) qidiruv qatorini yashiramiz — yangi panel o'z inputini yasaydi
        var oldInput = $('customer-search-input');
        if (oldInput && oldInput.parentNode) oldInput.parentNode.style.display = 'none';

        openSheet('adminCustomersModal', 'adminModal');
        loadCustomers();
    }

    /** Mijozlarni bazadan (qayta) o'qib chizadi — oynani qayta ochmasdan (history'ga yozmaydi). */
    function loadCustomers() {
        var box = $('admin-customers-list');
        var snapP = window._getUsersSnap
            ? window._getUsersSnap()
            : DB().ref('users').once('value');

        var dd = DB();
        var blkP = dd
            ? dd.ref('blocked_users').once('value').then(function (x) { return x.val() || {}; }, function () { return {}; })
            : Promise.resolve({});

        Promise.all([snapP, blkP]).then(function (r) {
            var snap = r[0];
            window._blockedMap = r[1] || {};
            CS.all = buildCustomers(snap);
            CS.loaded = true;
            applyFilters();
            renderShell();
        }).catch(function (err) {
            if (box) {
                box.innerHTML = '<div class="cst-empty"><span class="ic">\u26A0\uFE0F</span><b>O\'qib bo\'lmadi</b><p>' +
                    E((err && err.message) || 'Bazaga ulanish xatosi') + '</p></div>';
            }
        });
    }

    // Eski nomlarni saqlab qolamiz (admin paneldagi onclick o'zgarmaydi)
    window.openAdminCustomers = openCustomers;
    window.renderCustomersList = function () { applyFilters(); renderList(); };
    window.searchCustomers = function () {
        var el = $('customer-search-input') || $('cst-q');
        CS.q = el ? (el.value || '') : '';
        applyFilters(); renderList();
    };

    // Pastga skroll qilinganda yana yuklash (eski listener `lastCustomersRef` ni
    // tekshirgani uchun ishlamaydi — shuning uchun o'zimiz qo'shamiz)
    (function infinite() {
        var m = $('adminCustomersModal');
        if (!m) return;
        m.addEventListener('scroll', function () {
            if (curModal() !== 'adminCustomersModal') return;
            if (m.scrollTop + m.clientHeight < m.scrollHeight - 90) return;
            if (CS.limit >= CS.view.length) return;
            CS.limit += 20;
            renderList();
        }, { passive: true });
    })();

    /* ------------------------------------------------------------------ *
     * 6. ADMIN BUYURTMALARIDA VIP BELGISI
     * Admin buyurtmalar ro'yxatida VIP mijozni darhol ajratib ko'rsatish —
     * `renderAdminOrdersUI` chizgandan keyin nozik belgi qo'shamiz.
     * ------------------------------------------------------------------ */
    (function vipTagOnOrders() {
        function wrap() {
            if (typeof window.renderAdminOrdersUI !== 'function' || window._vipOrdersWrapped) return;
            window._vipOrdersWrapped = true;
            var orig = window.renderAdminOrdersUI;
            window.renderAdminOrdersUI = function () {
                var r = orig.apply(this, arguments);
                try { setTimeout(markVips, 40); } catch (e) {}
                return r;
            };
        }
        /** Buyurtma kartasidagi `.cst-vip-slot` bo'sh joyini daraja belgisi bilan to'ldiradi. */
        function markVips(retry) {
            var slots = document.querySelectorAll('.cst-vip-slot[data-order-uid]');
            if (!slots.length) return;
            // Mijozlar bazasi hali o'qilmagan bo'lsa — fonda bir marta o'qib, keyin belgilaymiz.
            // ⚠️ `retry` bayrog'i SHART: aks holda baza xato bersa markVips <-> primeCustomers
            //    bir-birini cheksiz chaqirib, brauzerni qotirib qo'yardi.
            if (!CS.loaded) {
                if (retry) return;
                primeCustomers().then(function () { markVips(true); });
                return;
            }
            var vipMap = {};
            CS.all.forEach(function (c) { if (c.isVip) vipMap[c.uid] = c.tier; });
            Array.prototype.forEach.call(slots, function (n) {
                if (n.getAttribute('data-filled') === '1') return;
                var t = vipMap[n.getAttribute('data-order-uid')];
                if (!t) return;
                n.setAttribute('data-filled', '1');
                n.className = 'cst-vip-slot cst-tier';
                n.style.cssText = '--tier-grad:' + t.grad + '; --tier-tx:' + t.ink + ';';
                n.textContent = t.icon + ' ' + t.name;
            });
        }

        /** Mijozlar bazasini bir marta fonda o'qiydi (VIP belgilari uchun). */
        var priming = null;
        function primeCustomers() {
            if (CS.loaded) return Promise.resolve();
            if (priming) return priming;
            var p = window._getUsersSnap ? window._getUsersSnap()
                  : (DB() ? DB().ref('users').once('value') : Promise.reject(new Error('no db')));
            priming = p.then(function (snap) {
                CS.all = buildCustomers(snap);
                CS.loaded = true;
                applyFilters();
            }).catch(function () {}).then(function () { priming = null; });
            return priming;
        }

        wrap();
        setTimeout(wrap, 1500);
    })();

    if (window._dlog) window._dlog('%c[Qatlam 2026.06] Stories + Mijozlar + VIP yuklandi', 'color:#C9A84C;font-weight:bold;');
})();
