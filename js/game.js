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
/* 全対策項目（js/courses.js の COURSES）の科目をつなげたもの。
 * quest.course / QUESTION_INDEX[id].course に、どの対策項目の問題かを記録する。 */
var SUBJECTS = [];
var QUESTION_INDEX = {};   // qid -> {q:問題, quest:クエスト, subject, course}
var ALL_QUESTS = [];       // 全クエスト（順序つき・全対策項目）
COURSES.forEach(function (course) {
  course.subjects.forEach(function (sub) {
    sub.course = course.key;
    SUBJECTS.push(sub);
    sub.quests.forEach(function (quest) {
      quest.subject = sub.subject;
      quest.course = course.key;
      ALL_QUESTS.push(quest);
      quest.questions.forEach(function (q) {
        QUESTION_INDEX[q.id] = { q: q, quest: quest, subject: sub.subject, course: course.key };
      });
    });
  });
});

/* ---------- 対策項目（コース） ---------- */
/* 表示する対策項目。GAME_CONFIG.COURSES（例 ["mos", "ipa_fe"]）があれば、それでしぼる */
/* 問題が1問も入っていない項目（問題ファイル未収録の IPA など）は出さない */
function courseHasQuestions(c) {
  return c.subjects.some(function (sub) { return sub.quests.some(function (q) { return q.questions.length > 0; }); });
}
function availableCourses() {
  var keys = GAME_CONFIG.COURSES;
  var list = COURSES.filter(function (c) { return courseHasQuestions(c) && (!keys || !keys.length || keys.indexOf(c.key) >= 0); });
  return list.length ? list : [COURSES[0]];
}
function courseDef(key) {
  return COURSES.filter(function (c) { return c.key === key; })[0] || null;
}
/* 選択中の対策項目。save.course が無い・表示しない項目のときは、表示する項目の先頭 */
function currentCourseDef() {
  var list = availableCourses();
  var key = save && save.course;
  for (var i = 0; i < list.length; i++) if (list[i].key === key) return list[i];
  return list[0];
}
function currentCourse() { return currentCourseDef().key; }
/* 選択中の対策項目の科目・クエスト */
function courseSubjects() {
  var key = currentCourse();
  return SUBJECTS.filter(function (s) { return s.course === key; });
}
function courseQuests() {
  var key = currentCourse();
  return ALL_QUESTS.filter(function (q) { return q.course === key; });
}
function inCourse(qid) {
  return !!QUESTION_INDEX[qid] && QUESTION_INDEX[qid].course === currentCourse();
}
/* ---------- はんい（科目A だけ／科目B だけ／A＋B） ----------
 * 対策項目の定義に scopes があり、問題の入っている科目が2つ以上あるときだけ選べる。
 * 復習・まおうの城・むげんの めいきゅうは、入るときに はんいを えらぶ（enterWithScope）。
 * えらんだ はんいは activeScopeKey に入れ、メニューに もどると消す。メニューの上では
 * いちばん広い はんい（A＋B）として数える（復習の件数・解放の判定など）。
 * もぎけんていは科目ごとに分かれているので、はんいは えらばない。
 * クエスト（科目ボタンから入るもの）は、はんいに関係なく その科目のまま。
 * save.scopes[対策項目] は「まえ回 えらんだ はんい」（えらぶ画面で目印を付けるだけ）。 */
var activeScopeKey = null;
function scopeChoices() {
  var def = currentCourseDef();
  if (!def.scopes) return [];
  var filled = courseSubjects().filter(function (sub) {
    return sub.quests.some(function (q) { return q.questions.length > 0; });
  }).map(function (sub) { return sub.subject; });
  if (filled.length < 2) return [];
  return def.scopes;
}
function widestScope(list) {
  return list.reduce(function (a, b) { return b.subjects.length > a.subjects.length ? b : a; });
}
function currentScope() {
  var list = scopeChoices();
  if (!list.length) return null;
  for (var i = 0; i < list.length; i++) if (list[i].key === activeScopeKey) return list[i];
  return widestScope(list);
}
/* はんいを一時的に かえて fn を呼ぶ（えらぶ画面で、はんいごとの解放・件数を出すため） */
function withScope(key, fn) {
  var prev = activeScopeKey;
  activeScopeKey = key;
  try { return fn(); } finally { activeScopeKey = prev; }
}
function scopeHasSubject(subjectKey) {
  var sc = currentScope();
  return !sc || sc.subjects.indexOf(subjectKey) >= 0;
}
function scopeQuests() {
  return courseQuests().filter(function (q) { return scopeHasSubject(q.subject); });
}
function inScope(qid) {
  return inCourse(qid) && scopeHasSubject(QUESTION_INDEX[qid].subject);
}
function scopeClearedCount() {
  var n = 0;
  scopeQuests().forEach(function (q) { if (save.quests[q.id] && save.quests[q.id].stars > 0) n++; });
  return n;
}
function courseClearedCount() {
  var n = 0;
  courseQuests().forEach(function (q) { if (save.quests[q.id] && save.quests[q.id].stars > 0) n++; });
  return n;
}
/* まおうの城の討伐。MOS は今までどおり save.finalClear（エキスパートの解放条件にもなる）、
 * ほかの対策項目は save.finalClears[項目キー] に分けて持つ */
function isFinalCleared(key) {
  key = key || currentCourse();
  return key === "mos" ? !!save.finalClear : !!(save.finalClears && save.finalClears[key]);
}

/* SRS.dueList/weakList は save.records 全体（エキスパートの問題を答えた記録も含む）を
 * 見境なく返すため、まおうの城・ふっかつのほこら等の「Specialist側」の消費先では
 * 必ずこのフィルターを通す（そうしないとエキスパート限定のidがQUESTION_INDEXに無く
 * qs.map(...).q が undefined になってクラッシュする）。エキスパート側は
 * EXPERT_QUESTION_INDEX で同様にフィルターする（startExpert() 参照）。 */
/* さらに、選択中の対策項目の問題だけにしぼる（MOS の復習に IPA の問題が混ざらないように。逆も同じ） */
/* さらに、はんい（科目A だけ／科目B だけ など）の科目の問題だけにしぼる */
function specialistDueList() {
  return SRS.dueList(save.records).filter(inScope);
}
function specialistWeakList() {
  return SRS.weakList(save.records).filter(inScope);
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
var persistWarned = false;
function persist() {
  /* プライベートブラウズや容量いっぱいの端末では保存に失敗することがある。
   * そのときもゲームは止めず、いちどだけ知らせる（その回の記録は、閉じると残らない）。 */
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch (e) {
    if (!persistWarned) {
      persistWarned = true;
      setTimeout(function () { toast("この たんまつでは きろくを ほぞんできないみたい…（とじると きえます）"); }, 0);
    }
  }
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
  s.gauge = s.gauge || 0;                  // ひっさつゲージ（0〜100）。戦闘をまたいで持ちこす
  s.hints = s.hints || {};                 // 見せおわった「はじめての ヒント」
  /* v2.1 で足したもの（対策項目） */
  s.course = s.course || null;             // 前回えらんだ対策項目（"mos" / "ipa_fe"）。無ければ選択画面を出す
  s.finalClears = s.finalClears || {};     // MOS 以外の対策項目の まおうの城 討伐（MOS は finalClear のまま）
  s.scopes = s.scopes || {};               // 対策項目ごとの はんい（IPA："all" / "fe_a" / "fe_b"）
  /* v2.5 で足したもの（アバター・しょくぎょう。js/avatar.js） */
  s.avatar = s.avatar || null;             // {hair, hairColor, skin, eyes}。null なら まだ作っていない（作る画面を出す）
  s.job = s.job || "programmer";           // いまの しょくぎょう（JOBS の key）
  s.jobXp = s.jobXp || {};                 // しょくぎょう -> その しょくぎょうで ためた EXP（しょくぎょうレベル）
  s.jobStyle = s.jobStyle || {};           // しょくぎょう -> 1 なら いろちがいの服（しょくぎょうLv5〜）
  s.subJob = s.subJob || null;             // サブ特ちょう（マスターした しょくぎょうの key）
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
function courseStars() {
  var s = 0;
  courseQuests().forEach(function (q) { if (save.quests[q.id]) s += (save.quests[q.id].stars || 0); });
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
    examWord: save.exams && save.exams.word ? save.exams.word.best : 0,
    examFe: save.exams && save.exams.fe_a ? save.exams.fe_a.best : 0,
    course: save.course || "",
    examFeB: save.exams && save.exams.fe_b ? save.exams.fe_b.best : 0   // 基本情報 科目B の模試（GAS の列は末尾の examFeB）
  });
}

/* ---------- 画面制御 ---------- */
function show(id) {
  document.querySelectorAll(".screen").forEach(function (s) {
    s.classList.remove("active");
  });
  $("#" + id).classList.add("active");
  document.body.classList.toggle("in-battle", id === "screen-battle");
  /* バトルの外では、ステージの粒を止めて、マップの曲にもどす（リザルトは無音でジングルを聞かせる） */
  if (id !== "screen-battle") { Fx.stopAmbient(); Fx.cancel(); }
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
    /* クエストに hearts があれば、その数（科目B の道場は1問が長いので ♥5） */
    idx: 0, hearts: quest.hearts || 3, maxHearts: quest.hearts || 3,
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
  $("#quests-title").dataset.subject = "";
  var box = $("#quest-list");
  box.innerHTML = "";
  currentCourseDef().exams.filter(function (ex) { return scopeHasSubject(ex.subject); }).forEach(function (ex) {
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
    ds.textContent = ex.count + "もん / 1000てんまんてん / ごうかくライン " + ex.pass + "てん";
    var st = document.createElement("div");
    st.className = "quest-stars";
    var best = save.exams && save.exams[ex.key] ? save.exams[ex.key].best : 0;
    st.textContent = best > 0 ? "さいこう " + best + " てん" : "みちょうせん";
    info.appendChild(nm); info.appendChild(ds); info.appendChild(st);
    div.appendChild(cv); div.appendChild(info);
    div.onclick = function () { Sound.select(); startExam(ex.key); };
    box.appendChild(div);
  });
  enableCardKeys();
  show("screen-quests");
}

/* 対策項目の定義（js/courses.js の exams）から、もぎけんていの構成をさがす */
function examDef(examKey) {
  var found = null;
  COURSES.forEach(function (c) {
    c.exams.forEach(function (ex) { if (ex.key === examKey) found = ex; });
  });
  return found;
}

/* もぎけんてい開始（1000点満点。問題数・合格ラインは対策項目の定義から。MOS は20問・700点） */
function startExam(examKey) {
  var ex = examDef(examKey);
  var sub = SUBJECTS.filter(function (s) { return s.subject === ex.subject; })[0];
  var per = Math.ceil(ex.count / sub.quests.length);
  var pool = [];
  sub.quests.forEach(function (q) { pool = pool.concat(sampleQuestQuestions(q, per)); });
  var qs = shuffle(pool).slice(0, ex.count);
  battle = {
    mode: "exam",
    subjectKey: examKey,
    exam: ex,
    quest: null,
    label: ex.label,
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
  var pool = Object.keys(QUESTION_INDEX).filter(inScope);
  var weak = specialistWeakList().slice(0, 6);
  var rest = shuffle(pool.filter(function (id) { return weak.indexOf(id) < 0; }));
  var ids = weak.concat(rest).slice(0, 12);
  var qs = shuffle(ids.map(function (qid) { return QUESTION_INDEX[qid].q; }));
  battle = {
    mode: "final",
    quest: null,
    label: "まおうの城",
    course: currentCourse(),
    qs: qs,
    bossFrom: 0,               // 全問ボス戦
    /* 12問中9問せいかいで討伐。問題が12問に足りない項目では、出せる問題数に合わせてへらす（勝てなくならないように） */
    bossHp: Math.min(9, Math.ceil(qs.length * 0.75)), bossMax: Math.min(9, Math.ceil(qs.length * 0.75)),
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
  critMul: 1.2,         // かいしんのEXP倍率
  specialMul: 1.3,      // ひっさつわざのEXP倍率
  gaugeCorrect: 15,     // ひっさつゲージ：せいかい1回ぶん（100でMAX。6〜7問に1回くらい）
  gaugeCrit: 10,        // 　〃　：かいしんの上のせ
  /* クイック（早押し）は「見た目・音・実績」だけのごほうびにしてある。
   * 下の3つを 0 より大きくすると、読むのが速い人ほどEXPが多くなる（ランキングに影響する）。
   * 日本語を勉強中の人が不利にならないよう、0 のままを すすめる。 */
  quickXp: 0,           // クイックせいかいのボーナスEXP
  critQuick: 0,         // クイックせいかいのときの、かいしんの確率の上のせ
  gaugeQuick: 0,        // クイックせいかいのときの、ひっさつゲージの上のせ
  shinyChance: 0.03,    // 色ちがいのモンスターが出る確率
  shinyXp: 15,          // 色ちがいをたおしたときのボーナスEXP
  feverCombo: 5         // このコンボからフィーバー
};

/* ---------- しょくぎょうレベル ----------
 * その しょくぎょうで いるあいだに手に入れた EXP で上がる（ふつうのレベルとは別。ふつうのレベルは そのまま）。
 * Lv5：いろちがいの服 ／ Lv10：特ちょうが強くなる ／ Lv20（マスター）：★・しょうごう・サブ特ちょうに できる */
var JOB_MAX_LEVEL = 20;
var JOB_LV_STYLE = 5, JOB_LV_BOOST = 10;
function jobXpNeed(level) { return 20 + (level - 1) * 10; }
function jobLevelInfo(jobKey) {
  var level = 1, rest = (save.jobXp && save.jobXp[jobKey]) || 0;
  while (level < JOB_MAX_LEVEL && rest >= jobXpNeed(level)) { rest -= jobXpNeed(level); level++; }
  return { level: level, cur: rest, need: jobXpNeed(level), max: level >= JOB_MAX_LEVEL };
}
function jobLevel(jobKey) { return jobLevelInfo(jobKey).level; }
function jobMastered(jobKey) { return jobLevel(jobKey) >= JOB_MAX_LEVEL; }
function masterTitle(jobKey) { return jobDef(jobKey).name + "マスター"; }
/* EXP を手に入れたら、いまの しょくぎょうにも入れる。レベルが上がったら知らせる */
function addJobXp(n) {
  if (!save || !n || n <= 0) return;
  var key = save.job;
  var before = jobLevel(key);
  save.jobXp[key] = (save.jobXp[key] || 0) + n;
  var after = jobLevel(key);
  if (after <= before) return;
  var job = jobDef(key);
  var reward = after >= JOB_MAX_LEVEL ? "マスター！ しょうごう「" + masterTitle(key) + "」・サブ特ちょうに できる"
    : after >= JOB_LV_BOOST && before < JOB_LV_BOOST ? "特ちょう「" + job.perkName + "」が つよくなった！"
    : after >= JOB_LV_STYLE && before < JOB_LV_STYLE ? "いろちがいの服が きられるように なった！"
    : job.name + " Lv " + after;
  if (after >= JOB_MAX_LEVEL && save.titles.indexOf(masterTitle(key)) < 0) save.titles.push(masterTitle(key));
  setTimeout(function () {
    Sound.levelup();
    Juice.banner("🧑‍💻", "しょくぎょう レベルアップ！ " + job.name + " Lv " + after, reward, "levelup");
  }, 900);
}
/* じぶんの アバターを描く（いろちがいの服も） */
function drawMyAvatar(canvas, jobKey, scale) {
  drawAvatar(canvas, save.avatar, jobKey, scale, !!(save.jobStyle[jobKey] && jobLevel(jobKey) >= JOB_LV_STYLE));
}

/* しょくぎょうの特ちょう（js/avatar.js の JOBS の perks）の、いまの値。持っていなければ 0。
 * しょくぎょうLv10 で強くなり、マスターした しょくぎょうを「サブ特ちょう」に すると、その特ちょうも足される。
 * もぎけんてい（本番と同じ条件）では、どれも効かない。強さは JOBS の数値で変える */
var PERK_BOOST = {   // しょくぎょうLv10 で どう強くなるか
  heartGuard: ["add", 1], comboKeep: ["add", 1], regen: ["add", 1],
  gaugeCombo: ["mul", 1.5], gaugeOnMiss: ["mul", 1.5], startGauge: ["mul", 1.5], crit: ["mul", 1.5],
  chestLuck: ["mul", 1.5], specialMul: ["mul", 1.5], bossXp: ["mul", 1.5], missionXp: ["mul", 1.6],
  reviewXp: ["set", 1.15], shiny: ["set", 3]
};
var PERK_INT = { heartGuard: 1, comboKeep: 1, regen: 1, gaugeCombo: 1, gaugeOnMiss: 1, startGauge: 1, bossXp: 1, missionXp: 1 };
function jobPerkValue(jobKey, name, boosted) {
  var v = jobDef(jobKey).perks[name] || 0;
  if (!v || !boosted || !PERK_BOOST[name]) return v;
  var b = PERK_BOOST[name];
  v = b[0] === "add" ? v + b[1] : b[0] === "mul" ? v * b[1] : b[1];
  return PERK_INT[name] ? Math.round(v) : v;
}
function perkVal(name) {
  if (!save || (battle && battle.mode === "exam")) return 0;
  var main = jobPerkValue(save.job, name, jobLevel(save.job) >= JOB_LV_BOOST);
  var sub = save.subJob && save.subJob !== save.job && jobMastered(save.subJob) ? jobPerkValue(save.subJob, name, false) : 0;
  if (name === "reviewXp" || name === "shiny") return Math.max(main, sub);   /* 倍率は 大きいほう */
  return main + sub;
}
/* とくい分野：いまの しょくぎょうが、この問題を とくいとするか（IPA は分野、MOS は科目で決める） */
var LIKE_XP = 1.2, LIKE_GAUGE = 10;
function jobLikes(jobKey, q) {
  if (!q || !q.id || !QUESTION_INDEX[q.id]) return false;
  var job = jobDef(jobKey);
  if (q.field) return job.fields.indexOf(q.field) >= 0;
  return job.mosSubjects.indexOf(QUESTION_INDEX[q.id].subject) >= 0;
}
function likedNow(q) {
  return !!battle && battle.mode !== "exam" && jobLikes(save.job, q);
}
function missionBonusXp() {
  return MISSION_BONUS_XP + perkVal("missionXp");
}

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

/* ひっさつわざの名前（MOSで習う操作にちなむ。機能の名前は、問題文と同じ書き方＝試験で見る字にする） */
var SPECIAL_MOVES = [
  "Ctrl+Z ブレイカー", "オートSUM キャノン", "絶対参照 ロック", "フラッシュフィル ストーム",
  "条件付き書式 バースト", "スタイル いっかつ ざん", "目次 じどうせいせい", "ウィンドウ枠の 固定"
];

/* はじめての ヒント：新しいしくみに はじめて出会ったときだけ、メッセージの最後に ひとこと そえる。
 * （説明書を読まなくても、遊びながら分かるように。1回見せたら save.hints に記録して、もう出さない） */
var HINTS = {
  combo:   "れんぞく せいかいで コンボ！ つづけるほど こうげきが しんかして、もらえる EXPも ふえるぞ。",
  quick:   "「クイック！」は はやく せいかいした しるし。EXPは かわらないので、あせらず よく よんで こたえよう。",
  crit:    "かいしんの いちげきは、ときどき でる ラッキーな いちげき。EXPが すこし ふえるぞ。",
  gauge:   "ひっさつゲージが MAXに なった！ つぎの せいかいで ひっさつわざが でるぞ。",
  special: "ひっさつわざは EXPが ふえる。ゲージは つぎの たたかいにも もちこせるぞ。",
  shiny:   "色ちがいの モンスターを たおすと、図鑑に 色ちがいが とうろくされるぞ。"
};
function firstHint(key) {
  if (!key || !HINTS[key] || save.hints[key]) return "";
  save.hints[key] = 1;
  return "\n【ヒント】" + HINTS[key];
}

/* いま戦闘画面で、この問題の番のままか（時間差の演出が、次の問題や別の画面に出ないように） */
function battleLive(b, turn) {
  return battle === b && battle.idx === turn && $("#screen-battle").classList.contains("active");
}

/* ---------- もぎけんていのタイマー（定義に minutes がある模試だけ。MOS の模試は時間なし） ---------- */
var examTimer = null;
function stopExamTimer() {
  clearInterval(examTimer);
  examTimer = null;
  $("#battle-timer").classList.add("hidden");
}
/* 最初の問題が出たときに始める（画面の切りかえの演出の間は数えない） */
function startExamTimer() {
  if (battle.mode !== "exam" || !battle.exam || !battle.exam.minutes || battle.deadline) return;
  battle.deadline = Date.now() + battle.exam.minutes * 60000;
  var b = battle;
  renderExamTimer();
  examTimer = setInterval(function () {
    if (battle !== b || !$("#screen-battle").classList.contains("active")) { stopExamTimer(); return; }
    renderExamTimer();
    if (Date.now() >= b.deadline) examTimeUp();
  }, 250);
}
function renderExamTimer() {
  var left = Math.max(0, Math.ceil((battle.deadline - Date.now()) / 1000));
  var el = $("#battle-timer");
  el.textContent = "⏱ のこり " + Math.floor(left / 60) + ":" + ("0" + (left % 60)).slice(-2);
  el.classList.toggle("low", left <= 60);
  el.classList.remove("hidden");
}
/* 時間切れ：まだ答えていない問題は不正解として、結果を出す */
function examTimeUp() {
  stopExamTimer();
  battle.timedOut = true;
  stopQuickTimer();
  clearInterval(typer.timer);
  typer.cb = null;
  var unanswered = battle.qs.slice(battle.answered);
  battle.unanswered = unanswered.length;
  unanswered.forEach(function (q) {
    var qname = QUESTION_INDEX[q.id] ? QUESTION_INDEX[q.id].quest.name : "";
    var pq = battle.perQuest[qname] || (battle.perQuest[qname] = { right: 0, total: 0 });
    pq.total++;
  });
  Sound.wrong();
  endExam();
}

function setStageTheme(theme) {
  battle.theme = theme;
  StageBg.draw($("#stage-bg"), theme);
  Fx.ambient(theme);
}

function battleBgm() {
  if (battle.mode === "exam") return null;   // もぎけんていは本番と同じ気持ちで解くので、音楽は流さない
  if (battle.mode === "final" || battle.mode === "expert") return "boss";
  if (battle.mode === "endless") return "maze";
  return "battle";
}

function beginBattle() {
  /* 図・表・プログラムのある問題が出る戦闘だけ、PC で画面を広く使う（戦闘のあいだは はばを変えない） */
  document.body.classList.toggle("wide-battle", battle.qs.some(hasHeavyVisual));
  /* どのモードでも共通の、この戦闘のあいだだけ持つ値 */
  battle.useGauge = battle.mode !== "exam";   // もぎけんていは本番と同じ気持ちで解くので、ひっさつは無し
  /* ひっさつゲージ（0〜100）は前の戦闘から持ちこす（「あと少しでMAX」が、もう1回やる理由になる。
   * 1回の戦闘でためきれない人も、いつかは必殺技が出せる） */
  battle.gauge = battle.useGauge ? Math.min(100, save.gauge || 0) : 0;
  battle.fever = false;
  /* 1回の戦闘で決まった回数だけ効く特ちょうの、のこりの回数 */
  battle.guardsLeft = perkVal("heartGuard");
  battle.keepsLeft = perkVal("comboKeep");
  battle.regenLeft = perkVal("regen");
  /* クラウドエンジニア など：ひっさつゲージが たまった状態で はじまる */
  if (battle.useGauge && perkVal("startGauge")) battle.gauge = Math.min(100, battle.gauge + perkVal("startGauge"));
  drawMyAvatar($("#battle-avatar"), save.job, 3);
  battle.maxCombo = 0;
  battle.crits = 0;
  battle.quicks = 0;
  battle.specials = 0;
  battle.quickMs = 0;
  battle.rightBtn = null;
  battle.answered = 0;   // こたえた数（めいきゅうを途中でぬけたときの集計に使う）
  battle.mastered = 0;   // この戦闘でマスターした問題の数
  battle.deadline = 0;   // もぎけんていのタイマーの終わりの時刻（最初の問題で決める）
  battle.timedOut = false;
  stopExamTimer();
  var b = battle;

  resultToken++;
  closeLevelUp();
  flushPendingLevelUp();
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
    renderQuestionVisual({});
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
    $(".battle-meters").classList.toggle("hidden", battle.mode === "exam");

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
    return pick(courseQuests()).mob;
  }
  /* クエスト・復習・めいきゅうでは、ごく低確率で激レアモンスターが出現する */
  var luck = perkVal("shiny") || 1;   /* Webデザイナー：色ちがい・激レアに出会いやすい */
  if (Math.random() < RARE_MONSTER_CHANCE * luck) {
    battle.isRare = true;
    battle.rare = pickRareMonster();
    return battle.rare.mob;
  }
  var m = battle.mode === "review" ? pick(courseQuests()).mob
        : battle.mode === "endless" ? pick(battle.quests).mob
        : battle.quest.mob;
  /* さらに低確率で、色ちがい。たおすと図鑑に色ちがいが登録される */
  if (Math.random() < TUNE.shinyChance * luck) {
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
/* 戦闘画面のアバター（こうげきで はねる・まちがいで ゆれる） */
function avatarAnim(name) {
  var c = $("#battle-avatar");
  c.classList.remove("hop", "hurt");
  void c.offsetWidth;   /* 同じ動きを つづけて出すため、いったん もどす */
  c.classList.add(name);
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
  fill.style.transform = "scaleX(0)";
}
/* バーは幅ではなく拡大率（transform）で動かす：幅を動かすと、問題が出ている間ずっと
 * 画面の組み直しが毎フレーム走って、古いPCで重くなる */
function startQuickTimer(q) {
  var chars = q.q.length + q.c.join("").length;
  battle.quickChars = chars;
  battle.quickMs = Math.min(25000, 5000 + 110 * chars + (q.type === "hotspot" ? 3000 : 0));
  var bar = $("#quick-bar"), fill = $("#quick-fill");
  bar.classList.remove("expired", "off");
  fill.style.transition = "none";
  fill.style.transform = "scaleX(1)";
  void fill.offsetWidth;
  fill.style.transition = "transform " + battle.quickMs + "ms linear";
  fill.style.transform = "scaleX(0)";
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
  fill.style.transition = "none";   // バーをその場で止める
  fill.style.transform = "scaleX(" + Math.max(0, 1 - elapsed / (battle.quickMs || 1)) + ")";
  return elapsed;
}
/* クイックと数えるのは「読める時間はかけたが、持ち時間の内」の正解だけ。
 * 出た瞬間の当てずっぽうは数えない（下限：1.2秒＋文字数ぶん、長くても4秒） */
function isQuickAnswer(elapsed) {
  if (elapsed === null) return false;
  return elapsed <= battle.quickMs && elapsed >= Math.min(4000, 1200 + 25 * (battle.quickChars || 0));
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
  if (floor === ENDLESS_HEAL_UNTIL + 1 && !battle.warnedDeep) {
    battle.warnedDeep = true;
    toast("ここから さきは ♥の かいふくが ない… しんちょうに すすもう！");
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

/* 選択肢の記号（labels: "aiue" の問題。IPA の問題は「ア イ ウ エ …」で出す） */
var CHOICE_LABELS = { aiue: "アイウエオカキクケコ" };
function choiceLabel(q, ci) {
  var set = q.labels && CHOICE_LABELS[q.labels];
  return set ? set.charAt(ci) : "";
}
/* 解説などで選択肢を示すときの文字（記号つきの問題は「エ  0.94」の形） */
function choiceText(q, ci) {
  var label = choiceLabel(q, ci);
  if (labelOnlyChoice(q, ci)) return label;
  return label ? label + "  " + q.c[ci] : q.c[ci];
}
/* 図の中の「ア〜エ」から選ぶ問題は、c に記号だけを入れる（c[i] が記号と同じ）。そのときは記号を1つだけ出す */
function labelOnlyChoice(q, ci) {
  var label = choiceLabel(q, ci);
  return !!label && q.c[ci] === label;
}
/* 問題文のほかに、長文・プログラム・表・図をもつ問題か（クイック判定を出さない） */
function hasHeavyVisual(q) {
  return !!(q.passage || q.code || q.table || q.tables || q.figure || q.choiceTable);
}

function showQuestion() {
  var q = battle.qs[battle.idx];
  startExamTimer();
  typeMsg(q.q);
  /* 長い問題（instant: true）は、タイプライターの演出を飛ばして全文を出す */
  if (q.instant) finishType();
  renderQuestionVisual(q);
  renderSource(q);
  $("#battle-liked").classList.toggle("hidden", !likedNow(q));
  var box = $("#battle-choices");
  box.innerHTML = "";
  battle.rightBtn = null;
  /* 選択肢は4個とはかぎらない（科目B は ア〜コ まである）。
   * fixedOrder の問題（IPA の問題）は並べ替えない（並べ替えも「改変」になるため） */
  var idxs = q.c.map(function (_, i) { return i; });
  var order = q.fixedOrder ? idxs : shuffle(idxs);
  box.classList.toggle("fixed", !!q.fixedOrder);
  /* 選択肢が ぜんぶ記号だけ（ア、イ…）のときは、ボタンを横に並べる */
  box.classList.toggle("label-only", idxs.every(function (ci) { return labelOnlyChoice(q, ci); }));
  /* 短い選択肢は2列に並べる（css の .choices.fixed.short / .tiny） */
  /* 長さは見た目の幅で数える（半角は全角の半分ほど） */
  var maxLen = Math.max.apply(null, q.c.map(function (c) {
    if (c.indexOf("\n") >= 0) return 99;
    var w = 0;
    for (var k = 0; k < c.length; k++) w += c.charCodeAt(k) < 0x80 ? 0.55 : 1;
    return w;
  }));
  box.classList.toggle("short", maxLen <= 22);
  box.classList.toggle("tiny", maxLen <= 9);
  renderNotationButton(q);
  order.forEach(function (ci) {
    var btn = document.createElement("button");
    btn.className = "choice";
    var label = choiceLabel(q, ci);
    if (label) {
      var mark = document.createElement("span");
      /* 改行のある選択肢（真理値表・複数行の SQL など）は、記号を1行目に置いて、本文の行頭をそろえる */
      mark.className = "choice-label" + (q.c[ci].indexOf("\n") >= 0 ? " choice-label-block" : "");
      mark.textContent = label;
      btn.appendChild(mark);
    }
    if (!labelOnlyChoice(q, ci)) btn.appendChild(document.createTextNode(q.c[ci]));
    if (ci === q.a) battle.rightBtn = btn;
    btn.onclick = function () { answer(ci === q.a, btn); };
    box.appendChild(btn);
  });
  /* 出たばかりの選択肢は、ほんの一瞬だけ押せなくする（「すすむ」の連打が、次の問題の答えになるのを防ぐ） */
  box.classList.add("arming");
  setTimeout(function () { box.classList.remove("arming"); }, 300);
  /* もぎけんていでは、クイックのバーも出さない（時間を気にさせない）。
   * 長文・プログラム・表・図のある問題も、読む量で不公平になるので出さない */
  if (battle.mode === "exam" || hasHeavyVisual(q)) resetQuickBar(); else startQuickTimer(q);
}

/* 擬似言語の記述形式（科目B）。問題に notation（例 "fe_pseudo"）があるとき、
 * 戦闘画面に「きじゅつ けいしきを みる」ボタンを出し、押すと FE_NOTATIONS の内容をモーダルで出す */
function renderNotationButton(q) {
  var btn = $("#battle-notation");
  var has = !!(q && q.notation && window.FE_NOTATIONS && FE_NOTATIONS[q.notation]);
  btn.classList.toggle("hidden", !has);
  btn.dataset.notation = has ? q.notation : "";
}
function openNotation(key) {
  var n = window.FE_NOTATIONS && FE_NOTATIONS[key];
  if (!n) return;
  var body = $("#notation-body");
  body.innerHTML = "";
  $("#notation-title").textContent = n.title;
  n.sections.forEach(function (sec) {
    if (sec.heading) {
      var h = document.createElement("h3");
      h.className = "notation-heading";
      h.textContent = sec.heading;
      body.appendChild(h);
    }
    if (sec.text) {
      var p = document.createElement("div");
      p.className = "passage-text";
      p.textContent = sec.text;
      body.appendChild(p);
    }
    if (sec.rows) body.appendChild(passageTable(sec.rows, true, ""));
    if (sec.note) {
      var note = document.createElement("div");
      note.className = "passage-text notation-note";
      note.textContent = sec.note;
      body.appendChild(note);
    }
  });
  $("#notation-source").textContent = "出典:" + n.source;
  $("#notation-modal").classList.remove("hidden");
  body.scrollTop = 0;
  $("#notation-close").focus();
}
function closeNotation() {
  $("#notation-modal").classList.add("hidden");
}

/* 出典（IPA の問題は、問題を出している間も解説の間もずっと出す） */
function renderSource(q) {
  var el = $("#battle-source");
  el.textContent = q.source ? "出典:" + q.source : "";
  el.classList.toggle("hidden", !q.source);
}

/* 表を1つ組み立てる。header が true なら1行目を見出しにする（tableHeader: false の表は見出しの行が無い）。
 * caption があれば表の上に題名（「表」「追加後の表」など）を出す */
function passageTable(rows, header, caption) {
  var wrap = document.createElement("div");
  wrap.className = "passage-scroll";
  if (caption) {
    var cap = document.createElement("div");
    cap.className = "passage-caption";
    cap.textContent = caption;
    wrap.appendChild(cap);
  }
  var table = document.createElement("table");
  /* 改行や長い文のあるセルがある表は、セルの中で折り返す（短い表は折り返さず、横にスクロール） */
  var longCells = rows.some(function (row) { return row.some(function (cell) { return cell.indexOf("\n") >= 0 || cell.length > 24; }); });
  table.className = "passage-table" + (longCells ? " wrap" : "");
  rows.forEach(function (row, ri) {
    var tr = document.createElement("tr");
    row.forEach(function (cell) {
      var td = document.createElement(ri === 0 && header ? "th" : "td");
      td.textContent = cell;
      tr.appendChild(td);
    });
    table.appendChild(tr);
  });
  wrap.appendChild(table);
  return wrap;
}

/* 長文・プログラム（等幅）・表・図を、モンスターの下のスクロール領域に出す。
 * 問題の文字は すべて textContent で入れる（HTML として解釈しない） */
function renderPassage(q) {
  var box = $("#battle-passage");
  box.innerHTML = "";
  if (!hasHeavyVisual(q)) {
    $("#battle-ctable").innerHTML = "";
    $("#battle-ctable").classList.add("hidden");
    box.classList.add("hidden");
    $("#battle-stage").classList.remove("passage-mode");
    layoutAfterPassage(false);
    return;
  }
  if (q.passage) {
    var p = document.createElement("div");
    p.className = "passage-text";
    p.textContent = q.passage;
    box.appendChild(p);
  }
  if (q.figure) {
    var fig = document.createElement("img");
    fig.className = "passage-figure";
    fig.src = q.figure;
    fig.alt = q.figureAlt || "図";
    fig.title = "クリック（タップ）で かくだい";
    fig.onclick = function () { openFigure(fig.src, fig.alt); };
    box.appendChild(fig);
  }
  /* 表は table（1つ）か tables（題名つきで複数。[{ caption, rows, header }]）。どちらも図のあと・プログラムの前に出す */
  if (q.table && q.table.length) box.appendChild(passageTable(q.table, q.tableHeader !== false, ""));
  (q.tables || []).forEach(function (t) {
    box.appendChild(passageTable(t.rows, t.header !== false, t.caption || ""));
  });
  if (q.code) {
    var pre = document.createElement("pre");
    pre.className = "passage-code";
    pre.textContent = q.code;
    box.appendChild(pre);
  }
  /* 解答群が表になっている問題（科目B の「a と b の組合せ」など）。プログラムのあとに出し、
   * 選択肢のボタンには記号（ア、イ…）だけを出す（c に記号だけを入れる） */
  /* 解答群の表は、選択肢のすぐ上（#battle-ctable）に出す */
  var ctBox = $("#battle-ctable");
  ctBox.innerHTML = "";
  ctBox.classList.add("hidden");
  if (q.choiceTable) {
    var ct = passageTable(q.choiceTable.rows, true, q.choiceTable.caption || "");
    ct.classList.add("passage-choice-table");
    ctBox.appendChild(ct);
    ctBox.classList.remove("hidden");
  }
  box.scrollTop = 0;
  /* 解答群の表だけで、左の列に出すものが無いとき */
  var empty = !box.childNodes.length;
  box.classList.toggle("hidden", empty);
  $("#battle-stage").classList.add("passage-mode");
  layoutAfterPassage(!empty);
}

/* 図を大きく見る（図をクリック／タップ）。Esc・外側・とじるで閉じる */
function openFigure(src, alt) {
  var img = $("#figure-img");
  img.src = src;
  img.alt = alt || "図";
  $("#figure-modal").classList.remove("hidden");
  $("#figure-close").focus();
}
function closeFigure() {
  $("#figure-modal").classList.add("hidden");
}

/* ---------- 戦闘画面の並び（index.html・css の「戦闘画面の並び」） ----------
 * 1段目「モンスター｜問題文」の高さを はかって、PC の2段目（図など｜選択肢）を画面の高さに収める。
 * 問題文は1文字ずつ出るので、1段目の高さが変わるたびに はかりなおす */
function initBattleLayout() {
  window.addEventListener("resize", measureBattleTop);
  if (window.ResizeObserver) new ResizeObserver(measureBattleTop).observe($("#battle-head"));
}
function measureBattleTop() {
  var top = $("#battle-top");
  if (!top || !top.offsetHeight) return;
  var head = $("#battle-head");
  var h = top.offsetHeight + (head ? head.offsetHeight + 12 : 0);
  document.documentElement.style.setProperty("--battle-top-h", h + "px");
}
/* 図などがある問題か どうかで、2段目を2列にするか 1列にするかを切りかえる */
function layoutAfterPassage(hasPassage) {
  $("#battle-body").classList.toggle("no-side", !hasPassage);
  $("#battle-side").scrollTop = 0;
  $("#battle-main").scrollTop = 0;
  window.scrollTo(0, 0);
  setTimeout(measureBattleTop, 0);
}

/* 画面ホットスポット問題（type:"hotspot"）のときはモンスターを隠してリボンUIモックアップ
 * ＋番号バッジを表示する。通常の問題ではモンスター表示に戻す。 */
function renderQuestionVisual(q) {
  renderPassage(q);
  if (!q.id) { renderSource(q); renderNotationButton(null); }   /* 次の問題へ行くとき（renderQuestionVisual({})）は出典・記述形式のボタンも片づける */
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
  if (battle.timedOut) return;
  finishType();
  var elapsed = stopQuickTimer();
  var q = battle.qs[battle.idx];
  var b = battle, turn = battle.idx;
  document.querySelectorAll(".choice").forEach(function (x) { x.disabled = true; });
  btn.classList.add(isCorrect ? "picked-right" : "picked-wrong");
  /* まちがえたときは、正解のボタンもしめす（文字だけでなく、位置でも覚えられるように） */
  if (!isCorrect && battle.rightBtn) battle.rightBtn.classList.add("was-right");

  var rec0 = save.records[q.id];
  var boxBefore = rec0 ? rec0.box : -1;
  /* むげんの めいきゅうは何周でも続けられるので、復習の期限がまだ来ていない問題に正解しても
   * 記憶の箱は上げない（正解の回数だけ数える）。続けて解くだけで「おぼえた」ことになり、
   * 復習の予定が先へ行ってしまうのを防ぐため。まちがえたときは、ほかのモードと同じく箱0にもどす。 */
  if (battle.mode === "endless" && isCorrect && rec0 && rec0.due > Date.now()) {
    rec0.right++;
    rec0.last = Date.now();
  } else {
    SRS.record(save.records, q.id, isCorrect);
  }
  /* この正解で、記憶の箱がいちばん上（マスター）に届いたか */
  var mastered = isCorrect && save.records[q.id].box >= SRS.MAX_BOX && boxBefore < SRS.MAX_BOX;
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
    var quick = isQuickAnswer(elapsed);
    var special = battle.useGauge && battle.gauge >= 100;
    var crit = !special && Math.random() <
      TUNE.critBase + TUNE.critPerCombo * Math.min(battle.combo, TUNE.critComboCap) + (quick ? TUNE.critQuick : 0) +
      perkVal("crit");
    var tier = attackTier(battle.combo);

    var gained = battle.mode === "review" ? 6 : (battle.mode === "exam" || battle.mode === "endless") ? 8 : 10;
    if (isBoss) gained = 15;
    var comboBonus = Math.min((battle.combo - 1) * 2, 10);
    gained += comboBonus;
    if (battle.isRare) gained += 20;   /* 激レアモンスターのラッキーボーナス */
    if (battle.isShiny) gained += TUNE.shinyXp;
    if (crit) gained = Math.round(gained * TUNE.critMul);
    if (quick) gained += TUNE.quickXp;
    if (special) gained = Math.round(gained * (TUNE.specialMul + perkVal("specialMul")));
    if (isBoss) gained += perkVal("bossXp");
    if (battle.mode === "review" && perkVal("reviewXp")) gained = Math.round(gained * perkVal("reviewXp"));
    var liked = likedNow(q);   /* とくい分野の問題：EXP 1.2倍・ゲージ多め */
    if (liked) gained = Math.round(gained * LIKE_XP);
    battle.xp += gained; addJobXp(gained);
    save.xp += gained;

    if (special) {
      battle.gauge = 0;
      save.gauge = 0;
      battle.specials++;
      save.stats.specials++;
      missionHits.push(Missions.record(save, "special", 1));
    } else if (battle.useGauge) {
      battle.gauge = Math.min(100, battle.gauge + TUNE.gaugeCorrect +
        (quick ? TUNE.gaugeQuick : 0) + (crit ? TUNE.gaugeCrit : 0) +
        (battle.combo >= 5 ? perkVal("gaugeCombo") : 0) + (liked ? LIKE_GAUGE : 0));
      save.gauge = battle.gauge;
      if (battle.gauge >= 100) setTimeout(function () { if (battleLive(b, turn)) Sound.gaugeMax(); }, 600);
    }
    if (crit) { battle.crits++; save.stats.crits++; missionHits.push(Missions.record(save, "crit", 1)); }
    /* ITサポート：3問つづけて正解すると ♥が1つ回復（1回の戦闘で決まった回数まで） */
    if (battle.regenLeft > 0 && battle.combo >= 3 && battle.hearts < battle.maxHearts && !battle.noFail) {
      battle.regenLeft--;
      battle.hearts++;
      setTimeout(function () { if (battleLive(b, turn)) { Sound.heal(); Fx.floatText("ふっきゅうの て！ ♥ かいふく", "#7ab0f0", ""); } }, 700);
    }
    if (quick) { battle.quicks++; save.stats.quicks++; missionHits.push(Missions.record(save, "quick", 1)); }

    var died = true;
    if (isBoss) {
      battle.bossHp--;
      battle.bossCorrect++;
      died = battle.bossHp <= 0;
    }

    /* かいふく：ひっさつわざ（めいきゅう以外）／めいきゅうのボスをたおしたとき（浅いかいだけ）。
     * めいきゅうで回復が多いと、正解率の高い人は終わらなくなり、記録が「実力」ではなく
     * 「使えた時間」で決まってしまう。そこで回復はボスだけ・ちか ENDLESS_HEAL_UNTIL かいまでにしている。 */
    var endlessBossKill = battle.mode === "endless" && isBoss && died;
    var healed = false;
    if (!battle.noFail && battle.hearts < battle.maxHearts &&
        ((special && battle.mode !== "endless") || (endlessBossKill && battle.correct <= ENDLESS_HEAL_UNTIL))) {
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
      if (medal) banners.push([medal.icon, medal.name + " かくとく！", mobName + "を " + kills + "体 たおした！", ""]);
      if (battle.isShiny && !save.shinyMonsters[mobName]) {
        save.shinyMonsters[mobName] = battle.mob.palette;
        shinyNew = true;
      }
    }
    if (battle.mode === "endless") {
      missionHits.push(Missions.record(save, "endlessFloor", 1));
      if (endlessBossKill) missionHits.push(Missions.record(save, "bossWin", 1));
      /* 記録は進むたびに保存する（授業の終わりにタブを閉じても、そこまでの記録が残るように） */
      var reached = battle.correct + 1;   // いま立っている かい
      save.endless.totalFloors++;
      if (reached > save.endless.best) save.endless.best = reached;
      if (battle.startBest > 0 && reached > battle.startBest && !battle.brokeRecord) {
        battle.brokeRecord = true;   /* これまでの最高記録をこえた瞬間を祝う（1回の挑戦で1度だけ） */
        setTimeout(function () {
          if (!battleLive(b, turn)) return;
          Juice.announce("きろく こうしん！", "record", 1500);
          Sound.newRecord();
          Juice.confetti(40);
        }, 600);
      }
      ENDLESS_TITLES.forEach(function (t) {
        if (save.endless.best >= t[0] && save.titles.indexOf(t[1]) < 0) {
          save.titles.push(t[1]);
          banners.push(["👑", "あたらしい しょうごう！", "「" + t[1] + "」", ""]);
        }
      });
    }

    /* こうげきの演出 */
    var move = null;
    var onHit = function () {
      if (!battleLive(b, turn)) return;
      updateHud();   // ボスのHP・ハートは、こうげきが当たった瞬間に動かす
      if (!special) Sound.correct();
      avatarAnim("hop");
      if (died) {
        Fx.defeat(battle.mob.palette, isBoss);
        setEnemyAnim("gone");
        if (isBoss) Sound.boom();
      } else {
        setEnemyAnim("hit");
      }
      Fx.floatText((liked ? "とくい！ " : "") + "＋" + gained + " EXP", liked ? "#7ab0f0" : null, (crit || special) ? "crit" : "");
      Juice.orbs(Juice.enemyPoint(), $("#battle-xpfill").parentNode, { n: 6, onDone: renderBattleXp });
      setTimeout(renderBattleXp, 1000);   // 玉が届かなかったときの保険
      if (healed) { Sound.heal(); flashHearts("heal"); }
      if (mastered) {
        setTimeout(function () { if (battleLive(b, turn)) { Sound.star(2); Juice.sparkle($("#battle-msg"), { n: 12 }); } }, 350);
      }
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
      Fx.floatText("⚡ クイック！" + (TUNE.quickXp ? " ＋" + TUNE.quickXp : ""), null, "quick");
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
    if (mastered) { battle.mastered++; msg += "\n★ この もんだいを マスターした！"; }
    if (shinyNew) msg += "\n✨ 色ちがいを 図鑑に とうろくした！";
    if (healed) msg += "\n♥ が 1つ かいふくした！";
    /* はじめての ヒント（1回の答えにつき1つまで。だいじな順） */
    msg += firstHint(!special && battle.useGauge && battle.gauge >= 100 ? "gauge"
          : special ? "special"
          : battle.combo === 2 ? "combo"
          : crit ? "crit"
          : quick ? "quick" : null);
  } else {
    var hadCombo = battle.combo;
    battle.combo = 0;
    /* ♥が へらない（セキュリティ など）・コンボが半分 のこる（ネットワーク など）は、1回の戦闘で決まった回数まで */
    var guarded = !battle.noFail && battle.guardsLeft > 0;
    var kept = battle.keepsLeft > 0 && hadCombo >= 2;
    if (guarded) battle.guardsLeft--;
    if (kept) { battle.keepsLeft--; battle.combo = Math.floor(hadCombo / 2); }
    /* テストエンジニア：まちがえても ひっさつゲージが すこし たまる */
    if (battle.useGauge && perkVal("gaugeOnMiss") && battle.gauge < 100) {
      battle.gauge = Math.min(100, battle.gauge + perkVal("gaugeOnMiss"));
      save.gauge = battle.gauge;
    }
    if (!battle.noFail && !guarded) battle.hearts--;
    Sound.wrong();
    if (hadCombo >= 3 && !kept) setTimeout(function () { Sound.comboBreak(); }, 200);
    setEnemyAnim("lunge");
    avatarAnim("hurt");
    Fx.claw();
    Fx.floatText(guarded ? jobDef(save.job).perkName + "！ ♥は へらない" : kept ? jobDef(save.job).perkName + "！ コンボ " + battle.combo + " のこった" :
      battle.noFail ? "ミス…" : "－♥ ダメージ！", guarded || kept ? "#7ab0f0" : "#ff5d7a", "bad");
    if (!battle.noFail && !guarded) flashHearts("hurt");
    setFever(false);
    renderCombo();
    msg = "ミス！ こうげきを うけた…\nせいかいは 「" + choiceText(q, q.a) + "」\n【かいせつ】" + q.exp;
  }

  /* デイリーミッションの進捗を更新し、達成したぶんだけボーナスEXPを加える */
  if (isCorrect) {
    missionHits.push(Missions.record(save, "correct", 1));
    missionHits.push(Missions.record(save, "comboReach", battle.combo));
    if (battle.mode === "review") missionHits.push(Missions.record(save, "reviewCorrect", 1));
  }
  missionHits.filter(Boolean).forEach(function (m) {
    save.xp += missionBonusXp();
    battle.xp += missionBonusXp(); addJobXp(missionBonusXp());
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

  /* 実績は、達成したその場で知らせる（コンボ10などは、決めた瞬間がいちばん うれしい） */
  var newAch = Achievements.check(save);
  if (newAch.length) showAchievementToasts(newAch);

  persist();
  if (!isCorrect) updateHud();
  /* めいきゅうは長くつづくので、ボスをたおすたびに先生の記録も更新する（送る内容は同じ） */
  if (isCorrect && battle.mode === "endless" && battle.bossPhase && battle.bossHp <= 0) syncNow();
  renderGauge();
  var readyAt = performance.now() + hitDelay + 250 + (isCorrect ? 0 : 1200);   // まちがいのときは、解説を読む間をとる
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
  return ["📋", "ミッション たっせい！ ＋" + missionBonusXp() + "EXP", m.label, "mission"];
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
var ENDLESS_HEAL_UNTIL = 30;   // このかいより下では、ボスをたおしても回復しない（記録が実力で決まるように）
var ENDLESS_TITLES = [
  [10, "めいきゅうの ちょうせんしゃ"],
  [20, "ちていの たんけんか"],
  [30, "しんえんの けんじゃ"],
  [50, "むげんを こえし者"]
];

function endlessQuests() {
  /* 選択中の対策項目のクエストだけ。エキスパートのクエストは MOS のときだけ入れる */
  var expert = currentCourse() === "mos" && typeof EXPERT_QUEST_DATA_EXCEL !== "undefined" ? EXPERT_QUEST_DATA_EXCEL.quests : [];
  var all = scopeQuests().concat(expert);
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
    startBest: save.endless.best,   // この挑戦を始める前の最高記録（新記録かどうかの判定に使う）
    bossFrom: 99999, bossHp: 0, bossMax: 0,
    idx: 0, hearts: 3, maxHearts: 3,
    correct: 0, combo: 0, xp: 0,
    bossPhase: false, bossCorrect: 0
  };
  save.endless.runs++;
  if (!save.hints.endless) {
    save.hints.endless = 1;
    Juice.banner("🌀", "むげんの めいきゅう", "3回 ミスすると おわり。ちか5かいごとの ボスを たおすと ♥が 1つ かいふく！", "");
  }
  beginBattle();
}

function endEndless() {
  /* とうたつした かい＝いま立っている かい（画面の「ちか N かい」と同じ数え方）。
   * 最高記録・しょうごう・実績は answer() で進むたびに保存ずみ。ここでは終わりのボーナスだけ足す。 */
  var reached = battle.correct + 1;
  var bonus = Math.min(battle.correct * 2, 60);
  save.xp += bonus;
  battle.xp += bonus; addJobXp(bonus);

  var prevBest = battle.startBest;
  var isRecord = battle.correct > 0 && reached > prevBest;

  var newAchievements = Achievements.check(save);
  persist();
  syncNow();

  presentResult({
    cleared: true,
    title: isRecord ? "しんきろく！！" : "たんけん しゅうりょう",
    sub: isRecord
      ? (prevBest > 0 ? "これまでの きろく（ちか " + prevBest + " かい）を ぬりかえた！" : "はじめての きろくだ！\nつぎは これを こえよう！")
      : (prevBest > 0 ? "さいこう きろくは ちか " + prevBest + " かい。\nつぎは きろくこうしんを ねらおう！"
                      : "3回 ミスすると おわり。\nまた ちょうせんしよう！"),
    stars: null,
    big: { label: "とうたつ", value: reached, prefix: "ちか ", suffix: " かい" },
    rows: battleRows(battle.answered),
    xp: battle.xp,
    jingle: isRecord ? "newRecord" : "clear",
    confetti: isRecord ? 120 : 30,
    announce: isRecord ? ["NEW RECORD!!", "record"] : null,
    achievements: newAchievements
  });
}

/* =========================================================
 * 結果（リザルト）
 * ======================================================= */
var resultToken = 0;   // リザルトの時間差の演出を、画面をはなれたら止めるための番号
var pendingLevelUp = null;   // まだ見せていないレベルアップ（{prev, next}）。早く画面をはなれたら帯で知らせる

/* リザルトを最後まで見ずに はなれたとき、見せそこねたレベルアップを帯で知らせる */
function flushPendingLevelUp() {
  if (!pendingLevelUp) return;
  var p = pendingLevelUp;
  pendingLevelUp = null;
  Sound.levelup();
  Juice.banner("⬆️", "レベルアップ！ Lv" + p.prev + " → Lv" + p.next,
    levelUpText(p.prev, p.next).slice(1).join("　") || "つぎの ぼうけんへ！", "levelup", "levelup");
}
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
  if (battle.mastered) rows.push(["マスターした もんだい", battle.mastered + " もん"]);
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
      if (!low) Sound.star(n);   // ひかえめでは全部いちどに出るので、音は重ねない
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

  pendingLevelUp = newLevel > prevLevel ? { prev: prevLevel, next: newLevel } : null;
  function afterXp() {
    if (newLevel <= prevLevel) return;
    pendingLevelUp = null;
    lvEl.textContent = levelUpText(prevLevel, newLevel).join("\n");
    lvEl.classList.remove("hidden");
    if (low) setTimeout(function () { if (token === resultToken) Sound.levelup(); }, 1400);   // クリアの音が終わってから
    else later(250, function () { showLevelUp(prevLevel, newLevel); });
  }
  later(700, function () {
    if (!low) Juice.countUp(xpVal, 0, o.xp, 700, function (v) { return "＋" + v; }, tickSound);
  });
  later(1000, function () {
    if (low) afterXp();
    else animateResultXp(prevXp, save.xp, 1000, token, afterXp);
  });

  /* お知らせの帯は待たせずに出す（すぐ画面をはなれても、帯は次の画面に残る） */
  (o.banners || []).forEach(function (x) { Juice.banner(x[0], x[1], x[2], x[3]); });
  if (o.achievements && o.achievements.length) showAchievementToasts(o.achievements);
}

/* ---------- 結果（もぎけんてい） ---------- */
function endExam() {
  stopExamTimer();
  var score = Math.round(battle.correct / battle.qs.length * 1000);
  var passLine = battle.exam ? battle.exam.pass : 700;
  var pass = score >= passLine;
  var bonus = pass ? 50 : 10;
  save.xp += bonus;
  battle.xp += bonus; addJobXp(bonus);

  save.exams = save.exams || {};
  var ex = save.exams[battle.subjectKey] || { best: 0, tries: 0 };
  ex.tries++;
  if (score > ex.best) ex.best = score;
  save.exams[battle.subjectKey] = ex;

  var newAchievements = Achievements.check(save);
  persist();
  syncNow();

  var lines = ["ごうかくライン " + passLine + "てん"];
  if (battle.timedOut) lines.push("じかん ぎれ！ こたえて いない " + battle.unanswered + " もんは ふせいかい");
  if (battle.exam && battle.exam.note) lines.push("（" + battle.exam.note + "）");
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
    if (battle.mode === "review" && perkVal("reviewXp")) bonus = Math.round(bonus * perkVal("reviewXp"));
    if (stars === 3) bonus += 20;

    if (battle.mode === "quest") {
      var rec = save.quests[battle.quest.id] || { stars: 0, clears: 0, bossWins: 0 };
      rec.clears++;
      if (stars > rec.stars) rec.stars = stars;
      if (battle.bossCorrect >= 3) { rec.bossWins++; save.stats.bossWins++; }
      save.quests[battle.quest.id] = rec;

      missionHits.push(Missions.record(save, "questClear", 1));
      if (battle.bossCorrect >= 3) missionHits.push(Missions.record(save, "bossWin", 1));

      chestReward = Treasure.grant(save, battle.quest, { stars: stars, luck: perkVal("chestLuck") });
      if (chestReward.type === "xp") { save.xp += chestReward.xp; battle.xp += chestReward.xp; addJobXp(chestReward.xp); }
    }
    if (battle.mode === "final") {
      /* MOS は今までどおり finalClear（エキスパートの解放条件）。ほかの項目は finalClears に分ける */
      if (battle.course === "mos") save.finalClear = true;
      else save.finalClears[battle.course] = Date.now();
      save.stats.bossWins++;
      bonus = 100;
    }
    if (battle.mode === "expert") {
      save.expertClear = true;
      save.stats.bossWins++;
      bonus = 150;
    }
    save.xp += bonus;
    battle.xp += bonus; addJobXp(bonus);

    missionHits.filter(Boolean).forEach(function (m) {
      save.xp += MISSION_BONUS_XP;
      battle.xp += MISSION_BONUS_XP; addJobXp(MISSION_BONUS_XP);
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
      sub = courseDef(battle.course).finalText;
    } else if (battle.mode === "expert") {
      title = "しんおうデリートを たおした！！";
      sub = "エキスパートの おくぎを てにいれた！\nきみは まことの MOSエキスパートだ！";
    } else if (battle.practice) {
      title = battle.practice.name + "の しれん クリア！";
      sub = "この分野の ちしきが ふかまった！";
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
    hideRetry: battle.mode === "review" && cleared && !battle.practice,
    chest: chestReward,
    jingle: cleared ? (grand ? "fanfare" : "clear") : "fail",
    confetti: cleared ? (grand ? 140 : 40) : 0,
    banners: missionHits.filter(Boolean).map(missionBanner),
    achievements: newAchievements
  });
}

function retryBattle() {
  Sound.select();
  if (battle.practice && battle.practice.kind === "job") startJobPractice(battle.practice.key);
  else if (battle.practice) startPractice(monsterPracticePool(battle.practice.key), battle.practice);
  else if (battle.mode === "quest") startQuest(battle.quest);
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
  var img = $("#" + prefix + "-avatar-img");
  if (img) drawMyAvatar(img, save.job, 3);
  var job = $("#" + prefix + "-job");
  if (job) job.textContent = "🧑‍💻 " + jobDef(save.job).name + " Lv " + jobLevel(save.job) + (jobMastered(save.job) ? " ★" : "") +
    (save.subJob && save.subJob !== save.job && jobMastered(save.subJob) ? "（サブ：" + jobDef(save.subJob).perkName + "）" : "");
}

function openMenu() {
  resultToken++;        // リザルトの時間差の演出を止める
  stopExamTimer();
  closeLevelUp();
  stopQuickTimer();
  Sound.setTempo(1);
  Juice.clear();
  flushPendingLevelUp();
  activeScopeKey = null;   /* メニューでは はんいを えらんでいない（A＋B として数える） */
  renderPlayerHeader("menu");
  var due = specialistDueList().length;
  var badge = $("#menu-review-badge");
  if (due > 0) { badge.textContent = due; badge.classList.remove("hidden"); }
  else badge.classList.add("hidden");

  renderCourseMenu();

  /* まおうの城は、選択中の対策項目のクエストを ぜんぶ クリアすると解放 */
  var allCleared = finalUnlockedAny();
  var finalBtn = $("#menu-final");
  finalBtn.classList.toggle("locked", !allCleared);
  $("#menu-final-lock").textContent = allCleared
    ? (isFinalCleared() ? "とうばつずみ！ なんども ちょうせんできる" : "ふういんが とかれた…！")
    : (scopeChoices().length ? "どちらかの科目の クエストを ぜんぶ クリアすると かいほう" : "ぜんぶの クエストを クリアすると かいほう");

  var expertBtn = $("#menu-expert");
  expertBtn.classList.toggle("locked", !save.finalClear);
  $("#menu-expert-lock").textContent = save.finalClear
    ? (save.expertClear ? "とうばつずみ！ なんども ちょうせんできる" : "かくされた みちが あらわれた…！")
    : "まおうの城を クリアすると かいほう";

  var endlessOpen = scopeClearedCount() >= ENDLESS_UNLOCK;
  $("#menu-endless").classList.toggle("locked", !endlessOpen);
  $("#menu-endless").classList.toggle("is-new", endlessOpen && save.endless.runs === 0);
  $("#menu-endless-lock").textContent = endlessOpen
    ? (save.endless.best > 0 ? "さいこう きろく：ちか " + save.endless.best + " かい" : "♥は 3つ。どこまで もぐれるか！")
    : "クエストを " + ENDLESS_UNLOCK + "つ クリアすると かいほう";

  /* Streak.checkLogin/Achievements.check は同じ日のうちは isNewDay:false／解除済みで
   * 実質なにもしないので、メニューを開くたびに呼んでも安全（新規登録直後もここで初期化される）。 */
  var streakResult = Streak.checkLogin(save);
  Missions.ensureToday(save);
  var newAchievements = Achievements.check(save);
  persist();

  renderStreakChip();
  renderMissions();
  renderNextGoal();

  renderMessenger();
  show("screen-menu");
  syncNow();

  if (streakResult.isNewDay) showStreakBanner(streakResult);
  /* 音楽は、ボタンを押した人にだけ流れる。あることを1回だけ知らせる */
  if (!save.hints.bgm && Sound.mode() === "se") {
    save.hints.bgm = 1;
    persist();
    Juice.banner("🎵", "おんがくも ならせるよ", "みぎしたの「♪ おとだけ」を おすと ながれる", "");
  }
  if (newAchievements.length) showAchievementToasts(newAchievements);
}

/* 選択中の対策項目の まおうの城が解放されているか（その項目の、はんいの中のクエストを ぜんぶ クリア） */
function finalUnlocked() {
  var qs = scopeQuests();
  return qs.length > 0 && scopeClearedCount() >= qs.length;
}
/* メニューの まおうの城は、どれか1つの はんいで解放されていれば入れる（入るときに はんいを えらぶ） */
function finalUnlockedAny() {
  var list = scopeChoices();
  if (!list.length) return finalUnlocked();
  return list.some(function (sc) { return withScope(sc.key, finalUnlocked); });
}

/* 入るときに はんいを えらぶ（ふっかつのほこら・まおうの城・むげんの めいきゅう） */
var SCOPE_ENTRIES = {
  review: {
    title: "⛩️ ふっかつの ほこら",
    roles: ["database", "auditor"],
    open: function () { return true; },
    status: function () {
      var n = specialistDueList().length;
      if (n > 0) return "復習まち " + n + "もん";
      return specialistWeakList().length ? "にがて とっくん" : "復習する もんだいは まだ ない";
    },
    start: function () { startReview(); }
  },
  final: {
    title: "🌋 まおうの しろ",
    roles: ["architect", "whitehacker", "strategist", "ai", "cto"],
    open: function () { return finalUnlocked(); },
    status: function () { return finalUnlocked() ? "ちょうせんできる" : "この はんいの クエストを ぜんぶ クリアすると かいほう"; },
    start: function () { startFinal(); }
  },
  endless: {
    title: "🌀 むげんの めいきゅう",
    roles: ["support", "security", "blueteam", "ciso"],
    open: function () { return scopeClearedCount() >= ENDLESS_UNLOCK; },
    status: function () {
      var n = scopeClearedCount();
      return n >= ENDLESS_UNLOCK ? "クリアした クエスト " + n + "こ から 出る" : "この はんいで クエストを " + ENDLESS_UNLOCK + "つ クリアすると かいほう";
    },
    start: function () { startEndless(); }
  }
};
function enterWithScope(kind) {
  var entry = SCOPE_ENTRIES[kind];
  var list = scopeChoices();
  if (!list.length) { entry.start(); return; }
  var last = save.scopes && save.scopes[currentCourse()];
  var box = $("#scope-list");
  box.innerHTML = "";
  $("#scope-title").textContent = entry.title;
  var roles = (entry.roles || []).map(jobDef).filter(jobUnlocked);
  var good = roles.some(function (j) { return j.key === save.job; });
  $("#scope-reco").textContent = !roles.length ? "" : good ? "🎯 いまの しょくぎょう（" + jobDef(save.job).name + "）は ここに むいている！"
    : "🎯 むいている しょくぎょう：" + roles.map(function (j) { return j.name; }).join("・");
  list.forEach(function (sc) {
    var open = withScope(sc.key, entry.open);
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn scope-btn" + (sc.key === last ? " is-last" : "");
    btn.disabled = !open;
    btn.dataset.scope = sc.key;
    var nm = document.createElement("span");
    nm.className = "scope-name";
    nm.textContent = sc.label + (sc.key === last ? "（まえ回）" : "");
    var st = document.createElement("span");
    st.className = "scope-status";
    st.textContent = (open ? "" : "🔒 ") + withScope(sc.key, entry.status);
    btn.appendChild(nm); btn.appendChild(st);
    btn.onclick = function () {
      Sound.select();
      save.scopes[currentCourse()] = sc.key;
      persist();
      closeScopeSelect();
      activeScopeKey = sc.key;
      var before = battle;
      entry.start();
      /* 入れなかったとき（復習する問題が無い など）は、メニューのまま なので はんいを もどす。
       * 画面の切りかえは えんしゅつの あとなので、画面ではなく「新しい戦闘が始まったか」で見る */
      if (battle === before) activeScopeKey = null;
    };
    box.appendChild(btn);
  });
  $("#scope-modal").classList.remove("hidden");
  var focus = box.querySelector(".is-last:not(:disabled)") || box.querySelector(".scope-btn:not(:disabled)") || $("#scope-close");
  focus.focus();
}
function closeScopeSelect() {
  $("#scope-modal").classList.add("hidden");
}

/* メニューのボタンを、選択中の対策項目の定義（js/courses.js の menu）の順に並べ、ほかは隠す。
 * 科目ボタン（"subject:<科目キー>"）だけは JS で作る（id は menu-<科目キー>）。 */
var MENU_BUTTON_IDS = ["review", "final", "expert", "endless", "exam", "practical", "avatar", "ranking", "status"];
function subjectMenuButton(subjectKey) {
  var btn = $("#menu-" + subjectKey);
  if (btn) return btn;
  var look = SUBJECT_BUTTONS[subjectKey] || { icon: "📘", label: subjectKey };
  btn = document.createElement("button");
  btn.className = "btn menu-btn menu-subject";
  btn.id = "menu-" + subjectKey;
  var icon = document.createElement("span");
  icon.className = "menu-icon";
  icon.textContent = look.icon;
  btn.appendChild(icon);
  btn.appendChild(document.createTextNode(look.label));
  btn.onclick = function () { Sound.select(); openQuestList(subjectKey); };
  return btn;
}
function renderCourseMenu() {
  var def = currentCourseDef();
  var grid = $("#menu-grid");
  var shown = {};
  def.menu.forEach(function (item) {
    var btn = item.indexOf("subject:") === 0 ? subjectMenuButton(item.slice(8)) : $("#menu-" + item);
    if (!btn) return;
    btn.classList.remove("hidden");
    grid.appendChild(btn);   /* 定義の順に並べなおす */
    shown[btn.id] = true;
  });
  Array.prototype.slice.call(grid.querySelectorAll(".menu-btn")).forEach(function (btn) {
    if (!shown[btn.id]) btn.classList.add("hidden");
  });
  $("#menu-course-icon").textContent = def.icon;
  $("#menu-course-name").textContent = def.label + "（" + def.sub + "）";
  $("#menu-course-change").classList.toggle("hidden", availableCourses().length < 2);
}

/* =========================================================
 * アバター・しょくぎょう（js/avatar.js）
 * かえたら すぐ保存する。はじめて作るとき（first）は「◀ マップ」を出さず、けっていで対策項目を えらぶ画面へ。
 * ======================================================= */
var avatarFirst = false;
function openAvatar(first) {
  avatarFirst = !!first;
  if (!save.avatar) { save.avatar = randomAvatar(); persist(); }
  $("#avatar-back").classList.toggle("hidden", avatarFirst);
  $("#avatar-lead").textContent = avatarFirst
    ? "ぼうけんに でる まえに、じぶんの アバターと しょくぎょうを きめよう！（あとから いつでも かえられるよ）"
    : "アバターの みためと、しょくぎょうを かえられるよ。";
  $("#avatar-done").textContent = avatarFirst ? "これで ぼうけんに でる！" : "これで けってい！";
  renderAvatarScreen();
  show("screen-avatar");
}
function renderAvatarScreen() {
  drawMyAvatar($("#avatar-preview"), save.job, 8);
  var box = $("#avatar-parts");
  box.innerHTML = "";
  AVATAR_PART_ORDER.forEach(function (p) {
    var kind = p[0], list = AVATAR_PARTS[kind];
    var row = document.createElement("div");
    row.className = "avatar-part";
    var lab = document.createElement("span");
    lab.className = "avatar-part-label";
    lab.textContent = p[1];
    var prev = document.createElement("button");
    prev.type = "button"; prev.className = "btn btn-small avatar-arrow"; prev.textContent = "◀";
    prev.setAttribute("aria-label", p[1] + "を まえに");
    var val = document.createElement("span");
    val.className = "avatar-part-value";
    val.textContent = avatarPart(kind, save.avatar[kind]).label;
    var next = document.createElement("button");
    next.type = "button"; next.className = "btn btn-small avatar-arrow"; next.textContent = "▶";
    next.setAttribute("aria-label", p[1] + "を つぎに");
    function step(d) {
      var i = 0;
      list.forEach(function (x, k) { if (x.key === save.avatar[kind]) i = k; });
      save.avatar[kind] = list[(i + d + list.length) % list.length].key;
      persist();
      Sound.select();
      renderAvatarScreen();
    }
    prev.onclick = function () { step(-1); };
    next.onclick = function () { step(1); };
    row.appendChild(lab); row.appendChild(prev); row.appendChild(val); row.appendChild(next);
    box.appendChild(row);
  });
  renderJobList();
}
function jobUnlocked(job) {
  return levelInfo(save.xp).level >= job.level;
}
function renderJobList() {
  var box = $("#job-list");
  box.innerHTML = "";
  var lastLevel = null;
  JOBS.forEach(function (job) {
    /* 解放されるレベルごとに見出しを入れる */
    if (job.level !== lastLevel) {
      lastLevel = job.level;
      var hd = document.createElement("div");
      hd.className = "job-tier" + (jobUnlocked(job) ? "" : " locked");
      hd.textContent = job.level === 1 ? "さいしょから" : "Lv " + job.level + (jobUnlocked(job) ? " で かいほう ✔" : " で かいほう 🔒");
      box.appendChild(hd);
    }
    var open = jobUnlocked(job);
    var cur = save.job === job.key;
    var div = document.createElement("div");
    div.className = "quest-card window job-card" + (cur ? " is-current" : "") + (open ? "" : " locked");
    div.tabIndex = 0;
    div.setAttribute("role", "button");
    div.dataset.job = job.key;
    var cv = document.createElement("canvas");
    drawMyAvatar(cv, job.key, 3);
    var info = document.createElement("div");
    info.className = "quest-info";
    var nm = document.createElement("div");
    nm.className = "quest-name";
    nm.textContent = job.name;
    var ds = document.createElement("div");
    ds.className = "quest-desc";
    ds.textContent = open ? "とくちょう「" + job.perkName + "」" : "🔒 Lv " + job.level + " で かいほう";
    info.appendChild(nm); info.appendChild(ds);
    if (open) {
      var jl = jobLevelInfo(job.key);
      var lvl = document.createElement("div");
      lvl.className = "job-level";
      lvl.textContent = jl.max ? "★ マスター" + (save.subJob === job.key ? "（サブ特ちょう）" : "")
        : "しょくぎょう Lv " + jl.level + "（つぎまで " + (jl.need - jl.cur) + " EXP）";
      info.appendChild(lvl);
    }
    if (cur) {
      var mark = document.createElement("div");
      mark.className = "quest-stars";
      mark.textContent = "▶ いまの しょくぎょう";
      info.appendChild(mark);
    }
    div.appendChild(cv); div.appendChild(info);
    div.onclick = function () { Sound.select(); openJobCard(job.key); };
    box.appendChild(div);
  });
}

/* 解説カード（しょくぎょう・のちに 装備・モンスター など）。読むことが そのまま勉強になるように、
 * 「ひとことで」「しけんでは」などの欄と、関係する問題に すぐ ちょうせんできるボタンを出す。
 * card = { kind, title, sub, draw(canvas), sections: [{ h, text }], actions: [{ label, onClick, disabled, note }] } */
function openCard(card) {
  $("#card-kind").textContent = card.kind || "";
  $("#card-title").textContent = card.title || "";
  $("#card-sub").textContent = card.sub || "";
  var img = $("#card-img");
  img.classList.toggle("hidden", !card.draw);
  if (card.draw) card.draw(img);
  var body = $("#card-body");
  body.innerHTML = "";
  (card.sections || []).forEach(function (sec) {
    var h = document.createElement("h3");
    h.className = "card-h";
    h.textContent = sec.h;
    var t = document.createElement("p");
    t.className = "card-text";
    t.textContent = sec.text;
    body.appendChild(h); body.appendChild(t);
  });
  var acts = $("#card-actions");
  acts.innerHTML = "";
  (card.actions || []).forEach(function (a) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn" + (a.primary ? " btn-primary" : "");
    btn.textContent = a.label;
    btn.disabled = !!a.disabled;
    btn.onclick = function () { a.onClick(); };
    acts.appendChild(btn);
    if (a.note) {
      var n = document.createElement("div");
      n.className = "card-note";
      n.textContent = a.note;
      acts.appendChild(n);
    }
  });
  $("#card-modal").classList.remove("hidden");
  body.scrollTop = 0;
  $("#card-close").focus();
}
function closeCard() {
  $("#card-modal").classList.add("hidden");
}

/* しょくぎょうの 関係する問題（いまの対策項目の問題のうち、分野が合うもの） */
function jobPracticePool(jobKey) {
  var job = jobDef(jobKey);
  return Object.keys(QUESTION_INDEX).filter(function (id) {
    return inCourse(id) && job.fields.indexOf(QUESTION_INDEX[id].q.field) >= 0;
  });
}
function openJobCard(jobKey) {
  var job = jobDef(jobKey);
  var open = jobUnlocked(job);
  var cur = save.job === job.key;
  var pool = jobPracticePool(job.key);
  var jl = jobLevelInfo(job.key);
  var actions = [{
    label: cur ? "いまの しょくぎょう" : open ? "この しょくぎょうに なる" : "🔒 Lv " + job.level + " で かいほう",
    primary: true,
    disabled: cur || !open,
    onClick: function () {
      save.job = job.key;
      persist();
      syncNow();
      Sound.heal();
      closeCard();
      renderAvatarScreen();
      toast(job.name + "に なった！");
    }
  }];
  if (open && jl.level >= JOB_LV_STYLE) {
    actions.push({
      label: save.jobStyle[job.key] ? "ふつうの服に もどす" : "🎨 いろちがいの服を きる",
      onClick: function () {
        save.jobStyle[job.key] = save.jobStyle[job.key] ? 0 : 1;
        persist(); Sound.select(); closeCard(); renderAvatarScreen(); openJobCard(job.key);
      }
    });
  }
  if (jl.max && !cur) {
    actions.push({
      label: save.subJob === job.key ? "サブ特ちょうを はずす" : "⭐ サブ特ちょうに する（「" + job.perkName + "」）",
      onClick: function () {
        save.subJob = save.subJob === job.key ? null : job.key;
        persist(); Sound.heal(); closeCard(); renderAvatarScreen();
        toast(save.subJob ? "サブ特ちょう「" + job.perkName + "」を つけた！" : "サブ特ちょうを はずした");
      },
      note: "マスターした しょくぎょうの特ちょうを、ほかの しょくぎょうでも 1つ つけられる"
    });
  }
  if (pool.length) {
    actions.push({
      label: "⚔️ " + job.name + "の しれん（" + Math.min(5, pool.length) + "もん）",
      onClick: function () { closeCard(); startJobPractice(job.key); },
      note: "この しごとに かかわる 分野の もんだいに ちょうせん（" + pool.length + "もんから）"
    });
  }
  openCard({
    kind: "しょくぎょう カード",
    title: job.name,
    sub: open ? "しょくぎょう Lv " + jl.level + (jl.max ? " ★マスター" : "") + " ／ とくちょう「" + job.perkName + "」" : "Lv " + job.level + " で かいほう",
    draw: function (cv) { drawMyAvatar(cv, job.key, 5); },
    sections: [
      { h: "💼 どんな しごと？", text: job.about },
      { h: "📝 しけんでは", text: job.exam },
      { h: "✨ とくちょう「" + job.perkName + "」", text: job.perk + "（もぎしけんでは きかない）" },
      { h: "💡 とくちょうの わけ", text: job.perkWhy },
      { h: "🎯 とくい分野", text: jobLikesText(job) + "\nとくい分野の問題に せいかいすると、EXP が 1.2ばい・ひっさつゲージも 多めに たまる。" },
      { h: "🏰 むいている ばしょ", text: job.bestFor },
      { h: "⭐ しょくぎょうレベル", text: jobLevelText(job.key) }
    ],
    actions: actions
  });
}
function jobLikesText(job) {
  var parts = [];
  if (job.fields.length) parts.push("IPA 基本情報：" + job.fields.join("・"));
  if (job.mosSubjects.length) parts.push("MOS：" + job.mosSubjects.map(function (k) { return k === "excel" ? "エクセル" : "ワード"; }).join("・"));
  return parts.join("\n");
}
function jobLevelText(jobKey) {
  var jl = jobLevelInfo(jobKey);
  var head = jl.max ? "Lv " + JOB_MAX_LEVEL + "（マスター）" : "Lv " + jl.level + "（つぎの レベルまで " + (jl.need - jl.cur) + " EXP）";
  return head + "\nこの しょくぎょうで いるあいだに 手に入れた EXP で 上がる。\n" +
    (jl.level >= JOB_LV_STYLE ? "✔" : "・") + " Lv " + JOB_LV_STYLE + "：いろちがいの服\n" +
    (jl.level >= JOB_LV_BOOST ? "✔" : "・") + " Lv " + JOB_LV_BOOST + "：特ちょうが つよくなる\n" +
    (jl.max ? "✔" : "・") + " Lv " + JOB_MAX_LEVEL + "：マスター（★・しょうごう「" + masterTitle(jobKey) + "」・サブ特ちょうに できる）";
}
/* クエストの おすすめ しょくぎょう：解放ずみの しょくぎょうのうち、とくいな問題が いちばん多いもの */
function recommendJob(questions) {
  var best = null, bestN = 0;
  JOBS.forEach(function (job) {
    if (!jobUnlocked(job)) return;
    var n = questions.filter(function (q) { return jobLikes(job.key, q); }).length;
    /* 同じ数なら、いまの しょくぎょうを優先 */
    if (n > bestN || (n === bestN && n > 0 && job.key === save.job)) { best = job; bestN = n; }
  });
  return best ? { job: best, n: bestN } : null;
}
function questRecoEl(quest) {
  var reco = recommendJob(quest.questions);
  if (!reco) return null;
  var wrap = document.createElement("div");
  wrap.className = "quest-reco";
  var curN = quest.questions.filter(function (q) { return jobLikes(save.job, q); }).length;
  var txt = document.createElement("span");
  if (reco.job.key === save.job || curN >= reco.n) {
    txt.textContent = "🎯 いまの しょくぎょうが とくい（" + curN + "/" + quest.questions.length + "もん）";
    wrap.appendChild(txt);
    return wrap;
  }
  txt.textContent = "🎯 おすすめ：" + reco.job.name + "（とくい " + reco.n + "/" + quest.questions.length + "もん）";
  var btn = document.createElement("button");
  btn.type = "button";
  btn.className = "btn btn-small quest-reco-btn";
  btn.textContent = "かえる";
  btn.onclick = function (e) {
    e.stopPropagation();
    save.job = reco.job.key;
    persist(); syncNow(); Sound.heal();
    toast(reco.job.name + "に なった！");
    var again = $("#quests-title").dataset.subject;
    if (again) openQuestList(again);
  };
  wrap.appendChild(txt); wrap.appendChild(btn);
  return wrap;
}

/* しれん：解説カードから入る、関係する問題 5問の短い戦い（にがてな問題を先に）。
 * practice = { kind: "job" | "monster", key, name }（リザルトの題名・「もういちど」に使う） */
function startPractice(pool, practice) {
  if (!pool.length) { toast("この たいさく こうもくには、まだ もんだいが ないよ"); return; }
  var weak = specialistWeakList().filter(function (id) { return pool.indexOf(id) >= 0; });
  var rest = shuffle(pool.filter(function (id) { return weak.indexOf(id) < 0; }));
  var ids = weak.concat(rest).slice(0, 5);
  battle = {
    mode: "review",
    practice: practice,
    quest: null,
    label: practice.name + "の しれん",
    qs: shuffle(ids.map(function (id) { return QUESTION_INDEX[id].q; })),
    bossFrom: 9999, bossHp: 0, bossMax: 0,
    idx: 0, hearts: 3, maxHearts: 3,
    correct: 0, combo: 0, xp: 0,
    bossPhase: false, bossCorrect: 0
  };
  beginBattle();
}
function startJobPractice(jobKey) {
  startPractice(jobPracticePool(jobKey), { kind: "job", key: jobKey, name: jobDef(jobKey).name });
}

/* =========================================================
 * モンスター図鑑の解説カード（js/bestiary_notes.js）
 * ======================================================= */
/* モンスターの「しれん」に使うクエスト（解説に quest があれば それ、無ければ そのモンスターが出るクエスト） */
function monsterQuest(name) {
  var note = window.BESTIARY_NOTES && BESTIARY_NOTES[name];
  var id = note && note.quest;
  for (var i = 0; i < ALL_QUESTS.length; i++) {
    var q = ALL_QUESTS[i];
    if (id ? q.id === id : (q.mob && q.mob.name === name) || (q.boss && q.boss.name === name)) return q;
  }
  return null;
}
function monsterPracticePool(name) {
  var quest = monsterQuest(name);
  if (!quest || quest.course !== currentCourse()) return [];
  return quest.questions.map(function (q) { return q.id; }).filter(function (id) { return !!QUESTION_INDEX[id]; });
}
function openMonsterCard(m) {
  var note = (window.BESTIARY_NOTES && BESTIARY_NOTES[m.name]) || null;
  var quest = monsterQuest(m.name);
  var pool = monsterPracticePool(m.name);
  var shinyPal = save.shinyMonsters[m.name];
  var sections = [{ h: "🐾 ひとこと", text: BESTIARY[m.name] || "" }];
  if (note) {
    sections.push({ h: "📖 キーワード「" + note.key + "」", text: note.about });
    sections.push({ h: "📝 しけんでは", text: note.exam });
  }
  sections.push({ h: "🗺️ であえる ばしょ", text: m.rare ? "どこかで ごく まれに あらわれる（げきレア）" :
    quest ? (courseDef(quest.course).label + "「" + quest.name + "」") : "まおうの城" });
  var actions = [];
  if (pool.length) {
    actions.push({
      label: "⚔️ " + m.name + "の しれん（" + Math.min(5, pool.length) + "もん）",
      primary: true,
      onClick: function () { closeCard(); startPractice(pool, { kind: "monster", key: m.name, name: m.name }); },
      note: "「" + quest.name + "」の もんだいに ちょうせん（" + pool.length + "もんから）"
    });
  } else if (quest && quest.course !== currentCourse()) {
    actions.push({ label: "⚔️ しれん", disabled: true, onClick: function () {},
      note: courseDef(quest.course).label + " を えらぶと、ここから もんだいに ちょうせんできるよ" });
  }
  openCard({
    kind: "モンスター カード",
    title: m.name,
    sub: note ? "キーワード：" + note.key : "",
    draw: function (cv) { drawSprite(cv, m.shape, shinyPal || m.palette, 5); },
    sections: sections,
    actions: actions
  });
}

/* ---------- 対策項目を えらぶ ---------- */
function openCourseSelect() {
  var list = availableCourses();
  /* 1つしか無いなら えらぶ画面は飛ばす */
  if (list.length < 2) {
    if (save.course !== list[0].key) { save.course = list[0].key; persist(); }
    renderTitleCourse();
    openMenu();
    return;
  }
  var box = $("#course-list");
  box.innerHTML = "";
  list.forEach(function (c) {
    var last = save.course === c.key;
    var div = document.createElement("div");
    div.className = "quest-card window course-card" + (last ? " is-last" : "");
    div.tabIndex = 0;
    div.setAttribute("role", "button");
    div.id = "course-" + c.key;
    var icon = document.createElement("div");
    icon.className = "course-icon";
    icon.textContent = c.icon;
    var info = document.createElement("div");
    info.className = "quest-info";
    var nm = document.createElement("div");
    nm.className = "quest-name";
    nm.textContent = c.label + "（" + c.sub + "）";
    var ds = document.createElement("div");
    ds.className = "quest-desc";
    ds.textContent = c.desc;
    info.appendChild(nm); info.appendChild(ds);
    if (last) {
      var mark = document.createElement("div");
      mark.className = "quest-stars course-last";
      mark.textContent = "▶ まえ回 えらんだ こうもく";
      info.appendChild(mark);
    }
    div.appendChild(icon); div.appendChild(info);
    div.onclick = function () { Sound.select(); chooseCourse(c.key); };
    box.appendChild(div);
  });
  show("screen-course");
  var focus = $("#course-list .is-last") || $("#course-list .course-card");
  if (focus) focus.focus();
}
function chooseCourse(key) {
  save.course = key;
  persist();
  syncNow();
  renderTitleCourse();
  openMenu();
}

/* タイトルは対策項目に関係なく「STUDY QUEST」1つ（index.html に書いてある）。
 * 対策項目は「ぼうけんを はじめる」のあとに えらぶ。呼んでいる所が残っているので、関数だけ残す */
function renderTitleCourse() {}

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
    Juice.banner("🌱", "あたらしい れんぞくきろく、はじめよう！", "さいちょう きろくは " + result.longest + "日", "");
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

/* つぎの めあて：あと少しで とれる実績を1つ見せる（「もう1回やろう」のきっかけ） */
function renderNextGoal() {
  var el = $("#menu-goal");
  var best = null;
  ACHIEVEMENTS.forEach(function (a) {
    if (save.achievements[a.id] || !a.prog || a.noGoal) return;
    var p = a.prog(save);
    var ratio = p[0] / p[1];
    if (ratio > 0 && ratio < 1 && (!best || ratio > best.ratio)) best = { a: a, ratio: ratio, left: p[1] - p[0] };
  });
  if (!best) { el.classList.add("hidden"); return; }
  el.textContent = "🎯 つぎの めあて：" + best.a.desc + "（あと " + best.left + "）";
  el.classList.remove("hidden");
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
  /* 試験日カウントダウン（GAME_CONFIG.EXAM_DATES）は MOS の試験日なので、MOS のときだけ */
  var line = currentCourseDef().countdown ? Countdown.pickLine() : null;
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

/* クエストの一覧のカードを、Tab キーで選べるようにする（Enter／スペースで開く） */
function enableCardKeys() {
  Array.prototype.slice.call(document.querySelectorAll("#quest-list .quest-card")).forEach(function (card) {
    if (card.classList.contains("locked")) return;
    card.tabIndex = 0;
    card.setAttribute("role", "button");
  });
}

/* クエストの習熟度（0〜100%）：全問の記憶の箱（0〜5）の合計 ÷ 満点。
 * ★はクリアのうまさ、こちらは「どれだけ おぼえたか」。周回すると少しずつ伸びる */
function questMastery(quest) {
  var sum = 0;
  quest.questions.forEach(function (q) {
    var m = SRS.mastery(save.records, q.id);
    if (m > 0) sum += m;
  });
  return Math.round(sum / (quest.questions.length * SRS.MAX_BOX) * 100);
}
function questMasteryEl(quest) {
  var pct = questMastery(quest);
  var wrap = document.createElement("div");
  wrap.className = "quest-mastery";
  var bar = document.createElement("div");
  bar.className = "quest-mastery-bar";
  var fill = document.createElement("div");
  fill.style.width = pct + "%";
  bar.appendChild(fill);
  var label = document.createElement("span");
  label.textContent = (pct >= 100 ? "👑 " : "") + "しゅうじゅく " + pct + "%";
  wrap.appendChild(bar);
  wrap.appendChild(label);
  return wrap;
}

function openQuestList(subjectKey) {
  var sub = SUBJECTS.filter(function (s) { return s.subject === subjectKey; })[0];
  $("#quests-title").textContent = sub.label;
  $("#quests-title").dataset.subject = subjectKey;
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
    if (unlocked) info.appendChild(questMasteryEl(quest));
    if (unlocked) { var reco = questRecoEl(quest); if (reco) info.appendChild(reco); }

    div.appendChild(cv);
    div.appendChild(info);
    if (unlocked) {
      div.onclick = function () { Sound.select(); startQuest(quest); };
    }
    box.appendChild(div);
  });
  enableCardKeys();
  show("screen-quests");
}

/* エキスパートのかくしダンジョン：クエスト一覧＋末尾の裏ボスカード */
function openExpertQuests() {
  $("#quests-title").textContent = EXPERT_QUEST_DATA_EXCEL.label;
  $("#quests-title").dataset.subject = "";
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
    if (unlocked) info.appendChild(questMasteryEl(quest));

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

  enableCardKeys();
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
    ["たいさく こうもく", currentCourseDef().label],
    ["クエストたっせい", courseClearedCount() + " / " + courseQuests().length],
    ["あつめた ★", courseStars() + " / " + (courseQuests().length * 3)],
    ["もぎけんてい さいこう", (function () {
      var ex = save.exams || {};
      return currentCourseDef().exams.map(function (d) {
        return d.label.replace(/\s*もぎ.*$/, "") + " " + (ex[d.key] ? ex[d.key].best + "てん" : "—");
      }).join(" / ");
    })()],
    ["ふくしゅう まち", specialistDueList().length + " もん"],
    ["かいしんの いちげき", save.stats.crits + " 回"],
    ["クイックせいかい", save.stats.quicks + " 回"],
    ["ひっさつわざ", save.stats.specials + " 回"],
    ["たおした モンスター", save.stats.kills + " 体"],
    ["むげんの めいきゅう", save.endless.best > 0 ? "ちか " + save.endless.best + " かい" : "—"],
    ["ぶき", weaponFor(li.level).name],
    ["しょうごう", (save.finalClear || Object.keys(save.finalClears).length) ? "まおうを たおせし者" : rankFor(li.level)]
  ].forEach(function (pair) {
    var dt = document.createElement("dt"); dt.textContent = pair[0];
    var dd = document.createElement("dd"); dd.textContent = pair[1];
    $("#status-stats").appendChild(dt);
    $("#status-stats").appendChild(dd);
  });

  /* しゅうじゅく度マップ（問題ごとの記憶ボックスを色で表示） */
  var map = $("#status-mastery");
  map.innerHTML = "";
  courseSubjects().forEach(function (sub) {
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
      ? m.name + (m.rare ? "　✨げきレア" : "") + (shinyPal ? "　🌟色ちがい" : "")
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
      meta.textContent = (medal ? medal.icon + " " : "") + "たおした数 " + kills + " 体" +
        (next ? "（" + next.name + "まで あと " + (next.at - kills) + "）" : "");
      info.appendChild(meta);
    }

    div.appendChild(cv); div.appendChild(info);
    if (seen) {
      /* であったモンスターは、押すと解説カード（名前のもとになった用語と、試験のポイント）が出る */
      div.tabIndex = 0;
      div.setAttribute("role", "button");
      div.classList.add("has-card");
      div.onclick = function () { Sound.select(); openMonsterCard(m); };
    }
    box.appendChild(div);
  });

  $("#bestiary-progress").textContent = seenCount + " / " + list.length + " たいと であった（であった モンスターを おすと 解説カードが みられるよ）";
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
  /* まだ アバターを作っていない人（v2.5 より前から遊んでいる人も）は、さきに作る */
  if (save) { if (!save.avatar) openAvatar(true); else openCourseSelect(); return; }
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
  openAvatar(true);   /* はじめに アバターを作ってから、対策項目を えらぶ */
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
  $("#btn-mute").textContent = m === "all" ? "♪ おんがく" : (m === "se" ? "♪ おとだけ" : "♪ OFF");
}

/* えんしゅつ（はで／ひかえめ）の切りかえ。タイトルと「ぼうけんの しょ」の両方から変えられる */
function updateFxButtons() {
  var low = Juice.isLow();
  $("#btn-fx-level").textContent = low ? "ひかえめ（タップで はでに）" : "はで（タップで ひかえめに）";
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
  renderTitleCourse();
  initBattleLayout();
  updateMuteButton();
  updateFxButtons();
  startTitleSparkle();

  /* 敵のうごきが終わったら待機にもどす */
  $("#enemy-canvas").addEventListener("animationend", onEnemyAnimEnd);
  /* レベルアップのえんしゅつは タップで とじる */
  $("#levelup-overlay").onclick = closeLevelUp;
  $("#btn-fx-level").onclick = toggleFxLevel;
  $("#title-fx-toggle").onclick = toggleFxLevel;
  /* キーボードでも遊べる：1〜9 で選択肢、Enter／スペースで「すすむ」（教室のPCで手を止めずに進める） */
  document.addEventListener("keydown", function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;
    var tag = (e.target && e.target.tagName) || "";
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    var isGo = e.key === "Enter" || e.key === " ";
    /* レベルアップのえんしゅつは、Enter／スペース／Esc でも とじられる */
    if (!$("#levelup-overlay").classList.contains("hidden")) {
      if (isGo || e.key === "Escape") { e.preventDefault(); closeLevelUp(); }
      return;
    }
    /* クエストの一覧は、Enter／スペースでも選べる */
    if (isGo && e.target.classList && (e.target.classList.contains("quest-card") || e.target.classList.contains("has-card")) && !e.repeat) {
      e.preventDefault(); e.target.click(); return;
    }
    /* 解説カードは、Esc でも とじられる（開いている間は、うしろの選択肢を キーで えらばない） */
    if (!$("#card-modal").classList.contains("hidden")) {
      if (e.key === "Escape") { e.preventDefault(); closeCard(); }
      return;
    }
    /* 図の かくだいは、Esc・Enter でも とじられる */
    if (!$("#figure-modal").classList.contains("hidden")) {
      if (e.key === "Escape" || isGo) { e.preventDefault(); closeFigure(); }
      return;
    }
    /* はんいを えらぶ画面は、Esc でも とじられる */
    if (!$("#scope-modal").classList.contains("hidden")) {
      if (e.key === "Escape") { e.preventDefault(); closeScopeSelect(); }
      return;
    }
    /* 擬似言語の記述形式は、Esc でも とじられる（開いている間は、うしろの選択肢を キーで えらばない） */
    if (!$("#notation-modal").classList.contains("hidden")) {
      if (e.key === "Escape") { e.preventDefault(); closeNotation(); }
      return;
    }
    if (!$("#screen-battle").classList.contains("active")) return;
    if (!$("#feedback-modal").classList.contains("hidden")) return;
    /* Enter を押しっぱなしにしても、解説を読まないまま次へ進まない */
    if (e.repeat && isGo) { e.preventDefault(); return; }
    var n = e.key.length === 1 ? "123456789".indexOf(e.key) : -1;
    if (n >= 0) {
      var box = $("#battle-choices");
      var btns = box.querySelectorAll(".choice");
      if (btns[n] && !btns[n].disabled && !box.classList.contains("arming")) { e.preventDefault(); btns[n].click(); }
      return;
    }
    /* ボタンにフォーカスがあるときの Enter は、ブラウザがそのボタンを押すので、ここでは何もしない */
    if ((e.key === "Enter" || e.key === " ") && tag !== "BUTTON") {
      var cont = $("#battle-continue");
      if (!cont.classList.contains("hidden")) { e.preventDefault(); cont.click(); }
    }
  });

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
  $("#battle-notation").onclick = function () { Sound.select(); openNotation(this.dataset.notation); };
  $("#notation-close").onclick = closeNotation;
  $("#feedback-send").onclick = submitFeedback;
  $("#feedback-modal").onclick = function (e) {
    if (e.target === this) closeFeedback();   /* 外側クリックで閉じる */
  };

  /* 科目ボタン（エクセルの とう 等）は renderCourseMenu() が作って結線する */
  $("#menu-course-change").onclick = function () { Sound.select(); openCourseSelect(); };
  $("#figure-close").onclick = function () { closeFigure(); };
  $("#card-close").onclick = function () { Sound.select(); closeCard(); };
  $("#card-modal").onclick = function (e) { if (e.target === this) closeCard(); };
  $("#menu-avatar").onclick = function () { Sound.select(); openAvatar(false); };
  $("#menu-avatar-img").onclick = function () { Sound.select(); openAvatar(false); };
  $("#status-avatar-img").onclick = function () { Sound.select(); openAvatar(false); };
  $("#avatar-random").onclick = function () { Sound.select(); save.avatar = randomAvatar(); persist(); renderAvatarScreen(); };
  $("#avatar-done").onclick = function () {
    Sound.select();
    if (avatarFirst) { avatarFirst = false; openCourseSelect(); } else openMenu();
  };
  $("#figure-modal").onclick = function (e) { if (e.target === this || e.target.id === "figure-img") closeFigure(); };
  $("#scope-close").onclick = function () { Sound.select(); closeScopeSelect(); };
  $("#scope-modal").onclick = function (e) { if (e.target === this) closeScopeSelect(); };
  $("#menu-review").onclick = function () { Sound.select(); enterWithScope("review"); };
  $("#menu-final").onclick = function () {
    if (!finalUnlockedAny()) {
      toast("まだ ふういんされている… すべての クエストを クリアせよ！");
      return;
    }
    Sound.select(); enterWithScope("final");
  };
  $("#menu-expert").onclick = function () {
    if (!save.finalClear) {
      toast("まだ かくされている… まおうの城を さきに クリアせよ！");
      return;
    }
    Sound.select(); openExpertQuests();
  };
  $("#menu-endless").onclick = function () {
    if (scopeClearedCount() < ENDLESS_UNLOCK) {
      toast("まだ とびらが ひらかない… クエストを " + ENDLESS_UNLOCK + "つ クリアせよ！");
      return;
    }
    Sound.select(); enterWithScope("endless");
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
