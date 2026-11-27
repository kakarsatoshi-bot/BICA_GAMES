#!/usr/bin/env node
/* =========================================================
 * IPA 基本情報（科目A・科目B）の問題を、実際の画面で1問ずつ表示・解答して確かめる（配信対象外の作業用スクリプト）
 *
 *   node tools/ipa/play_fe.cjs [スクリーンショットの保存先]   （既定: work/ipa/screens）
 *
 * js/questions_ipa_fe_a.js・js/questions_ipa_fe_b.js を index.html が読み込んでいないときは、
 * このスクリプトの中でだけ <script> を差しこんで読み込ませる（リポジトリは変えない）。
 *
 *   1回目（PC の幅 1280px）: 科目A・科目B の各クエストを順に、すべて正解で進める（次のクエストが開く）
 *   はんい : まおうの城・復習に入るときに「科目A だけ」「科目B だけ」「A＋B」を えらび、その科目の問題だけが出る
 *   2回目（スマホの幅 390px）: 各クエストを、すべて不正解で進める（noFail にして最後まで）
 *   最後  : 科目A もぎしけん・科目B もぎしけん（タイマーつき）を最後まで解く
 *
 * 各問で確かめること: 問題文・出典・選択肢（ア〜の順のまま・記号つき）・図（読み込めている）・
 * 表・プログラム・長文・解答群の表・記述形式のボタンが データのとおりに出る。解答後のメッセージに解説
 * （不正解なら「せいかいは」も）が出て、出典が消えない。ページが横にはみ出さない。コンソールのエラーが 0。
 * Playwright（require('playwright')）と Node.js が必要。
 * ========================================================= */
const http = require("http");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const ROOT = path.resolve(__dirname, "..", "..");
const OUT = path.resolve(process.argv[2] || path.join(ROOT, "work", "ipa", "screens"));
const QFILES = ["js/questions_ipa_fe_a.js", "js/questions_ipa_fe_b.js"].filter((f) => fs.existsSync(path.join(ROOT, f)));
const SUBJECTS = [{ key: "fe_a", data: "QUEST_DATA_FE_A" }, { key: "fe_b", data: "QUEST_DATA_FE_B" }];
const LABELS = "アイウエオカキクケコ";
const SHOOT = new Set(["FE-2025A-03", "FE-2025A-06", "FE-2025A-14", "FE-2025A-19",
  "FE-2026A-01", "FE-2026A-06", "FE-2026A-07", "FE-2026A-14", "FE-2026A-17",
  "FE-2024A-01", "FE-2024A-03", "FE-2024A-13", "FE-2024A-19",
  "FE-2023A-02", "FE-2023A-06", "FE-2023A-10", "FE-2023A-11", "FE-2023A-13",
  "FE-2025B-01", "FE-2025B-03", "FE-2025B-05", "FE-2025B-06", "FE-2026B-02", "FE-2026B-04", "FE-2026B-05", "FE-2026B-06",
  "FE-2024B-03", "FE-2024B-05", "FE-2024B-06", "FE-2023B-02", "FE-2023B-04", "FE-2023B-05", "FE-2023B-06"]);   // 図・表・SQL・プログラムのある問題

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png",
  ".svg": "image/svg+xml", ".json": "application/json", ".webp": "image/webp", ".ico": "image/x-icon" };

function serve() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = decodeURIComponent(req.url.split("?")[0]);
      const file = path.join(ROOT, url === "/" ? "index.html" : url);
      if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404); res.end(); return;
      }
      let body = fs.readFileSync(file);
      if (url === "/" || url === "/index.html") {
        const html = body.toString("utf8");
        const tag = '<script src="js/courses.js';
        if (!html.includes(tag)) throw new Error("index.html に courses.js の読み込みが見つかりません");
        /* index.html がまだ読み込んでいないファイルだけを差しこむ（読み込み済みならそのまま） */
        const missing = QFILES.filter((f) => !html.includes(`<script src="${f}`));
        body = html.replace(tag, missing.map((f) => `<script src="${f}"></script>\n`).join("") + tag);
      }
      res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream" });
      res.end(body);
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

const MAX_REPLAY = 6;   // 1つのクエストを くり返す回数の上限（1回8問なので、48問まで確かめられる）
const allSeen = (quest, seen) => quest.questions.every((q) => seen.has(q.id));
/* まだ出ていない問題の記録を、テストの中のセーブから消して「未挑戦」にもどす（未挑戦の問題が先に出るため）。
 * 不正解にした問題は すぐ復習の期限になり、次の回もそちらが先に出てしまうので、くり返すときに使う */
async function preferUnseen(page, quest, seen) {
  const ids = quest.questions.map((q) => q.id).filter((id) => !seen.has(id));
  await page.evaluate((list) => { list.forEach((id) => { delete save.records[id]; }); }, ids);
}

let failures = 0;
const fail = (msg) => { failures++; console.log("  NG " + msg); };
const check = (cond, msg) => { if (!cond) fail(msg); };

async function noOverflow(page, where) {
  const w = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
  check(w.sw <= w.iw, `${where}: ページが横にはみ出している（${w.sw}px > ${w.iw}px）`);
}

/* いま出ている問題を、データとくらべる */
async function checkQuestionView(page, q) {
  const v = await page.evaluate(() => {
    const $ = (s) => document.querySelector(s);
    const passage = $("#battle-passage");
    const img = passage.querySelector("img.passage-figure");
    return {
      msg: $("#battle-msg").textContent,
      source: $("#battle-source").classList.contains("hidden") ? null : $("#battle-source").textContent,
      choices: [...document.querySelectorAll("#battle-choices .choice")].map((b) => ({
        label: (b.querySelector(".choice-label") || {}).textContent || "",
        text: b.textContent,
      })),
      fixed: $("#battle-choices").classList.contains("fixed"),
      passageShown: !passage.classList.contains("hidden"),
      passageText: (passage.querySelector(".passage-text") || {}).textContent || null,
      figure: img ? { src: img.getAttribute("src"), ok: img.complete && img.naturalWidth > 0, alt: img.alt } : null,
      tables: [...passage.querySelectorAll(".passage-scroll:not(.passage-choice-table)")].map((w) => ({
        caption: (w.querySelector(".passage-caption") || {}).textContent || "",
        rows: [...w.querySelector("table").rows].map((r) => [...r.cells].map((c) => c.tagName + ":" + c.textContent)),
      })),
      code: (passage.querySelector("pre.passage-code") || {}).textContent || null,
      choiceTable: (() => {
        /* 解答群の表は、選択肢のすぐ上（#battle-ctable）に出る */
        const w = document.querySelector("#battle-ctable .passage-choice-table");
        return w ? { caption: (w.querySelector(".passage-caption") || {}).textContent || "",
          rows: [...w.querySelector("table").rows].map((r) => [...r.cells].map((c) => c.textContent)) } : null;
      })(),
      labelOnly: $("#battle-choices").classList.contains("label-only"),
      notationShown: !$("#battle-notation").classList.contains("hidden"),
    };
  });
  const id = q.id;
  check(v.msg === q.q, `${id}: 問題文がデータと違う`);
  check(v.source === "出典:" + q.source, `${id}: 出典が「${v.source}」`);
  check(v.fixed, `${id}: 選択肢が1列（fixed）になっていない`);
  check(v.choices.length === q.c.length, `${id}: 選択肢が ${v.choices.length} 個`);
  v.choices.forEach((c, i) => {
    check(c.label === LABELS[i], `${id}: ${i + 1}番目の選択肢の記号が「${c.label}」`);
    const want = q.c[i] === LABELS[i] ? LABELS[i] : LABELS[i] + q.c[i];   // 記号だけの選択肢（図の中から選ぶ問題）
    check(c.text === want, `${id}: ${LABELS[i]} の選択肢が並べ替わっているか、文字が違う`);
  });
  const heavy = !!(q.passage || q.code || q.table || q.tables || q.figure || q.choiceTable);
  check(v.passageShown === heavy, `${id}: 図・表などの領域の表示が ${v.passageShown}`);
  check(v.passageText === (q.passage || null), `${id}: 長文（passage）が違う`);
  if (q.figure) {
    check(v.figure && v.figure.src === q.figure && v.figure.ok, `${id}: 図 ${q.figure} が読み込めていない`);
    check(v.figure && v.figure.alt === q.figureAlt, `${id}: 図の説明（alt）が違う`);
  } else check(!v.figure, `${id}: 図が残っている`);
  /* 表：table（1つ）と tables（題名つき）を、出る順にくらべる */
  const cells = (rows, header) => rows.map((r, ri) => r.map((c) => (ri === 0 && header ? "TH:" : "TD:") + c));
  const wantTables = (q.table ? [{ caption: "", rows: cells(q.table, q.tableHeader !== false) }] : [])
    .concat((q.tables || []).map((t) => ({ caption: t.caption || "", rows: cells(t.rows, t.header !== false) })));
  check(JSON.stringify(v.tables) === JSON.stringify(wantTables), `${id}: 表がデータと違う（または前の問題の表が残っている）`);
  check(v.code === (q.code || null), `${id}: プログラム（code）が違う`);
  check(JSON.stringify(v.choiceTable) === JSON.stringify(q.choiceTable ? { caption: q.choiceTable.caption || "", rows: q.choiceTable.rows } : null),
    `${id}: 解答群の表（choiceTable）が違う`);
  check(v.labelOnly === q.c.every((c, i) => c === LABELS[i]), `${id}: 記号だけの選択肢の並べ方が違う`);
  check(v.notationShown === !!q.notation, `${id}: 記述形式のボタンの表示が ${v.notationShown}`);
}

/* 擬似言語の記述形式のモーダル：開く・中身・出典・開いている間は数字キーで答えない・Esc で閉じる */
let notationChecked = false;
async function checkNotation(page, q) {
  await page.click("#battle-notation");
  const m = await page.evaluate(() => ({
    open: !document.querySelector("#notation-modal").classList.contains("hidden"),
    title: document.querySelector("#notation-title").textContent,
    source: document.querySelector("#notation-source").textContent,
    tables: document.querySelectorAll("#notation-body table").length,
    want: FE_NOTATIONS[battle.qs[battle.idx].notation],
  }));
  check(m.open, `${q.id}: 記述形式のモーダルが開かない`);
  check(m.title === m.want.title && m.source === "出典:" + m.want.source, `${q.id}: 記述形式の題名・出典が違う`);
  check(m.tables === m.want.sections.filter((x) => x.rows).length, `${q.id}: 記述形式の表の数が違う`);
  await page.screenshot({ path: path.join(OUT, `notation_${q.id}.png`), fullPage: false });
  await page.keyboard.press("1");
  const answered = await page.evaluate(() => document.querySelectorAll("#battle-choices .choice:disabled").length);
  check(answered === 0, `${q.id}: 記述形式を開いている間に、数字キーで答えてしまった`);
  await page.keyboard.press("Escape");
  const closed = await page.evaluate(() => document.querySelector("#notation-modal").classList.contains("hidden"));
  check(closed, `${q.id}: Esc で記述形式が閉じない`);
  notationChecked = true;
}

async function waitChoices(page) {
  await page.waitForSelector("#battle-choices .choice", { state: "visible", timeout: 15000 });
  await page.waitForFunction(() => !document.querySelector("#battle-choices").classList.contains("arming"));
}

async function closeOverlays(page) {
  await page.evaluate(() => {
    const lv = document.querySelector("#levelup-overlay");
    if (lv && !lv.classList.contains("hidden")) lv.classList.add("hidden");
  });
}

/* 1回の戦闘を最後まで。pickWrong=true なら必ず不正解を選ぶ */
async function playBattle(page, { pickWrong, seen, tag }) {
  for (;;) {
    const state = await Promise.race([
      waitChoices(page).then(() => "q"),
      page.waitForSelector("#screen-result.active", { timeout: 15000 }).then(() => "end"),
    ]);
    if (state === "end") return;
    const q = await page.evaluate(() => {
      const x = battle.qs[battle.idx];
      return JSON.parse(JSON.stringify(x));
    });
    await checkQuestionView(page, q);
    await noOverflow(page, `${q.id}（${tag}・解答前）`);
    if (q.notation && !notationChecked) await checkNotation(page, q);
    if (SHOOT.has(q.id)) await page.screenshot({ path: path.join(OUT, `${q.id}_${tag}.png`), fullPage: true });

    const pick = pickWrong ? (q.a + 1) % q.c.length : q.a;
    await page.locator("#battle-choices .choice").nth(pick).click();
    await page.waitForSelector("#battle-continue:not(.hidden)", { timeout: 20000 });
    const after = await page.evaluate(() => ({
      msg: document.querySelector("#battle-msg").textContent,
      source: document.querySelector("#battle-source").classList.contains("hidden") ? null : document.querySelector("#battle-source").textContent,
      boss: battle.bossPhase,
    }));
    check(after.source === "出典:" + q.source, `${q.id}: 解答後に出典が消えた`);
    if (pickWrong) {
      const right = q.c[q.a] === LABELS[q.a] ? LABELS[q.a] : `${LABELS[q.a]}  ${q.c[q.a]}`;
      check(after.msg.includes(`せいかいは 「${right}」`), `${q.id}: 不正解のときの「せいかいは」が記号つきで出ない`);
      check(after.msg.includes("【かいせつ】" + q.exp), `${q.id}: 不正解のときに解説が出ない`);
    } else if (!after.boss) {
      /* ボス戦の正解メッセージには解説が出ない（MOS と同じ仕様） */
      check(after.msg.includes("【まめちしき】" + q.exp), `${q.id}: 正解のときに解説（まめちしき）が出ない`);
    }
    await noOverflow(page, `${q.id}（${tag}・解答後）`);
    if (pickWrong && (q.id === "FE-2025A-06" || q.id === "FE-2026A-06" || q.id === "FE-2025B-06")) await page.screenshot({ path: path.join(OUT, `${q.id}_${tag}_wrong.png`), fullPage: true });
    seen.add(q.id);
    await closeOverlays(page);
    await page.locator("#battle-continue").click();
  }
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  const consoleErrors = [];
  const external = new Set();   // 外部（フォント・成績送信など）の読み込み失敗。このリポジトリの問題ではないので数えない
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const url = (m.location() && m.location().url) || "";
    if (/^Failed to load resource/.test(m.text()) && url && !url.startsWith(base)) { external.add(new URL(url).host); return; }
    consoleErrors.push(m.text() + (url ? " (" + url + ")" : ""));
  });
  page.on("pageerror", (e) => consoleErrors.push(String(e)));
  page.on("requestfailed", (r) => {
    if (r.url().startsWith(base)) consoleErrors.push("読み込み失敗 " + r.url());
    else external.add(new URL(r.url()).host);
  });

  await page.goto(base);
  const subjects = [];
  for (const sub of SUBJECTS) {
    const data = await page.evaluate((name) => (window[name] && window[name].quests.length ? JSON.parse(JSON.stringify(window[name])) : null), sub.data);
    if (data) subjects.push({ key: sub.key, data, ids: data.quests.flatMap((qu) => qu.questions.map((q) => q.id)) });
  }
  const allIds = subjects.flatMap((s) => s.ids);
  console.log(QFILES.join("・") + ": " + subjects.map((s) => `${s.key} ${s.data.quests.length} クエスト・${s.ids.length} 問`).join(" ／ "));

  /* タイトル → 登録 → 対策項目（IPA） → メニュー */
  await page.click("#title-start");
  await page.fill("#register-name", "テスト");
  await page.click("#register-submit");
  /* はじめての人は、さきに アバター・しょくぎょうを きめる */
  await page.waitForSelector("#screen-avatar.active");
  await page.click("#avatar-done");
  await page.waitForSelector("#screen-course.active");
  await page.click("#course-ipa_fe");
  await page.waitForSelector("#screen-menu.active");

  async function toMenu() {
    await closeOverlays(page);
    await page.evaluate(() => openMenu());
    await page.waitForSelector("#screen-menu.active");
  }
  async function openQuest(subjectKey, i) {
    await closeOverlays(page);
    await page.click("#menu-" + subjectKey);   /* メニューの科目ボタンから入る */
    await page.waitForSelector("#screen-quests.active");
    await page.locator("#quest-list .quest-card").nth(i).click();
  }
  /* 科目・クエストごとに、全問が出るまで戦う */
  async function playAll(tag, pickWrong) {
    const seen = new Set();
    for (const sub of subjects) {
      for (let i = 0; i < sub.data.quests.length; i++) {
        const quest = sub.data.quests[i];
        for (let n = 0; n < MAX_REPLAY && !allSeen(quest, seen); n++) {
          if (n > 0) await preferUnseen(page, quest, seen);
          await toMenu();
          await openQuest(sub.key, i);
          await page.waitForFunction(() => battle && battle.mode === "quest");
          const hearts = await page.evaluate(() => battle.maxHearts);
          check(hearts === (quest.hearts || 3), `${quest.id}: ♥ の数が ${hearts}（${quest.hearts || 3} のはず）`);
          if (pickWrong) await page.evaluate(() => { battle.noFail = true; });
          await playBattle(page, { pickWrong, seen, tag });
        }
        if (!pickWrong) {
          const cleared = await page.evaluate((id) => !!(save.quests[id] && save.quests[id].stars > 0), quest.id);
          check(cleared, `${quest.id}: クリアにならない`);
        }
      }
    }
    check(seen.size === allIds.length, `${tag}: 出た問題が ${seen.size} / ${allIds.length} 問`);
  }

  /* 1回目：PC の幅で、すべて正解 */
  console.log("1回目（1280px・すべて正解）");
  await playAll("pc", false);
  check(notationChecked || !allIds.some((id) => /B-/.test(id)), "記述形式のモーダルを確かめられなかった");

  /* はんい：両方の科目に問題があるときだけ、まおうの城などに入るときに えらぶ画面が出る（メニューには出さない） */
  const both = subjects.length >= 2;
  const SCOPES = [{ key: "fe_a", re: /^FE-\d{4}A-/ }, { key: "fe_b", re: /^FE-\d{4}B-/ }, { key: "all", re: /^FE-\d{4}[AB]-/ }];
  /* メニューのボタンを押して、はんいを えらんで入る。入った戦闘の問題 id を返す */
  async function enterScoped(menuId, scopeKey) {
    await toMenu();
    await page.click(menuId);
    await page.waitForSelector("#scope-modal:not(.hidden)");
    const modal = await page.evaluate(() => ({
      keys: [...document.querySelectorAll("#scope-list .scope-btn")].map((b) => b.dataset.scope),
      last: (document.querySelector("#scope-list .is-last") || {}).dataset,
    }));
    check(modal.keys.join(",") === "all,fe_a,fe_b", `${menuId}: はんいの えらびかたが ${modal.keys.join(",")}`);
    await page.click(`#scope-list [data-scope="${scopeKey}"]`);
    await waitChoices(page);
    return page.evaluate(() => ({ ids: battle.qs.map((q) => q.id), mode: battle.mode, saved: save.scopes.ipa_fe,
      last: null }));
  }
  await toMenu();
  check(!(await page.$("#menu-scope")), "メニューに はんいの選択ボタンが残っている");
  if (both) {
    /* もぎしけんの一覧は、科目A・科目B の両方が出る（はんいは えらばない） */
    await page.click("#menu-exam");
    await page.waitForSelector("#screen-quests.active");
    const exams = await page.evaluate(() => [...document.querySelectorAll("#quest-list .quest-name")].map((e) => e.textContent));
    check(JSON.stringify(exams) === JSON.stringify(["科目A もぎしけん", "科目B もぎしけん"]), `もぎしけんの一覧が ${exams.join("・")}`);
    await toMenu();
    await page.click("#menu-final");
    await page.waitForSelector("#scope-modal:not(.hidden)");
    await page.screenshot({ path: path.join(OUT, "menu_scope.png"), fullPage: true });
    await page.keyboard.press("Escape");
    check(await page.evaluate(() => document.querySelector("#scope-modal").classList.contains("hidden")), "はんいの画面が Esc で とじない");
    for (const sc of SCOPES) {
      const r = await enterScoped("#menu-final", sc.key);
      check(r.mode === "final", `はんい ${sc.key}: まおうの城に入れない（${r.mode}）`);
      check(r.saved === sc.key, `はんい ${sc.key}: えらんだ はんいが保存されない（${r.saved}）`);
      check(r.ids.length > 0 && r.ids.every((id) => sc.re.test(id)), `はんい ${sc.key}: まおうの城の問題に ほかの科目が混ざっている`);
      if (sc.key === "all") {
        const subs = await page.evaluate(() => [...new Set(Object.keys(QUESTION_INDEX).filter(inScope).map((id) => QUESTION_INDEX[id].subject))].sort());
        check(subs.join(",") === "fe_a,fe_b", `はんい A＋B: 対象の科目が ${subs.join(",")}`);
      }
    }
    /* メニューにもどると、はんいは A＋B（科目ぜんぶ）として数える。まえ回 えらんだ はんいに目印が付く */
    await toMenu();
    const back = await page.evaluate(() => ({ scope: currentScope().key, final: finalUnlockedAny() }));
    check(back.scope === "all" && back.final, `メニューでの はんい・まおうの城が ${back.scope} / ${back.final}`);
    await page.click("#menu-final");
    await page.waitForSelector("#scope-modal:not(.hidden)");
    const last = await page.evaluate(() => (document.querySelector("#scope-list .is-last") || {}).dataset.scope);
    check(last === "all", `まえ回の目印が ${last}`);
    await page.click("#scope-close");
  }

  /* 2回目：スマホの幅で、すべて不正解（noFail にして最後まで出す） */
  console.log("2回目（390px・すべて不正解）");
  await page.setViewportSize({ width: 390, height: 844 });
  await playAll("sp", true);

  /* 復習（ふっかつのほこら）：2回目で全問まちがえたので、えらんだ はんいの科目の問題だけが出る */
  if (both) {
    for (const sc of SCOPES.slice(0, 2)) {
      const rv = await enterScoped("#menu-review", sc.key);
      check(rv.mode === "review" && rv.ids.length > 0 && rv.ids.every((id) => sc.re.test(id)), `はんい ${sc.key}: 復習の問題に ほかの科目が混ざっている（${rv.ids.join(",")}）`);
    }
  }

  /* もぎしけん（タイマーつき）：メニューのボタンから、科目ごとに */
  await page.setViewportSize({ width: 1280, height: 800 });
  for (let e = 0; e < subjects.length; e++) {
    await toMenu();
    await page.click("#menu-exam");
    await page.waitForSelector("#screen-quests.active");
    const name = await page.locator("#quest-list .quest-name").nth(e).textContent();
    console.log(name);
    await page.locator("#quest-list .quest-card").nth(e).click();
    await waitChoices(page);
    const timer = await page.evaluate(() => ({
      shown: !document.querySelector("#battle-timer").classList.contains("hidden"),
      text: document.querySelector("#battle-timer").textContent,
      count: battle.qs.length, want: battle.exam.count,
    }));
    check(timer.shown && /\d+:\d\d/.test(timer.text), `${name}のタイマーが出ない（${timer.text}）`);
    check(timer.count === timer.want, `${name}の問題数が ${timer.count}（${timer.want} のはず）`);
    const seen3 = new Set();
    await playBattle(page, { pickWrong: false, seen: seen3, tag: "exam" });
    const result = await page.evaluate(() => document.querySelector("#result-sub").textContent + " " + document.querySelector("#result-title").textContent);
    console.log(`  ${seen3.size} 問を解答。結果「${result.replace(/\s+/g, " ").slice(0, 60)}」`);
    check(seen3.size > 0, `${name}で問題が出ない`);
  }

  if (external.size) console.log("  （参考）外部への読み込みが失敗: " + [...external].join(", ") + " … ネットワークの制限によるもの。エラーには数えない");
  check(consoleErrors.length === 0, "コンソールのエラー: " + consoleErrors.join(" / "));
  await browser.close();
  server.close();
  if (failures) {
    console.log(`\nNG ${failures} 件`);
    process.exit(1);
  }
  console.log(`\nOK: ${allIds.length} 問すべて表示・解答できた（正解・不正解とも）。コンソールのエラー 0。スクリーンショット: ${path.relative(ROOT, OUT) || OUT}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
