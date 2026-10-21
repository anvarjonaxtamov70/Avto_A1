#!/usr/bin/env bash
# =====================================================================
#  Avto_A1 bot — serverdagi botni GitHub'dagi eng so'nggi kodga yangilash
#    bash ~/Avto_A1/bot/oracle_update.sh
#  Yangi kod sintaktik xato bo'lsa — eski versiya ishlayveradi (qayta yoqilmaydi).
# =====================================================================
set -euo pipefail
APP_DIR="${APP_DIR:-$HOME/Avto_A1}"
BOT_DIR="$APP_DIR/bot"
SERVICE="avto-a1-bot"

OLD=$(git -C "$APP_DIR" rev-parse HEAD)
git -C "$APP_DIR" pull --ff-only
NEW=$(git -C "$APP_DIR" rev-parse HEAD)
if [ "$OLD" = "$NEW" ]; then
  echo "✅ Kod allaqachon eng so'nggi: $(git -C "$APP_DIR" log -1 --format='%h %s')"
  exit 0
fi
cd "$BOT_DIR"
./venv/bin/pip install -q -r requirements.txt
if ! ./venv/bin/python -m py_compile bot.py ai_agent.py fb_utils.py bulk_import_fixed.py order_ops.py; then
  echo "❌ Yangi kodda sintaksis xatosi — qaytaramiz, bot ESKI versiyada ishlayveradi."
  git -C "$APP_DIR" reset -q --hard "$OLD"
  exit 1
fi
sudo systemctl restart "$SERVICE"
sleep 15
if systemctl is-active --quiet "$SERVICE"; then
  echo "✅ Yangilandi: $(git -C "$APP_DIR" log -1 --format='%h %s')"
else
  echo "❌ Bot yangi kod bilan yonmadi. Loglar:"
  sudo journalctl -u "$SERVICE" -n 40 --no-pager
  exit 1
fi
