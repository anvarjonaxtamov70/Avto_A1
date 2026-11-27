
/* ============================================================================
   BANNERLAR — bosh sahifa slayderini admin o'zi boshqaradi.

   TUZILISHI:
     0) yordamchilar (mavjud ilova bilan bir xil usul)
     1) SIFAT: rasm o'lchamini o'qish va xulosa berish
     2) BOSH SAHIFA: sliderni bazadan chizish (+ standart zaxira)
     3) ADMIN: bannerlar ro'yxati (tartib / yashirish / o'chirish)
     4) COMPOSER: rasm yuklash + jonli ko'rinish + saqlash

   💎 SIFAT SIYOSATI (xo'jayin talabi — «faqat yuqori sifatda»):
     • Rasm ImgBB'ga ASL holida yuklanadi: siqilmaydi, o'lchami kichraytirilmaydi.
     • Yuklashdan OLDIN o'lcham o'qiladi — past bo'lsa admin ogohlantiriladi va
       bekor qilishi mumkin (behuda yuklash va keyin afsuslanish yo'q).
     • Ko'rsatishda weserv orqali AYNAN kerakli piksel o'lchamiga (slayder
       kengligi × DPR, 1600 px gacha) keltiriladi, sifat 92. Vizual jihatdan
       asl nusxadan farqi yo'q, lekin bayt 10-20x kam — slayder bo'sh turmaydi.
       `&we` — KICHIK rasmni KATTALASHTIRMAYDI, ya'ni bulanish kelib chiqmaydi.
     • SVG'ga TEGILMAYDI — vektor har qanday ekranda mukammal.
   ============================================================================ */
(function bannerAdmin2026() {
    'use strict';
    if (window.AvtoBanners) return;

    /* ------------------------------------------------------------------ *
     * 0. YORDAMCHILAR
     * ------------------------------------------------------------------ */
    var $ = function (id) { return document.getElementById(id); };
    var E = function (s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
        });
    };
    var hap = function (k) { try { if (window._hap) window._hap(k); } catch (e) {} };
    var toast = function (m, t) { try { if (window.showToast) window.showToast(m, t); } catch (e) {} };
    var amAdmin = function () { try { return !!(window.isAdmin && window.isAdmin()); } catch (e) { return false; } };
    function msgOf(e) { return (e && e.message) ? e.message : 'ruxsat yo\'q yoki tarmoq xatosi'; }
    function num(v, d) { var n = parseInt(v, 10); return isFinite(n) ? n : d; }

    /* ⚠️ Asosiy skriptdagi `const db`, `let activeModal` kabi e'lonlar `window`
       obyektiga TUSHMAYDI (top-level let/const global leksik muhitda yashaydi).
       Shuning uchun avval leksik bog'lanish sinaladi, keyin zaxira yo'l. */
    function DB() {
        try { if (typeof db !== 'undefined' && db) return db; } catch (e) {}
        try {
            if (window.firebase && window.firebase.apps && window.firebase.apps.length) {
                return window.firebase.database();
            }
        } catch (e) {}
        return null;
    }
    function curModal() {
        try { if (typeof activeModal !== 'undefined') return activeModal; } catch (e) {}
        return window.activeModal || null;
    }
    function reduceMotion() {
        try {
            return (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
                || document.documentElement.classList.contains('lite');
        } catch (e) { return false; }
    }
    function stagger(nodes, step, max) {
        if (reduceMotion()) return;
        step = step || 45; max = max || 12;
        Array.prototype.forEach.call(nodes, function (n, i) {
            n.style.animationDelay = (Math.min(i, max) * step) + 'ms';
        });
    }
    function confirmBox(q, onYes) {
        try {
            if (window.tg && window.tg.showConfirm) {
                window.tg.showConfirm(q, function (ok) { if (ok) onYes(); });
                return;
            }
        } catch (e) {}
        if (window.confirm(q)) onYes();
    }
    /* Admin oynasini ochishning yagona usuli — mavjud ilova qoidasiga mos:
       ota oyna yashiriladi, yangisi flex bo'ladi, history'ga pushState.
       Qaytish `popstate` handlerida ro'yxatga qo'shilgan. */
    function openSheet(id, fromId) {
        if (fromId && $(fromId)) $(fromId).style.display = 'none';
        var m = $(id);
        if (!m) return false;
        m.style.display = 'flex';
        m.scrollTop = 0;
        var inner = m.querySelector('#banner-admin-body, #banner-composer-body');
        if (inner) inner.scrollTop = 0;
        document.body.style.overflow = 'hidden';
        window.activeModal = id;
        try { activeModal = id; } catch (e) {}
        window.history.pushState({ modal: id }, '');
        try { if (window.tg && window.tg.BackButton) window.tg.BackButton.show(); } catch (e) {}
        try { if (window.updateBtns) window.updateBtns(); } catch (e) {}
        return true;
    }

    /* ---- Ikonkalar (SVG — emoji emas: ikkala mavzuda ham bir xil ko'rinadi) ---- */
    var IC_GALLERY = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.6"/><path d="M21 15l-5-5L5 21"/></svg>';
    var IC_LINK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.07 0l2-2A5 5 0 0 0 12 4l-1 1"/><path d="M14 11a5 5 0 0 0-7.07 0l-2 2A5 5 0 0 0 12 20l1-1"/></svg>';
    var IC_WAIT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 3a9 9 0 1 0 9 9" opacity=".9"/></svg>';
    var IC_OK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
    var IC_INFO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><line x1="12" y1="11" x2="12" y2="16"/><line x1="12" y1="7.6" x2="12" y2="7.7"/></svg>';
    var IC_UP = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>';
    var IC_DOWN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>';
    var IC_EYE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1.7 12S5.3 5.5 12 5.5 22.3 12 22.3 12 18.7 18.5 12 18.5 1.7 12 1.7 12z"/><circle cx="12" cy="12" r="3.1"/></svg>';
    var IC_EYE_OFF = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.9 5.7A9.6 9.6 0 0 1 12 5.5c6.7 0 10.3 6.5 10.3 6.5a18 18 0 0 1-2.7 3.6M6.4 7.3A18 18 0 0 0 1.7 12S5.3 18.5 12 18.5c1.7 0 3.2-.4 4.5-1"/><line x1="3" y1="3" x2="21" y2="21"/></svg>';
    var IC_PENCIL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>';
    var IC_TRASH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>';

    /* ---- Sozlamalar ---- */
    var NODE = 'banners';
    var MAX_BANNERS = 12;                 // slayder undan ortig'ini "hazm qilmaydi"
    var MAX_FILE = 25 * 1024 * 1024;      // ImgBB chegarasidan pastda
    var IDEAL_W = 1600, IDEAL_H = 990;    // 1.618:1 — `.slider img` aspect-ratio
    var MIN_GOOD_W = 700;                 // bundan pastda slayderda bulanadi

    /* ---- Holat ---- */
    var S = { rows: [], loaded: false, ref: null, seeding: false, tries: 0 };
    var C = { key: null, img: '', alt: '', partner: false, active: true, busy: false, w: 0, h: 0 };
    var DEFAULTS = [];
    var _sliderSig = null;

    var AvtoBanners = {};

    /* ------------------------------------------------------------------ *
     * 1. SIFAT
     * ------------------------------------------------------------------ */
    /** Rasm o'lchamini o'qiydi. Xato/kechikishda {w:0,h:0} — bloklamaydi. */
    function measure(url) {
        return new Promise(function (resolve) {
            if (!url) return resolve({ w: 0, h: 0 });
            var im = new Image(), done = false;
            var t = setTimeout(function () {
                if (!done) { done = true; resolve({ w: 0, h: 0 }); }
            }, 9000);
            im.onload = function () {
                if (done) return; done = true; clearTimeout(t);
                resolve({ w: im.naturalWidth || 0, h: im.naturalHeight || 0 });
            };
            im.onerror = function () {
                if (done) return; done = true; clearTimeout(t);
                resolve({ w: 0, h: 0 });
            };
            im.src = url;
        });
    }

    /** O'lchamdan xulosa: daraja, yorliq va tushuntirish. */
    function qualityOf(w, h) {
        w = num(w, 0); h = num(h, 0);
        if (!w || !h) return null;
        var lvl, lbl, note;
        if (w >= 1400) { lvl = 'hi'; lbl = 'Ajoyib sifat'; note = 'Retina ekranda ham tiniq chiqadi.'; }
        else if (w >= 1000) { lvl = 'ok'; lbl = 'Yaxshi sifat'; note = 'Deyarli hamma telefonda toza ko\'rinadi.'; }
        else if (w >= MIN_GOOD_W) { lvl = 'mid'; lbl = 'O\'rtacha sifat'; note = 'Retina ekranda biroz yumshoq chiqadi. ' + IDEAL_W + ' px kengroq nusxa afzal.'; }
        else { lvl = 'low'; lbl = 'Past sifat'; note = 'Slayderda bulanib ko\'rinadi \u2014 kattaroq nusxa toping.'; }
        // Nisbat: slayder 1.618:1 va `object-fit: cover` — farq bo'lsa chetlari kesiladi
        var r = w / h;
        if (r < 1.35 || r > 1.95) {
            note += ' Nisbati ' + (Math.round(r * 100) / 100) + ':1 \u2014 slayder 1.618:1 kesadi.';
        }
        return { lvl: lvl, lbl: lbl, size: w + '\u00D7' + h + ' px', note: note };
    }

    /* ------------------------------------------------------------------ *
     * 2. BOSH SAHIFA — sliderni bazadan chizish
     * ------------------------------------------------------------------ */
    /**
     * Ko'rsatish uchun havola. Sifat siyosati fayl boshidagi izohda.
     * Mahalliy SVG va nisbiy yo'llarga TEGMAYDI.
     */
    function displayUrl(url) {
        try {
            if (!url || typeof url !== 'string') return url;
            if (url.indexOf('http') !== 0) return url;                 // 'banners/banner1.svg'
            if (url.indexOf('images.weserv.nl') !== -1) return url;    // allaqachon proxy
            if (/\.svg(\?|#|$)/i.test(url)) return url;                // vektor — rasterlamaymiz
            var sl = $('main-slider');
            var cssW = (sl && sl.clientWidth) || Math.max(320, (window.innerWidth || 360) - 40);
            var dpr = Math.max(1, window.devicePixelRatio || 1);
            // Zaif telefonda DPR'ni cheklaymiz — bayt va dekod yuki pasayadi
            try { if (window.__perfLite) dpr = Math.min(dpr, 1.5); } catch (e) {}
            var w = Math.round(cssW * Math.min(3, dpr));
            if (w > 1600) w = 1600;
            if (w < 320) w = 320;
            var clean = url.replace(/^https?:\/\//, '');
            return 'https://images.weserv.nl/?url=' + encodeURIComponent(clean) +
                   '&w=' + w + '&q=92&output=webp&we';
        } catch (e) { return url; }
    }

    function sigOf(list) {
        return list.map(function (b) { return b.img + '|' + (b.partner ? 1 : 0); }).join('~');
    }

    /**
     * HTML'dagi standart bannerlarni bir marta xotiraga oladi — bu ZAXIRA
     * ro'yxat (baza bo'sh yoki o'qilmasa shu ko'rinadi) va bazaga birinchi
     * ko'chirish manbasi.
     */
    function captureDefaults() {
        if (DEFAULTS.length) return;
        var sl = $('main-slider');
        if (!sl) return;
        var imgs = sl.querySelectorAll('img');
        for (var i = 0; i < imgs.length; i++) {
            var src = imgs[i].getAttribute('src') || '';
            if (!src) continue;
            DEFAULTS.push({
                img: src,
                alt: imgs[i].getAttribute('alt') || '',
                partner: imgs[i].getAttribute('data-partner') === '1',
                active: true
            });
        }
        // DOM allaqachon shu ro'yxatni ko'rsatib turadi. Imzoni HOZIR belgilaymiz,
        // aks holda baza bo'sh bo'lsa slider bekordan-bekorga qayta chizilib
        // rasmlar "miltillab" ketardi (opacity 0 -> 1 qaytadan).
        _sliderSig = sigOf(DEFAULTS);
    }

    /** Bosh sahifada ko'rinadigan ro'yxat. */
    function visibleList() {
        // Bazada yozuv BOR — faqat yoqilganlari. Hech narsa yo'q -> standart.
        if (S.loaded && S.rows.length) {
            return S.rows.filter(function (b) { return b.active !== false; });
        }
        return DEFAULTS;
    }

    function renderSlider() {
        var sl = $('main-slider');
        if (!sl) return;
        var list = visibleList();
        var sig = sigOf(list);
        if (sig === _sliderSig) return;      // o'zgarish yo'q — rasmlarni qayta yuklamaymiz
        _sliderSig = sig;

        // Baza to'ldirilgan, lekin HAMMASI yashirilgan — slayderni butunlay
        // olib qo'yamiz. Bo'sh ramka "sahifa buzilgan" hissini beradi.
        var box = sl.parentNode;
        if (box && box.classList && box.classList.contains('slider-container')) {
            box.style.display = list.length ? '' : 'none';
        }
        if (!list.length) { sl.innerHTML = ''; return; }

        sl.innerHTML = list.map(function (b, i) {
            return '<img src="' + E(displayUrl(b.img)) + '"' +
                ' data-full="' + E(b.img) + '"' +
                ' data-partner="' + (b.partner ? '1' : '0') + '"' +
                ' alt="' + E(b.alt) + '" decoding="async"' +
                (i === 0 ? ' fetchpriority="high"' : ' loading="lazy"') +
                ' onload="this.style.opacity=1"' +
                ' onerror="window._imgFallback && window._imgFallback(this)">';
        }).join('');
        sl.scrollLeft = 0;
        // Nuqta indikatorini va «HAMKORLIK» belgisini yangi slaydlarga moslaymiz
        try { if (window.refreshHomeSliderDots) window.refreshHomeSliderDots(); } catch (e) {}
        try { if (window.updatePartnerBadge) window.updatePartnerBadge(); } catch (e) {}
    }

    /* «HAMKORLIK» belgisi endi MA'LUMOTGA bog'liq.
       ⚠️ Ilgari `idx === 3` deb qattiq yozilgan edi — bannerlar almashtirilsa
       yoki tartibi o'zgarsa, belgi mutlaqo boshqa (hamkorlikka aloqasi yo'q)
       slaydda chiqib qolardi. Endi har slayd o'zining `data-partner` belgisini
       olib yuradi. Inline `onscroll="updatePartnerBadge()"` o'zgarmaydi. */
    window.updatePartnerBadge = function () {
        var sl = $('main-slider'), badge = $('slider-partner-badge');
        if (!sl || !badge) return;
        var imgs = sl.querySelectorAll('img');
        var w = sl.clientWidth || 1;
        var idx = Math.round(sl.scrollLeft / w);
        var cur = imgs[idx];
        // Slayder har kadrda skroll hodisasi beradi — faqat qiymat o'zgarganda yozamiz
        var v = (cur && cur.getAttribute('data-partner') === '1') ? '1' : '0';
        if (badge.__op !== v) { badge.__op = v; badge.style.opacity = v; }
    };

    /* ---- Bazani o'qish ---- */
    function absorb(snap) {
        var rows = [];
        try {
            if (snap && snap.exists()) {
                var v = snap.val() || {};
                Object.keys(v).forEach(function (k) {
                    var it = v[k] || {};
                    if (!it.img) return;
                    rows.push({
                        key: k,
                        img: String(it.img),
                        alt: String(it.alt || ''),
                        order: num(it.order, 0),
                        partner: it.partner === true,
                        active: it.active !== false,
                        createdAt: num(it.createdAt, 0)
                    });
                });
            }
        } catch (e) {}
        rows.sort(function (a, b) { return (a.order - b.order) || (a.createdAt - b.createdAt); });
        S.rows = rows;
        S.loaded = true;
    }

    function load() {
        return new Promise(function (res, rej) {
            var d = DB();
            if (!d) return rej(new Error('Baza ulanmagan'));
            d.ref(NODE).once('value').then(function (snap) {
                absorb(snap); renderSlider(); res();
            }).catch(rej);
        });
    }

    function byKey(k) {
        for (var i = 0; i < S.rows.length; i++) if (S.rows[i].key === k) return S.rows[i];
        return null;
    }

    /** Jonli tinglovchi — admin bannerni o'zgartirsa mijozda qayta yuklamasdan yangilanadi. */
    function boot() {
        captureDefaults();
        var d = DB();
        if (!d) {
            // Firebase hali yuklanmagan bo'lishi mumkin — cheklangan urinish
            if (S.tries++ < 20) setTimeout(boot, 1500);
            return;
        }
        if (S.ref) return;
        try {
            S.ref = d.ref(NODE);
            S.ref.on('value', function (snap) {
                absorb(snap);
                renderSlider();
                if (curModal() === 'bannerAdminModal') renderAdmin();
            }, function () {
                // Ruxsat yo'q yoki oflayn — standart bannerlar ko'rinib turadi
                S.loaded = false;
            });
        } catch (e) {}
    }

    /* ------------------------------------------------------------------ *
     * 3. ADMIN — bannerlar ro'yxati
     * ------------------------------------------------------------------ */
    var MODALS_HTML =
        '<div class="modal-standard" id="bannerAdminModal">' +
            '<div class="bnr-hd">' +
                '<div><h2>Bannerlar</h2><span>Bosh sahifa slayderi</span></div>' +
                '<button class="close-btn" aria-label="Orqaga" style="font-size:24px;" onclick="closeModal()">&larr;</button>' +
            '</div>' +
            '<div id="banner-admin-body"></div>' +
        '</div>' +
        '<div class="modal-standard" id="bannerComposerModal">' +
            '<div class="bnr-hd">' +
                '<div><h2 id="bnr-cm-title">Yangi banner</h2><span id="bnr-cm-sub">Rasm tanlang</span></div>' +
                '<button class="close-btn" aria-label="Yopish" onclick="closeModal()">&times;</button>' +
            '</div>' +
            '<div id="banner-composer-body"></div>' +
            '<div class="bnr-foot">' +
                '<button class="bnr-save" id="bnr-save-btn" type="button">Saqlash</button>' +
            '</div>' +
        '</div>';

    function injectModals() {
        if ($('bannerAdminModal')) return;
        var host = document.createElement('div');
        host.innerHTML = MODALS_HTML;
        while (host.firstChild) document.body.appendChild(host.firstChild);
    }

    /** Havola manbasini qisqa yorliq bilan ko'rsatadi (admin qaerdan kelganini bilsin). */
    function srcLabel(url) {
        try {
            if (!url) return '\u2014';
            if (url.indexOf('http') !== 0) return 'Ilova ichida';
            var m = url.replace(/^https?:\/\//, '').split('/')[0];
            return m.replace(/^www\./, '');
        } catch (e) { return '\u2014'; }
    }

    function cardHTML(b, i, total) {
        return '<div class="bnr-card' + (b.active ? '' : ' is-off') + '" data-key="' + E(b.key) + '">' +
            '<div class="bnr-thumb" data-edit="1">' +
                '<img src="' + E(displayUrl(b.img)) + '" alt="" loading="lazy" onerror="this.style.opacity=.15;">' +
                '<em class="bnr-pos">' + (i + 1) + '</em>' +
                (b.partner ? '<span class="bnr-hamkor">Hamkorlik</span>' : '') +
                (b.active ? '' : '<span class="bnr-hidden-tag">Yashirilgan</span>') +
            '</div>' +
            '<div class="bnr-mid">' +
                '<b>' + E(b.alt || ('Banner ' + (i + 1))) + '</b>' +
                '<div class="bnr-chips">' +
                    (b.active
                        ? '<span class="bnr-chip">Ko\'rinadi</span>'
                        : '<span class="bnr-chip is-off">Yashirin</span>') +
                    (b.partner ? '<span class="bnr-chip is-gold">Reklama</span>' : '') +
                    '<span class="bnr-chip">' + E(srcLabel(b.img)) + '</span>' +
                '</div>' +
            '</div>' +
            '<div class="bnr-acts">' +
                '<button type="button" class="bnr-mini" data-up="1"' + (i === 0 ? ' disabled' : '') + ' aria-label="Yuqoriga">' + IC_UP + '</button>' +
                '<button type="button" class="bnr-mini" data-down="1"' + (i === total - 1 ? ' disabled' : '') + ' aria-label="Pastga">' + IC_DOWN + '</button>' +
                '<button type="button" class="bnr-mini" data-eye="1" aria-label="Ko\'rsatish yoki yashirish">' + (b.active ? IC_EYE : IC_EYE_OFF) + '</button>' +
                '<button type="button" class="bnr-mini is-edit" data-edit="1" aria-label="Almashtirish">' + IC_PENCIL + '</button>' +
                '<button type="button" class="bnr-mini is-del" data-del="1" aria-label="O\'chirish">' + IC_TRASH + '</button>' +
            '</div>' +
        '</div>';
    }

    function renderAdmin() {
        var box = $('banner-admin-body');
        if (!box) return;
        var total = S.rows.length;
        var shown = 0;
        S.rows.forEach(function (b) { if (b.active) shown++; });

        var head =
            '<div class="bnr-sum">' +
                '<div class="bnr-sum-b"><b>' + total + '</b><span>banner</span></div>' +
                '<div class="bnr-sum-b"><b>' + shown + '</b><span>ko\'rinadi</span></div>' +
                '<div class="bnr-sum-b"><b>' + (total - shown) + '</b><span>yashirin</span></div>' +
            '</div>';

        if (total > 0 && shown === 0) {
            head += '<div class="bnr-warn">Hozir bosh sahifada slayder <b>butunlay ko\'rinmaydi</b> \u2014 ' +
                'hamma banner yashirilgan. Hech bo\'lmasa bittasini yoqing.</div>';
        }
        head += '<div class="bnr-hint">' + IC_INFO + '<span>Eng yaxshi natija: <b>' + IDEAL_W + '\u00D7' + IDEAL_H +
            ' px</b>. Rasm <b>siqilmaydi</b> \u2014 asl sifatida saqlanadi. ' +
            'Kartani bosib rasmni almashtirasiz.</span></div>';

        head += (total >= MAX_BANNERS)
            ? '<div class="bnr-warn">Chegara: <b>' + MAX_BANNERS + ' ta banner</b>. Yangisini qo\'shish uchun birortasini o\'chiring.</div>'
            : '<button type="button" class="bnr-add" id="bnr-new-btn">' +
                  '<span class="bnr-add-ic">+</span>' +
                  '<span class="bnr-add-tx"><b>Yangi banner qo\'shish</b><i>Rasm tanlang \u2014 yarim daqiqada tayyor</i></span>' +
              '</button>';

        var list = total
            ? S.rows.map(function (b, i) { return cardHTML(b, i, total); }).join('')
            : '<div class="bnr-empty"><span class="ic">' + IC_GALLERY + '</span>' +
              '<b>Banner yo\'q</b><p>Birinchi bannerni qo\'shsangiz, bosh sahifadagi ' +
              'slayderda darhol paydo bo\'ladi.</p></div>';

        box.innerHTML = head + list;

        var nb = $('bnr-new-btn');
        if (nb) nb.onclick = function () { hap('medium'); AvtoBanners.openComposer(null); };

        stagger(box.querySelectorAll('.bnr-card'), 45, 12);

        box.onclick = function (e) {
            var card = e.target.closest ? e.target.closest('.bnr-card') : null;
            if (!card) return;
            var key = card.getAttribute('data-key');
            if (e.target.closest('[data-up]')) { move(key, -1); return; }
            if (e.target.closest('[data-down]')) { move(key, 1); return; }
            if (e.target.closest('[data-eye]')) { toggleActive(key); return; }
            if (e.target.closest('[data-del]')) { removeBanner(key, card); return; }
            if (e.target.closest('[data-edit]')) { hap('light'); AvtoBanners.openComposer(key); return; }
        };
    }

    /** Tartibni bazaga yozadi — har safar 10,20,30... deb QAYTA raqamlanadi. */
    function saveOrder(rows) {
        var d = DB();
        if (!d) return Promise.reject(new Error('Baza ulanmagan'));
        var upd = {};
        rows.forEach(function (b, i) { upd[b.key + '/order'] = (i + 1) * 10; });
        return d.ref(NODE).update(upd);
    }

    function move(key, dir) {
        var i = -1;
        for (var n = 0; n < S.rows.length; n++) if (S.rows[n].key === key) { i = n; break; }
        var j = i + dir;
        if (i < 0 || j < 0 || j >= S.rows.length) return;
        var arr = S.rows.slice();
        var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
        arr.forEach(function (b, n2) { b.order = (n2 + 1) * 10; });
        // Optimistik: ro'yxat va bosh sahifa DARHOL o'zgaradi, keyin baza.
        S.rows = arr;
        renderAdmin();
        renderSlider();
        hap('selection');
        saveOrder(arr).catch(function (err) { toast('Tartib saqlanmadi: ' + msgOf(err), 'warning'); });
    }

    function toggleActive(key) {
        var b = byKey(key);
        var d = DB();
        if (!b || !d) return;
        hap('light');
        var next = !b.active;
        /* ⚠️ OPTIMISTIK YANGILASH — SHART, tuzatilgan xato:
           ilgari faqat jonli tinglovchiga tayanardi. Tinglovchi ulanmagan
           bo'lsa (ruxsat yo'q / oflayn / `boot` ulgurmagan), `S.rows` eski
           qiymatda qolib, IKKINCHI bosishda AYNI qiymat qayta yozilardi:
           tugma "qotib" qolardi — bir marta yashirsa, boshqa yoqilmasdi. */
        b.active = next;
        renderAdmin();
        renderSlider();
        d.ref(NODE + '/' + key).update({ active: next, updatedAt: Date.now() })
            .then(function () { toast(next ? 'Banner yoqildi' : 'Banner yashirildi', 'success'); })
            .catch(function (err) {
                b.active = !next;          // orqaga qaytaramiz
                renderAdmin();
                renderSlider();
                toast('O\'zgarmadi: ' + msgOf(err), 'warning');
            });
    }

    function removeBanner(key, cardEl) {
        if (!amAdmin()) { toast('Faqat admin', 'warning'); return; }
        var b = byKey(key);
        if (!b) return;
        confirmBox('Bu bannerni o\'chirasizmi?\n\nBosh sahifadan darhol yo\'qoladi.', function () {
            var d = DB();
            if (!d) return;
            if (cardEl) {
                cardEl.style.transition = 'opacity .22s ease, transform .22s ease';
                cardEl.style.opacity = '0';
                cardEl.style.transform = 'translateX(-26px)';
            }
            d.ref(NODE + '/' + key).remove().then(function () {
                hap('success');
                toast('Banner o\'chirildi', 'success');
                // Qolganlarini qayta raqamlaymiz — tartibda "teshik" qolmasin.
                // Bu ham OPTIMISTIK: tinglovchiga tayanmaymiz (yuqoridagi izoh).
                var rest = S.rows.filter(function (x) { return x.key !== key; });
                rest.forEach(function (b2, i2) { b2.order = (i2 + 1) * 10; });
                S.rows = rest;
                renderAdmin();
                renderSlider();
                if (rest.length) saveOrder(rest).catch(function () {});
            }).catch(function (err) {
                if (cardEl) { cardEl.style.opacity = ''; cardEl.style.transform = ''; }
                toast('O\'chirilmadi: ' + msgOf(err), 'warning');
            });
        });
    }

    /**
     * HTML'dagi standart bannerlarni bazaga BIR MARTA ko'chiradi. Shundan keyin
     * ular oddiy yozuv bo'lib qoladi — tahrirlash, o'chirish, tartibini
     * o'zgartirish mumkin. Aks holda admin panel bo'sh ko'rinardi-yu, bosh
     * sahifada 4 ta banner turardi — chalkash.
     */
    function seedDefaults() {
        var d = DB();
        if (!d || S.seeding || !DEFAULTS.length) return Promise.resolve();
        S.seeding = true;
        var upd = {}, now = Date.now();
        DEFAULTS.forEach(function (b, i) {
            var k = d.ref(NODE).push().key;
            upd[k] = {
                img: b.img,
                alt: b.alt,
                order: (i + 1) * 10,
                partner: !!b.partner,
                active: true,
                createdAt: now + i
            };
        });
        return d.ref(NODE).update(upd).then(function () {
            S.seeding = false;
            toast('Joriy ' + DEFAULTS.length + ' ta banner bazaga ko\'chirildi \u2014 endi tahrirlash mumkin', 'success');
            return load();
        }).catch(function (err) {
            S.seeding = false;
            throw err;
        });
    }

    AvtoBanners.openAdmin = function () {
        if (!amAdmin()) { toast('Bu bo\'lim faqat admin uchun', 'warning'); return; }
        injectModals();
        captureDefaults();
        var box = $('banner-admin-body');
        if (box) box.innerHTML = (window._skel ? window._skel(3, 190) : '<p style="text-align:center;">Yuklanmoqda...</p>');
        openSheet('bannerAdminModal', 'adminModal');
        load().then(function () {
            if (!S.rows.length) return seedDefaults();
        }).then(function () {
            renderAdmin();
        }).catch(function (err) {
            if (box) {
                box.innerHTML = '<div class="bnr-empty"><span class="ic">' + IC_INFO + '</span>' +
                    '<b>O\'qib bo\'lmadi</b><p>' + E(msgOf(err)) + '</p></div>';
            }
        });
    };

    /** popstate composer'dan qaytganda ro'yxatni yangilash uchun chaqiradi. */
    AvtoBanners.repaintAdmin = function () {
        if (curModal() === 'bannerAdminModal') renderAdmin();
    };

    /* ------------------------------------------------------------------ *
     * 4. COMPOSER — rasm yuklash + jonli ko'rinish
     * ------------------------------------------------------------------ */
    function composerHTML() {
        return '' +
        '<div class="bnr-block">' +
            '<p class="bnr-lbl">1 &middot; Banner rasmi</p>' +
            '<div class="bnr-picks">' +
                '<div class="bnr-pick" id="bnr-pick-file" role="button" tabindex="0">' +
                    '<span class="bnr-pick-ic" id="bnr-pick-ic">' + IC_GALLERY + '</span>' +
                    '<b id="bnr-pick-tx">Galereyadan</b><i>Telefondagi rasm</i>' +
                    // Input KARTANING USTIDA shaffof qatlam (CSS izohiga qara)
                    '<input type="file" id="bnr-file" class="bnr-file-over" ' +
                        'accept="image/png,image/jpeg,image/jpg,image/webp,image/heic,image/heif">' +
                '</div>' +
                '<div class="bnr-pick" id="bnr-pick-link" role="button" tabindex="0">' +
                    '<span class="bnr-pick-ic">' + IC_LINK + '</span>' +
                    '<b>Havoladan</b><i>Tayyor rasm manzili</i>' +
                '</div>' +
            '</div>' +
            '<div class="bnr-up hidden" id="bnr-up"><i id="bnr-up-bar"></i><span id="bnr-up-tx">0%</span></div>' +
            '<div id="bnr-link-wrap" style="display:none; margin-top:13px;">' +
                '<label class="bnr-field" style="margin-bottom:0;"><span>Rasm havolasi</span>' +
                '<input type="text" class="bnr-input" id="bnr-img-url" placeholder="https://..." ' +
                    'autocomplete="off" spellcheck="false" inputmode="url"></label>' +
            '</div>' +
            '<p class="bnr-tip">' + IC_INFO + ' Eng yaxshi natija: <b>' + IDEAL_W + '\u00D7' + IDEAL_H + ' px</b> ' +
                '(nisbat 1.618:1). Rasm <b>siqilmaydi</b> \u2014 asl sifatida saqlanadi.</p>' +
            '<div class="bnr-qual hidden" id="bnr-qual"></div>' +
        '</div>' +

        '<div class="bnr-block">' +
            '<p class="bnr-lbl">2 &middot; Bosh sahifada shunday ko\'rinadi</p>' +
            '<div class="bnr-stage is-empty" id="bnr-stage"></div>' +
            '<p class="bnr-tip">Ramka aynan bosh sahifadagi slayder o\'lchamida \u2014 ' +
                'rasm chetlari kesilsa shu yerda ko\'rinadi.</p>' +
        '</div>' +

        '<div class="bnr-block">' +
            '<p class="bnr-lbl">3 &middot; Tafsilotlar</p>' +
            '<label class="bnr-field"><span>Nomi \u2014 o\'zingiz uchun belgi</span>' +
            '<input type="text" class="bnr-input" id="bnr-alt" maxlength="120" ' +
                'placeholder="Masalan: Qishki chegirma" autocomplete="off"></label>' +
            '<div class="bnr-sw" id="bnr-sw-partner" role="button" tabindex="0">' +
                '<div class="bnr-sw-tx"><b>\u00ABHamkorlik\u00BB belgisi</b>' +
                    '<i>Reklama ekanini bildiradi \u2014 banner ustida chiqadi</i></div>' +
                '<span class="bnr-sw-el"><i></i></span>' +
            '</div>' +
            '<div class="bnr-sw" id="bnr-sw-active" role="button" tabindex="0">' +
                '<div class="bnr-sw-tx"><b>Bosh sahifada ko\'rinsin</b>' +
                    '<i>O\'chirsangiz banner saqlanadi, lekin mijozga ko\'rinmaydi</i></div>' +
                '<span class="bnr-sw-el"><i></i></span>' +
            '</div>' +
        '</div>';
    }

    function setSw(id, on) {
        var el = $(id);
        if (el) el.classList.toggle('on', !!on);
    }
    function setPickTx(iconHtml, txt) {
        var ic = $('bnr-pick-ic'), tx = $('bnr-pick-tx');
        if (ic) ic.innerHTML = iconHtml;
        if (tx) tx.textContent = txt;
    }
    function showProgress(pct) {
        var box = $('bnr-up'), bar = $('bnr-up-bar'), tx = $('bnr-up-tx');
        if (!box) return;
        if (pct === null) { box.classList.add('hidden'); return; }
        box.classList.remove('hidden');
        if (bar) bar.style.width = Math.max(3, Math.min(100, pct)) + '%';
        if (tx) tx.textContent = pct + '%';
    }
    function showQual(q) {
        var el = $('bnr-qual');
        if (!el) return;
        if (!q) { el.className = 'bnr-qual hidden'; el.innerHTML = ''; return; }
        if (q.pending) {
            el.className = 'bnr-qual is-wait';
            el.innerHTML = '<b>O\'lcham tekshirilmoqda\u2026</b>';
            return;
        }
        el.className = 'bnr-qual is-' + q.lvl;
        el.innerHTML = '<b>' + E(q.lbl) + '</b><span>' + E(q.size) + '</span><p>' + E(q.note) + '</p>';
    }
    function refreshQuality(url) {
        showQual({ pending: true });
        measure(url).then(function (d) {
            C.w = d.w; C.h = d.h;
            showQual(qualityOf(d.w, d.h));
        });
    }

    /** Jonli ko'rinish. ⚠️ ASL havola ko'rsatiladi (proxy emas) — admin
     *  haqiqiy sifatni o'z ko'zi bilan baholashi kerak. */
    function paintStage() {
        var st = $('bnr-stage');
        if (!st) return;
        if (!C.img) {
            st.className = 'bnr-stage is-empty';
            st.innerHTML = '<div class="bnr-stage-ph">' + IC_GALLERY +
                '<span>Rasm tanlansa \u2014 shu yerda ko\'rinadi</span></div>';
            return;
        }
        st.className = 'bnr-stage';
        st.innerHTML =
            '<img src="' + E(C.img) + '" alt="" onerror="this.style.opacity=.15;">' +
            '<span class="bnr-stage-fade"></span>' +
            (C.partner ? '<span class="bnr-stage-hamkor">Hamkorlik</span>' : '') +
            '<span class="bnr-stage-dots"><i class="on"></i><i></i><i></i></span>' +
            '<button type="button" class="bnr-stage-x" id="bnr-stage-x" aria-label="Tozalash">&times;</button>';
        var x = $('bnr-stage-x');
        if (x) x.onclick = function () {
            C.img = ''; C.w = 0; C.h = 0;
            var iu = $('bnr-img-url'); if (iu) iu.value = '';
            setPickTx(IC_GALLERY, 'Galereyadan');
            showQual(null); paintStage(); hap('light');
        };
    }

    function wireComposer() {
        var altEl = $('bnr-alt');
        if (altEl) {
            altEl.value = C.alt;
            altEl.oninput = function () { C.alt = altEl.value; };
        }

        var urlEl = $('bnr-img-url');
        if (urlEl) {
            urlEl.value = (C.img && C.img.indexOf('http') === 0) ? C.img : '';
            var applyUrl = function () {
                var v = (urlEl.value || '').trim();
                if (!v || v === C.img) return;
                if (v.indexOf('http://') !== 0 && v.indexOf('https://') !== 0) {
                    toast('Havola https:// bilan boshlanishi kerak', 'warning');
                    return;
                }
                C.img = v;
                paintStage();
                refreshQuality(v);
            };
            urlEl.onchange = applyUrl;
            urlEl.onblur = applyUrl;
        }
        var pl = $('bnr-pick-link');
        if (pl) pl.onclick = function () {
            var w = $('bnr-link-wrap');
            if (w) w.style.display = 'block';
            pl.classList.add('on');
            var i = $('bnr-img-url');
            if (i) { try { i.focus(); } catch (e) {} }
            hap('light');
        };

        var fi = $('bnr-file');
        if (fi) fi.onchange = function () {
            var f = fi.files && fi.files[0];
            fi.value = '';
            if (f) pickFile(f);
        };

        setSw('bnr-sw-partner', C.partner);
        setSw('bnr-sw-active', C.active);
        var sp = $('bnr-sw-partner');
        if (sp) sp.onclick = function () {
            C.partner = !C.partner;
            setSw('bnr-sw-partner', C.partner);
            paintStage();                 // belgi jonli ko'rinishda darhol chiqadi
            hap('selection');
        };
        var sa = $('bnr-sw-active');
        if (sa) sa.onclick = function () {
            C.active = !C.active;
            setSw('bnr-sw-active', C.active);
            hap('selection');
        };

        var sv = $('bnr-save-btn');
        if (sv) {
            sv.disabled = false;
            sv.textContent = C.key ? 'O\'zgarishni saqlash' : 'Bannerni joylash';
            sv.onclick = save;
        }
    }

    function pickFile(file) {
        if (typeof window.uploadFileWithProgress !== 'function') {
            toast('Rasm yuklash moduli topilmadi', 'warning');
            return;
        }
        if (file.size > MAX_FILE) {
            toast('Rasm juda katta (' + Math.round(file.size / 1048576) + ' MB). ' +
                  Math.round(MAX_FILE / 1048576) + ' MB gacha bo\'lsin.', 'warning');
            return;
        }
        // ⚠️ O'lchamni YUKLASHDAN OLDIN o'qiymiz. Aks holda past sifatli rasm
        //    ImgBB'ga chiqib ketardi va admin faqat keyin "bulanadi" degan
        //    xabarni ko'rardi — bekor qilish uchun juda kech.
        var blobUrl = null;
        try { blobUrl = URL.createObjectURL(file); } catch (e) {}
        measure(blobUrl || '').then(function (d) {
            if (blobUrl) { try { URL.revokeObjectURL(blobUrl); } catch (e) {} }
            if (d.w && d.w < MIN_GOOD_W) {
                confirmBox('Bu rasm faqat ' + d.w + '\u00D7' + d.h + ' px \u2014 ' +
                    'slayderda bulanib ko\'rinadi.\n\nShunda ham yuklaymizmi?',
                    function () { doUpload(file, d); });
                return;
            }
            doUpload(file, d);
        });
    }

    function doUpload(file, dim) {
        setPickTx(IC_WAIT, 'Yuklanmoqda\u2026');
        showProgress(4);
        showQual({ pending: true });
        window.uploadFileWithProgress(file, function (p) { showProgress(p); })
            .then(function (url) {
                C.img = url; C.w = dim.w; C.h = dim.h;
                showProgress(null);
                setPickTx(IC_OK, 'Rasm tayyor');
                var iu = $('bnr-img-url');
                if (iu) iu.value = url;
                paintStage();
                if (dim.w) showQual(qualityOf(dim.w, dim.h));
                else refreshQuality(url);
                hap('success');
            })
            .catch(function (err) {
                showProgress(null);
                setPickTx(IC_GALLERY, 'Galereyadan');
                showQual(null);
                toast('Yuklanmadi: ' + msgOf(err), 'warning');
            });
    }

    function save() {
        if (!amAdmin()) { toast('Faqat admin', 'warning'); return; }
        if (C.busy) return;
        if (!C.img) { hap('warning'); toast('Avval banner rasmini tanlang', 'warning'); return; }
        var d = DB();
        if (!d) { toast('Baza ulanmagan', 'warning'); return; }
        if (!C.key && S.rows.length >= MAX_BANNERS) {
            toast('Chegara: ' + MAX_BANNERS + ' ta banner', 'warning');
            return;
        }

        var btn = $('bnr-save-btn');
        C.busy = true;
        if (btn) { btn.disabled = true; btn.textContent = 'Saqlanmoqda\u2026'; }

        var payload = {
            img: C.img,
            alt: String(C.alt || '').slice(0, 120),
            partner: !!C.partner,
            active: !!C.active,
            updatedAt: Date.now()
        };
        var p;
        if (C.key) {
            p = d.ref(NODE + '/' + C.key).update(payload);
        } else {
            payload.order = (S.rows.length + 1) * 10;
            payload.createdAt = Date.now();
            p = d.ref(NODE).push(payload);
        }

        p.then(function () {
            hap('success');
            toast(C.key ? 'Banner yangilandi' : 'Banner qo\'shildi', 'success');
            return load().catch(function () {});
        }).then(function () {
            // Ro'yxatga qaytamiz — popstate `bannerComposerModal` uchun
            // `bannerAdminModal` ga qaytishni biladi va qayta chizadi.
            window.history.back();
        }).catch(function (err) {
            toast('Saqlanmadi: ' + msgOf(err), 'warning');
        }).then(function () {
            C.busy = false;
            if (btn) { btn.disabled = false; btn.textContent = C.key ? 'O\'zgarishni saqlash' : 'Bannerni joylash'; }
        });
    }

    AvtoBanners.openComposer = function (key) {
        if (!amAdmin()) { toast('Faqat admin', 'warning'); return; }
        injectModals();
        var b = key ? byKey(key) : null;
        C.key = b ? b.key : null;
        C.img = b ? b.img : '';
        C.alt = b ? b.alt : '';
        C.partner = b ? !!b.partner : false;
        C.active = b ? (b.active !== false) : true;
        C.busy = false; C.w = 0; C.h = 0;

        var t = $('bnr-cm-title'), s = $('bnr-cm-sub');
        if (t) t.textContent = b ? 'Bannerni almashtirish' : 'Yangi banner';
        if (s) s.textContent = b ? 'Rasmni yoki nomini o\'zgartiring' : 'Rasm tanlang \u2014 ko\'rinishi pastda';

        var body = $('banner-composer-body');
        if (body) body.innerHTML = composerHTML();
        openSheet('bannerComposerModal', 'bannerAdminModal');
        wireComposer();
        showProgress(null);
        showQual(null);
        paintStage();
        if (C.img) refreshQuality(C.img);
    };

    /** Tashqi kod uchun: bannerlarni qayta o'qib, bosh sahifani yangilash. */
    AvtoBanners.refresh = function () { return load(); };

    window.AvtoBanners = AvtoBanners;

    /* ---- Ishga tushirish ---- */
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
})();
