
(function aiBulkUX() {
    'use strict';
    var $ = function (id) { return document.getElementById(id); };
    var fmt = function (n) { return (Math.round(n) || 0).toLocaleString('ru-RU').replace(/,/g, ' '); };

    /* ---------------- Jonli narx ko'rinishi + qator hisobi ---------------- */
    function updatePreview() {
        var rate = parseFloat(($('ai-bulk-usd-rate') || {}).value);
        var mark = parseFloat(($('ai-bulk-markup') || {}).value);
        var box = $('aib-preview');
        var rEl = $('ai-bulk-usd-rate'), mEl = $('ai-bulk-markup');
        var rBad = !isFinite(rate) || rate < 100 || rate > 1000000;
        var mBad = !isFinite(mark) || mark < -90 || mark > 1000;
        if (rEl) rEl.classList.toggle('is-bad', rBad);
        if (mEl) mEl.classList.toggle('is-bad', mBad);
        if (!box) return;
        if (rBad || mBad) {
            box.style.background = 'rgba(255,69,58,.09)';
            box.style.borderColor = 'rgba(255,69,58,.25)';
            box.innerHTML = rBad ? "USD kursi 100 – 1 000 000 orasida bo'lsin"
                                 : "Ustama -90% – 1000% orasida bo'lsin";
            return;
        }
        box.style.background = 'rgba(48,209,88,.09)';
        box.style.borderColor = 'rgba(48,209,88,.22)';
        // Bot bilan AYNI formula: ceil(usd * kurs * (1+ustama/100) / 1000) * 1000
        var som = Math.ceil((10 * rate * (1 + mark / 100)) / 1000) * 1000;
        box.innerHTML = "10$ tovar → <b>" + fmt(som) + " so'm</b> (" + mark + "% ustama bilan)";
    }
    function updateCount() {
        var t = $('ai-bulk-text'), c = $('aib-count');
        if (!t || !c) return;
        var n = t.value.split('\n').filter(function (l) { return l.trim(); }).length;
        c.textContent = n + ' qator' + (n > 200 ? ' — 200 dan oshdi!' : '');
        c.style.color = n > 200 ? 'var(--accent-red)' : 'var(--luxury-gold)';
    }

    /* ---------------- Holat paneli ---------------- */
    var STAGES = {
        sending: { ic: '', cls: '', t: 'Yuborilmoqda...', s: "Ro'yxat bazaga yozilmoqda" },
        working: { ic: '', cls: '', t: 'AI tahlil qilmoqda', s: "Nom va narxlar ajratilib, qoralamalarga yozilmoqda. Bu 10–60 soniya olishi mumkin." },
        done:    { ic: '\u2705', cls: 'is-ok', t: 'Tayyor!', s: '' },
        error:   { ic: '\u26A0\uFE0F', cls: 'is-bad', t: 'Xatolik', s: '' },
        timeout: { ic: '\u23F0', cls: 'is-warn', t: 'Bot javob bermadi',
                   s: "Bot uxlab qolgan bo'lishi mumkin (Render bepul rejimi). So'rov saqlandi — bot uyg'onganda o'zi bajaradi. Bir necha daqiqadan keyin Qoralamalarni tekshirib ko'ring." }
    };

    window._aiBulkShowStage = function (stage, data) {
        data = data || {};
        var content = $('ai-bulk-content'), loader = $('ai-neural-loader');
        if (!content || !loader) return;
        content.style.display = 'none';
        loader.style.display = 'block';

        var cfg = STAGES[stage] || STAGES.working;
        var ic = $('aib-stage-ic'), t = $('aib-stage-t'), s = $('aib-stage-s'), acts = $('aib-stage-acts');
        if (ic) {
            ic.className = 'aib-stage-ic ' + (cfg.cls || '');
            ic.innerHTML = cfg.ic ? cfg.ic : '<div class="aib-ring"></div>';
        }
        if (t) t.textContent = cfg.t;
        if (s) {
            var msg = cfg.s;
            if (stage === 'done') {
                msg = data.added > 0
                    ? (data.added + " ta tovar Qoralamalar bo'limiga qo'shildi. Endi rasm qo'shib e'lon qilishingiz mumkin.")
                    : "AI hech qanday tovar ajratib olmadi. Har qatorda nom va $ narxi borligini tekshiring.";
            } else if (stage === 'error') {
                msg = data.error || "Noma'lum xato";
            } else if (stage === 'working' && data.lines) {
                msg = data.lines + " qator yuborildi. " + cfg.s;
            }
            s.textContent = msg;
        }
        if (acts) {
            acts.innerHTML = '';
            if (stage === 'done' || stage === 'error' || stage === 'timeout') {
                if (stage === 'done' && data.added > 0) {
                    acts.innerHTML += '<button type="button" class="aib-btn aib-btn-gold" id="aib-go-drafts">📁 Qoralamalarni ochish</button>';
                }
                acts.innerHTML += '<button type="button" class="aib-btn aib-btn-ghost" id="aib-back">← Formaga qaytish</button>';
                var g = $('aib-go-drafts');
                if (g) g.onclick = function () {
                    resetForm(true);
                    if (typeof window.openAdminDrafts === 'function') window.openAdminDrafts();
                };
                var b = $('aib-back');
                if (b) b.onclick = function () { resetForm(false); };
            }
        }
    };

    /** Formani tiklaydi (holat paneli yopiladi). */
    function resetForm(clearText) {
        var content = $('ai-bulk-content'), loader = $('ai-neural-loader');
        if (loader) loader.style.display = 'none';
        if (content) content.style.display = 'block';
        if (clearText) {
            var t = $('ai-bulk-text');
            if (t) t.value = '';
            updateCount();
        }
    }
    window._aiBulkResetForm = resetForm;

    /* ---------------- "Rasmdan" tugmasi — halol tushuntirish ---------------- */
    window._aiBulkPhotoInfo = function () {
        try { if (window._hap) window._hap('light'); } catch (e) {}
        var msg = "Rasmdan ro'yxat o'qish (OCR) hozircha yo'q.\n\n" +
                  "Buning o'rniga: bitta tovar rasmini BOTGA yuborsangiz, AI uni tanib, " +
                  "nomi va tavsifini o'zi yozib beradi.\n\n" +
                  "Ommaviy qo'shish uchun ro'yxatni matn ko'rinishida tashlang.";
        try {
            if (window.tg && tg.showAlert) { tg.showAlert(msg); return; }
        } catch (e) {}
        if (typeof showToast === 'function') showToast("Rasmdan o'qish hozircha yo'q — ro'yxatni matn bilan tashlang", 'warning');
    };

    /* ---------------- Oyna ochilganda holatni tiklash ---------------- */
    // ⚠️ ILGARI: loader ochiq holatda oynani yopib qayta ochsa, faqat loader
    //    ko'rinardi (forma yashirin qolardi) — oyna "buzilgan" bo'lib tuyulardi.
    function wrapOpen() {
        if (typeof window.openModal !== 'function' || window._aibWrapped) return;
        window._aibWrapped = true;
        var orig = window.openModal;
        window.openModal = function (id) {
            var r = orig.apply(this, arguments);
            if (id === 'aiBulkModal') {
                try {
                    setTimeout(function () {
                        if (!window._aiBulkBusy) resetForm(false);
                        updatePreview(); updateCount();
                    }, 20);
                } catch (e) {}
            }
            return r;
        };
    }

    function wire() {
        var r = $('ai-bulk-usd-rate'), m = $('ai-bulk-markup'), t = $('ai-bulk-text');
        if (r && !r._aibW) { r._aibW = 1; r.oninput = updatePreview; }
        if (m && !m._aibW) { m._aibW = 1; m.oninput = updatePreview; }
        if (t && !t._aibW) { t._aibW = 1; t.oninput = updateCount; }
        updatePreview(); updateCount();
    }
    wire();
    wrapOpen();
    setTimeout(function () { wire(); wrapOpen(); }, 1200);

    /* ---------------- Qoralama papkasi nomini chiroyli ko'rsatish ----------------
     * ⚠️ ILGARI: bot papkani `AI_30_05_2026_14_22` deb nomlardi, ilova esa faqat
     *    `Partiya_` prefiksini olib tashlardi — natijada adminга xom, o'qishga
     *    noqulay `AI_30_05_2026_14_22` ko'rinardi.
     * ---------------------------------------------------------------------------- */
    window._prettyBatch = function (bId) {
        var s = String(bId == null ? '' : bId);
        if (!s) return 'Boshqalar';
        // AI_DD_MM_YYYY_HH_MM -> "AI · 30.05.2026 14:22"
        var m = s.match(/^AI[_-](\d{2})[_-](\d{2})[_-](\d{4})[_-](\d{2})[_-](\d{2})$/);
        if (m) return '🧠 AI · ' + m[1] + '.' + m[2] + '.' + m[3] + ' ' + m[4] + ':' + m[5];
        if (/^AI[_-]/i.test(s)) return '🧠 AI · ' + s.replace(/^AI[_-]/i, '').replace(/_/g, ' ');
        if (/^Partiya_/.test(s)) return 'Partiya ' + s.replace('Partiya_', '');
        return s;
    };

    if (window._dlog) window._dlog('%c[Qatlam 2026.09] AI ommaviy yangilandi', 'color:#C9A84C;font-weight:bold;');
})();
