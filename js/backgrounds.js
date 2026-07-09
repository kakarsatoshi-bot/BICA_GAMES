/* =========================================================
 * MOS QUEST バトル背景エンジン
 * クエストごとの背景をコードでドット絵描画する（画像ファイル不要）。
 * 低解像度のキャンバスに描いてCSSで引き伸ばし、ドット感を出す。
 * ========================================================= */

var StageBg = (function () {
  var W = 96, H = 34;      // 論理解像度
  var HORIZON = 21;        // 地平線（敵の足もとの高さに合わせる）

  function px(ctx, x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); }
  function band(ctx, y0, y1, c) { px(ctx, 0, y0, W, y1 - y0, c); }

  /* 色の境目をチェッカー模様でぼかす（レトロなディザ表現） */
  function dither(ctx, y, c) {
    for (var x = 0; x < W; x += 2) px(ctx, x + (y % 2), y, 1, 1, c);
  }

  function stars(ctx, seed, c) {
    for (var i = 0; i < 18; i++) {
      var x = (i * 37 + seed * 13) % W;
      var y = (i * 11 + seed * 7) % (HORIZON - 5);
      px(ctx, x, y, 1, 1, c);
    }
  }

  /* 上向き三角（木・山） */
  function tri(ctx, cx, baseY, size, c) {
    for (var r = 0; r <= size; r++) px(ctx, cx - r, baseY - size + r, r * 2 + 1, 1, c);
  }

  /* 下向き三角（つらら） */
  function triDown(ctx, cx, y0, size, c) {
    for (var r = 0; r <= size; r++) px(ctx, cx - (size - r), y0 + r, (size - r) * 2 + 1, 1, c);
  }

  /* 地面（2色＋小石の散らばり） */
  function ground(ctx, c1, c2) {
    band(ctx, HORIZON, H, c1);
    dither(ctx, HORIZON, c2);
    for (var x = 3; x < W; x += 9) px(ctx, x, HORIZON + 4 + (x % 5), 2, 1, c2);
  }

  var THEMES = {

    /* XL1 セルとさんしょうの森 */
    forest: function (ctx) {
      band(ctx, 0, HORIZON, "#0c2135");
      stars(ctx, 1, "#2e4d66");
      for (var x = 4; x < W; x += 11) tri(ctx, x, HORIZON, 7, "#123522");
      for (x = 9; x < W; x += 13) tri(ctx, x, HORIZON + 1, 9, "#1b4a2e");
      ground(ctx, "#153a24", "#1e5233");
    },

    /* XL2 かんすうの洞くつ */
    cave: function (ctx) {
      band(ctx, 0, HORIZON, "#171227");
      for (var x = 5; x < W; x += 9) triDown(ctx, x, 0, 3 + (x % 3), "#2c2244");
      for (x = 10; x < W; x += 17) tri(ctx, x, HORIZON, 4 + (x % 3), "#241c38");
      px(ctx, 20, 9, 2, 2, "#5ee0c0"); px(ctx, 66, 12, 2, 2, "#5ee0c0"); /* 光るキノコ */
      ground(ctx, "#221a33", "#332a4a");
    },

    /* XL3 しょしきの城 */
    castle: function (ctx) {
      band(ctx, 0, HORIZON, "#232a3d");
      for (var y = 2; y < HORIZON - 1; y += 4) {
        px(ctx, 0, y, W, 1, "#161b2b");
        for (var x = (y % 8 === 2 ? 0 : 4); x < W; x += 8) px(ctx, x, y, 1, 4, "#161b2b");
      }
      px(ctx, 14, 6, 3, 6, "#0a0d18"); px(ctx, 79, 6, 3, 6, "#0a0d18");   /* 窓 */
      px(ctx, 15, 7, 1, 2, "#ffd23b"); px(ctx, 80, 7, 1, 2, "#ffd23b");  /* 窓あかり */
      ground(ctx, "#2c3450", "#3a4466");
    },

    /* XL4 データの荒野（夕暮れ） */
    wild: function (ctx) {
      band(ctx, 0, 8, "#3d1c2e");
      band(ctx, 8, 14, "#6b2d35"); dither(ctx, 8, "#3d1c2e");
      band(ctx, 14, HORIZON, "#9e4a30"); dither(ctx, 14, "#6b2d35");
      px(ctx, 70, 4, 5, 5, "#ffd8a0"); /* 夕日 */
      px(ctx, 6, 15, 12, 6, "#54241d"); px(ctx, 8, 13, 8, 2, "#54241d");   /* 台地 */
      px(ctx, 74, 16, 14, 5, "#54241d"); px(ctx, 77, 14, 8, 2, "#54241d");
      ground(ctx, "#6e3520", "#8a4a2a");
    },

    /* XL5 グラフの塔（塔の上・夜空） */
    tower: function (ctx) {
      band(ctx, 0, HORIZON, "#14284a");
      stars(ctx, 3, "#4a6a9e");
      px(ctx, 80, 3, 6, 6, "#f0e6c0"); px(ctx, 80, 3, 1, 1, "#14284a");   /* 月 */
      px(ctx, 85, 3, 1, 1, "#14284a"); px(ctx, 80, 8, 1, 1, "#14284a"); px(ctx, 85, 8, 1, 1, "#14284a");
      px(ctx, 8, 14, 14, 2, "#2c4468"); px(ctx, 12, 13, 6, 1, "#2c4468"); /* 雲 */
      px(ctx, 46, 9, 16, 2, "#2c4468"); px(ctx, 50, 8, 8, 1, "#2c4468");
      ground(ctx, "#3d3d55", "#50506e");
      for (var x = 0; x < W; x += 6) px(ctx, x, HORIZON + 1, 1, 2, "#28283c"); /* 石畳の目地 */
    },

    /* WD1 もじの草原 */
    grass: function (ctx) {
      band(ctx, 0, HORIZON, "#1d3a5f");
      stars(ctx, 5, "#3d5f8a");
      tri(ctx, 16, HORIZON, 8, "#24476b"); tri(ctx, 78, HORIZON, 10, "#24476b"); /* 遠くの山 */
      px(ctx, 34, 6, 12, 2, "#2c4d73"); px(ctx, 38, 5, 5, 1, "#2c4d73");        /* 雲 */
      ground(ctx, "#2c6b2c", "#3d8a3d");
      for (var x = 2; x < W; x += 7) px(ctx, x, HORIZON + 2 + (x % 4), 1, 2, "#4da34d"); /* 草 */
    },

    /* WD2 だんらくの谷 */
    valley: function (ctx) {
      band(ctx, 0, HORIZON, "#122c3d");
      stars(ctx, 7, "#2e5266");
      for (var r = 0; r < 10; r++) {                       /* 両側のがけ */
        px(ctx, 0, r * 2, 16 - r, 2, "#1d4a52");
        px(ctx, W - (16 - r), r * 2, 16 - r, 2, "#1d4a52");
      }
      px(ctx, 44, 4, 8, 1, "#2e5266");                     /* 谷間の霧 */
      px(ctx, 40, 8, 16, 1, "#2e5266");
      ground(ctx, "#1b4448", "#256058");
    },

    /* WD3 ひょうと画像の湖 */
    lake: function (ctx) {
      band(ctx, 0, HORIZON, "#122a44");
      stars(ctx, 9, "#3d5f8a");
      tri(ctx, 24, HORIZON, 7, "#1b3d5c"); tri(ctx, 66, HORIZON, 9, "#1b3d5c");
      band(ctx, HORIZON, H, "#183d5c");                    /* 水面 */
      dither(ctx, HORIZON, "#122a44");
      for (var y = HORIZON + 3; y < H; y += 3) {           /* 波のきらめき */
        for (var x = (y % 2) * 4 + 2; x < W; x += 12) px(ctx, x, y, 3, 1, "#2a6a8a");
      }
    },

    /* WD4 ページのとりで */
    fort: function (ctx) {
      band(ctx, 0, HORIZON, "#2b1d33");
      stars(ctx, 11, "#54446b");
      px(ctx, 8, 10, 10, 11, "#3d2f4d");                   /* 城壁とやぐら */
      px(ctx, 78, 10, 10, 11, "#3d2f4d");
      for (var x = 8; x < 18; x += 3) px(ctx, x, 8, 2, 2, "#3d2f4d");
      for (x = 78; x < 88; x += 3) px(ctx, x, 8, 2, 2, "#3d2f4d");
      px(ctx, 18, 14, 60, 7, "#332742");                   /* つなぎの城壁 */
      for (x = 20; x < 78; x += 4) px(ctx, x, 12, 2, 2, "#332742");
      px(ctx, 12, 14, 2, 3, "#ffb03b"); px(ctx, 82, 14, 2, 3, "#ffb03b"); /* たいまつ */
      ground(ctx, "#3a2f47", "#4d3f5e");
    },

    /* WD5 こうえつの神殿 */
    temple: function (ctx) {
      band(ctx, 0, HORIZON, "#241a38");
      stars(ctx, 13, "#8a7a3d");
      for (var x = 8; x < W - 6; x += 20) {                /* 柱 */
        px(ctx, x, 5, 4, HORIZON - 5, "#4a3a66");
        px(ctx, x - 1, 4, 6, 2, "#5c4a7d");
        px(ctx, x - 1, HORIZON - 1, 6, 1, "#5c4a7d");
      }
      px(ctx, 0, 2, W, 2, "#3d2f52");                      /* 天井のはり */
      ground(ctx, "#38284f", "#4a3866");
    },

    /* XL6 ブックの大としょかん */
    library: function (ctx) {
      band(ctx, 0, HORIZON, "#241a12");
      var cols = ["#8a4a2a", "#2a6a8a", "#4a8a3d", "#8a2a4a", "#8a7a2a"];
      for (var s = 0; s < 2; s++) {                        /* 本棚2段 */
        var y0 = 3 + s * 9;
        px(ctx, 4, y0 + 6, 88, 2, "#4a3319");              /* 棚板 */
        for (var x = 6; x < 90; x += 4) {
          var bh = 4 + (x % 3);
          px(ctx, x, y0 + 6 - bh, 3, bh, cols[Math.floor(x / 4) % cols.length]);
        }
      }
      ground(ctx, "#33241a", "#4a3626");
    },

    /* WD6 ぶんしょ管理の宝物庫 */
    vault: function (ctx) {
      band(ctx, 0, HORIZON, "#1d1428");
      stars(ctx, 17, "#8a7a3d");
      px(ctx, 10, 15, 10, 6, "#6b4a2a"); px(ctx, 10, 13, 10, 2, "#8a5f33");  /* 宝箱 */
      px(ctx, 14, 15, 2, 2, "#ffd23b");
      px(ctx, 76, 15, 10, 6, "#6b4a2a"); px(ctx, 76, 13, 10, 2, "#8a5f33");
      px(ctx, 80, 15, 2, 2, "#ffd23b");
      tri(ctx, 30, HORIZON, 3, "#c0a02a"); tri(ctx, 64, HORIZON, 4, "#c0a02a"); /* 金貨の山 */
      ground(ctx, "#2b1f38", "#3d2f4d");
    },

    /* ふっかつのほこら（復習） */
    shrine: function (ctx) {
      band(ctx, 0, HORIZON, "#101c33");
      stars(ctx, 15, "#3d8a8a");
      px(ctx, 38, 4, 20, 2, "#2a5e66");                    /* ほこらの門 */
      px(ctx, 36, 6, 24, 1, "#2a5e66");
      px(ctx, 40, 7, 3, HORIZON - 7, "#2a5e66");
      px(ctx, 53, 7, 3, HORIZON - 7, "#2a5e66");
      px(ctx, 46, 10, 4, 4, "#5ee0c0");                    /* 中央に浮かぶ光 */
      px(ctx, 47, 9, 2, 1, "#aef0e0"); px(ctx, 47, 14, 2, 1, "#aef0e0");
      ground(ctx, "#16303d", "#204a52");
    },

    /* まおうの城（最終決戦） */
    final: function (ctx) {
      band(ctx, 0, 10, "#1a0510");
      band(ctx, 10, HORIZON, "#3d0a14"); dither(ctx, 10, "#1a0510");
      px(ctx, 74, 3, 6, 6, "#c03040"); px(ctx, 74, 3, 1, 1, "#1a0510");   /* 赤い月 */
      px(ctx, 79, 3, 1, 1, "#1a0510"); px(ctx, 74, 8, 1, 1, "#1a0510"); px(ctx, 79, 8, 1, 1, "#1a0510");
      px(ctx, 6, 8, 8, 13, "#14060e");                     /* 城のシルエット */
      px(ctx, 82, 8, 8, 13, "#14060e");
      px(ctx, 14, 12, 68, 9, "#14060e");
      for (var x = 6; x < 14; x += 3) px(ctx, x, 6, 2, 2, "#14060e");
      for (x = 82; x < 90; x += 3) px(ctx, x, 6, 2, 2, "#14060e");
      for (x = 16; x < 82; x += 4) px(ctx, x, 10, 2, 2, "#14060e");
      px(ctx, 46, 14, 4, 7, "#c03040");                    /* 城門の赤い光 */
      ground(ctx, "#1c0e14", "#33141f");
    }
  };

  /* クエストID → 背景テーマの対応表（新しいクエストを足したらここにも追記） */
  var QUEST_BG = {
    XL1: "forest", XL2: "cave", XL3: "castle", XL4: "wild", XL5: "tower", XL6: "library",
    WD1: "grass", WD2: "valley", WD3: "lake", WD4: "fort", WD5: "temple", WD6: "vault"
  };

  function draw(canvas, theme) {
    canvas.width = W;
    canvas.height = H;
    var ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    (THEMES[theme] || THEMES.grass)(ctx);
  }

  return {
    draw: draw,
    forQuest: function (questId) { return QUEST_BG[questId] || "grass"; }
  };
})();
