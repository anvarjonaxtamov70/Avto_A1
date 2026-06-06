# Avto_A1 botini Oracle Cloud'da BEPUL va 24/7 ishlatish

Bu qo'llanma botni o'z kompyuteringizdan **Oracle Cloud "Always Free"** serveriga ko'chiradi.
Shundan keyin bot **uzluksiz** (kompyuteringiz o'chsa ham) ishlaydi va **bepul** bo'ladi.

> ⚠️ **ENG MUHIM QOIDA:** bot faqat **bitta joyda** ishlashi mumkin. Serverda ishga
> tushirgandan keyin **kompyuteringizdagi (VS Code) nusxasini to'xtating** (terminalda
> `Ctrl+C`), aks holda Telegram `409 Conflict` xatosini beradi.

---

## 0-QADAM: Nima kerak

- Oracle Cloud akkaunti (ro'yxatdan o'tishda karta so'raydi — pul yechilmaydi, faqat tasdiqlash uchun).
- `.env` faylidagi qiymatlar (BOT_TOKEN, GROQ_API_KEY, ...).
- `serviceAccount.json` fayli (Firebase Console'dan).

---

## 1-QADAM: Oracle Cloud'da bepul server (VM) yaratish

1. https://www.oracle.com/cloud/free/ ga kiring va ro'yxatdan o'ting.
2. Konsolda: **Menu → Compute → Instances → Create Instance**.
3. Sozlamalar:
   - **Image:** Canonical **Ubuntu** (22.04 yoki 24.04).
   - **Shape:** "Always Free eligible" deb belgilangan shaklni tanlang
     (masalan **Ampere (ARM) VM.Standard.A1.Flex** — 1 OCPU / 6 GB RAM bemalol yetadi,
     yoki AMD **VM.Standard.E2.1.Micro**).
   - **SSH keys:** "Generate a key pair for me" ni tanlab, **private key**'ni
     yuklab oling (masalan `ssh-key.key`) — bu serverga kirish kaliti.
4. **Create** bosing. Bir-ikki daqiqada server tayyor bo'ladi.
5. Server sahifasidan **Public IP address** ni nusxalang (masalan `123.45.67.89`).

### Telegram uchun portni ochish (ixtiyoriy, polling uchun shart emas)
Bot **long polling** ishlatadi — kiruvchi port kerak emas, shuning uchun firewall'ni
o'zgartirish shart emas. (Faqat chiquvchi internet kerak, u doim ochiq.)

---

## 2-QADAM: Serverga ulanish (SSH)

Kompyuteringiz terminalida (private key shu papkada turgan bo'lsin):

```bash
# kalit faylga to'g'ri ruxsat berish (Linux/Mac)
chmod 600 ssh-key.key

# serverga kirish (IP o'rniga o'zingiznikini yozing)
ssh -i ssh-key.key ubuntu@123.45.67.89
```

> Windows'da: PowerShell yoki PuTTY ishlating. PowerShell'da xuddi shu `ssh` buyrug'i ishlaydi.

---

## 3-QADAM: Serverda dasturlarni o'rnatish

Server ichida (SSH ulangan holda) quyidagilarni ketma-ket yozing:

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y python3 python3-venv python3-pip git
```

---

## 4-QADAM: Kodni yuklab olish

```bash
cd ~
git clone https://github.com/anvarjonaxtamov70/Avto_A1.git
cd Avto_A1/bot
```

Virtual muhit yaratib, kutubxonalarni o'rnatamiz:

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

---

## 5-QADAM: Maxfiy fayllarni joylashtirish (.env va serviceAccount.json)

Bu ikki fayl GitHub'da **yo'q** (maxfiy), shuning uchun ularni qo'lda yaratish kerak.

### 5.1 — `.env`
```bash
cp .env.example .env
nano .env
```
`nano` ichida qiymatlarni to'ldiring (kamida `BOT_TOKEN` va `GROQ_API_KEY`).
Saqlash: `Ctrl+O` → `Enter`, chiqish: `Ctrl+X`.

### 5.2 — `serviceAccount.json`
Kompyuteringizdagi `serviceAccount.json` ni serverga yuborish — **yangi terminal**
oching (kompyuteringizda, server emas):

```bash
scp -i ssh-key.key serviceAccount.json ubuntu@123.45.67.89:~/Avto_A1/bot/
```

> Muqobil: server ichida `nano serviceAccount.json` ochib, JSON matnini nusxalab qo'ying.

---

## 6-QADAM: Sinov uchun ishga tushirish

Server ichida (venv yoqilgan holda):
```bash
python bot.py
```
"Bot ishga tushdi!" deb yozilsa — ishlayapti. Telegram'da botingizga `/start` yozib tekshiring.

> Endi `Ctrl+C` bilan to'xtating — keyingi qadamda uni **doimiy xizmat** qilamiz.
> Shuningdek **kompyuteringizdagi botni ham to'xtating** (bitta nusxa qoidasi).

---

## 7-QADAM: Botni "hech qachon o'chmaydigan" qilish (systemd)

Repoda tayyor `avto-a1-bot.service` fayli bor. U botni:
- krash bo'lsa **avtomatik qayta ishga tushiradi**,
- server qayta yuklansa **o'zi yonadi**.

Server ichida:
```bash
sudo cp ~/Avto_A1/bot/avto-a1-bot.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now avto-a1-bot
```

Tekshirish:
```bash
systemctl status avto-a1-bot      # "active (running)" bo'lishi kerak
journalctl -u avto-a1-bot -f      # jonli loglar (chiqish: Ctrl+C)
```

Tayyor! Endi SSH'dan chiqib ketsangiz ham (`exit`) bot **24/7 ishlayveradi**.

---

## Kodni yangilaganda (kelajakda)

GitHub'ga yangi o'zgarish chiqsa, serverda:
```bash
cd ~/Avto_A1
git pull
cd bot
source venv/bin/activate
pip install -r requirements.txt   # yangi kutubxona bo'lsa
sudo systemctl restart avto-a1-bot
```

---

## Foydali buyruqlar

| Vazifa | Buyruq |
|--------|--------|
| Holatni ko'rish | `systemctl status avto-a1-bot` |
| Jonli loglar | `journalctl -u avto-a1-bot -f` |
| To'xtatish | `sudo systemctl stop avto-a1-bot` |
| Ishga tushirish | `sudo systemctl start avto-a1-bot` |
| Qayta ishga tushirish | `sudo systemctl restart avto-a1-bot` |
| Avtoyoqishni o'chirish | `sudo systemctl disable avto-a1-bot` |

---

## Tez-tez uchraydigan muammolar

- **`409 Conflict` xatosi loglarda** → bot ikki joyda ishlayapti. Kompyuteringizdagi
  (VS Code) nusxasini to'xtating. Faqat server nusxasi qolsin.
- **Storis yozilmayapti / 401** → `serviceAccount.json` server'da `bot/` papkasida
  borligini tekshiring.
- **`ModuleNotFoundError`** → `source venv/bin/activate` qilib, `pip install -r requirements.txt` ni qayta yuriting.
- **Bot javob bermayapti** → `journalctl -u avto-a1-bot -f` orqali loglarni ko'ring;
  `BOT_TOKEN` to'g'ri kiritilganini tekshiring.
