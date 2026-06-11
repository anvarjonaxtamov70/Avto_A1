# assets/img — sayt rasmlari (o'z hostingi)

Ilgari barcha story, banner, brend logosi va ba'zi mahsulot rasmlari bepul
`i.postimg.cc` xizmatida turardi. Bu ishonchsiz edi (havolalar o'chib qolishi,
sekin yuklanish, sifat past) va premium brendga mos emas edi.

Endi rasmlar shu repo ichida saqlanadi va GitHub Pages CDN orqali tarqatiladi.
`index.html` ulardan nisbiy yo'l bilan foydalanadi, masalan: `assets/img/brand-gaz.png`.

## Rasmlarni shu papkaga qanday qo'shish kerak

Rasm fayllari hali bu papkada **yo'q** — ularni bir marta yuklab olish kerak.
Internet bo'lgan joyda quyidagilardan birini bajaring:

**A variant — GitHub'da (kompyutersiz, eng oson):**
1. GitHub'da repo → **Actions** → **"Rasmlarni o'z hostingiga yuklab olish"** workflow
2. **Run workflow** → ushbu branch (`design/self-host-images`) ni tanlang → ishga tushiring
3. Workflow rasmlarni shu papkaga yuklab, avtomatik commit qiladi

**B variant — lokal kompyuterda:**
```bash
bash scripts/download-images.sh
git add assets/img && git commit -m "assets: rasmlarni o'z hostingiga qo'shish"
```

> Rasmlar qo'shilgandan keyingina PR'ni `main`ga merge qiling, aks holda
> sayt rasmlari ko'rinmaydi.

## Fayl ro'yxati (15 ta)

| Fayl | Ishlatilishi |
|------|--------------|
| `story-aksiyalar.png` | Story: Aksiyalar |
| `story-bugun.jpg` | Story: Bugun |
| `story-mijozlar.png` | Story: Mijozlar |
| `story-dostavka.png` | Story: Dostavka |
| `story-kafolat.png` | Story: Kafolat |
| `story-lokatsiya.png` | Story: Lokatsiya |
| `story-tolov.png` | Story: To'lov |
| `story-aloqa.png` | Story: Aloqa |
| `banner-fara-club-sam.png` | Slayder: FARA CLUB SAM hamkorlik banneri |
| `brand-gaz.png` | Brend logo: GAZ / Volga |
| `brand-chevrolet.png` | Brend logo: Chevrolet (eng ko'p ishlatiladi) |
| `brand-daewoo.png` | Brend logo: Daewoo (Nexia, Matiz, Tico) |
| `brand-uaz.png` | Brend logo: UAZ |
| `contact-banner.png` | Aloqa modalidagi banner |
| `product-gazel-porshen.jpg` | Mahsulot: Gazel porshen to'plami |
