
/* ═══════════════════════════════════════════════════════════════════
   🔙 ANDROID «ORQAGA» TUGMASI (Google Play sifat talabi)
   Native qism (MainActivity) har bosishda window.a1HandleBack() ni so'raydi:
     'handled' — ilova o'zi bajardi (oyna yopildi / orqaga qaytdi);
     'exit'    — bosh sahifada 2 soniya ichida ikkinchi marta bosildi;
     'none'    — bu funksiya yo'q (eski sayt) -> native o'zi hal qiladi.
   Tartib: hujjat → oyna (sheet) → kirish ekrani → modal/storis/qidiruv/bo'lim
   (history.back) → bosh sahifa (ikki marta bosib chiqish).
   ═══════════════════════════════════════════════════════════════════ */
(function () {
    'use strict';
    var W = window, D = document, last = 0;
    W.a1HandleBack = function () {
        try {
            if (W.a1CloseDoc && W.a1CloseDoc()) return 'handled';
            if (W.a1CloseSheet && W.a1CloseSheet()) return 'handled';
            var ls = D.getElementById('login-screen');
            if (ls && !ls.classList.contains('hidden')) {
                var x = D.getElementById('login-close');
                if (x && !x.hidden) { x.click(); return 'handled'; }
            } else {
                var modal = (typeof activeModal !== 'undefined' && activeModal) || D.documentElement.classList.contains('a1sv-lock');
                var depth = (typeof historyStack !== 'undefined' && historyStack && historyStack.length) || 1;
                var search = (typeof searchActive !== 'undefined' && searchActive);
                if (modal || depth > 1 || search) { W.history.back(); return 'handled'; }
            }
            var now = Date.now();
            if (now - last < 2000) return 'exit';
            last = now;
            if (typeof W.showToast === 'function') W.showToast('Chiqish uchun yana bir marta bosing', 'info');
            return 'handled';
        } catch (e) {
            return 'none';
        }
    };
})();
