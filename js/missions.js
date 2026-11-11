/* =========================================================
 * MOS QUEST デイリーミッション
 * その日ごとにランダムで3つ選ばれる、ちいさな目標。
 * 達成すると ボーナスEXP がもらえる（MISSION_BONUS_XP は game.js 側で加算）。
 * ========================================================= */

var MISSION_TEMPLATES = [
  { id: "correct3", label: "3もん せいかいする", type: "correct", target: 3 },
  { id: "combo3", label: "コンボ3いじょう たっせいする", type: "comboReach", target: 3 },
  { id: "review1", label: "復習を 1もん せいかいする", type: "reviewCorrect", target: 1 },
  { id: "answer10", label: "10もん こたえる", type: "answered", target: 10 },
  { id: "quest1", label: "クエストを 1つ クリアする", type: "questClear", target: 1 },
  { id: "bossWin1", label: "ボスを 1体 たおす", type: "bossWin", target: 1 },
  { id: "combo5", label: "コンボ5いじょう たっせいする", type: "comboReach", target: 5 },
  { id: "crit1", label: "かいしんの いちげきを 1回 だす", type: "crit", target: 1 },
  /* クイック（早押し）のミッションは作らない：読むのが速い人だけがEXPを得る形にしないため */
  { id: "special1", label: "ひっさつわざを 1回 はなつ", type: "special", target: 1 },
  { id: "kills8", label: "モンスターを 8体 たおす", type: "kills", target: 8 },
  /* need: この条件を満たす人にだけ出す（まだ入れない場所のミッションを出さない） */
  { id: "endless5", label: "むげんの めいきゅうで 5かい もぐる", type: "endlessFloor", target: 5,
    need: function () { return clearedCount() >= ENDLESS_UNLOCK; } }
];

var Missions = (function () {
  function pad(n) { return n < 10 ? "0" + n : "" + n; }
  function todayStr() {
    var d = new Date();
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }

  /* 日付が変わっていたら3つ選び直す。変わっていなければ何もしない（true=選び直した） */
  function ensureToday(save) {
    var today = todayStr();
    if (save.missions.date === today) return false;
    var avail = MISSION_TEMPLATES.filter(function (t) { return !t.need || t.need(save); });
    var picks = shuffle(avail).slice(0, 3);
    save.missions = {
      date: today,
      list: picks.map(function (t) {
        return { id: t.id, label: t.label, type: t.type, target: t.target, progress: 0, done: false };
      })
    };
    return true;
  }

  /* type に該当するミッションの進捗を進める。達成したミッションを返す（なければ null）。 */
  function record(save, type, amount) {
    var completed = null;
    save.missions.list.forEach(function (m) {
      if (m.done || m.type !== type) return;
      if (type === "comboReach") m.progress = Math.max(m.progress, amount);
      else m.progress += (amount || 1);
      if (m.progress >= m.target) { m.done = true; completed = m; }
    });
    if (completed) save.stats.missionsCompleted++;
    return completed;
  }

  return { ensureToday: ensureToday, record: record };
})();

var MISSION_BONUS_XP = 20;
