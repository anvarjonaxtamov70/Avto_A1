
/* ============================================================================
   👥 «MIJOZ» QOIDASI — bitta joyda (Mijozlar oynasi, statistika, tozalash)
   ----------------------------------------------------------------------------
   Do'kon egasining talabi: mijoz = ismi VA telefon raqami bor foydalanuvchi.
   Faqat ilovani ochib ketgan (anonim), botda faqat til tanlagan yoki raqam
   bermagan foydalanuvchilar «Mijozlar» oynasida ko'rinmaydi va «Botni
   tozalash» / «O'chirish» (Worker /admin-reset) ularni bazadan o'chiradi.

   ⚠️ cloudflare-worker.js dagi customerIdentity() bilan AYNAN bir xil:
      • ism  = profile.name, bo'lmasa profile.firstName (Telegram ismi);
               «Nomsiz mijoz», «Mijoz», «Noma'lum» kabi zaxira yorliqlar ism emas;
      • raqam = profile.phone, bo'lmasa tasdiqlangan verify.phone;
               9 xonali -> 998 qo'shiladi, 10-15 xonali — o'zi (phoneDigits).
   Sinov: .github/test-admin-reset.js (ikkala tomon bir xil natija beradi).
   ============================================================================ */
(function () {
    'use strict';
    var PLACEHOLDERS = ['nomsiz mijoz', 'ismsiz mijoz', 'nomsiz', 'ismsiz', 'mijoz', "noma'lum", "yo'q",
        'kiritilmagan', 'null', 'undefined', '-', '\u2014'];
    function text(v) {
        return (typeof v === 'string' || typeof v === 'number') ? String(v).replace(/\s+/g, ' ').trim() : '';
    }
    function realName(v) {
        var s = text(v);
        if (!s) return '';
        var k = s.toLowerCase().replace(/[\u02BB\u02BC\u2018\u2019`\u00B4]/g, "'");
        return PLACEHOLDERS.indexOf(k) === -1 ? s : '';
    }
    function phoneDigits(v) {
        var d = text(v).replace(/[^0-9]/g, '');
        if (d.length === 9) return '998' + d;
        return (d.length >= 10 && d.length <= 15) ? d : '';
    }
    function obj(v) { return (v && typeof v === 'object' && !Array.isArray(v)) ? v : {}; }

    /** users/{uid} yozuvidan: ko'rsatiladigan ism, raqam va «to'liq mijozmi». */
    window._a1CustomerInfo = function (user) {
        var u = obj(user), p = obj(u.profile), v = obj(u.verify);
        var name = realName(p.name) || realName(p.firstName);
        var phone = phoneDigits(p.phone) ? text(p.phone) : (phoneDigits(v.phone) ? text(v.phone) : '');
        return { name: name, phone: phone, complete: !!(name && phone) };
    };
    window._a1IsCompleteCustomer = function (user) { return window._a1CustomerInfo(user).complete; };
})();
