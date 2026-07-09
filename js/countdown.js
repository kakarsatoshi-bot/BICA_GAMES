/* =========================================================
 * MOS QUEST 試験日カウントダウン
 * GAME_CONFIG.EXAM_DATE（例: "2026-09-15"）が設定されているときだけ、
 * メニュー画面に「王さま／お姫さま／魔王」がランダムに一言くちを出す。
 * 未設定（空文字）なら Countdown.isEnabled() が false になり、非表示のまま。
 * ========================================================= */

var Countdown = (function () {

  function daysLeft() {
    var target = new Date(GAME_CONFIG.EXAM_DATE + "T00:00:00");
    var now = new Date();
    var todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.round((target - todayStart) / (24 * 60 * 60 * 1000));
  }

  function isEnabled() {
    return !!(GAME_CONFIG.EXAM_DATE && !isNaN(new Date(GAME_CONFIG.EXAM_DATE + "T00:00:00").getTime()));
  }

  /* 話者ごとのスプライトと、残り日数の階層ごとのセリフ */
  var SPEAKERS = {
    king:    { shape: "wizard", palette: "gold",   label: "王さま" },
    princess:{ shape: "ghost",  palette: "pink",   label: "お姫さま" },
    demon:   { shape: "demon",  palette: "dark",   label: "まおう" }
  };

  var TIERS = [
    {
      test: function (d) { return d > 30; },
      speaker: "king",
      lines: [
        "しけんまで あと {d}にち か。 あわてず じっくり れんしゅうすると よいぞ。",
        "急がずとも よい。 まいにち コツコツ クエストを こなすのじゃ。 あと{d}にち。",
        "{d}にちも あれば、まだまだ 強くなれる。 のんびり いこう。"
      ]
    },
    {
      test: function (d) { return d > 7; },
      speaker: "princess",
      lines: [
        "あと {d}にちで しけんね…？ ちゃんと 「ふっかつのほこら」も やってる？",
        "のこり{d}にち。 わたし ちょっとだけ しんぱいしてるんだから。",
        "{d}にちも あれば もぎけんてい、なんかいか うけられそう。 うけた？"
      ]
    },
    {
      test: function (d) { return d > 0; },
      speaker: "demon",
      lines: [
        "ふはは、しけんまで あと{d}にちだぞ。 まだ とっくんが たりんのではないか？",
        "のこり{d}にち…！ にがてな もんだいを ほうっておいて よいのか？",
        "{d}にち後には しんぱんの ときだ。 いまさら じたばたしても おそいかもしれんぞ…？"
      ]
    },
    {
      test: function (d) { return d === 0; },
      speaker: "demon",
      lines: [
        "きょうが その日だ…！ いままでの とっくんを しんじて いってこい！",
        "しんぱんの 日が きた。 ふるえて まて…と いいたいところだが、けんとうを いのる！"
      ]
    },
    {
      test: function () { return true; },  /* 試験日を過ぎたあとは無期限にこれ */
      speaker: "king",
      lines: [
        "しけんは おわった。 けっかは どうあれ、ここまで がんばった きみを たたえよう。",
        "つかれさまじゃった。 つぎの もくひょうに 向けて、また すこしずつ やっていくと よい。",
        "しけんの できは どうじゃったかな？ ここでの れんしゅうは 決して むだには ならぬぞ。"
      ]
    }
  ];

  function pickLine() {
    if (!isEnabled()) return null;
    var d = daysLeft();
    var tier = TIERS.filter(function (t) { return t.test(d); })[0];
    var sp = SPEAKERS[tier.speaker];
    var line = tier.lines[Math.floor(Math.random() * tier.lines.length)].replace("{d}", d);
    return { speaker: sp, text: line, days: d };
  }

  return { isEnabled: isEnabled, daysLeft: daysLeft, pickLine: pickLine };
})();
