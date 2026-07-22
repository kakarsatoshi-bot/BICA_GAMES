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
function newSave(name, klass) {
  return {
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
  };
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

function beginBattle() {
  $("#battle-quest-name").textContent = battle.label;
  $("#battle-choices").innerHTML = "";
  $("#battle-continue").classList.add("hidden");
  $("#boss-hpbar").classList.add("hidden");
  $("#hotspot-stage").classList.add("hidden");
  $("#hotspot-stage").innerHTML = "";
  $("#battle-stage").classList.remove("hotspot-mode");
  $("#enemy-canvas").classList.remove("hidden");
  $("#enemy-name").classList.remove("hidden");

  /* クエストごとの背景を描画 */
  var theme = battle.mode === "review" ? "shrine"
            : battle.mode === "final" ? "final"
            : battle.mode === "expert" ? "final"   // 専用の背景テーマは未作成。まおうの城の溶岩背景を流用する
            : battle.mode === "exam" ? "temple"
            : StageBg.forQuest(battle.quest.id);
  StageBg.draw($("#stage-bg"), theme);

  show("screen-battle");
  showTurn();
}

/* モンスター図鑑：遭遇したモンスターを記録する */
function recordSeenMonster(name) {
  if (save.seenMonsters.indexOf(name) < 0) save.seenMonsters.push(name);
}

function currentMonster() {
  battle.isRare = false;
  if (battle.mode === "final") {
    return { shape: "demon", palette: "dark", name: "まおうデリート" };
  }
  if (battle.mode === "expert") {
    return { shape: "demon", palette: "purple", name: "しんおうデリート" };
  }
  if (battle.bossPhase) return battle.quest.boss;
  if (battle.mode === "exam") {
    var examMobs = ALL_QUESTS.map(function (q) { return q.mob; });
    return examMobs[Math.floor(Math.random() * examMobs.length)];
  }
  /* クエスト・復習中のみ、ごく低確率で激レアモンスターが出現する */
  if (Math.random() < RARE_MONSTER_CHANCE) {
    battle.isRare = true;
    return RARE_MONSTER;
  }
  if (battle.mode === "review") {
    var mobs = ALL_QUESTS.map(function (q) { return q.mob; });
    return mobs[Math.floor(Math.random() * mobs.length)];
  }
  return battle.quest.mob;
}

function updateHud() {
  var h = "";
  if (!battle.noFail) {
    for (var i = 0; i < battle.maxHearts; i++) h += i < battle.hearts ? "♥" : "♡";
  }
  $("#battle-hearts").textContent = h;
  $("#battle-progress").textContent = (battle.idx + 1) + "/" + battle.qs.length;
  if (battle.bossPhase || battle.mode === "final") {
    $("#boss-hpbar").classList.remove("hidden");
    var pct = Math.max(0, battle.bossHp / battle.bossMax * 100);
    $("#boss-hpfill").style.width = pct + "%";
  }
}

function showTurn() {
  var enteringBoss = !battle.bossPhase && battle.idx >= battle.bossFrom;
  if (enteringBoss) battle.bossPhase = true;
  /* ボスが既に登場ずみの2問目以降は、出現メッセージなしで次の問題へ直行する */
  var bossContinuing = battle.bossPhase && !enteringBoss;

  var canvas = $("#enemy-canvas");
  $("#battle-choices").innerHTML = "";
  $("#battle-continue").classList.add("hidden");

  /* もぎけんていは出現メッセージなしでテンポよく出題する */
  if (battle.mode === "exam") {
    var em = currentMonster();
    battle.mob = em;
    recordSeenMonster(em.name);
    persist();
    drawSprite(canvas, em.shape, em.palette, 9);
    canvas.className = "spawn";
    $("#enemy-name").textContent = em.name;
    updateHud();
    showQuestion();
    return;
  }

  if (bossContinuing) {
    canvas.className = "";   /* ボスは立ったまま。再出現アニメもさせない */
    updateHud();
    showQuestion();
    return;
  }

  var m = currentMonster();
  battle.mob = m;
  recordSeenMonster(m.name);
  persist();
  var scale = (battle.bossPhase || battle.mode === "final") ? 12 : 9;
  drawSprite(canvas, m.shape, m.palette, scale);
  canvas.className = "spawn";
  $("#enemy-name").textContent = m.name;
  updateHud();

  var intro;
  if (battle.isRare) {
    Sound.heal();
    intro = RARE_MONSTER_INTRO[Math.floor(Math.random() * RARE_MONSTER_INTRO.length)];
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

  typeMsg(intro, function () {
    setTimeout(showQuestion, 450);
  });
}

function showQuestion() {
  var q = battle.qs[battle.idx];
  typeMsg(q.q);
  renderQuestionVisual(q);
  var box = $("#battle-choices");
  box.innerHTML = "";
  var order = shuffle([0, 1, 2, 3]);
  order.forEach(function (ci) {
    var btn = document.createElement("button");
    btn.className = "choice";
    btn.textContent = q.c[ci];
    btn.onclick = function () { answer(ci === q.a, btn); };
    box.appendChild(btn);
  });
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
  var q = battle.qs[battle.idx];
  document.querySelectorAll(".choice").forEach(function (b) { b.disabled = true; });
  btn.classList.add(isCorrect ? "picked-right" : "picked-wrong");

  SRS.record(save.records, q.id, isCorrect);
  save.stats.answered++;

  /* もぎけんてい: 分野（クエスト）ごとの正答を記録して苦手診断に使う */
  if (battle.mode === "exam") {
    var qname = QUESTION_INDEX[q.id].quest.name;
    var pq = battle.perQuest[qname] || (battle.perQuest[qname] = { right: 0, total: 0 });
    pq.total++;
    if (isCorrect) pq.right++;
  }

  var canvas = $("#enemy-canvas");
  var msg;

  if (isCorrect) {
    save.stats.correct++;
    battle.correct++;
    battle.combo++;
    if (battle.combo > save.stats.bestCombo) save.stats.bestCombo = battle.combo;

    var gained = battle.mode === "review" ? 6 : battle.mode === "exam" ? 8 : 10;
    if (battle.bossPhase || battle.mode === "final") gained = 15;
    var comboBonus = Math.min((battle.combo - 1) * 2, 10);
    gained += comboBonus;
    if (battle.isRare) gained += 20;   /* 激レアモンスターのラッキーボーナス */
    battle.xp += gained;
    save.xp += gained;

    /* 連続正解でこうげきが進化する: 剣 → いなずま → ごうかの まほう */
    var tier = battle.combo >= 5 ? "fire" : (battle.combo >= 3 ? "bolt" : "slash");
    var waza = tier === "fire" ? "ごうかの まほうが さくれつ！"
             : tier === "bolt" ? "いなずまの まほうが ほとばしる！"
             : "つるぎの いちげき！";
    if (tier === "bolt") Sound.zap();
    else if (tier === "fire") Sound.fireball();
    else Sound.attack();
    setTimeout(function () { Sound.correct(); }, 240);
    Fx.attack(tier);
    Fx.floatText("＋" + gained + " EXP");

    var isBoss = battle.bossPhase || battle.mode === "final";
    var died = true;
    if (isBoss) {
      battle.bossHp--;
      battle.bossCorrect++;
      died = battle.bossHp <= 0;
      msg = waza + " ボスに ダメージ！\n＋" + gained + " EXP";
      if (died) msg = "とどめの いちげき！！ ボスを たおした！\n＋" + gained + " EXP";
    } else if (battle.isRare) {
      msg = RARE_MONSTER_DEFEAT[Math.floor(Math.random() * RARE_MONSTER_DEFEAT.length)]
          + " ラッキーEXP＋" + gained + "！"
          + (q.exp ? "\n【まめちしき】" + q.exp : "");
    } else {
      msg = waza + " " + battle.mob.name + "を たおした！ ＋" + gained + " EXP"
          + (q.exp ? "\n【まめちしき】" + q.exp : "");
      if (comboBonus > 0) msg = "れんぞく せいかい！ " + msg;
    }
    /* エフェクトが当たってから敵がやられる（ひと呼吸おいて命中感を出す） */
    setTimeout(function () {
      canvas.className = died ? "die" : "hit";
      if (died) {
        Fx.particles(battle.mob.palette, isBoss ? 18 : 12);
        if (isBoss) Fx.flash("rgba(255,210,59,.3)", 350);
      }
    }, 160);
  } else {
    battle.combo = 0;
    if (!battle.noFail) battle.hearts--;
    Sound.wrong();
    Fx.claw();
    Fx.floatText(battle.noFail ? "ミス…" : "－♥ ダメージ！", "#ff5d7a");
    $("#screen-battle").classList.add("shake");
    setTimeout(function () { $("#screen-battle").classList.remove("shake"); }, 420);
    msg = "ミス！ こうげきを うけた…\nせいかいは 「" + q.c[q.a] + "」\n【かいせつ】" + q.exp;
  }

  /* デイリーミッションの進捗を更新し、達成したぶんだけボーナスEXPを加える */
  var missionHits = [Missions.record(save, "answered", 1)];
  if (isCorrect) {
    missionHits.push(Missions.record(save, "correct", 1));
    missionHits.push(Missions.record(save, "comboReach", battle.combo));
    if (battle.mode === "review") missionHits.push(Missions.record(save, "reviewCorrect", 1));
  }
  missionHits.filter(Boolean).forEach(function (m) {
    save.xp += MISSION_BONUS_XP;
    battle.xp += MISSION_BONUS_XP;
    toast("📋 ミッション達成！「" + m.label + "」＋" + MISSION_BONUS_XP + "EXP");
  });

  persist();
  updateHud();
  typeMsg(msg, function () {
    var btnNext = $("#battle-continue");
    btnNext.classList.remove("hidden");
    btnNext.focus();
  });
}

function nextTurn() {
  Sound.select();
  $("#battle-continue").classList.add("hidden");
  battle.idx++;
  if (battle.hearts <= 0) { endBattle(false); return; }
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

/* ---------- 結果（もぎけんてい） ---------- */
function endExam() {
  var prevLevel = levelInfo(save.xp - battle.xp).level;
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

  persist();
  syncNow();

  var newAchievements = Achievements.check(save);
  if (newAchievements.length) { persist(); showAchievementToasts(newAchievements); }

  Sound[pass ? "clear" : "fail"]();
  $("#result-title").textContent = pass ? "ごうかく！！" : "あと すこし…！";
  $("#result-title").className = pass ? "result-clear" : "result-fail";
  $("#result-stars").textContent = pass ? "🎖" : "";

  var lines = ["スコア " + score + " ／ 1000（ごうかくライン 700）"];
  var weak = [];
  for (var name in battle.perQuest) {
    var r = battle.perQuest[name];
    if (r.right < r.total) weak.push(name + "（" + r.right + "/" + r.total + "）");
  }
  lines.push(weak.length ? "にがてな ぶんや: " + weak.join("、") : "ぜんぶんや パーフェクト！");
  lines.push(pass
    ? "この ちょうしなら ほんばんも だいじょうぶだ！"
    : "にがてを「ふっかつのほこら」で とっくんして さいちょうせんだ！");
  $("#result-sub").textContent = lines.join("\n");
  $("#result-detail").textContent =
    "せいかい " + battle.correct + "/" + battle.qs.length +
    "　かくとく " + battle.xp + " EXP";

  var newLi = levelInfo(save.xp);
  var lvEl = $("#result-levelup");
  if (newLi.level > prevLevel) {
    setTimeout(function () { Sound.levelup(); }, 600);
    var rankUp = rankFor(newLi.level) !== rankFor(prevLevel);
    lvEl.textContent = "レベルアップ！ Lv" + prevLevel + " → Lv" + newLi.level +
      (rankUp ? "\nランクアップ！ →「" + rankFor(newLi.level) + "」" : "");
    lvEl.classList.remove("hidden");
  } else {
    lvEl.classList.add("hidden");
  }
  $("#result-retry").classList.remove("hidden");
  show("screen-result");
}

/* ---------- 結果 ---------- */
function endBattle(cleared) {
  if (battle.mode === "exam") { endExam(); return; }
  var prevLevel = levelInfo(save.xp - battle.xp).level;
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

      chestReward = Treasure.grant(save, battle.quest);
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

  var newLi = levelInfo(save.xp);
  var title, sub;
  if (cleared) {
    Sound.clear();
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
    Sound.fail();
    title = "ぜんめつ…";
    sub = "しかし けいけんちは のこった。\nまちがえた もんだいは「ふっかつのほこら」で とっくんできるぞ！";
  }

  $("#result-title").textContent = title;
  $("#result-title").className = cleared ? "result-clear" : "result-fail";
  $("#result-sub").textContent = sub;
  $("#result-stars").textContent = cleared && battle.mode !== "review"
    ? "★".repeat(stars) + "☆".repeat(3 - stars) : "";
  $("#result-detail").textContent =
    "せいかい " + battle.correct + "/" + battle.idx +
    "　かくとく " + battle.xp + " EXP";

  var lvEl = $("#result-levelup");
  if (newLi.level > prevLevel) {
    setTimeout(function () { Sound.levelup(); }, 600);
    var rankUp = rankFor(newLi.level) !== rankFor(prevLevel);
    lvEl.textContent = "レベルアップ！ Lv" + prevLevel + " → Lv" + newLi.level +
      (rankUp ? "\nランクアップ！ →「" + rankFor(newLi.level) + "」" : "");
    lvEl.classList.remove("hidden");
  } else {
    lvEl.classList.add("hidden");
  }

  var retryBtn = $("#result-retry");
  retryBtn.classList.toggle("hidden", battle.mode === "review" && cleared);

  renderChestBox(chestReward);
  missionHits.filter(Boolean).forEach(function (m) {
    toast("📋 ミッション達成！「" + m.label + "」＋" + MISSION_BONUS_XP + "EXP");
  });
  if (newAchievements.length) showAchievementToasts(newAchievements);

  show("screen-result");
}

function retryBattle() {
  Sound.select();
  if (battle.mode === "quest") startQuest(battle.quest);
  else if (battle.mode === "review") startReview();
  else if (battle.mode === "exam") startExam(battle.subjectKey);
  else if (battle.mode === "expert") startExpert();
  else startFinal();
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
  var msg = result.broken
    ? "あたらしい れんぞくきろく、はじめよう！（さいちょう記録は " + result.longest + "日）"
    : "🔥 れんぞく " + result.streak + "日目！ よくきたね！";
  if (due > 0) msg += "\nふっかつのほこらに " + due + "もん 復習まちだよ！";
  toast(msg);
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
function showAchievementToasts(list) {
  list.forEach(function (a, i) {
    setTimeout(function () { toast("🏅 実績解除：" + a.name); }, i * 2400);
  });
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
    ds.textContent = unlocked ? a.desc : "まだ みたされていない…";
    info.appendChild(nm); info.appendChild(ds);
    div.appendChild(icon); div.appendChild(info);
    box.appendChild(div);
  });
  $("#achievements-progress").textContent = unlockedCount + " / " + ACHIEVEMENTS.length + " かいほう ずみ";
  show("screen-achievements");
}

/* ---------- たからばこ ---------- */
function renderChestBox(reward) {
  var box = $("#chest-box");
  if (!reward) { box.classList.add("hidden"); return; }
  box.classList.remove("hidden");
  var cv = $("#chest-canvas");
  cv.className = "";
  drawSprite(cv, "chestClosed", "gold", 6);
  var rewardText = $("#chest-reward-text");
  rewardText.classList.add("hidden");
  var openBtn = $("#chest-open");
  openBtn.classList.remove("hidden");
  var opened = false;
  openBtn.onclick = function () {
    if (opened) return;
    opened = true;
    Sound.chest();
    cv.classList.add("opening");
    if (reward.type === "palette") drawSprite(cv, reward.shape, reward.palette, 6);
    else drawSprite(cv, "chestOpen", "gold", 6);
    rewardText.textContent = reward.label;
    rewardText.classList.remove("hidden");
    openBtn.classList.add("hidden");
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
 * 個人情報保護のため、生徒全員の成績を一覧で読み取れるAPIはあえて用意していない。
 * ここでは自分の最新の成績をサーバーへ送るだけ（write-only）。
 * クラス全体のランキングは、先生がスプレッドシートを Google Classroom 等の
 * 学内システム経由で共有する運用（詳しくは game/README.md を参照）。
 * ======================================================= */
function openRanking() {
  show("screen-ranking");
  if (!Api.enabled()) {
    $("#ranking-note").textContent = "せんせいが せっていすると、きみの せいせきが せんせいの きろくに とどくよ！（いまは オフラインモード）";
    return;
  }
  $("#ranking-note").textContent = "そうしんちゅう…";
  syncNow();
  setTimeout(function () {
    $("#ranking-note").textContent =
      "きみの せいせきを せんせいに とどけたよ！\nクラスの ランキングは せんせいが Classroom（クラスルーム）で きょうゆうする せいせきひょうを みてね。";
  }, 500);
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
  $("#btn-mute").textContent = Sound.isMuted() ? "♪ OFF" : "♪ ON";
}

window.addEventListener("DOMContentLoaded", function () {
  save = loadSave();
  if (save) {
    /* 旧セーブとの後方互換：新しく追加したフィールドがなければ初期値を補う */
    save.seenMonsters = save.seenMonsters || [];
    save.streak = save.streak || { current: 0, longest: 0, lastLoginDate: null };
    save.missions = save.missions || { date: null, list: [] };
    save.achievements = save.achievements || {};
    save.titles = save.titles || [];
    save.shinyMonsters = save.shinyMonsters || {};
    save.stats.missionsCompleted = save.stats.missionsCompleted || 0;
    save.player.equippedTitle = save.player.equippedTitle || null;
    save.expertClear = save.expertClear || false;
    save.practical = save.practical || {};
    persist();
  }
  $("#title-start").textContent = save ? "ぼうけんを つづける" : "ぼうけんを はじめる";
  if (save) {
    var li = levelInfo(save.xp);
    $("#title-continue-info").textContent =
      save.player.name + "（Lv" + li.level + " " + rankFor(li.level) + "）の ぼうけんのしょ";
  }
  updateMuteButton();

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
  $("#menu-exam").onclick = function () { Sound.select(); openExamSelect(); };
  $("#menu-practical").onclick = function () { Sound.select(); openPractical(); };
  $("#menu-ranking").onclick = function () { Sound.select(); openRanking(); };
  $("#menu-status").onclick = function () { Sound.select(); openStatus(); };

  document.querySelectorAll(".btn-back").forEach(function (b) {
    b.onclick = function () { Sound.select(); openMenu(); };
  });
  $("#battle-quit").onclick = function () {
    if (confirm("クエストを ちゅうだんして マップに もどりますか？\n（かくとくした EXPは のこります）")) openMenu();
  };
  $("#battle-continue").onclick = nextTurn;
  $("#battle-msg").onclick = finishType;
  $("#result-next").onclick = function () { Sound.select(); openMenu(); };
  $("#result-retry").onclick = retryBattle;
  $("#btn-mute").onclick = function () { Sound.toggleMute(); updateMuteButton(); };
  $("#btn-reset").onclick = resetData;

  show("screen-title");
});
