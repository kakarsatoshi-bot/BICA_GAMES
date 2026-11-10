/* =========================================================
 * MOS QUEST ゲームエンジン本体
 * 画面制御・バトル・経験値/レベル/ランク・セーブ・同期
 * ========================================================= */

/* ---------- ユーティリティ ---------- */
function $(sel) { return document.querySelector(sel); }
function shuffle(arr) {
  var a = arr.slice();
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function uid() {
  return "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/* ---------- 問題インデックス ---------- */
var SUBJECTS = [QUEST_DATA_EXCEL, QUEST_DATA_WORD];
var QUESTION_INDEX = {};   // qid -> {q:問題, quest:クエスト, subject}
var ALL_QUESTS = [];       // 全クエスト（順序つき）
SUBJECTS.forEach(function (sub) {
  sub.quests.forEach(function (quest) {
    quest.subject = sub.subject;
    ALL_QUESTS.push(quest);
    quest.questions.forEach(function (q) {
      QUESTION_INDEX[q.id] = { q: q, quest: quest, subject: sub.subject };
    });
  });
});

/* SRS.dueList/weakList は save.records 全体（エキスパートの問題を答えた記録も含む）を
 * 見境なく返すため、まおうの城・ふっかつのほこら等の「Specialist側」の消費先では
 * 必ずこのフィルターを通す（そうしないとエキスパート限定のidがQUESTION_INDEXに無く
 * qs.map(...).q が undefined になってクラッシュする）。エキスパート側は
 * EXPERT_QUESTION_INDEX で同様にフィルターする（startExpert() 参照）。 */
function specialistDueList() {
  return SRS.dueList(save.records).filter(function (id) { return !!QUESTION_INDEX[id]; });
}
function specialistWeakList() {
  return SRS.weakList(save.records).filter(function (id) { return !!QUESTION_INDEX[id]; });
}

/* ---------- レベル・ランク ---------- */
function xpNeedFor(level) { return 30 + (level - 1) * 12; }  // そのレベルで必要なEXP
function levelInfo(xp) {
  var level = 1, rest = xp;
  while (level < 99 && rest >= xpNeedFor(level)) { rest -= xpNeedFor(level); level++; }
  return { level: level, cur: rest, need: xpNeedFor(level) };
}
var RANKS = [
  [1,  "みならい冒険者"],
  [5,  "かけだし戦士"],
  [10, "ブロンズナイト"],
  [15, "シルバーナイト"],
  [20, "ゴールドナイト"],
  [25, "りゅうきへい"],
  [30, "けんじゃ"],
  [40, "マスターナイト"],
  [50, "でんせつの勇者"],
  [70, "MOSマスター"]
];
function rankFor(level) {
  var name = RANKS[0][1];
  RANKS.forEach(function (r) { if (level >= r[0]) name = r[1]; });
  return name;
}

/* ぶき（見た目だけ。レベルで つるぎの色が かわる。強さは かわらない） */
var WEAPONS = [
  [1,  "きの つるぎ",       "#e0c08a"],
  [5,  "てつの つるぎ",     "#d7dbe3"],
  [10, "ほのおの つるぎ",   "#ff9d3b"],
  [20, "いなずまの つるぎ", "#fff27a"],
  [30, "こおりの つるぎ",   "#6ee7ff"],
  [40, "ひかりの つるぎ",   "#ffffff"],
  [50, "でんせつの つるぎ", "#c79bff"]
];
function weaponFor(level) {
  var w = WEAPONS[0];
  WEAPONS.forEach(function (x) { if (level >= x[0]) w = x; });
  return { name: w[1], color: w[2] };
}

/* ---------- セーブデータ ---------- */
var SAVE_KEY = "mosquest_save_v1";
var save = null;

function loadSave() {
  try {
    var raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}
function persist() {
  localStorage.setItem(SAVE_KEY, JSON.stringify(save));
}
/* 新しく足した項目が無ければ初期値を入れる（旧セーブとの後方互換。新規セーブにも同じものを通す）。
 * ⚠️ 既にある項目の名前・意味は変えない（生徒のセーブが読めなくなる）。 */
function ensureSaveShape(s) {
  s.seenMonsters = s.seenMonsters || [];
  s.streak = s.streak || { current: 0, longest: 0, lastLoginDate: null };
  s.missions = s.missions || { date: null, list: [] };
  s.achievements = s.achievements || {};
  s.titles = s.titles || [];
  s.shinyMonsters = s.shinyMonsters || {};
  s.stats.missionsCompleted = s.stats.missionsCompleted || 0;
  s.player.equippedTitle = s.player.equippedTitle || null;
  s.expertClear = s.expertClear || false;
  s.practical = s.practical || {};
  /* v2 で足したもの */
  s.kills = s.kills || {};                 // モンスター名 -> たおした数
  s.endless = s.endless || { best: 0, runs: 0, totalFloors: 0 };   // むげんの めいきゅうの記録
  s.stats.crits = s.stats.crits || 0;      // かいしんの いちげき
  s.stats.quicks = s.stats.quicks || 0;    // クイックせいかい
  s.stats.specials = s.stats.specials || 0; // ひっさつわざ
  s.stats.kills = s.stats.kills || 0;      // たおしたモンスターの合計
  return s;
}
function newSave(name, klass) {
  return ensureSaveShape({
    player: { id: uid(), name: name, klass: klass, createdAt: Date.now(), equippedTitle: null },
    xp: 0,
    records: {},   // qid -> SRS記録
    quests: {},    // questId -> {stars, clears, bossWins}
    stats: { answered: 0, correct: 0, bossWins: 0, bestCombo: 0, missionsCompleted: 0 },
    finalClear: false,
    expertClear: false,   // まおうの城のさらに奥、エキスパートのかくしダンジョン討伐ずみか
    seenMonsters: [],   // モンスター図鑑：遭遇ずみのモンスター名
    streak: { current: 0, longest: 0, lastLoginDate: null },
    missions: { date: null, list: [] },
    achievements: {},   // achievementId -> かいほうした時刻
    titles: [],         // たからばこで手に入れた しょうごう
    shinyMonsters: {},  // モンスター名 -> たからばこで手に入れた色ちがいのパレット名
    practical: {}       // practicalId -> {bestScore, maxScore, passed, tries}（じっせん道場の記録）
  });
}
function totalStars() {
  var s = 0;
  for (var k in save.quests) s += (save.quests[k].stars || 0);
  return s;
}
function clearedCount() {
  var n = 0;
  for (var k in save.quests) if (save.quests[k].stars > 0) n++;
  return n;
}

/* ---------- サーバー同期 ---------- */
function syncNow() {
  if (!save) return;
  var li = levelInfo(save.xp);
  Api.syncProfile({
    id: save.player.id,
    name: save.player.name,
    klass: save.player.klass,
    level: li.level,
    xp: save.xp,
    rank: rankFor(li.level),
    stars: totalStars(),
    questsCleared: clearedCount(),
    answered: save.stats.answered,
    correct: save.stats.correct,
    accuracy: save.stats.answered ? Math.round(save.stats.correct / save.stats.answered * 100) : 0,
    bossWins: save.stats.bossWins,
    finalClear: save.finalClear ? 1 : 0,
    examExcel: save.exams && save.exams.excel ? save.exams.excel.best : 0,
    examWord: save.exams && save.exams.word ? save.exams.word.best : 0
  });
}

/* ---------- 画面制御 ---------- */
function show(id) {
  document.querySelectorAll(".screen").forEach(function (s) {
    s.classList.remove("active");
  });
  $("#" + id).classList.add("active");
  /* バトルの外では、ステージの粒を止めて、マップの曲にもどす（リザルトは無音でジングルを聞かせる） */
  if (id !== "screen-battle") Fx.stopAmbient();
  if (id !== "screen-battle" && id !== "screen-result") Sound.playBgm("menu");
}
function toast(msg) {
  var t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toast._timer);
  toast._timer = setTimeout(function () { t.classList.remove("show"); }, 2200);
}

/* ---------- メッセージ（タイプライター表示） ---------- */
var typer = { timer: null, full: "", el: null, cb: null };
function typeMsg(text, cb) {
  var el = $("#battle-msg");
  clearInterval(typer.timer);
  typer.full = text; typer.el = el; typer.cb = cb || null;
  el.textContent = "";
  var i = 0;
  typer.timer = setInterval(function () {
    i += 2; // 1回で2文字ずつ（テンポ重視）
    el.textContent = text.slice(0, i);
    if (i >= text.length) finishType();
  }, 16);
}
function finishType() {
  clearInterval(typer.timer);
  typer.timer = null;
  if (typer.el) typer.el.textContent = typer.full;
  if (typer.cb) { var cb = typer.cb; typer.cb = null; cb(); }
}

/* =========================================================
 * バトル
 * ======================================================= */
var battle = null;

/* クエストのプールから出題する8問を選ぶ。
 * 優先順: 未挑戦 → 復習期限が来ている → 記憶が弱い（ボックスが低い）順。
 * 何度も周回すると自然と「まだ覚えていない問題」だけが出るようになり、
 * 全問題の取りこぼしなく合格レベルまで習熟できる。 */
function sampleQuestQuestions(quest, n) {
  var now = Date.now();
  var unseen = [], due = [], rest = [];
  quest.questions.forEach(function (q) {
    var r = save.records[q.id];
    if (!r) unseen.push(q);
    else if (r.due <= now && r.box < SRS.MAX_BOX) due.push(q);
    else rest.push(q);
  });
  rest.sort(function (a, b) { return save.records[a.id].box - save.records[b.id].box; });
  var picked = shuffle(unseen).concat(shuffle(due)).concat(rest).slice(0, n);
  return shuffle(picked);
}

/* クエスト（通常）開始 */
function startQuest(quest) {
  var qs = sampleQuestQuestions(quest, 8);
  battle = {
    mode: "quest",
    quest: quest,
    label: quest.name,
    qs: qs,
    bossFrom: qs.length - 3,  // 最後の3問はボス戦
    bossHp: 3, bossMax: 3,
    idx: 0, hearts: 3, maxHearts: 3,
    correct: 0, combo: 0, xp: 0,
    bossPhase: false, bossCorrect: 0
  };
  beginBattle();
}

/* 復習（ふっかつのほこら）開始 */
function startReview() {
  var due = specialistDueList().slice(0, 10);
  var label = "ふっかつのほこら（復習）";
  if (due.length === 0) {
    var weak = specialistWeakList().slice(0, 8);
    if (weak.length === 0) {
      toast("復習する もんだいは まだ ない！ クエストに でよう！");
      return;
    }
    due = weak;
    label = "にがて とっくん";
  }
  var qs = due.map(function (qid) { return QUESTION_INDEX[qid].q; });
  battle = {
    mode: "review",
    quest: null,
    label: label,
    qs: qs,
    bossFrom: 9999, bossHp: 0, bossMax: 0,
    idx: 0, hearts: 3, maxHearts: 3,
    correct: 0, combo: 0, xp: 0,
    bossPhase: false, bossCorrect: 0
  };
  beginBattle();
}

/* もぎけんてい: 科目えらび */
function openExamSelect() {
  $("#quests-title").textContent = "もぎ けんてい";
  var box = $("#quest-list");
  box.innerHTML = "";
  [
    { key: "excel", label: "Excel もぎけんてい", shape: "wizard", palette: "green" },
    { key: "word",  label: "Word もぎけんてい",  shape: "wizard", palette: "blue" }
  ].forEach(function (ex) {
    var div = document.createElement("div");
    div.className = "quest-card window";
    var cv = document.createElement("canvas");
    drawSprite(cv, ex.shape, ex.palette, 4);
    var info = document.createElement("div");
    info.className = "quest-info";
    var nm = document.createElement("div");
    nm.className = "quest-name";
    nm.textContent = ex.label;
    var ds = document.createElement("div");
    ds.className = "quest-desc";
    ds.textContent = "20もん / 1000てんまんてん / ごうかくライン 700てん";
    var st = document.createElement("div");
    st.className = "quest-stars";
    var best = save.exams && save.exams[ex.key] ? save.exams[ex.key].best : 0;
    st.textContent = best > 0 ? "さいこう " + best + " てん" : "みちょうせん";
    info.appendChild(nm); info.appendChild(ds); info.appendChild(st);
    div.appendChild(cv); div.appendChild(info);
    div.onclick = function () { Sound.select(); startExam(ex.key); };
    box.appendChild(div);
  });
  show("screen-quests");
}

/* もぎけんてい開始（本試験と同じ1000点満点・合格ライン700点） */
function startExam(subjectKey) {
  var sub = SUBJECTS.filter(function (s) { return s.subject === subjectKey; })[0];
  var per = Math.ceil(20 / sub.quests.length);
  var pool = [];
  sub.quests.forEach(function (q) { pool = pool.concat(sampleQuestQuestions(q, per)); });
  var qs = shuffle(pool).slice(0, 20);
  battle = {
    mode: "exam",
    subjectKey: subjectKey,
    quest: null,
    label: (subjectKey === "excel" ? "Excel" : "Word") + " もぎけんてい",
    qs: qs,
    bossFrom: 9999, bossHp: 0, bossMax: 0,
    idx: 0, hearts: 1, maxHearts: 1, noFail: true,
    correct: 0, combo: 0, xp: 0,
    bossPhase: false, bossCorrect: 0,
    perQuest: {}
  };
  beginBattle();
}

/* まおうの城（最終決戦）開始 */
function startFinal() {
  var pool = Object.keys(QUESTION_INDEX);
  var weak = specialistWeakList().slice(0, 6);
  var rest = shuffle(pool.filter(function (id) { return weak.indexOf(id) < 0; }));
  var ids = weak.concat(rest).slice(0, 12);
  var qs = shuffle(ids.map(function (qid) { return QUESTION_INDEX[qid].q; }));
  battle = {
    mode: "final",
    quest: null,
    label: "まおうの城",
    qs: qs,
    bossFrom: 0,               // 全問ボス戦
    bossHp: 9, bossMax: 9,     // 12問中9問せいかいで討伐
    idx: 0, hearts: 5, maxHearts: 5,
    correct: 0, combo: 0, xp: 0,
    bossPhase: false, bossCorrect: 0
  };
  beginBattle();
}

/* エキスパートのかくしダンジョン最終決戦（まおうの城のさらに奥） */
function startExpert() {
  var pool = Object.keys(EXPERT_QUESTION_INDEX);
  var weak = SRS.weakList(save.records).filter(function (id) { return !!EXPERT_QUESTION_INDEX[id]; }).slice(0, 6);
  var rest = shuffle(pool.filter(function (id) { return weak.indexOf(id) < 0; }));
  var ids = weak.concat(rest).slice(0, 12);
  var qs = shuffle(ids.map(function (qid) { return EXPERT_QUESTION_INDEX[qid].q; }));
  battle = {
    mode: "expert",
    quest: null,
    label: "エキスパートの奥義",
    qs: qs,
    bossFrom: 0,               // 全問ボス戦
    bossHp: 9, bossMax: 9,     // 12問中9問せいかいで討伐
    idx: 0, hearts: 5, maxHearts: 5,
    correct: 0, combo: 0, xp: 0,
    bossPhase: false, bossCorrect: 0
  };
  beginBattle();
}

/* =========================================================
 * バトルの味つけ（数値はここで調整する）
 * ======================================================= */
var TUNE = {
  critBase: 0.08,       // かいしんの いちげきの、もとの確率
  critPerCombo: 0.02,   // コンボ1つごとに上がる確率
  critComboCap: 6,      // ↑が伸びるのはコンボ6まで
  critQuick: 0.10,      // クイックせいかいのときの上のせ
  critMul: 1.3,         // かいしんのEXP倍率
  quickXp: 2,           // クイックせいかいのボーナスEXP
  specialMul: 1.5,      // ひっさつわざのEXP倍率
  gaugeCorrect: 14,     // ひっさつゲージ：せいかい1回ぶん（100でMAX。5〜7問に1回くらい）
  gaugeQuick: 6,        // 　〃　：クイックの上のせ
  gaugeCrit: 10,        // 　〃　：かいしんの上のせ
  shinyChance: 0.03,    // 色ちがいのモンスターが出る確率
  shinyXp: 15,          // 色ちがいをたおしたときのボーナスEXP
  feverCombo: 5         // このコンボからフィーバー
};

/* こうげきは連続正解で進化する（上から順に、あてはまる最初のものを使う） */
var ATTACK_TIERS = [
  { min: 10, kind: "meteor", se: "meteor",   text: "りゅうせいの まほうが ふりそそぐ！" },
  { min: 7,  kind: "ice",    se: "ice",      text: "ふぶきの まほうが うずをまく！" },
  { min: 5,  kind: "fire",   se: "fireball", text: "ごうかの まほうが さくれつ！" },
  { min: 3,  kind: "bolt",   se: "zap",      text: "いなずまの まほうが ほとばしる！" },
  { min: 0,  kind: "slash",  se: "attack",   text: "つるぎの いちげき！" }
];
function attackTier(combo) {
  for (var i = 0; i < ATTACK_TIERS.length; i++) {
    if (combo >= ATTACK_TIERS[i].min) return ATTACK_TIERS[i];
  }
  return ATTACK_TIERS[ATTACK_TIERS.length - 1];
}

/* ひっさつわざの名前（MOSで習う操作にちなむ） */
var SPECIAL_MOVES = [
  "Ctrl+Z ブレイカー", "オートSUM キャノン", "ぜったいさんしょう ロック", "フラッシュフィル ストーム",
  "じょうけんしょしき バースト", "スタイル いっかつ ざん", "もくじ じどうせいせい", "ウィンドウわく こてい"
];

/* いま戦闘画面で、この問題の番のままか（時間差の演出が、次の問題や別の画面に出ないように） */
function battleLive(b, turn) {
  return battle === b && battle.idx === turn && $("#screen-battle").classList.contains("active");
}

function setStageTheme(theme) {
  battle.theme = theme;
  StageBg.draw($("#stage-bg"), theme);
  Fx.ambient(theme);
}

function battleBgm() {
  if (battle.mode === "final" || battle.mode === "expert") return "boss";
  if (battle.mode === "endless") return "maze";
  return "battle";
}

function beginBattle() {
  /* どのモードでも共通の、この戦闘のあいだだけ持つ値 */
  battle.gauge = 0;                           // ひっさつゲージ（0〜100）
  battle.useGauge = battle.mode !== "exam";   // もぎけんていは本番と同じ気持ちで解くので、ひっさつは無し
  battle.fever = false;
  battle.maxCombo = 0;
  battle.crits = 0;
  battle.quicks = 0;
  battle.specials = 0;
  battle.quickMs = 0;
  battle.rightBtn = null;
  battle.answered = 0;   // こたえた数（めいきゅうを途中でぬけたときの集計に使う）
  var b = battle;

  resultToken++;
  closeLevelUp();
  Sound.encounter();
  Juice.transition("battle", function () {
    if (battle !== b) return;
    Juice.clear();
    $("#battle-quest-name").textContent = battle.label;
    $("#battle-choices").innerHTML = "";
    $("#battle-continue").classList.add("hidden");
    $("#boss-hpbar").classList.add("hidden");
    $("#hotspot-stage").classList.add("hidden");
    $("#hotspot-stage").innerHTML = "";
    $("#battle-stage").classList.remove("hotspot-mode", "fever");
    $("#enemy-canvas").classList.remove("hidden");
    $("#enemy-name").classList.remove("hidden", "shiny");
    $("#enemy-name").textContent = "";
    $("#battle-msg").textContent = "";
    setEnemyAnim("gone");

    /* クエストごとの背景を描画 */
    var theme = battle.mode === "review" ? "shrine"
              : battle.mode === "final" ? "final"
              : battle.mode === "expert" ? "final"   // 専用の背景テーマは未作成。まおうの城の溶岩背景を流用する
              : battle.mode === "exam" ? "temple"
              : battle.mode === "endless" ? StageBg.forQuest(pick(battle.quests).id)
              : StageBg.forQuest(battle.quest.id);
    setStageTheme(theme);

    Sound.setTempo(1);
    Sound.playBgm(battleBgm());
    renderCombo();
    renderGauge();
    renderBattleXp();
    resetQuickBar();

    show("screen-battle");
    showTurn();
  });
}

/* モンスター図鑑：遭遇したモンスターを記録する */
function recordSeenMonster(name) {
  if (save.seenMonsters.indexOf(name) < 0) save.seenMonsters.push(name);
}

function currentMonster() {
  battle.isRare = false;
  battle.isShiny = false;
  battle.rare = null;
  if (battle.mode === "final") {
    return { shape: "demon", palette: "dark", name: "まおうデリート" };
  }
  if (battle.mode === "expert") {
    return { shape: "demon", palette: "purple", name: "しんおうデリート" };
  }
  if (battle.bossPhase) {
    return battle.mode === "endless" ? pick(battle.quests).boss : battle.quest.boss;
  }
  if (battle.mode === "exam") {
    return pick(ALL_QUESTS).mob;
  }
  /* クエスト・復習・めいきゅうでは、ごく低確率で激レアモンスターが出現する */
  if (Math.random() < RARE_MONSTER_CHANCE) {
    battle.isRare = true;
    battle.rare = pickRareMonster();
    return battle.rare.mob;
  }
  var m = battle.mode === "review" ? pick(ALL_QUESTS).mob
        : battle.mode === "endless" ? pick(battle.quests).mob
        : battle.quest.mob;
  /* さらに低確率で、色ちがい。たおすと図鑑に色ちがいが登録される */
  if (Math.random() < TUNE.shinyChance) {
    battle.isShiny = true;
    return { shape: m.shape, palette: Treasure.shinyPalette(m.palette), name: m.name };
  }
  return m;
}

/* 敵のうごき（CSSのクラス）を切りかえる。色ちがい・激レアの光り方と、
 * ホットスポット問題で敵を隠している状態（hidden）は保つ。 */
function setEnemyAnim(name) {
  var c = $("#enemy-canvas");
  var hid = c.classList.contains("hidden");
  c.className = name + (battle && battle.isShiny ? " shiny" : "") + (battle && battle.isRare ? " rare" : "");
  if (hid) c.classList.add("hidden");
}
/* 出現・ひるみ・とびかかりのうごきが終わったら、ふわふわ待機にもどす */
var ENEMY_ANIM_CLASS = { spawn: "spawn", spawnBoss: "spawn-boss", hit: "hit", enemyLunge: "lunge" };
function onEnemyAnimEnd(e) {
  var cls = ENEMY_ANIM_CLASS[e.animationName];
  if (cls && e.target.classList.contains(cls)) setEnemyAnim("idle");
}

function updateHud() {
  var h = "";
  if (!battle.noFail) {
    for (var i = 0; i < battle.maxHearts; i++) h += i < battle.hearts ? "♥" : "♡";
  }
  $("#battle-hearts").textContent = h;
  $("#battle-progress").textContent = battle.mode === "endless"
    ? "ちか " + (battle.correct + 1) + " かい"
    : (battle.idx + 1) + "/" + battle.qs.length;
  /* めいきゅうのボスは1問でたおすので、HPバーは出さない */
  var showBar = (battle.bossPhase || battle.mode === "final") && battle.mode !== "endless";
  $("#boss-hpbar").classList.toggle("hidden", !showBar);
  if (showBar) {
    var pct = Math.max(0, battle.bossHp / battle.bossMax * 100);
    $("#boss-hpfill").style.width = pct + "%";
    $("#boss-hpghost").style.width = pct + "%";   // 白いバーが少し遅れて追いかける（けずった量が見える）
  }
}

function flashHearts(cls) {
  var el = $("#battle-hearts");
  el.classList.remove("hurt", "heal");
  void el.offsetWidth;   // 同じうごきを続けて再生できるように、いちど読みなおす
  el.classList.add(cls);
}

/* ---------- コンボ・ひっさつゲージ・EXPバー・クイック ---------- */
function renderCombo(bump) {
  var el = $("#combo-hud");
  if (!battle || battle.combo < 2) { el.className = "combo-hud hidden"; return; }
  $("#combo-num").textContent = battle.combo;
  el.className = "combo-hud tier-" + attackTier(battle.combo).kind;
  if (bump) { void el.offsetWidth; el.classList.add("bump"); }
}

function renderGauge() {
  var g = $("#special-gauge");
  g.classList.toggle("hidden", !battle.useGauge);
  var full = battle.gauge >= 100;
  $("#special-fill").style.width = Math.min(100, battle.gauge) + "%";
  g.classList.toggle("full", full);
  $("#special-label").textContent = full ? "ひっさつ MAX！" : "ひっさつ";
}

/* EXPバー（prefix = "battle" / "result"）。いまのレベルを返す */
function setXpBar(prefix, xp) {
  var li = levelInfo(xp);
  $("#" + prefix + "-lv").textContent = "Lv " + li.level;
  $("#" + prefix + "-xpfill").style.width = Math.floor(li.cur / li.need * 100) + "%";
  var t = $("#" + prefix + "-xptext");
  if (t) t.textContent = "EXP " + li.cur + " / " + li.need;
  return li.level;
}
function renderBattleXp() { setXpBar("battle", save.xp); }

function setFever(on, delayed) {
  if (battle.fever === on) return;
  battle.fever = on;
  $("#battle-stage").classList.toggle("fever", on);
  Sound.setTempo(on ? 1.08 : 1);
  if (on) {
    var b = battle, turn = battle.idx;
    setTimeout(function () {
      if (battleLive(b, turn)) Juice.announce("フィーバー！！", "fever", 1100);
    }, delayed ? 700 : 0);
  }
}

/* クイック：問題が出てから一定の時間内に正解するとボーナス。
 * おそくても罰は無い（あせって当てずっぽうにならないように、ごほうびだけにしている）。
 * 持ち時間は問題文と選択肢の長さで決める（長い問題ほど長い）。 */
var quickState = { t0: 0, timer: null };
function resetQuickBar() {
  clearTimeout(quickState.timer);
  quickState.t0 = 0;
  var bar = $("#quick-bar"), fill = $("#quick-fill");
  bar.classList.remove("expired");
  bar.classList.add("off");
  fill.style.transition = "none";
  fill.style.width = "0%";
}
function startQuickTimer(q) {
  var chars = q.q.length + q.c.join("").length;
  battle.quickMs = Math.min(16000, 5000 + 70 * chars + (q.type === "hotspot" ? 3000 : 0));
  var bar = $("#quick-bar"), fill = $("#quick-fill");
  bar.classList.remove("expired", "off");
  fill.style.transition = "none";
  fill.style.width = "100%";
  void fill.offsetWidth;
  fill.style.transition = "width " + battle.quickMs + "ms linear";
  fill.style.width = "0%";
  quickState.t0 = performance.now();
  clearTimeout(quickState.timer);
  quickState.timer = setTimeout(function () { bar.classList.add("expired"); }, battle.quickMs);
}
/* タイマーを止めて、かかった時間（ミリ秒）を返す。うごいていなければ null */
function stopQuickTimer() {
  clearTimeout(quickState.timer);
  if (!quickState.t0) return null;
  var elapsed = performance.now() - quickState.t0;
  quickState.t0 = 0;
  var fill = $("#quick-fill");
  var w = getComputedStyle(fill).width;   // バーをその場で止める
  fill.style.transition = "none";
  fill.style.width = w;
  return elapsed;
}

/* ---------- むげんの めいきゅう：1かいごとの準備 ---------- */
function prepareEndlessFloor() {
  var floor = battle.correct + 1;
  if (floor % ENDLESS_BOSS_EVERY === 0) {
    /* ボスのかい。まちがえても同じボスが立ちふさがる（正解するまで下へ行けない） */
    if (!battle.bossPhase) { battle.bossFrom = battle.idx; battle.bossHp = 1; battle.bossMax = 1; }
  } else {
    if (battle.bossPhase) Sound.playBgm("maze");
    battle.bossPhase = false;
    battle.bossFrom = 99999;
  }
  /* 5かいごとに けしきが かわる */
  var zone = Math.floor((floor - 1) / ENDLESS_BOSS_EVERY);
  if (zone !== battle.zone) {
    battle.zone = zone;
    setStageTheme(StageBg.forQuest(pick(battle.quests).id));
    if (!Juice.isLow()) Juice.announce("ちか " + floor + " かい", "floor", 1000);
  }
}

function showTurn() {
  if (battle.mode === "endless") prepareEndlessFloor();

  var enteringBoss = !battle.bossPhase && battle.idx >= battle.bossFrom;
  if (enteringBoss) battle.bossPhase = true;
  /* ボスが既に登場ずみの2問目以降は、出現メッセージなしで次の問題へ直行する */
  var bossContinuing = battle.bossPhase && !enteringBoss;

  var canvas = $("#enemy-canvas");
  $("#battle-choices").innerHTML = "";
  $("#battle-continue").classList.add("hidden");
  resetQuickBar();
  /* まえの問題がリボンの絵（ホットスポット）だったら片づけて、モンスターの表示にもどす */
  renderQuestionVisual({});

  if (bossContinuing) {
    setEnemyAnim("idle");   /* ボスは立ったまま。再出現アニメもさせない */
    updateHud();
    showQuestion();
    return;
  }

  var m = currentMonster();
  battle.mob = m;
  recordSeenMonster(m.name);
  persist();
  var tag = $("#enemy-name");

  /* もぎけんていは出現メッセージなしでテンポよく出題する */
  if (battle.mode === "exam") {
    drawSprite(canvas, m.shape, m.palette, 9);
    setEnemyAnim("spawn");
    tag.textContent = m.name;
    tag.classList.remove("shiny");
    updateHud();
    showQuestion();
    return;
  }

  var b = battle, turn = battle.idx;
  var bossLike = battle.bossPhase || battle.mode === "final";

  function appear() {
    if (!battleLive(b, turn)) return;
    drawSprite(canvas, m.shape, m.palette, bossLike ? 12 : 9);
    setEnemyAnim(enteringBoss ? "spawn-boss" : "spawn");
    tag.textContent = (battle.isShiny ? "✨ " : "") + m.name;
    tag.classList.toggle("shiny", battle.isShiny);
    updateHud();

    var intro;
    if (battle.isRare) {
      Sound.heal();
      Juice.sparkle(canvas, { n: 14 });
      intro = pick(battle.rare.intro);
    } else if (battle.isShiny) {
      Sound.shiny();
      Juice.sparkle(canvas, { n: 18, colors: ["#ffffff", "#fff7a0", "#ffd23b"] });
      Juice.announce("色ちがい！", "shiny", 1200);
      intro = "キラリ…！ めずらしい 色ちがいだ！\n" + m.name + "が あらわれた！";
    } else if (battle.mode === "final") {
      Sound.boss();
      intro = "じゃあくな けはいが みなぎる…！\n" + m.name + "が すがたを あらわした！！";
    } else if (battle.mode === "expert") {
      Sound.boss();
      intro = "けたはずれの プレッシャーが おそいかかる…！\n真の おうしゃ「" + m.name + "」が すがたを あらわした！！";
    } else if (enteringBoss) {
      Sound.boss();
      intro = "つよそうな けはいが する…！\nボス「" + m.name + "」が あらわれた！！";
    } else {
      intro = m.name + "が あらわれた！";
    }
    if (enteringBoss) Juice.shake(0.45);

    typeMsg(intro, function () {
      setTimeout(function () { if (battleLive(b, turn)) showQuestion(); }, 450);
    });
  }

  if (enteringBoss) {
    Sound.playBgm("boss");
    if (!Juice.isLow()) {
      /* ボス登場：警告の帯 → 上からドスンと落ちてくる */
      setEnemyAnim("gone");
      tag.textContent = "？？？";
      tag.classList.remove("shiny");
      updateHud();
      Sound.warning();
      Fx.warning(battle.mode === "final" || battle.mode === "expert" ? "DANGER" : "WARNING");
      typeMsg("…！？ なにかが ちかづいてくる…！");
      setTimeout(appear, 1200);
      return;
    }
  }
  appear();
}

function showQuestion() {
  var q = battle.qs[battle.idx];
  typeMsg(q.q);
  renderQuestionVisual(q);
  var box = $("#battle-choices");
  box.innerHTML = "";
  battle.rightBtn = null;
  var order = shuffle([0, 1, 2, 3]);
  order.forEach(function (ci) {
    var btn = document.createElement("button");
    btn.className = "choice";
    btn.textContent = q.c[ci];
    if (ci === q.a) battle.rightBtn = btn;
    btn.onclick = function () { answer(ci === q.a, btn); };
    box.appendChild(btn);
  });
  startQuickTimer(q);
}

/* 画面ホットスポット問題（type:"hotspot"）のときはモンスターを隠してリボンUIモックアップ
 * ＋番号バッジを表示する。通常の問題ではモンスター表示に戻す。 */
function renderQuestionVisual(q) {
  var hotspotBox = $("#hotspot-stage");
  var stage = $("#battle-stage");
  if (q.type === "hotspot") {
    /* 先に表示状態にしてからでないと getBoundingClientRect() が全部0を返すため、
     * hidden解除 → 描画・座標計測 の順を必ず守る。 */
    hotspotBox.classList.remove("hidden");
    stage.classList.add("hotspot-mode");
    $("#enemy-canvas").classList.add("hidden");
    $("#enemy-name").classList.add("hidden");

    var mockup = RIBBON_MOCKUPS[q.ui];
    mockup.render(hotspotBox);
    q.markers.forEach(function (m) {
      var pos = ribbonMarkerPosition(hotspotBox, m.target);
      if (!pos) return;
      var badge = document.createElement("span");
      badge.className = "hotspot-badge";
      badge.textContent = m.n;
      badge.style.left = pos.x + "px";
      badge.style.top = pos.y + "px";
      hotspotBox.appendChild(badge);
    });
  } else {
    hotspotBox.classList.add("hidden");
    hotspotBox.innerHTML = "";
    stage.classList.remove("hotspot-mode");
    $("#enemy-canvas").classList.remove("hidden");
    $("#enemy-name").classList.remove("hidden");
  }
}

function answer(isCorrect, btn) {
  finishType();
  var elapsed = stopQuickTimer();
  var q = battle.qs[battle.idx];
  var b = battle, turn = battle.idx;
  document.querySelectorAll(".choice").forEach(function (x) { x.disabled = true; });
  btn.classList.add(isCorrect ? "picked-right" : "picked-wrong");
  /* まちがえたときは、正解のボタンもしめす（文字だけでなく、位置でも覚えられるように） */
  if (!isCorrect && battle.rightBtn) battle.rightBtn.classList.add("was-right");

  SRS.record(save.records, q.id, isCorrect);
  save.stats.answered++;
  battle.answered++;

  /* もぎけんてい: 分野（クエスト）ごとの正答を記録して苦手診断に使う */
  if (battle.mode === "exam") {
    var qname = QUESTION_INDEX[q.id].quest.name;
    var pq = battle.perQuest[qname] || (battle.perQuest[qname] = { right: 0, total: 0 });
    pq.total++;
    if (isCorrect) pq.right++;
  }

  var levelBefore = levelInfo(save.xp).level;
  var missionHits = [Missions.record(save, "answered", 1)];
  var banners = [];
  var msg;
  var hitDelay = 300;   // 演出が当たるまでの時間。これより前には「すすむ」を出さない

  if (isCorrect) {
    save.stats.correct++;
    battle.correct++;
    battle.combo++;
    if (battle.combo > battle.maxCombo) battle.maxCombo = battle.combo;
    if (battle.combo > save.stats.bestCombo) save.stats.bestCombo = battle.combo;

    var isBoss = battle.bossPhase || battle.mode === "final";
    var quick = elapsed !== null && elapsed <= battle.quickMs;
    var special = battle.useGauge && battle.gauge >= 100;
    var crit = !special && Math.random() <
      TUNE.critBase + TUNE.critPerCombo * Math.min(battle.combo, TUNE.critComboCap) + (quick ? TUNE.critQuick : 0);
    var tier = attackTier(battle.combo);

    var gained = battle.mode === "review" ? 6 : (battle.mode === "exam" || battle.mode === "endless") ? 8 : 10;
    if (isBoss) gained = 15;
    var comboBonus = Math.min((battle.combo - 1) * 2, 10);
    gained += comboBonus;
    if (battle.isRare) gained += 20;   /* 激レアモンスターのラッキーボーナス */
    if (battle.isShiny) gained += TUNE.shinyXp;
    if (crit) gained = Math.round(gained * TUNE.critMul);
    if (quick) gained += TUNE.quickXp;
    if (special) gained = Math.round(gained * TUNE.specialMul);
    battle.xp += gained;
    save.xp += gained;

    if (special) {
      battle.gauge = 0;
      battle.specials++;
      save.stats.specials++;
      missionHits.push(Missions.record(save, "special", 1));
    } else if (battle.useGauge) {
      battle.gauge = Math.min(100, battle.gauge + TUNE.gaugeCorrect +
        (quick ? TUNE.gaugeQuick : 0) + (crit ? TUNE.gaugeCrit : 0));
      if (battle.gauge >= 100) setTimeout(function () { if (battleLive(b, turn)) Sound.gaugeMax(); }, 600);
    }
    if (crit) { battle.crits++; save.stats.crits++; missionHits.push(Missions.record(save, "crit", 1)); }
    if (quick) { battle.quicks++; save.stats.quicks++; missionHits.push(Missions.record(save, "quick", 1)); }

    var died = true;
    if (isBoss) {
      battle.bossHp--;
      battle.bossCorrect++;
      died = battle.bossHp <= 0;
    }

    /* かいふく：ひっさつわざ／めいきゅうのボスをたおしたとき */
    var healed = false;
    if (!battle.noFail && battle.hearts < battle.maxHearts &&
        (special || (battle.mode === "endless" && isBoss && died))) {
      battle.hearts++;
      healed = true;
    }

    /* たおした数（図鑑のメダル）と、色ちがいの登録 */
    var shinyNew = false;
    if (died) {
      var mobName = battle.mob.name;
      var kills = save.kills[mobName] = (save.kills[mobName] || 0) + 1;
      save.stats.kills++;
      missionHits.push(Missions.record(save, "kills", 1));
      var medal = medalAt(kills);
      if (medal) banners.push([medal.icon, medal.name + " かくとく！", mobName + "を " + kills + "たい たおした！", ""]);
      if (battle.isShiny && !save.shinyMonsters[mobName]) {
        save.shinyMonsters[mobName] = battle.mob.palette;
        shinyNew = true;
      }
    }
    if (battle.mode === "endless") missionHits.push(Missions.record(save, "endlessFloor", 1));

    /* こうげきの演出 */
    var move = null;
    var onHit = function () {
      if (!battleLive(b, turn)) return;
      if (!special) Sound.correct();
      if (died) {
        Fx.defeat(battle.mob.palette, isBoss);
        setEnemyAnim("gone");
        if (isBoss) Sound.boom();
      } else {
        setEnemyAnim("hit");
      }
      Fx.floatText("＋" + gained + " EXP", null, (crit || special) ? "crit" : "");
      Juice.orbs(Juice.enemyPoint(), $("#battle-xpfill").parentNode, { n: 6, onDone: renderBattleXp });
      setTimeout(renderBattleXp, 1000);   // 玉が届かなかったときの保険
      if (healed) { Sound.heal(); flashHearts("heal"); }
    };
    if (special) {
      move = pick(SPECIAL_MOVES);
      hitDelay = 860;
      Sound.special();
      Fx.special(move, onHit);
    } else {
      hitDelay = 160;
      Sound[tier.se]();
      Fx.attack(tier.kind, { crit: crit, color: weaponFor(levelBefore).color });
      setTimeout(onHit, hitDelay);
      if (crit) {
        Juice.announce("かいしんの いちげき！", "crit", 900);
        setTimeout(function () { Sound.crit(); }, 120);
      }
    }
    if (quick) {
      Fx.floatText("⚡ QUICK！ ＋" + TUNE.quickXp, null, "quick");
      Sound.quick();
    }
    renderCombo(true);
    if (battle.combo >= 2) Sound.combo(battle.combo);
    if (battle.combo >= TUNE.feverCombo) setFever(true, crit || special);

    var head = special ? "ひっさつ「" + move + "」！！ " : (crit ? "かいしんの いちげき！ " : "");
    var waza = special ? "" : tier.text + " ";
    var tip = q.exp ? "\n【まめちしき】" + q.exp : "";
    if (isBoss) {
      msg = head + waza + "ボスに ダメージ！\n＋" + gained + " EXP";
      if (died) msg = head + "とどめの いちげき！！ ボスを たおした！\n＋" + gained + " EXP";
    } else if (battle.isRare) {
      msg = head + pick(battle.rare.defeat) + " ラッキーEXP＋" + gained + "！" + tip;
    } else {
      msg = head + waza + battle.mob.name + "を たおした！ ＋" + gained + " EXP" + tip;
      if (comboBonus > 0 && !head) msg = "れんぞく せいかい！ " + msg;
    }
    if (shinyNew) msg += "\n✨ 色ちがいを 図鑑に とうろくした！";
    if (healed) msg += "\n♥ が 1つ かいふくした！";
  } else {
    var hadCombo = battle.combo;
    battle.combo = 0;
    if (!battle.noFail) battle.hearts--;
    Sound.wrong();
    if (hadCombo >= 3) setTimeout(function () { Sound.comboBreak(); }, 200);
    setEnemyAnim("lunge");
    Fx.claw();
    Fx.floatText(battle.noFail ? "ミス…" : "－♥ ダメージ！", "#ff5d7a", "bad");
    if (!battle.noFail) flashHearts("hurt");
    setFever(false);
    renderCombo();
    msg = "ミス！ こうげきを うけた…\nせいかいは 「" + q.c[q.a] + "」\n【かいせつ】" + q.exp;
  }

  /* デイリーミッションの進捗を更新し、達成したぶんだけボーナスEXPを加える */
  if (isCorrect) {
    missionHits.push(Missions.record(save, "correct", 1));
    missionHits.push(Missions.record(save, "comboReach", battle.combo));
    if (battle.mode === "review") missionHits.push(Missions.record(save, "reviewCorrect", 1));
  }
  missionHits.filter(Boolean).forEach(function (m) {
    save.xp += MISSION_BONUS_XP;
    battle.xp += MISSION_BONUS_XP;
    banners.push(missionBanner(m));
  });

  /* 戦闘のとちゅうでレベルが上がったら、その場でも知らせる（くわしい演出はリザルトで） */
  var levelAfter = levelInfo(save.xp).level;
  if (levelAfter > levelBefore) {
    setTimeout(function () {
      if (!battleLive(b, turn)) return;
      Sound.levelup();
      Juice.banner("⬆️", "レベルアップ！", "Lv " + levelAfter + " に なった！", "levelup", "levelup");
      var c = Juice.centerOf($("#battle-xpfill").parentNode);
      if (c) Juice.fountain(c.x, c.y, { n: 30, speed: 380 });
    }, hitDelay + 500);
  }
  banners.forEach(function (x) { Juice.banner(x[0], x[1], x[2], x[3]); });

  persist();
  updateHud();
  renderGauge();
  var readyAt = performance.now() + hitDelay + 250;
  typeMsg(msg, function () {
    setTimeout(function () {
      if (!battleLive(b, turn)) return;
      var btnNext = $("#battle-continue");
      btnNext.classList.remove("hidden");
      btnNext.focus();
    }, Math.max(0, readyAt - performance.now()));
  });
}

function missionBanner(m) {
  return ["📋", "ミッション たっせい！ ＋" + MISSION_BONUS_XP + "EXP", m.label, "mission"];
}

/* たおした数のメダル（ちょうどその数になったときだけ返す） */
var MEDALS = [
  { at: 10,  icon: "🥉", name: "どうメダル" },
  { at: 30,  icon: "🥈", name: "ぎんメダル" },
  { at: 100, icon: "🥇", name: "きんメダル" }
];
function medalAt(kills) {
  for (var i = 0; i < MEDALS.length; i++) if (MEDALS[i].at === kills) return MEDALS[i];
  return null;
}
function medalFor(kills) {
  var m = null;
  MEDALS.forEach(function (x) { if (kills >= x.at) m = x; });
  return m;
}

function nextTurn() {
  Sound.select();
  $("#battle-continue").classList.add("hidden");
  battle.idx++;
  if (battle.hearts <= 0) { endBattle(false); return; }
  /* むげんの めいきゅうは終わりが無い。問題を出しきったら、もう一周ぶん足す */
  if (battle.mode === "endless") {
    if (battle.idx >= battle.qs.length) refillEndless();
    showTurn();
    return;
  }
  // 最終決戦（まおう/エキスパート）はボスのHPを削りきった時点で勝利（残りの問題は出題しない）
  if ((battle.mode === "final" || battle.mode === "expert") && battle.bossHp <= 0) { endBattle(true); return; }
  if (battle.idx >= battle.qs.length) {
    // 最終決戦はボスを討伐しきれなければ失敗
    if ((battle.mode === "final" || battle.mode === "expert") && battle.bossHp > 0) { endBattle(false); return; }
    endBattle(true);
    return;
  }
  showTurn();
}

/* =========================================================
 * むげんの めいきゅう
 * クリアずみのクエストの問題が、終わりなく出つづける。3回まちがえるまでに
 * 何問せいかいできるか（＝ちか何かいまで もぐれるか）をきそう。
 * 出題の順番は「復習の期限が来ている → にがて → それ以外」（復習を兼ねる）。
 * ======================================================= */
var ENDLESS_UNLOCK = 3;        // クエストをこの数クリアすると入れる
var ENDLESS_BOSS_EVERY = 5;    // このかい数ごとにボス（たおすと♥が1つ回復）
var ENDLESS_TITLES = [
  [10, "めいきゅうの ちょうせんしゃ"],
  [20, "ちていの たんけんか"],
  [30, "しんえんの けんじゃ"],
  [50, "むげんを こえし者"]
];

function endlessQuests() {
  var all = ALL_QUESTS.concat(typeof EXPERT_QUEST_DATA_EXCEL !== "undefined" ? EXPERT_QUEST_DATA_EXCEL.quests : []);
  return all.filter(function (q) { return save.quests[q.id] && save.quests[q.id].stars > 0; });
}

function endlessOrder(pool) {
  var now = Date.now();
  var due = [], weak = [], rest = [];
  pool.forEach(function (q) {
    var r = save.records[q.id];
    if (!r) rest.push(q);
    else if (r.due <= now && r.box < SRS.MAX_BOX) due.push(q);
    else if (r.box <= 1) weak.push(q);
    else rest.push(q);
  });
  return shuffle(due).concat(shuffle(weak)).concat(shuffle(rest));
}

function refillEndless() {
  var more = endlessOrder(battle.pool);
  /* 直前の問題がつづけて出ないようにする */
  var last = battle.qs[battle.qs.length - 1];
  if (more.length > 1 && last && more[0].id === last.id) more.push(more.shift());
  battle.qs = battle.qs.concat(more);
}

function startEndless() {
  var quests = endlessQuests();
  var pool = [];
  quests.forEach(function (q) { pool = pool.concat(q.questions); });
  if (!pool.length) { toast("まだ はいれない… クエストを クリアしよう！"); return; }
  battle = {
    mode: "endless",
    quest: null,
    label: "むげんの めいきゅう",
    qs: endlessOrder(pool),
    pool: pool,
    quests: quests,
    zone: 0,
    bossFrom: 99999, bossHp: 0, bossMax: 0,
    idx: 0, hearts: 3, maxHearts: 3,
    correct: 0, combo: 0, xp: 0,
    bossPhase: false, bossCorrect: 0
  };
  beginBattle();
}

function endEndless() {
  var floors = battle.correct;   /* もぐれた かい数＝せいかいした数 */
  var bonus = Math.min(floors * 2, 60);
  save.xp += bonus;
  battle.xp += bonus;

  var rec = save.endless;
  rec.runs++;
  rec.totalFloors += floors;
  var prevBest = rec.best;
  var isRecord = floors > prevBest;
  if (isRecord) rec.best = floors;

  /* 節目のかい数で しょうごうを てにいれる */
  var banners = [];
  ENDLESS_TITLES.forEach(function (t) {
    if (rec.best >= t[0] && save.titles.indexOf(t[1]) < 0) {
      save.titles.push(t[1]);
      banners.push(["👑", "あたらしい しょうごう！", "「" + t[1] + "」", ""]);
    }
  });

  var newAchievements = Achievements.check(save);
  persist();
  syncNow();

  presentResult({
    cleared: true,
    title: isRecord && floors > 0 ? "しんきろく！！" : "たんけん しゅうりょう",
    sub: isRecord && prevBest > 0
      ? "これまでの きろく（ちか " + prevBest + " かい）を ぬりかえた！"
      : (prevBest > 0 ? "さいこう きろくは ちか " + prevBest + " かい。\nつぎは きろくこうしんを ねらおう！"
                      : "3かい まちがえるまでに どこまで もぐれるか。\nまた ちょうせんしよう！"),
    stars: null,
    big: { label: "とうたつ", value: floors, prefix: "ちか ", suffix: " かい" },
    rows: battleRows(battle.answered),
    xp: battle.xp,
    jingle: isRecord && floors > 0 ? "newRecord" : "clear",
    confetti: isRecord && floors > 0 ? 120 : 30,
    announce: isRecord && floors > 0 ? ["NEW RECORD!!", "record"] : null,
    banners: banners,
    achievements: newAchievements
  });
}

/* =========================================================
 * 結果（リザルト）
 * ======================================================= */
var resultToken = 0;   // リザルトの時間差の演出を、画面をはなれたら止めるための番号
var lastTickAt = 0;
function tickSound() {
  var now = performance.now();
  if (now - lastTickAt > 55) { lastTickAt = now; Sound.tick(); }
}

function battleRows(total) {
  var rows = [
    ["せいかい", battle.correct + " / " + total],
    ["さいだいコンボ", battle.maxCombo + " れんぞく"]
  ];
  if (battle.crits) rows.push(["かいしんの いちげき", battle.crits + " 回"]);
  if (battle.quicks) rows.push(["クイックせいかい", battle.quicks + " 回"]);
  if (battle.specials) rows.push(["ひっさつわざ", battle.specials + " 回"]);
  return rows;
}

function closeLevelUp() {
  $("#levelup-overlay").classList.add("hidden");
}

function levelUpText(prevLevel, newLevel) {
  var lines = ["レベルアップ！ Lv" + prevLevel + " → Lv" + newLevel];
  if (rankFor(newLevel) !== rankFor(prevLevel)) lines.push("ランクアップ！ →「" + rankFor(newLevel) + "」");
  if (weaponFor(newLevel).name !== weaponFor(prevLevel).name) lines.push("あたらしい ぶき「" + weaponFor(newLevel).name + "」");
  return lines;
}

/* レベルアップのえんしゅつ（画面いっぱい）。タップか、数秒で閉じる */
function showLevelUp(prevLevel, newLevel) {
  var lines = levelUpText(prevLevel, newLevel);
  $("#lvup-from").textContent = "Lv " + prevLevel;
  $("#lvup-to").textContent = "Lv " + newLevel;
  var rankUp = rankFor(newLevel) !== rankFor(prevLevel);
  var newWeapon = weaponFor(newLevel).name !== weaponFor(prevLevel).name;
  $("#lvup-rank").textContent = rankUp ? "ランクアップ！ →「" + rankFor(newLevel) + "」" : "";
  $("#lvup-rank").classList.toggle("hidden", !rankUp);
  $("#lvup-weapon").textContent = newWeapon ? "⚔ " + lines[lines.length - 1] + "を てにいれた！" : "";
  $("#lvup-weapon").classList.toggle("hidden", !newWeapon);
  $("#levelup-overlay").classList.remove("hidden");
  Sound.levelup();
  var s = Juice.size();
  Juice.rays(s.w / 2, s.h * 0.42, { dur: 3, len: Math.max(s.w, s.h) * 0.6, alpha: 0.13, count: 14 });
  Juice.fountain(s.w / 2, s.h * 0.78, { n: 60 });
  Juice.confetti(50);
  var token = resultToken;
  setTimeout(function () { if (token === resultToken) closeLevelUp(); }, 3600);
}

/* リザルトのEXPバーを、もとの値から今の値までのばす（レベルが上がるたびに光る） */
function animateResultXp(fromXp, toXp, ms, token, done) {
  var t0 = performance.now();
  var lastLevel = levelInfo(fromXp).level;
  var box = $(".result-xp");
  function step(now) {
    if (token !== resultToken) return;
    var k = Math.min(1, (now - t0) / ms);
    var e = 1 - (1 - k) * (1 - k);
    var lv = setXpBar("result", Math.round(fromXp + (toXp - fromXp) * e));
    if (lv > lastLevel) {
      lastLevel = lv;
      Sound.star(2);
      box.classList.add("levelup-flash");
      Juice.sparkle(box, { n: 10 });
    }
    if (k < 1) requestAnimationFrame(step);
    else if (done) done();
  }
  requestAnimationFrame(step);
}

/* リザルト画面を、順番に見せる。
 * o: { cleared, title, sub, icon, stars(数 or null), big:{label,value,prefix,suffix,fail},
 *      rows:[[見出し,値]], xp(この戦闘で得たEXPの合計), hideRetry, chest, jingle, confetti,
 *      announce:[文字,クラス], banners:[[icon,head,body,cls]], achievements:[] } */
function presentResult(o) {
  var token = ++resultToken;
  var low = Juice.isLow();
  function later(ms, fn) {
    if (low) { fn(); return; }
    setTimeout(function () { if (token === resultToken) fn(); }, ms);
  }

  Fx.stopAmbient();
  Sound.setTempo(1);
  Sound.playBgm(null);
  Juice.clear();
  Juice.dropBanners("levelup");   // 戦闘中のレベルアップのお知らせは、リザルトの演出にまかせる
  closeLevelUp();
  stopQuickTimer();

  $("#result-title").textContent = o.title;
  $("#result-title").className = o.cleared ? "result-clear" : "result-fail";
  $("#result-sub").textContent = o.sub;

  /* ★は1つずつスタンプする */
  var starsEl = $("#result-stars");
  starsEl.textContent = o.icon || "";
  var starEls = [];
  if (typeof o.stars === "number") {
    for (var i = 0; i < 3; i++) {
      var st = document.createElement("span");
      st.className = "result-star";
      st.textContent = "☆";
      starsEl.appendChild(st);
      starEls.push(st);
    }
  }

  /* 大きな数字（もぎけんていのスコア・めいきゅうの かい数） */
  var bigBox = $("#result-big");
  bigBox.classList.toggle("hidden", !o.big);
  var bigFmt = function (v) { return (o.big.prefix || "") + v + (o.big.suffix || ""); };
  if (o.big) {
    bigBox.classList.toggle("fail", !!o.big.fail);
    $("#result-big-label").textContent = o.big.label;
    $("#result-big-num").textContent = bigFmt(low ? o.big.value : 0);
  }

  /* 明細 */
  var tally = $("#result-tally");
  tally.innerHTML = "";
  var xpVal = null;
  o.rows.concat([["かくとく EXP", "＋" + (low ? o.xp : 0)]]).forEach(function (r, idx, all) {
    var row = document.createElement("div");
    var isXp = idx === all.length - 1;
    row.className = "result-row" + (isXp ? " xp" : "");
    row.style.animationDelay = (0.3 + idx * 0.1) + "s";
    var a = document.createElement("span"); a.textContent = r[0];
    var v = document.createElement("span"); v.textContent = r[1];
    row.appendChild(a); row.appendChild(v);
    tally.appendChild(row);
    if (isXp) xpVal = v;
  });

  var prevXp = save.xp - o.xp;
  var prevLevel = levelInfo(prevXp).level, newLevel = levelInfo(save.xp).level;
  setXpBar("result", low ? save.xp : prevXp);
  $(".result-xp").classList.remove("levelup-flash");
  var lvEl = $("#result-levelup");
  lvEl.classList.add("hidden");

  $("#result-retry").classList.toggle("hidden", !!o.hideRetry);
  renderChestBox(o.chest || null);

  show("screen-result");

  Sound[o.jingle || (o.cleared ? "clear" : "fail")]();
  if (o.confetti) Juice.confetti(o.confetti);

  starEls.forEach(function (el, n) {
    if (n >= o.stars) return;
    later(450 + n * 300, function () {
      el.textContent = "★";
      el.classList.add("on");
      Sound.star(n);
      var c = Juice.centerOf(el);
      if (c) Juice.burst(c.x, c.y, { n: 12, speed: 260, size: 6, shape: "star" });
    });
  });
  if (o.stars === 3) {
    later(1450, function () {
      Juice.announce("PERFECT!!", "perfect", 1400);
      Juice.confetti(60);
    });
  }
  if (o.announce) later(600, function () { Juice.announce(o.announce[0], o.announce[1], 1600); });

  if (o.big && !low) {
    later(350, function () { Juice.countUp($("#result-big-num"), 0, o.big.value, 900, bigFmt, tickSound); });
  }

  function afterXp() {
    if (newLevel <= prevLevel) return;
    lvEl.textContent = levelUpText(prevLevel, newLevel).join("\n");
    lvEl.classList.remove("hidden");
    if (low) Sound.levelup();
    else later(250, function () { showLevelUp(prevLevel, newLevel); });
  }
  later(700, function () {
    if (!low) Juice.countUp(xpVal, 0, o.xp, 700, function (v) { return "＋" + v; }, tickSound);
  });
  later(1000, function () {
    if (low) afterXp();
    else animateResultXp(prevXp, save.xp, 1000, token, afterXp);
  });

  later(500, function () {
    (o.banners || []).forEach(function (x) { Juice.banner(x[0], x[1], x[2], x[3]); });
    if (o.achievements && o.achievements.length) showAchievementToasts(o.achievements);
  });
}

/* ---------- 結果（もぎけんてい） ---------- */
function endExam() {
  var score = Math.round(battle.correct / battle.qs.length * 1000);
  var pass = score >= 700;
  var bonus = pass ? 50 : 10;
  save.xp += bonus;
  battle.xp += bonus;

  save.exams = save.exams || {};
  var ex = save.exams[battle.subjectKey] || { best: 0, tries: 0 };
  ex.tries++;
  if (score > ex.best) ex.best = score;
  save.exams[battle.subjectKey] = ex;

  var newAchievements = Achievements.check(save);
  persist();
  syncNow();

  var lines = ["ごうかくライン 700てん"];
  var weak = [];
  for (var name in battle.perQuest) {
    var r = battle.perQuest[name];
    if (r.right < r.total) weak.push(name + "（" + r.right + "/" + r.total + "）");
  }
  lines.push(weak.length ? "にがてな ぶんや: " + weak.join("、") : "ぜんぶんや パーフェクト！");
  lines.push(pass
    ? "この ちょうしなら ほんばんも だいじょうぶだ！"
    : "にがてを「ふっかつのほこら」で とっくんして さいちょうせんだ！");

  presentResult({
    cleared: pass,
    title: pass ? "ごうかく！！" : "あと すこし…！",
    sub: lines.join("\n"),
    icon: pass ? "🎖" : "",
    stars: null,
    big: { label: "スコア（1000てん まんてん）", value: score, suffix: " てん", fail: !pass },
    rows: battleRows(battle.qs.length),
    xp: battle.xp,
    jingle: pass ? "fanfare" : "fail",
    confetti: pass ? 100 : 0,
    achievements: newAchievements
  });
}

/* ---------- 結果 ---------- */
function endBattle(cleared) {
  if (battle.mode === "exam") { endExam(); return; }
  if (battle.mode === "endless") { endEndless(); return; }
  var stars = 0;
  var bonus = 0;

  var chestReward = null;
  var missionHits = [];
  if (cleared) {
    var miss = battle.idx - battle.correct;   /* 実際に解いた数から計算（最終決戦の早期勝利にも対応） */
    stars = miss === 0 ? 3 : (miss <= 2 ? 2 : 1);
    bonus = battle.mode === "review" ? 15 : 30;
    if (stars === 3) bonus += 20;

    if (battle.mode === "quest") {
      var rec = save.quests[battle.quest.id] || { stars: 0, clears: 0, bossWins: 0 };
      rec.clears++;
      if (stars > rec.stars) rec.stars = stars;
      if (battle.bossCorrect >= 3) { rec.bossWins++; save.stats.bossWins++; }
      save.quests[battle.quest.id] = rec;

      missionHits.push(Missions.record(save, "questClear", 1));
      if (battle.bossCorrect >= 3) missionHits.push(Missions.record(save, "bossWin", 1));

      chestReward = Treasure.grant(save, battle.quest, { stars: stars });
      if (chestReward.type === "xp") { save.xp += chestReward.xp; battle.xp += chestReward.xp; }
    }
    if (battle.mode === "final") {
      save.finalClear = true;
      save.stats.bossWins++;
      bonus = 100;
    }
    if (battle.mode === "expert") {
      save.expertClear = true;
      save.stats.bossWins++;
      bonus = 150;
    }
    save.xp += bonus;
    battle.xp += bonus;

    missionHits.filter(Boolean).forEach(function (m) {
      save.xp += MISSION_BONUS_XP;
      battle.xp += MISSION_BONUS_XP;
    });
  }

  var newAchievements = Achievements.check(save);

  persist();
  syncNow();

  var title, sub;
  var grand = battle.mode === "final" || battle.mode === "expert";
  if (cleared) {
    if (battle.mode === "final") {
      title = "まおうデリートを たおした！！";
      sub = "MOSの ちしきが せかいを すくった！\nきみこそ しんの MOSマスターだ！";
    } else if (battle.mode === "expert") {
      title = "しんおうデリートを たおした！！";
      sub = "エキスパートの おくぎを てにいれた！\nきみは まことの MOSエキスパートだ！";
    } else if (battle.mode === "review") {
      title = "ふくしゅう かんりょう！";
      sub = "きおくが しっかり ていちゃくした！";
    } else {
      title = "クエスト クリア！";
      sub = battle.bossCorrect >= 3 ? "ボスも みごとに とうばつした！" : "ボスには にげられたが クエストは たっせいだ！";
    }
  } else {
    title = "ぜんめつ…";
    sub = "しかし けいけんちは のこった。\nまちがえた もんだいは「ふっかつのほこら」で とっくんできるぞ！";
  }

  presentResult({
    cleared: cleared,
    title: title,
    sub: sub,
    stars: cleared && battle.mode !== "review" ? stars : null,
    rows: battleRows(battle.idx),
    xp: battle.xp,
    hideRetry: battle.mode === "review" && cleared,
    chest: chestReward,
    jingle: cleared ? (grand ? "fanfare" : "clear") : "fail",
    confetti: cleared ? (grand ? 140 : 40) : 0,
    banners: missionHits.filter(Boolean).map(missionBanner),
    achievements: newAchievements
  });
}

function retryBattle() {
  Sound.select();
  if (battle.mode === "quest") startQuest(battle.quest);
  else if (battle.mode === "review") startReview();
  else if (battle.mode === "exam") startExam(battle.subjectKey);
  else if (battle.mode === "expert") startExpert();
  else if (battle.mode === "endless") startEndless();
  else startFinal();
}

/* 「にげる」。めいきゅうは、にげても そこまでの きろくが のこる */
function quitBattle() {
  if (battle.mode === "endless") {
    if (confirm("めいきゅうから だっしゅつしますか？\n（ここまでの きろくは のこります）")) endEndless();
    return;
  }
  if (confirm("クエストを ちゅうだんして マップに もどりますか？\n（かくとくした EXPは のこります）")) openMenu();
}

/* =========================================================
 * メニュー・クエスト選択
 * ======================================================= */
function renderPlayerHeader(prefix) {
  var li = levelInfo(save.xp);
  $("#" + prefix + "-name").textContent = save.player.name;
  $("#" + prefix + "-class").textContent = save.player.klass;
  $("#" + prefix + "-level").textContent = "Lv " + li.level;
  $("#" + prefix + "-rank").textContent = rankFor(li.level) +
    (save.player.equippedTitle ? "・「" + save.player.equippedTitle + "」" : "");
  var fill = $("#" + prefix + "-xpfill");
  if (fill) fill.style.width = Math.floor(li.cur / li.need * 100) + "%";
  var xptext = $("#" + prefix + "-xptext");
  if (xptext) xptext.textContent = "EXP " + li.cur + " / " + li.need;
}

function openMenu() {
  resultToken++;        // リザルトの時間差の演出を止める
  closeLevelUp();
  stopQuickTimer();
  Sound.setTempo(1);
  Juice.clear();
  renderPlayerHeader("menu");
  var due = specialistDueList().length;
  var badge = $("#menu-review-badge");
  if (due > 0) { badge.textContent = due; badge.classList.remove("hidden"); }
  else badge.classList.add("hidden");

  var allCleared = clearedCount() >= ALL_QUESTS.length;
  var finalBtn = $("#menu-final");
  finalBtn.classList.toggle("locked", !allCleared);
  $("#menu-final-lock").textContent = allCleared
    ? (save.finalClear ? "とうばつずみ！ なんども ちょうせんできる" : "ふういんが とかれた…！")
    : "ぜんぶの クエストを クリアすると かいほう";

  var expertBtn = $("#menu-expert");
  expertBtn.classList.toggle("locked", !save.finalClear);
  $("#menu-expert-lock").textContent = save.finalClear
    ? (save.expertClear ? "とうばつずみ！ なんども ちょうせんできる" : "かくされた みちが あらわれた…！")
    : "まおうの城を クリアすると かいほう";

  var endlessOpen = clearedCount() >= ENDLESS_UNLOCK;
  $("#menu-endless").classList.toggle("locked", !endlessOpen);
  $("#menu-endless").classList.toggle("is-new", endlessOpen && save.endless.runs === 0);
  $("#menu-endless-lock").textContent = endlessOpen
    ? (save.endless.best > 0 ? "さいこう きろく：ちか " + save.endless.best + " かい" : "3ミスまでに どこまで もぐれるか！")
    : "クエストを " + ENDLESS_UNLOCK + "つ クリアすると かいほう";

  /* Streak.checkLogin/Achievements.check は同じ日のうちは isNewDay:false／解除済みで
   * 実質なにもしないので、メニューを開くたびに呼んでも安全（新規登録直後もここで初期化される）。 */
  var streakResult = Streak.checkLogin(save);
  Missions.ensureToday(save);
  var newAchievements = Achievements.check(save);
  persist();

  renderStreakChip();
  renderMissions();

  renderMessenger();
  show("screen-menu");
  syncNow();

  if (streakResult.isNewDay) showStreakBanner(streakResult);
  if (newAchievements.length) showAchievementToasts(newAchievements);
}

/* ---------- ストリーク ---------- */
function renderStreakChip() {
  var chip = $("#menu-streak-chip");
  if (save.streak.current > 0) {
    chip.textContent = "🔥 " + save.streak.current + "日目";
    chip.classList.remove("hidden");
  } else {
    chip.classList.add("hidden");
  }
}

function showStreakBanner(result) {
  if (!result.isNewDay) return;
  var due = specialistDueList().length;
  if (result.broken) {
    Juice.banner("🌱", "あたらしい れんぞくきろく、はじめよう！", "さいちょう記録は " + result.longest + "日", "");
  } else {
    Juice.banner("🔥", "れんぞく ログイン", result.streak + "日目！ よくきたね！", "");
    Juice.sparkle($("#menu-streak-chip"), { n: 8 });
  }
  if (due > 0) toast("ふっかつのほこらに " + due + "もん 復習まちだよ！");
  if (result.streak > 0 && (result.streak === 7 || result.streak === 14 || result.streak === 30 || result.streak % 30 === 0)) {
    Sound.heal();
  }
}

/* ---------- デイリーミッション ---------- */
function renderMissions() {
  var box = $("#menu-missions");
  var list = $("#missions-list");
  list.innerHTML = "";
  save.missions.list.forEach(function (m) {
    var row = document.createElement("div");
    row.className = "mission-row" + (m.done ? " done" : "");
    var label = document.createElement("span");
    label.textContent = (m.done ? "✅ " : "・") + m.label;
    var prog = document.createElement("span");
    prog.className = "mission-progress";
    prog.textContent = Math.min(m.progress, m.target) + " / " + m.target;
    row.appendChild(label);
    row.appendChild(prog);
    list.appendChild(row);
  });
  box.classList.toggle("hidden", save.missions.list.length === 0);
}

/* ---------- 実績 ---------- */
/* 実績のお知らせ（上から降りてくる帯）。いちどに たくさん解除されたときは、まとめる */
function showAchievementToasts(list) {
  var shown = list.length > 3 ? list.slice(0, 2) : list;
  shown.forEach(function (a) { Juice.banner("🏅", "じっせき かいほう！", a.name, ""); });
  if (list.length > shown.length) {
    Juice.banner("🏅", "じっせき かいほう！", "ほかにも " + (list.length - shown.length) + "こ！「ぼうけんの しょ」で みてみよう", "");
  }
}

function openAchievements() {
  var box = $("#achievements-list");
  box.innerHTML = "";
  var unlockedCount = 0;
  ACHIEVEMENTS.forEach(function (a) {
    var unlocked = !!save.achievements[a.id];
    if (unlocked) unlockedCount++;
    var div = document.createElement("div");
    div.className = "achievement-card window" + (unlocked ? "" : " locked");
    var icon = document.createElement("span");
    icon.className = "achievement-icon";
    icon.textContent = unlocked ? "🏅" : "🔒";
    var info = document.createElement("div");
    var nm = document.createElement("div");
    nm.className = "achievement-name";
    nm.textContent = unlocked ? a.name : "？？？";
    var ds = document.createElement("div");
    ds.className = "achievement-desc";
    ds.textContent = a.desc;   /* 条件は はじめから見せる（めあてに なるように）。名前は解除してからの おたのしみ */
    info.style.flex = "1";
    info.appendChild(nm); info.appendChild(ds);
    if (!unlocked && a.prog) {
      var pr = a.prog(save);
      var bar = document.createElement("div");
      bar.className = "achievement-bar";
      var fill = document.createElement("div");
      fill.style.width = Math.min(100, Math.floor(pr[0] / pr[1] * 100)) + "%";
      bar.appendChild(fill);
      info.appendChild(bar);
      ds.textContent = a.desc + "（" + Math.min(pr[0], pr[1]) + " / " + pr[1] + "）";
    }
    div.appendChild(icon); div.appendChild(info);
    box.appendChild(div);
  });
  $("#achievements-progress").textContent = unlockedCount + " / " + ACHIEVEMENTS.length + " かいほう ずみ";
  show("screen-achievements");
}

/* ---------- たからばこ ---------- */
var CHEST_RARITY = {
  normal: { label: "ノーマル", rays: null },
  rare:   { label: "★ レア ★", rays: "#6ee7ff" },
  super:  { label: "★★ スーパーレア ★★", rays: "#ffe98a" }
};
function renderChestBox(reward) {
  var box = $("#chest-box");
  if (!reward) { box.classList.add("hidden"); return; }
  box.classList.remove("hidden", "rarity-normal", "rarity-rare", "rarity-super");
  var cv = $("#chest-canvas");
  cv.className = "";
  drawSprite(cv, "chestClosed", "gold", 6);
  var rewardText = $("#chest-reward-text");
  var rarityText = $("#chest-rarity");
  rewardText.classList.add("hidden");
  rarityText.classList.add("hidden");
  var openBtn = $("#chest-open");
  openBtn.classList.remove("hidden");
  var opened = false;
  var token = resultToken;
  openBtn.onclick = function () {
    if (opened) return;
    opened = true;
    openBtn.classList.add("hidden");
    var rarity = CHEST_RARITY[reward.rarity] || CHEST_RARITY.normal;
    /* ガタガタ…と ためてから ひらく（ひかえめ設定では すぐ ひらく） */
    var wait = Juice.isLow() ? 0 : 560;
    if (wait) { Sound.rattle(); cv.classList.add("rattle"); }
    setTimeout(function () {
      if (token !== resultToken) return;
      Sound.chest();
      cv.className = "opening";
      if (reward.type === "palette") drawSprite(cv, reward.shape, reward.palette, 6);
      else drawSprite(cv, "chestOpen", "gold", 6);
      box.classList.add("rarity-" + (reward.rarity || "normal"));
      rarityText.textContent = rarity.label;
      rarityText.classList.remove("hidden");
      rewardText.textContent = reward.label;
      rewardText.classList.remove("hidden");
      var c = Juice.centerOf(cv);
      if (c) {
        Juice.burst(c.x, c.y, { n: reward.rarity === "super" ? 46 : 22, speed: 380, size: 7, shape: "star",
          colors: reward.rarity === "normal" || !reward.rarity ? ["#ffd23b", "#ffffff"] : ["#ffd23b", "#ffffff", "#6ee7ff", "#ff5d7a", "#6ef08c"] });
        Juice.ring(c.x, c.y, { color: rarity.rays || "#ffd23b", r1: 120 });
        if (rarity.rays) Juice.rays(c.x, c.y, { dur: 1.2, len: 200, color: rarity.rays, alpha: 0.2 });
        if (reward.rarity === "super") { Juice.confetti(40); Sound.shiny(); }
      }
    }, wait);
  };
}

/* 試験日カウントダウンの一言（王さま／お姫さま／まおう）を表示する */
function renderMessenger() {
  var box = $("#menu-messenger");
  var line = Countdown.pickLine();
  if (!line) { box.classList.add("hidden"); return; }
  drawSprite($("#messenger-sprite"), line.speaker.shape, line.speaker.palette, 5);
  $("#messenger-name").textContent = line.speaker.label;
  $("#messenger-text").textContent = line.text;
  var headEl = $("#messenger-headline");
  if (line.headline) {
    headEl.textContent = line.headline;
    headEl.classList.remove("hidden");
  } else {
    headEl.classList.add("hidden");
  }
  box.classList.remove("hidden");
}

function openQuestList(subjectKey) {
  var sub = SUBJECTS.filter(function (s) { return s.subject === subjectKey; })[0];
  $("#quests-title").textContent = sub.label;
  var box = $("#quest-list");
  box.innerHTML = "";

  sub.quests.forEach(function (quest, i) {
    var prev = i === 0 ? null : sub.quests[i - 1];
    var unlocked = i === 0 || (save.quests[prev.id] && save.quests[prev.id].stars > 0);
    var rec = save.quests[quest.id] || { stars: 0 };

    var div = document.createElement("div");
    div.className = "quest-card window" + (unlocked ? "" : " locked");

    var cv = document.createElement("canvas");
    drawSprite(cv, quest.mob.shape, quest.mob.palette, 4);

    var info = document.createElement("div");
    info.className = "quest-info";
    var nm = document.createElement("div");
    nm.className = "quest-name";
    nm.textContent = (i + 1) + ". " + quest.name;
    var ds = document.createElement("div");
    ds.className = "quest-desc";
    ds.textContent = unlocked ? quest.desc : "まえの クエストを クリアすると かいほう";
    var st = document.createElement("div");
    st.className = "quest-stars";
    st.textContent = "★".repeat(rec.stars) + "☆".repeat(3 - rec.stars);
    info.appendChild(nm); info.appendChild(ds); info.appendChild(st);

    div.appendChild(cv);
    div.appendChild(info);
    if (unlocked) {
      div.onclick = function () { Sound.select(); startQuest(quest); };
    }
    box.appendChild(div);
  });
  show("screen-quests");
}

/* エキスパートのかくしダンジョン：クエスト一覧＋末尾の裏ボスカード */
function openExpertQuests() {
  $("#quests-title").textContent = EXPERT_QUEST_DATA_EXCEL.label;
  var box = $("#quest-list");
  box.innerHTML = "";

  var quests = EXPERT_QUEST_DATA_EXCEL.quests;
  var allExpertCleared = true;

  quests.forEach(function (quest, i) {
    var prev = i === 0 ? null : quests[i - 1];
    var unlocked = i === 0 || (save.quests[prev.id] && save.quests[prev.id].stars > 0);
    var rec = save.quests[quest.id] || { stars: 0 };
    if (rec.stars === 0) allExpertCleared = false;

    var div = document.createElement("div");
    div.className = "quest-card window" + (unlocked ? "" : " locked");

    var cv = document.createElement("canvas");
    drawSprite(cv, quest.mob.shape, quest.mob.palette, 4);

    var info = document.createElement("div");
    info.className = "quest-info";
    var nm = document.createElement("div");
    nm.className = "quest-name";
    nm.textContent = (i + 1) + ". " + quest.name;
    var ds = document.createElement("div");
    ds.className = "quest-desc";
    ds.textContent = unlocked ? quest.desc : "まえの クエストを クリアすると かいほう";
    var st = document.createElement("div");
    st.className = "quest-stars";
    st.textContent = "★".repeat(rec.stars) + "☆".repeat(3 - rec.stars);
    info.appendChild(nm); info.appendChild(ds); info.appendChild(st);

    div.appendChild(cv);
    div.appendChild(info);
    if (unlocked) {
      div.onclick = function () { Sound.select(); startQuest(quest); };
    }
    box.appendChild(div);
  });

  /* 末尾に裏ボスカードを1枚追加する。全エキスパートクエストをクリアするまでロック */
  var bossDiv = document.createElement("div");
  bossDiv.className = "quest-card window" + (allExpertCleared ? "" : " locked");
  var bossCv = document.createElement("canvas");
  drawSprite(bossCv, "demon", "purple", 4);
  var bossInfo = document.createElement("div");
  bossInfo.className = "quest-info";
  var bossNm = document.createElement("div");
  bossNm.className = "quest-name";
  bossNm.textContent = (quests.length + 1) + ". しんおうデリート";
  var bossDs = document.createElement("div");
  bossDs.className = "quest-desc";
  bossDs.textContent = allExpertCleared
    ? (save.expertClear ? "とうばつずみ！ なんども ちょうせんできる" : "すべてのクエストをクリアした者だけが いどめる")
    : "すべてのエキスパートクエストを クリアすると かいほう";
  bossInfo.appendChild(bossNm); bossInfo.appendChild(bossDs);
  bossDiv.appendChild(bossCv);
  bossDiv.appendChild(bossInfo);
  if (allExpertCleared) {
    bossDiv.onclick = function () { Sound.select(); startExpert(); };
  }
  box.appendChild(bossDiv);

  show("screen-quests");
}

/* =========================================================
 * ランキング
 * ゲーム内でクラス全員のランキングを表示する（read API: Api.getRanking）。
 * 自分の最新の成績を送信してから、サーバー側で並べ替え済みの一覧を取得して表示する。
 * ======================================================= */
function openRanking() {
  show("screen-ranking");
  $("#ranking-list").innerHTML = "";
  if (!Api.enabled()) {
    $("#ranking-note").textContent = "せんせいが せっていすると、ランキングが みられるようになるよ！（いまは オフラインモード）";
    return;
  }
  $("#ranking-note").textContent = "そうしんちゅう…";
  syncNow();
  Api.getRanking(function (ranking) {
    if (!ranking) {
      $("#ranking-note").textContent = "ランキングを とりよせられなかったよ…（つうしんエラー）。じかんを おいて もういちど ためしてね。";
      return;
    }
    if (!ranking.length) {
      $("#ranking-note").textContent = "まだ だれも せいせきを とどけていないみたい。";
      return;
    }
    $("#ranking-note").textContent = "";
    var myId = save.player.id;
    var box = $("#ranking-list");
    ranking.forEach(function (r) {
      var row = document.createElement("div");
      row.className = "ranking-row window" + (r.id === myId ? " me" : "");
      var rankEl = document.createElement("span");
      rankEl.className = "ranking-rank";
      rankEl.textContent = r.rank <= 3 ? ["🥇", "🥈", "🥉"][r.rank - 1] : r.rank;
      var info = document.createElement("div");
      info.className = "ranking-info";
      var nameEl = document.createElement("div");
      nameEl.className = "ranking-name";
      nameEl.textContent = r.name + "（" + r.klass + "）";
      var statsEl = document.createElement("div");
      statsEl.className = "ranking-stats";
      statsEl.textContent = "Lv." + r.level + " / XP " + r.xp + " / ⭐" + r.stars;
      info.appendChild(nameEl); info.appendChild(statsEl);
      row.appendChild(rankEl); row.appendChild(info);
      box.appendChild(row);
    });
  });
}

/* =========================================================
 * ステータス（ぼうけんのしょ）
 * ======================================================= */
function openStatus() {
  renderPlayerHeader("status");
  var li = levelInfo(save.xp);
  var acc = save.stats.answered ? Math.round(save.stats.correct / save.stats.answered * 100) : 0;
  $("#status-stats").innerHTML = "";
  [
    ["こたえた かず", save.stats.answered + " 回"],
    ["せいかいりつ", acc + " %"],
    ["さいだいコンボ", save.stats.bestCombo + " れんぞく"],
    ["ボスとうばつ", save.stats.bossWins + " 体"],
    ["クエストたっせい", clearedCount() + " / " + ALL_QUESTS.length],
    ["あつめた ★", totalStars() + " / " + (ALL_QUESTS.length * 3)],
    ["もぎけんてい さいこう", (function () {
      var ex = save.exams || {};
      var e = ex.excel ? ex.excel.best + "てん" : "—";
      var w = ex.word ? ex.word.best + "てん" : "—";
      return "Excel " + e + " / Word " + w;
    })()],
    ["ふくしゅう まち", specialistDueList().length + " もん"],
    ["かいしんの いちげき", save.stats.crits + " 回"],
    ["クイックせいかい", save.stats.quicks + " 回"],
    ["ひっさつわざ", save.stats.specials + " 回"],
    ["たおした モンスター", save.stats.kills + " 体"],
    ["むげんの めいきゅう", save.endless.best > 0 ? "ちか " + save.endless.best + " かい" : "—"],
    ["ぶき", weaponFor(li.level).name],
    ["しょうごう", save.finalClear ? "まおうを たおせし者" : rankFor(li.level)]
  ].forEach(function (pair) {
    var dt = document.createElement("dt"); dt.textContent = pair[0];
    var dd = document.createElement("dd"); dd.textContent = pair[1];
    $("#status-stats").appendChild(dt);
    $("#status-stats").appendChild(dd);
  });

  /* しゅうじゅく度マップ（問題ごとの記憶ボックスを色で表示） */
  var map = $("#status-mastery");
  map.innerHTML = "";
  SUBJECTS.forEach(function (sub) {
    var h = document.createElement("div");
    h.className = "mastery-subject";
    h.textContent = sub.label;
    map.appendChild(h);
    sub.quests.forEach(function (quest) {
      var row = document.createElement("div");
      row.className = "mastery-row";
      var label = document.createElement("span");
      label.className = "mastery-label";
      label.textContent = quest.name;
      row.appendChild(label);
      quest.questions.forEach(function (q) {
        var cell = document.createElement("span");
        var m = SRS.mastery(save.records, q.id);
        cell.className = "mastery-cell m" + (m < 0 ? "x" : m);
        cell.title = q.q;
        row.appendChild(cell);
      });
      map.appendChild(row);
    });
  });

  /* たからばこで手に入れた しょうごう */
  var tbox = $("#titles-box");
  if (save.titles.length) {
    tbox.classList.remove("hidden");
    var sel = $("#title-select");
    sel.innerHTML = '<option value="">（なし）</option>';
    save.titles.forEach(function (t) {
      var op = document.createElement("option");
      op.value = t; op.textContent = t;
      if (save.player.equippedTitle === t) op.selected = true;
      sel.appendChild(op);
    });
    sel.onchange = function () {
      save.player.equippedTitle = sel.value || null;
      persist();
      Sound.select();
      renderPlayerHeader("status");
    };
  } else {
    tbox.classList.add("hidden");
  }

  updateFxButtons();
  show("screen-status");
}

/* =========================================================
 * モンスター図鑑
 * ======================================================= */
function openBestiary() {
  var list = buildBestiaryList(ALL_QUESTS);
  var box = $("#bestiary-list");
  box.innerHTML = "";
  var seenCount = 0;

  list.forEach(function (m) {
    var seen = save.seenMonsters.indexOf(m.name) >= 0;
    if (seen) seenCount++;

    var div = document.createElement("div");
    div.className = "bestiary-card window" + (seen ? "" : " locked");

    var shinyPal = save.shinyMonsters[m.name];
    var cv = document.createElement("canvas");
    if (seen) drawSprite(cv, m.shape, shinyPal || m.palette, 5);

    var info = document.createElement("div");
    info.className = "bestiary-info";
    var nm = document.createElement("div");
    nm.className = "bestiary-name";
    nm.textContent = seen
      ? m.name + (m.rare ? "　✨げきレア" : "") + (shinyPal ? "　🌟シャイニー" : "")
      : "？？？";
    var bio = document.createElement("div");
    bio.className = "bestiary-bio";
    bio.textContent = seen ? (BESTIARY[m.name] || "") : "まだ であっていない…";
    info.appendChild(nm); info.appendChild(bio);
    var kills = save.kills[m.name] || 0;
    if (seen && kills > 0) {
      var medal = medalFor(kills);
      var next = null;
      MEDALS.forEach(function (x) { if (!next && kills < x.at) next = x; });
      var meta = document.createElement("div");
      meta.className = "bestiary-meta";
      meta.textContent = (medal ? medal.icon + " " : "") + "たおした数 " + kills + " たい" +
        (next ? "（" + next.name + "まで あと " + (next.at - kills) + "）" : "");
      info.appendChild(meta);
    }

    div.appendChild(cv); div.appendChild(info);
    box.appendChild(div);
  });

  $("#bestiary-progress").textContent = seenCount + " / " + list.length + " たいと であった";
  show("screen-bestiary");
}

function resetData() {
  if (!confirm("ぼうけんのしょを けしますか？\n（レベル・復習記録が すべて きえます）")) return;
  if (!confirm("ほんとうに よろしいですか？")) return;
  localStorage.removeItem(SAVE_KEY);
  location.reload();
}

/* =========================================================
 * 起動・登録・なまえの変更
 * ======================================================= */
function populateClassSelect(selected) {
  var sel = $("#register-class");
  sel.innerHTML = "";
  GAME_CONFIG.CLASSES.forEach(function (c) {
    var op = document.createElement("option");
    op.value = c; op.textContent = c;
    sel.appendChild(op);
  });
  if (selected && GAME_CONFIG.CLASSES.indexOf(selected) >= 0) sel.value = selected;
}

function startAdventure() {
  Sound.select();
  if (save) { openMenu(); return; }
  populateClassSelect(null);
  $("#register-title").textContent = "ぼうけんしゃ とうろく";
  $("#register-submit").textContent = "ぼうけんに でる！";
  $("#register-cancel").classList.add("hidden");
  $("#register-name").value = "";
  show("screen-register");
  $("#register-name").focus();
}

/* ぼうけんのしょ画面からの「なまえ・クラスをかえる」 */
function openProfileEdit() {
  Sound.select();
  populateClassSelect(save.player.klass);
  $("#register-title").textContent = "なまえ・クラスの へんこう";
  $("#register-submit").textContent = "へんこうを ほぞん";
  $("#register-cancel").classList.remove("hidden");
  $("#register-name").value = save.player.name;
  show("screen-register");
  $("#register-name").focus();
}

function submitRegister() {
  var name = $("#register-name").value.trim();
  if (!name) { toast("なまえを いれてね！"); return; }
  if (name.length > 10) { toast("なまえは 10もじ いないで！"); return; }

  if (save) {
    /* 変更モード: IDはそのままなので、せんせいの記録も同じ行が更新される */
    save.player.name = name;
    save.player.klass = $("#register-class").value;
    persist();
    Sound.heal();
    syncNow();
    toast("なまえ・クラスを へんこうしたよ！");
    openStatus();
    return;
  }

  save = newSave(name, $("#register-class").value);
  persist();
  Sound.levelup();
  syncNow();
  openMenu();
}

/* =========================================================
 * ご意見箱（どの画面からでも投稿できる）
 * ======================================================= */
function openFeedback() {
  Sound.select();
  $("#feedback-text").value = "";
  $("#feedback-modal").classList.remove("hidden");
  $("#feedback-text").focus();
}

function closeFeedback() {
  $("#feedback-modal").classList.add("hidden");
}

function submitFeedback() {
  var text = $("#feedback-text").value.trim();
  if (!text) { toast("かきたいことを いれてね！"); return; }
  if (!Api.enabled()) { toast("せんせいが つうしんを せっていすると つかえるよ！"); return; }

  var btn = $("#feedback-send");
  btn.disabled = true;
  Api.sendFeedback({
    name: save && save.player ? save.player.name : "（とうろくまえ）",
    klass: save && save.player ? save.player.klass : "",
    text: text,
    place: (document.querySelector(".screen.active") || {}).id || ""
  }, function (ok) {
    btn.disabled = false;
    if (ok) {
      closeFeedback();
      Sound.heal();
      toast("ごいけん ありがとう！ せんせいに とどけたよ！");
    } else {
      toast("そうしんに しっぱいした… もういちど ためしてみてね");
    }
  });
}

function updateMuteButton() {
  var m = Sound.mode();
  $("#btn-mute").textContent = m === "all" ? "♪ ON" : (m === "se" ? "♪ SEのみ" : "♪ OFF");
}

/* えんしゅつ（はで／ひかえめ）の切りかえ。タイトルと「ぼうけんの しょ」の両方から変えられる */
function updateFxButtons() {
  var low = Juice.isLow();
  $("#btn-fx-level").textContent = low ? "ひかえめ（タップで はで に）" : "はで（タップで ひかえめ に）";
  $("#title-fx-toggle").textContent = "✨ えんしゅつ：" + (low ? "ひかえめ" : "はで") + "（タップで きりかえ）";
}
function toggleFxLevel() {
  Juice.setLevel(Juice.isLow() ? "high" : "low");
  Juice.clear();
  Sound.select();
  updateFxButtons();
  toast(Juice.isLow() ? "えんしゅつを ひかえめに したよ" : "えんしゅつを はでに したよ！");
}

/* タイトル画面：星がまたたく */
function startTitleSparkle() {
  setInterval(function () {
    if (Juice.isLow() || document.hidden || !$("#screen-title").classList.contains("active")) return;
    var s = Juice.size();
    Juice.burst(Math.random() * s.w, Math.random() * s.h * 0.8, {
      n: 1, shape: "star", g: 0, speed: 10, size: 9, life: 1.5,
      colors: ["#ffffff", "#fff27a", "#6ee7ff", "#ffd23b"]
    });
  }, 260);
}

window.addEventListener("DOMContentLoaded", function () {
  Juice.init();
  save = loadSave();
  if (save) {
    /* 旧セーブとの後方互換：新しく追加したフィールドがなければ初期値を補う */
    ensureSaveShape(save);
    persist();
  }
  $("#title-start").textContent = save ? "ぼうけんを つづける" : "ぼうけんを はじめる";
  if (save) {
    var li = levelInfo(save.xp);
    $("#title-continue-info").textContent =
      save.player.name + "（Lv" + li.level + " " + rankFor(li.level) + "）の ぼうけんのしょ";
  }
  updateMuteButton();
  updateFxButtons();
  startTitleSparkle();

  /* 敵のうごきが終わったら待機にもどす */
  $("#enemy-canvas").addEventListener("animationend", onEnemyAnimEnd);
  /* レベルアップのえんしゅつは タップで とじる */
  $("#levelup-overlay").onclick = closeLevelUp;
  $("#btn-fx-level").onclick = toggleFxLevel;
  $("#title-fx-toggle").onclick = toggleFxLevel;
  /* ボタンを押したところから、小さく光がはじける */
  document.addEventListener("pointerdown", function (e) {
    var t = e.target && e.target.closest ? e.target.closest(".btn, .choice, .quest-card") : null;
    if (!t || t.disabled || t.classList.contains("locked")) return;
    Juice.burst(e.clientX, e.clientY, { n: 6, speed: 150, size: 4, life: 0.35, g: 200, colors: ["#ffd23b", "#ffffff", "#6ee7ff"] });
  });

  /* タイトルのデコ用モンスター */
  drawSprite($("#title-sprite-1"), "slime", "green", 6);
  drawSprite($("#title-sprite-2"), "dragon", "red", 6);
  drawSprite($("#title-sprite-3"), "ghost", "pink", 6);

  /* イベント登録 */
  $("#title-start").onclick = startAdventure;
  $("#register-submit").onclick = submitRegister;
  /* ※Enterキーでの送信はしない（日本語入力の確定で誤って先に進むのを防ぐため） */
  $("#register-cancel").onclick = function () { Sound.select(); openStatus(); };
  $("#btn-edit-profile").onclick = openProfileEdit;
  $("#btn-bestiary").onclick = function () { Sound.select(); openBestiary(); };
  $("#btn-achievements").onclick = function () { Sound.select(); openAchievements(); };

  /* ご意見箱 */
  $("#btn-feedback").onclick = openFeedback;
  $("#feedback-close").onclick = closeFeedback;
  $("#feedback-send").onclick = submitFeedback;
  $("#feedback-modal").onclick = function (e) {
    if (e.target === this) closeFeedback();   /* 外側クリックで閉じる */
  };

  $("#menu-excel").onclick = function () { Sound.select(); openQuestList("excel"); };
  $("#menu-word").onclick = function () { Sound.select(); openQuestList("word"); };
  $("#menu-review").onclick = function () { Sound.select(); startReview(); };
  $("#menu-final").onclick = function () {
    if (clearedCount() < ALL_QUESTS.length) {
      toast("まだ ふういんされている… すべての クエストを クリアせよ！");
      return;
    }
    Sound.select(); startFinal();
  };
  $("#menu-expert").onclick = function () {
    if (!save.finalClear) {
      toast("まだ かくされている… まおうの城を さきに クリアせよ！");
      return;
    }
    Sound.select(); openExpertQuests();
  };
  $("#menu-endless").onclick = function () {
    if (clearedCount() < ENDLESS_UNLOCK) {
      toast("まだ とびらが ひらかない… クエストを " + ENDLESS_UNLOCK + "つ クリアせよ！");
      return;
    }
    Sound.select(); startEndless();
  };
  $("#menu-exam").onclick = function () { Sound.select(); openExamSelect(); };
  $("#menu-practical").onclick = function () { Sound.select(); openPractical(); };
  $("#menu-ranking").onclick = function () { Sound.select(); openRanking(); };
  $("#menu-status").onclick = function () { Sound.select(); openStatus(); };

  document.querySelectorAll(".btn-back").forEach(function (b) {
    b.onclick = function () { Sound.select(); openMenu(); };
  });
  $("#battle-quit").onclick = quitBattle;
  $("#battle-continue").onclick = nextTurn;
  $("#battle-msg").onclick = finishType;
  $("#result-next").onclick = function () { Sound.select(); openMenu(); };
  $("#result-retry").onclick = retryBattle;
  $("#btn-mute").onclick = function () { Sound.cycleMode(); updateMuteButton(); Sound.select(); };
  $("#btn-reset").onclick = resetData;

  show("screen-title");
});
