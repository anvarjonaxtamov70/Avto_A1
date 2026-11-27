'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'bot/source/manifest.json'),'utf8'));
for(const [target,parts] of Object.entries(manifest)){
  const output=Buffer.concat(parts.map(p=>fs.readFileSync(path.join(root,p))));
  const file=path.join(root,target);
  if(process.argv.includes('--write'))fs.writeFileSync(file,output);
  else assert.ok(output.equals(fs.readFileSync(file)),target+' sections out of sync');
  console.log(target+': '+parts.length+' sections synchronized');
}
