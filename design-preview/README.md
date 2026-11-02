# Avto A1 — Sky Glass Home Preview

## Maqsad
Amaldagi Avto A1 savdo logikasini o'zgartirmasdan, oq va havo rangli, iOS uslubidagi premium/sodda vizual yo'nalishni ko'rib chiqish.

## Tasdiqlangan dizayn
- Ilova nomi: **Avto A1**
- Fon: oq va juda och ko'k (#FFFFFF, #F4FAFF)
- Asosiy rang: havo rang / ko'k (#339CE6)
- Matn: to'q rang (#172D45); qora rang faqat matnda
- Glass va blur: header, pastki navigatsiya va kelajakdagi modal oynalar
- Mahsulot kartasi: katta vizual, yumaloq burchak, ko'k qo'shish tugmasi
- Birinchi ekran: Home

## Fayllar
- `design-preview/index.html` — faqat vizual Home ekran namunasi
- `design-preview/sky-glass.css` — uning stil qoidalari

## Chegaralar
- **Demo:** mahsulotlar, narxlar, rasmlar va banner konseptual. SVG ilustratsiyalar mahsulotlarning haqiqiy rasmlari emas.
- **Integratsiya yo'q:** qidiruv, savat, login, bildirishnoma, to'lov va buyurtma ishlamaydi.
- **Jonli tizim o'zgarmaydi:** asosiy `index.html`, bot, Cloudflare Worker, Firebase qoidalari va Android konfiguratsiyasi o'zgarmaydi.
- Prototipni brauzerda `design-preview/index.html` ni ochib ko'rish mumkin. Alohida server yoki npm talab qilinmaydi.
- Telefonlarda turli ekran o'lchamlari va accessibility alohida tekshirilishi kerak.

## Keyingi bosqich (yangi PR)
Dizayn tasdiqlangach, mavjud Avto A1 funksiyalarini saqlagan holda komponentma-komponent real ilovaga integratsiya qilish. Bunga qadar prototipga haqiqiy ma'lumotlarni bog'lamang.
