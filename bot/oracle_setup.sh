#!/usr/bin/env bash
# =====================================================================
#  Avto_A1 bot — Oracle Cloud (Ubuntu) serveriga BIR BUYRUQ bilan o'rnatish
#
#  Serverda (SSH orqali kirgandan keyin) shuni yozing:
#    curl -fsSL https://raw.githubusercontent.com/anvarjonaxtamov70/Avto_A1/main/bot/oracle_setup.sh | bash
#
#  Skript nima qiladi (har qadamni TEKSHIRADI, xato bo'lsa aniq aytib to'xtaydi):
#    1) kerakli dasturlar (python, git), vaqt zonasi — Toshkent
#    2) RAM kichik bo'lsa (Micro server) — 2 GB swap (pip o'rnatishda qotmasligi uchun)
#    3) kodni GitHub'dan yuklaydi (yoki yangilaydi)
#    4) Python kutubxonalarini virtual muhitga o'rnatadi
#    5) .env va serviceAccount.json ni tekshiradi (yo'q bo'lsa — nima qilishni aytadi)
#    6) BOT_TOKEN ni Telegram'da tekshiradi
#    7) systemd xizmatini yaratadi: bot 24/7, yiqilsa/server o'chib-yonsa O'ZI yonadi
#    8) 25 soniya kuzatib, bot haqiqatan ishlayotganini va 409 (ikki nusxa) yo'qligini tekshiradi
#
#  Qayta ishga tushirish xavfsiz: mavjud .env / serviceAccount.json ga tegmaydi.
# =====================================================================
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/anvarjonaxtamov70/Avto_A1.git}"
APP_DIR="${APP_DIR:-$HOME/Avto_A1}"
BOT_DIR="$APP_DIR/bot"
SERVICE="avto-a1-bot"

green() { printf '\033[32m✅ %s\033[0m\n' "$*"; }
yellow() { printf '\033[33m⚠️  %s\033[0m\n' "$*"; }
red() { printf '\033[31m❌ %s\033[0m\n' "$*"; }
step() { printf '\n\033[1m▶ %s\033[0m\n' "$*"; }

if [ "$(id -u)" -eq 0 ] && [ "${ALLOW_ROOT:-}" != "1" ]; then
  red "Skriptni root sifatida emas, oddiy foydalanuvchi (ubuntu) sifatida ishga tushiring."
  exit 1
fi

step "1/8 Dasturlar va vaqt zonasi"
sudo apt-get update -y -qq
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq python3 python3-venv python3-pip git curl >/dev/null
sudo timedatectl set-timezone Asia/Tashkent 2>/dev/null || true
green "python $(python3 --version | cut -d' ' -f2), git, vaqt zonasi: $(timedatectl show -p Timezone --value 2>/dev/null || echo '?')"

step "2/8 Xotira (RAM)"
MEM_MB=$(free -m | awk '/^Mem:/{print $2}')
SWAPFILE="${SWAPFILE:-/swapfile}"
FSTAB="${FSTAB:-/etc/fstab}"
if [ "$MEM_MB" -lt 2000 ] && ! swapon --show --noheadings 2>/dev/null | grep -q .; then
  [ -f "$SWAPFILE" ] || sudo fallocate -l 2G "$SWAPFILE"
  sudo chmod 600 "$SWAPFILE"
  sudo mkswap "$SWAPFILE" >/dev/null
  sudo swapon "$SWAPFILE"
  grep -q "^$SWAPFILE " "$FSTAB" || echo "$SWAPFILE none swap sw 0 0" | sudo tee -a "$FSTAB" >/dev/null
  green "RAM ${MEM_MB} MB — 2 GB swap qo'shildi"
else
  green "RAM ${MEM_MB} MB — yetarli"
fi

step "3/8 Kod (GitHub)"
if [ -d "$APP_DIR/.git" ]; then
  git -C "$APP_DIR" pull --ff-only
  green "Kod yangilandi: $(git -C "$APP_DIR" log -1 --format='%h %s')"
else
  git clone -q "$REPO_URL" "$APP_DIR"
  green "Kod yuklandi: $(git -C "$APP_DIR" log -1 --format='%h %s')"
fi

step "4/8 Python kutubxonalari"
cd "$BOT_DIR"
[ -d venv ] || python3 -m venv venv
./venv/bin/pip install -q --upgrade pip
./venv/bin/pip install -q -r requirements.txt
./venv/bin/python -m py_compile bot.py ai_agent.py fb_utils.py bulk_import_fixed.py order_ops.py
./venv/bin/python -c "import aiogram, aiohttp, groq, google.auth, dotenv, pandas" 
green "Kutubxonalar o'rnatildi va kod sintaktik toza"

step "5/8 Maxfiy sozlamalar (.env, serviceAccount.json)"
if [ ! -f .env ]; then
  cp .env.example .env
  chmod 600 .env
  red ".env yaratildi, lekin BO'SH. Uni to'ldiring:   nano $BOT_DIR/.env"
  echo "   Kamida: BOT_TOKEN, GROQ_API_KEY. Qiymatlarni Render -> Environment dan nusxalang."
  echo "   Keyin skriptni QAYTA ishga tushiring."
  exit 1
fi
chmod 600 .env
env_val() { grep -E "^$1=" .env | tail -1 | cut -d= -f2- | sed -e 's/^["'\'']//' -e 's/["'\'']$//'; }
BOT_TOKEN_VAL="$(env_val BOT_TOKEN || true)"
if [ -z "$BOT_TOKEN_VAL" ]; then
  red ".env da BOT_TOKEN bo'sh.  nano $BOT_DIR/.env  — to'ldirib, skriptni qayta ishga tushiring."
  exit 1
fi
[ -n "$(env_val GROQ_API_KEY || true)" ] || yellow "GROQ_API_KEY bo'sh — AI javoblari ishlamaydi (bot qolgan ishlarni qiladi)."
ADMIN_IDS_VAL="$(env_val ADMIN_IDS || true)"
if [ -n "$ADMIN_IDS_VAL" ]; then
  for id in 5105291033 483425630 5302078; do
    case ",$ADMIN_IDS_VAL," in *",$id,"*) ;; *) yellow "ADMIN_IDS da $id yo'q — u admin tugmalaridan foydalana olmaydi.";; esac
  done
fi
if [ -f serviceAccount.json ]; then
  ./venv/bin/python -c "import json; d=json.load(open('serviceAccount.json')); assert d.get('client_email') and d.get('private_key')" \
    || { red "serviceAccount.json buzuq (client_email/private_key yo'q). Firebase Console'dan qayta yuklab oling."; exit 1; }
  chmod 600 serviceAccount.json
  green "serviceAccount.json — to'g'ri"
elif [ -n "$(env_val SERVICE_ACCOUNT_JSON || true)" ]; then
  green "serviceAccount .env dagi SERVICE_ACCOUNT_JSON dan olinadi"
else
  red "serviceAccount.json yo'q. Kompyuteringizdan yuboring:"
  echo "   scp -i ssh-key.key serviceAccount.json ubuntu@<SERVER_IP>:$BOT_DIR/"
  echo "   (yoki Render'dagi SERVICE_ACCOUNT_JSON qatorini .env ga qo'shing). Keyin skriptni qayta ishga tushiring."
  exit 1
fi
green ".env — to'g'ri"

step "6/8 BOT_TOKEN ni Telegram'da tekshirish"
TG_API="${TG_API:-https://api.telegram.org}"
ME=$(curl -fsS --max-time 20 "${TG_API}/bot${BOT_TOKEN_VAL}/getMe" || true)
if ! printf '%s' "$ME" | grep -q '"ok":true'; then
  red "Telegram BOT_TOKEN ni rad etdi (yoki internet yo'q). .env dagi BOT_TOKEN ni tekshiring."
  exit 1
fi
BOT_USERNAME=$(printf '%s' "$ME" | sed -n 's/.*"username":"\([^"]*\)".*/\1/p')
green "Token to'g'ri: @${BOT_USERNAME}"

step "7/8 systemd xizmati (24/7, avtomatik qayta yonish)"
sudo tee "/etc/systemd/system/${SERVICE}.service" >/dev/null <<UNIT
[Unit]
Description=Avto_A1 Telegram bot
After=network-online.target
Wants=network-online.target
StartLimitIntervalSec=0

[Service]
Type=simple
User=$(id -un)
WorkingDirectory=$BOT_DIR
ExecStart=$BOT_DIR/venv/bin/python bot.py
Environment=PYTHONUNBUFFERED=1
Environment=BOT_HOST_LABEL=Oracle Cloud
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
UNIT
sudo systemctl daemon-reload
sudo systemctl enable "$SERVICE" >/dev/null 2>&1
sudo systemctl restart "$SERVICE"
green "Xizmat yaratildi va ishga tushirildi"

step "8/8 Bot haqiqatan ishlayaptimi (25 soniya kuzatamiz)"
sleep "${WAIT_SECONDS:-25}"
if ! systemctl is-active --quiet "$SERVICE"; then
  red "Xizmat ishlamayapti. Oxirgi loglar:"
  sudo journalctl -u "$SERVICE" -n 40 --no-pager
  exit 1
fi
LOGS=$(sudo journalctl -u "$SERVICE" --since "-40s" --no-pager 2>/dev/null || true)
if printf '%s' "$LOGS" | grep -qi "Conflict\|terminated by other getUpdates"; then
  red "409 Conflict: bot BOSHQA joyda ham ishlayapti (Render yoki kompyuteringiz)."
  echo "   Render'dagi xizmatni O'CHIRING (Settings -> Delete Service) va kompyuterdagi nusxani to'xtating."
  exit 1
fi
if printf '%s' "$LOGS" | grep -q "Traceback"; then
  yellow "Loglarda xato bor — tekshiring:  journalctl -u $SERVICE -n 80"
fi
if printf '%s' "$LOGS" | grep -qi "serviceAccount.json topilmadi\|access_token olinmadi\|Firebase token"; then
  yellow "Firebase tokeni bilan muammo bo'lishi mumkin — serviceAccount.json ni tekshiring."
fi
green "Bot ishlayapti! Telegram'da @${BOT_USERNAME} ga /start yozib tekshiring."
echo
echo "Foydali buyruqlar:"
echo "  holat:      systemctl status $SERVICE"
echo "  jonli log:  journalctl -u $SERVICE -f"
echo "  yangilash:  bash $BOT_DIR/oracle_update.sh"
