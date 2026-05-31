/* =============================================================
   IVY — Jewelry & Cosmetics — PR avtomatik tekshiruvi
   1) index.html ichidagi barcha inline <script> bloklari sintaksisi
   2) Hech qaysi faylda ochiq (literal) Telegram bot tokeni yo'qligi
   Xato topilsa exit(1) — GitHub'da PR'ga qizil x chiqadi.
   ============================================================= */
const fs = require('fs');
const cp = require('child_process');
const os = require('os');
const path = require('path');

let failed = false;
const fail = (m) => { console.error('FAIL: ' + m); failed = true; };
const ok = (m) => { console.log('OK: ' + m); };

// ---------- 1) HTML ichidagi inline JS sintaksisi ----------
try {
  const html = fs.readFileSync('index.html', 'utf8');
  const re = /<script(\s[^>]*)?>([\s\S]*?)<\/script>/gi;
  let m, count = 0, syntaxOk = true;
  while ((m = re.exec(html)) !== null) {
    if (/\bsrc\s*=/.test(m[1] || '')) continue; // tashqi skriptlarni o'tkazib yuboramiz
    const code = m[2];
    const startLine = html.slice(0, m.index).split('\n').length;
    const tmp = path.join(os.tmpdir(), `ivy_block_${count}.js`);
    fs.writeFileSync(tmp, code);
    try {
      cp.execSync(`node --check "${tmp}"`, { stdio: 'pipe' });
    } catch (e) {
      syntaxOk = false;
      fail(`JS sintaksis xatosi (index.html, ~${startLine}-qator atrofida):\n${e.stderr.toString()}`);
    }
    count++;
  }
  if (syntaxOk) ok(`index.html: ${count} ta inline <script> bloki sintaktik toza`);
} catch (e) {
  fail('index.html o\'qilmadi: ' + e.message);
}

// ---------- 2) Ochiq token (maxfiy kalit) qidirish ----------
// Telegram bot token shakli: <8-10 raqam>:<>=30 ta belgi>
const tokenRe = /\b\d{8,10}:[A-Za-z0-9_-]{30,}\b/;

// Repo ildizidagi text fayllarni yig'amiz (.git va .github dan tashqari)
function collectFiles(dir, acc) {
  for (const name of fs.readdirSync(dir)) {
    if (name === '.git' || name === '.github' || name === 'node_modules') continue;
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) collectFiles(full, acc);
    else if (/\.(html|js)$/i.test(name) || !name.includes('.')) acc.push(full);
  }
  return acc;
}

let leakFound = false;
for (const f of collectFiles('.', [])) {
  let txt;
  try { txt = fs.readFileSync(f, 'utf8'); } catch { continue; }
  txt.split('\n').forEach((line, idx) => {
    if (tokenRe.test(line)) {
      leakFound = true;
      fail(`Ochiq Telegram token topildi: ${f}:${idx + 1}`);
    }
  });
}
if (!leakFound) ok('Hech qaysi faylda ochiq Telegram token topilmadi');

// ---------- Yakun ----------
if (failed) {
  console.error('\nTekshiruv MUVAFFAQIYATSIZ — yuqoridagi xatolarni tuzating.');
  process.exit(1);
}
console.log('\nBarcha tekshiruvlar muvaffaqiyatli o\'tdi!');
