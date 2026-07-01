# =====================================================================
#  💎 Ivy — Jewelry & Cosmetics bot — Docker image
#  Render, Railway, Koyeb, Fly.io kabi konteyner platformalarida ishlaydi.
#  Maxfiy qiymatlar (.env / serviceAccount.json) image ICHIGA QO'YILMAYDI —
#  ular platforma "environment variables" orqali beriladi (xavfsiz).
# =====================================================================
FROM python:3.11-slim

# Loglar darhol ko'rinishi uchun (buffer'siz)
ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Avval faqat requirements — Docker qatlam keshidan unumli foydalanish uchun
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Bot kodi
COPY . .

# Bot long-polling ishlatadi; PORT berilsa health-server shu portda ochiladi.
CMD ["python", "bot.py"]
