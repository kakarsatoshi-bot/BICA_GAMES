/* =========================================================
 * MOS QUEST 成績送信API（Google Apps Script 連携）
 *
 * GAME_CONFIG.SYNC_URL が未設定なら何もしない（オフラインでも遊べる）。
 * GAS側のコードは リポジトリの gas/mos_quest_backend.gs を参照。
 *
 * 成績の送信（sync）・ご意見箱（feedback）・じっせん道場の採点（gradePractical）は
 * 送信専用（write-only）。ランキング（getRanking）だけは、なまえ・クラス・レベル等を
 * まとめて返す read API（先生が「ゲーム内にランキングを出したい」と選んだ場合のみ有効）。
 * 詳しくは game/README.md の「セキュリティについて」を参照。
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

  /* クラス全員のランキングを取得する（read API）。
   * onDone(null) は「未設定」または「通信エラー」を表す。 */
  function getRanking(onDone) {
    if (!enabled()) { if (onDone) onDone(null); return; }
    fetch(GAME_CONFIG.SYNC_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "getRanking", apiKey: GAME_CONFIG.API_KEY || "" })
    })
      .then(function (res) { return res.json(); })
      .then(function (data) { if (onDone) onDone(data && data.ok ? data.ranking : null); })
      .catch(function () { if (onDone) onDone(null); });
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

  return { enabled: enabled, syncProfile: syncProfile, getRanking: getRanking, sendFeedback: sendFeedback, gradePractical: gradePractical };
})();
