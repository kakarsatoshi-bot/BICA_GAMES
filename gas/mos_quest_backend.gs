/**
 * MOS QUEST バックエンド（Google Apps Script）
 *
 * これをGoogleスプレッドシートのApps Scriptエディタに丸ごと貼り付けて使う。
 * doPost() が action の値で処理を振り分ける、単一のウェブアプリとして動作する。
 *   action: "sync"          … 生徒の成績をPlayersシートへ書き込む（write-only）
 *   action: "feedback"      … ご意見箱への投稿をご意見箱シートへ書き込む（write-only）
 *   action: "gradePractical"… じっせん道場：アップロードされたxlsxを採点する
 *
 * ▼ 事前準備（1回だけ）
 * 1. このスクリプトを貼り付けたら、左メニューの「サービス」（＋アイコン）から
 *    「Drive API」（Advanced Google Services）を追加する。
 * 2. プロジェクトの設定→スクリプト プロパティに API_KEY を設定する
 *    （game/js/config.js の API_KEY とまったく同じ文字列にすること）。
 * 3. じっせん道場を使う場合は、各課題の「正解ファイル」を自分のGoogle Driveに
 *    アップロードしてから、下の setupAnswerKey_P1() などを1回だけ実行する
 *    （詳しい手順はREADMEを参照）。
 *
 * ⚠️ Drive Advanced Service はAPIバージョンによって呼び出し方が変わることがある。
 *    Drive.Files.create() まわりでエラーが出る場合は、Apps Script公式リファレンス
 *    （Drive API Advanced Service）の最新の書き方に合わせて調整すること。
 */

var SHEET_PLAYERS = "Players";
var SHEET_FEEDBACK = "ご意見箱";
var SHEET_PRACTICAL = "Practical";

/* ---------- エントリーポイント ---------- */
function doPost(e) {
  var body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonResponse({ ok: false, error: "invalid JSON" });
  }

  if (!checkApiKey(body.apiKey)) {
    return jsonResponse({ ok: false, error: "invalid API key" });
  }

  switch (body.action) {
    case "sync": return handleSync(body.player);
    case "feedback": return handleFeedback(body.feedback);
    case "gradePractical": return handleGradePractical(body.practical);
    default: return jsonResponse({ ok: false, error: "unknown action" });
  }
}

function checkApiKey(key) {
  var expected = PropertiesService.getScriptProperties().getProperty("API_KEY");
  return !!expected && key === expected;
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function getOrCreateSheet(name, headerRow) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headerRow);
    sheet.getRange(1, 1, 1, headerRow.length).setFontWeight("bold");
  }
  return sheet;
}

/* =========================================================
 * 成績送信（sync） — js/api.js の syncProfile() から呼ばれる
 * ======================================================= */
function handleSync(player) {
  if (!player || !player.id) return jsonResponse({ ok: false, error: "missing player" });

  var header = [
    "id", "name", "klass", "level", "xp", "rank", "stars", "questsCleared",
    "answered", "correct", "accuracy", "bossWins", "finalClear", "examExcel", "examWord", "updatedAt"
  ];
  var sheet = getOrCreateSheet(SHEET_PLAYERS, header);

  var data = sheet.getDataRange().getValues();
  var rowIndex = -1;
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === player.id) { rowIndex = i + 1; break; }
  }

  var row = [
    player.id, player.name, player.klass, player.level, player.xp, player.rank,
    player.stars, player.questsCleared, player.answered, player.correct, player.accuracy,
    player.bossWins, player.finalClear, player.examExcel, player.examWord, new Date()
  ];

  if (rowIndex > 0) {
    sheet.getRange(rowIndex, 1, 1, row.length).setValues([row]);
  } else {
    sheet.appendRow(row);
  }
  return jsonResponse({ ok: true });
}

/* =========================================================
 * ご意見箱（feedback） — js/api.js の sendFeedback() から呼ばれる
 * ======================================================= */
function handleFeedback(fb) {
  if (!fb) return jsonResponse({ ok: false, error: "missing feedback" });
  var sheet = getOrCreateSheet(SHEET_FEEDBACK, ["受信日時", "なまえ", "クラス", "内容", "送った画面"]);
  sheet.appendRow([new Date(), fb.name || "", fb.klass || "", fb.text || "", fb.place || ""]);
  return jsonResponse({ ok: true });
}

/* =========================================================
 * じっせん道場（gradePractical） — js/api.js の gradePractical() から呼ばれる
 * ======================================================= */

/* 採点対象セルの定義（あくまで「どのセルを見るか」という設問メタ情報であり、
 * 正解の値そのものはここには書かない。正解の値は setupAnswerKey() で変換した
 * 正解シート側にだけ存在し、そのシートIDだけをスクリプトプロパティに保持する）。
 * 課題を追加するときは js/questions_excel_practical.js の PRACTICAL_TASKS と
 * あわせてここにも1エントリー追加すること。 */
var PRACTICAL_ANSWER_SPECS = {
  "P1": { cells: [{ ref: "D2" }, { ref: "D3" }, { ref: "D4" }, { ref: "D6" }], passRatio: 0.7 },
  "P2": { cells: [{ ref: "C2" }, { ref: "C3" }, { ref: "C4" }], passRatio: 0.7 },
  "P3": { cells: [{ ref: "C8", tolerance: 0.01 }, { ref: "C9" }], passRatio: 0.7 }
};

function handleGradePractical(practical) {
  if (!practical || !practical.practicalId || !practical.fileBase64) {
    return jsonResponse({ ok: false, error: "missing fields" });
  }
  var spec = PRACTICAL_ANSWER_SPECS[practical.practicalId];
  if (!spec) return jsonResponse({ ok: false, error: "unknown practicalId" });

  var answerKeyId = PropertiesService.getScriptProperties().getProperty("ANSWERKEY_" + practical.practicalId);
  if (!answerKeyId) return jsonResponse({ ok: false, error: "answer key is not set up yet (run setupAnswerKey first)" });

  var tempId = null;
  try {
    var tempName = "tmp_" + practical.practicalId + "_" + (practical.studentId || "anon") + "_" + new Date().getTime();
    tempId = convertXlsxBase64ToSheet(practical.fileBase64, tempName);

    var studentSheet = SpreadsheetApp.openById(tempId).getSheets()[0];
    var answerSheet = SpreadsheetApp.openById(answerKeyId).getSheets()[0];

    var correct = 0;
    spec.cells.forEach(function (c) {
      var studentVal = studentSheet.getRange(c.ref).getValue();
      var answerVal = answerSheet.getRange(c.ref).getValue();
      if (valuesMatch(studentVal, answerVal, c.tolerance || 0)) correct++;
    });

    var maxScore = spec.cells.length;
    var score = correct;
    var pass = (score / maxScore) >= spec.passRatio;

    logPracticalResult(practical, score, maxScore, pass);

    return jsonResponse({ ok: true, score: score, maxScore: maxScore, pass: pass });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err) });
  } finally {
    /* 生徒の提出データはプライバシー・Drive容量の両面から必ず消す。
     * setTrashed()は基本のDriveAppサービスなのでバージョン差異の心配がない。 */
    if (tempId) {
      try { DriveApp.getFileById(tempId).setTrashed(true); } catch (cleanupErr) { /* すでに無い場合は無視 */ }
    }
  }
}

function valuesMatch(a, b, tolerance) {
  if (typeof a === "number" && typeof b === "number") {
    return Math.abs(a - b) <= (tolerance || 0);
  }
  return String(a) === String(b);
}

function logPracticalResult(practical, score, maxScore, pass) {
  var sheet = getOrCreateSheet(SHEET_PRACTICAL,
    ["日時", "生徒ID", "なまえ", "クラス", "課題ID", "ファイル名", "スコア", "満点", "合格"]);
  sheet.appendRow([
    new Date(), practical.studentId || "", practical.name || "", practical.klass || "",
    practical.practicalId, practical.filename || "", score, maxScore, pass ? "○" : "×"
  ]);
}

/* ---------- xlsx → Googleスプレッドシート変換 ---------- */

/* Base64文字列（生徒がアップロードしたxlsxの中身）を一時的にGoogleスプレッドシートへ
 * 変換し、変換後のファイルIDを返す。 */
function convertXlsxBase64ToSheet(base64, newName) {
  var bytes = Utilities.base64Decode(base64);
  var blob = Utilities.newBlob(
    bytes,
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    newName + ".xlsx"
  );
  var resource = { name: newName, mimeType: MimeType.GOOGLE_SHEETS };
  var converted = Drive.Files.create(resource, blob);
  return converted.id;
}

/* 既にDriveに置いてある正解ファイル（xlsx、ファイルID指定）をGoogleスプレッドシートへ
 * 変換し、変換後のファイルIDを返す。 */
function convertExistingXlsxToSheet(driveFileId, newName) {
  var blob = DriveApp.getFileById(driveFileId).getBlob();
  var resource = { name: newName, mimeType: MimeType.GOOGLE_SHEETS };
  var converted = Drive.Files.create(resource, blob);
  return converted.id;
}

/* ---------- 正解ファイルの事前セットアップ（先生がApps Scriptエディタから手動で1回だけ実行） ----------
 * 1. 正解ファイル（xlsx）を自分のGoogle Driveにアップロードする
 * 2. アップロードしたファイルを開き、URLの中の「/d/【ここ】/edit」のIDをコピーする
 * 3. 下の関数の "ここに正解ファイルのDriveファイルIDを貼る" を書きかえて、
 *    エディタの実行対象に選んで実行する（1課題につき1回でOK。実行するたびに
 *    「AnswerKey_P1」のような名前の変換ずみシートが新規作成され、そのIDが
 *    スクリプトプロパティ ANSWERKEY_P1 として保存される）。
 * 4. 実行ログ（表示→ログ）に変換後のファイルIDが出力されるので、正しく
 *    保存されたか確認できる。
 */
function setupAnswerKey_P1() { setupAnswerKey("P1", "ここに正解ファイルのDriveファイルIDを貼る"); }
function setupAnswerKey_P2() { setupAnswerKey("P2", "ここに正解ファイルのDriveファイルIDを貼る"); }
function setupAnswerKey_P3() { setupAnswerKey("P3", "ここに正解ファイルのDriveファイルIDを貼る"); }

function setupAnswerKey(practicalId, driveFileId) {
  var convertedId = convertExistingXlsxToSheet(driveFileId, "AnswerKey_" + practicalId);
  PropertiesService.getScriptProperties().setProperty("ANSWERKEY_" + practicalId, convertedId);
  Logger.log(practicalId + " -> " + convertedId);
}
