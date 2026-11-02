/* Avto A1 Sky Glass: view-only light mode carousel.
   Does not replace the Firebase banner store or product/cart/theme logic. */
(function () {
  'use strict';
  function initSkyGlass() {
    var original = document.querySelector('.slider-container');
    if (!original || document.getElementById('a1-sg-carousel')) return;
    var root = document.documentElement;
    var home = document.getElementById('main-menu');
    var content = document.getElementById('content-area');
    if (!home || !content) return;

    var data = [
      { src: 'assets/skyglass/approved-gazel.webp', name:'Gazel uchun ehtiyot qismlar', action:'Katalogni ochish' },
      { src: 'assets/skyglass/approved-aksiyalar.webp', name:'Avto A1 aksiyalari', action:'Aksiyadagi tovarlarni ko‘rish' },
      { src: 'assets/skyglass/approved-aloqa.webp', name:'Avto A1 bilan aloqa', action:'Aloqa oynasini ochish' }
    ];
    var wrap = document.createElement('section');
    wrap.id = 'a1-sg-carousel';
    wrap.hidden = true;
    wrap.setAttribute('aria-label', 'Avto A1 takliflari');
    var track = document.createElement('div');
    track.className = 'a1-sg-track';
    track.setAttribute('aria-roledescription', 'karusel');
    track.setAttribute('aria-label', 'Uchta reklama banneri');
    var dots = document.createElement('div');
    dots.className = 'a1-sg-dots';
    dots.setAttribute('aria-label', 'Banner tanlash');

    function takeAction(i) {
      try {
        if (i === 0 && typeof window.showCatalog === 'function') {
          window.showCatalog();
        } else if (i === 1) {
          if (typeof window.goHome === 'function') window.goHome();
          var chip = document.getElementById('hf-promo');
          if (chip && !chip.classList.contains('on') && typeof window._homeToggle === 'function') {
            window._homeToggle('discount');
          }
          if (content && content.scrollIntoView) content.scrollIntoView({behavior:'smooth',block:'start'});
        } else if (i === 2 && typeof window.openModal === 'function') {
          window.openModal('contactModal');
        }
      } catch (err) { if (window.console) console.warn('Sky Glass banner action:', err); }
    }
    var slides = [];
    var dotButtons = [];
    data.forEach(function (item, i) {
      var slide = document.createElement('div');
      slide.className = 'a1-sg-slide';
      var img = document.createElement('img');
      img.src = item.src;
      img.alt = item.name;
      img.loading = i === 0 ? 'eager' : 'lazy';
      img.decoding = 'async';
      img.addEventListener('error', function () {
        root.classList.add('a1-sg-assets-failed');
        wrap.hidden = true;
      }, {once:true});
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'a1-sg-hit';
      button.setAttribute('aria-label', item.action);
      button.addEventListener('click', function () { takeAction(i); });
      slide.appendChild(img); slide.appendChild(button);
      track.appendChild(slide); slides.push(slide);

      var dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'a1-sg-dot';
      dot.setAttribute('aria-label', String(i + 1) + '-banner');
      dot.setAttribute('aria-current', i === 0 ? 'true' : 'false');
      dot.addEventListener('click', function () {
        track.scrollTo({left: i * track.clientWidth, behavior: 'smooth'});
      });
      dots.appendChild(dot); dotButtons.push(dot);
    });
    wrap.appendChild(track); wrap.appendChild(dots);
    original.insertAdjacentElement('afterend', wrap);

    function sync() {
      var show = root.getAttribute('data-theme') === 'light' &&
        !root.classList.contains('a1-sg-assets-failed') &&
        !home.classList.contains('hidden') &&
        !content.classList.contains('hidden') &&
        original.style.display !== 'none';
      wrap.hidden = !show;
    }
    function updateDots() {
      var idx = Math.max(0, Math.min(2, Math.round(track.scrollLeft / Math.max(1, track.clientWidth))));
      dotButtons.forEach(function (d, i) { d.setAttribute('aria-current', i === idx ? 'true' : 'false'); });
    }
    track.addEventListener('scroll', updateDots, {passive:true});
    var watch = new MutationObserver(sync);
    watch.observe(root, {attributes:true, attributeFilter:['data-theme','class']});
    watch.observe(original, {attributes:true, attributeFilter:['style']});
    watch.observe(home, {attributes:true, attributeFilter:['class']});
    watch.observe(content, {attributes:true, attributeFilter:['class']});
    window.addEventListener('resize', updateDots, {passive:true});
    sync();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSkyGlass, {once:true});
  } else { initSkyGlass(); }
})();