
/* ═══════════════════════════════════════════════════════════════════
   🧹 BOTNI TOZALASH (admin) — Worker /admin-reset
   • «full» (Boshqaruv markazi → Xavfli hudud): buyurtmalar, keshbek,
     statistika, bildirishnoma va xabarlar o'chadi; tovar, narx, ombor va
     ismi+raqami bor mijozlar (ro'yxatdan o'tgan holida) qoladi. Ismi yoki
     raqami yo'q foydalanuvchilar ham o'chadi.
   • «incomplete» (Mijozlar oynasi): faqat ismi yoki raqami yo'q
     foydalanuvchilar (buyurtmasi borlari qoladi).
   Alohida parol SERVERDA tekshiriladi — bu faylda parol ham, uning xeshi ham yo'q.
   Server mijozlarni sahifalab ishlaydi, shuning uchun `cursor` bilan takrorlaymiz.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
    'use strict';
    var W = window;
    var CONFIRM = 'TOZALASH';
    var running = false;
    var toast = function (m, k) { try { if (typeof W.showToast === 'function') W.showToast(m, k || 'success'); } catch (e) {} };
    var hap = function (k) { try { if (typeof W._hap === 'function') W._hap(k || 'light'); } catch (e) {} };
    var ICON = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 3h6l1 2h4v2H4V5h4l1-2zm-3 6h12l-.8 11.1A2 2 0 0 1 15.2 22H8.8a2 2 0 0 1-2-1.9L6 9zm4 2v8h1.6v-8H10zm2.4 0v8H14v-8h-1.6z"/></svg>';

    var FULL_HTML =
        '<b>O\u2018chadi:</b> barcha buyurtmalar, keshbeklar, statistika, bildirishnomalar va xabarlar ' +
        '(buyurtma chatlari, AI suhbatlari, storis javoblari), sharhlar, hamda ismi yoki raqami yo\u2018q foydalanuvchilar.<br><br>' +
        '<b>Qoladi:</b> tovarlar, narxlar va ombor qoldig\u2018i, katalog, bannerlar, storislar; ismi va raqami bor mijozlar \u2014 ' +
        'ro\u2018yxatdan o\u2018tgan holida.<br><br><b>Bu amalni qaytarib bo\u2018lmaydi.</b>';

    function incompleteHtml(n) {
        return (n ? '<b>' + n + ' ta</b> foydalanuvchining' : 'Bu foydalanuvchilarning') +
            ' ismi yoki telefon raqami yo\u2018q. Ular savati, storis ko\u2018rishlari va boshqa ma\u2019lumotlari bilan butunlay o\u2018chiriladi. ' +
            'Buyurtmasi bor foydalanuvchi o\u2018chirilmaydi.<br><br><b>Bu amalni qaytarib bo\u2018lmaydi.</b>';
    }

    function errorText(code, d, scanned) {
        d = d || {};
        if (code === 403 && d.wrongPassword) {
            return 'Parol noto\u2018g\u2018ri' + (typeof d.attemptsLeft === 'number' ? ' \u2014 yana ' + d.attemptsLeft + ' ta urinish qoldi' : '');
        }
        if (code === 403) return 'Bu amal faqat admin uchun';
        if (code === 429) {
            return 'Juda ko\u2018p noto\u2018g\u2018ri urinish \u2014 ' + Math.max(1, Math.ceil((Number(d.retryAfter) || 900) / 60)) +
                ' daqiqadan keyin qayta urinib ko\u2018ring';
        }
        if (code === 404) return 'Server hali yangilanmagan \u2014 Cloudflare Worker\u2019ni yangilang';
        if (code === 401) return 'Xavfsiz ulanish yo\u2018q \u2014 ilovani qayta oching';
        return (scanned ? 'Tozalash yarim yo\u2018lda to\u2018xtadi. ' : '') +
            'Internetni tekshirib, qayta bosing \u2014 bu xavfsiz, ish davom ettiriladi.';
    }

    function doneText(full, sum) {
        if (full) {
            return '\u2705 Bot tozalandi: ' + sum.cleaned + ' ta mijoz yangidek' +
                (sum.deleted ? ', ' + sum.deleted + ' ta ismi yoki raqami yo\u2018q foydalanuvchi o\u2018chirildi' : '');
        }
        return (sum.deleted ? '\uD83E\uDDF9 ' + sum.deleted + ' ta foydalanuvchi o\u2018chirildi' : 'O\u2018chiriladigan foydalanuvchi qolmadi') +
            (sum.keptWithOrders ? ' \u00b7 ' + sum.keptWithOrders + ' tasida buyurtma bor \u2014 qoldirildi' : '');
    }

    /** Server sahifalab ishlaydi: `done` bo'lguncha `cursor` bilan takrorlaymiz. */
    async function run(mode, password, api) {
        var cursor = '', total = 0;
        var sum = { scanned: 0, deleted: 0, cleaned: 0, keptWithOrders: 0 };
        for (var step = 0; step < 5000; step++) {
            var r = null;
            try {
                r = await W._workerPost('/admin-reset', { mode: mode, password: password, confirm: CONFIRM, cursor: cursor });
            } catch (e) { r = null; }
            var code = r && r.resp ? r.resp.status : 0, d = (r && r.data) || {};
            if (code !== 200 || !d.ok) return { ok: false, code: code, data: d, sum: sum };
            if (typeof d.total === 'number') total = d.total;
            var pg = d.page || {};
            sum.scanned += pg.scanned || 0;
            sum.deleted += pg.deleted || 0;
            sum.cleaned += pg.cleaned || 0;
            sum.keptWithOrders += pg.keptWithOrders || 0;
            if (d.done) return { ok: true, sum: sum };
            if (!d.cursor || d.cursor === cursor) return { ok: false, code: 0, data: d, sum: sum };
            cursor = d.cursor;
            api.busy(true, 'Tozalanmoqda\u2026 ' + (total ? Math.min(sum.scanned, total) + ' / ' + total : sum.scanned));
        }
        return { ok: false, code: 0, data: {}, sum: sum };
    }

    /** mode: 'full' — botni tozalash; 'incomplete' — ismi yoki raqami yo'qlarni o'chirish. */
    function open(mode, opts) {
        opts = opts || {};
        var full = mode !== 'incomplete';
        if (!(typeof W.isAdmin === 'function' && W.isAdmin())) { toast('Bu amal faqat admin uchun', 'warning'); return; }
        if (typeof W.a1Sheet !== 'function' || typeof W._workerPost !== 'function') { toast('Ilovani yangilang', 'warning'); return; }
        if (running) { toast('Tozalash davom etmoqda\u2026', 'info'); return; }
        var confirmed = false;
        hap('light');
        W.a1Sheet({
            icon: ICON, color: '#ff453a', danger: true,
            title: full ? 'Botni tozalash' : 'Ismi yoki raqami yo\u2018q foydalanuvchilar',
            html: full ? FULL_HTML : incompleteHtml(opts.count),
            input: { type: 'password', placeholder: 'Tozalash paroli', autocomplete: 'off' },
            primary: full ? 'Tozalash' : 'O\u2018chirish', secondary: 'Bekor qilish',
            onPrimary: async function (api) {
                if (running) return;
                var password = api.value();
                if (!password) { api.error('Parolni kiriting'); return; }
                if (!confirmed) {   // ikki bosqichli tasdiq — tasodifiy bosilmasin
                    confirmed = true;
                    api.error('');
                    api.label(full ? 'Ha, hammasini o\u2018chirish' : 'Ha, o\u2018chirish');
                    hap('warning');
                    return;
                }
                running = true;
                api.error('');
                api.lock(true);
                api.busy(true, 'Tozalanmoqda\u2026');
                var res;
                try { res = await run(full ? 'full' : 'incomplete', password, api); }
                finally { running = false; api.lock(false); }
                if (res.ok) {
                    api.close(true);
                    try { if (W._invalidateUsersCache) W._invalidateUsersCache(); } catch (e) {}
                    hap('success');
                    toast(doneText(full, res.sum), 'success');
                    try { if (typeof opts.onDone === 'function') opts.onDone(res); } catch (e) {}
                    return;
                }
                api.busy(false);
                api.error(errorText(res.code, res.data, res.sum.scanned));
                hap('error');
            }
        });
    }

    W.A1Reset = { open: open };
})();
