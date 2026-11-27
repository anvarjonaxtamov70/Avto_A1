
  (function scrollPerf(){
    // 📱 Ilovada kerak emas: u yerda cheksiz bezak animatsiyalari va grain umuman
    //    o'chiq (a1-app-perf), body sinfini almashtirish esa har skroll boshida
    //    butun sahifa uslubini qayta hisoblatib, «tutilish» berardi.
    // Skroll boshlanganda body.is-scrolling qo'shamiz, tugagach (140ms jim) olib tashlaymiz.
    var t = null, on = false;
    function start(){ if(!on){ document.body.classList.add('is-scrolling'); on = true; } }
    function end(){ document.body.classList.remove('is-scrolling'); on = false; }
    function onScroll(){
      start();
      if (t) clearTimeout(t);
      t = setTimeout(end, 140);
    }
    // 🔧 FIX (jank/20fps): skroll WINDOW'da emas, ".container" ICHIDA bo'ladi
    //   (html/body { overflow:hidden }). Avval listener faqat window'da edi —
    //   shu sabab body.is-scrolling HECH QACHON qo'shilmasdi va skroll paytida
    //   barcha cheksiz animatsiyalar ishlab turardi -> kadr "yeyilib" qotardi.
    //   Endi haqiqiy skrollerga ulaymiz (window zaxira sifatida qoladi).
    var _sc = document.querySelector('.container');
    if (_sc) _sc.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });
  })();
