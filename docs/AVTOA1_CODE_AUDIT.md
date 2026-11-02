# Avto A1 — texnik konspekt: kodni tushunish va xavfsiz Light mode integratsiyasi

**Holat:** 2026-11-02. Bu manba-kodga asoslangan dastlabki audit; 46 083 satrning har birini semantik va runtime darajada tasdiqladik degani **emas**. Ishlayotgan ilovaning integratsiyasini testlashdan oldin merge qilinmaydi.

## Manba va o'lcham
- Repository: `anvarjonaxtamov70/Avto_A1`.
- O'rganilgan manba: `main/index.html` blob `98948c3421cf4e1cc7f95ed5f70162cb14424228`.
- Asosiy fayl: **2 816 843 belgi / 46 083 satr**; `<script>` bloklari ~65 ta; `<style>` bloklari ~85 ta. Ko'plab qatlamli CSS override'lar bor; ularning kaskadini tekshirish muhim.
- Fayl strukturasidagi frontend HTML/CSS/JS inline; tashqi kutubxonalar Telegram Web App va Firebase compat SDK. `README.md`ga ko'ra GitHub Pages + Cloudflare Worker + Firebase va Telegram bot mavjud.

## Tasdiqlangan komponent xaritasi

| Qism | Manbadagi joy (taxminiy satr) | Qanday ishlaydi | Tegmaslik / test |
|---|---:|---|---|
| Theme yuklash | 18, 94, 1636 | `localStorage.avto_phase2`dagi `theme` orqali `html[data-theme]` belgilanadi; default dark | Foydalanuvchining tanlovi va first paint |
| Light/Dark switch | 19852-19885 | `applyTheme` va `Phase2.toggleTheme`: HTML attributi, Telegram header/background, local/remote saqlash | Dark mode, eski profillar, preferensiya saqlanishi |
| Bosh sahifa | 6512-6515 | `#main-menu`, `#home-products.items-grid`; `#home-title` va Aksiya/Sotuvda filtrlar | Filtrlar va render |
| Mahsulot render | 10450 va keyingi satrlar | `renderProducts` `displayDB`ni `cardHTML` bilan chizadi; katalog gridi lazy; animatsiya va perf optimizatsiyasi bor | Mahsulotlarning real ID, filtr, stock, thumbnail |
| Savatga qo'shish | 10480+, 11014 | `addToCartQuick` razmerli mahsulotlarni modalga yo'naltiradi; `addToCart` savatni saqlab badge/haptic/toast yangilaydi | Ikkita savat yo'lini buzmaslik |
| Pastki navigatsiya | 373000-belgi atrofida, 11016+ | `.bottom-nav .nav-item`; `goHome()`, `showCatalog()`, `updateNav()`, `#nav-indicator` kapsula joylashuvini hisoblaydi | Indikatorning eski oltin kapsulasi bilan yangi CSS konfliktilari |
| Slayder / banner | 6473-6490 | `.slider-container #main-slider`; SVG zaxira rasm va 4-chi hamkorlik bannerni ko'rsatadi | `AvtoBanners` admin/Firebase slaydlarni almashtirishi mumkin |
| Qidiruv | 6494+ va 11007 | `#searchInput` `searchProducts()` chaqiradi; `exitSearch()` slayder/navbar ko'rinishini qaytaradi | Focus/search overlay va navbar |
| Orqaga qaytish | 12154+ | `goHome`, `historyStack` va `popstate` modalni alohida yopadi | Android back/Telegram close va stack |
| Firebase | 580+, 8883+, 19770+ | SDK va ma'lumotlar yangilanishi: tovar, login, Phase2 remote state | Savdo va profil ma'lumotiga tegmaslik |
| Service Worker | `sw.js` | Offline/cache; eski CSSni kesh ushlab qolishi mumkin | Version update / hard refresh |

## Bannerlarning dolzarb holati
1. Foydalanuvchi dizayn bo'yicha **Gazel, Aksiyalar, Aloqa** uchta banner eskizini tasdiqlagan.
2. Hozirgi `main/index.html`dagi `#main-slider` markup hali eski SVG + hamkorlik to'rtinchi bannerni ko'rsatadi.
3. Kommentariyga ko'ra adminning **Bannerlar** boshqaruvi birinchi ishga tushirilgach bazaga ko'chiriladi, keyin `window.AvtoBanners` bannerlarni Firebase'dan render qiladi. `index.html`dagi 4 ta `<img>`ni almashtirishning o'zi **yetarli emas** va admin ro'yxatini buzishi mumkin.
4. Shuning uchun PR #338 hozir banner kartasining faqat Light-theme bezagini o'zgartiradi. Rasm assetlari va CTA mexanizmi **hali jonli emas**.
5. Keyingi vazifa: `window.AvtoBanners` manbasini / admin save flow'ni tekshirish; ishlab turgan bannerlarni boshqa mode uchun o'zgartirmasdan 3 ta Light-specific bannerga imkon berish; haqiqiy action linklarini aniqlash.

## PR #338 nima o'zgartirdi
- `index.html`ga Light-only CSS stylesheet link.
- `light-skyglass-preview/avtoa1-light-only.css`: selectorlar faqat `html[data-theme="light"]` uchun. Mahsulot, mavjud slider atrofi, header, search, bottom-nav ustidan vizual skin.
- Alohida `light-skyglass-preview/index.html` va `sky-glass.css`: dastlabki to'rtta dizayn bosqichining **demo** namunasi, ishlaydigan katalog emas.
- **Dark mode JS/CSS asl qatorlari, Firebase, buyurtma mantiqi o'zgartirilmagan.**
- **Xavf:** `#nav-indicator` eski kapsula alohida CSS/JS bilan boshqariladi; aktyor kapsulasi yangi active backgroundga qo'shilib noto'g'ri ko'rinishi mumkin. Profil, katalogning boshqa oynalari `.luxury-card` umumiy classidan foydalansa Light CSS ularga ham ta'sir etadi. Hozirgi uslubni faqat Home ekrani kontekstiga yanada toraytirish lozim.

## Tekshirilishi shart bo'lgan bog'liqliklar (hali to'liq audit emas)
- `cardHTML` ichidagi price/sale/stock/variant markup va narx formatini aniq xaritalash.
- `AvtoBanners` admin CRUD va Firebase strukturasini aniqlash; reklama CTA qayerdan keladi va bosilganda nima qiladi?
- `#nav-indicator`, `updateNav`ning style/layout hisoblashlari bilan yangi border-radius/box-shadow moslashishi.
- Eski `html[data-theme="light"]` stil qatlamlari kaskadi va `!important` ustuvorligi; header/card/shop ekranlari bo'yicha screenshot diff.
- Savat (quick cart/variant), checkout, login/profile, offline va PWA caching, Android WebView.
- Xavfsiz feature flag va rollback; Light uslubi noto'g'ri bo'lsa linkni olib tashlash, Dark mode mavjud.

## Integratsiya jarayoni — qat'iy
1. Qolgan kod yo'llarini tekshirish va selektor qamrovini toraytirish.
2. Bannerlar uchun approval qilingan rasm assetlarini GitHub'ga joylash va live-admin tizimiga zid bo'lmagan yondashuv.
3. Mavjud kodni ixtiyoriy test brauzerida dark/light, kichik iPhone/Android, eski/savatsiz foydalanuvchi holatlarida tekshirish.
4. CI, kod diff, CSS parse, ma'lumotlar oqimi regresiyasi.
5. Faqat o'tgach `main`ga merge va jonli Telegram smoke test, rollback tayyor.

**Asosiy xulosa:** kodning asosiy arxitekturasi va Light-mode kirish nuqtasi aniqlandi; barcha 46 ming satrni funksional jihatdan to'liq audit qildik deyish noto'g'ri. Ishni ana shu hujjat bo'yicha bosqichma-bosqich davom ettiramiz.
