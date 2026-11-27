
(function () {
    'use strict';
    // «+» bosilganda — qisqa «✓» (savatga tushdi) holati
    document.addEventListener('click', function (e) {
        var b = e.target.closest && e.target.closest('.luxury-card.ac-card .btn-add-cart.ac-add');
        if (!b || b.disabled || b.classList.contains('is-out')) return;
        var before = 0; try { before = Object.keys(cart).reduce(function (s, k) { return s + (parseInt(cart[k], 10) || 0); }, 0); } catch (err) {}
        setTimeout(function () {
            var after = before; try { after = Object.keys(cart).reduce(function (s, k) { return s + (parseInt(cart[k], 10) || 0); }, 0); } catch (err) {}
            if (after <= before) return;
            b.classList.add('a9-done');
            clearTimeout(b.__a9); b.__a9 = setTimeout(function () { b.classList.remove('a9-done'); }, 1100);
        }, 30);
    }, true);
})();
