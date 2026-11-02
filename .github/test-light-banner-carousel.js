'use strict';
// Guards the approved three-banner Light-only integration, without Firebase/network.
const fs=require('node:fs'),assert=require('node:assert/strict');
const read=p=>fs.readFileSync(p,'utf8');
const html=read('index.html');
const css=read('light-skyglass-preview/approved-banner-live.css');
const img=read('light-skyglass-preview/approved-banner-images.css');
const js=read('light-skyglass-preview/approved-banner-live.js');
const n=(s,needle)=>s.split(needle).length-1;

assert.equal(n(html,'id="a1-sky-light-carousel"'),1,'One Light-only banner carousel');
assert.equal(n(html,'id="a1-legacy-home-slider"'),1,'Original admin slider remains mounted');
assert.equal(n(html,'id="main-slider"'),1,'Original Firebase slider ID not changed');
assert.ok(html.includes('window.AvtoBanners = AvtoBanners'),'Admin banner service remains');
assert.ok(html.includes('function renderSlider()'),'Existing DB renderer remains');
assert.equal(n(html,'class="sky-slide"'),3,'Three approved slides');
for(const action of ['catalog','promos','contact']) {
  assert.equal(n(html,'data-action="'+action+'"'),1,'One real action button: '+action);
}
for(const f of ['approved-banner-images.css?v=1','approved-banner-live.css?v=1','approved-banner-live.js?v=1']) {
  assert.equal(n(html,f),1,'Asset link exactly once: '+f);
}
const parts=[...img.matchAll(/data:image\/webp;base64,([A-Za-z0-9+/=]+)/g)];
assert.equal(parts.length,3,'Three embedded approved banner images');
for(const [i,m] of parts.entries()){
  const b=Buffer.from(m[1],'base64');
  assert.ok(b.length>10000,'Approved banner image #'+(i+1)+' unexpectedly small');
  assert.equal(b.toString('ascii',0,4),'RIFF','Not WebP RIFF');
  assert.equal(b.toString('ascii',8,12),'WEBP','Not WebP format');
}
assert.match(css,/#a1-legacy-home-slider\{display:none!important\}/,'Legacy slider Light override');
assert.ok(!css.includes('data-theme="dark"'),'Dark stylesheet must not be touched');
assert.ok(css.includes('#a1-sky-light-carousel{display:none}'),'New layer hidden by default');
assert.ok(!css.includes('.slider-container{display:none!important}'),'No global slider hiding');
assert.ok(js.includes('document.getElementById(\'a1-legacy-home-slider\')'),'Observe correct old slider');
assert.ok(js.includes('window.showCatalog')&&js.includes('window._homeToggle')&&js.includes("window.openModal('contactModal')"),'Buttons call existing actions');
assert.ok(js.includes("chip.classList.contains('on')"),'Promo action cannot accidentally deactivate active filter');
const executable=js.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\n]*/g,'');
assert.ok(!/\bfirebase\b|\brtdb\b|\.ref\s*\(|\.set\s*\(|\.update\s*\(/i.test(executable),'Carousel code must not write to backend');
console.log('✅ Three approved Light banners, working CTA hooks and untouched Dark admin slider: PASS');
