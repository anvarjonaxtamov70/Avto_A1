'use strict';
// Edit card CSS in frontend/styles/cards, then run this script with --write.
// The committed index.html remains the compatible runtime and test entrypoint.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname,'..');
const file = path.join(root,'index.html');
const ids = ["bm-cards-2026","card-style-appstore","card-style-admin"];
const original = fs.readFileSync(file,'utf8');
let output = original;
for (const id of ids) {
  const css = fs.readFileSync(path.join(root,'frontend/styles/cards',id+'.css'),'utf8');
  assert.ok(!/<\/style\b/i.test(css),'Unexpected closing style tag: '+id);
  const re = new RegExp('(<style id="'+id+'">)([\\s\\S]*?)(</style>)','g');
  assert.equal([...output.matchAll(re)].length,1,'Expected exactly one block: '+id);
  output = output.replace(re,(_,open,body,close)=>open+css+close);
}
if (process.argv.includes('--write')) fs.writeFileSync(file,output);
else assert.equal(output,original,'Card CSS out of sync; run node .github/sync-card-css.js --write');
console.log('Card CSS synchronized: '+ids.length+' blocks');
