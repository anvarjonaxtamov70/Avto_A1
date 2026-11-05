# Avto A1 — Sky Glass dizayn prototipi

## Maqsad
Mavjud **Avto_A1** chakana savdo ilovasining asosiy ishlash mantiqiga tegmasdan, kelajakdagi Android/iOS ilova uchun oq va havo rangli, iOS'ga xos shaffof glass dizayn konsepsiyasining **Home** ekranini ko‘rsatish.

## Foydalanuvchi tasdiqlagan talablar
- Nom: **Avto A1**
- Ranglar: **oq + havo rang**
- Kayfiyat: **premium + sodda**
- Glass/blur: **header, pastki menyu va keyinchalik modal oynalar**
- Birinchi ekran: **Home**
- To‘q rang: **matn va piktogrammalarda**, qora fon yo‘q
- Mahsulot kartalari: **katta tasvir, yumaloq burchak, ko‘k savat tugmasi**
- Mavjud bot, Firebase va buyurtma logikasi: **o‘zgarmaydi**

## Fayllar
- `design-preview/index.html`: Home sahifasi, faqat prototip
- `design-preview/sky-glass.css`: mobil-first CSS, blur/glass, ranglar va adaptiv o‘lchamlar

## Ranglar
- Background: `#F4FAFF`
- White: `#FFFFFF`
- Sky light: `#DDF2FF`
- Blue: `#55B5F5`
- Primary text: `#172D45`

## Prototip cheklovlari
**Bu savdo ilovasi emas.** Katalog, qidiruv, savat, kirish, bildirishnoma, yetkazish va to‘lov tugmalari ishchi backend'ga ulanmagan. Mahsulot nomlari va narxlari **demo ma'lumot**. Rasm o‘rniga ichki SVG chizmalar ishlatilgan; keyin haqiqiy tovar suratlari bilan almashtiriladi. Header va bottom nav'da glass effekt bor, modal effekt esa modal dizayni rejalashtirilganda qo‘shiladi.

## Xavfsizlik
- Mavjud root `index.html`, `database.rules.json`, Cloudflare Worker va `bot/` o‘zgartirilmagan.
- PR'ni merge qilishdan oldin dizaynni ko‘rib chiqish va tekshirish kerak.
- Barcha yangi fayllar alohida `design-preview/` papkasiga qo‘yilgan.
- Joylashuv: kelgusida `/design-preview/` yo‘li orqali alohida ko‘rish mumkin (agar branch preview xizmatiga joylansa).

## Keyingi PR (faqat tasdiqdan so‘ng)
1. Prototip bo‘yicha fikrlarni yig‘ish.
2. Haqiqiy mahsulot kartalari uchun UI komponentlarni ajratish.
3. Mavjud ishchi katalog va savat funksiyasiga ulash rejasini tayyorlash.
4. Bot/Firebase ishlashini regressiya testlari bilan tekshirish.
5. Ilovaning jonli sahifasida faqat keyin dizayn migratsiyasini bajarish.
