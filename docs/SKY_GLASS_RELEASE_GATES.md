# Avto A1 Sky Glass — PR #338 uchun chiqarish (release) mezonlari

**Maqsad:** to'rtta tasdiqlangan UI bosqichi Light mode'da to'liq va kaskad to'qnashuvlarisiz ishlasin; Dark mode, Telegram, Firebase va savdo o'zgarmasin.

## Avtomatik testlar
- [x] Lint/syntax va xavfsizlik tekshiruvlari GitHub Actions'ga ulangan (`validate.js`).
- [x] 3 bannerning WebP assetlari, CTA action'lari, Dark-only eski slider va Light-only CSS chegarasi uchun static regressiya testi mavjud (`test-light-banner-carousel.js`).
- [x] `.github/test-light-banner-behavior.js`: banner controller'ni soxta DOM ichida bajarib, slayd nuqtalari, barmoq bilan surish, klaviatura (`ArrowLeft`/`ArrowRight`), katalog, aksiya, aloqa, theme va Home visibility reaksiyalarini tekshiradi.
- [x] `.github/test-light-skyglass.js`: barcha sub-selektorlarning `html[data-theme="light"]` bilan chegaralanganini hamda `index.html` ichidagi keyingi `<style>` bloklaridan (`home-ios-2026`, `bm-cards-2026`, `card-style-appstore`, `a1-ios26-card9/10`, `tabbar-liquid-glass`, `a1-ios26-pages3`, `html.lite`) ustun keluvchi specificity qoidalarini tekshiradi.
- [x] `build-site.js` ixchamlashtirish va barcha CI testlari 100% yashil.

## Tekshirilgan va hal qilingan texnik nuqtalar
- `main/index.html` 46 109 satr va ko'plab keyingi `<style>` qatlamlariga ega bo'lgani uchun `avtoa1-light-only.css` dagi selektorlar `html[data-theme="light"][data-theme="light"][data-theme="light"] body ...` darajasiga ko'tarildi:
  - `.header.hx h1` va `#subBrand .sb-name` eski tilla gradientdan Sky Glass `#172d45` rangiga o'tkazildi.
  - `.search-input-container input.search-box` (`a1-ios26-pages3` va `home-ios-2026` ustidan) Sky Glass oq-shisha fon, ko'k fokus halqa va ko'k qidiruv belgisiga ega bo'ldi.
  - Barcha 3 ta karta uslubida (`market` / `.bm-card`, `appstore` / `.ac-card`, `classic` / `.luxury-card`) `.img-wrap` (`#ecebe6` o'rniga `#f5fbff -> #eaf6ff`), narxlar (`.bm-pr b`, `.ac-pr b`) va savat tugmalari (`.bm-btn`, `.ac-add.ac-add.ac-add:not(.is-out):not(.a9-done)`, `.btn-add-cart`) Sky Glass ko'k gradientga o'tkazildi.
  - `.bottom-nav` da kontur (`svg.ni-o`) ikonkalar `fill: none; stroke: #6c94b6` holatida, faol (`svg.ni-f`) ikonkalar esa `fill: #247bc1` holatida to'g'ri chizilishi ta'minlandi.
  - `approved-banner-live.css` da to'liq ekranli qidiruv (`body.a1-srch`) vaqtida `#a1-sky-light-carousel` avtomatik yashirinishi qo'shildi.

## Real qurilma tekshiruvlari — Merge oldidan nazorat ro'yxati
- [ ] Telegram Mini App'ni iPhone Safari/WebView va Android WebView'da Light mode'ga o'tkazib ko'rish.
- [ ] Dark mode eski qora-tilla dizayn, eski Firebase-admin bannerlari va navigatsiya animatsiyasi bilan bir xil qolganini ko'zdan kechirish.
- [ ] Light'dagi uchta tasdiqlangan banner (**Katalog**, **Aksiya**, **Aloqa** CTA tugmalari) va pastki navigatsiyani tekshirish.

## Orqaga qaytarish (rollback)
1. Agar deploydan keyin muammo chiqsa, PR Merge commitini revert qilib GitHub Pages qayta deploy qiling.
2. Light-only qatlamni alohida vaqtincha to'xtatish uchun `index.html`dagi `light-skyglass-preview/` CSS/JS linklarini va `#a1-sky-light-carousel` bo'limini revert orqali o'chiring.
3. Dark mode'ning eski `#main-slider`, `AvtoBanners`, savat va checkout'ini o'zgartirmang.
4. Firebase `banners` ma'lumotini hech qachon ommaviy o'chirib/tahrirlab rollback qilmang.
