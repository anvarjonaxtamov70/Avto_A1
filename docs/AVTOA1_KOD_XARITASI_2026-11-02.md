# Avto A1 — kod tuzilishi, Light-only dizayn integratsiyasi uchun audit

**Sana:** 2026-11-02  
**Audit asosi:** `main` commit `c60699f0a184bc1c317069c327bf367f14d8bb1a`; `index.html` blob `98948c3421cf4e1cc7f95ed5f70162cb14424228`.  
**PR:** #338, `design/avtoa1-light-skyglass-integration`.  
**Chegara:** Avval kod tuzilishi va muhim kirish nuqtalari o'rganildi; keyingi real vazifa — Light mode UI. Kodning har bir tarmog'i **jonli bajarilib tekshirilgan degani emas**.

## 1. Loyiha arxitekturasi va yuklanish

- `index.html`: ~2,816,843 belgi, 46,083 qator. 65 ta `<script>` bloki (ayrimlari tashqi `src`), 74 ta `<style>` bloki. Shularning taxminan 1.6 MB'i inline JS, 1.0 MB'i inline CSS. Ko'plab eski va yangi CSS qatlamlari bir-birining ustidan yozadi. **Bitta stil o'zgarishining natijasi kaskad va specificity'ga bog'liq.**
- Dastlabki `a1-boot-gate` (taxm. 89-qator) `localStorage.avto_phase2` ichidagi `theme` orqali HTML root'ga `data-theme="light"` yoki `dark` qo'yadi. Dastlabki holat dark.
- `a1-perf-tier` (taxm. 237-qator) qurilma quvvatiga mos low/mid/high grafik/animatsiya rejimini tanlaydi. `html.lite` da ayrim blur/animatsiyalar o'chirilishi mumkin; dizaynni faqat yuqori quvvatli telefonda baholash yetarli emas.
- `index.html` bosh sahifa: admin-boshqariladigan `.slider-container > #main-slider`, `.search-box`, `#main-menu`, `#home-products.items-grid`, `.bottom-nav` (taxm. 6470–6790 qatorlar).
- `README.md`: bu GitHub Pages hostingidagi Telegram Mini App. `android-app/` Capacitor qobig'i ham mavjud; Android/iOS/WebView tajribalari alohida ko'rib chiqilishi kerak.
- `.github/workflows/deploy.yml`: `main` ga push'da avtomatik GitHub Pages deploy. `.github/build-site.js` deploydan oldin HTML ichidagi katta JS'ni alohida hash-fayllarga ajratib, CSS/JS'ni ixchamlaydi. Demak, oddiy PR Merge ham jonli foydalanuvchilarga ta'sir qilishi mumkin.
- `sw.js`: HTML uchun network-first/offline fallback; hashli JS uchun cache-first; Firebase/shriftlar uchun alohida strategiya. Light CSS fayli kesh yoki browser yuklanishida tekshirilsin.

## 2. Light/Dark mode: aniq kod xaritasi

- `<script id="a1-phase2-js">`, taxm. 19666-qator (86 KB) — `Phase2`: tema, profil, notification, cashback, achievements, warranty va analytics.
- `applyTheme(t)`, taxm. 19858-qator: `document.documentElement.setAttribute('data-theme', ...)`; Telegram header/background ranglariga ham tegadi.
- `P.toggleTheme(ev)`, taxm. 19869-qator: `P.state.theme`ni almashtiradi, ripple o'tish animatsiyasini ishlatadi, so'ng `save()` orqali holatni saqlaydi.
- `loadLocal()` va `saveRemote()`: tema tanlovi foydalanuvchi holatida saqlanishi/sinxronlanishi mumkin. Dark rejimni CSS orqali almashtirmaslik zarur.
- Existing Light CSS: `html[data-theme="light"]` selektori **ko'p marta** turli qatlamlarda uchraydi. Masalan eski Ivory & Gold theme, tabbar-liquid-glass, home-ios-2026, a1-ios26-card10 va boshqa CSS'lar.
- **Bizning xavfsiz chegaramiz:** `light-skyglass-preview/avtoa1-light-only.css` faqat `html[data-theme="light"]` bilan ishlaydi; `index.html`da faqat stylesheet `link` qo'shilgan. Dark selector, theme JavaScript, Firebase state o'zgarmagan.
- **Hal qilinmagan:** bu link `</head>` oldiga qo'shilgan; `<body>` ichida undan keyin keladigan ko'plab `<style>` bloklari bor. Ularning muayyan specificity/`!important`lari yangi rangni bosib ketishi mumkin. Browser computed-style/visual regression sinovi **shart**.
- Rollback: `index.html`dan yangi stylesheet `link`ni olib tashlab eski Light holatga qaytish mumkin. Kerak bo'lsa Light rejimini UI'dan o'chirish **alohida, testlangan feature flag** talab qiladi; hozir bunday flag qo'shilmagan.

## 3. Bosh sahifa va mahsulot kartalari

- `renderProducts()`, taxm. 10450-qator: `displayDB.slice(0, limitCount)`ni `#home-products`ga chizadi; katalog gridlarida lazy render mavjud. Bu ishlash tezligi uchun muhim.
- `cardHTML(p)`, taxm. 10509-qator: stock, badge, eski/yangi narx, flash chegirma/taymer, reyting, wishlist, taqqoslash, mahsulot rasm/nom, savat CTA ni HTML qiladi. `openProduct(id)` va `addToCartQuick(event,id)` kabi joriy handlerlar SAQLANSIN.
- `addToCartQuick(e,id)`, taxm. 10485-qator: razmerli mahsulotga variant tanlashni talab qiladi, stock va savatdagi jami miqdorni tekshiradi; `addToCartWithOptions`ni chaqiradi. Tugma dizaynini o'zgartirish bu tekshiruvlardan birini olib tashlash degani emas.
- Admin `settings/ui/cardStyle` orqali `market`, `appstore`, `classic` dizaynini tanlaydi (`card-style-switch`, taxm. 35428-qator). Sky Glass har xil karta variantlari uchun sinovdan o'tishi kerak.
- `customer-boost-2026-js` (taxm. 29420) my-car filtr, saralash, origin, search bilan; `home-filters-bulk-discount-js` (taxm. 30332) chegirma va home filter; `smart-search-2026-js` (taxm. 31014) chidamli qidiruv; `a1-reviews-v2-js` (taxm. 41102) xarid tekshiruvi/reviews.
- **Qoida:** demo narx, rasm, statik mahsulot kartochkasini jonli `cardHTML` o'rniga ko'chirmaslik. Real DB'dan kelgan ma'lumot va mavjud handlerlar qolishi kerak.

## 4. Banner / aksiya / aloqa slayderi

- Bosh sahifadagi `#main-slider` (taxm. 6485-qator) HTML fallbackda 4 slaydga ega; JS ularni yangilashi mumkin.
- `banner-admin-2026-js` (taxm. 32988-qator) `AvtoBanners` modulini yaratadi, `captureDefaults()`, `visibleList()`, `renderSlider()`, `load()`, `seedDefaults()`, `doUpload()`, `save()` funksiyalari mavjud.
- `renderSlider()` (taxm. 33220-qator) Firebase'dan kelgan banner ro'yxatidan faollari uchun `<img>`larni generatsiya qiladi, nuqta indikatorini sinxronlaydi, partner belgisini yangilaydi. Admin ko'rinadigan banner tartibini, yashirishni, rasmlarini o'zgartira oladi.
- `doUpload()` admin tanlagan faylni mavjud upload yordamchisi orqali yuklaydi; `save()` banner ma'lumotlarini bazaga yozadi.
- **Katta xavf:** demo `<section class="hero-banner">`ni haqiqiy `#main-slider`ga shunchaki qo'yib yuborish JS/Firebase bilan boshqariladigan rasmlarni buzishi mumkin. Faqat Light ko'rinishini yangilash uchun Dark'dagi bannerlar o'z holicha qolishi ham nazorat qilinishi kerak.
- **Yana bir muhim farq:** rasm ichiga CHIZILGAN katalog/aksiya/aloqa tugmalari bosiladigan HTML tugma EMAS. CTA klik funksiyasini olish uchun slayd komponenti uchun xavfsiz, semantik, boshqariladigan link/overlay mexanizmi zarur. Haqiqiy aksiya foizi, aloqa URL'i tasdiqlanmasdan o'ylab topilmasin.
- Tasdiqlangan 3 reklama rasmi hozirgi PR'da original binar asset sifatida repo'ga qo'yilmagan; demo rasmlari haqiqiy jonli banner emas.

## 5. Pastki menyu, sahifalar va glass

- `.bottom-nav` (taxm. 6787-qator) joriy `goHome()`, `showCatalog()`, savat va profil navigatsiyasiga bog'langan. Hodisalarni o'zgartirmasdan faqat ko'rinishni yangilash mumkin.
- `goHome()` (taxm. 12154-qator) tarix stacki va modal holatini tozalashni ham bajaradi. Tugma onclicklarini qayta yozish kerak emas.
- `tabbar-liquid-glass` (CSS, taxm. 35139-qator) — mavjud glass nav dizayni. Uni yangi Light CSS bilan to'qnashmasligi va badge'lar ekran chegarasidan kesilmasligi tekshirilsin.
- `a1-perf-tier-css` (taxm. 41610-qator) lite'ga alohida optimizatsiya beradi. Blur/box-shadow qisqartirilgan holda ham navigatsiya bosiladigan bo'lsin.

## 6. Buyurtma, autentifikatsiya, ombor, cashback — TEGMASLIK ZONASI

- `renderCartItems()`, taxm. 11112-qator: savatdagi haqiqiy mahsulot, variant va miqdorlar.
- `co-ios-checkout-js`, taxm. 34761-qator: kuryer/BTS, manzil, to'lov va tasdiqlash. `window.openCheckout` va `window._coSubmit` joriy oqimni ishlatadi.
- `cloudflare-worker.js` (~232 KB): /auth, /order-commit, /order-status, /order-notify, /order-deliver, /stock-commit, /upload, /login-phone, /phone-verify, /session, /merge-legacy, /admin-reset, /story-* va boshqalar. Buyurtma holati, server authorization, stock va cashbackni Worker yuritadi. **UI PR bu route'larga tegmasin.**
- `bot/bot.py` (~228 KB, ~4963 qator), `bot/order_ops.py`, `bot/account_ops.py`, `bot/ai_agent.py` (shuningdek boshqa bot modullari): Telegram callback, admin amallari, bot imzosi, AI va Worker bilan aloqa.
- `database.rules.json`: pul, zaxira va buyurtma holati uchun server-authoritative qoidalar. Light-only UI o'zgarishi bu qoidalarga tegmaydi.
- `sw.js`: offline va aktiv asset cache strategiyasi.

## 7. Mavjud CI va sinov chegarasi

- `.github/workflows/pr-check.yml` barcha PR'da JS sintaksisi, token tekshiruvi, customer, promo, tier/cashback, search, AI, auth timeout, order flow client/Worker, perf, reviews, stories, identity, admin reset, build-site, Python syntax va AI testlarini ishlatadi.
- `.github/workflows/deploy.yml` faqat `main` push bo'lganda nashr qiladi.
- #338 dagi `6384f96e...` commit uchun `PR Tekshiruv` workflow **success** qaytdi (2026-11-02); bu statik/integration testlar, **jonli Telegram, dizayn ko'rinishi yoki har xil telefon/tema testlari emas**.
- CSS/HTML vizual regression, Light↔Dark almashish, skelet/flash/banner admin, real Telegram WebView, iPhone Safari, Android WebView, lite va accessibility alohida test talab qiladi.

## 8. Qabul qilish mezonlari — keyingi aniq ishlar

1. **Ranglar:** 4 asosiy Sky Glass palitrasi faqat Light'da; Dark computed-style va screenshot oldingi bilan bir xil.
2. **3 banner:** tasdiqlangan Gazel, Aksiyalar, Aloqa assetlari repo'da; Light'da ko'rinadi, Dark'da eski/banner mavjud tizim buzilmaydi. Linklarning har biri to'g'ri joyga olib boradi; admin banner qo'shganda/slayd yangilanganda UI ishlaydi.
3. **Karta:** `market`, `appstore`, `classic`ning barchasida mahsulot/stock/price/discount/variant/like/cart ishlaydi. Demo mahsulot narxi jonliga tushmaydi.
4. **Nav:** 4 tab va barcha badge, modal/orqaga qaytish ishlaydi; glass effekti `lite` va reduced motion'da ham o'qiladigan.
5. **Safety:** Firebase, bot, Worker, savdo hisob-kitoblari va Dark JS o'zgartirilmaydi.
6. **Test:** GitHub Actions yashil, browser/Telegram real sinovi, qaytish (rollback) amalda tekshirilgan.
7. **Merge:** faqat 1–6 tasdiqlangandan keyin. PR #338 hozircha Draft bo'lib turadi.

## 9. Hozirgi PR #338ning haqiqiy holati

- `light-skyglass-preview/index.html` + `sky-glass.css`: **demo**, jonli DB bilan ishlamaydi.
- `light-skyglass-preview/avtoa1-light-only.css`: mavjud Light theme uchun yangi CSS, `index.html`ga link qo'shilgan. Bu haqiqatda Light stylingni o'zgartirishga tayyor **kod**, ammo hali main'ga Merge qilinmagan.
- **3 ta haqiqiy banner tasviri va ularning CTA-lari hali integratsiya qilinmagan.**
- Runtime/visual testlar to'liq emas. Ishlab turgan ilovaga ta'sir ko'rsatadigan Merge shoshilinch qilinmasin.

## 10. Audit chegaralari / halollik

Ushbu hujjat manba kodning miqyosi, asosiy oqimlari, muhim funksiyalari va ularni qanday xavfsiz o'zgartirish kerakligini xaritalaydi. **46 ming qatorning har biri ishga tushirilib, barcha tarmoqlari sinab ko'rilganini da'vo qilmaydi.** Yangi CSS qo'shilishi, HTML minify/deploy va brauzer specificity testini real qurilmada tekshirish ham talab qilinadi.
