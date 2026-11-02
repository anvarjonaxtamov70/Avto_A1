# Avto A1 — asosiy 46 ming qatorning modul xaritasi

Avtomatik statik inventarizatsiya, 2026-11-02. **Bu funksional test emas:** bo'limlar vazifasi sarlavha/kalit so'z/chaqiruvga qarab taxminan tasniflangan; har bir satr ijrosi tasdiqlangan degani emas. Sirlar, Telegram tokenlari yoki shaxsiy ma'lumotlar hujjatga ko'chirilmadi.

- Bazaviy main/index.html manba: 2 816 843 belgi, 46 083 qator.
- Topilgan JS blok: **65**, CSS blok: **74** (inline/sahifaga kiritilgan; oddiy regExp parsing, qatlamli JS template holatida chegaralar tekshirilishi zarur).
- Tashqi SDK: Telegram Web App JS, Firebase App/Auth/Database compat.
- Qo'shimcha muhim resurslar: `bot/bot.py` (227775 belgi), `cloudflare-worker.js` (232434), `sw.js` (6528), `database.rules.json` (28463).

## 1. Inline JavaScript bloklari — yuklanish va kirish nuqtalari

| # | Qatorlar | Script ID | Hajm | Ehtimoliy vazifa | Funksiya namunalari |
|---:|---|---|---:|---|---|
| 1 | 17–19 | — | 182 | tema | — |
| 2 | 23–42 | — | 1031 | navigatsiya | — |
| 3 | 89–196 | a1-boot-gate | 5681 | tema, slayder, tovar, navigatsiya | fontsReady, productsReady |
| 4 | 237–577 | a1-perf-tier | 17827 | navigatsiya, AI, tezlik | adaptivePerf, lsGet |
| 5 | 594–624 | — | 1429 | kesh | — |
| 6 | 634–634 | — | 0 | JS bo'lagi | —; **tashqi src** |
| 7 | 635–635 | — | 0 | Firebase | —; **tashqi src** |
| 8 | 636–636 | — | 0 | Firebase, autentifikatsiya | —; **tashqi src** |
| 9 | 637–637 | — | 0 | Firebase | —; **tashqi src** |
| 10 | 1634–1637 | — | 350 | tema | — |
| 11 | 6619–6771 | — | 8295 | JS bo'lagi | esc, rebuildCarNames |
| 12 | 8526–19603 | — | 679765 | tovar, navigatsiya | blockDocumentRubberBand, findScroller |
| 13 | 19646–19663 | — | 843 | savat | — |
| 14 | 19666–21124 | a1-phase2-js | 86458 | tema, Firebase, buyurtma, modal | cashbackRate, rateForOrder |
| 15 | 21203–21242 | — | 1784 | AI, animatsiya | polishLayer, ready |
| 16 | 21356–21379 | — | 1260 | AI, tezlik | scrollPerf, start |
| 17 | 21571–21626 | — | 1838 | banner, slayder, AI | homeSliderDots, init |
| 18 | 21723–21883 | — | 7604 | ombor, tovar, qidiruv, filtr | searchFilterSort, priceOf |
| 19 | 21908–21929 | — | 869 | JS bo'lagi | — |
| 20 | 22107–22165 | — | 2368 | JS bo'lagi | loginFlowSoften, bindEnter |
| 21 | 22166–22208 | — | 1874 | navigatsiya | a11yInit |
| 22 | 23690–23735 | a1-customer-rule-js | 2465 | admin, profil | text, realName |
| 23 | 23737–26271 | vip-stories-2026-js | 124873 | Firebase, admin, stories, profil | DB, adminChatId |
| 24 | 26360–26530 | — | 7154 | savat, AI | cashbackAtPayment, balance |
| 25 | 26652–26819 | — | 7656 | JS bo'lagi | storiesSeenAndRating, loadSeen |
| 26 | 26932–27101 | — | 8365 | buyurtma, filtr, baholash, AI | aiBulkUX, updatePreview |
| 27 | 27193–27231 | — | 1620 | stories, AI, modal | sheetScrollFix, resetScroll |
| 28 | 27618–27766 | — | 5812 | buyurtma, admin | orderLoader, reduced |
| 29 | 27803–28053 | — | 12597 | Firebase, admin, profil | profileCarAndAddress, esc |
| 30 | 28072–28119 | — | 1887 | Firebase, buyurtma, filtr | ordersAtomicWrites, ordersRef |
| 31 | 28376–28498 | — | 5589 | ombor, filtr | stockServerGuard, proxyBase |
| 32 | 28781–28958 | — | 8171 | AI, modal, tezlik, stillar | motionPackage, cancelClose |
| 33 | 29028–29183 | — | 6243 | banner, navigatsiya | offlineAndErrors, ensureBanner |
| 34 | 29420–30313 | customer-boost-2026-js | 36506 | ombor, tovar, filtr | customerBoost2026, esc |
| 35 | 30332–30979 | home-filters-bulk-discount-js | 26555 | ombor, tovar, filtr | homeFiltersAndBulkDiscount, homeBaseList |
| 36 | 31014–31333 | smart-search-2026-js | 12389 | qidiruv | smartSearch, sNorm |
| 37 | 31561–31986 | shogird-ai-2026-js | 17499 | Firebase, AI, modal | shogirdAi, DB |
| 38 | 32988–33908 | banner-admin-2026-js | 43337 | banner, slayder, admin | bannerAdmin2026, msgOf |
| 39 | 33959–34302 | — | 15417 | Firebase, buyurtma | fb, esc |
| 40 | 34457–34593 | pfx-ios-profile-js | 8613 | profil | moveTiles, watchHub |
| 41 | 34761–35137 | co-ios-checkout-js | 30090 | JS bo'lagi | counter, step |
| 42 | 35428–35533 | card-style-switch | 6617 | Firebase, admin, tovar, AI | rerender, apply |
| 43 | 35956–36020 | admin-ios-2026b-js | 3098 | admin, filtr, AI | syncHome, isAdminUid |
| 44 | 36611–37079 | a1-ios26-info-js | 36524 | Firebase, admin | esc, md |
| 45 | 37590–37947 | a1-ios26-pages2-js | 26160 | tema, AI | esc, hap |
| 46 | 38266–38521 | a1-ios26-pages3-js | 17105 | savat | cartChrome, paintCart |
| 47 | 38957–39335 | a1-ios26-admin4-js | 24627 | admin, qidiruv | chrome, bulkSetup |
| 48 | 39424–39653 | a1-ios26-avatar5-js | 16988 | Firebase, kesh | hap, toast |
| 49 | 39681–39797 | a1-ios26-admin6-js | 6642 | Firebase, buyurtma, admin, profil | DB, admin |
| 50 | 40104–40299 | a1-ios26-product7-js | 13379 | tovar | fmt, esc |
| 51 | 40386–40545 | a1-ios26-admin8-js | 10388 | buyurtma, admin, filtr, AI | hap, keys |
| 52 | 40602–40618 | a1-ios26-card9-js | 877 | savat, AI | — |
| 53 | 40680–40698 | a1-ios26-card10-js | 852 | slayder, tovar, modal | — |
| 54 | 40699–40759 | a1-smooth11-js | 2860 | buyurtma, admin, AI, kesh | settle, wrapRender |
| 55 | 40795–40889 | a1-smooth12-js | 4567 | slayder, savat, AI | wrapPrice, heroPlaceholder |
| 56 | 41102–41606 | a1-reviews-v2-js | 32976 | Firebase, buyurtma, tovar, baholash | esc, DB |
| 57 | 42033–42295 | a1-ios26-product-js | 16062 | tovar, AI, modal | syncSegs, flashEls |
| 58 | 42403–43039 | a1-auth-pw-js | 40670 | Firebase, autentifikatsiya, AI | setHint, paint |
| 59 | 43096–43435 | a1-account-js | 22161 | Firebase, autentifikatsiya | watchVerify, row |
| 60 | 43452–43585 | a1-admin-reset-js | 7485 | tema, banner, admin, AI | incompleteHtml, errorText |
| 61 | 43586–43623 | a1-android-back-js | 1909 | qidiruv, stories, AI, modal | — |
| 62 | 43630–43718 | a1-app-perf-js | 4281 | filtr, navigatsiya, AI, tezlik | walk, noGlass |
| 63 | 43737–43780 | a1-install-hint-js | 3070 | navigatsiya, AI | show, maybe |
| 64 | 43825–43904 | a1-model-empty-js | 6400 | qidiruv | find, countFor |
| 65 | 44132–46079 | a1-stories-26-js | 108586 | tema, Firebase, autentifikatsiya, admin | a1Stories26, mk |

## 2. Inline CSS qatlamlari — kaskad xaritasi

**Muhim:** 85 ta CSS qatlam bo'lsa, stilni o'zgartirish uchun faqat bitta klassni topish yetmaydi. Kechki CSS va `!important`, `#id` ustuvorligi, hamda media-query ham hisobga olinadi.

| # | Qatorlar | Style ID | Hajm | Ehtimoliy vazifa |
|---:|---|---|---:|---|
| 1 | 69–88 | a1-boot-css | 2114 | tema, buyurtma, AI, stillar |
| 2 | 427–633 | — | 11232 | tovar, navigatsiya, AI, tezlik |
| 3 | 659–1633 | — | 47791 | tema, buyurtma, qidiruv, navigatsiya |
| 4 | 1638–6282 | — | 240580 | tema, banner, buyurtma, navigatsiya |
| 5 | 6289–6299 | unified-icons-css | 827 | slayder, savat, stories, modal |
| 6 | 6598–6618 | — | 1141 | buyurtma, animatsiya |
| 7 | 6773–6786 | — | 1314 | buyurtma, animatsiya |
| 8 | 6870–7009 | mo-ios-orders | 12757 | tema, buyurtma, AI, modal |
| 9 | 7041–7105 | ad-ios-addresses | 6557 | tema, buyurtma, modal, animatsiya |
| 10 | 7936–8263 | — | 26513 | tema, buyurtma, admin, AI |
| 11 | 8285–8313 | — | 3353 | buyurtma, admin, modal, animatsiya |
| 12 | 21134–21202 | polish-layer-v1 | 2636 | tema, buyurtma, filtr, AI |
| 13 | 21250–21302 | design-system-v2 | 2903 | savat, AI, modal |
| 14 | 21311–21355 | perf-tuning-v1 | 1973 | slayder, filtr, stories, navigatsiya |
| 15 | 21389–21461 | — | 3429 | tema, savat, buyurtma, tovar |
| 16 | 21471–21515 | — | 2588 | tema, savat, buyurtma, ombor |
| 17 | 21532–21570 | design-system-v4 | 1583 | tema, banner, slayder, buyurtma |
| 18 | 21649–21722 | design-system-v5 | 3504 | tema, buyurtma, AI |
| 19 | 21943–21994 | design-system-v7 | 2191 | tema, buyurtma, AI |
| 20 | 22011–22032 | design-system-v8 | 797 | tema, buyurtma, animatsiya |
| 21 | 22055–22106 | design-system-v9 | 2661 | tema, buyurtma, AI, animatsiya |
| 22 | 22230–22336 | search-premium-final | 4286 | slayder, buyurtma, qidiruv, filtr |
| 23 | 22338–22416 | ux-enhance-2026 | 4193 | tema, savat, qidiruv, stories |
| 24 | 22418–22488 | anim-enhance-2026 | 3176 | savat, buyurtma, filtr, navigatsiya |
| 25 | 22490–22543 | flash-sale-2026 | 2594 | tema, savat, buyurtma, animatsiya |
| 26 | 22549–22718 | — | 8642 | savat, buyurtma, admin, qidiruv |
| 27 | 22725–23051 | — | 12455 | tema, buyurtma, AI |
| 28 | 23065–23688 | layer-stories-customers-vip | 35172 | buyurtma, admin, stories, AI |
| 29 | 26284–26358 | layer-cashback-pay | 3633 | tema, buyurtma, AI, animatsiya |
| 30 | 26535–26650 | layer-stories-rating | 5717 | tema |
| 31 | 26824–26930 | layer-ai-bulk | 5460 | tema, buyurtma, filtr, AI |
| 32 | 27135–27191 | layer-sheet-layout | 2355 | tema, filtr, stories, AI |
| 33 | 27244–27412 | — | 6900 | buyurtma, stories, animatsiya |
| 34 | 27451–27616 | layer-order-loader | 6482 | tema, buyurtma, filtr, animatsiya |
| 35 | 27782–27801 | layer-profile-car | 916 | tema, qidiruv, profil |
| 36 | 28159–28347 | layer-essential-motion | 6984 | buyurtma, AI, animatsiya |
| 37 | 28560–28779 | layer-motion-2026 | 9218 | tovar, filtr, modal, animatsiya |
| 38 | 28992–29026 | layer-offline-2026 | 1323 | banner, buyurtma, AI |
| 39 | 29205–29419 | customer-boost-2026 | 11314 | buyurtma, AI |
| 40 | 31343–31559 | layer-shogird-ai | 14177 | tema, AI, modal, animatsiya |
| 41 | 32003–32358 | — | 17845 | tema, banner, buyurtma, admin |
| 42 | 32364–32986 | avto-a1-product-actions-v2 | 22431 | tema, slayder, buyurtma, tovar |
| 43 | 33910–33958 | — | 5376 | tema, buyurtma, admin, tovar |
| 44 | 34305–34328 | perf-ios-2026 | 1594 | buyurtma, filtr, tezlik, animatsiya |
| 45 | 34330–34455 | pfx-ios-profile | 15580 | tema, buyurtma, profil, modal |
| 46 | 34595–34759 | co-ios-checkout | 16664 | tema, savat, buyurtma, modal |
| 47 | 35139–35214 | tabbar-liquid-glass | 5465 | tema, buyurtma, filtr, navigatsiya |
| 48 | 35216–35271 | home-ios-2026 | 5596 | tema, buyurtma, filtr |
| 49 | 35273–35342 | bm-cards-2026 | 8413 | tema, buyurtma |
| 50 | 35344–35405 | card-style-appstore | 7669 | tema, buyurtma, admin, filtr |
| 51 | 35406–35426 | card-style-admin | 2203 | tema, savat, buyurtma, admin |
| 52 | 35540–35954 | admin-ios-2026b | 35301 | tema, buyurtma, admin, qidiruv |
| 53 | 36023–36157 | shogird-ios26 | 9790 | tema, buyurtma, AI, modal |
| 54 | 36158–36610 | a1-ios26-info | 39873 | tema, admin, filtr, modal |
| 55 | 37080–37589 | a1-ios26-pages2 | 52587 | tema, admin, profil, AI |
| 56 | 37948–38265 | a1-ios26-pages3 | 26791 | tema, savat, buyurtma, filtr |
| 57 | 38522–38956 | a1-ios26-admin4 | 47107 | tema, buyurtma, admin, filtr |
| 58 | 39336–39423 | a1-ios26-avatar5 | 8499 | tema, buyurtma, filtr |
| 59 | 39654–39680 | a1-ios26-admin6 | 2638 | buyurtma, admin, filtr, modal |
| 60 | 39798–40103 | a1-ios26-product7 | 35733 | slayder, buyurtma, tovar, AI |
| 61 | 40300–40385 | a1-ios26-admin8 | 11289 | buyurtma, admin, stories, modal |
| 62 | 40546–40601 | a1-ios26-card9 | 7230 | tema, buyurtma, animatsiya |
| 63 | 40619–40679 | a1-ios26-card10 | 6056 | savat, buyurtma, filtr |
| 64 | 40760–40794 | a1-smooth12-css | 2321 | tema, buyurtma, tovar, qidiruv |
| 65 | 40909–41101 | a1-reviews-v2-css | 18076 | tema, buyurtma, filtr, baholash |
| 66 | 41610–41669 | a1-perf-tier-css | 4738 | banner, slayder, filtr, AI |
| 67 | 41670–42032 | a1-ios26-product | 32921 | tema, buyurtma, tovar, baholash |
| 68 | 42296–42402 | a1-auth-pw | 10029 | tema, buyurtma, autentifikatsiya, AI |
| 69 | 43040–43095 | a1-account | 4837 | tema, buyurtma |
| 70 | 43436–43451 | a1-admin-reset-css | 904 | buyurtma, admin, AI, modal |
| 71 | 43624–43629 | a1-app-perf | 297 | AI, tezlik |
| 72 | 43639–43736 | — | 5691 | filtr, navigatsiya, AI, stillar |
| 73 | 43781–43824 | a1-model-empty | 5628 | buyurtma, AI, animatsiya |
| 74 | 43931–44131 | a1-stories-26 | 23054 | buyurtma, filtr, AI, tezlik |

## 3. Cross-system contractlar

**Telegram bot (Python):** `bot/bot.py` ichida kamida 41 ta `@dp.message/callback_query/edited_message` dekorator belgilangan. Ro'yxatdan o'tish, buyurtma xabarlari, admin, import, AI va stories oqimlari mavjud. Botni HTML dizayn PR'da o'zgartirmaslik zarur.

**Cloudflare Worker:** HTTP yo'llar: `/media`, `/file`, `/img`, `/auth`, `/upload`, `/order-commit`, `/order-status`, `/order-notify`, `/order-deliver`, `/customer-register`, `/tg-login-poll`, `/session`, `/login-phone`, `/phone-verify`, `/merge-legacy`, `/story-reply`, `/story-answer`, `/account-delete`, `/admin-reset`, `/stock-commit`. Muhim: `/auth`, `/order-commit`, `/stock-commit`, `/order-status`, `/admin-reset`, `/upload` endpointlari savdoga ta'sir qiladi; CSS-only o'zgarishda yo'qligi kerak.

**Firebase RTDB Rules:** ajratilgan bo'limlar: `banners`, `settings`, `products`, `orders`, `users`, `stock`, `reviews`, `admins`; ushbu JSON tarkibida kommentlar mavjud, shuning uchun oddiy strict JSON parserga bevosita uzatishdan avval izohlarni chiqarish kerak.

**Service Worker:** `sw.js` `SW_VERSION`ni tekshiradi, HTML'ni network-first oladi, CDN font/SDK'ni cache qiladi; CSS yangi fayl manzili navigator requestidan olinishi mumkin, ammo browser cache/CDN yangilanishida hard refresh zarur bo'lishi ehtimoli bor. `?v=1` bu release asset versiyasi.

**CI testlar:** `node .github/validate.js`, `node .github/test-customer-layer.js`, `node .github/test-promo-layer.js`, `node .github/test-tier-cashback.js`, `node .github/test-smart-search.js`, `node .github/test-ai-chat.js`, `node .github/test-auth-guard.js`, `node .github/test-order-flow.js`, `node .github/test-order-client.js`, `node .github/test-perf-tier.js`, `node .github/test-reviews.js`, `node .github/test-stories.js`, `node .github/test-identity.js`, `node .github/test-admin-reset.js`.

## 4. Nazorat qilinadigan xavflar

1. **Tema:** `html[data-theme="light"]` va localStorage `avto_phase2` theme; Dark tanlanganda yangi Light CSS ta'sir etmasin.
2. **Banner:** `window.AvtoBanners` real-time Firebase listener `banners` bilan boshqaradi; zaxira 4 banner admin data borida almashtiriladi. Faqat static `<img>`ni yozish noto'g'ri.
3. **Karta:** `settings/ui/cardStyle` qiymati `market`, `appstore` yoki `classic`; narx, oldPrice, flashUntil, stock badge, wishlist, reyting, variantni o'zgartirmaslik zarur.
4. **Savat:** `addToCartQuick` bilan `addToCart` bir xil emas, razmerli mahsulot modal orqali ketadi.
5. **Nav:** `#nav-indicator` JS offsetWidth/top/left bilan aniq koordinata hisoblaydi, CSS unga kenglik/position/transform bermasligi shart.
6. **CI:** unit/syntax testlar yashil bo'lsa ham real Telegram WebView, Android va Firebase regressiyasi avtomatik isbotlanmaydi.

## 5. Kelgusi o'zgarish chegaralari

- O'zgartirish mumkin: `light-skyglass-preview/avtoa1-light-only.css`, Light-only banner assets, Light-only vizual helper; maxsus testlar.
- Taqiqlangan: real buyurtma/status/auth/stock, Firebase rules, admin CRUD, Telegram/Python bot, Cloudflare Worker, dark tema qoidalarini shu UI PR uchun tahrirlash.
- Merge talabi: CI yashil + qo'lda 2 theme, 3 cardStyle, oddiy/razmerli savat, admin banner yangilanishi, bir nechta telefon o'lchami tekshirilsin.

## 6. Tekshiruv holati

Bu inventarizatsiya **butun fayldagi bloklarni kataloglashtirdi**; yuzlab ichki yordamchi funksiyalarni bitta-bittadan runtime tekshirish hali alohida ish. Audit bo'yicha muhim nuqtalar boshqa hujjatda: `docs/AVTOA1_CODE_AUDIT.md` va `docs/AVTOA1_KOD_XARITASI_2026-11-02.md`.
