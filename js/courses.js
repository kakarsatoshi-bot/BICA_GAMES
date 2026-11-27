/* =========================================================
 * 対策項目（コース）の定義
 * タイトル → 登録 → 「対策項目を えらぶ」→ その項目のメニュー、の順で使う。
 *
 * - subjects : その項目の科目（QUEST_DATA_* の形。クエストと問題が入っている）
 * - exams    : もぎけんていの構成。key は save.exams のキー（excel / word は変えない）
 *              minutes はフェーズ2のタイマー用（まだ使わない）
 * - menu     : メニューに出すボタンの順番。"subject:<科目キー>" は科目ボタン（JS で作る）
 * - vocabLink: タイトルに MOS単語帳のリンクを出すか
 * - countdown: GAME_CONFIG.EXAM_DATES の試験日カウントダウンを出すか（MOS だけ）
 * - scopes   : （任意）復習・まおうの城・めいきゅう・もぎけんていの「はんい」の選択肢。
 *              subjects は科目キーの配列。問題の入っている科目が2つ以上のときだけ、メニューに選択ボタンが出る。
 *              えらんだ はんいは save.scopes[項目のキー] に保存する（key は変えない）
 *
 * 経験値・レベル・称号・実績・図鑑・ミッションは項目をまたいで共通（1人1セーブ）。
 * ⚠️ key（"mos" / "ipa_fe"）は save.course に保存されるので変えない。
 * 表示する項目は config.js の GAME_CONFIG.COURSES でしぼれる（1つだけなら選択画面を飛ばす）。
 * 問題が1問も入っていない項目は、COURSES に書いてあっても出さない。
 * ========================================================= */
/* IPA 基本情報の問題ファイル（フェーズ3の js/questions_ipa_fe_a.js）がまだ無いときは、空の科目にしておく。
 * 問題が1問も無い対策項目は、選択画面に出さない（availableCourses() 参照）。 */
window.QUEST_DATA_FE_A = window.QUEST_DATA_FE_A || { subject: "fe_a", label: "科目A の まち", quests: [] };
window.QUEST_DATA_FE_B = window.QUEST_DATA_FE_B || { subject: "fe_b", label: "科目B の 道場", quests: [] };

var COURSES = [
  {
    key: "mos", label: "MOS", sub: "ワード・エクセル", icon: "🗼",
    logo: "MOS", subtitle: "〜 ワード・エクセル ぼうけんの書 〜", copy: "BICA MOS対策クエスト",
    desc: "MOS（Word・Excel）の 試験対策",
    subjects: [QUEST_DATA_EXCEL, QUEST_DATA_WORD],
    exams: [ { key: "excel", label: "Excel もぎけんてい", subject: "excel", count: 20, pass: 700, shape: "wizard", palette: "green" },
             { key: "word",  label: "Word もぎけんてい",  subject: "word",  count: 20, pass: 700, shape: "wizard", palette: "blue" } ],
    menu: ["subject:excel", "subject:word", "review", "final", "expert", "endless", "exam", "practical", "ranking", "status"],
    finalText: "MOSの ちしきが せかいを すくった！\nきみこそ しんの MOSマスターだ！",
    vocabLink: true,
    countdown: true
  },
  {
    key: "ipa_fe", label: "IPA 基本情報", sub: "基本情報技術者試験", icon: "💻",
    logo: "IPA", subtitle: "〜 基本情報技術者 ぼうけんの書 〜", copy: "BICA 基本情報技術者試験 対策クエスト",
    desc: "IPA 基本情報技術者試験（科目A・科目B）の 対策",
    subjects: [QUEST_DATA_FE_A, QUEST_DATA_FE_B],
    exams: [ { key: "fe_a", label: "科目A もぎしけん", subject: "fe_a", count: 20, pass: 600, minutes: 30, shape: "wizard", palette: "purple",
               note: "本試験は IRT 方式で採点されるため、この点数は 正答率からの めやす です" },
             /* 本試験の科目B は 20問100分。6問なら 30分が同じペース */
             { key: "fe_b", label: "科目B もぎしけん", subject: "fe_b", count: 6, pass: 600, minutes: 30, shape: "wizard", palette: "dark",
               note: "本試験は IRT 方式で採点されるため、この点数は 正答率からの めやす です" } ],
    menu: ["subject:fe_a", "subject:fe_b", "review", "final", "endless", "exam", "ranking", "status"],
    scopes: [ { key: "all", label: "A＋B（まぜる）", subjects: ["fe_a", "fe_b"] },
              { key: "fe_a", label: "科目A だけ", subjects: ["fe_a"] },
              { key: "fe_b", label: "科目B だけ", subjects: ["fe_b"] } ],
    finalText: "IT の ちしきが せかいを すくった！\nきみこそ しんの じょうほう マスターだ！",
    vocabLink: false,
    countdown: false
  }
];

/* 科目ボタンの見た目（メニューの "subject:<科目キー>"） */
var SUBJECT_BUTTONS = {
  excel: { icon: "🗼", label: "エクセルの とう" },
  word:  { icon: "🏰", label: "ワードの しろ" },
  fe_a:  { icon: "💻", label: "科目A の まち" },
  fe_b:  { icon: "📜", label: "科目B の 道場" }
};
