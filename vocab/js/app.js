/* =========================================================
 * MOS Vocabulary Cards - アプリ本体
 * ========================================================= */

var STORAGE_KEY = "mosVocabProgress_v1";
var CAT_LABEL = { common: "きょうつう", excel: "Excel", word: "Word" };

var progress = loadProgress();
var state = {
  category: "all",
  reverse: false,
  deck: [],
  index: 0,
  fcKnownThisRound: 0,
  fcAgainThisRound: 0,
  quizQuestions: [],
  quizIndex: 0,
  quizScore: 0,
  quizMissed: []
};

/* ---------- storage ---------- */
function loadProgress() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
  catch (e) { return {}; }
}
function saveProgress() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}
function markWord(id, known) {
  progress[id] = { known: known };
  saveProgress();
}

/* ---------- helpers ---------- */
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}
function toRuby(word) {
  if (/[一-龯]/.test(word.jp)) {
    return "<ruby>" + escapeHtml(word.jp) + "<rt>" + escapeHtml(word.reading) + "</rt></ruby>";
  }
  return escapeHtml(word.jp);
}
function shuffle(arr) {
  var a = arr.slice();
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}
function wordsByCategory(cat) {
  if (cat === "all") return VOCAB_WORDS.slice();
  if (cat === "review") return VOCAB_WORDS.filter(function (w) { return !progress[w.id] || !progress[w.id].known; });
  return VOCAB_WORDS.filter(function (w) { return w.category === cat; });
}
function knownCount(list) {
  return list.filter(function (w) { return progress[w.id] && progress[w.id].known; }).length;
}
function showScreen(id) {
  document.querySelectorAll(".screen").forEach(function (el) { el.classList.remove("active"); });
  document.getElementById(id).classList.add("active");
}

/* ---------- home screen ---------- */
function renderHome() {
  var all = VOCAB_WORDS;
  document.getElementById("stat-total").textContent = knownCount(all) + " / " + all.length;
  var pct = Math.round((knownCount(all) / all.length) * 100);
  document.getElementById("stat-bar-fill").style.width = pct + "%";

  var counts = {
    all: all.length,
    common: wordsByCategory("common").length,
    excel: wordsByCategory("excel").length,
    word: wordsByCategory("word").length,
    review: wordsByCategory("review").length
  };
  document.getElementById("count-all").textContent = counts.all;
  document.getElementById("count-common").textContent = counts.common;
  document.getElementById("count-excel").textContent = counts.excel;
  document.getElementById("count-word").textContent = counts.word;
  document.getElementById("count-review").textContent = counts.review;

  document.querySelectorAll(".cat-btn").forEach(function (btn) {
    btn.classList.toggle("active", btn.dataset.cat === state.category);
  });
}

document.querySelectorAll(".cat-btn").forEach(function (btn) {
  btn.addEventListener("click", function () {
    state.category = btn.dataset.cat;
    renderHome();
  });
});
document.getElementById("reverse-mode").addEventListener("change", function (e) {
  state.reverse = e.target.checked;
});
document.getElementById("reset-progress").addEventListener("click", function () {
  if (confirm("これまでの学習の記録（おぼえた・もう一度）を全部消しますか？")) {
    progress = {};
    saveProgress();
    renderHome();
  }
});
document.querySelectorAll(".btn-back").forEach(function (btn) {
  btn.addEventListener("click", function () {
    showScreen(btn.dataset.target);
    renderHome();
  });
});

/* ---------- flashcard mode ---------- */
document.getElementById("start-flashcard").addEventListener("click", function () {
  var pool = wordsByCategory(state.category);
  if (pool.length === 0) { alert("このカテゴリーには単語がありません。"); return; }
  state.deck = shuffle(pool);
  state.index = 0;
  state.fcKnownThisRound = 0;
  state.fcAgainThisRound = 0;
  showScreen("screen-flashcard");
  renderFlashcard();
});

function renderFlashcard() {
  var card = document.getElementById("flashcard");
  card.classList.remove("flipped");
  document.getElementById("fc-actions").classList.add("hidden");

  var w = state.deck[state.index];
  document.getElementById("fc-progress").textContent = (state.index + 1) + " / " + state.deck.length;
  document.getElementById("fc-cat-chip").textContent = CAT_LABEL[w.category] || w.category;
  document.getElementById("fc-cat-chip").className = "cat-chip cat-" + w.category;
  document.getElementById("fc-term").innerHTML = toRuby(w);
  document.getElementById("fc-en").textContent = w.en;
  document.getElementById("fc-desc").textContent = w.desc;
}

document.getElementById("flashcard").addEventListener("click", function () {
  var card = document.getElementById("flashcard");
  var willFlip = !card.classList.contains("flipped");
  card.classList.toggle("flipped");
  if (willFlip) document.getElementById("fc-actions").classList.remove("hidden");
});

function fcAdvance(known) {
  var w = state.deck[state.index];
  markWord(w.id, known);
  if (known) state.fcKnownThisRound++; else state.fcAgainThisRound++;
  if (state.index < state.deck.length - 1) {
    state.index++;
    renderFlashcard();
  } else {
    showFlashcardResult();
  }
}
document.getElementById("fc-known").addEventListener("click", function () { fcAdvance(true); });
document.getElementById("fc-again").addEventListener("click", function () { fcAdvance(false); });

function showFlashcardResult() {
  showScreen("screen-result");
  document.getElementById("result-body").innerHTML =
    "<p class='result-big'>✅ おぼえた: " + state.fcKnownThisRound + " 語</p>" +
    "<p class='result-big'>❓ もう一度: " + state.fcAgainThisRound + " 語</p>" +
    "<p class='note'>「もう一度」にした単語は、ホーム画面の「復習」カテゴリーでいつでも挑戦できます。</p>";
}

/* ---------- quiz mode ---------- */
document.getElementById("start-quiz").addEventListener("click", function () {
  var pool = wordsByCategory(state.category);
  if (pool.length === 0) { alert("このカテゴリーには単語がありません。"); return; }
  var count = Math.min(20, pool.length);
  var deck = shuffle(pool).slice(0, count);
  state.quizQuestions = deck.map(buildQuizQuestion);
  state.quizIndex = 0;
  state.quizScore = 0;
  state.quizMissed = [];
  showScreen("screen-quiz");
  renderQuiz();
});

function buildQuizQuestion(word) {
  var pool = wordsByCategory(word.category);
  var candidates = pool.filter(function (w) { return w.id !== word.id && w.en !== word.en; });
  if (candidates.length < 3) {
    var extra = VOCAB_WORDS.filter(function (w) {
      return w.id !== word.id && w.en !== word.en && candidates.indexOf(w) === -1;
    });
    candidates = candidates.concat(extra);
  }
  var distractors = shuffle(candidates).slice(0, 3);
  var options = shuffle([word].concat(distractors));
  return { word: word, options: options, reverse: state.reverse };
}

function renderQuiz() {
  var q = state.quizQuestions[state.quizIndex];
  document.getElementById("quiz-progress").textContent = (state.quizIndex + 1) + " / " + state.quizQuestions.length;
  document.getElementById("quiz-score").textContent = "せいかい " + state.quizScore;
  document.getElementById("quiz-explain").classList.add("hidden");
  document.getElementById("quiz-next").classList.add("hidden");

  var qEl = document.getElementById("quiz-question");
  if (q.reverse) {
    qEl.innerHTML = "<span class='cat-chip cat-" + q.word.category + "'>" + (CAT_LABEL[q.word.category] || q.word.category) + "</span>" +
      "<div class='quiz-term'>" + escapeHtml(q.word.en) + "</div>" +
      "<p class='quiz-instruction'>意味が合う日本語はどれ？</p>";
  } else {
    qEl.innerHTML = "<span class='cat-chip cat-" + q.word.category + "'>" + (CAT_LABEL[q.word.category] || q.word.category) + "</span>" +
      "<div class='quiz-term'>" + toRuby(q.word) + "</div>" +
      "<p class='quiz-instruction'>意味が合う英語はどれ？</p>";
  }

  var choicesEl = document.getElementById("quiz-choices");
  choicesEl.innerHTML = "";
  q.options.forEach(function (opt, i) {
    var btn = document.createElement("button");
    btn.className = "btn quiz-choice";
    btn.innerHTML = q.reverse ? toRuby(opt) : escapeHtml(opt.en);
    btn.addEventListener("click", function () { answerQuiz(opt, btn); });
    choicesEl.appendChild(btn);
  });
}

function answerQuiz(chosen, btnEl) {
  var q = state.quizQuestions[state.quizIndex];
  var correct = chosen.id === q.word.id;
  var choiceButtons = document.querySelectorAll(".quiz-choice");
  choiceButtons.forEach(function (b) { b.disabled = true; });
  q.options.forEach(function (opt, i) {
    if (opt.id === q.word.id) choiceButtons[i].classList.add("correct");
  });
  if (!correct) btnEl.classList.add("wrong");

  markWord(q.word.id, correct);
  if (correct) state.quizScore++;
  else state.quizMissed.push(q.word);
  document.getElementById("quiz-score").textContent = "せいかい " + state.quizScore;

  var explainEl = document.getElementById("quiz-explain");
  explainEl.classList.remove("hidden");
  explainEl.innerHTML =
    "<p class='explain-term'>" + toRuby(q.word) + " = " + escapeHtml(q.word.en) + "</p>" +
    "<p class='explain-desc'>" + escapeHtml(q.word.desc) + "</p>";

  document.getElementById("quiz-next").classList.remove("hidden");
}

document.getElementById("quiz-next").addEventListener("click", function () {
  if (state.quizIndex < state.quizQuestions.length - 1) {
    state.quizIndex++;
    renderQuiz();
  } else {
    showQuizResult();
  }
});

function showQuizResult() {
  showScreen("screen-result");
  var total = state.quizQuestions.length;
  var missedHtml = "";
  if (state.quizMissed.length > 0) {
    missedHtml = "<h3>まちがえた単語</h3><ul class='missed-list'>" +
      state.quizMissed.map(function (w) {
        return "<li>" + toRuby(w) + " = " + escapeHtml(w.en) + "</li>";
      }).join("") + "</ul>";
  }
  document.getElementById("result-body").innerHTML =
    "<p class='result-big'>スコア: " + state.quizScore + " / " + total + "</p>" +
    missedHtml +
    "<p class='note'>まちがえた単語は「復習」カテゴリーで、もう一度チャレンジできます。</p>";
}

document.getElementById("result-home").addEventListener("click", function () {
  showScreen("screen-home");
  renderHome();
});

/* ---------- init ---------- */
renderHome();
