'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),file=path.join(root,'index.html');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'frontend/styles/manifest.json'),'utf8'));
const source=fs.readFileSync(file,'utf8');
let index=0;
const output=source.replace(/<!--[\s\S]*?-->|<script\b[^>]*>[\s\S]*?<\/script\s*>|<style\b([^>]*)>([\s\S]*?)<\/style>/gi,(whole,attrs,body)=>{
  if(attrs===undefined)return whole;
  const entry=manifest[index++];
  assert.ok(entry,'Unexpected CSS block');
  assert.equal(attrs,entry.attrs,'CSS block order or attributes changed');
  const css=fs.readFileSync(path.join(root,entry.file),'utf8');
  assert.ok(!/<\/style\b/i.test(css),'Unexpected closing style tag');
  return '<style'+attrs+'>'+css+'</style>';
});
assert.equal(index,manifest.length,'CSS block count changed');
if(process.argv.includes('--write'))fs.writeFileSync(file,output);
else assert.equal(output,source,'CSS sources out of sync; run node .github/sync-all-css.js --write');
console.log('CSS sources synchronized: '+index);
