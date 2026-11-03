# Avto A1 — kod tuzilishi, Light-only dizayn integratsiyasi uchun audit

**Sana:** 2026-11-03  
**Audit asosi:** `main` commit `c60699f0a184bc1c317069c327bf367f14d8bb1a`; PR #338 `design/avtoa1-light-skyglass-integration`.  
**Holat:** Sky Glass Light-only CSS specificity qoidalari, 3 ta tasdiqlangan WebP banner (`#a1-sky-light-carousel`) va ularning CTA handlerlari (`catalog`, `promos`, `contact`) to'liq yakunlandi va CI testlaridan o'tkazildi.

## 1. Loyiha arxitekturasi va yuklanish

- `index.html`: ~2.84 MB, 46,109 qator. 61+ ta inline `<script>` bloki, 74+ ta `<style>` bloki.
- Dastlabki `a1-boot-gate` (taxm. 89-qator) `localStorage.avto_phase2` ichidagi `theme` orqali HTML root'ga `data-theme="light"` yoki `dark` qo'yadi. Dastlabki holat dark.
- `a1-perf-tier` (taxm. 237-qator) qurilma quvvatiga mos low/mid/high grafik/animatsiya rejimini tanlaydi (`html.lite`, `html.perf-mid`).
- `index.html` bosh sahifa: admin-boshqariladigan `#a1-legacy-home-slider > #main-slider` (Dark mode uchun), `#a1-sky-light-carousel` (Light mode uchun), `.search-box`, `#main-menu`, `#home-products.items-grid`, `.bottom-nav`.
- `.github/workflows/deploy.yml`: `main` ga push'da avtomatik GitHub Pages deploy. `.github/build-site.js` deploydan oldin HTML ichidagi katta JS'ni alohida hash-fayllarga ajratib, CSS/JS'ni ixchamlaydi.

## 2. Light/Dark mode: aniq kod xaritasi va kaskad yechimi

- `<script id="a1-phase2-js">`, taxm. 19666-qator — `Phase2`: tema, profil, notification, cashback, achievements, warranty va analytics.
- `applyTheme(t)` va `P.toggleTheme(ev)`: `document.documentElement.setAttribute('data-theme', ...)`; holatni `localStorage` va Firebase `users/<uid>/phase2` ga saqlaydi.
- **Hal qilingan specificity masalasi:** `light-skyglass-preview/avtoa1-light-only.css` `<head>` oxirida ulangan bo'lsa-da, `<body>` ichidagi keyingi `<style>` bloklaridan (`home-ios-2026`, `bm-cards-2026`, `card-style-appstore`, `a1-ios26-card9`, `a1-ios26-card10`, `tabbar-liquid-glass`, `a1-ios26-pages3`, `perf-tier-lite`) ustun kelishi uchun `html[data-theme="light"][data-theme="light"][data-theme="light"] body ...` selektorlari qo'llanildi.
- Dark selector, theme JavaScript va Firebase state o'zgarmagan.
- Rollback: `index.html`dan yangi stylesheet/script linklarini olib tashlab eski Light holatga qaytish mumkin.

## 3. Bosh sahifa va mahsulot kartalari (`market`, `appstore`, `classic`)

- `renderProducts()` va `cardHTML(p)` mavjud `openProduct(id)` va `addToCartQuick(event,id)` handlerlarini o'zgarishsiz saqlaydi.
- Admin `settings/ui/cardStyle` orqali `market` (`.bm-card`), `appstore` (`.ac-card`), `classic` (`.luxury-card`) dizaynini tanlaydi.
- `avtoa1-light-only.css` uchala karta uslubida ham:
  - `.img-wrap` fonini `#ecebe6` o'rniga Sky Glass `linear-gradient(135deg,#f5fbff,#eaf6ff)` ga o'zgartiradi;
  - `.bm-pr b`, `.ac-pr b`, `h4` sarlavha va narx ranglarini `#172d45` (`--a1-sky-ink`) ga o'tkazadi;
  - `.bm-btn`, `.ac-add.ac-add.ac-add:not(.is-out):not(.a9-done)` va `.btn-add-cart` tugmalarini oq ikonkali Sky Glass ko'k gradientga (`#2f8fd8 -> #247bc1`) o'tkazadi, `.a9-done` (yashil tasdiq) va `.is-out` (tugagan) holatlarini saqlaydi.

## 4. Banner / aksiya / aloqa slayderi (`#a1-sky-light-carousel`)

- Dark mode'da `#a1-legacy-home-slider` va `window.AvtoBanners` (Firebase `banners` jadvali) o'z holicha ishlaydi.
- Light mode'da `#a1-legacy-home-slider` yashirilib, `#a1-sky-light-carousel` ko'rsatiladi (`approved-banner-images.css`, `approved-banner-live.css`, `approved-banner-live.js`).
- 3 ta tasdiqlangan WebP banner va ularning CTA tugmalari:
  1. **Gazel:** `window.showCatalog()`
  2. **Aksiyalar:** `#hf-promo` faol bo'lmasa `window._homeToggle('discount')` ni yoqadi va `#home-products` ga silliq skroll qiladi.
  3. **Aloqa:** `window.openModal('contactModal')`
- To'liq ekranli qidiruv (`body.a1-srch`) yoki boshqa bo'limlarga o'tilganda (`legacy.style.display === 'none'`) karusel avtomatik yashirinadi. Nuqtalar, swipe va klaviatura (`ArrowLeft`/`ArrowRight`) ishlaydi.

## 5. Pastki menyu (`.bottom-nav`) va glass

- `.bottom-nav` ichidagi nofaol kontur ikonkalar (`svg.ni-o`) `fill: none !important; stroke: #6c94b6 !important;`, faol ikonkalar (`svg.ni-f`) esa `fill: #247bc1 !important;` bilan to'g'ri chiziladi.
- `#nav-indicator` JS tomonidan hisoblanadigan `width`/`height`/`transform` qiymatlariga tegmasdan, Sky Glass ko'k shisha kapsulaga bo'yaladi.
- `html.lite` rejimida ham blur o'chirilgan holda toza och-havorang shakl va chegara saqlanadi.

## 6. Buyurtma, autentifikatsiya, ombor, cashback — TEGMASLIK ZONASI

- `renderCartItems()`, `co-ios-checkout-js`, `cloudflare-worker.js`, `bot/bot.py`, `database.rules.json` va `sw.js` o'zgartirilmagan.
