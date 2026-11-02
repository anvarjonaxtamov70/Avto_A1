# Avto A1 — Light mode Sky Glass integratsiya PR

## Holat
Bu **alohida ishlaydigan HTML/CSS preview**, mavjud Telegram Mini App'ga ulanmagan. GitHub PR Merge qilinganda avtomatik ravishda bot Light mode'i o'zgarmaydi. Dark mode va ishlab turgan index.html o'zgarmaydi.

## Foydalanuvchi tasdiqlagan 4 bosqich
1. Ranglar: primary #2F8FD8, deep #247BC1, accent #5AAEEA, pale #EAF6FF.
2. Bannerlar: Gazel / aksiyalar / biz bilan aloqa (uchta slayd); turli CTA uslublari. **Tasdiqlangan rasmlarning original binar fayllari GitHub branch'ida hali yo'q**, shuning uchun HTML'da ko'rgazmali SVG/CSS o'rinbosarlar bor. Reklama tasvirlari va aloqa URL'larini integratsiyadan oldin alohida tekshirish kerak.
3. Product cards: katta vizual, nom/narx, ko'k savat CTA, 2 ustun. Narxlar va rasmlar demo.
4. Bottom nav: yumshoq soya, blur/glass, faol tugmada ko'k bo'rtma.

## Xavfsizlik
- Bu PR hozircha `main/index.html`, Firebase, Telegram bot, Cloudflare Worker, Android'ga tegmaydi.
- Dark mode hech qanday global qoida bilan almashtirilmagan.
- Qidiruv, savat, hisob, buyurtmalar va to'lovlar demo preview'da **ishlamaydi**.
- Botga haqiqiy integratsiya uchun `main/index.html`ni to'liq olish, Light/Dark theme markerlarini aniqlash, yangi CSS'ni faqat Light mode'ga ulash va testlarni o'tkazish zarur.
- Aloqa banneridagi knopka hozircha demo sahifadagi #contact ga o'tadi, haqiqiy Telegram/telefon manzili ulangan emas.

## Tekshiruv
- Browser'da `light-skyglass-preview/index.html` faylini oching.
- 3 banner nuqtalarini bosing; klaviaturada Left/Right.
- Telefon ekranida product card, CTA va bottom nav'ni ko'ring.
- Haqiqiy Light/Dark tema sinovlari va mini-app integratsiyasi **hali bajarilmadi**.

**PR Draft holatda qolishi kerak. Bu preview'ni ishlab turgan ilova bilan adashtirmang.**
