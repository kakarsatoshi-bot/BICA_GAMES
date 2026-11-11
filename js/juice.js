/* =========================================================
 * MOS QUEST えんしゅつエンジン（Juice）
 * 画面全体にかぶせた1枚のキャンバスに、ドットの粒・光の輪・光の筋・
 * 紙ふぶきを描く。画面ゆれ・ヒットストップ・大きな文字の演出もここ。
 * 画像・外部ライブラリは使わない（すべてコードで描く）。
 *
 * ⚠️ 光の点滅に弱い人のために：画面全体のフラッシュは1回ずつ・うすく・
 *    ゆっくり消す（1秒に3回をこえる点滅を作らない）。
 *    「ひかえめ」設定（Juice.setLevel("low")）では、ゆれ・全体フラッシュ・
 *    ヒットストップを止め、粒の数を減らす。
 * ========================================================= */

var Juice = (function () {
  var LEVEL_KEY = "mosquest_fx_level";
  var MAX_PARTICLES = 700;

  var canvas = null, ctx = null;
  var W = 0, H = 0;
  var parts = [];      // 粒
  var shapes = [];     // 輪・線・光の筋など、形を持つ演出
  var overlays = [];   // 画面全体の色かぶせ
  var running = false;
  var lastT = 0;
  var freezeUntil = 0; // ヒットストップ中はこの時刻まで更新を止める
  var trauma = 0;      // 画面ゆれの強さ（0〜1。時間で減る）
  var shakeEl = null;
  var level = "high";

  /* ---------- 設定 ---------- */
  function loadLevel() {
    var saved = null;
    try { saved = localStorage.getItem(LEVEL_KEY); } catch (e) { /* 保存できない環境は既定で動く */ }
    if (saved === "high" || saved === "low") return saved;
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    return reduce ? "low" : "high";
  }
  function setLevel(v) {
    level = v === "low" ? "low" : "high";
    try { localStorage.setItem(LEVEL_KEY, level); } catch (e) { /* 同上 */ }
    document.documentElement.classList.toggle("fx-low", level === "low");
  }
  function isLow() { return level === "low"; }
  function amount(n) { return isLow() ? Math.max(1, Math.round(n * 0.35)) : n; }

  /* ---------- 初期化 ---------- */
  function init() {
    if (canvas) return;
    canvas = document.createElement("canvas");
    canvas.id = "juice-canvas";
    document.body.appendChild(canvas);
    ctx = canvas.getContext("2d");
    shakeEl = document.getElementById("app");
    resize();
    window.addEventListener("resize", resize);
    setLevel(loadLevel());
  }
  function resize() {
    /* スクロールバーをのぞいた、見えている範囲の大きさ（画面上の座標とずれないように） */
    var de = document.documentElement;
    W = canvas.width = de.clientWidth || window.innerWidth;
    H = canvas.height = de.clientHeight || window.innerHeight;
    ctx.imageSmoothingEnabled = false;
  }

  /* ---------- 位置の計算（画面上の座標） ---------- */
  function centerOf(el) {
    if (!el) return { x: W / 2, y: H / 2 };
    var r = el.getBoundingClientRect();
    if (!r.width && !r.height) return null;
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height };
  }
  /* 敵の中心。敵が隠れている画面（ホットスポット問題）ではステージの中心を返す */
  function enemyPoint() {
    var p = centerOf(document.getElementById("enemy-canvas"));
    if (p) return p;
    return centerOf(document.getElementById("battle-stage")) || { x: W / 2, y: H / 3, w: 100, h: 100 };
  }
  function stageRect() {
    var el = document.getElementById("battle-stage");
    return el ? el.getBoundingClientRect() : { left: 0, top: 0, right: W, bottom: H, width: W, height: H };
  }

  /* ---------- ループ ---------- */
  function kick() {
    if (running) return;
    running = true;
    lastT = performance.now();
    requestAnimationFrame(frame);
  }
  function frame(now) {
    var dt = Math.min(50, now - lastT) / 1000;
    lastT = now;
    var frozen = now < freezeUntil;
    if (!frozen) update(dt);
    draw();
    applyShake(dt);
    if (parts.length || shapes.length || overlays.length || trauma > 0 || frozen) {
      requestAnimationFrame(frame);
    } else {
      running = false;
      ctx.clearRect(0, 0, W, H);
      if (shakeEl) shakeEl.style.transform = "";
    }
  }

  function update(dt) {
    var i, p;
    for (i = parts.length - 1; i >= 0; i--) {
      p = parts[i];
      p.life -= dt;
      if (p.life <= 0) { parts.splice(i, 1); continue; }
      if (p.delay > 0) { p.delay -= dt; continue; }
      if (p.home) {
        /* 目的地へ吸いこまれる粒（EXPの玉など）：だんだん加速して寄っていく */
        var hx = p.home.x - p.x, hy = p.home.y - p.y;
        var d = Math.sqrt(hx * hx + hy * hy) || 1;
        p.homeSpeed += 2600 * dt;
        var step = p.homeSpeed * dt;
        if (d <= step + 6) {
          if (p.onArrive) p.onArrive(p);
          parts.splice(i, 1);
          continue;
        }
        p.vx += (hx / d * p.homeSpeed - p.vx) * Math.min(1, 6 * dt);
        p.vy += (hy / d * p.homeSpeed - p.vy) * Math.min(1, 6 * dt);
      } else {
        p.vy += p.g * dt;
        if (p.drag) { p.vx *= (1 - p.drag * dt); p.vy *= (1 - p.drag * dt); }
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.spin) p.rot += p.spin * dt;
      if (p.clip && (p.x < p.clip.left || p.x > p.clip.right || p.y < p.clip.top || p.y > p.clip.bottom)) {
        parts.splice(i, 1);
      }
    }
    for (i = shapes.length - 1; i >= 0; i--) {
      shapes[i].t += dt;
      if (shapes[i].t >= shapes[i].dur) shapes.splice(i, 1);
    }
    for (i = overlays.length - 1; i >= 0; i--) {
      overlays[i].t += dt;
      if (overlays[i].t >= overlays[i].dur) overlays.splice(i, 1);
    }
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    var i, p, s, k;

    /* 画面全体の色かぶせ（暗転・フラッシュ） */
    for (i = 0; i < overlays.length; i++) {
      s = overlays[i];
      k = s.t / s.dur;
      var a = s.hold && k < s.hold ? s.alpha : s.alpha * (1 - (s.hold ? (k - s.hold) / (1 - s.hold) : k));
      ctx.globalAlpha = Math.max(0, a);
      ctx.fillStyle = s.color;
      ctx.fillRect(0, 0, W, H);
    }

    /* 形のある演出 */
    for (i = 0; i < shapes.length; i++) {
      s = shapes[i];
      k = s.t / s.dur;
      if (s.delay && s.t < 0) continue;
      if (s.kind === "ring") {
        ctx.globalAlpha = (1 - k) * (s.alpha || 1);
        ctx.strokeStyle = s.color;
        ctx.lineWidth = Math.max(1, s.width * (1 - k));
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r0 + (s.r1 - s.r0) * easeOut(k), 0, Math.PI * 2);
        ctx.stroke();
      } else if (s.kind === "line") {
        /* 斬撃：先頭がのびて、しっぽが追いかけて消える */
        var head = Math.min(1, k / 0.35), tail = Math.max(0, (k - 0.25) / 0.75);
        ctx.globalAlpha = 1 - tail * 0.6;
        ctx.strokeStyle = s.color;
        ctx.lineWidth = s.width * (1 - tail * 0.7);
        ctx.lineCap = "square";
        ctx.beginPath();
        ctx.moveTo(s.x0 + (s.x1 - s.x0) * tail, s.y0 + (s.y1 - s.y0) * tail);
        ctx.lineTo(s.x0 + (s.x1 - s.x0) * head, s.y0 + (s.y1 - s.y0) * head);
        ctx.stroke();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = Math.max(1, s.width * 0.35 * (1 - tail));
        ctx.stroke();
      } else if (s.kind === "bolt") {
        ctx.globalAlpha = k < 0.5 ? 1 : 1 - (k - 0.5) * 2;
        ctx.strokeStyle = s.color;
        ctx.lineWidth = s.width;
        ctx.lineJoin = "miter";
        ctx.beginPath();
        for (var j = 0; j < s.pts.length; j++) {
          if (j === 0) ctx.moveTo(s.pts[j].x, s.pts[j].y); else ctx.lineTo(s.pts[j].x, s.pts[j].y);
        }
        ctx.stroke();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = Math.max(1, s.width * 0.4);
        ctx.stroke();
      } else if (s.kind === "rays") {
        /* 中心から広がる光の筋（ゆっくり回る） */
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(s.rot0 + s.t * (s.speed || 0.6));
        var fade = k < 0.15 ? k / 0.15 : (k > 0.7 ? (1 - k) / 0.3 : 1);
        ctx.globalAlpha = (s.alpha || 0.5) * Math.max(0, fade);
        ctx.fillStyle = s.color;
        for (var n = 0; n < s.count; n++) {
          ctx.rotate(Math.PI * 2 / s.count);
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(s.len, -s.len * 0.09);
          ctx.lineTo(s.len, s.len * 0.09);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
      }
    }

    /* 粒 */
    for (i = 0; i < parts.length; i++) {
      p = parts[i];
      if (p.delay > 0) continue;
      k = p.life / p.max;
      ctx.globalAlpha = p.fade ? Math.min(1, k * p.fade) : 1;
      ctx.fillStyle = p.blink && ((p.life * 20) | 0) % 2 ? "#ffffff" : p.color;
      var sz = p.shrink ? Math.max(1, p.size * k) : p.size;
      if (p.shape === "confetti") {
        /* 紙ふぶき：ひらひら（幅が伸び縮みして回って見える） */
        var wv = Math.abs(Math.cos(p.rot)) * sz + 1;
        ctx.fillRect((p.x - wv / 2) | 0, (p.y - sz / 2) | 0, wv, sz * 0.6);
      } else if (p.shape === "star") {
        var h2 = sz / 2;
        ctx.fillRect((p.x - h2) | 0, (p.y - 1) | 0, sz, 2);
        ctx.fillRect((p.x - 1) | 0, (p.y - h2) | 0, 2, sz);
      } else {
        ctx.fillRect((p.x - sz / 2) | 0, (p.y - sz / 2) | 0, sz, sz);
      }
    }
    ctx.globalAlpha = 1;
  }

  function easeOut(k) { return 1 - (1 - k) * (1 - k); }

  /* ---------- 画面ゆれ（強さが時間で減っていく） ---------- */
  function applyShake(dt) {
    if (!shakeEl) return;
    if (trauma <= 0) { return; }
    trauma = Math.max(0, trauma - dt * 1.9);
    if (trauma === 0) { shakeEl.style.transform = ""; return; }
    var m = trauma * trauma * 16;
    var x = (Math.random() * 2 - 1) * m, y = (Math.random() * 2 - 1) * m;
    shakeEl.style.transform = "translate(" + x.toFixed(1) + "px," + y.toFixed(1) + "px)";
  }
  function shake(power) {
    if (isLow()) return;
    trauma = Math.min(1, trauma + (power || 0.4));
    kick();
  }

  /* ヒットストップ：命中の瞬間に一瞬だけ時間を止める（重さが出る） */
  function hitStop(ms) {
    if (isLow()) return;
    freezeUntil = performance.now() + ms;
    document.documentElement.classList.add("hitstop");
    setTimeout(function () { document.documentElement.classList.remove("hitstop"); }, ms);
    kick();
  }

  /* ---------- 粒を出す ---------- */
  function spawn(p) {
    if (parts.length >= MAX_PARTICLES) parts.shift();
    p.max = p.life;
    p.g = p.g === undefined ? 0 : p.g;
    p.delay = p.delay || 0;
    p.rot = p.rot || 0;
    p.homeSpeed = p.homeSpeed || 60;
    parts.push(p);
  }

  /* はじける粒。o: {n, colors, speed, speedVar, size, life, g, spread, angle, shape, drag, clip, shrink} */
  function burst(x, y, o) {
    if (!canvas) return;
    o = o || {};
    var n = amount(o.n || 14);
    var colors = o.colors || ["#ffd23b", "#ffffff", "#ff9d3b"];
    var spread = o.spread === undefined ? Math.PI * 2 : o.spread;
    var base = o.angle === undefined ? 0 : o.angle;
    for (var i = 0; i < n; i++) {
      var ang = base + (Math.random() - 0.5) * spread;
      var sp = (o.speed || 220) * (1 - (o.speedVar === undefined ? 0.6 : o.speedVar) * Math.random());
      spawn({
        x: x + (Math.random() - 0.5) * (o.jitter || 0),
        y: y + (Math.random() - 0.5) * (o.jitter || 0),
        vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
        g: o.g === undefined ? 520 : o.g,
        drag: o.drag || 0,
        life: (o.life || 0.6) * (0.6 + Math.random() * 0.6),
        size: (o.size || 6) * (0.6 + Math.random() * 0.8),
        color: colors[(Math.random() * colors.length) | 0],
        shape: o.shape, shrink: o.shrink !== false, fade: 3,
        blink: !!o.blink, clip: o.clip, delay: o.delay ? Math.random() * o.delay : 0,
        spin: o.shape === "confetti" ? (Math.random() * 10 + 4) : 0
      });
    }
    kick();
  }

  function ring(x, y, o) {
    if (!canvas) return;
    o = o || {};
    shapes.push({ kind: "ring", x: x, y: y, t: 0, dur: o.dur || 0.45,
      r0: o.r0 || 6, r1: o.r1 || 90, width: o.width || 8, color: o.color || "#ffffff", alpha: o.alpha });
    kick();
  }

  function line(x0, y0, x1, y1, o) {
    if (!canvas) return;
    o = o || {};
    shapes.push({ kind: "line", x0: x0, y0: y0, x1: x1, y1: y1, t: -(o.delay || 0), delay: !!o.delay,
      dur: o.dur || 0.3, width: o.width || 12, color: o.color || "#ffd23b" });
    kick();
  }

  /* いなずま：上から目標へ、ギザギザの線 */
  function bolt(x, y, o) {
    if (!canvas) return;
    o = o || {};
    var top = o.top === undefined ? y - 180 : o.top;
    var pts = [{ x: x + (Math.random() - 0.5) * 60, y: top }];
    var segs = 6;
    for (var i = 1; i < segs; i++) {
      pts.push({ x: x + (Math.random() - 0.5) * 46, y: top + (y - top) * i / segs });
    }
    pts.push({ x: x, y: y });
    shapes.push({ kind: "bolt", pts: pts, t: 0, dur: o.dur || 0.28, width: o.width || 8, color: o.color || "#fff27a" });
    kick();
  }

  function rays(x, y, o) {
    if (!canvas) return;
    o = o || {};
    shapes.push({ kind: "rays", x: x, y: y, t: 0, dur: o.dur || 1.4, count: o.count || 12,
      len: o.len || 260, color: o.color || "#ffe98a", alpha: o.alpha || 0.4, rot0: Math.random() * 6, speed: o.speed });
    kick();
  }

  /* 画面全体の色かぶせ。hold（0〜1）のあいだは濃さを保ち、そのあと消える */
  function overlay(color, alpha, ms, hold) {
    if (!canvas) return;
    overlays.push({ color: color, alpha: alpha, t: 0, dur: (ms || 300) / 1000, hold: hold || 0 });
    kick();
  }
  /* フラッシュ（ひかえめ設定では出さない） */
  function flash(color, alpha, ms) {
    if (isLow()) return;
    overlay(color || "#ffffff", Math.min(alpha === undefined ? 0.3 : alpha, 0.6), ms || 260);
  }

  /* 紙ふぶき（上から降る） */
  function confetti(n) {
    if (!canvas) return;
    var colors = ["#ffd23b", "#6ee7ff", "#ff5d7a", "#6ef08c", "#c79bff", "#ffffff"];
    n = amount(n || 70);
    for (var i = 0; i < n; i++) {
      spawn({
        x: Math.random() * W, y: -20 - Math.random() * H * 0.3,
        vx: (Math.random() - 0.5) * 120, vy: 120 + Math.random() * 200,
        g: 90, drag: 0.4, life: 2.6 + Math.random() * 1.6,
        size: 8 + Math.random() * 6, color: colors[(Math.random() * colors.length) | 0],
        shape: "confetti", rot: Math.random() * 6, spin: 5 + Math.random() * 8, fade: 4
      });
    }
    kick();
  }

  /* 下から吹き上がる光の粒（レベルアップなど） */
  function fountain(x, y, o) {
    o = o || {};
    burst(x, y, {
      n: o.n || 40, colors: o.colors || ["#ffd23b", "#fff7c2", "#ffffff", "#6ef08c"],
      speed: o.speed || 520, speedVar: 0.5, angle: -Math.PI / 2, spread: o.spread || 1.1,
      g: 700, size: o.size || 7, life: o.life || 1.1, shape: o.shape, delay: o.delay || 0.35
    });
  }

  /* きらきら（要素のまわりに星がまたたく） */
  function sparkle(el, o) {
    var c = centerOf(el);
    if (!c) return;
    o = o || {};
    var n = amount(o.n || 10);
    for (var i = 0; i < n; i++) {
      spawn({
        x: c.x + (Math.random() - 0.5) * (c.w + 30), y: c.y + (Math.random() - 0.5) * (c.h + 30),
        vx: 0, vy: -12 - Math.random() * 20, g: 0,
        life: 0.5 + Math.random() * 0.7, size: 7 + Math.random() * 7,
        color: (o.colors || ["#ffffff", "#fff27a", "#6ee7ff"])[i % 3],
        shape: "star", shrink: true, fade: 3, delay: Math.random() * (o.spreadTime || 0.6)
      });
    }
    kick();
  }

  /* fromから出た玉がtoへ吸いこまれる（EXPがバーに入っていく） */
  function orbs(from, to, o) {
    if (!canvas) return;
    o = o || {};
    var a = from.x !== undefined ? from : centerOf(from);
    var b = to.x !== undefined ? to : centerOf(to);
    if (!a || !b) { if (o.onDone) o.onDone(); return; }
    var n = amount(o.n || 8);
    var left = n;
    for (var i = 0; i < n; i++) {
      var ang = Math.random() * Math.PI * 2, sp = 160 + Math.random() * 180;
      spawn({
        x: a.x, y: a.y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 80,
        life: 3, size: o.size || 7, color: (o.colors || ["#ffd23b", "#fff7c2"])[i % 2],
        home: null, shrink: false, blink: true, delay: 0,
        _home: b, _arm: 0.18 + Math.random() * 0.18,
        onArrive: function () {
          if (o.onEach) o.onEach();
          if (--left === 0 && o.onDone) o.onDone();
        }
      });
    }
    /* 少し飛び散ってから吸いこみを始める */
    setTimeout(function () {
      parts.forEach(function (p) { if (p._home && !p.home) { p.home = p._home; p.g = 0; } });
    }, 240);
    kick();
  }

  /* キャンバスに描かれたドット絵を、ドットの粒にしてバラバラに飛ばす（敵がくだける） */
  function dissolve(el, o) {
    if (!canvas || !el || !el.width) return;
    o = o || {};
    var r = el.getBoundingClientRect();
    if (!r.width) return;
    var img;
    try { img = el.getContext("2d").getImageData(0, 0, el.width, el.height); } catch (e) { return; }
    var cell = Math.max(4, Math.round(el.width / (isLow() ? 9 : 16)));
    var sx = r.width / el.width, sy = r.height / el.height;
    var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    for (var y = (cell / 2) | 0; y < el.height; y += cell) {
      for (var x = (cell / 2) | 0; x < el.width; x += cell) {
        var i = (y * el.width + x) * 4;
        if (img.data[i + 3] < 128) continue;
        var px = r.left + x * sx, py = r.top + y * sy;
        var dx = px - cx, dy = py - cy;
        var d = Math.sqrt(dx * dx + dy * dy) || 1;
        var pw = (o.power || 1) * (140 + Math.random() * 220);
        spawn({
          x: px, y: py,
          vx: dx / d * pw + (Math.random() - 0.5) * 80,
          vy: dy / d * pw - 120 - Math.random() * 120,
          g: 900, life: 0.7 + Math.random() * 0.6, size: cell * sx,
          color: "rgb(" + img.data[i] + "," + img.data[i + 1] + "," + img.data[i + 2] + ")",
          shrink: true, fade: 3, blink: Math.random() < 0.25
        });
      }
    }
    kick();
  }

  /* ---------- 文字の演出（DOM。ドット文字のフォントをそのまま使う） ---------- */
  function textLayer() {
    var l = document.getElementById("juice-text");
    if (!l) {
      l = document.createElement("div");
      l.id = "juice-text";
      document.body.appendChild(l);
    }
    return l;
  }
  /* その場でポンと出て、上へ飛んで消える文字。cls で色・大きさを変える */
  function pop(x, y, text, cls, ttl) {
    var d = document.createElement("div");
    d.className = "jz-pop " + (cls || "");
    d.textContent = text;
    d.style.left = x + "px";
    d.style.top = y + "px";
    textLayer().appendChild(d);
    setTimeout(function () { d.remove(); }, ttl || 1000);
    return d;
  }
  /* 画面まんなかにドンと出る大きな文字（「かいしんの いちげき！」など） */
  function announce(text, cls, ttl) {
    var s = stageRect();
    /* バトル画面の外（リザルトなど）では、画面のまんなかに出す */
    if (!s.width) s = { left: 0, top: 0, width: W, height: H * 0.8 };
    var d = document.createElement("div");
    d.className = "jz-announce " + (cls || "");
    d.textContent = text;
    d.style.left = (s.left + s.width / 2) + "px";
    d.style.top = (s.top + s.height * 0.42) + "px";
    textLayer().appendChild(d);
    setTimeout(function () { d.remove(); }, ttl || 900);
    return d;
  }

  /* 上からスッと降りてくるお知らせの帯（実績・ミッション）。順番に1本ずつ出す */
  var bannerQueue = [], bannerBusy = false;
  /* key を付けると、まだ出ていない同じ key のお知らせを上書きする
   * （レベルが続けて上がったとき、古い数字の帯を何本も待たせない） */
  function banner(icon, head, body, cls, key) {
    var item = { icon: icon, head: head, body: body, cls: cls, key: key || null };
    if (key) {
      for (var i = 0; i < bannerQueue.length; i++) {
        if (bannerQueue[i].key === key) { bannerQueue[i] = item; return; }
      }
    }
    bannerQueue.push(item);
    if (!bannerBusy) nextBanner();
  }
  /* まだ出ていないお知らせのうち、key が同じものを取りさげる */
  function dropBanners(key) {
    bannerQueue = bannerQueue.filter(function (b) { return b.key !== key; });
  }
  function nextBanner() {
    var b = bannerQueue.shift();
    if (!b) { bannerBusy = false; return; }
    bannerBusy = true;
    var d = document.createElement("div");
    d.className = "jz-banner " + (b.cls || "");
    var ic = document.createElement("span"); ic.className = "jz-banner-icon"; ic.textContent = b.icon;
    var tx = document.createElement("div"); tx.className = "jz-banner-text";
    var h = document.createElement("div"); h.className = "jz-banner-head"; h.textContent = b.head;
    var bd = document.createElement("div"); bd.className = "jz-banner-body"; bd.textContent = b.body;
    tx.appendChild(h); tx.appendChild(bd);
    d.appendChild(ic); d.appendChild(tx);
    textLayer().appendChild(d);
    if (typeof Sound !== "undefined" && Sound.banner) Sound.banner();
    var c = centerOf(d);
    if (c) sparkle(d, { n: 8 });
    /* うしろに お知らせが たまっているときは、1本を短くして待たせない */
    var hold = bannerQueue.length ? 1300 : 2100;
    setTimeout(function () { d.classList.add("out"); }, hold);
    setTimeout(function () { d.remove(); nextBanner(); }, hold + 350);
  }

  /* 数字が 0 から目標までカタカタと上がっていく */
  function countUp(el, from, to, ms, fmt, onTick) {
    var t0 = performance.now();
    var last = null;
    fmt = fmt || function (v) { return String(v); };
    function step(now) {
      var k = Math.min(1, (now - t0) / ms);
      var v = Math.round(from + (to - from) * easeOut(k));
      if (v !== last) { el.textContent = fmt(v); last = v; if (onTick) onTick(v); }
      if (k < 1) requestAnimationFrame(step);
    }
    if (isLow() || ms <= 0) { el.textContent = fmt(to); return; }
    requestAnimationFrame(step);
  }

  /* 画面の切りかえ：帯が閉じて→中身を入れかえて→開く。kind "battle" はエンカウント風 */
  function transition(kind, swap) {
    if (isLow()) { swap(); return; }
    var d = document.createElement("div");
    d.className = "jz-wipe jz-wipe-" + (kind || "plain");
    for (var i = 0; i < 6; i++) d.appendChild(document.createElement("span"));
    document.body.appendChild(d);
    var closeMs = kind === "battle" ? 420 : 200;
    setTimeout(function () {
      swap();
      d.classList.add("open");
      setTimeout(function () { d.remove(); }, 320);
    }, closeMs);
  }

  /* スマホをブルッとさせる（対応している端末だけ） */
  function buzz(pattern) {
    if (isLow()) return;
    try { if (navigator.vibrate) navigator.vibrate(pattern); } catch (e) { /* 非対応は何もしない */ }
  }

  function clear() {
    parts.length = 0; shapes.length = 0; overlays.length = 0; trauma = 0;
    var l = document.getElementById("juice-text");
    if (l) Array.prototype.slice.call(l.querySelectorAll(".jz-pop,.jz-announce")).forEach(function (n) { n.remove(); });
  }

  return {
    init: init, setLevel: setLevel, isLow: isLow, getLevel: function () { return level; },
    centerOf: centerOf, enemyPoint: enemyPoint, stageRect: stageRect,
    burst: burst, ring: ring, line: line, bolt: bolt, rays: rays,
    overlay: overlay, flash: flash, confetti: confetti, fountain: fountain,
    sparkle: sparkle, orbs: orbs, dissolve: dissolve,
    shake: shake, hitStop: hitStop, buzz: buzz,
    pop: pop, announce: announce, banner: banner, dropBanners: dropBanners, textLayer: textLayer,
    countUp: countUp, transition: transition,
    clear: clear,
    size: function () { return { w: W, h: H }; },
    count: function () { return parts.length; }
  };
})();
