/* =========================================================
 * MOS QUEST じっせん道場（実データ差分採点）
 * 通常のバトルループ（タイプライター・コンボ・ハート等）とは
 * リズムがまったく違う（ダウンロード→実際に操作→アップロード→
 * 採点、で数分かかる）ため、あえて #screen-battle とは完全に
 * 切り離した独立画面として実装する。
 *
 * 採点は必ずサーバー側（GAS、js/api.js の Api.gradePractical）で行い、
 * このファイルは正解データを一切持たない。
 * ========================================================= */

var PRACTICAL_MAX_FILE_MB = 5;

function openPractical() {
  var box = $("#practical-list");
  box.innerHTML = "";

  PRACTICAL_TASKS.forEach(function (task) {
    var rec = save.practical[task.id];

    var card = document.createElement("div");
    card.className = "practical-card window";

    var title = document.createElement("div");
    title.className = "practical-title";
    title.textContent = task.title;

    var instructions = document.createElement("div");
    instructions.className = "practical-instructions";
    instructions.textContent = task.instructions;

    var status = document.createElement("div");
    status.className = "practical-status";
    status.textContent = rec
      ? (rec.passed ? "✅ ごうかく ずみ（さいこう " + rec.bestScore + "/" + rec.maxScore + "）" : "まだ ごうかくしていない（さいこう " + rec.bestScore + "/" + rec.maxScore + "）")
      : "まだ ちょうせんしていない";

    var dl = document.createElement("a");
    dl.className = "btn";
    dl.href = task.filePath;
    dl.setAttribute("download", task.fileName);
    dl.textContent = "📥 問題ファイルを ダウンロード";

    var fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = ".xlsx";
    fileInput.className = "practical-file-input";

    var submitBtn = document.createElement("button");
    submitBtn.className = "btn btn-big practical-submit";
    submitBtn.textContent = "かんせいした ファイルを ていしゅつする";

    var resultBox = document.createElement("div");
    resultBox.className = "practical-result hidden";

    submitBtn.onclick = function () {
      submitPractical(task, fileInput, submitBtn, resultBox, status);
    };

    card.appendChild(title);
    card.appendChild(instructions);
    card.appendChild(status);
    card.appendChild(dl);
    card.appendChild(fileInput);
    card.appendChild(submitBtn);
    card.appendChild(resultBox);
    box.appendChild(card);
  });

  show("screen-practical");
}

function submitPractical(task, fileInput, submitBtn, resultBox, statusEl) {
  var file = fileInput.files && fileInput.files[0];
  if (!file) { toast("ファイルを えらんでね！"); return; }
  if (!/\.xlsx$/i.test(file.name)) { toast(".xlsxファイルを えらんでね！"); return; }
  if (file.size > PRACTICAL_MAX_FILE_MB * 1024 * 1024) {
    toast("ファイルが おおきすぎるよ（" + PRACTICAL_MAX_FILE_MB + "MBまで）");
    return;
  }
  if (!Api.enabled()) {
    toast("せんせいが つうしんを せっていすると つかえるよ！");
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = "さいてん ちゅう…";
  Sound.select();

  var reader = new FileReader();
  reader.onload = function () {
    var base64 = String(reader.result).split(",")[1] || "";
    Api.gradePractical({
      practicalId: task.id,
      studentId: save.player.id,
      name: save.player.name,
      klass: save.player.klass,
      filename: file.name,
      fileBase64: base64
    }, function (result) {
      submitBtn.disabled = false;
      submitBtn.textContent = "かんせいした ファイルを ていしゅつする";
      handlePracticalResult(task, result, resultBox, statusEl);
    });
  };
  reader.onerror = function () {
    submitBtn.disabled = false;
    submitBtn.textContent = "かんせいした ファイルを ていしゅつする";
    toast("ファイルの よみこみに しっぱいした… もういちど ためしてね");
  };
  reader.readAsDataURL(file);
}

function handlePracticalResult(task, result, resultBox, statusEl) {
  resultBox.classList.remove("hidden");
  if (!result) {
    resultBox.textContent = "採点に しっぱいした… もういちど ためしてみてね（通信エラーの可能性があります）";
    return;
  }

  var prev = save.practical[task.id] || { bestScore: 0, maxScore: result.maxScore || 0, passed: false, tries: 0 };
  var firstPass = !!result.pass && !prev.passed;
  prev.tries++;
  if (result.score > prev.bestScore) prev.bestScore = result.score;
  prev.maxScore = result.maxScore;
  if (result.pass) prev.passed = true;
  save.practical[task.id] = prev;

  save.xp += task.expReward;
  var gained = task.expReward;
  if (firstPass) {
    save.xp += task.passBonusExp;
    gained += task.passBonusExp;
  }

  resultBox.textContent = (result.pass ? "🎉 ごうかく！ " : "あと すこし… ") +
    "スコア " + result.score + "/" + result.maxScore + "　＋" + gained + " EXP";
  statusEl.textContent = prev.passed
    ? "✅ ごうかく ずみ（さいこう " + prev.bestScore + "/" + prev.maxScore + "）"
    : "まだ ごうかくしていない（さいこう " + prev.bestScore + "/" + prev.maxScore + "）";

  Sound[result.pass ? "clear" : "wrong"]();

  var newAchievements = Achievements.check(save);
  persist();
  syncNow();
  if (newAchievements.length) showAchievementToasts(newAchievements);
}
