# Avto A1 — texnik konspekt: kodni tushunish va xavfsiz Light mode integratsiyasi

**Holat:** 2026-11-03. Sky Glass Light mode integratsiyasi, kaskad specificity yechimlari va 3 ta tasdiqlangan banner karuseli to'liq yakunlandi hamda avtomatlashtirilgan regressiya testlaridan o'tkazildi.

## Manba va o'lcham
- Repository: `anvarjonaxtamov70/Avto_A1`.
- Asosiy fayl: `index.html` (**46 109 satr**); `<script>` bloklari ~65 ta; `<style>` bloklari ~85 ta.
- Frontend HTML/CSS/JS inline; Light-only Sky Glass qatlami esa `light-skyglass-preview/` ichidagi alohida CSS/JS fayllar orqali ulangan.

## Tasdiqlangan komponent xaritasi va Light-only qamrovi

| Qism | Manbadagi joy | Qanday ishlaydi | Sky Glass Light-only yechimi |
|---|---|---|---|
| Theme yuklash va switch | `a1-boot-gate`, `a1-phase2-js` | `localStorage.avto_phase2` orqali `html[data-theme]` belgilanadi; default dark | Asl JS o'zgarmagan; CSS faqat `html[data-theme="light"]` ga bog'langan |
| Sarlavha va qidiruv | `.header.hx`, `.search-input-container input.search-box` | `home-ios-2026` va `a1-ios26-pages3` qatlamlari boshqaradi | Yuqori specificity (`[data-theme="light"]` x3 + `body`) bilan `#172d45` sarlavha, oq-shisha qidiruv maydoni va ko'k fokus halqa berildi |
| Slayder / 3 banner | `#a1-legacy-home-slider`, `#a1-sky-light-carousel` | Dark mode'da `AvtoBanners` Firebase slayderi; Light mode'da 3 ta tasdiqlangan WebP banner | `approved-banner-live.js` va `.css`: `catalog`, `promos`, `contact` CTA'lar, swipe, dots, klaviatura (`ArrowLeft`/`ArrowRight`), `body.a1-srch` da yashirinish |
| Mahsulot kartalari | `cardHTML(p)`: `.bm-card`, `.ac-card`, `.luxury-card` | Admin `settings/ui/cardStyle` orqali 3 xil dizaynni tanlaydi | Uchala dizaynda ham `.img-wrap`, `.bm-pr b`, `.ac-pr b`, `.bm-btn` va `.ac-add.ac-add.ac-add:not(.is-out):not(.a9-done)` Sky Glass ko'k palitraga o'tkazildi |
| Pastki navigatsiya | `.bottom-nav`, `.nav-item`, `#nav-indicator` | `positionNavIndicator` kapsula joylashuvini JS da hisoblaydi | `svg.ni-o` konturi (`fill:none; stroke:#6c94b6`), `svg.ni-f` faol ko'k rang (`#247bc1`) va `#nav-indicator` ko'k shisha kapsulasi sozlandi |
| Zaif qurilmalar (`lite`) | `html.lite` (`a1-perf-tier`) | Blur va og'ir animatsiyalarni o'chiradi | `html[data-theme="light"]...lite` qoidalari bilan blur'siz ham toza Sky Glass foni va hoshiyalari saqlandi |

## 2026-11-03: Yakunlangan kaskad va regressiya himoyasi
- `index.html` ning `<body>` qismida `<head>` dan keyin keladigan `home-ios-2026`, `bm-cards-2026`, `card-style-appstore`, `a1-ios26-card9`, `a1-ios26-card10`, `tabbar-liquid-glass` va `a1-ios26-pages3` `<style>` bloklaridagi `!important` qoidalar tahlil qilinib, `avtoa1-light-only.css` da ulardan yuqori specificity'ga ega selektorlar yozildi.
- `.github/test-light-skyglass.js` har bir vergul bilan ajratilgan sub-selektorning `html[data-theme="light"][data-theme="light"]` bilan boshlanishini va barcha asosiy komponentlar (`bm-card`, `ac-card`, `header.hx`, `search-box`, `bottom-nav`, `lite`) qamrab olinganini avtomatik tekshiradi.
- `.github/test-light-banner-carousel.js` va `.github/test-light-banner-behavior.js` 3 ta WebP banner, 3 ta CTA, swipe, klaviatura strelkalari va Dark/Light almashinuvini tekshiradi.
