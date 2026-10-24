/* =====================================================================
 *  build-site.js — DEPLOY PAYTIDA index.html ni IXCHAMLASHTIRISH
 *
 *  Repodagi asl index.html O'ZGARMAYDI (izohlar, formatlash joyida).
 *  Faqat GitHub Pages'ga chiqadigan nusxa (_site/index.html) qayta ishlanadi:
 *
 *    1) Har bir ichki <script> ALOHIDA terser bilan ixchamlanadi
 *       (bloklar birlashtirilmaydi: 'use strict' va xatolar chegarasi saqlanadi;
 *       top-level nomlar o'zgarmaydi — onclick="..." va skriptlararo
 *       global o'zgaruvchilar ishlashda davom etadi).
 *    2) Katta skriptlar (> 20 KB) assets/js/<n>-<nom>.<hash>.js fayliga
 *       chiqariladi va AYNAN O'SHA JOYDA <script src> bilan ulanadi —
 *       bajarilish tartibi o'zgarmaydi. Afzalligi: brauzer tashqi faylning
 *       kompilyatsiya qilingan kodini xotirada saqlaydi (V8 code cache) va
 *       HTML o'zgarganda JS qayta yuklanmaydi (Service Worker keshlaydi).
 *    3) <style> bloklaridan izohlar va ortiqcha bo'sh joylar olinadi
 *       (qoidalar, tartib va qiymatlar O'ZGARMAYDI).
 *    4) HTML izohlari (<!-- ... -->) olinadi.
 *
 *  Biror skriptni ixchamlab bo'lmasa — u ASL holicha qoldiriladi (deploy to'xtamaydi).
 *
 *  ISHLATISH:  node .github/build-site.js _site
 *  O'CHIRISH:  GitHub -> Settings -> Variables -> A1_SKIP_BUILD = 1
 * ===================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SITE = path.resolve(process.argv[2] || '_site');
const FILE = path.join(SITE, 'index.html');
const EXTERNAL_MIN = 20 * 1024;      // shundan katta skriptlar alohida faylga
const ASSET_DIR = 'assets/js';

let terser;
try { terser = require('terser'); } catch (e) {
  console.error('❌ terser topilmadi: npm install --no-save terser@5'); process.exit(1);
}

const TERSER_OPTS = {
  ecma: 5,                 // yangi sintaksis QO'SHILMAYDI (eski WebView'lar uchun)
  safari10: true,
  toplevel: false,         // global nomlar (onclick, skriptlararo) o'zgarmaydi
  keep_fnames: true,
  keep_classnames: true,
  compress: { passes: 1, keep_fargs: true, drop_console: false, unsafe: false },
  mangle: true,
  format: { comments: false, ascii_only: false },
};

/** CSS: izoh va bo'sh joylarni olish. Satrlar ("..." / '...') ichiga tegilmaydi. */
function minifyCss(css) {
  let out = '', i = 0, n = css.length, ws = false;
  while (i < n) {
    const ch = css[i];
    if (ch === '/' && css[i + 1] === '*') {               // izoh
      const j = css.indexOf('*/', i + 2);
      i = j < 0 ? n : j + 2; ws = true; continue;
    }
    if (ch === '"' || ch === "'") {                         // satr — o'zgarishsiz
      let j = i + 1;
      while (j < n && css[j] !== ch) { if (css[j] === '\\') j++; j++; }
      if (ws && out && !/[{};,]$/.test(out)) out += ' ';
      ws = false; out += css.slice(i, j + 1); i = j + 1; continue;
    }
    if (/\s/.test(ch)) { ws = true; i++; continue; }
    if (/[{};,]/.test(ch)) {                                // bular atrofidagi bo'sh joy keraksiz
      out = out.replace(/ $/, '');
      if (ch === '}') out = out.replace(/;$/, '');
      out += ch; ws = false; i++; continue;
    }
    if (ws && out && !/[{};,]$/.test(out)) out += ' ';
    ws = false; out += ch; i++;
  }
  return out.trim();
}

function slug(attrs, idx) {
  const m = /\bid="([^"]+)"/.exec(attrs);
  return (m ? m[1] : 'script').replace(/[^a-z0-9-]/gi, '').slice(0, 40) || 'script';
}

async function main() {
  if (!fs.existsSync(FILE)) { console.error('❌ ' + FILE + ' topilmadi'); process.exit(1); }
  const src = fs.readFileSync(FILE, 'utf8');
  fs.mkdirSync(path.join(SITE, ASSET_DIR), { recursive: true });

  let out = '', pos = 0, sIdx = 0;
  const st = { jsIn: 0, jsOut: 0, cssIn: 0, cssOut: 0, ext: 0, extBytes: 0, failed: [], comments: 0 };
  const re = /<!--[\s\S]*?-->|<script\b([^>]*)>([\s\S]*?)<\/script>|<style\b([^>]*)>([\s\S]*?)<\/style>/gi;
  let m;
  while ((m = re.exec(src))) {
    out += src.slice(pos, m.index);
    pos = re.lastIndex;
    const whole = m[0];

    if (whole.startsWith('<!--')) { st.comments += whole.length; continue; }

    if (m[3] !== undefined) {                                 // <style>
      st.cssIn += m[4].length;
      const css = minifyCss(m[4]);
      st.cssOut += css.length;
      out += '<style' + m[3] + '>' + css + '</style>';
      continue;
    }

    const attrs = m[1] || '', body = m[2] || '';
    if (/\bsrc\s*=/.test(attrs) || /\btype\s*=\s*"(?!text\/javascript)/i.test(attrs) || !body.trim()) {
      out += whole; continue;                                 // tashqi / JSON / bo'sh
    }
    sIdx++;
    st.jsIn += body.length;
    let code = body;
    try {
      const r = await terser.minify(body, TERSER_OPTS);
      if (!r || typeof r.code !== 'string') throw new Error('bo\'sh natija');
      code = r.code;
    } catch (e) {
      st.failed.push(slug(attrs) + ' #' + sIdx + ': ' + (e && e.message));
      code = body;                                            // asl holicha qoladi
    }
    st.jsOut += code.length;
    if (code.length > EXTERNAL_MIN) {
      const hash = crypto.createHash('sha256').update(code).digest('hex').slice(0, 10);
      const name = ASSET_DIR + '/' + String(sIdx).padStart(2, '0') + '-' + slug(attrs) + '.' + hash + '.js';
      fs.writeFileSync(path.join(SITE, name), code);
      st.ext++; st.extBytes += code.length;
      out += '<script' + attrs + ' src="' + name + '"></script>';
    } else {
      out += '<script' + attrs + '>' + code.replace(/<\/script/gi, '<\\/script') + '</script>';
    }
  }
  out += src.slice(pos);
  fs.writeFileSync(FILE, out);

  const kb = (n) => (n / 1024).toFixed(0) + ' KB';
  console.log('✅ build-site: index.html ' + kb(src.length) + ' -> ' + kb(out.length) +
    ' (+ ' + st.ext + ' ta JS fayl, ' + kb(st.extBytes) + ')');
  console.log('   JS  ' + kb(st.jsIn) + ' -> ' + kb(st.jsOut) + ' · CSS ' + kb(st.cssIn) + ' -> ' + kb(st.cssOut) +
    ' · HTML izohlar -' + kb(st.comments));
  if (st.failed.length) {
    console.log('⚠ Ixchamlanmagan (asl holicha qoldi):');
    st.failed.forEach((f) => console.log('   - ' + f));
  }
}

main().catch((e) => { console.error('❌ build-site xato:', e); process.exit(1); });
