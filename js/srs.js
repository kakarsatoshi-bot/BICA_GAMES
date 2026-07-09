/* =========================================================
 * MOS QUEST 復習エンジン（間隔反復 / 忘却曲線対応）
 *
 * ライトナー方式：問題ごとに「ボックス0〜5」を持つ。
 *   せいかい → ボックスが1つ上がる（次の復習は先になる）
 *   まちがい → ボックス0にもどる（すぐ復習対象になる）
 * 復習間隔（日）: 0, 1, 3, 7, 14, 30
 * エビングハウスの忘却曲線に合わせて、忘れかけたころに再出題する。
 * ========================================================= */

var SRS = (function () {
  var INTERVALS_DAYS = [0, 1, 3, 7, 14, 30];
  var MAX_BOX = INTERVALS_DAYS.length - 1;
  var DAY_MS = 24 * 60 * 60 * 1000;

  /* 解答結果を記録に反映する。records[qid] = {box, due, right, wrong, last} */
  function record(records, qid, isCorrect) {
    var r = records[qid] || { box: 0, due: 0, right: 0, wrong: 0, last: 0 };
    var now = Date.now();
    if (isCorrect) {
      r.right++;
      r.box = Math.min(r.box + 1, MAX_BOX);
    } else {
      r.wrong++;
      r.box = 0;
    }
    r.last = now;
    r.due = now + INTERVALS_DAYS[r.box] * DAY_MS;
    records[qid] = r;
    return r;
  }

  /* いま復習すべき問題IDのリスト（期限が来ているもの。弱い順） */
  function dueList(records) {
    var now = Date.now();
    var list = [];
    for (var qid in records) {
      var r = records[qid];
      if (r.due <= now && r.box < MAX_BOX) list.push(qid);
    }
    list.sort(function (a, b) {
      var ra = records[a], rb = records[b];
      if (ra.box !== rb.box) return ra.box - rb.box; // 弱い(box小)ほうを先に
      return ra.due - rb.due;                        // 期限が古いほうを先に
    });
    return list;
  }

  /* まちがえたことのある問題IDのリスト（まちがい回数が多い順） */
  function weakList(records) {
    var list = [];
    for (var qid in records) {
      if (records[qid].wrong > 0) list.push(qid);
    }
    list.sort(function (a, b) {
      return (records[b].wrong - records[b].right) - (records[a].wrong - records[a].right);
    });
    return list;
  }

  /* 問題の習熟度（0〜5）。ステータス画面の表示用 */
  function mastery(records, qid) {
    var r = records[qid];
    return r ? r.box : -1; // -1 = 未挑戦
  }

  return {
    record: record,
    dueList: dueList,
    weakList: weakList,
    mastery: mastery,
    MAX_BOX: MAX_BOX,
    INTERVALS_DAYS: INTERVALS_DAYS
  };
})();
