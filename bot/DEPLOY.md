# Avto_A1 botini Oracle Cloud'da BEPUL va 24/7 ishlatish

Oracle Cloud "Always Free" serveri **uxlamaydi** va Render'dagi kabi **oylik kvota tugab to'xtamaydi**.
O'rnatish bitta skript bilan bo'ladi (`bot/oracle_setup.sh`) — u har qadamni tekshiradi va
xato bo'lsa nima qilishni aniq aytadi.

> ⚠️ **ENG MUHIM QOIDA:** bot faqat **bitta joyda** ishlashi mumkin. Oracle'da yoqqandan keyin
> **Render'dagi xizmatni O'CHIRING** (Render → `avto-a1-bot` → Settings → **Delete Service**).
> Hozir u to'xtatilgan, lekin keyingi oy kvota yangilanganda **o'zi yonib qoladi** va ikki
> nusxa `409 Conflict` beradi — bot jim qoladi.

---

## 1. Oracle akkaunt va server (≈15 daqiqa, bir marta)

1. https://www.oracle.com/cloud/free/ — ro'yxatdan o'ting (karta so'raydi, faqat tasdiqlash uchun).
   **Home region**ni yaqinroq tanlang (masalan Frankfurt) — keyin o'zgartirib bo'lmaydi.
2. **Tavsiya (muhim):** Billing → **Upgrade to Pay As You Go**.
   - Always Free resurslar baribir **bepul** qoladi, faqat limitdan oshsa to'lov bo'ladi.
   - Bepul akkauntda Oracle **"bo'sh turgan"** serverni (7 kun CPU < 20%) qaytarib olishi mumkin —
     bot kam yuk ishlatgani uchun bu xavf bor. PAYG'da bu muammo va "Out of capacity" xatosi kamayadi.
   - Xavfsizlik uchun: Billing → **Budgets** → $1 lik byudjet ogohlantirishini qo'ying.
3. **Compute → Instances → Create instance:**
   - **Image:** Canonical **Ubuntu 24.04**
   - **Shape:** **Ampere VM.Standard.A1.Flex**, 1 OCPU / 6 GB (Always Free).
     "Out of host capacity" chiqsa — boshqa Availability Domain'ni tanlang yoki
     **VM.Standard.E2.1.Micro** (AMD, 1 GB) ni oling — skript unga swap qo'shadi, bot bemalol ishlaydi.
   - **SSH keys:** "Generate a key pair for me" → **private key**ni yuklab oling (`ssh-key.key`).
4. **Create** → server sahifasidan **Public IP address**ni nusxalang.

Bot long polling ishlatadi — **port ochish shart emas**.

## 2. Serverga kirish

Kompyuteringizda (PowerShell yoki terminal), `ssh-key.key` turgan papkada:

```bash
ssh -i ssh-key.key ubuntu@SERVER_IP
```

> Linux/Mac'da avval: `chmod 600 ssh-key.key`. Windows'da kalit "too open" desa: fayl
> xususiyatlari → Security → faqat o'zingizga ruxsat qoldiring.

## 3. Bitta buyruq bilan o'rnatish

Server ichida:

```bash
curl -fsSL https://raw.githubusercontent.com/anvarjonaxtamov70/Avto_A1/main/bot/oracle_setup.sh | bash
```

Birinchi marta skript **`.env` bo'sh** deb to'xtaydi — bu normal.

## 4. Maxfiy sozlamalar

**`.env`** — Render → `avto-a1-bot` → **Environment** dagi qiymatlarni ko'chiring:

```bash
nano ~/Avto_A1/bot/.env
```

Kamida: `BOT_TOKEN`, `GROQ_API_KEY`, `ADMIN_IDS=5105291033,483425630,5302078`.
Saqlash: `Ctrl+O` → `Enter`, chiqish: `Ctrl+X`.

> `BOT_TOKEN` **Cloudflare Worker'dagi bilan bir xil** bo'lishi shart (tugmalar shu bilan imzolanadi).

**`serviceAccount.json`** — ikki yo'ldan biri:
- Kompyuteringizdan (yangi terminalda, server emas):
  `scp -i ssh-key.key serviceAccount.json ubuntu@SERVER_IP:~/Avto_A1/bot/`
- yoki Render'dagi `SERVICE_ACCOUNT_JSON` qatorini to'liq `.env` ga qo'shing.

## 5. Skriptni qayta ishga tushirish

```bash
bash ~/Avto_A1/bot/oracle_setup.sh
```

Oxirida `✅ Bot ishlayapti!` chiqishi kerak. Adminlarga **"🟢 Bot ishga tushdi — Qayerda: Oracle Cloud"**
xabari keladi. Telegram'da botga `/start` yozib tekshiring.

Skript nimani tekshiradi: Python kutubxonalari, `.env`, `serviceAccount.json` to'g'riligi,
`BOT_TOKEN` (Telegram'dan so'raydi), xizmat yonganini va **409 (ikki nusxa)** yo'qligini.

## 6. Render'ni o'chirish

Render → `avto-a1-bot` → Settings → **Delete Service**. (Yuqoridagi qoidaga qarang.)

---

## Kod yangilanganda

```bash
bash ~/Avto_A1/bot/oracle_update.sh
```
Yangi kodda sintaksis xatosi bo'lsa — yangilamaydi, bot eski versiyada ishlayveradi.

## Foydali buyruqlar

| Vazifa | Buyruq |
|--------|--------|
| Holat | `systemctl status avto-a1-bot` |
| Jonli loglar | `journalctl -u avto-a1-bot -f` |
| Qayta ishga tushirish | `sudo systemctl restart avto-a1-bot` |
| To'xtatish | `sudo systemctl stop avto-a1-bot` |

## Muammolar

| Belgi | Sabab va yechim |
|-------|-----------------|
| Loglarda `409 Conflict` | Bot ikki joyda. Render'ni o'chiring, kompyuterdagi nusxani to'xtating. |
| Storis/buyurtma yozilmayapti, `401` | `serviceAccount.json` yo'q yoki eski — Firebase'dan qayta yuklang. |
| Tugmalar "Worker eski versiyada" deydi | `cloudflare-worker.js` ni Cloudflare'ga joylang. |
| Tugmalar "Imzo rad etildi" deydi | Worker va bot `.env` dagi `BOT_TOKEN` bir xil emas. |
| "Out of host capacity" | Boshqa Availability Domain, E2.1.Micro yoki PAYG (1-bo'lim). |
