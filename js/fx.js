/* =========================================================
 * MOS QUEST バトルエフェクトエンジン
 * 剣・まほう・爆発・ダメージ表示など、戦闘を盛り上げる演出をまとめる。
 * ドット絵のスプライト（sprites.js）と、粒・光の演出（juice.js）を組み合わせる。
 * ========================================================= */

var Fx = (function () {

  function layer() { return document.getElementById("fx-layer"); }

  /* 時間差で出る演出（爆発・カットインなど）が、バトルをはなれたあとの画面に出ないようにする。
   * cancel() を呼ぶと番号が進み、それより前に予約した演出は何もしなくなる。 */
  var gen = 0;
  function later(ms, fn) {
    var g0 = gen;
    setTimeout(function () { if (g0 === gen) fn(); }, ms);
  }
  function cancel() {
    gen++;
    Array.prototype.slice.call(document.querySelectorAll(".fx-cutin-wrap, .fx-warning")).forEach(function (n) { n.remove(); });
  }

  /* 敵スプライトの中心座標（ステージ内の相対位置）。
   * 敵が隠れているとき（ホットスポット問題）はステージの中心を使う。 */
  function enemyPos() {
    var c = document.getElementById("enemy-canvas");
    if (!c.offsetWidth) return stageCenter();
    return { x: c.offsetLeft + c.offsetWidth / 2, y: c.offsetTop + c.offsetHeight / 2 };
  }

  function stageCenter() {
    var s = layer();
    return { x: s.clientWidth / 2, y: s.clientHeight * 0.5 };
  }

  /* 要素を配置して、寿命がきたら自動で片付ける */
  function put(el, x, y, ttl) {
    el.style.left = x + "px";
    el.style.top = y + "px";
    layer().appendChild(el);
    setTimeout(function () { el.remove(); }, ttl);
  }

  function sprite(shape, palette, scale, cls, ttl, x, y) {
    var cv = document.createElement("canvas");
    drawSprite(cv, shape, palette, scale);
    cv.className = "fx-sprite " + cls;
    put(cv, x, y, ttl);
  }

  /* 画面全体を一瞬光らせる（ステージの中だけ） */
  function flash(color, ttl) {
    if (Juice.isLow()) return;
    var d = document.createElement("div");
    d.className = "fx-flash";
    d.style.background = color;
    layer().appendChild(d);
    setTimeout(function () { d.remove(); }, ttl || 300);
  }

  /* 技ごとの色 */
  var COLORS = {
    slash:  ["#ffd23b", "#ffffff", "#ff9d3b"],
    bolt:   ["#fff27a", "#ffffff", "#6ee7ff"],
    fire:   ["#ff5d3b", "#ff9d3b", "#ffd23b", "#ffffff"],
    ice:    ["#6ee7ff", "#b8f3ff", "#ffffff", "#4f8fe0"],
    meteor: ["#c79bff", "#ff5d7a", "#ffd23b", "#ffffff"],
    special: ["#ffffff", "#ffd23b", "#6ee7ff", "#ff5d7a", "#6ef08c"]
  };

  /* こうげきエフェクト。
   * kind: "slash"（剣）/ "bolt"（いなずま）/ "fire"（ごうか）/ "ice"（ふぶき）/ "meteor"（りゅうせい）
   * o: { crit: かいしん, color: 剣の色 } */
  function attack(kind, o) {
    o = o || {};
    var p = enemyPos();
    var g = Juice.enemyPoint();
    var cols = COLORS[kind] || COLORS.slash;
    var crit = !!o.crit;

    if (kind === "bolt") {
      sprite("fxBolt", "gold", 5, "fx-bolt", 460, p.x, p.y - 8);
      Juice.bolt(g.x, g.y, { top: Juice.stageRect().top, width: crit ? 12 : 8 });
      Juice.burst(g.x, g.y, { n: 16, colors: cols, speed: 320, g: 300, size: 6 });
    } else if (kind === "fire") {
      sprite("fxFire", "red", 5, "fx-fire", 540, p.x - 8, p.y + 4);
      sprite("fxFire", "orange", 4, "fx-fire", 540, p.x + 24, p.y + 12);
      Juice.burst(g.x, g.y + 20, { n: 26, colors: cols, speed: 300, angle: -Math.PI / 2, spread: 1.6, g: -160, size: 8, life: 0.7 });
      Juice.ring(g.x, g.y, { color: "#ff9d3b", r1: 80 });
    } else if (kind === "ice") {
      for (var i = 0; i < 5; i++) {
        var a = -Math.PI / 2 + (i - 2) * 0.5;
        Juice.line(g.x + Math.cos(a) * 150, g.y + Math.sin(a) * 150, g.x, g.y,
          { color: "#b8f3ff", width: 7, dur: 0.26, delay: i * 0.03 });
      }
      later(150, function () {
        Juice.burst(g.x, g.y, { n: 30, colors: cols, speed: 380, g: 240, size: 7, shape: "star" });
        Juice.ring(g.x, g.y, { color: "#b8f3ff", r1: 110, width: 10 });
      });
    } else if (kind === "meteor") {
      for (var m = 0; m < 4; m++) {
        (function (m) {
          later(m * 85, function () {
            var ox = (m - 1.5) * 34, oy = (m % 2) * 18 - 9;
            Juice.line(g.x + 190 + ox, g.y - 210, g.x + ox, g.y + oy, { color: cols[m % 2], width: 12, dur: 0.24 });
            later(110, function () {
              Juice.burst(g.x + ox, g.y + oy, { n: 14, colors: cols, speed: 340, size: 8 });
              Juice.ring(g.x + ox, g.y + oy, { color: cols[m % 2], r1: 70 });
              Juice.shake(0.22);
            });
          });
        })(m);
      }
    } else {
      sprite("fxSlash", "gold", 4, "fx-slash", 420, p.x, p.y);
      var c0 = o.color || "#ffd23b";
      Juice.line(g.x + 70, g.y - 70, g.x - 70, g.y + 70, { color: c0, width: crit ? 18 : 12 });
      if (crit) Juice.line(g.x - 70, g.y - 70, g.x + 70, g.y + 70, { color: "#ffffff", width: 14, delay: 0.08 });
      Juice.burst(g.x, g.y, { n: 12, colors: [c0, "#ffffff"], speed: 300, size: 6 });
    }

    later(150, function () {
      sprite("fxBurst", "gold", crit ? 6 : 4, "fx-burst", 420, p.x, p.y);
      if (crit) {
        Juice.ring(g.x, g.y, { color: "#ffffff", r1: 150, width: 12 });
        Juice.burst(g.x, g.y, { n: 28, colors: ["#ffffff", "#ffd23b", "#ff5d7a"], speed: 520, size: 8, shape: "star" });
        Juice.hitStop(90);
      }
    });
    flash("rgba(255,255,255," + (crit ? ".32" : ".2") + ")", 220);
    Juice.shake(crit ? 0.5 : (kind === "slash" ? 0.18 : 0.3));
    Juice.buzz(crit ? [20, 30, 40] : 15);
  }

  /* ひっさつわざ：暗転 → 技名のカットイン → 十字の斬撃 → 大爆発 */
  function special(name, onHit) {
    var g = Juice.enemyPoint();
    /* 暗転（画面全体の明るさが急に変わるので、ひかえめ設定では出さない。帯だけで十分伝わる） */
    if (!Juice.isLow()) Juice.overlay("#05051a", 0.6, 900, 0.75);
    /* カットインは暗転より手前に出す（暗転は全画面のキャンバスに描くので、
     * ステージの中に置くと一緒に暗くなってしまう）。ステージと同じ位置・大きさの枠を上の層に作る */
    var r = Juice.stageRect();
    var wrap = document.createElement("div");
    wrap.className = "fx-cutin-wrap";
    wrap.style.left = r.left + "px";
    wrap.style.top = r.top + "px";
    wrap.style.width = r.width + "px";
    wrap.style.height = r.height + "px";
    var cut = document.createElement("div");
    cut.className = "fx-cutin";
    var lab = document.createElement("div"); lab.className = "fx-cutin-label"; lab.textContent = "ひっさつ！";
    var nm = document.createElement("div"); nm.className = "fx-cutin-name"; nm.textContent = name;
    cut.appendChild(lab); cut.appendChild(nm);
    wrap.appendChild(cut);
    Juice.textLayer().appendChild(wrap);
    setTimeout(function () { wrap.remove(); }, 1000);

    later(520, function () {
      var cols = COLORS.special;
      [[-90, -90, 90, 90], [90, -90, -90, 90], [-110, 0, 110, 0], [0, -110, 0, 110]].forEach(function (v, i) {
        Juice.line(g.x + v[0], g.y + v[1], g.x + v[2], g.y + v[3], { color: cols[(i % 4) + 1], width: 16, dur: 0.28, delay: i * 0.07 });
      });
    });
    later(860, function () {
      Juice.flash("#ffffff", 0.5, 420);
      Juice.rays(g.x, g.y, { dur: 1.1, len: 320, alpha: 0.5 });
      Juice.ring(g.x, g.y, { color: "#ffffff", r1: 220, width: 16, dur: 0.6 });
      Juice.ring(g.x, g.y, { color: "#ffd23b", r1: 150, width: 10, dur: 0.5 });
      Juice.burst(g.x, g.y, { n: 60, colors: COLORS.special, speed: 640, size: 9, shape: "star", life: 0.9 });
      Juice.shake(0.9);
      Juice.hitStop(130);
      Juice.buzz([30, 40, 30, 40, 80]);
      if (onHit) onHit();
    });
  }

  /* 敵の反撃（まちがえたとき）：ツメの引っかき＋赤いフラッシュ */
  function claw() {
    var c = stageCenter();
    sprite("fxClaw", "red", 7, "fx-claw", 470, c.x, c.y);
    flash("rgba(255,80,100,.28)", 320);
    var s = Juice.stageRect();
    Juice.burst(s.left + s.width / 2, s.top + s.height / 2, { n: 10, colors: ["#ff5d7a", "#9e2b2b"], speed: 260, size: 6 });
    Juice.shake(0.55);
    Juice.buzz([60, 40, 60]);
  }

  /* 敵をたおしたとき：ドット絵がバラバラにくだけ散る */
  function defeat(paletteKey, isBoss) {
    var cv = document.getElementById("enemy-canvas");
    var g = Juice.enemyPoint();
    var pal = PIXEL_PALETTES[paletteKey] || PIXEL_PALETTES.gold;
    if (cv.offsetWidth) Juice.dissolve(cv, { power: isBoss ? 1.5 : 1 });
    Juice.ring(g.x, g.y, { color: pal[3], r1: isBoss ? 200 : 110, width: isBoss ? 14 : 8 });
    Juice.burst(g.x, g.y, { n: isBoss ? 40 : 14, colors: [pal[1], pal[3], "#ffffff"], speed: isBoss ? 520 : 300, size: 7, shape: "star" });
    if (isBoss) {
      Juice.flash("#ffffff", 0.45, 500);
      Juice.shake(0.8);
      Juice.hitStop(110);
      [0, 160, 320].forEach(function (d, i) {
        later(d + 120, function () {
          var ox = (i - 1) * 60, oy = (i % 2) * 40 - 20;
          Juice.burst(g.x + ox, g.y + oy, { n: 22, colors: ["#ffd23b", "#ff9d3b", "#ffffff"], speed: 420, size: 8 });
          Juice.ring(g.x + ox, g.y + oy, { color: "#ffd23b", r1: 100 });
          if (typeof Sound !== "undefined" && Sound.boom) Sound.boom();
        });
      });
    }
  }

  /* 敵をたおしたときの飛び散るドット（むかしの演出。ほかの場面でも使えるよう残す） */
  function particles(paletteKey, n) {
    var p = enemyPos();
    var pal = PIXEL_PALETTES[paletteKey] || PIXEL_PALETTES.gold;
    var colors = [pal[1], pal[2], pal[3], "#f8f8f8"];
    for (var i = 0; i < (n || 12); i++) {
      var d = document.createElement("div");
      d.className = "fx-particle";
      d.style.background = colors[i % colors.length];
      var ang = Math.random() * Math.PI * 2;
      var dist = 34 + Math.random() * 56;
      d.style.setProperty("--dx", Math.cos(ang) * dist + "px");
      d.style.setProperty("--dy", (Math.sin(ang) * dist - 18) + "px");
      put(d, p.x, p.y, 650);
    }
  }

  /* 敵の頭上にふわっと浮かぶ文字（EXPやダメージ表示）。cls: "crit" / "bad" / "quick" */
  function floatText(text, color, cls) {
    var p = enemyPos();
    var d = document.createElement("div");
    d.className = "fx-float" + (cls ? " fx-float-" + cls : "");
    d.textContent = text;
    if (color) d.style.color = color;
    put(d, p.x + (cls === "quick" ? 60 : 0), p.y - (cls === "quick" ? 4 : 24), 1100);
  }

  /* ボス登場：「WARNING」の帯が流れる */
  function warning(text) {
    var d = document.createElement("div");
    d.className = "fx-warning";
    for (var i = 0; i < 2; i++) {
      var row = document.createElement("div");
      row.className = "fx-warning-row";
      row.textContent = new Array(9).join((text || "WARNING") + "　");
      d.appendChild(row);
    }
    layer().appendChild(d);
    setTimeout(function () { d.remove(); }, 1500);
    Juice.overlay("#3a0010", 0.35, 1300, 0.6);
  }

  /* ステージにただよう粒（ほたる・火の粉・雪など）。テーマごとに雰囲気を変える */
  var ambientTimer = null;
  var AMBIENT = {
    forest:  { colors: ["#c8ff7a", "#fff7a0"], vy: -14, vx: 10, size: 4, every: 420 },
    grass:   { colors: ["#c8ff7a", "#ffffff"], vy: -12, vx: 14, size: 4, every: 520 },
    cave:    { colors: ["#6ee7ff", "#9fd2ff"], vy: -8, vx: 4, size: 4, every: 520 },
    lake:    { colors: ["#9fd2ff", "#ffffff"], vy: -10, vx: 8, size: 4, every: 480 },
    castle:  { colors: ["#ffd23b", "#ffb03b"], vy: -22, vx: 6, size: 4, every: 460 },
    fort:    { colors: ["#ffb03b", "#ff7a3b"], vy: -26, vx: 6, size: 4, every: 420 },
    wild:    { colors: ["#e0c08a", "#ffffff"], vy: 6, vx: 60, size: 3, every: 260 },
    valley:  { colors: ["#ffffff", "#d7dbe3"], vy: 24, vx: 18, size: 4, every: 300 },
    tower:   { colors: ["#c79bff", "#6ee7ff"], vy: -18, vx: 0, size: 4, every: 380 },
    temple:  { colors: ["#fff7a0", "#ffffff"], vy: -10, vx: 0, size: 4, every: 520 },
    library: { colors: ["#e0c08a", "#fff7a0"], vy: 8, vx: 6, size: 3, every: 520 },
    vault:   { colors: ["#ffd23b", "#fff0a0"], vy: -14, vx: 0, size: 4, every: 380 },
    shrine:  { colors: ["#6ef08c", "#ffffff"], vy: -20, vx: 0, size: 5, every: 340 },
    final:   { colors: ["#ff5d3b", "#ffb03b", "#ffd23b"], vy: -60, vx: 14, size: 5, every: 150 }
  };
  function ambient(theme) {
    clearInterval(ambientTimer);
    ambientTimer = null;
    var a = AMBIENT[theme];
    if (!a || Juice.isLow()) return;
    ambientTimer = setInterval(function () {
      var stage = document.getElementById("battle-stage");
      if (!stage || !document.getElementById("screen-battle").classList.contains("active") || document.hidden) return;
      var r = stage.getBoundingClientRect();
      var down = a.vy > 0;
      Juice.burst(r.left + Math.random() * r.width, down ? r.top + 6 : r.bottom - 8, {
        n: 1, colors: a.colors, speed: Math.abs(a.vy) + 10, speedVar: 0.5,
        angle: Math.atan2(a.vy, a.vx * (Math.random() - 0.3)), spread: 0.6,
        g: 0, size: a.size, life: 3.2, shrink: false,
        clip: { left: r.left + 4, right: r.right - 4, top: r.top + 4, bottom: r.bottom - 4 }
      });
    }, a.every);
  }
  function stopAmbient() { clearInterval(ambientTimer); ambientTimer = null; }

  return {
    attack: attack, special: special, claw: claw, defeat: defeat,
    particles: particles, floatText: floatText, flash: flash,
    warning: warning, ambient: ambient, stopAmbient: stopAmbient, cancel: cancel
  };
})();
