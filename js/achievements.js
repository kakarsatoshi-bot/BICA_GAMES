/* =========================================================
 * MOS QUEST 実績（じっせき）システム
 * 各実績は save の状態を見る純粋な判定関数を持つ。
 * bestiary.js と同じく「定義＋セーブ状態のマージ」で毎回まるごと再評価する。
 * ========================================================= */

var ACHIEVEMENTS = [
  { id: "first_quest", name: "はじめの一歩", desc: "はじめて クエストを クリアする",
    check: function (s) { return clearedCount() >= 1; } },
  { id: "level5", name: "かけだし卒業", desc: "レベル5に とうたつする",
    check: function (s) { return levelInfo(s.xp).level >= 5; } },
  { id: "combo5", name: "れんげきの たつじん", desc: "コンボ5いじょうを たっせいする",
    check: function (s) { return s.stats.bestCombo >= 5; } },
  { id: "streak3", name: "みっかぼうずじゃない", desc: "3日 れんぞくで ログインする",
    check: function (s) { return s.streak.current >= 3; } },
  { id: "streak7", name: "7日れんぞくログイン", desc: "7日 れんぞくで ログインする",
    check: function (s) { return s.streak.current >= 7; } },
  { id: "streak30", name: "けいぞくは ちからなり", desc: "さいちょう れんぞくログイン30日",
    check: function (s) { return s.streak.longest >= 30; } },
  { id: "perfect_quest", name: "全問正解でクリア", desc: "1つの クエストを ノーミスで クリアする",
    check: function (s) { for (var k in s.quests) { if (s.quests[k].stars === 3) return true; } return false; } },
  { id: "all_quests", name: "コンプリートマスター", desc: "すべての クエストを クリアする",
    check: function (s) { return clearedCount() >= ALL_QUESTS.length; } },
  { id: "boss10", name: "ボス10体討伐", desc: "ボスを 10体 とうばつする",
    check: function (s) { return s.stats.bossWins >= 10; } },
  { id: "final_clear", name: "まおう討伐者", desc: "まおうの城を クリアする",
    check: function (s) { return !!s.finalClear; } },
  { id: "exam_pass", name: "もぎけんてい合格", desc: "もぎけんていで 700点いじょう とる",
    check: function (s) { var e = s.exams || {}; return (e.excel && e.excel.best >= 700) || (e.word && e.word.best >= 700); } },
  { id: "exam_900", name: "模試900点以上", desc: "もぎけんていで 900点いじょう とる",
    check: function (s) { var e = s.exams || {}; return (e.excel && e.excel.best >= 900) || (e.word && e.word.best >= 900); } },
  { id: "mastery20", name: "もんだいマスター", desc: "20もん いじょう しゅうじゅく(box5)にする",
    check: function (s) { var n = 0; for (var q in s.records) { if (s.records[q].box >= 5) n++; } return n >= 20; } },
  { id: "bestiary_full", name: "モンスター博士", desc: "図鑑の モンスターを ぜんぶ みつける",
    check: function (s) { return s.seenMonsters.length >= buildBestiaryList(ALL_QUESTS).length; } },
  { id: "rare_found", name: "げきレア発見", desc: "げきレアモンスターに であう",
    check: function (s) { return s.seenMonsters.indexOf(RARE_MONSTER.name) >= 0; } },
  { id: "mission30", name: "デイリー皆勤賞", desc: "デイリーミッションを 30回 たっせいする",
    check: function (s) { return s.stats.missionsCompleted >= 30; } },
  { id: "practical_first_pass", name: "じっせん道場デビュー", desc: "はじめて じっせん課題に ごうかくする",
    check: function (s) { for (var k in s.practical) { if (s.practical[k].passed) return true; } return false; } },
  { id: "practical_master", name: "実践道場マスター", desc: "すべての じっせん課題に ごうかくする",
    check: function (s) {
      if (typeof PRACTICAL_TASKS === "undefined" || !PRACTICAL_TASKS.length) return false;
      return PRACTICAL_TASKS.every(function (t) { return s.practical[t.id] && s.practical[t.id].passed; });
    } }
];

/* まだ解除していない実績のうち、条件を満たしたものを解除して返す（新規解除分の配列）。 */
function checkAchievements(save) {
  var unlocked = [];
  ACHIEVEMENTS.forEach(function (a) {
    if (!save.achievements[a.id] && a.check(save)) {
      save.achievements[a.id] = Date.now();
      unlocked.push(a);
    }
  });
  return unlocked;
}

var Achievements = { list: ACHIEVEMENTS, check: checkAchievements };
