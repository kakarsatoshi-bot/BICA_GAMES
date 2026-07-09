/* =========================================================
 * MOS QUEST 試験日カウントダウン
 * GAME_CONFIG.EXAM_DATES（例: ["2026-09-04", "2026-12-06"]）に
 * わかっている試験日をすべて入れておくと、メニュー画面に
 * 「王さま／お姫さま／魔王」がランダムに一言くちを出す。
 *
 * 試験日は学校ごとに決まる（規則性なし）ため、先生が把握している
 * 日付を配列にリストしておく方式。今日から見て一番近い「未来の」日付を
 * 自動で選ぶので、1つの試験日が過ぎればリストの次の日付に自動で切り替わる。
 * すべて過ぎている場合は、一番新しい過去日を使って労いメッセージを出し続ける。
 * 空配列 [] のままなら Countdown.isEnabled() が false になり、非表示のまま。
 * ========================================================= */

var Countdown = (function () {

  function parseDates() {
    return (GAME_CONFIG.EXAM_DATES || [])
      .map(function (s) { return new Date(s + "T00:00:00"); })
      .filter(function (d) { return !isNaN(d.getTime()); })
      .sort(function (a, b) { return a - b; });
  }

  /* 今日から見て「今から扱うべき」試験日を1つ選ぶ。
   * 未来の日付があれば、その中で一番近いもの。すべて過去なら一番新しい過去日。 */
  function activeExamDate() {
    var dates = parseDates();
    if (!dates.length) return null;
    var now = new Date();
    var todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    var upcoming = dates.filter(function (d) { return d >= todayStart; });
    return upcoming.length ? upcoming[0] : dates[dates.length - 1];
  }

  function daysLeft() {
    var target = activeExamDate();
    if (!target) return null;
    var now = new Date();
    var todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.round((target - todayStart) / (24 * 60 * 60 * 1000));
  }

  function isEnabled() {
    return parseDates().length > 0;
  }

  /* "9月4日" のような表示用の日付文字列を作る */
  function formatDate(d) {
    return (d.getMonth() + 1) + "月" + d.getDate() + "日";
  }

  /* 「次のMOS試験日 9月4日まで あと57日」のような見出し文。
   * 試験日をすべて過ぎている（days < 0）ときは表示しない（null）。 */
  function headline() {
    var target = activeExamDate();
    var d = daysLeft();
    if (!target || d === null || d < 0) return null;
    return "次のMOS試験日 " + formatDate(target) + "まで あと" + d + "日";
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
    return { speaker: sp, text: line, days: d, headline: headline() };
  }

  return { isEnabled: isEnabled, daysLeft: daysLeft, pickLine: pickLine };
})();
