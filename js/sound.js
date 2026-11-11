/* =========================================================
 * MOS QUEST サウンドエンジン（WebAudio チップチューン）
 * 音源ファイル不要・すべてコードで生成するレトロ効果音とBGM。
 * 曲はすべてこのゲームのためのオリジナル（既存の曲の引用はしない）。
 *
 * 音のモード（右下のボタンで切りかえ）:
 *   "all" … 効果音＋BGM ／ "se" … 効果音だけ ／ "off" … 無音
 * ========================================================= */

var Sound = (function () {
  var ctx = null;
  var MUTE_KEY = "mosquest_mute";   // "1" = 効果音も止める（むかしからのキー）
  var BGM_KEY = "mosquest_bgm";     // "0" = BGMを止める
  var muted = store(MUTE_KEY) === "1";
  /* BGMを最初から流すか。既定は false（＝音楽は、右下のボタンを押した人だけに流れる）。
   * 教室では1台ずつ別々のタイミングで曲がくり返すので、全員に最初から流すと さわがしくなる。
   * 家で使う・全員がヘッドホン、という場合は true にしてよい。 */
  var BGM_DEFAULT_ON = false;
  var savedBgm = store(BGM_KEY);
  var bgmOn = savedBgm === null ? BGM_DEFAULT_ON : savedBgm !== "0";
  /* ブラウザは、画面を1回さわるまで音を鳴らせない。それまではBGMを予約だけしておく */
  var unlocked = false;

  var seGain = null, bgmGain = null, noiseBuf = null;

  function store(k, v) {
    try {
      if (v === undefined) return localStorage.getItem(k);
      localStorage.setItem(k, v);
    } catch (e) { /* 保存できない環境では既定のまま動く */ }
    return null;
  }

  function ensureCtx() {
    if (!ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try { ctx = new AC(); } catch (e) { ctx = null; return null; }   // 音が使えない端末でもゲームは止めない
      seGain = ctx.createGain(); seGain.gain.value = 1; seGain.connect(ctx.destination);
      bgmGain = ctx.createGain(); bgmGain.gain.value = 0.55; bgmGain.connect(ctx.destination);
      var len = ctx.sampleRate;
      noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      var data = noiseBuf.getChannelData(0);
      for (var i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === "suspended" && !document.hidden) ctx.resume();
    return ctx;
  }

  /* 1音を鳴らす（t=開始時刻） */
  function tone(dest, freq, t, dur, type, vol, slideTo) {
    var osc = ctx.createOscillator();
    var g = ctx.createGain();
    g.gain.value = 0;   // 予約した時刻が来るまで無音にしておく（出はじめの雑音を防ぐ）
    osc.type = type || "square";
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g).connect(dest);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  /* ノイズ（爆発・ドラム）。hp=ハイパスの周波数 */
  function noise(dest, t, dur, vol, hp) {
    var src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    var g = ctx.createGain();
    g.gain.value = 0;   // 同上。これが無いと、1サンプルだけ最大音量で鳴って「プチッ」と聞こえる
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    if (hp) {
      var f = ctx.createBiquadFilter();
      f.type = "highpass"; f.frequency.value = hp;
      src.connect(f).connect(g).connect(dest);
    } else {
      src.connect(g).connect(dest);
    }
    src.start(t, Math.random() * 0.5, dur + 0.02);
  }

  /* notes: [[周波数Hz, 長さms], ...]  周波数0は休符 */
  /* タブが隠れている間の効果音は鳴らさない（音の時計が止まっているので、
   * ためこまれて、もどった瞬間にまとめて鳴ってしまう） */
  function playSeq(notes, type, vol, delayMs) {
    if (muted || document.hidden) return;
    var c = ensureCtx();
    if (!c) return;
    var t = c.currentTime + (delayMs || 0) / 1000;
    notes.forEach(function (n) {
      var freq = n[0], dur = n[1] / 1000;
      if (freq > 0) tone(seGain, freq, t, dur, type, vol || 0.08);
      t += dur;
    });
  }
  function playNoise(dur, vol, hp, delayMs) {
    if (muted || document.hidden) return;
    var c = ensureCtx();
    if (!c) return;
    noise(seGain, c.currentTime + (delayMs || 0) / 1000, dur / 1000, vol, hp);
  }
  function sweep(f0, f1, ms, type, vol, delayMs) {
    if (muted || document.hidden) return;
    var c = ensureCtx();
    if (!c) return;
    tone(seGain, f0, c.currentTime + (delayMs || 0) / 1000, ms / 1000, type, vol, f1);
  }

  /* =======================================================
   * BGM（ステップシーケンサー）
   * 1小節=16ステップ。メロディは文字列で書く（"-"=のばす ／ "."=休み）。
   * ベースと分散和音は、小節ごとの和音から自動で作る。
   * ===================================================== */
  var NOTE_INDEX = { C: 0, "C#": 1, D: 2, "D#": 3, E: 4, F: 5, "F#": 6, G: 7, "G#": 8, A: 9, "A#": 10, B: 11 };
  function midi(name) {
    var m = /^([A-G]#?)(\d)$/.exec(name);
    return m ? NOTE_INDEX[m[1]] + (parseInt(m[2], 10) + 1) * 12 : null;
  }
  function hz(m) { return 440 * Math.pow(2, (m - 69) / 12); }

  /* 和音: [根音, "M"|"m"] */
  var THEMES = {
    /* マップ・タイトル：ゆったり明るい旅立ち（ハ長調） */
    menu: {
      bpm: 104, leadVol: 0.045, arpVol: 0.018, bassVol: 0.06, drumVol: 0.5,
      chords: [["C3", "M"], ["A2", "m"], ["F2", "M"], ["G2", "M"], ["C3", "M"], ["A2", "m"], ["F2", "M"], ["G2", "M"]],
      lead: [
        "E5 - G5 - C6 - - - B5 - G5 - E5 - G5 -",
        "A5 - - - E5 - C5 - D5 - E5 - A4 - - -",
        "F5 - A5 - C6 - - - A5 - F5 - A5 - C6 -",
        "D6 - - - B5 - G5 - A5 - B5 - D6 - - -",
        "E6 - - - C6 - G5 - E5 - G5 - C6 - - -",
        "C6 - A5 - E5 - A5 - C6 - B5 - A5 - - -",
        "A5 - - - F5 - A5 - G5 - F5 - E5 - D5 -",
        "G5 - - - D5 - G5 - B5 - - - G5 - . -"
      ],
      drums: "k . . . h . . . k . . . h . h .",
      bass: [0, 6, 8, 14]
    },
    /* 通常バトル：前のめりで軽快（イ短調） */
    battle: {
      bpm: 152, leadVol: 0.05, arpVol: 0.02, bassVol: 0.07, drumVol: 0.8,
      chords: [["A2", "m"], ["F2", "M"], ["G2", "M"], ["A2", "m"], ["A2", "m"], ["F2", "M"], ["G2", "M"], ["E2", "M"]],
      lead: [
        "A5 - A5 C6 - A5 - E5 - - A5 - C6 - E6 -",
        "F6 - - E6 - C6 - A5 - - C6 - A5 - F5 -",
        "G5 - G5 B5 - D6 - G6 - - F6 - D6 - B5 -",
        "C6 - - A5 - - E5 - A5 - - - . - - -",
        "E6 - E6 D6 - C6 - A5 - - C6 - D6 - E6 -",
        "F6 - - A6 - F6 - C6 - - F6 - E6 - C6 -",
        "D6 - D6 E6 - D6 - B5 - - G5 - B5 - D6 -",
        "E6 - - - G#5 - B5 - E6 - G#6 - B6 - - -"
      ],
      drums: "k . h . s . h . k k h . s . h h",
      bass: [0, 2, 4, 6, 8, 10, 12, 14]
    },
    /* ボス：重くて速い（ニ短調） */
    boss: {
      bpm: 168, leadVol: 0.05, arpVol: 0.022, bassVol: 0.08, drumVol: 0.9, leadType: "sawtooth",
      chords: [["D2", "m"], ["D2", "m"], ["A#1", "M"], ["C2", "M"], ["D2", "m"], ["D2", "m"], ["G2", "m"], ["A2", "M"]],
      lead: [
        "D5 - D5 - F5 - D5 - A5 - - G5 - F5 - E5",
        "D5 - D5 - F5 - A5 - D6 - - - C6 - A5 -",
        "A#5 - A#5 - D6 - A#5 - F6 - - D6 - A#5 - F5",
        "C6 - C6 - E6 - G6 - E6 - - C6 - G5 - E5",
        "D6 - - A5 - - F5 - D6 - - A5 - - F5 -",
        "D6 - E6 - F6 - E6 - D6 - A5 - F5 - A5 -",
        "G5 - A#5 - D6 - G6 - - - F6 - D6 - A#5 -",
        "A5 - C#6 - E6 - A6 - - - G6 - E6 - C#6 -"
      ],
      drums: "k . h k s . h . k k h k s . s s",
      bass: [0, 2, 3, 4, 6, 8, 10, 11, 12, 14]
    },
    /* むげんの めいきゅう：ふしぎで止まらない分散和音（ホ短調） */
    maze: {
      bpm: 136, leadVol: 0.045, arpVol: 0.016, bassVol: 0.07, drumVol: 0.7,
      chords: [["E2", "m"], ["C2", "M"], ["D2", "M"], ["B1", "M"], ["E2", "m"], ["C2", "M"], ["D2", "M"], ["B1", "M"]],
      lead: [
        "E5 - B5 - G5 - B5 - E6 - B5 - G5 - B5 -",
        "E5 - C6 - G5 - C6 - E6 - C6 - G5 - C6 -",
        "F#5 - D6 - A5 - D6 - F#6 - D6 - A5 - D6 -",
        "F#5 - B5 - D#6 - B5 - F#6 - - - D#6 - B5 -",
        "G6 - - - E6 - B5 - G5 - B5 - E6 - - -",
        "G6 - - - E6 - C6 - G5 - C6 - E6 - - -",
        "A6 - - - F#6 - D6 - A5 - D6 - F#6 - A6 -",
        "B6 - - - F#6 - D#6 - B5 - - - . - - -"
      ],
      drums: "k . h . . . h . k . h . s . h .",
      bass: [0, 4, 8, 10, 12]
    }
  };

  /* メロディの文字列を「どのステップで・どの高さを・何ステップ鳴らすか」に直す */
  function compile(theme) {
    if (theme.events) return;
    var ev = [];
    var step = 0;
    theme.lead.forEach(function (bar) {
      var toks = bar.split(" ");
      var cur = null;
      toks.forEach(function (tk) {
        if (tk === "-") { if (cur) cur.len++; }
        else if (tk === ".") { cur = null; }
        else { cur = { step: step, m: midi(tk), len: 1 }; ev.push(cur); }
        step++;
      });
    });
    theme.total = theme.lead.length * 16;
    theme.events = {};
    ev.forEach(function (e) { theme.events[e.step] = e; });
    theme.drumSteps = theme.drums.split(" ");
  }

  var bgm = { want: null, name: null, theme: null, step: 0, next: 0, timer: null, tempo: 1 };

  function scheduleStep(theme, step, t, stepDur) {
    var bar = (step / 16) | 0, s = step % 16;
    var chord = theme.chords[bar % theme.chords.length];
    var root = midi(chord[0]);
    var third = root + (chord[1] === "m" ? 3 : 4), fifth = root + 7;

    var e = theme.events[step];
    if (e) tone(bgmGain, hz(e.m), t, stepDur * e.len * 0.95, theme.leadType || "square", theme.leadVol);

    if (theme.bass.indexOf(s) >= 0) {
      var bn = (s === 8 || s === 10) ? fifth : root;
      tone(bgmGain, hz(bn), t, stepDur * 1.8, "triangle", theme.bassVol);
    }
    if (s % 2 === 0) {
      var arp = [root, third, fifth, third][(s / 2) % 4] + 24;
      tone(bgmGain, hz(arp), t, stepDur * 1.2, "square", theme.arpVol);
    }
    var d = theme.drumSteps[s];
    if (d === "k") tone(bgmGain, 150, t, 0.12, "sine", 0.16 * theme.drumVol, 45);
    else if (d === "s") noise(bgmGain, t, 0.11, 0.07 * theme.drumVol, 1400);
    else if (d === "h") noise(bgmGain, t, 0.035, 0.03 * theme.drumVol, 6000);
  }

  function bgmTick() {
    if (!ctx || !bgm.theme) return;
    var stepDur = 60 / (bgm.theme.bpm * bgm.tempo) / 4;
    if (bgm.next < ctx.currentTime) bgm.next = ctx.currentTime + 0.05;
    while (bgm.next < ctx.currentTime + 0.14) {
      scheduleStep(bgm.theme, bgm.step, bgm.next, stepDur);
      bgm.next += stepDur;
      bgm.step = (bgm.step + 1) % bgm.theme.total;
    }
  }

  function bgmStop() {
    clearInterval(bgm.timer);
    bgm.timer = null; bgm.name = null; bgm.theme = null;
  }
  function bgmStart() {
    if (!bgm.want || muted || !bgmOn || !unlocked) { bgmStop(); return; }
    if (bgm.name === bgm.want && bgm.timer) return;
    var c = ensureCtx();
    if (!c) return;
    var theme = THEMES[bgm.want];
    if (!theme) { bgmStop(); return; }
    compile(theme);
    clearInterval(bgm.timer);
    bgm.name = bgm.want; bgm.theme = theme; bgm.step = 0; bgm.next = c.currentTime + 0.08;
    bgmGain.gain.cancelScheduledValues(c.currentTime);
    bgmGain.gain.setValueAtTime(0.55, c.currentTime);
    bgm.timer = setInterval(bgmTick, 30);
  }
  /* 流したい曲を伝える（null で止める）。同じ曲なら流しっぱなし。
   * 速さ（setTempo）はここでは変えない：フィーバー中にボスの曲へ切りかわっても、速いままにするため。
   * もとの速さにもどすのは呼ぶ側（バトルの始まり・リザルト・メニュー）。 */
  function playBgm(name) {
    bgm.want = name || null;
    bgmStart();
  }
  /* 曲の速さ（フィーバー中は少し速くする） */
  function setTempo(mul) { bgm.tempo = mul || 1; }
  /* ジングルを鳴らすあいだ、BGMを少し下げる */
  function duck(ms) {
    if (!ctx || !bgmGain) return;
    var t = ctx.currentTime;
    bgmGain.gain.cancelScheduledValues(t);
    bgmGain.gain.setValueAtTime(0.12, t);
    bgmGain.gain.linearRampToValueAtTime(0.55, t + (ms || 1200) / 1000);
  }

  /* 最初の操作で音を出せるようにする。操作の種類によっては（Esc キーなど）ブラウザが
   * 「人の操作」と数えず、音が止まったままになるので、本当に鳴りはじめるまで聞きつづける */
  var UNLOCK_EVENTS = ["pointerdown", "pointerup", "touchend", "keydown", "click"];
  function unlock() {
    unlocked = true;
    if (!muted) ensureCtx();
    bgmStart();
    if (muted || !ctx || ctx.state === "running") {
      UNLOCK_EVENTS.forEach(function (ev) { document.removeEventListener(ev, unlock, true); });
    }
  }
  UNLOCK_EVENTS.forEach(function (ev) { document.addEventListener(ev, unlock, true); });

  document.addEventListener("visibilitychange", function () {
    if (!ctx) return;
    if (document.hidden) ctx.suspend(); else if (!muted) ctx.resume();
  });

  function mode() { return muted ? "off" : (bgmOn ? "all" : "se"); }

  return {
    select:  function () { playSeq([[880, 60]]); },
    correct: function () { playSeq([[523, 90], [659, 90], [784, 90], [1047, 160]]); },
    wrong:   function () { playSeq([[220, 140], [180, 220]], "sawtooth", 0.06); playNoise(180, 0.08, 300); },
    attack:  function () { playSeq([[980, 40], [1400, 40], [700, 60]], "triangle", 0.1); playNoise(70, 0.06, 2500); },
    zap:     function () { playSeq([[1800, 40], [1200, 40], [2000, 40], [700, 100]], "sawtooth", 0.05); playNoise(120, 0.05, 4000); },
    fireball:function () { playSeq([[160, 80], [220, 80], [300, 100], [130, 180]], "sawtooth", 0.09); playNoise(320, 0.09, 200); },
    ice:     function () { playSeq([[2093, 50], [1760, 50], [2637, 60], [3136, 140]], "triangle", 0.07); playNoise(160, 0.05, 5000, 120); },
    meteor:  function () { sweep(900, 90, 420, "sawtooth", 0.08); playNoise(260, 0.1, 150, 130); playNoise(260, 0.1, 150, 300); },
    levelup: function () { duck(1600); playSeq([[523, 110], [659, 110], [784, 110], [1047, 110], [784, 90], [1047, 320]]); },
    clear:   function () { duck(1400); playSeq([[659, 120], [659, 120], [659, 120], [523, 120], [659, 120], [784, 350]]); },
    boss:    function () { playSeq([[110, 200], [104, 200], [98, 350]], "sawtooth", 0.09); },
    fail:    function () { playSeq([[392, 200], [370, 200], [349, 200], [330, 450]], "triangle", 0.08); },
    heal:    function () { playSeq([[784, 80], [988, 80], [1175, 200]], "sine", 0.09); },
    chest:   function () { playSeq([[440, 70], [660, 70], [880, 70], [1175, 90], [1568, 220]], "square", 0.09); },

    /* ---- ここから新しい効果音 ---- */
    /* かいしんの いちげき */
    crit:    function () { playSeq([[1568, 50], [2093, 50], [2637, 60], [3136, 200]], "square", 0.08); playNoise(140, 0.1, 1800); },
    /* コンボ：つながるほど音が高くなる */
    combo:   function (n) {
      var f = 440 * Math.pow(2, Math.min(n, 14) / 12);
      playSeq([[f, 50], [f * 1.5, 90]], "square", 0.06, 300);
    },
    comboBreak: function () { sweep(600, 120, 260, "triangle", 0.07); },
    quick:   function () { playSeq([[1760, 40], [2349, 80]], "triangle", 0.07, 80); },
    gaugeMax:function () { playSeq([[523, 60], [784, 60], [1047, 60], [1568, 60], [2093, 200]], "square", 0.07); },
    special: function () {
      duck(1800);
      sweep(200, 1600, 480, "sawtooth", 0.07);
      playNoise(500, 0.14, 120, 860);
      playSeq([[1047, 70], [1319, 70], [1568, 70], [2093, 260]], "square", 0.09, 880);
    },
    boom:    function () { playNoise(300, 0.13, 100); sweep(160, 40, 280, "sine", 0.14); },
    warning: function () { playSeq([[740, 180], [520, 180], [740, 180], [520, 180], [740, 180], [520, 260]], "sawtooth", 0.05); },
    star:    function (i) { playSeq([[784 * Math.pow(1.19, i || 0), 60], [1568 * Math.pow(1.19, i || 0), 160]], "square", 0.08); },
    tick:    function () { playSeq([[1568, 22]], "square", 0.03); },
    fanfare: function () {
      duck(2400);
      playSeq([[523, 100], [523, 100], [523, 100], [659, 220], [587, 110], [659, 110], [784, 110], [1047, 480]], "square", 0.09);
      playSeq([[262, 320], [330, 220], [294, 110], [330, 110], [392, 110], [523, 480]], "triangle", 0.09);
    },
    banner:  function () { playSeq([[988, 70], [1319, 70], [1976, 180]], "triangle", 0.07); },
    heart:   function () { sweep(880, 220, 200, "square", 0.05); },
    shiny:   function () { playSeq([[2093, 60], [2637, 60], [3136, 60], [4186, 200]], "sine", 0.07); },
    encounter: function () { sweep(300, 1400, 180, "sawtooth", 0.05); sweep(300, 1400, 180, "sawtooth", 0.05, 200); },
    rattle:  function () { playNoise(60, 0.07, 2500); playNoise(60, 0.07, 2500, 130); playNoise(60, 0.07, 2500, 260); },
    newRecord: function () { duck(1600); playSeq([[784, 90], [988, 90], [1175, 90], [1568, 90], [1976, 90], [2349, 360]], "square", 0.08); },

    playBgm: playBgm,
    setTempo: setTempo,

    /* 右下のボタン：効果音だけ → 音楽＋効果音 → 無音 → 効果音だけ → … と切りかえる。
     * 既定は「効果音だけ」なので、1回押すと音楽が流れ、もう1回で無音になる */
    cycleMode: function () {
      var m = mode();
      if (m === "se") { bgmOn = true; }
      else if (m === "all") { muted = true; }
      else { muted = false; bgmOn = false; }
      store(MUTE_KEY, muted ? "1" : "0");
      store(BGM_KEY, bgmOn ? "1" : "0");
      if (ctx && !muted && !document.hidden) ctx.resume();
      bgmStart();
      return mode();
    },
    mode: mode,
    toggleMute: function () {
      muted = !muted;
      store(MUTE_KEY, muted ? "1" : "0");
      bgmStart();
      return muted;
    },
    isMuted: function () { return muted; },
    /* テスト用：曲データが1小節16ステップで書けているかを数える */
    _themes: THEMES
  };
})();
