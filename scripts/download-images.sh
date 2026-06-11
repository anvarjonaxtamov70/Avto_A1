#!/usr/bin/env bash
#
# download-images.sh
# ------------------------------------------------------------------
# postimg.cc dagi rasmlarni repo ichidagi assets/img/ papkasiga
# yuklab oladi (o'z hostingiga ko'chirish uchun).
#
# Ishlatish:
#   bash scripts/download-images.sh
#
# Talab: curl. Internet bo'lishi shart.
# Yuklab olgandan keyin: git add assets/img && git commit
# ------------------------------------------------------------------
set -euo pipefail

cd "$(dirname "$0")/.."
OUT="assets/img"
mkdir -p "$OUT"

# fayl_nomi|manba_url
MAP=(
  "story-aksiyalar.png|https://i.postimg.cc/Bvkx57Cg/cfce7f953881dc027c48ab63a9d8f1b2.png"
  "story-bugun.jpg|https://i.postimg.cc/zftxskFr/full-6Enh-HLt-T.jpg"
  "story-mijozlar.png|https://i.postimg.cc/7PM2bZjY/Pink-Illustrated-Ask-Me-Anything-Instagram-Post-6.png"
  "story-dostavka.png|https://i.postimg.cc/KjZ4ttCc/orig.png"
  "story-kafolat.png|https://i.postimg.cc/vB56rYBN/content-full-lewlcqnv.png"
  "story-lokatsiya.png|https://i.postimg.cc/GpyBRLvW/308e0e8c2b804e9c64d0dd1bd69fc36a.png"
  "story-tolov.png|https://i.postimg.cc/kXsKYgc4/5.png"
  "story-aloqa.png|https://i.postimg.cc/bNh9FMfb/isee-7.png"
  "banner-fara-club-sam.png|https://i.postimg.cc/NM8SWXFy/Gemini-Generated-Image-wz3selwz3selwz3s-(1).png"
  "brand-gaz.png|https://i.postimg.cc/VLj18zjV/orig-(4).png"
  "brand-chevrolet.png|https://i.postimg.cc/NMgBNSyD/8h0a-Bn9L-1F0s-Hy-WEZSLfnhaqer-Kq-Kxj0Rp-SDjapvv-0z-LWJcn-SH19DCH-In-KOCt-N4s-Wd6Q9b4KGl-NDJp0vc-Ow.png"
  "brand-daewoo.png|https://i.postimg.cc/7Y4dS02Y/Daewoo-logo.png"
  "brand-uaz.png|https://i.postimg.cc/yxr763cn/orig-(5).png"
  "contact-banner.png|https://i.postimg.cc/DZbSYcSS/Gemini-Generated-Image-wyl7ivwyl7ivwyl7-(1).png"
  "product-gazel-porshen.jpg|https://i.postimg.cc/zDhCzyyB/gazel.jpg"
)

ok=0; fail=0
for entry in "${MAP[@]}"; do
  name="${entry%%|*}"
  url="${entry#*|}"
  echo "-> $name"
  if curl -fsSL --retry 3 --retry-delay 2 -o "$OUT/$name" "$url"; then
    ok=$((ok+1))
  else
    echo "   XATO: yuklab bo'lmadi -> $url" >&2
    fail=$((fail+1))
  fi
done

echo "----------------------------------------"
echo "Tayyor: $ok ta yuklandi, $fail ta xato. Papka: $OUT"
if [ "$fail" -ne 0 ]; then
  echo "Ba'zi rasmlar yuklanmadi. URL'lar hali tirik ekanini tekshiring." >&2
  exit 1
fi
echo "Keyingi qadam:  git add assets/img && git commit -m \"assets: rasmlarni o'z hostingiga qo'shish\""
