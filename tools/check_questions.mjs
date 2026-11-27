#!/usr/bin/env node
/* =========================================================
 * 問題データの検査（配信対象外の作業用スクリプト）
 *
 *   node tools/check_questions.mjs              # 直前のコミット（HEAD）とくらべる
 *   node tools/check_questions.mjs --base main  # くらべる相手を変える（PR の確認など）
 *
 * js/questions_*.js を node:vm で読み、次のどれかがあれば exit 1（エラー）。
 *   - 問題 id の重複（ファイルをまたいでも）、クエスト id の重複、選択肢の重複、a が範囲外
 *   - IPA の問題（id が FE- で始まる）で、source が無い・書式が
 *     「令和N年度 基本情報技術者試験 科目[AB] 公開問題 問N」（末尾に「(一部改変)」可）に合わない、
 *     id と source の年度・科目・問番号が合わない
 *   - IPA の問題で fixedOrder: true・labels: "aiue" が無い（並べ替えると「改変」になるため）
 *   - 解説（exp）が15文字未満、figure の画像ファイルが無い、table・tables の形がおかしい
 *   - クエストの問題数が8未満（index.html で読み込んでいるファイルだけ。まだ読み込んでいない
 *     ファイルは、生徒の画面に出ないので「注意」にとどめる）
 *   - くらべる相手のコミットにあった問題 id が消えている（id は一度公開したら変更・削除しない）
 * ========================================================= */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MIN_QUEST_QUESTIONS = 8;   // クエストは毎回8問を選ぶ
const MIN_EXP_LENGTH = 15;
const SOURCE_RE = /^令和(\d+)年度 基本情報技術者試験 科目([AB]) 公開問題 問(\d+)(\(一部改変\))?$/;
const FE_ID_RE = /^FE-(\d{4})([AB])-(\d{2})$/;

const args = process.argv.slice(2);
const baseIdx = args.indexOf("--base");
const BASE = baseIdx >= 0 ? args[baseIdx + 1] : "HEAD";

const NOTATIONS = {};   // 擬似言語の記述形式など（FE_NOTATIONS）
const LABEL_SETS = { aiue: "アイウエオカキクケコ" };
const errors = [];
const warnings = [];
const err = (where, msg) => errors.push(`${where}: ${msg}`);
const warn = (where, msg) => warnings.push(`${where}: ${msg}`);

/* ---------- 読み込み ---------- */
function loadQuestData(code, filename) {
  const ctx = vm.createContext({});
  ctx.window = ctx;
  vm.runInContext(code, ctx, { filename, timeout: 5000 });
  if (ctx.FE_NOTATIONS) Object.assign(NOTATIONS, ctx.FE_NOTATIONS);
  return Object.keys(ctx)
    .filter((k) => ctx[k] && typeof ctx[k] === "object" && Array.isArray(ctx[k].quests))
    .map((k) => ({ name: k, data: ctx[k] }));
}

function questionFiles() {
  return readdirSync(join(ROOT, "js"))
    .filter((f) => /^questions_.*\.js$/.test(f))
    .sort()
    .map((f) => `js/${f}`);
}

/* index.html で読み込んでいるファイル（＝生徒の画面に出るもの） */
function publishedFiles() {
  const html = readFileSync(join(ROOT, "index.html"), "utf8");
  const set = new Set();
  for (const m of html.matchAll(/<script\s+src="([^"?]+)(?:\?[^"]*)?"/g)) set.add(m[1]);
  return set;
}

const charLen = (s) => Array.from(String(s)).length;

/* ---------- 1問の検査 ---------- */
function checkQuestion(q, where, file) {
  if (typeof q.id !== "string" || !q.id) { err(where, "id がありません"); return; }
  const at = `${file} ${q.id}`;
  if (typeof q.q !== "string" || !q.q.trim()) err(at, "問題文（q）がありません");

  if (!Array.isArray(q.c) || q.c.length < 2) {
    err(at, "選択肢（c）が2つ以上の配列ではありません");
  } else {
    if (q.c.length > 10) err(at, `選択肢が ${q.c.length} 個（10個まで）`);
    const seen = new Map();
    q.c.forEach((c, i) => {
      if (typeof c !== "string" || !c.trim()) { err(at, `選択肢 ${i} が空です`); return; }
      const key = c.trim();
      if (seen.has(key)) err(at, `選択肢の重複（${seen.get(key)} 番目と ${i} 番目）「${key}」`);
      else seen.set(key, i);
    });
    if (!Number.isInteger(q.a) || q.a < 0 || q.a >= q.c.length) err(at, `a=${q.a} が範囲外（0〜${q.c.length - 1}）`);
  }

  if (typeof q.exp !== "string" || charLen(q.exp.trim()) < MIN_EXP_LENGTH) {
    err(at, `解説（exp）が${MIN_EXP_LENGTH}文字未満`);
  }

  if (q.figure !== undefined) {
    if (typeof q.figure !== "string" || !existsSync(join(ROOT, q.figure))) err(at, `figure のファイルがありません: ${q.figure}`);
    if (!q.figureAlt) warn(at, "figureAlt（図の説明）がありません");
  }
  const tableOk = (rows) => Array.isArray(rows) && rows.length > 0 &&
    rows.every((r) => Array.isArray(r) && r.length === rows[0].length && r.every((c) => typeof c === "string"));
  if (q.table !== undefined && !tableOk(q.table)) err(at, "table は同じ長さの文字列の配列の配列にしてください");
  if (q.tables !== undefined) {
    const ok = Array.isArray(q.tables) && q.tables.length > 0 &&
      q.tables.every((t) => t && tableOk(t.rows) && (t.caption === undefined || typeof t.caption === "string"));
    if (!ok) err(at, "tables は [{ caption, rows }] の配列にしてください（rows は table と同じ形）");
  }
  /* 解答群が表の問題：表の行数（見出しをのぞく）と選択肢の数が同じで、c は記号だけ、各行の先頭も同じ記号 */
  if (q.choiceTable !== undefined) {
    const t = q.choiceTable;
    if (!t || !tableOk(t.rows)) err(at, "choiceTable は { caption, rows } にしてください（rows は table と同じ形）");
    else if (Array.isArray(q.c)) {
      const labels = LABEL_SETS[q.labels] || "";
      if (t.rows.length - 1 !== q.c.length) err(at, `choiceTable の行数（${t.rows.length - 1}）と選択肢の数（${q.c.length}）が違います`);
      q.c.forEach((c, i) => {
        if (c !== labels.charAt(i)) err(at, `choiceTable の問題の c は記号だけにしてください（${i + 1}番目が「${c}」）`);
        if (t.rows[i + 1] && t.rows[i + 1][0] !== labels.charAt(i)) err(at, `choiceTable の ${i + 1}行目の先頭が「${labels.charAt(i)}」ではありません`);
      });
    }
  }
  if (q.notation !== undefined && !NOTATIONS[q.notation]) err(at, `notation「${q.notation}」の内容（FE_NOTATIONS）がありません`);
  for (const k of ["passage", "code", "source"]) {
    if (q[k] !== undefined && typeof q[k] !== "string") err(at, `${k} は文字列にしてください`);
  }

  /* IPA の問題 */
  if (q.id.startsWith("FE-")) {
    const im = FE_ID_RE.exec(q.id);
    if (!im) err(at, "IPA の問題 id は FE-<西暦>A-<2けたの問番号> の形（例 FE-2025A-03）");
    if (!q.source) {
      err(at, "IPA の問題に source（出典）がありません");
    } else {
      const sm = SOURCE_RE.exec(q.source);
      if (!sm) {
        err(at, `source の書式が「令和N年度 基本情報技術者試験 科目[AB] 公開問題 問N」に合いません: ${q.source}`);
      } else if (im) {
        const [, year, kind, no] = im;
        if (Number(sm[1]) !== Number(year) - 2018 || sm[2] !== kind || Number(sm[3]) !== Number(no)) {
          err(at, `id と source の年度・科目・問番号が合いません: ${q.source}`);
        }
      }
    }
    if (q.fixedOrder !== true) err(at, "IPA の問題に fixedOrder: true がありません（選択肢の並べ替えは改変になる）");
    if (q.labels !== "aiue") err(at, 'IPA の問題に labels: "aiue" がありません');
    if (!q.field) warn(at, "field（シラバスの中分類）がありません");
  }
}

/* ---------- 全体 ---------- */
const published = publishedFiles();
const allIds = new Map();   // 問題 id -> ファイル
const questIds = new Map();
let questionCount = 0;

for (const file of questionFiles()) {
  let sets;
  try {
    sets = loadQuestData(readFileSync(join(ROOT, file), "utf8"), file);
  } catch (e) {
    err(file, `読み込めません: ${e.message}`);
    continue;
  }
  if (sets.length === 0) continue;   // クエスト形式でないファイル（じっせん道場など）
  const isPublished = published.has(file);
  for (const { name, data } of sets) {
    data.quests.forEach((quest, qi) => {
      const qwhere = `${file} ${name}.quests[${qi}]${quest.id ? " " + quest.id : ""}`;
      if (!quest.id) err(qwhere, "クエスト id がありません");
      else if (questIds.has(quest.id)) err(qwhere, `クエスト id の重複（${questIds.get(quest.id)}）`);
      else questIds.set(quest.id, file);
      const qs = Array.isArray(quest.questions) ? quest.questions : [];
      if (qs.length < MIN_QUEST_QUESTIONS) {
        const msg = `問題が ${qs.length} 問（${MIN_QUEST_QUESTIONS}問以上にする）`;
        if (isPublished) err(qwhere, msg);
        else warn(qwhere, msg + "。index.html で読み込んでいないので、いまは生徒の画面に出ません");
      }
      qs.forEach((q, i) => {
        questionCount++;
        checkQuestion(q, `${qwhere}.questions[${i}]`, file);
        if (q && q.id) {
          if (allIds.has(q.id)) err(`${file} ${q.id}`, `問題 id の重複（${allIds.get(q.id)}）`);
          else allIds.set(q.id, file);
        }
      });
    });
  }
}

/* ---------- くらべる相手のコミットにあった id が消えていないか ---------- */
function git(argv) {
  return execFileSync("git", argv, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}
try {
  git(["rev-parse", "--verify", `${BASE}^{commit}`]);
  const baseFiles = git(["ls-tree", "--name-only", BASE, "js/"])
    .split("\n").filter((f) => /^js\/questions_.*\.js$/.test(f));
  for (const file of baseFiles) {
    let sets;
    try {
      sets = loadQuestData(git(["show", `${BASE}:${file}`]), `${BASE}:${file}`);
    } catch (e) {
      warn(`${BASE}:${file}`, `読み込めないので、消えた id の検査をとばしました（${e.message}）`);
      continue;
    }
    for (const { data } of sets) {
      for (const quest of data.quests) {
        for (const q of quest.questions || []) {
          if (q && q.id && !allIds.has(q.id)) err(`${file} ${q.id}`, `${BASE} にあった問題 id が消えています（id は変更・削除しない）`);
        }
      }
    }
  }
} catch (e) {
  warn("git", `${BASE} とくらべられませんでした（${String(e.message).split("\n")[0]}）`);
}

/* ---------- 結果 ---------- */
if (warnings.length) {
  console.log(`注意 ${warnings.length} 件:`);
  for (const w of warnings) console.log("  " + w);
  console.log("");
}
if (errors.length) {
  console.log(`エラー ${errors.length} 件:`);
  for (const e of errors) console.log("  " + e);
  process.exit(1);
}
console.log(`エラー 0 件（${questionCount} 問・${questIds.size} クエストを検査。くらべた相手: ${BASE}）`);
