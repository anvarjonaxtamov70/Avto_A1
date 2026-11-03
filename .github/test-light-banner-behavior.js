'use strict';
// Runtime regression for actual Light-only banner controller (no network/Firebase).
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const js=fs.readFileSync('light-skyglass-preview/approved-banner-live.js','utf8');
function el(attrs={}){
 const listeners={},classes=new Set();
 return {attrs,listeners,style:{},
   getAttribute(k){return this.attrs[k]??null;},setAttribute(k,v){this.attrs[k]=String(v);},
   addEventListener(name,fn){(listeners[name]??=[]).push(fn);},
   fire(name,e={}){for(const fn of listeners[name]||[])fn(e);},
   classList:{contains(k){return classes.has(k);},add(k){classes.add(k);},
     toggle(k,on){if(on===undefined?!classes.has(k):on)classes.add(k);else classes.delete(k);},
     remove(k){classes.delete(k);}}
 };
}
const slides=Array.from({length:3},()=>el()),dots=Array.from({length:3},()=>el());
const buttons=['catalog','promos','contact'].map(x=>el({'data-action':x}));
const root=el(),legacy=el(),promo=el(),grid=el(),html=el();
let theme='dark',catalogCalls=0,promoCalls=0,contactCalls=0,scrollCalls=0;
root.querySelectorAll=q=>({'.sky-slide':slides,'.sky-dots button':dots,'.sky-hotspot':buttons}[q]||[]);
grid.scrollIntoView=()=>scrollCalls++;
html.getAttribute=q=>q==='data-theme'?theme:null;
const ids={'a1-sky-light-carousel':root,'a1-legacy-home-slider':legacy,'hf-promo':promo,'home-products':grid};
const document={readyState:'complete',documentElement:html,getElementById:q=>ids[q]||null};
const window={showCatalog(){catalogCalls++;},_homeToggle(q){assert.equal(q,'discount');promoCalls++;promo.classList.add('on');},
 openModal(q){assert.equal(q,'contactModal');contactCalls++;}};
const observers=[];
class MutationObserver{constructor(fn){this.fn=fn;observers.push(this);}observe(node,opts){assert.ok(node===legacy||node===html);assert.ok(opts.attributeFilter);}}
vm.runInNewContext(js,{window,document,MutationObserver},{filename:'approved-banner-live.js',timeout:1000});
assert.equal(observers.length,1);
assert.equal(root.getAttribute('tabindex'),'0','Carousel must be keyboard focusable');
assert.equal(root.getAttribute('aria-hidden'),'true','Dark must hide carousel');
assert.equal(slides[0].getAttribute('aria-hidden'),'false');
theme='light';observers[0].fn();
assert.equal(root.classList.contains('is-visible'),true,'Light must show carousel');
dots[1].fire('click');assert.equal(slides[1].getAttribute('aria-hidden'),'false','Dot selects promo');
assert.equal(dots[1].getAttribute('aria-pressed'),'true');
buttons[1].fire('click');assert.equal(promoCalls,1);assert.equal(scrollCalls,1);
buttons[1].fire('click');assert.equal(promoCalls,1,'Promo cannot disable active filter');
root.fire('touchstart',{touches:[{clientX:240}]});
root.fire('touchend',{changedTouches:[{clientX:70}]});
assert.equal(slides[2].getAttribute('aria-hidden'),'false','Swipe advances to contact');
root.fire('keydown',{key:'ArrowRight',preventDefault(){}});
assert.equal(slides[0].getAttribute('aria-hidden'),'false','ArrowRight wraps to first slide');
root.fire('keydown',{key:'ArrowLeft',preventDefault(){}});
assert.equal(slides[2].getAttribute('aria-hidden'),'false','ArrowLeft wraps to third slide');
buttons[0].fire('click');buttons[2].fire('click');
assert.equal(catalogCalls,1);assert.equal(contactCalls,1);
legacy.style.display='none';observers[0].fn();
assert.equal(root.classList.contains('is-visible'),false,'Other sections hide carousel');
legacy.style.display='';observers[0].fn();
assert.equal(root.classList.contains('is-visible'),true,'Home restores carousel');
theme='dark';observers[0].fn();
assert.equal(root.classList.contains('is-visible'),false,'Dark hides Light-only carousel');
console.log('✅ Runtime Light carousel: dots, swipe, keyboard arrows, three CTAs, theme and Home visibility — PASS');
