# Avto A1 — Light mode Sky Glass integratsiya modullari

## Holat
Ushbu papkada ikki xil artefakt joylashgan:
1. **Jonli Light-only integratsiya fayllari (`index.html` ga ulangan):**
   - `avtoa1-light-only.css` — faqat `html[data-theme="light"]` uchun yuqori specificity (`html[data-theme="light"][data-theme="light"][data-theme="light"] body ...`) bilan yozilgan Sky Glass dizayn qatlami. `index.html` ichidagi keyingi `<style>` bloklaridan (`home-ios-2026`, `bm-cards-2026`, `card-style-appstore`, `a1-ios26-card9/10`, `tabbar-liquid-glass`, `a1-ios26-pages3`, `html.lite`) ustun keladi; Dark mode va savdo mantiqiga tegmaydi.
   - `approved-banner-images.css` — tasdiqlangan 3 ta reklama bannerining (Gazel, Aksiyalar, Biz bilan aloqa) WebP tasvirlari.
   - `approved-banner-live.css` va `approved-banner-live.js` — faqat Light mode Bosh sahifasida (`#a1-sky-light-carousel`) ko'rinadigan, 3 ta CTA tugmasi (`showCatalog()`, `_homeToggle('discount')`, `openModal('contactModal')`), nuqtali indikator, swipe va klaviatura (`ArrowLeft`/`ArrowRight`) boshqaruviga ega banner karuseli.
2. **Mustaqil dizayn prototipi (`index.html` + `sky-glass.css`):**
   - Dastlabki 4 bosqichli tasdiq uchun yaratilgan alohida ko'rgazmali maket.

## Foydalanuvchi tasdiqlagan 4 bosqich
1. **Ranglar:** primary `#2F8FD8`, deep `#247BC1`, accent `#5AAEEA`, surface `#EAF6FF`, ink `#172D45`, muted `#6F859A`.
2. **Bannerlar:** Gazel (`showCatalog()`), Aksiyalar (`#hf-promo` + `_homeToggle('discount')` + `#home-products` scroll), Biz bilan aloqa (`openModal('contactModal')`). Qidiruv rejimida (`body.a1-srch`) va boshqa bo'limlarda avtomatik yashirinadi.
3. **Mahsulot kartalari:** barcha 3 rejimda (`market` / `.bm-card`, `appstore` / `.ac-card`, `classic` / `.luxury-card`) Sky Glass fon, aniq narx/sarlavha kontrasti va ko'k savat CTA tugmalari.
4. **Pastki navigatsiya (`.bottom-nav`):** shisha kapsula (`#nav-indicator`), kontur (`svg.ni-o`) va to'ldirilgan (`svg.ni-f`) ikonkalar mosligi hamda `html.lite` tezlik rejimida toza ko'rinish.

## Xavfsizlik va Orqaga Qaytarish (Rollback)
- Dark mode (`html[data-theme="dark"]`), Firebase, Telegram bot, Cloudflare Worker va savat/buyurtma mantiqi o'zgartirilmagan.
- Orqaga qaytarish uchun `index.html` dan `light-skyglass-preview/` linklarini olib tashlash kifoya.
