/* =========================================================
 * MOS QUEST クエストクリア報酬（たからばこ）
 * 通貨・ガチャは作らず、称号／モンスターのシャイニー色違い／
 * ボーナスEXP のいずれかを必ずひとつ手に入れる。
 * ========================================================= */

var TREASURE_TITLES = [
  "コツコツ冒険者", "反撃の達人", "たいねつの探求者", "しゅうじゅくの賢者", "はやとちり克服者",
  "れんぞく正解の使い手", "ふっかつの守り人", "きろくやぶりの旅人", "こんじょうの盾", "しゅうかんの魔導士"
];

var Treasure = (function () {
  function pickShinyPalette(basePalette) {
    return basePalette === "gold" ? "purple" : "gold";
  }

  /* save を更新し、宝箱の中身を表す descriptor を返す（表示用。type: "title"|"palette"|"xp"） */
  function grant(save, quest) {
    var roll = Math.random();
    if (roll < 0.25 && save.titles.length < TREASURE_TITLES.length) {
      var next = TREASURE_TITLES[save.titles.length];
      save.titles.push(next);
      return { type: "title", label: "あたらしい しょうごう「" + next + "」を てにいれた！" };
    }
    if (roll < 0.40 && quest && quest.mob && !save.shinyMonsters[quest.mob.name]) {
      var pal = pickShinyPalette(quest.mob.palette);
      save.shinyMonsters[quest.mob.name] = pal;
      return {
        type: "palette",
        label: "「" + quest.mob.name + "」の シャイニーいろを 図鑑で かいほうした！",
        shape: quest.mob.shape, palette: pal
      };
    }
    var xp = 15 + Math.floor(Math.random() * 16);
    return { type: "xp", xp: xp, label: "ボーナス ＋" + xp + " EXP を てにいれた！" };
  }

  return { grant: grant };
})();
