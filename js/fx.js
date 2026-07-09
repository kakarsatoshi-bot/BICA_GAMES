/* =========================================================
 * MOS QUEST バトルエフェクトエンジン
 * 剣・まほう・爆発・パーティクル・ダメージ表示など、
 * 戦闘を盛り上げるドット絵エフェクトをすべてコードで描画する。
 * （drawSprite と PIXEL_PALETTES は sprites.js のものを利用）
 * ========================================================= */

var Fx = (function () {

  function layer() { return document.getElementById("fx-layer"); }

  /* 敵スプライトの中心座標（ステージ内の相対位置） */
  function enemyPos() {
    var c = document.getElementById("enemy-canvas");
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

  /* 画面全体を一瞬光らせる */
  function flash(color, ttl) {
    var d = document.createElement("div");
    d.className = "fx-flash";
    d.style.background = color;
    layer().appendChild(d);
    setTimeout(function () { d.remove(); }, ttl || 300);
  }

  /* こうげきエフェクト。kind: "slash"（剣）/ "bolt"（いなずま）/ "fire"（ごうか） */
  function attack(kind) {
    var p = enemyPos();
    if (kind === "bolt") {
      sprite("fxBolt", "gold", 5, "fx-bolt", 460, p.x, p.y - 8);
    } else if (kind === "fire") {
      sprite("fxFire", "red", 5, "fx-fire", 540, p.x - 8, p.y + 4);
      sprite("fxFire", "orange", 4, "fx-fire", 540, p.x + 24, p.y + 12);
    } else {
      sprite("fxSlash", "gold", 4, "fx-slash", 420, p.x, p.y);
    }
    setTimeout(function () {
      sprite("fxBurst", "gold", 4, "fx-burst", 420, p.x, p.y);
    }, 150);
    flash("rgba(255,255,255,.2)", 220);
  }

  /* 敵の反撃（まちがえたとき）：ツメの引っかき＋赤いフラッシュ */
  function claw() {
    var c = stageCenter();
    sprite("fxClaw", "red", 7, "fx-claw", 470, c.x, c.y);
    flash("rgba(255,80,100,.28)", 320);
  }

  /* 敵をたおしたときの飛び散るドット */
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

  /* 敵の頭上にふわっと浮かぶ文字（EXPやダメージ表示） */
  function floatText(text, color) {
    var p = enemyPos();
    var d = document.createElement("div");
    d.className = "fx-float";
    d.textContent = text;
    if (color) d.style.color = color;
    put(d, p.x, p.y - 24, 950);
  }

  return { attack: attack, claw: claw, particles: particles, floatText: floatText, flash: flash };
})();
