/* Sky Glass banners: Light-only UI. Existing Firebase banner admin remains intact. */
(function(){
'use strict';
function start(){
  const root=document.getElementById('a1-sky-light-carousel');
  const legacy=document.getElementById('a1-legacy-home-slider');
  if(!root||!legacy)return;
  const slides=Array.from(root.querySelectorAll('.sky-slide'));
  const dots=Array.from(root.querySelectorAll('.sky-dots button'));
  if(slides.length!==3||dots.length!==3)return;
  let current=0,down=null;
  function select(i){
    current=(i+3)%3;
    slides.forEach((el,n)=>el.setAttribute('aria-hidden',String(n!==current)));
    dots.forEach((el,n)=>el.setAttribute('aria-pressed',String(n===current)));
  }
  function sync(){
    const visible=document.documentElement.getAttribute('data-theme')==='light'&&legacy.style.display!=='none';
    root.classList.toggle('is-visible',visible);
    root.setAttribute('aria-hidden',String(!visible));
  }
  dots.forEach((el,n)=>el.addEventListener('click',()=>select(n)));
  root.querySelectorAll('.sky-hotspot').forEach(el=>el.addEventListener('click',()=>{
    const action=el.getAttribute('data-action');
    if(action==='catalog'&&typeof window.showCatalog==='function')window.showCatalog();
    if(action==='promos'){
      const chip=document.getElementById('hf-promo');
      if(chip&&!chip.classList.contains('on')&&typeof window._homeToggle==='function')window._homeToggle('discount');
      const grid=document.getElementById('home-products');
      if(grid)grid.scrollIntoView({block:'start',behavior:'smooth'});
    }
    if(action==='contact'&&typeof window.openModal==='function')window.openModal('contactModal');
  }));
  root.addEventListener('touchstart',e=>{down=e.touches.length===1?e.touches[0].clientX:null},{passive:true});
  root.addEventListener('touchend',e=>{
    if(down===null||e.changedTouches.length!==1)return;
    const dx=e.changedTouches[0].clientX-down;down=null;
    if(Math.abs(dx)>48)select(current+(dx<0?1:-1));
  },{passive:true});
  const ob=new MutationObserver(sync);
  ob.observe(legacy,{attributes:true,attributeFilter:['style']});
  ob.observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
  select(0);sync();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
