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
    player: { id: uid(), name: name, klass: klass, createdAt: Date.now() },
    xp: 0,
    records: {},   // qid -> SRS記録
    quests: {},    // questId -> {stars, clears, bossWins}
    stats: { answered: 0, correct: 0, bossWins: 0, bestCombo: 0 },
    finalClear: false
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
    finalClear: save.finalClear ? 1 : 0
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

/* クエスト（通常）開始 */
function startQuest(quest) {
  var qs = shuffle(quest.questions);
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
  var due = SRS.dueList(save.records).slice(0, 10);
  var label = "ふっかつのほこら（復習）";
  if (due.length === 0) {
    var weak = SRS.weakList(save.records).slice(0, 8);
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

/* まおうの城（最終決戦）開始 */
function startFinal() {
  var pool = Object.keys(QUESTION_INDEX);
  var weak = SRS.weakList(save.records).slice(0, 6);
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

function beginBattle() {
  $("#battle-quest-name").textContent = battle.label;
  $("#battle-choices").innerHTML = "";
  $("#battle-continue").classList.add("hidden");
  $("#boss-hpbar").classList.add("hidden");
  show("screen-battle");
  showTurn();
}

function currentMonster() {
  if (battle.mode === "final") {
    return { shape: "demon", palette: "dark", name: "まおうデリート" };
  }
  if (battle.bossPhase) return battle.quest.boss;
  if (battle.mode === "review") {
    var mobs = ALL_QUESTS.map(function (q) { return q.mob; });
    return mobs[Math.floor(Math.random() * mobs.length)];
  }
  return battle.quest.mob;
}

function updateHud() {
  var h = "";
  for (var i = 0; i < battle.maxHearts; i++) h += i < battle.hearts ? "♥" : "♡";
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

  var m = currentMonster();
  battle.mob = m;
  var canvas = $("#enemy-canvas");
  var scale = (battle.bossPhase || battle.mode === "final") ? 12 : 9;
  drawSprite(canvas, m.shape, m.palette, scale);
  canvas.className = "spawn";
  $("#enemy-name").textContent = m.name;
  $("#battle-choices").innerHTML = "";
  $("#battle-continue").classList.add("hidden");
  updateHud();

  var intro;
  if (battle.mode === "final" && battle.idx === 0) {
    Sound.boss();
    intro = "じゃあくな けはいが みなぎる…！\n" + m.name + "が すがたを あらわした！！";
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

function answer(isCorrect, btn) {
  finishType();
  var q = battle.qs[battle.idx];
  document.querySelectorAll(".choice").forEach(function (b) { b.disabled = true; });
  btn.classList.add(isCorrect ? "picked-right" : "picked-wrong");

  SRS.record(save.records, q.id, isCorrect);
  save.stats.answered++;

  var canvas = $("#enemy-canvas");
  var msg;

  if (isCorrect) {
    save.stats.correct++;
    battle.correct++;
    battle.combo++;
    if (battle.combo > save.stats.bestCombo) save.stats.bestCombo = battle.combo;

    var gained = battle.mode === "review" ? 6 : 10;
    if (battle.bossPhase || battle.mode === "final") gained = 15;
    var comboBonus = Math.min((battle.combo - 1) * 2, 10);
    gained += comboBonus;
    battle.xp += gained;
    save.xp += gained;

    Sound.attack();
    setTimeout(function () { Sound.correct(); }, 180);
    canvas.className = "hit";

    if (battle.bossPhase || battle.mode === "final") {
      battle.bossHp--;
      battle.bossCorrect++;
      msg = "かいしんの いちげき！ ボスに ダメージ！\n＋" + gained + " EXP";
      if (battle.bossHp <= 0) {
        canvas.className = "die";
        msg = "とどめの いちげき！！ ボスを たおした！\n＋" + gained + " EXP";
      }
    } else {
      canvas.className = "die";
      msg = q.exp
        ? "せいかい！ " + battle.mob.name + "を たおした！ ＋" + gained + " EXP\n【まめちしき】" + q.exp
        : "せいかい！ ＋" + gained + " EXP";
      if (comboBonus > 0) msg = "れんぞく せいかい！ " + msg;
    }
  } else {
    battle.combo = 0;
    battle.hearts--;
    Sound.wrong();
    $("#screen-battle").classList.add("shake");
    setTimeout(function () { $("#screen-battle").classList.remove("shake"); }, 420);
    msg = "ミス！ こうげきを うけた…\nせいかいは 「" + q.c[q.a] + "」\n【かいせつ】" + q.exp;
  }

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
  if (battle.idx >= battle.qs.length) {
    // 最終決戦はボスを討伐しきれなければ失敗
    if (battle.mode === "final" && battle.bossHp > 0) { endBattle(false); return; }
    endBattle(true);
    return;
  }
  showTurn();
}

/* ---------- 結果 ---------- */
function endBattle(cleared) {
  var prevLevel = levelInfo(save.xp - battle.xp).level;
  var stars = 0;
  var bonus = 0;

  if (cleared) {
    var miss = battle.qs.length - battle.correct;
    stars = miss === 0 ? 3 : (miss <= 2 ? 2 : 1);
    bonus = battle.mode === "review" ? 15 : 30;
    if (stars === 3) bonus += 20;

    if (battle.mode === "quest") {
      var rec = save.quests[battle.quest.id] || { stars: 0, clears: 0, bossWins: 0 };
      rec.clears++;
      if (stars > rec.stars) rec.stars = stars;
      if (battle.bossCorrect >= 3) { rec.bossWins++; save.stats.bossWins++; }
      save.quests[battle.quest.id] = rec;
    }
    if (battle.mode === "final") {
      save.finalClear = true;
      save.stats.bossWins++;
      bonus = 100;
    }
    save.xp += bonus;
    battle.xp += bonus;
  }

  persist();
  syncNow();

  var newLi = levelInfo(save.xp);
  var title, sub;
  if (cleared) {
    Sound.clear();
    if (battle.mode === "final") {
      title = "まおうデリートを たおした！！";
      sub = "MOSの ちしきが せかいを すくった！\nきみこそ しんの MOSマスターだ！";
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
    "せいかい " + battle.correct + "/" + battle.qs.length +
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
  show("screen-result");
}

function retryBattle() {
  Sound.select();
  if (battle.mode === "quest") startQuest(battle.quest);
  else if (battle.mode === "review") startReview();
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
  $("#" + prefix + "-rank").textContent = rankFor(li.level);
  var fill = $("#" + prefix + "-xpfill");
  if (fill) fill.style.width = Math.floor(li.cur / li.need * 100) + "%";
  var xptext = $("#" + prefix + "-xptext");
  if (xptext) xptext.textContent = "EXP " + li.cur + " / " + li.need;
}

function openMenu() {
  renderPlayerHeader("menu");
  var due = SRS.dueList(save.records).length;
  var badge = $("#menu-review-badge");
  if (due > 0) { badge.textContent = due; badge.classList.remove("hidden"); }
  else badge.classList.add("hidden");

  var allCleared = clearedCount() >= ALL_QUESTS.length;
  var finalBtn = $("#menu-final");
  finalBtn.classList.toggle("locked", !allCleared);
  $("#menu-final-lock").textContent = allCleared
    ? (save.finalClear ? "とうばつずみ！ なんども ちょうせんできる" : "ふういんが とかれた…！")
    : "ぜんぶの クエストを クリアすると かいほう";

  show("screen-menu");
  syncNow();
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

/* =========================================================
 * ランキング
 * ======================================================= */
function openRanking() {
  show("screen-ranking");
  var box = $("#ranking-body");
  if (!Api.enabled()) {
    box.innerHTML = "";
    $("#ranking-note").textContent = "せんせいが ランキングを せっていすると ここに クラスの なかまが ひょうじされるよ！（いまは オフラインモード）";
    return;
  }
  $("#ranking-note").textContent = "つうしんちゅう…";
  box.innerHTML = "";
  syncNow();
  Api.getRanking(function (list) {
    if (!list) {
      $("#ranking-note").textContent = "つうしんに しっぱいした… でんぱの よいばしょで もういちど ためしてみよう。";
      return;
    }
    $("#ranking-note").textContent = "EXPが おおい じゅんの ぼうけんしゃ ランキング！";
    box.innerHTML = "";
    list.forEach(function (row, i) {
      var tr = document.createElement("tr");
      if (row.id === save.player.id) tr.className = "me";
      var medal = i === 0 ? "🏆" : (i === 1 ? "🥈" : (i === 2 ? "🥉" : (i + 1)));
      [medal, row.name, row.klass, "Lv" + row.level, row.xp + " EXP", "★" + row.stars]
        .forEach(function (val) {
          var td = document.createElement("td");
          td.textContent = val;
          tr.appendChild(td);
        });
      box.appendChild(tr);
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
    ["ふくしゅう まち", SRS.dueList(save.records).length + " もん"],
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
  show("screen-status");
}

function resetData() {
  if (!confirm("ぼうけんのしょを けしますか？\n（レベル・復習記録が すべて きえます）")) return;
  if (!confirm("ほんとうに よろしいですか？")) return;
  localStorage.removeItem(SAVE_KEY);
  location.reload();
}

/* =========================================================
 * 起動・登録
 * ======================================================= */
function startAdventure() {
  Sound.select();
  if (save) { openMenu(); return; }
  /* 登録画面のクラス選択肢を生成 */
  var sel = $("#register-class");
  sel.innerHTML = "";
  GAME_CONFIG.CLASSES.forEach(function (c) {
    var op = document.createElement("option");
    op.value = c; op.textContent = c;
    sel.appendChild(op);
  });
  show("screen-register");
  $("#register-name").focus();
}

function submitRegister() {
  var name = $("#register-name").value.trim();
  if (!name) { toast("なまえを いれてね！"); return; }
  if (name.length > 10) { toast("なまえは 10もじ いないで！"); return; }
  save = newSave(name, $("#register-class").value);
  persist();
  Sound.levelup();
  syncNow();
  openMenu();
}

function updateMuteButton() {
  $("#btn-mute").textContent = Sound.isMuted() ? "♪ OFF" : "♪ ON";
}

window.addEventListener("DOMContentLoaded", function () {
  save = loadSave();
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
  $("#register-name").addEventListener("keydown", function (e) {
    if (e.key === "Enter") submitRegister();
  });

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
