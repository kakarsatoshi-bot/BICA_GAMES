/* =========================================================
 * MOS QUEST クエストクリア報酬（たからばこ）
 * 通貨・ガチャは作らず、称号／モンスターのシャイニー色違い／
 * ボーナスEXP のいずれかを必ずひとつ手に入れる。
 * 中身には「めずらしさ」（ノーマル／レア／スーパーレア）があり、開けるときの演出が変わる。
 * ========================================================= */

/* ⚠️ 並び順を変えない・消さない（生徒が持っている しょうごうは、この文字列で保存されている） */
var TREASURE_TITLES = [
  "コツコツ冒険者", "反撃の達人", "たいねつの探求者", "しゅうじゅくの賢者", "はやとちり克服者",
  "れんぞく正解の使い手", "ふっかつの守り人", "きろくやぶりの旅人", "こんじょうの盾", "しゅうかんの魔導士",
  "セルの まもりびと", "リボンの たつじん", "ショートカットの つかいて", "すうしきの れんきんじゅつし", "グラフの えかき",
  "いんさつの しょくにん", "スタイルの まほうつかい", "もくじの あんないにん", "ひょうの けんちくか", "ほぞんを わすれぬ者"
];

var Treasure = (function () {
  function shinyPalette(basePalette) {
    return basePalette === "gold" ? "purple" : "gold";
  }

  /* save を更新し、宝箱の中身を表す descriptor を返す
   * （表示用。type: "title"|"palette"|"xp"、rarity: "normal"|"rare"|"super"）。
   * ctx.stars が 3（ノーミス）だと、しょうごうが少し出やすい。 */
  function grant(save, quest, ctx) {
    var roll = Math.random();
    var luck = ctx && ctx.stars === 3 ? 0.08 : 0;
    var titlesLeft = TREASURE_TITLES.filter(function (t) { return save.titles.indexOf(t) < 0; });
    if (roll < 0.25 + luck && titlesLeft.length) {
      var next = titlesLeft[0];
      save.titles.push(next);
      return { type: "title", rarity: "rare", label: "あたらしい しょうごう「" + next + "」を てにいれた！" };
    }
    if (roll < 0.40 + luck && quest && quest.mob && !save.shinyMonsters[quest.mob.name]) {
      var pal = shinyPalette(quest.mob.palette);
      save.shinyMonsters[quest.mob.name] = pal;
      return {
        type: "palette", rarity: "super",
        label: "「" + quest.mob.name + "」の シャイニーいろを 図鑑で かいほうした！",
        shape: quest.mob.shape, palette: pal
      };
    }
    /* 10回に1回くらい、おおあたりのEXP */
    if (Math.random() < 0.1) {
      var big = 40 + Math.floor(Math.random() * 21);
      return { type: "xp", rarity: "rare", xp: big, label: "おおあたり！ ボーナス ＋" + big + " EXP を てにいれた！" };
    }
    var xp = 15 + Math.floor(Math.random() * 16);
    return { type: "xp", rarity: "normal", xp: xp, label: "ボーナス ＋" + xp + " EXP を てにいれた！" };
  }

  return { grant: grant, shinyPalette: shinyPalette };
})();
