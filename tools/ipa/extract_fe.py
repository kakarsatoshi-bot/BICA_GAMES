#!/usr/bin/env python3
"""IPA 基本情報技術者試験 科目A 公開問題の下書きづくりと、正解の突き合わせ。

配信対象外の作業用スクリプト（標準ライブラリ + poppler の pdftotext / pdftoppm）。
PDF と下書きは work/ipa/ に置き、リポジトリには入れない（.gitignore 済み）。

使い方（リポジトリのルートで）:
  python3 -I tools/ipa/extract_fe.py fetch 2025      # 問題と解答の PDF を work/ipa/ に取得
  python3 -I tools/ipa/extract_fe.py draft 2025      # work/ipa/fe_a_draft.json に下書きを書き出す
  python3 -I tools/ipa/extract_fe.py figures 2025    # 図を img/fe/ に切り出す（FIGURES の範囲）
  python3 -I tools/ipa/extract_fe.py check 2025      # js/questions_ipa_fe_a.js の a を解答 PDF と突き合わせる

check は「解答 PDF の正解」と「収録した a」が1問でも違う・足りないと exit 1。
あわせて、問題文・選択肢が PDF の文字と違う問題を一覧にする（空白と全角半角の差は無視）。
違いがあるのに source に「(一部改変)」が無いものは要確認として出す（exit コードには影響しない）。
"""

import argparse
import json
import re
import subprocess
import sys
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
WORK = ROOT / "work" / "ipa"
DRAFT = WORK / "fe_a_draft.json"
QUESTIONS_JS = ROOT / "js" / "questions_ipa_fe_a.js"

BASE = "https://www.ipa.go.jp/shiken/mondai-kaiotu/sg_fe/koukai/"
# 年度ごとの PDF のフォルダ（IPA の公開問題ページから）
FOLDERS = {
    2023: "t6hhco0000003zx0-att",
    2024: "eid2eo0000007g1d-att",
    2025: "tbl5kb0000005r9r-att",
    2026: "rcu1hd0000012qj6-att",
}

# 図の切り出し範囲。pdftoppm -r 200 のピクセル（ページ左上が原点）: 問番号 -> (ページ, x, y, 幅, 高さ)
# 図の内容は変えず、周りの余白だけを付けて切り出す。
FIGURE_DPI = 200
FIGURES = {
    2025: {
        3: (3, 459, 319, 516, 474),    # 2分探索木
        14: (8, 281, 334, 882, 518),   # アローダイアグラム
    },
    2024: {
        3: (3, 242, 493, 1033, 298),   # 構成の図と、アクセス時間の表（横に並んでいるので1枚に）
        13: (6, 278, 1165, 896, 428),  # アローダイアグラム
        19: (9, 565, 331, 366, 280),   # 散布図
    },
    2026: {
        6: (6, 204, 772, 1066, 982),   # 論理回路と、選択肢ア〜エのタイミングチャート
    },
}

LABELS = "アイウエ"
FULLWIDTH_DIGITS = str.maketrans("０１２３４５６７８９", "0123456789")
HEADER_RE = re.compile(r"^\s*問\s*([0-9０-９]{1,2})(?=[\s　]|$)(.*)$")
FOOTER_RE = re.compile(r"^\s*－\s*\d+\s*－\s*$")
MEMO_RE = re.compile(r"〔\s*メ\s*モ\s*用\s*紙\s*〕")
CHOICE_START_RE = re.compile(r"^\s*([アイウエ])\s+\S")
RUBY_RE = re.compile(r"^\s*[ぁ-ゖ]{1,4}\s*$")
CONTINUE_PARA = ("なお，", "ここで，", "ただし，")


def reiwa(year):
    return year - 2018


def prefix(year):
    return "%dr%02d" % (year, reiwa(year))


def pdf_path(year, kind):
    return WORK / ("%s_fe_kamoku_a_%s.pdf" % (prefix(year), kind))


def pdftotext(path, layout=True):
    if not path.exists():
        sys.exit("PDF がありません: %s（先に fetch を実行）" % path.relative_to(ROOT))
    args = ["pdftotext"] + (["-layout"] if layout else []) + [str(path), "-"]
    return subprocess.run(args, check=True, capture_output=True, text=True).stdout


def norm(s):
    """比較用：全角半角をそろえ（NFKC）、空白をすべて取る"""
    return re.sub(r"\s+", "", unicodedata.normalize("NFKC", s))


# ---------------------------------------------------------------- fetch
def cmd_fetch(year):
    WORK.mkdir(parents=True, exist_ok=True)
    for kind in ("qs", "ans"):
        dest = pdf_path(year, kind)
        url = BASE + FOLDERS[year] + "/" + dest.name
        subprocess.run(["curl", "-sSfL", "--retry", "3", "-o", str(dest), url], check=True)
        print("取得:", dest.relative_to(ROOT))


# ---------------------------------------------------------------- 解答
def read_answers(year):
    """解答 PDF の「問番号 / 正解」の表を読む。{問番号: 0..3}"""
    text = pdftotext(pdf_path(year, "ans"))
    if "科目 A" not in text and "科目A" not in text:
        sys.exit("解答 PDF に「科目A」が見つかりません")
    answers = {}
    for m in re.finditer(r"問\s*([0-9０-９]{1,2})\s+([アイウエ])", text):
        no = int(m.group(1).translate(FULLWIDTH_DIGITS))
        if no in answers:
            sys.exit("解答 PDF に問%d が2回あります" % no)
        answers[no] = LABELS.index(m.group(2))
    if sorted(answers) != list(range(1, 21)):
        sys.exit("解答 PDF から問1〜問20 を読めませんでした: %s" % sorted(answers))
    return answers


# ---------------------------------------------------------------- 下書き
def split_questions(text):
    """問N の見出しで分ける。{問番号: [行...]}（見出し行の「問N」は取り除く）"""
    lines = text.splitlines()
    blocks, cur, no = {}, None, None
    for i, line in enumerate(lines):
        if MEMO_RE.search(line):
            break
        if FOOTER_RE.match(line):
            continue
        m = HEADER_RE.match(line)
        if m:
            n = int(m.group(1).translate(FULLWIDTH_DIGITS))
            if n == (no or 0) + 1:
                # 見出しの直前のルビ（例：危殆化の「たい」）は前の問題から外し、この問題の注記にする
                ruby = []
                while cur and len(cur) > 1 and (not cur[-1].strip() or RUBY_RE.match(cur[-1])):
                    last = cur.pop()
                    if last.strip():
                        ruby.insert(0, last.strip())
                no, cur = n, [" " * (len(line) - len(line.lstrip())) + "  " + m.group(2).strip()]
                blocks[no] = {"lines": cur, "ruby": ruby}
                continue
        if cur is not None:
            cur.append(line)
    return blocks


def join_text(lines):
    """ページ幅の折り返しをつなぐ。行内の空白の並びは1つにまとめる"""
    out = ""
    for line in lines:
        s = re.sub(r"[ \t]+", " ", line.strip())
        if not s:
            continue
        # 英数字どうし、英数字と仮名・漢字のあいだは、行の中と同じく半角の空白を入れる（例「平成 28 年」）
        ascii_l, ascii_r = re.match(r"[A-Za-z0-9]", out[-1:] or " "), re.match(r"[A-Za-z0-9]", s[0])
        cjk_l, cjk_r = re.match(r"[぀-ヿ一-鿿]", out[-1:] or " "), re.match(r"[぀-ヿ一-鿿]", s[0])
        if out and ((ascii_l and (ascii_r or cjk_r)) or (cjk_l and ascii_r)):
            out += " "
        out += s
    return out


def is_next_paragraph(line):
    s = line.strip()
    return s.startswith(CONTINUE_PARA) or (len(s) >= 20 and not re.search(r"\S\s{3,}\S", s))


def parse_choices(lines):
    """ア〜エ の位置で選択肢を切り出す。1行に2〜4個並ぶ短い選択肢にも対応"""
    texts = {k: [] for k in LABELS}
    expect = 0
    current = None
    for line in lines:
        if not line.strip() or RUBY_RE.match(line):   # 空行と、選択肢の中のルビ（例「脆」の「ぜい」）はとばす
            continue
        pos = 0
        pieces = []
        while expect < 4:
            label = LABELS[expect]
            m = re.compile(r"(?:^|\s)" + label + r"\s+(?=\S)").search(line, pos)
            if not m:
                break
            pieces.append((m.start(), m.end(), label))
            pos = m.end()
            expect += 1
        if not pieces:
            if current:
                texts[current].append(line)
            continue
        if current and line[: pieces[0][0]].strip():
            texts[current].append(line[: pieces[0][0]])
        for j, (_, end, label) in enumerate(pieces):
            stop = pieces[j + 1][0] if j + 1 < len(pieces) else len(line)
            texts[label].append(line[end:stop])
            current = label
    return [join_text(texts[k]) for k in LABELS], expect == 4


def draft_question(year, no, block):
    lines = block["lines"]
    first_choice = next((i for i, l in enumerate(lines) if CHOICE_START_RE.match(l) and l.strip().startswith("ア")), None)
    head = lines if first_choice is None else lines[:first_choice]
    choice_lines = [] if first_choice is None else lines[first_choice:]

    # 問題文は、最初の「。」で終わる行まで（そのあと選択肢までに残った行は図・表とみなす）。
    # ただし、すぐ後に文章の段落（「なお，」などで始まる行や、大きな空白の無い長い行）が続くときは、改行して問題文に入れる
    paras, extra = [[]], []
    ended = False
    for line in head:
        if ended and not any(l.strip() for l in extra) and is_next_paragraph(line):
            paras.append([])
            ended = False
        if ended:
            extra.append(line)
            continue
        paras[-1].append(line)
        if line.rstrip().endswith("。"):
            ended = True
    extra_text = "\n".join(l.rstrip() for l in extra).strip("\n")
    choices, ok = parse_choices(choice_lines)

    notes = []
    if block["ruby"]:
        notes.append("見出しの上にルビ: " + " ".join(block["ruby"]) + "（問題文にはルビを入れていない）")
    choice_ruby = [l.strip() for l in choice_lines if RUBY_RE.match(l)]
    if choice_ruby:
        notes.append("選択肢の中にルビ: " + " ".join(choice_ruby) + "（選択肢にはルビを入れていない）")
    if not ok:
        notes.append("選択肢を ア〜エ の4つに切り分けられなかった")
    if extra_text.strip():
        notes.append("問題文と選択肢のあいだに図・表らしき行がある（extra を参照）")
    if any(len(re.findall(r"\S\s{3,}\S", l.strip())) >= 2 for l in choice_lines if not CHOICE_START_RE.match(l)):
        notes.append("選択肢の中に表らしき行がある")
    if any(re.match(r"^\s{4,}\S", l) and not CHOICE_START_RE.match(l) and re.search(r"[A-Z]{3,}", l) for l in choice_lines):
        notes.append("選択肢の中で改行に意味がありそう（SQL・プログラムなど）")

    return {
        "id": "FE-%dA-%02d" % (year, no),
        "no": no,
        "q": "\n".join(join_text(p) for p in paras),
        "c": choices,
        "source": "令和%d年度 基本情報技術者試験 科目A 公開問題 問%d" % (reiwa(year), no),
        "needsFigure": bool(extra_text.strip()) or no in FIGURES.get(year, {}),
        "extra": extra_text,
        "notes": notes,
    }


def build_draft(year):
    blocks = split_questions(pdftotext(pdf_path(year, "qs")))
    if sorted(blocks) != list(range(1, 21)):
        sys.exit("問題 PDF から問1〜問20 を切り分けられませんでした: %s" % sorted(blocks))
    answers = read_answers(year)
    out = []
    for no in range(1, 21):
        q = draft_question(year, no, blocks[no])
        q["a"] = answers[no]
        q["answerLabel"] = LABELS[answers[no]]
        out.append(q)
    return out


def cmd_draft(year):
    items = build_draft(year)
    data = {}
    if DRAFT.exists():
        data = json.loads(DRAFT.read_text(encoding="utf-8"))
    data[str(year)] = items
    DRAFT.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("書き出し:", DRAFT.relative_to(ROOT), "（%d年度 %d問）" % (year, len(items)))
    for q in items:
        flags = []
        if q["needsFigure"]:
            flags.append("図・表")
        flags += q["notes"]
        print("  問%-2d 正解 %s  %s" % (q["no"], q["answerLabel"], " / ".join(flags)))


# ---------------------------------------------------------------- 図
def cmd_figures(year):
    out_dir = ROOT / "img" / "fe"
    out_dir.mkdir(parents=True, exist_ok=True)
    for no, (page, x, y, w, h) in sorted(FIGURES.get(year, {}).items()):
        stem = out_dir / ("%s_a%02d" % (prefix(year), no))
        subprocess.run(["pdftoppm", "-r", str(FIGURE_DPI), "-png", "-f", str(page), "-l", str(page),
                        "-x", str(x), "-y", str(y), "-W", str(w), "-H", str(h), "-singlefile",
                        str(pdf_path(year, "qs")), str(stem)], check=True)
        print("切り出し:", stem.with_suffix(".png").relative_to(ROOT))


# ---------------------------------------------------------------- 突き合わせ
JS_STR = r'"(?:[^"\\\n]|\\.)*"'


def read_js_questions(path, year):
    """questions_ipa_fe_a.js から、その年度の問題の id / q / c / a / source を読む（JSON 互換の文字列だけを想定）"""
    src = path.read_text(encoding="utf-8")
    starts = [m for m in re.finditer(r'\bid:\s*"(FE-(\d{4})A-(\d{2}))"', src)]
    found = {}
    for i, m in enumerate(starts):
        end = starts[i + 1].start() if i + 1 < len(starts) else len(src)
        # 次の問題までのうち、この問題のオブジェクトの終わり（クエストの閉じかっこ）までで十分
        chunk = src[m.end():end]
        if int(m.group(2)) != year:
            continue
        no = int(m.group(3))
        if no in found:
            sys.exit("%s が2回あります" % m.group(1))

        def field_str(name):
            fm = re.search(r"\b" + name + r":\s*(" + JS_STR + ")", chunk)
            return json.loads(fm.group(1)) if fm else None

        cm = re.search(r"\bc:\s*\[((?:\s*" + JS_STR + r"\s*,?)*)\s*\]", chunk)
        stripped = re.sub(JS_STR, '""', chunk)
        am = re.search(r"\ba:\s*(\d+)", stripped)
        found[no] = {
            "id": m.group(1),
            "q": field_str("q"),
            "source": field_str("source"),
            "c": [json.loads(s) for s in re.findall(JS_STR, cm.group(1))] if cm else None,
            "a": int(am.group(1)) if am else None,
        }
    return found


def cmd_check(year, path):
    answers = read_answers(year)
    draft = {q["no"]: q for q in build_draft(year)}
    got = read_js_questions(path, year)
    errors, review = [], []
    for no in range(1, 21):
        if no not in got:
            errors.append("問%d が %s にありません" % (no, path.name))
            continue
        q = got[no]
        if q["a"] != answers[no]:
            errors.append("問%d: a=%s（%s）だが、解答 PDF の正解は %s" % (
                no, q["a"], LABELS[q["a"]] if q["a"] is not None and 0 <= q["a"] < 4 else "?", LABELS[answers[no]]))
        else:
            print("  問%-2d a=%d（%s）解答 PDF と一致" % (no, q["a"], LABELS[q["a"]]))
        diffs = []
        if q["q"] is None or norm(q["q"]) != norm(draft[no]["q"]):
            diffs.append("問題文")
        if q["c"] is None or len(q["c"]) != 4:
            errors.append("問%d: 選択肢が4つではありません" % no)
        elif any("切り分けられなかった" in n or "選択肢の中に表らしき行" in n for n in draft[no]["notes"]):
            review.append("問%d: 下書きで選択肢を正しく切り出せない形（図や表の選択肢）なので、選択肢は比較していない。PDF と見くらべて確認" % no)
        else:
            for k in range(4):
                if norm(q["c"][k]) != norm(draft[no]["c"][k]):
                    diffs.append("選択肢" + LABELS[k])
        if diffs:
            modified = (q["source"] or "").endswith("(一部改変)")
            review.append("問%d: %s が PDF の文字と違う%s" % (
                no, "・".join(diffs), "（source に (一部改変) あり）" if modified else "（要確認：見た目だけの違いか、改変なら (一部改変) を付ける）"))
    extra = sorted(set(got) - set(range(1, 21)))
    if extra:
        errors.append("問1〜問20 以外の番号があります: %s" % extra)

    if review:
        print("\nPDF の文字と違う問題（人が確認）:")
        for r in review:
            print("  " + r)
    if errors:
        print("\nNG:")
        for e in errors:
            print("  " + e)
        sys.exit(1)
    print("\nOK: %d年度 科目A 20問の a はすべて解答 PDF と一致" % year)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("command", choices=["fetch", "draft", "figures", "check"])
    ap.add_argument("year", type=int, choices=sorted(FOLDERS))
    ap.add_argument("questions", nargs="?", default=str(QUESTIONS_JS), help="check で調べる問題ファイル")
    args = ap.parse_args()
    if args.command == "fetch":
        cmd_fetch(args.year)
    elif args.command == "draft":
        cmd_draft(args.year)
    elif args.command == "figures":
        cmd_figures(args.year)
    else:
        cmd_check(args.year, Path(args.questions))


if __name__ == "__main__":
    main()
