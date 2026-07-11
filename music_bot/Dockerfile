# =====================================================================
#  🎵 Music Downloader Bot — Docker image (PO Token bilan)
#
#  Bu image ICHIDA ikkita narsa ishlaydi:
#    1) bgutil PO Token provider (Node.js HTTP server, 127.0.0.1:4416)
#       -> YouTube'ning "Sign in to confirm you're not a bot" blokini ochadi
#    2) Telegram bot (Python) -> yt-dlp + ffmpeg bilan MP3 yuklaydi
#
#  yt-dlp PO Token plagini (pip) avtomatik shu serverdan token oladi.
#  Hammasi bitta konteynerda => bitta BEPUL Render servisi yetadi.
#
#  Maxfiy qiymatlar (BOT_TOKEN) image ICHIGA QO'YILMAYDI — platforma
#  "environment variables" orqali beriladi.
# =====================================================================
FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    NODE_MAJOR=20

# Tizim paketlari: ffmpeg (audio), curl/gnupg/git/unzip (build), va Node.js 20
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg curl gnupg ca-certificates git unzip \
    && mkdir -p /etc/apt/keyrings \
    && curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
        | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg \
    && echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_${NODE_MAJOR}.x nodistro main" \
        > /etc/apt/sources.list.d/nodesource.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

# --- Deno (JS runtime) ---
#  yt-dlp YouTube'ning n-parametr / signature (JS) challenge'ini yechish uchun
#  JS runtime talab qiladi. Bo'lmasa formatlar ochilmay "Requested format is
#  not available" xatosi chiqadi. Deno + yt-dlp-ejs shu muammoni hal qiladi.
#
#  MUHIM: deno.land/install.sh HECH QANDAY "-y" (avto-tasdiqlash) flagini
#  qabul qilmaydi — u interaktiv so'rov bermaydi. Skriptga uzatilgan birinchi
#  argument DENO VERSIYASI (release tag) sifatida talqin qilinadi. "-y"
#  yuborilsa, skript "https://github.com/denoland/deno/releases/download/-y/..."
#  manzilidan yuklashga urinadi — bu URL mavjud emas (404), shu sababli
#  RUN buyrug'i XATO bilan tugaydi va BUTUN Docker build MUVAFFAQIYATSIZ
#  bo'ladi (bot Render'da umuman ishga tushmaydi). Shu uchun argumentsiz
#  chaqiramiz — bu eng so'nggi Deno versiyasini o'rnatadi.
ENV DENO_INSTALL=/usr/local
RUN curl -fsSL https://deno.land/install.sh | sh \
    && deno --version

# --- PO Token provider (bgutil) serverini build qilamiz ---
#  Manba: https://github.com/Brainicism/bgutil-ytdlp-pot-provider
RUN git clone --depth 1 https://github.com/Brainicism/bgutil-ytdlp-pot-provider.git /opt/bgutil \
    && cd /opt/bgutil/server \
    && npm install \
    && npx tsc

WORKDIR /app

# Python kutubxonalari (yt-dlp + PO Token plagini ham shu yerda)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Bot kodi va ishga tushirish skripti
COPY . .
RUN chmod +x start.sh

# start.sh: avval POT serverni fon rejimida, keyin botni ishga tushiradi
CMD ["bash", "start.sh"]
