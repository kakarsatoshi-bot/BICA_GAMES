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
  { id: "bestiary_full", name: "モンスター博士", desc: "図鑑の モンスターを ぜんぶ みつける（げきレアは 1体で OK）",
    check: function (s) {
      /* ふつうのモンスター全部＋げきレアを1体以上（げきレア全種は、べつの実績「げきレア コンプリート」）。
       * 図鑑の外のボスに会っても数に入れない。 */
      var list = buildBestiaryList(ALL_QUESTS);
      var seen = function (m) { return s.seenMonsters.indexOf(m.name) >= 0; };
      return list.filter(function (m) { return !m.rare; }).every(seen) &&
             list.filter(function (m) { return m.rare; }).some(seen);
    } },
  { id: "rare_found", name: "げきレア発見", desc: "げきレアモンスターに であう",
    check: function (s) { return RARE_MONSTERS.some(function (r) { return s.seenMonsters.indexOf(r.mob.name) >= 0; }); } },
  { id: "mission30", name: "デイリー皆勤賞", desc: "デイリーミッションを 30回 たっせいする",
    check: function (s) { return s.stats.missionsCompleted >= 30; } },
  { id: "practical_first_pass", name: "じっせん道場デビュー", desc: "はじめて じっせん課題に ごうかくする",
    check: function (s) { for (var k in s.practical) { if (s.practical[k].passed) return true; } return false; } },
  { id: "practical_master", name: "実践道場マスター", desc: "すべての じっせん課題に ごうかくする",
    check: function (s) {
      if (typeof PRACTICAL_TASKS === "undefined" || !PRACTICAL_TASKS.length) return false;
      return PRACTICAL_TASKS.every(function (t) { return s.practical[t.id] && s.practical[t.id].passed; });
    } },

  /* ---- ここから v2 で足した実績。prog は「いま いくつ／めあて いくつ」（一覧に進みぐあいを出す） ---- */
  { id: "level10", name: "いちにんまえ", desc: "レベル10に とうたつする",
    check: function (s) { return levelInfo(s.xp).level >= 10; },
    prog: function (s) { return [levelInfo(s.xp).level, 10]; } },
  { id: "level20", name: "ベテラン冒険者", desc: "レベル20に とうたつする",
    check: function (s) { return levelInfo(s.xp).level >= 20; },
    prog: function (s) { return [levelInfo(s.xp).level, 20]; } },
  { id: "level30", name: "たつじんの いき", desc: "レベル30に とうたつする",
    check: function (s) { return levelInfo(s.xp).level >= 30; },
    prog: function (s) { return [levelInfo(s.xp).level, 30]; } },
  { id: "answer500", name: "500もん とっぱ", desc: "ぜんぶで 500もん こたえる",
    check: function (s) { return s.stats.answered >= 500; },
    prog: function (s) { return [s.stats.answered, 500]; } },
  { id: "answer1000", name: "1000もん とっぱ", desc: "ぜんぶで 1000もん こたえる",
    check: function (s) { return s.stats.answered >= 1000; },
    prog: function (s) { return [s.stats.answered, 1000]; } },
  { id: "combo10", name: "とまらない れんげき", desc: "コンボ10いじょうを たっせいする",
    check: function (s) { return s.stats.bestCombo >= 10; },
    prog: function (s) { return [s.stats.bestCombo, 10]; } },
  { id: "combo20", name: "れんげきの かみ", desc: "コンボ20いじょうを たっせいする",
    check: function (s) { return s.stats.bestCombo >= 20; },
    prog: function (s) { return [s.stats.bestCombo, 20]; } },
  { id: "crit10", name: "かいしんの つかいて", desc: "かいしんの いちげきを 10回 だす",
    check: function (s) { return s.stats.crits >= 10; },
    prog: function (s) { return [s.stats.crits, 10]; } },
  { id: "crit100", name: "かいしん マスター", desc: "かいしんの いちげきを 100回 だす",
    check: function (s) { return s.stats.crits >= 100; },
    prog: function (s) { return [s.stats.crits, 100]; } },
  { id: "special1", name: "ひっさつ かいがん", desc: "ひっさつわざを はじめて はなつ",
    check: function (s) { return s.stats.specials >= 1; } },
  { id: "special30", name: "ひっさつの たつじん", desc: "ひっさつわざを 30回 はなつ",
    check: function (s) { return s.stats.specials >= 30; },
    prog: function (s) { return [s.stats.specials, 30]; } },
  /* noGoal: メニューの「つぎの めあて」には出さない（早押しを目標として すすめない） */
  { id: "quick50", name: "しっぷうの あたま", desc: "クイックせいかいを 50回 きめる", noGoal: true,
    check: function (s) { return s.stats.quicks >= 50; },
    prog: function (s) { return [s.stats.quicks, 50]; } },
  { id: "kills100", name: "モンスターハンター", desc: "モンスターを 100体 たおす",
    check: function (s) { return s.stats.kills >= 100; },
    prog: function (s) { return [s.stats.kills, 100]; } },
  { id: "kills500", name: "ひゃくせんれんま", desc: "モンスターを 500体 たおす",
    check: function (s) { return s.stats.kills >= 500; },
    prog: function (s) { return [s.stats.kills, 500]; } },
  { id: "kills1000", name: "でんせつの かりうど", desc: "モンスターを 1000体 たおす",
    check: function (s) { return s.stats.kills >= 1000; },
    prog: function (s) { return [s.stats.kills, 1000]; } },
  { id: "medal_gold", name: "きんメダリスト", desc: "おなじ モンスターを 100体 たおす",
    check: function (s) { for (var k in s.kills) { if (s.kills[k] >= 100) return true; } return false; },
    prog: function (s) { var m = 0; for (var k in s.kills) { if (s.kills[k] > m) m = s.kills[k]; } return [m, 100]; } },
  { id: "shiny1", name: "色ちがい はっけん", desc: "色ちがいの モンスターを 1体 図鑑に とうろくする",
    check: function (s) { return Object.keys(s.shinyMonsters).length >= 1; } },
  { id: "shiny5", name: "色ちがい コレクター", desc: "色ちがいの モンスターを 5体 図鑑に とうろくする",
    check: function (s) { return Object.keys(s.shinyMonsters).length >= 5; },
    prog: function (s) { return [Object.keys(s.shinyMonsters).length, 5]; } },
  { id: "rare_all", name: "げきレア コンプリート", desc: "げきレアモンスター ぜんしゅるいに であう",
    check: function (s) { return RARE_MONSTERS.every(function (r) { return s.seenMonsters.indexOf(r.mob.name) >= 0; }); },
    prog: function (s) {
      return [RARE_MONSTERS.filter(function (r) { return s.seenMonsters.indexOf(r.mob.name) >= 0; }).length, RARE_MONSTERS.length];
    } },
  { id: "stars_all", name: "オール★3", desc: "すべての クエストで ★3を とる",
    check: function (s) { return ALL_QUESTS.every(function (q) { return s.quests[q.id] && s.quests[q.id].stars === 3; }); },
    prog: function (s) {
      return [ALL_QUESTS.filter(function (q) { return s.quests[q.id] && s.quests[q.id].stars === 3; }).length, ALL_QUESTS.length];
    } },
  { id: "titles5", name: "しょうごう コレクター", desc: "しょうごうを 5つ あつめる",
    check: function (s) { return s.titles.length >= 5; },
    prog: function (s) { return [s.titles.length, 5]; } },
  { id: "endless10", name: "ちか10かい とっぱ", desc: "むげんの めいきゅうで ちか10かいに とうたつする",
    check: function (s) { return s.endless.best >= 10; },
    prog: function (s) { return [s.endless.best, 10]; } },
  { id: "endless20", name: "ちか20かい とっぱ", desc: "むげんの めいきゅうで ちか20かいに とうたつする",
    check: function (s) { return s.endless.best >= 20; },
    prog: function (s) { return [s.endless.best, 20]; } },
  { id: "endless30", name: "ちか30かい とっぱ", desc: "むげんの めいきゅうで ちか30かいに とうたつする",
    check: function (s) { return s.endless.best >= 30; },
    prog: function (s) { return [s.endless.best, 30]; } },
  { id: "endless50", name: "ちか50かい とっぱ", desc: "むげんの めいきゅうで ちか50かいに とうたつする",
    check: function (s) { return s.endless.best >= 50; },
    prog: function (s) { return [s.endless.best, 50]; } },
  { id: "expert_clear", name: "しんおう討伐者", desc: "エキスパートの奥義を クリアする",
    check: function (s) { return !!s.expertClear; } }
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
