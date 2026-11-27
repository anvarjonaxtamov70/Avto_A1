
  // 🏠 4/9 — Banner slider nuqta indikatori (sinxron, ikkala mavzu)
  (function homeSliderDots(){
    function init(){
      var slider = document.getElementById('main-slider');
      if(!slider) return;
      var imgs = slider.querySelectorAll('img');
      if(!imgs.length) return;

      var cont = (slider.closest && slider.closest('.slider-container')) || slider.parentNode;
      var bar = document.getElementById('main-slider-dots');
      if(!bar){
        bar = document.createElement('div');
        bar.id = 'main-slider-dots';
        bar.className = 'slider-dots-bar';
        cont.appendChild(bar);
      }
      bar.innerHTML = '';

      var dots = [];
      for(var i=0;i<imgs.length;i++){
        var d = document.createElement('span');
        d.className = 'slider-dot' + (i===0 ? ' active' : '');
        (function(idx){
          d.addEventListener('click', function(){
            var w = slider.clientWidth || 1;
            slider.scrollTo({ left: idx * w, behavior: 'smooth' });
          });
        })(i);
        bar.appendChild(d);
        dots.push(d);
      }

      function update(){
        var w = slider.clientWidth || 1;
        var idx = Math.round(slider.scrollLeft / w);
        for(var i=0;i<dots.length;i++){
          dots[i].classList.toggle('active', i === idx);
        }
      }
      // ADDITIV: mavjud inline onscroll="updatePartnerBadge()" saqlanadi
      slider.addEventListener('scroll', update, { passive: true });
      window.addEventListener('resize', update);
      update();
    }

    window.refreshHomeSliderDots = init;
    if(document.readyState === 'loading'){
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
    // Rasm/maket joylashgach qayta sinxron (nuqtalar aniq chiqsin)
    window.addEventListener('load', init);
  })();
