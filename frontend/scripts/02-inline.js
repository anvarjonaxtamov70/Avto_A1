
      /* 📱 Ilova rejimini ENG BIRINCHI aniqlaymiz (welcome animatsiyasi boshlanishidan oldin):
         a1-native — Android ilova (Capacitor, User-Agent «AvtoA1App»);
         a1-pwa    — iPhone/iPad/Android «Bosh ekranga qo'shilgan» ilova;
         a1-app    — ikkalasi ham (Telegram'siz ilova rejimi). */
      (function () {
        try {
          var r = document.documentElement, ua = navigator.userAgent || '';
          var nat = /\bAvtoA1App\b/.test(ua);
          var pwa = !nat && (window.navigator.standalone === true ||
                    (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches));
          var ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
          if (nat) r.classList.add('a1-native');
          if (pwa) r.classList.add('a1-pwa');
          if (nat || pwa) r.classList.add('a1-app');
          if (ios) r.classList.add('a1-ios');
          window.A1_NATIVE = nat; window.A1_PWA = pwa;
        } catch (e) {}
      })();
    