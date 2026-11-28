/* =========================================================
 * STUDY QUEST 問題の図（js/visuals.js）
 * 問題に vis があるとき、選択肢の上に「まえ → あと」の図を出す（Word の紙面・Excel の表）。
 * まず見た目で つかんで、あとから ことば（もとの問題文 qText）で ふりかえる、ための しくみ。
 *
 *  vis: {
 *    kind: "word" | "excel",
 *    before: <図>, after: <図>     // before が無いときは after だけ（「この表示」）
 *  }
 *  Word の図 … 段落の配列。段落は { t: "文字" } か { runs: [{ t, b, i, u, strike, sel, dist, hl, color, size }] }
 *               align: "left|center|right|justify|distribute"、first / left / right（字下げ・インデント。文字数）、
 *               list: "bullet|number"、b / i / u、size: "s|m|l|xl"、sel（選択中）、border、shade、spacing
 *               run の dist: N は「N 文字分の はばに 均等割り付け」
 *  Excel の図 … { cells: [[...], ...], fx: "数式バーの文字", active: "B5", sel: "B2:B4",
 *                fmt: { "B2:B4": { b, fill, color, align, border } }, colw: [文字数,...] }
 * ========================================================= */
var Vis = (function () {
  function el(tag, cls, text, parent) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined && text !== null) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  }
  var COLORS = { red: "#d62828", blue: "#1f5fbf", green: "#2a8a34", yellow: "#fff3a0", gray: "#d9d9d9", orange: "#f08c3a" };
  function col(c) { return COLORS[c] || c; }

  /* ---------- Word ---------- */
  function runEl(r, parent) {
    var s = el("span", "vr", null, parent);
    if (r.dist) {
      s.classList.add("vr-dist");
      s.style.width = r.dist + "em";
    }
    s.textContent = r.t;
    if (r.b) s.style.fontWeight = "bold";
    if (r.i) s.style.fontStyle = "italic";
    var deco = [];
    if (r.u) deco.push("underline");
    if (r.strike) deco.push("line-through");
    if (deco.length) s.style.textDecoration = deco.join(" ");
    if (r.color) s.style.color = col(r.color);
    if (r.hl) s.style.background = col(r.hl);
    if (r.size) s.classList.add("vs-" + r.size);
    if (r.sel) s.classList.add("vr-sel");
    return s;
  }
  function wordPage(paras, page) {
    var pg = el("div", "vp-page");
    if (page && page.cols) { pg.style.columnCount = page.cols; pg.classList.add("vp-cols"); }
    if (page && page.orient === "landscape") pg.classList.add("vp-land");
    var n = 0;
    (paras || []).forEach(function (p) {
      var d = el("div", "vp", null, pg);
      if (p.align) d.classList.add("va-" + p.align);
      if (p.first) d.style.textIndent = p.first + "em";
      if (p.left || (p.first < 0)) d.style.paddingLeft = ((p.left || 0) + (p.first < 0 ? -p.first : 0)) + "em";
      if (p.right) d.style.paddingRight = p.right + "em";
      if (p.spacing) d.style.lineHeight = (1.5 * p.spacing).toFixed(2);
      if (p.border) d.classList.add("vp-border");
      if (p.shade) d.style.background = col(p.shade);
      if (p.size) d.classList.add("vs-" + p.size);
      if (p.list) {
        n = p.list === "number" ? n + 1 : 0;
        el("span", "vp-mark", p.list === "number" ? n + "." : "●", d);
      }
      var runs = p.runs || [{ t: p.t, b: p.b, i: p.i, u: p.u, strike: p.strike, sel: p.sel, color: p.color, hl: p.hl }];
      runs.forEach(function (r) { runEl(r, d); });
    });
    return pg;
  }

  /* ---------- Excel ---------- */
  function colName(i) { return String.fromCharCode(65 + i); }
  function parseRef(ref) {
    var m = /^([A-Z])(\d+)$/.exec(ref);
    return m ? { c: m[1].charCodeAt(0) - 65, r: +m[2] } : null;
  }
  function inRange(range, c, r) {
    var parts = range.split(":"), a = parseRef(parts[0]), b = parseRef(parts[1] || parts[0]);
    if (!a || !b) return false;
    return c >= Math.min(a.c, b.c) && c <= Math.max(a.c, b.c) && r >= Math.min(a.r, b.r) && r <= Math.max(a.r, b.r);
  }
  function excelSheet(sh) {
    var wrap = el("div", "vx");
    var bar = el("div", "vx-bar", null, wrap);
    el("span", "vx-name", sh.active || (sh.sel ? sh.sel.split(":")[0] : "A1"), bar);
    el("span", "vx-fx", "fx", bar);
    el("span", "vx-formula", sh.fx || "", bar);
    var cells = sh.cells || [];
    var ncol = cells.reduce(function (m, r) { return Math.max(m, r.length); }, 0);
    var t = el("table", "vx-grid", null, wrap);
    var hr = el("tr", null, null, t);
    el("th", "vx-corner", "", hr);
    for (var c = 0; c < ncol; c++) {
      var th = el("th", null, colName(c), hr);
      if (sh.colw && sh.colw[c]) th.style.width = sh.colw[c] + "em";
    }
    cells.forEach(function (row, ri) {
      var tr = el("tr", null, null, t);
      el("th", null, String(ri + 1), tr);
      for (var c = 0; c < ncol; c++) {
        var v = row[c];
        var td = el("td", null, v === undefined || v === null ? "" : String(v), tr);
        if (typeof v === "number") td.classList.add("vx-num");
        var ref = colName(c) + (ri + 1);
        Object.keys(sh.fmt || {}).forEach(function (rg) {
          if (!inRange(rg, c, ri + 1)) return;
          var f = sh.fmt[rg];
          if (f.b) td.style.fontWeight = "bold";
          if (f.fill) td.style.background = col(f.fill);
          if (f.color) td.style.color = col(f.color);
          if (f.align) td.style.textAlign = f.align;
          if (f.border) td.classList.add("vx-border");
        });
        if (sh.sel && inRange(sh.sel, c, ri + 1)) td.classList.add("vx-sel");
        if (sh.active === ref) td.classList.add("vx-active");
      }
    });
    return wrap;
  }

  function panel(kind, data, label, page) {
    var p = el("div", "vis-panel");
    if (label) el("div", "vis-label", label, p);
    p.appendChild(kind === "excel" ? excelSheet(data) : wordPage(data, page));
    return p;
  }
  function render(box, vis) {
    box.innerHTML = "";
    if (!vis) { box.classList.add("hidden"); return; }
    box.classList.remove("hidden");
    var wrap = el("div", "vis vis-" + vis.kind, null, box);
    if (vis.before) {
      wrap.appendChild(panel(vis.kind, vis.before, "まえ", vis.pageBefore || vis.page));
      el("div", "vis-arrow", "▶", wrap).setAttribute("aria-hidden", "true");
    }
    wrap.appendChild(panel(vis.kind, vis.after, vis.before ? "あと" : "", vis.page));
  }
  return { render: render };
})();
