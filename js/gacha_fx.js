/* =========================================================
 * STUDY QUEST まなびガチャの演出（js/gacha_fx.js）
 * テーマは「サーバーに せつぞくして、データを ダウンロードする」。
 *   1. 接続：ターミナルに、通信の じっさいの手順（DNS・TCP・TLS・HTTP…）が 1行ずつ出る。各行に ひとことの解説つき
 *   2. 受信：パケットが とどくと ランプが光る。ランプと バーの色が めずらしさの合図（白＝ノーマル・青＝レア・金＝スーパー）。
 *            ときどき とちゅうで「シグナルが 強くなった！」と 色が上がる（上がるだけ。下がる演出は しない）
 *   3. ひらく：「これは なんの用語？」と、用語を かくした解説を見せながら、ばらばらの文字が 1文字ずつ そろって 名前が出る
 *   4. 登場：めずらしさで 派手さが ちがう（スーパーは 光・ゆれ・紙ふぶき・ファンファーレ）
 * どこを押しても先に進む（スキップ）。演出が「ひかえめ」のときは、光・ゆれ を止めて 時間も短くする。
 * ⚠️ 下の通信の手順の文は、作り手とは別の確認役（AI）が確かめている（ハッシュ・TLS・ドメイン名の例 など4件を直した）。
 *    例の名前と番号は、説明用に予約されたもの（gacha.example：RFC 2606、192.0.2.30：RFC 5737）。
 * ========================================================= */

/* 通信の手順（上から順に起きる。めずらしいほど たくさん出る） */
var GACHA_NET_STEPS = [
  { cmd: "DNS で なまえを しらべる  gacha.example", ok: "→ 192.0.2.30", sub: "DNS：ドメイン名を IP アドレスに変換するしくみ（名前解決）" },
  { cmd: "TCP で せつぞく  SYN → SYN+ACK → ACK", ok: "せつぞく OK", sub: "TCP：3回の やりとり（3ウェイハンドシェイク）で 接続してから データを送る" },
  { cmd: "TLS で あんごう化", ok: "🔒 OK", sub: "TLS：通信を暗号化して ぬすみ見を ふせぎ、改ざんや なりすましも 見ぬく（https で使う）" },
  { cmd: "HTTP  GET /gacha", ok: "200 OK", sub: "HTTP の ステータスコード：200 は「成功」、404 は「見つからない」" },
  { cmd: "パケットを うけとる", ok: "ぜんぶ とどいた", sub: "パケット：データを 小さく分けて送るときの、1つぶんの かたまり" },
  { cmd: "ハッシュ値を くらべる", ok: "一致", sub: "ハッシュ値：データから計算する 短い値。正しい ハッシュ値と くらべて、ちがえば とちゅうで 書きかえられた（こわれた）と わかる" }
];
var GACHA_FX_COLORS = { normal: "#d7dbe3", rare: "#6ea8ff", super: "#ffd23b" };
var GACHA_FX_LABEL = { normal: "NORMAL", rare: "RARE", super: "SUPER RARE" };

var GachaFx = (function () {
  var root = null, timers = [], skipFn = null, tickers = [];
  var RANK = { normal: 0, rare: 1, super: 2 };

  function low() { return typeof Juice !== "undefined" && Juice.isLow(); }
  function ms(n) { return Math.round(n * (low() ? 0.6 : 1)); }
  function later(fn, n) { var t = setTimeout(fn, ms(n)); timers.push(t); return t; }
  function every(fn, n) { var t = setInterval(fn, n); tickers.push(t); return t; }
  function stopAll() {
    timers.forEach(clearTimeout); tickers.forEach(clearInterval);
    timers = []; tickers = []; skipFn = null;
  }
  function el(tag, cls, text, parent) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined && text !== null) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  }
  function bestOf(results) {
    return results.reduce(function (b, r) { return RANK[r.rarity] > RANK[b] ? r.rarity : b; }, "normal");
  }

  /* ---------- 画面（全面をおおう） ---------- */
  function open() {
    close();
    root = el("div", "gfx", null, document.body);
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-label", "まなびガチャ");
    var rain = el("div", "gfx-rain", null, root);
    rain.setAttribute("aria-hidden", "true");
    var cols = low() ? 8 : 18;
    for (var i = 0; i < cols; i++) {
      var c = el("span", "gfx-rain-col", null, rain);
      var s = "";
      for (var j = 0; j < 14; j++) s += Math.random() < 0.5 ? "0" : "1";
      c.textContent = s;
      c.style.left = (i / cols * 100 + Math.random() * 3) + "%";
      c.style.animationDuration = (2.4 + Math.random() * 2.6) + "s";
      c.style.animationDelay = (-Math.random() * 4) + "s";
    }
    root.appendChild(el("div", "gfx-body"));
    var skip = el("button", "gfx-skip", "▶▶ スキップ", root);
    skip.type = "button";
    skip.onclick = function (e) { e.stopPropagation(); doSkip(); };
    root.onclick = function () { doSkip(); };
    root.tabIndex = -1;
    root.focus();
    return root;
  }
  function body() { return root.querySelector(".gfx-body"); }
  function setTier(r) {
    if (!root) return;
    root.classList.remove("tier-normal", "tier-rare", "tier-super");
    root.classList.add("tier-" + r);
  }
  function doSkip() { if (skipFn) { var f = skipFn; skipFn = null; f(); } }
  function close() {
    stopAll();
    if (root && root.parentNode) root.parentNode.removeChild(root);
    root = null;
  }

  /* ---------- 1・2. 接続と受信（まとめて1回） ---------- */
  function intro(results, done) {
    open();
    var best = bestOf(results);
    /* はじめに見せる色。スーパーは半分、レアは3わりで、ひとつ下の色から はじまって とちゅうで上がる */
    var start = best;
    if (best === "super" && Math.random() < 0.5) start = "rare";
    else if (best === "rare" && Math.random() < 0.3) start = "normal";
    setTier("normal");
    var b = body();
    b.innerHTML = "";
    var term = el("div", "gfx-term", null, b);
    el("div", "gfx-term-title", "📡 まなびサーバーに せつぞく", term);
    /* めずらしいほど 手順が多い（順番は くずさない） */
    var n = best === "super" ? 5 : best === "rare" ? 4 : 3;
    var steps = GACHA_NET_STEPS.slice();
    while (steps.length > n) steps.splice(1 + Math.floor(Math.random() * (steps.length - 2)), 1);
    var finished = false;
    function finishIntro() {
      if (finished) return;
      finished = true;
      stopAll();
      done();
    }
    var t = 0;
    steps.forEach(function (st) {
      later(function () {
        var line = el("div", "gfx-line", null, term);
        el("span", "gfx-prompt", "> ", line);
        el("span", "gfx-cmd", st.cmd, line);
        Sound.tick();
        later(function () {
          el("span", "gfx-ok", "  " + st.ok, line);
          el("div", "gfx-sub", st.sub, term);
          Sound.select();
        }, 260);
      }, t);
      t += 560;
    });
    /* 受信：ランプ（パケット1つ＝1回ぶん）とバー */
    later(function () {
      var dl = el("div", "gfx-dl", null, b);
      el("div", "gfx-dl-label", "📦 データを ダウンロード中…", dl);
      var leds = el("div", "gfx-leds", null, dl);
      var ledEls = results.map(function () { return el("span", "gfx-led", null, leds); });
      var bar = el("div", "gfx-bar", null, dl);
      var fill = el("div", "gfx-bar-fill", null, bar);
      var pct = el("div", "gfx-pct", "0%", dl);
      setTier(start);
      var p = 0, upgraded = start === best, dur = best === "super" ? 2400 : best === "rare" ? 1700 : 1200;
      var step = 100 / (ms(dur) / 40);
      every(function () {
        p = Math.min(100, p + step * (0.6 + Math.random() * 0.8));
        fill.style.width = p + "%";
        pct.textContent = Math.floor(p) + "%";
        /* ランプは 順番に光る。色は その回の めずらしさ（上がる前は はじめの色まで） */
        ledEls.forEach(function (led, i) {
          if (!led.dataset.on && p >= (i + 1) / ledEls.length * 92) {
            led.dataset.on = "1";
            var r = results[i].rarity;
            if (!upgraded && RANK[r] > RANK[start]) r = start;
            led.dataset.r = r;
            led.className = "gfx-led on r-" + r;
            Sound.combo(i + 2);
          }
        });
        if (!upgraded && p >= 68) {
          upgraded = true;
          setTier(best);
          el("div", "gfx-upgrade", best === "super" ? "📶 シグナルが 強くなった！ 金色の データ！" : "📶 シグナルが 強くなった！", dl);
          ledEls.forEach(function (led, i) { if (led.dataset.on) led.className = "gfx-led on r-" + results[i].rarity; });
          Sound.zap();
          if (!low()) { Juice.flash(GACHA_FX_COLORS[best], 0.35, 260); Juice.shake(0.3); }
        }
        if (p >= 100) {
          stopAll();
          skipFn = finishIntro;
          pct.textContent = "100%  ✔ かんりょう";
          if (best === "super") Sound.warning(); else Sound.banner();
          later(finishIntro, best === "super" ? 900 : 500);
        }
      }, 40);
    }, t + 200);
    skipFn = finishIntro;
  }

  /* ---------- 3・4. ひらいて登場（1つずつ） ---------- */
  /* 解説の中の 用語を ■ で かくす（当てる楽しみ） */
  function maskText(text, words) {
    var out = text;
    words.forEach(function (w) {
      if (!w) return;
      var parts = [w].concat(w.split(/[（）()・、\s]+|と/));
      parts.forEach(function (p) {
        if (p.length < 2) return;
        out = out.split(p).join(new Array(Math.min(p.length, 6) + 1).join("■"));
      });
    });
    return out;
  }
  function info(res) {
    if (res.type === "card") {
      var c = gachaCard(res.key);
      return { kind: "用語カード", name: c.term, hintH: "❓ これは なんの用語？", hint: maskText(c.about, [c.term]), full: c.about };
    }
    if (res.type === "color") {
      var g = gachaColor(res.key);
      return { kind: "髪の色", name: g.label + "（" + g.code + "）", hintH: "❓ カラーコード " + g.code + " は なに色？",
        hint: "カラーコードは、光の三原色 R（赤）・G（緑）・B（青）の強さを、16進数 2けたずつ（00〜FF）で表す。", full: g.about };
    }
    var it = itemDef(res.key);
    return { kind: "そうび", name: it.name, hintH: "❓ この そうびの もとに なった用語は？", hint: maskText(it.card.about, [it.card.key]), full: "【" + it.card.key + "】" + it.card.about };
  }
  var SCRAMBLE = "01ABCDEF#$%&@*+=?<>";
  function scramble(len) {
    var s = "";
    for (var i = 0; i < len; i++) s += SCRAMBLE.charAt(Math.floor(Math.random() * SCRAMBLE.length));
    return s;
  }
  function reveal(res, opt, done) {
    if (!root) open();
    opt = opt || {};
    var r = res.rarity, inf = info(res);
    setTier(r);
    root.classList.remove("revealed");
    var b = body();
    b.innerHTML = "";
    var box = el("div", "gfx-reveal", null, b);
    if (opt.total > 1) el("div", "gfx-count", (opt.index + 1) + " / " + opt.total, box);
    el("div", "gfx-decode-label", "📂 とどいた データを ひらいている…", box);
    var stage = el("div", "gfx-stage", null, box);
    el("div", "gfx-rays", null, stage).setAttribute("aria-hidden", "true");
    var cv = el("canvas", "gfx-icon", null, stage);
    drawGachaIcon(cv, res, 8, true);
    var name = el("div", "gfx-name", scramble(inf.name.length), box);
    var hint = el("div", "gfx-hint", null, box);
    var hintH = el("div", "gfx-hint-h", inf.hintH, hint);
    var hintT = JpText.set(el("div", "gfx-hint-t", null, hint), inf.hint);
    var after = el("div", "gfx-after", null, box);

    var dur = r === "super" ? 2600 : r === "rare" ? 1700 : 1000;
    var shown = 0, total = inf.name.length, finished = false;
    var stepMs = Math.max(30, ms(dur) / Math.max(1, total));
    every(function () {
      shown = Math.min(total, shown + 1);
      name.textContent = inf.name.slice(0, shown) + scramble(total - shown);
      Sound.tick();
      if (shown >= total) finish();
    }, stepMs);
    function finish() {
      if (finished) return;
      finished = true;
      stopAll();
      name.textContent = inf.name;
      root.classList.add("revealed");
      drawGachaIcon(cv, res, 8, false);
      /* こたえ合わせ：かくしていた解説を ぜんぶ見せる */
      hintH.textContent = "💡 こたえ：" + inf.name;
      JpText.set(hintT, inf.full);
      var label = el("div", "gfx-rarity r-" + r, ITEM_RARITY[r].stars + " " + GACHA_FX_LABEL[r], box);
      box.insertBefore(label, name);
      el("div", "gfx-note", inf.kind + "　" + (res.dup ? "もっていたので ＋" + MEDAL_DUP + " メダル もどった" : "🆕 はじめて！"), after);
      var btn = el("button", "btn btn-primary gfx-go", "📖 解説カードを見る", after);
      btn.type = "button";
      btn.onclick = function (e) { e.stopPropagation(); go(); };
      skipFn = go;
      if (r === "super") {
        Sound.fanfare(); later(function () { Sound.shiny(); }, 500);
        Juice.confetti(90);
        if (!low()) { Juice.flash("#ffd23b", 0.5, 420); Juice.shake(0.6); }
      } else if (r === "rare") {
        Sound.chest(); Juice.confetti(28);
        if (!low()) Juice.flash("#6ea8ff", 0.25, 260);
      } else {
        Sound.correct();
      }
      btn.focus();
    }
    function go() {
      close();
      done();
    }
    skipFn = finish;
  }

  return { intro: intro, reveal: reveal, close: close, isOpen: function () { return !!root; }, mask: maskText };
})();
