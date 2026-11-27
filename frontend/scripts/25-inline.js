
(function cashbackAtPayment() {
    'use strict';

    var S = { on: false, applied: 0 };
    var $ = function (id) { return document.getElementById(id); };
    var fmt = function (n) { return (parseInt(n, 10) || 0).toLocaleString('ru-RU').replace(/,/g, ' '); };

    function balance() {
        try {
            if (window.Phase2 && window.Phase2.balance) return window.Phase2.balance();
            if (window.Phase2 && window.Phase2.state) return parseInt(window.Phase2.state.cashback, 10) || 0;
        } catch (e) {}
        return 0;
    }
    function grossTotal() {
        try {
            if (window._recalcCartTotal) return window._recalcCartTotal();
            return parseInt(window._cartTotal, 10) || 0;
        } catch (e) { return 0; }
    }

    /** Ishlatiladigan cashback — balans va buyurtma summasidan oshmaydi. */
    window._cbGetApplied = function (total) {
        if (!S.on) return 0;
        total = parseInt(total, 10);
        if (!total || total < 0) total = grossTotal();
        var use = Math.min(balance(), total);
        S.applied = use > 0 ? use : 0;
        return S.applied;
    };
    window._cbResetApplied = function () { S.on = false; S.applied = 0; };
    // 🧾 Rasmiylashtirish sahifasi uchun: holatni o'qish/o'rnatish va balans
    window._cbIsOn = function () { return !!S.on; };
    window._cbSetOn = function (v) { S.on = !!v; if (!S.on) S.applied = 0; try { repaintAmounts(); } catch (e) {} };
    window._cbBalance = function () { return balance(); };

    /** Barcha summa ko'rsatkichlarini bir vaqtda yangilaymiz. */
    function repaintAmounts() {
        var gross = grossTotal();
        var use = window._cbGetApplied(gross);
        var payable = Math.max(0, gross - use);

        var main = $('pay-amount-display');
        if (main) main.textContent = fmt(payable) + " so'm";
        var c = $('card-pay-amount');
        if (c) c.textContent = fmt(payable) + " so'm";
        var a = $('app-pay-amount');
        if (a) a.textContent = fmt(payable) + " so'm";

        var box = $('cbp-box');
        if (!box) return;
        box.classList.toggle('on', S.on && use > 0);
        var sum = $('cbp-sum');
        if (sum) {
            sum.style.display = use > 0 ? 'flex' : 'none';
            // `&nbsp;` OLIB TASHLANDI — u matnni bo'linishga qo'ymay, tor
            // ekranda summani siqib qo'yardi.
            sum.innerHTML = '<span>Tovarlar: ' + fmt(gross) + " so'm · Cashback: \u2212" + fmt(use) + '</span>' +
                '<b>' + fmt(payable) + " so'm</b>";
        }
        paintEarn(payable);
    }
    window._cbRepaint = repaintAmounts;

    /** 🎁 «Bu xariddan sizga qancha qaytadi» — mijoz to'lashdan OLDIN ko'radi.
     *
     *  Hisob AYNAN Phase2 bilan bir xil: cashback `payable` (haqiqatda
     *  to'lanadigan summa) dan hisoblanadi — ya'ni cashback ustiga
     *  cashback berilmaydi. Shu sababli bu yerda ko'rsatilgan summa
     *  yetkazilgandan keyin hisobga tushadigan summaga teng. */
    function earnRate() {
        try { if (window._cashbackRate) return window._cashbackRate(); } catch (e) {}
        return 0.008;
    }
    function isVipNow() {
        try { return !!(window.VIP && window.VIP.state && window.VIP.state.isVip); } catch (e) { return false; }
    }
    function paintEarn(payable) {
        var el = $('cbp-earn');
        if (!el) return;
        var rate = earnRate();
        var som = Math.round((parseInt(payable, 10) || 0) * rate);
        var pct = String(+(rate * 100).toFixed(2));
        if (som <= 0) { el.style.display = 'none'; return; }
        el.style.display = 'flex';
        el.innerHTML =
            '<span class="cbe-ic">\uD83C\uDF81</span>' +
            '<span class="cbe-tx">Bu xariddan sizga <b>' + fmt(som) + " so'm</b> cashback qaytadi " +
                '<span style="opacity:.75;">(' + pct + '%)</span></span>' +
            (isVipNow() ? '<span class="cbe-vip">VIP</span>' : '');
    }

    /** To'lov oynasiga cashback blokini joylaymiz (bir marta yasab, keyin yangilaymiz). */
    function renderBox() {
        var anchor = $('pay-total-display');
        if (!anchor || !anchor.parentNode) return;
        var bal = balance();
        var gross = grossTotal();

        var box = $('cbp-box');
        if (!box) {
            box = document.createElement('div');
            box.id = 'cbp-box';
            box.className = 'cbp-box';
            anchor.parentNode.insertBefore(box, anchor.nextSibling);
        }

        if (bal <= 0) {
            // Balans bo'sh — blokni ko'rsatamiz, lekin o'chirilgan holatda (mijoz tizimni bilsin)
            S.on = false; S.applied = 0;
            box.className = 'cbp-box is-empty';
            box.innerHTML =
                '<div class="cbp-row">' +
                    '<span class="cbp-ic">\uD83C\uDF81</span>' +
                    '<span class="cbp-tx"><b>Cashback: 0 so\'m</b>' +
                    '<span>Buyurtma qo\'lingizga yetkazilgach cashback yig\'iladi va keyingi to\'lovda ishlatiladi.</span></span>' +
                '</div>' +
                // Balans nol bo'lsa ham «qancha qaytadi» KO'RINADI — mijoz
                // tizimning foydasini aynan shu paytda tushunishi kerak.
                '<div class="cbp-earn" id="cbp-earn"></div>';
            repaintAmounts();
            return;
        }

        var usable = Math.min(bal, gross);
        box.className = 'cbp-box' + (S.on ? ' on' : '');
        box.innerHTML =
            '<div class="cbp-row" id="cbp-toggle" role="button" tabindex="0">' +
                '<span class="cbp-ic">\uD83C\uDF81</span>' +
                '<span class="cbp-tx"><b>Cashback ishlatish</b>' +
                '<span>Balansingiz: ' + fmt(bal) + " so'm" +
                    (usable < bal ? ' · bu buyurtmaga ' + fmt(usable) + " so'm" : '') + '</span></span>' +
                '<span class="cbp-sw"><i></i></span>' +
            '</div>' +
            '<div class="cbp-sum" id="cbp-sum" style="display:none;"></div>' +
            '<div class="cbp-earn" id="cbp-earn"></div>';

        var t = $('cbp-toggle');
        if (t) t.onclick = function () {
            S.on = !S.on;
            try { if (window._hap) window._hap('selection'); } catch (e) {}
            repaintAmounts();
            box.classList.toggle('on', S.on);
        };
        repaintAmounts();
    }

    /** To'lov oynasi ochilganda blokni chizamiz. */
    function wrapOpen() {
        if (typeof window.openPaymentModal !== 'function' || window._cbWrappedOpen) return;
        window._cbWrappedOpen = true;
        var orig = window.openPaymentModal;
        window.openPaymentModal = function () {
            var r = orig.apply(this, arguments);
            try { setTimeout(renderBox, 20); } catch (e) {}
            return r;
        };
    }
    wrapOpen();
    setTimeout(wrapOpen, 1000);
    setTimeout(wrapOpen, 3000);

    // Savat o'zgarsa — summa qayta hisoblanadi (oyna ochiq bo'lsa)
    document.addEventListener('click', function () {
        if (!$('cbp-box')) return;
        var pm = $('paymentModal');
        if (pm && pm.style.display === 'flex') setTimeout(repaintAmounts, 60);
    }, true);
})();
