/* =========================================================
 * MOS QUEST サウンドエンジン（WebAudio チップチューン）
 * 音源ファイル不要・すべてコードで生成するレトロ効果音
 * ========================================================= */

var Sound = (function () {
  var ctx = null;
  var muted = localStorage.getItem("mosquest_mute") === "1";

  function ensureCtx() {
    if (!ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  /* notes: [[周波数Hz, 長さms], ...]  周波数0は休符 */
  function playSeq(notes, type, vol) {
    if (muted) return;
    var c = ensureCtx();
    if (!c) return;
    var t = c.currentTime;
    notes.forEach(function (n) {
      var freq = n[0], dur = n[1] / 1000;
      if (freq > 0) {
        var osc = c.createOscillator();
        var g = c.createGain();
        osc.type = type || "square";
        osc.frequency.value = freq;
        g.gain.setValueAtTime(vol || 0.08, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        osc.connect(g).connect(c.destination);
        osc.start(t);
        osc.stop(t + dur);
      }
      t += dur;
    });
  }

  return {
    select:  function () { playSeq([[880, 60]]); },
    correct: function () { playSeq([[523, 90], [659, 90], [784, 90], [1047, 160]]); },
    wrong:   function () { playSeq([[220, 140], [180, 220]], "sawtooth", 0.06); },
    attack:  function () { playSeq([[980, 40], [1400, 40], [700, 60]], "triangle", 0.1); },
    zap:     function () { playSeq([[1800, 40], [1200, 40], [2000, 40], [700, 100]], "sawtooth", 0.05); },
    fireball:function () { playSeq([[160, 80], [220, 80], [300, 100], [130, 180]], "sawtooth", 0.09); },
    levelup: function () { playSeq([[523, 110], [659, 110], [784, 110], [1047, 110], [784, 90], [1047, 320]]); },
    clear:   function () { playSeq([[659, 120], [659, 120], [659, 120], [523, 120], [659, 120], [784, 350]]); },
    boss:    function () { playSeq([[110, 200], [104, 200], [98, 350]], "sawtooth", 0.09); },
    fail:    function () { playSeq([[392, 200], [370, 200], [349, 200], [330, 450]], "triangle", 0.08); },
    heal:    function () { playSeq([[784, 80], [988, 80], [1175, 200]], "sine", 0.09); },
    chest:   function () { playSeq([[440, 70], [660, 70], [880, 70], [1175, 90], [1568, 220]], "square", 0.09); },

    toggleMute: function () {
      muted = !muted;
      localStorage.setItem("mosquest_mute", muted ? "1" : "0");
      return muted;
    },
    isMuted: function () { return muted; }
  };
})();
