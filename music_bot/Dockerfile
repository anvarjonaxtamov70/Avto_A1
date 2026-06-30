# =====================================================================
#  🎵 Music Downloader Bot — Docker image
#  Render / Railway / Koyeb / Fly.io kabi konteyner platformalarida ishlaydi.
#
#  MUHIM: audioni MP3 ga aylantirish uchun FFMPEG kerak — uni shu yerda
#  o'rnatamiz. (Render'ning oddiy "Python" runtime'ida ffmpeg yo'q,
#  shuning uchun ushbu bot DOCKER runtime'da ishga tushiriladi.)
#  Maxfiy qiymatlar (BOT_TOKEN) image ICHIGA QO'YILMAYDI — platforma
#  "environment variables" orqali beriladi.
# =====================================================================
FROM python:3.11-slim

# Loglar darhol ko'rinishi uchun
ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

# ffmpeg — audio ajratish/konvert qilish uchun MAJBURIY
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Avval requirements — Docker qatlam keshidan unumli foydalanish uchun
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Bot kodi
COPY . .

CMD ["python", "bot.py"]
