
// ============================================================
// 💎 PREMIUM REDESIGN v2 — JS YORDAMCHILARI (passiv qo'shimcha)
// Mavjud onclick'larga TEGMAYDI — faqat capture phase'da kuzatadi.
// (Eski blur-up tizimi olib tashlandi — arzon ko'rinardi va botni
//  qotirardi. Endi rasmlar darhol o'z holicha ko'rinadi.)
// ============================================================

// ✨ SAVATGA QO'SHILGANDA TUGMA "PULSE" (mikro-animatsiya)
document.addEventListener('click', function (e) {
    var btn = e.target.closest && e.target.closest('.btn-add-cart');
    if (!btn || btn.disabled) return;
    btn.classList.remove('just-added');
    void btn.offsetWidth; // reflow majburlash — animatsiya qayta boshlanadi
    btn.classList.add('just-added');
    setTimeout(function () { btn.classList.remove('just-added'); }, 450);
}, true);
