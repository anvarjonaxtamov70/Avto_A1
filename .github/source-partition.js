'use strict';
// Lossless inventory and extraction plan. No production files are modified.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
function partition(source) {
  const parts = [];
  const re = /<!--[\s\S]*?-->|<script\b[^>]*>[\s\S]*?<\/script\s*>|<style\b[^>]*>[\s\S]*?<\/style\s*>/gi;
  let cursor = 0, match;
  while ((match = re.exec(source))) {
    if (match.index > cursor) parts.push({kind:'html', text:source.slice(cursor,match.index)});
    const kind = /^<style\b/i.test(match[0]) ? 'css' : /^<script\b/i.test(match[0]) ? 'js' : 'comment';
    parts.push({kind,text:match[0]});
    cursor = re.lastIndex;
  }
  if (cursor < source.length) parts.push({kind:'html',text:source.slice(cursor)});
  return parts;
}
function verify(source) {
  const parts = partition(source);
  assert.equal(parts.map(p=>p.text).join(''),source,'Source round trip must be byte-equivalent');
  return parts.map((p,i)=>({order:i,kind:p.kind,bytes:Buffer.byteLength(p.text),sha256:hash(p.text)}));
}
if (require.main === module) {
  const source = fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
  const manifest = verify(source);
  assert.ok(manifest.some(p=>p.kind==='css'));
  assert.ok(manifest.some(p=>p.kind==='js'));
  const counts = {};
  for (const p of manifest) counts[p.kind]=(counts[p.kind]||0)+1;
  console.log('Lossless source partition:',counts);
  console.log('Source SHA256:',hash(source));
}
module.exports = {partition,verify};
