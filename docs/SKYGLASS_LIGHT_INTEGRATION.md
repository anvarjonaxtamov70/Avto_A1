# Avto A1 Sky Glass — faqat LIGHT mode integratsiyasi

## Qamrov (2026-11-02)
- 1-bosqich: foydalanuvchi tasdiqlagan oq / havorang palitra (#2F8FD8, #247BC1, #5AAEEA).
- 2-bosqich: foydalanuvchi tasdiqlagan uchta rastr banner (Gazel, Aksiyalar, Biz bilan aloqa); gorizontal suriladigan karusel, nuqta navigatsiyasi.
- 3-bosqich: haqiqiy katalog ma'lumotlari va mavjud savat JS'i saqlangan holda oq, yumaloq, soyali mahsulot kartalari va bo'rtma ko'k savat tugmalari.
- 4-bosqich: mavjud 5 ta nav funksiyasini saqlagan holda shaffof, yumaloq pastki menyu va faol ko'k segment.

## Qanday ishlaydi
- `index.html` oxirida faqat 2 ta yangi resurs havolasi bor: `skyglass/light.css`, `skyglass/light.js`. Savdo, Firebase, bot, admin va checkout kodlari tahrirlanmadi.
- Barcha vizual almashtirishlar `html[data-theme="light"]` bilan chegaralangan; `dark` rejimining asl UI'i shu holda qoladi.
- Yangi bannerlar **faqat Light mode**da ko'rinadi; admin/Firebase banner slayderining DOM'i, logikasi va ma'lumotlari saqlanadi. Dark mode'da eski admin slayder ishlayveradi.
- Agar yangi banner rasmi yuklanmasa, `a1-sg-assets-failed` sinfi orqali original slayder yana ko'rsatiladi.
- Banner tugmalari mos mavjud funktsiyalarga bog'langan: `showCatalog()`, `_homeToggle('discount')`, `openModal('contactModal')`.
- Mahsulotlar demo emas: real `cardHTML` / `renderProducts` natijalariga faqat CSS qo'llanadi.

## Muhim chegaralar
- Dizayn tasdiqlangan rasm namunalariga mos *stil integratsiyasi*, butun ilovaning yangi React maketi emas.
- `main` branch'ga MERGE QILINMAGAN. Jonli Telegram/Firebase/Android o'tishlar va qurilmalarda ko'rinish tekshirilmaguncha PR qoralama holatda qoladi.
- Admin boshqa banner qo'shsa, u light mode'dagi uchta tasdiqlangan bannerga avtomatik qo'shilmaydi. Asl admin bannerlar dark mode'da saqlanadi.
- Tasdiqlangan rasmda chizilgan tugmalar rastr tasvir ichida, ularning ustidagi shaffof HTML tugmalar ishlaydigan click/focus zonasini beradi.

## Tekshiruv ro'yxati
1. Light mode: uy sahifasida aynan uchta banner, surish va nuqtalar ishlashi.
2. Birinchi banner katalogni, ikkinchi banner chegirma filtrini, uchinchi banner aloqa oynasini ochishi.
3. Haqiqiy mahsulot kartalarida rasm, narx, reyting va savat tugmalari mavjudligi.
4. Pastki navda Asosiy, Katalog, Saqlangan, Savat, Profil funksiyalari ishlashi.
5. Dark mode: avvalgi bannerlar, navigatsiya, mahsulot kartalari va ranglar o'zgarmaganligi.
6. Telegram Mini App, brauzer, iOS, Android hamda kam quvvatli qurilmalar alohida tekshirilishi.
7. Xatolik yuz bersa, Light mode CSS/JS importlarini qaytarib olish yoki PR'ni revert qilish mumkin.

## Orqaga qaytish
`index.html`dagi ushbu ikkita qo'shimcha tegni olib tashlash kifoya:
```html
<link rel="stylesheet" href="skyglass/light.css?v=20261102a">
<script src="skyglass/light.js?v=20261102a"></script>
```
Qolgan biznes kodiga tegish talab qilinmaydi.
