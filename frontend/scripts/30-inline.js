
(function profileCarAndAddress() {
    'use strict';

    var LS_CAR = 'avto_my_car';

    /* ------------------------------------------------------------------ *
     * 1) MASHINALAR RO'YXATI — YAGONA MANBA
     * ------------------------------------------------------------------ */
    window.MY_CAR_BRANDS = {
        gaz:    { label: 'GAZ',       models: ['Gazel Biznes', 'Gazel Next', 'Gazel Eski', 'Volga 2401', 'Volga 2410', 'Volga 3110', 'Volga 31105', 'Sobol'] },
        chevy:  { label: 'Chevrolet', models: ['Damas', 'Cobalt', 'Gentra', 'Lacetti', 'Malibu', 'Tracker', 'Nexia 3', 'Spark', 'Onix', 'Captiva', 'Labo', 'Matiz', 'Epica'] },
        daewoo: { label: 'Daewoo',    models: ['Nexia 1', 'Nexia 2', 'Matiz', 'Tico'] },
        uaz:    { label: 'UAZ',       models: ['Patriot', 'Hunter'] }
    };

    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
            return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c];
        });
    }

    function getCar() {
        try { return localStorage.getItem(LS_CAR) || ''; } catch (e) { return ''; }
    }

    /** Firebase havolasi — `db` top-level `const`, shuning uchun zaxira ham bor. */
    function dbRef(path) {
        try { if (typeof db !== 'undefined' && db && db.ref) return db.ref(path); } catch (e) {}
        try { if (window.firebase && firebase.database) return firebase.database().ref(path); } catch (e) {}
        return null;
    }

    /** `<option>` lar (markalar bo'yicha guruhlangan). */
    // 🚗 Mashina ro'yxati — KATALOGdan olinadi (admin qo'shgan YANGI markalar ham
    //    shu yerda avtomatik chiqadi). CATALOG_TREE bo'sh bo'lsa — eski
    //    MY_CAR_BRANDS zaxira sifatida ishlatiladi. Qiymat = model SLUG'i
    //    (katalog kategoriyasi bilan bir xil — moslik/filtr to'g'ri ishlaydi).
    function catalogCarList() {
        var tree = (window.CATALOG_TREE && window.CATALOG_TREE.length) ? window.CATALOG_TREE : null;
        var arr = [];
        if (tree) {
            tree.forEach(function (b) {
                (b.models || []).forEach(function (m) {
                    if (m && m.slug) arr.push({ brand: b.title || b.brand, slug: m.slug, name: m.name || m.slug, img: m.img || '' });
                });
            });
        }
        if (arr.length) return arr;
        Object.keys(window.MY_CAR_BRANDS).forEach(function (key) {
            var br = window.MY_CAR_BRANDS[key];
            br.models.forEach(function (m) { arr.push({ brand: br.label, slug: key + '-' + m, name: m, img: '' }); });
        });
        return arr;
    }
    window._catalogCarList = catalogCarList;

    window.myCarOptionsHTML = function (selected) {
        var sel = String(selected || '');
        var h = '<option value=""' + (sel ? '' : ' selected') + '>-- Tanlang --</option>';
        var list = catalogCarList();
        var groups = {}, order = [];
        list.forEach(function (it) { if (!groups[it.brand]) { groups[it.brand] = []; order.push(it.brand); } groups[it.brand].push(it); });
        order.forEach(function (bt) {
            h += '<optgroup label="' + esc(bt) + '">';
            groups[bt].forEach(function (it) {
                h += '<option value="' + esc(it.slug) + '"' + (it.slug === sel ? ' selected' : '') + '>' +
                     esc(bt + ' ' + it.name) + '</option>';
            });
            h += '</optgroup>';
        });
        return h;
    };

    /**
     * "chevy-Nexia 3" -> "Chevrolet Nexia 3".
     * ⚠️ Eski kod `val.split('-')` qilib qolganini bo'sh joy bilan qo'shardi —
     *    modelda chiziqcha bo'lsa nom buzilardi. Endi FAQAT birinchi
     *    chiziqcha bo'yicha ajratamiz.
     */
    window.myCarLabel = function (val) {
        var v = String(val || '').trim();
        if (!v) return '';
        // 1) Katalogdan slug bo'yicha (yangi format — masalan "bmw-m5-f90")
        var tree = window.CATALOG_TREE;
        if (tree && tree.length) {
            for (var t = 0; t < tree.length; t++) {
                var ms = tree[t].models || [];
                for (var j = 0; j < ms.length; j++) {
                    if (ms[j].slug === v) {
                        var _bt = String(tree[t].title || tree[t].brand || '').trim(), _mn = String(ms[j].name || ms[j].slug).trim();
                        // Model nomi marka bilan boshlansa ("Bmw M5 f90") — markani takrorlamaymiz
                        if (_bt && _mn.toLowerCase().indexOf(_bt.toLowerCase()) === 0) return _mn;
                        return (_bt + ' ' + _mn).trim();
                    }
                }
            }
        }
        // 2) Eski format: "chevy-Cobalt"
        var i = v.indexOf('-');
        if (i < 0) return v;
        var key = v.slice(0, i);
        var model = v.slice(i + 1);
        var br = window.MY_CAR_BRANDS[key];
        var bl = br ? br.label : (key.charAt(0).toUpperCase() + key.slice(1));
        return (bl + ' ' + model.replace(/-/g, ' ').replace(/^./, function (c) { return c.toUpperCase(); })).trim();
    };

    /* ------------------------------------------------------------------ *
     * 2) «MA'LUMOT» OYNASIDAGI TANLAGICH
     * ------------------------------------------------------------------ */
    window._pfSyncCarSelect = function () {
        var sel = document.getElementById('user-edit-car');
        if (!sel) return;
        var cur = getCar();
        sel.innerHTML = window.myCarOptionsHTML(cur);
        sel.value = cur;
    };

    /* ------------------------------------------------------------------ *
     * 3) MASHINANI SAQLASH — yagona yo'l
     * ------------------------------------------------------------------ */
    function saveCar(val) {
        val = String(val == null ? '' : val).trim();
        try { localStorage.setItem(LS_CAR, val); } catch (e) {}
        if (window.currentUser) {
            var r = dbRef('users/' + window.currentUser + '/my_car');
            if (r) { try { r.set(val); } catch (e) {} }
        }
        if (typeof window.renderMyCar === 'function') window.renderMyCar();
        // 🔧 Bosh sahifadagi «Mashinamga mos» yorlig'ini DARHOL yangilaymiz.
        //    Ilgari faqat window.saveMyCar wrap'i sync qilardi, lekin «Mening
        //    mashinam» oynasi ichki saveCar ni chaqiradi — shuning uchun yangi
        //    tanlangan mashina yorliqda ko'rinmasdi (eski qolib ketardi).
        try { if (window._syncMyCarShortcut) window._syncMyCarShortcut(true); } catch (e) {}
        return val;
    }
    window.saveMyCar = saveCar;

    /* ------------------------------------------------------------------ *
     * 4) PROFIL KARTOCHKASI VA ALOHIDA OYNA (yagona manbadan)
     * ------------------------------------------------------------------ */
    window.renderMyCar = function () {
        var val = getCar();
        var el = document.getElementById('pf-my-car-info');
        if (el) {
            el.innerHTML = val
                ? '<span style="color:var(--luxury-gold);font-weight:800;">' + esc(window.myCarLabel(val)) + '</span>'
                : '<span style="color:var(--text-muted);">Belgilanmagan \u2014 tanlash uchun bosing</span>';
        }
        try { window._pfSyncCarSelect(); } catch (e) {}
    };

    window.openMyCarModal = function () {
        var m = document.getElementById('myCarModal');
        var cur = getCar();
        if (!m) {
            m = document.createElement('div');
            m.id = 'myCarModal';
            m.className = 'modal-standard';
            m.innerHTML =
                '<div class="modal-header"><h2 style="color:var(--luxury-gold);">' +
                    '<svg class="uic" aria-hidden="true"><use href="#i-car"></use></svg>Mening mashinam</h2>' +
                    '<button class="close-btn" aria-label="Yopish" onclick="closeModal()">\u00D7</button></div>' +
                '<div style="padding:16px 16px 12px;">' +
                    '<p style="color:var(--text-muted);font-size:13px;margin-bottom:12px;line-height:1.5;">' +
                    'Mashinangizni qidirib toping va tanlang. Buyurtma berganda admin sizga ' +
                    'aynan mos qismni tanlashda yordam beradi.</p>' +
                    '<input type="text" id="my-car-search" class="search-box" placeholder="\uD83D\uDD0D Mashina nomini yozing..." oninput="renderMyCarList(this.value)" style="margin-bottom:12px; width:100%; box-sizing:border-box;">' +
                    '<div id="my-car-current"></div>' +
                    '<div id="my-car-list" style="max-height:54vh; overflow-y:auto; -webkit-overflow-scrolling:touch;"></div>' +
                '</div>';
            document.body.appendChild(m);
        }
        var si = document.getElementById('my-car-search'); if (si) si.value = '';
        try { window.renderMyCarList(''); } catch (e) {}
        if (typeof window.openModal === 'function') window.openModal('myCarModal');
        else { m.style.display = 'flex'; window.activeModal = 'myCarModal'; }
    };

    // 🔎 Qidiruvli mashina ro'yxati (select o'rniga — tez topish uchun).
    window.renderMyCarList = function (query) {
        var q = String(query == null ? '' : query).toLowerCase().trim();
        var cur = getCar();
        var listBox = document.getElementById('my-car-list');
        var curBox = document.getElementById('my-car-current');
        if (curBox) {
            curBox.innerHTML = cur
                ? '<div class="mycar-cur">Tanlangan: <b>' + esc(window.myCarLabel(cur)) + '</b> <span class="mycar-clear" onclick="saveMyCarChoice(\'\')">\u2715 olib tashlash</span></div>'
                : '';
        }
        if (!listBox) return;
        var list = catalogCarList();
        var rows = [];
        list.forEach(function (it) {
            var label = it.brand + ' ' + it.name;
            if (q && label.toLowerCase().indexOf(q) === -1) return;
            var jsv = esc(it.slug).replace(/'/g, "\\'");
            var active = (it.slug === cur) ? ' mycar-row-active' : '';
            var thumb = it.img
                ? '<img src="' + esc(it.img) + '" alt="" style="width:40px;height:40px;border-radius:9px;object-fit:cover;background:rgba(255,255,255,0.06);border:1px solid var(--glass-border);flex-shrink:0;" onerror="this.style.display=\'none\'">'
                : '';
            rows.push('<div class="mycar-row' + active + '" role="button" tabindex="0" onclick="saveMyCarChoice(\'' + jsv + '\')">' +
                thumb +
                '<span class="mycar-model">' + esc(it.name) + '</span>' +
                '<span class="mycar-brand">' + esc(it.brand) + '</span>' +
                (it.slug === cur ? '<span class="mycar-check">\u2713</span>' : '') +
                '</div>');
        });
        listBox.innerHTML = rows.length ? rows.join('')
            : '<p style="text-align:center;color:var(--text-muted);padding:20px;">Topilmadi \u2014 boshqacha yozib ko\'ring</p>';
    };

    window.saveMyCarChoice = function (value) {
        var val;
        if (typeof value === 'string') { val = value; }
        else { var sel = document.getElementById('my-car-select'); val = sel ? sel.value : ''; }
        val = saveCar(val);
        if (typeof showToast === 'function') showToast(val ? '\u2705 Mashina saqlandi!' : "Mashina o'chirildi", 'success');
        if (typeof window._hap === 'function') window._hap('success');
        if (typeof closeModal === 'function') closeModal();
    };

    /* ------------------------------------------------------------------ *
     * 5) «Ma'lumot» oynasi ochilganda tanlagichni to'ldiramiz
     * ------------------------------------------------------------------ */
    (function hookOpenModal() {
        function wrap() {
            if (typeof window.openModal !== 'function' || window._pfCarWrapped) return;
            window._pfCarWrapped = true;
            var orig = window.openModal;
            window.openModal = function (id) {
                var r = orig.apply(this, arguments);
                if (id === 'profileEditModal') {
                    try { window._pfSyncCarSelect(); } catch (e) {}
                    try { if (window._peSync) window._peSync(); } catch (e) {}
                }
                return r;
            };
        }
        wrap();
        setTimeout(wrap, 1200);
        setTimeout(wrap, 3000);
    })();

    // Dastlabki holat (profil ekrani allaqachon ochiq bo'lsa ham to'g'ri chizilsin)
    setTimeout(function () { try { window.renderMyCar(); } catch (e) {} }, 800);

    if (window._dlog) window._dlog('%c[Qatlam 2026.13] Profil: mashina + doimiy manzil', 'color:#C9A84C;font-weight:bold;');
})();
