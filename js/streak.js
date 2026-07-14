/* =========================================================
 * MOS QUEST ログインストリーク
 * まいにち ひらくと れんぞくきろくが のびる。とぎれても
 * 責めるメッセージは出さず、さいちょう記録はずっと残る。
 * ========================================================= */

var Streak = (function () {
  function pad(n) { return n < 10 ? "0" + n : "" + n; }
  function todayStr() {
    var d = new Date();
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }
  function daysBetween(a, b) {
    var da = new Date(a + "T00:00:00"), db = new Date(b + "T00:00:00");
    return Math.round((db - da) / 86400000);
  }

  /* アプリ起動時に1回だけ呼ぶ。同じ日に何度開いても2回目以降は isNewDay:false を返す。 */
  function checkLogin(save) {
    var today = todayStr();
    var st = save.streak;
    if (st.lastLoginDate === today) return { isNewDay: false, streak: st.current, longest: st.longest };

    var diff = st.lastLoginDate ? daysBetween(st.lastLoginDate, today) : null;
    var broken = false;
    if (diff === 1) {
      st.current += 1;
    } else if (diff === null) {
      st.current = 1;
    } else {
      st.current = 1;
      broken = diff > 1;   /* diff<=0（時計のずれ等）はリセット扱いにするがbrokenとは言わない */
    }
    if (st.current > st.longest) st.longest = st.current;
    st.lastLoginDate = today;
    return { isNewDay: true, streak: st.current, longest: st.longest, broken: broken };
  }

  return { checkLogin: checkLogin, todayStr: todayStr };
})();
