#!/usr/bin/env bash
# =====================================================================
#  Music bot ishga tushirish skripti
#  1) bgutil PO Token provider serverini fon rejimida ishga tushiradi
#  2) Telegram botni ishga tushiradi
# =====================================================================
set -e

POT_PORT="${POT_PORT:-4416}"
POT_MAIN="/opt/bgutil/server/build/main.js"

if [ -f "$POT_MAIN" ]; then
  echo "🔑 PO Token provider ishga tushyapti (port ${POT_PORT})..."
  node "$POT_MAIN" --port "${POT_PORT}" &
  # Serverga ko'tarilish uchun ozgina vaqt beramiz
  sleep 4
else
  echo "⚠️ PO Token provider topilmadi ($POT_MAIN). Bot u holda davom etadi."
fi

echo "🎵 Telegram bot ishga tushyapti..."
exec python bot.py
