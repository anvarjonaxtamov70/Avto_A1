// Avto A1 — ilova ikonkalari va splash uchun manba PNG'lar (assets/*.png).
// Harflar shrift emas, vektor yo'l (path) — hech qanday shrift o'rnatish shart emas.
// Natijani @capacitor/assets barcha Android o'lchamlariga aylantiradi.
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

const OUT = path.join(__dirname, '..', 'assets');
fs.mkdirSync(OUT, { recursive: true });

// 1024 kanvasdagi «A1» belgisi (markaz ~512,515)
const MARK = `
  <path fill-rule="evenodd" d="M312 700 L410 330 L474 330 L572 700 L506 700 L488 628 L396 628 L378 700 Z M410 568 L474 568 L442 438 Z"/>
  <path d="M640 700 L640 412 L596 444 L596 380 L656 330 L712 330 L712 700 Z"/>`;
const GOLD = `
  <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#f6dc7e"/><stop offset=".48" stop-color="#d4af37"/><stop offset="1" stop-color="#a07c1c"/>
  </linearGradient>`;
const BG = `
  <radialGradient id="glow" cx=".5" cy=".38" r=".7">
    <stop offset="0" stop-color="#2a2414"/><stop offset=".55" stop-color="#121214"/><stop offset="1" stop-color="#08090b"/>
  </radialGradient>`;
// Belgi ostidagi nozik oltin chiziq (yo'l / tezlik)
const SWOOSH = `<path d="M300 760 Q512 735 724 760" fill="none" stroke="url(#gold)" stroke-width="16" stroke-linecap="round" opacity=".9"/>`;

const svg = (w, h, body, defs) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs>${defs}</defs>${body}</svg>`;

// To'liq ikonka (eski Android, Play Market): fon + belgi
const iconOnly = svg(1024, 1024,
  `<rect width="1024" height="1024" fill="url(#glow)"/><g fill="url(#gold)">${MARK}</g>${SWOOSH}`, GOLD + BG);

// Adaptiv ikonka: oldingi qatlam — belgi 66% xavfsiz hududga sig'ishi uchun kichraytirilgan
const fg = svg(1024, 1024,
  `<g transform="translate(512 528) scale(.74) translate(-512 -545)"><g fill="url(#gold)">${MARK}</g>${SWOOSH}</g>`, GOLD);
const bg = svg(1024, 1024, `<rect width="1024" height="1024" fill="url(#glow)"/>`, BG);

// Splash: qora fon, markazda kichik belgi
const splash = svg(2732, 2732,
  `<rect width="2732" height="2732" fill="#0a0a0b"/>
   <g transform="translate(1366 1366) scale(.62) translate(-512 -545)"><g fill="url(#gold)">${MARK}</g>${SWOOSH}</g>`, GOLD);

(async () => {
  const jobs = [
    ['icon-only.png', iconOnly], ['icon-foreground.png', fg], ['icon-background.png', bg],
    ['splash.png', splash], ['splash-dark.png', splash],
  ];
  for (const [name, s] of jobs) {
    await sharp(Buffer.from(s)).png().toFile(path.join(OUT, name));
    console.log('✓', name);
  }
  // 🌐 Sayt / iPhone «Bosh ekranga qo'shish» ikonkalari -> repo ildizidagi icons/
  const WEB = path.join(__dirname, '..', '..', 'icons');
  fs.mkdirSync(WEB, { recursive: true });
  const maskable = svg(1024, 1024,
    `<rect width="1024" height="1024" fill="url(#glow)"/><g transform="translate(512 528) scale(.78) translate(-512 -545)"><g fill="url(#gold)">${MARK}</g>${SWOOSH}</g>`, GOLD + BG);
  const web = [
    ['apple-touch-icon.png', iconOnly, 180], ['icon-192.png', iconOnly, 192], ['icon-512.png', iconOnly, 512],
    ['icon-maskable-512.png', maskable, 512],
  ];
  for (const [name, s, size] of web) {
    await sharp(Buffer.from(s)).resize(size, size).png({ compressionLevel: 9 }).toFile(path.join(WEB, name));
    console.log('✓ icons/' + name);
  }
})().catch((e) => { console.error(e); process.exit(1); });
