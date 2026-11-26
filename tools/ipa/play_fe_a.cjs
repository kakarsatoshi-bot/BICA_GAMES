#!/usr/bin/env node
/* =========================================================
 * IPA 科目A の問題を、実際の画面で1問ずつ表示・解答して確かめる（配信対象外の作業用スクリプト）
 *
 *   node tools/ipa/play_fe_a.cjs [スクリーンショットの保存先]   （既定: work/ipa/screens）
 *
 * js/questions_ipa_fe_a.js は、まだ index.html で読み込んでいない（生徒の画面に出さない）ので、
 * このスクリプトの中でだけ index.html に <script> を差しこんで読み込ませる（リポジトリは変えない）。
 *
 *   1回目（PC の幅 1280px）: 各クエストを順に、すべて正解で進める（次のクエストが開く）
 *   2回目（スマホの幅 390px）: 各クエストを、すべて不正解で進める（noFail にして最後まで）
 *   最後  : 科目A もぎしけん（タイマーつき）を最後まで解く
 *
 * 各問で確かめること: 問題文・出典・選択肢（ア〜エの順のまま・記号つき）・図（読み込めている）・
 * 表・プログラム・長文が データのとおりに出る。解答後のメッセージに解説（不正解なら「せいかいは」も）が出て、
 * 出典が消えない。ページが横にはみ出さない。コンソールのエラーが 0。
 * Playwright（require('playwright')）と Node.js が必要。
 * ========================================================= */
const http = require("http");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const ROOT = path.resolve(__dirname, "..", "..");
const OUT = path.resolve(process.argv[2] || path.join(ROOT, "work", "ipa", "screens"));
const QFILE = "js/questions_ipa_fe_a.js";
const LABELS = "アイウエオカキクケコ";
const SHOOT = new Set(["FE-2025A-03", "FE-2025A-06", "FE-2025A-14", "FE-2025A-19",
  "FE-2026A-01", "FE-2026A-06", "FE-2026A-07", "FE-2026A-14", "FE-2026A-17",
  "FE-2024A-01", "FE-2024A-03", "FE-2024A-13", "FE-2024A-19"]);   // 図・表・SQL のある問題

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
        if (html.includes(`<script src="${QFILE}`)) throw new Error("index.html がすでに " + QFILE + " を読み込んでいます");
        body = html.replace(tag, `<script src="${QFILE}"></script>\n${tag}`);
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
    const table = passage.querySelector("table.passage-table");
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
      table: table ? [...table.rows].map((r) => [...r.cells].map((c) => c.tagName + ":" + c.textContent)) : null,
      code: (passage.querySelector("pre.passage-code") || {}).textContent || null,
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
  const heavy = !!(q.passage || q.code || q.table || q.figure);
  check(v.passageShown === heavy, `${id}: 図・表などの領域の表示が ${v.passageShown}`);
  check(v.passageText === (q.passage || null), `${id}: 長文（passage）が違う`);
  if (q.figure) {
    check(v.figure && v.figure.src === q.figure && v.figure.ok, `${id}: 図 ${q.figure} が読み込めていない`);
    check(v.figure && v.figure.alt === q.figureAlt, `${id}: 図の説明（alt）が違う`);
  } else check(!v.figure, `${id}: 図が残っている`);
  if (q.table) {
    const want = q.table.map((r, ri) => r.map((c) => (ri === 0 && q.tableHeader !== false ? "TH:" : "TD:") + c));
    check(JSON.stringify(v.table) === JSON.stringify(want), `${id}: 表がデータと違う`);
  } else check(!v.table, `${id}: 表が残っている`);
  check(v.code === (q.code || null), `${id}: プログラム（code）が違う`);
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
    if (pickWrong && (q.id === "FE-2025A-06" || q.id === "FE-2026A-06")) await page.screenshot({ path: path.join(OUT, `${q.id}_${tag}_wrong.png`), fullPage: true });
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
  const data = await page.evaluate(() => JSON.parse(JSON.stringify(QUEST_DATA_FE_A)));
  const allIds = data.quests.flatMap((qu) => qu.questions.map((q) => q.id));
  console.log(`${QFILE}: ${data.quests.length} クエスト・${allIds.length} 問`);

  /* タイトル → 登録 → 対策項目（IPA） → メニュー */
  await page.click("#title-start");
  await page.fill("#register-name", "テスト");
  await page.click("#register-submit");
  await page.waitForSelector("#screen-course.active");
  await page.click("#course-ipa_fe");
  await page.waitForSelector("#screen-menu.active");

  async function openQuest(i) {
    await closeOverlays(page);
    await page.evaluate(() => openQuestList("fe_a"));
    await page.waitForSelector("#screen-quests.active");
    await page.locator("#quest-list .quest-card").nth(i).click();
  }

  /* 1回目：PC の幅で、すべて正解 */
  console.log("1回目（1280px・すべて正解）");
  const seen1 = new Set();
  for (let i = 0; i < data.quests.length; i++) {
    /* 1回のクエストは8問まで。9問以上あるクエストは、全問が出るまでくり返す（未挑戦の問題が先に出る） */
    for (let n = 0; n < MAX_REPLAY && !allSeen(data.quests[i], seen1); n++) {
      if (n > 0) await preferUnseen(page, data.quests[i], seen1);
      await openQuest(i);
      await playBattle(page, { pickWrong: false, seen: seen1, tag: "pc" });
    }
    const cleared = await page.evaluate((id) => !!(save.quests[id] && save.quests[id].stars > 0), data.quests[i].id);
    check(cleared, `${data.quests[i].id}: クリアにならない`);
  }
  check(seen1.size === allIds.length, `1回目で出た問題が ${seen1.size} / ${allIds.length} 問`);

  /* 2回目：スマホの幅で、すべて不正解（noFail にして最後まで出す） */
  console.log("2回目（390px・すべて不正解）");
  await page.setViewportSize({ width: 390, height: 844 });
  const seen2 = new Set();
  for (let i = 0; i < data.quests.length; i++) {
    for (let n = 0; n < MAX_REPLAY && !allSeen(data.quests[i], seen2); n++) {
      if (n > 0) await preferUnseen(page, data.quests[i], seen2);
      await openQuest(i);
      await page.waitForFunction(() => battle && battle.mode === "quest");
      await page.evaluate(() => { battle.noFail = true; });
      await playBattle(page, { pickWrong: true, seen: seen2, tag: "sp" });
    }
  }
  check(seen2.size === allIds.length, `2回目で出た問題が ${seen2.size} / ${allIds.length} 問`);

  /* もぎしけん（タイマーつき）：メニューのボタンから */
  console.log("科目A もぎしけん");
  await page.setViewportSize({ width: 1280, height: 800 });
  await closeOverlays(page);
  await page.evaluate(() => openMenu());
  await page.waitForSelector("#screen-menu.active");
  await page.click("#menu-exam");
  await page.waitForSelector("#screen-quests.active");
  await page.locator("#quest-list .quest-card").first().click();
  await waitChoices(page);
  const timer = await page.evaluate(() => ({
    shown: !document.querySelector("#battle-timer").classList.contains("hidden"),
    text: document.querySelector("#battle-timer").textContent,
  }));
  check(timer.shown && /\d+:\d\d/.test(timer.text), `もぎしけんのタイマーが出ない（${timer.text}）`);
  const seen3 = new Set();
  await playBattle(page, { pickWrong: false, seen: seen3, tag: "exam" });
  const result = await page.evaluate(() => document.querySelector("#result-sub").textContent + " " + document.querySelector("#result-title").textContent);
  console.log(`  もぎしけん: ${seen3.size} 問を解答。結果「${result.replace(/\s+/g, " ").slice(0, 80)}」`);
  check(seen3.size > 0, "もぎしけんで問題が出ない");

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
