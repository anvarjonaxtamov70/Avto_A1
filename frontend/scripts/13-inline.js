
window.currentUser = null;
    // 🔇 #16: PRODUCTION'da konsol toza bo'lsin. Diagnostika kerak bo'lsa
    //   localStorage.avto_debug = '1' qo'ying (yoki window.AVTO_DEBUG = true) —
    //   shunda _dlog/_dwarn yana ishlaydi. Xatolar yo'qolmaydi, faqat yashiriladi.
    window.AVTO_DEBUG = (function () { try { return localStorage.getItem('avto_debug') === '1'; } catch (e) { return false; } })();
    window._dlog = function () { if (window.AVTO_DEBUG) { try { console['log'].apply(console, arguments); } catch (e) {} } };
    window._dwarn = function () { if (window.AVTO_DEBUG) { try { console['warn'].apply(console, arguments); } catch (e) {} } };
    // 🏷 BUILD VERSIYA — telefon qaysi kodni yuklayotganini bilish uchun (kesh diagnostikasi)
    window.AVTO_BUILD = 'v2026.05.30-7';
    try { _dlog('%c[Avto A1] BUILD ' + window.AVTO_BUILD + ' — ' + new Date().toISOString(), 'color:#C9A84C;font-weight:bold;'); } catch(e){}
    // 🛡 Telegram WebApp himoyali yuklash — brauzerda yoki Telegram yuklanmasa ham xato bermaydi
    // 📱 ANDROID ILOVA (APK) — Capacitor qobig'i User-Agent oxiriga «AvtoA1App» qo'shadi.
    //    Ilovada Telegram yo'q: telegram-web-app.js baribir window.Telegram.WebApp
    //    yaratadi, lekin uning showConfirm/showAlert'i Telegram tashqarisida XATO
    //    otadi, openTelegramLink esa butun ilovani t.me sahifasiga olib ketadi.
    //    Shuning uchun ilovada Telegram obyekti ishlatilmaydi — pastdagi to'liq
    //    «stub» ishlaydi (tasdiq/ogohlantirish — native oyna, havolalar — tashqi ilova).
    window.A1_APP = (function () {
        try {
            if (/\bAvtoA1App\b/.test(navigator.userAgent || '')) return true;
            if (window.A1_PWA) return true;   // iPhone/iPad/Android «Bosh ekranga qo'shilgan» ilova
            return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
        } catch (e) { return false; }
    })();
    if (window.A1_APP) { try { document.documentElement.classList.add('a1-app'); } catch (e) {} }
    // Ilovada tashqi havola (t.me, tel:, Instagram, xarita) — tizim ochadi
    // (Telegram ilovasi, qo'ng'iroq, brauzer). Capacitor o'z domenidan tashqari
    // har qanday manzilni avtomatik tashqi ilovaga uzatadi.
    window.a1OpenExternal = function (url) {
        if (!url) return;
        window.location.href = url;   // Capacitor tutib oladi -> Intent.ACTION_VIEW
    };
    window._a1IsExternal = function (href) {
        try {
            if (/^(tel|tg|mailto|sms|geo|intent|whatsapp|market):/i.test(href)) return true;
            var u = new URL(href, location.href);
            return /^https?:$/.test(u.protocol) && u.host !== location.host;
        } catch (e) { return false; }
    };
    if (window.A1_APP && !window.A1_PWA) {
        // target="_blank" havolalar va window.open — ilova ichida emas, tashqi ilovada ochiladi
        document.addEventListener('click', function (e) {
            var a = e.target && e.target.closest && e.target.closest('a[href]');
            if (!a || e.defaultPrevented) return;
            var href = a.getAttribute('href') || '';
            if (!href || href.charAt(0) === '#' || /^javascript:/i.test(href) || a.hasAttribute('download')) return;
            if (window._a1IsExternal(href)) { e.preventDefault(); window.a1OpenExternal(a.href || href); }
        }, true);
        var _wopen = window.open;
        window.open = function (url) {
            if (url && window._a1IsExternal(String(url))) { window.a1OpenExternal(String(url)); return null; }
            return _wopen.apply(window, arguments);
        };
    }
    let tg;
    try {
        tg = (!window.A1_APP && window.Telegram && window.Telegram.WebApp) ? window.Telegram.WebApp : null;
    } catch(e) { tg = null; }
    if (!tg) {
        // Brauzerda yoki Telegram script bloklangan bo'lsa — bo'sh "stub" yaratamiz
        // Shunda keyingi kod tg.xxx() chaqirsa ham, hech qaysi narsa portlamaydi
        tg = {
            initDataUnsafe: {},
            expand: function(){}, ready: function(){},
            isVersionAtLeast: function(){ return false; },
            // 📳 Brauzer/APK (Telegram tashqarisida) — navigator.vibrate ZAXIRASI.
            // Shunda mavjud BARCHA tg.HapticFeedback.* chaqiruvlari (savat, buyurtma,
            // like va h.k.) Telegram tashqarisida ham tebranish beradi — call-site'larni
            // o'zgartirmasdan. Telegram ICHIDA bu stub umuman ishlatilmaydi (native haptic).
            // ⚡ Telefonni qizdirmaydi: bir martalik, juda qisqa (5–20ms) impuls.
            HapticFeedback: {
                notificationOccurred: function(type){ try { if (typeof navigator!=='undefined' && navigator.vibrate) navigator.vibrate(type === 'success' ? [10,30,10] : [18,40,18]); } catch(e){} },
                impactOccurred: function(style){ try { if (typeof navigator!=='undefined' && navigator.vibrate) navigator.vibrate(style === 'heavy' ? 20 : style === 'medium' ? 15 : style === 'soft' ? 8 : 10); } catch(e){} },
                selectionChanged: function(){ try { if (typeof navigator!=='undefined' && navigator.vibrate) navigator.vibrate(5); } catch(e){} }
            },
            BackButton: { show: function(){}, hide: function(){}, onClick: function(){}, offClick: function(){}, isVisible: false },
            MainButton: { show: function(){}, hide: function(){}, onClick: function(){}, offClick: function(){}, setText: function(){} },
            close: function(){}, sendData: function(){},
            // Telegram API'ning qolgan qismi — chaqirilsa ham xato bermaydi.
            // (Ilgari yo'q edi: masalan `tg.onEvent('backButtonClicked', …)` himoyasiz
            //  chaqiriladi va stub rejimida butun skript blokini to'xtatib qo'yardi.)
            initData: '',
            onEvent: function(){}, offEvent: function(){},
            setHeaderColor: function(){}, setBackgroundColor: function(){}, setBottomBarColor: function(){},
            enableClosingConfirmation: function(){}, disableClosingConfirmation: function(){},
            enableVerticalSwipes: function(){}, disableVerticalSwipes: function(){}, enableSwipeBack: function(){},
            requestFullscreen: function(){}, exitFullscreen: function(){}, isFullscreen: false,
            safeAreaInset: null, contentSafeAreaInset: null,
            // Tasdiq / ogohlantirish — native (Android) oyna
            showConfirm: function(msg, cb){ var ok = false; try { ok = window.confirm(String(msg || '')); } catch(e){} if (typeof cb === 'function') setTimeout(function(){ cb(ok); }, 0); },
            showAlert: function(msg, cb){ try { window.alert(String(msg || '')); } catch(e){} if (typeof cb === 'function') setTimeout(cb, 0); },
            showPopup: function(p, cb){
                p = p || {}; var bs = p.buttons || [{ id: 'ok', type: 'ok' }];
                var text = (p.title ? p.title + '\n\n' : '') + (p.message || '');
                var main = bs.filter(function(b){ return b.type !== 'cancel' && b.type !== 'close'; })[0] || bs[0];
                var cancel = bs.filter(function(b){ return b.type === 'cancel' || b.type === 'close'; })[0];
                var id = main && main.id;
                try { if (bs.length > 1) { if (!window.confirm(text)) id = cancel ? cancel.id : ''; } else window.alert(text); } catch(e){}
                if (typeof cb === 'function') setTimeout(function(){ cb(id); }, 0);
            },
            openLink: function(url){ window.a1OpenExternal(url); },
            openTelegramLink: function(url){ window.a1OpenExternal(url); },
            colorScheme: 'dark', themeParams: {},
            platform: 'browser', version: '0.0'
        };
        _dwarn('[TG] WebApp mavjud emas — brauzer rejimida ishlamoqda (stub yoqildi)');
    }
    try { tg.expand && tg.expand(); } catch(e) { _dwarn('[TG] expand xato:', e.message); }
    try { tg.ready && tg.ready(); } catch(e) {}

    // 🔴 KRITIK TUZATISH — `window.tg` ni OCHIQ qilamiz.
    // ------------------------------------------------------------------
    // Yuqorida `let tg` ishlatilgan. Top-level `let`/`const` global LEKSIK
    // muhitga tushadi, ammo `window` OBYEKTIGA TUSHMAYDI. Ya'ni `window.tg`
    // hamisha `undefined` edi.
    //
    // Fayl bo'ylab 13 joyda `if (window.tg && tg.xxx)` shaklidagi qo'riqchi
    // ishlatilgan — ularning HAMMASI doim `false` bo'lib, Telegram
    // funksiyalari HECH QACHON ishlamagan. Buzilganlari:
    //   • storisga video yuklash — `initData` doim bo'sh -> "faqat Telegram
    //     ichida ishlaydi" degan ogohlantirish chiqib, yuklash boshlanmasdi
    //     (foydalanuvchi "video tanlayapman, o'sha joyda qotib qolyapti" deb
    //      aytgan holat AYNAN shu edi);
    //   • Telegram header/fon rangi mavzuga moslashmasdi;
    //   • BackButton ko'rinmasdi;
    //   • native showAlert / showConfirm o'rniga oddiy toast chiqardi;
    //   • openLink / openTelegramLink ishlamasdi.
    //
    // Bitta qator — hammasi tiklanadi. Brauzer rejimida `tg` "stub" bo'ladi,
    // unda `initData`/`showAlert` yo'q, shuning uchun o'sha qo'riqchilar
    // avvalgidek xavfsiz zaxira yo'lga tushadi (xatti-harakat o'zgarmaydi).
    window.tg = tg;
    // Ilovada `window.Telegram.WebApp` ga to'g'ridan-to'g'ri murojaat qiluvchi
    // joylar ham shu xavfsiz stub'ni ko'rsin.
    if (window.A1_APP) { try { window.Telegram = { WebApp: tg }; } catch (e) {} }

    // 📳 HAPTIC ZAXIRASI (navigator.vibrate) — XAVFSIZ va MARKAZIY.
    //    Muammo: telegram-web-app.js BRAUZERDA ham window.Telegram.WebApp yaratadi,
    //    lekin uning HapticFeedback'i Telegram TASHQARISIDA NO-OP (tebranmaydi).
    //    Yechim: agar HAQIQATAN Telegram ichida bo'lmasak (initData bo'sh va platform
    //    'unknown'/'browser'), tg.HapticFeedback'ni navigator.vibrate bilan almashtiramiz.
    //    Natija: savat / buyurtma / like / menyu — BARCHA mavjud haptic chaqiruvlari
    //    brauzer va APK'da ham tebranadi. Telegram ICHIDA esa native haptic SAQLANADI.
    //    ⚡ Telefonni qizdirmaydi: bir martalik, juda qisqa (5–20ms) impuls.
    try {
        var _realTelegram = !!(tg && (tg.initData ||
            (tg.platform && tg.platform !== 'unknown' && tg.platform !== 'browser')));
        if (!_realTelegram && typeof navigator !== 'undefined' && navigator.vibrate) {
            tg.HapticFeedback = {
                notificationOccurred: function(type){ try { navigator.vibrate(type === 'success' ? [10,30,10] : [18,40,18]); } catch(e){} },
                impactOccurred: function(style){ try { navigator.vibrate(style === 'heavy' ? 20 : style === 'medium' ? 15 : style === 'soft' ? 8 : 10); } catch(e){} },
                selectionChanged: function(){ try { navigator.vibrate(5); } catch(e){} }
            };
        }
    } catch(e){}
    // iOS dagi 300ms kechikishni o'chiramiz
// Endi tugmalar darhol javob beradi
document.addEventListener('touchstart', function() {}, {passive: true});

// iOS da scroll qilganda sahifa "sakrab" ketishini to'xtatamiz
document.addEventListener('touchmove', function(e) {
    // Oyna (modal) ochiq bo'lsa, FAQAT orqa fonni muzlatamiz.
    // ⚠️ MUHIM: ilgari bu kod oyna ochiq bo'lganda BARCHA barmoq harakatini
    // (modal ichidagi va slayderdagi skrollni ham) to'xtatib qo'yardi.
    // Endi barmoq skroll bo'ladigan element (oyna, slayder, chat...) ustida
    // bo'lsa — skrollga TO'LIQ ruxsat beramiz, faqat orqa fonni qotiramiz.
    if (document.body.style.overflow === 'hidden') {
        var t = e.target;
        var scrollable = (t && t.closest) ? t.closest(
            '#productModal, .modal-standard, .pm-slider, .pm-info-section, ' +
            '#ai-chat-box, #story-content, .chat-messages, .pm-similar-wrapper, ' +
            '#admin-orders-list, #admin-customers-list, #admin-drafts-list, ' +
            '#admin-inventory-list, #admin-stats-content, #od-chat-messages, ' +
            '#admin-chat-messages, #pm-reviews-list, #pm-size-options, #pm-car-options, ' +
            // 🆕 Stories boshqaruvi / composer / mijoz tafsiloti — ichki skrollga ruxsat
            '#admin-stories-list, #story-composer-body, #customer-detail-body, ' +
            '#cst-list, .st2-rings, .cst-segs, ' +
            // 🆕 AI ommaviy: kontent va holat paneli ham ichki skroller
            //    (bularsiz barmoq harakati bloklanib, skroll "sakrardi")
            '#ai-bulk-content, #ai-neural-loader'
        ) : null;
        // Faqat skroll bo'ladigan joy TOPILMASA (ya'ni orqa fon) to'xtatamiz
        if (!scrollable) {
            e.preventDefault();
        }
    }
}, {passive: false});

// ====================================================================
// 🛑 REZINA (RUBBER-BAND / OVERSCROLL) EFFEKTINI BLOKLASH
// --------------------------------------------------------------------
// Telegram Mini App'da hujjatni eng tepa yoki eng pastdan ortiqcha
// tortganda "ko'rinmas oyna ochilgandek" cho'zilib qaytadi. Quyidagi
// mantiq FAQAT hujjat chekkasida (eng tepa/eng past) ortiqcha
// touchmove'ni bloklaydi. Asosiy window.scrollY skroll mantig'iga,
// ichki skrollga (oyna, slayder, chat) va gorizontal slayderlarga
// umuman tegmaydi. CSS overscroll-behavior:none yetmagan iOS WebView
// (Telegram) holatlari uchun qo'shimcha sug'urta.
// ====================================================================
(function blockDocumentRubberBand() {
    var startY = 0, startX = 0, scroller = null;

    // Barmoq ostidan eng yaqin VERTIKAL skroll bo'ladigan ajdodni topamiz.
    // (overflow-y auto/scroll VA scrollHeight > clientHeight bo'lsa — haqiqiy skroller)
    function findScroller(node) {
        while (node && node.nodeType === 1 && node !== document.body && node !== document.documentElement) {
            var oy = '';
            try { oy = getComputedStyle(node).overflowY; } catch (e) {}
            if ((oy === 'auto' || oy === 'scroll') && node.scrollHeight > node.clientHeight + 1) {
                return node;
            }
            node = node.parentNode;
        }
        return null;
    }

    document.addEventListener('touchstart', function(e) {
        if (e.touches && e.touches.length === 1) {
            startY = e.touches[0].clientY;
            startX = e.touches[0].clientX;
            // Skroller'ni BIR MARTA (touchstart) aniqlaymiz — touchmove'da tez ishlaydi
            scroller = findScroller(e.target);
        }
    }, { passive: true });

    document.addEventListener('touchmove', function(e) {
        // Ikki barmoq (zoom/pinch) — aralashmaymiz
        if (!e.touches || e.touches.length !== 1) return;
        // Oyna ochiq bo'lsa — yuqoridagi handler (orqa fonni muzlatish) hal qiladi
        if (document.body.style.overflow === 'hidden') return;

        var dY = e.touches[0].clientY - startY;
        var dX = e.touches[0].clientX - startX;
        // Gorizontal imo (banner slider, storis lentasi) — vertikal rezinaga
        // aralashmaymiz, slayder erkin suriladi.
        if (Math.abs(dX) > Math.abs(dY)) return;

        if (scroller) {
            // Ichki skroller: faqat O'Z chekkasida (rezina) bloklaymiz —
            // ichki skroll erkin ishlaydi, lekin chekkada cho'zilmaydi.
            var atTopS = scroller.scrollTop <= 0;
            var atBotS = scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 1;
            if ((atTopS && dY > 0) || (atBotS && dY < 0)) e.preventDefault();
            return;
        }

        // Skroller topilmadi -> hujjat (window) skroli. Eng tepada pastga yoki
        // eng pastda tepaga tortish = rezina effekti -> bloklaymiz.
        var st = window.scrollY || document.documentElement.scrollTop || 0;
        var atTop = st <= 0;
        var atBottom = (window.innerHeight + st) >= (document.documentElement.scrollHeight - 1);
        if ((atTop && dY > 0) || (atBottom && dY < 0)) e.preventDefault();
    }, { passive: false });
})();
    // ==========================================
    // 🍏 IOS NATIVE (HAQIQIY ILOVA) SOZLAMALARI
    // ==========================================
    
    // 1. iPhone'da chapdan o'ngga surib orqaga qaytishni yoqish
    try {
        if (tg.isVersionAtLeast && tg.isVersionAtLeast('7.7') && tg.enableSwipeBack) {
            tg.enableSwipeBack();
        }
    } catch(e) { _dwarn('[TG] enableSwipeBack qo\'llab-quvvatlanmaydi:', e.message); }

    // 2. Tepadagi soat/batareya qismini (Status Bar) qora fon bilan bir xil qilish
    try {
        if (tg.isVersionAtLeast && tg.isVersionAtLeast('6.1') && tg.setHeaderColor) {
            tg.setHeaderColor('#000000'); // Yoki sizning fonga mos to'q qora
        }
    } catch(e) { _dwarn('[TG] setHeaderColor qo\'llab-quvvatlanmaydi:', e.message); }
    
    // 3. Pastki qism (Home Indicator) fonini moslash
    try {
        if (tg.isVersionAtLeast && tg.isVersionAtLeast('6.1') && tg.setBackgroundColor) {
            tg.setBackgroundColor('#000000');
        }
    } catch(e) { _dwarn('[TG] setBackgroundColor qo\'llab-quvvatlanmaydi:', e.message); }
    
    // 4. Ekranni to'liq egallash (faqat Telegram 8.0+ uchun)
    var _tgFullscreen = false;
    try {
        if (tg.isVersionAtLeast && tg.isVersionAtLeast('8.0') && tg.requestFullscreen) {
            tg.requestFullscreen();
            _tgFullscreen = true;
        }
    } catch(e) { _dwarn('[TG] requestFullscreen qo\'llab-quvvatlanmaydi:', e.message); }

    // ====================================================================
    // 🔝 TELEGRAM XAVFSIZ ZONA — header Telegram tugmalari OSTIDA boshlansin
    // --------------------------------------------------------------------
    // To'liq ekran (fullscreen) rejimida Telegram'ning o'z tugmalari (✕ yopish,
    // ⋮ menyu) kontent USTIDA suzadi. Bizning header tugmalarimiz (mavzu/qo'ng'iroq)
    // ular ostida qolib ketmasligi uchun --safe-top o'zgaruvchisini Telegram bergan
    // HAQIQIY insetlar bilan yangilaymiz:
    //     --safe-top = safeAreaInset.top (notch) + contentSafeAreaInset.top (TG UI)
    // CSS dagi barcha 'calc(... + var(--safe-top))' joylari (header padding,
    // .p2-hdr-btn tugmalari, modal paddinglari) avtomatik to'g'ri pastga suriladi.
    // Insetlar fullscreen O'TISHIDAN KEYIN (event orqali) keladi — shuning uchun
    // event listenerlar + bir nechta kechiktirilgan urinish qo'shamiz.
    // ====================================================================
    function applyTgSafeTop() {
        try {
            var sa  = tg.safeAreaInset || null;          // qurilma (notch/status bar)
            var csa = tg.contentSafeAreaInset || null;   // Telegram UI (tugmalar paneli)
            var saTop  = (sa  && typeof sa.top  === 'number') ? sa.top  : 0;
            var csaTop = (csa && typeof csa.top === 'number') ? csa.top : 0;
            var total = saTop + csaTop;
            // Fullscreen yoqilgan, ammo inset hali kelmagan (eski SDK yoki o'tish
            // lahzasi) — tugmalar ustma-ust tushmasligi uchun zaxira qiymat.
            var isFs = (typeof tg.isFullscreen === 'boolean') ? tg.isFullscreen : _tgFullscreen;
            if (total < 1 && isFs) total = 56;
            if (total > 0) {
                document.documentElement.style.setProperty('--safe-top', total + 'px');
            }
        } catch(e) { _dwarn('[TG] safe-top hisoblash xato:', e.message); }
    }
    try {
        if (tg.onEvent) {
            tg.onEvent('safeAreaChanged', applyTgSafeTop);
            tg.onEvent('contentSafeAreaChanged', applyTgSafeTop);
            tg.onEvent('fullscreenChanged', applyTgSafeTop);
        }
    } catch(e) {}
    applyTgSafeTop();                 // darhol
    setTimeout(applyTgSafeTop, 120);  // fullscreen o'tishidan keyin
    setTimeout(applyTgSafeTop, 500);  // sekinroq qurilmalar uchun zaxira

    // 🛑 1. Tepadan pastga tortganda yopilib ketishini TO'LIQ BLOKLASH
    try {
        if (tg.isVersionAtLeast && tg.isVersionAtLeast('7.7') && tg.disableVerticalSwipes) {
            tg.disableVerticalSwipes();
        }
    } catch(e) { _dwarn('[TG] disableVerticalSwipes qo\'llab-quvvatlanmaydi:', e.message); }

    // 🛡 2. QO'SHIMCHA HIMOYA (Ixtiyoriy): 
    // Agar mijoz "x" ni adashib bosib yuborsa, darrov yopilmaydi, 
    // "Haqiqatan ham chiqmoqchimisiz?" deb so'raydi. Bu savatdagi tovarlar yo'qolmasligi uchun juda foydali.
    if (tg.enableClosingConfirmation) {
        tg.enableClosingConfirmation(); 
    }

    const ADMIN_IDS = [5105291033, 483425630, 5302078];
    const ADMIN_ID = ADMIN_IDS[0];
    // 🔒 Token endi koddan olib tashlandi! Xabarlar maxfiy proxy (Cloudflare Worker) orqali yuboriladi.
    const TG_PROXY = "https://avtoa1bot.anvaraxtamov70.workers.dev";
    // Fayl oxiridagi qatlamlar (`/stock-commit`) ham shu manzildan foydalanadi.
    window.TG_PROXY = TG_PROXY;
    const IMGBB_API_KEY = "956de2d2a33ae1bcc56d5ada6fd8788d";
    const firebaseConfig = {
        apiKey: "AIzaSyCqK0E5hNpSHl6h-V-3WeVteWZnt7gXyOM",
        authDomain: "avtoa1shop.firebaseapp.com",
        databaseURL: "https://avtoa1shop-default-rtdb.firebaseio.com/",
        projectId: "avtoa1shop"
    };
    if (!firebase.apps.length) { firebase.initializeApp(firebaseConfig); }
    const db = firebase.database();

    // =====================================
    // 🛡 XAVFSIZLIK YORDAMCHILARI
    // =====================================
    // 🔐 XSS himoyasi: foydalanuvchi matnini DOM (innerHTML) uchun xavfsizlashtirish.
    //    Sharh va chat xabarlari shu orqali chiqarilishi SHART (aks holda saqlangan XSS).
    function escHtml(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]; }); }
    window.escHtml = escHtml;
    // 🔐 Telegram parse_mode:"HTML" xabarlari uchun (& < > ). Mahsulot nomi/mijoz matni
    //    HTML xabarga qo'shilishidan oldin shu orqali xavfsizlashtiriladi.
    function escTg(s){ return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
    window.escTg = escTg;
    // 🔐 onclick="fn('...')" kabi INLINE atribut ichidagi JS satri uchun.
    //    Ikki qatlam kerak: avval JS satri uchun (\ va '), keyin HTML atributi uchun.
    //    Brauzer avval HTML entity'ni ochadi, keyin JS'ni o'qiydi — shuning uchun
    //    tartib AYNAN shunday: escHtml(jsEscape(x)). Faqat .replace(/'/g,"\\'")
    //    yetarli EMAS edi (mijoz ismidagi " yoki < atributdan chiqib ketardi).
    function _jsAttr(s){
        return escHtml(
            String(s == null ? '' : s)
                .replace(/\\/g, '\\\\')
                .replace(/'/g, "\\'")
                .replace(/\r?\n/g, '\\n')
        );
    }
    window._jsAttr = _jsAttr;
    // 📨 Telegram proxy'ga xabar yuborish — Worker auth tekshirishi uchun initData qo'shamiz.
    //    (Ochiq proxy yopildi: endi faqat tekshirilgan foydalanuvchi/admin yubora oladi.)
    // 🔑 SERVER-AUTHORITATIVE AUTH KREDENTIALI.
    //    Telegram ichida — initData (Worker HMAC bilan tekshiradi).
    //    Brauzer/APK — Firebase anonim foydalanuvchisining ID tokeni.
    //    Worker /order-commit, /order-status, / (proxy) va boshqalar shu
    //    kredentialni talab qiladi (yangi database.rules.json + Worker).
    // ⏱ Telegram initData Worker'da faqat 1 soat qabul qilinadi
    //    (TELEGRAM_INIT_MAX_AGE). Ilova uzoq ochiq tursa (masalan admin
    //    kun bo'yi ochib qo'ysa) initData eskiradi va HAR buyurtma / holat
    //    o'zgarishi "initData eskirgan" (401) bilan yiqilardi. Firebase
    //    idToken esa SDK tomonidan avtomatik yangilanadi — eskirgan
    //    initData o'rniga shuni yuboramiz.
    window._initDataAgeSec = function () {
        try {
            if (typeof tg === 'undefined' || !tg.initData) return Infinity;
            var ad = parseInt(new URLSearchParams(tg.initData).get('auth_date') || '0', 10);
            if (!ad) return Infinity;
            return Math.floor(Date.now() / 1000) - ad;
        } catch (e) { return Infinity; }
    };
    window._authCred = async function (opts) {
        var preferToken = !!(opts && opts.preferToken);
        var hasInit = false;
        try { hasInit = (typeof tg !== 'undefined' && !!tg.initData); } catch (e) {}
        var fresh = hasInit && window._initDataAgeSec() < 50 * 60;
        if (hasInit && fresh && !preferToken) return { initData: tg.initData };
        try {
            var u = (window.firebase && firebase.auth) ? firebase.auth().currentUser : null;
            if (u) return { idToken: await u.getIdToken(preferToken) };
        } catch (e) {}
        // Token yo'q — hech bo'lmasa initData (Worker aniq sababini aytadi).
        if (hasInit) return { initData: tg.initData };
        return null;
    };
    // 🛰 Worker'ga xavfsiz POST: kredential qo'shadi; 401 bo'lsa (eskirgan
    //    initData / muddati o'tgan token) BIR MARTA yangi Firebase idToken
    //    bilan qayta uradi. { resp, data } qaytaradi; tarmoq xatosida throw.
    window._workerPost = async function (path, body) {
        try { if (window._ensureAuth) await window._ensureAuth(); } catch (e) {}
        var send = async function (cred) {
            var b = Object.assign({}, body || {});
            delete b.initData; delete b.idToken;
            if (cred && cred.initData) b.initData = cred.initData;
            else if (cred && cred.idToken) b.idToken = cred.idToken;
            var resp = await fetch(TG_PROXY + path, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(b)
            });
            var data = await resp.json().catch(function () { return null; });
            return { resp: resp, data: data, cred: cred };
        };
        var cred = await window._authCred();
        if (!cred) return { resp: { ok: false, status: 401 }, data: { ok: false, error: 'auth' }, cred: null };
        var r = await send(cred);
        if (r.resp.status === 401) {
            var again = await window._authCred({ preferToken: true });
            if (again && again.idToken) r = await send(again);
        }
        return r;
    };
    // 📨 Xabarlarni ALOHIDA so'rovda turtish (Worker notifyMode:"split").
    //    Cloudflare bepul rejasida bitta so'rovga atigi 50 ta tashqi so'rov:
    //    buyurtma yozish shu limitning katta qismini olgani uchun xabarlar
    //    1.5-2.5 daqiqa kechikar yoki mijozga IKKI marta ketardi. Endi javob
    //    kelishi bilan shu chaqiriladi va Worker xabarlarni yangi so'rovda
    //    (to'liq limit bilan) yuboradi. `keepalive` — Telegram oynasi darhol
    //    yopilsa ham so'rov yetib boradi. Yiqilsa bir marta qayta uradi;
    //    baribir yetmasa bot watchdog ~1.5 daqiqada yuboradi (yo'qolmaydi).
    window._a1OrderDeliver = function (outboxKey) {
        if (!outboxKey || typeof outboxKey !== 'string') return Promise.resolve(false);
        var post = function (cred) {
            var b = { outboxKey: outboxKey };
            if (cred && cred.initData) b.initData = cred.initData;
            else if (cred && cred.idToken) b.idToken = cred.idToken;
            else return Promise.resolve({ status: 401 });
            return fetch(TG_PROXY + '/order-deliver', {
                method: 'POST', keepalive: true,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(b)
            }).then(function (r) { return { status: r.status }; }, function () { return { status: 0 }; });
        };
        var attempt = function (n, preferToken) {
            return Promise.resolve(window._authCred ? window._authCred(preferToken ? { preferToken: true } : null) : null)
                .catch(function () { return null; })
                .then(post)
                .then(function (r) {
                    if (r.status >= 200 && r.status < 300) return true;
                    if (n >= 1 || (r.status >= 400 && r.status < 500 && r.status !== 401 && r.status !== 429)) return false;
                    return new Promise(function (res) { setTimeout(res, 2500); })
                        .then(function () { return attempt(n + 1, r.status === 401); });
                });
        };
        return attempt(0, false);
    };
    // 🔐 Auth kafolati: Worker chaqiruvi / DB yozuvidan OLDIN chaqiriladi.
    //    Telegram — custom token (window._authReady kutiladi).
    //    Brauzer/APK — anonim kirish (barqaror uid, LOCAL persistence).
    //    Firebase user obyektini (yoki null) qaytaradi.
    // ⏳ Firebase saqlangan sessiyani (LOCAL persistence) ASINXRON tiklaydi.
    //    Sahifa ochilishi bilan `currentUser` hali null bo'ladi — shu paytda
    //    signInAnonymously() chaqirilsa, telefon+parol bilan kirgan mijoz
    //    yangi anonim hisobga almashib ketardi. Shuning uchun avval kutamiz.
    window._authSettled = function () {
        if (window.__authSettledP) return window.__authSettledP;
        window.__authSettledP = new Promise(function (res) {
            try {
                var un = firebase.auth().onAuthStateChanged(function (u) { try { un(); } catch (e) {} res(u || null); });
            } catch (e) { res(null); }
            setTimeout(function () { res(null); }, 4000);
        });
        return window.__authSettledP;
    };
    window._ensureAuth = async function () {
        try {
            if (!(window.firebase && firebase.auth)) return null;
            if (!firebase.auth().currentUser) { try { await window._authSettled(); } catch (e) {} }
            var cur = firebase.auth().currentUser;
            if (cur) return cur;
            if (typeof tg !== 'undefined' && tg.initData) {
                try { await window._authReady; } catch (e) {}
                return firebase.auth().currentUser;
            }
            if (typeof firebase.auth().signInAnonymously === 'function') {
                try { await firebase.auth().signInAnonymously(); } catch (e) {}
            }
            return firebase.auth().currentUser;
        } catch (e) {
            try { return (window.firebase && firebase.auth) ? firebase.auth().currentUser : null; } catch (e2) { return null; }
        }
    };
    // 📨 Telegram proxy'ga xabar yuborish — Worker auth tekshirishi uchun kredential qo'shamiz.
    //    (Ochiq proxy yopildi: endi faqat tekshirilgan foydalanuvchi/admin yubora oladi.
    //     initData bo'lmasa anonim Firebase ID token yuboriladi.)
    //    Async: avval kredential hal qilinadi, keyin fetch qaytariladi — mavjud
    //    `await tgProxySend(...)` va `.then/.catch` chaqiruvchilar ishlayveradi.
    async function tgProxySend(payload){
        try {
            var _cred = window._authCred ? await window._authCred() : null;
            if (_cred && _cred.initData) payload.initData = _cred.initData;
            else if (_cred && _cred.idToken) payload.idToken = _cred.idToken;
            else if (typeof tg !== 'undefined' && tg.initData) payload.initData = tg.initData;
        } catch(e){}
        return fetch(TG_PROXY, { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify(payload) });
    }
    window.tgProxySend = tgProxySend;
    // 📦 Stokni XAVFSIZ kamaytirish — ZAXIRA (fallback) yo'li.
    //    ASOSIY yo'l endi serverda: Worker `/stock-commit` (izohni fayl oxiridagi
    //    "QATLAM 2026.16" qatlamida o'qing). Bu funksiya faqat Worker yangilanmagan
    //    yoki internet uzilgan holatda ishlaydi.
    //
    //    Bu yerda TUZATILGAN ikki jiddiy xato:
    //      1) MANZIL INDEKS bo'yicha edi (`products/{idx}/stock`). Admin mahsulot
    //         o'chirsa/qo'shsa indekslar suriladi va BOSHQA tovarning stoki
    //         kamayardi. Endi manzil har safar mahsulot `id`si bo'yicha QAYTA
    //         topiladi.
    //      2) `fallback` — sahifa yuklanganda o'qilgan ESKI stok qiymati edi.
    //         Transaction ichida `cur` bo'lmasa u qiymat qayta tiklanardi, ya'ni
    //         boshqalar sotgan tovarlar "omborga qaytardi". Endi ishlatilmaydi.
    //    changes: [{ id, size?, qty, idx?, sizeIdx?, name? }]
    function _decrementStock(changes){
        if (!Array.isArray(changes) || !changes.length) return Promise.resolve(false);
        // Manzilni ANIQLASH uchun `products` tugunini bir marta yangi holatda o'qiymiz.
        var fresh = null;
        return db.ref('products').once('value')
            .then(function(snap){ fresh = snap.val(); })
            .catch(function(e){ _dwarn('[stock] products o\'qilmadi, indeksga qaytamiz:', e); })
            .then(function(){
                var jobs = changes.map(function(ch){
                    try {
                        var loc = _resolveStockPath(fresh, ch);
                        if (!loc) return Promise.resolve(false);
                        return db.ref(loc).transaction(function(cur){
                            // `cur` yo'q bo'lsa — bu tugunni o'zimiz yaratmaymiz:
                            // eski (yuklanish vaqtidagi) qiymatni tiklash sotilgan
                            // tovarni "qaytarib" qo'yardi.
                            if (typeof cur !== 'number') return cur;
                            var nv = cur - (parseInt(ch.qty) || 0);
                            return nv < 0 ? 0 : nv;
                        }).then(function(res){
                            return !!(res && res.committed);
                        }).catch(function(e){
                            _dwarn('[stock] transaction rad etildi:', loc, e);
                            return false;
                        });
                    } catch(e){ _dwarn('[stock] update xato:', e); return Promise.resolve(false); }
                });
                return Promise.all(jobs).then(function(r){
                    return r.some(function(x){ return x === true; });
                });
            });
    }
    // Mahsulot `id`si bo'yicha DB dagi haqiqiy yozish manzilini topadi.
    // `fresh` o'qilmagan bo'lsa — oxirgi chora sifatida eski indeksga qaytadi.
    function _resolveStockPath(fresh, ch){
        var key = null, node = null;
        if (fresh) {
            var keys = Array.isArray(fresh)
                ? fresh.map(function(_, i){ return String(i); })
                : Object.keys(fresh);
            for (var i = 0; i < keys.length; i++) {
                var v = fresh[keys[i]];
                if (v && String(v.id) === String(ch.id)) { key = keys[i]; node = v; break; }
            }
        }
        if (key === null) {
            if (ch.idx == null || ch.idx < 0) return null;
            key = String(ch.idx);
            return (ch.sizeIdx != null && ch.sizeIdx >= 0)
                ? 'products/' + key + '/sizes/' + ch.sizeIdx + '/stock'
                : 'products/' + key + '/stock';
        }
        var wantSize = (ch.size != null) ? String(ch.size) : '';
        if (wantSize && wantSize !== 'Universal' && node && node.sizes) {
            var sKeys = Array.isArray(node.sizes)
                ? node.sizes.map(function(_, i){ return String(i); })
                : Object.keys(node.sizes);
            for (var j = 0; j < sKeys.length; j++) {
                var s = node.sizes[sKeys[j]];
                if (s && String(s.size) === wantSize) {
                    return 'products/' + key + '/sizes/' + sKeys[j] + '/stock';
                }
            }
        }
        return 'products/' + key + '/stock';
    }
    window._decrementStock = _decrementStock;
    window._resolveStockPath = _resolveStockPath;

    // =====================================
    // 🎨 IKONKA TIZIMI (emoji o'rniga bitta SVG to'plami)
    // Maqsad: har telefonda BIR XIL, premium ko'rinish (emoji turlicha render bo'ladi).
    // SVG'lar currentColor oladi — joylashgan elementning rangiga moslashadi.
    // =====================================
    var ICONS = {
        flame:   'M13.5.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8C20 8.61 17.41 3.8 13.5.67zM11.71 19c-1.78 0-3.22-1.4-3.22-3.14 0-1.62 1.05-2.76 2.81-3.12 1.77-.36 3.6-1.21 4.62-2.58.39 1.29.59 2.65.59 4.04 0 2.65-2.15 4.8-4.8 4.8z',
        sparkle: 'M12 2l2.4 5.6L20 10l-5.6 2.4L12 18l-2.4-5.6L4 10l5.6-2.4z',
        star:    'M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z',
        check:   'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z',
        truck:   'M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9l1.96 2.5H17V9.5h2.5zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z',
        flag:    'M14.4 6L14 4H5v17h2v-7h5.6l.4 2h7V6z',
        clock:   'M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z',
        cancel:  'M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z',
        scale:   'M9.01 14H2v2h7.01v3L13 15l-3.99-4v3zm5.98-1v-3H22V8h-7.01V5L11 9l3.99 4z',
        box:     'M20 2H4c-1 0-2 .9-2 2v3.01c0 .72.43 1.34 1 1.69V20c0 1.1 1.1 2 2 2h14c.9 0 2-.9 2-2V8.7c.57-.35 1-.97 1-1.69V4c0-1.1-1-2-2-2zm-5 12H9v-2h6v2zm5-7H4V4h16v3z',
        car:     'M18.92 5.01C18.72 4.42 18.16 4 17.5 4h-11c-.66 0-1.21.42-1.42 1.01L3 11v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 15c-.83 0-1.5-.67-1.5-1.5S5.67 12 6.5 12s1.5.67 1.5 1.5S7.33 15 6.5 15zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 10l1.5-4.5h11L19 10H5z',
        tools:   'M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z',
        gear:    'M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.49-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z',
        pin:     'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z',
        card:    'M20 4H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z',
        phone:   'M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.18z',
        chat:    'M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z',
        heart:   'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z',
        gift:    'M20 6h-2.18c.11-.31.18-.65.18-1 0-1.66-1.34-3-3-3-1.05 0-1.96.54-2.5 1.35l-.5.67-.5-.68C10.96 2.54 10.05 2 9 2 7.34 2 6 3.34 6 5c0 .35.07.69.18 1H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-5-2c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zM9 4c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm11 15H4v-2h16v2zm0-5H4V8h5.08L7 10.83 8.62 12 11 8.76l1-1.36 1 1.36L15.38 12 17 10.83 14.92 8H20v6z',
        bell:    'M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z',
        trash:   'M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z',
        edit:    'M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z',
        share:   'M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z',
        megaphone:'M18 11v2h4v-2h-4zm-2 6.61c.96.71 2.21 1.65 3.2 2.39.4-.53.8-1.07 1.2-1.6-.99-.74-2.24-1.68-3.2-2.4-.4.54-.8 1.08-1.2 1.61zM20.4 5.6c-.4-.53-.8-1.07-1.2-1.6-.99.74-2.24 1.68-3.2 2.4.4.53.8 1.07 1.2 1.6.96-.72 2.21-1.65 3.2-2.4zM4 9c-1.1 0-2 .9-2 2v2c0 1.1.9 2 2 2h1v4h2v-4h1l5 3V6L8 9H4zm11.5 3c0-1.33-.58-2.53-1.5-3.35v6.69c.92-.81 1.5-2.01 1.5-3.34z',
        shield:  'M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z',
        bolt:    'M7 2v11h3v9l7-12h-4l4-8z',
        arrow:   'M10 17l5-5-5-5v10z',
        search:  'M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z',
        user:    'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z',
        chart:   'M3.5 18.49l6-6.01 4 4L22 6.92l-1.41-1.41-7.09 7.97-4-4L2 16.99z',
        rocket:  'M12 2.5s4.5 2.04 4.5 10.5c0 2.49-1.04 5.57-1.6 7H9.1c-.56-1.43-1.6-4.51-1.6-7C7.5 4.54 12 2.5 12 2.5zm0 9.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm-5.5 8s-.5-2.5 1.5-4l1.5 1.5L8 21l-1.5-.5zm11 0L16 21l-1.5-2 1.5-1.5c2 1.5 1.5 4 1.5 4z',
        diamond: 'M6 2l-4 6 10 14L22 8l-4-6H6zm.5 2h11L20 8H4l2.5-4z',
        warning: 'M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z',
        lock:    'M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM9 6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9V6zm3 11c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z',
        users:   'M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z',
        camera:  'M9 2l-1.83 2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2h-3.17L15 2H9zm3 15c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.65 0-3 1.35-3 3s1.35 3 3 3 3-1.35 3-3-1.35-3-3-3z',
        moon:    'M12 3a9 9 0 1 0 9 9c0-.46-.04-.92-.1-1.36a5.39 5.39 0 0 1-7.54-7.54C12.92 3.04 12.46 3 12 3z',
        sun:     'M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58a.996.996 0 0 0-1.41 0 .996.996 0 0 0 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37a.996.996 0 0 0-1.41 0 .996.996 0 0 0 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0a.996.996 0 0 0 0-1.41l-1.06-1.06zm1.06-10.96a.996.996 0 0 0 0-1.41.996.996 0 0 0-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06zM7.05 18.36a.996.996 0 0 0 0-1.41.996.996 0 0 0-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06z'
    };
    function icon(name) {
        var p = ICONS[name];
        if (!p) return '';
        return '<svg class="ico" viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden="true"><path d="' + p + '"/></svg>';
    }
    window.icon = icon;

    // =====================================
    // 🖼️ RASM OPTIMIZATSIYASI (eng katta perf yutug'i)
    // ImgBB to'liq o'lchamli (multi-MB) rasm saqlaydi — karta atigi ~180px.
    // images.weserv.nl (bepul CDN proxy) orqali rasmni KERAKLI o'lchamga
    // resize qilamiz + webp + sifat 80%. Bazaga TEGMAYDI (faqat ko'rsatishda).
    // Natija: rasm hajmi 10-30x kichrayadi -> yuklash/dekod tez, qotish yo'q.
    // =====================================
    function _thumb(url, w) {
        try {
            if (!url || typeof url !== 'string') return url;
            // data:, blob:, allaqachon weserv, yoki placeholder bo'lsa — tegmaymiz
            if (url.indexOf('data:') === 0 || url.indexOf('blob:') === 0) return url;
            if (url.indexOf('images.weserv.nl') !== -1) return url;
            if (url.indexOf('http') !== 0) return url;
            // ⚡ Zaif telefonda (haqiqiy lite) rasmlarni KICHIKROQ so'raymiz:
            //    DPR=1 (retina 2x emas) + kenglik ~28% kam -> bayt va dekod
            //    yuki sezilarli pasayadi -> yuklanish silliq, qotish kamayadi.
            var weak = false;
            try { weak = !!window.__perfLite; } catch (e) {}
            var dprCap = weak ? 1 : 2;
            // DPR'ni hisobga olamiz (retina), lekin 2x bilan cheklaymiz (juda katta bo'lmasin)
            var dpr = Math.min(dprCap, Math.max(1, Math.round(window.devicePixelRatio || 1)));
            var baseW = w || 400;
            if (weak) baseW = Math.round(baseW * 0.72);
            var tw = Math.round(baseW * dpr);
            var clean = url.replace(/^https?:\/\//, '');
            return 'https://images.weserv.nl/?url=' + encodeURIComponent(clean) +
                   '&w=' + tw + '&output=webp&q=' + (weak ? 72 : 80) + '&we';
        } catch (e) { return url; }
    }
    window._thumb = _thumb;
    // 🛡 ImgBB "SERVICE UNAVAILABLE" RASMI MUAMMOSI
    //    i.ibb.co xato bo'lganda (ishlamay qolsa, 404/503) xato o'rniga O'Z
    //    reklama rasmini ("imgbb.com service unavailable") qaytaradi. Brauzer
    //    uni oddiy rasm sifatida chizadi — `onerror` ishlamaydi va tovar rasmi
    //    o'rnida ImgBB yozuvi turib qoladi. Shuning uchun i.ibb.co manzili
    //    brauzerga HECH QACHON to'g'ridan-to'g'ri berilmaydi: Worker `/img`
    //    orqali o'tadi. Worker faqat HAQIQIY rasmni (200 + rasm baytlari)
    //    qaytaradi, aks holda xato beradi -> onerror -> brend placeholder.
    function _isImgbb(url) {
        return typeof url === 'string' && /^https?:\/\/(i|image)\.ibb\.co\//i.test(url);
    }
    function _safeImg(url) {
        try {
            if (!_isImgbb(url) || !window.TG_PROXY) return url;
            return window.TG_PROXY + '/img?u=' + encodeURIComponent(url.replace(/^http:/i, 'https:'));
        } catch (e) { return url; }
    }
    window._isImgbb = _isImgbb;
    window._safeImg = _safeImg;
    // Rasm yuklanmasa: avval ORIGINAL (data-full; ImgBB bo'lsa Worker orqali
    // tekshirilgan nusxa) ga, u ham bo'lmasa brend placeholder
    function _imgFallback(img) {
        try {
            if (!img) return;
            var full = img.getAttribute('data-full');
            if (full && img.getAttribute('data-tried-full') !== '1') {
                img.setAttribute('data-tried-full', '1');
                var next = _safeImg(full);
                if (next && img.src !== next) { img.src = next; return; }
            }
            img.onerror = null;
            img.src = window._brandPlaceholder ? window._brandPlaceholder('A1') : '';
        } catch (e) {}
    }
    window._imgFallback = _imgFallback;

    // =====================================
    // 🔐 FIREBASE AUTH (Telegram initData -> custom token)
    // =====================================
    // Worker (/auth) initData'ni HMAC bilan tekshirib, Firebase custom token
    // qaytaradi. So'ng signInWithCustomToken bilan auth.uid = Telegram ID bo'ladi.
    //
    // ⚠️ MUHIM: Hozircha bu "best-effort" (fonda) ishlaydi — agar Worker /auth
    // hali deploy qilinmagan yoki Secret'lar sozlanmagan bo'lsa, ilova AVVALGIDEK
    // ishlashda davom etadi (DB qoidalari hali ochiq). Auth barqaror ishlay
    // boshlagachgina database.rules.json ni Firebase Console'ga qo'ying.
    // O'sha paytda DB o'qishni window._authReady ni kutadigan qilib o'zgartiring.
    window._authReady = (async function signInToFirebase() {
        // ⏱️ TARMOQ QOTIB QOLMASLIGI UCHUN — MUHIM!
        // `fetch()` ning O'ZIDA timeout YO'Q. Agar Worker (/auth) javob
        // bermay «osilib» qolsa, bu promise ABADIY hal bo'lmaydi. Pastda
        // `initUserData()` aynan shu promise'ni `await` qiladi — ya'ni
        // savat, buyurtmalar, profil — HAMMASI yuklanmay qoladi va admin
        // panelda «Tekshirilmoqda…» abadiy turadi. Shuning uchun har bir
        // urinishga qat'iy vaqt chegarasi qo'yamiz.
        function fetchWithTimeout(url, opts, ms) {
            return new Promise(function (resolve, reject) {
                var done = false, ctl = null;
                try {
                    if (typeof AbortController !== 'undefined') ctl = new AbortController();
                } catch (e) {}
                var timer = setTimeout(function () {
                    if (done) return;
                    done = true;
                    try { if (ctl) ctl.abort(); } catch (e) {}
                    reject(new Error('auth-timeout'));
                }, ms);
                var o = {};
                for (var k in opts) {
                    if (Object.prototype.hasOwnProperty.call(opts, k)) o[k] = opts[k];
                }
                if (ctl) o.signal = ctl.signal;
                fetch(url, o).then(function (r) {
                    if (done) return;
                    done = true; clearTimeout(timer); resolve(r);
                }, function (e) {
                    if (done) return;
                    done = true; clearTimeout(timer); reject(e);
                });
            });
        }

        async function attempt() {
            if (!firebase.auth) return false;
            if (firebase.auth().currentUser) return true;

            var initData = (tg && tg.initData) ? tg.initData : "";
            if (!initData) return false;

            var res = await fetchWithTimeout(TG_PROXY + '/auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ initData: initData })
            }, 5000);
            var data = await res.json();
            if (!data || !data.ok || !data.token) return false;

            await firebase.auth().signInWithCustomToken(data.token);
            return true;
        }
        // initData yo'q bo'lsa (brauzer/APK) — Telegram custom token yo'q.
        // Buning o'rniga ANONIM Firebase kirish qilamiz, shunda brauzer/APK
        // mijozi ham HAQIQIY auth.uid oladi (yangi qoidalar auth.uid ni talab
        // qiladi). Anonim kirish tarmoq so'rovi yubormaydi (Worker /auth EMAS)
        // va SDK mavjud bo'lmasa jimgina o'tkazib yuboriladi. `_authReady`
        // qiymati baribir `false` bo'ladi — u faqat TELEGRAM admin auth'ini
        // bildiradi; anonim kirish alohida (window._ensureAuth) boshqariladi.
        if (!(tg && tg.initData)) {
            try { await window._authSettled(); } catch (e) {}
            try {
                if (firebase.auth && firebase.auth().currentUser == null &&
                    typeof firebase.auth().signInAnonymously === 'function') {
                    await firebase.auth().signInAnonymously();
                }
            } catch (e) {}
            try { return await attempt(); } catch (e) { return false; }
        }
        // Telegram ichida: vaqtinchalik tarmoq uzilishiga qarshi 1 marta qayta urinamiz.
        for (var i = 0; i < 2; i++) {
            try {
                if (await attempt()) return true;
            } catch (e) {}
            if (i === 0) { await new Promise(function (r) { setTimeout(r, 1200); }); }
        }
        return false;
    })();

    // 🛡️ OXIRGI KAFOLAT (fail-safe).
    // Yuqoridagi har bir `fetch` chegaralangan, ammo `signInWithCustomToken`
    // yoki Firebase SDK ham kechikishi mumkin. `initUserData()` bu promise'ni
    // kutadi — demak u HAR QANDAY holatda hal bo'lishi SHART. 12 sekunddan
    // keyin «auth bo'lmadi» deb davom etamiz: ilova ochiladi, mijoz tovarlarni
    // ko'radi, admin panelda esa sabab qizil yozuv bilan ko'rsatiladi.
    window._authReady = Promise.race([
        window._authReady,
        new Promise(function (r) { setTimeout(function () { r(false); }, 12000); })
    ]);

    // 🆕 YANGI MIJOZ HODISASI — faqat Worker orqali, server-authoritative.
    // Endpoint auth.uid'dan deterministic marker yaratadi; app qayta ochilishi,
    // retry yoki parallel tab Telegram/Mini App xabarini takrorlamaydi.
    window._registerCustomerOnce = async function (profile) {
        try {
            var payload = { profile: profile || {} };
            if (tg && tg.initData) {
                payload.initData = tg.initData;
            } else {
                if (window._ensureAuth) await window._ensureAuth();
                var authUser = firebase.auth && firebase.auth().currentUser;
                if (!authUser || typeof authUser.getIdToken !== 'function') return false;
                payload.idToken = await authUser.getIdToken();
            }
            var ctl = null;
            try { if (typeof AbortController !== 'undefined') ctl = new AbortController(); } catch (e) {}
            var timer = ctl ? setTimeout(function () { try { ctl.abort(); } catch (e) {} }, 8000) : null;
            var response;
            try {
                var requestPromise = fetch(TG_PROXY + '/customer-register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                    signal: ctl ? ctl.signal : undefined
                });
                response = await requestPromise;
            } finally {
                if (timer) clearTimeout(timer);
            }
            if (!response.ok) {
                if (window._dwarn) window._dwarn('[customer-register] Worker rad etdi:', response.status);
                return false;
            }
            var result = await response.json();
            var completed = !!(result && result.ok);
            if (completed && !(tg && tg.initData)) {
                try {
                    var pending = JSON.parse(localStorage.getItem('avto_registration_pending') || 'null');
                    if (pending && authUser && String(pending.uid) === String(authUser.uid)) {
                        localStorage.removeItem('avto_registration_pending');
                    }
                } catch (e) {}
            }
            return completed;
        } catch (e) {
            if (window._dwarn) window._dwarn('[customer-register] xato:', e);
            return false;
        }
    };

    // =====================================
    // 🔐 ADMIN TEKSHIRUVI (himoya darajasi: defense-in-depth)
    // =====================================
    // Imkon bo'lsa — TASDIQLANGAN auth.uid bo'yicha (haqiqiy chegara baribir
    // Firebase rules'da: faqat admins/{uid}==true yoza/o'qiy oladi). Auth hali
    // tayyor bo'lmaganda (yoki APK/brauzer) — kosmetik fallback (currentUser).
    // Shu sababli ADMIN_IDS ni brauzerda "soxtalashtirish" tugmalarni ko'rsatishi
    // mumkin, ammo qoidalar yoqilgach DB amallari baribir rad etiladi.
    window.isAdmin = function () {
        try {
            var adminStr = ADMIN_IDS.map(String);
            var au = (window.firebase && firebase.auth && firebase.auth().currentUser)
                ? String(firebase.auth().currentUser.uid) : null;
            if (au) return adminStr.indexOf(au) !== -1;
            return adminStr.indexOf(String(window.currentUser)) !== -1
                || adminStr.indexOf(String(parseInt(window.currentUser))) !== -1;
        } catch (e) {
            return ADMIN_IDS.indexOf(parseInt(window.currentUser)) !== -1;
        }
    };

    // ⚡️ TELEGRAM PREMIUM HAPTIC (VIBRATSIYA) TIZIMI
    // Endi window._hap orqali yo'naltiriladi: Telegram ichida native haptic,
    // brauzer/APK'da esa navigator.vibrate ZAXIRASI ishlaydi (xato bermaydi).
const Haptics = {
    light:     () => { try { window._hap && window._hap('light'); } catch (e) {} }, // Mayin (tugma uchun)
    medium:    () => { try { window._hap && window._hap('medium'); } catch (e) {} }, // O'rtacha (savat uchun)
    success:   () => { try { window._hap && window._hap('success'); } catch (e) {} }, // Zo'r (xarid uchun)
    warning:   () => { try { window._hap && window._hap('warning'); } catch (e) {} }, // Ogohlantirish
    selection: () => { try { window._hap && window._hap('selection'); } catch (e) {} } // Menyu almashganda
};

    
    // =====================================
    // 🧠 1. MIJOZNI DASTLABKI TANISH (Kutmasdan darhol o'qiydi)
    // =====================================
    let tgUser = (tg.initDataUnsafe && tg.initDataUnsafe.user) ? tg.initDataUnsafe.user : null;
    const urlParams = new URLSearchParams(window.location.search);
    let urlName = urlParams.get('name') ? decodeURIComponent(urlParams.get('name')) : null;
    let urlPhone = urlParams.get('phone') ? decodeURIComponent(urlParams.get('phone')) : "";
    let botRegion = urlParams.get('region') ? decodeURIComponent(urlParams.get('region')) : "Noma'lum";

    let userName = "Mijoz";
    let isFromTelegram = false;

    if (tgUser) {
        window.currentUser = parseInt(tgUser.id);
        userName = tgUser.first_name || "Mijoz";
        isFromTelegram = true;
    } else if (urlName) {
        window.currentUser = "tg_url_" + Date.now();
        userName = urlName;
        isFromTelegram = true;
    } else {
        let savedUser = localStorage.getItem('avto_a1_user');
        if (savedUser) {
            try {
                let parsed = JSON.parse(savedUser);
                window.currentUser = parsed.id;
                userName = parsed.name || "Mijoz";
                urlPhone = parsed.phone || "";
            } catch(e) { localStorage.removeItem('avto_a1_user'); }
        }
    }

    // =====================================
    // 📦 2. BAZA VA O'ZGARUVCHILAR
    // =====================================
    let cart = {}; try { cart = JSON.parse(localStorage.getItem('avto_cart')) || {}; } catch(e) { localStorage.removeItem('avto_cart'); }
    let productsDB = [], displayDB = [], historyStack = ['main-menu'], activeModal = null, searchActive = false, myOrders = [], wishlist = [], isDataLoaded = false;
    let myProfile = { name: userName, phone: urlPhone, address: botRegion !== "Noma'lum" ? botRegion : "" };

    // =====================================
    // 🔐 3. EKRANNI (LOGIN) SOZLASh
    // =====================================
    function checkUserLogin() {
        let loginScreen = document.getElementById('login-screen');
        if (!loginScreen) return;
        
        if (window.currentUser) {
            loginScreen.classList.add('hidden');
            initUserData(); // Login bor, srazi bazani o'qishga ruxsat beramiz
        } else {
            loginScreen.classList.remove('hidden');
        }
        updateProfileUI();
    }

    window._manualLoginLegacy = function() {
        let nameEl = document.getElementById('login-name');
        let phoneEl = document.getElementById('login-phone');
        let nameVal = nameEl.value.trim();
        let phoneVal = phoneEl.value.trim();
        // Faqat raqamlar (+998 dan keyin 9 ta = O'zbekiston mobil raqami)
        let digits = phoneVal.replace(/[^0-9]/g, '');

        // 🧈 9/9: qo'pol toast o'rniga maydon ostida yumshoq xatolik
        let ok = true;
        if (window._loginSetErr) {
            if (!nameVal) { window._loginSetErr('login-name', "Ismingizni kiriting"); ok = false; }
            // 998 + 9 raqam = 12 ta raqam
            if (digits.length < 12) { window._loginSetErr('login-phone', "To'liq raqam kiriting: +998 90 123 45 67"); ok = false; }
        } else if (!nameVal || digits.length < 12) {
            ok = false;
        }
        if (!ok) {
            try { Haptics.warning(); } catch(e) {}
            // Birinchi xato maydonga fokus
            if (!nameVal) nameEl.focus(); else phoneEl.focus();
            return;
        }

        // Tugma "yuklanmoqda" holatiga o'tadi (ikki marta bosishning oldini oladi)
        let btn = document.getElementById('login-submit-btn');
        if (btn) { if (btn.dataset.busy === '1') return; btn.dataset.busy = '1'; btn.classList.add('is-loading'); btn.textContent = 'Kirilmoqda...'; }

        let fakeId = "apk_" + digits;
        window.currentUser = fakeId;
        myProfile.name = nameVal;
        myProfile.phone = phoneVal;

        localStorage.setItem('avto_a1_user', JSON.stringify({ id: fakeId, name: nameVal, phone: phoneVal }));

        try { Haptics.success(); } catch(e) {}
        // Kichik kechikish — tugma holati ko'rinib, o'tish silliq bo'ladi
        setTimeout(function(){
            let ls = document.getElementById('login-screen');
            if (ls) ls.classList.add('login-leaving');
            setTimeout(function(){
                if (ls) { ls.classList.add('hidden'); ls.classList.remove('login-leaving'); }
                if (btn) { btn.dataset.busy = '0'; btn.classList.remove('is-loading'); btn.textContent = 'Tizimga kirish'; }
            }, 280);
            // 🆔 ANONIM FIREBASE KIRISH — mijozga HAQIQIY auth.uid beradi (yangi
            //    qoidalar buni talab qiladi). uid o'rnatilgach ism/telefon profilга
            //    yoziladi (egaga ruxsat), so'ng bazani o'qish boshlanadi.
            var _proceed = function (u) {
                if (u && u.uid) window.currentUser = u.uid; else window.currentUser = fakeId;
                if (u && u.uid) {
                    try {
                        localStorage.setItem('avto_registration_pending', JSON.stringify({
                            uid: String(u.uid), name: nameVal, phone: phoneVal
                        }));
                    } catch (e) {}
                }
                // (Oldindan Promise.reject yaratilmaydi — u «ushlanmagan xato» bo'lib chiqardi)
                var _profileWrite = null;
                try {
                    if (typeof db !== 'undefined' && db.ref) {
                        _profileWrite = db.ref('users/' + window.currentUser + '/profile').update({ name: nameVal, phone: phoneVal });
                    }
                } catch (e) { _profileWrite = Promise.reject(e); }
                if (!_profileWrite) _profileWrite = Promise.reject(new Error('Firebase mavjud emas'));
                // Anonymous authning o'zi ro'yxatdan o'tish EMAS. Faqat ism/telefon
                // profili muvaffaqiyatli yozilgandan keyin server hodisasini yaratamiz.
                _profileWrite.then(function () {
                    if (window._registerCustomerOnce) {
                        return window._registerCustomerOnce({ name: nameVal, phone: phoneVal });
                    }
                }).catch(function (e) {
                    if (window._dwarn) window._dwarn('[profil] ro\'yxatdan o\'tish yozilmadi:', e);
                });
                updateProfileUI();
                showToast("Xush kelibsiz, " + nameVal + "!", "success");
                initUserData(); // Mijoz qo'lda kirgandan keyin ruxsat beramiz
            };
            if (window._ensureAuth) {
                window._ensureAuth().then(_proceed, function () { _proceed(null); });
            } else {
                _proceed(null);
            }
        }, 180);
    };

    window._manualLogin_legacy_removed = null;

    // DARHOL TEKSHIRAMIZ
    checkUserLogin();

    // =====================================
    // ⚙️ 4. ADMIN TUGMASI VA FIREBASE YUKLASH
    // =====================================
    async function initUserData() {
        // 1. Admin tekshiruvi (Mijoz topilgandan keyin) — DB kerak emas, darhol
        if (window.isAdmin()) { 
            let adminBtn = document.getElementById('nav-admin'); 
            if(adminBtn) adminBtn.classList.remove('hidden'); 
            let scanBtn = document.getElementById('scanSearchBtn');
            if(scanBtn) scanBtn.classList.remove('hidden');
            // Admin tugmasi qo'shildi => menyu ustunlari 5->6 o'zgardi: kapsulani to'g'rilaymiz
            try { if (window._recalcNavIndicator) window._recalcNavIndicator(60); } catch(e) {}
        }

        // 🔐 DB'ga murojaatdan OLDIN auth tugashini kutamiz.
        // Shunda Firebase rules yoqilganda token tayyor bo'ladi (permission xatosi bo'lmaydi).
        // Auth muvaffaqiyatsiz bo'lsa ham (APK/brauzer) promise hal bo'ladi va davom etadi.
        try { window._authOk = !!(await window._authReady); } catch (e) { window._authOk = false; }

        // 🆔 BRAUZER/APK KIMLIGI = ANONIM FIREBASE UID.
        //    Yangi qoidalar auth.uid === $uid ni talab qiladi. Telegram tashqarisida
        //    (initData yo'q) DB o'qishdan OLDIN anonim uid'ni o'rnatamiz — aks holda
        //    "apk_" / "tg_url_" kabi soxta id'lar bo'yicha yozuvlar rad etilardi.
        try {
            if (!(tg && tg.initData) && window._ensureAuth) {
                var _anonUser = await window._ensureAuth();
                if (_anonUser && _anonUser.uid) window.currentUser = _anonUser.uid;
            }
        } catch (e) {}

        // Manual profil yozilib, Worker vaqtincha ishlamagan bo'lsa pending hodisa
        // Firebase UID bilan saqlanadi va keyingi ochilishlarda tasdiqlanguncha qayta
        // reconcile qilinadi. Endpoint deterministic bo'lgani uchun retry dublikat emas.
        if (!(tg && tg.initData) && window._registerCustomerOnce) {
            try {
                var _pendingReg = JSON.parse(localStorage.getItem('avto_registration_pending') || 'null');
                if (_pendingReg && String(_pendingReg.uid) === String(window.currentUser)) {
                    window._registerCustomerOnce({ name: _pendingReg.name || '', phone: _pendingReg.phone || '' });
                }
            } catch (e) {}
        }

        // 🚨 JIM QOLMASLIK: qoidalar qattiqlashtirilgandan keyin auth ishlamasa
        //    ilova "hech narsa yuklanmadi" holatiga tushadi va SABABI ko'rinmaydi.
        //    Telegram ichidagi foydalanuvchi uchun auth SHART — shuning uchun
        //    muvaffaqiyatsiz bo'lsa ochiq ogohlantirish beramiz (jimgina sinmaydi).
        if (!window._authOk && isFromTelegram && tgUser) {
            if (window._dwarn) window._dwarn('[auth] Firebase auth o\'rnatilmadi — Worker /auth yoki BOT_TOKEN sozlanmagan bo\'lishi mumkin.');
            try {
                showToast("Xavfsiz ulanish o'rnatilmadi — ma'lumotlar saqlanmasligi mumkin. Ilovani qayta ochib ko'ring.", "warning");
            } catch (e) {}
        }

        // Auth tugagach admin tugmasini TASDIQLANGAN identifikator bo'yicha qayta baholaymiz.
        // (Soxta currentUser tugmani ko'rsatgan bo'lsa, auth uid admin bo'lmasa — yashiriladi.)
        try {
            var _adminBtn2 = document.getElementById('nav-admin');
            var _scanBtn2 = document.getElementById('scanSearchBtn');
            var _amAdmin = window.isAdmin();
            if (_adminBtn2) _adminBtn2.classList.toggle('hidden', !_amAdmin);
            if (_scanBtn2) _scanBtn2.classList.toggle('hidden', !_amAdmin);
            // Tugmalar soni o'zgargan bo'lishi mumkin => kapsulani qayta to'g'rilaymiz
            try { if (window._recalcNavIndicator) window._recalcNavIndicator(60); } catch(e) {}
        } catch (e) {}

        // 2. Telegramdagi ma'lumotlarni bazaga yozish
        if (isFromTelegram && tgUser) {
            var _tgProfile = {
                uid: window.currentUser,
                username: tgUser.username ? "@" + tgUser.username : "Yo'q",
                firstName: tgUser.first_name || "",
                lastName: tgUser.last_name || ""
            };
            try {
                // Worker profil yozilishidan OLDIN eski profil bor-yo'qligini
                // tekshiradi. Shu tartib rolloutda mavjud mijozlarni «yangi» deb
                // qayta e'lon qilmaydi; yangi Telegram userda esa profil hali yo'q.
                if (window._registerCustomerOnce) {
                    await window._registerCustomerOnce({
                        name: [tgUser.first_name || '', tgUser.last_name || ''].join(' ').trim(),
                        username: tgUser.username || '',
                        phone: myProfile.phone || ''
                    });
                }
                await db.ref('users/' + window.currentUser + '/profile').update(_tgProfile);
            } catch (e) {
                if (window._dwarn) window._dwarn('[profil] Telegram profili/hodisasi yozilmadi:', e);
                // Notification xatosi profilni saqlashni bloklamasin.
                try { await db.ref('users/' + window.currentUser + '/profile').update(_tgProfile); } catch (_) {}
            }
        }

        // 3. Savat va Tarixni tortib olish
        db.ref('users/' + window.currentUser).on('value', (snap) => {
            if (snap.exists()) {
                let data = snap.val(); 
                cart = data.cart || {}; 
                myOrders = (window._toOrdersArray ? window._toOrdersArray(data.orders) : (data.orders || []));
                wishlist = data.wishlist || [];
                window.myOrders = myOrders; window.wishlist = wishlist; // Phase2 doim yangi ma'lumot o'qishi uchun
                if(data.profile) { myProfile = data.profile; updateProfileUI(); }

                // 🚗📍 MASHINA VA MANZILLARNI SERVERDAN TIKLASH
                // ⚠️ ILGARI: `my_car` va `addresses` faqat localStorage'dan
                //    o'qilardi (localStorage-first). Firebase'ga yozilsa ham,
                //    QAYTA O'QILMASDI. Natijada mijoz boshqa telefondan kirsa
                //    yoki ilova keshini tozalasa — saqlangan mashinasi va
                //    manzillari "Belgilanmagan" bo'lib ko'rinardi (aslida
                //    bazada turardi).
                // ENDI: lokal BO'SH bo'lsagina serverdan tiklaymiz. Shunday
                //    qilib "yangi telefon" holati tuzatiladi, lekin lokal
                //    o'zgarishlar eski server javobi bilan BOSILMAYDI.
                try {
                    if (typeof data.my_car === 'string' && data.my_car &&
                        !localStorage.getItem('avto_my_car')) {
                        localStorage.setItem('avto_my_car', data.my_car);
                        if (typeof window.renderMyCar === 'function') window.renderMyCar();
                    }
                    var _lsAddr = localStorage.getItem('avto_addresses');
                    if (data.addresses && (!_lsAddr || _lsAddr === '[]')) {
                        var _remoteAddr = Array.isArray(data.addresses)
                            ? data.addresses
                            : Object.values(data.addresses);
                        if (_remoteAddr.length) {
                            localStorage.setItem('avto_addresses', JSON.stringify(_remoteAddr));
                            if (typeof window.renderAddresses === 'function') window.renderAddresses();
                        }
                    }
                } catch(e) { _dwarn('[profil] mashina/manzil tiklash xatosi:', e); }

                _updateVipStatus(); // ⭐ VIP holatini buyurtma tarixi bo'yicha yangilash
                try { if (window.Phase2) window.Phase2.sync(data, window.currentUser, window.productsDB || productsDB); } catch(e){ _dwarn('[Phase2] sync xato:', e); }
                
                if(!isDataLoaded) { 
                    updateCartBadge(); 
                    if(activeModal === 'cartModal') renderCartItems(); 
                    if(window._moSectionOpen && window._moSectionOpen()) renderMyOrders(); 
                    isDataLoaded = true; 
                } else {
                    setTimeout(() => {
                        if(window._moSectionOpen && window._moSectionOpen()) renderMyOrders();
                        if(activeModal === 'orderDetailModal' && window._moRefreshDetail) window._moRefreshDetail();
                        if(activeModal === 'orderDetailModal' && typeof renderChatMessages === 'function') renderChatMessages();
                    }, 50);
                }
            }
        });
    }

    // (generateOrderCode o'chirildi — buyurtma kodini endi SERVER beradi.)

    // =====================================================================
    // #5 / #6 — MARKAZIY 'orders' TUGUNI + ADMIN O'QISH KESHI
    // =====================================================================
    // Ilgari web app buyurtmani FAQAT users/{uid}/orders ga yozardi, bot esa
    // markaziy 'orders' tugunini o'qirdi (hech qachon yozilmagani uchun — o'lik
    // kod). Endi har buyurtma markaziy 'orders' ga HAM yoziladi (izolyatsiya
    // qilingan — asosiy buyurtma oqimiga ta'sir qilmaydi). notified_admin=true:
    // web allaqachon adminga to'g'ridan-to'g'ri xabar berdi, shuning uchun bot
    // ikki marta yubormaydi (lekin boshqa manba yozsa — bot uni xabar qiladi).
    window._centralOrderKey = function (uid, o) {
        return String(uid || 'anon') + '_' + String((o && (o.code || o.id)) || Date.now());
    };
    // 🔒 NEUTRALIZED: markaziy `orders` tuguni endi SERVER-OWNED (Worker /order-commit
    //    uni o'zi yozadi). Yangi database.rules.json mijozga bu tugunni yozishga ruxsat
    //    bermaydi — shuning uchun bu funksiya endi HECH NARSA YOZMAYDI (permission-denied
    //    siklining oldini oladi). Signatura saqlanadi (boshqa chaqiruvlar buzilmasin).
    window._mirrorOrderToCentral = function (order, extra) {
        // no-op — server owns central orders
    };

    // 🧾 Buyurtma tarkibini chiroyli matn qilib beradi (mijozga ketadigan xabarlar uchun).
    // itemsMap: { "baseId||carOpt": qty }. Nom/narx productsDB dan olinadi; tovar
    // o'chirilgan bo'lsa ham buyurtma yiqilmaydi (qatorsiz o'tib ketadi).
    window._orderItemsSummary = function (itemsMap) {
        var lines = "";
        var total = 0;
        try {
            var pdb = window.productsDB || [];
            for (var fullId in (itemsMap || {})) {
                var parts = String(fullId).split('||');
                var baseId = parts[0];
                var carOpt = parts[1];
                var qty = itemsMap[fullId] || 0;
                var p = pdb.find(function (x) { return x.id == baseId; });
                var price = p ? (p.price || 0) : 0;
                var sum = price * qty;
                total += sum;
                if (!p) continue; // nomi noma'lum tovarni qatorga qo'shmaymiz
                var nm = p.name;
                if (carOpt && carOpt !== "Universal" && carOpt !== "undefined") nm += ' (' + carOpt + ')';
                lines += "\n\u25AA\uFE0F " + nm + " \u2014 " + qty + " x " + price.toLocaleString() + " = " + sum.toLocaleString() + " so'm";
            }
        } catch (e) {}
        return { lines: lines, total: total };
    };

    // #6: admin panelda stats/orders/customers ketma-ket ochilganda butun users
    // daraxtini qayta-qayta yuklamaslik uchun qisqa muddatli umumiy kesh.
    // Yozuvlardan keyin (holat o'zgartirish) _invalidateUsersCache() chaqiriladi.
    window._usersSnapCache = null;
    window._USERS_CACHE_TTL = 20000; // 20s — navigatsiya "burst"ini dedupe qiladi
    window._getUsersSnap = function () {
        var c = window._usersSnapCache;
        if (c && (Date.now() - c.at) < window._USERS_CACHE_TTL) return Promise.resolve(c.snap);
        return db.ref('users').once('value').then(function (snap) {
            window._usersSnapCache = { at: Date.now(), snap: snap };
            return snap;
        });
    };
    window._invalidateUsersCache = function () { window._usersSnapCache = null; };
    function getStatusHTML(s) { if(s === 'qabul') return '<span class="status-badge st-qabul">' + icon('check') + ' Qabul qildik</span>'; if(s === 'yolda') return '<span class="status-badge st-yolda">' + icon('truck') + ' Yo\'lga chiqdi</span>'; if(s === 'yetkazildi') return '<span class="status-badge st-yetkazildi">' + icon('flag') + ' Yetkazib berildi</span>'; if(s === 'bekor_qilingan') return '<span class="status-badge" style="background:var(--accent-red); color:white;">' + icon('cancel') + ' Bekor qilingan</span>'; return '<span class="status-badge st-kutilmoqda">' + icon('clock') + ' Kutilmoqda</span>'; }
    function updateProfileUI() { let dN = myProfile.name || "Mijoz"; var _und = document.getElementById('user-name-display'); if (_und) _und.innerText = dN; document.getElementById('pf-name').innerText = dN; document.getElementById('pf-avatar').innerText = dN.charAt(0).toUpperCase(); document.getElementById('pf-id').innerText = "ID: " + (window.currentUser || "Noma'lum"); document.getElementById('user-edit-name').value = dN; document.getElementById('user-edit-phone').value = myProfile.phone || ""; if(document.getElementById('user-edit-address')) document.getElementById('user-edit-address').value = myProfile.address || ""; _updateVipStatus(); }

    // ⭐ VIP HOLATI — endi to'liq mantiq `window.VIP` modulida (fayl oxiridagi qatlam).
    // Bu funksiya faqat "ko'prik": buyurtma tarixi o'zgarganda VIP modulini xabardor qiladi.
    //
    // ⚠️ ESKI XATO (tuzatildi): ilgari bu yerda `.profile-header` klassi izlanardi,
    //    lekin profil ekrani inline stil bilan yozilgan — bu klass HECH QAYERDA yo'q.
    //    Natijada `querySelector` doim `null` qaytarib, VIP yorlig'i HECH QACHON
    //    ko'rinmasdi. Endi VIP moduli o'z konteynerini (#vip-card-box) o'zi yasaydi.
    function _updateVipStatus() {
        try {
            // Yangi tizim: daraja (bronze/kumush/oltin/platina) + imtiyozlar + progress
            if (window.VIP && window.VIP.refresh) { window.VIP.refresh(myOrders); return; }
            // Zaxira (qatlam hali yuklanmagan bo'lsa): eski klassni ham qo'llab-quvvatlaymiz
            const header = document.querySelector('.profile-header');
            if (!header || !Array.isArray(myOrders)) return;
            const delivered = myOrders.filter(o => o && o.status === 'yetkazildi');
            const totalSpent = delivered.reduce((s, o) => s + (parseInt(o.total) || 0), 0);
            header.classList.toggle('is-vip', delivered.length >= 5 || totalSpent >= 1000000);
        } catch (e) { /* xato bo'lsa indamasdan o'tib ketamiz - boshqa funksiyalar buzilmasin */ }
    }

    // ⚠️ ILGARI: har bir "+"/"-" bosilganda Firebase'ga darhol yozilardi.
    //    Mijoz sonni 5 marta o'zgartirsa — 5 ta tarmoq yozuvi. Bu (a) trafik
    //    va batareyani yeydi, (b) to'qnashuv oynasini kengaytiradi.
    //    Endi localStorage DARHOL yoziladi (ilova tez javob beradi), Firebase'ga
    //    esa 400ms jimlikdan keyin BIR MARTA yoziladi. Ilova yopilishi mumkin
    //    bo'lgan payt (buyurtma berish) uchun `_flushCart()` bor.
    var _cartFlushTimer = null;
    function _flushCart() {
        if (_cartFlushTimer) { clearTimeout(_cartFlushTimer); _cartFlushTimer = null; }
        if (!currentUser) return Promise.resolve();
        try { return db.ref('users/' + currentUser + '/cart').set(cart); }
        catch (e) { return Promise.resolve(); }
    }
    window._flushCart = _flushCart;
    function saveLocalCart() {
        try { localStorage.setItem('avto_cart', JSON.stringify(cart)); } catch (e) {}
        if (!currentUser) return;
        if (_cartFlushTimer) clearTimeout(_cartFlushTimer);
        _cartFlushTimer = setTimeout(function () { _cartFlushTimer = null; _flushCart(); }, 400);
    }
    function saveLocalWishlist() { if (currentUser) db.ref('users/' + currentUser + '/wishlist').set(wishlist); }

    // ❤️ SAQLANGANLAR (WISHLIST) YANGLANGAN FUNKSIYASI
function toggleWishlist(e, id) {
    if(e) e.stopPropagation();
    
    let idx = wishlist.indexOf(id);
    let btn = e ? e.currentTarget : null; // Bosilgan yurakchani o'zini ushlab olamiz

    if(idx === -1) { 
        wishlist.push(id); 
        showToast("Saqlandi!", "success"); 
        if(btn) { btn.classList.add('active'); if(typeof _burstHeart==='function') _burstHeart(btn); }
        if(typeof _hap==='function') _hap('light');
    } else { 
        wishlist.splice(idx, 1); 
        showToast("O'chirildi", "warning"); 
        if(btn) btn.classList.remove('active');
        if(typeof _hap==='function') _hap('selection');
    }
    
    saveLocalWishlist();
    
    // 🛑 DASTURNI QOTIRADIGAN "renderProducts()" NI O'CHIRIB TASHLADIK
    
    // Agar mijoz aynan "Saqlanganlar" bo'limi ichida turib o'chirsa, o'shanda ro'yxatni yangilaymiz
    if (historyStack[historyStack.length - 1] === 'wishlist-section') {
        renderWishlist(); 
    }
}

    function showWishlist() {
        if(activeModal) closeModal();
        updateNav('nav-wishlist');
        showSection('wishlist-section');
        renderWishlist();
    }

    function renderWishlist() {
        let c = document.getElementById('wishlist-items-container');
        if(wishlist.length === 0) {
            c.innerHTML = `<div style="grid-column: span 2;">` + window._emptyState({
                icon: '<svg viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>',
                title: "Saqlanganlar bo'sh",
                desc: "Yoqqan tovarlarni yurakcha (❤) tugmasi orqali saqlang — keyin shu yerda topasiz.",
                btnText: "Katalogga o'tish",
                btnAction: "showCatalog()"
            }) + `</div>`;
            return;
        }
        let items = wishlist.map(id => productsDB.find(x => x.id === id)).filter(x => x);
        c.innerHTML = items.map(x => cardHTML(x)).join('');
    }
    // 🔒 SERVER-OWNED: buyurtmalar (users/{uid}/orders) endi FAQAT server (Worker)
    //    tomonidan yoziladi. Yangi database.rules.json mijozga bu tugunni yozishga
    //    ruxsat bermaydi — shuning uchun bu funksiya endi REMOTE'ga YOZMAYDI
    //    (aks holda permission-denied siklini keltirib chiqarardi). Faqat lokal
    //    massiv/localStorage yangilanadi (ko'rsatuv uchun). on('value') listener
    //    serverdan haqiqiy holatni o'zi tortadi.
    function saveLocalOrders() {
        try {
            window.myOrders = Array.isArray(myOrders) ? myOrders : [];
            localStorage.setItem('avto_orders_cache', JSON.stringify(window.myOrders));
        } catch (e) {}
        return Promise.resolve(null);
    }
    function saveProfile() {
        let nN = document.getElementById('user-edit-name').value.trim();
        let nP = document.getElementById('user-edit-phone').value.trim();
        let nA = document.getElementById('user-edit-address') ? document.getElementById('user-edit-address').value.trim() : "";
        // 🚗 Mashina ham SHU OYNADAN o'zgartiriladi (ilgari alohida oynada edi)
        let carEl = document.getElementById('user-edit-car');
        let nC = carEl ? String(carEl.value || '').trim() : null;

        if(!nN || !nP) { showToast("Ism va raqamni kiritish shart!", "warning"); return; }
        // 📞 Raqam to'liqligini tekshiramiz (ilgari har qanday matn qabul qilinardi)
        var _pd = nP.replace(/\D/g, '');
        if (_pd.length < 9) {
            showToast("Telefon raqamni to'liq kiriting (masalan: +998 90 123 45 67)", "warning");
            try { var _pf = document.getElementById('user-edit-phone').closest('.pe-f'); if (_pf) _pf.classList.add('is-bad'); } catch(e) {}
            return;
        }
        if (_pd.length === 9) _pd = '998' + _pd;
        if (_pd.indexOf('998') === 0 && _pd.length === 12) nP = '+' + _pd.slice(0,3) + ' ' + _pd.slice(3,5) + ' ' + _pd.slice(5,8) + ' ' + _pd.slice(8,10) + ' ' + _pd.slice(10);

        myProfile.name = nN; myProfile.phone = nP; myProfile.address = nA;
        updateProfileUI();

        // 🚗 Mashinani saqlaymiz (localStorage + Firebase), keyin kartochkani yangilaymiz
        if (nC !== null) {
            try {
                localStorage.setItem('avto_my_car', nC);
                if (currentUser) db.ref('users/' + currentUser + '/my_car').set(nC);
                if (typeof window.renderMyCar === 'function') window.renderMyCar();
            } catch(e) {}
        }

        if (currentUser) {
            // ⚠️ ILGARI `.set(myProfile)` ishlatilardi — bu BUTUN `profile` tugunini
            //    xotiradagi obyekt bilan qayta yozardi. `myProfile` boshlang'ich
            //    holatda faqat {name, phone, address} bo'lgani uchun (7448-qator),
            //    agar Firebase listeneri hali javob bermagan bo'lsa, saqlash
            //    `uid`, `username`, `firstName`, `lastName`, `lang`, `vip` kabi
            //    maydonlarni O'CHIRIB yuborardi (ular 7554-qatorda yozilgan).
            //    Endi `.update()` — faqat uchta maydonni yangilaydi, qolganiga tegmaydi.
            db.ref('users/' + currentUser + '/profile').update({ name: nN, phone: nP, address: nA })
                .then(() => { showToast("Saqlandi!"); closeModal(); })
                .catch(() => { showToast("Saqlanmadi — internetni tekshiring", "warning"); });
        } else { showToast("Saqlandi!"); closeModal(); }
    }
    // 🪟 DYNAMIC ISLAND (XABARNOMA) FUNKSIYASI
function showToast(m, t = 'success') { 
    const c = document.getElementById('toast-container'); 
    const el = document.createElement('div'); 
    el.className = 'toast'; 
    // Muvaffaqiyatli bo'lsa yashil nur, xato bo'lsa sariq/qizil nur taratadi
    let glowColor = t === 'success' ? 'rgba(48,209,88,0.2)' : 'rgba(212,175,55,0.2)';
    el.style.boxShadow = `0 15px 35px rgba(0,0,0,0.5), 0 0 20px ${glowColor}`;
    
    // Ikonkalar ham Dynamic Island uslubida
    let icon = t === 'success' ? '<span style="color:#30d158; filter:drop-shadow(0 0 4px rgba(48,209,88,.55));"><svg class="uic" style="width:16px;height:16px;vertical-align:-3px"><use href="#i-check"></use></svg></span>' : '<span style="color:var(--luxury-gold);"><svg class="uic" style="width:16px;height:16px;vertical-align:-3px"><use href="#i-alert"></use></svg></span>';
    
    // Only the fixed icon markup is HTML; messages may contain untrusted text.
    el.innerHTML = `${icon} <span style="margin-top: 1px;"></span>`;
    el.lastElementChild.textContent = String(m); 
    c.appendChild(el); 
    
    // Animatsiya o'zini yig'ib ketgach, elementni tozalaymiz
    setTimeout(() => el.remove(), 3000); 
}
    const initialProducts = [ { id: 1, name: "Porshen To'plami", car: "Gazel Biznes", brand: "Rossiya", desc: "100% original", price: 1060000, stock: 10, img: "https://i.postimg.cc/zDhCzyyB/gazel.jpg", category: "gazel-biznes-motor", badge: "hot" } ];

// ===================================================
    // 🚀 2 VA 4. GIBRID PAGINATSIYA VA ORQA FON SINXRONIZATSIYASI
    // ===================================================
    window.isDataLoaded = false;

    // 1. Dastur ochilganda BARCHA tovarlarni bir marta yuklaymiz.
    //    ⚠️ Avval faqat limitToLast(30) yuklanardi — bu XAVFLI edi: kod 13 ta joyda
    //    db.ref('products').set(productsDB) qiladi, ya'ni butun bazani xotiradagi
    //    ro'yxat bilan qayta yozadi. Agar 30 tadan ko'p tovar bo'lsa, qolgani
    //    O'CHIB ketardi. Endi hammasi yuklanadi -> .set() xavfsiz.
    //    Ekran tez ochilishi uchun ma'lumot kelgach FAQAT 12 ta chiziladi
    //    (renderProducts), qolgani skrollда 12 talab qo'shiladi.
    // ⚡ CONTENT-AWARE SKELETON ko'rsatish: ma'lumot kelguncha markaziy "gear"
    //    o'rniga MAHSULOT KARTASI SHAKLIDAGI skeletonlarni (allaqachon #home-products
    //    ichida statik turibdi) ko'rsatamiz -> "tezroq" va zamonaviy his beradi.
    //    Ma'lumot kelgach renderProducts() ularni haqiqiy kartalar bilan almashtiradi.
    //    XAVFSIZ: faqat ko'rinishni ochadi, yangi DOM/logika qo'shmaydi.
    (function _showInitialSkeletons(){
        try {
            var hc = document.getElementById('home-products');
            // Skeleton kartalar mavjud bo'lsagina (hali render bo'lmagan) ko'rsatamiz
            if (!hc || !hc.querySelector('.sk-card')) return;
            var lt = document.getElementById('loading-text');
            if (lt) lt.style.display = 'none';
            var ca = document.getElementById('content-area');
            if (ca) ca.classList.remove('hidden');
        } catch (e) {}
    })();
    // ⚡ TEZKOR BIRINCHI CHIZISH — oxirgi katalog telefon xotirasidan.
    //    Firebase javobi kelmasidan OLDIN mijoz allaqachon tovarlarni ko'radi.
    //    Javob kelgach pastdagi `once` hammasini yangi ma'lumot bilan qayta chizadi.
    //
    //    ⚠️ TUZATILDI (2 ta xato):
    //      1) Bu blok `renderProducts()` ni DARHOL chaqirardi. Lekin
    //         `renderProducts` pastda e'lon qilinadigan `limitCount`
    //         o'zgaruvchisiga tayanadi ("let limitCount = 12" — bu qatordan
    //         PASTDA). JavaScript'da o'zgaruvchini e'londan OLDIN ishlatib
    //         bo'lmaydi, shuning uchun chaqiruv xato tashlardi va kesh
    //         JIMGINA chizilmasdan o'tib ketardi — ya'ni butun tezlashtirish
    //         AMALDA ISHLAMASDI. Endi skript to'liq yuklanib bo'lgach
    //         (`setTimeout(…, 0)`) chaqiriladi — o'sha paytda hamma
    //         o'zgaruvchi tayyor bo'ladi.
    //      2) Nazariy poyga: agar Firebase javobi keshdan OLDIN kelib qolsa,
    //         kesh YANGI ma'lumot ustiga eski holatni yozib qo'yardi. Endi
    //         `_catalogFresh` bayrog'i buni butunlay imkonsiz qiladi.
    (function _paintCatalogFromCache() {
        setTimeout(function () {
            try {
                if (window._catalogFresh) return;        // Firebase allaqachon javob berdi
                if (!window._catalogCache) return;
                var cached = window._catalogCache.read();
                if (!cached || !cached.length) return;
                productsDB = cached;
                window.productsDB = productsDB;
                displayDB = _sortDisplayDB(productsDB.filter(p => !p.is_draft).slice().reverse());
                var lt = document.getElementById('loading-text');
                if (lt) lt.style.display = 'none';
                var ca = document.getElementById('content-area');
                if (ca) ca.classList.remove('hidden');
                renderProducts();
                updateCartBadge();
                window._catalogPaintedFromCache = true;
                if (window._dlog) window._dlog('[kesh] katalog xotiradan chizildi:', cached.length);
            } catch (e) { if (window._dwarn) window._dwarn('[kesh] chizib bo\'lmadi:', e); }
        }, 0);
    })();

    db.ref('products').once('value', (snap) => {
        // 🛡 Yangi ma'lumot keldi — kesh chizishi endi KERAK EMAS va
        //    ruxsat ETILMAYDI (aks holda eski holat ustiga yozib qo'yardi).
        window._catalogFresh = true;
        document.getElementById('loading-text').style.display = 'none';
        document.getElementById('content-area').classList.remove('hidden');

        if (snap.exists()) {
            let allData = [];
            snap.forEach(child => { if(child.val()) allData.push(child.val()); });
            // Keyingi ochilishda darhol ko'rinishi uchun saqlab qo'yamiz
            try { if (window._catalogCache) window._catalogCache.write(allData); } catch (e) {}
            // ⚠️ productsDB — BAZADAGI tartibda (teskari QILMAYMIZ!).
            //    Aks holda .set(productsDB) tartibni har safar teskari yozib,
            //    keyingi ochilishда buzilardi (oscillation). Faqat displayDB teskari.
            productsDB = allData;
        } else {
            productsDB = initialProducts;
            db.ref('products').set(productsDB);
        }
        // 🔗 window.productsDB sinxronlash (tashqi funksiyalar — compare, profil stat — uchun)
        window.productsDB = productsDB;

        // Ekranda yangi tovarlar TEPADA turishi uchun faqat displayDB teskari qilinadi
        displayDB = _sortDisplayDB(productsDB.filter(p => !p.is_draft).slice().reverse());
        renderProducts();
        updateCartBadge();
        if(activeModal === 'adminInventoryModal') renderAdminInventory();
        loadProductRatings(); // ⭐ Reytinglarni reviews bazasidan AVTOMAT hisoblab, kartalarga qo'shamiz
    });

    // ⭐ MAHSULOT REYTINGLARINI AVTOMAT HISOBLASH
    // reviews/{productId}/{uid} dan har bir mahsulotning o'rtacha bahosi va soni
    // hisoblanadi -> window.productRatings -> cardHTML kartada yulduz ko'rsatadi.
    // Qo'lda hech narsa kiritish SHART EMAS — sharhlar kelishi bilan avtomat chiqadi.
    function loadProductRatings() {
        try {
            db.ref('reviews').once('value', function (snap) {
                var map = {};
                if (snap.exists()) {
                    snap.forEach(function (prodSnap) {
                        var pid = prodSnap.key;
                        var sum = 0, cnt = 0;
                        prodSnap.forEach(function (rSnap) {
                            var r = rSnap.val();
                            var rating = r && parseFloat(r.rating);
                            if (rating && rating > 0) { sum += rating; cnt++; }
                        });
                        if (cnt > 0) map[pid] = { avg: Math.round((sum / cnt) * 10) / 10, count: cnt };
                    });
                }
                window.productRatings = map;
                // Kartalarga reytingni JOYIDA qo'shamiz (to'liq re-render YO'Q — miltillash bo'lmaydi)
                try {
                    document.querySelectorAll('.luxury-card[data-pid]').forEach(function (card) {
                        var pid = card.getAttribute('data-pid');
                        var info = map[pid];
                        if (!info) return;
                        if (card.querySelector('.card-rating')) return; // allaqachon bor
                        var meta = card.querySelector('.card-meta');
                        if (!meta) {
                            var h4 = card.querySelector('.info h4');
                            if (!h4 || !h4.parentNode) return;
                            meta = document.createElement('div');
                            meta.className = 'card-meta';
                            h4.insertAdjacentElement('afterend', meta);
                        }
                        // ⭐ AYNAN cardHTML bilan bir xil markup (yagona manba)
                        var wrap = document.createElement('span');
                        wrap.innerHTML = window._starsHTML
                            ? window._starsHTML(info.avg, info.count)
                            : ('<span class="card-rating">' + icon('star') + ' ' + info.avg + '</span>');
                        var span = wrap.firstElementChild || wrap;
                        meta.insertBefore(span, meta.firstChild);
                        // Shablondagidek: reyting bor kartada «Kafolatlangan» yorlig'i chiqmaydi
                        // (tor kartada u «Kaf» bo'lib kesilib qolardi)
                        meta.querySelectorAll('.ac-trust, .bm-trust').forEach(function (t) { t.remove(); });
                    });
                } catch (e) { _dwarn('[ratings] DOM xato:', e); }
            });
        } catch (e) { _dwarn('[ratings] xato:', e); }
    }

    // 📦 QADAM 3: Tugagan tovarlarni oxirga suruvchi yordamchi
    // Mantiq: ichki tartib saqlanadi (yangidan-eskiga), faqat sotuvda
    // bo'lganlari oldinga, tugaganlari oxirga ajraladi.
    // - Razmerli tovar: jami stock yig'indisi (>0 bo'lsa "bor")
    // - Oddiy tovar: stock > 0 bo'lsa "bor"
    // 🎲 Fisher-Yates shuffle — har safar random tartib (lekin har bir
    // sahifa ochilganда BIR XIL tartib saqlanadi - skroll/qaytishда qotmaydi).
    // Faqat 'inStock' guruhi aralashtiriladi, tugaganlari oxirda qoladi.
    function _shuffle(arr) {
        const a = arr.slice();
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }
    function _sortDisplayDB(items) {
        const _now = Date.now();
        const isInStock = (p) => {
            if (p.product_type === 'razmerli' && Array.isArray(p.sizes)) {
                return p.sizes.some(s => (parseInt(s.stock) || 0) > 0);
            }
            return (p.stock !== undefined ? p.stock : 10) > 0;
        };
        // 🏷️ AKSIYA aniqlash: chegirmada (oldPrice > price) yoki taymerda
        //    (flashUntil hali tugamagan) bo'lgan tovar "aksiya" hisoblanadi.
        const isPromo = (p) => {
            const hasDiscount = p.oldPrice && Number(p.oldPrice) > Number(p.price);
            const flashActive = p.flashUntil && Number(p.flashUntil) > _now;
            return !!(hasDiscount || flashActive);
        };
        const inStock = items.filter(isInStock);
        const outOfStock = items.filter(p => !isInStock(p));
        // Sotuvda bor tovarlarni: AKSIYA va ODDIY guruhga ajratamiz
        const promoIn = inStock.filter(isPromo);
        const normalIn = inStock.filter(p => !isPromo(p));
        // 🎲 Har bir guruh alohida shuffle bo'ladi — shunda har safar kirganda/
        //    refreshda aksiya tovarlarining o'zaro tartibi tasodifiy almashadi,
        //    lekin AKSIYA bloki HAR DOIM eng tepada (birinchi) qoladi.
        //    Oddiy tovarlar undan keyin, tugagan tovarlar esa eng oxirida.
        return [
            ..._shuffle(promoIn),
            ..._shuffle(normalIn),
            ..._shuffle(outOfStock)
        ];
    }

    function toggleChip(el) { el.classList.toggle('selected'); }

    function deleteProduct() { let id = parseInt(document.getElementById('edit-id').value); tg.showConfirm("O'chirasizmi?", function(ok) { if(!ok) return; window._rewriteProductsSafely(function(fresh){ return fresh.filter(x => x.id !== id); }).then(() => { showToast("O'chirildi!"); closeModal(); }).catch(() => showToast("Saqlashda xato!", "warning")); }); }

    function openAdminInventory() {
        document.getElementById('adminModal').style.display = 'none'; let aI = document.getElementById('adminInventoryModal'); aI.style.display = 'flex'; activeModal = 'adminInventoryModal'; window.history.pushState({ modal: 'adminInventoryModal' }, "");
        let invS = document.getElementById('inv-search'); if (invS) invS.value = '';
        window.invFilter = 'all';
        window._invSelected = {};
        document.querySelectorAll('#inv-filter-chips .inv-fchip').forEach(c => c.classList.toggle('selected', c.getAttribute('data-f') === 'all'));
        renderAdminInventory();
    }
    // 🧹 [TOZALANDI] Eski "openEditModal" dublikati olib tashlandi.
    //    Faol versiya pastda: window.openEditModal (pushState + interaktiv rasm preview bilan).

    // 🧹 [TOZALANDI] Eski "saveEditProduct" dublikati olib tashlandi.
    //    Faol versiya pastda: window.saveEditProduct (kod maydoni + parsePrice + saveProductAt bilan).

window.toggleEditProductTypeFields = () => {
    let type = document.getElementById('edit-prod-type').value;
    if(type === 'razmerli') {
        document.getElementById('edit-oddiy-fields').style.display = 'none';
        document.getElementById('edit-razmerli-fields').style.display = 'block';
    } else {
        document.getElementById('edit-oddiy-fields').style.display = 'block';
        document.getElementById('edit-razmerli-fields').style.display = 'none';
    }
};

window.updateEditBrandModels = () => {
    let brand = document.getElementById('edit-prod-brand').value;
    let box = document.getElementById('edit-brand-models-box');
    let select = document.getElementById('edit-prod-model');
    select.innerHTML = ''; 
    if(brand === 'gaz') { box.style.display = 'none'; } 
    else if (brand === 'daewoo') {
        box.style.display = 'block';
        select.innerHTML = `<option value="nexia1">Nexia 1</option><option value="nexia2">Nexia 2</option><option value="matiz">Matiz</option><option value="tico">Tico</option><option value="damas">Damas</option>`;
    } else if (brand === 'chevy') {
        box.style.display = 'block';
        select.innerHTML = `<option value="cobalt">Cobalt</option><option value="gentra">Gentra</option><option value="lacetti">Lacetti</option><option value="spark">Spark</option><option value="nexia3">Nexia 3</option>`;
    } else if (brand === 'uaz') {
        box.style.display = 'block';
        select.innerHTML = `<option value="patriot">Patriot</option><option value="hunter">Hunter</option>`;
    } else { box.style.display = 'none'; }
};

window.addEditSizeField = () => {
    let container = document.getElementById('edit-sizes-container');
    let div = document.createElement('div');
    div.className = 'size-input-row';
    div.style.cssText = 'display:flex; gap:8px; margin-bottom:8px;';
    div.innerHTML = `
        <input type="text" placeholder="Razmer (mas. 92.5)" class="size-name" style="flex:1; padding:10px; background:rgba(0,0,0,0.5); color:white; border:1px solid var(--glass-border); border-radius:8px;">
        <input type="number" placeholder="Soni" class="size-stock" style="flex:1; padding:10px; background:rgba(0,0,0,0.5); color:white; border:1px solid var(--glass-border); border-radius:8px;">
        <button type="button" onclick="this.parentElement.remove()" style="background:var(--accent-red); color:white; border:none; border-radius:8px; padding:0 15px; cursor:pointer; font-weight:bold;">X</button>
    `;
    container.appendChild(div);
};

    function renderAdminInventory() {
        let c = document.getElementById('admin-inventory-list');
        c.innerHTML = productsDB.map(p => {
            if (p.product_type === 'razmerli' && p.sizes) {
                // RAZMERLI TOVARLAR UCHUN OMBOR
                let sizesHtml = p.sizes.map((s, idx) => `
                    <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.3); padding:8px; border-radius:8px; margin-top:5px;">
                        <span style="font-size:12px; color:var(--luxury-gold); font-weight:bold;">Razmer: ${s.size}</span>
                        <div class="inv-controls">
                            <input type="number" id="inv-input-${p.id}-${idx}" class="inv-input" value="${s.stock}" style="width:40px; padding:4px; font-size:12px;">
                            <button class="inv-btn" style="padding:4px 8px; font-size:11px;" onclick="fastSaveSizeStock(${p.id}, ${idx})">Saqlash</button>
                        </div>
                    </div>
                `).join('');
                
                return `
                <div class="inventory-item" style="flex-direction:column; align-items:stretch;">
                    <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
                        <div class="inv-info"><h4>${p.name}</h4><p>${p.price.toLocaleString()} so'm</p></div>
                        <span style="font-size:10px; background:var(--primary-blue); padding:3px 6px; border-radius:4px; color:white; font-weight:bold;">Razmerli</span>
                    </div>
                    <div style="margin-top:10px; border-top:1px dashed var(--glass-border); padding-top:5px;">${sizesHtml}</div>
                </div>`;
            } else {
                // ODDIY TOVARLAR UCHUN OMBOR (Eski holat)
                let st = p.stock !== undefined ? p.stock : 10;
                let nameParts = p.name.split('·'); // Nuqta bo'yicha ajratish
                let mainName = nameParts[0] ? nameParts[0].trim() : p.name;
                  let carHint = nameParts[1] ? `<span class="car-hint">· ${nameParts[1].trim()}</span>` : '';
                return `
                <div class="inventory-item">
                    <div class="inv-info"><h4>${mainName}${carHint}</h4><p>${p.price.toLocaleString()} so'm</p></div>
                    <div class="inv-controls">
                        <input type="number" id="inv-input-${p.id}" class="inv-input" value="${st}">
                        <button class="inv-btn" onclick="fastSaveStock(${p.id})">Saqlash</button>
                    </div>
                </div>`;
            }
        }).join('');
    }
    
    function fastSaveStock(id) {
        let val = parseInt(document.getElementById(`inv-input-${id}`).value) || 0;
        let idx = productsDB.findIndex(x => x.id === id);
        if(idx !== -1) { productsDB[idx].stock = val; saveProductAt(idx).then(() => { showToast("Qoldiq saqlandi!"); }); }
    }

    // YANGI: Razmerning aniq qoldig'ini tezkor saqlash
    window.fastSaveSizeStock = (id, sizeIdx) => {
        let val = parseInt(document.getElementById(`inv-input-${id}-${sizeIdx}`).value) || 0;
        let idx = productsDB.findIndex(x => x.id === id);
        if(idx !== -1) { 
            productsDB[idx].sizes[sizeIdx].stock = val;
            // Umumiy tovar qoldig'ini barcha razmerlar yig'indisi qilib qo'yamiz
            productsDB[idx].stock = productsDB[idx].sizes.reduce((sum, s) => sum + s.stock, 0);
            saveProductAt(idx).then(() => { showToast("Razmer qoldig'i saqlandi!"); }); 
        }
    };
   
    
    window.history.replaceState({ section: 'main-menu' }, "");
    // Foydalanuvchi boshqa ilovaga o'tganda barcha animatsiyalarni to'xtatamiz
// Telefon ekrani o'chganda ham ishlaydi — batareyani tejaydi
document.addEventListener('visibilitychange', function() {
    // ⚡ TUZATILDI: ilgari faqat CSS o'zgaruvchisi o'rnatilardi, lekin u
    // hech qayerda ishlatilmasdi — ya'ni animatsiyalar to'xtamasdi.
    // Endi body'ga 'anim-paused' klassi qo'shamiz va u CSS orqali
    // BARCHA animatsiyalarni haqiqatan to'xtatadi (batareya + CPU tejaladi).
    if (document.hidden) {
        document.body.classList.add('anim-paused');
    } else {
        document.body.classList.remove('anim-paused');
    }
});
    function startCinematicWelcome() {
        const screen = document.getElementById('welcome-screen');
        if (!screen) return;

        // iOS uslubidagi sahna (A1 ikonka + spidometr + harfma-harf salom)
        // HTML'da DARHOL turibdi va o'zi CSS animatsiyasi bilan ochiladi. Bu yerda innerHTML'ni QAYTA o'rnatmaymiz — aks holda
        // animatsiya nol nuqtadan qayta boshlanib "sakrab" ketardi va eski flash
        // qaytib kelardi. Faqat animatsiya tugagach ekranni yopamiz.

        // ⚡ Zaif telefonda welcome'ni qisqartiramiz (admin/mijoz kutib qolmasin)
        var _weak = false;
        try { _weak = document.documentElement.classList.contains('pf-weak') || !!window.__perfLite; } catch(e){}
        var _holdMs = _weak ? 1000 : 2900;
        // ⚙️ Shesterna aylanib sekinlashgan payt — yengil "tik" haptic
        if (!_weak) setTimeout(function(){
            try { if (typeof tg !== 'undefined' && tg && tg.HapticFeedback) tg.HapticFeedback.impactOccurred('soft'); } catch(e){}
        }, 1100);
        var _fadeMs = _weak ? 350 : 750;

        // Animatsiya tugagach VA ilova to'liq tayyor bo'lgach ochamiz (A1 BOOT GATE).
        // Ilgari bu qat'iy taymer edi — sekin internetda sahifa hali yuklanmay turib
        // ochilib, uslubsiz/eski ko'rinishlar chiqib qolardi.
        (window.__a1WhenReady || function (ms, f) { setTimeout(f, ms); })(_holdMs, () => {
            screen.classList.add('welcome-fade-out');
            
            // Fade tugagach elementni domdan butunlay yo'qotamiz
            setTimeout(() => {
                screen.style.display = 'none';
            }, _fadeMs);
            
            // Telefonni yengil titratib (Haptic), "Xush kelibsiz" signali beramiz
            if (typeof tg !== 'undefined' && tg.HapticFeedback) {
                tg.HapticFeedback.notificationOccurred('success');
            }
        }); 
    }

    // Ilova yuklanishi bilan ishga tushiramiz
    startCinematicWelcome();
    // 🔄 SILLIQ SKROLL VA TOVARLARNI YUKLASH (Muzlamaydigan versiya)
    // =====================================
    let limitCount = 12; 
    let _isLoadingMore = false;   // bir vaqtda faqat BITTA batch yuklanadi (takror oldini oladi)

// 🚀 SILLIQ SKROLL + ⚙️ PASTKI SHESTERNYA bilan 12talab yuklash
    // 🚀 SILLIQ SKROLL + ⚙️ PASTKI SHESTERNYA bilan 12talab yuklash
    // 🔧 TUZATISH: html/body { overflow:hidden } => skroll WINDOW'da emas,
    //    ".container" ICHIDA bo'ladi. Avval window.scrollY tinglangani uchun
    //    pastga tushganda yangi tovar yuklanmasdi. Endi haqiqiy skroller
    //    (.container) tinglanadi; window esa zaxira sifatida qoladi.
    function _isNearListBottom() {
        var sc = document.querySelector('.container');
        if (sc && sc.scrollHeight > sc.clientHeight + 1) {
            return sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 300;
        }
        var st = window.scrollY || document.documentElement.scrollTop || 0;
        return window.innerHeight + st >= (document.documentElement.scrollHeight || document.body.offsetHeight) - 300;
    }
    function _maybeLoadMoreOnScroll() {
        if (_isLoadingMore) return;
        if (activeModal || searchActive) return;
        var mm = document.getElementById('main-menu');
        if (!mm || mm.classList.contains('hidden')) return;
        if (!_isNearListBottom()) return;
        if (limitCount >= displayDB.length) return;
        _isLoadingMore = true;
        var oldLimit = limitCount;
        limitCount += 12;
        var loader = document.getElementById('scroll-loader');
        if (loader) loader.classList.remove('hidden');
        setTimeout(function () {
            window.requestAnimationFrame(function () {
                loadMoreProducts(oldLimit);
                if (loader) loader.classList.add('hidden');
                _isLoadingMore = false;
            });
        }, 550);
    }
    (function attachInfiniteScroll() {
        var sc = document.querySelector('.container');
        if (sc) sc.addEventListener('scroll', _maybeLoadMoreOnScroll, { passive: true });
        window.addEventListener('scroll', _maybeLoadMoreOnScroll, { passive: true });
    })();

   
// ➕ Faqatgina yangi kelgan tovarlarni pastga yopishtiruvchi motor
    function loadMoreProducts(startIndex) {
        let hc = document.getElementById('home-products'); 
        if(hc) { 
            // Eski tovarlarni buzmaymiz, faqat yangi qismini (slice) qirqib olamiz
            let newItems = displayDB.slice(startIndex, limitCount); 
            if(newItems.length > 0) {
                // innerHTML emas, insertAdjacentHTML orqali oxiriga ulab qo'yamiz!
                hc.insertAdjacentHTML('beforeend', newItems.map(x => cardHTML(x)).join(''));
                
                // 🔥 MANA SHU QATOR QO'SHILDI: Pastga skroll qilinganda yangi kelganlarni ham animatsiyaga ulaymiz
                setTimeout(initReveal, 100);
            }
        }
    }

// ⚡ LAZY KATALOG: bitta mashina bo'limini (#<slug>-parts) joriy ma'lumot bilan chizadi.
function _a1FillGridNow(c) {
    let catName = c.id.replace('-parts', ''); 
    let items = displayDB.filter(x => x.category === catName || (x.categories && x.categories.includes(catName))); 
    
    if(items.length > 0) {
        c.innerHTML = items.map(x => cardHTML(x)).join(''); 
    } else if (typeof window._a1ModelEmpty === 'function') {
        // 🍏 iOS 26 uslubidagi «tovar yo'q» ekrani (model kartasi + amallar)
        c.innerHTML = window._a1ModelEmpty(catName);
    } else {
        c.innerHTML = `<div style="grid-column: span 2;">` + window._emptyState({
            icon: '<svg viewBox="0 0 24 24"><path d="M20 2H4c-1 0-2 .9-2 2v3.01c0 .72.43 1.34 1 1.69V20c0 1.1 1.1 2 2 2h14c.9 0 2-.9 2-2V8.7c.57-.35 1-.97 1-1.69V4c0-1.1-1-2-2-2zm-5 12H9v-2h6v2zm5-7H4V4h16v3z"/></svg>',
            title: "Hali tovarlar yo'q",
            desc: "Bu mashina uchun tez orada tovarlar qo'shiladi. Qidiruv orqali boshqa qismlarni topishingiz mumkin.",
            btnText: "Qidirib ko'rish",
            btnAction: "var si=document.getElementById('searchInput'); if(si){si.focus(); searchProducts();}"
        }) + `</div>`;
    }
    c.__a1Ver = window.__a1GridVer;
}
/** Bo'limni kerak bo'lsa chizadi. force=true — har holda (ko'rinib turgan bo'lim).
 *  Avval ko'rilgan bo'lim bo'lsa, kartalar qayta "suzib chiqmaydi" (joyida yangilanadi). */
window._a1FillGrid = function (c, force) {
    if (typeof c === 'string') c = document.getElementById(c);
    if (!c || !c.id || c.id.slice(-6) !== '-parts') return false;
    if (!window.__a1GridVer) return false;                               // ma'lumot hali kelmagan
    if (!force && c.__a1Ver === window.__a1GridVer) return false;        // allaqachon yangi
    var seen = !!c.querySelector('.luxury-card.active');
    _a1FillGridNow(c);
    if (seen) c.querySelectorAll('.luxury-card').forEach(function (el) { el.classList.add('reveal-item', 'active'); });
    else if (!force) { try { initReveal(); } catch (e) {} }             // birinchi ochilish: suzib chiqish animatsiyasi
    return true;
};
/** Zaxira: bo'lim showSection'dan boshqa yo'l bilan ochilsa ham bo'sh/eskirgan qolmasin. */
function _a1WatchGrid(c) {
    if (c.__a1Obs || !window.MutationObserver) return;
    c.__a1Obs = new MutationObserver(function () {
        if (c.classList.contains('hidden') || c.__a1Ver === window.__a1GridVer) return;
        if (window._a1FillGrid(c)) { try { if (window._catDecorateVisible) window._catDecorateVisible(); } catch (e) {} }
    });
    c.__a1Obs.observe(c, { attributes: true, attributeFilter: ['class'] });
}

// Oynani birinchi marta ochgandagi yoki tovar yangilangandagi chizish
    function renderProducts() {
        // 🔥 Muddati tugagan flash chegirmalarni asl narxga qaytaramiz (har renderда)
        try { if (window.applyFlashState) window.applyFlashState(); } catch(e){}
        let hc = document.getElementById('home-products'); 
        if(hc) { 
            let hi = displayDB.slice(0, limitCount); 
            hc.innerHTML = hi.map(x => cardHTML(x)).join(''); 
        }
        
        // Katalog papkalariga (mashina bo'limlari) tovarlarni chizish.
        // ⚡ LAZY: faqat KO'RINIB turgan bo'lim darhol chiziladi. Yashirin bo'limlar
        //    shunchaki "eskirgan" bo'lib qoladi va mijoz o'sha bo'limni OCHGANDA
        //    chiziladi (_a1FillGrid). Ilgari har yangilanishda 267 ta kartochka
        //    qayta chizilardi (zaif telefonda ~200 ms qotish), endi ~12 ta.
        window.__a1GridVer = (window.__a1GridVer || 0) + 1;
        document.querySelectorAll('.items-grid').forEach(c => {
            if (!c.id || !c.id.endsWith('-parts')) return;
            _a1WatchGrid(c);
            if (c.classList.contains('hidden')) return;      // ochilganda chiziladi
            window._a1FillGrid(c, true);
        });
        
        // 🔥 MANA SHU QATOR QO'SHILDI: Tovarlar chizilgach, ularni "suzib chiqishi" uchun motorni yoqamiz
        setTimeout(initReveal, 100);

        // ⚡ BOOT SMOOTHING TUGADI: tovarlar chizildi -> zaif bo'lmagan telefonda
        //    vaqtincha yoqilgan 'lite'ni olib tashlaymiz (premium ko'rinish tiklanadi).
        //    Render lite ostida bo'lib o'tdi -> dastlabki qotish bo'lmaydi.
        try {
            if (window.__bootLiteOnly && !window.__bootLiteScheduled) {
                window.__bootLiteScheduled = true;
                setTimeout(function(){ if (window.__endBootLite) window.__endBootLite(); }, 700);
            }
        } catch(e){}
    }
function addToCartQuick(e, id) { 
    if(e) e.stopPropagation(); 
    let p = productsDB.find(x => x.id == id);
    
    if(p.product_type === 'razmerli') {
        showToast("Razmer tanlash uchun tovarni oching!", "warning");
        openProduct(id);
        return;
    }
    
    let st = p.stock !== undefined ? p.stock : 10;
    if(st <= 0) { showToast("Kechirasiz, bu tovar qolmagan", "warning"); return; }
    
    let totalInCart = 0;
    for(let cid in cart) { if(cid.startsWith(id + "||")) totalInCart += (parseInt(cart[cid]) || 0); }
    if(totalInCart >= st) { showToast("Omborda bunday ko'p emas", "warning"); return; }
    
    let finalId = id + "||Universal";
    addToCartWithOptions(finalId);
    
    // 🚀 ASOSIY OYNADA SAVATGA QO'SHGANDA UCHISH ANIMATSIYASI
    if(e) flyToCartAnimation(e, p.img);
}
    
function cardHTML(p) { 
    let st = p.stock !== undefined ? p.stock : 10;
    let bH = ''; 
    if(st <= 0) bH = '<div class="badge badge-out">' + icon('box') + ' Tugagan</div>';
    else if(p.badge === 'hot') bH = '<div class="badge hot">' + icon('flame') + ' Top</div>'; 
    else if(p.badge === 'new') bH = '<div class="badge new">' + icon('sparkle') + ' Yangi</div>'; 
    let oosStyle = st <= 0 ? 'filter: grayscale(1); opacity:0.7;' : '';

    // 💎 Karta boyitish — chegirma / flash
    let _now = Date.now();
    let flashOn = !!(p.flashUntil && p.flashUntil > _now && p.oldPrice && Number(p.oldPrice) > Number(p.price));
    let _pct = (p.oldPrice && Number(p.oldPrice) > Number(p.price))
               ? Math.round((1 - Number(p.price) / Number(p.oldPrice)) * 100) : 0;
    // Flash bo'lmaganda -% meta qatorida; flash bo'lsa -% flash guruhida ko'rsatiladi.
    let discChip = (_pct > 0 && !flashOn) ? `<span class="card-disc">-${_pct}%</span>` : '';
    // 🔥 Flash guruhi (sariq tugma TEPASIDA): taymer -> -% -> eski narx (chizilgan, kulrang)
    let flashGroup = '';
    if (flashOn) {
        flashGroup = `<div class="card-flash">`
            + `<span class="cf-timer">🔥 <span class="flash-cd" data-until="${p.flashUntil}"></span></span>`
            + (_pct > 0 ? `<span class="cf-disc">-${_pct}%</span>` : '')
            + `<span class="cf-old">${Number(p.oldPrice).toLocaleString()} so'm</span>`
            + `</div>`;
    }
    // ⭐ REYTING — 5 yulduzli, kasrli to'ldirish bilan (Yandex Taxi uslubi).
    //    Markup YAGONA joyda yasaladi: window._starsHTML (fayl oxiridagi qatlam).
    //    Shu sababli kartada va reytinglar keyin yuklanganda ham AYNAN bir xil
    //    ko'rinadi (ilgari ikki joyda alohida yozilgani uchun farq qilardi).
    let _ratingHTML = '';
    let _rInfo = (window.productRatings && window.productRatings[p.id]) ? window.productRatings[p.id] : null;
    let _rv = _rInfo ? _rInfo.avg : parseFloat(p.rating);
    let _rc = _rInfo ? _rInfo.count : p.ratingCount;
    if (_rv && _rv > 0) {
        _ratingHTML = window._starsHTML ? window._starsHTML(_rv, _rc)
            : `<span class="card-rating">${icon('star')} ${Math.round(_rv * 10) / 10}</span>`;
    }
    let _stockHTML = '';
    if (st > 0 && st <= 5) _stockHTML = `<span class="card-stock-low">${icon('box')} ${st} ta qoldi</span>`;
    let metaHTML = (_ratingHTML || _stockHTML || discChip) ? `<div class="card-meta">${_ratingHTML}${discChip}${_stockHTML}</div>` : '';
    
    // Nuqta belgisi bo'yicha ajratish
    let nameParts = p.name.split('·');
    let mainName = nameParts[0] ? nameParts[0].trim() : p.name;
    let carHint = nameParts[1] ? `<span class="car-hint">· ${nameParts[1].trim()}</span>` : '';
    
    let isFav = wishlist.includes(p.id) ? 'active' : '';
    let heartBtn = `<div class="btn-wishlist ${isFav}" onclick="toggleWishlist(event, ${p.id})"><svg viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg></div>`;
    
    // 🎛 KARTA DIZAYNI — admin paneldan boshqariladi (Firebase settings/ui/cardStyle).
    //    'market' = B · Bozor (narx birinchi), 'appstore' = A · App Store, 'classic' = eski karta.
    let _cardStyle = window.__cardStyle || 'market';
    // 🧾 iOS karta (App Store uslubi): narx alohida, tugma — yumaloq «+».
    let _fmtS = (n) => (Math.round(Number(n) || 0)).toLocaleString('ru-RU').replace(/,/g, ' ');
    let acOld = (p.oldPrice && Number(p.oldPrice) > Number(p.price)) ? `<s>${_fmtS(p.oldPrice)} so'm</s>` : '<s></s>';
    let acChips = '';
    if (st <= 0) acChips += `<i class="ac-chip is-out">Tugagan</i>`;
    else if (p.badge === 'hot') acChips += `<i class="ac-chip is-hot">${icon('flame')} Top</i>`;
    else if (p.badge === 'new') acChips += `<i class="ac-chip is-new">Yangi</i>`;
    if (_pct > 0) acChips += `<i class="ac-chip is-disc">-${_pct}%</i>`;
    if (flashOn) acChips += `<i class="ac-chip is-time">🔥 <span class="flash-cd" data-until="${p.flashUntil}"></span></i>`;
    let acMeta = _ratingHTML + _stockHTML;
    if (!acMeta && st > 0) acMeta = `<span class="ac-trust">${icon('shield')} Kafolatlangan</span>`;
    let acAdd = st > 0
        ? `<button class="btn-add-cart ac-add" aria-label="Savatga qo'shish" onclick="addToCartQuick(event, ${p.id})"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></button>`
        : `<button class="btn-add-cart ac-add is-out" disabled aria-label="Tugagan"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/></svg></button>`;
    if (_cardStyle === 'appstore') {
        return `<div class="luxury-card ac-card${Number(p.price) >= 1000000 ? ' is-long' : ''}" data-pid="${p.id}" onclick="openProduct(${p.id})">
        ${heartBtn}
        <div class="btn-compare-card ${(window.compareList||[]).includes(String(p.id))?'active':''}" onclick="toggleCompare(${p.id}, event)" title="Taqqoslash" aria-label="Taqqoslash"><span class="cmp-rock"><svg class="cmp-card-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="4" r="1.25" fill="currentColor" stroke="none"/><path d="M12 5.2V19"/><path d="M7.5 19h9"/><path d="M4.5 6.6h15"/><path d="M4.5 6.6L2 11.6h5z"/><path d="M19.5 6.6L17 11.6h5z"/></svg></span></div>
        <div class="img-wrap" style="${oosStyle}">
        <img src="${_thumb(p.img, 240)}" loading="lazy" decoding="async" class="card-img-lazy" data-full="${(p.img||'').replace(/"/g,'&quot;')}" onerror="window._imgFallback(this)">
        ${acChips ? `<div class="ac-chips">${acChips}</div>` : ''}
        </div>
        <div class="info">
            <h4>${mainName}${carHint}</h4>
            <div class="card-meta">${acMeta}</div>
            <div class="ac-ft"><div class="ac-pr">${acOld}<b>${_fmtS(p.price)}<small> so'm</small></b></div>${acAdd}</div>
        </div>
    </div>`;
    }


    // 🛍 B · BOZOR KARTASI (narx birinchi)
    if (_cardStyle === 'market') {
        let _f = (n) => (Math.round(Number(n) || 0)).toLocaleString('ru-RU').replace(/,/g, ' ');
        let bmOld = (p.oldPrice && Number(p.oldPrice) > Number(p.price)) ? `<s>${_f(p.oldPrice)}</s>` : '';
        let bmChips = '';
        if (st <= 0) bmChips += `<i class="bm-chip is-out">Tugagan</i>`;
        else if (p.badge === 'hot') bmChips += `<i class="bm-chip is-hot">${icon('flame')} Top</i>`;
        else if (p.badge === 'new') bmChips += `<i class="bm-chip is-new">Yangi</i>`;
        if (_pct > 0) bmChips += `<i class="bm-chip is-disc">-${_pct}%</i>`;
        let bmTimer = flashOn ? `<i class="bm-chip is-time">🔥 <span class="flash-cd" data-until="${p.flashUntil}"></span></i>` : '';
        let bmMeta = _ratingHTML + _stockHTML;
        if (!bmMeta && st > 0) bmMeta = `<span class="bm-trust">${icon('shield')} Kafolatlangan</span>`;
        let bmBtn = st > 0
            ? `<button class="btn-add-cart bm-btn" onclick="addToCartQuick(event, ${p.id})"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.9 7.2v-.5a4.1 4.1 0 0 1 8.2 0v.5h2.9c.5 0 .9.4.8.9l-1 12.2c-.1 1-.9 1.7-1.8 1.7H7c-.9 0-1.7-.7-1.8-1.7l-1-12.2c0-.5.3-.9.8-.9zm1.7 0h4.8v-.5a2.4 2.4 0 0 0-4.8 0z"/></svg><span>Savatga</span></button>`
            : `<button class="btn-add-cart bm-btn is-out" disabled><span>Tugadi</span></button>`;
        return `<div class="luxury-card bm-card${Number(p.price) >= 1000000 ? ' is-long' : ''}" data-pid="${p.id}" onclick="openProduct(${p.id})">
        <div class="img-wrap" style="${oosStyle}">
            <img src="${_thumb(p.img, 240)}" loading="lazy" decoding="async" class="card-img-lazy" data-full="${(p.img||'').replace(/"/g,'&quot;')}" onerror="window._imgFallback(this)">
            ${heartBtn}
            <div class="btn-compare-card ${(window.compareList||[]).includes(String(p.id))?'active':''}" onclick="toggleCompare(${p.id}, event)" title="Taqqoslash" aria-label="Taqqoslash"><span class="cmp-rock"><svg class="cmp-card-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="4" r="1.25" fill="currentColor" stroke="none"/><path d="M12 5.2V19"/><path d="M7.5 19h9"/><path d="M4.5 6.6h15"/><path d="M4.5 6.6L2 11.6h5z"/><path d="M19.5 6.6L17 11.6h5z"/></svg></span></div>
            ${bmChips ? `<div class="bm-chips">${bmChips}</div>` : ''}
            ${bmTimer ? `<div class="bm-timer">${bmTimer}</div>` : ''}
        </div>
        <div class="info">
            <div class="bm-pr${bmOld ? ' has-old' : ''}"><b>${_f(p.price)}</b><small>so'm</small>${bmOld}</div>
            <h4>${mainName}${carHint}</h4>
            <div class="card-meta">${bmMeta}</div>
            ${bmBtn}
        </div>
    </div>`;
    }

    let cartBtn = '';
    if(st > 0) {
        cartBtn = `
        <button class="btn-add-cart" onclick="addToCartQuick(event, ${p.id})">
            <span class="cart-price">${p.price.toLocaleString()} so'm</span>
            <svg viewBox="0 0 24 24"><path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z"/></svg>
        </button>`;
    } else {
        cartBtn = `<button class="btn-add-cart" style="background:rgba(255,255,255,0.05) !important; color:gray !important; box-shadow:none !important; justify-content:center !important;" disabled>Tugadi</button>`;
    }

    // 🛡️ 7/9: kartada nafis ISHONCH belgisi (kafolat) — faqat sotuvda bor tovarda
    //    ⚠️ Muddat (14 kun) ataylab YOZILMAYDI: kartochka juda kichik, muddat
    //    esa o'zgarishi mumkin va uni ikki joyda (kartochka + tovar oynasi)
    //    saqlash chalkashlikka olib keladi. Aniq muddat tovar oynasidagi
    //    ishonch panelida va "Kafolat" bo'limida ko'rsatiladi.
    let trustHTML = (st > 0) ? `<div class="card-trust">${icon('shield')} Kafolatlangan</div>` : '';

    return `<div class="luxury-card" data-pid="${p.id}" onclick="openProduct(${p.id})">
        ${bH}${heartBtn}
        <div class="btn-compare-card ${(window.compareList||[]).includes(String(p.id))?'active':''}" onclick="toggleCompare(${p.id}, event)" title="Taqqoslash" aria-label="Taqqoslash"><span class="cmp-rock"><svg class="cmp-card-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="4" r="1.25" fill="currentColor" stroke="none"/><path d="M12 5.2V19"/><path d="M7.5 19h9"/><path d="M4.5 6.6h15"/><path d="M4.5 6.6L2 11.6h5z"/><path d="M19.5 6.6L17 11.6h5z"/></svg></span></div>
        <div class="img-wrap" style="${oosStyle}">
        <img src="${_thumb(p.img, 240)}" 
     loading="lazy" 
     decoding="async"
     class="card-img-lazy"
     data-full="${(p.img||'').replace(/"/g,'&quot;')}"
     onerror="window._imgFallback(this)">
        </div>
        <div class="info">
            <h4>${mainName}${carHint}</h4>
            ${metaHTML}
            ${flashGroup}
            ${cartBtn}
            ${trustHTML}
        </div>
    </div>`; 
}

function openProduct(id) {
    let p = productsDB.find(x => x.id == id); if(!p) return;

    let imgs = [];
    if (p.images && p.images.length > 0) { imgs = p.images; } else if (p.img) { imgs = [p.img]; }

    let sliderWrapper = document.getElementById('pm-slider-wrapper');
    let dotsWrapper = document.getElementById('pm-slider-dots');

    if (imgs.length > 0) {
        // ⚪ ASLIY ORIGINAL OQ FON (XATOSIZ YUKLASH) — optimallashtirilgan thumbnail (w=820)
        sliderWrapper.innerHTML = imgs.map(src => `
            <img src="${_thumb(src, 820)}" loading="lazy" decoding="async" style="width:100%; height:100%; object-fit:contain; padding:25px; box-sizing:border-box; display:block;" data-full="${(src||'').replace(/"/g,'&quot;')}" onerror="window._imgFallback(this)">
         `).join('');
         dotsWrapper.innerHTML = imgs.length > 1 ? imgs.map((_, i) => `<div class="pm-dot ${i===0?'active':''}"></div>`).join('') : '';
    } else {
        sliderWrapper.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;width:100%;color:gray;">Rasm yuklanmagan</div>`;
        dotsWrapper.innerHTML = '';
    }
    sliderWrapper.scrollLeft = 0;

    document.getElementById('pm-title').innerText = p.name; 

    let pmCode = document.getElementById('pm-code');
    if (pmCode) {
        if (p.code) {
            pmCode.innerHTML = `<svg class="uic" aria-hidden="true"><use href="#i-tag"></use></svg> Kod: <span style="color:var(--luxury-gold); font-weight:800; letter-spacing:0.5px;">${escHtml(p.code)}</span>`;
            pmCode.style.display = 'block';
        } else {
            pmCode.style.display = 'none';
        }
    }
    
    let unitBadge = document.getElementById('pm-unit-badge');
    if (p.unit === 'komplekt') {
        unitBadge.innerHTML = '<svg class="uic" aria-hidden="true"><use href="#i-tools"></use></svg> Komplekt narxi';
        unitBadge.style.color = '#30d158';
        unitBadge.style.borderColor = 'rgba(48, 209, 88, 0.3)';
        unitBadge.style.background = 'rgba(48, 209, 88, 0.1)';
    } else {
        unitBadge.innerHTML = '<svg class="uic" aria-hidden="true"><use href="#i-box"></use></svg> 1 dona uchun narx';
        unitBadge.style.color = 'var(--luxury-gold)';
        unitBadge.style.borderColor = 'rgba(212, 175, 55, 0.3)';
        unitBadge.style.background = 'rgba(212, 175, 55, 0.15)';
    }
    
    document.getElementById('pm-desc').innerText = p.desc && p.desc !== "Tavsif kiritilmagan" ? p.desc : "Bu tovar haqida batafsil ma'lumot uchun biz bilan bog'laning — sizga yordam beramiz."; 
    document.getElementById('pm-price').innerText = `${p.price.toLocaleString()} so'm`;

    // 🔥 Flash countdown (detal oynasi) — aktiv flash bo'lsa narx ostida ko'rsatamiz
    (function(){
        var ex = document.getElementById('pm-flash-cd'); if (ex) ex.remove();
        var host = document.getElementById('pm-price');
        if (host && window._flashActive && window._flashActive(p)) {
            var box = document.createElement('div');
            box.id = 'pm-flash-cd';
            box.className = 'pm-flash-cd';
            box.innerHTML = '🔥 Flash chegirma tugashiga: <span class="flash-cd" data-until="' + p.flashUntil + '"></span>';
            var stickyBar = host.closest('.pm-sticky-bar');
            if (stickyBar) stickyBar.appendChild(box);
            else if (host.parentNode) host.parentNode.insertBefore(box, host.nextSibling);
        }
    })();
    
    let buyB = document.getElementById('pm-buy-btn');
    let sInf = document.getElementById('pm-stock');
    
    // RAZMERLI TOVAR
    if (p.product_type === 'razmerli' && p.sizes && p.sizes.length > 0) {
        window.currentSelectedCar = p.sizes[0].size; 
        window.currentSelectedStock = p.sizes[0].stock;
        
        let sizesHtml = `
        <div style="margin-top: 15px;">
            <p style="font-size: 12px; font-weight: bold; color: var(--text-muted); margin-bottom: 8px;">Razmerni tanlang:</p>
            <div style="display:flex; gap:8px; flex-wrap:wrap;" id="pm-size-options">
                ${p.sizes.map((s, i) => `
                    <button onclick="selectSizeModel(this, ${s.stock})" data-size="${s.size}" style="background: ${i===0 ? 'rgba(212, 175, 55, 0.2)' : 'rgba(255,255,255,0.05)'}; color: ${i===0 ? 'var(--luxury-gold)' : 'white'}; border: 1px solid ${i===0 ? 'var(--luxury-gold)' : 'var(--glass-border)'}; padding: 8px 15px; border-radius: 10px; font-size: 13px; font-weight: 600; cursor: pointer; transition: 0.2s;" class="pm-size-btn ${i===0 ? 'selected' : ''}">${s.size}</button>
                `).join('')}
            </div>
        </div>`;
        
        sInf.innerHTML = `<div id="dynamic-stock-info"></div>` + sizesHtml;
        updateDynamicStock(window.currentSelectedStock);

        buyB.onclick = (e) => { // ⚠️ e qo'shildi
            if (window.currentSelectedStock <= 0) {
                showToast("Bu razmerdan qolmagan!", "warning"); return;
            }
            let finalCartId = id + "||" + window.currentSelectedCar; 
            let totalInCart = 0;
            for(let cid in cart) { if(cid.startsWith(id + "||" + window.currentSelectedCar)) totalInCart += (parseInt(cart[cid]) || 0); }
            if(totalInCart >= window.currentSelectedStock){
                showToast("Omborda bunday ko'p emas", "warning");
            } else {
                addToCartWithOptions(finalCartId);
                // 🚀 TOVAR OYNASIDAN SAVATGA UCHISH
                if(e) flyToCartAnimation(e, imgs[0]);
                setTimeout(() => closeModal(), 600); // Parvoz tugaguncha oynani kutib turish
            }
        };
    } else {
        // ODDIY TOVAR
        let st = p.stock !== undefined ? p.stock : 10;
        let stockText = (currentUser === ADMIN_ID) ? `✅ Sotuvda bor: ${st} ta` : `✅ Sotuvda bor`;
        let stockHtml = st <= 0 
            ? `<span style="color:#ff453a; font-weight:bold;">❌ Sotuvda qolmagan</span>`
            : `<span style="color:var(--accent-green); font-weight:bold;">${stockText}</span>`;
            
        if(st <= 0) {
            buyB.disabled = true; buyB.innerText = "Tugagan"; buyB.onclick = null;
        } else {
            buyB.disabled = false; buyB.innerText = "Savatga qo'shish";
        }

        const carNames = window.CAR_NAMES || {};
        let uniqueModels = new Set();
        let pCats = p.categories || [p.category];
        pCats.forEach(c => {
            for(let key in carNames) { if(c && c.startsWith(key)) uniqueModels.add(carNames[key]); }
        });
        let carsArr = Array.from(uniqueModels);
        let modelsHtml = '';
        if(carsArr.length > 0) {
            modelsHtml = `
            <div style="margin-top: 15px;">
                <p style="font-size: 12px; font-weight: bold; color: var(--text-muted); margin-bottom: 8px;">Qaysi mashina uchun?</p>
                <div style="display:flex; gap:8px; flex-wrap:wrap;" id="pm-car-options">
                    ${carsArr.map((m, i) => `
                        <button onclick="selectCarModel(this)" data-car="${m}" style="background: ${i===0 ? 'rgba(212, 175, 55, 0.2)' : 'rgba(255,255,255,0.05)'}; color: ${i===0 ? 'var(--luxury-gold)' : 'white'}; border: 1px solid ${i===0 ? 'var(--luxury-gold)' : 'var(--glass-border)'}; padding: 8px 15px; border-radius: 10px; font-size: 13px; font-weight: 600; cursor: pointer; transition: 0.2s;" class="pm-car-btn ${i===0 ? 'selected' : ''}">${m}</button>
                    `).join('')}
                </div>
            </div>`;
            window.currentSelectedCar = carsArr[0];
        } else {
            window.currentSelectedCar = "Universal";
        }

        sInf.innerHTML = stockHtml + modelsHtml;
        
        if(st > 0) {
            buyB.onclick = (e) => { // ⚠️ e qo'shildi
                let finalCartId = id + "||" + window.currentSelectedCar;
                let totalInCart = 0;
                for(let cid in cart) { if(cid.startsWith(id + "||")) totalInCart += (parseInt(cart[cid]) || 0); }
                if(totalInCart >= st){ showToast("Omborda bunday ko'p emas", "warning"); } 
                else { 
                    addToCartWithOptions(finalCartId); 
                    // 🚀 TOVAR OYNASIDAN SAVATGA UCHISH
                    if(e) flyToCartAnimation(e, imgs[0]);
                    setTimeout(() => closeModal(), 600); // Parvoz tugaguncha oynani kutib turish
                }
            };
        }
    }

    buyB.setAttribute('data-id', id);
    loadProductReviews(id);
    let edB = document.getElementById('pm-edit-btn'); if (typeof window.isAdmin === 'function' ? window.isAdmin() : ADMIN_IDS.includes(currentUser)) { edB.style.display = 'flex'; edB.onclick = (e) => openEditModal(e); } else { edB.style.display = 'none'; }
    let sC = document.getElementById('pm-similar-items'); let pC = p.categories ? p.categories[0] : p.category; let sP = productsDB.filter(x => x.id !== p.id && (x.category === pC || (x.categories && x.categories.includes(pC))) ).slice(0, 6);
    if(sP.length > 0) { document.getElementById('similar-title').style.display = 'block'; sC.innerHTML = sP.map(x => `<div class="similar-card" onclick="openProduct(${x.id})"><div class="img-wrap"><img src="${_thumb(x.img, 200)}" loading="lazy" decoding="async" data-full="${(x.img||'').replace(/"/g,'&quot;')}" onload="this.style.opacity=1" onerror="window._imgFallback(this)"></div><h4>${escHtml(x.name)}</h4><div class="price">${x.price.toLocaleString()} so'm</div></div>`).join(''); } else { document.getElementById('similar-title').style.display = 'none'; sC.innerHTML = ''; }
    // 🆕 Compare tugmasi + Notify me (tugaganda)
    let extra = document.getElementById('pm-extra-actions');
    if (extra) {
        let extraStockTotal = (p.stock !== undefined ? p.stock : ((p.sizes||[]).reduce((s,x)=>s+(x.stock||0),0)));
        let notifyHtml = (extraStockTotal <= 0) ? `<button class="btn-notify" onclick="notifyMeForProduct(${p.id})">🔔 Sotuvga kirsa xabar bering</button>` : '';
        let inCmp = (window.compareList||[]).includes(String(p.id));
        let cmpHtml = `<button class="btn-compare ${inCmp?'active':''}" data-id="${p.id}" onclick="toggleCompare(${p.id}, event)" style="width:100%; margin-bottom:8px;">⚖️ ${inCmp?'Taqqoslashdan chiqarish':'Taqqoslashga qoʻshish (2 ta belgilang)'}</button>`;
        extra.innerHTML = cmpHtml + notifyHtml;
    }
    let mod = document.getElementById('productModal'); mod.style.display = 'flex'; document.body.style.overflow = 'hidden'; activeModal = 'productModal'; window.history.pushState({ modal: 'productModal' }, ""); tg.BackButton.show(); updateBtns();
    let cont = document.querySelector('.container');
    if(cont) cont.classList.add('blur-bg');
}
    
    function backToCart() {
        // 🧭 Yagona navigatsiya yo'li: history.back() -> popstate handler hal qiladi
        //   (karta/ilova tafsiloti -> usullar ro'yxati -> savat). Telegram Nazad
        //   tugmasi ham aynan shu yo'ldan yuradi — ikkisi 100% bir xil ishlaydi.
        window.history.back();
    }

    function updateSliderDots() {
        let sw = document.getElementById('pm-slider-wrapper');
        let idx = Math.round(sw.scrollLeft / sw.clientWidth);
        document.querySelectorAll('#pm-slider-dots .pm-dot').forEach((d, i) => {
            if(i === idx) d.classList.add('active'); else d.classList.remove('active');
        });
    }

window.searchProducts = () => {
    let qRaw = document.getElementById('searchInput').value.toLowerCase().trim();
    
    const synonyms = {
        "porshun": "porshen", "porshin": "porshen", "kolca": "kolsa", "xalqa": "kolsa", "kalso": "kolsa",
        "kalodka": "kalotka", "kolodka": "kalotka", "kalotki": "kalotka", "amartizator": "amortizator", 
        "mator": "motor", "galofka": "galovka", "apora": "opora", "xadavoy": "xodovoy", "xadovoy": "xodovoy", 
        "rul": "rul", "fara": "fara", "chirol": "fara"
    };
    
    // Mashina nomlarini katalog papkasiga ulovchi lug'at
    const carModelsIndex = {
        "cobalt": { name: "Chevrolet Cobalt", id: "chevy-cobalt-parts", img: "https://i.postimg.cc/NMgBNSyD/8h0a-Bn9L-1F0s-Hy-WEZSLfnhaqer-Kq-Kxj0Rp-SDjapvv-0z-LWJcn-SH19DCH-In-KOCt-N4s-Wd6Q9b4KGl-NDJp0vc-Ow.png" },
        "kobalt": { name: "Chevrolet Cobalt", id: "chevy-cobalt-parts", img: "https://i.postimg.cc/NMgBNSyD/8h0a-Bn9L-1F0s-Hy-WEZSLfnhaqer-Kq-Kxj0Rp-SDjapvv-0z-LWJcn-SH19DCH-In-KOCt-N4s-Wd6Q9b4KGl-NDJp0vc-Ow.png" },
        "spark": { name: "Chevrolet Spark", id: "chevy-spark-parts", img: "https://i.postimg.cc/NMgBNSyD/8h0a-Bn9L-1F0s-Hy-WEZSLfnhaqer-Kq-Kxj0Rp-SDjapvv-0z-LWJcn-SH19DCH-In-KOCt-N4s-Wd6Q9b4KGl-NDJp0vc-Ow.png" },
        "gentra": { name: "Chevrolet Gentra", id: "chevy-gentra-parts", img: "https://i.postimg.cc/NMgBNSyD/8h0a-Bn9L-1F0s-Hy-WEZSLfnhaqer-Kq-Kxj0Rp-SDjapvv-0z-LWJcn-SH19DCH-In-KOCt-N4s-Wd6Q9b4KGl-NDJp0vc-Ow.png" },
        "lacetti": { name: "Chevrolet Lacetti", id: "chevy-lacetti-parts", img: "https://i.postimg.cc/NMgBNSyD/8h0a-Bn9L-1F0s-Hy-WEZSLfnhaqer-Kq-Kxj0Rp-SDjapvv-0z-LWJcn-SH19DCH-In-KOCt-N4s-Wd6Q9b4KGl-NDJp0vc-Ow.png" },
        "laseti": { name: "Chevrolet Lacetti", id: "chevy-lacetti-parts", img: "https://i.postimg.cc/NMgBNSyD/8h0a-Bn9L-1F0s-Hy-WEZSLfnhaqer-Kq-Kxj0Rp-SDjapvv-0z-LWJcn-SH19DCH-In-KOCt-N4s-Wd6Q9b4KGl-NDJp0vc-Ow.png" },
        "malibu": { name: "Chevrolet Malibu", id: "chevy-malibu2-parts", img: "https://i.postimg.cc/NMgBNSyD/8h0a-Bn9L-1F0s-Hy-WEZSLfnhaqer-Kq-Kxj0Rp-SDjapvv-0z-LWJcn-SH19DCH-In-KOCt-N4s-Wd6Q9b4KGl-NDJp0vc-Ow.png" },
        "damas": { name: "Chevrolet Damas", id: "chevy-damas-parts", img: "https://i.postimg.cc/NMgBNSyD/8h0a-Bn9L-1F0s-Hy-WEZSLfnhaqer-Kq-Kxj0Rp-SDjapvv-0z-LWJcn-SH19DCH-In-KOCt-N4s-Wd6Q9b4KGl-NDJp0vc-Ow.png" },
        "nexia": { name: "Daewoo / Chevy Nexia", id: "chevy-nexia3-parts", img: "https://i.postimg.cc/7Y4dS02Y/Daewoo-logo.png" },
        "matiz": { name: "Daewoo Matiz", id: "daewoo-matiz-parts", img: "https://i.postimg.cc/7Y4dS02Y/Daewoo-logo.png" },
        "gazel": { name: "GAZ Gazel", id: "gazel-biznes-parts", img: "https://i.postimg.cc/VLj18zjV/orig-(4).png" },
        "volga": { name: "GAZ Volga", id: "volga-31105-parts", img: "https://i.postimg.cc/VLj18zjV/orig-(4).png" },
        "tico": { name: "Daewoo Tico", id: "daewoo-tico-parts", img: "https://i.postimg.cc/7Y4dS02Y/Daewoo-logo.png" },
        "tiko": { name: "Daewoo Tico", id: "daewoo-tico-parts", img: "https://i.postimg.cc/7Y4dS02Y/Daewoo-logo.png" },
        "uaz": { name: "UAZ", id: "uaz-patriot-parts", img: "https://i.postimg.cc/yxr763cn/orig-(5).png" },
        "patriot": { name: "UAZ Patriot", id: "uaz-patriot-parts", img: "https://i.postimg.cc/yxr763cn/orig-(5).png" },
        "hunter": { name: "UAZ Hunter", id: "uaz-hunter-parts", img: "https://i.postimg.cc/yxr763cn/orig-(5).png" },
        "captiva": { name: "Chevrolet Captiva", id: "chevy-captiva1-parts", img: "https://i.postimg.cc/NMgBNSyD/8h0a-Bn9L-1F0s-Hy-WEZSLfnhaqer-Kq-Kxj0Rp-SDjapvv-0z-LWJcn-SH19DCH-In-KOCt-N4s-Wd6Q9b4KGl-NDJp0vc-Ow.png" },
        "kaptiva": { name: "Chevrolet Captiva", id: "chevy-captiva1-parts", img: "https://i.postimg.cc/NMgBNSyD/8h0a-Bn9L-1F0s-Hy-WEZSLfnhaqer-Kq-Kxj0Rp-SDjapvv-0z-LWJcn-SH19DCH-In-KOCt-N4s-Wd6Q9b4KGl-NDJp0vc-Ow.png" },
        "labo": { name: "Chevrolet Labo", id: "chevy-labo-parts", img: "https://i.postimg.cc/NMgBNSyD/8h0a-Bn9L-1F0s-Hy-WEZSLfnhaqer-Kq-Kxj0Rp-SDjapvv-0z-LWJcn-SH19DCH-In-KOCt-N4s-Wd6Q9b4KGl-NDJp0vc-Ow.png" },
        "epica": { name: "Chevrolet Epica", id: "chevy-epica-parts", img: "https://i.postimg.cc/NMgBNSyD/8h0a-Bn9L-1F0s-Hy-WEZSLfnhaqer-Kq-Kxj0Rp-SDjapvv-0z-LWJcn-SH19DCH-In-KOCt-N4s-Wd6Q9b4KGl-NDJp0vc-Ow.png" },
        "epika": { name: "Chevrolet Epica", id: "chevy-epica-parts", img: "https://i.postimg.cc/NMgBNSyD/8h0a-Bn9L-1F0s-Hy-WEZSLfnhaqer-Kq-Kxj0Rp-SDjapvv-0z-LWJcn-SH19DCH-In-KOCt-N4s-Wd6Q9b4KGl-NDJp0vc-Ow.png" },
        "sobol": { name: "GAZ Sobol", id: "sobol-parts", img: "https://i.postimg.cc/VLj18zjV/orig-(4).png" }
    };
    
    let q = synonyms[qRaw] || qRaw; 
    let r = document.getElementById('search-results'); 
    let c = document.getElementById('content-area'); 
    let cb = document.getElementById('clearSearchBtn'); 
    let qc = document.getElementById('quick-chips'); 
    let sC = document.querySelector('.slider-container'); 
    let bn = document.querySelector('.bottom-nav');
    
    if (qRaw.length > 0) cb.classList.add('show'); else cb.classList.remove('show');
    
    if (!searchActive) { 
        searchActive = true; 
        window.history.pushState({ search: true }, ""); 
        c.classList.add('hidden'); 
        if(sC) sC.style.display = 'none'; 
        r.classList.remove('hidden'); 
        qc.classList.remove('hidden');
        if(bn) bn.style.display = 'none'; 
        tg.BackButton.show(); 
        let bb = document.getElementById('back-btn'); if(bb) bb.style.display = 'flex'; 
    }
    
    if (qRaw.length > 0) {
        qc.style.display = 'none'; 
        let htmlResult = '';

        for(let key in carModelsIndex) {
            if(q.includes(key) || key.includes(q)) {
                let carInfo = carModelsIndex[key];
                htmlResult += `
                <div class="search-item" onclick="exitSearch(); showSection('${carInfo.id}')" style="background: rgba(212, 175, 55, 0.15); border: 1px solid var(--luxury-gold); margin-bottom: 10px;">
                    <img src="${carInfo.img}" style="background:transparent; border-radius:8px; padding:2px;">
                    <div class="search-info">
                        <h4 style="color:var(--luxury-gold); font-size:15px; margin:0 0 4px;"><svg class="uic" aria-hidden="true"><use href="#i-car"></use></svg>${carInfo.name}</h4>
                        <p style="color:white; font-size:11px; margin:0; opacity:0.8;">Barcha ehtiyot qismlarni ko'rish ➔</p>
                    </div>
                </div>`;
                break; 
            }
        }

        // 🔎 CHIDAMLI QIDIRUV (2026.09) — mijoz nomni xato yozsa ham topadi.
        //    Butun mantiq fayl oxiridagi `smart-search-2026-js` qatlamida.
        //    Qatlam yuklanmagan bo'lsa — eski oddiy `includes` yo'liga qaytamiz
        //    (ya'ni qidiruv hech qachon butunlay ishlamay qolmaydi).
        let filtMatched;
        if (typeof window._smartMatch === 'function') {
            filtMatched = window._smartMatch(qRaw);
        } else {
            filtMatched = productsDB.filter(x => {
                if (x.is_draft) return false;
                let n = x.name ? x.name.toLowerCase() : "";
                let desc = x.desc ? x.desc.toLowerCase() : "";
                let cat = (x.categories || []).join(' ').toLowerCase();
                let code = x.code ? x.code.toLowerCase() : "";
                return n.includes(q) || desc.includes(q) || cat.includes(q) || (code && (code.includes(q) || code.includes(qRaw)));
            });
        }
        // 🔎 5/9: foydalanuvchi tanlagan FILTR + SARALASH'ni qidiruv natijasiga qo'llaymiz
        let filt = (typeof window._sfsApply === 'function') ? window._sfsApply(filtMatched) : filtMatched;
        // Saralash/filtr panelini natija holatiga moslab ko'rsatamiz (mashina kartasi alohida — sanamaymiz)
        if (typeof window._sfsSyncToolbar === 'function') {
            window._sfsSyncToolbar(true, filtMatched.length, filt.length);
        }
        
        if (filt.length === 0 && htmlResult === '') {
            // Sabab: umuman moslik yo'qmi yoki faqat filtr hammasini kesib tashladimi?
            if (filtMatched.length > 0 && typeof window._sfsHasActiveFilters === 'function' && window._sfsHasActiveFilters()) {
                r.innerHTML = window._emptyState({ title: "Filtrga mos tovar yo'q", desc: "'" + qRaw + "' bo'yicha " + filtMatched.length + " ta tovar bor, lekin tanlangan filtrlarga mos kelmadi.", btnText: "Filtrlarni tozalash", btnAction: "window._sfsReset()" });
            } else {
                r.innerHTML = window._emptyState({ title: "Hech narsa topilmadi", desc: "'" + qRaw + "' bo'yicha tovar yo'q. Boshqa nomdan qidirib ko'ring.", btnText: "Katalogga o'tish", btnAction: "exitSearch();showCatalog()" });
            }
        } else {
            htmlResult += filt.map(x => {
                let np = x.name.split('·');
                let mn = np[0] ? np[0].trim() : x.name;
                // Reyting / chegirma meta (mavjud bo'lsa) — natija qatorini boyitadi (regressiyasiz)
                let _ri = (window.productRatings && window.productRatings[x.id]) ? window.productRatings[x.id] : null;
                let _rv = _ri ? _ri.avg : parseFloat(x.rating);
                let _rc = _ri ? _ri.count : x.ratingCount;
                let _metaBits = '';
                if (_rv && _rv > 0) _metaBits += `<span class="sr-rating">${(typeof icon==='function'?icon('star'):'★')} ${Math.round(_rv*10)/10}${_rc?` <i>(${_rc})</i>`:''}</span>`;
                if (x.oldPrice && Number(x.oldPrice) > Number(x.price)) {
                    let _pct = Math.round((1 - Number(x.price)/Number(x.oldPrice)) * 100);
                    if (_pct > 0) _metaBits += `<span class="sr-disc">-${_pct}%</span>`;
                }
                let _metaHTML = _metaBits ? `<div class="sr-meta">${_metaBits}</div>` : '';
                return `<div class="search-item" onclick="openProduct(${x.id})">
                    <img src="${_thumb(x.img, 120)}" loading="lazy" decoding="async" data-full="${(x.img||'').replace(/"/g,'&quot;')}" onload="this.style.opacity=1" onerror="window._imgFallback(this)">
                    <div class="search-info">
                        <h4>${mn}</h4>
                        <p class="price">${x.price.toLocaleString()} so'm</p>
                        ${_metaHTML}
                    </div>
                </div>`;
            }).join('');
            r.innerHTML = htmlResult;
        }
    } else { 
        qc.style.display = 'flex'; 
        // Bo'sh so'rov: saralash/filtr panelini yashiramiz (chiplar bo'sh so'rovda ko'rinadi)
        if (typeof window._sfsSyncToolbar === 'function') window._sfsSyncToolbar(false, 0, 0);
        r.innerHTML = `<div class="empty-search"><p>Ehtiyot qism yoki mashina nomini yozing...</p></div>`; 
    }
};

// Keshni tozalash funksiyasi
window.clearAppCache = () => {
    // Agar dastur qotsa, shu tugma bosilsa o'ziga keladi
    if(typeof tg !== 'undefined' && tg.showConfirm) {
        tg.showConfirm("Dasturni yangilaymizmi? (Savat va saqlanganlar o'chib ketmaydi)", function(ok) {
            if(ok) {
                showToast("Yangilanmoqda...", "success");
                setTimeout(() => { window.location.reload(true); }, 800);
            }
        });
    } else {
        window.location.reload(true);
    }
};
    function clearSearch() { document.getElementById('searchInput').value = ''; searchProducts(); document.getElementById('searchInput').focus(); }
    function applyQuickSearch(t) { document.getElementById('searchInput').value = t; searchProducts(); }
    function exitSearch() { searchActive = false; document.getElementById('searchInput').value = ''; if (typeof window._sfsSyncToolbar === 'function') window._sfsSyncToolbar(false, 0, 0); document.getElementById('search-results').classList.add('hidden'); document.getElementById('quick-chips').classList.add('hidden'); document.getElementById('clearSearchBtn').classList.remove('show'); document.getElementById('content-area').classList.remove('hidden'); let sC = document.querySelector('.slider-container'); if(sC) sC.style.display = (historyStack[historyStack.length - 1] === 'main-menu') ? 'block' : 'none'; let bn = document.querySelector('.bottom-nav');if(bn) { bn.style.display = ''; } updateBtns(); }

    function updateCartBadge() { let tot = Object.values(cart).reduce((a,b)=>a+b,0); let b = document.getElementById('nav-badge'); b.innerText = tot; if(tot > 0) { b.classList.add('show'); b.classList.add('idle'); b.classList.remove('pulse'); void b.offsetWidth; b.classList.add('pulse'); } else { b.classList.remove('show'); b.classList.remove('idle'); } }
    function addToCart(id) { cart[id] = (cart[id] || 0) + 1; saveLocalCart(); updateCartBadge(); tg.HapticFeedback.impactOccurred('medium'); showToast('Savatda!'); }
    // HTML ni buzmaslik uchun Magnit Kapsulani JS orqali o'zimiz menyuga joylaymiz
    document.addEventListener('DOMContentLoaded', () => {
        let nav = document.querySelector('.bottom-nav');
        if(nav && !document.getElementById('nav-indicator')) {
            let indicator = document.createElement('div');
            indicator.id = 'nav-indicator';
            indicator.className = 'nav-indicator';
            nav.appendChild(indicator);
            // Ilova ochilganda birinchi ikonka ustiga borib turishi uchun:
            setTimeout(() => updateNav('nav-home'), 100);
        }
    });

    // ──────────────────────────────────────────────────────────────
    // 🧲 Sariq SHISHA kapsulani faol tugma ustiga ANIQ joylashtirish.
    //   'offset*' (layout) qiymatlaridan foydalanamiz — ular CSS transform
    //   (scale/translate) ta'sirida o'zgarmaydi. Shu sababli:
    //     • kapsula tugma markaziga AYNAN tushadi (scale(1.1) buzmaydi),
    //     • aktiv tugmaning -6px ko'tarilishi hisobga olinadi (LIFT),
    //     • iPhone safe-area paddingidan MUSTAQIL (vertikal bo'shliq yo'q).
    //   Natija: kapsula tugma hududini to'liq va TEKIS qoplaydi (iOS+Android).
    // ──────────────────────────────────────────────────────────────
    window._activeNavId = window._activeNavId || 'nav-home';
    function positionNavIndicator(it) {
        const indicator = document.getElementById('nav-indicator');
        const nav = document.querySelector('.bottom-nav');
        if (!indicator || !nav || !it) return;
        const LIFT = 0;       // iOS (Liquid Glass) menyu: faol tugma sakramaydi
        const INSET_X = 2;    // kapsula tugma ustunini deyarli to'liq qoplaydi
        const CAP_H = 54;     // CSS dagi .nav-item balandligi bilan bir xil
        const w = Math.max(0, it.offsetWidth - INSET_X * 2);
        const left = it.offsetLeft + INSET_X;
        const top = it.offsetTop + it.offsetHeight / 2 - CAP_H / 2 - LIFT;
        indicator.style.width = w + 'px';
        indicator.style.height = CAP_H + 'px';
        indicator.style.transform = `translate(${left}px, ${top}px)`;
    }

    // Eskining o'rniga yangi Suyuq Navigatsiya funksiyasi
    window.updateNav = function(id) {
        document.querySelectorAll('.nav-item').forEach(e => e.classList.remove('active'));
        if(id) {
            let it = document.getElementById(id);
            if(it) {
                it.classList.add('active');
                window._activeNavId = id;
                try { Haptics.selection(); } catch(e) {}
                positionNavIndicator(it);
            }
        }
    };

    // Ekran o'lchami / orientatsiya o'zgarsa kapsulani qayta hisoblaymiz
    // (klaviatura ochilishi, qurilma burilishi, oyna o'lchami — iOS+Android).
    let _navRecalcT;
    function _recalcNavIndicator(delay) {
        clearTimeout(_navRecalcT);
        _navRecalcT = setTimeout(() => {
            const it = document.getElementById(window._activeNavId);
            if (it && it.classList.contains('active')) positionNavIndicator(it);
        }, delay || 120);
    }
    window._recalcNavIndicator = _recalcNavIndicator;
    window.addEventListener('resize', () => _recalcNavIndicator(120));
    window.addEventListener('orientationchange', () => _recalcNavIndicator(280));
    // Shriftlar kech yuklansa kenglik biroz o'zgaradi — yuklangach to'g'rilaymiz
    if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(() => _recalcNavIndicator(60));
    }
    function showSection(id) { document.querySelectorAll('#content-area > div').forEach(d => { d.classList.add('hidden'); d.classList.remove('animate-slide-up'); }); let t = document.getElementById(id); if (t && window._a1FillGrid) { try { window._a1FillGrid(t); } catch(e){} } if(t) { t.classList.remove('hidden'); t.classList.add('animate-slide-up'); } if (historyStack[historyStack.length - 1] !== id) { historyStack.push(id); window.history.pushState({ section: id }, ""); } let sC = document.querySelector('.slider-container'); if(sC) sC.style.display = (id === 'main-menu') ? 'block' : 'none'; if(searchActive) exitSearch(); updateBtns(); }
    function showCatalog() { if(activeModal) closeModal(); updateNav('nav-catalog'); showSection('katalog-menu'); }
       function showProfile() { 
    if(activeModal) closeModal(); 
    updateNav('nav-profile'); 
    showSection('profile-section');
    try { var _bt = document.getElementById('pf-build-tag'); if (_bt) _bt.textContent = 'Avto A1 · ' + (window.AVTO_BUILD || '?'); } catch(e){}
    initVipCardGlow(); // ← mana shu
    try { if (window.Phase2) window.Phase2.renderProfile(); } catch(e){}
}
    
    function showMyOrders() { closeModal(); renderMyOrders(); showSection('my-orders-section'); }
    window._moSectionOpen = function () { var el = document.getElementById('my-orders-section'); return !!(el && !el.classList.contains('hidden')); };
    // Tafsilot ochiq turganda holat o'zgarsa (admin qabul qildi) — bosqichlar darhol yangilanadi.
    window._moRefreshDetail = function () {
        try {
            var o = (myOrders || []).find(function (x) { return x && x.id == currentOpenOrderId; });
            if (!o) return;
            var el = document.getElementById('od-status');
            var html = getTimelineHTML(o.status || 'kutilmoqda');
            if (el && el.getAttribute('data-st') !== (o.status || 'kutilmoqda')) { el.innerHTML = html; el.setAttribute('data-st', o.status || 'kutilmoqda'); }
            if (window._renderOrderCancel) window._renderOrderCancel(o);
        } catch (e) {}
    };

// ==========================================
    // TOZALANGAN SAVAT VA TO'LOV MANTIQI
    // ==========================================
    function renderCartItems() {
        let c = document.getElementById('cart-items-container'); 
        let b = document.getElementById('main-checkout-btn'); 
        let t = 0; 
        c.innerHTML = '';
        if(Object.keys(cart).length === 0) { 
            c.innerHTML = window._emptyState({
                icon: '<svg viewBox="0 0 24 24"><path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z"/></svg>',
                title: "Savatingiz bo'sh",
                desc: "Hozircha hech narsa qo'shmadingiz. Eng yaxshi tovarlarni tanlab, savatga qo'shing.",
                btnText: "Xaridni boshlash",
                btnAction: "closeModal(); showCatalog()"
            }); 
            if(b) b.style.display = 'none'; 
        } else {
            for(let fullId in cart) { 
                let [baseId, carOpt] = String(fullId).split('||');
                let p = productsDB.find(x => x.id == baseId); 
                if(!p) continue; 
                t += p.price * cart[fullId]; 
                let displayName = carOpt && carOpt !== "Universal" && carOpt !== "undefined" ? `${p.name} <span style="color:var(--luxury-gold); font-size:11px;">(${carOpt})</span>` : p.name;
                // DIQQAT: Xatolik aynan shu tugmada yashiringan edi, to'g'irlandi!
                c.innerHTML += `<div class="cart-row"><div class="cart-content-wrap"><div class="cart-info"><h4>${displayName}</h4><span style="color:var(--luxury-gold); font-weight:700;">${(p.price * cart[fullId]).toLocaleString()} so'm</span></div><div class="cart-controls"><button onclick="chg('${fullId}',-1)">-</button><span class="cart-qty" style="color:var(--text-main); font-weight:bold; width:20px; text-align:center;">${cart[fullId]}</span><button onclick="chg('${fullId}',1)">+</button></div></div><div class="swipe-delete" onclick="chg('${fullId}', -${cart[fullId]})">🗑</div></div>`; 
            } 
            if(b) b.style.display = 'block';
        } 
        let tSum = document.getElementById('cart-total-sum');
        if(tSum) tSum.innerText = t.toLocaleString() + " so'm";
        window._cartTotal = t;   // 🔢 count-up animatsiyasi uchun (cart ochilganda)
        // 🌟 PROGRESS BAR HISOB-KITOBI
    let pWrap = document.getElementById('cart-progress-wrap');
    let pBar = document.getElementById('cart-progress-bar');
    let pMsg = document.getElementById('cart-progress-msg');
    
    if(pWrap && pBar && pMsg) {
        if(t > 0) {
            pWrap.style.display = 'block';
            let target = (window.VIP && window.VIP.freeDeliveryTarget) ? window.VIP.freeDeliveryTarget() : 3000000;
            let percent = (t / target) * 100;
            if(percent >= 100) {
                pBar.style.width = '100%';
                pBar.style.background = '#30d158';
                pBar.style.boxShadow = '0 0 15px #30d158';
                pMsg.innerHTML = '🎉 Tabriklaymiz! Yetkazib berish <b>BEPUL</b>!';
                pMsg.style.color = '#30d158';
                if(typeof tg !== 'undefined' && tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
            } else {
                pBar.style.width = percent + '%';
                pBar.style.background = 'linear-gradient(90deg, #ff453a, #ff9500)';
                pBar.style.boxShadow = 'none';
                pMsg.innerHTML = `Yetkazib berish bepul bo'lishi uchun yana <b>${(target - t).toLocaleString()} so'm</b> qoldi`;
                pMsg.style.color = 'var(--luxury-gold)';
            }
        } else {
            pWrap.style.display = 'none';
        }
    }
    }

    function chg(fullId, d) { 
        let [baseId, carOpt] = String(fullId).split('||');
        let p = productsDB.find(x => x.id == baseId);
        if(!p) return;
        
        let st = 10;
        if (p.product_type === 'razmerli' && p.sizes) {
            let sizeObj = p.sizes.find(s => s.size === carOpt);
            if(sizeObj) st = sizeObj.stock;
        } else {
            st = p.stock !== undefined ? p.stock : 10;
        }
        
        let totalInCart = 0;
        for(let cid in cart) { if(cid.startsWith(baseId + "||" + (carOpt||""))) totalInCart += cart[cid]; }
        
        if(d > 0 && totalInCart >= st) { showToast("Omborda bunday ko'p emas", "warning"); return; }
        cart[fullId] = (cart[fullId] || 0) + d; 
        if(cart[fullId] <= 0) delete cart[fullId]; 
        saveLocalCart(); updateCartBadge(); renderCartItems(); 
    }

    // 🎯 Yetkazib berish turiga qarab to'lov usullari kartochkalarini ko'rsatish/yashirish.
    //   To'lov usullari endi FAQAT ikkita: Payme va naqd pul (karta orqali
    //   o'tkazma olib tashlandi). 'bts' -> faqat Payme (naqd yo'q).
    function applyPaymentMethodVisibility() {
        var elApp  = document.getElementById('pay-opt-app');
        var elCash = document.getElementById('pay-opt-cash');
        // .pay-method-card CSS'ida display:flex !important — shuning uchun ko'rsatish/yashirishda
        // ham 'important' bilan boshqaramiz.
        var show = function(el){ if(el) el.style.setProperty('display', 'flex', 'important'); };
        var hide = function(el){ if(el) el.style.setProperty('display', 'none', 'important'); };

        var method = (window.selectedDelivery && window.selectedDelivery.method) || null;
        if (method === 'bts') {
            // BTS pochta filialiga jo'natishdan oldin to'lov olinadi — naqd YO'Q.
            show(elApp); hide(elCash);
        } else {
            // Kuryer (manzilga) yoki noma'lum holat — Payme va naqd pul.
            show(elApp); show(elCash);
        }
    }

    function openPaymentModal() { 
        if (Object.keys(cart).length === 0) return; 
        if (!myProfile.phone) { 
            showToast("Raqam kiriting!", "warning"); 
            setTimeout(() => { closeModal(); showProfile(); setTimeout(() => openModal('profileEditModal'), 300); }, 1500); 
            return; 
        } 
        
        document.getElementById('cartModal').style.display = 'none'; 
        document.getElementById('payment-options').classList.remove('hidden'); 
        var _appDet = document.getElementById('app-pay-details');
        if(_appDet) _appDet.classList.add('hidden');

        // 🎯 YETKAZIB BERISH TURIGA QARAB TO'LOV USULLARINI CHEKLASH
        //   - Kuryer (manzilga): Payme va naqd pul.
        //   - BTS Pochta filialiga: oldindan to'lash kerak -> "Naqd pul" YASHIRILADI,
        //     faqat Payme qoladi.
        //   Eslatma: .pay-method-card CSS'ida display:flex !important bo'lgani uchun
        //   yashirishda ham 'important' ishlatamiz (aks holda !important ustun keladi).
        applyPaymentMethodVisibility();

        // Jami summani SAVATDAN QAYTA hisoblaymiz (eskirgan _cartTotal'ga tayanmaymiz)
        var _sum = _recalcCartTotal();
        var _payDisp = document.getElementById('pay-amount-display');
        if(_payDisp) _payDisp.textContent = _sum.toLocaleString() + " so'm";
        
        let m = document.getElementById('paymentModal'); 
        m.style.display = 'flex'; 
        document.body.style.overflow = 'hidden';
        // 🧭 Nazad bitta qadam orqaga: oldingi oynani (yetkazish/savat) stack'ga qo'yamiz
        window._modalStack = window._modalStack || [];
        window._modalStack.push(activeModal || 'cartModal');
        activeModal = 'paymentModal';
        window.history.pushState({ modal: 'paymentModal' }, ""); 
        tg.BackButton.show(); 
        updateBtns(); 
    }
    
    // 🔢 Savat jami summasini doim TOZA hisoblaydi (manba: cart + productsDB)
    function _recalcCartTotal() {
        var t = 0;
        try {
            for (var fullId in cart) {
                var baseId = String(fullId).split('||')[0];
                var p = productsDB.find(function(x){ return x.id == baseId; });
                if (p) t += p.price * cart[fullId];
            }
        } catch(e) {}
        window._cartTotal = t;
        return t;
    }
    
    function selectPayment(t) { 
        var _gross = _recalcCartTotal();
        // 🎁 Cashback ishlatilgan bo'lsa — ko'rsatiladigan summa TO'LANADIGAN summa
        var _cbUse = 0;
        try { if (window._cbGetApplied) _cbUse = window._cbGetApplied(_gross); } catch(e) {}
        var _sum = Math.max(0, _gross - _cbUse);
        var _cbLine = _cbUse > 0 ? ("\nCashback: −" + _cbUse.toLocaleString() + " so'm") : '';
        // 🎁 «Sizga qaytadi» — naqd to'lovda oyna emas, NATIVE dialog chiqadi,
        //    shuning uchun cashback va'dasi shu matnga ham qo'shiladi.
        var _cbEarnLine = '';
        try {
            var _r = window._cashbackRate ? window._cashbackRate() : 0.008;
            var _e = Math.round(_sum * _r);
            if (_e > 0) {
                _cbEarnLine = "\nSizga qaytadi: " + _e.toLocaleString() + " so'm cashback ("
                    + (+(_r * 100).toFixed(2)) + '%)';
            }
        } catch (e) {}
        if(t === 'cash') { 
            // Naqd pul — tasdiqlash so'rash
            tg.showConfirm("Buyurtmani tasdiqlaysizmi?\n\nTovarlar: " + _gross.toLocaleString() + " so'm" + _cbLine +
                "\nTo'lanadi: " + _sum.toLocaleString() + " so'm" + _cbEarnLine +
                "\nTo'lov: Naqd pul (yetkazilganda)", function(ok) {
                if(ok) {
                    confirmOrder('Naqd pul (yetkazilganda)');
                }
            });
        } else if(t === 'app' || t === 'card') {        } else if(t === 'app') {
            document.getElementById('payment-options').classList.add('hidden');
            document.getElementById('app-pay-details').classList.remove('hidden');
            // Summani ko'rsatish
            var el = document.getElementById('app-pay-amount');
            if(el) el.textContent = _sum.toLocaleString() + " so'm";
        }
    }
    // Payme oynasidan ORTGA — to'lov usullari ro'yxatiga qaytish
    function backToPaymentOptions() {
        var _ad = document.getElementById('app-pay-details'); if (_ad) _ad.classList.add('hidden');
        document.getElementById('payment-options').classList.remove('hidden');
    }
    function copyCard() { 
        navigator.clipboard.writeText("5614681874796349").then(function(){
            showToast("Karta raqami nusxalandi!", "success");
        }).catch(function(){ 
            // Fallback: manual select
            var t = document.createElement('textarea');
            t.value = "5614681874796349";
            document.body.appendChild(t);
            t.select();
            document.execCommand('copy');
            document.body.removeChild(t);
            showToast("Nusxalandi!", "success"); 
        });
    }
    // Payme ilovasini ochish (deeplink). Click olib tashlandi — faqat Payme.
    function openPayApp(provider) {
        tg.HapticFeedback.impactOccurred('medium');
        if(provider === 'payme') {
            // Payme ilovasini ochish — P2P o'tkazma sahifasi
            try { tg.openLink('https://payme.uz/home/main'); } catch(e) { window.open('https://payme.uz', '_blank'); }
            showToast("Payme ochildi. Kartaga o'tkazing!", "success");
        }
    }

    // (O'CHIRILDI: eski `confirmOrder` — u brauzerda stokni o'zi kamaytirar va
    //  adminga faqat ADMIN_IDS[0] ga xabar yuborardi. Pastdagi
    //  `window.confirmOrder` (server-authoritative, Worker /order-commit) uni
    //  baribir almashtirib qo'yardi, ya'ni bu kod hech qachon ishlamasdi, lekin
    //  o'qiganni chalg'itardi.)

    function renderMyOrders() {
        let c = document.getElementById('orders-list-container');
        if (!c) return;
        let sub = document.getElementById('mo-subtitle');
        if (!myOrders || myOrders.length === 0) {
            if (sub) sub.textContent = '';
            c.innerHTML = window._emptyState({ icon: '<svg viewBox="0 0 24 24"><path d="M20 2H4c-1 0-2 .9-2 2v3.01c0 .72.43 1.34 1 1.69V20c0 1.1 1.1 2 2 2h14c.9 0 2-.9 2-2V8.7c.57-.35 1-.97 1-1.69V4c0-1.1-1-2-2-2zm-5 12H9v-2h6v2zm5-7H4V4h16v3z"/></svg>', title: "Buyurtmalar yo'q", desc: "Hali buyurtma bermagansiz. Birinchi buyurtmangizni hoziroq bering!", btnText: "Xarid qilish", btnAction: "closeModal(); showCatalog()" });
            return;
        }
        // 🧭 ENG YANGISI TEPADA. Ilgari tartib umuman yo'q edi: RTDB kalitlari
        //    (eski "0,1,2…" + yangi "1729…-hash") aralash kelib, yangi buyurtma
        //    ro'yxat OXIRIDA yo'qolib qolardi.
        const T = function (o) {
            var c0 = Number(o && o.createdAt); if (c0 > 0) return c0;
            var n = parseInt(String(o && o.id != null ? o.id : ''), 10); return isFinite(n) ? n : 0;
        };
        const list = myOrders.filter(Boolean).slice().sort((a, b) => T(b) - T(a));
        const ST = { kutilmoqda: 'Kutilmoqda', qabul: 'Qabul qilindi', yolda: "Yo'lda", yetkazildi: 'Yetkazildi', bekor_qilingan: 'Bekor qilingan' };
        const STEP = { kutilmoqda: 1, qabul: 2, yolda: 3, yetkazildi: 4 };
        const active = list.filter(o => ['kutilmoqda', 'qabul', 'yolda'].includes(o.status || 'kutilmoqda')).length;
        if (sub) sub.textContent = list.length + ' ta buyurtma' + (active ? ' \u00B7 ' + active + ' ta faol' : '');

        const now = new Date();
        const today = now.toLocaleDateString('uz-UZ');
        const yest = new Date(now.getTime() - 864e5).toLocaleDateString('uz-UZ');
        const thumb = (typeof window._thumb === 'function') ? window._thumb : (u => u);
        const BOX = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8l-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8M12 13v8"/></svg>';
        let lastDay = null;

        c.innerHTML = list.map((o, i) => {
            const st = o.status || 'kutilmoqda';
            let lines = [];
            try { lines = window._aoLines ? window._aoLines(o) : []; } catch (e) {}
            const first = lines.find(l => l.img) || null;
            const nItems = lines.length || (Array.isArray(o.itemDetails) ? o.itemDetails.length : Object.keys(o.items || {}).length);
            const pic = first
                ? '<img src="' + escHtml(thumb(first.img, 160)) + '" alt="" loading="lazy" decoding="async" onerror="this.remove()">'
                : '';
            const more = nItems > 1 ? '<i class="mo-more">+' + (nItems - 1) + '</i>' : '';
            const names = lines.slice(0, 2).map(l => escHtml(l.name)).join(', ') + (lines.length > 2 ? '\u2026' : '');
            const step = STEP[st] || 0;
            const prog = (st !== 'bekor_qilingan' && st !== 'yetkazildi')
                ? '<span class="mo-prog" aria-hidden="true"><i style="width:' + (step / 4 * 100) + '%"></i></span>' : '';
            const dk = o.date || '';
            let head = '';
            if (dk !== lastDay) {
                lastDay = dk;
                head = '<div class="mo-day" style="--i:' + i + '">' + escHtml(dk === today ? 'Bugun' : dk === yest ? 'Kecha' : (dk || 'Sanasiz')) + '</div>';
            }
            return head + '<button type="button" class="mo-o mo-st-' + escHtml(st) + '" style="--i:' + i + '" onclick="openOrderDetails(\'' + escHtml(String(o.id)) + '\')">' +
                '<span class="mo-pic">' + BOX + pic + more + '</span>' +
                '<span class="mo-mid">' +
                    '<span class="mo-code">#' + escHtml(o.code || o.id) + '</span>' +
                    '<span class="mo-names">' + (names || (nItems + ' ta mahsulot')) + '</span>' +
                    '<span class="mo-meta">' + escHtml(String(o.time || '').slice(0, 5)) + (nItems ? ' \u00B7 ' + nItems + ' ta' : '') + '</span>' +
                '</span>' +
                '<span class="mo-end">' +
                    '<span class="mo-pill">' + (ST[st] || escHtml(st)) + '</span>' +
                    '<span class="mo-sum">' + (Number(o.total) || 0).toLocaleString() + '<small>so\'m</small></span>' +
                '</span>' +
                '<span class="mo-chev">\u203A</span>' + prog +
            '</button>';
        }).join('');
    }

// =====================================
    // CHAT: BUYURTMA TAFSILOTI VA YOZISHMA
    // =====================================
    let currentOpenOrderId = null; // Hozir qaysi buyurtma ochiqligini bilish uchun

    window.openOrderDetails = (id) => { 
        let o = myOrders.find(x => x.id === id); 
        if(!o) return; 
        
        currentOpenOrderId = id; // ID ni saqlab qo'yamiz
        
        document.getElementById('od-code').innerText = "Buyurtma: #" + (o.code || o.id); 
        document.getElementById('od-date').innerText = o.date + " " + o.time; 
        document.getElementById('od-status').innerHTML = getStatusHTML(o.status || 'kutilmoqda'); 
        
        let iH = ''; 
        for(let fullId in o.items) { 
                    let [baseId, carOpt] = fullId.split('||');
                    let p = productsDB.find(x => x.id == baseId); 
                    if(p) {
                        let carOptHTML = carOpt && carOpt !== "Universal" ? `<span class="od-car-opt">[${escHtml(carOpt)}]</span>` : '';
                        let imgSrc = p.img || p.image || '';
                        let imgTag = imgSrc 
                            ? `<img class="od-item-img" src="${imgSrc}" alt="${escHtml(p.name)}" onerror="this.style.display='none'">` 
                            : `<div class="od-item-img" style="display:flex;align-items:center;justify-content:center;font-size:20px;color:var(--text-muted);">📦</div>`;
                        iH += `<div class="od-item">
                            ${imgTag}
                            <div class="od-item-info">
                                <div class="od-item-name">${escHtml(p.name)} ${carOptHTML}</div>
                                <div class="od-item-meta">
                                    <span class="od-item-qty">×${o.items[fullId]}</span>
                                    <span class="od-item-price">${(p.price * o.items[fullId]).toLocaleString()} so'm</span>
                                </div>
                            </div>
                        </div>`; 
                    }
                }
        document.getElementById('od-items').innerHTML = iH; 
        document.getElementById('od-total').innerText = "Jami: " + o.total.toLocaleString() + " so'm"; 
        
        // Chat xabarlarini ekranga chiqarish
        renderChatMessages();
        
        openModal('orderDetailModal'); 
    }

        // 💬 PREMIUM CHAT: Xabarlarni chizish funksiyasi
    // 💬 PREMIUM CHAT: xabarlar endi ALOHIDA `order_chats/{uid}/{orderId}` tugunida
    //    (buyurtma yozuvi SERVER-OWNED bo'lgani uchun). Egasi faqat 'mijoz' nomidan
    //    yozadi; jonli listener orqali yangilanadi. Eski order.messages faqat
    //    O'QISH uchun zaxira (order_chats bo'sh bo'lsa).
    window.renderChatMessages = () => {
        let box = document.getElementById('od-chat-messages');
        if(!box) return;
        box.className = "chat-messages";

        let o = myOrders.find(x => x.id == currentOpenOrderId);
        var uid = window.currentUser;
        var oid = currentOpenOrderId;
        var legacy = (o && Array.isArray(o.messages)) ? o.messages : [];

        function paint(msgs) {
            if (!msgs || !msgs.length) {
                box.innerHTML = `<div style="text-align:center; color:gray; font-size:12px; margin: 20px 0;">Hali xabarlar yo'q. Savolingiz bo'lsa yozing...</div>`;
                return;
            }
            let chatHtml = '';
            msgs.forEach(function (msg) {
                let isMe = msg.sender === 'mijoz' || msg.sender === 'user';
                chatHtml += `
            <div style="display: flex; flex-direction: column; width: 100%; margin-bottom: 8px;">
                <div class="chat-bubble ${isMe ? 'chat-user' : 'chat-admin'}">
                    ${escHtml(msg.text)}
                    <span class="chat-time">${escHtml(msg.time || '')}</span>
                </div>
            </div>
            `;
            });
            box.innerHTML = chatHtml;
            setTimeout(() => { box.scrollTop = box.scrollHeight; }, 50);
        }

        // Avvalgi listenerni uzamiz (xotira oqishiga qarshi)
        if (window._custChatRef) { try { window._custChatRef.off('value'); } catch (e) {} window._custChatRef = null; }

        if (uid && oid != null && typeof db !== 'undefined' && db.ref) {
            try {
                window._custChatRef = db.ref('order_chats/' + uid + '/' + oid);
                window._custChatRef.on('value', function (snap) {
                    var val = snap.val();
                    var msgs = [];
                    if (val && typeof val === 'object') {
                        msgs = Object.keys(val).sort().map(function (k) { return val[k]; }).filter(Boolean);
                    }
                    if (!msgs.length && legacy.length) msgs = legacy;   // eski buyurtmalar uchun zaxira
                    paint(msgs);
                }, function () { paint(legacy); });
            } catch (e) { paint(legacy); }
        } else {
            paint(legacy);
        }
    };

    // 💬 PREMIUM CHAT: Xabar jo'natish tugmasi — order_chats ga push (sender:'mijoz')
    window.sendOrderMessage = () => {
        let input = document.getElementById('od-chat-input');
        if(!input) return;

        let text = input.value.trim();
        if(!text) return;
        if (!window.currentUser || currentOpenOrderId == null) return;

        let now = new Date();
        let timeString = now.getHours().toString().padStart(2, '0') + ":" + now.getMinutes().toString().padStart(2, '0');

        var _send = function () {
            try {
                db.ref('order_chats/' + window.currentUser + '/' + currentOpenOrderId)
                  .push({ sender: 'mijoz', text: text, time: timeString })
                  .catch(function () { try { showToast("Xabar saqlanmadi — qayta urinib ko'ring", "warning"); } catch (e) {} });
                input.value = '';   // jonli listener o'zi qayta chizadi
            } catch (e) {
                try { showToast("Xabar saqlanmadi — qayta urinib ko'ring", "warning"); } catch (e2) {}
            }
        };
        // Yozishdan oldin auth kafolatlanadi (qoidalar auth.uid === $uid ni talab qiladi)
        if (window._ensureAuth) { window._ensureAuth().then(_send, _send); }
        else _send();
    };

// =====================================
    // ADMIN: MIJOZ BILAN YOZISHMA (CHAT)
    // =====================================
    let currentAdminChatUid = null;
    let currentAdminChatOrderId = null;

// YANGI:
window.openAdminChat = (uid, orderId) => {
    currentAdminChatUid = uid;
    currentAdminChatOrderId = orderId;
    
    // Avval adminOrdersModal ni yashiramiz
    document.getElementById('adminOrdersModal').style.display = 'none';
    
    renderAdminChatMessages();
    
    // Keyin chatni ochamiz
    let m = document.getElementById('adminChatModal');
    m.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    activeModal = 'adminChatModal';
    window.history.pushState({ modal: 'adminChatModal' }, "");
    tg.BackButton.show();
    updateBtns();
}

    // Xabarlarni o'qib, ekranga chizish
    window.renderAdminChatMessages = () => {
        let box = document.getElementById('admin-chat-messages');
        box.innerHTML = '<p style="text-align:center; color:gray;">Yuklanmoqda...</p>';
    // ⚡ XOTIRA OQISHINI TUZATISH: eski listenerni o'chirib, keyin yangisini ulaymiz
    if (window._adminChatRef) { try { window._adminChatRef.off('value'); } catch(e){} }
    // 💬 order_chats/{uid}/{orderId} — buyurtma SERVER-OWNED, chat alohida tugunda.
    window._adminChatRef = db.ref('order_chats/' + currentAdminChatUid + '/' + currentAdminChatOrderId);
    window._adminChatRef.on('value', snapshot => {
            var val = snapshot.val();
            var msgs = [];
            if (val && typeof val === 'object') {
                msgs = Object.keys(val).sort().map(function (k) { return val[k]; }).filter(Boolean);
            }
            if (msgs.length > 0) {
                let chatHtml = '';
                msgs.forEach(msg => {
                    let isMe = msg.sender === 'admin';
                    chatHtml += `
                            <div style="display: flex; justify-content: ${isMe ? 'flex-end' : 'flex-start'};">
                                <div style="max-width: 80%; padding: 8px 12px; border-radius: 12px; font-size: 13px; 
                                     background: ${isMe ? 'var(--luxury-gold)' : 'rgba(255,255,255,0.1)'}; 
                                     color: ${isMe ? '#000' : 'white'}; border-bottom-${isMe ? 'right' : 'left'}-radius: 2px;">
                                    ${escHtml(msg.text)}
                                    <div style="font-size: 9px; opacity: 0.7; text-align: right; margin-top: 4px;">${escHtml(msg.time)}</div>
                                </div>
                            </div>
                        `;
                });
                box.innerHTML = chatHtml;
            } else {
                box.innerHTML = `<div style="color: gray; text-align: center; font-size: 12px; margin-top: 20px;">Hali xabarlar yo'q.</div>`;
            }
            box.scrollTop = box.scrollHeight; // Har doim pastga tushirib qo'yish
        });
    }

    // Admindan xabar jo'natish — order_chats ga push (sender:'admin'). Admin initData
    // bilan auth bo'lgani uchun qoidalar bu yozuvga ruxsat beradi. Buyurtma yozuviga
    // (users/{uid}/orders) ENDI TEGMAYMIZ — u SERVER-OWNED.
    window.sendAdminMessage = () => {
        let input = document.getElementById('admin-chat-input');
        let text = input.value.trim();
        if(!text) return;
        if (!currentAdminChatUid || currentAdminChatOrderId == null) return;

        let now = new Date();
        let timeString = now.getHours().toString().padStart(2, '0') + ":" + now.getMinutes().toString().padStart(2, '0');

        // Kod (best-effort) — Telegram xabarida ko'rsatish uchun
        var _sentCode = currentAdminChatOrderId;
        try {
            (window.allFetchedOrders || []).some(function (o) {
                if (o && String(o.uI) === String(currentAdminChatUid) && String(o.id) === String(currentAdminChatOrderId)) {
                    _sentCode = o.code || currentAdminChatOrderId; return true;
                }
                return false;
            });
        } catch (e) {}

        var _send = function () {
            try {
                db.ref('order_chats/' + currentAdminChatUid + '/' + currentAdminChatOrderId)
                  .push({ sender: 'admin', text: text, time: timeString })
                  .then(function () {
                        input.value = '';   // jonli listener o'zi qayta chizadi
                        var _uidStr = String(currentAdminChatUid);
                        // 🔔 Ilova ichidagi bildirishnoma — HAR mijozga (ilova/saytdan Telegram'siz
                        //    buyurtma bergan mijoz ham javobni ko'radi). Bitta kalit — ro'yxat
                        //    ustidan yozilmaydi (admin yozish huquqi bor: phase2/notifications).
                        try {
                            var _nid = 'oc_' + String(currentAdminChatOrderId).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 60) + '_' + Date.now();
                            db.ref('users/' + _uidStr + '/phase2/notifications/' + _nid).set({
                                id: _nid, icon: '\uD83D\uDCE9', title: '#' + String(_sentCode).slice(0, 40) + ' buyurtma bo\u2018yicha javob',
                                text: text.slice(0, 300), date: Date.now(), read: false, kind: 'order_chat', orderId: String(currentAdminChatOrderId)
                            }).catch(function () {});
                        } catch (e) {}
                        // MIJOZGA TELEGRAM ORQALI XABAR — faqat Telegram hisobi bo'lsa (uid = Telegram ID)
                        if (/^[1-9]\d{2,19}$/.test(_uidStr)) tgProxySend({
                            chat_id: currentAdminChatUid,
                            text: `📩 <b>#${escTg(_sentCode)}</b> buyurtmangiz bo'yicha Admindan javob keldi:\n\n💬 <i>"${escTg(text)}"</i>\n\nJavob berish uchun Avto_A1 do'koniga kiring.`,
                            parse_mode: "HTML"
                        });
                  })
                  .catch(function () { showToast("Xabar saqlanmadi — qayta urinib ko'ring", "warning"); });
            } catch (e) { showToast("Xabar saqlanmadi — internetni tekshiring", "warning"); }
        };
        if (window._ensureAuth) { window._ensureAuth().then(_send, _send); }
        else _send();
    }
    
    function openAdminStats() {
        document.getElementById('adminModal').style.display = 'none';
        let sM = document.getElementById('adminStatsModal');
        sM.style.display = 'flex';
        activeModal = 'adminStatsModal';
        window.history.pushState({ modal: 'adminStatsModal' }, "");
        
        let c = document.getElementById('admin-stats-content');
        c.innerHTML = '<p style="text-align:center; margin-top:30px;"><span class="hourglass" style="transform:scale(0.5); display:inline-block;"></span></p>';
        
        db.ref('users').once('value', (s) => {
            let totalRevenue = 0;
            let todayRevenue = 0;
            let totalCustomers = 0;
            let productSales = {}; 
            let todayDate = new Date().toLocaleDateString('uz-UZ');

            if(s.exists()) {
                let us = s.val();
                totalCustomers = Object.keys(us).length;
                
                for(let uid in us) {
                    if(us[uid].orders) {
                        us[uid].orders.forEach(o => {
                            // Faqat muvaffaqiyatli 'yetkazildi' bo'lganlar daromadga qo'shiladi
                            if(o.status === 'yetkazildi') {
                                totalRevenue += o.total;
                                if(o.date === todayDate) todayRevenue += o.total;
                            }
                            
                            // Tovarlar reytingini hisoblash
                            if(o.items && o.status !== 'bekor_qilingan') {
                                for(let pid in o.items) {
                                    productSales[pid] = (productSales[pid] || 0) + o.items[pid];
                                }
                            }
                        });
                    }
                }
            }

            // Top 5 ta eng ko'p sotilgan tovarni saralash
            let topProducts = Object.keys(productSales)
                .map(id => ({ id: id, count: productSales[id] }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 5);

            let topHtml = topProducts.map(tp => {
                let p = productsDB.find(x => x.id == tp.id);
                let pName = p ? p.name : "O'chirilgan tovar";
                return `<div style="display:flex; justify-content:space-between; margin-bottom:8px; background:rgba(255,255,255,0.05); padding:12px; border-radius:12px; border:1px solid rgba(255,255,255,0.05);"><span>${pName}</span><span style="color:var(--luxury-gold); font-weight:800;">${tp.count} ta</span></div>`;
            }).join('');
            
            if(topHtml === '') topHtml = "<p style='color:gray; font-size:13px; text-align:center;'>Hali tovar sotilmagan.</p>";

            c.innerHTML = `
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px; margin-bottom: 15px;">
                    <div class="luxury-card" style="padding:15px; text-align:center; display:block;">
                        <div style="font-size:26px; margin-bottom:5px;">📈</div>
                        <div style="font-size:10px; color:var(--text-muted); text-transform:uppercase; letter-spacing:1px;">Bugungi savdo</div>
                        <div style="font-size:14px; font-weight:800; color:#34c759; margin-top:5px;">${todayRevenue.toLocaleString()} so'm</div>
                    </div>
                    <div class="luxury-card" style="padding:15px; text-align:center; display:block;">
                        <div style="font-size:26px; margin-bottom:5px;">👥</div>
                        <div style="font-size:10px; color:var(--text-muted); text-transform:uppercase; letter-spacing:1px;">Jami Mijozlar</div>
                        <div style="font-size:18px; font-weight:800; color:#fff; margin-top:5px;">${totalCustomers} kishi</div>
                    </div>
                </div>
                
                <div class="luxury-card" style="padding:20px; display:block; margin-bottom:25px; text-align:center; border: 1px solid rgba(212, 175, 55, 0.3);">
                    <div style="font-size:11px; color:var(--text-muted); text-transform:uppercase; margin-bottom:8px; letter-spacing:1px;">Umumiy savdo (tushum)</div>
                    <div style="font-size:26px; font-weight:800; color:var(--luxury-gold);">${totalRevenue.toLocaleString()} so'm</div>
                    <div style="font-size:10px; color:gray; margin-top:5px;">(Faqat yetkazib berilgan buyurtmalar)</div>
                </div>

                <h3 style="font-size:16px; margin-bottom:15px; color:white; display:flex; align-items:center; gap:8px;"><svg class="uic" aria-hidden="true"><use href="#i-award"></use></svg>Xit Savdolar (Top 5)</h3>
                ${topHtml}
            `;
        });
    }
    

// 🎛 ADMIN buyurtma filtrlari — iOS uslubidagi chiplar (faqat ko'rinish).
window._aoFilterBar = function () {
    var F = [['barchasi','Barchasi','var(--ao-gray)'],['kutilmoqda','Kutilmoqda','var(--ao-yellow)'],['qabul','Qabul','var(--ao-blue)'],['yolda',"Yo'lda",'var(--ao-orange)'],['yetkazildi','Yetkazildi','var(--ao-green)'],['bekor_qilingan','Bekor','var(--ao-red)']];
    return '<div class="ao-chips" role="tablist">' + F.map(function (f, i) {
        return '<button type="button" role="tab" aria-selected="' + (i === 0) + '" class="ao-chip' + (i === 0 ? ' is-active' : '') + '" style="--c:' + f[2] + '" onclick="filterAdminOrders(\'' + f[0] + '\', this)">' +
            '<i class="ao-dot"></i><span>' + f[1] + '</span><b class="ao-cnt" data-cnt="' + f[0] + '"></b></button>';
    }).join('') + '</div>';
};
window._aoUpdateCounts = function () {
    var all = window.allFetchedOrders || [], c = { barchasi: all.length };
    all.forEach(function (o) { var k = o.status || 'kutilmoqda'; c[k] = (c[k] || 0) + 1; });
    document.querySelectorAll('#adminOrdersModal .ao-cnt').forEach(function (el) {
        var n = c[el.getAttribute('data-cnt')] || 0; el.textContent = n ? n : '';
    });
};

// 🧭 ADMIN buyurtmalar: tartib + HAQIQIY (server) holat.
//  1) Tartib: server buyurtma id si "1729…-hash" ko'rinishida (matn). `b.id - a.id`
//     bunday id da NaN berib, tartibni buzardi — yangi buyurtmalar ro'yxat
//     o'rtasida yo'qolib qolardi. Endi createdAt (yoki id ning raqamli boshi).
//  2) Holat: `users/{uid}/orders` — faqat proyeksiya; eski oqimda o'zgargan
//     buyurtmalarda u eskirib qolishi mumkin (ekranda "Kutilmoqda", serverda
//     aslida "Bekor"). Admin `orders/` ni o'qiy oladi — ko'rsatishdan oldin
//     holatni o'sha yerdan olamiz. Xato bo'lsa — jim, eski xatti-harakat.
window._aoOrderTime = function (o) {
    var c = Number(o && o.createdAt);
    if (c > 0) return c;
    var n = parseInt(String(o && o.id != null ? o.id : ''), 10);
    return isFinite(n) ? n : 0;
};
window._aoSortOrders = function (arr) {
    return arr.sort(function (a, b) { return window._aoOrderTime(b) - window._aoOrderTime(a); });
};
window._aoCanonStatus = function (arr) {
    if (!arr || !arr.length || typeof db === 'undefined') return Promise.resolve(arr);
    var read = db.ref('orders').once('value').then(function (snap) {
        var all = (snap && snap.val()) || {};
        arr.forEach(function (o) {
            var c = all[String(o.uI) + '_' + String(o.id)];
            if (!c || typeof c !== 'object') return;
            var st = c.status || 'kutilmoqda';
            if ((o.status || 'kutilmoqda') !== st) { o._projStatus = o.status || 'kutilmoqda'; o.status = st; }
            if (!o.createdAt && c.createdAt) o.createdAt = c.createdAt;
        });
        return arr;
    }).catch(function () { return arr; });
    // Sekin tarmoqda ro'yxatni ushlab turmaymiz (3 s dan keyin bor ma'lumot bilan).
    var timeout = new Promise(function (res) { setTimeout(function () { res(arr); }, 3000); });
    return Promise.race([read, timeout]);
};
  function openAdminOrders() { 
    try { if (window._aoHideDetail) window._aoHideDetail(); } catch (e) {}
    document.getElementById('adminModal').style.display = 'none'; 
    let aM = document.getElementById('adminOrdersModal'); 
    aM.style.display = 'flex'; 
    activeModal = 'adminOrdersModal'; 
    window.history.pushState({ modal: 'adminOrdersModal' }, ""); 
    let c = document.getElementById('admin-orders-list'); 
    
    aM.querySelector('.modal-header h2').innerHTML = '📦 Buyurtmalar';
    
    c.innerHTML = `
        ${window._aoFilterBar()}
        <div id="admin-orders-render-box">${window._skel(6)}</div>
    `;

    window.allFetchedOrders = []; 

    window._getUsersSnap().then((s) => { 
        let aO = []; 
        if(s.exists()) { 
            let us = s.val(); 
            for(let uid in us) { 
                if(us[uid].orders) { 
                    let ph = us[uid].profile ? us[uid].profile.phone : ""; 
                    let nm = us[uid].profile ? us[uid].profile.name : ""; 
                    // Qotib qolishni oldini olish uchun Object.values ishlatamiz
                    let userOrdersArr = Array.isArray(us[uid].orders) ? us[uid].orders : Object.values(us[uid].orders);
                    userOrdersArr.forEach(o => { 
                        if(o && (o.id || o.code)) aO.push({ uI: uid, uN: nm, uP: ph, ...o }); 
                    }); 
                } 
            } 
        } 
        window._aoCanonStatus(aO).then(() => {
            window._aoSortOrders(aO);
            window.allFetchedOrders = aO;
            window.lastOrdersRef = null;
            renderAdminOrdersUI(aO);
        });
    }); 
}
    
// ✅ Tasdiq oynasi (Telegram'da tg.showConfirm, brauzerda window.confirm).
window._a1Confirm = function (text) {
    return new Promise(function (resolve) {
        try {
            if (typeof tg !== 'undefined' && tg.showConfirm && tg.isVersionAtLeast && tg.isVersionAtLeast('6.2')) {
                tg.showConfirm(text, function (ok) { resolve(!!ok); });
                return;
            }
        } catch (e) {}
        try { resolve(window.confirm(text)); } catch (e) { resolve(false); }
    });
};

// 🧾 Buyurtma tarkibi matni — SERVER `itemDetails` afzal (yangi buyurtmalarda
//    `items` kalitlari "l_<hash>" — ulardan nom tiklab bo'lmaydi; ilgari shu
//    sabab mijoz xabarida tovarlar ro'yxati BO'SH chiqardi).
window._orderDetailLines = function (o) {
    if (o && Array.isArray(o.itemDetails) && o.itemDetails.length) {
        var lines = '';
        o.itemDetails.forEach(function (it) {
            var _opt = (it.size && it.size !== 'Universal') ? it.size : (it.carModel || ''); var sz = _opt ? ' (' + _opt + ')' : '';
            var line = (it.lineTotal != null) ? it.lineTotal : ((Number(it.unitPrice) || 0) * (Number(it.qty) || 0));
            lines += "\n\u25AA\uFE0F " + it.name + sz + " \u2014 " + (it.qty || 0) + " x " +
                (Number(it.unitPrice) || 0).toLocaleString() + " = " + (Number(line) || 0).toLocaleString() + " so'm";
        });
        return { lines: lines, total: Number(o.total) || 0 };
    }
    return window._orderItemsSummary((o && o.items) || {});
};

// ⌛ Holat soatchasi matnlari: [jarayon, natija].
window._aoStatusLbl = function (st, from) {
    if (st === 'qabul') return ['Qabul qilinmoqda\u2026', 'Qabul qilindi'];
    if (st === 'yolda') return ["Yo'lga chiqarilmoqda\u2026", "Yo'lga chiqdi"];
    if (st === 'yetkazildi') return ['Yetkazildi deb belgilanmoqda\u2026', 'Yetkazib berildi'];
    if (st === 'bekor_qilingan') return from === 'yetkazildi' ? ['Qaytarilmoqda\u2026', 'Qaytarildi'] : ['Bekor qilinmoqda\u2026', 'Bekor qilindi'];
    return ["Holat o'zgartirilmoqda\u2026", "Holat o'zgartirildi"];
};

// 🔄 Holat o'zgargach OCHIQ ko'rinishlarni joyida yangilaydi (serverga bormasdan):
//    buyurtma sahifasi (yangi holat + keyingi tugma), yig'ish oynasi va orqadagi ro'yxat.
window._aoAfterStatus = function (uid, id) {
    var same = function (o) { return !!o && String(o.uI) === String(uid) && String(o.id) === String(id); };
    var shown = function (elId) {
        var m = document.getElementById(elId);
        var d = m && m.style ? m.style.display : '';
        return !!d && d !== 'none';
    };
    try {
        var k = window._aoDetailKey;
        if (k && String(k.uid) === String(uid) && String(k.id) === String(id) && shown('adminOrderSheetModal') && window._aoRenderDetail) {
            window._aoRenderDetail(false);
        }
    } catch (e) {}
    try { if (same(window._pickOrder) && shown('adminOrderPickModal') && window._renderPick) window._renderPick(); } catch (e) {}
    // Orqadagi ro'yxat — animatsiyasiz qayta chiziladi (paginatsiya saqlanadi).
    try {
        if (window.lastOrdersRef && document.getElementById('admin-orders-render-box') && typeof renderAdminOrdersUI === 'function') {
            renderAdminOrdersUI(window.lastOrdersRef);
        }
    } catch (e) {}
};

// ✨ Yangi holat kartasi mayin "joyiga tushadi" (WAAPI — lite rejimdagi CSS
//    animatsiya o'chirgichi unga ta'sir qilmaydi; zaif qurilmada umuman yo'q).
window._aoPulseHero = function () {
    var hero = document.querySelector('#ao-detail .ao-hero');
    if (!hero || !hero.animate || document.documentElement.classList.contains('lite')) return;
    try {
        if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    } catch (e) {}
    hero.animate([{ transform: 'scale(.97)', opacity: .6 }, { transform: 'none', opacity: 1 }],
        { duration: 360, easing: 'cubic-bezier(.2,.8,.2,1)' });
};

// 🔎 Bitta buyurtmaning HAQIQIY (server) holatini qayta o'qiydi — butun `users`
//    daraxtini yuklamasdan (409: boshqa admin/bot allaqachon o'zgartirgan).
window._aoRefreshOne = function (uid, id) {
    try {
        if (typeof db === 'undefined' || !db || !db.ref) return Promise.resolve(null);
        return db.ref('orders/' + String(uid) + '_' + String(id)).once('value').then(function (s) {
            var c = s && s.val ? s.val() : null;
            if (!c || typeof c !== 'object') return null;
            (window.allFetchedOrders || []).forEach(function (o) {
                if (o && String(o.uI) === String(uid) && String(o.id) === String(id)) {
                    o.status = c.status || 'kutilmoqda';
                    if (c.statusUpdatedAt) o.statusUpdatedAt = c.statusUpdatedAt;
                }
            });
            try { window._aoAfterStatus(uid, id); } catch (e) {}
            return c;
        }).catch(function () { return null; });
    } catch (e) { return Promise.resolve(null); }
};

async function changeOrderStatus(uid, orderId, newStatus) {
        // 🔒 SERVER-AUTHORITATIVE: holat Worker /order-status orqali o'zgaradi.
        //    Server ikkala yozuvni (+ stok qaytarish, cashback) yangilaydi va
        //    YANGI Worker mijozga hamda BARCHA adminlarga xabarni o'zi yuboradi
        //    (bot'dagi kartochkalar ham yangilanadi).
        var _ord = null, oldStatus = null, displayCode = orderId;
        try {
            (window.allFetchedOrders || []).some(function (o) {
                if (o && String(o.uI) === String(uid) && String(o.id) === String(orderId)) { _ord = o; return true; }
                return false;
            });
        } catch (e) {}
        if (_ord) { oldStatus = _ord.status || 'kutilmoqda'; displayCode = _ord.code || orderId; }

        // ⏳ Ikki marta bosishdan himoya: bitta o'zgarish tugamaguncha yangisi boshlanmaydi.
        if (window._aoStatusBusy) return;
        window._aoStatusBusy = true;

        // ⚠️ Qaytarib bo'lmaydigan amallar — tasdiq so'raymiz (tasodifiy bosish).
        if (newStatus === 'bekor_qilingan') {
            var _q = (oldStatus === 'yetkazildi')
                ? ("#" + displayCode + " QAYTARILDI deb belgilansinmi?\n\nTovarlar omborga qaytadi, berilgan cashback qaytarib olinadi. Bu amalni qaytarib bo'lmaydi.")
                : ("#" + displayCode + " bekor qilinsinmi?\n\nTovarlar omborga qaytadi, mijozga xabar boradi. Bu amalni qaytarib bo'lmaydi.");
            var _yes = false;
            try { _yes = await window._a1Confirm(_q); } catch (e) {}
            if (!_yes) { window._aoStatusBusy = false; return; }
        }

        // ⌛ Soatcha DARHOL — xuddi buyurtma berilgandagidek (lekin qisqaroq:
        //    admin kuniga o'nlab marta bosadi). Ilgari tugma bosilgach bir necha
        //    soniya hech narsa ko'rinmasdi, keyin butun ro'yxat qayta yuklanardi.
        var _L = window._ordLoader;
        var _txt = window._aoStatusLbl(newStatus, oldStatus);
        try { if (_L) _L.show(_txt[0], { minSpin: 650, hold: 760, sub: '#' + displayCode }); } catch (e) {}
        try { if (window._hap) window._hap('light'); } catch (e) {}
        var _finish = function (ok, text) {
            window._aoStatusBusy = false;
            try { if (_L && _L.finish) return _L.finish(ok, text); } catch (e) {}
            return Promise.resolve();
        };

        // ✅ Server tasdiqlagan holatni qo'llash (oddiy yo'l ham, kechikkan javob ham).
        var _apply = function (data) {
            // Xabarlar alohida so'rovda (adminlar kartochkasi + mijoz xabari).
            if (data.deliver) { try { window._a1OrderDeliver(data.deliver); } catch (e) {} }
            // ⚡ OPTIMISTIK: ro'yxatdagi yozuv shu yerning o'zida yangilanadi. Ochiq
            //    sahifa (buyurtma / yig'ish) joyida qayta chiziladi: yangi holat +
            //    keyingi tugma. Butun `users` daraxtini qayta yuklash (eng sekin
            //    qism edi) endi shart emas — keyingi ochilishda yangisi olinadi.
            if (_ord) {
                _ord.status = data.status || newStatus;
                _ord.statusUpdatedAt = Date.now();
                delete _ord._projStatus;
            }
            try { window._invalidateUsersCache(); } catch (e) {}
            try { window._aoAfterStatus(uid, orderId); } catch (e) {}
        };

        var _resp, _data, _req, _timer;
        try {
            _req = window._workerPost('/order-status', { uid: String(uid), orderId: String(orderId), status: newStatus, notifyMode: 'split' });
            // ⏱ Javob 20 s kelmasa soatcha ekranni abadiy to'sib qolmasin. So'rov
            //    fonda davom etadi: kech bo'lsa ham muvaffaqiyatli kelsa qo'llanadi
            //    (takroriy bosish ham xavfsiz — server "duplicate" qaytaradi).
            var _wp = await Promise.race([_req, new Promise(function (res) { _timer = setTimeout(function () { res(null); }, window._aoStatusTimeoutMs || 20000); })]);
            clearTimeout(_timer);
            if (!_wp) {
                _finish(false, "Javob kelmadi");
                showToast("Server javob bermadi — holat birozdan keyin o'zi yangilanadi", "warning");
                _req.then(function (late) {
                    if (late && late.resp && late.resp.ok && late.data && late.data.ok) _apply(late.data);
                    else { try { window._aoRefreshOne(uid, orderId); } catch (e) {} }
                }, function () { try { window._aoRefreshOne(uid, orderId); } catch (e) {} });
                return;
            }
            _resp = _wp.resp; _data = _wp.data;
        } catch (e) {
            clearTimeout(_timer);
            _finish(false, "Internet yo'q");
            showToast("Holat saqlanmadi — internetni tekshiring", "warning");
            return;
        }
        if (!_resp.ok || !_data || !_data.ok) {
            // 🩺 Serverning ANIQ sababini ko'rsatamiz.
            var _emsg = (_data && _data.error) ? String(_data.error)
                        : ("server javobi " + (_resp ? _resp.status : '?'));
            if (_data && _data.retryable) _emsg = "boshqa o'zgarish bajarilmoqda — birozdan keyin qayta bosing";
            var _cur = _data && (_data.currentStatus || _data.from || _data.canonicalStatus);
            var _known = { kutilmoqda: "Kutilmoqda", qabul: "Qabul qilingan", yolda: "Yo'lda", yetkazildi: "Yetkazilgan", bekor_qilingan: "Bekor qilingan" };
            if (_resp && _resp.status === 409 && _cur && _cur !== newStatus) {
                _emsg = "bu buyurtma allaqachon \u00AB" + (_known[_cur] || _cur) + "\u00BB — sahifa yangilandi";
            }
            _finish(false, "Holat saqlanmadi");
            showToast("Holat saqlanmadi: " + _emsg, "warning");
            try { if (window._dwarn) window._dwarn('[order-status] xato:', _resp && _resp.status, _data); } catch (e) {}
            // Boshqa admin/bot allaqachon o'zgartirgan — server aytgan HAQIQIY holatni
            // shu yerning o'zida ko'rsatamiz (butun ro'yxatni qayta yuklamasdan).
            if (_resp && _resp.status === 409) {
                try { window._invalidateUsersCache(); } catch (e) {}
                if (_ord && _cur && _known[_cur]) { _ord.status = _cur; try { window._aoAfterStatus(uid, orderId); } catch (e) {} }
                else { try { window._aoRefreshOne(uid, orderId); } catch (e) {} }
            }
            return;
        }

        var _anim = _finish(true, _data.duplicate ? "Holat allaqachon shunday edi" : _txt[1]);
        _apply(_data);
        // Soatcha yopilgach — yangi holat kartasi mayin "joyiga tushadi".
        Promise.resolve(_anim).then(function () { try { if (window._aoPulseHero) window._aoPulseHero(); } catch (e) {} });
        if (Array.isArray(_data.restockSkipped) && _data.restockSkipped.length) {
            var _sk = _data.restockSkipped.map(function (x) { return '• ' + (x.name || x.id) + (x.size && x.size !== 'Universal' ? ' (' + x.size + ')' : ''); }).join('\n');
            Promise.resolve(_anim).then(function () {
                try {
                    var _skTxt = "Bu tovarlar omborga QAYTARILMADI (katalogdan o'chirilgan yoki razmeri o'zgargan):\n\n" + _sk + "\n\nKerak bo'lsa qoldiqni qo'lda to'g'rilang.";
                    if (typeof tg !== 'undefined' && tg.showAlert) tg.showAlert(_skTxt); else alert(_skTxt);
                } catch (e) {}
            });
        }

        // 📨 Yangi Worker xabarlarni O'ZI yuboradi (notify:"server").
        //    Eski Worker bilan moslik: maydon bo'lmasa brauzer yuboradi.
        if (_data.notify === 'server' || _data.duplicate) return;
        let statusText = "";
        let mijozMsg = "";
        let _sum = window._orderDetailLines(_ord || {});
        let _ordTotal = (_ord && _ord.total) || _sum.total;
        let _detail = _sum.lines
            ? ("\n\n🛒 Buyurtma tarkibi:" + _sum.lines + "\n\n💰 Jami: " + _ordTotal.toLocaleString() + " so'm")
            : (_ordTotal ? ("\n\n💰 Jami: " + _ordTotal.toLocaleString() + " so'm") : "");
        if (newStatus === "qabul") {
            statusText = "✅ QABUL QILINDI";
            mijozMsg = `✅ #${displayCode} raqamli buyurtmangiz qabul qilindi va tayyorlanmoqda!${_detail}\n\n🙏 Tez orada keyingi bosqich haqida xabar beramiz.`;
        } else if (newStatus === "yolda") {
            statusText = "🚚 YO'LGA CHIQDI";
            mijozMsg = `🚚 #${displayCode} raqamli buyurtmangiz yo'lga chiqdi!\n\n📦 Tez orada manzilingizga yetkazib beramiz, telefoningiz yoningizda bo'lsin.`;
        } else if (newStatus === "yetkazildi") {
            statusText = "🏁 YETKAZIB BERILDI";
            mijozMsg = `🏁 #${displayCode} raqamli buyurtmangiz yetkazib berildi.\n\n🙏 Xaridingiz uchun rahmat! Yana kutamiz.`;
        } else if (newStatus === "bekor_qilingan") {
            statusText = (oldStatus === 'yetkazildi') ? "↩️ QAYTARILDI" : "❌ BEKOR QILINDI";
            mijozMsg = `❌ #${displayCode} raqamli buyurtmangiz bekor qilindi.\n\nSavollaringiz bo'lsa biz bilan bog'laning: ${(window.ShopInfo && ShopInfo.mainPhone()) || '+998 88 289 30 30'}`;
        }
        let adminMsg = `🔄 <b>Buyurtma holati o'zgardi</b>\n\n🆔 Buyurtma: <b>#${escTg(displayCode)}</b>\n📊 Yangi holat: <b>${statusText}</b>`;
        try {
            for (var _i = 0; _i < ADMIN_IDS.length; _i++) {
                if (String(ADMIN_IDS[_i]) === String(currentUser)) continue;
                try { await tgProxySend({ chat_id: ADMIN_IDS[_i], text: adminMsg, parse_mode: "HTML" }); } catch (e) {}
            }
            if (uid && uid !== "Noma'lum" && /^\d+$/.test(String(uid)) && mijozMsg !== "") {
                await tgProxySend({ chat_id: uid, text: mijozMsg });
            }
        } catch(e) {
            showToast("Xato: SMS jo'natilmadi!", "warning");
        }
    }
    function openModal(id) {
        if (activeModal === id) return;
        if(id === 'cartModal') {
            renderCartItems();
            // 🔢 NUMBER COUNT-UP: cart ochilganda jami summa "yuqoriga sanab" chiqadi
            //    (faqat ochilganda — har +/- da emas). reduced-motion/lite da darhol.
            try {
                var _rmCnt = (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
                          || document.documentElement.classList.contains('lite') || window.__perfLite;
                if (!_rmCnt && window.animateValue && window._cartTotal > 0) {
                    setTimeout(function(){ window.animateValue('cart-total-sum', window._cartTotal); }, 60);
                }
            } catch(e){}
        }
        let m = document.getElementById(id);
        // 🛒 Agar boshqa modal ochiq bo'lsa - uni xotirada saqlab, yashiramiz.
        // Yangi modal yopilganда (popstate) - eski modal qaytib ochiladi.
        // Bu 'savatdan kafolatga -> orqaga -> savatga qaytish' muammosini hal qiladi.
        if (activeModal && activeModal !== id) {
            window._modalStack = window._modalStack || [];
            window._modalStack.push(activeModal);
            const prev = document.getElementById(activeModal);
            if (prev) prev.style.display = 'none';
        }
        m.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        activeModal = id;
        window.history.pushState({ modal: id }, "");
        tg.BackButton.show();
        updateBtns();
    }
    function closeModal() { if(activeModal) window.history.back(); }

    // 🎬 MODALNI QAYTA KO'RSATISH — yopilish animatsiyasini BEKOR QILIB.
    // ------------------------------------------------------------------
    // ⚠️ NIMA UCHUN KERAK (haqiqiy xato tuzatildi):
    //    "Orqaga" bosilganda pastdagi `popstate` avval joriy oynani yopadi
    //    (0.2 soniyalik chiqish animatsiyasi bilan), keyin esa ba'zi
    //    hollarda AYNI O'SHA oynani qaytadan ko'rsatadi. Eng aniq misol:
    //    to'lov oynasida "Karta" tafsilotidan orqaga qaytish — kod
    //    `paymentModal` ni qayta ko'rsatadi.
    //    Natijada oyna `display:flex` bo'ladi-yu, chiqish animatsiyasi uni
    //    shaffof qilib turadi va 0.2 soniyadan keyin butunlay yashiradi —
    //    ya'ni mijoz "orqaga" bosganda TO'LOV OYNASI YO'QOLIB QOLARDI.
    //    Bu yordamchi qayta ko'rsatishdan OLDIN yopilishni bekor qiladi.
    function _reshowModal(id) {
        var el = (typeof id === 'string') ? document.getElementById(id) : id;
        if (!el) return null;
        try { if (window._modalCancelClose) window._modalCancelClose(el); } catch (e) {}
        el.style.display = 'flex';
        return el;
    }
    window._reshowModal = _reshowModal;
    // 🏠 To'liq bosh menyuga qaytish (ilovada buyurtmadan keyin).
    //    Telegram'da buyurtmadan keyin mini app YOPILADI (tg.close) va keyingi
    //    ochilishda hammasi yangidan boshlanadi. Ilovada esa «yopish» yo'q —
    //    shuning uchun barcha oynalar yopiladi, savat qayta chiziladi va
    //    bosh sahifa ko'rsatiladi (aks holda savat eski buyurtma bilan qolardi).
    window.a1ResetToHome = function () {
        try {
            document.querySelectorAll('.modal-standard').forEach(function (m) {
                if (m.style.display && m.style.display !== 'none') {
                    try { if (window._modalCancelClose) window._modalCancelClose(m); } catch (e) {}
                    m.style.display = 'none';
                }
            });
            var sh = document.getElementById('coSheet');
            if (sh) { sh.classList.remove('open', 'on', 'show'); sh.style.display = 'none'; setTimeout(function () { sh.style.display = ''; }, 400); }
            activeModal = null;
            if (Array.isArray(window._modalStack)) window._modalStack.length = 0;
            document.body.style.overflow = '';
            historyStack = ['main-menu'];
            try { window.history.replaceState({ section: 'main-menu' }, ''); } catch (e) {}
            showSection('main-menu');
            if (typeof window.updateNav === 'function') window.updateNav('nav-home');
            try { if (typeof window.renderCartItems === 'function') window.renderCartItems(); } catch (e) {}
            try { updateCartBadge(); } catch (e) {}
            updateBtns();
            var c = document.querySelector('.container'); if (c) c.scrollTop = 0;
        } catch (e) { try { location.reload(); } catch (e2) {} }
    };
    function goHome() { if(activeModal) closeModal(); if(historyStack.length > 1 || historyStack[historyStack.length - 1] !== 'main-menu') { historyStack = ['main-menu']; window.history.pushState({ section: 'main-menu' }, ""); showSection('main-menu'); } updateNav('nav-home'); }

        // 🧭 MUKAMMAL NAVIGATSIYA VA OYNALARNI YOPISH XARITASI (Qotishlarga qarshi)
        window.addEventListener('popstate', function(e) {
            if (activeModal) {
                let current = activeModal;

                // 🔍 0-. RASMNI KATTALASHTIRISH qatlami — ENG yuqori prioritet.
                //    Fayl oxiridagi "QATLAM 2026.20" qo'shgan `#pmz` overlay'i.
                //    Bu yerda hal qilinishi SHART: aks holda «Nazad» bosilganda
                //    pastdagi shartlar tovar oynasini ham yopib yuborardi, ya'ni
                //    bitta emas IKKI oyna yopilardi.
                if (current === '__zoom__') {
                    if (window._closeZoomOverlay) window._closeZoomOverlay();
                    activeModal = window._zoomPrevActive || null;
                    window._zoomPrevActive = null;
                    updateBtns();
                    return;
                }

                // 📸 STORIES oynasi (fayl oxiridagi "a1-stories-26" qatlami) — xuddi
                //    zoom kabi: FAQAT storis yopiladi, ostidagi oyna (masalan admin
                //    Stories boshqaruvi) joyida qoladi.
                if (current === '__story__') {
                    if (window._a1svHideFromHistory) window._a1svHideFromHistory();
                    activeModal = window._a1svPrevActive || null;
                    window._a1svPrevActive = null;
                    updateBtns();
                    return;
                }
                // 📊 Storis statistikasi (kim ko'rdi / javoblar) — FAQAT shu oyna yopiladi;
                //    ostidagi storis yoki admin boshqaruvi joyida qoladi.
                if (current === '__storyins__') {
                    if (window._a1svInsHideFromHistory) window._a1svInsHideFromHistory();
                    activeModal = window._a1svInsPrev || null;
                    window._a1svInsPrev = null;
                    updateBtns();
                    return;
                }

                // 🆕 0a. SKANER overlay'i — eng yuqori prioritet, oldingi modalga qaytadi
                if (current === '__scanner__') {
                    let cleanup = () => { let ov = document.getElementById('scanner-overlay'); if (ov) ov.remove(); };
                    if (window._h5qr) {
                        let r = window._h5qr; window._h5qr = null;
                        try { r.stop().then(() => { try { r.clear(); } catch(e2){} cleanup(); }).catch(cleanup); }
                        catch(e2) { cleanup(); }
                    } else { cleanup(); }
                    activeModal = window._scannerPrevActive || null;
                    window._scannerPrevActive = null;
                    if (!activeModal) {
                        document.body.style.overflow = '';
                        let cont = document.querySelector('.container'); if(cont) cont.classList.remove('blur-bg');
                    }
                    updateBtns();
                    return;
                }

                // 🆕 0b. XARITA tanlash oynasi — Nazad bosilsa xavfsiz yopiladi (qotmaydi)
                if (current === '__mappicker__') {
                    // Agar nom berish qatlami ochiq bo'lsa — faqat uni yopamiz, xarita qoladi
                    let nm = document.getElementById('addr-name-overlay');
                    if (nm && nm.classList.contains('show')) {
                        nm.classList.remove('show');
                        setTimeout(function(){ nm.style.display = 'none'; }, 220);
                        window.history.pushState({ modal: '__mappicker__' }, ""); // map hali ochiq
                        updateBtns();
                        return;
                    }
                    // Xaritani yopamiz
                    let ovm = document.getElementById('map-picker-overlay');
                    if (ovm) ovm.style.display = 'none';
                    activeModal = window._mapPrevActive || null;
                    window._mapPrevActive = null;
                    if (!activeModal) {
                        document.body.style.overflow = '';
                        let cont = document.querySelector('.container'); if(cont) cont.classList.remove('blur-bg');
                    }
                    updateBtns();
                    return;
                }


                // 🎬 Modal YOPILISH animatsiyasi (QATLAM 2026.17).
                //    Ilgari bu yerda `display='none'` edi — oyna BIR ZUMDA
                //    g'oyib bo'lardi: ochilishi silliq, yopilishi keskin.
                //    `_modalHide` avval qisqa chiqish animatsiyasini o'ynatib,
                //    keyin yashiradi. Qatlam yuklanmagan bo'lsa — eski xatti-harakat.
                if (window._modalHide) window._modalHide(document.getElementById(current));
                else document.getElementById(current).style.display = 'none';
    
                // 0c. 🧾 Buyurtma sahifasidan -> buyurtmalar ro'yxatiga
                if (current === 'adminOrderSheetModal') {
                    window._aoDetailKey = null;
                    activeModal = 'adminOrdersModal';
                    _reshowModal('adminOrdersModal');
                    document.body.style.overflow = 'hidden';
                    window._modalStack = [];
                    updateBtns();
                    // Yig'ish/chat belgilari yangilansin (animatsiyasiz, paginatsiya saqlanadi)
                    try { if (window.lastOrdersRef) renderAdminOrdersUI(window.lastOrdersRef); } catch (e) {}
                    return;
                }

                // 1. Admin Chatdan -> Buyurtmalarga qaytish
                if (current === 'adminOrderPickModal') {
                    // 📋 Yig'ish oynasidan orqaga -> buyurtma sahifasiga (u yerdan ochilgan bo'lsa) yoki ro'yxatga
                    if (window._aoBackToDetail && window._aoBackToDetail()) { updateBtns(); return; }
                    activeModal = 'adminOrdersModal';
                    _reshowModal('adminOrdersModal');
                    document.body.style.overflow = 'hidden';
                    window._modalStack = [];
                    updateBtns();
                    return;
                }

                if (current === 'adminChatModal') {
                    // ⚡ Listenerni uzamiz (xotira oqishi bo'lmasligi uchun)
                    if (window._adminChatRef) { try { window._adminChatRef.off('value'); window._adminChatRef = null; } catch(e){} }
                    if (window._aoBackToDetail && window._aoBackToDetail()) { updateBtns(); return; }
                    activeModal = 'adminOrdersModal';
                    _reshowModal('adminOrdersModal');
                    document.body.style.overflow = 'hidden';
                    window._modalStack = []; // 🧭 stack toza (ikkinchi nazad to'g'ri ishlash uchun)
                    updateBtns();
                    // ⚠️ pushState YO'Q — history allaqachon adminOrders'da (iOS swipe mos)
                    return;
                }

                // 1b. AI Chat yopilganda listenerni uzamiz
                if (current === 'aiChatModal') {
                    if (window._aiChatRef) { try { window._aiChatRef.off('value'); window._aiChatRef = null; } catch(e){} }
                }

                // 1c. 💳 TO'LOV oynasi (Nazad tugmasi):
                //   - Payme tafsiloti ochiq bo'lsa -> to'lov usullari ro'yxatiga qaytamiz
                //   - Aks holda (usullar ro'yxati ochiq) -> savatga qaytamiz (stack orqali, pastda)
                if (current === 'paymentModal') {
                    var _cd = document.getElementById('card-details');
                    var _ad = document.getElementById('app-pay-details');
                    var _subOpen = (_cd && !_cd.classList.contains('hidden')) || (_ad && !_ad.classList.contains('hidden'));
                    if (_subOpen) {
                        if (_cd) _cd.classList.add('hidden');
                        if (_ad) _ad.classList.add('hidden');
                        document.getElementById('payment-options').classList.remove('hidden');
                        _reshowModal('paymentModal');
                        activeModal = 'paymentModal';
                        document.body.style.overflow = 'hidden';
                        window.history.pushState({ modal: 'paymentModal' }, "");
                        updateBtns();
                        return;
                    }
                    // usullar ro'yxati ochiq edi -> savatga (modal stack case 5 hal qiladi)
                }
    
                // 2. Tahrirlash oynasidan -> Tovar yoki Qoralamalarga qaytish
                if (current === 'editModal') {
                    // ⚠️ TUZATILDI (tur to'qnashuvi): ilgari bu yerda
                    //    `window.currentDraftFolder = false` yozilardi. Lekin o'sha
                    //    o'zgaruvchi BOSHQA maqsadda — ochilgan papka NOMINI (batch_id
                    //    satri) saqlash uchun ishlatiladi. Natijada qoralamani tahrirlab
                    //    "orqaga" bosilganda papka nomi `false` ga aylanib,
                    //    filterAdminDrafts hech narsa topa olmasdi va admin
                    //    "Bu papkada tovar topilmadi" degan bo'sh ekranni ko'rardi —
                    //    qoralamalar joyida turgani holda. Endi alohida bayroq bor.
                    if (window._editCameFromDrafts) {
                        activeModal = 'adminDraftsModal';
                        _reshowModal('adminDraftsModal');
                        window._editCameFromDrafts = false;   // faqat bayroqni tozalaymiz
                        // Papka ichidagi ro'yxatni yangilaymiz (tahrir natijasi ko'rinsin)
                        try {
                            if (window.currentDraftFolder && typeof filterAdminDrafts === 'function') {
                                filterAdminDrafts('all');
                            }
                        } catch (e) {}
                    } else {
                        activeModal = 'productModal';
                        _reshowModal('productModal');
                    }
                    document.body.style.overflow = 'hidden';
                    window._modalStack = []; // 🧭 stack toza
                    updateBtns();
                    return;
                }
    
                // 2b. 📸 STORY COMPOSER — qaerdan ochilgan bo'lsa, o'sha yerga qaytadi
                //     (admin Stories oynasi, yoki to'g'ridan-to'g'ri imo/halqa orqali -> hech qayerga)
                if (current === 'storyComposerModal') {
                    var _scFrom = window._storyComposerFrom || null;
                    window._storyComposerFrom = null;
                    if (_scFrom && document.getElementById(_scFrom)) {
                        activeModal = _scFrom;
                        _reshowModal(_scFrom);
                        document.body.style.overflow = 'hidden';
                        window._modalStack = [];
                        updateBtns();
                        return;
                    }
                    // Imo/halqa orqali ochilgan — butunlay yopamiz
                    document.body.style.overflow = '';
                    window._modalStack = [];
                    activeModal = null;
                    updateBtns();
                    return;
                }

                // 2b-2. 🖼 BANNER TAHRIRLASH -> Bannerlar ro'yxatiga qaytish.
                //       Composer FAQAT banner boshqaruvidan ochiladi, shuning
                //       uchun qaytish manzili doimo bir xil (`_storyComposerFrom`
                //       kabi holat saqlash kerak emas).
                if (current === 'bannerComposerModal') {
                    activeModal = 'bannerAdminModal';
                    _reshowModal('bannerAdminModal');
                    document.body.style.overflow = 'hidden';
                    window._modalStack = [];
                    updateBtns();
                    try { if (window.AvtoBanners) window.AvtoBanners.repaintAdmin(); } catch (e) {}
                    return;
                }

                // 2c. 👤 MIJOZ TAFSILOTI -> Mijozlar ro'yxatiga qaytish
                if (current === 'customerDetailModal') {
                    activeModal = 'adminCustomersModal';
                    _reshowModal('adminCustomersModal');
                    document.body.style.overflow = 'hidden';
                    window._modalStack = [];
                    updateBtns();
                    return;
                }

                // 3. Maxsus Admin oynalaridan -> Admin Panelga qaytish
                if (current === 'adminOrdersModal' || current === 'adminStatsModal' || current === 'adminInventoryModal' || current === 'adminCustomersModal' || current === 'adminDraftsModal' || current === 'adminStoriesModal' || current === 'bannerAdminModal' || current === 'bulkDiscountModal') {
                    activeModal = 'adminModal';
                    _reshowModal('adminModal');
                    document.body.style.overflow = 'hidden';
                    window._modalStack = []; // 🧭 stack toza
                    updateBtns();
                    // ⚠️ pushState YO'Q — endi ichki modallar pushState bilan ochiladi,
                    //    history allaqachon adminModal'da. Qo'lda pushState iOS swipe'ni buzardi.
                    return;
                }
    
                // 4. Qo'shish oynalaridan -> Admin Panelga qaytish (Faqatgina o'ziga qaytamiz)
                if (current === 'addProductModal' || current === 'aiBulkModal') {
                    activeModal = 'adminModal';
                    _reshowModal('adminModal');
                    document.body.style.overflow = 'hidden';
                    window._modalStack = []; // 🧭 stack toza (ikkinchi nazad to'g'ri ishlash uchun)
                    updateBtns();
                    return;
                }

                // 5. 🛒 MODAL STACK: agar oldingi modal saqlangan bo'lsa - unga qaytamiz.
                //    Bu 'savat -> kafolat -> orqa' muammosini hal qiladi: kafolat
                //    yopilganда savat oynasi qaytib ochiladi (asosiy menyu emas).
                if (window._modalStack && window._modalStack.length > 0) {
                    const prevId = window._modalStack.pop();
                    activeModal = prevId;
                    // `_reshowModal` — yopilish animatsiyasini bekor qilib ko'rsatadi
                    // (yuqoridagi izohga qara). Bu yerda ham izchil ishlatamiz.
                    const prevEl = _reshowModal(prevId);
                    if (prevId === 'cartModal') renderCartItems();
                    document.body.style.overflow = 'hidden';
                    updateBtns();
                    return;
                }

                // Boshqa har qanday oyna butunlay yopiladi va Asosiy ekranga tushadi
                document.body.style.overflow = '';
                window._modalStack = [];   // 🛒 stack ham tozalanadi (xavfsizlik)
                let cont = document.querySelector('.container');
                if(cont) cont.classList.remove('blur-bg');
                activeModal = null;
                updateBtns();
                
                let cS = historyStack[historyStack.length - 1];
                if(cS === 'profile-section') updateNav('nav-profile');
                else if(cS === 'katalog-menu') updateNav('nav-catalog');
                else if(cS === 'wishlist-section') updateNav('nav-wishlist');
                else updateNav('nav-home');
                return;
            }
            
            if (searchActive) { exitSearch(); return; }
            
            if (historyStack.length > 1) {
                historyStack.pop();
                let pId = historyStack[historyStack.length - 1];
                document.querySelectorAll('#content-area > div').forEach(d => { d.classList.add('hidden'); });
                let _a1f = false; try { _a1f = !!(window._a1FillGrid && window._a1FillGrid(pId)); } catch(e){}   // ⚡ lazy bo'lim
                document.getElementById(pId).classList.remove('hidden');
                if (_a1f) { try { if (window._catDecorateVisible) window._catDecorateVisible(); } catch(e){} }
                document.getElementById(pId).classList.add('animate-slide-up');
                let sC = document.querySelector('.slider-container');
                if(sC) sC.style.display = (pId === 'main-menu') ? 'block' : 'none';
                if(pId === 'profile-section') updateNav('nav-profile');
                else if(pId === 'katalog-menu') updateNav('nav-catalog');
                else if(pId === 'wishlist-section') updateNav('nav-wishlist');
                else updateNav('nav-home');
                updateBtns();
            } else {
                tg.close();
            }
        });

    tg.onEvent('backButtonClicked', function() { window.history.back(); });
    function goBack() { window.history.back(); }
    function updateBtns() { let iD = historyStack.length > 1; let bB = document.getElementById('back-btn'); if(bB) bB.style.display = iD ? 'flex' : 'none'; if (iD || activeModal || searchActive) tg.BackButton.show(); else tg.BackButton.hide(); }
    updateBtns();
    let aS = document.getElementById('main-slider'); if (aS) { setInterval(() => { if (document.hidden || activeModal || searchActive) return; if (aS.scrollWidth - aS.clientWidth <= aS.scrollLeft + 5) aS.scrollTo({ left: 0, behavior: 'smooth' }); else aS.scrollBy({ left: aS.clientWidth, behavior: 'smooth' }); }, 3500); } 

    // 🤝 'HAMKORLIK' badge — faqat FARA_CLUB_SAM banneri (2-slayd, index 1) faol
    // bo'lganda ko'rinadi. Slider scroll qilinganda (qo'lda yoki avtomat) chaqiriladi.
    window.updatePartnerBadge = function() {
        var sl = document.getElementById('main-slider');
        var badge = document.getElementById('slider-partner-badge');
        if (!sl || !badge) return;
        var w = sl.clientWidth || 1;
        var idx = Math.round(sl.scrollLeft / w);
        // FARA_CLUB_SAM = 4-slayd (index 3). Faqat shu slaydда 'HAMKORLIK' badge ko'rinadi.
        badge.style.opacity = (idx === 3) ? '1' : '0';
    };
    // Boshlang'ich holat (1-banner faol -> badge yashirin)
    setTimeout(() => { if (window.updatePartnerBadge) window.updatePartnerBadge(); }, 300);
// =====================================
// ADMIN: MIJOZLAR RO'YXATI VA BUYURTMALAR (PAGINATSIYA BILAN)
// =====================================

let allCustomersData = [];
window.adminCustomersLimit = 20;
window.lastCustomersRef = null;

window.openAdminCustomers = () => {
    document.getElementById('adminModal').style.display = 'none';
    let cM = document.getElementById('adminCustomersModal');
    cM.style.display = 'flex';
    activeModal = 'adminCustomersModal';
    window.history.pushState({ modal: 'adminCustomersModal' }, "");
    
    let listBox = document.getElementById('admin-customers-list');
    listBox.innerHTML = window._skel(6);
    
    window._getUsersSnap().then((s) => {
        allCustomersData = [];
        if(s.exists()) {
            let us = s.val();
            for(let uid in us) {
                let p = us[uid].profile || {};
                let ords = us[uid].orders || [];
                
                // Array yoki Object ekanligini tekshirib sanaymiz
                let totalOrdersCount = Array.isArray(ords) ? ords.length : Object.keys(ords).length; 
                
                let totalSpent = 0;
                if(Array.isArray(ords)) {
                    totalSpent = ords.reduce((sum, o) => o.status === 'yetkazildi' ? sum + (o.total || 0) : sum, 0);
                } else {
                    totalSpent = Object.values(ords).reduce((sum, o) => o.status === 'yetkazildi' ? sum + (o.total || 0) : sum, 0);
                }

                allCustomersData.push({
                    uid: uid,
                    name: p.name || "Nomsiz mijoz",
                    phone: p.phone || "Kiritilmagan",
                    address: p.address || "Kiritilmagan",
                    ordersCount: totalOrdersCount,
                    totalSpent: totalSpent
                });
            }
        }
        allCustomersData.sort((a, b) => b.totalSpent - a.totalSpent);
        renderCustomersList(allCustomersData);
    });
};

window.renderCustomersList = (arr) => {
    let listBox = document.getElementById('admin-customers-list');
    
    // Yangi ro'yxat kelsa limitni nollaymiz
    if (window.lastCustomersRef !== arr) {
        window.adminCustomersLimit = 20;
        window.lastCustomersRef = arr;
    }

    if(arr.length === 0) {
        listBox.innerHTML = '<p style="text-align:center; color: gray;">Mijozlar topilmadi.</p>';
        return;
    }
    
    // LIMIT QO'LLASH (Paginatsiya)
    let visibleCustomers = arr.slice(0, window.adminCustomersLimit);
    
    let html = visibleCustomers.map(c => `
        <div class="luxury-card" style="margin-bottom: 12px; padding: 15px; display: block; cursor: pointer; border: 1px solid transparent;"onclick="openCustomerSpecificOrders('${_jsAttr(c.uid)}', '${_jsAttr(c.name)}')" onmouseover="this.style.borderColor='var(--luxury-gold)'" onmouseout="this.style.borderColor='transparent'">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
                <div>
                    <h4 style="margin: 0 0 4px 0; font-size: 15px;">${escHtml(c.name)}</h4>
                    <span style="font-size: 11px; color: var(--text-muted);">ID: <code>${escHtml(c.uid)}</code></span>
                </div>
                <div style="text-align: right;">
                    <div style="font-size: 14px; font-weight: bold; color: var(--luxury-gold);">${c.totalSpent.toLocaleString()} so'm</div>
                    <span style="font-size: 10px; color: var(--accent-green); background: rgba(48,209,88,0.1); padding: 2px 6px; border-radius: 6px;">${c.ordersCount} ta xarid</span>
                </div>
            </div>
            <div style="font-size: 13px; color: var(--text-main);">📞 ${c.phone}</div>
            ${c.address && c.address !== "Kiritilmagan" ? `<div style="font-size: 11px; color: gray; margin-top: 4px;">📍 ${c.address}</div>` : ''}
        </div>
    `).join('');
    
    // Pastga tushganda chiqadigan "Yuklanmoqda" yozuvi
    if (window.adminCustomersLimit < arr.length) {
        html += `<div style="text-align:center; padding: 15px 0 30px; color: var(--luxury-gold); font-size: 12px; font-weight: bold; opacity: 0.7;">Pastga tushganda yana yuklanmoqda... ⏳</div>`;
    }
    
    listBox.innerHTML = html;
};

window.searchCustomers = () => {
    let q = document.getElementById('customer-search-input').value.toLowerCase().trim();
    if(q.length === 0) {
        renderCustomersList(allCustomersData);
        return;
    }
    let filtered = allCustomersData.filter(c => 
        c.name.toLowerCase().includes(q) || 
        c.uid.toString().includes(q) ||
        (c.phone && c.phone.includes(q))
    );
    renderCustomersList(filtered);
};

window.openCustomerSpecificOrders = (uid, customerName) => {
    try { if (window._aoHideDetail) window._aoHideDetail(); } catch (e) {}
    if(document.getElementById('adminCustomersModal')) document.getElementById('adminCustomersModal').style.display = 'none';
    let aM = document.getElementById('adminOrdersModal');
    aM.style.display = 'flex';
    activeModal = 'adminOrdersModal';
    window.history.pushState({ modal: 'adminOrdersModal' }, "");

    let c = document.getElementById('admin-orders-list');
    if(!c) return;
    
    // 🔐 XSS: `customerName` — MIJOZ o'zi kiritgan matn. Escape qilinmasa mijoz
    //    ismiga skript yozib, ADMIN panelida (ya'ni barcha yozish huquqi bor
    //    sessiyada) kod ishga tushirishi mumkin edi.
    aM.querySelector('.modal-header h2').innerHTML = `📦 ${escHtml(customerName)} buyurtmalari`;

    c.innerHTML = `
        ${window._aoFilterBar()}
        <div id="admin-orders-render-box">${window._skel(6)}</div>
    `;

    db.ref('users/' + uid).once('value', (s) => {
        let aO = [];
        if(s.exists()) {
            let userData = s.val();
            if(userData.orders) {
                let ph = userData.profile ? userData.profile.phone : ""; 
                let nm = userData.profile ? userData.profile.name : ""; 
                let ordsArray = Array.isArray(userData.orders) ? userData.orders : Object.values(userData.orders);
                ordsArray.forEach(o => { 
                    if(o && o.id) aO.push({ uI: uid, uN: nm, uP: ph, ...o }); 
                });
            }
        }
        window._aoCanonStatus(aO).then(() => {
            window._aoSortOrders(aO);
            window.allFetchedOrders = aO;
            window.lastOrdersRef = null;
            renderAdminOrdersUI(aO);
        });
    });
};

window.adminOrdersLimit = 20;
window.lastOrdersRef = null;



window.filterAdminOrders = (status, btnElement) => {
    if(!window.allFetchedOrders) return;

    document.querySelectorAll('#adminOrdersModal .ao-chip').forEach(btn => {
        btn.classList.remove('is-active');
        btn.setAttribute('aria-selected', 'false');
    });

    if(btnElement) {
        btnElement.classList.add('is-active');
        btnElement.setAttribute('aria-selected', 'true');
        try { btnElement.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' }); } catch (e) {}
        try { if (window._hap) window._hap('selection'); } catch (e) {}
    }

    if(status === 'barchasi') {
        renderAdminOrdersUI(window.allFetchedOrders);
    } else {
        let filtered = window.allFetchedOrders.filter(o => (o.status || 'kutilmoqda') === status);
        renderAdminOrdersUI(filtered);
    }
};

// =====================================
// 🎯 SCROLL SEZGICHLARI (Yangi ma'lumotlarni pastdan ulash)
// =====================================
document.getElementById('adminOrdersModal').addEventListener('scroll', function() {
    if (this.scrollTop + this.clientHeight >= this.scrollHeight - 80) {
        if (window.lastOrdersRef && window.adminOrdersLimit < window.lastOrdersRef.length) {
            window.adminOrdersLimit += 20;
            renderAdminOrdersUI(window.lastOrdersRef);
        }
    }
});

document.getElementById('adminCustomersModal').addEventListener('scroll', function() {
    if (this.scrollTop + this.clientHeight >= this.scrollHeight - 80) {
        if (window.lastCustomersRef && window.adminCustomersLimit < window.lastCustomersRef.length) {
            window.adminCustomersLimit += 20;
            renderCustomersList(window.lastCustomersRef);
        }
    }
});
    // =====================================
// MASHINA TANLASH VA SAVAT FUNKSIYALARI (TUZATILGAN)
// =====================================

window.selectCarModel = (btn) => {
    document.querySelectorAll('.pm-car-btn').forEach(b => {
        b.style.background = 'rgba(255,255,255,0.05)';
        b.style.color = 'white';
        b.style.borderColor = 'var(--glass-border)';
        b.classList.remove('selected');
    });
    btn.style.background = 'rgba(212, 175, 55, 0.2)';
    btn.style.color = 'var(--luxury-gold)';
    btn.style.borderColor = 'var(--luxury-gold)';
    btn.classList.add('selected');
    window.currentSelectedCar = btn.getAttribute('data-car');
};

window.addToCartWithOptions = (finalId) => { 
    cart[finalId] = (cart[finalId] || 0) + 1; 
    saveLocalCart(); 
    updateCartBadge(); 
    if(tg.HapticFeedback) tg.HapticFeedback.impactOccurred('medium'); 
    Haptics.success(); // ✅ Muvaffaqiyatli tebranish qo'shildi
    showToast('Savatda!'); 
};

    // =====================================
// RAZMERLI TOVARLAR UCHUN ADMIN MANTIQI
// =====================================
window.toggleProductTypeFields = () => {
    let type = document.getElementById('admin-prod-type').value;
    if(type === 'razmerli') {
        document.getElementById('admin-oddiy-fields').style.display = 'none';
        document.getElementById('admin-razmerli-fields').style.display = 'block';
    } else {
        document.getElementById('admin-oddiy-fields').style.display = 'block';
        document.getElementById('admin-razmerli-fields').style.display = 'none';
    }
};

window.updateBrandModels = () => {
    let brand = document.getElementById('admin-prod-brand').value;
    let box = document.getElementById('admin-brand-models-box');
    let select = document.getElementById('admin-prod-model');
    
    select.innerHTML = ''; // Tozalash
    
    if(brand === 'gaz') {
        box.style.display = 'none'; // GAZ uchun mashina kerak emas
    } else if (brand === 'daewoo') {
        box.style.display = 'block';
        select.innerHTML = `
            <option value="nexia1">Nexia 1</option>
            <option value="nexia2">Nexia 2</option>
            <option value="matiz">Matiz</option>
            <option value="tico">Tico</option>
            <option value="damas">Damas</option>
        `;
    } else if (brand === 'chevy') {
        box.style.display = 'block';
        select.innerHTML = `
            <option value="cobalt">Cobalt</option>
            <option value="gentra">Gentra</option>
            <option value="lacetti">Lacetti</option>
            <option value="spark">Spark</option>
            <option value="nexia3">Nexia 3</option>
        `;
    } else if (brand === 'uaz') {
        box.style.display = 'block';
        select.innerHTML = `
            <option value="patriot">Patriot</option>
            <option value="hunter">Hunter</option>
        `;
    } else {
        box.style.display = 'none';
    }
};

window.addSizeField = () => {
    let container = document.getElementById('admin-sizes-container');
    let div = document.createElement('div');
    div.style.display = 'flex';
    div.style.gap = '8px';
    div.style.marginBottom = '8px';
    div.className = 'size-input-row';
    div.innerHTML = `
        <input type="text" placeholder="Razmer (masalan: 92.5)" style="flex:1; padding:10px; background:rgba(0,0,0,0.5); color:white; border:1px solid var(--glass-border); border-radius:8px;" class="size-name">
        <input type="number" placeholder="Soni" style="flex:1; padding:10px; background:rgba(0,0,0,0.5); color:white; border:1px solid var(--glass-border); border-radius:8px;" class="size-stock">
        <button type="button" onclick="this.parentElement.remove()" style="background:var(--accent-red); color:white; border:none; border-radius:8px; padding:0 15px; cursor:pointer; font-weight:bold;">X</button>
    `;
    container.appendChild(div);
};

// =====================================
// MASHINA VA RAZMER TANLASH, SAVAT (YANGILANGAN)
// =====================================

window.selectCarModel = (btn) => {
    document.querySelectorAll('.pm-car-btn').forEach(b => {
        b.style.background = 'rgba(255,255,255,0.05)';
        b.style.color = 'white';
        b.style.borderColor = 'var(--glass-border)';
        b.classList.remove('selected');
    });
    btn.style.background = 'rgba(212, 175, 55, 0.2)';
    btn.style.color = 'var(--luxury-gold)';
    btn.style.borderColor = 'var(--luxury-gold)';
    btn.classList.add('selected');
    window.currentSelectedCar = btn.getAttribute('data-car');
};

window.selectSizeModel = (btn, stock) => {
    document.querySelectorAll('.pm-size-btn').forEach(b => {
        b.style.background = 'rgba(255,255,255,0.05)';
        b.style.color = 'white';
        b.style.borderColor = 'var(--glass-border)';
        b.classList.remove('selected');
    });
    btn.style.background = 'rgba(212, 175, 55, 0.2)';
    btn.style.color = 'var(--luxury-gold)';
    btn.style.borderColor = 'var(--luxury-gold)';
    btn.classList.add('selected');
    
    window.currentSelectedCar = btn.getAttribute('data-size');
    window.currentSelectedStock = stock;
    
    // Zaxira yozuvini yangilash
    let box = document.getElementById('dynamic-stock-info');
    let buyB = document.getElementById('pm-buy-btn');
    if(!box || !buyB) return;
    
    // isAdmin(): tasdiqlangan auth.uid bo'yicha — ilovadagi admin (uid satr) ham tanilsin
    let isAdmin = (typeof window.isAdmin === 'function') ? window.isAdmin() : (typeof currentUser !== 'undefined' && typeof ADMIN_IDS !== 'undefined' && ADMIN_IDS.includes(currentUser));
    let stockText = isAdmin ? `✅ Sotuvda bor: ${stock} ta` : `✅ Sotuvda bor`;
    
    if(stock <= 0) {
        box.innerHTML = `<span style="color:#ff453a; font-weight:bold;">❌ Sotuvda qolmagan</span>`;
        buyB.disabled = true; buyB.innerText = "Tugagan";
    } else {
        box.innerHTML = `<span style="color:var(--accent-green); font-weight:bold;">${stockText}</span>`;
        buyB.disabled = false; buyB.innerText = "Savatga qo'shish";
    }
};

window.updateDynamicStock = (st) => {
    let box = document.getElementById('dynamic-stock-info');
    let buyB = document.getElementById('pm-buy-btn');
    if(!box || !buyB) return;
    
    let isAdmin = (typeof currentUser !== 'undefined' && typeof ADMIN_ID !== 'undefined' && currentUser === ADMIN_ID);
    let stockText = isAdmin ? `✅ Sotuvda bor: ${st} ta` : `✅ Sotuvda bor`;
    
    if(st <= 0) {
        box.innerHTML = `<span style="color:#ff453a; font-weight:bold;">❌ Sotuvda qolmagan</span>`;
        buyB.disabled = true; buyB.innerText = "Tugagan";
    } else {
        box.innerHTML = `<span style="color:var(--accent-green); font-weight:bold;">${stockText}</span>`;
        buyB.disabled = false; buyB.innerText = "Savatga qo'shish";
    }
};

window.addToCartWithOptions = (finalId) => { 
    cart[finalId] = (cart[finalId] || 0) + 1; 
    saveLocalCart(); 
    updateCartBadge(); 
    if(typeof tg !== 'undefined' && tg.HapticFeedback) tg.HapticFeedback.impactOccurred('medium'); 
    Haptics.success(); // ✅ Muvaffaqiyatli tebranish qo'shildi
    showToast('Savatda!'); 
};

// 🚨 TO'LIQ VA XATOSIZ SAVAT FUNKSIYASI 🚨


window.chg = (fullId, d) => { 
    let [baseId, carOpt] = String(fullId).split('||');
    let p = productsDB.find(x => x.id == baseId);
    if(!p) return;
    
    let st = 10;
    if (p.product_type === 'razmerli' && p.sizes) {
        let sizeObj = p.sizes.find(s => s.size === carOpt);
        if(sizeObj) st = sizeObj.stock;
    } else {
        st = p.stock !== undefined ? p.stock : 10;
    }
    
    let totalInCart = 0;
    for(let cid in cart) { if(cid.startsWith(baseId + "||" + (carOpt||""))) totalInCart += cart[cid]; }
    
    if(d > 0 && totalInCart >= st) { showToast("Omborda bunday ko'p emas", "warning"); return; }
    cart[fullId] += d; 
    if(cart[fullId] <= 0) delete cart[fullId]; 
    saveLocalCart(); updateCartBadge(); renderCartItems(); 
};

// =====================================
// RAZMERLI TOVARLAR UCHUN ADMIN MANTIQI
// =====================================
window.toggleProductTypeFields = () => {
    let type = document.getElementById('admin-prod-type').value;
    if(type === 'razmerli') {
        document.getElementById('admin-oddiy-fields').style.display = 'none';
        document.getElementById('admin-razmerli-fields').style.display = 'block';
    } else {
        document.getElementById('admin-oddiy-fields').style.display = 'block';
        document.getElementById('admin-razmerli-fields').style.display = 'none';
    }
};

window.updateBrandModels = () => {
    let brand = document.getElementById('admin-prod-brand').value;
    let box = document.getElementById('admin-brand-models-box');
    let select = document.getElementById('admin-prod-model');
    
    select.innerHTML = ''; 
    
    if(brand === 'gaz') {
        box.style.display = 'none'; 
    } else if (brand === 'daewoo') {
        box.style.display = 'block';
        select.innerHTML = `
            <option value="nexia1">Nexia 1</option>
            <option value="nexia2">Nexia 2</option>
            <option value="matiz">Matiz</option>
            <option value="tico">Tico</option>
            <option value="damas">Damas</option>
        `;
    } else if (brand === 'chevy') {
        box.style.display = 'block';
        select.innerHTML = `
            <option value="cobalt">Cobalt</option>
            <option value="gentra">Gentra</option>
            <option value="lacetti">Lacetti</option>
            <option value="spark">Spark</option>
            <option value="nexia3">Nexia 3</option>
        `;
    } else if (brand === 'uaz') {
        box.style.display = 'block';
        select.innerHTML = `
            <option value="patriot">Patriot</option>
            <option value="hunter">Hunter</option>
        `;
    } else {
        box.style.display = 'none';
    }
};

window.addSizeField = () => {
    let container = document.getElementById('admin-sizes-container');
    let div = document.createElement('div');
    div.style.display = 'flex';
    div.style.gap = '8px';
    div.style.marginBottom = '8px';
    div.className = 'size-input-row';
    div.innerHTML = `
        <input type="text" placeholder="Razmer (masalan: 92.5)" style="flex:1; padding:10px; background:rgba(0,0,0,0.5); color:white; border:1px solid var(--glass-border); border-radius:8px;" class="size-name">
        <input type="number" placeholder="Soni" style="flex:1; padding:10px; background:rgba(0,0,0,0.5); color:white; border:1px solid var(--glass-border); border-radius:8px;" class="size-stock">
        <button type="button" onclick="this.parentElement.remove()" style="background:var(--accent-red); color:white; border:none; border-radius:8px; padding:0 15px; cursor:pointer; font-weight:bold;">X</button>
    `;
    container.appendChild(div);
};

// 🚨 MUAMMOLARNI TO'LIQ HAL QILUVCHI KOD (NUQTADAN HIMOYALANGAN)

window.updateCartBadge = () => {
    let tot = 0;
    for(let key in cart) {
        if(cart[key]) {
            let val = parseInt(cart[key]);
            if(!isNaN(val)) tot += val;
        }
    }
    let b = document.getElementById('nav-badge'); 
    if(!b) return;
    b.innerText = tot; 
    if(tot > 0) { 
        b.classList.add('show'); 
        b.classList.remove('pulse'); 
        void b.offsetWidth; 
        b.classList.add('pulse'); 
    } else { 
        b.classList.remove('show'); 
    } 
};

window.addToCartWithOptions = (finalId) => { 
    // Firebase xato bermasligi uchun nuqtani himoyalaymiz
    let safeId = finalId.replace(/\./g, "_dot_");
    cart[safeId] = (parseInt(cart[safeId]) || 0) + 1; 
    saveLocalCart(); 
    updateCartBadge(); 
    if(typeof tg !== 'undefined' && tg.HapticFeedback) tg.HapticFeedback.impactOccurred('medium'); 
    Haptics.success(); // ✅ Muvaffaqiyatli tebranish qo'shildi
    showToast('Savatda!'); 
};


window.chg = (safeId, d) => { 
    let [baseId, carOptRaw] = String(safeId).split('||');
    let p = productsDB.find(x => x.id == baseId);
    if(!p) return;
    
    let carOpt = carOptRaw ? carOptRaw.replace(/_dot_/g, ".") : "";
    
    let st = 10;
    if (p.product_type === 'razmerli' && p.sizes) {
        let sizeObj = p.sizes.find(s => s.size === carOpt);
        if(sizeObj) st = sizeObj.stock;
    } else {
        st = p.stock !== undefined ? p.stock : 10;
    }
    
    let totalInCart = 0;
    for(let cid in cart) { if(cid.startsWith(baseId + "||" + (carOptRaw||""))) totalInCart += parseInt(cart[cid]) || 0; }
    
    if(d > 0 && totalInCart >= st) { showToast("Omborda bunday ko'p emas", "warning"); return; }
    cart[safeId] = (parseInt(cart[safeId]) || 0) + d; 
    if(cart[safeId] <= 0) delete cart[safeId]; 
    saveLocalCart(); updateCartBadge(); renderCartItems(); 
};

// =====================================
// 📍 MANZIL, ISM VA NUQTA MUAMMOLARINI HAL QILUVCHI YAKUNIY KOD
// =====================================

// 🔁 Buyurtma attemptId — SERVER idempotentligi uchun (Worker /order-commit).
//    Bir XIL savat tarkibi qayta yuborilsa AYNI attemptId ishlatiladi (server
//    bir xil natijani qaytaradi). Savat o'zgarsa — yangi tasodifiy id.
function _randAttemptId() {
    var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
    var s = '';
    for (var i = 0; i < 20; i++) s += chars.charAt(Math.floor(Math.random() * chars.length));
    return s;
}
window._orderAttemptId = function (sig) {
    try {
        var raw = localStorage.getItem('avto_order_attempt');
        var obj = raw ? JSON.parse(raw) : null;
        if (obj && obj.sig === sig && obj.id) return obj.id;
        var id = _randAttemptId();
        localStorage.setItem('avto_order_attempt', JSON.stringify({ sig: sig, id: id }));
        return id;
    } catch (e) { return _randAttemptId(); }
};
window._orderAttemptClear = function () {
    try { localStorage.removeItem('avto_order_attempt'); } catch (e) {}
};

// ⚙️ SERVER-AUTHORITATIVE BUYURTMA — barcha pul/stok/cashback SERVERDA (Worker
//    /order-commit). Mijoz brauzeri buyurtma/stok/cashback YOZMAYDI (yangi
//    database.rules.json). Bu funksiya faqat so'rov yuboradi va natijani ko'rsatadi.
window.confirmOrder = async (paymentMethod) => {
    const loadingOverlay = document.getElementById('order-loading-overlay');
    if (window._ordLoader) window._ordLoader.show();
    else if(loadingOverlay) loadingOverlay.classList.add('active');

    var _hideLoader = function (okFlag) {
        try {
            if (window._ordLoader && window._ordLoader.finish) window._ordLoader.finish(okFlag);
            else if (window._ordLoader) window._ordLoader.hide();
        } catch (e) {}
        if (loadingOverlay) loadingOverlay.classList.remove('active');
    };

    try {
        let now = Date.now();
        // Spamdan himoya (15s)
        if (typeof lastOrderTime !== 'undefined' && now - lastOrderTime < 15000) {
            if(typeof showToast === 'function') showToast("Kuting! Qayta xarid uchun 15 soniya kerak.", "warning");
            if (window._ordLoader) window._ordLoader.hide();
            if(loadingOverlay) loadingOverlay.classList.remove('active');
            return { ok: false, reason: 'spam' };
        }
        window.lastOrderTime = now;

        // 🔑 XAVFSIZ ULANISH — Worker /order-commit auth (initData yoki idToken) talab qiladi.
        //    (Haqiqiy kredential `_workerPost` ichida olinadi va 401 da yangilanadi.)
        try { if (window._ensureAuth) await window._ensureAuth(); } catch (e) {}
        var _cred = null;
        try { _cred = window._authCred ? await window._authCred() : null; } catch (e) { _cred = null; }
        if (!_cred) {
            _hideLoader(false);
            try { showToast("Xavfsiz ulanish kerak", "warning"); } catch (e) {}
            window.lastOrderTime = 0;
            return { ok: false, reason: 'auth' };
        }

        // 🛒 Savatdan qatorlarni yig'amiz. Server narx/stok/summani O'ZI hisoblaydi;
        //    estimatedTotal faqat cashback taxmini uchun (serverda cheklanadi).
        var items = [];
        var estimatedTotal = 0;
        for (let safeId in cart) {
            if (!cart[safeId]) continue;
            let parts = String(safeId).split('||');
            let baseId = parts[0];
            let carOptRaw = parts[1] || "";
            let carOpt = carOptRaw.replace(/_dot_/g, ".");
            let qty = parseInt(cart[safeId]) || 0;
            if (qty <= 0) continue;
            let p = productsDB.find(x => x.id == baseId);
            // Razmeri yo'q tovar -> "" (server buni "Universal" deb qabul qiladi).
            var _size = (carOpt && carOpt !== "Universal") ? carOpt : "";
            items.push({ id: String(baseId), size: _size, qty: qty });
            if (p) estimatedTotal += (p.price || 0) * qty;
        }
        if (!items.length) {
            _hideLoader(false);
            try { showToast("Savat bo'sh", "warning"); } catch (e) {}
            window.lastOrderTime = 0;
            return { ok: false, reason: 'empty' };
        }

        // 🔁 Savat imzosiga bog'langan barqaror attemptId (bir xil savatni qayta
        //    yuborish xavfsiz — server bir xil natija qaytaradi).
        var _sig = items.map(function (it) { return it.id + ':' + it.size + ':' + it.qty; }).sort().join('|');
        var _attemptId = window._orderAttemptId(_sig);

        // 🎁 So'ralgan cashback — SERVER cheklaydi (pulga ishonmaymiz).
        var cashbackRequested = 0;
        try { if (window._cbGetApplied) cashbackRequested = window._cbGetApplied(estimatedTotal) || 0; } catch (e) { cashbackRequested = 0; }

        // 📞 Mijoz ma'lumotlari (manzil bazadan tiklanadi, kerak bo'lsa)
        if (currentUser && (!myProfile.address || myProfile.address === "Noma'lum")) {
            try {
                let snap = await db.ref('users/' + currentUser + '/profile').once('value');
                if (snap.exists() && snap.val().address) myProfile.address = snap.val().address;
            } catch (e) {}
        }
        var profName = myProfile.name || userName || "Ismsiz mijoz";
        var profPhone = myProfile.phone || "";
        var userTgLink = (tg.initDataUnsafe && tg.initDataUnsafe.user && tg.initDataUnsafe.user.username)
            ? tg.initDataUnsafe.user.username : "";
        var custAddress = myProfile.address || (typeof botRegion !== 'undefined' ? botRegion : '') || "";

        // 🚚 Yetkazish (courier / bts) — joriy kodning derivatsiyasi bilan bir xil
        var _dlv = window.selectedDelivery || {};
        var deliveryMethod = _dlv.method || 'delivery';
        var deliveryAddress = custAddress;
        var deliveryMapLink = _dlv.mapLink || '';
        var deliveryNote = '';
        if (_dlv.method === 'courier') {
            deliveryAddress = _dlv.address || custAddress;
        } else if (_dlv.method === 'bts') {
            deliveryAddress = (_dlv.branch || "") + (_dlv.district ? (", " + _dlv.district) : "") + (_dlv.region ? (", " + _dlv.region) : "");
            deliveryNote = [_dlv.branchAddress, _dlv.branchLandmark].filter(Boolean).join(' ');
        }

        var _body = {
            attemptId: _attemptId,
            items: items,
            customer: { name: profName, phone: profPhone, address: custAddress, username: userTgLink },
            delivery: { method: deliveryMethod, address: deliveryAddress, mapLink: deliveryMapLink, note: deliveryNote },
            payment: { method: paymentMethod },
            cashbackRequested: cashbackRequested,
            // Xabarlar javobdan keyin ALOHIDA so'rovda (window._a1OrderDeliver).
            notifyMode: 'split'
        };

        // 🛡 SERVERDA ATOMIK: stok band qilinadi, buyurtma yoziladi, cashback hisoblanadi.
        //    Eskirgan initData (ilova 1 soatdan ko'p ochiq) — 401 bo'lsa idToken bilan
        //    qayta uriladi (ayni attemptId => server dublikat yaratmaydi).
        var resp, data;
        try {
            var _wp = await window._workerPost('/order-commit', _body);
            resp = _wp.resp;
            data = _wp.data;
        } catch (e) {
            _hideLoader(false);
            try { showToast("Xatolik! Internetni tekshiring.", "warning"); } catch (e2) {}
            window.lastOrderTime = 0;
            return { ok: false, reason: 'error' };
        }

        // 🚫 STOK YETMASA (HTTP 409, error:"stock") — serverda hech narsa yozilmadi.
        if (resp.status === 409 && data && data.error === 'stock') {
            _hideLoader(false);
            var _short = data.shortages || [];
            var _shortMsg = _short.map(function (s) {
                return '• ' + (s.name || s.id) + (s.size ? ' (' + s.size + ')' : '') +
                       ' — omborda ' + (parseInt(s.available, 10) || 0) + ' ta';
            }).join('\n');
            try { showToast("Omborda yetarli emas!", "warning"); } catch (e) {}
            try {
                var _alertTxt = "Kechirasiz, bu tovarlar omborda yetarli emas:\n\n" + _shortMsg +
                                "\n\nSavatdagi sonni kamaytirib, qayta urinib ko'ring.";
                if (typeof tg !== 'undefined' && tg.showAlert) tg.showAlert(_alertTxt);
                else alert(_alertTxt);
            } catch (e) {}
            // Bu buyurtma EMAS — 15 soniyalik kutish jazosi qo'llanmasin.
            window.lastOrderTime = 0;
            return { ok: false, reason: 'stock', shortages: _short };
        }

        // ❌ Boshqa xato (tarmoq/server) — serverning ANIQ sababini ko'rsatamiz.
        if (!resp.ok || !data || !data.ok || !data.committed || !data.order) {
            _hideLoader(false);
            var _why = (data && data.error) ? String(data.error) : '';
            var _txt = "Xatolik! Qayta urinib ko'ring.";
            if (resp && resp.status === 401) _txt = "Ulanish eskirdi — ilovani yopib qayta oching.";
            else if (data && data.retryable) _txt = "Server band — bir necha soniyadan keyin qayta bosing.";
            else if (_why) _txt = "Buyurtma o'tmadi: " + _why;
            try { showToast(_txt, "warning"); } catch (e) {}
            window.lastOrderTime = 0;
            return { ok: false, reason: 'error' };
        }

        // ✅ MUVAFFAQIYAT (committed:true). SERVER buyurtma/stok/cashback egasi:
        //    mijoz brauzeri buyurtma YOZMAYDI, stok KAMAYTIRMAYDI, Phase2.spendCashback
        //    CHAQIRMAYDI. on('value') listener buyurtmani serverdan o'zi tortadi.
        var order = data.order;
        // 📨 Adminlarga kartochka + mijozga tasdiq — DARHOL, alohida so'rovda.
        if (data.deliver) { try { window._a1OrderDeliver(data.deliver); } catch (e) {} }
        try { window._orderAttemptClear(); } catch (e) {}

        // Savat va qo'llangan cashback tozalanadi
        cart = {};
        try { saveLocalCart(); } catch (e) {}
        try { if (window._flushCart) window._flushCart(); } catch (e) {}
        try { if (window._cbResetApplied) window._cbResetApplied(); } catch (e) {}
        updateCartBadge();

        // 🕒 OPTIMISTIK LOKAL KO'RSATISH — DB'ga YOZILMAYDI (buyurtma SERVER-OWNED).
        //    on('value') listener biroздан haqiqiy yozuvni tortadi va myOrders'ni
        //    to'liq almashtiradi. Buyurtmaga SERVER hisoblab yozgan ulush (cbRate)
        //    saqlanadi — cashback aynan o'sha ulush bilan beriladi (rateForOrder).
        try {
            var cbRate = (order.cbRate != null) ? order.cbRate : (window._cashbackRate ? window._cashbackRate() : 0.008);
            var _localOrder = {
                id: order.id, code: order.code, date: order.date, time: order.time,
                status: order.status || 'kutilmoqda', total: order.total,
                cashbackUsed: order.cashbackUsed || 0, payable: order.payable,
                cbRate: cbRate,
                items: order.items, itemDetails: order.itemDetails,
                customerName: order.customerName, customerPhone: order.customerPhone,
                customerAddress: order.customerAddress, customerUsername: order.customerUsername,
                deliveryMethod: order.deliveryMethod, deliveryMapLink: order.deliveryMapLink
            };
            if (Array.isArray(window.myOrders)) {
                if (!window.myOrders.some(function (x) { return x && String(x.id) === String(order.id); })) {
                    myOrders.unshift(_localOrder);
                }
            } else {
                myOrders = [_localOrder];
            }
            window.myOrders = myOrders;
        } catch (e) {}

        // 📨 Telegram xabarlari.
        //    YANGI Worker (data.notify === "server") adminlarga tugmali kartochkani va
        //    mijozga tasdiqni O'ZI yuboradi — ishonchli, ilova yopilsa ham. Bu yerda
        //    yuborsak dublikat bo'lardi.
        //    ESKI Worker (maydon yo'q) — moslik uchun brauzer yuboradi (endi BARCHA
        //    adminlarga; ilgari faqat ADMIN_IDS[0] olardi).
        if (data.notify !== 'server') try {
            var _cb = order.cashbackUsed || 0;
            var _pay = (order.payable != null) ? order.payable : order.total;
            var _lines = '';
            (order.itemDetails || []).forEach(function (it) {
                var _cOpt = (it.size && it.size !== 'Universal') ? it.size : (it.carModel || ''); var _co = _cOpt ? ' (' + escTg(_cOpt) + ')' : '';
                _lines += "\n\u25AA\uFE0F " + escTg(it.name) + _co + " \u2014 " + (it.qty || 0) +
                          " x " + (it.unitPrice || 0).toLocaleString() + " = " + (it.lineTotal || 0).toLocaleString() + " so'm";
            });
            var _adminText = "\uD83C\uDD95 <b>YANGI BUYURTMA: #" + escTg(order.code || '') + "</b>\n\n" +
                "\uD83D\uDC64 <b>Ism:</b> " + escTg(order.customerName || profName) + "\n" +
                "\uD83D\uDCDE <b>Telefon:</b> <code>" + escTg(order.customerPhone || profPhone) + "</code>\n" +
                "\uD83D\uDCCD <b>Manzil:</b> " + escTg(order.customerAddress || deliveryAddress) + "\n" +
                "\uD83C\uDD94 <b>ID:</b> <code>" + escTg(String(order.uid || currentUser || '')) + "</code>\n" +
                "\uD83D\uDCB3 <b>To'lov turi:</b> " + escTg(paymentMethod) + "\n\n" +
                "\uD83D\uDED2 <b>Mahsulotlar:</b>" + _lines +
                "\n\n\uD83D\uDCB0 <b>Jami:</b> " + (order.total || 0).toLocaleString() + " so'm";
            if (_cb > 0) {
                _adminText += "\n\uD83C\uDF81 <b>Cashback ishlatildi:</b> \u2212" + _cb.toLocaleString() + " so'm";
                _adminText += "\n\uD83D\uDCB5 <b>TO'LANADI:</b> " + _pay.toLocaleString() + " so'm";
            }
            try {
                var _vipTag = (window.VIP && window.VIP.orderTag) ? window.VIP.orderTag() : '';
                if (_vipTag) _adminText += "\n\n" + escTg(_vipTag);
            } catch (e) {}
            ADMIN_IDS.forEach(function (aid) {
                try { tgProxySend({ chat_id: aid, text: _adminText, parse_mode: "HTML" }); } catch (e) {}
            });
            if (currentUser) {
                // Matn Worker'dagi `created` bilan bir xil ma'noda: do'kon hali QABUL
                // QILMAGAN (aks holda keyingi "qabul qilindi" xabari dublikatdek tuyuladi).
                tgProxySend({ chat_id: currentUser, text: "\uD83E\uDDFE Buyurtmangiz do'konga yuborildi!\n\uD83C\uDD94 Kod: #" + (order.code || '') +
                    (_cb > 0 ? "\n\uD83C\uDF81 Cashback: \u2212" + _cb.toLocaleString() + " so'm\n\uD83D\uDCB5 To'lanadi: " + _pay.toLocaleString() + " so'm" : '') +
                    "\n\uD83D\uDCDE Bog'lanish: " + profPhone });
            }
        } catch (e) {}

        // ✅ Animatsiya + konfetti + yopilish (mavjud xatti-harakat saqlanadi).
        var _animDone = (window._ordLoader && window._ordLoader.finish)
            ? window._ordLoader.finish(true)
            : Promise.resolve();
        if (loadingOverlay) loadingOverlay.classList.remove('active');
        showToast("Qabul qilindi!");
        shootConfetti();

        var _closed = false;
        var _doClose = function () {
            if (_closed) return; _closed = true;
            var _inTg = false; try { _inTg = !!(tg && tg.initData); } catch (e) {}
            if (!_inTg) {
                // Ilova / brauzer: yopiladigan narsa yo'q — toza bosh sahifaga qaytamiz.
                // (Karta orqali o'tkazma olib tashlandi — chek uchun Telegram endi ochilmaydi.)
                try { if (window.a1ResetToHome) window.a1ResetToHome(); } catch (e) {}
                return;
            }
            try { tg.close(); } catch (e) {}
        };
        Promise.race([
            Promise.resolve(_animDone),
            new Promise(function (r) { setTimeout(r, 6000); })
        ]).then(_doClose);

        // ✅ Wrapper (pastda) faqat shu holatda konfetti + pticha ko'rsatadi.
        return { ok: true, code: order.code };
    } catch (err) {
        if (window._ordLoader && window._ordLoader.finish) window._ordLoader.finish(false);
        if (loadingOverlay) loadingOverlay.classList.remove('active');
        showToast("Xatolik! Internetni tekshiring.", "warning");
        window.lastOrderTime = 0;
        return { ok: false, reason: 'error' };
    }
};

// ==========================================
// 📦 1. VIZUAL KUZATUV ZANJIRI (TIMELINE)
// ==========================================
window.getTimelineHTML = (status) => {
    var X = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';
    var C = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>';
    if (status === 'bekor_qilingan') {
        return '<div class="mo-cancelled">' + X + '<div><b>Buyurtma bekor qilingan</b><span>Ishlatilgan mablag\' va cashback qaytarilgan.</span></div></div>';
    }
    var FLOW = ['kutilmoqda', 'qabul', 'yolda', 'yetkazildi'];
    var LBL = ['Kutilmoqda', 'Qabul', "Yo'lda", 'Yetkazildi'];
    var HINT = {
        kutilmoqda: "Do'kon buyurtmangizni ko'rib chiqmoqda",
        qabul: "Buyurtma qabul qilindi va tayyorlanmoqda",
        yolda: "Buyurtmangiz yo'lda — tez orada yetib boradi",
        yetkazildi: "Buyurtma yetkazib berildi. Xaridingiz uchun rahmat!"
    };
    var cur = Math.max(0, FLOW.indexOf(status || 'kutilmoqda'));
    var done = status === 'yetkazildi';
    return '<div class="mo-hint">' + (HINT[FLOW[cur]] || '') + '</div><div class="mo-steps">' + FLOW.map(function (f, i) {
        var c = (i < cur || (i === cur && done)) ? 'done' : (i === cur ? 'cur' : '');
        return '<div class="mo-step ' + c + '"><i>' + (c === 'done' ? C : '') + '</i><span>' + LBL[i] + '</span></div>';
    }).join('') + '</div>';
};

// 🧾 BUYURTMA QATORLARI HTML — SERVER `itemDetails` ni AFZAL ko'radi.
//    Server buyurtmasi { itemDetails:[{id,name,size,qty,unitPrice,lineTotal}] }
//    beradi (nom/narx buyurtma vaqtida qotirilgan). Eski buyurtmalar (itemDetails
//    yo'q) uchun ESKI yo'l: `items` map (baseId||carOpt) + productsDB lookup.
window._odItemsHTML = function (o) {
    var pdb = window.productsDB || (typeof productsDB !== 'undefined' ? productsDB : []);
    var iH = '';
    var _th = (typeof window._thumb === 'function') ? window._thumb : function (u) { return u; };
    function row(imgSrc, nameHTML, qty, lineTotal) {
        var imgTag = imgSrc
            ? '<img class="mo-li-img" src="' + escHtml(_th(imgSrc, 160)) + '" alt="" loading="lazy" decoding="async" onerror="this.style.visibility=\'hidden\'">'
            : '<span class="mo-li-img"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8l-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8M12 13v8"/></svg></span>';
        return '<div class="mo-li">' + imgTag +
            '<div class="mo-li-mid"><div class="mo-li-nm">' + nameHTML + '</div>' +
            '<div class="mo-li-meta">' + qty + ' dona</div></div>' +
            '<span class="mo-li-sum">' + (Number(lineTotal) || 0).toLocaleString() + "</span></div>";
    }
    if (o && Array.isArray(o.itemDetails) && o.itemDetails.length) {
        o.itemDetails.forEach(function (it) {
            var p = pdb.find(function (x) { return x.id == it.id; });
            var imgSrc = p ? (p.img || p.image || '') : '';
            var carOpt = (it.size && it.size !== 'Universal') ? it.size : (it.carModel || '');
            var carOptHTML = carOpt ? '<span class="mo-li-opt">' + escHtml(carOpt) + '</span>' : '';
            var line = (it.lineTotal != null) ? it.lineTotal : ((Number(it.unitPrice) || 0) * (Number(it.qty) || 0));
            iH += row(imgSrc, escHtml(it.name) + carOptHTML, (it.qty || 0), line);
        });
        return iH;
    }
    // Eski buyurtmalar uchun zaxira
    for (var fullId in (o && o.items ? o.items : {})) {
        var parts = String(fullId).split('||');
        var baseId = parts[0];
        var carOptRaw = parts[1];
        var pp = pdb.find(function (x) { return x.id == baseId; });
        if (!pp) continue;
        var co = carOptRaw ? carOptRaw.replace(/_dot_/g, ".") : "";
        var coHTML = (co && co !== "Universal") ? '<span class="mo-li-opt">' + escHtml(co) + '</span>' : '';
        iH += row(pp.img || pp.image || '', escHtml(pp.name) + coHTML, o.items[fullId], (pp.price * o.items[fullId]));
    }
    return iH;
};

// ==========================================
// 📦 2. BUYURTMA ICHIGA KIRISH (KABINETDAN)
// ==========================================
window.openOrderDetails = (id) => { 
     let o = myOrders.find(x => x.id == id);
    if(!o) return; 
    
    currentOpenOrderId = id; 
    
    document.getElementById('od-code').innerText = "#" + (o.code || o.id); 
    document.getElementById('od-date').innerText = [o.date, o.time].filter(Boolean).join(" \u00B7 "); 
    
    // Eski yozuv o'rniga Zanjirni ulaymiz
    document.getElementById('od-status').innerHTML = getTimelineHTML(o.status || 'kutilmoqda'); 
    document.getElementById('od-status').setAttribute('data-st', o.status || 'kutilmoqda');
    
    document.getElementById('od-items').innerHTML = window._odItemsHTML(o);
    document.getElementById('od-total').innerText = (Number(o.total) || 0).toLocaleString() + " so'm";
    try { window._renderOrderCancel(o); } catch (e) {}
    
    // CHAT FUNKSIYASI SHU YERDA CHAQIRILADI (Yo'qolib ketmaydi)
    if(typeof renderChatMessages === 'function') renderChatMessages();
    openModal('orderDetailModal'); 
};

// ==========================================
// ❌ MIJOZ BUYURTMANI O'ZI BEKOR QILADI
//    Ilgari bunday imkoniyat umuman yo'q edi — mijoz faqat adminga yozib
//    so'rashi mumkin edi. Endi do'kon hali QABUL QILMAGAN ("kutilmoqda")
//    buyurtmani mijozning o'zi bekor qila oladi. Server (Worker) buni qayta
//    tekshiradi: faqat o'z buyurtmasi va faqat "kutilmoqda" holatida.
//    Tovarlar omborga, ishlatilgan cashback mijozga qaytadi; adminlarga
//    ogohlantirish boradi.
// ==========================================
window._renderOrderCancel = function (o) {
    var box = document.getElementById('od-cancel-box');
    if (!box) return;
    var st = String((o && o.status) || 'kutilmoqda');
    if (!o || st !== 'kutilmoqda' || !o.id) { box.innerHTML = ''; return; }
    box.innerHTML = '<button type="button" id="od-cancel-btn" class="mo-btn mo-danger" onclick="cancelMyOrder(\'' + escHtml(String(o.id)) + '\')">' +
        'Buyurtmani bekor qilish</button>' +
        '<div class="mo-note">Do\'kon buyurtmani qabul qilgunga qadar bekor qilish mumkin.</div>';
};

window.cancelMyOrder = async function (orderId) {
    var o = (window.myOrders || myOrders || []).find(function (x) { return x && String(x.id) === String(orderId); });
    if (!o) return;
    if (String(o.status || 'kutilmoqda') !== 'kutilmoqda') {
        showToast("Buyurtma allaqachon qabul qilingan — do'kon bilan bog'laning", "warning");
        return;
    }
    if (!currentUser) { showToast("Xavfsiz ulanish kerak", "warning"); return; }
    var ok = await window._a1Confirm("#" + (o.code || o.id) + " buyurtmasini bekor qilasizmi?\n\nBu amalni qaytarib bo'lmaydi.");
    if (!ok) return;
    var btn = document.getElementById('od-cancel-btn');
    if (btn) { btn.disabled = true; btn.style.opacity = '0.6'; btn.innerText = '⏳ Bekor qilinmoqda...'; }
    var r;
    try {
        r = await window._workerPost('/order-status', { uid: String(currentUser), orderId: String(o.id), status: 'bekor_qilingan', notifyMode: 'split' });
    } catch (e) {
        showToast("Internetni tekshiring", "warning");
        try { window._renderOrderCancel(o); } catch (e2) {}
        return;
    }
    if (r && r.resp && r.resp.ok && r.data && r.data.ok) {
        if (r.data.deliver) { try { window._a1OrderDeliver(r.data.deliver); } catch (e) {} }
        o.status = 'bekor_qilingan';
        showToast("Buyurtma bekor qilindi");
        try { if (navigator.vibrate) navigator.vibrate(30); } catch (e) {}
        try { document.getElementById('od-status').innerHTML = getTimelineHTML('bekor_qilingan'); } catch (e) {}
        try { window._renderOrderCancel(o); } catch (e) {}
        try { if (typeof renderMyOrders === 'function') renderMyOrders(); } catch (e) {}
        return;
    }
    var err = (r && r.data && r.data.error) ? String(r.data.error) : '';
    if (r && r.resp && r.resp.status === 409 && r.data && r.data.currentStatus) {
        o.status = r.data.currentStatus;
        try { document.getElementById('od-status').innerHTML = getTimelineHTML(o.status); } catch (e) {}
        showToast("Buyurtma allaqachon qabul qilingan — do'kon bilan bog'laning", "warning");
    } else if (r && r.resp && r.resp.status === 403) {
        showToast("Bu buyurtmani bekor qilib bo'lmaydi", "warning");
    } else {
        showToast("Bekor qilinmadi" + (err ? ": " + err : ""), "warning");
    }
    try { window._renderOrderCancel(o); } catch (e) {}
};

// 🧾 ADMIN buyurtma qatorlari — SERVER `itemDetails` ni afzal ko'radi, eski
//    buyurtmalar uchun `items` map + productsDB zaxira yo'li.
window._adminOrderItemsHTML = function (o) {
    var pdb = window.productsDB || (typeof productsDB !== 'undefined' ? productsDB : []);
    var rows = '';
    function row(nameHTML, qty, sum) {
        return '<div class="ao-item"><span class="ao-item-nm">' + nameHTML + '</span>' +
            '<span class="ao-item-q">\u00D7' + qty + '</span>' +
            '<span class="ao-item-p">' + (Number(sum) || 0).toLocaleString() + ' s</span></div>';
    }
    if (o && Array.isArray(o.itemDetails) && o.itemDetails.length) {
        o.itemDetails.forEach(function (it) {
            var carOpt = (it.size && it.size !== 'Universal') ? it.size : (it.carModel || '');
            var nm = escHtml(it.name) + (carOpt ? '<span class="ao-opt">' + escHtml(carOpt) + '</span>' : '');
            var line = (it.lineTotal != null) ? it.lineTotal : ((Number(it.unitPrice) || 0) * (Number(it.qty) || 0));
            rows += row(nm, (it.qty || 0), line);
        });
        return rows;
    }
    for (var pid in (o && o.items ? o.items : {})) {
        var parts = String(pid).split('||');
        var baseId = parts[0];
        var carOptRaw = parts[1];
        var p = pdb.find(function (x) { return x.id == baseId; });
        if (!p) continue;
        var co = carOptRaw ? carOptRaw.replace(/_dot_/g, ".") : "";
        var nm2 = escHtml(p.name) + ((co && co !== "Universal") ? '<span class="ao-opt">' + escHtml(co) + '</span>' : '');
        rows += row(nm2, o.items[pid], (p.price * o.items[pid]));
    }
    return rows;
};

// =====================================
// 📦 ADMIN: BUYURTMALAR RO'YXATI (iOS USLUBIDAGI DIZAYN)
//   Faqat ko'rinish yangilangan — handlerlar, holat oqimi, paginatsiya,
//   VIP slot va yig'ish tugmasi avvalgidek.
// =====================================
window._AOI = {
    user: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zm0 2.2c-3.6 0-8 1.8-8 4.6V21h16v-2.2c0-2.8-4.4-4.6-8-4.6z"/></svg>',
    phone: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1A17 17 0 0 1 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1l-2.3 2.2z"/></svg>',
    pin: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z"/></svg>',
    list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2"/></svg>',
    chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8.5 8.5 0 0 1-12.4 7.6L3 21l1.5-5A8.5 8.5 0 1 1 21 12z"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>',
    truck: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 4h13v12H1zM14 9h4l4 4v3h-8z"/><circle cx="6" cy="18.5" r="2"/><circle cx="18" cy="18.5" r="2"/></svg>',
    flag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 21V4M5 4h11l-2 4 2 4H5"/></svg>',
    xmark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    undo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/></svg>',
    box: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8l-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8M12 13v8"/></svg>'
};

window._AOI.chev = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>';
window._AOI.at = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21.9 4.3l-3.2 15c-.2 1-.9 1.3-1.8.8l-4.9-3.6-2.4 2.3c-.3.3-.5.5-1 .5l.3-5 9.2-8.3c.4-.4-.1-.6-.6-.2L6.2 13l-4.9-1.5c-1-.3-1.1-1 .2-1.5L20.6 2.8c.9-.3 1.6.2 1.3 1.5z"/></svg>';
window._AOI.map = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M15 5.1L9 3 3 5v16l6-2 6 2 6-2V3l-6 2.1zM15 19l-6-2.1V5l6 2.1V19z"/></svg>';
window._AOI.card = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z"/></svg>';
window._AO_ST = { kutilmoqda: 'Kutilmoqda', qabul: 'Qabul', yolda: "Yo'lda", yetkazildi: 'Yetkazildi', bekor_qilingan: 'Bekor' };

window._aoUnread = function (o) {
    var n = 0;
    if (o && o.messages) {
        for (var i = o.messages.length - 1; i >= 0; i--) {
            if (o.messages[i].sender === 'admin') break;
            if (o.messages[i].sender === 'mijoz') n++;
        }
    }
    return n;
};
window._aoInitials = function (name) {
    var w = String(name || '').trim().split(/\s+/).filter(Boolean).slice(0, 2);
    var t = w.map(function (x) { return Array.from(x)[0] || ''; }).join('').toUpperCase();
    return t || '?';
};
window._aoItemCount = function (o) {
    if (o && Array.isArray(o.itemDetails) && o.itemDetails.length) return o.itemDetails.length;
    return o && o.items ? Object.keys(o.items).length : 0;
};

window.renderAdminOrdersUI = (ordersArr) => {
    let box = document.getElementById('admin-orders-render-box');
    if(!box) return;
    const I = window._AOI;

    // Yangi ro'yxat (filtr / qayta ochish) bo'lsagina kirish animatsiyasi —
    // paginatsiyada (pastga yuklash) qatorlar qayta "sakramaydi".
    let isFresh = window.lastOrdersRef !== ordersArr;
    if (isFresh) {
        window.adminOrdersLimit = 20;
        window.lastOrdersRef = ordersArr;
    }
    box.classList.toggle('ao-anim', isFresh);
    try { window._aoUpdateCounts && window._aoUpdateCounts(); } catch (e) {}

    if(ordersArr.length === 0) { 
        box.innerHTML = '<div class="ao-empty"><div class="ao-empty-ic">' + I.box + '</div><b>Buyurtmalar topilmadi</b>Bu bo\'limda hozircha buyurtma yo\'q.</div>'; 
        return; 
    }
    
    let visibleOrders = ordersArr.slice(0, window.adminOrdersLimit);

    // 📅 Kun bo'yicha guruhlash: "Bugun", "Kecha", sana
    let _now = new Date();
    let _today = _now.toLocaleDateString('uz-UZ');
    let _yest = new Date(_now.getTime() - 864e5).toLocaleDateString('uz-UZ');
    let dayCount = {};
    ordersArr.forEach(o => { let k = o.date || ''; dayCount[k] = (dayCount[k] || 0) + 1; });
    let lastDay = null;

    let html = visibleOrders.map((o, idx) => {
        let st = o.status || 'kutilmoqda';
        let unread = window._aoUnread(o);
        let rawName = o.customerName || o.uN || 'Ismsiz mijoz';
        let n = window._aoItemCount(o);
        let sub = [`<b>#${escHtml(o.code || o.id)}</b>`];
        if (o.time) sub.push(escHtml(String(o.time).slice(0, 5)));
        if (n) sub.push(n + ' ta');

        let head = '';
        let dk = o.date || '';
        if (dk !== lastDay) {
            lastDay = dk;
            let lbl = dk === _today ? 'Bugun' : (dk === _yest ? 'Kecha' : (dk || 'Sanasiz'));
            head = `<div class="ao-day" style="--i:${idx}"><span>${escHtml(lbl)}</span><em>${dayCount[dk] || ''}</em></div>`;
        }

        return head + `
        <button type="button" class="ao-o ao-st-${escHtml(st)}" style="--i:${idx}" onclick="openAdminOrderDetail('${o.uI}', '${o.id}')">
            <span class="ao-av">${escHtml(window._aoInitials(rawName))}${unread > 0 ? `<span class="ao-badge">${unread}</span>` : ''}</span>
            <span class="ao-o-mid">
                <span class="ao-o-name"><span class="t">${escHtml(rawName)}</span><!-- 👑 VIP daraja belgisi shu bo'sh joyga qo'yiladi (fayl oxiridagi qatlam to'ldiradi) --><span class="cst-vip-slot" data-order-uid="${o.uI || ''}"></span></span>
                <span class="ao-o-sub">${sub.join(' \u00B7 ')}</span>
            </span>
            <span class="ao-o-end">
                <span class="ao-pill">${window._AO_ST[st] || escHtml(st)}</span>
                <span class="ao-o-sum">${(Number(o.total)||0).toLocaleString()}<small>so'm</small></span>
            </span>
            <span class="ao-chev">\u203A</span>
        </button>`;
    }).join(''); 
        
    if (window.adminOrdersLimit < ordersArr.length) {
        html += `<div class="ao-more"><span class="ao-spin"></span>Yana yuklanmoqda\u2026</div>`;
    }
    
    box.innerHTML = html;
};

// =====================================
// 🧾 ADMIN: BITTA BUYURTMA SAHIFASI
//   Ro'yxatdagi qator bosilganda ochiladi. Tugmalar o'sha eski funksiyalarni
//   chaqiradi (changeOrderStatus / openAdminChat / openAdminOrderPick).
//   Holat o'zgarishi — yig'ish oynasidagidek: avval ro'yxatga qaytamiz,
//   keyin holat o'zgaradi (ro'yxat serverdan qayta o'qiladi).
// =====================================
window._aoDetailKey = null;
window._aoFindOrder = function (uid, id) {
    return (window.allFetchedOrders || []).find(function (x) { return String(x.uI) === String(uid) && String(x.id) === String(id); }) || null;
};

window.openAdminOrderDetail = function (uid, id) {
    var o = window._aoFindOrder(uid, id);
    if (!o) { if (typeof showToast === 'function') showToast('Buyurtma topilmadi', 'warning'); return; }
    window._aoDetailKey = { uid: uid, id: id };
    document.getElementById('adminOrdersModal').style.display = 'none';
    var m = _reshowModal('adminOrderSheetModal');
    if (m) m.scrollTop = 0;
    document.body.style.overflow = 'hidden';
    activeModal = 'adminOrderSheetModal';
    window.history.pushState({ modal: 'adminOrderSheetModal' }, "");
    try { tg.BackButton.show(); } catch (e) {}
    updateBtns();
    window._aoRenderDetail(true);
    try { if (window._hap) window._hap('light'); } catch (e) {}
};

// Chat / yig'ish oynasidan orqaga — sahifa ochiq bo'lgan bo'lsa unga qaytamiz.
window._aoBackToDetail = function () {
    var k = window._aoDetailKey;
    if (!k || !window._aoFindOrder(k.uid, k.id)) return false;
    activeModal = 'adminOrderSheetModal';
    _reshowModal('adminOrderSheetModal');
    document.body.style.overflow = 'hidden';
    window._modalStack = [];
    window._aoRenderDetail(false);
    return true;
};

window._aoHideDetail = function () {
    window._aoDetailKey = null;
    var m = document.getElementById('adminOrderSheetModal');
    if (!m) return;
    try { if (window._modalCancelClose) window._modalCancelClose(m); } catch (e) {}
    m.style.display = 'none';
};

// ⚡ Holat tugmasi: endi sahifadan CHIQMAYMIZ. Soatcha darhol chiqadi, holat
//    o'zgargach sahifa joyida yangilanadi (yangi holat + keyingi tugma).
//    Ilgari avval ro'yxatga qaytilar, 280 ms kutilar, keyin butun ro'yxat
//    serverdan qayta yuklanardi — bosilgandan keyin bir necha soniya "hech
//    narsa bo'lmayotgandek" tuyulardi.
window._aoDetailStatus = function (uid, id, status) {
    try { changeOrderStatus(uid, id, status); } catch (e) {}
};

window._aoLines = function (o) {
    var pdb = window.productsDB || (typeof productsDB !== 'undefined' ? productsDB : []);
    var out = [];
    if (o && Array.isArray(o.itemDetails) && o.itemDetails.length) {
        o.itemDetails.forEach(function (it) {
            if (!it) return;
            var p = pdb.find(function (x) { return x.id == it.id; });
            var qty = Number(it.qty) || 0;
            var unit = Number(it.unitPrice) || (p ? Number(p.price) || 0 : 0);
            var line = (it.lineTotal != null) ? (Number(it.lineTotal) || 0) : unit * qty;
            out.push({ name: it.name || (p && p.name) || '', opt: (it.size && it.size !== 'Universal') ? it.size : (it.carModel || ''), qty: qty, unit: unit, line: line, img: p ? (p.img || p.image || '') : '' });
        });
        return out;
    }
    for (var pid in (o && o.items ? o.items : {})) {
        var parts = String(pid).split('||');
        var p2 = pdb.find(function (x) { return x.id == parts[0]; });
        if (!p2) continue;
        var co = parts[1] ? parts[1].replace(/_dot_/g, '.') : '';
        var q2 = Number(o.items[pid]) || 0;
        out.push({ name: p2.name, opt: (co && co !== 'Universal') ? co : '', qty: q2, unit: Number(p2.price) || 0, line: (Number(p2.price) || 0) * q2, img: p2.img || p2.image || '' });
    }
    return out;
};

window._aoRenderDetail = function (animate) {
    var k = window._aoDetailKey; if (!k) return;
    var o = window._aoFindOrder(k.uid, k.id); if (!o) return;
    var box = document.getElementById('ao-detail'); if (!box) return;
    var I = window._AOI, st = o.status || 'kutilmoqda', uid = o.uI, id = o.id;
    var fmt = function (n) { return (Number(n) || 0).toLocaleString(); };

    // — Holat bosqichlari
    var FLOW = ['kutilmoqda', 'qabul', 'yolda', 'yetkazildi'];
    var LBL = ['Kutilmoqda', 'Qabul', "Yo'lda", 'Yetkazildi'];
    var cur = FLOW.indexOf(st);
    var steps = st === 'bekor_qilingan'
        ? '<div class="ao-cancelled">' + I.xmark + 'Buyurtma bekor qilingan</div>'
        : '<div class="ao-steps">' + FLOW.map(function (f, i) {
            var c = (i < cur || (i === cur && st === 'yetkazildi')) ? 'done' : (i === cur ? 'cur' : '');
            return '<div class="ao-step ' + c + '"><i>' + (c === 'done' ? I.check : '') + '</i><span>' + LBL[i] + '</span></div>';
        }).join('') + '</div>';

    var when = [o.date, o.time].filter(Boolean).map(escHtml).join(' \u00B7 ');
    var hero = '<section class="ao-hero ao-st-' + escHtml(st) + '">' +
        '<div class="ao-hero-top"><span class="ao-hero-code">#' + escHtml(o.code || o.id) + '</span>' + getStatusHTML(st) + '</div>' +
        (when ? '<div class="ao-hero-when">' + when + '</div>' : '') +
        '<div class="ao-hero-sum"><b>' + fmt(o.total) + '</b><small>so\'m</small></div>' +
        steps + '</section>';

    // — Mijoz
    var rawName = o.customerName || o.uN || 'Ismsiz mijoz';
    var phone = String(o.customerPhone || o.uP || '');
    var user = String(o.customerUsername || (o.customer && o.customer.username) || '').replace(/^@+/, '');
    var addr = o.customerAddress && o.customerAddress !== 'Kiritilmagan' ? o.customerAddress : '';
    var mapLink = String(o.deliveryMapLink || (o.delivery && o.delivery.mapLink) || '');
    var vip = '';
    try {
        var vs = document.querySelector('#admin-orders-render-box .cst-vip-slot[data-filled="1"][data-order-uid="' + String(uid).replace(/["\\]/g, '') + '"]');
        if (vs) vip = vs.outerHTML;
    } catch (e) {}
    var cust = '<div class="ao-dsec"><span>Mijoz</span></div><div class="ao-group">' +
        '<div class="ao-row ao-name"><span class="ao-ic" style="--ic:var(--ao-gray)">' + I.user + '</span><span class="ao-row-tx">' + escHtml(rawName) + vip + '</span></div>' +
        (phone ? '<a class="ao-row ao-link" href="tel:' + escHtml(phone.replace(/\s+/g, '')) + '"><span class="ao-ic" style="--ic:#34c759">' + I.phone + '</span><span class="ao-row-tx">' + escHtml(phone) + '</span><span class="ao-chev">\u203A</span></a>' : '') +
        (user && /^[A-Za-z0-9_]{3,64}$/.test(user) ? '<a class="ao-row ao-link" href="https://t.me/' + user + '" target="_blank" rel="noopener"><span class="ao-ic" style="--ic:#2aabee">' + I.at + '</span><span class="ao-row-tx">@' + escHtml(user) + '</span><span class="ao-chev">\u203A</span></a>' : '') +
        (addr ? '<div class="ao-row ao-addr"><span class="ao-ic" style="--ic:#ff9500">' + I.pin + '</span><span class="ao-row-tx">' + escHtml(addr) + '</span></div>' : '') +
        (/^https:\/\//i.test(mapLink) ? '<a class="ao-row ao-link" href="' + escHtml(mapLink) + '" target="_blank" rel="noopener"><span class="ao-ic" style="--ic:#5e5ce6">' + I.map + '</span><span class="ao-row-tx">Xaritada ko\'rish</span><span class="ao-chev">\u203A</span></a>' : '') +
        '</div>';

    // — Mahsulotlar
    var lines = window._aoLines(o);
    var thumb = (typeof window._thumb === 'function') ? window._thumb : function (u) { return u; };
    var items = '<div class="ao-dsec"><span>Mahsulotlar</span><span>' + lines.length + ' ta</span></div><div class="ao-group">' +
        (lines.length ? lines.map(function (l) {
            var img = l.img
                ? '<img class="ao-li-img" src="' + escHtml(thumb(l.img, 160)) + '" alt="" loading="lazy" decoding="async" onerror="window._imgFallback ? window._imgFallback(this) : (this.style.visibility=\'hidden\')">'
                : '<span class="ao-li-img">' + I.box + '</span>';
            return '<div class="ao-li">' + img + '<div class="ao-li-mid"><div class="ao-li-nm">' + escHtml(l.name) + '</div>' +
                (l.opt ? '<span class="ao-li-opt">' + escHtml(l.opt) + '</span>' : '') +
                '<div class="ao-li-meta">' + l.qty + ' \u00D7 ' + fmt(l.unit) + ' so\'m</div></div>' +
                '<span class="ao-li-sum">' + fmt(l.line) + '</span></div>';
        }).join('') : '<div class="ao-note" style="color:var(--ao-tx2)">Mahsulot ma\'lumoti yo\'q</div>') +
        '</div>';

    // — Yig'ish
    var pickRaw = window._pickBadge ? window._pickBadge(o) : "\uD83D\uDCCB Mahsulotlarni yig'ish";
    var pickCls = pickRaw.indexOf('\u2705') === 0 ? ' is-done' : (/\d+\/\d+/.test(pickRaw) ? ' is-part' : '');
    var pick = '<div class="ao-dsec"><span>Ombor</span></div>' +
        '<button type="button" class="pick-open-btn ao-pick' + pickCls + '" onclick="openAdminOrderPick(\'' + uid + '\', \'' + id + '\')"><span class="ao-ic" style="--ic:#5e5ce6">' + I.list + '</span><span class="ao-pick-tx">' + escHtml(pickRaw.replace(/^\S+\s+/, '')) + '</span><span class="ao-chev">\u203A</span></button>';

    // — To'lov
    var DLV = { courier: 'Kuryer', bts: 'BTS pochta', delivery: 'Yetkazib berish', pickup: 'Olib ketish' };
    var dm = String(o.deliveryMethod || (o.delivery && o.delivery.method) || '');
    var pm = String((o.payment && o.payment.method) || o.paymentMethod || '');
    var cb = Number(o.cashbackUsed) || 0;
    var payable = (o.payable != null) ? Number(o.payable) || 0 : (Number(o.total) || 0) - cb;
    var pay = '<div class="ao-dsec"><span>To\'lov</span></div><div class="ao-group">' +
        (pm ? '<div class="ao-kv"><span>Usul</span><b>' + escHtml(pm) + '</b></div>' : '') +
        (dm ? '<div class="ao-kv"><span>Yetkazish</span><b>' + escHtml(DLV[dm] || dm) + '</b></div>' : '') +
        '<div class="ao-kv"><span>Mahsulotlar</span><b>' + fmt(o.total) + ' so\'m</b></div>' +
        (cb > 0 ? '<div class="ao-kv is-green"><span>Cashback</span><b>\u2212' + fmt(cb) + ' so\'m</b></div>' : '') +
        '<div class="ao-kv is-total"><span>To\'lanadi</span><b>' + fmt(payable) + ' so\'m</b></div>' +
        '</div>';

    // — Izohlar
    var dn = String((o.delivery && o.delivery.note) || '');
    var pn = String((o.payment && o.payment.note) || '');
    var notes = (dn || pn) ? '<div class="ao-dsec"><span>Izoh</span></div><div class="ao-group">' +
        (dn ? '<div class="ao-note"><small>Yetkazish</small>' + escHtml(dn) + '</div>' : '') +
        (pn ? '<div class="ao-note"><small>To\'lov</small>' + escHtml(pn) + '</div>' : '') + '</div>' : '';

    // — Pastki tugmalar (oqim o'zgarmagan)
    var unread = window._aoUnread(o);
    var q = "'" + uid + "', '" + id + "'";
    var primary = '';
    if (st === 'kutilmoqda') primary = '<button type="button" class="ao-btn ao-primary is-gold" onclick="window._aoDetailStatus(' + q + ', \'qabul\')">' + I.check + 'Qabul qilish</button>';
    else if (st === 'qabul') primary = '<button type="button" class="ao-btn ao-primary" style="--c:var(--ao-orange)" onclick="window._aoDetailStatus(' + q + ', \'yolda\')">' + I.truck + 'Yo\'lga chiqarish</button>';
    else if (st === 'yolda') primary = '<button type="button" class="ao-btn ao-primary" style="--c:var(--ao-green)" onclick="window._aoDetailStatus(' + q + ', \'yetkazildi\')">' + I.flag + 'Yetkazildi</button>';
    else if (st === 'yetkazildi') primary = '<div class="ao-done-note">' + I.check + 'Buyurtma yetkazib berilgan</div>';
    var cancel = '';
    if (st !== 'bekor_qilingan' && st !== 'yetkazildi') cancel = '<button type="button" class="ao-btn ao-danger" onclick="window._aoDetailStatus(' + q + ', \'bekor_qilingan\')">' + I.xmark + 'Bekor</button>';
    else if (st === 'yetkazildi') cancel = '<button type="button" class="ao-btn ao-danger" onclick="window._aoDetailStatus(' + q + ', \'bekor_qilingan\')">' + I.undo + 'Qaytarish</button>';
    // 💬 Chat — Shogird kabi ekran burchagidagi kichik suzuvchi tugma (dock ustida).
    var chat = '<button type="button" class="ao-chatfab' + (unread > 0 ? ' has-unread' : '') + '" aria-label="Mijoz bilan chat' + (unread > 0 ? ', ' + unread + ' ta yangi xabar' : '') + '" onclick="openAdminChat(' + q + ')">' +
        '<span class="ao-chatfab-orbit" aria-hidden="true"></span>' +
        '<span class="ao-chatfab-ic" aria-hidden="true"><svg viewBox="0 0 32 32"><path class="b" d="M7.5 6.5h17a4 4 0 0 1 4 4v9a4 4 0 0 1-4 4h-7.2l-5.8 4v-4h-4a4 4 0 0 1-4-4v-9a4 4 0 0 1 4-4Z"/><circle class="d" cx="11.5" cy="15" r="1.6"/><circle class="d" cx="16" cy="15" r="1.6"/><circle class="d" cx="20.5" cy="15" r="1.6"/></svg></span>' +
        '<span class="ao-chatfab-lb">Chat</span>' +
        (unread > 0 ? '<span class="ao-badge">' + unread + '</span>' : '') + '</button>';
    var hasBtns = !!(primary || cancel);
    var dock = '<div class="ao-dock-sp"></div><div class="ao-dock' + (hasBtns ? '' : ' is-empty') + '">' + chat +
        (hasBtns ? '<div class="ao-actions"><div class="ao-actions-sub ao-row-acts">' + cancel + primary + '</div></div>' : '') + '</div>';

    box.innerHTML = '<div class="' + (animate ? 'ao-push' : '') + '">' + hero + cust + items + pick + pay + notes + '</div>' + dock;
    window._aoBindFabScroll();
};

window._aoBindFabScroll = function () {
    var m = document.getElementById('adminOrderSheetModal');
    if (!m || m.__aoFab) return;
    m.__aoFab = true;
    var t = null;
    m.addEventListener('scroll', function () {
        var f = m.querySelector('.ao-chatfab');
        if (!f) return;
        if (!f.classList.contains('is-mini')) f.classList.add('is-mini');
        clearTimeout(t);
        t = setTimeout(function () { f.classList.remove('is-mini'); }, 650);
    }, { passive: true });
};
    
// ==========================================================================
// 📋 ADMIN: BUYURTMANI "YIG'ISH" (PICKING CHECKLIST)
//   Har bir mahsulotni RASMI bilan ko'rib, galochka qo'yib yig'iladi
//   ("bunisi olindi, endi bunisi"). Holat localStorage'da (avto_pick_<code>)
//   — admin qurilmasida saqlanadi (baza server-owned, tegilmaydi).
// ==========================================================================
function _pickLines(o) {
    var pdb = window.productsDB || (typeof productsDB !== 'undefined' ? productsDB : []);
    var lines = [];
    if (o && Array.isArray(o.itemDetails) && o.itemDetails.length) {
        o.itemDetails.forEach(function (it) {
            var p = pdb.find(function (x) { return x.id == it.id; });
            var img = p ? (p.img || p.image || '') : '';
            var size = (it.size && it.size !== 'Universal') ? it.size : (it.carModel || '');
            lines.push({ key: String(it.id) + '||' + size, name: it.name || '', size: size, qty: it.qty || 1, img: img });
        });
    } else {
        for (var fid in (o && o.items ? o.items : {})) {
            var parts = String(fid).split('||');
            var baseId = parts[0];
            var co = parts[1] ? parts[1].replace(/_dot_/g, '.') : '';
            var p2 = pdb.find(function (x) { return x.id == baseId; });
            if (!p2) continue;
            var size2 = (co && co !== 'Universal') ? co : '';
            lines.push({ key: baseId + '||' + size2, name: p2.name, size: size2, qty: o.items[fid], img: p2.img || p2.image || '' });
        }
    }
    return lines;
}

window._pickBadge = function (o) {
    try {
        var key = 'avto_pick_' + (o.code || o.id);
        var st = JSON.parse(localStorage.getItem(key) || '{}');
        var lines = _pickLines(o);
        var total = lines.length;
        var done = lines.filter(function (l) { return st[l.key]; }).length;
        if (done > 0 && total > 0) {
            return (done === total ? "\u2705 Yig'ildi " : "\uD83D\uDCCB Yig'ish ") + done + '/' + total;
        }
    } catch (e) {}
    return "\uD83D\uDCCB Mahsulotlarni yig'ish";
};

window.openAdminOrderPick = function (uid, orderId) {
    var o = (window.allFetchedOrders || []).find(function (x) { return String(x.uI) === String(uid) && String(x.id) === String(orderId); });
    if (!o) { if (typeof showToast === 'function') showToast('Buyurtma topilmadi', 'warning'); return; }
    window._pickOrder = o;
    window._pickKey = 'avto_pick_' + (o.code || o.id);
    try { window._pickState = JSON.parse(localStorage.getItem(window._pickKey) || '{}'); } catch (e) { window._pickState = {}; }

    document.getElementById('adminOrdersModal').style.display = 'none';
    var m = document.getElementById('adminOrderPickModal');
    m.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    activeModal = 'adminOrderPickModal';
    window.history.pushState({ modal: 'adminOrderPickModal' }, "");
    try { tg.BackButton.show(); } catch (e) {}
    updateBtns();
    window._renderPick();
};

var _PICK_CHK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>';

window._renderPick = function () {
    var o = window._pickOrder;
    if (!o) return;
    var lines = _pickLines(o);
    var st = window._pickState || {};
    var total = lines.length;
    var done = lines.filter(function (l) { return st[l.key]; }).length;
    var pct = total ? Math.round(done / total * 100) : 0;

    var tEl = document.getElementById('pick-title'); if (tEl) tEl.innerHTML = '#' + escHtml(o.code || o.id);
    var sEl = document.getElementById('pick-sub'); if (sEl) sEl.innerHTML = escHtml(o.customerName || o.uN || 'Mijoz') + ' \u00B7 ' + total + ' ta mahsulot';
    var ssEl = document.getElementById('pick-status-slot'); if (ssEl) { ssEl.className = 'ao-pick-status ao-st-' + (o.status || 'kutilmoqda'); ssEl.innerHTML = getStatusHTML(o.status || 'kutilmoqda'); }

    var listEl = document.getElementById('pick-list');
    if (listEl) {
        listEl.innerHTML = lines.map(function (l, i) {
            var checked = !!st[l.key];
            var imgTag = l.img
                ? '<img class="od-item-img" src="' + _thumb(l.img, 160) + '" data-full="' + (l.img || '').replace(/"/g, '&quot;') + '" loading="lazy" decoding="async" onerror="window._imgFallback(this)">'
                : '<div class="od-item-img" style="display:flex;align-items:center;justify-content:center;font-size:22px;color:var(--text-muted);">\uD83D\uDCE6</div>';
            return '<div class="pick-row' + (checked ? ' picked' : '') + '" role="button" tabindex="0" onclick="window._togglePick(' + i + ')">' +
                imgTag +
                '<div class="od-item-info"><div class="od-item-name">' + escHtml(l.name) + (l.size ? ' <span class="od-car-opt">[' + escHtml(l.size) + ']</span>' : '') + '</div>' +
                '<div class="od-item-meta"><span class="od-item-qty">' + l.qty + ' dona</span></div></div>' +
                '<span class="pick-check">' + (checked ? _PICK_CHK : '') + '</span>' +
                '</div>';
        }).join('') || '<p style="text-align:center;color:var(--text-muted);padding:20px;">Mahsulot yo\'q</p>';
    }

    var bar = document.getElementById('pick-bar'); if (bar) bar.style.width = pct + '%';
    var cnt = document.getElementById('pick-count'); if (cnt) cnt.innerHTML = done + ' / ' + total + " yig'ildi";
    var allBtn = document.getElementById('pick-all-btn');
    if (allBtn) allBtn.innerHTML = (total > 0 && done === total) ? "\u21A9\uFE0F Belgilashni bekor qilish" : "\u2705 Hammasi yig'ildi";
    var act = document.getElementById('pick-actions'); if (act) act.innerHTML = _pickActionBtns(o);
};

window._togglePick = function (idx) {
    var o = window._pickOrder; if (!o) return;
    var lines = _pickLines(o); var l = lines[idx]; if (!l) return;
    var st = window._pickState || {};
    st[l.key] = !st[l.key];
    window._pickState = st;
    try { localStorage.setItem(window._pickKey, JSON.stringify(st)); } catch (e) {}
    try { if (window._hap) window._hap(st[l.key] ? 'success' : 'light'); } catch (e) {}
    window._renderPick();
};

window._pickToggleAll = function () {
    var o = window._pickOrder; if (!o) return;
    var lines = _pickLines(o); var st = window._pickState || {};
    var allDone = lines.length > 0 && lines.every(function (l) { return st[l.key]; });
    lines.forEach(function (l) { st[l.key] = !allDone; });
    window._pickState = st;
    try { localStorage.setItem(window._pickKey, JSON.stringify(st)); } catch (e) {}
    try { if (window._hap) window._hap(allDone ? 'light' : 'success'); } catch (e) {}
    window._renderPick();
};

function _pickActionBtns(o) {
    var uid = o.uI, id = o.id, a = '', I = window._AOI || {};
    if (o.status === 'kutilmoqda' || !o.status) a = '<button type="button" class="ao-btn ao-primary" style="--c:var(--ao-blue)" onclick="window._pickStatus(\'' + uid + '\',\'' + id + '\',\'qabul\')">' + (I.check || '') + 'Qabul qilish</button>';
    else if (o.status === 'qabul') a = '<button type="button" class="ao-btn ao-primary" style="--c:var(--ao-orange)" onclick="window._pickStatus(\'' + uid + '\',\'' + id + '\',\'yolda\')">' + (I.truck || '') + 'Yo\'lga chiqarish</button>';
    else if (o.status === 'yolda') a = '<button type="button" class="ao-btn ao-primary" style="--c:var(--ao-green)" onclick="window._pickStatus(\'' + uid + '\',\'' + id + '\',\'yetkazildi\')">' + (I.flag || '') + 'Yetkazildi</button>';
    var cancel = '';
    if (o.status !== 'bekor_qilingan' && o.status !== 'yetkazildi') cancel = '<button type="button" class="ao-btn ao-danger" style="flex:0.6" onclick="window._pickStatus(\'' + uid + '\',\'' + id + '\',\'bekor_qilingan\')">Bekor</button>';
    return a + cancel;
}

window._pickStatus = function (uid, id, status) {
    // Yig'ish oynasida QOLAMIZ: soatcha chiqadi, holat va tugmalar joyida
    // yangilanadi (_aoAfterStatus). Ilgari oyna yopilib, ro'yxat qayta yuklanardi.
    try { changeOrderStatus(uid, id, status); } catch (e) {}
};

// ===================================================
// 1. TAKRORIY BUYURTMA (REPEAT ORDER)
// ===================================================
window.reorderItems = () => {
    let o = myOrders.find(x => String(x.id) === String(currentOpenOrderId));
    if (!o || (!o.items && !Array.isArray(o.itemDetails))) return;
    let addedCount = 0; let outOfStock = [];

    // ⚠️ Server yozgan buyurtmada `items` kalitlari "l_<hash>" — ulardan tovar
    //    id sini tiklab bo'lmaydi (ilgari "Qayta buyurtma" HECH NARSA qo'shmasdi).
    //    `itemDetails` (id, razmer/mashina, soni) afzal; eski buyurtmalar — `items`.
    let srcItems = {};
    if (Array.isArray(o.itemDetails) && o.itemDetails.length) {
        o.itemDetails.forEach(function (it) {
            if (!it || it.id == null) return;
            let opt = (it.size && it.size !== 'Universal') ? it.size : (it.carModel || 'Universal');
            let k = String(it.id) + '||' + opt;
            srcItems[k] = (srcItems[k] || 0) + (parseInt(it.qty) || 1);
        });
    } else {
        srcItems = o.items;
    }

    for (let safeId in srcItems) {
        let parts = String(safeId).split('||');
        let baseId = parts[0];
        let carOpt = parts[1] ? parts[1].replace(/_dot_/g, ".") : "Universal";
        let p = productsDB.find(x => x.id == baseId);
        if (!p) continue;

        let stockLeft = 10;
        if (p.product_type === 'razmerli' && p.sizes) {
            let sz = p.sizes.find(s => s.size === carOpt);
            if (sz) stockLeft = sz.stock;
        } else {
            stockLeft = p.stock !== undefined ? p.stock : 10;
        }

        if (stockLeft <= 0) { outOfStock.push(p.name); continue; }

        let finalSafeId = baseId + "||" + (carOpt ? carOpt.replace(/\./g, "_dot_") : "Universal");
        cart[finalSafeId] = (parseInt(cart[finalSafeId]) || 0) + (parseInt(srcItems[safeId]) || 1);
        addedCount++;
    }
    saveLocalCart(); updateCartBadge();

    if (addedCount > 0) {
        showToast(`${addedCount} ta tovar savatga qo'shildi!`, 'success');
        setTimeout(() => { closeModal(); setTimeout(() => openModal('cartModal'), 300); }, 1000);
    }
    if (outOfStock.length > 0) setTimeout(() => { showToast(`Tugagan: ${outOfStock.slice(0,2).join(', ')}`, 'warning'); }, 1500);
};

// ===================================================
// 2. GRAFIK STATISTIKA (CHART.JS)
// ===================================================
if (!window._chartJsLoaded) {
    let script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js';
    script.onload = () => { window._chartJsLoaded = true; };
    document.head.appendChild(script);
}

let salesChartInstance = null;
window.animateValue = (id, end) => {
    let obj = document.getElementById(id);
    if(!obj) return;
    let start = 0; let duration = 1200; let startTime = null;
    function step(timestamp) {
        if (!startTime) startTime = timestamp;
        let progress = Math.min((timestamp - startTime) / duration, 1);
        obj.innerHTML = Math.floor(progress * end).toLocaleString() + " so'm";
        if (progress < 1) { window.requestAnimationFrame(step); } else { obj.innerHTML = end.toLocaleString() + " so'm"; }
    }
    window.requestAnimationFrame(step);
};
window.openAdminStats = () => {
    document.getElementById('adminModal').style.display = 'none';
    let sM = document.getElementById('adminStatsModal');
    sM.style.display = 'flex';
    activeModal = 'adminStatsModal';
    window.history.pushState({ modal: 'adminStatsModal' }, "");

    let c = document.getElementById('admin-stats-content');
    c.innerHTML = '<p style="text-align:center; margin-top:30px;"><span class="hourglass" style="transform:scale(0.5); display:inline-block;"></span><br><span style="color:var(--luxury-gold); font-size:12px; margin-top:10px; display:block;">Hisob-kitob qilinmoqda...</span></p>';

    window._getUsersSnap().then((s) => {
        window._statsUsers = s.exists() ? s.val() : {};
        window._renderStats();
    });
};

// 📅 DAVR FILTRI — holati localStorage'da saqlanadi (mode: all | days | reset).
window._statsFilter = (function () {
    try { var r = JSON.parse(localStorage.getItem('avto_stats_filter') || 'null'); if (r && r.mode) return r; } catch (e) {}
    return { mode: 'all', days: 7, resetAt: 0 };
})();
function _saveStatsFilter() { try { localStorage.setItem('avto_stats_filter', JSON.stringify(window._statsFilter)); } catch (e) {} }

// Tanlangan davr uchun quyi chegara (ms). null => hamma vaqt.
function _statsCutoff() {
    var f = window._statsFilter || { mode: 'all' };
    var d;
    if (f.mode === 'reset' && f.resetAt) { d = new Date(f.resetAt); d.setHours(0, 0, 0, 0); return d.getTime(); }
    if (f.mode === 'days') { d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - (Math.max(1, f.days) - 1)); return d.getTime(); }
    return null;
}
// Buyurtma sanasi ("kk.oo.yyyy") -> yarim tun ms.
function _orderDateMs(o) {
    if (!o || !o.date) return NaN;
    // Ajratkich turli bo'lishi mumkin: "kk.oo.yyyy" (brauzer), "kk/oo/yyyy", "yyyy-oo-kk"
    var p = String(o.date).split(/[.\/\-\s]+/).filter(Boolean);
    if (p.length < 3) return NaN;
    var day, mon, yr;
    if (p[0].length === 4) { yr = parseInt(p[0], 10); mon = parseInt(p[1], 10); day = parseInt(p[2], 10); }
    else { day = parseInt(p[0], 10); mon = parseInt(p[1], 10); yr = parseInt(p[2], 10); }
    if (!yr || !mon || !day) return NaN;
    var dt = new Date(yr, mon - 1, day);
    dt.setHours(0, 0, 0, 0);
    return dt.getTime();
}
function _statsPeriodLabel() {
    var f = window._statsFilter || { mode: 'all' };
    if (f.mode === 'reset') return 'Yangidan (bugundan beri)';
    if (f.mode === 'days') return f.days === 1 ? 'Bugun' : ("So'nggi " + f.days + ' kun');
    return 'Barcha vaqt';
}
window._setStatsPeriod = function (mode, days) {
    window._statsFilter = window._statsFilter || {};
    window._statsFilter.mode = mode;
    if (days) window._statsFilter.days = days;
    _saveStatsFilter();
    if (typeof window._hap === 'function') window._hap('selection');
    window._renderStats();
};
window._customStatsDays = function (v) {
    var n = parseInt(v, 10);
    if (!n || n < 1) return;
    window._statsFilter = window._statsFilter || {};
    window._statsFilter.mode = 'days';
    window._statsFilter.days = n;
    _saveStatsFilter();
    window._renderStats();
};
window._resetStatsCounter = function () {
    var doIt = function () {
        window._statsFilter = { mode: 'reset', days: (window._statsFilter && window._statsFilter.days) || 7, resetAt: Date.now() };
        _saveStatsFilter();
        window._renderStats();
        if (typeof showToast === 'function') showToast('✅ Hisob bugundan yangidan boshlandi', 'success');
        if (typeof window._hap === 'function') window._hap('success');
    };
    try {
        if (window.tg && tg.showConfirm) tg.showConfirm("Statistikani 0 dan boshlaymizmi? Bugundan oldingi savdolar hisobga olinmaydi (ma'lumot o'chmaydi).", function (ok) { if (ok) doIt(); });
        else if (confirm('Statistikani 0 dan boshlaymizmi?')) doIt();
    } catch (e) { doIt(); }
};

window._renderStats = () => {
    let c = document.getElementById('admin-stats-content');
    if (!c) return;
    let us = window._statsUsers || {};
    let cutoff = _statsCutoff();

    let totalRevenue = 0, todayRevenue = 0, totalCustomers = 0;
    let productSales = {};
    let deliveredOrders = 0, returningCustomers = 0;
    let regionStats = {};
    let todayDate = new Date().toLocaleDateString('uz-UZ');
    let dailyData = {}; let monthlyData = {};
    for (let i = 29; i >= 0; i--) { let d = new Date(); d.setDate(d.getDate() - i); dailyData[d.toLocaleDateString('uz-UZ')] = 0; }
    let monthNames = ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyun', 'Iyul', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek'];
    monthNames.forEach(m => monthlyData[m] = 0);

    // 👥 Mijoz = ismi VA raqami bor foydalanuvchi («Mijozlar» oynasi bilan bir xil qoida).
    totalCustomers = Object.keys(us).filter(uid => !window._a1IsCompleteCustomer || window._a1IsCompleteCustomer(us[uid])).length;
    for (let uid in us) {
        if (!us[uid].orders) continue;
        let _region = (us[uid].profile && us[uid].profile.address) ? us[uid].profile.address : "Noma'lum";
        let _userDelivered = 0;
        let ords = Array.isArray(us[uid].orders) ? us[uid].orders : Object.values(us[uid].orders);
        ords.forEach(o => {
            if (!o || !o.total) return;
            let amount = o.total || 0;
            let inRange = (cutoff === null);
            if (!inRange) { let oms = _orderDateMs(o); inRange = !isNaN(oms) && oms >= cutoff; }

            if (o.status === 'yetkazildi') {
                // Grafik uchun — HAR DOIM to'liq (davr filtriga bog'liq emas)
                if (o.date && dailyData.hasOwnProperty(o.date)) dailyData[o.date] += amount;
                if (o.date) { let parts = o.date.split('.'); if (parts.length >= 2) { let mIdx = parseInt(parts[1]) - 1; if (mIdx >= 0 && mIdx < 12) monthlyData[monthNames[mIdx]] += amount; } }
                if (o.date === todayDate) todayRevenue += amount;
                // Davr bo'yicha yig'indi
                if (inRange) { totalRevenue += amount; deliveredOrders++; _userDelivered++; }
            }
            if (o.items && o.status !== 'bekor_qilingan' && inRange) {
                for (let pid in o.items) { let baseId = pid.split('||')[0]; productSales[baseId] = (productSales[baseId] || 0) + (parseInt(o.items[pid]) || 0); }
            }
        });
        if (_userDelivered > 1) returningCustomers++;
        if (_userDelivered > 0) regionStats[_region] = (regionStats[_region] || 0) + _userDelivered;
    }

    let topProducts = Object.keys(productSales).map(id => ({ id, count: productSales[id] })).sort((a, b) => b.count - a.count).slice(0, 5);
    let topHtml = topProducts.map((tp, i) => {
        let p = productsDB.find(x => x.id == tp.id);
        let pName = p ? p.name : "O'chirilgan tovar";
        let medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
        return `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; background:rgba(255,255,255,0.04); padding:12px; border-radius:12px; border:1px solid rgba(255,255,255,0.05);"><span style="font-size:13px;">${medals[i]} ${pName}</span><span style="color:var(--luxury-gold); font-weight:800; font-size:13px;">${tp.count} ta</span></div>`;
    }).join('');
    if (!topHtml) topHtml = "<p style='color:gray;font-size:13px;text-align:center;'>Bu davrda sotuv yo'q.</p>";

    let avgCheck = deliveredOrders ? Math.round(totalRevenue / deliveredOrders) : 0;
    let _esc = (typeof escHtml === 'function') ? escHtml : (function (x) { return x; });
    let topRegions = Object.keys(regionStats).map(r => ({ r: r, c: regionStats[r] })).sort((a, b) => b.c - a.c).slice(0, 5);
    let regionHtml = topRegions.map(x => `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; background:rgba(255,255,255,0.04); padding:10px 12px; border-radius:10px; border:1px solid rgba(255,255,255,0.05);"><span style="font-size:12px;">📍 ${_esc(x.r)}</span><span style="color:var(--luxury-gold); font-weight:800; font-size:12px;">${x.c} ta</span></div>`).join('');
    if (!regionHtml) regionHtml = "<p style='color:gray;font-size:12px;text-align:center;'>Ma'lumot yo'q.</p>";

    // 📅 DAVR PANELI (chiplar + 0 dan boshlash + ixtiyoriy kun)
    let f = window._statsFilter || { mode: 'all' };
    let isDays = f.mode === 'days';
    let chip = (label, active, onclick) => `<span role="button" tabindex="0" onclick="${onclick}" style="padding:8px 13px; border-radius:11px; font-size:12px; font-weight:800; cursor:pointer; white-space:nowrap; transition:.15s; border:1px solid ${active ? 'var(--luxury-gold)' : 'var(--glass-border)'}; background:${active ? 'rgba(212,175,55,0.18)' : 'rgba(255,255,255,0.04)'}; color:${active ? 'var(--luxury-gold)' : 'var(--text-muted)'};">${label}</span>`;
    let periodBar =
        `<div style="display:flex; gap:8px; overflow-x:auto; padding:2px 2px 10px; -webkit-overflow-scrolling:touch; scrollbar-width:none;">` +
            chip('Bugun', isDays && f.days === 1, "window._setStatsPeriod('days',1)") +
            chip('5 kun', isDays && f.days === 5, "window._setStatsPeriod('days',5)") +
            chip('7 kun', isDays && f.days === 7, "window._setStatsPeriod('days',7)") +
            chip('30 kun', isDays && f.days === 30, "window._setStatsPeriod('days',30)") +
            chip('Hammasi', f.mode === 'all', "window._setStatsPeriod('all')") +
            chip(f.mode === 'reset' ? '🔄 Yangidan ✓' : '🔄 0 dan boshlash', f.mode === 'reset', "window._resetStatsCounter()") +
        `</div>` +
        `<div style="display:flex; align-items:center; gap:10px; margin-bottom:12px;">` +
            `<input type="number" inputmode="numeric" min="1" placeholder="Necha kun?" value="${isDays && ![1,5,7,30].includes(f.days) ? f.days : ''}" onchange="window._customStatsDays(this.value)" class="admin-input" style="flex:1; padding:11px 13px; margin:0;">` +
            `<span style="font-size:11px; color:var(--text-muted); white-space:nowrap;">ixtiyoriy davr</span>` +
        `</div>` +
        (f.mode === 'reset' && f.resetAt
            ? `<div style="font-size:11.5px; color:#34c759; margin-bottom:12px; padding:9px 12px; background:rgba(52,199,89,0.08); border:1px solid rgba(52,199,89,0.25); border-radius:11px; line-height:1.5;">🔄 <b>${new Date(f.resetAt).toLocaleDateString('uz-UZ')}</b> dan beri yangidan hisoblanmoqda. <span onclick="window._setStatsPeriod('all')" style="color:var(--luxury-gold); cursor:pointer; text-decoration:underline;">Bekor</span></div>`
            : '') +
        `<div style="font-size:11px; color:var(--text-muted); margin-bottom:14px; padding:0 2px;">Ko'rsatilmoqda: <b style="color:#fff;">${_statsPeriodLabel()}</b></div>`;

    c.innerHTML = periodBar + `
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:15px;">
            <div class="luxury-card" style="padding:15px; text-align:center; display:block;">
                <div style="font-size:22px; margin-bottom:5px;">📈</div>
                <div style="font-size:10px; color:var(--text-muted); text-transform:uppercase; letter-spacing:1px;">Bugungi savdo</div>
                <div id="admin-today-rev" style="font-size:14px; font-weight:800; color:#34c759; margin-top:5px;">0 so'm</div>
            </div>
            <div class="luxury-card" style="padding:15px; text-align:center; display:block;">
                <div style="font-size:22px; margin-bottom:5px;">👥</div>
                <div style="font-size:10px; color:var(--text-muted); text-transform:uppercase; letter-spacing:1px;">Jami Mijozlar</div>
                <div style="font-size:18px; font-weight:800; color:#fff; margin-top:5px;">${totalCustomers} kishi</div>
            </div>
        </div>
        <div class="luxury-card" style="padding:20px; display:block; margin-bottom:20px; text-align:center; border:1px solid rgba(212,175,55,0.3);">
            <div style="font-size:11px; color:var(--text-muted); text-transform:uppercase; margin-bottom:8px; letter-spacing:1px;">Savdo (tushum) · ${_statsPeriodLabel()}</div>
            <div id="admin-total-rev" style="font-size:26px; font-weight:800; color:var(--luxury-gold);">0 so'm</div>
            <div style="font-size:10px; color:gray; margin-top:5px;">(Faqat yetkazib berilganlar)</div>
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px;">
            <div class="luxury-card" style="padding:15px; text-align:center; display:block;">
                <div style="font-size:22px; margin-bottom:5px;">🧾</div>
                <div style="font-size:10px; color:var(--text-muted); text-transform:uppercase; letter-spacing:1px;">O'rtacha chek</div>
                <div style="font-size:14px; font-weight:800; color:#fff; margin-top:5px;">${avgCheck.toLocaleString()} so'm</div>
            </div>
            <div class="luxury-card" style="padding:15px; text-align:center; display:block;">
                <div style="font-size:22px; margin-bottom:5px;">📦</div>
                <div style="font-size:10px; color:var(--text-muted); text-transform:uppercase; letter-spacing:1px;">Jami sotuvlar</div>
                <div style="font-size:18px; font-weight:800; color:#fff; margin-top:5px;">${deliveredOrders} ta</div>
            </div>
        </div>
        <div class="luxury-card" style="padding:14px 16px; display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
            <span style="font-size:12px; color:var(--text-muted);">🔁 Qaytgan mijozlar (2+ xarid)</span>
            <span style="font-size:16px; font-weight:800; color:#34c759;">${returningCustomers} kishi</span>
        </div>
        <h3 style="font-size:15px; margin-bottom:12px; color:white;"><svg class="uic" aria-hidden="true"><use href="#i-map"></use></svg>Hududlar bo'yicha (Top 5)</h3>
        ${regionHtml}
        <div style="height:18px;"></div>
        <h3 style="font-size:15px; margin-bottom:12px; color:white;"><svg class="uic" aria-hidden="true"><use href="#i-award"></use></svg>Xit Savdolar (Top 5)</h3>
        ${topHtml}
    `;

    setTimeout(() => {
        if (window.animateValue) {
            window.animateValue('admin-today-rev', todayRevenue);
            window.animateValue('admin-total-rev', totalRevenue);
        }
    }, 100);

    let chartSection = document.getElementById('admin-chart-section');
    if (chartSection) {
        chartSection.style.display = 'block';
        window._chartData = { daily: dailyData, monthly: monthlyData };
        setTimeout(() => loadChart('daily', document.querySelector('#admin-chart-section button')), 300);
    }
};

window.loadChart = (type, btnEl) => {
    document.querySelectorAll('#admin-chart-section button').forEach(b => { b.style.borderColor = 'var(--glass-border)'; b.style.background = 'rgba(255,255,255,0.05)'; b.style.color = 'var(--text-muted)'; });
    if (btnEl) { btnEl.style.borderColor = 'var(--luxury-gold)'; btnEl.style.background = 'rgba(212,175,55,0.2)'; btnEl.style.color = 'var(--luxury-gold)'; }
    if (!window._chartData || !window._chartJsLoaded) return;

    let labels = [], data = [], title = '';
    if (type === 'daily') {
        let entries = Object.entries(window._chartData.daily).slice(-14); labels = entries.map(e => e[0].split('.').slice(0,2).join('.')); data = entries.map(e => Math.round(e[1] / 1000)); title = "So'nggi 14 kun (ming so'm)";
    } else if (type === 'weekly') {
        let entries = Object.entries(window._chartData.daily); let weeks = {};
        entries.forEach(([date, val]) => { let d = date.split('.'); if(d.length < 2) return; let day = parseInt(d[0]); let weekNum = Math.ceil(day / 7); let key = d[1] + "/" + weekNum + "-hafta"; weeks[key] = (weeks[key] || 0) + val; });
        let wEntries = Object.entries(weeks).slice(-8); labels = wEntries.map(e => e[0]); data = wEntries.map(e => Math.round(e[1] / 1000)); title = "Haftalik (ming so'm)";
    } else {
        let entries = Object.entries(window._chartData.monthly); labels = entries.map(e => e[0]); data = entries.map(e => Math.round(e[1] / 1000)); title = "Oylik (ming so'm)";
    }

    let canvas = document.getElementById('salesChart'); if (!canvas) return; let ctx = canvas.getContext('2d');
    if (salesChartInstance) salesChartInstance.destroy();
    salesChartInstance = new Chart(ctx, { type: 'bar', data: { labels: labels, datasets: [{ label: title, data: data, backgroundColor: 'rgba(212, 175, 55, 0.35)', borderColor: '#D4AF37', borderWidth: 2, borderRadius: 8, hoverBackgroundColor: 'rgba(212, 175, 55, 0.6)', }] }, options: { responsive: true, plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ctx.parsed.y.toLocaleString() + " ming so'm" }, backgroundColor: '#1c1c1e', titleColor: '#D4AF37', bodyColor: '#fff', borderColor: '#D4AF37', borderWidth: 1, } }, scales: { x: { ticks: { color: '#8e8e93', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.05)' } }, y: { ticks: { color: '#8e8e93', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.05)' } } } } });

    let total = data.reduce((a, b) => a + b, 0); let maxVal = Math.max(...data); let maxIdx = data.indexOf(maxVal);
    document.getElementById('chart-summary').innerHTML = `<div class="luxury-card" style="padding:12px; text-align:center; display:block;"><div style="font-size:10px; color:var(--text-muted); margin-bottom:4px;">Jami davr</div><div style="font-size:15px; font-weight:800; color:var(--luxury-gold);">${total.toLocaleString()} ming</div></div><div class="luxury-card" style="padding:12px; text-align:center; display:block;"><div style="font-size:10px; color:var(--text-muted); margin-bottom:4px;">Eng yaxshi</div><div style="font-size:13px; font-weight:800; color:#34c759;">${labels[maxIdx] || '—'}</div></div>`;
};

// ===================================================
// 3. BAHOLASH VA IZOH TIZIMI (STAR RATING & REVIEWS)
// ===================================================
let currentReviewProductId = null; let selectedReviewStar = 0;

window.loadProductReviews = (productId) => {
    currentReviewProductId = productId; selectedReviewStar = 0;
    document.querySelectorAll('#review-stars span').forEach(s => s.classList.remove('active'));
    let reviewSection = document.getElementById('pm-review-section'); let reviewsList = document.getElementById('pm-reviews-list'); let addReview = document.getElementById('pm-add-review'); let loginMsg = document.getElementById('pm-review-login-msg'); let avgEl = document.getElementById('pm-avg-rating');
    reviewsList.innerHTML = window._skel(3, 70); if (addReview) addReview.classList.add('hidden'); if (loginMsg) loginMsg.classList.add('hidden');

    db.ref('reviews/' + productId).once('value', (snap) => {
        let reviews = []; if (snap.exists()) { let data = snap.val(); reviews = Object.values(data).filter(r => r && r.rating); }
        if (reviews.length > 0) {
            let avg = reviews.reduce((a, r) => a + r.rating, 0) / reviews.length;
            // ⭐ Kartochkalardagi bilan bir xil 5 yulduzli ko'rinish (kattaroq o'lchamda)
            avgEl.innerHTML = window._starsHTML
                ? window._starsHTML(avg, reviews.length, 'big')
                : ('★ ' + avg.toFixed(1) + ' (' + reviews.length + ' baho)');
        } else { avgEl.innerHTML = ''; }
        if (reviews.length === 0) {
            // QADAM 7: chiroyli, jonli, taklifkor empty state — eski oddiy
            // 'Hali izoh yo'q' yozuvi mijozga 'tovar zerikkan' hissini berardi
            reviewsList.innerHTML = `
                <div style="text-align:center; padding:24px 12px; background:rgba(255,255,255,0.02); border-radius:14px; border:1px dashed rgba(212,175,55,0.18);">
                    <div style="font-size:42px; margin-bottom:10px; opacity:0.55; filter:drop-shadow(0 4px 10px rgba(212,175,55,0.25));">⭐</div>
                    <div style="font-size:14px; color:var(--text-main); font-weight:700; margin-bottom:6px;">Yangi tovar — sharhlar hali yo'q</div>
                    <div style="font-size:12px; color:var(--text-muted); line-height:1.55;">Xarid qilgandan so'ng birinchi bo'lib<br>fikringizni qoldiring 🌟</div>
                </div>
            `;
        } else {
            reviews.sort((a, b) => b.timestamp - a.timestamp);
            reviewsList.innerHTML = reviews.map(r => `<div class="review-card"><div class="r-head"><span class="r-name">${escHtml(r.userName || 'Mijoz')}</span><span class="r-stars">${'★'.repeat(Math.max(0, Math.min(5, parseInt(r.rating) || 0)))}${'☆'.repeat(5 - Math.max(0, Math.min(5, parseInt(r.rating) || 0)))}</span></div>${r.text ? `<div class="r-text">${escHtml(r.text)}</div>` : ''}<div class="r-date">${escHtml(r.date || '')}</div></div>`).join('');
        }
        if (!currentUser) { loginMsg.classList.remove('hidden'); return; }
        let alreadyReviewed = reviews.some(r => r.userId == currentUser);
        if (alreadyReviewed) { loginMsg.innerText = '✅ Siz allaqachon baho qo\'ydingiz'; loginMsg.classList.remove('hidden'); return; }
        let hasBought = myOrders.some(o => o.status === 'yetkazildi' && o.items && Object.keys(o.items).some(k => k.split('||')[0] == productId));
        if (hasBought) { addReview.classList.remove('hidden'); } else { loginMsg.innerText = 'Izoh qoldirish uchun avval xarid qiling'; loginMsg.classList.remove('hidden'); }
    });
};

window.setReviewStar = (val) => {
    selectedReviewStar = val;
    document.querySelectorAll('#review-stars span').forEach((s, i) => { if (i < val) s.classList.add('active'); else s.classList.remove('active'); });
};

window.submitReview = () => {
    if (selectedReviewStar === 0) { showToast("Yulduz tanlang!", "warning"); return; }
    if (!currentUser || !currentReviewProductId) return;
    let text = document.getElementById('review-text').value.trim(); let userName = myProfile.name || 'Mijoz'; let now = new Date();
    let reviewData = { userId: currentUser, userName: userName, rating: selectedReviewStar, text: text, date: now.toLocaleDateString('uz-UZ'), timestamp: now.getTime() };
    db.ref('reviews/' + currentReviewProductId + '/' + currentUser).set(reviewData).then(() => {
        showToast("Rahmat! Bahongiz saqlandi ✅"); loadProductReviews(currentReviewProductId); if(typeof loadProductRatings==='function') loadProductRatings();
        if (document.getElementById('review-text')) document.getElementById('review-text').value = '';
        selectedReviewStar = 0; document.querySelectorAll('#review-stars span').forEach(s => s.classList.remove('active'));
    });
};

// =====================================
// 🛡️ ESLATMA: avvalgi "anti-klon" himoyasi (F12 / o'ng tugma / Ctrl+U bloklash
//   va body'da user-select:none) OLIB TASHLANDI. Sabablari:
//     • client tomondagi bunday bloklash OSON chetlab o'tiladi — bu haqiqiy himoya emas;
//     • mijozga buyurtma kodi / manzil / kartani nusxalashga to'sqinlik qilardi;
//     • klaviatura/accessibility'ni buzardi.
//   Haqiqiy himoya: Firebase Security Rules + Cloudflare Worker auth (initData HMAC).
// =====================================

// =====================================
// 🛑 SPAM VA "BOMBA" HUJUMLARIDAN HIMOYA (ANTI-SPAM)
// =====================================

// 1. Izoh qoldirish tugmasi uchun himoya (10 soniya)
let lastReviewTime = 0;
const originalSubmitReview = window.submitReview;
window.submitReview = () => {
    let now = Date.now();
    if (now - lastReviewTime < 10000) { 
        if(typeof showToast === 'function') showToast("Shoshmang! Keyingi izohgacha biroz kuting.", "warning");
        return;
    }
    lastReviewTime = now;
    if (typeof originalSubmitReview === 'function') {
        originalSubmitReview();
    }
};
// ============================================================
// 🔧 TUZATILGAN: RASM YUKLASH TIZIMI (iOS + Telegram uchun)
// ============================================================

// URL inputga yozilganda preview ko'rsatuvchi funksiya
window.updateImgPreviews = (prefix) => {
    let urls = [
        document.getElementById(`${prefix}-img-url`)?.value,
        document.getElementById(`${prefix}-img-url2`)?.value,
        document.getElementById(`${prefix}-img-url3`)?.value,
    ].filter(u => u && u.startsWith('http'));
    
    let box = document.getElementById(`${prefix}-img-previews`);
    if (!box) return;
    
    if (urls.length === 0) {
        box.innerHTML = '';
        return;
    }
    
    box.innerHTML = urls.map((url, i) => `
        <div style="position:relative; display:inline-block;">
            <img src="${url}" 
                 style="width:75px; height:75px; object-fit:cover; border-radius:12px; border:2px solid var(--luxury-gold); display:block; background:#1c1c1e;"
                 onerror="this.style.border='2px solid #ff453a'; this.src=window._brandPlaceholder('Xato')">
            <span style="position:absolute; top:-7px; right:-7px; background:var(--luxury-gold); color:#000; border-radius:50%; width:18px; height:18px; font-size:10px; font-weight:800; display:flex; align-items:center; justify-content:center;">${i+1}</span>
        </div>
    `).join('');
};

// ✅ TUZATILGAN: EditModal ochish (pushState ishlatadi)
window.openEditModal = function(e, directId = null) {
    if (e) e.stopPropagation();
    let id = directId;
    if (!id) {
        let btn = document.getElementById('pm-buy-btn');
        if (btn) id = btn.getAttribute('data-id');
    }
    let p = productsDB.find(x => x.id == id);
    if (!p) return;
    document.getElementById('edit-id').value = p.id;
    document.getElementById('edit-name').value = p.name;
    document.getElementById('edit-price').value = formatNumber(p.price);
    let editCodeEl = document.getElementById('edit-code');
    if (editCodeEl) editCodeEl.value = p.code || "";
    // 🔎 Qidiruv so'zlari
    let editAliasEl = document.getElementById('edit-aliases');
    if (editAliasEl) editAliasEl.value = p.aliases || "";

    // 🔥 Flash sale maydonlarini to'ldirish: aktiv flash bo'lsa, narx maydonida ASL
    //    narx (oldPrice), flash maydonida chegirma narx va qolgan soat ko'rsatiladi.
    (function(){
        var efp = document.getElementById('edit-flash-price');
        var efh = document.getElementById('edit-flash-hours');
        if (!efp || !efh) return;
        var now = Date.now();
        if (p.flashUntil && p.flashUntil > now && p.oldPrice && Number(p.oldPrice) > Number(p.price)) {
            document.getElementById('edit-price').value = formatNumber(p.oldPrice); // asl narx
            efp.value = formatNumber(p.price);                                       // flash narx
            efh.value = Math.max(0, Math.round(((p.flashUntil - now) / 3600000) * 10) / 10);
        } else {
            efp.value = '';
            efh.value = '';
        }
    })();
    document.getElementById('edit-desc').value = p.desc || "";

    // 🏭 Saqlangan «ishlab chiqarilgan joy» chipini tiklaymiz — aks holda
    //    tahrirlashda u har safar birinchi variantga («Original») tushib
    //    qolardi va saqlash bilan tovarning haqiqiy qiymati buzilardi.
    (function () {
        var want = String(p.origin || '').trim();
        var chips = document.querySelectorAll('#edit-origin-chips .origin-chip');
        if (!chips.length) return;
        var hit = null;
        chips.forEach(function (c) {
            if (want && c.getAttribute('data-origin') === want) hit = c;
        });
        if (typeof selectOrigin === 'function') selectOrigin(hit || chips[0], 'edit');
    })();

    let pType = p.product_type || 'oddiy';
    document.getElementById('edit-prod-type').value = pType;
    toggleEditProductTypeFields();

    if (pType === 'oddiy') {
        document.getElementById('edit-stock').value = p.stock !== undefined ? p.stock : 10;
    } else {
        document.getElementById('edit-prod-brand').value = p.brand || "";
        updateEditBrandModels();
        if (p.model) setTimeout(() => { let m = document.getElementById('edit-prod-model'); if (m) m.value = p.model; }, 60);
        let sCont = document.getElementById('edit-sizes-container');
        sCont.innerHTML = '';
        (p.sizes || []).forEach(s => {
            let div = document.createElement('div');
            div.className = 'size-input-row';
            div.style.cssText = 'display:flex;gap:8px;margin-bottom:8px;';
            div.innerHTML = `<input type="text" value="${s.size}" class="size-name" style="flex:1;padding:10px;background:rgba(0,0,0,0.5);color:white;border:1px solid var(--glass-border);border-radius:8px;"><input type="number" value="${s.stock}" class="size-stock" style="flex:1;padding:10px;background:rgba(0,0,0,0.5);color:white;border:1px solid var(--glass-border);border-radius:8px;"><button type="button" onclick="this.parentElement.remove()" style="background:var(--accent-red);color:white;border:none;border-radius:8px;padding:0 15px;cursor:pointer;font-weight:bold;">X</button>`;
            sCont.appendChild(div);
        });
        if (!p.sizes || p.sizes.length === 0) addEditSizeField();
    }

    // Rasmlarni yuklash va preview ko'rsatish
    let imgs = (p.images && p.images.length > 0) ? p.images : (p.img ? [p.img] : []);
    let urlIds = ['edit-img-url', 'edit-img-url2', 'edit-img-url3'];
    urlIds.forEach((id, i) => { let el = document.getElementById(id); if (el) el.value = imgs[i] || ""; });

    // 🔄 Interaktiv rasm boshqaruvi (tartiblash, asosiy tanlash, o'chirish)
    updateImgPreviews('edit');

    // Chip tanlovlarini yuklash
    document.querySelectorAll('#editModal .cat-chip').forEach(c => c.classList.remove('selected'));
    let cats = p.categories || [p.category];
    cats.forEach(c => {
        if (!c) return;
        // 1) To'g'ridan-to'g'ri moslik (yangi sxema: "chevy-cobalt")
        let direct = document.querySelector(`#editModal .model-chip[data-val="${c}"]`);
        if (direct) { direct.classList.add('selected'); return; }
        // 2) Eski sxema (model-tur, mas: "chevy-cobalt-motor") — oxirgi qismni tashlaymiz
        let parts = c.split('-'); let t = parts.pop(); let m = parts.join('-');
        let mC = document.querySelector(`#editModal .model-chip[data-val="${m}"]`); if (mC) mC.classList.add('selected');
        let tC = document.querySelector(`#editModal .type-chip[data-val="${t}"]`); if (tC) tC.classList.add('selected');
    });

    document.getElementById('productModal').style.display = 'none';
    document.getElementById('editModal').style.display = 'flex';
    activeModal = 'editModal';
    // ✅ pushState (replaceState emas!) — back tugmasi ishlaydi
    window.history.pushState({ modal: 'editModal' }, "");
    tg.BackButton.show();
    updateLivePreview('edit');
    window._formDirty = false;
    updateBtns();
};


window.closeEditGoBack = () => {
    // 🧭 Soddalashtirildi: oddiy history.back() — popstate handler editModal case'i hammasini hal qiladi
    //    (drafts'dan kelgan bo'lsa adminDraftsModal'ga, aks holda productModal'ga qaytadi).
    window.history.back();
};
    
// =====================================
// 1. TAHRIRLASH (EDIT) FUNKSIYASI
// =====================================
window.saveEditProduct = function(keepDraft = false) {
    let id = parseInt(document.getElementById('edit-id').value);
    let n = document.getElementById('edit-name').value.trim();
    let p = parsePrice(document.getElementById('edit-price').value);
    let codeEl = document.getElementById('edit-code');
    let pCode = codeEl ? codeEl.value.trim() : "";
    
    let unitEl = document.getElementById('edit-unit');
    let pUnit = unitEl ? unitEl.value : 'dona';
    
    let descEl = document.getElementById('edit-desc');
    let d = descEl ? descEl.value.trim() : "Tavsif kiritilmagan";
    
    let pType = document.getElementById('edit-prod-type').value;
    
    let img1El = document.getElementById('edit-img-url');
    let img1 = img1El ? img1El.value : "";
    let img2El = document.getElementById('edit-img-url2');
    let img2 = img2El ? img2El.value : "";
    let img3El = document.getElementById('edit-img-url3');
    let img3 = img3El ? img3El.value : "";
    let imagesArr = [img1, img2, img3].filter(u => u !== "");

    // Faqat mashinani o'qiymiz (Motor/xadavoy turi olib tashlangan)
    let sMods = Array.from(document.querySelectorAll('#editModal .model-chip.selected')).map(c => c.getAttribute('data-val'));

    if (!keepDraft) {
        if (!n || !p || imagesArr.length === 0) { 
            showToast("Ism, narx va kamida 1 ta rasm kerak!", "warning"); 
            return; 
        }
        if (pType === 'oddiy' && sMods.length === 0) { 
            showToast("Mashina rusumini tanlang!", "warning"); 
            return; 
        }
    } else {
        if (!n) { showToast("Tovarga hech bo'lmasa ism yozing!", "warning"); return; }
    }

    let sCats = sMods.length > 0 ? sMods : ["umumiy"];
    
    let idx = productsDB.findIndex(x => x.id === id);

    if (idx !== -1) {
        // 🏭 Ishlab chiqarilgan joy (Original / Rossiya / Xitoy) — tovarga saqlanadi.
        //    Chip tanlanmagan bo'lsa MAVJUD qiymat saqlanib qoladi (o'chib ketmaydi).
        let _edOriginEl = document.querySelector('#edit-origin-chips .origin-chip.selected');
        let _edOrigin = _edOriginEl ? (_edOriginEl.getAttribute('data-origin') || "") : "";

        productsDB[idx] = { 
            ...productsDB[idx], 
            name: n, 
            price: p, 
            code: pCode,
            unit: pUnit, 
            desc: d, 
            origin: _edOrigin || productsDB[idx].origin || "",
            // 🔎 Qidiruv so'zlari — har saqlashda formadan QAYTA olinadi.
            //    (Obyekt `...productsDB[idx]` bilan qurilgani uchun aks holda
            //     eski qiymat qolib ketardi.)
            aliases: (function () {
                try {
                    var e = document.getElementById('edit-aliases');
                    return e ? String(e.value || '').trim().slice(0, 300) : (productsDB[idx].aliases || '');
                } catch (err) { return productsDB[idx].aliases || ''; }
            })(),
            img: imagesArr[0] || "", 
            images: imagesArr, 
            categories: sCats, 
            category: sCats[0], 
            product_type: pType 
        };

        if (pType === 'oddiy') {
            let stockEl = document.getElementById('edit-stock');
            productsDB[idx].stock = stockEl ? (parseInt(stockEl.value) || 0) : 10;
            delete productsDB[idx].sizes; 
            delete productsDB[idx].brand; 
            delete productsDB[idx].model;
        } else {
            let brandEl = document.getElementById('edit-prod-brand');
            let modelEl = document.getElementById('edit-prod-model');
            
            let brand = brandEl ? brandEl.value : "";
            let model = modelEl ? modelEl.value : "";
            
            let sizes = [];
            document.querySelectorAll('#edit-sizes-container .size-input-row').forEach(row => {
                let sName = row.querySelector('.size-name').value.trim();
                let sStock = parseInt(row.querySelector('.size-stock').value) || 0;
                if (sName) sizes.push({ size: sName, stock: sStock });
            });
            
            if (!keepDraft && sizes.length === 0) { 
                showToast("Kamida 1 razmer kiriting!", "warning"); 
                return; 
            }
            
            productsDB[idx].brand = brand; 
            productsDB[idx].model = model;
            productsDB[idx].sizes = sizes;
            productsDB[idx].stock = sizes.reduce((s, x) => s + x.stock, 0);
        }

        // 🔥 FLASH SALE (ixtiyoriy): flash narx asl narxdan kichik va soat > 0 bo'lsa —
        //    narxni vaqtincha tushiramiz (price=flash, oldPrice=asl, flashUntil=tugash vaqti).
        //    Aks holda flashni o'chiramiz (asl narxni tiklab). 'p' = asl narx (price maydoni).
        (function(){
            var fpEl = document.getElementById('edit-flash-price');
            var fhEl = document.getElementById('edit-flash-hours');
            var fp = fpEl ? parsePrice(fpEl.value) : 0;
            var fh = fhEl ? (parseFloat(String(fhEl.value).replace(',', '.')) || 0) : 0;
            if (fp > 0 && fp < p && fh > 0) {
                productsDB[idx].oldPrice = p;
                productsDB[idx].price = fp;
                productsDB[idx].flashUntil = Date.now() + Math.round(fh * 3600000);
            } else {
                productsDB[idx].price = p;
                delete productsDB[idx].oldPrice;
                delete productsDB[idx].flashUntil;
            }
        })();

        if (!keepDraft) {
            delete productsDB[idx].is_draft; 
        } else {
            productsDB[idx].is_draft = true; 
        }
        
        window._formDirty = false;
        saveProductAt(idx).then(() => {
            showToast(keepDraft ? "⏳ Qoralama saqlandi!" : "✅ Mijozlarga chiqarildi!", "success");
            displayDB = _sortDisplayDB(productsDB.filter(p => !p.is_draft).slice().reverse());
            renderProducts();
            if(typeof filterAdminDrafts === 'function') filterAdminDrafts();
            closeEditGoBack();
        });
    }
};
// =====================================
// 2. YANGI TOVAR QO'SHISH (ADD) FUNKSIYASI
// =====================================
window.saveNewProduct = function() {
    let n = document.getElementById('add-name').value.trim();
    let p = parsePrice(document.getElementById('add-price').value);
    let codeEl = document.getElementById('add-code');
    let pCode = codeEl ? codeEl.value.trim() : "";
    let pUnit = document.getElementById('add-unit').value;
    let pType = document.getElementById('admin-prod-type').value;
    let img1 = document.getElementById('add-img-url').value;
    let img2 = document.getElementById('add-img-url2') ? document.getElementById('add-img-url2').value : "";
    let img3 = document.getElementById('add-img-url3') ? document.getElementById('add-img-url3').value : "";
    let imagesArr = [img1, img2, img3].filter(u => u);
    let descVal = document.getElementById('add-desc').value.trim() || "Tavsif kiritilmagan";

    let sMods = Array.from(document.querySelectorAll('#addProductModal .model-chip.selected')).map(c => c.getAttribute('data-val'));

    if (!n || !p || imagesArr.length === 0) { showToast("Ism, narx va kamida 1 rasm kerak!", "warning"); return; }

    // 🏭 ISHLAB CHIQARILGAN JOY — endi TOVARGA SAQLANADI.
    //    ⚠️ ILGARI: `selectOrigin` bilan tanlangan qiymat FAQAT AI tavsif
    //    yozdirishga uzatilardi (`ai_admin_tasks.origin`) va tovar obyektiga
    //    hech qachon yozilmasdi. Natijada avto-ehtiyot qism savdosidagi ENG
    //    muhim tanlov (Original / Rossiya / Xitoy) mijozga ko'rinmasdi,
    //    filtrlanmasdi va narx bilan solishtirilmasdi.
    let _addOriginEl = document.querySelector('#add-origin-chips .origin-chip.selected');
    let pOrigin = _addOriginEl ? (_addOriginEl.getAttribute('data-origin') || "") : "";

    let newId = generateProductId();
    // 🔎 Qidiruv so'zlari (qo'lda kiritilgan sinonimlar). Chegara qo'yamiz —
    //    bu maydon qidiruv indeksiga tushadi, cheksiz uzun bo'lmasligi kerak.
    var pAliases = '';
    try {
        var _alEl = document.getElementById('add-aliases');
        pAliases = _alEl ? String(_alEl.value || '').trim().slice(0, 300) : '';
    } catch (e) {}
    let newProduct = { id: newId, name: n, desc: descVal, price: p, code: pCode, unit: pUnit, origin: pOrigin, aliases: pAliases, img: imagesArr[0], images: imagesArr, product_type: pType };

    if (pType === 'oddiy') {
        let st = parseInt(document.getElementById('add-stock').value) || 0;
        if (sMods.length === 0) { showToast("Mashina rusumini tanlang!", "warning"); return; }
        
        newProduct.stock = st; 
        newProduct.category = sMods[0]; 
        newProduct.categories = sMods;
    } else {
        let brand = document.getElementById('admin-prod-brand').value;
        let model = document.getElementById('admin-prod-model') ? document.getElementById('admin-prod-model').value : "";
        
        let sizes = [];
        document.querySelectorAll('#admin-sizes-container .size-input-row').forEach(row => {
            let sName = row.querySelector('.size-name').value.trim();
            let sStock = parseInt(row.querySelector('.size-stock').value) || 0;
            if (sName) sizes.push({ size: sName, stock: sStock });
        });
        if (sizes.length === 0) { showToast("Kamida 1 razmer kiriting!", "warning"); return; }
        
        let sCats = [];
        if (brand === 'gaz') {
            sCats = ['gazel-biznes','gazel-next','gazel-eski','volga-2401','volga-2410','volga-3110','volga-31105','volga-31029','sobol'];
        } else {
            if (!model) { showToast("Modelni tanlang!", "warning"); return; }
            sCats.push(`${brand}-${model}`);
        }
        newProduct.brand = brand; newProduct.model = model; newProduct.sizes = sizes;
        newProduct.stock = sizes.reduce((s, x) => s + x.stock, 0);
        newProduct.category = sCats[0]; newProduct.categories = sCats;
    }

    // 🔥 FLASH SALE (ixtiyoriy): flash narx asl narxdan kichik + soat > 0 bo'lsa qo'llaymiz.
    //    'p' = asl narx. To'ldirilmasa — oddiy tovar (flashsiz) qo'shiladi.
    (function(){
        var fpEl = document.getElementById('add-flash-price');
        var fhEl = document.getElementById('add-flash-hours');
        var fp = fpEl ? parsePrice(fpEl.value) : 0;
        var fh = fhEl ? (parseFloat(String(fhEl.value).replace(',', '.')) || 0) : 0;
        if (fp > 0 && fp < p && fh > 0) {
            newProduct.oldPrice = p;
            newProduct.price = fp;
            newProduct.flashUntil = Date.now() + Math.round(fh * 3600000);
        }
    })();

    productsDB.push(newProduct);
    let newIdx = productsDB.length - 1;
    window._formDirty = false;
    saveProductAt(newIdx).then(() => {
        showToast("✅ Tovar qo'shildi!", "success");
        // Reload o'rniga xotirada yangilaymiz — tezroq va silliqroq
        displayDB = _sortDisplayDB(productsDB.filter(x => !x.is_draft).slice().reverse());
        renderProducts();
        if (typeof filterAdminDrafts === 'function' && document.getElementById('adminDraftsModal') && document.getElementById('adminDraftsModal').style.display === 'flex') filterAdminDrafts();
        resetAddForm();
        closeModal();
    }).catch(() => {
        showToast("Saqlashda xato! Internetni tekshiring.", "warning");
    });
};
// =====================================
// 🚀 AQLLI OMMAVIY QO'SHISH (SMART BULK IMPORT)
// =====================================

window.currentDraftFilter = 'all';

window.openAdminDrafts = () => {
    document.getElementById('adminModal').style.display = 'none';
    let m = document.getElementById('adminDraftsModal');
    m.style.display = 'flex';
    activeModal = 'adminDraftsModal';
    window.history.pushState({ modal: 'adminDraftsModal' }, "");
    
    document.getElementById('draft-search-input').value = '';
    filterAdminDrafts('all');
};

// Filtrlash va qidirish tizimi
window.filterAdminDrafts = (filterBrand = null) => {
    if (filterBrand) window.currentDraftFilter = filterBrand;
    
    let q = document.getElementById('draft-search-input').value.toLowerCase().trim();
    let c = document.getElementById('admin-drafts-list');
    let drafts = productsDB.filter(p => p.is_draft === true);
    
    // Brand (Mashina) bo'yicha filter
    if (window.currentDraftFilter !== 'all') {
        drafts = drafts.filter(p => {
            let catsStr = (p.categories || []).join(' ');
            if (window.currentDraftFilter === 'gaz') return catsStr.includes('gazel') || catsStr.includes('volga') || catsStr.includes('sobol') || catsStr.includes('uaz');
            if (window.currentDraftFilter === 'chevy') return catsStr.includes('chevy');
            if (window.currentDraftFilter === 'daewoo') return catsStr.includes('daewoo');
            return true;
        });
    }

    // Qidiruv bo'yicha filter (Nomidan yoki Partiya nomidan qidiradi)
    if (q) {
        drafts = drafts.filter(p => p.name.toLowerCase().includes(q) || (p.batch_id && p.batch_id.toLowerCase().includes(q)));
    }
    
    if (drafts.length === 0) {
        c.innerHTML = '<p style="text-align:center; color:gray; margin-top:20px;">Qoralamalar topilmadi.</p>';
        return;
    }

    c.innerHTML = drafts.map(p => {
      let firstCat = (p.categories && p.categories[0]) ? p.categories[0].split('-').slice(0,2).join(' ').toUpperCase().replace(/CHEVY/g, 'CHEVROLET') : '';
        // Dublikat va Partiya dizaynlari
        let conflictBadge = p.has_conflict ? `<div style="color:#ff453a; font-size:10px; font-weight:bold; margin-bottom:4px;">⚠️ DUBLIKAT (Eskisi yashirildi)</div>` : '';
        let batchInfo = p.batch_id ? `<div style="color:gray; font-size:9px; margin-top:4px;">📁 ${window._prettyBatch(p.batch_id)}</div>` : '';
        
        return `
        <div class="inventory-item" style="display:flex; justify-content:space-between; align-items:center; border: 1px solid ${p.has_conflict ? 'rgba(255,69,58,0.4)' : 'var(--glass-border)'};">
            <div class="inv-info" style="flex:1; cursor:pointer;" onclick="editDraft(${p.id})">
                ${conflictBadge}
                <h4 style="color:var(--luxury-gold); margin-bottom:5px;">${p.name}</h4>
                <p style="font-weight:bold; font-size:12px;">${p.price.toLocaleString()} so'm <span style="color:gray; font-size:10px; margin-left:10px; background:rgba(255,255,255,0.1); padding:2px 5px; border-radius:5px;">${firstCat}</span></p>
                ${batchInfo}
            </div>
            <div class="inv-controls" style="display:flex; gap:12px; align-items:center; padding-left:10px;">
                <span style="font-size:22px; cursor:pointer;" onclick="editDraft(${p.id})">✏️</span>
                <span style="font-size:22px; cursor:pointer; color:#ff453a; filter: grayscale(0.2);" onclick="deleteDraft(${p.id}, ${p.has_conflict ? 'true' : 'false'})">🗑️</span>
            </div>
        </div>
        `;
    }).join('');
};

window.editDraft = (id) => {
    document.getElementById('adminDraftsModal').style.display = 'none';
    // 🧭 Qaytish uchun ALOHIDA bayroq — `currentDraftFolder` papka nomini saqlaydi
    //    va uni buzib bo'lmaydi (aks holda papka bo'sh ko'rinib qolardi).
    window._editCameFromDrafts = true;
    // To'g'ridan-to'g'ri editModal'ni ochamiz (productModal'ni o'tkazib yuboramiz)
    // — bu navigatsiyani sodda qiladi va history'da ortiqcha entry qoldirmaydi.
    if (typeof openEditModal === 'function') {
        openEditModal(null, id);
    } else {
        // Zaxira: eski yo'l (productModal orqali)
        openProduct(id);
        setTimeout(() => { let editBtn = document.getElementById('pm-edit-btn'); if (editBtn) editBtn.click(); }, 100);
    }
};

// 🗑️ Qoralamani o'chirish va Eskisini tiklash
window.deleteDraft = (id, hasConflict) => {
    if(typeof tg !== 'undefined' && tg.showConfirm) {
        tg.showConfirm(hasConflict ? "Yangi narxni bekor qilib, eskisini tiklaymizmi?" : "Bu qoralamani o'chirasizmi?", function(ok) {
            if(ok) processDraftDeletion(id, hasConflict);
        });
    } else {
        if(confirm("Bu qoralamani o'chirasizmi?")) processDraftDeletion(id, hasConflict);
    }
};

window.processDraftDeletion = (id, hasConflict) => {
    let draftIndex = productsDB.findIndex(p => p.id === id);
    let draftName = "";
    
    if(draftIndex !== -1) {
        draftName = productsDB[draftIndex].name.toLowerCase();
        productsDB.splice(draftIndex, 1); // Qoralamani uchirib tashlaymiz
    }
    
    // Agar u dublikat bo'lgan bo'lsa, eski yashirilgan tovarni topib QAYTA TIKLAYMIZ
    if (hasConflict && draftName) {
        let oldIndex = productsDB.findIndex(p => p.name.toLowerCase() === draftName && p.is_draft && p.desc && p.desc.includes("DIQQAT"));
        if (oldIndex !== -1) {
            delete productsDB[oldIndex].is_draft; // Yashirinishdan chiqaramiz
            productsDB[oldIndex].desc = "Narxi saqlab qolindi (Tiklandi)";
        }
    }
    
    // ⚠️ ILGARI: `db.ref('products').set(productsDB)` — butun katalogni
    //    XOTIRADAGI (eskirgan bo'lishi mumkin) nusxa bilan qayta yozardi.
    //    `productsDB` sahifa ochilganda BIR MARTA o'qiladi va `products` ga
    //    listener YO'Q. Ya'ni sahifa ochilgandan keyin bot yoki boshqa admin
    //    qo'shgan HAR QANDAY tovar shu yozuvda JIMGINA O'CHIB KETARDI.
    //    Endi `_rewriteProductsSafely` ishlatiladi: u avval ENG SO'NGGI
    //    holatni o'qiydi, o'zgartirishni o'shanga qo'llaydi.
    window._rewriteProductsSafely(function (fresh) {
        var byId = {};
        productsDB.forEach(function (p) { if (p && p.id != null) byId[String(p.id)] = p; });
        // Serverdagi ro'yxatni asos qilamiz; lokalda o'zgargan tovarlarni
        // ustiga qo'yamiz; lokalda BUTUNLAY yo'q (o'chirilgan) tovarni tashlaymiz.
        return fresh
            .filter(function (p) { return p && p.id != null && byId[String(p.id)]; })
            .map(function (p) { return byId[String(p.id)]; });
    }).then(function () {
        showToast(hasConflict ? "O'chirildi va eskisi tiklandi!" : "Qoralama o'chirildi!");
        filterAdminDrafts(); // Oynani yangilab qoyish
    }).catch(function () {
        showToast("Saqlashda xato — qayta urinib ko'ring", "warning");
    });
};

// =====================================
// ✍️ TAVSIF UCHUN AVTO-MATN SHABLONLARI
// =====================================
window.addDescTemplate = (prefix, text) => {
    let textarea = document.getElementById(`${prefix}-desc`);
    if (textarea) {
        // Agar yozuv qutisi bo'sh bo'lmasa, yangi qatordan qo'shadi, bo'sh bo'lsa shundayligicha yozadi
        if (textarea.value.trim() !== '') {
            textarea.value += '\n' + text;
        } else {
            textarea.value = text;
        }
        showToast("Matn qo'shildi!", "success");
    }
};

// ==========================================
// 🤖 AI KO'PRIK (FIREBASE ORQALI PYTHONGA)
// ==========================================

// ==========================================
// 🤖 PREMIUM AI KO'PRIK VA CHAT MOTORI
//
// ⚠️⚠️ O'LIK KOD — 2026.22 dan boshlab BU BLOK ISHLAMAYDI.
//   `openAiChat`, `sendAiMessage` va `renderAiChat` fayl OXIRIDAGI
//   «QATLAM 2026.22 — SHOGIRD AI» blokida qayta yozilgan va u keyin
//   yuklangani uchun AYNAN O'SHA ishlaydi.
//   Bu yerni tahrirlash HECH NARSAGA ta'sir qilmaydi — fayl oxiridagi
//   id'si "shogird-ai-2026-js" bo'lgan skript blokini tahrirlang.
//   (Izohda marker satrini SO'ZMA-SO'Z yozib bo'lmaydi: sinov skript
//    blokini aynan shu satr bo'yicha topadi va izohga tushib qolardi.)
//   Ataylab o'chirilmadi: eski keshdagi ilova bir muddat shu nomlarga
//   tayanishi mumkin. Keyingi tozalashda olib tashlanadi.
// ==========================================
window.openAiChat = () => {
    activeModal = 'aiChatModal';
    document.getElementById('aiChatModal').style.display = 'flex';
    document.body.style.overflow = 'hidden'; 
    
    if (typeof historyStack !== 'undefined') {
        window.history.pushState({ modal: 'aiChatModal' }, "");
    }

    // 🛑 Xabarlarni bazadan real-vaqtda o'qish (Listener)
    if(window.currentUser) {
        // ⚡ XOTIRA OQISHINI TUZATISH: eski listenerni o'chirib, keyin yangisini ulaymiz
        if (window._aiChatRef) { try { window._aiChatRef.off('value'); } catch(e){} }
        window._aiChatRef = db.ref('ai_requests/' + window.currentUser);
        window._aiChatRef.on('value', snap => {
            if(snap.exists()) {
                let data = snap.val();
                if(data.messages) {
                    renderAiChat(data.messages);
                } else {
                    renderAiChat([]);
                }
            } else {
                renderAiChat([]); 
            }
        });
    }
};

    window.sendAiMessage = () => {
    let input = document.getElementById('ai-chat-input');
    let text = input.value.trim();
    if(!text || !currentUser) return;
    
    input.value = ''; 
    let box = document.getElementById('ai-chat-box');
    
    box.innerHTML += `
        <div class="msg-bot-luxury" id="ai-typing-indicator" style="padding: 12px 18px !important; width: max-content;">
            <div class="luxury-typing">
                <div class="luxury-dot"></div><div class="luxury-dot"></div><div class="luxury-dot"></div>
            </div>
        </div>`;
    box.scrollTop = box.scrollHeight;
    
    db.ref('ai_requests/' + currentUser).once('value', snap => {
        let data = snap.exists() ? snap.val() : { messages: [] };
        if(!data.messages) data.messages = [];
        data.messages.push({ sender: 'user', text: text, time: Date.now() });
        data.needs_processing = true; 
        db.ref('ai_requests/' + currentUser).set(data);
    });
};

window.renderAiChat = (messages) => {
    let box = document.getElementById('ai-chat-box');
    
    let html = `
        <div class="msg-bot-luxury">
            Assalomu alaykum! Men sizning shaxsiy yordamchingizman.<br>
            Qanday ehtiyot qismlar yoki xizmatlar kerakligini bemalol so'rashingiz mumkin.
        </div>`;
    
    messages.forEach(m => {
        let isMe = m.sender === 'user';
        let bubbleClass = isMe ? 'msg-user-luxury' : 'msg-bot-luxury';
        
        let productsHtml = '';
        if(m.found_products && m.found_products.length > 0) {
            productsHtml = '<div style="margin-top: 12px; display:flex; flex-direction:column; gap:8px;">';
            m.found_products.forEach(id => {
                let p = productsDB.find(x => x.id == id);
                if(p) {
                    productsHtml += `
                    <div style="background: rgba(0,0,0,0.4); border: 1px solid rgba(212,175,55,0.2); border-radius: 8px; padding: 8px; display:flex; align-items:center; gap: 10px; cursor:pointer;" onclick="closeModal(); setTimeout(() => openProduct(${p.id}), 300)">
                        <img src="${p.img || ''}" style="width:45px; height:45px; object-fit:contain; border-radius:6px; background:#fff; padding: 2px;">
                        <div style="flex:1;">
                            <div style="font-size:13px; font-weight:600; color:#fff;">${p.name}</div>
                            <div style="font-size:12px; color:#D4AF37; font-weight: bold; margin-top:3px;">${p.price.toLocaleString()} so'm</div>
                        </div>
                        <div style="color:#D4AF37; font-size: 16px;">›</div>
                    </div>`;
                }
            });
            productsHtml += '</div>';
        }

        html += `<div class="${bubbleClass}">${m.text}${productsHtml}</div>`;
    });
    
    box.innerHTML = html;
    setTimeout(() => { box.scrollTo({ top: box.scrollHeight, behavior: 'smooth' }); }, 100);
};

// ==========================================
// ✍️ ADMIN UCHUN AI TAVSIF YARATUVCHI
// ==========================================
// Davlatni tanlash tugmalari uchun (Dizayn o'zgarishi)
window.selectOrigin = (el, type) => {
    document.querySelectorAll(`#${type}-origin-chips .origin-chip`).forEach(c => {
        c.style.background = 'rgba(255,255,255,0.05)';
        c.style.color = 'white';
        c.style.borderColor = 'var(--glass-border)';
        c.classList.remove('selected');
    });
    el.style.background = 'rgba(212, 175, 55, 0.15)';
    el.style.color = 'var(--luxury-gold)';
    el.style.borderColor = 'var(--luxury-gold)';
    el.classList.add('selected');
};

// Asosiy AI Generator (Rasm ko'radigan qilingan)
window.generateAiDescription = (type) => {
    let nameInput = document.getElementById(`${type}-name`).value.trim();
    if(!nameInput) {
        showToast("Avval tepaga tovar nomini yozing!", "warning");
        return;
    }
    
    // 📸 1. RASM YUKLANGANINI TEKSHIRAMIZ
    let imgUrl = document.getElementById(`${type}-img-url`).value;
    if(!imgUrl) {
        showToast("Avval rasmni yuklang! Shogird rasmni ko'rib aniq yozadi.", "warning");
        return;
    }
    
    // Tanlangan davlatni aniqlash
    let originChip = document.querySelector(`#${type}-origin-chips .origin-chip.selected`);
    let origin = originChip ? originChip.getAttribute('data-origin') : "Noma'lum";
    
    let descBox = document.getElementById(`${type}-desc`);
    let originalText = descBox.value;
    descBox.value = "👀 AI rasmni diqqat bilan o'rganmoqda... Kuting...";
    
    // Firebase orqali Pythonga vazifa beramiz (Rasm URL si bilan)
    let taskId = Date.now().toString();
    db.ref('ai_admin_tasks/' + taskId).set({
        action: "generate_desc",
        product_name: nameInput,
        origin: origin, 
        image_url: imgUrl, // YANGLIK: Rasm silkasi Pythonga ketdi
        needs_processing: true
    }); 
    
    // Python javobini kutamiz
    let ref = db.ref('ai_admin_tasks/' + taskId);
    ref.on('value', snap => {
        let data = snap.val();
        if(data && data.result) {
            descBox.value = data.result; 
            ref.off('value'); 
            db.ref('ai_admin_tasks/' + taskId).remove();
            if(typeof tg !== 'undefined' && tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
            showToast("✨ Shogird rasmni ko'rib yozib berdi!", "success");
        } else if (data && data.error) {
            descBox.value = originalText;
            ref.off('value');
            showToast("Xatolik yuz berdi", "warning");
        }
    });
};


// 🚀 AI OMMAVIY QO'SHISH MOTOR
// ============================================================================
// 🧠 AI OMMAVIY — TO'LIQ QAYTA YOZILDI
// ----------------------------------------------------------------------------
// ⚠️ ILGARI QANDAY XATOLAR BO'LGAN (hammasi shu yerda tuzatildi):
//
//  1. `.catch()` YO'Q edi. Firebase yozuvi rad etilsa (qoidalar, internet yo'q,
//     auth tayyor emas) `.then()` hech qachon ishlamasdi -> forma yashirin,
//     loader esa MANGU aylanib turardi. Oyna sahifa qayta yuklanmaguncha o'lik
//     bo'lib qolardi va HECH QANDAY xabar chiqmasdi.
//  2. SOXTA progress: loader qattiq `setTimeout(1500)` bilan yopilardi
//     ("1.5 soniya neyron tarmoqni tomosha qiladi" deb izoh ham bor edi).
//     Bot o'chiq bo'lsa ham "✅ tahlilga yuborildi" deb yozardi.
//  3. NATIJA HECH QACHON O'QILMASDI. Bot `status`, `added`, `error` yozardi —
//     lekin ilovada uni o'qiydigan kod umuman yo'q edi. "Matn bo'sh",
//     "Hech qanday mahsulot ajratib bo'lmadi" kabi xatolar ko'rinmasdi.
//  4. TIMEOUT yo'q: bot uxlab qolsa (Render) so'rov abadiy kutib turardi.
//  5. ADMIN TEKSHIRUVI yo'q edi (server tomonda ham) — xavfsizlik teshigi.
//  6. `currentUser` tekshirilmasdi -> `ai_bulk_requests/null` ga yozishga urinardi.
//  7. `btn` parametri ishlatilmasdi -> tugma bloklanmasdi, ikki marta bosilsa
//     ikki so'rov ketardi.
//  8. Qiymatlar tekshirilmasdi: `parseFloat(...) || 12600` — 0 kiritilsa
//     jimgina 12600 ga aylanardi; manfiy ustama manfiy narx berardi.
//  9. Natijadagi qoralamalar ILOVADA KO'RINMASDI: `products` bir marta
//     (`once`) o'qilardi, listener yo'q -> ilovani qayta ochmaguncha
//     "Qoralamalar yo'q" deb turardi.
// 10. Oyna holati tiklanmasdi: loader ochiq holatda yopib qayta ochsa,
//     faqat loader ko'rinardi.
// ============================================================================
window._aiBulkBusy = false;

window.sendAiBulk = (btn) => {
    if (window._aiBulkBusy) { showToast("So'rov yuborilmoqda, kuting...", "warning"); return; }

    // 🔐 1) Faqat admin
    if (!(window.isAdmin && window.isAdmin())) {
        showToast("Bu amal faqat admin uchun", "warning");
        return;
    }
    // 2) Foydalanuvchi aniqmi (Firebase qoidalari uid bo'yicha ishlaydi)
    var uid = window.currentUser;
    if (!uid) { showToast("Foydalanuvchi aniqlanmadi. Ilovani qayta oching.", "warning"); return; }

    var txtEl = document.getElementById('ai-bulk-text');
    var text = txtEl ? txtEl.value.trim() : '';
    if (!text) { showToast("Iltimos, oldin ro'yxatni yozing!", "warning"); return; }

    // 3) Qiymatlarni HAQIQATAN tekshiramiz (jimgina almashtirmaymiz)
    var rateEl = document.getElementById('ai-bulk-usd-rate');
    var markEl = document.getElementById('ai-bulk-markup');
    var usdRate = parseFloat(rateEl ? rateEl.value : '');
    var markup = parseFloat(markEl ? markEl.value : '');
    if (!isFinite(usdRate) || usdRate < 100 || usdRate > 1000000) {
        showToast("USD kursi noto'g'ri (100 – 1 000 000)", "warning");
        if (rateEl) rateEl.focus();
        return;
    }
    if (!isFinite(markup) || markup < -90 || markup > 1000) {
        showToast("Ustama noto'g'ri (-90% – 1000%)", "warning");
        if (markEl) markEl.focus();
        return;
    }

    var lineCount = text.split('\n').filter(function (l) { return l.trim(); }).length;
    if (lineCount > 200) {
        showToast("Ro'yxat 200 qatordan oshmasin (hozir " + lineCount + " ta)", "warning");
        return;
    }

    window._aiBulkBusy = true;
    if (btn) { btn.disabled = true; btn.dataset.old = btn.innerHTML; btn.innerHTML = 'Yuborilmoqda...'; }
    window._aiBulkShowStage('sending', { lines: lineCount });

    var reqRef = db.ref('ai_bulk_requests/' + uid);
    var startedAt = Date.now();

    reqRef.set({
        raw_text: text,
        status: "pending",
        time: startedAt,
        needs_processing: true,
        usd_rate: usdRate,
        markup_pct: markup
    }).then(function () {
        window._aiBulkShowStage('working', { lines: lineCount });
        // 4) NATIJANI KUTAMIZ (jonli listener) — soxta setTimeout emas
        window._aiBulkWatch(reqRef, startedAt, btn);
    }).catch(function (err) {
        // 5) Endi xato JIMGINA yo'qolmaydi
        window._aiBulkBusy = false;
        if (btn) { btn.disabled = false; if (btn.dataset.old) btn.innerHTML = btn.dataset.old; }
        var msg = (err && err.message) ? err.message : 'Bazaga yozilmadi';
        window._aiBulkShowStage('error', { error: msg });
        showToast("❌ Yuborilmadi: " + msg, "warning");
    });
};

/**
 * So'rov natijasini kuzatadi: bot `status`ni 'done' yoki 'error' qiladi.
 * Bot javob bermasa — 90 soniyadan keyin ogohlantiradi (ilgari abadiy kutardi).
 */
window._aiBulkWatch = function (reqRef, startedAt, btn) {
    var done = false;
    var TIMEOUT_MS = 90000;

    var finish = function () {
        if (done) return;
        done = true;
        try { reqRef.off('value', onVal); } catch (e) {}
        if (timer) clearTimeout(timer);
        window._aiBulkBusy = false;
        if (btn) { btn.disabled = false; if (btn.dataset.old) btn.innerHTML = btn.dataset.old; }
    };

    var onVal = function (snap) {
        var v = snap.val();
        if (!v || done) return;
        // Eski (oldingi) natijani o'qib yubormaslik uchun vaqtni tekshiramiz
        if (v.time && v.time < startedAt) return;
        if (v.status === 'done') {
            finish();
            var added = parseInt(v.added, 10) || 0;
            window._aiBulkShowStage('done', { added: added });
            if (added > 0) {
                showToast("✅ " + added + " ta qoralama qo'shildi!", "success");
                try { if (window._hap) window._hap('success'); } catch (e) {}
                // 6) Qoralamalar DARHOL ko'rinsin — bazani qayta o'qiymiz
                if (window._aiBulkReloadProducts) window._aiBulkReloadProducts();
            } else {
                showToast("Hech narsa qo'shilmadi", "warning");
            }
        } else if (v.status === 'error') {
            finish();
            window._aiBulkShowStage('error', { error: v.error || "Noma'lum xato" });
            showToast("❌ " + (v.error || "Xatolik"), "warning");
        }
    };

    reqRef.on('value', onVal);

    var timer = setTimeout(function () {
        if (done) return;
        finish();
        window._aiBulkShowStage('timeout', {});
    }, TIMEOUT_MS);
};

/** Qoralamalar darhol ko'rinishi uchun `products`ni qayta o'qiydi. */
window._aiBulkReloadProducts = function () {
    try {
        db.ref('products').once('value').then(function (snap) {
            if (!snap.exists()) return;
            var all = [];
            snap.forEach(function (c) { if (c.val()) all.push(c.val()); });
            productsDB = all;
            window.productsDB = all;
            if (typeof _sortDisplayDB === 'function') {
                displayDB = _sortDisplayDB(productsDB.filter(function (p) { return !p.is_draft; }).slice().reverse());
            }
            if (typeof renderProducts === 'function') renderProducts();
            // Qoralamalar oynasi ochiq bo'lsa — yangilaymiz
            if (activeModal === 'adminDraftsModal' && typeof showDraftFolders === 'function') showDraftFolders();
        }).catch(function () {});
    } catch (e) {}
};

    // ==========================================
// 🗑 BARCHA QORALAMALARNI TOZALASH
// ==========================================
window.deleteAllDrafts = () => {
    // 1. O'chirishdan oldin so'rash (xato bosilib ketmasligi uchun)
    if(typeof tg !== 'undefined' && tg.showConfirm) {
        tg.showConfirm("Haqiqatan ham barcha qoralamalarni o'chirib tashlaysizmi? Bu amalni ortga qaytarib bo'lmaydi!", function(ok) {
            if(ok) executeDeleteAllDrafts();
        });
    } else {
        if(confirm("Haqiqatan ham barcha qoralamalarni o'chirib tashlaysizmi?")) executeDeleteAllDrafts();
    }
};

window.executeDeleteAllDrafts = () => {
    // 2. Bazadagi jami tovarlar sonini eslab qolamiz
    let originalCount = productsDB.length;
    let deletedCount = productsDB.filter(p => p.is_draft).length;

    if (deletedCount === 0) {
        showToast("O'chirish uchun qoralamalar yo'q!", "warning");
        return;
    }

    // #7: eng so'nggi holatni o'qib, faqat qoralamalarni olib tashlab yozamiz
    window._rewriteProductsSafely(function (fresh) {
        return fresh.filter(p => !p.is_draft);
    }).then(() => {
        showToast(`✅ ${deletedCount} ta qoralama o'chirildi!`, "success");
        filterAdminDrafts(); // Oynadagi ro'yxatni yangilab qo'yamiz (bo'm-bo'sh bo'lib qoladi)
    }).catch(err => {
        showToast("Xatolik yuz berdi!", "warning");
    });
};

// ==========================================
// 📁 QORALAMALAR PAPKALARI (BATCHES) MANTIG'I
// ==========================================
window.currentDraftFolder = null;

/** Marka filtrini tozalaydi (u yashirib qo'ygan qoralamalarni qaytaradi). */
window._draftResetFilter = function () {
    window.currentDraftFilter = 'all';
    var sel = document.getElementById('draft-brand-filter');
    if (sel) sel.value = 'all';
    if (typeof filterAdminDrafts === 'function') filterAdminDrafts('all');
};

window.openAdminDrafts = () => {
    document.getElementById('adminModal').style.display = 'none';
    let m = document.getElementById('adminDraftsModal');
    m.style.display = 'flex';
    activeModal = 'adminDraftsModal';
    window.history.pushState({ modal: 'adminDraftsModal' }, "");
    showDraftFolders();
};

window.closeDraftsModalCustom = () => {
    if (document.getElementById('draft-items-view').style.display === 'block') {
        backToFolders();
    } else {
        closeModal();
    }
};

window.showDraftFolders = () => {
    document.getElementById('draft-folders-view').style.display = 'block';
    document.getElementById('draft-items-view').style.display = 'none';
    document.getElementById('drafts-modal-title').innerHTML = "📝 Qoralamalar (Papkalar)";
    
    let drafts = productsDB.filter(p => p.is_draft);
    let folders = {};
    
    drafts.forEach(p => {
        let bId = p.batch_id || "Boshqalar";
        if(!folders[bId]) folders[bId] = 0;
        folders[bId]++;
    });

    let html = Object.keys(folders).map(bId => `
        <div class="admin-card" style="position:relative; display:flex; flex-direction:column; align-items:center; justify-content:center; aspect-ratio: 1/1;" onclick="openDraftFolder('${bId}')">
            <div style="position:absolute; top:10px; right:40px; cursor:pointer; background:rgba(255,255,255,0.1); padding:6px; border-radius:5px; font-size:14px;" onclick="renameFolder(event, '${bId}')">✏️</div>
            <div style="position:absolute; top:10px; right:10px; cursor:pointer; background:rgba(255,69,58,0.1); padding:6px; border-radius:5px; font-size:14px; color:var(--accent-red);" onclick="deleteFolder(event, '${bId}')">🗑️</div>
            
            <div style="font-size:40px; margin-bottom:10px; filter: drop-shadow(0 4px 10px rgba(212,175,55,0.4));">📁</div>
            <h3 style="font-size:12px; margin-bottom:5px; color:var(--luxury-gold); text-align:center;">${window._prettyBatch(bId)}</h3>
            <p style="font-size:11px; font-weight:bold; color:var(--accent-green); background:rgba(48,209,88,0.1); padding:3px 8px; border-radius:6px;">${folders[bId]} ta tovar</p>
        </div>
    `).join('');

    if(Object.keys(folders).length === 0) {
        html = '<div style="grid-column: span 2; text-align:center; padding: 40px; background: rgba(255,255,255,0.05); border-radius: 16px;"><span style="font-size:40px;">📭</span><p style="color:gray; margin-top:10px;">Qoralamalar yo\'q.</p></div>';
    }
    document.getElementById('draft-folders-list').innerHTML = html;
};

// PAPKANI O'ZINI TO'LIQ O'CHIRISH
window.deleteFolder = (e, batchId) => {
    e.stopPropagation();
    if(typeof tg !== 'undefined' && tg.showConfirm) {
        tg.showConfirm("Ushbu papkadagi BARCHA tovarlarni o'chirib tashlaysizmi?", function(ok) {
            if(ok) executeDeleteFolder(batchId);
        });
    } else {
        if(confirm("Ushbu papkadagi BARCHA tovarlarni o'chirib tashlaysizmi?")) executeDeleteFolder(batchId);
    }
};

window.executeDeleteFolder = (batchId) => {
    // #7: eng so'nggi holat ustida ishlaymiz (begona tovarlar yo'qolmaydi)
    window._rewriteProductsSafely(function (fresh) {
        let itemsToDelete = fresh.filter(p => p.is_draft && (p.batch_id || "Boshqalar") === batchId);
        itemsToDelete.forEach(draft => {
            let draftIndex = fresh.findIndex(p => p.id === draft.id);
            if (draftIndex !== -1) {
                fresh.splice(draftIndex, 1);
                if (draft.has_conflict) {
                    let oldIndex = fresh.findIndex(p => p.name.toLowerCase() === draft.name.toLowerCase() && p.is_draft && p.desc && p.desc.includes("DIQQAT"));
                    if (oldIndex !== -1) {
                        delete fresh[oldIndex].is_draft;
                        fresh[oldIndex].desc = "Narxi saqlab qolindi (Tiklandi)";
                    }
                }
            }
        });
        return fresh;
    }).then(() => {
        showToast("Papka va uning ichidagi tovarlar o'chirildi!", "success");
        showDraftFolders();
    }).catch(() => showToast("Saqlashda xato!", "warning"));
};

window.openDraftFolder = (batchId) => {
    window.currentDraftFolder = batchId;
    document.getElementById('draft-folders-view').style.display = 'none';
    document.getElementById('draft-items-view').style.display = 'block';
    
    let displayTitle = window._prettyBatch(batchId);
    if(displayTitle.length > 15) displayTitle = displayTitle.substring(0, 15) + '...';
    document.getElementById('drafts-modal-title').innerHTML = `📁 ${displayTitle}`;
    
    document.getElementById('draft-search-input').value = '';
    filterAdminDrafts('all');
};

window.backToFolders = () => {
    window.currentDraftFolder = null;
    showDraftFolders();
};

window.renameFolder = (e, oldName) => {
    e.stopPropagation();
    let currentDisplay = window._prettyBatch(oldName);
    let newName = prompt("Papkaning yangi nomini kiriting:", currentDisplay);
    if(!newName || newName.trim() === "" || newName === currentDisplay) return;
    
    let finalNewName = newName.trim();
    // #7: butun massivni qayta yozmaymiz — faqat o'zgargan tovarlarning
    // batch_id maydonini ATOMIK multi-path update() bilan yangilaymiz.
    let updates = {};
    productsDB.forEach((p, idx) => {
        if(p.is_draft && (p.batch_id || "Boshqalar") === oldName) {
            p.batch_id = finalNewName;
            updates['products/' + idx + '/batch_id'] = finalNewName;
        }
    });

    if(Object.keys(updates).length > 0) {
        db.ref().update(updates).then(() => {
            showToast("Papka nomi o'zgardi!", "success");
            showDraftFolders();
        }).catch(() => showToast("Saqlashda xato!", "warning"));
    }
};

window.filterAdminDrafts = (filterBrand = null) => {
    if (filterBrand) window.currentDraftFilter = filterBrand;
    let q = document.getElementById('draft-search-input').value.toLowerCase().trim();
    let c = document.getElementById('admin-drafts-list');
    
    let drafts = productsDB.filter(p => p.is_draft === true && (p.batch_id || "Boshqalar") === window.currentDraftFolder);
    let totalInFolder = drafts.length;   // marka filtridan OLDINGI son

    if (window.currentDraftFilter && window.currentDraftFilter !== 'all') {
        drafts = drafts.filter(p => {
            let catsStr = (p.categories || []).join(' ');
            if (window.currentDraftFilter === 'gaz') return catsStr.includes('gazel') || catsStr.includes('volga') || catsStr.includes('sobol') || catsStr.includes('uaz');
            if (window.currentDraftFilter === 'chevy') return catsStr.includes('chevy');
            if (window.currentDraftFilter === 'daewoo') return catsStr.includes('daewoo');
            return true;
        });
    }

    if (q) drafts = drafts.filter(p => p.name.toLowerCase().includes(q));
    
    if (drafts.length === 0) {
        // ⚠️ ILGARI har qanday holatda bitta quruq "Bu papkada tovar topilmadi"
        //    chiqardi. Eng chalg'itadigan holat: AI qo'shgan qoralamalarga marka
        //    BELGILANMAYDI (bot `categories: ["umumiy"]` yozadi), shuning uchun
        //    admin marka filtrini tanlasa — hamma AI qoralamasi yashirinardi va
        //    admin ular "yo'qolgan" deb o'ylardi. Endi sabab aytiladi.
        if (totalInFolder > 0 && window.currentDraftFilter && window.currentDraftFilter !== 'all') {
            c.innerHTML = '<div style="text-align:center; padding:26px 18px;">' +
                '<div style="font-size:38px; opacity:.6; margin-bottom:10px;">🔍</div>' +
                '<div style="font-size:14px; font-weight:700; color:var(--text-main); margin-bottom:6px;">' +
                    'Marka filtri ' + totalInFolder + ' ta tovarni yashirdi</div>' +
                '<div style="font-size:12.5px; color:var(--text-muted); line-height:1.55; margin-bottom:14px;">' +
                    "AI qo'shgan qoralamalarga marka hali belgilanmagan — " +
                    "tahrirlashda markani tanlaysiz.</div>" +
                '<button type="button" onclick="window._draftResetFilter()" ' +
                    'style="padding:12px 20px; border:none; border-radius:13px; cursor:pointer; font-family:inherit; ' +
                    'font-size:13.5px; font-weight:800; background:var(--gold-gradient); color:#2a2000;">' +
                    'Hammasini ko\'rsatish</button></div>';
            return;
        }
        c.innerHTML = '<p style="text-align:center; color:gray; margin-top:20px;">' +
            (q ? "Qidiruv bo'yicha topilmadi." : "Bu papkada tovar topilmadi.") + '</p>';
        return;
    }

    c.innerHTML = drafts.map(p => {
        let firstCat = (p.categories && p.categories[0]) ? p.categories[0].split('-').slice(0,2).join(' ').toUpperCase().replace(/CHEVY/g, 'CHEVROLET') : '';
        let conflictBadge = p.has_conflict ? `<div style="color:#ff453a; font-size:10px; font-weight:bold; margin-bottom:4px;">⚠️ DUBLIKAT (Eskisi yashirildi)</div>` : '';
        
        return `
        <div class="inventory-item" style="display:flex; justify-content:space-between; align-items:center; border: 1px solid ${p.has_conflict ? 'rgba(255,69,58,0.4)' : 'var(--glass-border)'};">
            <div class="inv-info" style="flex:1; cursor:pointer;" onclick="editDraft(${p.id})">
                ${conflictBadge}
                <h4 style="color:var(--luxury-gold); margin-bottom:5px;">${p.name}</h4>
                <p style="font-weight:bold; font-size:12px;">${p.price.toLocaleString()} so'm <span style="color:gray; font-size:10px; margin-left:10px; background:rgba(255,255,255,0.1); padding:2px 5px; border-radius:5px;">${firstCat}</span></p>
            </div>
            <div class="inv-controls" style="display:flex; gap:12px; align-items:center; padding-left:10px;">
                <span style="font-size:22px; cursor:pointer;" onclick="editDraft(${p.id})">✏️</span>
                <span style="font-size:22px; cursor:pointer; color:#ff453a; filter: grayscale(0.2);" onclick="deleteDraft(${p.id}, ${p.has_conflict ? 'true' : 'false'})">🗑️</span>
            </div>
        </div>
        `;
    }).join('');
};

window.editDraft = (id) => {
    document.getElementById('adminDraftsModal').style.display = 'none';
    openProduct(id);
    setTimeout(() => { let editBtn = document.getElementById('pm-edit-btn'); if (editBtn) editBtn.click(); }, 100);
};

window.deleteDraft = (id, hasConflict) => {
    if(typeof tg !== 'undefined' && tg.showConfirm) {
        tg.showConfirm(hasConflict ? "Yangi narxni bekor qilib, eskisini tiklaymizmi?" : "Bu qoralamani o'chirasizmi?", function(ok) {
            if(ok) processDraftDeletion(id, hasConflict);
        });
    } else {
        if(confirm("Bu qoralamani o'chirasizmi?")) processDraftDeletion(id, hasConflict);
    }
};

window.processDraftDeletion = (id, hasConflict) => {
    // #7: eng so'nggi holat ustida (id bo'yicha) ishlaymiz — begona tovarlar yo'qolmaydi
    window._rewriteProductsSafely(function (fresh) {
        let draftIndex = fresh.findIndex(p => p.id === id);
        let draftName = "";
        if (draftIndex !== -1) {
            draftName = fresh[draftIndex].name.toLowerCase();
            fresh.splice(draftIndex, 1);
        }
        if (hasConflict && draftName) {
            let oldIndex = fresh.findIndex(p => p.name.toLowerCase() === draftName && p.is_draft && p.desc && p.desc.includes("DIQQAT"));
            if (oldIndex !== -1) {
                delete fresh[oldIndex].is_draft;
                fresh[oldIndex].desc = "Narxi saqlab qolindi (Tiklandi)";
            }
        }
        return fresh;
    }).then(() => {
        showToast(hasConflict ? "O'chirildi va eskisi tiklandi!" : "Qoralama o'chirildi!");
        filterAdminDrafts(); // Oynadagi tovarlarni yangilash
        
        // Agar papka bo'shab qolgan bo'lsa, avtomat orqaga qaytarish
        let draftsInFolder = productsDB.filter(p => p.is_draft === true && (p.batch_id || "Boshqalar") === window.currentDraftFolder);
        if(draftsInFolder.length === 0) backToFolders();
    }).catch(() => showToast("Saqlashda xato!", "warning"));
};

// Mashina tugmalarini (chiplarni) bosganda belgilaydigan funksiya
window.toggleChip = function(el) {
    if (el) {
        el.classList.toggle('selected');
    }
};    
// 🛍️ SAVATNI CHIZISH VA RASM KO'RSATISH (Qotishlarsiz yagona versiya)
window.renderCartItems = () => {
    let c = document.getElementById('cart-items-container'); 
    let b = document.getElementById('main-checkout-btn'); 
    let footer = document.getElementById('cart-total-footer'); 
    let pWrap = document.getElementById('cart-progress-wrap');
    let t = 0; 
    
    if(!c) return; 
    c.innerHTML = '';
    
    if(!cart || Object.keys(cart).length === 0) { 
        c.innerHTML = `
        <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding: 50px 20px; text-align:center;">
            <div style="font-size: 80px; animation: floatCart 2s ease-in-out infinite; filter: drop-shadow(0 15px 15px rgba(212,175,55,0.3)); margin-bottom: 20px;">🛒</div>
            <h3 style="color: #fff; margin: 0 0 8px 0; font-size: 20px; font-weight: 800;">Savatingiz bo'p-bo'sh</h3>
            <p style="color: gray; font-size: 14px; margin: 0 0 25px 0; line-height: 1.5;">Hozircha hech narsa tanlamadingiz.<br>Katalogda ajoyib zapchastlar bor!</p>
            <button onclick="closeModal(); showCatalog();" style="background: linear-gradient(135deg, rgba(212,175,55,0.2), rgba(212,175,55,0.05)); color: var(--luxury-gold); border: 1px solid var(--luxury-gold); padding: 14px 35px; border-radius: 16px; font-weight: 800; font-size: 14px; cursor: pointer; transition: 0.3s; box-shadow: 0 8px 15px rgba(0,0,0,0.3);">
                🛍️ TOVARLARNI KO'RISH
            </button>
        </div>`; 
        
        if(b) b.style.display = 'none'; 
        if(footer) footer.style.display = 'none'; 
        if(pWrap) pWrap.style.display = 'none';
        // ⛑ Savat bo'sh -> ishonch belgilari ham yashirin
        var tBdg = document.getElementById('cart-trust-badges');
        if(tBdg) tBdg.style.display = 'none';
        return; 
    } 
    // ⛑ Savatda tovar bor -> ishonch belgilari ko'rinadi (1-2 kun, kafolat, pul qaytarish)
    var tBdg2 = document.getElementById('cart-trust-badges');
    if(tBdg2) tBdg2.style.display = 'flex';

    if(b) b.style.display = 'block';
    if(footer) footer.style.display = 'block'; 
    
    t = 0; 
    for(let safeId in cart) { 
        let [baseId, carOptRaw] = String(safeId).split('||');
        let p = productsDB.find(x => x.id == baseId); 
        if(!p) continue; 
        
        let qty = parseInt(cart[safeId]) || 0;
        let sum = p.price * qty;
        t += sum; 
        
        let carOpt = carOptRaw ? carOptRaw.replace(/_dot_/g, ".") : "";
        let displayName = carOpt && carOpt !== "Universal" ? `${p.name} <br><span style="color:var(--text-muted); font-size:11px;">(Razmer: <b style="color:var(--luxury-gold);">${carOpt}</b>)</span>` : p.name;
        
        c.innerHTML += `
            <div class="cart-row">
                <div class="cart-content-wrap">
                <img src="${_thumb(p.img, 140)}" style="width: 65px; height: 65px; border-radius: 12px; object-fit: cover; background: #fff;" loading="lazy" decoding="async" data-full="${(p.img||'').replace(/"/g,'&quot;')}" onload="this.style.opacity=1" onerror="window._imgFallback(this)">
                
                <div class="cart-info">
                    <h4 style="line-height: 1.4;">${displayName}</h4>
                    <span style="color:var(--luxury-gold); font-weight:700;">${sum.toLocaleString()} so'm</span>
                </div>
                
                <div class="cart-controls">
                    <button onclick="chg('${safeId}',-1)">-</button>
                    <span style="color:white; font-weight:bold; width:25px; text-align:center; font-size: 16px;">${qty}</span>
                    <button onclick="chg('${safeId}',1)">+</button>
                </div>
                </div>
                <div class="swipe-delete" onclick="chg('${safeId}', -${qty})">🗑</div>
            </div>`; 
    } 
    
    if(typeof animatePrice === 'function') animatePrice('cart-total-sum', t);
    else { let tSum = document.getElementById('cart-total-sum'); if(tSum) tSum.innerText = t.toLocaleString() + " so'm"; }

    if(pWrap) {
        pWrap.style.display = 'block';
        let target = (window.VIP && window.VIP.freeDeliveryTarget) ? window.VIP.freeDeliveryTarget() : 3000000;
        let percent = Math.min((t / target) * 100, 100);
        let pBar = document.getElementById('cart-progress-bar');
        let pMsg = document.getElementById('cart-progress-msg');
        if(pBar) pBar.style.width = percent + '%';
        if(pMsg) {
            if(percent >= 100) {
                pMsg.innerHTML = '🎉 Tabriklaymiz! Dostavka <b>BEPUL</b>!';
                pMsg.style.color = '#30d158';
            } else {
                pMsg.innerHTML = `Bepul dostavka uchun yana <b>${(target - t).toLocaleString()} so'm</b> qoldi`;
                pMsg.style.color = 'var(--luxury-gold)';
            }
        }
    }
};
// 🏠 OYNA TASHQARISIGA BOSGANDA YOPILISHI (Professional ergonomics)
window.onclick = function(event) {
    const modals = ['productModal', 'cartModal', 'paymentModal', 'profileEditModal'];
    modals.forEach(id => {
        let m = document.getElementById(id);
        if (event.target == m) {
            closeModal();
        }
    });
};

// ➖➕ SAVATDAGI SONNI O'ZGARTIRISH (Toza va yagona versiya)
window.chg = (safeId, d) => { 
    let [baseId, carOptRaw] = String(safeId).split('||');
    let p = productsDB.find(x => x.id == baseId);
    if(!p) return;
    
    let carOpt = carOptRaw ? carOptRaw.replace(/_dot_/g, ".") : "";
    
    let st = 10;
    if (p.product_type === 'razmerli' && p.sizes) {
        let sizeObj = p.sizes.find(s => s.size === carOpt);
        if(sizeObj) st = sizeObj.stock;
    } else {
        st = p.stock !== undefined ? p.stock : 10;
    }
    
    let totalInCart = 0;
    for(let cid in cart) { if(cid.startsWith(baseId + "||" + (carOptRaw||""))) totalInCart += parseInt(cart[cid]) || 0; }
    
    if(d > 0 && totalInCart >= st) { showToast("Omborda bunday ko'p emas", "warning"); return; }
    
    let currentQty = parseInt(cart[safeId]) || 0;
    let newQty = currentQty + d;
    
    if (newQty <= 0) {
        delete cart[safeId]; 
    } else {
        cart[safeId] = newQty;
    }
    
    saveLocalCart(); 
    updateCartBadge(); 
    renderCartItems(); 
};

// 🛍️ SAVATNI CHIZISH VA RASM KO'RSATISH (Qotishlarsiz yagona versiya)
window.renderCartItems = () => {
    let c = document.getElementById('cart-items-container'); 
    let b = document.getElementById('main-checkout-btn'); 
    let footer = document.getElementById('cart-total-footer'); 
    let pWrap = document.getElementById('cart-progress-wrap');
    let t = 0; 
    
    if(!c) return; 
    c.innerHTML = '';
    
    if(!cart || Object.keys(cart).length === 0) { 
        c.innerHTML = `
        <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding: 50px 20px; text-align:center;">
            <div style="font-size: 80px; animation: floatCart 2s ease-in-out infinite; filter: drop-shadow(0 15px 15px rgba(212,175,55,0.3)); margin-bottom: 20px;">🛒</div>
            <h3 style="color: #fff; margin: 0 0 8px 0; font-size: 20px; font-weight: 800;">Savatingiz bo'p-bo'sh</h3>
            <p style="color: gray; font-size: 14px; margin: 0 0 25px 0; line-height: 1.5;">Hozircha hech narsa tanlamadingiz.<br>Katalogda ajoyib zapchastlar bor!</p>
            <button onclick="closeModal(); showCatalog();" style="background: linear-gradient(135deg, rgba(212,175,55,0.2), rgba(212,175,55,0.05)); color: var(--luxury-gold); border: 1px solid var(--luxury-gold); padding: 14px 35px; border-radius: 16px; font-weight: 800; font-size: 14px; cursor: pointer; transition: 0.3s; box-shadow: 0 8px 15px rgba(0,0,0,0.3);">
                🛍️ TOVARLARNI KO'RISH
            </button>
        </div>`; 
        
        if(b) b.style.display = 'none'; 
        if(footer) footer.style.display = 'none'; 
        if(pWrap) pWrap.style.display = 'none';
        // ⛑ Savat bo'sh -> ishonch belgilari ham yashirin
        var tBdg = document.getElementById('cart-trust-badges');
        if(tBdg) tBdg.style.display = 'none';
        return; 
    } 
    // ⛑ Savatda tovar bor -> ishonch belgilari ko'rinadi (1-2 kun, kafolat, pul qaytarish)
    var tBdg2 = document.getElementById('cart-trust-badges');
    if(tBdg2) tBdg2.style.display = 'flex';

    if(b) b.style.display = 'block';
    if(footer) footer.style.display = 'block'; 
    
    t = 0; 
    // ⚡ TEZLIK: har element uchun innerHTML += qilish (butun konteynerni
    // qayta parse qiladi) o'rniga massivga yig'ib, OXIRIDA bir marta yozamiz.
    let _rows = [];
    for(let safeId in cart) { 
        let [baseId, carOptRaw] = String(safeId).split('||');
        let p = productsDB.find(x => x.id == baseId); 
        if(!p) continue; 
        
        let qty = parseInt(cart[safeId]) || 0;
        let sum = p.price * qty;
        t += sum; 
        
        let carOpt = carOptRaw ? carOptRaw.replace(/_dot_/g, ".") : "";
        let displayName = carOpt && carOpt !== "Universal" ? `${p.name} <br><span style="color:var(--text-muted); font-size:11px;">(Razmer: <b style="color:var(--luxury-gold);">${carOpt}</b>)</span>` : p.name;
        
        _rows.push(`
            <div class="cart-row">
                <div class="cart-content-wrap">
                <img src="${_thumb(p.img, 140)}" loading="lazy" decoding="async" style="width: 65px; height: 65px; border-radius: 12px; object-fit: cover; background: #fff;" data-full="${(p.img||'').replace(/"/g,'&quot;')}" onload="this.style.opacity=1" onerror="window._imgFallback(this)">
                <div class="cart-info">
                    <h4 style="line-height: 1.4;">${displayName}</h4>
                    <span style="color:var(--luxury-gold); font-weight:700;">${sum.toLocaleString()} so'm</span>
                </div>
                
                <div class="cart-controls">
                    <button onclick="chg('${safeId}',-1)">-</button>
                    <span style="color:white; font-weight:bold; width:25px; text-align:center; font-size: 16px;">${qty}</span>
                    <button onclick="chg('${safeId}',1)">+</button>
                </div>
                </div>
                <div class="swipe-delete" onclick="chg('${safeId}', -${qty})">🗑</div>
            </div>`); 
    } 
    c.innerHTML = _rows.join(''); // ⚡ bir marta yozish — DOM bir marta yangilanadi
    
// t - bu savatdagi jami summa o'zgaruvchisi
animatePrice('cart-total-sum', t);

    if(pWrap) {
        pWrap.style.display = 'block';
        let target = (window.VIP && window.VIP.freeDeliveryTarget) ? window.VIP.freeDeliveryTarget() : 3000000;
        let percent = Math.min((t / target) * 100, 100);
        let pBar = document.getElementById('cart-progress-bar');
        let pMsg = document.getElementById('cart-progress-msg');
        if(pBar) pBar.style.width = percent + '%';
        if(pMsg) {
            if(percent >= 100) {
                pMsg.innerHTML = '🎉 Tabriklaymiz! Dostavka <b>BEPUL</b>!';
                pMsg.style.color = '#30d158';
            } else {
                pMsg.innerHTML = `Bepul dostavka uchun yana <b>${(target - t).toLocaleString()} so'm</b> qoldi`;
                pMsg.style.color = 'var(--luxury-gold)';
            }
        }
    }
};

// 🚀 UCHUVCHI TOVAR ANIMATSIYASI (FLY TO CART)
window.flyToCartAnimation = (e, imgSrc) => {
    let clientX = e.clientX || (e.touches && e.touches.length > 0 ? e.touches[0].clientX : null);
    let clientY = e.clientY || (e.touches && e.touches.length > 0 ? e.touches[0].clientY : null);
    if (!clientX || !clientY) return; 

    let flyingImg = document.createElement('img');
    flyingImg.src = imgSrc || window._brandPlaceholder('A1');
    flyingImg.className = 'flying-img';
    
    flyingImg.style.left = (clientX - 30) + 'px';
    flyingImg.style.top = (clientY - 30) + 'px';
    flyingImg.style.width = '60px';
    flyingImg.style.height = '60px';
    document.body.appendChild(flyingImg);

    let cartNav = document.getElementById('nav-cart');
    if(!cartNav) return;
    
    let targetRect = cartNav.getBoundingClientRect();
    let targetX = targetRect.left + (targetRect.width / 2) - 10;
    let targetY = targetRect.top + (targetRect.height / 2) - 10;

    setTimeout(() => {
        flyingImg.style.left = targetX + 'px';
        flyingImg.style.top = targetY + 'px';
        flyingImg.style.width = '15px';
        flyingImg.style.height = '15px';
        flyingImg.style.opacity = '0.4';
        flyingImg.style.transform = 'rotate(360deg)';
    }, 20);

    setTimeout(() => {
        flyingImg.remove();
        cartNav.classList.add('cart-bounce');
        if(typeof tg !== 'undefined' && tg.HapticFeedback) tg.HapticFeedback.impactOccurred('medium');
        setTimeout(() => cartNav.classList.remove('cart-bounce'), 400);
    }, 700); 
};

// 🛡️ MODALNI XAVFSIZ OCHISH (Qotishlarga qarshi)
//   ⚠️ Bu funksiya ASOSIY (oxirgi declared) openModal — eskini yozib qo'yadi.
//   Modal stack: agar boshqa modal ochiq bo'lsa, uning ID si stack'ga saqlanadi
//   va u yashiriladi. Yangi modal yopilganда (popstate) eski qaytib ochiladi.
//   Bu 'savat -> kafolat -> orqa -> savat' qotishi muammosini hal qiladi.
window.openModal = function(id) { 
    if (activeModal === id) return; 

    if(id === 'cartModal') renderCartItems(); 

    let m = document.getElementById(id); 
    if(!m) return;

    // 🛒 Boshqa modal ochiq bo'lsa - xotirada saqlab, yashiramiz
    if (activeModal && activeModal !== id) {
        window._modalStack = window._modalStack || [];
        window._modalStack.push(activeModal);
        const prev = document.getElementById(activeModal);
        if (prev) prev.style.display = 'none';
    }

    m.style.display = 'flex'; 
    document.body.style.overflow = 'hidden'; 
    activeModal = id; 

    window.history.pushState({ modal: id }, ""); 
    if(typeof tg !== 'undefined' && tg.BackButton) tg.BackButton.show(); 
    updateBtns(); 
};
    // ===================================================
// 🌊 SUV TO'LQINI (RIPPLE EFFECT) JONLANTIRUVCHISI
// ===================================================
document.addEventListener('click', function(e) {
    // Qaysi tugmalarda to'lqin bo'lishini belgilaymiz
    let target = e.target.closest('.btn-checkout, .pm-sticky-btn, .btn-add-cart, .nav-item');
    if (!target) return;
    
    // To'lqin shaklini yaratamiz
    let circle = document.createElement('span');
    let diameter = Math.max(target.clientWidth, target.clientHeight);
    let radius = diameter / 2;
    
    // Barmoq tekkan aniq nuqtani (x, y) hisoblaymiz
    let rect = target.getBoundingClientRect();
    let x = e.clientX - rect.left;
    let y = e.clientY - rect.top;
    
    circle.style.width = circle.style.height = `${diameter}px`;
    circle.style.left = `${x - radius}px`;
    circle.style.top = `${y - radius}px`;
    circle.classList.add('ripple');
    
    // Eski to'lqinlarni tozalab, yangisini qo'shamiz
    let existing = target.querySelector('.ripple');
    if (existing) existing.remove();
    
    target.appendChild(circle);
    
    // Animatsiya tugagach, to'lqinni o'chiramiz
    setTimeout(() => circle.remove(), 600);
});

// Elementlarni BIR MARTA topib saqlaymiz
// Endi scroll bo'lganida qayta qidirish shart emas
const bottomNavEl = document.querySelector('.bottom-nav');
const aiBtnEl = document.querySelector('.ai-luxury-btn');

let lastScrollTop = 0;
let isScrolling = false;

window.addEventListener("scroll", function() {
    if (!isScrolling) {
        window.requestAnimationFrame(function() {
            let st = window.pageYOffset || document.documentElement.scrollTop;
            
            // Sahifa biroz pastga tushganda header kichrayadi
            if (st > 40) {
                document.body.classList.add("scrolled");
            } else {
                document.body.classList.remove("scrolled");
            }

            // Modal ochiq bo'lmasa menyuni yashiramiz/ko'rsatamiz
            if (!activeModal) {
                if (st > lastScrollTop && st > 50) {
                    // ⚠️ Menyu yashirinishi O'CHIRILDI (foydalanuvchi so'rovi):
                    // Menyu doim qotib turadi. Faqat AI tugma yashirinadi.
                    if(aiBtnEl) aiBtnEl.classList.add("ai-hidden");
                } else {
                    if(aiBtnEl) aiBtnEl.classList.remove("ai-hidden");
                }
            }
            
            lastScrollTop = st <= 0 ? 0 : st;
            isScrolling = false;
        });
        isScrolling = true;
    }
}, { passive: true }); // passive: true — scroll hech qachon to'xtamaydi

// ===================================================
// 🎉 BAYRAMONA XARID (CONFETTI YOMG'IRI)
// ===================================================
window.shootConfetti = () => {
    // Telefonni vibratsiya qildiramiz (Mijoz maza qiladi)
    if(typeof tg !== 'undefined' && tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
    
    // Tilla, ko'k, oq va yashil ranglar
    const colors = ['#D4AF37', '#007aff', '#ffffff', '#30d158', '#e5c07b']; 
    
    // 70 ta bayram qog'ozi yog'diramiz
    for (let i = 0; i < 70; i++) {
        let conf = document.createElement('div');
        conf.className = 'confetti-piece';
        
        // Ekranning har xil joyidan tushadi
        conf.style.left = Math.random() * 100 + 'vw';
        conf.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        
        // Ba'zilarini dumaloq, ba'zilarini uzun qog'oz qilamiz
        if (Math.random() > 0.5) { 
            conf.style.borderRadius = '50%'; 
            conf.style.width = '12px'; 
            conf.style.height = '12px'; 
        }
        
        // Tushish tezligi va boshlanish vaqti har xil
        conf.style.animationDuration = (Math.random() * 2 + 2) + 's';
        conf.style.animationDelay = (Math.random() * 0.3) + 's';
        
        document.body.appendChild(conf);
        
        // Animatsiya tugagach, tozalab tashlaymiz (Telefon qotmasligi uchun)
        setTimeout(() => conf.remove(), 4500);
    }
};
// 🔦 QIDIRUV SPOTLIGHT DVIJOGI
document.addEventListener('DOMContentLoaded', () => {
    let searchInput = document.getElementById('searchInput');
    if(searchInput) {
        searchInput.addEventListener('focus', () => {
            document.body.classList.add('search-focused');
        });
        searchInput.addEventListener('blur', () => {
            // Agar matn yozilmagan bo'lsa fon yana yorishadi
            if(searchInput.value.trim() === '') {
                document.body.classList.remove('search-focused');
            }
        });
    }
});

// Qidiruvdan chiqishda Spotlight'ni ham o'chiramiz
const originalExitSearch = window.exitSearch;
window.exitSearch = () => {
    document.body.classList.remove('search-focused');
    if(typeof originalExitSearch === 'function') originalExitSearch();
};
// 🔢 RAQAMLARNI SILLIQ HISOB-KITOB QILUVCHI MOTOR
window.animatePrice = (id, end) => {
    let obj = document.getElementById(id);
    if(!obj) return;
    
    // Hozirgi ekrandagi raqamni aniqlaymiz (so'm so'zini olib tashlab)
    let start = parseInt(obj.innerText.replace(/[^0-9]/g, '')) || 0;
    if(start === end) return; // Agar raqam o'zgarmagan bo'lsa, to'xtaymiz
    
    let duration = 800; // Animatsiya tezligi (800ms)
    let startTime = null;
    
    function step(timestamp) {
        if (!startTime) startTime = timestamp;
        let progress = Math.min((timestamp - startTime) / duration, 1);
        
        // Matematik hisob: boshlang'ich va oxirgi raqam orasidagi yo'l
        let current = Math.floor(progress * (end - start) + start);
        
        // Ekranga chiroyli qilib chiqaramiz
        obj.innerHTML = current.toLocaleString() + " so'm";
        
        if (progress < 1) {
            window.requestAnimationFrame(step);
        }
    }
    window.requestAnimationFrame(step);
};
const revealObserver = new IntersectionObserver((entries, observer) => {
    // 🎬 STAGGERED ENTRY: ayni vaqtda ko'ringan kartalar KETMA-KET (45ms oraliq)
    //    paydo bo'ladi. Animatsiyani CSS transition (reveal-item) beradi; biz faqat
    //    '.active' ni staggered VAQTDA qo'shamiz -> transition-delay ishlatilmaydi,
    //    shu sababli micro-interaction (press) kechikmaydi. lite/reduced-motion da
    //    darhol (oraliqsiz). Skrollda 1-2 ta kelganda oraliq ~0 -> sezilmaydi.
    var reduce = false, lite = false;
    try { reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch(e){}
    try { lite = document.documentElement.classList.contains('lite') || window.__perfLite; } catch(e){}
    var i = 0;
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            var el = entry.target;
            observer.unobserve(entry.target);
            if (reduce || lite) { el.classList.add('active'); return; }
            var delay = Math.min(i, 8) * 45;   // eng ko'pi 8 ta karta staggerlanadi
            i++;
            if (delay > 0) setTimeout(function(){ el.classList.add('active'); }, delay);
            else el.classList.add('active');
        }
    });
}, { 
    threshold: 0.05,
    rootMargin: '0px 0px -10px 0px'
});

function initReveal() {
    document.querySelectorAll('.luxury-card, .section-title, .neon-brand-card').forEach(el => {
        // Agar allaqachon ko'ringan bo'lsa — o'tkazib yuboramiz
        // Bu tepaga qaytganda rasmlar o'chib-yonishini to'xtatadi
        if (el.classList.contains('active')) return;
        if (el.classList.contains('reveal-item')) return;
        
        el.classList.add('reveal-item');
        revealObserver.observe(el);
    });
    // 🌊 Yangi render bo'lgan kartalar rasmlarini parallax kuzatuviga ulaymiz
    try { if (typeof window._scanParallax === 'function') window._scanParallax(); } catch(e){}
}

/* ====================================================================
   🌊 KARTA PARALLAX — mahsulot rasmlari skrollda yengil "suzadi".
   - FAQAT transform (GPU-friendly), rAF-throttle bilan; IntersectionObserver
     orqali FAQAT ekrandagi rasmlarga ishlaydi -> telefonni QIZDIRMAYDI.
   - lite rejim / reduced-motion / __perfLite bo'lsa BUTUNLAY o'chadi.
   - Reveal tizimiga TEGMAYDI: reveal kartaga (.luxury-card), parallax esa
     uning ichidagi RASMGA (.img-wrap img) ta'sir qiladi -> to'qnashmaydi.
   - img-wrap'da overflow:hidden + radial-mask bor -> qirralar ko'rinmaydi.
   ==================================================================== */
(function(){
    var reduce = false;
    try { reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch(e){}
    function disabled(){
        // 📱 Ilovada (Android ilova / iPhone bosh ekran ilovasi) parallax O'CHIQ:
        //    har skroll kadrida rasm o'lchamini o'qib, transform yozish butun
        //    sahifa uslubini qayta hisoblatardi (o'lchovda 400+ marta) — skroll
        //    va rasmlar ochilishidagi asosiy «tutilish» shu edi.
        try { return reduce || document.documentElement.classList.contains('lite') || window.__perfLite; }
        catch(e){ return true; }
    }

    var visible = new Set();
    var ticking = false;
    var AMP = 7;          // px — siljish amplitudasi (juda nozik, premium his)
    var io = null;

    function ensureObserver(){
        if (io) return io;
        io = new IntersectionObserver(function(entries){
            entries.forEach(function(en){
                var img = en.target;
                if (en.isIntersecting){
                    visible.add(img);
                    img.style.willChange = 'transform';
                } else {
                    visible.delete(img);
                    img.style.willChange = '';
                    img.style.transform = 'scale(1.08)';   // ko'rinishdan chiqdi -> baseline
                }
            });
            schedule();
        }, { threshold: 0 });
        return io;
    }

    function apply(){
        ticking = false;
        if (disabled()) return;
        var vh = window.innerHeight || document.documentElement.clientHeight || 1;
        var mid = vh / 2;
        visible.forEach(function(img){
            var r = img.getBoundingClientRect();
            var c = r.top + r.height / 2;
            var rel = (c - mid) / vh;                       // -1 (tepa) .. +1 (past)
            if (rel > 1) rel = 1; else if (rel < -1) rel = -1;
            var y = (rel * AMP).toFixed(2);
            img.style.transform = 'scale(1.08) translate3d(0,' + y + 'px,0)';
        });
    }
    function schedule(){
        if (ticking) return;
        ticking = true;
        window.requestAnimationFrame(apply);
    }

    function attach(){
        var c = document.querySelector('.container');     // asosiy skroll konteyneri
        if (c) c.addEventListener('scroll', schedule, { passive: true });
        window.addEventListener('scroll', schedule, { passive: true });
        window.addEventListener('resize', schedule, { passive: true });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', attach);
    else attach();

    // Render/loadMore'dan keyin initReveal ichidan chaqiriladi.
    window._scanParallax = function(){
        if (disabled()) return;
        var obs = ensureObserver();
        document.querySelectorAll('.luxury-card .img-wrap img:not(.ux-parallax)').forEach(function(img){
            img.classList.add('ux-parallax');
            obs.observe(img);
        });
        schedule();
    };
})();
// ===================================================
        // 📺 2. PREMIUM STORIS MOTOR (4K Video, Tap, Pause, Admin)
        // ===================================================
        let storyProgressAnimation;
        let currentPlaylist = [];
        let currentPlaylistId = '';
        let currentStoryIdx = 0;
        let isStoryPaused = false;
        let storyVideoElement = null;

 // ===================================================
        // ☁️ FIREBASE STORIES BAZASI VA MANTIQ (JONLI)
        // ===================================================
        let STORIES_DB = {};

        // Mijoz ko'rgan storislarni eslab qolish (qaytib kelganda kulrang turadi)
        // ⚠️ ESKIRGAN (deprecated): kategoriya bo'yicha bitta timestamp.
        //    Endi har bir storis alohida belgilanadi (avto_seen_story_items).
        //    Bu yozuv faqat BIR MARTALIK migratsiya uchun o'qiladi
        //    (window._applyOldSeenMigration) — yangi kod unga yozmaydi.
        let _seenStories = {};
        try { _seenStories = JSON.parse(localStorage.getItem('avto_seen_stories')) || {}; } catch(e) {}

        // ⚙️ Halqalarni Firebase ma'lumotiga qarab AVTOMAT markirlash
        // Mantiq:
        //  - Storis bor + ko'rilmagan -> 'new' (tilla aylanadi)
        //  - Storis bor + ko'rilgan    -> 'seen' (kulrang, aylanmaydi)
        //  - Storis yo'q              -> 'empty' (kulrang, aylanmaydi, ishlatib bo'lmaydi)
        // ⚠️ ILGARI "KO'RILGAN" MANTIG'I NOTO'G'RI EDI:
        //    faqat KATEGORIYA bo'yicha bitta timestamp saqlanardi
        //    (avto_seen_stories = {bugun: 171234...}). Halqani bosish bilanoq
        //    BUTUN kategoriya "ko'rilgan" bo'lib qolardi — mijoz 8 ta storisdan
        //    faqat 1-sini ko'rib chiqib ketsa ham halqa kulrangga aylanardi va
        //    qolgan 7 tasi "yangi" ekani BILINMASDI.
        //    Endi HAR BIR storis alohida belgilanadi va halqa SEGMENTLARGA
        //    bo'linadi (Instagram kabi): ko'rilmaganlari tilla, ko'rilganlari xira.
        function _refreshStoryRings() {
            const rings = document.querySelectorAll('.story-ring[data-story]');
            let visibleCount = 0;
            rings.forEach(ring => {
                const cat = ring.getAttribute('data-story');
                const items = STORIES_DB[cat];
                ring.classList.remove('new', 'seen', 'empty', 'segmented', 'has-new');
                ring.style.removeProperty('--ring-grad');
                // Halqaning ota-elementi (.story-item) — uni to'liq yashirish/ko'rsatish uchun
                const itemEl = ring.closest('.story-item');
                if (!items || items.length === 0) {
                    // ⚙️ QADAM 1: Storis yo'q -> butun halqa YASHIRINADI
                    // (avval 'empty' kulrang halqa turardi - mijozga "tashlab qo'yilgan sayt"
                    //  hissini berardi. Endi Aksiyalar/Aloqa kabilar yo'q bo'lsa, umuman
                    //  ko'rinmaydi - faqat haqiqiy kontent ko'rinadi.)
                    ring.classList.add('empty');
                    if (itemEl) itemEl.style.display = 'none';
                    return;
                }
                // Storis bor -> ko'rsatamiz
                if (itemEl) itemEl.style.display = '';
                visibleCount++;

                // 👁 Har bir storis ko'rilganmi — alohida hisoblaymiz.
                //    ⚠️ ILGARI: `_isStorySeen` fayl oxirida e'lon qilinadi. Firebase
                //    javobi undan OLDIN kelsa (sekin telefonda sahifa hali o'qilayotganda)
                //    zaxira `true` (ko'rilmagan) qaytarardi — ko'rilgan storislar halqasi
                //    QAYTA YONIB qolardi va keyingi yangilanishgacha shunday turardi.
                //    Endi zaxira ham xotiradagi belgilarni o'qiydi.
                const unseenFlags = items.map(it => {
                    try { return !(window._isStorySeen ? window._isStorySeen(cat, it) : _storySeenEarly(cat, it)); }
                    catch (e) { return true; }
                });
                const unseenCount = unseenFlags.filter(Boolean).length;

                // 🚫 RAQAMLI NISHONCHA OLIB TASHLANDI.
                //    Ilgari halqa ustida kichik tilla doiracha ichida "1" kabi
                //    son chiqardi (ko'rilmaganlar soni). U .story-item ning
                //    o'ng-yuqori burchagiga yopishib, rasmdan chetga chiqib
                //    turardi va xunuk ko'rinardi. Telegram/Instagram'da bunday
                //    son YO'Q — halqaning o'zi hammasini bildiradi.
                //    Eski elementlar DOM'da qolib ketmasligi uchun o'chiramiz.
                if (itemEl) {
                    const _oldBadge = itemEl.querySelector('.story-unseen-badge');
                    if (_oldBadge && _oldBadge.parentNode) _oldBadge.parentNode.removeChild(_oldBadge);
                }

                // 🔵 TELEGRAM USLUBI — YAGONA MANTIQ:
                //    • biror storis ko'rilmagan  -> segmentli TILLA halqa + yumshoq nur
                //      (har storis bitta yoy; ko'rilgani xira, ko'rilmagani tilla)
                //    • hammasi ko'rilgan         -> halqa BUTUNLAY O'CHADI
                //    Ilgari uch xil holat (new / segmented / seen) uch xil
                //    ko'rinishda edi: bittasi aylanardi, bittasi qotib turardi —
                //    izchillik yo'q edi. Endi bitta til.
                if (unseenCount === 0) {
                    ring.classList.add('seen');            // o'chgan holat
                } else {
                    ring.classList.add('segmented', 'has-new');
                    ring.style.setProperty('--ring-grad', _segmentGradient(unseenFlags));
                }
            });
            // Agar BIRORTA storis yo'q bo'lsa, butun storis qatori yashirinadi
            // (toza ko'rinish, "tashlab qo'yilgan" hissi yo'qoladi)
            const container = document.getElementById('stories-list');
            if (container) {
                container.style.display = visibleCount === 0 ? 'none' : '';
            }
        }
        // Tashqi qatlam (storis yopilganda halqalarni yangilash) uchun ochamiz
        window._refreshStoryRingsPublic = _refreshStoryRings;

        // 👁 Erta "ko'rilgan" tekshiruvi — asosiy qatlamlar yuklanguncha (xuddi
        //    o'sha kalitlar: eski `avto_seen_story_items` + yangi `a1_story_seen_v2`).
        function _storySeenEarly(cat, it) {
            if (!it) return false;
            let oldM = null, newM = null;
            try { oldM = JSON.parse(localStorage.getItem('avto_seen_story_items') || '{}') || {}; } catch (e) { oldM = {}; }
            try { newM = JSON.parse(localStorage.getItem('a1_story_seen_v2') || '{}') || {}; } catch (e) { newM = {}; }
            const legacy = String(it.id || it.story_id || it.src || ((cat || '-') + ':' + (it.timestamp || '')));
            const k = it._key != null ? it._key : it.id;
            const sid = k != null ? String(cat) + '__' + String(k) : '';
            return !!(oldM[legacy] || (sid && newM[sid]));
        }

        /**
         * Segmentli halqa uchun conic-gradient yasaydi.
         * Har storis bitta yoy; orasida kichik bo'shliq. Ko'rilmagan — tilla,
         * ko'rilgan — xira. Aylanish YO'Q (segmentlar joyida turishi kerak).
         */
        function _segmentGradient(unseenFlags) {
            const n = unseenFlags.length;
            const gap = n > 1 ? Math.min(6, 90 / n) : 0;   // daraja
            const seg = 360 / n;
            const GOLD = '#F0D060', GOLD2 = '#C9A84C', DIM = 'rgba(255,255,255,0.16)';
            let stops = [];
            for (let i = 0; i < n; i++) {
                const a1 = i * seg + gap / 2;
                const a2 = (i + 1) * seg - gap / 2;
                const col = unseenFlags[i] ? (i % 2 ? GOLD2 : GOLD) : DIM;
                if (gap > 0) stops.push('transparent ' + (i * seg) + 'deg ' + a1 + 'deg');
                stops.push(col + ' ' + a1 + 'deg ' + a2 + 'deg');
                if (gap > 0) stops.push('transparent ' + a2 + 'deg ' + ((i + 1) * seg) + 'deg');
            }
            return 'conic-gradient(from -90deg, ' + stops.join(', ') + ')';
        }

        // Dastur ishga tushganda storislarni Firebase'dan avtomat o'qiydi
        if (typeof db !== 'undefined') {
            db.ref('stories').on('value', (snap) => {
                STORIES_DB = {}; // Avval bazani tozalaymiz
                if (snap.exists()) {
                    let data = snap.val();
                    for (let cat in data) {
                        const node = data[cat];
                        if (!node || typeof node !== 'object') continue;
                        // Vaqt bo'yicha ketma-ket taxlash (eskilari oldin, yangilari keyin chiqadi).
                        // `_key` — Firebase kaliti: storisning BARQAROR identifikatori (sid =
                        // kategoriya + kalit). Ko'rilgan/ko'rishlar/javoblar shunga bog'lanadi.
                        // ⚠️ `timestamp` bazada MATN ham bo'lishi mumkin — son sifatida solishtiramiz.
                        STORIES_DB[cat] = Object.keys(node)
                            .map(k => (node[k] && typeof node[k] === 'object') ? Object.assign({}, node[k], { _key: k }) : null)
                            .filter(Boolean)
                            .sort((a, b) => (Number(a.timestamp) || 0) - (Number(b.timestamp) || 0));
                    }
                }
                // Eski (kategoriya bo'yicha) "ko'rilgan" belgilarini bir marta ko'chiramiz —
                // shunda yangilanishdan keyin hamma storis "yangi" bo'lib chiqmaydi
                try { if (window._applyOldSeenMigration) window._applyOldSeenMigration(STORIES_DB); } catch (e) {}
                // Halqalarni yangilash (Firebase javobiga qarab avtomat)
                _refreshStoryRings();
            });
        }

        // ============================================================
        // 📱 INSTAGRAM-DARAJA STORIES — tezlik + UX + sayqal
        // ============================================================
        // Yangi xususiyatlar:
        // ✅ Preload (keyingi storis fonда oldindan yuklanadi)
        // ✅ Buffering bar (pastda nozik tilla chiziq)
        // ✅ Cover poster (qora ekran o'rniga birinchi kadr)
        // ✅ Toza tilla spinner (eski 3 nuqta o'rniga)
        // ✅ Pause indikatori (bosib turganda ⏸)
        // ✅ Sound icon (🔊/🔇)
        // ✅ Swipe-down to close
        // ✅ Avtomat keyingi kategoriyaga o'tish
        // ✅ Tap zona aniq (chap 30%, o'ng 70%)
        // ============================================================

        // Kategoriyalar tartibi (avtomat o'tish uchun) — HTML buyrug'iga mos
        const STORY_CATEGORIES_ORDER = [
            'aksiyalar', 'bugun', 'mijozlar', 'dostavka',
            'kafolat', 'lokatsiya', 'tolov', 'aloqa'
        ];
        const STORY_CAPTIONS = {
            aksiyalar: 'Aksiyalar',
            bugun:     'Bugun',
            mijozlar:  'Mijozlar',
            dostavka:  'Yetkazib berish',
            kafolat:   'Kafolat',
            lokatsiya: 'Manzil',
            tolov:     'To\'lov',
            aloqa:     'Aloqa'
        };

        // playlistId → ikonka (emoji o'rniga story sarlavhasida ishlatiladi)
        const STORY_ICONS = {
            aksiyalar:'i-flame', bugun:'i-zap', mijozlar:'i-users', dostavka:'i-truck',
            kafolat:'i-shield', lokatsiya:'i-pin', tolov:'i-card', aloqa:'i-phone'
        };
        window.STORY_ICONS = STORY_ICONS;

        // ⏰ WATCHDOG — video/rasm javob bermasa storis abadiy qotib qolmasin
        let _storyWatchdogTimer = null;
        function _clearStoryWatchdog() {
            if (_storyWatchdogTimer) { clearTimeout(_storyWatchdogTimer); _storyWatchdogTimer = null; }
        }
        function _armStoryWatchdog(ms, fn) {
            _clearStoryWatchdog();
            const gen = _storyGen;
            _storyWatchdogTimer = setTimeout(() => {
                _storyWatchdogTimer = null;
                if (gen !== _storyGen) return;            // allaqachon boshqa storisga o'tilgan
                const viewer = document.getElementById('story-viewer');
                if (!viewer || viewer.style.display === 'none') return;
                try { fn(); } catch (e) {}
            }, ms);
        }

        // Preload va sound holatini saqlash
        let _preloadVideo = null;
        let _storySoundMuted = false;   // ✅ boshlanishidayoq OVOZLI (unmuted). Telegram WebApp foydalanuvchi ilovani o'zi ochgani uchun ovozli autoplay'ga ruxsat beradi; bloklansa _safePlay() avtomatik muted'ga qaytadi.
        let _storyTouchStartY = 0;
        let _storyTouchCurrentY = 0;
        let _storyIsSwiping = false;
        // Sekin internet — preload o'chiriladi
        let _saveData = false;
        try {
            if (navigator.connection && navigator.connection.saveData) _saveData = true;
        } catch (e) {}

        // ============================================================
        // 💬 STORIES REAKSIYA / JAVOB TIZIMI
        //   Mijoz emoji bossa yoki xabar yozsa -> bot (proxy) orqali adminga
        //   yetkaziladi: Mijoz profili + qaysi video + xabar/reaksiya.
        //   Admin xabardagi havolaga bosib, to'g'ridan-to'g'ri mijoz lichkasiga
        //   o'tib javob yoza oladi.
        // ============================================================
        function _svEscHtml(s){
            return String(s == null ? '' : s)
                .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
        }

        // ── 2) ANTI-SPAM: localStorage'da (story kaliti -> emoji) reaksiyalar ──
        //   Firebase rules foydalanuvchi yozuviga ruxsat bermagani uchun qurilma
        //   xotirasida saqlaymiz: har bir story uchun reaksiya FAQAT 1 marta botga
        //   ketadi; qayta bosilsa mahalliy yangilanadi (overwrite), bot qotmaydi.
        function _allStoryReactions(){
            try { return JSON.parse(localStorage.getItem('avto_story_reactions') || '{}'); }
            catch(e){ return {}; }
        }
        function _getStoryReaction(key){ const m = _allStoryReactions(); return m[key] || null; }
        function _setStoryReaction(key, emoji){
            try { const m = _allStoryReactions(); m[key] = emoji; localStorage.setItem('avto_story_reactions', JSON.stringify(m)); } catch(e){}
        }

        function _currentStoryItem(){
            return (currentPlaylist && currentPlaylist[currentStoryIdx]) ? currentPlaylist[currentStoryIdx] : null;
        }
        // Story'ning BARQAROR kaliti (dedup uchun): id/story_id -> src -> kat:timestamp
        function _currentStoryKey(){
            const item = _currentStoryItem();
            const cat = currentPlaylistId || '-';
            if (!item) return cat + ':' + currentStoryIdx;
            return String(item.id || item.story_id || item.src || (cat + ':' + (item.timestamp || currentStoryIdx)));
        }
        // 🔢 3) ICHKI RAQAM (FAQAT ADMIN UCHUN, mijozga ko'rinmaydi):
        //   "kategoriya tartibi . video tartibi"  (mas. 1.2 = 1-kategoriya, 2-video).
        //   Kategoriya tartibi — tepadagi halqalar (DOM) ko'rinish tartibi bo'yicha.
        function _currentVideoNumber(){
            let catIdx = 0;
            try {
                const ringEls = document.querySelectorAll('.story-item .story-ring[data-story]');
                const order = Array.from(ringEls).map(r => r.getAttribute('data-story'));
                const i = order.indexOf(currentPlaylistId);
                catIdx = (i >= 0) ? i : 0;
            } catch(e){}
            return (catIdx + 1) + '.' + (currentStoryIdx + 1);
        }
        // Reaksiya holatini joriy story'ga moslash: yurakcha tanlangan emojiga aylanadi,
        // popup ichidagi tanlangan variant belgilanadi.
        function _refreshStoryReactionUI(){
            try {
                const reacted = _getStoryReaction(_currentStoryKey());
                const heart = document.getElementById('sv-heart-btn');
                if (heart) { if (reacted || !window._svHeartIco) heart.textContent = reacted || '❤'; else heart.innerHTML = window._svHeartIco; heart.classList.toggle('sv-reacted', !!reacted); }
                document.querySelectorAll('#sv-react-popup .sv-react').forEach(b =>
                    b.classList.toggle('sv-react-active', !!reacted && b.getAttribute('data-emoji') === reacted));
            } catch(e){}
        }
        window._refreshStoryReactionUI = _refreshStoryReactionUI;

        // 🎈 Pop-up reaksiya menyusini ochish/yopish (yurakcha bosilganda)
        window.toggleReactionPopup = function (e) {
            if (e) e.stopPropagation();
            const pop = document.getElementById('sv-react-popup');
            const ov  = document.getElementById('sv-react-overlay');
            if (!pop) return;
            const willOpen = !pop.classList.contains('open');
            pop.classList.toggle('open', willOpen);
            if (ov) ov.classList.toggle('show', willOpen);
            try { if (willOpen && typeof tg !== 'undefined' && tg.HapticFeedback) tg.HapticFeedback.impactOccurred('light'); } catch(e2){}
        };
        window._closeReactionPopup = function (e) {
            if (e) e.stopPropagation();
            const pop = document.getElementById('sv-react-popup');
            const ov  = document.getElementById('sv-react-overlay');
            if (pop) pop.classList.remove('open');
            if (ov) ov.classList.remove('show');
        };

        // Input + panelni bir marta "simlash" (pauza/davom + Enter + has-text + tap-zona himoyasi)
        function _ensureReplyBar() {
            const bar = document.getElementById('sv-reply-bar');
            if (bar && !bar._svWired) {
                bar._svWired = true;
                ['click','mousedown','touchstart','touchend'].forEach(ev =>
                    bar.addEventListener(ev, (e) => e.stopPropagation()));
            }
            const inp = document.getElementById('sv-reply-input');
            if (!inp || inp._svWired) return;
            inp._svWired = true;
            inp.addEventListener('focus', () => { try { pauseStory(); } catch(e){} });  // yozayotganda story to'xtaydi
            inp.addEventListener('blur',  () => { try { resumeStory(); } catch(e){} });
            // Matn yozilsa -> yuborish tugmasi ko'rinadi, yurakcha yashirinadi (Telegram kabi)
            inp.addEventListener('input', () => {
                const wrap = document.getElementById('sv-reply-inputwrap');
                if (wrap) wrap.classList.toggle('has-text', inp.value.trim().length > 0);
            });
            inp.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') { e.preventDefault(); window.sendStoryReplyFromInput(); }
            });
        }

        window.sendStoryReplyFromInput = function () {
            const inp = document.getElementById('sv-reply-input');
            if (!inp) return;
            const txt = inp.value.trim();
            if (!txt) return;
            window.sendStoryReaction('message', txt);
            inp.value = '';
            const wrap = document.getElementById('sv-reply-inputwrap');
            if (wrap) wrap.classList.remove('has-text');
            try { inp.blur(); } catch(e){}
        };

        let _lastStoryMsgTs = 0;   // matn xabarlari uchun yengil cooldown (flood'ni oldini oladi)

        window.sendStoryReaction = function (actionType, content) {
            try {
                if (actionType === 'reaction') { try { window._closeReactionPopup(); } catch(e){} }  // tanlangach popup yopiladi
                const cat = currentPlaylistId || '-';
                const capEl = document.getElementById('story-caption');
                const caption = capEl ? (capEl.textContent || '').trim() : cat;
                const storyKey = _currentStoryKey();
                const videoNo = _currentVideoNumber();

                // ── ANTI-SPAM ──
                if (actionType === 'reaction') {
                    // Bu story'ga allaqachon reaksiya bildirilgan -> botga QAYTA yubormaymiz
                    const prev = _getStoryReaction(storyKey);
                    if (prev) {
                        _setStoryReaction(storyKey, content);   // mahalliy overwrite
                        _refreshStoryReactionUI();
                        try { if (typeof tg !== 'undefined' && tg.HapticFeedback) tg.HapticFeedback.impactOccurred('light'); } catch(e){}
                        if (typeof showToast === 'function') {
                            showToast(prev === content ? 'Siz allaqachon reaksiya bildirgansiz' : 'Reaksiyangiz yangilandi ✅', 'info');
                        }
                        return;   // 🛑 botga yangi xabar ketmaydi
                    }
                } else {
                    // Matn xabari — flood bo'lmasligi uchun yengil cooldown (8s)
                    const now = Date.now();
                    if (now - _lastStoryMsgTs < 8000) {
                        if (typeof showToast === 'function') showToast('Biroz kuting — oldingi xabaringiz yuborilyapti', 'warning');
                        return;
                    }
                    _lastStoryMsgTs = now;
                }

                // 👤 Foydalanuvchi (Telegram'dan)
                const tgUser = (typeof tg !== 'undefined' && tg.initDataUnsafe && tg.initDataUnsafe.user) ? tg.initDataUnsafe.user : null;
                let name = (typeof myProfile !== 'undefined' && myProfile && myProfile.name) ? myProfile.name
                            : (tgUser ? ((tgUser.first_name || '') + (tgUser.last_name ? ' ' + tgUser.last_name : '')).trim() : '');
                if (!name) name = 'Mijoz';
                const uname = (tgUser && tgUser.username) ? tgUser.username : '';
                const uid = (typeof window.currentUser !== 'undefined' && window.currentUser) ? window.currentUser : (tgUser ? tgUser.id : '');
                // Profil havolasi: username bo'lsa t.me, aks holda tg://user (admin bosib lichkaga o'tadi)
                const profileLink = uname ? ('https://t.me/' + uname) : ('tg://user?id=' + uid);
                const unamePart = uname ? ('@' + _svEscHtml(uname)) : ('ID: <code>' + _svEscHtml(uid) + '</code>');

                let contentDisplay = _svEscHtml(content);
                if (actionType === 'reaction' && content === '❓') {
                    contentDisplay = '❓ <i>(narx / ma\'lumot so\'rayapti)</i>';
                }
                const contentLabel = (actionType === 'reaction') ? 'Emoji' : 'Xabar';

                // 🤖 4) ADMINGA TAYYOR FORMAT
                const text =
                    '🔔 <b>Stories — Yangi xabar/reaksiya keldi!</b>\n\n' +
                    '👤 Mijoz: <a href="' + profileLink + '">' + _svEscHtml(name) + '</a> (' + unamePart + ')\n' +
                    '🎬 Kategoriya: ' + _svEscHtml(caption) + '\n' +
                    '🔢 Video tartib raqami: <b>' + videoNo + '</b>\n' +
                    '💬 ' + contentLabel + ': ' + contentDisplay;

                tgProxySend({ chat_id: ADMIN_ID, text: text, parse_mode: 'HTML', disable_web_page_preview: true });

                // Reaksiya bo'lsa — mahalliy belgilaymiz (shu story'ga qayta yuborilmasin)
                if (actionType === 'reaction') {
                    _setStoryReaction(storyKey, content);
                    _refreshStoryReactionUI();
                }

                try { if (typeof tg !== 'undefined' && tg.HapticFeedback) tg.HapticFeedback.impactOccurred('light'); } catch(e){}
                if (typeof showToast === 'function') {
                    showToast((actionType === 'reaction') ? 'Reaksiya yuborildi ✅' : 'Xabaringiz yuborildi ✅', 'success');
                }
            } catch (e) {
                if (typeof showToast === 'function') showToast('Yuborishda xatolik, qayta urinib ko\'ring', 'warning');
            }
        };

        window.startStories = (playlistId, caption) => {
            currentPlaylistId = playlistId;
            currentPlaylist = STORIES_DB[playlistId];

            if (!currentPlaylist || currentPlaylist.length === 0) {
                showToast("Hali yangiliklar yo'q!", "warning"); return;
            }

            // Bosilgan halqani avtomat 'seen' qilib markirlash (timestamp saqlanadi)
            try {
                const itemEl = document.querySelector('.story-item .story-ring[data-story="' + playlistId + '"]');
                if (itemEl && itemEl.parentElement) markAsSeen(itemEl.parentElement);
            } catch (e) {}

            currentStoryIdx = 0;
            document.getElementById('story-caption').innerHTML =
                (window.STORY_ICONS && STORY_ICONS[playlistId]
                    ? '<svg class="uic" aria-hidden="true"><use href="#' + STORY_ICONS[playlistId] + '"></use></svg> '
                    : '') + caption;
            const viewer = document.getElementById('story-viewer');
            viewer.style.display = 'flex';
            viewer.classList.remove('closing-down', 'swiping');
            viewer.style.transform = '';
            viewer.style.opacity = '';
            document.body.style.overflow = 'hidden';
            // ✨ OCHILISH ANIMATSIYASI.
            //    ⚠️ ILGARI: `instaZoom` animatsiyasi to'g'ridan #story-viewer
            //    ELEMENTIGA bog'langan edi — u sahifa yuklanganda, oyna hali
            //    display:none holatida BIR MARTA o'ynab tugardi. Ya'ni haqiqiy
            //    ochilish animatsiyasi UMUMAN yo'q edi (oyna shartta paydo bo'lardi).
            //    Endi klass qo'shiladi va reflow majburlanadi — har ochilishda o'ynaydi.
            viewer.classList.remove('sv-opening');
            void viewer.offsetWidth;
            viewer.classList.add('sv-opening');
            setTimeout(() => { try { viewer.classList.remove('sv-opening'); } catch (e) {} }, 460);

            // Admin uchun o'chirish tugmasi
            let delBtn = document.getElementById('admin-story-delete-btn');
            if (typeof window.isAdmin === 'function' ? window.isAdmin() : (typeof currentUser !== 'undefined' && typeof ADMIN_IDS !== 'undefined' && ADMIN_IDS.includes(currentUser))) {
                delBtn.style.display = 'flex';
            } else {
                delBtn.style.display = 'none';
            }

            // Swipe-down va sound tugmalarini biriktirish (faqat 1 marta)
            _attachSwipeDownClose();
            _ensureSoundButton();
            _ensureReplyBar();   // 💬 javob/reaksiya panelini biriktirish

            if (typeof tg !== 'undefined' && tg.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
            playCurrentStory();
        };

        window.playCurrentStory = () => {
            if (currentStoryIdx >= currentPlaylist.length) {
                _goToNextCategory();   // joriy kategoriya tugadi -> keyingisiga o'tamiz
                return;
            }
            if (currentStoryIdx < 0) currentStoryIdx = 0;

            const item = currentPlaylist[currentStoryIdx];
            // 🔗 Tashqi qatlam (caption / "Batafsil" tugmasi) joriy storisni bilishi uchun.
            //    currentPlaylist lokal o'zgaruvchi bo'lgani sababli faqat shu yerda ochamiz.
            window._st2CurrentStoryItem = item;
            window._st2CurrentStoryCat = currentPlaylistId;
            const content = document.getElementById('story-content');
            const progressContainer = document.getElementById('story-progress-container');

            // Tepadagi progress chiziqlari
            progressContainer.innerHTML = currentPlaylist.map((_, i) => `
                <div class="story-progress-bg">
                    <div class="story-progress-fill" style="width: ${i < currentStoryIdx ? '100%' : '0%'}"></div>
                </div>
            `).join('');
            // ⚠️ ILGARI: children[currentStoryIdx] mavjudligi tekshirilmasdi.
            //    currentPlaylist Firebase yangilanishi bilan eskirsa (yoki admin
            //    storisni o'chirsa) bu qator XATO tashlab, playCurrentStory
            //    o'rtada uzilardi — natijada body overflow:hidden qolib, oyna
            //    oldingi kadrda MUZLAB qolardi (orqa sahifa ham qulflangan).
            const _fillHost = progressContainer.children[currentStoryIdx];
            const currentFill = _fillHost ? _fillHost.querySelector('.story-progress-fill') : null;
            _killProgress();                 // eski tsikllarni o'chiramiz
            _clearStoryWatchdog();           // eski kutish taymerini o'chiramiz
            // 👁 Ko'rilgan deb belgilaymiz (har bir storis alohida)
            try { if (window._markStorySeen) window._markStorySeen(currentPlaylistId, item); } catch (e) {}

            // Eski videoni xavfsiz to'xtatamiz (xotira oqishini oldini olamiz)
            if (storyVideoElement) {
                try {
                    storyVideoElement.pause();
                    storyVideoElement.removeAttribute('src');
                    storyVideoElement.load();
                } catch (e) {}
                storyVideoElement = null;
            }

            // Sound tugmasini yashiramiz (faqat video uchun yoqamiz)
            const soundBtn = document.getElementById('sv-sound-btn');
            if (soundBtn) soundBtn.style.display = 'none';

            // ============================================================
            // VIDEO STORIS
            // ============================================================
            if (item.type === 'video') {
                // poster (cover) — agar item.poster bo'lsa shu, aks holda bo'sh (qora)
                // 🔐 XSS: URL HTML ATRIBUTI ichiga qo'yiladi — escape qilinmasa
                //    ichidagi qo'shtirnoq atributdan "chiqib ketib" (onerror=...)
                //    kod ishga tushirishi mumkin edi.
                const poster = item.poster ? `poster="${escHtml(item.poster)}"` : '';

                content.innerHTML = `
                    <div id="sv-loader" style="position:absolute; z-index:2; display:flex; flex-direction:column; align-items:center;">
                        <div class="sv-spinner"></div>
                    </div>
                    <video id="stVideo" class="stv-loading" ${poster} playsinline webkit-playsinline
                           preload="auto" autoplay disablepictureinpicture
                           ${_storySoundMuted ? 'muted' : ''}
                           src="${escHtml(item.src)}"
                           style="width:100%;height:100%;object-fit:contain;background:#000;">
                    </video>
                    <div class="sv-buffer-bar" id="sv-buffer-bar"><div></div></div>
                    <div class="sv-pause-indicator" id="sv-pause-indicator"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1.4"/><rect x="14" y="5" width="4" height="14" rx="1.4"/></svg></div>
                `;

                storyVideoElement = document.getElementById('stVideo');
                const loader = document.getElementById('sv-loader');
                const bufferBar = document.getElementById('sv-buffer-bar');
                const bufferFill = bufferBar ? bufferBar.firstElementChild : null;

                // 🛡️ AUTOPLAY KAFOLATI: agar autoplay atributi bloklansa
                // (sound on holatida brauzer ba'zan bloklaydi), qo'lda
                // play() chaqiramiz; agar u ham bloklansa - mute qilib urinamiz
                const _safePlay = () => {
                    if (!storyVideoElement) return;
                    const p = storyVideoElement.play();
                    if (p && typeof p.catch === 'function') {
                        p.catch(() => {
                            try {
                                storyVideoElement.muted = true;
                                _storySoundMuted = true;
                                const sb = document.getElementById('sv-sound-btn');
                                if (sb) sb.innerHTML = window._svSoundIco ? window._svSoundIco(true) : '🔇';
                                storyVideoElement.play().catch(() => {});
                            } catch (e) {}
                        });
                    }
                };

                // Sound tugmasini ko'rsatamiz va holatga moslashtiramiz
                if (soundBtn) {
                    soundBtn.style.display = 'flex';
                    soundBtn.innerHTML = window._svSoundIco ? window._svSoundIco(_storySoundMuted) : (_storySoundMuted ? '🔇' : '🔊');
                }

                // Yuklanish boshlanmaguncha buffering bar ko'rinadi
                if (bufferBar) bufferBar.classList.add('show');

                // ⏰ WATCHDOG — eng muhim qotishga qarshi himoya.
                //    ⚠️ ILGARI: agar 'loadedmetadata' HECH QACHON kelmasa (o'lik
                //    havola, CDN javob bermayapti, Telegram WebView range-so'rovni
                //    bloklagan, internet uzilgan) — progress umuman boshlanmasdi,
                //    'ended' ham, 'error' ham kelmasdi. Ekranda spinner ABADIY
                //    aylanib turardi va chiqishning yagona yo'li ✕ edi.
                //    Endi 11 soniyada javob bo'lmasa — o'zi keyingisiga o'tadi.
                _armStoryWatchdog(11000, () => {
                    showToast("Video yuklanmadi — keyingisiga o'tdik", 'warning');
                    nextStory();
                });

                // Progress event — yuklanish foizini yangilaymiz
                storyVideoElement.addEventListener('progress', () => {
                    try {
                        if (storyVideoElement.buffered.length > 0 && storyVideoElement.duration) {
                            const buffered = storyVideoElement.buffered.end(storyVideoElement.buffered.length - 1);
                            const pct = Math.min(100, (buffered / storyVideoElement.duration) * 100);
                            if (bufferFill) bufferFill.style.width = pct + '%';
                        }
                    } catch (e) {}
                });

                // ⚡ TEZLIK: `canplay` ni kutmasdan, ILK KADR tayyor bo'lishi
                //    bilan (loadeddata) blurni olib tashlab, o'ynatishni
                //    boshlaymiz. Ilgari faqat `canplay` kutilardi — u ancha
                //    ko'proq bufer to'planishini talab qiladi, shuning uchun
                //    mijoz qora/xira ekranga bekorga qarab turardi.
                storyVideoElement.addEventListener('loadeddata', () => {
                    if (loader) loader.style.display = 'none';
                    if (storyVideoElement) storyVideoElement.classList.remove('stv-loading');
                    if (storyVideoElement && storyVideoElement.paused) _safePlay();
                }, { once: true });

                // Yetarli yuklanganда — loader ketadi, video boshlanadi
                storyVideoElement.addEventListener('canplay', () => {
                    if (loader) loader.style.display = 'none';
                    // 🌫️ Blur'ni olib tashlaymiz — video tayyor
                    if (storyVideoElement) storyVideoElement.classList.remove('stv-loading');
                    // 🛡️ Backup: agar autoplay atributi qandaydir sababdan
                    // ishlamagan bo'lsa, qo'lda boshlaymiz
                    if (storyVideoElement.paused) _safePlay();
                }, { once: true });

                storyVideoElement.addEventListener('loadedmetadata', () => {
                    _clearStoryWatchdog();               // javob keldi — kutish taymeri kerak emas
                    const _d = storyVideoElement.duration;
                    const _ms = (isFinite(_d) && _d > 0) ? _d * 1000 : 15000;  // duration NaN/Infinity bo'lsa zaxira
                    animateStoryProgress(currentFill, _ms, true);   // ✅ progress video vaqtidan olinadi
                    // Yana bir kafolat: ba'zan canplay'dan oldin loadedmetadata keladi
                    if (storyVideoElement.paused) _safePlay();
                }, { once: true });

                // Sekin internet — "waiting" / "stalled" da loader qaytadi
                //
                // ⚠️ QOTISHNING QOLGAN SABABI (endi tuzatildi): progress chizig'i
                //    video.currentTime dan olinadi. Bu bufferlanishda TO'G'RI ishlaydi
                //    (chiziq ham to'xtaydi), LEKIN video o'rtada butunlay muzlab
                //    qolsa (CDN javob bermadi, internet uzildi) currentTime hech
                //    qachon o'zgarmaydi -> chiziq ham, storis ham ABADIY turadi.
                //    Boshlanish uchun watchdog bor edi, O'YNASH paytida esa YO'Q edi.
                //    Endi 12 soniya harakatsizlikda o'zi keyingisiga o'tadi.
                const _armStallSkip = () => {
                    _armStoryWatchdog(12000, () => {
                        // Mijoz ataylab bosib turib PAUZA qilgan bo'lsa — o'tmaymiz
                        if (isStoryPaused) { _armStallSkip(); return; }
                        showToast("Video to'xtab qoldi — keyingisiga o'tdik", 'warning');
                        nextStory();
                    });
                };
                storyVideoElement.addEventListener('waiting', () => {
                    if (loader) loader.style.display = 'flex';
                    // 🌫️ Bufferlanayotganda blur'ni qaytaramiz
                    if (storyVideoElement) storyVideoElement.classList.add('stv-loading');
                    _armStallSkip();
                });
                storyVideoElement.addEventListener('stalled', _armStallSkip);
                storyVideoElement.addEventListener('playing', () => {
                    _clearStoryWatchdog();      // harakat bor — nazoratchi kerak emas
                    if (loader) loader.style.display = 'none';
                    // 🌫️ O'ynay boshladi — blur ketadi (tiniq video)
                    if (storyVideoElement) storyVideoElement.classList.remove('stv-loading');
                    if (bufferBar) {
                        // 1.2s dan keyin buffering barni yashiramiz (chalg'itmasin)
                        setTimeout(() => { bufferBar.classList.remove('show'); }, 1200);
                    }
                });

                storyVideoElement.addEventListener('ended', () => { nextStory(); });

                // Xato bo'lsa — keyingi storisga o'tamiz (qotib qolmasin).
                // ⚠️ ILGARI: bu handler faqat kutib turardi — progress tsiklini
                //    to'xtatmasdi, spinnerni yashirmasdi, blurni olib tashlamasdi.
                //    Natijada 600ms davomida xira, aylanuvchi "o'lik" ekran turardi.
                storyVideoElement.addEventListener('error', () => {
                    _clearStoryWatchdog();
                    _killProgress();
                    if (loader) loader.style.display = 'none';
                    if (bufferBar) bufferBar.classList.remove('show');
                    try { if (storyVideoElement) storyVideoElement.classList.remove('stv-loading'); } catch (e) {}
                    showToast("Video yuklanmadi", "warning");
                    setTimeout(() => nextStory(), 450);
                });

            // ============================================================
            // RASM STORIS
            // ============================================================
            } else {
                // ⚠️ ILGARI: progress rasm yuklanishini KUTMASDAN darhol boshlanardi.
                //    Rasm ochilmasa (onerror faqat opacity'ni pasaytirardi) mijoz
                //    5 soniya BO'SH ekranga qarab turardi. Endi rasm tayyor bo'lgach
                //    boshlanadi, yuklanayotganda esa chiroyli skeleton ko'rinadi.
                content.innerHTML = `
                    <div id="sv-loader" class="sv-loader" style="position:absolute; z-index:2; display:flex; flex-direction:column; align-items:center; gap:14px;">
                        <div class="sv-spinner"></div>
                    </div>
                    <img id="stImg" class="stv-loading" src="${escHtml(item.src)}" style="width:100%;height:100%;object-fit:contain;background:#000;">
                    <div class="sv-pause-indicator" id="sv-pause-indicator"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1.4"/><rect x="14" y="5" width="4" height="14" rx="1.4"/></svg></div>
                `;
                const _img = document.getElementById('stImg');
                const _imgLoader = document.getElementById('sv-loader');
                const _startImg = () => {
                    _clearStoryWatchdog();
                    if (_imgLoader) _imgLoader.style.display = 'none';
                    if (_img) _img.classList.remove('stv-loading');
                    animateStoryProgress(currentFill, 5000, false);
                };
                if (_img && _img.complete && _img.naturalWidth > 0) {
                    _startImg();                     // kesh — darhol
                } else if (_img) {
                    _img.onload = _startImg;
                    _img.onerror = () => {
                        _clearStoryWatchdog();
                        if (_imgLoader) _imgLoader.style.display = 'none';
                        showToast("Rasm yuklanmadi", "warning");
                        setTimeout(() => nextStory(), 450);
                    };
                    // Rasm ham cheksiz kutib qolmasin
                    _armStoryWatchdog(9000, _startImg);
                } else {
                    _startImg();
                }
            }

            // ⏸ BOSIB TURGANDA PAUZA + ⏯ pause indikatorini ko'rsatamiz
            content.onmousedown  = _onPressDown;
            content.onmouseup    = _onPressUp;
            content.onmouseleave = _onPressUp;     // sichqoncha chiqib ketsa ham qaytaradi
            content.ontouchstart = _onPressDown;
            content.ontouchend   = _onPressUp;
            content.ontouchcancel = _onPressUp;

            // 🚀 PRELOAD: keyingi storisni fonда yuklab qo'yamiz
            _preloadNextStory();

            // 💬 Reaksiya tugmalari holatini shu story uchun yangilash (1 marta qoidasi)
            try { _refreshStoryReactionUI(); if (window._closeReactionPopup) window._closeReactionPopup(); } catch(e){}
        };

        function _onPressDown(e) {
            // Swipe-down davomida pause qilmaymiz (yuqorida swipe handler ishlaydi)
            if (_storyIsSwiping) return;
            pauseStory();
            const ind = document.getElementById('sv-pause-indicator');
            if (ind) ind.classList.add('show');
        }
        function _onPressUp() {
            resumeStory();
            const ind = document.getElementById('sv-pause-indicator');
            if (ind) ind.classList.remove('show');
        }

        // 🚀 PRELOAD — keyingi 1 ta videoni fonда yuklash (saveData rejimda o'chadi)
        function _preloadNextStory() {
            if (_saveData) return;            // sekin internet — preload yo'q
            if (!currentPlaylist) return;
            const nextItem = currentPlaylist[currentStoryIdx + 1];
            if (!nextItem || nextItem.type !== 'video' || !nextItem.src) {
                if (_preloadVideo) _preloadVideo.removeAttribute('src');
                return;
            }
            try {
                if (!_preloadVideo) {
                    _preloadVideo = document.createElement('video');
                    _preloadVideo.style.display = 'none';
                    _preloadVideo.preload = 'auto';
                    _preloadVideo.muted = true;
                    _preloadVideo.playsInline = true;
                    document.body.appendChild(_preloadVideo);
                }
                if (_preloadVideo.src !== nextItem.src) {
                    _preloadVideo.src = nextItem.src;
                    _preloadVideo.load();
                }
            } catch (e) {}
        }

        // 🔊/🔇 Sound tugmasini bir marta yaratish
        function _ensureSoundButton() {
            if (document.getElementById('sv-sound-btn')) return;
            const viewer = document.getElementById('story-viewer');
            const btn = document.createElement('div');
            btn.id = 'sv-sound-btn';
            btn.className = 'sv-sound-btn';
            // ⚠️ ILGARI: har doim '🔇' yozilardi, holat esa OVOZLI (_storySoundMuted=false).
            //    Ya'ni ovoz yoniq bo'lsa ham tugma "ovoz o'chirilgan" deb ko'rsatardi.
            btn.innerHTML = window._svSoundIco ? window._svSoundIco(_storySoundMuted) : (_storySoundMuted ? '🔇' : '🔊');
            btn.onclick = (e) => {
                e.stopPropagation();
                _storySoundMuted = !_storySoundMuted;
                btn.innerHTML = window._svSoundIco ? window._svSoundIco(_storySoundMuted) : (_storySoundMuted ? '🔇' : '🔊');
                if (storyVideoElement) {
                    storyVideoElement.muted = _storySoundMuted;
                    if (!_storySoundMuted) {
                        // Brauzer ba'zan ovoz uchun ruxsatni qaytaradi
                        try { storyVideoElement.play(); } catch (er) {}
                    }
                }
            };
            viewer.appendChild(btn);
        }

        // 👇 SWIPE-DOWN TO CLOSE (Instagram qoidasi)
        let _swipeAttached = false;
        function _attachSwipeDownClose() {
            if (_swipeAttached) return;
            _swipeAttached = true;
            const viewer = document.getElementById('story-viewer');

            viewer.addEventListener('touchstart', (e) => {
                if (e.touches.length !== 1) return;
                _storyTouchStartY = e.touches[0].clientY;
                _storyTouchCurrentY = _storyTouchStartY;
                _storyIsSwiping = false;
            }, { passive: true });

            viewer.addEventListener('touchmove', (e) => {
                if (e.touches.length !== 1) return;
                _storyTouchCurrentY = e.touches[0].clientY;
                const dy = _storyTouchCurrentY - _storyTouchStartY;
                // Faqat PASTGA yoki YUQORIGA sezilarli sursa swipe deb hisoblaymiz
                if (Math.abs(dy) > 12 && !_storyIsSwiping) {
                    _storyIsSwiping = true;
                    viewer.classList.add('swiping');
                    pauseStory();
                }
                if (_storyIsSwiping) {
                    // Faqat pastga sirpanishni ko'rsatamiz, yuqoriga — kichikroq
                    const moveY = dy > 0 ? dy : dy * 0.3;
                    viewer.style.transform = `translateY(${moveY}px)`;
                    viewer.style.opacity = String(Math.max(0.4, 1 - Math.abs(dy) / 600));
                }
            }, { passive: true });

            viewer.addEventListener('touchend', () => {
                if (!_storyIsSwiping) return;
                const dy = _storyTouchCurrentY - _storyTouchStartY;
                viewer.classList.remove('swiping');
                if (dy > 110) {
                    // Yetarli pastga surildi -> yopamiz
                    viewer.classList.add('closing-down');
                    setTimeout(() => closeStoryViewer(), 240);
                } else {
                    // Qaytib joyiga keladi
                    viewer.style.transform = '';
                    viewer.style.opacity = '';
                    resumeStory();
                }
                _storyIsSwiping = false;
            });
        }

        // ⏭ Joriy kategoriya tugagach — keyingi kategoriyaga avtomat o'tish
        function _goToNextCategory() {
            const currentIdx = STORY_CATEGORIES_ORDER.indexOf(currentPlaylistId);
            for (let i = currentIdx + 1; i < STORY_CATEGORIES_ORDER.length; i++) {
                const nextCat = STORY_CATEGORIES_ORDER[i];
                if (STORIES_DB[nextCat] && STORIES_DB[nextCat].length > 0) {
                    // ⚠️ ILGARI: keyingi kategoriya halqasi shu yerda darhol
                    //    "ko'rilgan" qilib bo'yalardi — hali bitta storisi ham
                    //    ko'rilmasdan. Endi belgilash faqat haqiqatda ko'rganda.
                    startStories(nextCat, STORY_CAPTIONS[nextCat] || nextCat);
                    return;
                }
            }
            // Boshqa kategoriya yo'q — yopamiz
            closeStoryViewer();
        }

        // ⏭ KEYINGI VA ⏮ OLDINGI
        // ⚠️ ILGARI: nextStory() to'rt xil joydan chaqirilardi ('ended', 'error'
        //    + 600ms, progress tsikli, o'ng tap zonasi) va hech qanday himoya
        //    yo'q edi — natijada currentStoryIdx BIRDAN IKKITA oshib ketishi,
        //    yoki xato bilan tugash ustma-ust tushib storis tashlab ketilishi
        //    mumkin edi. Endi qisqa "advancing" qulfi bor.
        window.nextStory = (e) => {
            if (e) e.stopPropagation();
            if (_advancing) return;
            _advancing = true;
            setTimeout(() => { _advancing = false; }, 180);
            _killProgress();
            currentStoryIdx++;
            playCurrentStory();
        };
        window.prevStory = (e) => {
            if (e) e.stopPropagation();
            if (_advancing) return;
            _advancing = true;
            setTimeout(() => { _advancing = false; }, 180);
            _killProgress();
            currentStoryIdx--;
            playCurrentStory();
        };

        window.closeStoryViewer = () => {
            const viewer = document.getElementById('story-viewer');
            viewer.style.display = 'none';
            viewer.classList.remove('closing-down', 'swiping', 'sv-opening');
            viewer.style.transform = '';
            viewer.style.opacity = '';
            document.getElementById('story-content').innerHTML = '';
            document.body.style.overflow = '';
            _killProgress();
            _clearStoryWatchdog();
            _advancing = false;
            if (storyVideoElement) {
                try {
                    storyVideoElement.pause();
                    storyVideoElement.removeAttribute('src');
                    storyVideoElement.load();
                } catch (e) {}
                storyVideoElement = null;
            }
            // ⚠️ ILGARI: yashirin preload <video> body'ga qo'shilib, HECH QACHON
            //    olib tashlanmasdi — faqat src tozalanardi. Element sessiya davomida
            //    to'planib, sekin internetda ko'rinadigan video bilan tarmoq uchun
            //    raqobatlashib, uni "ochlikda" qoldirardi (aynan qotishga sabab).
            if (_preloadVideo) {
                try {
                    _preloadVideo.removeAttribute('src');
                    _preloadVideo.load();
                    if (_preloadVideo.parentNode) _preloadVideo.parentNode.removeChild(_preloadVideo);
                } catch (e) {}
                _preloadVideo = null;
            }
            try { if (window._refreshStoryRingsPublic) window._refreshStoryRingsPublic(); } catch (e) {}
        };

        // ============================================================
        // ⏱ PROGRESS BAR — QAYTA YOZILDI (QOTISHLARNING ASOSIY SABABI)
        // ------------------------------------------------------------
        // ⚠️ ILGARI QANDAY QOTIB QOLARDI:
        //  1) VIDEO uchun "o'lik tugash": percent >= 100 bo'lganda kod chiziqni
        //     100% qilib qo'yib, requestAnimationFrame'ni QAYTA NAVBATGA
        //     QO'YMASDAN va nextStory() ni CHAQIRMASDAN chiqib ketardi.
        //     Keyingi storisga o'tish FAQAT video 'ended' hodisasiga bog'liq edi.
        //     'ended' kelmasa (fayl chala, oxirgi sekundda stall, duration = NaN/
        //     Infinity) — ekran to'la chiziq bilan MUZLAB qolardi.
        //  2) Vaqt DEVOR SOATI (Date.now) bo'yicha sanalardi. Video bufferlanayotganda
        //     ham chiziq yugurib ketardi: video to'xtab turadi, chiziq esa tugaydi ->
        //     "tugagan chiziq + muzlagan kadr". 'waiting' hodisasi isStoryPaused
        //     ni umuman o'rnatmasdi.
        //  3) storyProgressAnimation YAGONA global handle edi. Ikki tsikl birdan
        //     tirik bo'lsa (kechikkan loadedmetadata, kategoriya almashuvi) faqat
        //     oxirgisi bekor qilinardi; "yetim" tsikl esa o'chirilgan elementga
        //     yozib, nextStory() ni chaqirib turardi -> sakrash/miltillash.
        //
        // ENDI:
        //  • VIDEO progressi video.currentTime dan olinadi -> bufferlanish
        //    avtomatik hisobga olinadi, desinxron YO'Q;
        //  • video tugaganda ham nextStory() chaqiriladi (ended'ga tayanmaydi);
        //  • har bir storis uchun "avlod" (generation) tokeni — eski tsikllar
        //    o'zini darhol to'xtatadi;
        //  • rasm uchun ham xuddi shu tsikl, lekin devor soati bo'yicha.
        // ============================================================
        let storyDuration = 0;
        let storyPassedTime = 0;
        let _storyGen = 0;          // har yangi storis -> +1 (eski tsikllarni o'chiradi)
        let _advancing = false;     // ikki marta o'tib ketishdan himoya

        /** Joriy storis tsiklini bekor qiladi. */
        function _killProgress() {
            _storyGen++;
            try { cancelAnimationFrame(storyProgressAnimation); } catch (e) {}
        }

        /**
         * @param fill      progress chizig'i elementi
         * @param ms        davomiylik (rasm uchun; video uchun zaxira qiymat)
         * @param useVideo  true bo'lsa progress video.currentTime dan olinadi
         */
        function animateStoryProgress(fill, ms, useVideo) {
            const gen = ++_storyGen;          // shu tsiklning avlodi
            storyDuration = ms;
            storyPassedTime = 0;
            isStoryPaused = false;
            let lastTime = Date.now();

            function step() {
                if (gen !== _storyGen) return;            // eskirgan tsikl — o'zini to'xtatadi
                const vid = storyVideoElement;

                if (isStoryPaused) {
                    lastTime = Date.now();
                    storyProgressAnimation = requestAnimationFrame(step);
                    return;
                }

                let percent;
                if (useVideo && vid) {
                    // 🎬 Haqiqiy o'ynash vaqti — bufferlanish o'zi hisobga olinadi
                    const dur = (isFinite(vid.duration) && vid.duration > 0) ? vid.duration : (ms / 1000);
                    percent = dur > 0 ? (vid.currentTime / dur) * 100 : 0;
                } else {
                    const now = Date.now();
                    storyPassedTime += (now - lastTime);
                    lastTime = now;
                    percent = storyDuration > 0 ? (storyPassedTime / storyDuration) * 100 : 100;
                }

                if (!isFinite(percent) || percent < 0) percent = 0;

                if (percent >= 100) {
                    if (fill) fill.style.width = '100%';
                    // ⚠️ Nozik holat: agar shu lahzada boshqa o'tish jarayonda bo'lsa
                    //    (_advancing qulfi), nextStory() hech narsa qilmaydi. Tsiklni
                    //    to'xtatib qo'ysak — yana qotish. Shuning uchun keyingi kadrda
                    //    qayta urinamiz (o'tish muvaffaqiyatli bo'lsa gen o'zgarib,
                    //    bu tsikl yuqoridagi tekshiruvda o'zini to'xtatadi).
                    if (_advancing) {
                        storyProgressAnimation = requestAnimationFrame(step);
                        return;
                    }
                    nextStory();                          // ✅ video uchun ham o'tadi (ilgari muzlab qolardi)
                    return;
                }
                if (fill) fill.style.width = percent + '%';
                storyProgressAnimation = requestAnimationFrame(step);
            }
            storyProgressAnimation = requestAnimationFrame(step);
        }

        function pauseStory() {
            isStoryPaused = true;
            if(storyVideoElement) { try { storyVideoElement.pause(); } catch (e) {} }
        }
        
        function resumeStory() {
            isStoryPaused = false;
            // ⚠️ ILGARI: play() qaytargan Promise ushlanmasdi -> brauzer davom
            //    etishni bloklasa "unhandled rejection" va video pauzada qolib,
            //    progress chizig'i esa yugurib ketardi (muzlagan kadr effekti).
            if (storyVideoElement) {
                try {
                    const pr = storyVideoElement.play();
                    if (pr && typeof pr.catch === 'function') {
                        pr.catch(() => {
                            try {
                                storyVideoElement.muted = true;
                                _storySoundMuted = true;
                                const sb = document.getElementById('sv-sound-btn');
                                if (sb) sb.innerHTML = window._svSoundIco ? window._svSoundIco(true) : '🔇';
                                storyVideoElement.play().catch(() => {});
                            } catch (e) {}
                        });
                    }
                } catch (e) {}
            }
        }

        // 🗑 FAQAT ADMIN UCHUN: STORISNI O'CHIRISH
        window.deleteCurrentStory = () => {
            if(typeof tg !== 'undefined' && tg.showConfirm) {
                tg.showConfirm("Ushbu storisni butunlay o'chirib tashlaysizmi?", function(ok) {
                    if(ok) executeStoryDelete();
                });
            } else {
                if(confirm("Ushbu storisni butunlay o'chirib tashlaysizmi?")) executeStoryDelete();
            }
        };

    function executeStoryDelete() {
            const item = currentPlaylist[currentStoryIdx];
            if(!item || !item.id) return;

            // Firebase bazasidan to'liq yo'q qilamiz (kalit — Firebase kaliti; id ba'zan farq qiladi)
            db.ref('stories/' + currentPlaylistId + '/' + (item._key != null ? item._key : item.id)).remove().then(() => {
                showToast("Storis bazadan o'chirildi!", "success");
                closeStoryViewer(); // Oynani yopib yuboramiz. Keyingi ochilganda bu storis bo'lmaydi.
            }).catch(err => {
                showToast("O'chirishda xatolik yuz berdi", "warning");
            });
        }

// ===================================================
// 💳 3. VIP CARD GOLOGRAMMA MOTOR (Device Orientation)
// ===================================================
function initVipCardGlow() {
    const card = document.querySelector('.premium-bank-card');
    if(!card) return;

    document.addEventListener('mousemove', (e) => {
        if(activeModal || searchActive) return;
        let rect = card.getBoundingClientRect();
        let x = (e.clientX - rect.left) / rect.width - 0.5;
        let y = (e.clientY - rect.top) / rect.height - 0.5;
        
        card.style.transform = `rotateY(${x * 30}deg) rotateX(${-y * 30}deg)`;
        card.style.setProperty('--reflect-pos', `${(x + 0.5) * 100}%`);
    });

    // Telefonni qimirlatganda (iPhone/Android Giroskop)
    window.addEventListener('deviceorientation', (e) => {
        let tiltX = e.gamma / 2; // -45 dan 45 gacha
        let tiltY = e.beta / 2;
        
        card.style.transform = `rotateY(${tiltX}deg) rotateX(${-tiltY}deg)`;
    });
}

// Storis bosilganda uni "ko'rilgan" qilib o'zgartiruvchi funksiya.
// Endi: localStorage'ga timestamp saqlanadi -> mijoz qaytib kelganda
// halqa kulrang (seen) bo'lib qoladi (admin yangi storis qo'shsa - yana 'new').
// Agar storis yo'q (empty) yoki allaqachon ko'rilgan (seen) bo'lsa - tegmaydi.
// 👁 Storis halqasi bosilganda chaqiriladi (HTML onclick'dan).
//
// ⚠️ ILGARI BU FUNKSIYA XATO ISHLARDI: u `_seenStories[cat] = Date.now()`
//    yozib, BUTUN kategoriyani "ko'rilgan" deb belgilardi. Ya'ni mijoz
//    halqani bosishi bilanoq — hatto birinchi storisni ham ko'rib
//    bo'lmasdan yopib qo'ysa ham — o'sha bo'limdagi HAMMA storis
//    "ko'rilgan" bo'lib qolardi va halqa kulrangga aylanardi.
//
// ENDI: har bir storis ALOHIDA, uni haqiqatda ko'rgandagina belgilanadi
//    (playCurrentStory ichida). Bu funksiya faqat darhol vizual javob beradi
//    (bosilganda aylanish to'xtaydi), hech narsani "ko'rilgan" qilmaydi.
function markAsSeen(element) {
    let ring = element.querySelector('.story-ring');
    if (!ring) return;
    if (ring.classList.contains('empty')) return;     // storis yo'q -> tegmaymiz
    // Ataylab HECH NARSA saqlanmaydi — haqiqiy belgilash storisni ko'rganda bo'ladi.
}

// ============================================================
// 💎 ADMIN TOVAR MODULI — ZAMONAVIYLASHTIRISH (2026)
// Bu blok script oxirida turadi: window.* funksiyalar mavjudlarini
// xavfsiz qayta belgilaydi (override) va yangilarini qo'shadi.
// ============================================================

// ---------- 1) NARX FORMATI ----------
window.formatNumber = (n) => { n = parseInt(n) || 0; return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' '); };
window.parsePrice = (str) => parseInt(String(str == null ? '' : str).replace(/[^\d]/g, '')) || 0;
/**
 * 💰 NARXNI MINGGA YAXLITLASH — chiroyli, «do'kon narxi» ko'rinishi uchun.
 *
 * Foizli hisob-kitob deyarli har doim xunuk son beradi:
 *   312 000 + 3%  = 321 360  ->  321 000
 *   321 501       ->            322 000   (500 va undan yuqorisi TEPAGA)
 *
 * Qoida: oxirgi 3 xona yaxlitlanadi (eng yaqin 1000 ga). 500 dan kichik
 * bo'lsa pastga, 500 va undan katta bo'lsa tepaga.
 *
 * ⚠️ Bu bot'dagi `bulk_adjust_price` bilan AYNI qoida
 * (`int(round(cur / 1000.0)) * 1000`) — ikki joyda boshqa natija
 * chiqmasligi uchun ataylab bir xil qilingan.
 */
window._roundSom = function (n) {
    var v = Number(n);
    if (!isFinite(v) || v <= 0) return 0;
    return Math.round(v / 1000) * 1000;
};
window.formatPriceInput = (el) => {
    if (!el) return;
    let d = el.value.replace(/[^\d]/g, '');
    el.value = d ? formatNumber(d) : '';
    let prefix = (el.id && el.id.indexOf('edit') === 0) ? 'edit' : ((el.id && el.id.indexOf('add') === 0) ? 'add' : null);
    if (prefix) updateLivePreview(prefix);
    window._formDirty = true;
};

// ---------- 2) MARKA -> MODEL (to'liq, izchil ro'yxat) ----------
window.BRAND_MODELS = {
    chevy: [['damas','Damas'],['cobalt','Cobalt'],['gentra','Gentra'],['lacetti','Lacetti'],['malibu1','Malibu 1'],['malibu2','Malibu 2'],['tracker2','Tracker 2'],['nexia3','Nexia 3'],['spark','Spark'],['onix','Onix'],['captiva1','Captiva 1'],['captiva2','Captiva 2'],['captiva3','Captiva 3'],['captiva4','Captiva 4'],['labo','Labo'],['matiz','Matiz'],['epica','Epica']],
    daewoo: [['nexia1','Nexia 1'],['nexia2','Nexia 2'],['matiz','Matiz'],['tico','Tico']],
    uaz: [['patriot','Patriot'],['hunter','Hunter']]
};
window.buildModelOptions = (brand) => (BRAND_MODELS[brand] || []).map(m => `<option value="${m[0]}">${m[1]}</option>`).join('');
window.updateBrandModels = () => {
    let brandEl = document.getElementById('admin-prod-brand');
    let box = document.getElementById('admin-brand-models-box');
    let select = document.getElementById('admin-prod-model');
    if (!brandEl || !box || !select) return;
    let brand = brandEl.value;
    if (brand === 'gaz' || !brand) { box.style.display = 'none'; select.innerHTML = ''; }
    else { box.style.display = 'block'; select.innerHTML = buildModelOptions(brand); }
};
window.updateEditBrandModels = () => {
    let brandEl = document.getElementById('edit-prod-brand');
    let box = document.getElementById('edit-brand-models-box');
    let select = document.getElementById('edit-prod-model');
    if (!brandEl || !box || !select) return;
    let brand = brandEl.value;
    if (brand === 'gaz' || !brand) { box.style.display = 'none'; select.innerHTML = ''; }
    else { box.style.display = 'block'; select.innerHTML = buildModelOptions(brand); }
};

// ---------- 3) RASMLARNI BOSHQARISH (tartiblash / asosiy / o'chirish) ----------
window.getImgInputs = (prefix) => ['', '2', '3'].map(s => document.getElementById(`${prefix}-img-url${s}`));
window.readImgUrls = (prefix) => getImgInputs(prefix).map(el => el ? el.value.trim() : '').filter(u => u);
window.setImgUrls = (prefix, arr) => { getImgInputs(prefix).forEach((el, i) => { if (el) el.value = (arr && arr[i]) ? arr[i] : ''; }); };
window.removeImg = (prefix, i) => { let a = readImgUrls(prefix); a.splice(i, 1); setImgUrls(prefix, a); updateImgPreviews(prefix); window._formDirty = true; };
window.moveImg = (prefix, i, dir) => { let a = readImgUrls(prefix); let j = i + dir; if (j < 0 || j >= a.length) return; let t = a[i]; a[i] = a[j]; a[j] = t; setImgUrls(prefix, a); updateImgPreviews(prefix); window._formDirty = true; };
window.setMainImg = (prefix, i) => { let a = readImgUrls(prefix); if (i <= 0 || i >= a.length) return; let x = a.splice(i, 1)[0]; a.unshift(x); setImgUrls(prefix, a); updateImgPreviews(prefix); window._formDirty = true; };

window.updateImgPreviews = (prefix) => {
    let urls = readImgUrls(prefix);
    let box = document.getElementById(`${prefix}-img-previews`);
    if (!box) return;
    if (urls.length === 0) { box.innerHTML = ''; updateLivePreview(prefix); return; }
    box.innerHTML = urls.map((url, i) => `
        <div class="img-thumb-wrap" style="margin:4px;">
            <img src="${url}" style="width:80px;height:80px;object-fit:cover;border-radius:12px;border:2px solid ${i===0?'var(--luxury-gold)':'var(--glass-border)'};display:block;background:#fff;" onerror="this.style.borderColor='#ff453a';this.src=window._brandPlaceholder('Xato')">
            <button type="button" class="img-ctrl img-del" onclick="removeImg('${prefix}',${i})" title="O'chirish">✕</button>
            <button type="button" class="img-ctrl" style="top:-8px;left:-8px;background:${i===0?'var(--luxury-gold)':'rgba(0,0,0,0.7)'};color:${i===0?'#000':'#fff'};" onclick="setMainImg('${prefix}',${i})" title="${i===0?'Asosiy rasm':'Asosiy qilish'}">⭐</button>
            <div class="img-move-row">
                ${i>0?`<button type="button" class="img-ctrl" style="position:relative;width:24px;height:24px;font-size:11px;" onclick="moveImg('${prefix}',${i},-1)">◀</button>`:''}
                ${i<urls.length-1?`<button type="button" class="img-ctrl" style="position:relative;width:24px;height:24px;font-size:11px;" onclick="moveImg('${prefix}',${i},1)">▶</button>`:''}
            </div>
        </div>
    `).join('');
    updateLivePreview(prefix);
};

// ---------- 4) RASM YUKLASH (progress bilan, XHR) ----------
function uploadFileWithProgress(file, onProgress) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const base64 = reader.result.split(',')[1];
            const fd = new FormData();
            fd.append('key', IMGBB_API_KEY);
            fd.append('image', base64);
            const xhr = new XMLHttpRequest();
            xhr.open('POST', 'https://api.imgbb.com/1/upload');
            xhr.upload.onprogress = (e) => { if (e.lengthComputable && onProgress) onProgress(Math.round(e.loaded / e.total * 100)); };
            xhr.onload = () => {
                try { let j = JSON.parse(xhr.responseText); if (j && j.success) resolve(j.data.url); else reject(new Error(j && j.error && j.error.message ? j.error.message : 'ImgBB rad etdi')); }
                catch (err) { reject(err); }
            };
            xhr.onerror = () => reject(new Error('Tarmoq xatosi'));
            xhr.send(fd);
        };
        reader.onerror = () => reject(new Error("Fayl o'qilmadi"));
        reader.readAsDataURL(file);
    });
}

window.handleMultiImgUpload = async function(event, prefix) {
    let existing = readImgUrls(prefix);
    let slots = 3 - existing.length;
    if (slots <= 0) { showToast("Maksimum 3 ta rasm. Avval birortasini o'chiring.", "warning"); event.target.value = ''; return; }
    const files = Array.from(event.target.files).slice(0, slots);
    event.target.value = '';
    if (files.length === 0) return;

    const box = document.getElementById(`${prefix}-img-previews`);
    if (box) {
        let existHtml = existing.map(url => `<div class="img-thumb-wrap" style="margin:4px;opacity:0.5;"><img src="${url}" style="width:80px;height:80px;object-fit:cover;border-radius:12px;border:2px solid var(--glass-border);background:#fff;"></div>`).join('');
        let progHtml = files.map((f, i) => `<div class="up-prog" id="up-prog-${prefix}-${i}" style="margin:4px;"><span class="up-pct">0%</span><div class="up-bar"></div></div>`).join('');
        box.innerHTML = existHtml + progHtml;
    }

    let uploaded = [];
    for (let i = 0; i < files.length; i++) {
        let cell = document.getElementById(`up-prog-${prefix}-${i}`);
        try {
            let url = await uploadFileWithProgress(files[i], (pct) => {
                if (cell) { let b = cell.querySelector('.up-bar'); let t = cell.querySelector('.up-pct'); if (b) b.style.width = pct + '%'; if (t) t.innerText = pct + '%'; }
            });
            uploaded.push(url);
            if (cell) { let t = cell.querySelector('.up-pct'); if (t) t.innerText = '✅'; let b = cell.querySelector('.up-bar'); if (b) b.style.width = '100%'; }
        } catch (err) {
            if (cell) { let t = cell.querySelector('.up-pct'); if (t) t.innerText = '❌'; }
            showToast(`${i + 1}-rasm xatosi: ${err.message}`, 'warning');
        }
    }

    if (uploaded.length > 0) {
        setImgUrls(prefix, existing.concat(uploaded));
        updateImgPreviews(prefix);
        window._formDirty = true;
        showToast(`✅ ${uploaded.length} ta rasm yuklandi!`, 'success');
    } else {
        updateImgPreviews(prefix);
        showToast("❌ Rasm yuklanmadi. Qaytadan urinib ko'ring.", 'warning');
    }
};

// ---------- 5) JONLI KO'RINISH (Live preview) ----------
window.updateLivePreview = (prefix) => {
    let box = document.getElementById(`${prefix}-live-preview`);
    if (!box) return;
    let nameEl = document.getElementById(`${prefix}-name`);
    let name = nameEl ? nameEl.value.trim() : '';
    let priceEl = document.getElementById(`${prefix}-price`);
    let price = priceEl ? parsePrice(priceEl.value) : 0;
    let codeEl = document.getElementById(`${prefix}-code`);
    let code = codeEl ? codeEl.value.trim() : '';
    let img = readImgUrls(prefix)[0] || '';
    if (!name && !price && !img) { box.innerHTML = `<div class="lp-empty">Maydonlarni to'ldiring — bu yerda mijozga qanday ko'rinishi chiqadi</div>`; return; }
    let mainName = (name || 'Tovar nomi').split('·')[0].trim();
    box.innerHTML = `
        <div class="lp-card">
            <img src="${img || window._brandPlaceholder('Rasm')}" onerror="this.src=window._brandPlaceholder('Rasm')">
            <div style="flex:1; min-width:0;">
                <div style="font-weight:700; color:#fff; font-size:14px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${mainName || 'Tovar nomi'}</div>
                ${code ? `<div style="font-size:11px; color:var(--text-muted); margin-top:2px;">🔖 ${code}</div>` : ''}
                <div style="color:var(--luxury-gold); font-weight:800; font-size:14px; margin-top:4px;">${price ? price.toLocaleString() : 0} so'm</div>
            </div>
        </div>`;
};

// ---------- 6) DB YOZISH (faqat o'zgargan tovar) va XAVFSIZ ID ----------
// ⚠️ ILGARI XATO: tovar MASSIV INDEKSI bo'yicha yozilardi
//    (`products/{idx}`). `_rewriteProductsSafely` esa massivni `filter()`
//    qiladi — bitta tovar o'chirilsa, undan KEYINGI barcha indekslar suriladi.
//    Natijada tahrirlash oynasi o'chirishdan OLDIN ochilgan bo'lsa, saqlash
//    tahrirlangan tovarni BOSHQA tovar ustiga yozib yuborardi.
//    Endi yozishdan oldin o'sha indeksdagi tovar AYNAN shu `id` ga tegishli
//    ekani tekshiriladi; mos kelmasa — `id` bo'yicha to'g'ri joy topiladi.
window.saveProductAt = (idx) => {
    if (idx < 0 || idx >= productsDB.length) return Promise.reject(new Error("Noto'g'ri indeks"));
    var prod = productsDB[idx];
    var pid = prod && prod.id;
    if (pid == null) return db.ref('products/' + idx).set(prod);   // id yo'q — eski yo'l

    return db.ref('products/' + idx).transaction(function (cur) {
        // Bu joyda boshqa tovar turgan bo'lsa — YOZMAYMIZ (bekor qilamiz)
        if (cur && cur.id != null && String(cur.id) !== String(pid)) return;
        return prod;
    }).then(function (res) {
        if (res && res.committed) return res;
        // Indeks siljigan — id bo'yicha haqiqiy joyni topamiz
        return db.ref('products').once('value').then(function (snap) {
            var fresh = [];
            if (snap.exists()) snap.forEach(function (c) { if (c.val()) fresh.push(c.val()); });
            var real = fresh.findIndex(function (p) { return p && String(p.id) === String(pid); });
            if (real < 0) throw new Error('Tovar bazada topilmadi');
            return db.ref('products/' + real).set(prod);
        });
    });
};
// =====================================================================
// 🔥 FLASH SALE — yordamchilar, normalizer (muddat tugashi) va countdown ticker
//   - _flashActive(p): flash hozir aktivmi.
//   - _fmtFlash(ms): qolgan vaqtni "Dk HH:MM:SS" ko'rinishida.
//   - applyFlashState(): muddati o'tgan flash'larni ASL narxga qaytaradi
//     (xotirada; admin bo'lsa DB'ni ham tozalaydi). price flash davomida
//     discounted; tugagach oldPrice (asl) tiklanadi -> cart/buyurtma to'g'ri.
// =====================================================================
window._flashActive = function(p){
    return !!(p && p.flashUntil && p.flashUntil > Date.now()
              && p.oldPrice && Number(p.oldPrice) > Number(p.price));
};
window._fmtFlash = function(ms){
    if (ms <= 0) return '00:00:00';
    var s = Math.floor(ms/1000), d = Math.floor(s/86400); s -= d*86400;
    var h = Math.floor(s/3600); s -= h*3600;
    var m = Math.floor(s/60); s -= m*60;
    var z = function(n){ return (n<10?'0':'') + n; };
    return (d>0 ? d + ' kun ' : '') + z(h)+':'+z(m)+':'+z(s);
};
window.applyFlashState = function(){
    var now = Date.now(), changed = false;
    var list = (typeof productsDB !== 'undefined' && productsDB) ? productsDB : (window.productsDB || []);
    for (var i = 0; i < list.length; i++){
        var p = list[i];
        if (p && p.flashUntil && p.flashUntil <= now){
            if (p.oldPrice && Number(p.oldPrice) > 0) p.price = Number(p.oldPrice);
            delete p.oldPrice; delete p.flashUntil;
            changed = true;
            try { if (window.isAdmin && window.isAdmin() && window.saveProductAt) window.saveProductAt(i); } catch(e){}
        }
    }
    return changed;
};
// 1 soniyalik ticker — FAQAT ekranda .flash-cd bo'lsa ish bajaradi (telefonni qizdirmaydi).
(function flashTicker(){
    function tick(){
        var nodes = document.querySelectorAll('.flash-cd');
        if (!nodes.length) return;
        var now = Date.now(), expired = false;
        nodes.forEach(function(el){
            var until = parseInt(el.getAttribute('data-until'), 10) || 0;
            var left = until - now;
            if (left <= 0){ el.textContent = '00:00:00'; expired = true; }
            else el.textContent = window._fmtFlash(left);
        });
        if (expired && window.applyFlashState && window.applyFlashState()){
            try {
                if (typeof _sortDisplayDB === 'function')
                    displayDB = _sortDisplayDB(productsDB.filter(function(p){ return !p.is_draft; }).slice().reverse());
                if (typeof renderProducts === 'function') renderProducts();
            } catch(e){}
        }
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function(){ setInterval(tick, 1000); });
    else setInterval(tick, 1000);
})();

window.generateProductId = () => {
    // #14: bot bilan BIR XIL sxema — ketma-ket (max + 1). Bot ham max(id)+1
    // ishlatadi; ilgari bu yerda Date.now() edi (nomuvofiq). Collision guard saqlanadi.
    let id = productsDB.reduce((mx, p) => Math.max(mx, parseInt(p.id) || 0), 0) + 1;
    while (productsDB.some(x => x.id === id)) id++;
    return id;
};

// ---------- #7: butun massivni KO'R-KO'RONA qayta yozmaslik ----------
// Eski kodda o'chirish amallari db.ref('products').set(productsDB) bilan BUTUN
// massivni xotiradagi (eskirgan bo'lishi mumkin) nusxa bilan qayta yozardi —
// ayni paytda bot/boshqa admin qo'shgan tovar YO'QOLISHI mumkin edi.
// Bu yordamchi avval ENG SO'NGGI holatni o'qiydi, o'zgartirishni (mutator,
// id bo'yicha ishlaydi) o'shanga qo'llab yozadi. Shunday qilib begona
// o'zgarishlar saqlanadi.
window._rewriteProductsSafely = function (mutator) {
    return db.ref('products').once('value').then(function (snap) {
        var fresh = [];
        if (snap.exists()) snap.forEach(function (c) { if (c.val()) fresh.push(c.val()); });
        var out = mutator(fresh);
        if (!Array.isArray(out)) out = fresh;
        productsDB = out;
        window.productsDB = out;
        return db.ref('products').set(out);
    });
};

// ---------- 7) ADD FORMANI TOZALASH / OCHISH / KLON ----------
window.resetAddForm = () => {
    ['add-name','add-price','add-code','add-desc','add-aliases','add-img-url','add-img-url2','add-img-url3','add-flash-price','add-flash-hours'].forEach(id => { let el = document.getElementById(id); if (el) el.value = ''; });
    let st = document.getElementById('add-stock'); if (st) st.value = 10;
    let pt = document.getElementById('admin-prod-type'); if (pt) pt.value = 'oddiy';
    if (typeof toggleProductTypeFields === 'function') toggleProductTypeFields();
    let unit = document.getElementById('add-unit'); if (unit) unit.value = 'dona';
    let brand = document.getElementById('admin-prod-brand'); if (brand) brand.value = '';
    if (typeof updateBrandModels === 'function') updateBrandModels();
    let sc = document.getElementById('admin-sizes-container');
    if (sc) sc.innerHTML = `<div class="size-input-row" style="display:flex; gap:8px; margin-bottom:8px;"><input type="text" placeholder="Razmer (mas: 92.5)" style="flex:1; padding:12px; background:rgba(255,255,255,0.05); color:white; border:1px solid var(--glass-border); border-radius:12px; outline:none;" class="size-name"><input type="number" placeholder="Soni" style="flex:1; padding:12px; background:rgba(255,255,255,0.05); color:white; border:1px solid var(--glass-border); border-radius:12px; outline:none;" class="size-stock"><button type="button" onclick="this.parentElement.remove()" style="background:rgba(255,69,58,0.2); color:#ff453a; border:1px solid rgba(255,69,58,0.5); border-radius:12px; padding:0 15px; cursor:pointer; font-weight:bold; font-size:16px;">×</button></div>`;
    document.querySelectorAll('#addProductModal .cat-chip').forEach(c => c.classList.remove('selected'));
    let firstOrigin = document.querySelector('#add-origin-chips .origin-chip');
    if (firstOrigin && typeof selectOrigin === 'function') selectOrigin(firstOrigin, 'add');
    updateImgPreviews('add');
    updateLivePreview('add');
};
window.openAddProduct = () => {
    resetAddForm();
    window._formDirty = false;
    openModal('addProductModal');
    updateLivePreview('add');
};
window.fillAddFormFromProduct = (p) => {
    resetAddForm();
    document.getElementById('add-name').value = (p.name || '') + ' (nusxa)';
    document.getElementById('add-price').value = formatNumber(p.price);
    let codeEl = document.getElementById('add-code'); if (codeEl) codeEl.value = p.code || '';
    let alEl = document.getElementById('add-aliases'); if (alEl) alEl.value = p.aliases || '';
    document.getElementById('add-desc').value = (p.desc && p.desc !== 'Tavsif kiritilmagan') ? p.desc : '';
    let unit = document.getElementById('add-unit'); if (unit) unit.value = p.unit || 'dona';
    let pType = p.product_type || 'oddiy';
    document.getElementById('admin-prod-type').value = pType;
    if (typeof toggleProductTypeFields === 'function') toggleProductTypeFields();
    if (pType === 'oddiy') {
        let st = document.getElementById('add-stock'); if (st) st.value = (p.stock !== undefined ? p.stock : 10);
    } else {
        let brandEl = document.getElementById('admin-prod-brand');
        if (brandEl) { brandEl.value = p.brand || ''; updateBrandModels(); }
        if (p.model) setTimeout(() => { let m = document.getElementById('admin-prod-model'); if (m) m.value = p.model; }, 60);
        let sc = document.getElementById('admin-sizes-container');
        if (sc && p.sizes && p.sizes.length) {
            sc.innerHTML = p.sizes.map(s => `<div class="size-input-row" style="display:flex; gap:8px; margin-bottom:8px;"><input type="text" value="${s.size}" class="size-name" style="flex:1; padding:12px; background:rgba(255,255,255,0.05); color:white; border:1px solid var(--glass-border); border-radius:12px; outline:none;"><input type="number" value="${s.stock}" class="size-stock" style="flex:1; padding:12px; background:rgba(255,255,255,0.05); color:white; border:1px solid var(--glass-border); border-radius:12px; outline:none;"><button type="button" onclick="this.parentElement.remove()" style="background:rgba(255,69,58,0.2); color:#ff453a; border:1px solid rgba(255,69,58,0.5); border-radius:12px; padding:0 15px; cursor:pointer; font-weight:bold; font-size:16px;">×</button></div>`).join('');
        }
    }
    let imgs = (p.images && p.images.length) ? p.images.slice(0, 3) : (p.img ? [p.img] : []);
    setImgUrls('add', imgs);
    document.querySelectorAll('#addProductModal .cat-chip').forEach(c => c.classList.remove('selected'));
    let cats = p.categories || (p.category ? [p.category] : []);
    cats.forEach(c => { let mC = document.querySelector(`#addProductModal .model-chip[data-val="${c}"]`); if (mC) mC.classList.add('selected'); });
    updateImgPreviews('add');
    updateLivePreview('add');
};
window.cloneProductFromEdit = () => {
    let id = parseInt(document.getElementById('edit-id').value);
    let p = productsDB.find(x => x.id === id);
    if (!p) { showToast("Tovar topilmadi", "warning"); return; }
    let em = document.getElementById('editModal'); if (em) em.style.display = 'none';
    let am = document.getElementById('addProductModal');
    am.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    activeModal = 'addProductModal';
    window.history.pushState({ modal: 'addProductModal' }, "");
    if (typeof tg !== 'undefined' && tg.BackButton) tg.BackButton.show();
    fillAddFormFromProduct(p);
    window._formDirty = true;
    showToast("📋 Nusxa olindi! O'zgartirib, saqlang.", "success");
};

// ---------- 8) SAQLANMAGAN O'ZGARISHLAR OGOHLANTIRISHI ----------
window.tryCloseAddProduct = () => {
    if (window._formDirty) {
        let go = () => { window._formDirty = false; closeModal(); };
        if (typeof tg !== 'undefined' && tg.showConfirm) { tg.showConfirm("Saqlanmagan ma'lumotlar bor. Chiqasizmi?", (ok) => { if (ok) go(); }); }
        else if (confirm("Saqlanmagan ma'lumotlar bor. Chiqasizmi?")) go();
    } else { closeModal(); }
};
if (typeof window.closeEditGoBack === 'function' && !window._origCloseEditGoBack) {
    window._origCloseEditGoBack = window.closeEditGoBack;
    window.closeEditGoBack = function() {
        if (window._formDirty) {
            let go = () => { window._formDirty = false; window._origCloseEditGoBack(); };
            if (typeof tg !== 'undefined' && tg.showConfirm) { tg.showConfirm("Saqlanmagan o'zgarishlar bor. Chiqasizmi?", (ok) => { if (ok) go(); }); }
            else if (confirm("Saqlanmagan o'zgarishlar bor. Chiqasizmi?")) go();
            return;
        }
        window._origCloseEditGoBack();
    };
}

// ---------- 9) OVOZLI KIRITISH ----------
window.startVoice = (targetId) => {
    let SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { showToast("Bu qurilmada ovozli kiritish ishlamaydi", "warning"); return; }
    let el = document.getElementById(targetId);
    if (!el) return;
    let rec = new SR();
    rec.lang = 'ru-RU';
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    showToast("🎤 Gapiring...");
    rec.onresult = (e) => {
        let t = e.results[0][0].transcript;
        el.value = el.value ? (el.value + ' ' + t) : t;
        el.dispatchEvent(new Event('input'));
        window._formDirty = true;
        showToast("✅ Yozildi", "success");
    };
    rec.onerror = () => { showToast("Ovoz tushunilmadi, qaytaring", "warning"); };
    try { rec.start(); } catch (e) {}
};

// ---------- 10) SHTRIX-KOD / QR SKANER ----------
// BarcodeDetector ko'p qurilmalarda (iPhone, ba'zi Telegram brauzerlari) yo'q edi.
// Endi universal "html5-qrcode" kutubxonasidan foydalanamiz (lazy-load):
//   1) Kamera ishlasa — 1D shtrix-kod VA QR ni o'qiydi.
//   2) Kamera bloklansa — Telegram'ning o'z (native) QR skaneriga o'tamiz.
//   3) U ham bo'lmasa — kodni qo'lda kiritish taklif qilinadi.
let _qrLibLoading = null;
function ensureQrScanner() {
    if (window.Html5Qrcode) return Promise.resolve();
    if (_qrLibLoading) return _qrLibLoading;
    _qrLibLoading = new Promise((resolve, reject) => {
        const js = document.createElement('script');
        js.src = 'https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.8/html5-qrcode.min.js';
        js.onload = () => resolve();
        js.onerror = () => reject(new Error('yuklanmadi'));
        document.head.appendChild(js);
    });
    return _qrLibLoading;
}

// Telegram native QR skaneri — onResult(text) chaqiradi (umumiy)
window._telegramQrScan = (onResult) => {
    if (typeof tg === 'undefined' || !tg.showScanQrPopup) {
        showToast("Kamera ishlamadi. Iltimos, kodni qo'lda kiriting.", "warning");
        return false;
    }
    let handler = (e) => {
        let text = (e && e.data) ? String(e.data).trim() : '';
        try { tg.closeScanQrPopup(); } catch (e2) {}
        try { tg.offEvent('qrTextReceived', handler); } catch (e2) {}
        if (text) {
            if (typeof tg.HapticFeedback !== 'undefined' && tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
            onResult(text);
        }
    };
    try {
        tg.onEvent('qrTextReceived', handler);
        tg.showScanQrPopup({ text: "Kod yoki QR ni ramkaga tuting" });
        return true;
    } catch (e) {
        showToast("Skaner ochilmadi. Kodni qo'lda kiriting.", "warning");
        return false;
    }
};

// Fonarik (flashlight) — ba'zi telefonlarda track.applyConstraints orqali ishlaydi
window._toggleTorch = async () => {
    try {
        if (!window._h5qr || !window._h5qr.applyVideoConstraints) return;
        let st = window._h5qr.getRunningTrackSettings ? window._h5qr.getRunningTrackSettings() : {};
        let next = !st.torch;
        await window._h5qr.applyVideoConstraints({ advanced: [{ torch: next }] });
        let btn = document.getElementById('scan-torch-btn');
        if (btn) btn.style.background = next ? 'var(--luxury-gold)' : 'rgba(255,255,255,0.15)';
    } catch (e) { showToast("Bu qurilmada fonarik yo'q", "warning"); }
};

// Skaner ichidan Telegram tezkor (ruxsat saqlanadi) skaneriga o'tish
window._switchToTelegramScan = (onResult) => {
    stopScan();
    setTimeout(() => window._telegramQrScan(onResult), 100);
};

// Umumiy skaner: muvaffaqiyatda onResult(text) chaqiradi
// ⚡ TEZLASHTIRILGAN: fps 10 -> 25, kattaroq qrbox, faqat kerakli formatlar,
//    native BarcodeDetector (Chrome/Edge/Samsung) — bu deyarli darrov o'qiydi.
// 🧭 NAVIGATSIYA: history.pushState bilan ulangan — BackButton overlay'ni yopadi.
window._h5qr = null;
window.runScanner = async (onResult) => {
    try {
        await ensureQrScanner();
    } catch (e) {
        window._telegramQrScan(onResult); // kutubxona yuklanmadi -> Telegram
        return;
    }
    let ov = document.createElement('div');
    ov.id = 'scanner-overlay';
    ov.innerHTML = `
        <button class="scan-close" onclick="stopScan()">×</button>
        <div id="qr-reader" style="width:100%; max-width:380px; min-height:300px;"></div>
        <div class="scan-hint">📷 Kod / QR ni ramkaga tuting</div>
        <div class="scan-actions">
            <button id="scan-torch-btn" class="scan-action-btn" onclick="_toggleTorch()" title="Fonarik">💡</button>
            <button class="scan-action-btn" onclick="_switchToTelegramScan(window._scanCb)" title="Tezkor Telegram skaneri (faqat QR)">⚡ Tezkor</button>
        </div>`;
    document.body.appendChild(ov);
    window._scanCb = onResult;

    // 🧭 History'ga qo'shamiz: BackButton overlay'ni yopadi (asosiy ekranga emas)
    window._scannerPrevActive = activeModal;
    activeModal = '__scanner__';
    window.history.pushState({ modal: '__scanner__' }, "");
    if (typeof tg !== 'undefined' && tg.BackButton) tg.BackButton.show();

    try {
        // Faqat avto-ehtiyot qism qutilarida bo'ladigan formatlar — boshqasini tekshirmaydi
        let formats = [];
        if (typeof Html5QrcodeSupportedFormats !== 'undefined') {
            formats = [
                Html5QrcodeSupportedFormats.QR_CODE,
                Html5QrcodeSupportedFormats.EAN_13,
                Html5QrcodeSupportedFormats.EAN_8,
                Html5QrcodeSupportedFormats.CODE_128,
                Html5QrcodeSupportedFormats.CODE_39,
                Html5QrcodeSupportedFormats.UPC_A,
                Html5QrcodeSupportedFormats.UPC_E,
                Html5QrcodeSupportedFormats.ITF
            ];
        }
        window._h5qr = new Html5Qrcode("qr-reader", { 
            formatsToSupport: formats.length ? formats : undefined,
            // ⚡ Eng katta tezlashtirish: native BarcodeDetector (Chrome/Edge/Samsung Internet)
            //    Bu html5-qrcode'ning ZXing dekoderiga 5-10 baravar tezroq.
            experimentalFeatures: { useBarCodeDetectorIfSupported: true },
            verbose: false
        });
        await window._h5qr.start(
            { facingMode: "environment" },
            { 
                fps: 25,                                  // 10 -> 25 (sekundiga 25 kadr)
                qrbox: (vw, vh) => {                      // dinamik: ekran kattaligiga moslashadi
                    let edge = Math.floor(Math.min(vw, vh) * 0.8);
                    return { width: edge, height: Math.floor(edge * 0.65) };
                },
                aspectRatio: 1.333,
                disableFlip: false,
                videoConstraints: { 
                    facingMode: "environment", 
                    width: { ideal: 1280 }, 
                    height: { ideal: 720 } 
                }
            },
            (decodedText) => {
                if (typeof tg !== 'undefined' && tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
                stopScan();
                onResult(String(decodedText).trim());
            },
            () => {} // har kadrdagi "topilmadi" — e'tibordan chetda
        );
    } catch (err) {
        stopScan();
        window._telegramQrScan(onResult); // kamera ochilmadi -> Telegram skaneri
    }
};

// 1) ADMIN: skanerlangan kodni "code" maydoniga yozadi
window.scanBarcode = (prefix) => {
    runScanner((text) => {
        let inp = document.getElementById(`${prefix}-code`);
        if (inp) { inp.value = text; inp.dispatchEvent(new Event('input')); }
        window._formDirty = true;
        showToast("✅ Kod: " + text, "success");
    });
};

// 2) ADMIN: skanerlangan kod bo'yicha tovarni topib ochadi (faqat admin)
window.scanToFindProduct = () => {
    // Qo'shimcha xavfsizlik: faqat admin
    let isAdmin = (typeof window.isAdmin === 'function') ? window.isAdmin() : (ADMIN_IDS.includes(window.currentUser) || ADMIN_IDS.includes(parseInt(window.currentUser)));
    if (!isAdmin) { showToast("Bu funksiya faqat administrator uchun", "warning"); return; }

    runScanner((raw) => {
        let text = String(raw || '').trim();
        if (!text) return;
        let low = text.toLowerCase();
        // a) aniq kod mosligi
        let matches = productsDB.filter(p => !p.is_draft && p.code && p.code.toLowerCase() === low);
        // b) qisman kod mosligi
        if (matches.length === 0) matches = productsDB.filter(p => !p.is_draft && p.code && p.code.toLowerCase().includes(low));
        // c) nom bo'yicha (kod topilmasa)
        if (matches.length === 0) matches = productsDB.filter(p => !p.is_draft && p.name && p.name.toLowerCase().includes(low));

        if (matches.length === 1) {
            showToast("✅ Topildi: " + matches[0].name, "success");
            openProduct(matches[0].id);
        } else if (matches.length > 1) {
            let si = document.getElementById('searchInput');
            if (si) { si.value = text; searchProducts(); }
            showToast("🔎 " + matches.length + " ta tovar topildi", "success");
        } else {
            let si = document.getElementById('searchInput');
            if (si) { si.value = text; searchProducts(); }
            showToast("❌ '" + text + "' bo'yicha tovar topilmadi", "warning");
        }
    });
};
window.stopScan = () => {
    // Agar history'da skaner bor bo'lsa — back orqali yopamiz (popstate cleanup qiladi)
    if (activeModal === '__scanner__') {
        window.history.back();
        return;
    }
    // Aks holda to'g'ridan-to'g'ri tozalaymiz
    let cleanup = () => { let ov = document.getElementById('scanner-overlay'); if (ov) ov.remove(); };
    if (window._h5qr) {
        let r = window._h5qr;
        window._h5qr = null;
        try {
            r.stop().then(() => { try { r.clear(); } catch (e) {} cleanup(); }).catch(() => cleanup());
        } catch (e) { cleanup(); }
    } else {
        cleanup();
    }
};

// ---------- 11) OMBOR: QIDIRUV / FILTR / OMMAVIY TAHRIR ----------
window.invFilter = 'all';
window._invSelected = {};
window.setInvFilter = (el, f) => {
    window.invFilter = f;
    document.querySelectorAll('#inv-filter-chips .inv-fchip').forEach(c => c.classList.remove('selected'));
    if (el) el.classList.add('selected');
    renderAdminInventory();
};
window._invMatchesBrand = (p, f) => {
    if (f === 'all') return true;
    let cats = (p.categories || (p.category ? [p.category] : [])).join(' ').toLowerCase();
    if (f === 'gaz') return cats.includes('gazel') || cats.includes('volga') || cats.includes('sobol');
    if (f === 'chevy') return cats.includes('chevy');
    if (f === 'daewoo') return cats.includes('daewoo');
    if (f === 'uaz') return cats.includes('uaz');
    return true;
};
window.invToggleSelect = (el, id) => {
    let checked = el.checked;
    if (checked) window._invSelected[id] = true; else delete window._invSelected[id];
    // Tovar kartasi vizual holatini DARHOL yangilaymiz (qayta render qilmasdan)
    let card = el.closest('.inventory-item');
    if (card) card.classList.toggle('inv-selected', checked);
    try { if (typeof _hap === 'function') _hap('selection'); } catch(e){}
    invUpdateBulkBar();
};
window.invSelectedIds = () => Object.keys(window._invSelected).map(k => parseInt(k)).filter(id => productsDB.some(p => p.id === id));
window.invClearSelection = () => { window._invSelected = {}; renderAdminInventory(); };
/**
 * 📋 OMBORDA HOZIR KO'RINAYOTGAN tovarlar ro'yxati (qidiruv + chip filtri).
 *
 * ⚠️ NEGA ALOHIDA FUNKSIYA: bu filtr ilgari faqat `renderAdminInventory`
 * ichida edi va tashqaridan olib bo'lmasdi. «Hammasini belgilash» esa
 * AYNI ro'yxatni bilishi shart — aks holda u ekranda ko'rinmayotgan
 * tovarlarni ham belgilab qo'yardi va xo'jayin bilmasdan butun katalogga
 * amal qo'llab yuborishi mumkin edi. Endi ikkalasi bitta manbadan oladi.
 */
window._invVisibleItems = () => {
    let searchEl = document.getElementById('inv-search');
    let q = (searchEl ? searchEl.value : '').toLowerCase().trim();
    let f = window.invFilter || 'all';
    const stockOf = (p) => (p.product_type === 'razmerli' && p.sizes)
        ? p.sizes.reduce((a, x) => a + (x.stock || 0), 0)
        : (p.stock !== undefined ? p.stock : 0);
    return productsDB.filter(p => {
        if (!p) return false;
        if (f === 'low') { if (stockOf(p) > 3) return false; }
        else if (!_invMatchesBrand(p, f)) return false;
        if (q) {
            let n = (p.name || '').toLowerCase();
            let code = (p.code || '').toLowerCase();
            if (!n.includes(q) && !code.includes(q)) return false;
        }
        return true;
    });
};
/** ☑️ ALMASHTIRGICH (toggle): ko'rinayotgan tovarlarni belgilaydi, qayta
 *  bosilganda BEKOR qiladi.
 *
 *  ⚠️ Ilgari faqat «belgilash» bor edi, bekor qilish yo'q edi — 76 ta
 *  tovarni belgilab qo'ygandan keyin ularni yechish uchun har birini
 *  qo'lda bosish kerak bo'lardi. Endi ayni tugma ikki tomonga ishlaydi. */
window.invSelectAllVisible = () => {
    let items = window._invVisibleItems();
    if (!items.length) { showToast("Belgilash uchun tovar yo'q", "warning"); return; }
    // Ko'rinayotganlarning HAMMASI belgilangan bo'lsa — bekor qilamiz.
    let allOn = items.every(p => p && p.id != null && window._invSelected[p.id]);
    if (allOn) {
        items.forEach(p => { if (p && p.id != null) delete window._invSelected[p.id]; });
        try { if (typeof _hap === 'function') _hap('light'); } catch (e) {}
        showToast("Belgilash bekor qilindi", "success");
    } else {
        items.forEach(p => { if (p && p.id != null) window._invSelected[p.id] = true; });
        try { if (typeof _hap === 'function') _hap('success'); } catch (e) {}
        showToast(items.length + " ta tovar belgilandi", "success");
    }
    renderAdminInventory();
};
window.invUpdateBulkBar = () => {
    let ids = invSelectedIds();
    let bar = document.getElementById('inv-bulk-bar');
    let cnt = document.getElementById('inv-bulk-count');
    if (!bar) return;
    if (ids.length > 0) { bar.style.display = 'block'; if (cnt) cnt.innerText = ids.length + " ta belgilandi"; }
    else { bar.style.display = 'none'; }
};
window._afterBulk = () => {
    window._invSelected = {};
    displayDB = _sortDisplayDB(productsDB.filter(x => !x.is_draft).slice().reverse());
    renderProducts();
    renderAdminInventory();
};
window.invBulkSetPrice = () => {
    let ids = invSelectedIds();
    if (ids.length === 0) { showToast("Avval tovarlarni belgilang", "warning"); return; }
    let newP = parsePrice(document.getElementById('inv-bulk-price').value);
    if (!newP) { showToast("Yangi narx kiriting!", "warning"); return; }
    let proms = [];
    ids.forEach(id => { let idx = productsDB.findIndex(x => x.id === id); if (idx !== -1) { productsDB[idx].price = newP; proms.push(saveProductAt(idx)); } });
    Promise.all(proms).then(() => { showToast(ids.length + " ta narx yangilandi!", "success"); _afterBulk(); }).catch(() => showToast("Saqlashda xato!", "warning"));
};
window.invBulkPercent = (sign) => {
    let ids = invSelectedIds();
    if (ids.length === 0) { showToast("Avval tovarlarni belgilang", "warning"); return; }
    let pct = parseFloat(document.getElementById('inv-bulk-pct').value);
    if (!pct || pct <= 0) { showToast("Foiz kiriting!", "warning"); return; }
    let proms = [];
    let skipped = 0;
    ids.forEach(id => {
        let idx = productsDB.findIndex(x => x.id === id);
        if (idx === -1) return;
        let p = productsDB[idx];
        // 🏷 AKSIYADAGI tovarga tegmaymiz: uning `price`i vaqtincha tushirilgan,
        //    unga foiz qo'shsak asl narx (`oldPrice`) bilan mos kelmay qoladi.
        //    (Bot'dagi `bulk_adjust_price` ham xuddi shunday o'tkazib yuboradi.)
        if (p.oldPrice && Number(p.oldPrice) > Number(p.price)) { skipped++; return; }
        // 💰 Natija MINGGA yaxlitlanadi: 312 000 + 3% = 321 360 -> 321 000
        let np = window._roundSom(Number(p.price) * (1 + sign * pct / 100));
        if (np <= 0) { skipped++; return; }
        p.price = np;
        proms.push(saveProductAt(idx));
    });
    if (!proms.length) { showToast("O'zgartirish uchun mos tovar yo'q", "warning"); return; }
    Promise.all(proms).then(() => {
        let msg = proms.length + " ta narx " + (sign > 0 ? '+' : '−') + pct + "% o'zgartirildi";
        if (skipped) msg += " (" + skipped + " ta o'tkazildi — aksiyada)";
        showToast(msg, "success");
        _afterBulk();
    }).catch(() => showToast("Saqlashda xato!", "warning"));
};
window.invBulkDelete = () => {
    let ids = invSelectedIds();
    if (ids.length === 0) { showToast("Avval tovarlarni belgilang", "warning"); return; }
    let doDel = () => {
        window._rewriteProductsSafely(function (fresh) { return fresh.filter(p => !ids.includes(p.id)); })
            .then(() => { showToast(ids.length + " ta tovar o'chirildi!", "success"); _afterBulk(); })
            .catch(() => showToast("Saqlashda xato!", "warning"));
    };
    if (typeof tg !== 'undefined' && tg.showConfirm) { tg.showConfirm(ids.length + " ta tovarni o'chirasizmi?", (ok) => { if (ok) doDel(); }); }
    else if (confirm(ids.length + " ta tovarni o'chirasizmi?")) doDel();
};

window.renderAdminInventory = () => {
    let c = document.getElementById('admin-inventory-list');
    if (!c) return;

    // — Qoldiq hisoblagich (razmerli bo'lsa razmerlar yig'indisi) —
    const _stockOf = (p) => (p.product_type === 'razmerli' && p.sizes)
        ? p.sizes.reduce((a, x) => a + (x.stock || 0), 0)
        : (p.stock !== undefined ? p.stock : 0);
    const _rank = (s) => s <= 0 ? 0 : (s <= 3 ? 1 : 2); // tugagan -> kam -> yetarli

    // #30: ombor xulosasi (qoralama bo'lmaganlar bo'yicha)
    let _live = productsDB.filter(p => p && !p.is_draft);
    let _lowCount = _live.filter(p => { let s = _stockOf(p); return s > 0 && s <= 3; }).length;
    let _outCount = _live.filter(p => _stockOf(p) <= 0).length;

    // Filtr mantiqi `_invVisibleItems()` da — «Hammasini belgilash» ham
    // AYNI ro'yxatdan foydalanadi (ikki joyda ikki xil natija bo'lmasin).
    let items = window._invVisibleItems();

    items = items.slice().sort((a, b) => _rank(_stockOf(a)) - _rank(_stockOf(b)));

    // Ko'rinayotgan tovar soni — «Hammasini belgilash» nimani qamrashini
    // xo'jayin OLDINDAN bilishi uchun.
    try {
        let vc = document.getElementById('inv-visible-count');
        if (vc) vc.innerText = items.length + " ta tovar ko'rinmoqda";
        // Tugma matni holatga qarab o'zgaradi — bosishdan oldin nima
        // bo'lishini bilib turadi.
        let sb = document.getElementById('inv-selall-btn');
        if (sb) {
            let allOn = items.length > 0 && items.every(p => p && p.id != null && window._invSelected[p.id]);
            sb.innerText = allOn ? "Belgilashni bekor qilish" : "Hammasini belgilash";
        }
    } catch (e) {}

    // #30: yuqorida jami / kam qolgan / tugagan xulosasi
    let summaryHtml = `<div class="inv2-summary">
        <div class="inv2-stat"><b>${_live.length}</b><span>Jami tovar</span></div>
        <div class="inv2-stat inv2-stat-low"><b>${_lowCount}</b><span>Kam qoldi</span></div>
        <div class="inv2-stat inv2-stat-out"><b>${_outCount}</b><span>Tugagan</span></div>
    </div>`;

    if (items.length === 0) {
        c.innerHTML = summaryHtml + '<p class="iv-empty">Tovar topilmadi</p>';
        invUpdateBulkBar();
        return;
    }

    c.innerHTML = summaryHtml + items.map(p => {
        let checked = window._invSelected[p.id] ? 'checked' : '';
        let selCls = window._invSelected[p.id] ? ' inv-selected' : '';
        let checkbox = `<input type="checkbox" class="inv-check" ${checked} onchange="invToggleSelect(this, ${p.id})">`;
        let codeHint = p.code ? `<span class="inv-code">${p.code}</span>` : '';
        let tot = _stockOf(p);
        let flag = tot <= 0 ? '<span class="inv-flag inv-flag-out">Tugagan</span>' : (tot <= 3 ? '<span class="inv-flag inv-flag-low">Kam qoldi</span>' : '');
        let urg = tot <= 0 ? ' inv-urg-out' : (tot <= 3 ? ' inv-urg-low' : '');
        if (p.product_type === 'razmerli' && p.sizes) {
            let sizesHtml = p.sizes.map((s, idx) => `
                <div class="inv-size-row">
                    <span class="inv-size-name">${s.size}</span>
                    <div class="inv-controls">
                        <input type="number" id="inv-input-${p.id}-${idx}" class="inv-input" value="${s.stock}">
                        <button class="inv-btn" onclick="fastSaveSizeStock(${p.id}, ${idx})">Saqlash</button>
                    </div>
                </div>`).join('');
            return `
            <div class="inventory-item${urg}${selCls}" style="flex-direction:column; align-items:stretch;">
                <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
                    <div style="display:flex; align-items:center; flex:1; min-width:0;">${checkbox}<div class="inv-info"><h4>${p.name}${codeHint}</h4><p>${p.price.toLocaleString()} so'm ${flag}</p></div></div>
                    <span class="inv-type-tag">Razmerli</span>
                </div>
                <div style="margin-top:10px; border-top:1px dashed var(--glass-border); padding-top:5px;">${sizesHtml}</div>
            </div>`;
        } else {
            let st = p.stock !== undefined ? p.stock : 10;
            let nameParts = (p.name || '').split('·');
            let mainName = nameParts[0] ? nameParts[0].trim() : p.name;
            let carHint = nameParts[1] ? `<span class="car-hint">· ${nameParts[1].trim()}</span>` : '';
            return `
            <div class="inventory-item${urg}${selCls}">
                <div style="display:flex; align-items:center; flex:1; min-width:0;">${checkbox}<div class="inv-info"><h4>${mainName}${carHint}${codeHint}</h4><p>${p.price.toLocaleString()} so'm ${flag}</p></div></div>
                <div class="inv-controls">
                    <input type="number" id="inv-input-${p.id}" class="inv-input" value="${st}">
                    <button class="inv-btn" onclick="fastSaveStock(${p.id})">Saqlash</button>
                </div>
            </div>`;
        }
    }).join('');
    invUpdateBulkBar();
};

// ---------- 12) INIT: "o'zgarish bor" bayrog'ini kuzatish ----------
(function initAdminEnhancements() {
    ['addProductModal', 'editModal'].forEach(mid => {
        let m = document.getElementById(mid);
        if (m) m.addEventListener('input', () => { window._formDirty = true; });
    });
})();

// ============================================================
// ✨ DIZAYN ZAMONAVIYLASHTIRISH (10 ta) — yordamchi JS funksiyalar
// ============================================================

// #1 BRAND PLACEHOLDER (via.placeholder.com o'rniga inline SVG)
window._brandPlaceholder = (label) => {
    const txt = (label || 'A1').toString().substring(0, 5);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
        <defs>
            <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stop-color="#1c1c1e"/>
                <stop offset="100%" stop-color="#0a0a0c"/>
            </linearGradient>
            <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stop-color="#F0D060"/>
                <stop offset="50%" stop-color="#C9A84C"/>
                <stop offset="100%" stop-color="#96720A"/>
            </linearGradient>
        </defs>
        <rect width="200" height="200" fill="url(#g)"/>
        <rect x="6" y="6" width="188" height="188" rx="20" fill="none" stroke="url(#gold)" stroke-width="1.5" opacity="0.6"/>
        <g transform="translate(100,80)" fill="url(#gold)" opacity="0.85">
            <path d="M-30,15 L-25,5 L25,5 L30,15 L30,25 L-30,25 Z M-22,5 L-18,-8 L18,-8 L22,5 Z"/>
            <circle cx="-18" cy="25" r="6" fill="#0a0a0c" stroke="url(#gold)" stroke-width="2"/>
            <circle cx="18" cy="25" r="6" fill="#0a0a0c" stroke="url(#gold)" stroke-width="2"/>
        </g>
        <text x="100" y="150" text-anchor="middle" fill="url(#gold)" font-family="-apple-system,Segoe UI,sans-serif" font-weight="800" font-size="20" letter-spacing="2">${txt}</text>
    </svg>`;
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
};

// Eski via.placeholder.com URL'larini ushlab brand placeholder bilan almashtiramiz
// Bu yerda hech qanday mavjud kodga tegmaymiz — onerror va src'larini global ushlaymiz.
document.addEventListener('error', function(e) {
    let el = e.target;
    if (!el || el.tagName !== 'IMG') return;
    let s = el.src || '';
    if (s.indexOf('via.placeholder.com') !== -1 || s === '' || el.dataset._placed === '1') {
        if (el.dataset._placed !== '1') {
            el.dataset._placed = '1';
            el.src = window._brandPlaceholder('A1');
        }
    }
}, true);

// Sahifa yuklanganda mavjud via.placeholder.com chaqiruvlarini ham almashtiramiz
window.addEventListener('load', () => {
    document.querySelectorAll('img').forEach(img => {
        if (img.src && img.src.indexOf('via.placeholder.com') !== -1) {
            img.src = window._brandPlaceholder('A1');
        }
    });
});

// #6 SKELETON KARTOCHKALAR (yuklanish vaqtida)
window._skeletonCards = (count) => {
    let html = '';
    for (let i = 0; i < (count || 6); i++) {
        html += `<div class="sk-card"><div class="sk-bone sk-img"></div><div class="sk-bone sk-line"></div><div class="sk-bone sk-line short"></div><div class="sk-bone sk-line tall"></div></div>`;
    }
    return html;
};

// #7 EMPTY STATE — chiroyli "topilmadi" / "bo'sh" komponenti
window._emptyState = (opts) => {
    opts = opts || {};
    let icon = opts.icon || `<svg viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>`;
    let title = opts.title || "Hech narsa topilmadi";
    let desc = opts.desc || "Boshqa nomdan qidirib ko'ring";
    let btn = opts.btnText ? `<button class="es-btn" onclick="${opts.btnAction || ''}">${opts.btnText}</button>` : '';
    return `<div class="empty-state-pro"><div class="es-icon">${icon}</div><h3 class="es-title">${title}</h3><p class="es-desc">${desc}</p>${btn}</div>`;
};

// #3 SHOW TOAST yangilanishi (mavjud showToast'ni o'rab, premium klasslar qo'shadi)
if (typeof window.showToast === 'function' && !window._origShowToast) {
    window._origShowToast = window.showToast;
    window.showToast = function(m, t) {
        window._origShowToast(m, t);
        // Eng so'nggi qo'shilgan toast'ga rangli chiziq klassi qo'shamiz
        const c = document.getElementById('toast-container');
        if (c && c.lastElementChild) {
            const cls = (t === 'warning') ? 'toast-warning' : (t === 'error' ? 'toast-error' : 'toast-success');
            c.lastElementChild.classList.add(cls);
        }
    };
}

// ============================================================
// 🚀 KENGAYTIRISH 2 — JS YORDAMCHILAR (24 ta yangilik)
// ============================================================

// 3.8 UNIVERSAL HAPTIC
window._hap = (kind) => {
    // tg.HapticFeedback yuqorida MARKAZIY sozlangan: Telegram ICHIDA native haptic,
    // brauzer/APK'da esa navigator.vibrate. Shuning uchun shu yerda faqat yo'naltiramiz.
    try {
        if (typeof tg !== 'undefined' && tg.HapticFeedback) {
            if (kind === 'success') tg.HapticFeedback.notificationOccurred('success');
            else if (kind === 'warning') tg.HapticFeedback.notificationOccurred('warning');
            else if (kind === 'error') tg.HapticFeedback.notificationOccurred('error');
            else if (kind === 'selection') tg.HapticFeedback.selectionChanged();
            else tg.HapticFeedback.impactOccurred(kind || 'light');
            return;
        }
    } catch (e) {}
    // Zaxira (tg.HapticFeedback umuman bo'lmagan kamdan-kam holat uchun)
    try {
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
            navigator.vibrate(kind === 'success' ? [10, 30, 10]
                : (kind === 'warning' || kind === 'error') ? [18, 40, 18]
                : kind === 'selection' ? 5 : 10);
        }
    } catch (e) {}
};

// 1.1 HEART BURST
window._burstHeart = (btnEl) => {
    if (!btnEl) return;
    btnEl.classList.add('burst');
    setTimeout(() => btnEl.classList.remove('burst'), 500);
    for (let i = 0; i < 6; i++) {
        const p = document.createElement('div');
        p.className = 'heart-particle';
        const angle = (Math.PI * 2 * i) / 6;
        const dist = 28 + Math.random() * 12;
        p.style.setProperty('--tx', Math.cos(angle) * dist + 'px');
        p.style.setProperty('--ty', Math.sin(angle) * dist + 'px');
        btnEl.appendChild(p);
        setTimeout(() => p.remove(), 800);
    }
    _hap('light');
};

// 1.5 KONFETTI
window._fireConfetti = (count) => {
    count = count || 36;
    const colors = ['#F0D060', '#C9A84C', '#fff', '#30d158', '#0a84ff'];
    for (let i = 0; i < count; i++) {
        const piece = document.createElement('div');
        piece.className = 'confetti-piece';
        piece.style.left = Math.random() * 100 + '%';
        piece.style.background = colors[Math.floor(Math.random() * colors.length)];
        piece.style.animationDelay = (Math.random() * 0.5) + 's';
        piece.style.animationDuration = (2 + Math.random() * 1.5) + 's';
        document.body.appendChild(piece);
        setTimeout(() => piece.remove(), 4500);
    }
};

// 1.9 CART ICON SHAKE
window._shakeCartIcon = () => {
    const cart = document.getElementById('nav-cart');
    if (!cart) return;
    cart.classList.remove('shaking');
    void cart.offsetWidth;
    cart.classList.add('shaking');
    setTimeout(() => cart.classList.remove('shaking'), 600);
};

// 2.1 ORDER STATUS TIMELINE (mijozga ko'rinadigan)
window._renderOrderTimeline = (status) => {
    const steps = [
        { k: 'kutilmoqda', label: 'Yangi buyurtma' },
        { k: 'qabul', label: 'Qabul qildik' },
        { k: 'yolda', label: "Yo'lga chiqdi" },
        { k: 'yetkazildi', label: 'Yetkazib berildi' }
    ];
    if (status === 'bekor_qilingan') {
        return `<div class="order-timeline"><div class="tl-step"><div class="tl-dot" style="background:#ff453a;border-color:#ff453a;color:#fff;">✕</div><div class="tl-text" style="color:#ff453a;font-weight:800;">Buyurtma bekor qilingan</div></div></div>`;
    }
    let activeIdx = steps.findIndex(s => s.k === status);
    if (activeIdx < 0) activeIdx = 0;
    return '<div class="order-timeline">' + steps.map((s, i) => {
        const cls = i < activeIdx ? 'done' : (i === activeIdx ? 'active' : '');
        const sym = i < activeIdx ? '✓' : (i + 1);
        return `<div class="tl-step ${cls}"><div class="tl-dot">${sym}</div><div class="tl-text">${s.label}</div></div>`;
    }).join('') + '</div>';
};

// 2.3 PROFIL STATISTIKA
window._renderProfileStats = () => {
    const box = document.getElementById('pf-stats-box');
    if (!box) return;
    if (!window.currentUser) return;
    // myOrders lokal let o'zgaruvchisi -> window'dan foydalanib bo'lmaydi.
    // Firebase'dan qayta o'qiymiz (yengil, bir marta)
    db.ref('users/' + window.currentUser + '/orders').once('value', (snap) => {
        const orders = snap.val() || [];
        const totalOrders = Array.isArray(orders) ? orders.length : Object.keys(orders).length;
        const ordersArr = Array.isArray(orders) ? orders : Object.values(orders);
        const totalSpent = ordersArr.filter(o => o && o.status === 'yetkazildi').reduce((s, o) => s + (o.total || 0), 0);
        const wishCount = (document.querySelectorAll && document.querySelectorAll('.btn-wishlist.active') || []).length || 0;
        const fmt = (n) => n >= 1000000 ? (n/1000000).toFixed(1).replace(/\.0$/,'') + 'M' : (n >= 1000 ? Math.round(n/1000) + 'K' : n);
        box.innerHTML = `
            <div class="pf-stats">
                <div class="pf-stat-card"><div class="pf-stat-num">${totalOrders}</div><div class="pf-stat-lbl">Buyurtma</div></div>
                <div class="pf-stat-card"><div class="pf-stat-num">${fmt(totalSpent)}</div><div class="pf-stat-lbl">Sarflangan</div></div>
                <div class="pf-stat-card"><div class="pf-stat-num">${wishCount}</div><div class="pf-stat-lbl">Saqlangan</div></div>
            </div>`;
    });
};

// 4.3 NOTIFY ME — tugagan tovar uchun
window.notifyMeForProduct = (productId) => {
    if (!window.currentUser) { showToast('Iltimos avval profil yarating', 'warning'); return; }
    if (!productId) return;
    db.ref(`notify_requests/${productId}/${window.currentUser}`)
        .set({ time: Date.now(), userId: window.currentUser, name: (window.myProfile && window.myProfile.name) || '', phone: (window.myProfile && window.myProfile.phone) || '' })
        .then(() => { showToast('🔔 Sotuvga kirsa, sizga xabar beramiz!', 'success'); _hap('success'); })
        .catch(() => showToast('Xato! Internetni tekshiring', 'warning'));
};

// 4.6 COMPARE
window.compareList = [];
window.toggleCompare = (productId, e) => {
    if (e) { e.stopPropagation(); e.preventDefault(); }
    let product = (window.productsDB || []).find(x => x.id == productId);
    if (!product) { showToast("Tovar topilmadi. Sahifani yangilang.", "warning"); return; }
    let pid = String(productId);
    const idx = window.compareList.indexOf(pid);
    if (idx >= 0) {
        window.compareList.splice(idx, 1);
        showToast("Taqqoslashdan chiqarildi", "warning");
    } else {
        if (window.compareList.length >= 2) window.compareList.shift();
        window.compareList.push(pid);
        _hap('light');
        showToast(window.compareList.length === 1 ? "1/2 tanlandi — yana bitta bosing" : "Tayyor! Animatsiyali tarozi tugmasini bosing", "success");
    }
    updateCompareBar();
    updateCompareBtnStates();
};
window.updateCompareBar = () => {
    let bar = document.getElementById('compare-bar');
    if (!bar) {
        bar = document.createElement('div');
        bar.id = 'compare-bar';
        document.body.appendChild(bar);
    }
    if (window.compareList.length < 2) { bar.classList.remove('show'); bar.innerHTML = ''; return; }
    bar.classList.add('show');
    bar.innerHTML = '<button type="button" class="cmp-fab" onclick="openCompareModal()" aria-label="Tanlangan 2 ta tovarni taqqoslash"><span class="cmp-fab-ring" aria-hidden="true"></span><svg class="cmp-scale" viewBox="0 0 48 48" aria-hidden="true"><path class="cmp-scale-stand" d="M22 13h4v24h8v4H14v-4h8V13Z"/><circle class="cmp-scale-crown" cx="24" cy="10" r="4"/><g class="cmp-scale-beam"><path d="M9 15h30"/><path d="M24 10v5"/><g class="cmp-scale-pan cmp-scale-pan-left"><path d="M12 15 7 27M12 15l5 12"/><path d="M5 27c.5 4 3.2 6 7 6s6.5-2 7-6H5Z"/></g><g class="cmp-scale-pan cmp-scale-pan-right"><path d="m36 15-5 12m5-12 5 12"/><path d="M29 27c.5 4 3.2 6 7 6s6.5-2 7-6H29Z"/></g></g></svg><span class="cmp-fab-badge">2</span><span class="cmp-fab-label">Taqqoslash</span></button>';
};
window.updateCompareBtnStates = () => {
    document.querySelectorAll('.btn-compare, .btn-compare-card').forEach(btn => {
        let oc = btn.getAttribute('onclick') || '';
        let match = oc.match(/toggleCompare\((\d+)/);
        if (match) {
            let id = match[1];
            if (window.compareList.includes(id)) btn.classList.add('active');
            else btn.classList.remove('active');
        }
    });
};
window.openCompareModal = () => {
    if (window.compareList.length < 2) { showToast('2 ta tovar belgilang', 'warning'); return; }
    let m = document.getElementById('compareModal');
    if (!m) { m = document.createElement('div'); m.id = 'compareModal'; m.className = 'modal-standard'; document.body.appendChild(m); }
    const products = window.compareList.map(pid => (window.productsDB || []).find(x => x.id == pid)).filter(Boolean);
    if (products.length < 2) { showToast("Sahifani yangilang va qaytadan belgilang.", "warning"); window.compareList=[]; updateCompareBar(); return; }
    const [a, b] = products;
    const priceDiff = Math.abs(a.price - b.price);
    const cheaperIdx = a.price <= b.price ? 0 : 1;
    const pctDiff = Math.round((priceDiff / Math.max(a.price, b.price)) * 100);
    const diffLabel = priceDiff > 0 ? (pctDiff + '% arzonroq (' + priceDiff.toLocaleString() + " so'm farq)") : "Narxlari teng";
    const stockA = a.stock !== undefined ? a.stock : ((a.sizes||[]).reduce((s,x)=>s+(x.stock||0),0));
    const stockB = b.stock !== undefined ? b.stock : ((b.sizes||[]).reduce((s,x)=>s+(x.stock||0),0));
    const carNames = window.CAR_NAMES || {};
    const getCars = (p) => (p.categories || [p.category]).map(c => carNames[c] || c).filter(Boolean).join(', ') || 'Universal';
    const rows = [
        ['Narx', a.price.toLocaleString()+" so'm", b.price.toLocaleString()+" so'm", cheaperIdx===0, cheaperIdx===1],
        ['Kod', a.code||'—', b.code||'—', false, false],
        ['Birlik', a.unit==='komplekt'?'Komplekt':'Dona', b.unit==='komplekt'?'Komplekt':'Dona', false, false],
        ['Ombor', stockA>0?stockA+' ta':'Tugagan', stockB>0?stockB+' ta':'Tugagan', stockA>stockB, stockB>stockA],
        ['Mashina', getCars(a), getCars(b), false, false],
        ['Turi', a.product_type==='razmerli'?'Razmerli':'Oddiy', b.product_type==='razmerli'?'Razmerli':'Oddiy', false, false]
    ];
    const rowsHtml = rows.map(r => '<div style="display:grid;grid-template-columns:90px 1fr 1fr;gap:6px;padding:10px 12px;border-top:1px solid rgba(255,255,255,0.05);">' +
        '<div style="font-size:11px;color:var(--text-muted);font-weight:700;">' + r[0] + '</div>' +
        '<div style="font-size:12px;font-weight:700;color:' + (r[3]?'#30d158':'#fff') + ';">' + r[1] + '</div>' +
        '<div style="font-size:12px;font-weight:700;color:' + (r[4]?'#30d158':'#fff') + ';">' + r[2] + '</div></div>').join('');
    m.innerHTML = '<div class="modal-header" style="position:sticky;top:0;z-index:10;background:rgba(10,10,12,0.95);backdrop-filter:blur(10px);"><h2 style="color:var(--luxury-gold);margin:0;font-size:18px;"><svg class="uic" aria-hidden="true"><use href="#i-compare"></use></svg>Taqqoslash</h2><button class="close-btn" aria-label="Yopish" onclick="closeModal()">×</button></div>' +
        '<div style="padding:16px;"><div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">' +
        '<div style="text-align:center;"><img src="'+(a.img||window._brandPlaceholder('A1'))+'" onerror="this.src=window._brandPlaceholder(\'A1\')" style="width:100%;aspect-ratio:1/1;object-fit:contain;background:#fff;border-radius:14px;padding:8px;box-sizing:border-box;"><h4 style="font-size:13px;color:#fff;margin:8px 0 4px;line-height:1.3;">'+a.name.split('·')[0].trim()+'</h4><div style="color:var(--luxury-gold);font-weight:800;font-size:16px;">'+a.price.toLocaleString()+' so\'m</div></div>' +
        '<div style="text-align:center;"><img src="'+(b.img||window._brandPlaceholder('A1'))+'" onerror="this.src=window._brandPlaceholder(\'A1\')" style="width:100%;aspect-ratio:1/1;object-fit:contain;background:#fff;border-radius:14px;padding:8px;box-sizing:border-box;"><h4 style="font-size:13px;color:#fff;margin:8px 0 4px;line-height:1.3;">'+b.name.split('·')[0].trim()+'</h4><div style="color:var(--luxury-gold);font-weight:800;font-size:16px;">'+b.price.toLocaleString()+' so\'m</div></div></div>' +
        (priceDiff > 0 ? '<div style="background:rgba(48,209,88,0.1);border:1px solid rgba(48,209,88,0.3);border-radius:12px;padding:10px 14px;margin-bottom:14px;text-align:center;"><span style="color:#30d158;font-weight:800;font-size:13px;">✅ '+products[cheaperIdx].name.split('·')[0].trim()+' — '+diffLabel+'</span></div>' : '') +
        '<div style="border-radius:14px;overflow:hidden;border:1px solid var(--glass-border);margin-bottom:16px;">' +
        '<div style="display:grid;grid-template-columns:90px 1fr 1fr;gap:6px;padding:10px 12px;background:rgba(255,255,255,0.03);"><div style="font-size:10px;color:var(--text-muted);font-weight:800;text-transform:uppercase;">Xususiyat</div><div style="font-size:10px;color:var(--luxury-gold);font-weight:800;">1-tovar</div><div style="font-size:10px;color:var(--luxury-gold);font-weight:800;">2-tovar</div></div>' + rowsHtml + '</div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;"><button onclick="closeModal();setTimeout(()=>openProduct('+a.id+'),150)" style="padding:13px;background:var(--gold-gradient);color:#000;border:none;border-radius:12px;font-weight:800;font-size:12px;cursor:pointer;">🛒 Ochish</button><button onclick="closeModal();setTimeout(()=>openProduct('+b.id+'),150)" style="padding:13px;background:var(--gold-gradient);color:#000;border:none;border-radius:12px;font-weight:800;font-size:12px;cursor:pointer;">🛒 Ochish</button></div></div>';
    if (typeof openModal === 'function') openModal('compareModal');
    else { m.style.display='flex'; window.activeModal='compareModal'; }
};

// 5.1 XABAR YUBORISH (admin) — hammaga, tanlangan bir nechta yoki bitta mijozga.
//     Yetkazish o'zgarmadi: har bir xabar `tgProxySend` -> Worker -> Telegram.
// Faqat HAQIQIY Telegram chat_id (sof raqamli). Soxta ID (apk_*, tg_url_*) — skip.
window._isTelegramId = function (uid) { return /^\d+$/.test(String(uid)); };
(function () {
    var BC = { mode: 'all', sel: {}, users: [], q: '', busy: false, fake: 0, loaded: false };
    var $ = function (id) { return document.getElementById(id); };
    var esc = function (v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (ch) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]; }); };
    var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
    var hap = function (k) { try { if (window._hap) window._hap(k); } catch (e) {} };
    var DBX = function () { try { if (typeof db !== 'undefined' && db) return db; } catch (e) {} return (window.firebase && firebase.database) ? firebase.database() : null; };

    function ensureModal() {
        var m = $('broadcastModal');
        if (m) return m;
        m = document.createElement('div');
        m.id = 'broadcastModal';
        m.className = 'modal-standard';
        m.innerHTML =
            '<div class="modal-header"><h2><svg class="uic" aria-hidden="true"><use href="#i-megaphone"></use></svg>Xabar yuborish</h2><button class="close-btn" aria-label="Yopish" onclick="closeModal()">\u00D7</button></div>' +
            '<div class="bcx">' +
                '<div class="bcx-seg" id="bcx-seg"><button type="button" data-m="all" class="on">Hammaga</button><button type="button" data-m="pick">Tanlanganlarga</button></div>' +
                '<p class="bcx-sec">Xabar</p>' +
                '<div class="bcx-grp"><textarea id="bc-text" rows="5" maxlength="3500" placeholder="Assalomu alaykum! Yangi chegirmalarimiz bilan tanishing..."></textarea></div>' +
                '<p class="bcx-hint">Faqat Telegram mijozlariga boradi, bloklanganlar o\u2018tkazib yuboriladi. HTML ishlatish mumkin: &lt;b&gt;qalin&lt;/b&gt;</p>' +
                '<div id="bcx-pick" hidden>' +
                    '<p class="bcx-sec"><span>Qabul qiluvchilar</span><button type="button" class="bcx-link" id="bcx-clear">Tozalash</button></p>' +
                    '<label class="bcx-search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><line x1="20" y1="20" x2="16.2" y2="16.2"/></svg><input type="text" id="bcx-q" placeholder="Ism yoki telefon" autocomplete="off"></label>' +
                    '<div class="bcx-grp bcx-list" id="bcx-list"><div class="bcx-empty">Yuklanmoqda...</div></div>' +
                '</div>' +
                '<div class="bcx-stats" id="bcx-stats" hidden>' +
                    '<div><b id="bc-count">0</b><span>Jami</span></div>' +
                    '<div><b id="bc-sent">0</b><span>Yuborildi</span></div>' +
                    '<div><b id="bc-failed">0</b><span>Xato</span></div>' +
                    '<div><b id="bc-skipped">0</b><span>O\u2018tkazildi</span></div>' +
                '</div>' +
                '<p class="bcx-wait" id="bcx-wait" hidden></p>' +
            '</div>' +
            '<div class="bcx-foot"><button type="button" id="bc-send-btn" onclick="sendBroadcast()">Yuborish</button></div>';
        document.body.appendChild(m);
        $('bcx-seg').onclick = function (e) {
            var b = e.target.closest ? e.target.closest('button[data-m]') : null;
            if (!b || BC.busy) return;
            setMode(b.getAttribute('data-m'));
            hap('selection');
        };
        $('bcx-q').oninput = function () { BC.q = this.value || ''; renderPick(); };
        $('bcx-clear').onclick = function () { if (BC.busy) return; BC.sel = {}; renderPick(); paint(); };
        $('bcx-list').onclick = function (e) {
            var r = e.target.closest ? e.target.closest('.bcx-row') : null;
            if (!r || BC.busy || r.classList.contains('is-blk')) return;
            var id = r.getAttribute('data-uid');
            if (BC.sel[id]) delete BC.sel[id]; else BC.sel[id] = true;
            r.classList.toggle('on', !!BC.sel[id]);
            hap('selection');
            paint();
        };
        return m;
    }

    function setMode(md) {
        BC.mode = md === 'pick' ? 'pick' : 'all';
        var seg = $('bcx-seg');
        if (seg) Array.prototype.forEach.call(seg.querySelectorAll('button'), function (x) { x.classList.toggle('on', x.getAttribute('data-m') === BC.mode); });
        var pk = $('bcx-pick'); if (pk) pk.hidden = BC.mode !== 'pick';
        if (BC.mode === 'pick') renderPick();
        paint();
    }

    function recipients() {
        if (BC.mode === 'all') return BC.users.filter(function (u) { return !u.blocked; }).map(function (u) { return u.uid; });
        return Object.keys(BC.sel).filter(function (id) { return BC.sel[id] && window._isTelegramId(id) && !(window._blockedMap || {})[id]; });
    }

    function paint() {
        var btn = $('bc-send-btn');
        if (!btn || BC.busy) return;
        var n = recipients().length;
        btn.disabled = !BC.loaded || n === 0;
        btn.textContent = !BC.loaded ? 'Yuklanmoqda...' : (n === 0 ? 'Qabul qiluvchini tanlang' : (n + ' kishiga yuborish'));
    }

    function renderPick() {
        var box = $('bcx-list');
        if (!box || BC.mode !== 'pick') return;
        if (!BC.loaded) { box.innerHTML = '<div class="bcx-empty">Yuklanmoqda...</div>'; return; }
        var q = BC.q.toLowerCase().trim();
        var list = BC.users.filter(function (u) {
            return !q || u.name.toLowerCase().indexOf(q) !== -1 || (u.phone || '').toLowerCase().indexOf(q) !== -1 || u.uid.indexOf(q) !== -1;
        });
        // Tanlanganlar tepada turadi — kimga ketishini darhol ko'rish uchun
        list.sort(function (a, b) { return (BC.sel[b.uid] ? 1 : 0) - (BC.sel[a.uid] ? 1 : 0); });
        var more = list.length > 150 ? list.length - 150 : 0;
        list = list.slice(0, 150);
        box.innerHTML = list.length ? list.map(function (u) {
            return '<div class="bcx-row' + (BC.sel[u.uid] ? ' on' : '') + (u.blocked ? ' is-blk' : '') + '" role="button" tabindex="0" data-uid="' + esc(u.uid) + '">' +
                '<span class="bcx-chk" aria-hidden="true"></span>' +
                '<span class="bcx-mid"><b>' + esc(u.name) + '</b><span>' + esc(u.phone || 'Telefon yo\u2018q') + '</span></span>' +
                (u.blocked ? '<span class="bcx-blk">Bloklangan</span>' : '') +
            '</div>';
        }).join('') + (more ? '<div class="bcx-empty">Yana ' + more + ' ta \u2014 qidiruvdan foydalaning</div>' : '')
            : '<div class="bcx-empty">Mijoz topilmadi</div>';
    }

    function loadUsers() {
        var d = DBX();
        if (!d) return Promise.reject(new Error('Baza ulanmagan'));
        var snapP = window._getUsersSnap ? window._getUsersSnap() : d.ref('users').once('value');
        var blkP = d.ref('blocked_users').once('value').then(function (x) { return x.val() || {}; }, function () { return {}; });
        return Promise.all([snapP, blkP]).then(function (r) {
            var us = (r[0] && r[0].val && r[0].val()) || {};
            var bm = r[1] || {};
            window._blockedMap = bm;
            var all = Object.keys(us);
            BC.fake = all.filter(function (u) { return !window._isTelegramId(u); }).length;
            BC.users = all.filter(window._isTelegramId).map(function (uid) {
                var p = (us[uid] && us[uid].profile) || {};
                return { uid: String(uid), name: String(p.name || p.firstName || 'Nomsiz mijoz'), phone: String(p.phone || ''), blocked: !!bm[uid] };
            }).sort(function (a, b) { return a.name.localeCompare(b.name, 'uz'); });
            BC.loaded = true;
        });
    }

    /** ids — ixtiyoriy: oldindan tanlangan mijozlar (masalan mijoz kartasidan). */
    window.openBroadcastModal = function (ids) {
        ensureModal();
        if (!BC.busy) {
            if (Array.isArray(ids) && ids.length) {
                BC.sel = {};
                ids.forEach(function (id) { BC.sel[String(id)] = true; });
                setMode('pick');
            } else {
                setMode(BC.mode);
            }
        }
        if (typeof openModal === 'function') openModal('broadcastModal');
        else { var m = $('broadcastModal'); m.style.display = 'flex'; window.activeModal = 'broadcastModal'; }
        paint();
        loadUsers().then(function () { renderPick(); paint(); }).catch(function (e) {
            try { showToast('Mijozlar yuklanmadi: ' + (e.message || e), 'warning'); } catch (x) {}
        });
    };

    window.sendBroadcast = function () {
        if (BC.busy) return;
        var txtEl = $('bc-text');
        var text = (txtEl ? txtEl.value : '').trim();
        if (text.length < 2) { showToast('Xabar matnini yozing', 'warning'); return; }
        var ids = recipients();
        if (!ids.length) { showToast('Qabul qiluvchini tanlang', 'warning'); return; }
        var q = BC.mode === 'all' ? ('Xabar hamma (' + ids.length + ' kishi)ga yuborilsinmi?') : (ids.length + ' kishiga yuborilsinmi?');
        if (typeof tg !== 'undefined' && tg.showConfirm) {
            tg.showConfirm(q, function (ok) { if (ok) window._doBroadcast(text, ids); });
        } else if (confirm(q)) window._doBroadcast(text, ids);
    };

    window._doBroadcast = async function (text, ids) {
        if (BC.busy) return;
        if (!Array.isArray(ids)) {   // eski chaqiruv: hammaga
            if (!BC.loaded) { try { await loadUsers(); } catch (e) {} }
            BC.mode = 'all';
            ids = recipients();
        }
        BC.busy = true;
        var btn = $('bc-send-btn');
        var stats = $('bcx-stats'), wait = $('bcx-wait');
        var setN = function (id, v) { var el = $(id); if (el) el.textContent = v; };
        var sent = 0, failed = 0;
        var skipped = BC.mode === 'all' ? (BC.fake + BC.users.filter(function (u) { return u.blocked; }).length) : 0;
        if (stats) stats.hidden = false;
        setN('bc-count', ids.length); setN('bc-sent', 0); setN('bc-failed', 0); setN('bc-skipped', skipped);
        if (btn) { btn.disabled = true; btn.textContent = 'Yuborilmoqda... 0/' + ids.length; }
        try {
            for (var i = 0; i < ids.length; i++) {
                var uid = ids[i], ok = false;
                for (var attempt = 0; attempt < 6 && !ok; attempt++) {
                    try {
                        var res = await window.tgProxySend({ chat_id: uid, text: text, parse_mode: 'HTML' });
                        var j = null;
                        try { j = await res.json(); } catch (e) {}
                        if (j && j.ok) { ok = true; break; }
                        // Limit: Worker (retryAfter) yoki Telegram (retry_after / telegramStatus 429)
                        var waitS = 0;
                        if (res.status === 429 || (j && (j.error_code === 429 || j.telegramStatus === 429))) {
                            waitS = (j && (j.retryAfter || (j.parameters && j.parameters.retry_after)))
                                || parseInt(res.headers.get('Retry-After') || '0', 10) || 5;
                        }
                        if (waitS > 0) {
                            waitS = Math.min(90, waitS);
                            if (wait) { wait.hidden = false; wait.textContent = 'Telegram limiti: ' + waitS + ' soniya kutilmoqda. Oynani yopmang.'; }
                            await sleep(waitS * 1000 + 300);
                            if (wait) wait.hidden = true;
                            continue;
                        }
                        break; // boshqa xato (mas. mijoz botni bloklagan) — qayta urinmaymiz
                    } catch (e) {
                        if (attempt === 0) { await sleep(1500); continue; }
                        break;
                    }
                }
                if (ok) sent++; else failed++;
                setN('bc-sent', sent); setN('bc-failed', failed);
                if (btn) btn.textContent = 'Yuborilmoqda... ' + (i + 1) + '/' + ids.length;
                await sleep(60);
            }
            try { showToast('\u2705 Yuborildi: ' + sent + ' | Xato: ' + failed, 'success'); } catch (e) {}
            try { var d = DBX(); if (d) d.ref('broadcasts').push({ text: text, sent: sent, failed: failed, skipped: skipped, mode: BC.mode, count: ids.length, time: Date.now() }); } catch (e) {}
            var te = $('bc-text'); if (te && failed === 0) te.value = '';
        } catch (e) {
            try { showToast('Xato: ' + (e.message || e), 'warning'); } catch (x) {}
        } finally {
            BC.busy = false;
            if (wait) wait.hidden = true;
            paint();
        }
    };
})();

// 1.6 PULL-TO-REFRESH — OLIB TASHLANDI (foydalanuvchi so'roviga ko'ra: pastga
//      tortib yangilash kerak emas. Ma'lumot baribir real-time yangilanadi.)

// 2.8 SWIPE-TO-DELETE (cart row)
(function swipeInit(){
    let startX = 0, startY = 0, deltaX = 0, target = null, isHorizontal = null;
    const threshold = 50;
    document.addEventListener('touchstart', (e) => {
        const row = e.target.closest('.cart-row');
        if (!row) {
            // Boshqa joyga bossa, ochiq swipe rowni yopamiz
            document.querySelectorAll('.cart-row.show-delete').forEach(r => r.classList.remove('show-delete'));
            return;
        }
        document.querySelectorAll('.cart-row.show-delete').forEach(r => { if (r !== row) r.classList.remove('show-delete'); });
        target = row;
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        deltaX = 0;
        isHorizontal = null;
    }, {passive: true});
    document.addEventListener('touchmove', (e) => {
        if (!target) return;
        const dx = e.touches[0].clientX - startX;
        const dy = e.touches[0].clientY - startY;
        if (isHorizontal === null && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
            isHorizontal = Math.abs(dx) > Math.abs(dy);
        }
        if (isHorizontal) {
            deltaX = Math.min(0, dx);
            const wrap = target.querySelector('.cart-content-wrap');
            if (wrap) {
                wrap.style.transition = 'none';
                wrap.style.transform = `translateX(${Math.max(deltaX, -100)}px)`;
            }
        }
    }, {passive: true});
    document.addEventListener('touchend', () => {
        if (!target) return;
        const wrap = target.querySelector('.cart-content-wrap');
        if (wrap) wrap.style.transition = '';
        if (isHorizontal && deltaX < -threshold) {
            target.classList.add('show-delete');
            if (wrap) wrap.style.transform = '';
        } else {
            target.classList.remove('show-delete');
            if (wrap) wrap.style.transform = '';
        }
        target = null; deltaX = 0; isHorizontal = null;
    }, {passive: true});
})();

/* 🃏 Kartani surib savatga / sevimlilarga qo'shish OLIB TASHLANDI —
   skroll paytida tasodifan tovar savatga tushib qolardi. */

// 1.3 BOTTOM NAV PULSE — har bir nav-item bosilganda
document.addEventListener('click', (e) => {
    const tab = e.target.closest('.nav-item');
    if (!tab) return;
    tab.classList.remove('tab-pulse');
    void tab.offsetWidth;
    tab.classList.add('tab-pulse');
    setTimeout(() => tab.classList.remove('tab-pulse'), 400);
});

// 1.1 + Wishlist toggle wrap
if (typeof window.toggleWishlist === 'function' && !window._origToggleWishlist) {
    window._origToggleWishlist = window.toggleWishlist;
    window.toggleWishlist = function(e, id) {
        const before = (window.wishlist || []).includes(id);
        const r = window._origToggleWishlist.apply(this, arguments);
        const after = (window.wishlist || []).includes(id);
        if (!before && after && e && e.target) {
            const btn = e.target.closest('.btn-wishlist');
            if (btn) _burstHeart(btn);
        }
        return r;
    };
}

// 1.9 Cart shake — addToCart wrap
if (typeof window.addToCart === 'function' && !window._origAddToCart_v2) {
    window._origAddToCart_v2 = window.addToCart;
    window.addToCart = function() {
        const r = window._origAddToCart_v2.apply(this, arguments);
        try { _shakeCartIcon(); } catch (e) {}
        return r;
    };
}
if (typeof window.addToCartWithOptions === 'function' && !window._origAddToCartWithOptions_v2) {
    window._origAddToCartWithOptions_v2 = window.addToCartWithOptions;
    window.addToCartWithOptions = function() {
        const r = window._origAddToCartWithOptions_v2.apply(this, arguments);
        try { _shakeCartIcon(); } catch (e) {}
        return r;
    };
}

// 1.5 Konfetti — confirmOrder muvaffaqiyatda
// CSS SUCCESS CHECK (Lottie O'RNIGA) — buyurtma muvaffaqiyatda chiziladigan belgi.
window._showSuccessCheck = function(){
    try {
        var rm = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
        var ov = document.createElement('div');
        ov.className = 'css-check-overlay';
        ov.innerHTML = '<div class="css-check-circle"><svg viewBox="0 0 24 24"><path d="M5 13l4 4L19 7"/></svg></div>';
        document.body.appendChild(ov);
        setTimeout(function(){ try { ov.remove(); } catch(e){} }, rm ? 700 : 1100);
    } catch(e){}
};
if (typeof window.confirmOrder === 'function' && !window._origConfirmOrder_v2) {
    window._origConfirmOrder_v2 = window.confirmOrder;
    window.confirmOrder = async function() {
        const r = await window._origConfirmOrder_v2.apply(this, arguments);
        // ⚠️ TUZATILDI: ilgari bu yerda pticha + konfetti SHARTSIZ ko'rsatilardi.
        //    Ya'ni internet uzilganda, 15 soniya spam himoyasi ishlaganda yoki
        //    omborda tovar yetmaganda ham mijoz yashil "muvaffaqiyat" belgisini
        //    ko'rardi va buyurtma o'tgan deb o'ylardi. Endi faqat HAQIQIY
        //    muvaffaqiyatda ({ok:true}) tabriklanadi.
        try {
            if (r && r.ok === true) { _showSuccessCheck(); _fireConfetti(40); _hap('success'); }
        } catch (e) {}
        return r;
    };
}

// 2.3 + showProfile wrap (statistikani qo'shish)
// Profil ochilganda qo'shimcha bo'limlarni render qilish.
// (Avval v2 + v3 ikkita alohida wrapper edi — bitta wrapperga birlashtirildi,
//  _renderProfileStats() endi ikki marta emas, bir marta chaqiriladi.)
if (typeof window.showProfile === 'function' && !window._origShowProfileExt) {
    window._origShowProfileExt = window.showProfile;
    window.showProfile = function() {
        const r = window._origShowProfileExt.apply(this, arguments);
        setTimeout(() => {
            try { renderMyCar(); } catch(e) {}
            try { renderAddresses(); } catch(e) {}
            try { _renderProfileStats(); } catch(e) {}
        }, 50);
        return r;
    };
}

// updateProfileUI yoki renderMyOrders chaqirilganda statni yangilash
if (typeof window.updateProfileUI === 'function' && !window._origUpdProfUI) {
    window._origUpdProfUI = window.updateProfileUI;
    window.updateProfileUI = function() {
        const r = window._origUpdProfUI.apply(this, arguments);
        try { _renderProfileStats(); } catch (e) {}
        return r;
    };
}
    
    // ============================================================
// 🚗 SHAXSIY KABINET — YANGI FUNKSIYALAR
// ============================================================

// MENING MASHINAM — bu blok fayl OXIRIDAGI "QATLAM 2026.13" ga ko'chirildi.
// ------------------------------------------------------------------
// Nega ko'chirildi:
//   1) mashinalar ro'yxati shu yerda QATTIQ yozilgan edi, endi u yagona
//      manbada — `window.MY_CAR_BRANDS` (ikki joyda takrorlanmaydi);
//   2) mashinani endi «Ma'lumot» oynasidan ham o'zgartirish mumkin,
//      shuning uchun saqlash mantig'i bitta funksiyaga (`saveMyCar`) yig'ildi;
//   3) eski matn "faqat shu mashinaga mos tovarlarni ko'rsatamiz" deb
//      va'da berardi, lekin bunday FILTR KODDA UMUMAN YO'Q edi — yolg'on
//      va'da olib tashlandi;
//   4) eski `renderMyCar` nomni `split('-')` bilan ajratib bo'sh joy bilan
//      qo'shardi — modelda chiziqcha bo'lsa nom buzilardi.
// Funksiyalar (openMyCarModal / saveMyCarChoice / renderMyCar) o'sha
// nomlar bilan qatlamda qayta belgilangan — tashqi chaqiruvlar buzilmaydi.

// MANZILLAR — bir nechta manzil saqlash
window.getAddresses = () => { try { return JSON.parse(localStorage.getItem('avto_addresses') || '[]'); } catch(e) { return []; } };
window.saveAddresses = (arr) => { localStorage.setItem('avto_addresses', JSON.stringify(arr)); if(window.currentUser) db.ref('users/'+window.currentUser+'/addresses').set(arr); };
// 📍 Manzil turi -> ikonka/rang/nom
window._addrMeta = function (a) {
    var t = (a && a.type) || 'other';
    var I = {
        home: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>',
        work: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 6h-4V4c0-1.1-.9-2-2-2h-4c-1.1 0-2 .9-2 2v2H4c-1.1 0-2 .9-2 2v11c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-6 0h-4V4h4v2z"/></svg>',
        map: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M15 5.1L9 3 3 5v16l6-2 6 2 6-2V3l-6 2.1zM15 19l-6-2.1V5l6 2.1V19z"/></svg>',
        other: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z"/></svg>'
    };
    var M = { home: ['Uy', '#34c759'], work: ['Ish', '#0a84ff'], map: ['Xaritada', '#5e5ce6'], other: ['Manzil', '#ff9500'] };
    var m = M[t] || M.other;
    return { icon: I[t] || I.other, name: m[0], color: m[1] };
};
window._addrCoordOnly = function (v) { return /^📍?\s*-?\d{1,3}(?:\.\d+)?\s*,\s*-?\d{1,3}(?:\.\d+)?\s*$/u.test(String(v || '').trim()); };

window.renderAddresses = () => {
    let addrs = getAddresses();
    // Profil tugmasidagi son
    let cnt = document.getElementById('pf-addr-count');
    if (cnt) cnt.textContent = addrs.length ? String(addrs.length) : '';
    // Oyna ichidagi ro'yxat
    let el = document.getElementById('addr-sheet-list');
    if (!el) return;
    const safe = (value) => String(value == null ? '' : value).replace(/[&<>"']/g, (ch) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
    if (addrs.length === 0) {
        el.innerHTML = '<div class="ad-empty"><div class="ad-empty-ic">' + window._addrMeta({ type: 'other' }).icon + '</div><b>Manzil qo\'shilmagan</b><span>Xaritadan nuqta belgilang yoki manzilni qo\'lda yozing — keyingi buyurtmada bir bosishda tanlaysiz.</span></div>';
        return;
    }
    el.innerHTML = '<div class="ad-sec">Saqlangan \u00B7 ' + addrs.length + ' ta</div><div class="ad-group">' + addrs.map((a, i) => {
        const meta = window._addrMeta(a);
        const address = String(a.address || '').trim();
        const sub = address && !window._addrCoordOnly(address) ? safe(address) : (a.mapLink ? 'Xaritada belgilangan nuqta' : safe(address));
        const map = (a.mapLink && /^https:\/\//i.test(String(a.mapLink)))
            ? '<a class="ad-act" href="' + safe(a.mapLink) + '" target="_blank" rel="noopener" aria-label="Xaritada ochish"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3h7v7"/><path d="M10 14L21 3"/><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"/></svg></a>' : '';
        return '<div class="ad-row" style="--i:' + i + '">' +
            '<span class="ad-ic" style="--ic:' + meta.color + '">' + meta.icon + '</span>' +
            '<span class="ad-tx"><b>' + safe(a.label || meta.name) + '</b>' + (sub ? '<span>' + sub + '</span>' : '') + '</span>' +
            map +
            '<button type="button" class="ad-act ad-del" onclick="window._addrDelete(' + i + ')" aria-label="Manzilni o\'chirish"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/></svg></button>' +
        '</div>';
    }).join('') + '</div>';
};
window.deleteAddress = (idx) => {
    let arr = getAddresses(); arr.splice(idx, 1); saveAddresses(arr);
    // Yetkazish oynasidagi tanlangan indeksni ham to'g'rilaymiz
    if (window._dlvSelectedAddr === idx) window._dlvSelectedAddr = null;
    else if (typeof window._dlvSelectedAddr === 'number' && window._dlvSelectedAddr > idx) window._dlvSelectedAddr--;
    renderAddresses(); showToast("Manzil o'chirildi");
};
// Tasdiq bilan o'chirish (oyna ichidagi savat tugmasi)
window._addrDelete = (idx) => {
    let a = getAddresses()[idx];
    if (!a) return;
    let nm = a.label || window._addrMeta(a).name;
    let go = () => { window.deleteAddress(idx); try { if (window._hap) window._hap('success'); } catch (e) {} };
    if (window._a1Confirm) window._a1Confirm('"' + nm + '" manzilini o\'chirasizmi?').then(ok => { if (ok) go(); });
    else if (confirm('"' + nm + '" manzilini o\'chirasizmi?')) go();
};
window.openAddressesSheet = () => {
    renderAddresses();
    openModal('addressesModal');
    try { if (window._hap) window._hap('light'); } catch (e) {}
};
// Xaritadan belgilash: mavjud xarita tanlagichi (yetkazish oynasidagi bilan bir xil).
window._addrFromMap = () => {
    if (typeof window.openMapPicker === 'function') window.openMapPicker();
    else addNewAddress();
};
window.addNewAddress = () => {
    // Telegram lokatsiyasi
    let useLocation = false;
    if (typeof tg !== 'undefined' && tg.LocationManager) {
        try { tg.LocationManager.init(); useLocation = true; } catch(e) {}
    }
    let m = document.getElementById('addAddressModal');
    if (!m) {
        m = document.createElement('div');
        m.id = 'addAddressModal';
        m.className = 'modal-standard';
        var _M = window._addrMeta;
        m.innerHTML = `<div class="modal-header"><h2><svg class="uic" aria-hidden="true"><use href="#i-pin"></use></svg>Yangi manzil</h2><button class="close-btn" aria-label="Yopish" onclick="closeModal()">×</button></div><div class="ad-wrap">
            <div class="ad-seg" role="radiogroup" aria-label="Manzil turi">
                <button type="button" class="addr-type-btn selected" data-t="home" onclick="selectAddrType(this)">${_M({type:'home'}).icon}Uy</button>
                <button type="button" class="addr-type-btn" data-t="work" onclick="selectAddrType(this)">${_M({type:'work'}).icon}Ish</button>
                <button type="button" class="addr-type-btn" data-t="other" onclick="selectAddrType(this)">${_M({type:'other'}).icon}Boshqa</button>
            </div>
            <div class="ad-sec">Ma'lumot</div>
            <div class="ad-form">
                <input type="text" id="addr-label" class="ad-in" placeholder="Nom (ixtiyoriy, masalan: Onamning uyi)" autocomplete="off">
                <textarea id="addr-text" class="ad-in ad-ta" placeholder="To'liq manzil: shahar, ko'cha, uy, kvartira…"></textarea>
            </div>
            <button type="button" id="addr-loc-btn" class="ad-btn ad-ghost ad-loc" onclick="getLocationForAddress()"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm8.94 3A8.99 8.99 0 0 0 13 3.06V1h-2v2.06A8.99 8.99 0 0 0 3.06 11H1v2h2.06A8.99 8.99 0 0 0 11 20.94V23h2v-2.06A8.99 8.99 0 0 0 20.94 13H23v-2h-2.06zM12 19a7 7 0 1 1 0-14 7 7 0 0 1 0 14z"/></svg>Joriy joylashuvni olish</button>
            <button type="button" class="ad-btn ad-gold" onclick="saveNewAddress()">Saqlash</button>
        </div>`;
        document.body.appendChild(m);
    }
    if (typeof openModal === 'function') openModal('addAddressModal');
    else { m.style.display='flex'; window.activeModal='addAddressModal'; }
};
window.selectAddrType = (btn) => {
    document.querySelectorAll('.addr-type-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
};
window.getLocationForAddress = () => {
    if (typeof tg !== 'undefined' && tg.LocationManager && tg.LocationManager.isInited) {
        tg.LocationManager.getLocation((loc) => {
            if (loc && loc.latitude) {
                let txt = document.getElementById('addr-text');
                if (txt) txt.value = `📍 ${loc.latitude.toFixed(5)}, ${loc.longitude.toFixed(5)}`;
                showToast('📍 Lokatsiya olindi!', 'success');
            } else { showToast('Lokatsiya olinmadi', 'warning'); }
        });
    } else {
        showToast('Telegram lokatsiya ishlamaydi. Qo\'lda yozing.', 'warning');
    }
};
window.saveNewAddress = () => {
    let typeBtn = document.querySelector('.addr-type-btn.selected');
    let type = typeBtn ? typeBtn.getAttribute('data-t') : 'other';
    let label = (document.getElementById('addr-label') || {}).value || '';
    let address = (document.getElementById('addr-text') || {}).value || '';
    if (!address.trim()) { showToast('Manzil yozing!', 'warning'); return; }
    let arr = getAddresses();
    arr.push({ type, label: label.trim(), address: address.trim() });
    saveAddresses(arr);
    renderAddresses();
    showToast('✅ Manzil saqlandi!', 'success');
    closeModal();
};

// PROFIL INIT — sahifa ochilganda mashinani va manzillarni ko'rsatish
// (Eski v3 showProfile wrapperi yuqoridagi birlashtirilgan wrapperga ko'chirildi)

// ============================================================
// 🚚 YETKAZIB BERISH MODULI (Kuryer + Xarita + BTS Pochta)
// ============================================================
window.selectedDelivery = null;

// BTS Pochta filiallari (viloyatlar bo'yicha). Admin Firebase 'bts_branches' orqali yangilashi mumkin.
// 📦 BTS Pochta filiallari — barcha 14 viloyat + shahar/tumanlar (keng qamrov).
// Admin Firebase 'bts_branches' orqali aniq manzillar bilan yangilashi mumkin.
window.BTS_BRANCHES = {"Toshkent shahri":{"Yakkasaroy tumani":[{"id":"0101","name":"YAKKASAROY","address":"Bobur ko'chasi 22","landmark":"Tojmahal restorani","hours":"Du-Yak: 24/7"},{"id":"0123","name":"QUSHBEGI (SKLAD)","address":"Qushbegi massivi, kichik halqa yo'li 23 uy","landmark":"Kichik halqa yo'li 23 uy","hours":"Du-Ju: 09:00-18:00; Shan: 09:00-16:00; Yak: dam olish"},{"id":"0129","name":"YAKKASAROY 2","address":"Shota Rustaveli ko'chasi 122-uy, 42-xona","landmark":"Birodarlik qabristoni","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"},{"id":"0130","name":"QUSHBEGI (PVZ)","address":"Qushbegi daxasi, 2-uy","landmark":"Masjid qarshisida","hours":"Du-Shan: 09:00-20:00; Yak: 09:00-16:00"},{"id":"0135","name":"JANUBIY VOKZAL","address":"Kichik halqa yo'li k, 22A-uy","landmark":"IBR zapravka","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"},{"id":"0157","name":"YAKKASAROY ASKIYA","address":"Shota Rustaveli k, 55","landmark":"Askiya bozor qarshisi","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Uchtepa tumani":[{"id":"0102","name":"UCHTEPA","address":"24-kvartal, Lutfiy k, 2-A uy","landmark":"Shirin chorraha","hours":"Du-Yak: 09:00-20:00"},{"id":"0115","name":"O'RIKZOR 1","address":"O'rikzor bozor 4 blok 59-do'kon","landmark":"4 blok 59-do'kon","hours":"Du-Yak: 09:00-18:00"},{"id":"0124","name":"FARHOD","address":"Farhod Scopus avto Mall, 2-eshik, 9-qator, 215-do'kon","landmark":"Avtoturargoh","hours":"Du-Se: 09:00-18:00; Chor: dam olish; Pay-Yak: 09:00-18:00"},{"id":"0138","name":"O'RIKZOR 2","address":"O'rikzor bozori, 4-blok 42-2 do'kon","landmark":"4-blok 42-2 do'kon","hours":"Du-Yak: 09:00-18:00"},{"id":"0144","name":"UCHTEPA 2","address":"12-kvartal, 41 uy","landmark":"EVOS yonida","hours":"Du-Shan: 24/7; Yak: 20:00-08:00"},{"id":"0150","name":"FARHOD CHORRAHA","address":"Farhod k, 6a","landmark":"Havas super market yonida","hours":"Du-Shan: 09:00-18:00; Yak: 09:00-16:00"},{"id":"0170","name":"ARCHA KO'CHA","address":"14-mavze, 14-uy, 13-xonodon","landmark":"SQB Bank yonida","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"},{"id":"0173","name":"BESHQAYRAG'OCH","address":"Beshqayrag'och k, 276-uy","landmark":"Ginekologiya bo'limi","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"},{"id":"0179","name":"DEPO MALL","address":"Katta Kani k, 22-uy","landmark":"Depo mall","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"},{"id":"01103","name":"BESHQAYRAG'OCH 2","address":"Manon Uyg'ur k","landmark":"Beshqayrag'och chorrahasi","hours":"Du-Yak: 09:00-18:00"}],"Shayxontohur tumani":[{"id":"0103","name":"SHAYXONTOHUR","address":"Furkat 6","landmark":"Xadra, Asaka Bankni orqasi","hours":"Du-Yak: 24/7"},{"id":"0121","name":"MALIKA BOZOR","address":"Ko'rgazma k, 36 uy","landmark":"Mahmud kabob ro'parasida","hours":"Du: dam olish; Se-Yak: 09:00-18:00"},{"id":"0133","name":"HUVAYDO","address":"Huvaydo m, 14 kv","landmark":"Onkologiya markazi yonida","hours":"Du-Shan: 09:00-18:00; Yak: 09:00-16:00"},{"id":"0148","name":"IBN SINO","address":"Yoqub Ziyoev k, 5 uy","landmark":"Safiya do'koni","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"},{"id":"0158","name":"ALISHER NAVOIY METRO","address":"Navoiy ko'chasi, 69-b","landmark":"Alisher Navoiy metro","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"},{"id":"0165","name":"HUVAYDO 2","address":"Beruniy k, 12-uy","landmark":"Eco bozor yonida","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"},{"id":"0181","name":"GULOBOD","address":"Uyg'ur k, 4-uy","landmark":"Xotam moyka","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"},{"id":"0183","name":"CHORSU KIYIM BOZOR","address":"Zayqaynar k, 42-uy","landmark":"24-qator, 431-do'kon","hours":"Du: dam olish; Se-Yak: 09:00-18:00"},{"id":"0184","name":"CHORSU GOLD SENTR","address":"Chorsu bozor, Gold Sentr","landmark":"72-do'kon","hours":"Du: dam olish; Se-Yak: 09:00-18:00"},{"id":"0186","name":"TOSHMI CHORRAHA","address":"Jar Ariq ko'chasi","landmark":"N.A. Ko'ksaroy hospital","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"},{"id":"0192","name":"SAMARQAND DARVOZA","address":"Samarqand Darvoza k, 1 uy","landmark":"JFA stom ro'parasi","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"},{"id":"0198","name":"MALIKA BOZOR 2","address":"Malika bozori","landmark":"2C blok","hours":"Du: dam olish; Se-Yak: 09:00-18:00"}],"Olmazor tumani":[{"id":"0106","name":"OLMAZOR","address":"Talabalar ko'chasi 81/1","landmark":"Kamolaxon supermarket","hours":"Du-Shan: 09:00-20:00; Yak: 09:00-16:00"},{"id":"0131","name":"ESKI SHAHAR","address":"Langar ko'chasi, 76a-uy","landmark":"Versal to'yxonasi","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"},{"id":"0137","name":"QORAQAMISH","address":"Qoraqamish-2 ko'chasi","landmark":"Qoraqamish avtodrom","hours":"Du-Shan: 09:00-18:00; Yak: 09:00-16:00"},{"id":"0151","name":"KELES YO'LI","address":"Keles yo'li k","landmark":"Safia yonida","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"},{"id":"0163","name":"SEBZOR","address":"Sebzor k, 1-uy","landmark":"NBU banki yaqinida","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"},{"id":"0168","name":"SAG'BON","address":"Sag'bon k, 80-uy","landmark":"Eski Qo'shtut to'yxonasi","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"},{"id":"0185","name":"QORAQAMISH 2","address":"Qoraqamish 2, 8-uy","landmark":"Alo to'yxona qarshisi","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"},{"id":"01101","name":"QORASAROY","address":"Qorasaroy ko'chasi 2-uy, 39-xonadon","landmark":"Olmazor city","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Sergeli tumani":[{"id":"0107","name":"SERGELI","address":"Yangi Sergeli 8A, 3-uy, 74-xona","landmark":"Mediapark","hours":"Du-Shan: 09:00-20:00; Yak: 09:00-18:00"},{"id":"0143","name":"SERGELI 4-BEKAT","address":"Shokir ariq k, 100-uy","landmark":"Ozoda shifo klinikasi","hours":"Du-Shan: 09:00-20:00; Yak: 09:00-18:00"}],"Yunusobod tumani":[{"id":"0108","name":"YUNUSOBOD (SHAXRISTON)","address":"A.Temur k, 115A uy","landmark":"Korzinka qarshisida","hours":"Du-Shan: 09:00-18:00; Yak: 09:00-16:00"},{"id":"0111","name":"UNIVERSAM YUNUSOBOD","address":"Yunusabad kv 8, 22-uy, 50-xona","landmark":"Billur to'yxonasi","hours":"Du-Shan: 09:00-20:00; Yak: 09:00-16:00"},{"id":"0126","name":"OLOY","address":"Kashgar mavzesi, 1-uy, 22-xonadon","landmark":"Oloy bozor ro'parasi","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"},{"id":"0160","name":"YUNUSOBOD GIDROMITSENTR","address":"Osiyo k, 21 uy","landmark":"Gidromitsentr chorrahasi","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"},{"id":"0162","name":"MEGA PLANET","address":"11-Mav, 16-uy","landmark":"KINGSMAN SPORT qarshisida","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"},{"id":"0169","name":"BODOMZOR","address":"Bogishamol k, 33A","landmark":"TATU yonida","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"},{"id":"0187","name":"SAMPI","address":"TashGRESS mavzesi, 21-uy","landmark":"Sampi Korzinka","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"},{"id":"0188","name":"TURKISTON METRO","address":"Ahmad Donish k, 5-uy","landmark":"Mikro Med Lor","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"},{"id":"0190","name":"YUNUSOBOD SAMARA","address":"13-mavze, 53-uy","landmark":"Gamlet kafe yonida","hours":"Du-Yak: 09:00-18:00"},{"id":"0194","name":"ORIENT BUSSINES SENTR","address":"Oloy bozor k","landmark":"Gyote Instituti","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"},{"id":"01100","name":"XALQARO BUSINESS MARKAZI","address":"Prospekt A.Temur 107-B","landmark":"Xalqaro Business markazi","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Mirobod tumani":[{"id":"0109","name":"MIROBOD","address":"Afrosiab ko'cha 6","landmark":"Grand treyd biznes sentr","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"},{"id":"0136","name":"SHIMOLIY VOKZAL","address":"Oybek ko'chasi, 59-1 uy","landmark":"Shimoliy vokzal","hours":"Du-Shan: 09:00-18:00; Yak: 09:00-16:00"},{"id":"0159","name":"YANGI QO'YLIQ","address":"Qo'yliq k","landmark":"Imperial restorani yonida","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"},{"id":"0171","name":"SARAKULKA","address":"Mehrjon k, 45-uy, 79 kv","landmark":"Dilkash kafe ro'parasi","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"},{"id":"0195","name":"RISOVIY","address":"Farg'ona yo'li k","landmark":"Risoviy bozor","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"M. Ulug'bek tumani":[{"id":"0110","name":"MAKSIM GORKIY","address":"Buyuk ipak yuli k, 123","landmark":"Sayohat mehmonxona","hours":"Du-Shan: 09:00-20:00; Yak: 09:00-16:00"},{"id":"0113","name":"PARKENT","address":"Parkent k, 11","landmark":"Aroma medik bozor ro'parasi","hours":"Du-Shan: 09:00-18:00; Yak: 09:00-16:00"},{"id":"0128","name":"TTZ","address":"Buyuk Ipak yo'li ko'chasi, 481a-uy","landmark":"TTZ bozor to'g'risida","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"},{"id":"0141","name":"MIRZO ULUG'BEK","address":"Kattadarxon k, 1/8","landmark":"Digital Universitet","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"},{"id":"0164","name":"MIRZO ULUG'BEK CHIMGAN","address":"Yalangoch d, 67-uy","landmark":"Chimgan Hills","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"},{"id":"0166","name":"MAKSIM GORKIY 2","address":"Buyuk ipak y","landmark":"Sayoxat mehmonxonasi qarshisi","hours":"Du-Shan: 09:00-20:00; Yak: dam olish"},{"id":"0172","name":"S1 (MARKAZ)","address":"Buyuk Ipak yo'li k, 13-uy","landmark":"Orris parfumeriya","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"},{"id":"0174","name":"LUNACHARSKIY","address":"Buyuk ipak yo'li k, 276-uy","landmark":"Avto Servis","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"},{"id":"0176","name":"MIRZO ULUG'BEK IT-PARK","address":"Mominova kochasi 7-uy 32","landmark":"IT-PARK","hours":"Du-Yak: 09:00-18:00"},{"id":"0191","name":"FERUZA MASSIV","address":"Feruza k","landmark":"Mega school","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"},{"id":"01105","name":"QORASUV 2","address":"Qorasuv 2","landmark":"Qorasuv bozor","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Yashnobod tumani":[{"id":"0112","name":"QO'YLIQ","address":"Fargona yuli k, 4-uy, 3-xona","landmark":"Korzinka","hours":"Du-Shan: 09:00-18:00; Yak: 09:00-16:00"},{"id":"0127","name":"KADISHEVA","address":"2-Aviasozlar mavzesi, 40-uy, 2-xonadon","landmark":"Yashnobod to'yxonasi","hours":"Du-Shan: 09:00-18:00; Yak: 09:00-16:00"},{"id":"0145","name":"MAHTUMQULI","address":"Mahtumquli k, 117","landmark":"Korzinka Aviator","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"},{"id":"0149","name":"LISUNOVA","address":"Qorasuv k, 33","landmark":"Korzinka","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"},{"id":"0180","name":"ROHAT","address":"Ohongaron shossesi, 105-uy","landmark":"Rohat krugi","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"},{"id":"0182","name":"KADISHEVA 2","address":"Aviasozlar k","landmark":"Lady Fitness yonida","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"},{"id":"0197","name":"ROHAT 2","address":"Oxangaron shox k, 40/6-uy","landmark":"Centara kafe to'g'risida","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"},{"id":"01104","name":"FARG'ONA YO'LI","address":"Bunyodkor MFY, Fargona yoli k","landmark":"Oq uy jome masjid","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Chilonzor tumani":[{"id":"0114","name":"OQTEPA","address":"7-mavze, 33-uy","landmark":"Dentmed stom","hours":"Du-Shan: 09:00-18:00; Yak: 09:00-16:00"},{"id":"0117","name":"ABU SAXIY","address":"Bunyodkor k, 156A, Ye-blok, Ye154","landmark":"Masjid","hours":"Du: dam olish; Se-Yak: 09:00-18:00"},{"id":"0120","name":"BEK BARAKA","address":"Bek baraka bozori, 3-blok, 11-qator, 608-do'kon","landmark":"3-blok, 11-q, 608-do'kon","hours":"Du: dam olish; Se-Yak: 09:00-18:00"},{"id":"0122","name":"CHILONZOR","address":"1-mavze, 59-uy","landmark":"Elektroset","hours":"Du-Shan: 09:00-20:00; Yak: 09:00-16:00"},{"id":"0132","name":"CHO'PONOTA","address":"Dilobod MFY, 6-mavze, 44-uy, 27-xona","landmark":"Oliy Xo'jalik sudi","hours":"Du-Shan: 09:00-18:00; Yak: 09:00-16:00"},{"id":"0140","name":"ALGORITM","address":"Guliston k, 59/2 uy","landmark":"Ahmad Jo'ja ro'parasi","hours":"Du-Shan: 09:00-18:00; Yak: 09:00-16:00"},{"id":"0152","name":"CHILONZOR PARLAMENT","address":"Al-Xorazmiy k, 17 kv 46","landmark":"Al-Xorazmiy krugi","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"},{"id":"0153","name":"BEK BARAKA 2","address":"Bek baraka bozori, 11-qator, 770-do'kon","landmark":"Bek baraka bozori","hours":"Du: dam olish; Se-Yak: 09:00-18:00"},{"id":"0154","name":"DO'STLIK BOZOR","address":"Dostlik bozori, 41-2-35","landmark":"Ipodrom bozori yonida","hours":"Du: dam olish; Se-Yak: 09:00-18:00"},{"id":"0156","name":"ALGORITM 2","address":"So'galli k, 25-uy","landmark":"Safia qarshisida","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"},{"id":"0161","name":"NOVZA","address":"Bunyodkor k, 2A uy","landmark":"Oltin markazi qarshisida","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"},{"id":"0167","name":"CHILONZOR METRO","address":"16-mavze, 11-uy","landmark":"Bahor arka ro'parasida","hours":"Du-Yak: 24/7"},{"id":"0175","name":"ALFA SAVDO MARKAZI BTS","address":"ALFA Trade Center, 1 etaj, 41-do'kon","landmark":"Abu Saxiy ro'parasida","hours":"Du-Yak: 09:00-18:00"},{"id":"0196","name":"QO'QON BOZOR","address":"Ippodrom Qo'qon bozor","landmark":"Ippodrom Qo'qon bozori","hours":"Du: dam olish; Se-Yak: 09:00-18:00"},{"id":"01102","name":"QATORTOL","address":"Qatortol 1-tor ko'cha","landmark":"Oqtepa Lavash yonida","hours":"Du-Shan: 09:00-20:00; Yak: 09:00-16:00"}],"Yangihayot tumani":[{"id":"0134","name":"TASHKENT INDEX","address":"Rayxon k, C01-blok, 1154-do'kon","landmark":"TashINDEX","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"},{"id":"0142","name":"YANGI HAYOT SPUTNIK","address":"Do'stlik k, 2A","landmark":"Shedevr restorani ro'parasi","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"},{"id":"0177","name":"YANGI CHOSHTEPA","address":"Yangi Chochtepa, Uzar kochasi 8-uy","landmark":"Xoztovar","hours":"Du-Yak: 09:00-18:00"},{"id":"0193","name":"YANGI DARXON","address":"Navroz k, 52 uy","landmark":"JV ASIA TRADE ro'parasi","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Bektemir tumani":[{"id":"0178","name":"BEKTEMIR","address":"Bektemir k, 92-a uy","landmark":"Bektemir Hostel yonida","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"},{"id":"0189","name":"VODNIK","address":"Vodnik d, 77-uy","landmark":"Ilm-ziyo O'quv markazi yoni","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}]},"Toshkent viloyati":{"Chirchiq shahri":[{"id":"1002","name":"CHIRCHIQ BOZOR","address":"Navoiy 222","landmark":"10-maktab","hours":"Du-Shan: 09:00-18:00; Yak: 09:00-16:00"},{"id":"1012","name":"TROISKIY","address":"Navoiy shoh k, 77v-uy","landmark":"Troisk cherkov","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"},{"id":"1029","name":"OKTYABR","address":"Amir Temur k, 140/4 uy","landmark":"Oktyabr bozor qarshisi","hours":"Du-Shan: 09:00-18:00; Yak: 09:00-16:00"},{"id":"1031","name":"CHIRCHIQ NAVOIY","address":"A.Navoiy k, 200-uy","landmark":"Sofia to'g'risida","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Olmaliq shahri":[{"id":"1003","name":"OLMALIQ","address":"Furqat k-si, 3-30 uy","landmark":"Tezkor foto uyi","hours":"Du-Shan: 09:00-18:00; Yak: 09:00-16:00"},{"id":"1027","name":"OYDIN","address":"Ulug'bek k, 82-uy","landmark":"Shahar shifoxonasi","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Angren shahri":[{"id":"1004","name":"ANGREN","address":"Navoiy k, 111-uy","landmark":"Gul bozor","hours":"Du-Shan: 09:00-20:00; Yak: 09:00-16:00"},{"id":"1038","name":"ANGREN 6/4","address":"Mustaqqilik k, 223-uy","landmark":"Sokin market pasti","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Oqqo'rg'on tumani":[{"id":"1006","name":"OQQO'RG'ON","address":"Ohunboboyev k","landmark":"Ishonch do'koni","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Yangiyo'l shahri":[{"id":"1007","name":"YANGIYO'L","address":"Yoshlik k, 54","landmark":"Dunyo Mall ro'parasi","hours":"Du-Shan: 09:00-18:00; Yak: 09:00-16:00"}],"Bekobod shahri":[{"id":"1008","name":"BEKOBOD","address":"Buyuk ipak yo'li k, 466-uy","landmark":"Hayot to'yxonasi","hours":"Du-Shan: 09:00-18:00; Yak: 09:00-16:00"},{"id":"1030","name":"14-MIKRARAYON","address":"G'afur G'ulom k","landmark":"Prezident maktabi qarshisi","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Ohangaron shahri":[{"id":"1009","name":"OHANGORON","address":"A.Temur k, 10-uy","landmark":"Majnuntol to'yxonasi","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Nurafshon shahri":[{"id":"1010","name":"NURAFSHON","address":"Toshkent yo'li ko'chasi, 85","landmark":"Nurafshon Lor Shifo yonida","hours":"Du-Shan: 09:00-18:00; Yak: 09:00-16:00"},{"id":"1036","name":"NURAFSHON MIKRORAYON","address":"Yuksalish k, 19-uy","landmark":"Mikrorayon bekati","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Qibray tumani":[{"id":"1011","name":"QIBRAY","address":"A.Navoiy k","landmark":"Makro ro'parasi","hours":"Du-Shan: 09:00-18:00; Yak: 09:00-16:00"},{"id":"1017","name":"QIBRAY SELEKSIYA","address":"Universitet k, 37-uy","landmark":"Seleksiya bekat","hours":"Du-Shan: 09:00-18:00; Yak: 09:00-16:00"},{"id":"1035","name":"DO'RMON","address":"Yuzrobot k, 214-uy","landmark":"Do'rmon bekati","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"},{"id":"1039","name":"UCHHO'Z","address":"Milliy bog kochasi, 4A uy","landmark":"Makro yonida","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Parkent tumani":[{"id":"1013","name":"PARKENT TUMAN","address":"Mustaqillik k, SHOX bekat","landmark":"Parkent bozori","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Bo'stonliq tumani":[{"id":"1014","name":"G'AZALKENT","address":"O'zgarish k, 2/12 uy","landmark":"Istanbul Brend","hours":"Du-Shan: 09:00-18:00; Yak: 09:00-16:00"},{"id":"1032","name":"XOJIKENT","address":"Nurchilar m, 70-uy","landmark":"O'zbekiston pochtasi yoni","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"},{"id":"1034","name":"QORONG'U BOZOR","address":"G'azalkent sh, Mustaqillik k, 18a-uy","landmark":"Qorong'u bozor","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Zangiota tumani":[{"id":"1015","name":"ZANGIOTA","address":"H.Nogmonov 1-uy","landmark":"Eshonguzar bekati","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"},{"id":"1022","name":"NAZARBEK","address":"Oq uy k, 91-uy","landmark":"Grand to'yxonasi","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"},{"id":"1040","name":"SOLNECHNIY BOZOR 2","address":"Eshonguzar MFY","landmark":"Solnechniy bozor","hours":"Du-Yak: 09:00-18:00"}],"Toshkent tumani":[{"id":"1016","name":"KELES","address":"Keles yo'li, 179","landmark":"Keles bozorchasi","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"},{"id":"1024","name":"KO'KSAROY","address":"Ko'ksaroy MFY","landmark":"Beltepa betonka yo'li","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Yuqorichirchiq tumani":[{"id":"1018","name":"YUQORI CHIRCHIQ YANGIBOZOR","address":"Yangibozor","landmark":"Akita Universiteti ro'parasi","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"},{"id":"1026","name":"BARDANKO'L","address":"Mirobod k, 4/2-uy","landmark":"Bardanko'l uylari","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Piskent tumani":[{"id":"1019","name":"PISKENT","address":"Mitan MFY, Bobur k, 2 uy","landmark":"Piskent tumani Mitan MFY","hours":"Du-Shan: 09:00-18:00; Yak: 09:00-16:00"}],"Bekobod tumani":[{"id":"1021","name":"ZAFAR SHAXAR","address":"Mustaqillik k, 13-uy, 9-xona","landmark":"Orom to'yxona","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Bo'ka tumani":[{"id":"1023","name":"BO'KA","address":"Magistral k","landmark":"8-bog'cha ro'parasi","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Yangiyo'l tumani":[{"id":"1025","name":"GULBAHOR","address":"Sh.Rashidov k, 96-uy","landmark":"Gulbahor aylanma yo'li","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Chinoz tumani":[{"id":"1028","name":"CHINOZ","address":"Samarqand k, 141-uy","landmark":"YPX ro'parasi","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"O'rtachirchiq tumani":[{"id":"1033","name":"QORASUV (O'RTA CHIRCHIQ)","address":"Toshkent yo'li k, 270-uy","landmark":"Billur burger","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}]},"Sirdaryo viloyati":{"Sirdaryo tumani":[{"id":"2002","name":"BAXT","address":"Baxt shahri, Ulug'yo'l k, 159-uy","landmark":"Turon to'yxonasi","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"},{"id":"2013","name":"SIRDARYO","address":"O'zbekiston k, 198-uy","landmark":"Best market","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Guliston shahri":[{"id":"2003","name":"GULISTON","address":"Ozbekiston k, 3-17","landmark":"Anorbank ro'parasida","hours":"Du-Shan: 09:00-19:00; Yak: 09:00-16:00"},{"id":"2009","name":"GULISTON VOKZAL","address":"Sayxun shox k, 3A","landmark":"Vokzal","hours":"Du-Shan: 09:00-20:00; Yak: 09:00-16:00"},{"id":"2014","name":"GULISTON ASR","address":"Asr kochasi","landmark":"MCHS ro'parasida","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Yangiyer tumani":[{"id":"2004","name":"YANGIYER","address":"Gulshan k","landmark":"Krug Eski Artel magazin","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Xovos tumani":[{"id":"2005","name":"XOVOS","address":"Samarqand k","landmark":"Xovos Adliya ro'parasi","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Boyovut tumani":[{"id":"2006","name":"BOYOVUT","address":"Madaniyat shox k, 60-uy","landmark":"IIB ro'parasida","hours":"Du-Shan: 09:00-20:00; Yak: dam olish"}],"Shirin tumani":[{"id":"2007","name":"SHIRIN","address":"Ibn sino k, 1 uy","landmark":"Shifoxona ro'parasida","hours":"Du-Shan: 09:00-20:00; Yak: dam olish"}],"Oqoltin tumani":[{"id":"2008","name":"OQOLTIN","address":"Tinchlik k, 37-uy","landmark":"Uztelecom ro'parasi","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Sayxunobod tumani":[{"id":"2010","name":"SAYXUNOBOD","address":"A.Navoiy k, 19-uy","landmark":"Aziza MTT yoni","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Guliston tumani":[{"id":"2011","name":"GULISTON TUMAN","address":"Turkiston k, 83-uy","landmark":"Guliston IIB qarshisi","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Sardoba tumani":[{"id":"2012","name":"SARDOBA","address":"Dostlik k","landmark":"Avtoshox bekati yoni","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}]},"Jizzax viloyati":{"Jizzax shahri":[{"id":"2502","name":"JIZZAX","address":"Qassoblik mahallasi, Sh.Rashidov k, 303-uy","landmark":"Industrial kollej","hours":"Du-Shan: 08:00-20:00; Yak: 08:00-16:00"},{"id":"2507","name":"OROM","address":"Mustaqillik k, 31-uy","landmark":"Orom bouling orqasi","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"},{"id":"2516","name":"JIZZAX MIKRORAYON","address":"Qaliya k, 32-uy, 58-x","landmark":"Yangi Carnaval savdo","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Zomin tumani":[{"id":"2503","name":"ZOMIN","address":"Mustaqillik ko'chasi, 75","landmark":"Elegant yonida","hours":"Du-Shan: 09:00-20:00; Yak: dam olish"}],"Sharof Rashidov tumani":[{"id":"2504","name":"STANSIYA JIZ","address":"A.Navoiy k, 15-uy","landmark":"Ko'ksaroy ro'parasida","hours":"Du-Shan: 09:00-20:00; Yak: dam olish"}],"G'allaorol tumani":[{"id":"2505","name":"G'ALLAOROL","address":"Mustaqillik k, 13-uy","landmark":"Ko'hinur to'yxonasi","hours":"Du-Yak: 09:00-18:00"}],"Paxtakor tumani":[{"id":"2506","name":"PAXTAKOR","address":"Oltinkol MFY, 89-uy","landmark":"Oson nasiya majmuasi","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Do'stlik tumani":[{"id":"2508","name":"DO'STLIK","address":"Sariskov k, 7-uy","landmark":"Sport maktab chorrahasi","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Mirzacho'l tumani":[{"id":"2509","name":"MIRZACHO'L","address":"Iqbol k, 1 dom, 1 kv","landmark":"Mirzachol chorraha","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Zarbdor tumani":[{"id":"2510","name":"ZARBDOR","address":"Lalmikor m, A376","landmark":"Fayz oilaviy kafesi","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Baxmal tumani":[{"id":"2511","name":"BAXMAL","address":"Mustaqillik k, 77-uy","landmark":"Ishonch magazin","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Forish tumani":[{"id":"2512","name":"FORISH","address":"Fayzobod k, 2-uy","landmark":"Xonbandi bekati","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Yangiobod tumani":[{"id":"2513","name":"YANGIOBOD","address":"Mustaqillik k, 12-uy","landmark":"Tuman hokimyati yonida","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Zafarobod tumani":[{"id":"2514","name":"ZAFAROBOD","address":"Mustaqillik k, 2-uy","landmark":"Xalq banki yonida","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Arnasoy tumani":[{"id":"2515","name":"ARNASOY","address":"G'oliblar sh, Alpomish k, 3 uy","landmark":"8-maktab ro'parasida","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}]},"Samarqand viloyati":{"Samarqand shahri":[{"id":"3001","name":"M BARAKA SAM","address":"Said Baraka 8","landmark":"Avtomoyka yonida","hours":"Du-Shan: 08:00-22:00; Yak: 09:00-18:00"},{"id":"3002","name":"SAGDIANA","address":"Abu Bakir Roziy k","landmark":"Sagdiana masjid yonida","hours":"Du-Shan: 08:00-22:00; Yak: 09:00-18:00"},{"id":"3013","name":"MOTRID QORASUV","address":"Qorasuv massivi","landmark":"80-maktab qarshisi","hours":"Du-Shan: 09:00-20:00; Yak: dam olish"},{"id":"3016","name":"SAMARKAND SIYOB","address":"Rudakiy k, 277-uy","landmark":"Kohinur Plaza qarshisi","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"},{"id":"3023","name":"ULUG'BEK","address":"Toshkent trekt k, 55a uy","landmark":"Afruza hotel","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"},{"id":"3028","name":"SAMARQAND","address":"Abu Rayxon k, 196-uy","landmark":"Choy fabrikasi","hours":"Du-Shan: 09:00-22:00; Yak: dam olish"},{"id":"3043","name":"SAMARQAND YANGIBOZOR","address":"U.Joraqulov k","landmark":"Yangi bozor orqa darvozasi","hours":"Du: dam olish; Se-Yak: 09:00-18:00"},{"id":"3045","name":"FIRDAVSIY","address":"Gagarina k, 155","landmark":"Rustam Shurbo ro'parasi","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Oqdaryo tumani":[{"id":"3005","name":"OQDARYO","address":"A.Temur k, 27 uy","landmark":"Hokimiyat","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Kattaqo'rg'on shahri":[{"id":"3006","name":"KATTAQO'RG'ON","address":"Qoradaryo ko'chasi, 7D uy","landmark":"Bozor ro'parasi","hours":"Du-Shan: 09:00-20:00; Yak: dam olish"},{"id":"3046","name":"KATTAQO'RG'ON (NURXON)","address":"A.Navoiy k","landmark":"Motam saroy ona haykali","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Urgut tumani":[{"id":"3010","name":"URGUT","address":"Navoiyshox 1","landmark":"404 Burger oldi","hours":"Du-Shan: 09:00-20:00; Yak: dam olish"},{"id":"3026","name":"URGUT YANGIBOZOR BTS","address":"Amir Temur k","landmark":"Urgut city","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Payariq tumani":[{"id":"3011","name":"PAYARIQ (CHELAK)","address":"Chelak sh, U.Yusupova k","landmark":"Temir Hoji Somsa","hours":"Du-Shan: 09:00-20:00; Yak: dam olish"},{"id":"3037","name":"NARIMON","address":"Istiqlol k, 2-uy","landmark":"Narimon dehqon bozor yonida","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Jomboy tumani":[{"id":"3012","name":"JOMBOY","address":"Samarqand k-si, 19-uy","landmark":"Prokat Stol-stul","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"},{"id":"3025","name":"JOMBOY SENTR","address":"Toshkent k, 150-uy","landmark":"Tamanno restorani oldida","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"},{"id":"3036","name":"FARXOD SHAHARCHA","address":"Farxod k, 30a uy","landmark":"Yakkasaroy restorani","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Samarqand tumani":[{"id":"3014","name":"SELSKIY SAM","address":"Usmon Yusupov k, 137-uy","landmark":"Amina Go'sht markazi","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"},{"id":"3019","name":"SAMARQAND CITY","address":"U.Jo'raqulov k, 205-uy","landmark":"Imom A'zam jome masjidi","hours":"Du-Shan: 09:00-20:00; Yak: dam olish"},{"id":"3027","name":"OQMASJID","address":"Toshkent k, 100-uy","landmark":"21-maktab qarshisi","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"},{"id":"3038","name":"SUPER","address":"Narpayskaya k","landmark":"Dilshod restaurant qarshisi","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"},{"id":"3039","name":"EHTIYOT QISMLARI BOZORI","address":"Ehtiyot qismlari bozori","landmark":"1-sektor 14-do'kon","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Pastdarg'om tumani":[{"id":"3015","name":"JUMA SHAHAR","address":"Amir Temur ko'chasi, 32-uy","landmark":"Yoshlar bog'i qarshisi","hours":"Du-Shan: 09:00-19:00; Yak: dam olish"},{"id":"3035","name":"CHARXIN","address":"M.Ulugbek k, 12","landmark":"Oltin Saroy kafe qarshisi","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Tayloq tumani":[{"id":"3017","name":"TOYLOQ","address":"Bog'ichinor k, 2-uy","landmark":"Konserva zavod ro'parasi","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"},{"id":"3044","name":"UKRAJ","address":"Ukraj mahallasi, 91-uy","landmark":"Chorshanba bozori","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Narpay tumani":[{"id":"3018","name":"NARPAY","address":"Mirbozor, Salovat MFY, 2-uy","landmark":"Gilam do'kon yonida","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"},{"id":"3047","name":"NARPAY OQTOSH","address":"Oqtosh sh, Ismoil Buxoriy k","landmark":"Sud binosi yonida","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Nurobod tumani":[{"id":"3020","name":"NUROBOD","address":"Amir Temur k, 4-uy","landmark":"Uzum market yonida","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Ishtixon tumani":[{"id":"3021","name":"ISHTIXON","address":"Mustaqillik k, 23-uy","landmark":"Oybek osh markazi","hours":"Du-Shan: 09:00-20:00; Yak: dam olish"},{"id":"3041","name":"MITAN","address":"Mitan MSG, A.Temur k, 3-uy","landmark":"Ravza yonida","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Bulung'ur tumani":[{"id":"3022","name":"BULUNG'UR","address":"O'zbekiston k, 1-uy","landmark":"Shodlik to'yxona ro'parasi","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Kattaqo'rg'on tumani":[{"id":"3024","name":"PAYSHANBA KATTAQO'RG'ON","address":"Payshanba sh, A.Navoiy k","landmark":"Turk brend do'koni","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"},{"id":"3040","name":"KADAN","address":"A.Navoiy shox k","landmark":"DXA ro'parasida","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Paxtachi tumani":[{"id":"3029","name":"PAXTACHI","address":"Ziyovuddin sh","landmark":"Hokimyat binosi yonida","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Qo'shrobot tumani":[{"id":"3030","name":"QO'SHROBOT","address":"Bobur k, 10-uy","landmark":"Tuman Avtoshoxbekati","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}]},"Farg'ona viloyati":{"Farg'ona shahri":[{"id":"4001","name":"FARG'ONA","address":"Yuksalish 28","landmark":"Korzinka oldi","hours":"Du-Ju: 08:00-22:00; Shan: 08:00-20:00; Yak: 08:00-18:00"},{"id":"4015","name":"FARG'ONA PVZ","address":"Shodiyona MFY, S.Temur k, 227A-uy","landmark":"Harbiy qism","hours":"Du-Shan: 09:00-18:00; Yak: 09:00-16:00"},{"id":"4026","name":"SUM","address":"Mustaqillik k, 50-uy","landmark":"Al-Farg'oniy bog'i","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"},{"id":"4031","name":"QIRGULI","address":"Marg'ilon k, 11-uy","landmark":"Milliy gvardiya qarshisi","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Qo'qon shahri":[{"id":"4002","name":"QO'QON (CAVUM)","address":"Alisher Navoiy, 64","landmark":"Cavum stomatologiya","hours":"Du-Shan: 09:00-21:00; Yak: 09:00-16:00"},{"id":"4011","name":"QO'QON","address":"Turkiston ko'chasi, 220-uy","landmark":"Shahar roddom","hours":"Du-Shan: 08:00-22:00; Yak: 08:00-18:00"},{"id":"4029","name":"QO'QON (YANGIBOZOR)","address":"Usmon Nosir k, 67-8-1/7","landmark":"Yangi bozor qarshisida","hours":"Du: dam olish; Se-Yak: 09:00-19:00"}],"Marg'ilon shahri":[{"id":"4005","name":"MARG'ILON","address":"Mustaqillik 439/3","landmark":"Tibbiy diagnostika ro'parasida","hours":"Du-Ju: 09:00-20:00; Shan: 09:00-18:00; Yak: 09:00-16:00"}],"Toshloq tumani":[{"id":"4008","name":"TOSHLOQ","address":"Davon ko'chasi, 53-uy","landmark":"Toshloq aholi Bandligi","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Beshariq tumani":[{"id":"4009","name":"BESHARIQ","address":"Oltin Vodiy 190-uy","landmark":"Majburiy ijro ro'parasi","hours":"Du-Ju: 09:00-18:00; Shan: 09:00-16:00; Yak: dam olish"},{"id":"4035","name":"BESHARIQ PEREEZD","address":"Oltin vodiy 41","landmark":"Osiyo kelinlar saloni","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"O'zbekiston tumani":[{"id":"4012","name":"O'ZBEKISTON","address":"Yaypan sh, Turkiston MFY","landmark":"Oqtepa, Uzum market yoni","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"},{"id":"4036","name":"O'ZBEKISTON AVG'ONBOG'","address":"Avg'onbog' MFY","landmark":"Avg'onbog' avtostansiya","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Oltiariq tumani":[{"id":"4013","name":"OLTIARIQ","address":"Chinor tagi ko'chasi, 2-uy","landmark":"Aloqabank ro'parasi","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"},{"id":"4037","name":"XAMZA","address":"Obod mahalla k, 1 uy","landmark":"Shoxjahon market qarshisi","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Quva tumani":[{"id":"4014","name":"QUVA","address":"O'zbek ko'chasi, 41-uy","landmark":"Quva Tekstil ro'parasida","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"},{"id":"4038","name":"QUVA MARKAZ","address":"Muruvvat kochasi","landmark":"Uzum market","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Qo'shtepa tumani":[{"id":"4016","name":"QO'SHTEPA","address":"Mustaqillik k, 76-A uy","landmark":"Neurotashxis klinika","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Bag'dod tumani":[{"id":"4017","name":"BOG'DOD","address":"Olmos k, 115-uy","landmark":"Bog'dod krugi","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"},{"id":"4033","name":"BOG'DOD SENTR","address":"Orzu k, 8-uy","landmark":"Maxmud Ota choyxonasi","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Rishton tumani":[{"id":"4018","name":"RISHTON","address":"Farg'ona k, 9-uy","landmark":"Markaziy dorixona ro'parasi","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Uchkuprik tumani":[{"id":"4020","name":"UCHKO'PRIK","address":"Navrozshox k","landmark":"Agrobank qarshisida","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"},{"id":"4028","name":"YANGIBOZOR (SALANG)","address":"Salang k","landmark":"Salang metan yonida","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Buvayda tumani":[{"id":"4021","name":"BUVAYDA (YANGIQO'RG'ON)","address":"Yangiqo'rg'on krug","landmark":"Chirkay pitak","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"},{"id":"4032","name":"BUVAYDA 2","address":"G'uzar k, 7-uy","landmark":"39-maktab svitafori yonida","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Furqat tumani":[{"id":"4022","name":"FURQAT","address":"Mustaqillik k, 18 uy","landmark":"Tuman masjid yoni","hours":"Du-Yak: 09:00-18:00"}],"Quvasoy shahri":[{"id":"4023","name":"QUVASOY","address":"Mustaqillik k, 7a-uy","landmark":"Afsona to'yxonasi yoni","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"},{"id":"4039","name":"QUVASOY YO'LI","address":"Shakarqishloq MFY, Quvasoy kochasi, 35a-uy","landmark":"Quvasoy yo'li","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Dang'ara tumani":[{"id":"4024","name":"DANG'ARA","address":"Sanoat k, 1-uy","landmark":"Ishonch savdo markazi orqasi","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Yozyovon tumani":[{"id":"4025","name":"YOZYOVON","address":"Al-Fargona k","landmark":"Xalq banki qarshisida","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}]},"Namangan viloyati":{"To'raqo'rg'on tumani":[{"id":"5007","name":"TO'RAQO'RG'ON","address":"Al-Farg'oniy ko'chasi, 56A-uy","landmark":"Tuman Prokuraturasi","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"},{"id":"5023","name":"TO'RAQO'RG'ON 2","address":"Kosonsoy k","landmark":"Markaziy bozor","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Kosonsoy tumani":[{"id":"5008","name":"KOSONSOY","address":"Gulobod ko'chasi","landmark":"Vatanparvar binosi","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Namangan shahri":[{"id":"5009","name":"NAMANGAN","address":"6-MKR, G'alaba ko'chasi, 2-uy","landmark":"Olmos to'yxona","hours":"Du-Yak: 09:00-22:00"},{"id":"5014","name":"NAMANGAN LOLA","address":"Lola MFY, Boburshox street, 6v-uy","landmark":"Xo'jalik mollari bozori","hours":"Du-Ju: 09:00-18:00; Shan: 09:00-16:00; Yak: dam olish"},{"id":"5017","name":"SARDOBA NAMAN","address":"A.Navoiy k, 10-uy","landmark":"Olympus foto markaz yoni","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"},{"id":"5021","name":"CHORSU","address":"Uychi k, 2-uy","landmark":"Chorsu mexmonxonasi","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Chust tumani":[{"id":"5010","name":"CHUST","address":"Ipak yo'li ko'chasi","landmark":"Oila market qarshisida","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Uchqo'rg'on tumani":[{"id":"5011","name":"UCHQO'RG'ON","address":"Do'stlik ko'chasi, 34-uy","landmark":"Markaziy dorixona","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"},{"id":"5024","name":"QO'G'AY","address":"Madaniyat k, 27A-uy","landmark":"Bozor oldida","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Uychi tumani":[{"id":"5012","name":"UYCHI","address":"Beruniy ko'chasi, 10-uy","landmark":"Soliq va Moliya ro'parasi","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Mingbuloq tumani":[{"id":"5013","name":"MINGBULOQ","address":"Oybek MFY, Ozodlik ko'chasi","landmark":"Mingbuloq IIB","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Yangiqo'rg'on tumani":[{"id":"5015","name":"YANGIQO'RG'ON","address":"Chortoq ko'chasi, 11-uy","landmark":"Mudofaa bo'limi qarshisi","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Chortoq tumani":[{"id":"5016","name":"CHORTOQ","address":"Namangan k, 4 uy","landmark":"Globus dorixona ro'parasi","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Pop tumani":[{"id":"5018","name":"POP","address":"Shabboda k, 27-uy","landmark":"Milliy gvardiya qarshisi","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Norin tumani":[{"id":"5019","name":"NORIN","address":"Beruniy k, 20-uy","landmark":"Tez yordam yonida","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"},{"id":"5022","name":"NORINKAPA","address":"Soy bo'yi k","landmark":"Dr.Oybek stomatologiya qarshisi","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Namangan tumani":[{"id":"5020","name":"NAMANGAN TUMAN","address":"Nurafshon k, 50-uy","landmark":"22-maktab qarshisida","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}]},"Andijon viloyati":{"Andijon shahri":[{"id":"6001","name":"AVTOVOKZAL AND","address":"A.Temur 13","landmark":"Avtovakzal","hours":"Du-Shan: 08:00-20:00; Yak: 08:00-16:00"},{"id":"6006","name":"ESKI SHAHAR AND","address":"Mustaqillik Shox, 8 uy, 2/10","landmark":"Devonaboy Masjid","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"},{"id":"6011","name":"ANDIJON 1-MKR","address":"1-mikrorayon, 8-uy","landmark":"Furqat shifoxonasi","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"},{"id":"6017","name":"ANDIJON 2-MIKRARAYON","address":"2-mikrarayon, Nodira k, 1B","landmark":"Issiqlik manbayi","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"},{"id":"6034","name":"ANDIJON 3-MKR","address":"Bobur k, 2a-uy","landmark":"3-mikrorayon bozorcha","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Izboskan tumani":[{"id":"6005","name":"POYTUG'","address":"Naqshband ko'chasi, 5-uy","landmark":"Soliq idorasi yonida","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"},{"id":"6028","name":"CHUVAMA","address":"Chuvama q, Topchinor, 10","landmark":"Masjid qarshisi","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Paxtaobod tumani":[{"id":"6007","name":"PAXTAOBOD","address":"Z Habibiy, 70-uy","landmark":"Hamkorbank ro'parasi","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"},{"id":"6027","name":"MADANIYAT","address":"Maybog'cha k, 2-uy","landmark":"28-maktab qarshisi","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Asaka tumani":[{"id":"6008","name":"ASAKA","address":"Umid k-si, 41 uy","landmark":"Texnomart podvali","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"},{"id":"6022","name":"ASAKA 2","address":"Humo k, 2","landmark":"Uzavto Motors ko'cha chorraxasi","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Shaxrixon tumani":[{"id":"6009","name":"SHAXRIXON","address":"Xamza k, 1-uy","landmark":"Akshamnur restoran","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"},{"id":"6025","name":"YANGI SHAHRIXON","address":"Chinobod k, 7","landmark":"Pasport stol yonida","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Marhamat tumani":[{"id":"6012","name":"MARHAMAT","address":"Boburshox ko'chasi, 45-uy","landmark":"Marhamat hokimiyati","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"},{"id":"6031","name":"POLVONTOSH","address":"Polvontosh, Bobur k","landmark":"Mini stadion yonida","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Xo'jaobod tumani":[{"id":"6013","name":"XO'JAOBOD","address":"Uzun-ko'cha ko'chasi","landmark":"Agrobank ro'parasida","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Andijon tumani":[{"id":"6014","name":"ANDIJON TUMANI","address":"Nayman k, 17-uy","landmark":"Jahon bozori","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"},{"id":"6032","name":"KAMOLOT","address":"Sayfiobod k, 15-uy","landmark":"Kamolot ko'cha boshi","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"},{"id":"6033","name":"KUYGANYOR","address":"Vodiy k, 187-uy","landmark":"Davlat xizmatlari yonida","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"},{"id":"6035","name":"ANDIJON TELVIZYONNIY","address":"Telvizyonniy k, 30-uy","landmark":"Rose collection qatorida","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Buloqboshi tumani":[{"id":"6015","name":"BULOQBOSHI","address":"M.Ismoiliy k, 63-uy","landmark":"Hakim yodgor to'yxonasi","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Qo'rg'ontepa tumani":[{"id":"6016","name":"QO'RG'ONTEPA","address":"Mustaqillik k, 285","landmark":"41-IDUM ro'parasida","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"},{"id":"6030","name":"QORASUV","address":"Qorasuv sh, O'qituvchilar k, 2-uy","landmark":"Akmal Farm yonida","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Baliqchi tumani":[{"id":"6018","name":"BALIQCHI","address":"Boburshox k, 67-uy","landmark":"Do'stlik savdo markazi","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"},{"id":"6024","name":"CHINOBOD","address":"Namunaviy k, 134-uy","landmark":"Notarius yonida","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Jalaquduq tumani":[{"id":"6019","name":"JALAQUDUQ","address":"Dilhush k, 19-uy","landmark":"Jome masjid ro'parasi","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"},{"id":"6029","name":"OYIM","address":"Qo'chqor Turdiyev k, 4-uy","landmark":"Oyim markazi","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Oltinko'l tumani":[{"id":"6020","name":"OLTINKO'L","address":"Markaz k, 53-uy","landmark":"Prokuratura orqasi","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Xonobod shahri":[{"id":"6021","name":"XONOBOD","address":"Obod k, 26-uy","landmark":"Dehqon ota magazin","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Bo'z tumani":[{"id":"6023","name":"BO'Z","address":"Akmal Ikromov k, 2-uy","landmark":"O'zbegim to'yxonasi","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Ulug'nor tumani":[{"id":"6026","name":"ULUG'NOR","address":"Shaxriobod k, 20-uy","landmark":"Uzum Market yonida","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}]},"Qashqadaryo viloyati":{"Qarshi shahri":[{"id":"7001","name":"QARSHI","address":"5-Mikro rayon, Nasaf k","landmark":"Nikoh uyi orqa tomoni","hours":"Du-Shan: 08:00-01:00; Yak: 09:00-18:00"},{"id":"7005","name":"QARSHI (YANGIBOZOR)","address":"Markaziy savdo paviloni, 1/202","landmark":"Bozor darvozasi","hours":"Du: dam olish; Se-Ju: 09:00-18:00; Shan: 09:00-16:00; Yak: 09:00-18:00"},{"id":"7028","name":"QARSHI PEDINSTITUT","address":"A.Temur k, 110-uy","landmark":"QarDU eski darvozasi yonida","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"},{"id":"7029","name":"QARSHI ESKI SHAHAR","address":"Islom Karimov k, 347-uy","landmark":"Korzinka qarshisi","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Shahrisabz shahri":[{"id":"7003","name":"SHAHRISABZ","address":"Ipak yo'li k, 360-uy","landmark":"Yangi Masjid yonida","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"},{"id":"7017","name":"SHAHRISABZ TOJMAHAL","address":"Ipak yo'li k, 278","landmark":"Tojmahal restoran qarshisi","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Chiroqchi tumani":[{"id":"7006","name":"CHIROQCHI","address":"Mustaqillik ko'cha","landmark":"Xalq qabulxonasi yonida","hours":"Du-Ju: 09:00-18:00; Shan: 09:00-16:00; Yak: dam olish"},{"id":"7022","name":"JAR","address":"Jar k, 45-uy","landmark":"Jar pochtasi ro'parasida","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Kitob tumani":[{"id":"7007","name":"KITOB","address":"G.Jo'rayev ko'chasi, 21","landmark":"IIB","hours":"Du-Ju: 09:00-18:00; Shan: 09:00-16:00; Yak: dam olish"},{"id":"7024","name":"ESKI RADDOM","address":"General Jo'rayev k, 87-uy","landmark":"Eski raddom yonida","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Muborak tumani":[{"id":"7008","name":"MUBORAK","address":"Begzod ko'chasi, 4-uy","landmark":"Trastbank ATB yonida","hours":"Du-Ju: 09:00-18:00; Shan: 09:00-16:00; Yak: dam olish"}],"Qarshi tumani":[{"id":"7009","name":"BESHKENT","address":"Beshkent, Mustaqillik k, 41","landmark":"Tuman hokimligi yonida","hours":"Du-Ju: 09:00-18:00; Shan: 09:00-16:00; Yak: dam olish"}],"G'uzor tumani":[{"id":"7011","name":"G'UZOR","address":"O'zbekiston k, 57-uy","landmark":"Kadastr bo'limi ro'parasi","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Koson tumani":[{"id":"7012","name":"KOSON","address":"Mustaqillik k, 15-uy","landmark":"Universalbank ATB yonida","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Yakkabog' tumani":[{"id":"7014","name":"YAKKABOG'","address":"Amir Temur k, 25","landmark":"Comfort plus savdo kompleksi","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"},{"id":"7023","name":"ECO BOZOR","address":"Ayg'irko'l k, 212-uy","landmark":"Eco bozor yonida","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Shahrisabz tumani":[{"id":"7015","name":"CHORSHANBE SHAHRISABZ","address":"Zilol k, 1-uy","landmark":"Tuman tibbiyot birlashma","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Qamashi tumani":[{"id":"7016","name":"QAMASHI","address":"Amir Temur k","landmark":"Izmir magazini yonida","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Ko'kdala tumani":[{"id":"7018","name":"KO'KDALA","address":"Erkiv Vohidov k, 38-uy","landmark":"Avia kassa oldi","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Dehqonobod tumani":[{"id":"7019","name":"DEHQONOBOD","address":"Guliston k, 40-uy","landmark":"Tuman shifoxonasi qarshisi","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Kasbi tumani":[{"id":"7025","name":"KASBI","address":"Mug'lon QFY, 3-mitti t, 5-uy","landmark":"DHM ro'parasi","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Nishon tumani":[{"id":"7031","name":"NISHON","address":"Mustaqillik k","landmark":"Ona haykal ro'parasi","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}]},"Surxondaryo viloyati":{"Termiz shahri":[{"id":"7501","name":"TERMIZ","address":"A.Navoi k, 21","landmark":"Restoran MALIKA GOLD","hours":"Du-Ju: 08:00-20:00; Shan: 08:00-18:00; Yak: 08:00-16:00"},{"id":"7508","name":"TERMIZ SENTR","address":"Sentr Karpov bozori, Istiqlol 3/3","landmark":"Sentr Karpov bozori","hours":"Du-Ju: 09:00-20:00; Shan: 09:00-18:00; Yak: dam olish"},{"id":"7515","name":"TERMIZ VOZKAL","address":"Ibn Sino k, 29-uy","landmark":"Nafis mebel qatorida","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Denov tumani":[{"id":"7502","name":"DENOV","address":"Sharof Rashidov k, 176","landmark":"Uzum market yonida","hours":"Du-Shan: 09:00-18:00; Yak: 09:00-16:00"},{"id":"7516","name":"DENOV 2","address":"Namozgoh SFU","landmark":"Yangi bozor 3-do'kon","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Jarqo'rg'on tumani":[{"id":"7503","name":"JARQO'RG'ON","address":"O'zbekiston k, 12-uy","landmark":"Tuman hokimligi yoni","hours":"Du-Shan: 09:00-18:00; Yak: 09:00-16:00"},{"id":"7514","name":"SURXON","address":"Muqimiy k, 1-uy","landmark":"Univermag yoni","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Angor tumani":[{"id":"7504","name":"ANGOR","address":"At Termiziy ko'chasi","landmark":"Tuman Moliya bo'limi","hours":"Du-Shan: 09:00-18:00; Yak: 09:00-16:00"}],"Qumqo'rg'on tumani":[{"id":"7505","name":"QUMQO'RG'ON","address":"A.Navoiy k, 19A-uy","landmark":"Turon Savdo Majmuasi","hours":"Du-Shan: 09:00-18:00; Yak: 09:00-16:00"}],"Sherobod tumani":[{"id":"7506","name":"SHEROBOD","address":"Mustaqillik k","landmark":"Toshkent avtoshoxbekati","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Sho'rchi tumani":[{"id":"7507","name":"SHO'RCHI","address":"A.Temur ko'chasi, 53-B uy","landmark":"Sho'rchi Shoxbekat","hours":"Du-Shan: 09:00-18:00; Yak: 09:00-16:00"}],"Sariosiyo tumani":[{"id":"7509","name":"SARIOSIYO","address":"Mirzo Ulug'bek k","landmark":"Eski Dombita ro'parasi","hours":"Du-Shan: 09:00-18:00; Yak: 09:00-16:00"}],"Qiziriq tumani":[{"id":"7510","name":"QIZIRIQ","address":"Barhayot k","landmark":"Visol to'yxonasi yonida","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Boysun tumani":[{"id":"7511","name":"BOYSUN","address":"Istiqlol k, 9","landmark":"Konika binosi","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Uzun tumani":[{"id":"7512","name":"UZUN","address":"Yoshlik ko'chasi","landmark":"Avtoshoxbekat yonida","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Oltinsoy tumani":[{"id":"7513","name":"OLTINSOY","address":"Oltindala k, 10-uy","landmark":"Okean to'yxonasi qarshisi","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}]},"Buxoro viloyati":{"Buxoro shahri":[{"id":"8001","name":"BUXORO","address":"Bahouddin Naqshband 309/1","landmark":"Sherbudin restoran","hours":"Du-Shan: 08:00-21:00; Yak: 09:00-16:00"},{"id":"8003","name":"BUXORO 5-MKR","address":"A.Somiy k, 6A-17 uy","landmark":"Ped institut ro'parasi","hours":"Du-Shan: 09:00-19:00; Yak: dam olish"},{"id":"8005","name":"BUXORO GORGAZ","address":"Mustaqilligi k","landmark":"Steyk house yonida","hours":"Du-Shan: 09:00-19:00; Yak: dam olish"},{"id":"8008","name":"BUXORO VOKZAL","address":"O.Eshonov ko'chasi, 10-uy, 9-xonadon","landmark":"Mediapark ro'parasida","hours":"Du-Shan: 09:00-19:00; Yak: dam olish"},{"id":"8018","name":"BUXORO RAYMAG","address":"S.Murodov k, 90-uy","landmark":"Mo Salax osh markazi yoni","hours":"Du-Shan: 09:00-19:00; Yak: dam olish"},{"id":"8020","name":"CHINAR MALL","address":"Alpomish k, 203-uy","landmark":"Chinar Mall","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"},{"id":"8025","name":"FAYZOBOD","address":"Ashxobod k, 1-7-7-uy","landmark":"Saxarniy klinika","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"},{"id":"8026","name":"DILKUSHO","address":"Dilkusho k, 268 uy","landmark":"Kopilka supermarket","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"},{"id":"8029","name":"BUXORO KRITIY","address":"I.Mo'minov k, 24-uy","landmark":"Buxoro savdo majmuasi","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"},{"id":"8030","name":"BUXORO MELODIYA AVTOBEKATI","address":"I.Karimov k","landmark":"Salom Hayot savdo majmuasi yonida","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Kogon shahri":[{"id":"8007","name":"KOGON","address":"Mahmud Torobiy k, 49-uy, 3","landmark":"Vokzal chorraha","hours":"Du-Shan: 09:00-19:00; Yak: 09:00-16:00"},{"id":"8013","name":"KOGON VOKZAL","address":"Mahmud Torobiy k, 49-uy, 3","landmark":"Street Burger","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Vobkent tumani":[{"id":"8009","name":"VOBKENT","address":"Al Buxoriy ko'chasi","landmark":"Hokimiyat ro'parasida","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"G'ijduvon tumani":[{"id":"8010","name":"G'IJDUVON","address":"Yusuf Hamadoniy ko'chasi, 74-uy","landmark":"Sharifjon Savdo Majmuasi","hours":"Du-Shan: 09:00-18:00; Yak: 09:00-16:00"},{"id":"8023","name":"G'IJDUVON 2","address":"Ulug'bek k, 130-uy","landmark":"Tez tibbiy yordam orqasi","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"},{"id":"8033","name":"G'IJDUVON IPPADROM","address":"Yusuf Hamadoniy k","landmark":"Ippadrom bozorida","hours":"Du: dam olish; Se-Yak: 09:00-18:00"}],"Buxoro tumani":[{"id":"8011","name":"GALAOSIYO BUXORO","address":"Galaosiyo sh, Buyuk ipak yo'li k, 21-uy","landmark":"Muxayyo to'yxonasi ro'parasida","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"},{"id":"8024","name":"MADANIYAT CHORAXXA","address":"M.Karimov k, 93-uy","landmark":"Madaniyat chorraxasi","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Jondor tumani":[{"id":"8012","name":"JONDOR","address":"Mahmud Torobiy ko'chasi, 209-uy","landmark":"Tuman hokimligi","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"},{"id":"8027","name":"JONDOR 2","address":"Navgedi k, 1","landmark":"Jondor savdo majmuasi qarshisi","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Peshku tumani":[{"id":"8014","name":"PESHKU","address":"Yangi bozor k, 2-uy","landmark":"Velomakon yonida","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"},{"id":"8031","name":"PESHKU 2","address":"Uglon k","landmark":"Sazanchik yonida","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Qorako'l tumani":[{"id":"8015","name":"QORAKO'L","address":"Ulug'bek k, 48-uy","landmark":"15-maktab qarshisida","hours":"Du-Ju: 09:00-19:00; Shan: 09:00-18:00; Yak: dam olish"}],"Shofirkon tumani":[{"id":"8017","name":"SHOFIRKON","address":"Mustaqillik k","landmark":"Mohitobon Masjidi","hours":"Du-Shan: 09:00-19:00; Yak: 09:00-16:00"}],"Romitan tumani":[{"id":"8019","name":"ROMITAN","address":"Nurafshon k, 6-uy","landmark":"Tosh bar park ro'parasi","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Qorovulbozor tumani":[{"id":"8021","name":"QOROVULBOZOR","address":"Navoiy k, 12-uy","landmark":"Dehqon bozor","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Olot tumani":[{"id":"8022","name":"OLOT","address":"Olot shox k","landmark":"Techno zone","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Kogon tumani":[{"id":"8028","name":"YANGI HAYOT","address":"Amir Temur k, 63-uy","landmark":"Yangi saroy to'yxona","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}]},"Navoiy viloyati":{"Karmana tumani":[{"id":"8507","name":"KARMANA","address":"Talqoq MFY, Kulollar 8","landmark":"Karmana tuman 102","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Navoiy shahri":[{"id":"8508","name":"NAVOIY","address":"I.Karimov 120A-92","landmark":"Leon bekati ro'parasi","hours":"Du-Ju: 08:00-21:00; Shan: 08:00-19:00; Yak: 08:00-16:00"},{"id":"8509","name":"NAVOI (VOSXOD)","address":"Energetik d-1, kv-7","landmark":"Master Kabob","hours":"Du-Ju: 09:00-19:00; Shan: 09:00-18:00; Yak: dam olish"},{"id":"8517","name":"NAVOIY (YANGIBOZOR)","address":"Yangibozor","landmark":"Shirinlik bozori darvozasi qatorida","hours":"Du-Shan: 09:00-19:00; Yak: dam olish"},{"id":"8522","name":"NAVOIY (SHODLIK)","address":"Shodlik k, 1-uy","landmark":"UVD ro'parasida","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"},{"id":"8523","name":"NAVOIY MIB","address":"Mahmud Torobiy shoh kochasi, 116 uy","landmark":"Shahar MIB ro'parasi","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Qiziltepa tumani":[{"id":"8511","name":"QIZILTEPA","address":"Sozlab Ol Savdo","landmark":"Istiqlol to'yxona qarshisida","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"},{"id":"8518","name":"QIZILTEPA (VANG'OZI)","address":"Vang'ozi k","landmark":"BIR ZUMDA oshxona qarshisida","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Navbahor tumani":[{"id":"8512","name":"NAVBAHOR","address":"Markaziy Beshrabot","landmark":"Anor kafe qarshisida","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Zarafshon shahri":[{"id":"8513","name":"ZARAFSHON","address":"3-kichik tuman, Torgoviy sentr","landmark":"Uzum market ro'parasi","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"},{"id":"8520","name":"13-MIKRARAYON","address":"13-mikrarayon, 77-uy","landmark":"Gold supermarket yonida","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Nurota tumani":[{"id":"8514","name":"NUROTA","address":"U.Yusupova, 69-uy","landmark":"Tibbiyot birlashmasi yonida","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"},{"id":"8519","name":"G'OZG'ON","address":"G'ozg'on sh, Mustaqillik k, 65-uy","landmark":"Dehqon bozor ro'parasida","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Xatirchi tumani":[{"id":"8515","name":"XATIRCHI","address":"Navbahor ko'chasi","landmark":"Eski Univermag orqasi","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Uchquduq tumani":[{"id":"8516","name":"UCHQUDUQ","address":"A.Temur k, 37-B uy","landmark":"Qizilqum Jome Masjidi","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Konimex tumani":[{"id":"8521","name":"KONIMEX","address":"Ibn Sino kochasi","landmark":"Hokimiyat ro'parasida","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}]},"Xorazm viloyati":{"Urganch shahri":[{"id":"9001","name":"URGANCH","address":"Al-Xorazmiy 62","landmark":"Eski vino zavod chorrahasi","hours":"Du-Ju: 08:00-20:00; Shan: 08:00-18:00; Yak: 08:00-16:00"},{"id":"9003","name":"URGANCH 4-MKR","address":"Zarbuloq k, 1-uy, 26-xonadon","landmark":"Stadion chorrahasi","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"},{"id":"9016","name":"URGANCH YANGI TUNEL","address":"Yog'du k, 12A-uy","landmark":"Bozor yangi tunel yoni","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Xiva shahri":[{"id":"9002","name":"XIVA","address":"Yangi Xayot, A.Temur k","landmark":"Prokuratura yonida","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"},{"id":"9013","name":"XIVA (STADION)","address":"Feruz k, 98-uy","landmark":"Xiva stadion ro'parasi","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Tuproqqal'a tumani":[{"id":"9004","name":"TUPROQQAL'A","address":"Ogahiy k, 3-6 uy, 18","landmark":"Shahar boshbekati","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Xonqa tumani":[{"id":"9005","name":"XONQA","address":"Mustaqillik k, 5-uy","landmark":"Xonqa krugi","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Gurlan tumani":[{"id":"9006","name":"GURLAN","address":"Mustaqillik k","landmark":"Gurlan dehqon bozori","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Xozorasp tumani":[{"id":"9007","name":"XAZORASP","address":"Oftob ko'chasi, 107-uy","landmark":"96-avtobaza","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"},{"id":"9014","name":"XAZORASP MARKAZ","address":"Navoiy k","landmark":"Yoshlar bog'i yonida","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Bog'ot tumani":[{"id":"9008","name":"BOG'OT","address":"O'zbekiston k, 62-uy","landmark":"Kafe Original","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Qo'shko'pir tumani":[{"id":"9009","name":"QO'SHKO'PIR","address":"Sharof Rashidov k, 27 uy","landmark":"Eco bozor qarshisi","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Shovot tumani":[{"id":"9010","name":"SHOVOT","address":"Marifat k, 2-uy","landmark":"SES ro'parasida","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"},{"id":"9017","name":"SHOVOT 2","address":"Paxtakor mahallasi","landmark":"Temir yo'l bekati ko'prigi","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Yangibozor tumani":[{"id":"9011","name":"YANGIBOZOR XORAZM","address":"Sharshara k","landmark":"Yangi bozor post GAI yonida","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Yangiariq tumani":[{"id":"9012","name":"YANGIARIQ","address":"Al-Xorazmiy k, 18a uy","landmark":"Azza med klinikasi","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Urganch tumani":[{"id":"9015","name":"URGANCH RAYSENTR","address":"Mustaqillik k, 28-uy","landmark":"Chuqur burger yoni","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}]},"Qoraqalpog'iston Resp.":{"Nukus shahri":[{"id":"9501","name":"NUKUS","address":"Tatibaeva B/N 22","landmark":"Gurman lavash","hours":"Du-Ju: 08:00-20:00; Shan: 08:00-18:00; Yak: 08:00-16:00"},{"id":"9504","name":"NUKUS 26-MKR","address":"Pirjan Seytov k, 1A, 44-uy","landmark":"Tuz kafe yonida","hours":"Du-Ju: 09:00-18:00; Shan: 09:00-16:00; Yak: dam olish"}],"Qo'ng'irot tumani":[{"id":"9502","name":"QO'NG'IROT","address":"Beruniy k","landmark":"Munis market","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"},{"id":"9514","name":"QO'NG'IROT 2","address":"Nurmuxammedov k, 61","landmark":"Qo'ng'irot tumani gorgaz","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Beruniy tumani":[{"id":"9503","name":"BERUNIY","address":"Xalqlar do'stligi k","landmark":"Dinara hotel qarshisi","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"},{"id":"9515","name":"BERUNIY BOZOR","address":"Quruvchilar k","landmark":"Bozor (Suxrob kafe)","hours":"Du: dam olish; Se-Yak: 09:00-18:00"}],"Amudaryo tumani":[{"id":"9505","name":"AMUDARYO","address":"Tadbirkorlar k, 11","landmark":"Eshonbobo Jome masjidi","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"To'rtko'l tumani":[{"id":"9506","name":"TO'RTKO'L","address":"K.Ataniyazov k, 42-uy","landmark":"Eski bozor","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"},{"id":"9516","name":"TO'RTKO'L BOZOR","address":"Beruniy k, N501","landmark":"Kiyim bozor qosha darvoza","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Ellikqala tumani":[{"id":"9507","name":"ELLIK QAL'A","address":"Xalqlar do'stligi k","landmark":"Dehqon bozor yonida","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Taxiatosh tumani":[{"id":"9509","name":"TAXIATOSH","address":"Kamolot ko'chasi, 35-A uy","landmark":"Taxiatosh bozori","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Xo'jayli tumani":[{"id":"9510","name":"XO'JAYLI","address":"Tandirchi k, 32-uy","landmark":"Avtoturargoh","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Chimboy tumani":[{"id":"9511","name":"CHIMBOY","address":"Oltin bosaga k, 63-uy","landmark":"Xon machit","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Kegeyli tumani":[{"id":"9512","name":"KEGEYLI","address":"Dostlik guzari k, 106-uy","landmark":"Kegeyli bazar","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}],"Qanliko'l tumani":[{"id":"9513","name":"QANLIKO'L","address":"Dosliq k, 63-uy","landmark":"Xalq banki ro'parasida","hours":"Du-Shan: 09:00-18:00; Yak: dam olish"}]}};

// Firebase'dan BTS filiallarini (agar admin sozlagan bo'lsa) o'qish
try {
    db.ref('bts_branches').once('value', (snap) => {
        if (snap.exists()) { let d = snap.val(); if (d && typeof d === 'object') window.BTS_BRANCHES = d; }
    });
} catch(e) {}

window._dlvMethod = null;

window.openDeliveryModal = () => {
    if (Object.keys(cart).length === 0) { showToast("Savat bo'sh", "warning"); return; }
    if (!myProfile.phone) {
        showToast("Avval telefon raqamingizni kiriting!", "warning");
        setTimeout(() => { closeModal(); showProfile(); setTimeout(() => openModal('profileEditModal'), 300); }, 1500);
        return;
    }
    let m = document.getElementById('deliveryModal');
    if (!m) {
        m = document.createElement('div');
        m.id = 'deliveryModal';
        m.className = 'modal-standard';
        document.body.appendChild(m);
    }
    m.innerHTML = `
        <div class="modal-header" style="align-items:flex-start;">
            <div><h2 style="font-size:22px;font-weight:800;margin:0;"><svg class="uic" aria-hidden="true"><use href="#i-truck"></use></svg>Yetkazib berish</h2><p style="color:var(--text-muted);font-size:12px;margin:5px 0 0;">Qanday qabul qilmoqchisiz?</p></div>
            <button class="close-btn" aria-label="Yopish" style="font-size:24px;background:rgba(255,255,255,0.05);" onclick="backToCartFromDelivery()">←</button>
        </div>
        <div style="padding:0 4px;">
            <div class="dlv-method-card" id="dlv-courier" onclick="selectDeliveryMethod('courier')">
                <div style="font-size:30px;">🚖</div>
                <div style="flex:1;"><h4 style="margin:0 0 3px;font-size:15px;color:#fff;">Kuryer — manzilga</h4><p style="margin:0;font-size:12px;color:var(--text-muted);">Faqat Samarqand shahar ichida · 1 kun</p></div>
                <div class="dlv-check">✓</div>
            </div>
            <div class="dlv-method-card" id="dlv-bts" onclick="selectDeliveryMethod('bts')">
                <div style="font-size:30px;">📦</div>
                <div style="flex:1;"><h4 style="margin:0 0 3px;font-size:15px;color:#fff;">BTS Pochta filialiga</h4><p style="margin:0;font-size:12px;color:var(--text-muted);">Viloyat va tumanlarga · 2–4 kun · filialdan olasiz</p></div>
                <div class="dlv-check">✓</div>
            </div>

            <div id="dlv-courier-box" style="display:none; margin-top:16px;">
                <div style="font-size:11px;font-weight:800;color:var(--luxury-gold);letter-spacing:1px;margin-bottom:10px;">📍 MANZILNI TANLANG</div>
                <div id="dlv-addresses"></div>
                <button onclick="openMapPicker()" style="width:100%;padding:14px;border-radius:14px;background:rgba(0,122,255,0.1);border:1px solid rgba(0,122,255,0.35);color:#0a84ff;font-weight:800;cursor:pointer;margin-top:10px;display:flex;align-items:center;justify-content:center;gap:8px;">🗺 Xaritadan belgilash</button>
                <!-- 🗑 Sariq ogohlantirish oynachasi OLIB TASHLANDI (talab bo'yicha).
                     Ma'lumot baribir yo'qolmadi: kuryer kartochkasining tagida
                     "Faqat Samarqand shahar ichida · 1–2 kun" yozuvi turadi va
                     pastdagi tasdiqlash tumbleri ham shu haqda eslatadi. -->
                <label id="dlv-smq-card" onclick="toggleSmqConfirm()" style="display:flex;align-items:center;gap:14px;margin-top:14px;cursor:pointer;padding:16px;border-radius:16px;background:rgba(255,255,255,0.03);border:1.5px solid var(--glass-border);transition:all .25s ease;">
                    <input type="checkbox" id="dlv-smq-confirm" style="display:none;">
                    <div id="dlv-smq-toggle" style="width:44px;height:26px;border-radius:13px;background:rgba(255,255,255,0.12);position:relative;flex-shrink:0;transition:background .25s ease;">
                        <div id="dlv-smq-knob" style="width:22px;height:22px;border-radius:50%;background:#fff;position:absolute;top:2px;left:2px;transition:transform .25s ease;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>
                    </div>
                    <div style="flex:1;">
                        <div id="dlv-smq-text" style="font-size:14px;font-weight:700;color:#fff;transition:color .25s;">📍 Manzilim Samarqand shahar ichida</div>
                        <div id="dlv-smq-hint" style="font-size:11px;color:var(--text-muted);margin-top:3px;transition:color .25s;">Tasdiqlash uchun bosing</div>
                    </div>
                </label>
            </div>

            <div id="dlv-bts-box" style="display:none; margin-top:16px;">
                <div style="font-size:11px;font-weight:800;color:var(--luxury-gold);letter-spacing:1px;margin-bottom:10px;">📦 VILOYAT → TUMAN → FILIAL</div>
                <select id="dlv-bts-region" class="admin-input" style="padding:15px;margin-bottom:12px;" onchange="updateBtsDistricts()"><option value="">-- Viloyatni tanlang --</option></select>
                <select id="dlv-bts-district" class="admin-input" style="padding:15px;margin-bottom:12px;display:none;" onchange="updateBtsBranches()"><option value="">-- Tumanni tanlang --</option></select>
                <div id="dlv-bts-branch-box" style="display:none;">
                    <select id="dlv-bts-branch" class="admin-input" style="padding:15px;margin-bottom:12px;" onchange="showBranchInfo()"></select>
                </div>
                <div id="dlv-bts-info" style="display:none;margin-top:8px;padding:14px;border-radius:14px;background:rgba(212,175,55,0.06);border:1px solid rgba(212,175,55,0.2);">
                    <div id="dlv-bts-info-name" style="font-weight:800;font-size:14px;color:#fff;margin-bottom:6px;"></div>
                    <div id="dlv-bts-info-address" style="font-size:12px;color:var(--text-muted);margin-bottom:4px;"></div>
                    <div id="dlv-bts-info-landmark" style="font-size:12px;color:var(--luxury-gold);margin-bottom:4px;"></div>
                    <div id="dlv-bts-info-hours" style="font-size:11px;color:var(--text-muted);"></div>
                </div>
            </div>

            <button id="dlv-continue-btn" onclick="confirmDelivery()" style="width:100%;padding:17px;background:var(--gold-gradient);color:#000;border:none;border-radius:16px;font-weight:800;font-size:15px;cursor:pointer;margin-top:20px;box-shadow:0 8px 22px rgba(212,175,55,0.3);">To'lovga o'tish →</button>
        </div>`;
    // CSS bir marta
    if (!document.getElementById('dlv-style')) {
        let st = document.createElement('style');
        st.id = 'dlv-style';
        st.textContent = `
            .dlv-method-card{display:flex;align-items:center;gap:14px;background:rgba(255,255,255,0.03);border:1.5px solid var(--glass-border);border-radius:18px;padding:16px;margin-bottom:12px;cursor:pointer;transition:0.2s;}
            .dlv-method-card.selected{background:rgba(212,175,55,0.1);border-color:var(--luxury-gold);}
            .dlv-method-card .dlv-check{width:24px;height:24px;border-radius:50%;border:2px solid var(--glass-border);display:flex;align-items:center;justify-content:center;color:transparent;font-size:13px;font-weight:800;flex-shrink:0;}
            .dlv-method-card.selected .dlv-check{background:var(--luxury-gold);border-color:var(--luxury-gold);color:#000;}
            .dlv-addr-item{display:flex;align-items:center;gap:10px;padding:12px;background:rgba(255,255,255,0.03);border:1.5px solid var(--glass-border);border-radius:12px;margin-bottom:8px;cursor:pointer;transition:0.2s;}
            .dlv-addr-item.selected{background:rgba(48,209,88,0.1);border-color:#30d158;}
            .dlv-addr-radio{width:20px;height:20px;border-radius:50%;border:2px solid var(--glass-border);flex-shrink:0;}
            .dlv-addr-item.selected .dlv-addr-radio{border-color:#30d158;background:radial-gradient(circle,#30d158 40%,transparent 45%);}
            /* 🗑️ Manzilni o'chirish tugmasi — nozik, premium uslubda */
            .dlv-addr-del{flex-shrink:0;width:30px;height:30px;border-radius:50%;border:none;background:rgba(255,255,255,0.05);color:rgba(255,255,255,0.4);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:.18s;-webkit-tap-highlight-color:transparent;padding:0;margin-left:2px;}
            .dlv-addr-del svg{width:15px;height:15px;display:block;}
            .dlv-addr-del:hover{background:rgba(255,69,58,0.15);color:#ff453a;}
            .dlv-addr-del:active{transform:scale(0.82);background:rgba(255,69,58,0.28);color:#ff453a;}
            html[data-theme="light"] .dlv-addr-del{background:rgba(0,0,0,0.04);color:rgba(0,0,0,0.35);}
            html[data-theme="light"] .dlv-addr-del:hover{background:rgba(255,69,58,0.12);color:#e3002f;}
            #map-picker-overlay{position:fixed;inset:0;z-index:99999;background:#000;display:flex;flex-direction:column;}
            #map-picker-map{flex:1;width:100%;position:relative;}
            #map-picker-bar{padding:14px 16px calc(14px + env(safe-area-inset-bottom,0px));background:rgba(15,15,17,0.97);display:flex;gap:10px;align-items:center;}
            /* 🎯 "Mening joylashuvim" (GPS) tugmasi — xarita ustida suzuvchi */
            #map-locate-btn{position:absolute;right:16px;bottom:20px;z-index:1000;width:52px;height:52px;border-radius:50%;border:none;cursor:pointer;background:rgba(20,20,22,0.92);box-shadow:0 6px 20px rgba(0,0,0,0.45),0 0 0 1px rgba(212,175,55,0.25);display:flex;align-items:center;justify-content:center;color:var(--luxury-gold,#d4af37);-webkit-tap-highlight-color:transparent;transition:transform .18s ease,background .2s;}
            #map-locate-btn:active{transform:scale(0.88);background:rgba(212,175,55,0.18);}
            #map-locate-btn svg{width:26px;height:26px;display:block;}
            #map-locate-btn.locating svg{animation:mapLocateSpin 0.9s linear infinite;}
            @keyframes mapLocateSpin{to{transform:rotate(360deg);}}
            #map-locate-hint{position:absolute;left:50%;top:16px;transform:translateX(-50%);z-index:1000;background:rgba(20,20,22,0.92);color:#fff;font-size:12.5px;font-weight:600;padding:9px 16px;border-radius:20px;box-shadow:0 4px 16px rgba(0,0,0,0.4);pointer-events:none;white-space:nowrap;}
        `;
        document.head.appendChild(st);
    }
    // Region select to'ldirish
    let regSel = document.getElementById('dlv-bts-region');
    if (regSel) { for (let r in window.BTS_BRANCHES) { let o = document.createElement('option'); o.value = r; o.textContent = r; regSel.appendChild(o); } }

    document.getElementById('cartModal').style.display = 'none';
    m.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    // 🧭 Nazad bitta qadam orqaga: oldingi oynani (savat) stack'ga qo'yamiz
    window._modalStack = window._modalStack || [];
    window._modalStack.push(activeModal || 'cartModal');
    activeModal = 'deliveryModal';
    window.history.pushState({ modal: 'deliveryModal' }, "");
    if (typeof tg !== 'undefined' && tg.BackButton) tg.BackButton.show();
    updateBtns();
    // Avvalgi tanlovni tiklash
    window._dlvMethod = null;
};

window.backToCartFromDelivery = () => {
    // 🧭 Yagona yo'l: history.back() -> popstate (modal stack) savatga qaytaradi
    window.history.back();
};

window.toggleSmqConfirm = () => {
    let chk = document.getElementById('dlv-smq-confirm');
    let card = document.getElementById('dlv-smq-card');
    let toggle = document.getElementById('dlv-smq-toggle');
    let knob = document.getElementById('dlv-smq-knob');
    let text = document.getElementById('dlv-smq-text');
    let hint = document.getElementById('dlv-smq-hint');
    chk.checked = !chk.checked;
    if (chk.checked) {
        card.style.background = 'rgba(48,209,88,0.1)';
        card.style.borderColor = '#30d158';
        toggle.style.background = '#30d158';
        knob.style.transform = 'translateX(18px)';
        text.style.color = '#30d158';
        text.textContent = '✅ Tasdiqlandim — Samarqand shahar ichida';
        hint.textContent = 'Kuryer yetkazib beradi';
        hint.style.color = '#30d158';
    } else {
        card.style.background = 'rgba(255,255,255,0.03)';
        card.style.borderColor = 'var(--glass-border)';
        toggle.style.background = 'rgba(255,255,255,0.12)';
        knob.style.transform = 'translateX(0)';
        text.style.color = '#fff';
        text.textContent = '📍 Manzilim Samarqand shahar ichida';
        hint.textContent = 'Tasdiqlash uchun bosing';
        hint.style.color = 'var(--text-muted)';
    }
    _hap('selection');
};

window.selectDeliveryMethod = (method) => {
    window._dlvMethod = method;
    document.getElementById('dlv-courier').classList.toggle('selected', method === 'courier');
    document.getElementById('dlv-bts').classList.toggle('selected', method === 'bts');
    document.getElementById('dlv-courier-box').style.display = method === 'courier' ? 'block' : 'none';
    document.getElementById('dlv-bts-box').style.display = method === 'bts' ? 'block' : 'none';
    if (method === 'courier') renderCourierAddresses();
    _hap('selection');
};

window._dlvSelectedAddr = null;
window.renderCourierAddresses = () => {
    let box = document.getElementById('dlv-addresses');
    if (!box) return;
    let addrs = (typeof getAddresses === 'function') ? getAddresses() : [];
    if (addrs.length === 0) {
        box.innerHTML = `<div style="color:var(--text-muted);font-size:12px;padding:8px;text-align:center;">Saqlangan manzil yo'q. Xaritadan belgilang yoki profilda qo'shing.</div>`;
        return;
    }
    box.innerHTML = addrs.map((a, i) => `
        <div class="dlv-addr-item ${window._dlvSelectedAddr===i?'selected':''}" onclick="pickDlvAddress(${i})">
            <div class="dlv-addr-radio"></div>
            <span style="font-size:17px;">${a.type==='home'?'🏠':a.type==='work'?'🏢':'📍'}</span>
            <div style="flex:1;min-width:0;"><div style="font-size:13px;font-weight:700;color:#fff;">${a.label||(a.type==='home'?'Uy':a.type==='work'?'Ish':'Manzil')}</div><div style="font-size:11px;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${a.address}</div></div>
            <button class="dlv-addr-del" onclick="event.stopPropagation(); deleteDlvAddress(${i})" title="O'chirish" aria-label="Manzilni o'chirish"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
        </div>`).join('');
};
window.pickDlvAddress = (idx) => {
    window._dlvSelectedAddr = idx;
    renderCourierAddresses();
    _hap('light');
};

// 🗑️ Saqlangan manzilni o'chirish (tasdiqlash bilan)
window.deleteDlvAddress = (idx) => {
    let addrs = (typeof getAddresses === 'function') ? getAddresses() : [];
    if (!addrs[idx]) return;
    let nm = addrs[idx].label || addrs[idx].address || 'Ushbu manzil';
    let doDelete = function() {
        let arr = (typeof getAddresses === 'function') ? getAddresses() : [];
        arr.splice(idx, 1);
        if (typeof saveAddresses === 'function') saveAddresses(arr); // localStorage + Firebase
        // Tanlangan manzil indeksini to'g'rilaymiz
        if (window._dlvSelectedAddr === idx) window._dlvSelectedAddr = null;
        else if (typeof window._dlvSelectedAddr === 'number' && window._dlvSelectedAddr > idx) window._dlvSelectedAddr--;
        renderCourierAddresses();
        showToast("Manzil o'chirildi", "success");
        try { if (typeof _hap === 'function') _hap('success'); } catch(e){}
    };
    if (typeof tg !== 'undefined' && tg.showConfirm) {
        tg.showConfirm(`"${nm}" manzilini o'chirasizmi?`, function(ok){ if(ok) doDelete(); });
    } else if (confirm(`"${nm}" manzilini o'chirasizmi?`)) {
        doDelete();
    }
};

window.updateBtsDistricts = () => {
    let reg = document.getElementById('dlv-bts-region').value;
    let distSel = document.getElementById('dlv-bts-district');
    let brBox = document.getElementById('dlv-bts-branch-box');
    let infoBox = document.getElementById('dlv-bts-info');
    distSel.style.display = 'none'; brBox.style.display = 'none'; infoBox.style.display = 'none';
    if (!reg) return;
    let districts = window.BTS_BRANCHES[reg];
    if (!districts) return;
    distSel.innerHTML = '<option value="">-- Tumanni tanlang --</option>' +
        Object.keys(districts).map(d => `<option value="${d}">${d}</option>`).join('');
    distSel.style.display = 'block';
};

window.updateBtsBranches = () => {
    let reg = document.getElementById('dlv-bts-region').value;
    let dist = document.getElementById('dlv-bts-district').value;
    let box = document.getElementById('dlv-bts-branch-box');
    let sel = document.getElementById('dlv-bts-branch');
    let infoBox = document.getElementById('dlv-bts-info');
    box.style.display = 'none'; infoBox.style.display = 'none';
    if (!reg || !dist) return;
    let branches = (window.BTS_BRANCHES[reg] || {})[dist] || [];
    if (!branches.length) return;
    sel.innerHTML = '<option value="">-- Filialni tanlang --</option>' +
        branches.map((b,i) => `<option value="${i}">📦 ${b.name}</option>`).join('');
    box.style.display = 'block';
};

window.showBranchInfo = () => {
    let reg = document.getElementById('dlv-bts-region').value;
    let dist = document.getElementById('dlv-bts-district').value;
    let idx = document.getElementById('dlv-bts-branch').value;
    let infoBox = document.getElementById('dlv-bts-info');
    infoBox.style.display = 'none';
    if (idx === '' || !reg || !dist) return;
    let branches = (window.BTS_BRANCHES[reg] || {})[dist] || [];
    let b = branches[parseInt(idx)];
    if (!b) return;
    document.getElementById('dlv-bts-info-name').textContent = '📦 BTS ' + b.name;
    document.getElementById('dlv-bts-info-address').textContent = '📍 ' + b.address;
    document.getElementById('dlv-bts-info-landmark').textContent = '🏷 Mo\'ljal: ' + b.landmark;
    document.getElementById('dlv-bts-info-hours').textContent = '🕒 ' + b.hours;
    infoBox.style.display = 'block';
    _hap('light');
};

window.confirmDelivery = () => {
    if (!window._dlvMethod) { showToast("Yetkazish usulini tanlang!", "warning"); return; }
    if (window._dlvMethod === 'courier') {
        let chk = document.getElementById('dlv-smq-confirm');
        if (!chk || !chk.checked) { showToast("Kuryer faqat Samarqand shahar ichida. Tasdiqlang yoki 📦 BTS Pochtani tanlang.", "warning"); return; }
        let addrs = (typeof getAddresses === 'function') ? getAddresses() : [];
        if (window._dlvSelectedAddr === null || !addrs[window._dlvSelectedAddr]) { showToast("Manzilni tanlang yoki xaritadan belgilang!", "warning"); return; }
        let a = addrs[window._dlvSelectedAddr];
        window.selectedDelivery = { method: 'courier', address: a.address, mapLink: a.mapLink || '', city: 'Samarqand' };
    } else if (window._dlvMethod === 'bts') {
        let reg = document.getElementById('dlv-bts-region').value;
        if (!reg) { showToast("Viloyatni tanlang!", "warning"); return; }
        let dist = document.getElementById('dlv-bts-district').value;
        if (!dist) { showToast("Tumanni tanlang!", "warning"); return; }
        let idx = document.getElementById('dlv-bts-branch').value;
        if (idx === '') { showToast("Filialni tanlang!", "warning"); return; }
        let branches = (window.BTS_BRANCHES[reg] || {})[dist] || [];
        let b = branches[parseInt(idx)];
        if (!b) { showToast("Filial topilmadi", "warning"); return; }
        window.selectedDelivery = { method: 'bts', region: reg, district: dist, branch: b.name, branchAddress: b.address, branchLandmark: b.landmark, branchHours: b.hours };
    }
    // To'lovga o'tish
    document.getElementById('deliveryModal').style.display = 'none';
    _hap('success');
    if (typeof openPaymentModal === 'function') openPaymentModal();
};

// ══════════════════════════════════════════════════════════════════
// 🗺 XARITADAN MANZIL TANLASH — iOS 26 / Apple Maps uslubi (Leaflet + OSM)
// ──────────────────────────────────────────────────────────────────
// 🐞 ILGARI «Xaritadan belgilash» bosilganda HECH NARSA ochilmasdi:
//    overlay'ning BARCHA CSS qoidalari faqat eski (endi chaqirilmaydigan)
//    openDeliveryModal ichida inject qilinardi. Overlay sahifa oxiriga oddiy
//    blok bo'lib qo'shilar, xarita balandligi 0 bo'lib, ochiq oyna ostida
//    qolib ketardi. Endi CSS statik (`a1-ios26-pages2`), oyna har doim ustda.
// Yangi mantiq:
//   • Pin MARKAZDA turadi, xarita uning ostidan suriladi (Apple/Yandex kabi)
//   • Surish to'xtagach manzil matni avtomatik aniqlanadi (OSM Nominatim)
//   • Qidiruv: ko'cha / joy nomi bo'yicha (O'zbekiston ichida)
//   • «Mening joylashuvim» — ko'k nuqta + aniqlik, Telegram LocationManager zaxira
//   • Qorong'i mavzuda qora xarita, yorug'da — yorug'
//   • Manzil matn + koordinata + Google havola bilan saqlanadi
// ══════════════════════════════════════════════════════════════════
window.YANDEX_API_KEY = ""; // (eski sozlama — endi ishlatilmaydi, Leaflet/OSM kalitsiz ishlaydi)
window._pickedCoords = null;
window._mapPickerObj = null;
window._mapMarker = null;
window._mapEngine = 'leaflet';

(function () {
    var DEF_CENTER = [39.6542, 66.9597]; // Samarqand (kuryer xizmati shu yerda)
    var SVG = {
        x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>',
        mag: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
        nav: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 3 3 10.5l7.5 2.5L13 21z" fill="currentColor" stroke="none"/></svg>',
        pin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/></svg>',
        home: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/></svg>',
        work: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2.5" y="7" width="19" height="13" rx="2.5"/><path d="M8.5 7V5a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v2M2.5 13h19"/></svg>',
        shop: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9.5 4.5 4h15L21 9.5"/><path d="M3 9.5a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0"/><path d="M5 12v8h14v-8"/></svg>',
        dots: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="19" cy="12" r="1.6" fill="currentColor"/></svg>'
    };
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }
    function hap(k) { try { if (typeof _hap === 'function') _hap(k); } catch (e) {} }
    function $(id) { return document.getElementById(id); }
    function isDark() { return document.documentElement.getAttribute('data-theme') !== 'light'; }
    function fmtLL(lat, lng) { return lat.toFixed(5) + ', ' + lng.toFixed(5); }

    /* ——— Leaflet yuklash (unpkg → jsDelivr zaxira) ——— */
    var _leafletLoading = null;
    function ensureLeaflet() {
        if (window.L && window.L.map) return Promise.resolve();
        if (_leafletLoading) return _leafletLoading;
        var bases = ['https://unpkg.com/leaflet@1.9.4/dist/', 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/'];
        _leafletLoading = new Promise(function (resolve, reject) {
            var i = 0;
            (function tryNext() {
                if (i >= bases.length) { _leafletLoading = null; reject(new Error('xarita yuklanmadi')); return; }
                var base = bases[i++];
                var css = document.createElement('link'); css.rel = 'stylesheet'; css.href = base + 'leaflet.css'; document.head.appendChild(css);
                var js = document.createElement('script'); js.src = base + 'leaflet.js';
                js.onload = function () { resolve(); };
                js.onerror = function () { try { css.remove(); js.remove(); } catch (e) {} tryNext(); };
                document.head.appendChild(js);
            })();
        });
        return _leafletLoading;
    }
    window.ensureLeaflet = ensureLeaflet;

    /* ——— Geokod (OSM Nominatim: 1 so'rov/soniya qoidasiga rioya qilamiz) ——— */
    var G = { cache: {}, last: 0, ctrl: null };
    function nomi(url) {
        var wait = Math.max(0, 1100 - (Date.now() - G.last));
        return new Promise(function (res) { setTimeout(res, wait); }).then(function () {
            G.last = Date.now();
            return fetch(url + (url.indexOf('?') > -1 ? '&' : '?') + 'accept-language=uz').then(function (r) { if (!r.ok) throw new Error('geo ' + r.status); return r.json(); });
        });
    }
    function prettyAddr(j) {
        if (!j) return '';
        var a = j.address || {};
        var street = a.road || a.pedestrian || a.footway || a.residential || a.street || '';
        var line1 = [street, a.house_number].filter(Boolean).join(' ');
        var area = a.neighbourhood || a.quarter || a.suburb || a.city_district || a.hamlet || '';
        var city = a.city || a.town || a.village || a.county || a.state || '';
        var parts = [line1 || j.name || '', area, city].filter(function (x, i, arr) { return x && arr.indexOf(x) === i; });
        if (!parts.length && j.display_name) parts = String(j.display_name).split(',').slice(0, 3).map(function (s) { return s.trim(); });
        return parts.join(', ');
    }
    window._a1Geo = {
        reverse: function (lat, lng) {
            var k = lat.toFixed(4) + ',' + lng.toFixed(4);
            if (G.cache[k]) return Promise.resolve(G.cache[k]);
            return nomi('https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&zoom=18&lat=' + lat + '&lon=' + lng)
                .then(function (j) { var t = prettyAddr(j); G.cache[k] = t; return t; });
        },
        search: function (q, near) {
            var url = 'https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=7&countrycodes=uz&q=' + encodeURIComponent(q);
            if (near) url += '&viewbox=' + (near.lng - .6) + ',' + (near.lat + .45) + ',' + (near.lng + .6) + ',' + (near.lat - .45);
            return nomi(url).then(function (arr) { return (arr || []).map(function (j) { return { lat: +j.lat, lng: +j.lon, title: (j.name || prettyAddr(j).split(',')[0] || '').trim(), sub: prettyAddr(j) }; }); });
        }
    };

    /* ——— Oxirgi saqlangan nuqta (xarita shu yerdan ochiladi) ——— */
    function addrLL(a) {
        if (!a) return null;
        if (isFinite(+a.lat) && isFinite(+a.lng) && a.lat !== '' && a.lng !== '') return { lat: +a.lat, lng: +a.lng };
        var m = String(a.mapLink || '').match(/q=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/) || String(a.address || '').match(/(-?\d{1,3}\.\d{3,})\s*,\s*(-?\d{1,3}\.\d{3,})/);
        return m ? { lat: +m[1], lng: +m[2] } : null;
    }
    window._addrLatLng = addrLL;
    function lastPoint() {
        try { var A = (typeof getAddresses === 'function') ? getAddresses() : []; for (var i = A.length - 1; i >= 0; i--) { var p = addrLL(A[i]); if (p) return p; } } catch (e) {}
        return null;
    }

    /* ——— Oyna ——— */
    var S = { map: null, tiles: null, dark: null, me: null, geoT: 0, geoSeq: 0, addr: '', qT: 0 };
    function build() {
        var ov = $('map-picker-overlay');
        if (ov) return ov;
        ov = document.createElement('div');
        ov.id = 'map-picker-overlay';
        ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-label', 'Xaritadan manzil tanlash');
        ov.innerHTML =
            '<div id="map-picker-map"></div>' +
            '<div class="mp-load"><i></i>Xarita yuklanmoqda…</div>' +
            '<div class="mp-pin" id="mp-pin" aria-hidden="true"><div class="mp-pin-stick"></div><div class="mp-pin-head"><b>A1</b></div><div class="mp-pin-dot"></div></div>' +
            '<div class="mp-top"><button type="button" class="mp-circ" onclick="closeMapPicker()" aria-label="Yopish">' + SVG.x + '</button>' +
                '<label class="mp-search" id="mp-search">' + SVG.mag + '<input id="mp-q" type="search" enterkeyhint="search" autocomplete="off" placeholder="Ko\u2018cha yoki joy nomini qidiring"><button type="button" class="mp-x" aria-label="Tozalash" onclick="window._mpClearQ()">' + SVG.x + '</button></label></div>' +
            '<div class="mp-res" id="mp-res"></div>' +
            '<div id="map-locate-hint" class="mp-hint">Xaritani suring — pin turgan joy tanlanadi</div>' +
            '<div class="mp-side"><button type="button" id="map-locate-btn" class="mp-circ" onclick="locateMe()" aria-label="Mening joylashuvim">' + SVG.nav + '</button></div>' +
            '<div id="map-picker-bar" class="mp-sheet"><div class="mp-grab"></div>' +
                '<div class="mp-addr is-busy" id="mp-addr"><span class="a1-ic">' + SVG.pin + '</span><div class="mp-addr-tx"><b id="mp-addr-t">Joy aniqlanmoqda</b><small id="mp-addr-s">—</small></div></div>' +
                '<button type="button" class="a1-btn is-gold mp-ok" id="mp-ok" onclick="confirmMapLocation()">Shu manzilni tanlash</button>' +
                '<p class="mp-attr">© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a></p></div>';
        document.body.appendChild(ov);
        var q = $('mp-q');
        q.addEventListener('input', function () {
            $('mp-search').classList.toggle('has-q', !!q.value);
            clearTimeout(S.qT);
            var v = q.value.trim();
            if (v.length < 3) { showRes(null); return; }
            S.qT = setTimeout(function () { doSearch(v); }, 650);
        });
        q.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); clearTimeout(S.qT); if (q.value.trim().length >= 2) doSearch(q.value.trim()); } });
        q.addEventListener('focus', function () { hint(false); });
        return ov;
    }
    function hint(show, text) {
        var h = $('map-locate-hint'); if (!h) return;
        if (text) h.textContent = text;
        h.classList.toggle('hide', !show);
    }
    function showRes(list, msg) {
        var r = $('mp-res'); if (!r) return;
        if (!list && !msg) { r.classList.remove('show'); r.innerHTML = ''; return; }
        r.innerHTML = msg ? '<div class="mp-res-empty">' + esc(msg) + '</div>' : list.map(function (it, i) {
            return '<button type="button" onclick="window._mpPick(' + i + ')"><span class="a1-ic">' + SVG.pin + '</span><span class="mp-res-tx"><b>' + esc(it.title || it.sub) + '</b><small>' + esc(it.sub) + '</small></span></button>';
        }).join('');
        r.classList.add('show');
    }
    function doSearch(v) {
        showRes(null, 'Qidirilmoqda…');
        var c = S.map ? S.map.getCenter() : null;
        window._a1Geo.search(v, c ? { lat: c.lat, lng: c.lng } : null).then(function (list) {
            S.results = list;
            if ($('mp-q').value.trim() !== v) return;
            if (!list.length) showRes(null, 'Hech narsa topilmadi — boshqacha yozib ko\u2018ring');
            else showRes(list);
        }).catch(function () { showRes(null, 'Qidiruv ishlamadi — internetni tekshiring'); });
    }
    window._mpPick = function (i) {
        var it = S.results && S.results[i]; if (!it || !S.map) return;
        showRes(null); try { $('mp-q').blur(); } catch (e) {}
        S.map.flyTo([it.lat, it.lng], 17, { duration: .8 });
        hap('selection');
    };
    window._mpClearQ = function () { var q = $('mp-q'); if (q) { q.value = ''; q.focus(); } $('mp-search').classList.remove('has-q'); showRes(null); };

    function setAddr(title, sub, busy) {
        var a = $('mp-addr'); if (!a) return;
        a.classList.toggle('is-busy', !!busy);
        $('mp-addr-t').textContent = title;
        $('mp-addr-s').textContent = sub || '';
    }
    function onMoveEnd() {
        var c = S.map.getCenter();
        window._pickedCoords = { lat: c.lat, lng: c.lng };
        var pin = $('mp-pin'); if (pin) pin.classList.remove('lift');
        S.addr = '';
        setAddr('Joy aniqlanmoqda', fmtLL(c.lat, c.lng), true);
        clearTimeout(S.geoT);
        var seq = ++S.geoSeq;
        S.geoT = setTimeout(function () {
            window._a1Geo.reverse(c.lat, c.lng).then(function (t) {
                if (seq !== S.geoSeq) return;
                S.addr = t || '';
                setAddr(t || 'Belgilangan nuqta', fmtLL(c.lat, c.lng), false);
            }).catch(function () {
                if (seq !== S.geoSeq) return;
                setAddr('Belgilangan nuqta', fmtLL(c.lat, c.lng), false);
            });
        }, 380);
    }
    function applyTiles() {
        var dark = isDark();
        S.dark = dark;
        var el = $('map-picker-map'); if (el) el.classList.toggle('mp-dark', dark);
        if (S.tiles) return;
        /* OSM — Samarqand bo'yicha eng batafsil (binolar, o'zbekcha nomlar).
           Ko'p xato bo'lsa — Esri zaxira manbasiga o'tamiz. */
        var errs = 0, fell = false;
        S.tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, maxNativeZoom: 19, crossOrigin: false, referrerPolicy: 'strict-origin-when-cross-origin' });
        S.tiles.on('tileerror', function () {
            if (fell || ++errs < 4) return;
            fell = true;
            try { S.map.removeLayer(S.tiles); } catch (e) {}
            S.tiles = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, maxNativeZoom: 17 }).addTo(S.map);
            var at = document.querySelector('#map-picker-overlay .mp-attr'); if (at) at.innerHTML = '\u00A9 Esri \u00B7 \u00A9 OpenStreetMap';
        });
        S.tiles.addTo(S.map);
    }
    function initMap(center, zoom) {
        var el = $('map-picker-map');
        S.map = L.map(el, { zoomControl: false, attributionControl: false, tap: false, zoomSnap: .25, inertia: true }).setView(center, zoom);
        applyTiles();
        S.map.on('movestart', function () { var p = $('mp-pin'); if (p) p.classList.add('lift'); hint(false); showRes(null); });
        S.map.on('moveend', onMoveEnd);
        window._mapPickerObj = S.map;
    }

    window.openMapPicker = function () {
        var ov = build();
        try { if (document.activeElement) document.activeElement.blur(); } catch (e) {}
        ov.style.display = 'flex';
        ov.classList.remove('mp-in'); void ov.offsetWidth; ov.classList.add('mp-in');
        window._pickedCoords = null;
        var q = $('mp-q'); if (q) { q.value = ''; $('mp-search').classList.remove('has-q'); }
        showRes(null);
        hint(true, 'Xaritani suring — pin turgan joy tanlanadi');
        setTimeout(function () { hint(false); }, 3600);
        setAddr('Joy aniqlanmoqda', '—', true);
        // 🧭 Nazad tugmasi xaritani yopa olishi uchun navigatsiyaga ulaymiz
        window._mapPrevActive = (activeModal && activeModal !== '__mappicker__') ? activeModal : (window._mapPrevActive || null);
        activeModal = '__mappicker__';
        window.history.pushState({ modal: '__mappicker__' }, '');
        try { if (typeof tg !== 'undefined' && tg.BackButton) tg.BackButton.show(); } catch (e) {}
        hap('light');

        var start = lastPoint();
        ensureLeaflet().then(function () {
            requestAnimationFrame(function () {
                if (!S.map) initMap(start ? [start.lat, start.lng] : DEF_CENTER, start ? 16 : 13);
                else { applyTiles(); S.map.invalidateSize(); if (start) S.map.setView([start.lat, start.lng], 16, { animate: false }); }
                ov.classList.add('is-ready');
                setTimeout(function () { try { S.map.invalidateSize(); } catch (e) {} onMoveEnd(); }, 60);
                if (!start) locate(true);
            });
        }).catch(function () {
            showToast("Xarita yuklanmadi. Internetni tekshiring.", "warning");
            setAddr('Xarita yuklanmadi', 'Internet aloqasini tekshiring', false);
        });
    };
    window.closeMapPicker = function () {
        if (activeModal === '__mappicker__') { window.history.back(); }
        else { var ov = $('map-picker-overlay'); if (ov) ov.style.display = 'none'; }
    };
    // Tashqi chaqiruvlar uchun (moslik): xaritani shu nuqtaga olib boradi
    window._placeMarker = function (lat, lng) {
        window._pickedCoords = { lat: lat, lng: lng };
        if (S.map) S.map.setView([lat, lng], Math.max(S.map.getZoom(), 16));
    };

    /* ——— 📍 Mening joylashuvim ——— */
    function showMe(lat, lng, acc) {
        if (!S.map || !window.L) return;
        var icon = L.divIcon({ className: '', html: '<div class="mp-me"><i></i></div>', iconSize: [22, 22], iconAnchor: [11, 11] });
        if (S.me) S.me.setLatLng([lat, lng]); else S.me = L.marker([lat, lng], { icon: icon, interactive: false, keyboard: false }).addTo(S.map);
        if (acc && acc < 300) {
            if (S.acc) S.acc.setLatLng([lat, lng]).setRadius(acc);
            else S.acc = L.circle([lat, lng], { radius: acc, stroke: false, fillColor: '#0a84ff', fillOpacity: .12, interactive: false }).addTo(S.map);
        }
    }
    function viaTelegram(ok, fail) {
        try {
            var lm = (typeof tg !== 'undefined' && tg) ? tg.LocationManager : null;
            if (!lm || !(tg.isVersionAtLeast && tg.isVersionAtLeast('8.0'))) { fail(); return; }
            var go = function () {
                if (!lm.isLocationAvailable) { fail(); return; }
                lm.getLocation(function (loc) { if (loc && loc.latitude) ok(loc.latitude, loc.longitude, loc.horizontal_accuracy); else fail(); });
            };
            if (lm.isInited) go(); else lm.init(go);
        } catch (e) { fail(); }
    }
    function locate(silent) {
        var btn = $('map-locate-btn');
        if (btn) btn.classList.add('locating');
        if (!silent) hap('selection');
        var done = function (lat, lng, acc) {
            if (btn) btn.classList.remove('locating');
            showMe(lat, lng, acc);
            if (S.map) S.map.flyTo([lat, lng], 17, { duration: silent ? .01 : .8 });
            if (!silent) hap('success');
        };
        var fail = function (code) {
            if (btn) btn.classList.remove('locating');
            if (silent) return;
            var msg = "Joylashuvni aniqlab bo'lmadi";
            if (code === 1) msg = "Joylashuvga ruxsat berilmadi. Telegram/telefon sozlamalaridan yoqing.";
            else if (code === 3) msg = "Vaqt tugadi. Qayta urinib ko'ring.";
            showToast(msg, "warning");
        };
        if (!navigator.geolocation) { viaTelegram(done, function () { fail(0); }); return; }
        navigator.geolocation.getCurrentPosition(function (pos) {
            done(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy);
        }, function (err) {
            viaTelegram(done, function () { fail(err && err.code); });
        }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 15000 });
    }
    window.locateMe = function () { locate(false); };

    /* ——— ✅ Tasdiqlash → nom berish varag'i ——— */
    window.confirmMapLocation = function () {
        if (!window._pickedCoords) { showToast("Xaritani suring va nuqtani tanlang", "warning"); return; }
        openAddrNameModal();
    };
    var CHIPS = [['Uy', 'home', SVG.home], ['Ish', 'work', SVG.work], ["Do'kon", 'map', SVG.shop], ['Boshqa', 'map', SVG.dots]];
    window.openAddrNameModal = function () {
        var ov = $('addr-name-overlay');
        if (!ov) {
            ov = document.createElement('div');
            ov.id = 'addr-name-overlay';
            ov.onclick = function (e) { if (e.target === ov) closeAddrNameModal(); };
            ov.innerHTML =
                '<div id="addr-name-sheet" role="dialog" aria-label="Manzilga nom berish"><div class="mp-grab"></div>' +
                '<div class="an-h"><h3>Manzilni saqlash</h3><button type="button" class="mp-circ" style="width:32px;height:32px;box-shadow:none;background:var(--a-fill)" onclick="closeAddrNameModal()" aria-label="Yopish">' + SVG.x + '</button></div>' +
                '<div class="an-addr"><span class="a1-ic">' + SVG.pin + '</span><p id="addr-name-coords"></p></div>' +
                '<div class="an-chips" id="addr-name-chips">' + CHIPS.map(function (c, i) {
                    return '<button type="button" class="an-chip ans-chip" data-i="' + i + '" onclick="ansPickChip(this,\'' + c[0].replace(/'/g, "\\'") + '\')">' + c[2] + c[0] + '</button>';
                }).join('') + '</div>' +
                '<div class="an-grp"><input type="text" id="addr-name-input" maxlength="40" placeholder="Nomi (masalan: Uy, Ish, Onamnikiga)" autocomplete="off">' +
                '<input type="text" id="addr-name-extra" maxlength="120" placeholder="Uy / kvartira, podyezd, mo\u2018ljal (ixtiyoriy)" autocomplete="off"></div>' +
                '<button type="button" class="a1-btn is-gold" id="addr-name-save" onclick="saveMapAddressWithName()">Saqlash</button></div>';
            document.body.appendChild(ov);
        }
        var c = window._pickedCoords;
        var cEl = $('addr-name-coords');
        if (cEl && c) cEl.innerHTML = esc(S.addr || 'Xaritada belgilangan nuqta') + '<small>' + fmtLL(c.lat, c.lng) + '</small>';
        var inp = $('addr-name-input'); if (inp) inp.value = '';
        var ex = $('addr-name-extra'); if (ex) ex.value = '';
        document.querySelectorAll('#addr-name-chips .ans-chip').forEach(function (b) { b.classList.remove('sel'); });
        ov.style.display = 'flex';
        requestAnimationFrame(function () { ov.classList.add('show'); });
        hap('light');
    };
    window.closeAddrNameModal = function () {
        var nm = $('addr-name-overlay');
        if (nm) { nm.classList.remove('show'); setTimeout(function () { nm.style.display = 'none'; }, 260); }
    };
    window.ansPickChip = function (el, val) {
        document.querySelectorAll('#addr-name-chips .ans-chip').forEach(function (c) { c.classList.remove('sel'); });
        if (el) el.classList.add('sel');
        var inp = $('addr-name-input'); if (inp) inp.value = val;
        hap('selection');
    };
    window.saveMapAddressWithName = function () {
        if (!window._pickedCoords) { showToast("Xaritada nuqtani belgilang", "warning"); return; }
        var inp = $('addr-name-input');
        var name = (inp && inp.value ? inp.value.trim() : '');
        if (!name) { showToast("Manzilga nom bering (yoki tugmalardan birini tanlang)", "warning"); if (inp) inp.focus(); return; }
        var sel = document.querySelector('#addr-name-chips .ans-chip.sel');
        var type = sel ? CHIPS[+sel.getAttribute('data-i')][1] : 'map';
        if (sel && CHIPS[+sel.getAttribute('data-i')][0] !== name) type = 'map';
        var lat = window._pickedCoords.lat, lng = window._pickedCoords.lng;
        var extra = ($('addr-name-extra') && $('addr-name-extra').value.trim()) || '';
        var base = S.addr ? S.addr : ('📍 ' + fmtLL(lat, lng));
        var addrText = extra ? (base + ' — ' + extra) : base;
        var mapLink = 'https://www.google.com/maps?q=' + lat.toFixed(6) + ',' + lng.toFixed(6);
        if (typeof getAddresses === 'function') {
            var arr = getAddresses();
            arr.push({ type: type, label: name, address: addrText, mapLink: mapLink, lat: +lat.toFixed(6), lng: +lng.toFixed(6) });
            if (typeof saveAddresses === 'function') saveAddresses(arr);
            window._dlvSelectedAddr = arr.length - 1;
            if (typeof renderCourierAddresses === 'function') { try { renderCourierAddresses(); } catch (e) {} }
            try { if (typeof window.renderAddresses === 'function') window.renderAddresses(); } catch (e) {}
        }
        var nm = $('addr-name-overlay');
        if (nm) { nm.classList.remove('show'); setTimeout(function () { nm.style.display = 'none'; }, 260); }
        window.history.back(); // '__mappicker__' popstate xaritani yopib, oldingi oynaga qaytaradi
        showToast('📍 «' + esc(name) + '» manzili saqlandi', "success");
        hap('success');
    };
})();




