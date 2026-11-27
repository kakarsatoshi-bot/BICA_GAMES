/* =========================================================
 * STUDY QUEST 日本語の読みやすい折り返し（js/jptext.js）
 * ふつうのブラウザは、日本語を どの文字のあいだでも折り返すので、
 * 「揃|え」「Ctrl|+E」のように、ことばの途中で次の行に行ってしまう。
 * ここでは、文節（ことばの まとまり）の切れ目に <wbr>（ここで折り返してよい印）を入れ、
 * CSS の word-break: keep-all（印と空白のところだけで折り返す）と組み合わせて、
 * ことばの途中で行が変わらないようにする。1行に入りきらない長いまとまりだけは、
 * overflow-wrap: anywhere で そのまとまりの中で折り返す（はみ出さない）。
 * <wbr> は見た目だけの印なので、textContent（文字の中身）は変わらない。
 *
 * 切れ目の決め方（かんたんな きまり）
 *   ・「、」「。」「）」「」」などの後ろ、「（」「「」「【」などの前
 *   ・空白（分かち書き）のところ
 *   ・ひらがなの後ろに、漢字・カタカナ・英数字・記号が来るところ（「タイトルの|配置で|よく|使う。」）
 *   ・漢字と カタカナの さかいめ（「関係|データベース」）
 *   ・英数字の まとまりの前後（ただし「Ctrl+E」「=SUM(A1)」などは1つの まとまりのまま）
 * ========================================================= */
var JpText = (function () {
  function cls(ch) {
    if (!ch) return "";
    var c = ch.charCodeAt(0);
    if (ch === " " || ch === "　" || ch === "\t") return "S";
    if (ch === "\n") return "N";
    if ("「『（【［〈《〔([“‘".indexOf(ch) >= 0) return "O";
    if ("」』）】］〉》〕)]”’、。，．！？!?：；…‥・".indexOf(ch) >= 0) return "P";
    if (ch === "ー" || ch === "〜" || ch === "～") return "LONG";
    if (c >= 0x3041 && c <= 0x309f) return "H";
    if ((c >= 0x30a0 && c <= 0x30ff) || (c >= 0x31f0 && c <= 0x31ff) || (c >= 0xff66 && c <= 0xff9f)) return "K";
    if ((c >= 0x4e00 && c <= 0x9fff) || (c >= 0x3400 && c <= 0x4dbf) || ch === "々" || ch === "〆" || ch === "ヶ") return "C";
    if (c < 0x80 || (c >= 0xff01 && c <= 0xff5e)) return "L";
    return "X";
  }
  /* i 文字目の前で 折り返してよいか */
  var ALNUM = /[A-Za-z0-9０-９Ａ-Ｚａ-ｚ]/, LETTER = /[A-Za-zＡ-Ｚａ-ｚ]/;
  var PARTICLE = "のをにはがでともへや";
  var LONG_CHUNK = 7;
  function canBreak(a, b, prevCh, ch, runH, beforeRun) {
    if (!a || !b) return false;
    if (a === "S" || b === "S" || a === "N" || b === "N") return false;   /* 空白・改行は もともと折り返せる */
    if (b === "P" || b === "LONG") return false;                           /* 句読点・のばす音の前では 切らない */
    if (a === "O") return false;                                           /* かっこの すぐ後ろでは 切らない */
    if (a === "P") return !(b === "H" && "」』）】］〉》〕)]”’".indexOf(prevCh) >= 0);   /* 「（演算装置）と」の「と」は かっこに つける */
    if (b === "O") return !(ch === "(" && a === "L");                       /* =SUM(A1) の「(」の前では 切らない */
    if (a === "H" && b === "L") return ALNUM.test(ch);
    if (a === "H" && (b === "C" || b === "K" || b === "X")) {
      /* 漢字に はさまれた 送りがな1文字（取り出す・条件付き書式）では 切らない。助詞（の・を・に…）なら 切る */
      if (runH === 1 && beforeRun === "C" && b === "C") return PARTICLE.indexOf(prevCh) >= 0;
      return true;
    }
    if ((a === "C" && b === "K") || (a === "K" && b === "C")) return true;
    /* 英数字の前後。ただし 記号（= + - / など）が くっついているときは 切らない */
    if (b === "L" && (a === "C" || a === "K" || a === "X")) return ALNUM.test(ch);
    if (a === "L" && (b === "C" || b === "K" || b === "X")) return LETTER.test(prevCh);   /* 「4番目」のように 数字と 漢字は つなげる */
    return false;
  }
  /* 文字列を 折り返してよい まとまりに分ける */
  function chunks(text) {
    var out = [], cur = "", prev = "", prevCh = "", runH = 0, beforeRun = "";
    for (var i = 0; i < text.length; i++) {
      var ch = text.charAt(i), k = cls(ch);
      if (k === "LONG" && prev) k = prev;   /* 「ー」は前の文字の仲間 */
      if (cur && canBreak(prev, k, prevCh, ch, runH, beforeRun)) { out.push(cur); cur = ""; }
      cur += ch;
      /* ひらがなが いくつ続いたか と、その前の文字の種類（送りがなの見分けに使う） */
      if (k === "H") { if (prev !== "H") { beforeRun = prev; runH = 0; } runH++; } else runH = 0;
      prev = k; prevCh = ch;
    }
    if (cur) out.push(cur);
    /* 長すぎる まとまり（せまい画面で 大きな すきまが できる）は、
     * カタカナ・漢字の ことばと、そのあとの ひらがな3文字以上の さかいめでも 切れるようにする（「アプリケーション|そのものを」） */
    var res = [];
    out.forEach(function (c) {
      if (c.length <= LONG_CHUNK) { res.push(c); return; }
      var m, re = /[\u30a0-\u30ff\u4e00-\u9fff々](?=[\u3041-\u309f]{3,})/g, last = 0;
      while ((m = re.exec(c))) {
        var at = m.index + 1;
        if (at - last >= 3 && c.length - at >= 3) { res.push(c.slice(last, at)); last = at; }
      }
      res.push(c.slice(last));
    });
    return res;
  }
  /* 要素の中身を、折り返しの印つきの文字で入れかえる */
  function set(el, text) {
    el.textContent = "";
    append(el, text);
    el.classList.add("jp");
    return el;
  }
  function append(el, text) {
    var parts = chunks(String(text == null ? "" : text));
    for (var i = 0; i < parts.length; i++) {
      if (i) el.appendChild(document.createElement("wbr"));
      el.appendChild(document.createTextNode(parts[i]));
    }
    return el;
  }
  return { chunks: chunks, set: set, append: append };
})();
