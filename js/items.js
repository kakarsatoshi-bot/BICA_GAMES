/* =========================================================
 * STUDY QUEST そうび（ぶき・ぼうぐ・アクセサリー）
 * どの そうびも IT・MOS の用語にちなみ、効果は その用語の意味に合わせてある（効果をおぼえる＝用語をおぼえる）。
 * そうびの効果は しょくぎょうの特ちょうと同じ種類（perks。js/avatar.js の先頭を参照）で、ボスに必要な正解の数は変えない。
 * もぎけんてい（本番と同じ条件）では効かない。ぶきの atk は、ダメージの数字と、EXP の小さな上のせ（最大 1割）に使う。
 *   slot   : "weapon" | "armor" | "accessory"
 *   shape  : アイコンの形（ITEM_SHAPES）。ぶきは アバターの手にも持たせる（ITEM_HELD）
 *   rarity : "normal" | "rare" | "super"
 *   course : "ipa_fe" | "mos" | "all"（その対策項目で手に入る）
 *   from   : 手に入れ方 { quest: "クエストid" } 初クリア ／ { level: N } レベル ／ { chest: true } たからばこ ／ { final: true } まおうの城
 *   card   : 解説カード { key: 用語, about: 解説, why: 効果の わけ }
 * ⚠️ key は生徒のセーブに保存される。変えない・消さない（足すのはよい）。
 * 解説は、作り手とは別の確認役（AI）が確かめている（バックアップの方式・ハッシュ・SQL・SWOT・RAID の5件を直した）。
 * ========================================================= */

var ITEMS = [
  /* ===== ぶき ===== */
  { key: "bit_knife", slot: "weapon", shape: "knife", name: "ビットの ナイフ", rarity: "normal", course: "all",
    colors: ["#d7dbe3", "#8c92a4", "#e0c08a"], atk: 6, perks: {}, from: { level: 1 },
    card: { key: "ビット", about: "コンピュータが あつかう情報の、いちばん小さい単位。0 か 1 の どちらか。8ビットで1バイトになる。",
      why: "小さいけれど、すべての情報の もとになる。ぼうけんの はじめの ぶき。" } },
  { key: "byte_sword", slot: "weapon", shape: "sword", name: "バイトの つるぎ", rarity: "normal", course: "all",
    colors: ["#d7dbe3", "#8c92a4", "#b0824a"], atk: 10, perks: {}, from: { level: 5 },
    card: { key: "バイト", about: "8ビットを まとめた単位。1バイトで 256通り（2の8乗）を表せる。半角の英字や数字は、1文字を1バイトで表すことが多い（ASCII コード）。",
      why: "ビット8本ぶんの力を まとめた、ちょっと強い つるぎ。" } },
  { key: "sort_spear", slot: "weapon", shape: "spear", name: "ソートの やり", rarity: "rare", course: "ipa_fe",
    colors: ["#9fd2ff", "#4f8fe0", "#b0824a"], atk: 14, perks: { gaugeCombo: 4 }, from: { quest: "FEA1" },
    card: { key: "整列（ソート）", about: "データを、小さい順（昇順）や大きい順（降順）に並べかえること。バブルソート・選択ソート・挿入ソート・クイックソートなどの方法がある。",
      why: "順番どおりに、つぎつぎ攻撃をつなぐ（コンボ5以上で ひっさつゲージが たまりやすい）。" } },
  { key: "bsearch_bow", slot: "weapon", shape: "bow", name: "二分探索の ゆみ", rarity: "rare", course: "ipa_fe",
    colors: ["#e0c08a", "#7a5528", "#f8f8f8"], atk: 16, perks: { crit: 0.03 }, from: { chest: true },
    card: { key: "二分探索", about: "小さい順などに整列したデータで、まん中の値と くらべて、さがす範囲を半分ずつ しぼりこむ方法。データが n 個なら、くらべる回数は およそ log₂n 回で すむ。",
      why: "半分ずつ しぼりこんで、急所を ねらう（かいしんが 出やすい）。" } },
  { key: "pointer_whip", slot: "weapon", shape: "whip", name: "ポインタの むち", rarity: "rare", course: "ipa_fe",
    colors: ["#b0824a", "#7a5528", "#ffd23b"], atk: 13, perks: { comboKeep: 1 }, from: { chest: true },
    card: { key: "ポインタ・リスト構造", about: "ポインタは、データが ある場所（アドレス）を指すもの。リスト構造では、それぞれのデータに「次のデータの場所」を持たせて、つなげていく。",
      why: "つながりを たどって、コンボを つなぎとめる（1回、まちがえても コンボが半分のこる）。" } },
  { key: "sql_staff", slot: "weapon", shape: "staff", name: "SQLの つえ", rarity: "rare", course: "ipa_fe",
    colors: ["#b0824a", "#7a5528", "#4a8ae0"], atk: 15, perks: { specialMul: 0.1 }, from: { quest: "FEA3" },
    card: { key: "SQL", about: "関係データベースを あつかう言語。SELECT 文で データを取り出し、WHERE で条件を つけ、ORDER BY で並べかえ、GROUP BY で グループに分けて SUM や COUNT などで集計する。",
      why: "命令（じゅもん）を となえて、大きな力を引き出す（ひっさつわざの EXP が ふえる）。" } },
  { key: "hash_sword", slot: "weapon", shape: "sword", name: "ハッシュの つるぎ", rarity: "super", course: "ipa_fe",
    colors: ["#e0a6ff", "#9a5fd6", "#ffd23b"], atk: 22, perks: { crit: 0.04 }, from: { chest: true },
    card: { key: "ハッシュ関数", about: "データから、決まった長さの値（ハッシュ値）を作る関数。元のデータが少しでも変わると ハッシュ値は大きく変わる。セキュリティで使うハッシュ関数では、ハッシュ値から元のデータを求めるのは とても むずかしい。改ざんの検出や、パスワードの保存に使われる。",
      why: "少しの ちがいも 見のがさない、するどい一撃（かいしんが 出やすい）。" } },
  { key: "recursion_boomerang", slot: "weapon", shape: "boomerang", name: "再帰の ブーメラン", rarity: "super", course: "ipa_fe",
    colors: ["#ffd23b", "#b08a18", "#f05252"], atk: 20, perks: { regen: 1 }, from: { quest: "FEB1" },
    card: { key: "再帰", about: "関数の中で、その関数 自身を呼び出すこと。同じ形の小さな問題に分けて解ける。かならず「ここで止まる」条件を決めておかないと、終わらなくなる。",
      why: "投げても 自分のところに もどってくる（1回、3問つづけて正解すると ♥が1つ もどる）。" } },
  { key: "autosum_axe", slot: "weapon", shape: "axe", name: "オートSUMの おの", rarity: "rare", course: "mos",
    colors: ["#d7dbe3", "#8c92a4", "#4fc24f"], atk: 15, perks: { gaugeCombo: 4 }, from: { quest: "XL2" },
    card: { key: "オートSUM", about: "Excel の「Σ（オートSUM）」ボタンを押すと、となりの数値の範囲を自動で選んで、SUM 関数（合計）を入れてくれる。▼から 平均・最大値・最小値・数値の個数 も選べる。",
      why: "まとめて一気に計算する → まとめて攻撃（コンボ5以上で ひっさつゲージが たまりやすい）。" } },
  { key: "vlookup_spear", slot: "weapon", shape: "spear", name: "VLOOKUPの やり", rarity: "rare", course: "mos",
    colors: ["#a6e85e", "#2a8a34", "#b0824a"], atk: 17, perks: { crit: 0.03 }, from: { chest: true },
    card: { key: "VLOOKUP 関数", about: "表の左はしの列から値をさがして、同じ行の、指定した列の値を取り出す関数。4番目の引数を FALSE にすると、ぴったり同じ値だけを さがす（完全一致）。",
      why: "ねらった値を、まっすぐ つらぬいて取り出す（かいしんが 出やすい）。" } },
  { key: "macro_staff", slot: "weapon", shape: "staff", name: "マクロの つえ", rarity: "super", course: "mos",
    colors: ["#b0824a", "#7a5528", "#e0a6ff"], atk: 20, perks: { specialMul: 0.15 }, from: { final: true },
    card: { key: "マクロ", about: "よく行う操作を記録しておき、ボタン1つで くり返し実行できるようにするしくみ。Office では VBA という言語で作られ、マクロを ふくむ Excel ファイルは「.xlsm」で保存する。",
      why: "記録した わざを 一気に くり出す（ひっさつわざの EXP が ふえる）。" } },

  /* ===== ぼうぐ ===== */
  { key: "firewall_shield", slot: "armor", shape: "shield", name: "ファイアウォールの たて", rarity: "rare", course: "ipa_fe",
    colors: ["#f05252", "#9e2b2b", "#ffd23b"], perks: { heartGuard: 1 }, from: { quest: "FEA5" },
    card: { key: "ファイアウォール", about: "外のネットワーク（インターネット）と中のネットワークの あいだで、決めたルールに合う通信だけを通し、ほかを止めるしくみ。",
      why: "あやしい通信（攻撃）を止める（1回、まちがえても ♥が へらない）。" } },
  { key: "encrypt_armor", slot: "armor", shape: "armor", name: "暗号化の よろい", rarity: "rare", course: "ipa_fe",
    colors: ["#9aa0ad", "#5c6270", "#4ae0e0"], perks: { comboKeep: 1 }, from: { chest: true },
    card: { key: "暗号化", about: "データを、鍵を持つ人にしか読めない形に変えること。もとにもどすことを復号という。データを盗まれても、中身を読まれにくくなる。",
      why: "やられても、中身（コンボ）は守られる（1回、コンボが半分のこる）。" } },
  { key: "raid_armor", slot: "armor", shape: "armor", name: "RAIDの よろい", rarity: "super", course: "ipa_fe",
    colors: ["#ffd23b", "#a07f18", "#f8f8f8"], perks: { regen: 1 }, from: { final: true },
    card: { key: "RAID", about: "何台かのディスクを組み合わせて、1台のように使うしくみ。RAID1（ミラーリング）は同じデータを2台に書くので、1台がこわれても使いつづけられる。RAID0（ストライピング）は速くなるが、1台こわれると データを失う。",
      why: "RAID1 のように、1台 こわれても動きつづけて立ち直る（1回、3問つづけて正解すると ♥が1つ回復）。" } },
  { key: "backup_cape", slot: "armor", shape: "cape", name: "バックアップの マント", rarity: "normal", course: "all",
    colors: ["#4f8fe0", "#2b569e", "#ffd23b"], perks: { gaugeOnMiss: 5 }, from: { level: 15 },
    card: { key: "バックアップ", about: "データの写しを、別の場所に保存しておくこと。こわれたり消えたりしたとき、写しから もとにもどせる（リストア）。全部を写すフルバックアップ、さいごのフルバックアップからの変更を写す差分バックアップ、前回のバックアップ（フル・差分・増分のどれか）からの変更だけを写す増分バックアップがある。",
      why: "失敗しても、もどって やり直せる（まちがえても ひっさつゲージが たまる）。" } },
  { key: "absref_shield", slot: "armor", shape: "shield", name: "絶対参照の たて", rarity: "rare", course: "mos",
    colors: ["#4fc24f", "#2a8a34", "#ffd23b"], perks: { comboKeep: 1 }, from: { quest: "XL1" },
    card: { key: "絶対参照", about: "$A$1 のように $ を付けた参照。数式を ほかのセルにコピーしても、参照するセルが動かない。F4 キーで切りかえられる。",
      why: "$ で固定 → コンボが ずれない（1回、まちがえても コンボが半分のこる）。" } },
  { key: "protect_armor", slot: "armor", shape: "armor", name: "シート保護の よろい", rarity: "rare", course: "mos",
    colors: ["#4f8fe0", "#2b569e", "#d7dbe3"], perks: { heartGuard: 1 }, from: { quest: "XL6" },
    card: { key: "シートの保護", about: "「校閲」タブの「シートの保護」を使うと、ロックされたセル（ふつうは全部のセル）を書きかえられなくなる。パスワードを付けることもできる。",
      why: "書きかえ（攻撃）から守る（1回、まちがえても ♥が へらない）。" } },
  { key: "style_cape", slot: "armor", shape: "cape", name: "スタイルの マント", rarity: "rare", course: "mos",
    colors: ["#f078a8", "#b04a78", "#ffd2e8"], perks: { gaugeCombo: 4 }, from: { quest: "WD2" },
    card: { key: "スタイル", about: "「見出し1」などの、書式の組み合わせに名前を付けたもの。まとめて適用でき、スタイルを変えると、そのスタイルの文字が全部いっしょに変わる。見出しスタイルは目次にも使われる。",
      why: "まとめて ととのえる → コンボの力（コンボ5以上で ひっさつゲージが たまりやすい）。" } },

  /* ===== アクセサリー ===== */
  { key: "cache_ring", slot: "accessory", shape: "ring", name: "キャッシュの ゆびわ", rarity: "rare", course: "ipa_fe",
    colors: ["#ffd23b", "#a07f18", "#4ae0e0"], perks: { startGauge: 15 }, from: { quest: "FEA2" },
    card: { key: "キャッシュメモリ", about: "CPU と主記憶の あいだに置く、小さくて速い記憶装置。よく使うデータを置いておき、取りにいく時間を短くする。",
      why: "よく使う力を手もとに置いておく（ひっさつゲージが たまった状態で はじまる）。" } },
  { key: "agile_feather", slot: "accessory", shape: "feather", name: "アジャイルの はね", rarity: "rare", course: "ipa_fe",
    colors: ["#f8f8f8", "#9aa0ad", "#6ee7ff"], perks: { startGauge: 10 }, from: { quest: "FEA6" },
    card: { key: "アジャイル開発", about: "短い期間（スクラムでは スプリント）ごとに、作る・確かめる・直す をくり返して、変化に すばやく対応する開発の進め方。",
      why: "すばやく動き出す（ひっさつゲージが たまった状態で はじまる）。" } },
  { key: "wbs_book", slot: "accessory", shape: "book", name: "WBSの ノート", rarity: "rare", course: "ipa_fe",
    colors: ["#f08c3a", "#b05a1a", "#f8f8f8"], perks: { missionXp: 5 }, from: { quest: "FEA7" },
    card: { key: "WBS", about: "プロジェクトの作業を、だんだん細かい作業に分けて、木のような形に整理したもの（Work Breakdown Structure）。見積りや担当決めの もとになる。",
      why: "やることを分けて整理する → 目標を達成しやすい（ミッション たっせいの EXP が ふえる）。" } },
  { key: "swot_glasses", slot: "accessory", shape: "glasses", name: "SWOTの めがね", rarity: "rare", course: "ipa_fe",
    colors: ["#2a2a3a", "#141423", "#9fd2ff"], perks: { bossXp: 3 }, from: { quest: "FEA8" },
    card: { key: "SWOT分析", about: "自社の 強み（Strength）・弱み（Weakness）と、外部の 機会（Opportunity）・脅威（Threat）を、4つに分けて整理する分析の方法。",
      why: "自分の強み・弱みと、まわりの機会・脅威を見ぬいて、大きな相手に いどむ（ボスに正解したときの EXP が ふえる）。" } },
  { key: "redundancy_pendant", slot: "accessory", shape: "amulet", name: "冗長化の ペンダント", rarity: "rare", course: "ipa_fe",
    colors: ["#4ae0e0", "#2a8a8a", "#f8f8f8"], perks: { comboKeep: 1 }, from: { chest: true },
    card: { key: "冗長化", about: "予備の装置や回線を用意しておき、1つが止まっても システム全体が止まらないようにすること。",
      why: "予備があるので、ぜんぶは切れない（1回、まちがえても コンボが半分のこる）。" } },
  { key: "log_book", slot: "accessory", shape: "book", name: "ログの メモちょう", rarity: "normal", course: "all",
    colors: ["#e0c08a", "#7a5528", "#141423"], perks: { reviewXp: 1.1 }, from: { level: 10 },
    card: { key: "ログ", about: "システムの動きや、だれが いつ 何をしたかの記録。あとから問題の原因を調べたり、不正なアクセスを見つけたりするのに使う。",
      why: "記録を ふりかえる → 復習に強い（復習の EXP が 1わり ふえる）。" } },
  { key: "filter_ring", slot: "accessory", shape: "ring", name: "フィルターの ゆびわ", rarity: "rare", course: "mos",
    colors: ["#d7dbe3", "#8c92a4", "#f078a8"], perks: { shiny: 1.5 }, from: { quest: "XL4" },
    card: { key: "フィルター", about: "条件に合う行だけを表示して、ほかの行を一時的に かくす機能。かくれた行は消えていないので、解除すると もとにもどる。",
      why: "たくさんの中から、めずらしいものを見つけ出す（色ちがい・激レアに 出会いやすい）。" } },
  { key: "shortcut_boots", slot: "accessory", shape: "boots", name: "ショートカットの くつ", rarity: "rare", course: "mos",
    colors: ["#f05252", "#9e2b2b", "#f8f8f8"], perks: { crit: 0.02 }, from: { quest: "WD1" },
    card: { key: "ショートカットキー", about: "キーボードだけで操作を呼び出す キーの組み合わせ。Ctrl＋S（上書き保存）、Ctrl＋Z（元に戻す）、Ctrl＋B（太字）など。",
      why: "すばやい操作で、急所に とどく（かいしんが 出やすい）。" } },
  { key: "track_book", slot: "accessory", shape: "book", name: "変更履歴の ノート", rarity: "rare", course: "mos",
    colors: ["#4f8fe0", "#2b569e", "#f05252"], perks: { reviewXp: 1.1 }, from: { quest: "WD5" },
    card: { key: "変更履歴", about: "Word の「校閲」タブの「変更履歴の記録」を オンにすると、だれが どこを直したかが記録される。あとで1つずつ「承諾」して反映できる。",
      why: "直したあとを ふりかえる → 復習に強い（復習の EXP が 1わり ふえる）。" } },
  { key: "undo_amulet", slot: "accessory", shape: "amulet", name: "Ctrl+Zの おまもり", rarity: "super", course: "mos",
    colors: ["#ffd23b", "#a07f18", "#f05252"], perks: { heartGuard: 1 }, from: { chest: true },
    card: { key: "元に戻す（Ctrl＋Z）", about: "直前の操作を取り消して、前の状態に もどす機能。取り消した操作を もう一度やるのは「やり直し」（Ctrl＋Y）。",
      why: "まちがいを1回とりけす（1回、まちがえても ♥が へらない）。" } }
];

/* アイコンの形（10×10）。1=本体 2=かげ 3=アクセント W=白 B=りんかく */
var ITEM_SHAPES = {
  knife:     ["..........", "........B.", ".......B1B", "......B1B.", ".....B1B..", "....B1B...", "...B3B....", "..B3B.....", ".B3B......", "..B......."],
  sword:     [".......BB.", "......B11B", ".....B11B.", "....B11B..", "...B11B...", ".B.B1B....", "..B2B.....", ".B3BB.....", "B3B.......", ".B........"],
  spear:     ["......BBB.", ".....B111B", "......B11B", ".....B3B1B", "....B3B.B.", "...B3B....", "..B3B.....", ".B3B......", "B3B.......", ".B........"],
  bow:       ["...BBB....", "..B11WB...", ".B1B..W...", ".B1B...W..", "B1B....W..", "B1B....W..", ".B1B...W..", ".B1B..W...", "..B11WB...", "...BBB...."],
  whip:      ["......BB..", ".....B11B.", "....B1BB1B", "...B1B..B1", "...B1B...B", "....B1B...", ".....B1B..", "....B3B...", "...B3B....", "....B....."],
  staff:     ["...BBB....", "..B333B...", "..B3W3B...", "..B333B...", "...B1B....", "...B1B....", "...B1B....", "...B1B....", "...B1B....", "...BBB...."],
  boomerang: ["..........", ".BBBBB....", "B11111B...", "B1BBB11B..", ".B...B11B.", ".....B11B.", "......B11B", "......B11B", ".......BB.", ".........."],
  axe:       ["....BBB...", "...B111B..", "..B1111B..", "..B111BB..", "...BBB1B..", ".....B2B..", ".....B2B..", ".....B2B..", ".....B2B..", ".....BB..."],
  shield:    ["..BBBBBB..", ".B111111B.", "B11133111B", "B11133111B", "B13333331B", "B11133111B", ".B113311B.", ".B111111B.", "..B1111B..", "...BBBB..."],
  armor:     ["..BB..BB..", ".B11BB11B.", "B11111111B", "B1B1331B1B", "BB113311BB", ".B111111B.", ".B111111B.", ".B122221B.", ".B111111B.", "..BBBBBB.."],
  cape:      ["...BBBB...", "..B3333B..", ".B111111B.", ".B111111B.", "B11111111B", "B11111111B", "B11111111B", "B11111111B", "B12121212B", ".BBBBBBBB."],
  ring:      ["....BB....", "...B33B...", "...B33B...", "..BBBBBB..", ".B111111B.", "B11BBBB11B", "B1B....B1B", "B11BBBB11B", ".B111111B.", "..BBBBBB.."],
  feather:   [".......BB.", "......B3B.", ".....B3W3B", "....B3W3B.", "...B3W3B..", "..B3W3B...", ".B3W3B....", ".B3WB.....", "B1BB......", "BB........"],
  book:      [".BBBBBBBB.", "B11111111B", "B1WWWWWW1B", "B1W3333W1B", "B1WWWWWW1B", "B1W3333W1B", "B1WWWWWW1B", "B11111111B", "B22222222B", ".BBBBBBBB."],
  glasses:   ["..........", "..........", "BBBBBBBBBB", "B33BBB33BB", "B33B1B33B.", "BBBB.BBBB.", "..........", "..........", "..........", ".........."],
  amulet:    ["..B....B..", "...B..B...", "....BB....", "...B33B...", "..B3113B..", ".B311113B.", ".B311113B.", "..B3113B..", "...B33B...", "....BB...."],
  boots:     ["..........", "..BBBB....", "..B11B....", "..B11B....", "..B11B....", "..B11BBB..", ".B1111WB..", "B11111WBB.", "B2222222B.", "BBBBBBBBB."]
};
/* アバターの手に持たせる ぶき（アバターの 12〜15列・6〜16行に重ねる。1=本体 2=かげ 3=柄） */
var ITEM_HELD = {
  knife:     { 6: "....", 7: "....", 8: "....", 9: "....", 10: "....", 11: ".1..", 12: ".1..", 13: ".1..", 14: "22..", 15: ".3..", 16: "...." },
  sword:     { 6: ".1..", 7: ".1..", 8: ".1..", 9: ".1..", 10: ".1..", 11: ".1..", 12: ".1..", 13: ".1..", 14: "222.", 15: ".3..", 16: ".3.." },
  spear:     { 6: ".1..", 7: "111.", 8: ".3..", 9: ".3..", 10: ".3..", 11: ".3..", 12: ".3..", 13: ".3..", 14: ".3..", 15: ".3..", 16: ".3.." },
  bow:       { 6: "....", 7: "..1.", 8: "...1", 9: "...1", 10: "...1", 11: "...1", 12: "...1", 13: "...1", 14: "..1.", 15: ".3..", 16: "...." },
  whip:      { 6: "....", 7: "....", 8: "..1.", 9: "...1", 10: "..1.", 11: ".1..", 12: ".1..", 13: ".1..", 14: ".3..", 15: ".3..", 16: "...." },
  staff:     { 6: ".3..", 7: "333.", 8: ".3..", 9: ".2..", 10: ".2..", 11: ".2..", 12: ".2..", 13: ".2..", 14: ".2..", 15: ".2..", 16: ".2.." },
  boomerang: { 6: "....", 7: "....", 8: "....", 9: "....", 10: "....", 11: "111.", 12: "1...", 13: "1...", 14: "....", 15: "....", 16: "...." },
  axe:       { 6: "....", 7: ".111", 8: ".111", 9: ".11.", 10: ".2..", 11: ".2..", 12: ".2..", 13: ".2..", 14: ".2..", 15: ".2..", 16: ".2.." }
};
var ITEM_SLOTS = [["weapon", "ぶき"], ["armor", "ぼうぐ"], ["accessory", "アクセサリー"]];
var ITEM_RARITY = { normal: { label: "ノーマル", stars: "★" }, rare: { label: "レア", stars: "★★" }, super: { label: "スーパーレア", stars: "★★★" } };

function itemDef(key) {
  for (var i = 0; i < ITEMS.length; i++) if (ITEMS[i].key === key) return ITEMS[i];
  return null;
}
/* そうびの アイコンを canvas に描く（もっていないものは 影だけ） */
function drawItemIcon(canvas, item, scale, silhouette) {
  var rows = ITEM_SHAPES[item.shape];
  canvas.width = 10 * scale;
  canvas.height = 10 * scale;
  var ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  var col = { 1: item.colors[0], 2: item.colors[1], 3: item.colors[2], W: SPRITE_WHITE, B: SPRITE_BLACK };
  for (var y = 0; y < 10; y++) {
    for (var x = 0; x < 10; x++) {
      var ch = rows[y][x];
      if (ch === ".") continue;
      ctx.fillStyle = silhouette ? "#2a2a4a" : col[ch];
      ctx.fillRect(x * scale, y * scale, scale, scale);
    }
  }
}

/* ---------- セット（同じシリーズの そうびを ぜんぶ そうびすると、アバターが光り、セットの効果がつく） ----------
 * セットの効果も、ボスに必要な正解の数は変えない。もぎけんていでは効かない。解説は確認役が確かめている。 */
var ITEM_SETS = [
  { key: "cia", name: "CIA セット（情報セキュリティの3要素）", pieces: ["encrypt_armor", "hash_sword", "redundancy_pendant"],
    glow: "#6ee7ff", perks: { heartGuard: 1 },
    card: { key: "情報セキュリティの3要素（CIA）",
      about: "情報セキュリティでは、機密性（Confidentiality：見てよい人だけが見られる）・完全性（Integrity：まちがいや改ざんが無い）・可用性（Availability：使いたいときに使える）の3つを守ることが大切とされる。頭文字をとって CIA という。暗号化は機密性、ハッシュによる改ざんの検出は完全性、冗長化は可用性を守る方法。",
      why: "3つの要素が そろうと、守りが かたくなる（1回、まちがえても ♥が へらない）。" } },
  { key: "excel", name: "エクセル マスター セット", pieces: ["autosum_axe", "absref_shield", "filter_ring"],
    glow: "#6ef08c", perks: { gaugeCombo: 4 },
    card: { key: "Excel の基本の わざ",
      about: "オートSUM（すばやく合計する）・絶対参照（コピーしても参照がずれない）・フィルター（必要な行だけ表示する）は、表の計算とデータの整理で よく使う Excel の基本の機能。",
      why: "計算・参照・整理の わざが そろうと、つぎつぎ れんけいできる（コンボ5以上で ひっさつゲージが たまりやすい）。" } },
  { key: "word", name: "ワードの たつじん セット", pieces: ["style_cape", "track_book"],
    glow: "#9fd2ff", perks: { reviewXp: 1.15 },
    card: { key: "Word の文書づくりの わざ",
      about: "スタイル（見出しなどの書式をまとめて ととのえる）と 変更履歴（だれが どこを直したかを記録する）は、長い文書を作ったり、ほかの人と いっしょに直したりするときに役立つ Word の機能。",
      why: "書式を ととのえ、直したあとを ふりかえる（復習の EXP が ふえる）。" } }
];
function setDef(key) {
  for (var i = 0; i < ITEM_SETS.length; i++) if (ITEM_SETS[i].key === key) return ITEM_SETS[i];
  return null;
}
