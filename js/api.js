/* =========================================================
 * MOS QUEST ランキング同期API（Google Apps Script 連携）
 *
 * GAME_CONFIG.SYNC_URL が未設定なら何もしない（オフラインでも遊べる）。
 * GAS側のコードは リポジトリの gas/mos_quest_leaderboard.gs を参照。
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
      body: JSON.stringify({ action: "sync", player: payload })
    })
      .then(function (res) { return res.json(); })
      .then(function () { if (onDone) onDone(true); })
      .catch(function () { if (onDone) onDone(false); });
  }

  /* ランキング一覧を取得 */
  function getRanking(onDone) {
    if (!enabled()) { onDone(null); return; }
    fetch(GAME_CONFIG.SYNC_URL + "?action=ranking&limit=" + (GAME_CONFIG.RANKING_LIMIT || 30))
      .then(function (res) { return res.json(); })
      .then(function (data) { onDone(data && data.ok ? data.ranking : null); })
      .catch(function () { onDone(null); });
  }

  return { enabled: enabled, syncProfile: syncProfile, getRanking: getRanking };
})();
