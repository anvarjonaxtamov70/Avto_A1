
  // 🔑 9/9 — Login: telefon jonli format + maydon ostida yumshoq xatolik
  (function loginFlowSoften(){
    // Maydon ostida xatolik ko'rsatish/tozalash
    window._loginSetErr = function(id, msg){
      var el = document.getElementById(id);
      var err = document.getElementById('err-' + id);
      if (el && el.parentNode) el.parentNode.classList.add('has-err');
      if (err) err.textContent = msg || '';
    };
    window._loginClearErr = function(id){
      var el = document.getElementById(id);
      if (el && el.parentNode) el.parentNode.classList.remove('has-err');
    };

    // Telefonni jonli formatlash: +998 90 123 45 67
    // (faqat O'zbekiston formati; +998 prefiks himoyalangan)
    window._loginFormatPhone = function(input){
      window._loginClearErr('login-phone');
      var d = (input.value || '').replace(/[^0-9]/g, '');
      // 998 prefiksini ta'minlaymiz
      if (d.indexOf('998') === 0) d = d.slice(3);
      else if (d.length && '90'.indexOf(d[0]) === -1 && d[0] !== '9' && d[0] !== '8' && d[0] !== '7' && d[0] !== '3') {
        // foydalanuvchi 998siz yozsa ham, raqamlarni operator kodi sifatida olamiz
      }
      d = d.slice(0, 9); // operator(2) + 7 raqam
      var out = '+998';
      if (d.length > 0) out += ' ' + d.slice(0, 2);
      if (d.length > 2) out += ' ' + d.slice(2, 5);
      if (d.length > 5) out += ' ' + d.slice(5, 7);
      if (d.length > 7) out += ' ' + d.slice(7, 9);
      input.value = out;
    };

    // Backspace bilan "+998 " ni o'chirib bo'lmasin (kursor himoyasi)
    window._loginPhoneKey = function(e){
      var input = e.target;
      if ((e.key === 'Backspace' || e.key === 'Delete') &&
          (input.value === '+998' || input.value === '+998 ')) {
        e.preventDefault();
      }
    };

    // Enter bilan kirish (ism yoki telefon maydonida)
    function bindEnter(){
      ['login-name','login-phone'].forEach(function(id){
        var el = document.getElementById(id);
        if (el && !el._enterBound){
          el._enterBound = true;
          el.addEventListener('keydown', function(ev){
            if (ev.key === 'Enter'){ ev.preventDefault(); if (typeof manualLogin === 'function') manualLogin(); }
          });
        }
      });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bindEnter);
    else bindEnter();
  })();
