'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const parts=JSON.parse(fs.readFileSync(path.join(root,'frontend/scripts/main/manifest.json'),'utf8'));
const output=parts.map(p=>fs.readFileSync(path.join(root,p),'utf8')).join('');
const target=path.join(root,'frontend/scripts/13-inline.js');
if(process.argv.includes('--write'))fs.writeFileSync(target,output);
else assert.equal(output,fs.readFileSync(target,'utf8'),'Main script sections out of sync');
console.log('Main script sections synchronized: '+parts.length);
