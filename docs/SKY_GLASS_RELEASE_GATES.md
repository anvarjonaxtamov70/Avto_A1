# Avto A1 Sky Glass — PR #338 uchun chiqarish (release) mezonlari

**Maqsad:** to'rtta tasdiqlangan UI bosqichi Light mode'da ishlasin; Dark mode, Telegram, Firebase va savdo o'zgarmasin. **PR yashil bo'lsa ham jonli test o'rnini bosa olmaydi.**

## Avtomatik testlar
- [x] Lint/syntax va xavfsizlik tekshiruvlari GitHub Actions'ga ulangan.
- [x] 3 bannerning WebP assetlari, CTA action'lari, Dark-only eski slider va Light-only CSS chegarasi uchun static regressiya testi mavjud.
- [x] `.github/test-light-banner-behavior.js`: banner controller'ni soxta DOM ichida bajarib, slayd nuqtalari, barmoq bilan surish, katalog, aksiya, aloqa, theme va Home visibility reaksiyalarini tekshiradi.
- [ ] Oxirgi commit uchun barcha GitHub Actions joblari yashil bo'lishini tasdiqlash.

## Real qurilma tekshiruvlari — Merge oldidan majburiy
- [ ] Telegram Mini App'ni iPhone Safari/WebView va Android WebView'da Light mode'ga o'tkazib ko'rish.
- [ ] Dark mode eski qora-tilla dizayn, eski Firebase-admin bannerlari va navigatsiya animatsiyasi bilan bir xil qolgan.
- [ ] Light'dagi uchta tasdiqlangan banner to'g'ri rasm nisbatida, aniq matn va uchta bosiladigan CTA bilan ko'rinadi.
- [ ] **Katalog CTA** eski `showCatalog()` ishlashini buzmaydi.
- [ ] **Aksiya CTA** `_homeToggle('discount')`ni faqat yoqadi, ikkinchi bosishda o'chirmaydi.
- [ ] **Aloqa CTA** mavjud `contactModal`ni ochadi va ortga qaytish ishlaydi.
- [ ] Admin Firebase `banners`ni tahrirlaganda Dark slayder normal yangilanadi; Light'dagi tasdiqlangan slayder tasodifan yo'qolmaydi.
- [ ] Mahsulot kartalari `market`, `appstore`, `classic` tanlovida sinovdan o'tgan: narx, chegirma, stok, flash-taymer, rasmlar, yulduzcha, like/compare.
- [ ] Razmerli oddiy mahsulotlarni savatga qo'shish; cart badge, miqdor, buyurtma, Telegram xabari.
- [ ] Pastki navigatsiyaning 4 bo'limi, `nav-indicator` kapsulasi, back tugmasi, modal, qidiruv, ekran aylanishi, safe-area.
- [ ] Internet sekin/o'chiq, sw.js offline/html cache va engil (`lite`) performance rejimi sinovdan o'tgan.

## Texnik topilmalar (audit)
- `main/index.html` 46 083 satr va ko'plab CSS qatlamiga ega: testda computed styles va telefon ko'rinishi muhim.
- Mavjud `window.AvtoBanners` Firebase `banners` ref'ini jonli tinglaydi; Light uchun alohida banner qatlamini yozish bazaga tegishdan xavfsizroq.
- Bannerlar CSS'dagi 520x456 WebP fon rasmlaridir; bosiladigan `sky-hotspot` koordinatalari rasmdagi tugmalarga mosligini real telefon bilan tekshirish kerak.
- `#nav-indicator` width/transform JS orqali hisoblanadi; CSS faqat shisha rang va soyani o'zgartirishi kerak.
- `avtoa1-light-only.css` tashqi fayl: agar yuklanmasa eski Light ochiladi, lekin yangi banner CSS/JS fayllari ham to'liq tekshirilishi kerak.

## Orqaga qaytarish (rollback)
1. Agar deploydan keyin muammo chiqsa, PR Merge commitini revert qilib GitHub Pages qayta deploy qiling.
2. Light-only qatlamni alohida vaqtincha to'xtatish uchun `index.html`dagi `light-skyglass-preview/` CSS/JS linklarini va `#a1-sky-light-carousel` bo'limini revert orqali o'chiring.
3. Dark mode'ning eski `#main-slider`, `AvtoBanners`, savat va checkout'ini o'zgartirmang.
4. Firebase `banners` ma'lumotini hech qachon ommaviy o'chirib/tahrirlab rollback qilmang.

**Holat:** hozir PR #338 Draft. Avtomatik testlardan tashqari real iPhone/Android va Firebase bilan jonli smoke testni bajarmasdan Merge QILINMASIN.
