
(function smartSearch() {
  'use strict';

  // ===================================================================
  // 1) NORMALLASHTIRISH
  // ===================================================================

  /** Kirill -> lotin. Rus va o'zbek kirill harflari birga. */
  var CYR = {
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo',
    'ж': 'j', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
    'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
    'ф': 'f', 'х': 'x', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sh',
    'ъ': '', 'ы': 'i', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya',
    // o'zbek kirill
    'ў': 'o', 'қ': 'q', 'ғ': 'g', 'ҳ': 'h'
  };

  /** Qidiruv uchun matnni normallashtiradi.
   *  Apostrof BUTUNLAY tashlanadi: mijoz «to'plami», «toplami», «to‘plami»
   *  deb yozishi mumkin — hammasi bir xil bo'lishi kerak. */
  function sNorm(s) {
    s = String(s == null ? '' : s).toLowerCase();
    var out = '';
    for (var i = 0; i < s.length; i++) {
      var ch = s[i];
      out += (CYR[ch] !== undefined) ? CYR[ch] : ch;
    }
    // apostrof va uning barcha ko'rinishlari
    out = out.replace(/['\u2018\u2019\u02bb\u02bc\u0060\u00b4]/g, '');
    // qolgan hamma narsa -> bo'sh joy
    out = out.replace(/[^a-z0-9]+/g, ' ');
    return out.replace(/\s+/g, ' ').trim();
  }
  window._sNorm = sNorm;

  /** 🔊 FONETIK KALIT — almashib ketadigan tovushlarni bir sinfga qo'yadi.
   *
   *  Nega kerak: o'zbek tilida lotin yozuvi yangi va odamlar bir xil
   *  so'zni turlicha yozadi:
   *      xodovoy / hodovoy      kalotka / qalotka
   *      kolsa / kolca          shina / sina
   *  Bularni harf-baharf solishtirish topolmaydi, fonetik kalit topadi.
   *
   *  Digraflar (ch, sh, ts) BIR HARFDAN OLDIN tekshiriladi — aks holda
   *  «ch» ni «c»+«h» deb bo'lib yuborardi. */
  function sFold(s) {
    s = sNorm(s);
    var out = '', i = 0;
    while (i < s.length) {
      var two = s.substr(i, 2);
      if (two === 'ch') { out += 'C'; i += 2; continue; }
      if (two === 'sh' || two === 'ts') { out += 'S'; i += 2; continue; }
      if (two === 'yo') { out += 'o'; i += 2; continue; }
      if (two === 'yu') { out += 'u'; i += 2; continue; }
      if (two === 'ya') { out += 'a'; i += 2; continue; }
      var c = s[i]; i++;
      if (c === 'x' || c === 'h') { out += 'h'; continue; }
      if (c === 'q' || c === 'k') { out += 'k'; continue; }
      if (c === 'w' || c === 'v') { out += 'v'; continue; }
      if (c === 's' || c === 'c') { out += 'S'; continue; }
      if (c === 'z' || c === 'j') { out += 'j'; continue; }
      if (c === 'y') { out += 'i'; continue; }
      out += c;
    }
    // takroriy harflar: «kollsa» -> «kolsa»
    return out.replace(/(.)\1+/g, '$1');
  }
  window._sFold = sFold;

  // ===================================================================
  // 2) SINONIMLAR — endi HAR SO'ZGA alohida qo'llanadi
  // ===================================================================
  // ⚠️ Ilgari bu jadval BUTUN so'rovga qo'llanardi, ya'ni «porshun»
  //    topilardi, «gazel porshun» esa YO'Q. Endi so'rov so'zlarga
  //    bo'linadi va har so'z alohida almashtiriladi.
  var SYN = {
    porshun: 'porshen', porshin: 'porshen', porshan: 'porshen', porshn: 'porshen',
    kolca: 'kolsa', kalso: 'kolsa', xalqa: 'kolsa', halqa: 'kolsa',
    kalodka: 'kalotka', kolodka: 'kalotka', kalotki: 'kalotka', kolotka: 'kalotka',
    amartizator: 'amortizator', amartisator: 'amortizator', amortizatr: 'amortizator',
    mator: 'motor', dvigatel: 'motor', dvijok: 'motor',
    galofka: 'galovka', golovka: 'galovka', galavka: 'galovka',
    apora: 'opora', apara: 'opora',
    xadavoy: 'xodovoy', xadovoy: 'xodovoy', hodovoy: 'xodovoy',
    chirol: 'fara', chiroq: 'fara', chirog: 'fara',
    maslo: 'moy', masla: 'moy',
    tormaz: 'tormoz', tarmoz: 'tormoz',
    podshipnik: 'podshipnik', padshipnik: 'podshipnik', pdshipnik: 'podshipnik',
    filtir: 'filtr', filter: 'filtr', filtre: 'filtr',
    remen: 'remen', ramen: 'remen',
    svecha: 'svecha', sveca: 'svecha', shesha: 'svecha',
    radiator: 'radiator', radyator: 'radiator', radiatr: 'radiator'
  };

  /** So'rovni so'zlarga bo'lib, har biriga sinonimni qo'llaydi. */
  function synTokens(q) {
    var raw = sNorm(q).split(' ').filter(function (t) { return t.length >= 2; });
    var out = [];
    for (var i = 0; i < raw.length; i++) {
      var t = raw[i];
      out.push(SYN[t] || t);
    }
    return out;
  }

  // ===================================================================
  // 3) XATO MASOFASI (chegaralangan Levenshtein)
  // ===================================================================
  /** `max` dan oshsa darhol to'xtaydi — to'liq jadval qurilmaydi. */
  function lev(a, b, max) {
    var la = a.length, lb = b.length;
    if (Math.abs(la - lb) > max) return max + 1;
    if (!la) return lb;
    if (!lb) return la;
    var prev = new Array(lb + 1), cur = new Array(lb + 1), i, j;
    for (j = 0; j <= lb; j++) prev[j] = j;
    for (i = 1; i <= la; i++) {
      cur[0] = i;
      var best = cur[0];
      var from = Math.max(1, i - max), to = Math.min(lb, i + max);
      if (from > 1) cur[from - 1] = max + 1;
      for (j = from; j <= to; j++) {
        var cost = (a[i - 1] === b[j - 1]) ? 0 : 1;
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
        if (cur[j] < best) best = cur[j];
      }
      if (to < lb) cur[to + 1] = max + 1;
      if (best > max) return max + 1;      // shu qatorda ham chegaradan oshdi
      var tmp = prev; prev = cur; cur = tmp;
    }
    return prev[lb];
  }
  window._sLev = lev;

  /** So'z uzunligiga qarab ruxsat etilgan xato soni.
   *  Qisqa so'zlarda xatoga yo'l qo'ysak — hamma narsa mos kelib ketadi. */
  function maxDist(len) {
    if (len <= 3) return 0;
    if (len <= 5) return 1;
    return 2;
  }

  // ===================================================================
  // 4) TOVAR INDEKSI — bir marta hisoblanadi, keshlanadi
  // ===================================================================
  // ⚠️ Indeks tovar OBYEKTIGA yozilmaydi! `saveProductAt` butun obyektni
  //    Firebase'ga yozadi — indeks ham bazaga tushib ketardi. Shuning
  //    uchun alohida Map ishlatiladi.
  var IDX = new Map();

  /** Tovar matni o'zgarganini arzon aniqlash uchun «barmoq izi». */
  function fp(p) {
    return String(p.name || '') + '|' + String(p.code || '') + '|' +
      String(p.aliases || '') + '|' + String(p.brand || '') + '|' +
      String(p.model || '') + '|' + (p.categories || []).join(',') + '|' +
      String(p.desc || '').length;
  }

  function indexOf(p) {
    var key = p.id;
    var hit = IDX.get(key);
    var stamp = fp(p);
    if (hit && hit.stamp === stamp) return hit;

    var name = sNorm(p.name);
    var code = sNorm(p.code);
    var cats = sNorm((p.categories || []).join(' ') + ' ' + (p.category || ''));
    var brand = sNorm(p.brand);
    var model = sNorm(p.model);
    var alias = sNorm(p.aliases);      // qo'lda kiritilgan sinonimlar
    var desc = sNorm(p.desc);

    // Xato masofasi FAQAT shu to'plamga qo'llanadi: nom, kod, sinonim,
    // brand, model. `desc` ataylab chiqarilgan — u eng uzun va eng
    // «shovqinli» maydon, unga fuzzy qo'llash noto'g'ri natija beradi.
    var fuzzySrc = (name + ' ' + code + ' ' + alias + ' ' + brand + ' ' + model)
      .split(' ').filter(function (t) { return t.length >= 3; });
    var seen = {}, ftok = [];
    for (var i = 0; i < fuzzySrc.length; i++) {
      var f = sFold(fuzzySrc[i]);
      if (f && !seen[f]) { seen[f] = 1; ftok.push(f); }
    }

    var idx = {
      stamp: stamp,
      name: name, code: code, cats: cats, brand: brand, model: model,
      alias: alias, desc: desc,
      nameFold: sFold(name),
      ftok: ftok
    };
    IDX.set(key, idx);
    return idx;
  }

  // ===================================================================
  // 5) BAL BERISH — bot bilan bir xil vaznlar
  // ===================================================================
  // Vaznlar `bot/ai_agent.py::_score_product` dan olingan: nom 3, kod 3,
  // model 2, brand/kategoriya/tavsif 1, butun so'rov nomda +4.
  // Qo'shimcha: qo'lda kiritilgan sinonim ham 3 — u ataylab yozilgan.
  function score(p, idx, tokens, whole) {
    var s = 0, i, t;
    for (i = 0; i < tokens.length; i++) {
      t = tokens[i];
      if (idx.name.indexOf(t) !== -1) s += 3;
      if (idx.code && idx.code.indexOf(t) !== -1) s += 3;
      if (idx.alias && idx.alias.indexOf(t) !== -1) s += 3;
      if (idx.model && idx.model.indexOf(t) !== -1) s += 2;
      if (idx.brand && idx.brand.indexOf(t) !== -1) s += 1;
      if (idx.cats && idx.cats.indexOf(t) !== -1) s += 1;
      if (idx.desc && idx.desc.indexOf(t) !== -1) s += 1;
    }
    if (whole && idx.name.indexOf(whole) !== -1) s += 4;

    // ⚠️ «Sotuvda bor» bonusi FAQAT moslik bo'lganda qo'shiladi.
    //    Aks holda har qoldiqli tovar 0.5 bal olib, MOSLIK BO'LMASA HAM
    //    natijaga tushib qolardi — «zzzzzz» so'rovi butun katalogni
    //    qaytarardi. (Buni sinov tutdi.)
    if (s <= 0) return 0;
    try {
      var st = (p.product_type === 'razmerli' && Array.isArray(p.sizes))
        ? p.sizes.reduce(function (a, x) { return a + (parseInt(x && x.stock, 10) || 0); }, 0)
        : (p.stock !== undefined ? (Number(p.stock) || 0) : 10);
      if (st > 0) s += 0.5;
    } catch (e) {}
    return s;
  }

  /** Fonetik + xato masofasi bo'yicha qo'shimcha bal. */
  function fuzzyScore(idx, tokens) {
    var s = 0;
    for (var i = 0; i < tokens.length; i++) {
      var qf = sFold(tokens[i]);
      if (qf.length < 3) continue;
      var best = 99;
      for (var j = 0; j < idx.ftok.length; j++) {
        var tf = idx.ftok[j];
        if (tf === qf) { best = 0; break; }
        // fonetik kalit ichida bo'lsa — bu ham kuchli signal
        if (tf.indexOf(qf) !== -1 || qf.indexOf(tf) !== -1) { if (best > 0) best = 0; break; }
        var m = maxDist(Math.max(qf.length, tf.length));
        if (m > 0) {
          var d = lev(qf, tf, m);
          if (d <= m && d < best) best = d;
        }
      }
      if (best === 0) s += 2.5;
      else if (best === 1) s += 1.8;
      else if (best === 2) s += 1.0;
    }
    return s;
  }

  // ===================================================================
  // 6) ASOSIY FUNKSIYA
  // ===================================================================
  function liveProducts() {
    var src = window.productsDB || [];
    var out = [];
    for (var i = 0; i < src.length; i++) {
      if (src[i] && !src[i].is_draft) out.push(src[i]);
    }
    return out;
  }

  /**
   * Mos tovarlarni MOSLIK BO'YICHA TARTIBLANGAN holda qaytaradi.
   *
   * Ikki bosqich:
   *   1) Aniq moslik (normallashtirilgan). Tez va hech qachon
   *      noto'g'ri natija bermaydi — ilgari ishlagan hamma so'rov
   *      AVVALGIDEK ishlaydi.
   *   2) Natija kam bo'lsa (3 tadan kam) — fonetik + xato masofasi.
   *      Ya'ni qimmat hisob har tugma bosilganda emas, faqat kerak
   *      bo'lganda ishlaydi.
   */
  window._smartMatch = function (qRaw) {
    var list = liveProducts();
    var whole = sNorm(qRaw);
    if (!whole) return list;

    var tokens = synTokens(qRaw);
    if (!tokens.length) tokens = [whole];

    var i, p, idx, sc;
    var exact = [];
    for (i = 0; i < list.length; i++) {
      p = list[i];
      idx = indexOf(p);
      sc = score(p, idx, tokens, whole);
      if (sc > 0) exact.push({ p: p, s: sc });
    }

    // 2-bosqich: aniq moslik kam bo'lsa xato masofasini qo'shamiz
    var MIN_RESULTS = 3;
    if (exact.length < MIN_RESULTS && whole.length >= 3) {
      var have = {};
      for (i = 0; i < exact.length; i++) have[exact[i].p.id] = 1;
      for (i = 0; i < list.length; i++) {
        p = list[i];
        if (have[p.id]) continue;
        idx = indexOf(p);
        var fs = fuzzyScore(idx, tokens);
        if (fs > 0) exact.push({ p: p, s: fs });
      }
    }

    // Barqaror tartib: bal bo'yicha kamayish tartibida, teng bo'lsa
    // dastlabki tartib saqlanadi.
    exact.forEach(function (x, k) { x.k = k; });
    exact.sort(function (a, b) { return (b.s - a.s) || (a.k - b.k); });
    return exact.map(function (x) { return x.p; });
  };

  // Katalog yangilanganda keshni tozalash uchun (ixtiyoriy chaqiriladi)
  window._smartSearchReset = function () { IDX.clear(); };
})();
