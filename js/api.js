/* =========================================================
 * MOS QUEST 成績送信API（Google Apps Script 連携）
 *
 * GAME_CONFIG.SYNC_URL が未設定なら何もしない（オフラインでも遊べる）。
 * GAS側のコードは リポジトリの gas/mos_quest_leaderboard.gs を参照。
 *
 * 送信専用（write-only）。生徒全員の成績をまとめて読み取れるAPIは
 * 個人情報保護のため意図的に用意していない。ランキング（成績一覧）は
 * 先生がスプレッドシートを組織内限定で共有し、Classroom等で配布する運用にしている。
 * 詳しくは game/README.md を参照。
 *
 * CORSのプリフライトを避けるため text/plain でPOSTする（GASの定石）。
 * ========================================================= */

var Api = (function () {

  function enabled() {
    return !!(GAME_CONFIG.SYNC_URL && GAME_CONFIG.SYNC_URL.indexOf("http") === 0);
  }

  /* プレイヤーの成績をサーバーへ送信（結果を待たない fire-and-forget） */
  function syncProfile(payload, onDone) {
    if (!enabled()) { if (onDone) onDone(false); return; }
    fetch(GAME_CONFIG.SYNC_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "sync", apiKey: GAME_CONFIG.API_KEY || "", player: payload })
    })
      .then(function (res) { return res.json(); })
      .then(function () { if (onDone) onDone(true); })
      .catch(function () { if (onDone) onDone(false); });
  }

  /* ご意見箱の投稿を送信する（こちらも送信専用） */
  function sendFeedback(payload, onDone) {
    if (!enabled()) { if (onDone) onDone(false); return; }
    fetch(GAME_CONFIG.SYNC_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "feedback", apiKey: GAME_CONFIG.API_KEY || "", feedback: payload })
    })
      .then(function (res) { return res.json(); })
      .then(function (data) { if (onDone) onDone(!!(data && data.ok)); })
      .catch(function () { if (onDone) onDone(false); });
  }

  /* じっせん道場：アップロードされたファイル（Base64）をGAS側へ送って採点してもらう。
   * 正解データはサーバー側にしか存在しないため、結果（score/maxScore/pass）だけが返ってくる。
   * onDone(null) は「未設定」または「通信/採点エラー」のどちらかを表す。 */
  function gradePractical(payload, onDone) {
    if (!enabled()) { if (onDone) onDone(null); return; }
    fetch(GAME_CONFIG.SYNC_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "gradePractical", apiKey: GAME_CONFIG.API_KEY || "", practical: payload })
    })
      .then(function (res) { return res.json(); })
      .then(function (data) { if (onDone) onDone(data && data.ok ? data : null); })
      .catch(function () { if (onDone) onDone(null); });
  }

  return { enabled: enabled, syncProfile: syncProfile, sendFeedback: sendFeedback, gradePractical: gradePractical };
})();
