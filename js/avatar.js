/* =========================================================
 * STUDY QUEST アバター と ITの しょくぎょう
 * アバターは 16×20 のドット絵を、体 → 職業の服 → 目 → 髪 → かぶりもの の順に重ねて描く。
 * 文字マップ: B=りんかく S=はだ s=はだのかげ W=白 K=ひとみ H=髪 h=髪のかげ
 *             O=服 o=服のかげ A=服のアクセント P=ズボン X=くつ G/g=ヘッドホン L=メガネ .=透明
 * ⚠️ AVATAR_PARTS と JOBS の key は、生徒のセーブに保存される。変えない・消さない（足すのはよい）。
 * ========================================================= */

var AVATAR_W = 16, AVATAR_H = 20;

var AVATAR_BODY = [
  "................",
  "................",
  "................",
  ".....BBBBBB.....",
  "....BSSSSSSB....",
  "...BSSSSSSSSB...",
  "...BSSSSSSSSB...",
  "...BSSSSSSSSB...",
  "...BSSSSSSSSB...",
  "...BsSSSSSSsB...",
  "....BSSssSSB....",
  ".....BBSSBB.....",
  "....BSSSSSSB....",
  "...BSSSSSSSSB...",
  "..BSBSSSSSSBSB..",
  "..BSBSSSSSSBSB..",
  "..BBBSSSSSSBBB..",
  "....BSSSSSSB....",
  "....BSSBBSSB....",
  "....XXX..XXX...."
];

/* えらべるパーツ（label は画面に出す名前） */
var AVATAR_PARTS = {
  hair: [
    { key: "short", label: "ショート", rows: {
      2: ".....BBBBBB.....", 3: "....BHHHHHHB....", 4: "...BHHHHHHHHB...", 5: "...BHHhHHhHHB...", 6: "...BH......HB..." } },
    { key: "long", label: "ロング", rows: {
      2: ".....BBBBBB.....", 3: "....BHHHHHHB....", 4: "...BHHHHHHHHB...", 5: "..BHHHhHHhHHHB..", 6: "..BHH......HHB..",
      7: "..BH........HB..", 8: "..BH........HB..", 9: "..BH........HB..", 10: "..BHB......BHB..", 11: "..BHB......BHB..", 12: "...B........B..." } },
    { key: "spiky", label: "ツンツン", rows: {
      0: "....B..B..B.....", 1: "...BHBBHBBHB....", 2: "...BHHHHHHHHB...", 3: "...BHHHHHHHHHB..", 4: "..BHHHHHHHHHHB..",
      5: "...BHhHHhHHhB...", 6: "...BH......HB..." } },
    { key: "pony", label: "ポニーテール", rows: {
      2: ".....BBBBBB.....", 3: "....BHHHHHHBB...", 4: "...BHHHHHHHHHB..", 5: "...BHHhHHHHHBHB.", 6: "...BH......HBHB.",
      7: "............BHB.", 8: "............BHB.", 9: ".............B.." } },
    { key: "bun", label: "おだんご", rows: {
      0: "......BBBB......", 1: ".....BHHHHB.....", 2: ".....BBBBBB.....", 3: "....BHHHHHHB....", 4: "...BHHHHHHHHB...",
      5: "...BHhHHHHhHB...", 6: "...BH......HB..." } }
  ],
  hairColor: [
    { key: "black", label: "くろ", colors: ["#34344a", "#1c1c2c"] },
    { key: "brown", label: "ちゃいろ", colors: ["#8a5530", "#5a3418"] },
    { key: "blonde", label: "きんいろ", colors: ["#f2d266", "#c4a43a"] },
    { key: "red", label: "あか", colors: ["#d8503c", "#9a2e22"] },
    { key: "blue", label: "あお", colors: ["#4f80dc", "#2c4c9c"] },
    { key: "pink", label: "ピンク", colors: ["#f28cc2", "#b4568a"] },
    { key: "silver", label: "ぎんいろ", colors: ["#cdd2de", "#8c92a4"] },
    { key: "green", label: "みどり", colors: ["#4cbc6c", "#2c7c44"] }
  ],
  skin: [
    { key: "light", label: "あかるい", colors: ["#ffd9b8", "#e8ae86"] },
    { key: "medium", label: "ふつう", colors: ["#f0bf8c", "#c88e5c"] },
    { key: "tan", label: "こんがり", colors: ["#c98c5a", "#9a6238"] },
    { key: "dark", label: "こい", colors: ["#8c5c3a", "#60391f"] }
  ],
  eyes: [
    { key: "normal", label: "ぱっちり", rows: { 7: "...B.WK..WK.B..." } },
    { key: "dot", label: "てんてん", rows: { 7: "...B..K..K..B..." } },
    { key: "smile", label: "にっこり", rows: { 6: "...B.K.K.K.KB...", 7: "...B........B..." } },
    { key: "glasses", label: "メガネ", rows: { 6: "....LLL..LLL....", 7: "....LWKLLWKL...." } }
  ]
};
var AVATAR_PART_ORDER = [
  ["hair", "かみがた"], ["hairColor", "かみの いろ"], ["skin", "はだの いろ"], ["eyes", "め"]
];

/* 服とかぶりものの形（しょくぎょうで使い回す） */
var OUTFIT_HOODIE = {
      12: "....BOOAAOOB....", 13: "...BOOOAAOOOB...", 14: "..BOBOOOOOOBOB..", 15: "..BSBOOOOOOBSB..",
      16: "..BBBoOOOOoBBB..", 17: "....BPPPPPPB....", 18: "....BPPBBPPB...."
    };
var OUTFIT_JACKET = {
      12: "....BOOOOOOB....", 13: "...BOOOOOAOOB...", 14: "..BOBOOOOAAOBOB.", 15: "..BSBOOOOOOBSB..",
      16: "..BBBoOOOOoBBB..", 17: "....BPPPPPPB....", 18: "....BPPBBPPB...."
    };
var OUTFIT_VEST = {
      12: "....BAOOOOAB....", 13: "...BAAOOOOAAB...", 14: "..BOBAAOOAABOB..", 15: "..BSBAAOOAABSB..",
      16: "..BBBAAOOAABBB..", 17: "....BPPPPPPB....", 18: "....BPPBBPPB...."
    };
var OUTFIT_COAT = {
      12: "....BOOooOOB....", 13: "...BOOOooOAOB...", 14: "..BOBOOooOOBOB..", 15: "..BSBOOooOOBSB..",
      16: "..BOBOOooOOBOB..", 17: "....BOOPPOOB....", 18: "....BPPBBPPB...."
    };
var OUTFIT_SUIT = {
      12: "....BOOWWOOB....", 13: "...BOOOAAOOOB...", 14: "..BOBOOOAOOBOB..", 15: "..BSBOOOAOOBSB..",
      16: "..BBBOOOOOOBBB..", 17: "....BPPPPPPB....", 18: "....BPPBBPPB...."
    };
var OUTFIT_CAPE = {
      11: "...BAABSSBAAB...", 12: "..BOOBWWWWBOOB..", 13: "..BOOBWAAWBOOB..", 14: "..BOOBWWWWBOOB..",
      15: "..BOOSWWWWSOOB..", 16: "..BOOBWWWWBOOB..", 17: "..BoOBPPPPBOoB..", 18: "..BBBBPBBPBBBB.."
    };
var OUTFIT_STRIPE = {
      12: "....BOOOOOOB....", 13: "...BOAAAAAAOB...", 14: "..BOBOOOOOOBOB..", 15: "..BSBAAAAAABSB..",
      16: "..BBBOOOOOOBBB..", 17: "....BPPPPPPB....", 18: "....BPPBBPPB...."
    };
var HEADGEAR_PHONES = {
      1: ".....GGGGGG.....", 2: "....G......G....", 3: "...G........G...", 4: "...G........G...",
      5: "..GGg......gGG..", 6: "..GGg......gGG..", 7: "..GG........GG.."
    };
var HEADGEAR_HEADSET = {
      1: ".....GGGGGG.....", 2: "....G......G....", 3: "...G........G...", 4: "...G........G...",
      5: "..GGg......gGG..", 6: "..GGg......gGG..", 7: "..GG........GG..", 8: "..G.............", 9: "..GGg..........."
    };

/* ---------- ITの しょくぎょう ----------
 * 特ちょう（perks）は、ボスを倒すのに必要な正解の数を変えない（正解の数＝勉強の量を守る）。
 * もぎけんてい（本番と同じ条件）では、どの特ちょうも効かない。上のレベルの しょくぎょうほど、特ちょうを いくつも持つ。
 * perks の種類（数値は js/game.js が使う）:
 *   gaugeCombo  コンボ5以上の正解で、ひっさつゲージに上のせ    heartGuard  1回の戦闘で N回、まちがえても ♥が へらない
 *   comboKeep   1回の戦闘で N回、まちがえても コンボが半分のこる  reviewXp    復習の EXP の倍率
 *   missionXp   ミッション たっせいの EXP に上のせ              crit        かいしんの確率に上のせ
 *   shiny       色ちがい・激レアの出やすさ（倍率）                gaugeOnMiss まちがえたときも ひっさつゲージが たまる
 *   regen       1回の戦闘で N回、3問つづけて正解すると ♥が1つ回復  startGauge  たたかいの はじめに ひっさつゲージ
 *   chestLuck   たからばこで しょうごう・色ちがいが出やすい        specialMul  ひっさつわざの EXP 倍率に上のせ
 *   bossXp      ボスに正解したときの EXP に上のせ
 * fields は、その しょくぎょうの「とくい分野」（IPA 基本情報の問題の field）。とくい分野の問題は EXP が ふえ、「しれん」でも出す。
 * mosSubjects は、MOS の とくいな科目（"excel" / "word"）。bestFor は「むいている ばしょ」（解説カードに出す）。
 * headColors は、かぶりもの（G・g）の色。無ければ ヘッドホンの色。 */
var JOBS = [
  /* ===== Lv 1 ===== */
  {
    key: "programmer", name: "プログラマー", level: 1,
    colors: ["#5a6a8a", "#3a4660", "#f0f0f8", "#2a2a40"],
    outfit: OUTFIT_HOODIE, headgear: HEADGEAR_PHONES,
    perks: { gaugeCombo: 8 },
    perkName: "じどうかの ちから",
    perk: "コンボ 5いじょうで せいかいすると、ひっさつゲージが いつもより たまる。",
    perkWhy: "同じ作業をくり返すときは、プログラムで自動化すると速い。くり返し（コンボ）に強い しょくぎょう。",
    about: "設計書をもとに、コンピュータへの命令（プログラム）を書く仕事。書いたプログラムが正しく動くかをテストし、まちがい（バグ）を見つけて直す（デバッグ）。",
    exam: "科目B の「アルゴリズムとプログラミング」（擬似言語のプログラムを読む問題）。科目A でも、流れ図・配列・探索・整列・再帰などが出る。",
    bestFor: "科目B の道場（プログラムの問題が つづく）",
    mosSubjects: [],
    fields: ["アルゴリズムとプログラミング", "ソフトウェア開発管理技術", "システム開発技術"]
  },
  {
    key: "security", name: "セキュリティエンジニア", level: 1,
    colors: ["#2a3a72", "#1a2450", "#f0c040", "#2a2a40"],
    outfit: OUTFIT_JACKET,
    perks: { heartGuard: 1 },
    perkName: "まもりの かまえ",
    perk: "1回の たたかいで 1回だけ、まちがえても ♥が へらない。",
    perkWhy: "不正アクセスやウイルスから、システムと情報を守るのが仕事。攻撃を1回ふせぐ。",
    about: "不正アクセスやコンピュータウイルスなどから、システムと情報を守る仕事。システムの弱いところ（脆弱性）を調べたり、守るための対策を考えたりする。国家試験「情報処理安全確保支援士試験」もある。",
    exam: "「情報セキュリティ」（暗号・認証・攻撃の手口と対策など）。科目B の問6 は、情報セキュリティの事例の問題。",
    bestFor: "むげんの めいきゅう（長く たたかう）・セキュリティの問題",
    mosSubjects: [],
    fields: ["セキュリティ"]
  },
  {
    key: "network", name: "ネットワークエンジニア", level: 1,
    colors: ["#eef0f6", "#c8ccd8", "#f08c3a", "#3a3a5a"],
    outfit: OUTFIT_VEST,
    perks: { comboKeep: 1 },
    perkName: "つうしんの あんてい",
    perk: "1回の たたかいで 1回だけ、まちがえても コンボが ぜんぶは きれず、半分 のこる。",
    perkWhy: "ネットワークは、一部がこわれても通信が止まらないように、予備の道（冗長化）を用意しておく。",
    about: "コンピュータどうしをつなぐネットワークを設計して組み立て、止まらないように見守る（運用・監視する）仕事。",
    exam: "「ネットワーク」（IP アドレス・プロトコル・LAN など）と、コンピュータやハードウェアのしくみ。",
    bestFor: "長い クエスト（コンボを まもる）",
    mosSubjects: [],
    fields: ["ネットワーク", "コンピュータ構成要素", "ハードウェア", "ソフトウェア"]
  },
  {
    key: "database", name: "データベースエンジニア", level: 1,
    colors: ["#eef2fa", "#b8c4d8", "#4a8ae0", "#3a3a5a"],
    outfit: OUTFIT_COAT,
    perks: { reviewXp: 1.1 },
    perkName: "データの せいり",
    perk: "ふっかつのほこら（復習）で もらえる EXP が 1わり ふえる。",
    perkWhy: "たくさんのデータを整理しなおして、必要なときにすぐ取り出せるようにするのが仕事。おぼえたことの整理（復習）に強い。",
    about: "たくさんのデータを整理して保存し、速く正しく取り出せるデータベースを設計・管理する仕事。",
    exam: "「データベース」（関係データベース・正規化・SQL・トランザクションなど）。",
    bestFor: "ふっかつのほこら（復習）",
    mosSubjects: ["excel"],
    fields: ["データベース"]
  },
  /* ===== Lv 10 ===== */
  {
    key: "web", name: "Webデザイナー", level: 10,
    colors: ["#3ab8a8", "#24857a", "#f078a8", "#3a3a5a"],
    outfit: OUTFIT_STRIPE,
    headgear: { 1: ".....GGGGGG.....", 2: "....GGGGGGGGG...", 3: "...GGgGGGGGGGG.." },
    headColors: ["#d04a6a", "#a02a4a"],
    perks: { shiny: 2 },
    perkName: "いろの センス",
    perk: "色ちがい・激レアの モンスターに 2ばい 出会いやすい。",
    perkWhy: "色やレイアウトなど、見た目と使いやすさを考えるのが仕事。めずらしい色に すぐ気づく。",
    about: "Web サイトの見た目（色・文字・レイアウト）と、使いやすさを考えて作る仕事。だれにでも分かりやすく使える画面（ユーザビリティ・アクセシビリティ）も大切にする。",
    exam: "「ヒューマンインタフェース」「マルチメディア」（画面の作り方・使いやすさ・画像や音のデータ）。",
    bestFor: "クエストの くりかえし（色ちがい・図鑑あつめ）",
    mosSubjects: ["word"],
    fields: ["マルチメディア", "ソフトウェア"]
  },
  {
    key: "tester", name: "テストエンジニア", level: 10,
    colors: ["#f2f4f8", "#c8ccd8", "#4cb050", "#3a3a5a"],
    outfit: OUTFIT_VEST,
    headgear: { 2: "....BBBBBBB.....", 3: "...BGGGGGGGB....", 4: "...BGGGGGGGGGG.." },
    headColors: ["#4cb050", "#2c7c34"],
    perks: { gaugeOnMiss: 6 },
    perkName: "バグは たからもの",
    perk: "まちがえたときも、ひっさつゲージが すこし たまる。",
    perkWhy: "テストで見つかったまちがい（バグ）は、品質を良くするための大切な手がかり。まちがいも力に変える。",
    about: "できあがったソフトウェアが、決められたとおりに正しく動くかを確かめる（テストする）仕事。テストの計画を立て、まちがい（バグ）を見つけて報告する。",
    exam: "「システム開発技術」（単体テスト・結合テスト・ブラックボックステスト・ホワイトボックステストなど）と「ソフトウェア開発管理技術」。",
    bestFor: "科目B の道場（むずかしい問題でも ゲージが たまる）",
    mosSubjects: [],
    fields: ["システム開発技術", "ソフトウェア開発管理技術"]
  },
  {
    key: "support", name: "ITサポート", level: 10,
    colors: ["#4a8ae0", "#2b569e", "#f8f8f8", "#3a3a5a"],
    outfit: OUTFIT_JACKET, headgear: HEADGEAR_HEADSET,
    perks: { regen: 1 },
    perkName: "ふっきゅうの て",
    perk: "1回の たたかいで 1回だけ、3もん つづけて せいかいすると ♥が 1つ かいふくする。",
    perkWhy: "パソコンやシステムで困った人を助け、元どおり使えるように直す（復旧する）のが仕事。",
    about: "社内や お客さんの「パソコンが動かない」「使い方が分からない」といった問い合わせに答えて、困りごとを解決する仕事（ヘルプデスク・サービスデスク）。",
    exam: "「サービスマネジメント」（サービスデスク・インシデント管理・問題管理など）。",
    bestFor: "むげんの めいきゅう（♥を かいふく）",
    mosSubjects: [],
    fields: ["サービスマネジメント"]
  },
  /* ===== Lv 20 ===== */
  {
    key: "pm", name: "プロジェクトマネージャ", level: 20,
    colors: ["#343a52", "#222638", "#d04a4a", "#262a3c"],
    outfit: OUTFIT_SUIT,
    perks: { missionXp: 5 },
    perkName: "けいかくの ちから",
    perk: "きょうの ミッションを たっせいしたときの ボーナス EXP が ふえる。",
    perkWhy: "計画を立てて、予定どおりに進めるのが仕事。決めた目標（ミッション）を達成するのが得意。",
    about: "システムを作るプロジェクトの計画を立て、予定・費用・品質・メンバーを管理して、完成までみちびく仕事。国家試験「プロジェクトマネージャ試験」もある。",
    exam: "「プロジェクトマネジメント」（WBS・アローダイアグラム・クリティカルパス・見積りなど）。",
    bestFor: "きょうの ミッション",
    mosSubjects: ["word"],
    fields: ["プロジェクトマネジメント"]
  },
  {
    key: "cloud", name: "クラウドエンジニア", level: 20,
    colors: ["#5ab0f0", "#3a80c0", "#f8f8f8", "#2a3a5a"],
    outfit: OUTFIT_HOODIE,
    perks: { startGauge: 20 },
    perkName: "すぐに きどう",
    perk: "たたかいの はじめに、ひっさつゲージが 20 たまった じょうたいで はじまる。",
    perkWhy: "クラウドでは、必要なときに すぐサーバを用意して使いはじめられる。",
    about: "インターネットの向こうにあるサーバやサービス（クラウド）を組み合わせて、システムの土台（インフラ）を作り、動かしつづける仕事。",
    exam: "「システム構成要素」（クラウドコンピューティング・仮想化・システムの構成）と「ネットワーク」。",
    bestFor: "しょくぎょうの しれん（5もんの 短い たたかい）",
    mosSubjects: [],
    fields: ["システム構成要素", "ネットワーク"]
  },
  {
    key: "datasci", name: "データサイエンティスト", level: 20,
    colors: ["#eef2fa", "#b8c4d8", "#4cbc6c", "#3a3a5a"],
    outfit: OUTFIT_COAT,
    perks: { chestLuck: 0.08 },
    perkName: "かくりつを よむ",
    perk: "たからばこで、しょうごうや 色ちがいが 出やすくなる。",
    perkWhy: "たくさんのデータを統計の考え方で分析し、どうなりやすいか（確率・傾向）を読みとくのが仕事。",
    about: "たくさんのデータを集めて、統計や機械学習を使って分析し、仕事に役立つ発見をする仕事。分析の結果を、グラフなどで分かりやすく伝える。",
    exam: "「基礎理論」（確率・統計・データの表し方）と「データベース」。",
    bestFor: "クエストの くりかえし（たからばこ あつめ）",
    mosSubjects: ["excel"],
    fields: ["基礎理論", "データベース"]
  },
  /* ===== Lv 30 ===== */
  {
    key: "architect", name: "システムアーキテクト", level: 30,
    colors: ["#6a4ab0", "#47307a", "#f0c040", "#2a2a40"],
    outfit: OUTFIT_CAPE,
    perks: { crit: 0.04 },
    perkName: "ぜんたいを みる目",
    perk: "かいしんの いちげきが 出やすくなる。",
    perkWhy: "システム全体を見わたして、どこをどう組み合わせるかを決めるのが仕事。急所（かいしん）を見ぬく。",
    about: "仕事の目的に合わせて、システム全体の組み立て（どんな部品を、どう組み合わせるか）を考える仕事。国家試験「システムアーキテクト試験」もある。",
    exam: "「システム構成要素」（信頼性・稼働率など）と、システム開発技術・システム戦略。",
    bestFor: "まおうの城・ボス（かいしん）",
    mosSubjects: [],
    fields: ["システム構成要素", "システム開発技術", "システム戦略"]
  },
  {
    key: "ai", name: "AIエンジニア", level: 30,
    colors: ["#46466e", "#2e2e4c", "#4ae0e0", "#22223a"],
    outfit: OUTFIT_HOODIE,
    headgear: { 6: "...B........B...", 7: "...BggggggggB..." },
    headColors: ["#2a2a3a", "#4ae0e0"],
    perks: { specialMul: 0.15 },
    perkName: "がくしゅうの せいか",
    perk: "ひっさつわざで もらえる EXP が ふえる。",
    perkWhy: "AI は、たくさんのデータから学習をくり返して かしこくなる。ためた力（ゲージ）を大きな成果に変える。",
    about: "AI（人工知能）のしくみを使って、画像の見分け・言葉の理解・予測などをするシステムを作る仕事。AI に学ばせるデータを用意し、学習させて、正しく働くか確かめる。",
    exam: "「基礎理論」（AI・機械学習・ディープラーニングなど）。AI を使うときの決まりごと（法務）も出る。",
    bestFor: "まおうの城（ひっさつわざ）",
    mosSubjects: [],
    fields: ["基礎理論", "法務"]
  },
  /* ===== Lv 40 ===== */
  {
    key: "strategist", name: "ITストラテジスト", level: 40,
    colors: ["#22305a", "#141e3c", "#f0c040", "#1c2440"],
    outfit: OUTFIT_SUIT,
    perks: { bossXp: 3, missionXp: 5 },
    perkName: "せんりゃくの 目",
    perk: "ボスに せいかいしたときの EXP と、ミッション たっせいの EXP が ふえる。",
    perkWhy: "会社の大きな目標（ボス）に向けて、IT をどう使うかの戦略を立て、計画（ミッション）を進めるのが仕事。",
    about: "会社の経営の目標に合わせて、IT をどう使えば もうかるか・便利になるかという戦略を考える仕事。国家試験「ITストラテジスト試験」もある。",
    exam: "「経営戦略マネジメント」「システム戦略」「企業活動」「ビジネスインダストリ」。",
    bestFor: "まおうの城・ボス、きょうの ミッション",
    mosSubjects: [],
    fields: ["経営戦略マネジメント", "システム戦略", "企業活動", "ビジネスインダストリ"]
  },
  {
    key: "auditor", name: "システム監査人", level: 40,
    colors: ["#5c6270", "#3c4250", "#4a8ae0", "#2a2a40"],
    outfit: OUTFIT_SUIT,
    perks: { comboKeep: 1, reviewXp: 1.1 },
    perkName: "ていねいな かくにん",
    perk: "1回の たたかいで 1回だけ、まちがえても コンボが半分 のこる。復習の EXP も 1わり ふえる。",
    perkWhy: "システムが正しく安全に使われているかを、外から公平に、ていねいに確かめる（監査する）のが仕事。",
    about: "会社のシステムが、正しく・安全に・役に立つように使われているかを、独立した立場から調べて評価し、改善を提案する仕事。国家試験「システム監査技術者試験」もある。",
    exam: "「システム監査」（監査人の独立性・監査の手順・内部統制など）と「法務」。",
    bestFor: "ふっかつのほこら（復習）",
    mosSubjects: [],
    fields: ["システム監査", "法務"]
  },
  /* ===== Lv 50 ===== */
  {
    key: "whitehacker", name: "ホワイトハッカー", level: 50,
    colors: ["#e8ecf4", "#b0b8c8", "#141423", "#2a2a40"],
    outfit: OUTFIT_HOODIE,
    headgear: {
      2: "....GGGGGGGG....", 3: "...GGGGGGGGGG...", 4: "..GGG......GGG..", 5: "..GG........GG..",
      6: "..GG........GG..", 7: "..GG........GG..", 8: "..gG........Gg..", 9: "...gG......Gg...", 10: "....gg....gg...."
    },
    headColors: ["#e8ecf4", "#b0b8c8"],
    perks: { crit: 0.04, heartGuard: 1 },
    perkName: "こうげきを しる まもり",
    perk: "かいしんの いちげきが 出やすくなる。1回の たたかいで 1回だけ、まちがえても ♥が へらない。",
    perkWhy: "攻撃する人と同じ知識と技術を、守るために使う。弱点を見ぬき（かいしん）、攻撃をふせぐ。",
    about: "攻撃者と同じ知識と技術を、正しいことのために使う人。システムの持ち主の許可を得て、実際に攻撃を試し（ペネトレーションテスト）、見つけた弱点を報告して直してもらう。許可なく試すのは犯罪になる。",
    exam: "「情報セキュリティ」（攻撃の手口・脆弱性・ペネトレーションテストなど）。不正アクセス禁止法などの法律も出る。",
    bestFor: "まおうの城（かいしん＋まもり）",
    mosSubjects: [],
    fields: ["セキュリティ", "法務"]
  },
  /* ===== Lv 60 ===== */
  {
    key: "blueteam", name: "ブルーチーム", level: 60,
    colors: ["#2a6ad8", "#1a48a0", "#f8f8f8", "#22305a"],
    outfit: OUTFIT_JACKET, headgear: HEADGEAR_HEADSET,
    headColors: ["#2a2a3a", "#4ae0e0"],
    perks: { heartGuard: 2 },
    perkName: "てっぺきの かんし",
    perk: "1回の たたかいで 2回まで、まちがえても ♥が へらない。",
    perkWhy: "ログを見張って攻撃を早く見つけ、被害を広げずに食い止めるのが仕事。守りの専門家。",
    about: "サイバー攻撃の演習で、守る側を受けもつチーム（攻める側はレッドチーム）。ふだんも、SOC（セキュリティの監視センター）などで記録（ログ）を見張り、攻撃に気づいて対応する。",
    exam: "「情報セキュリティ」（ログの監視・SOC・CSIRT・インシデントへの対応など）。",
    bestFor: "むげんの めいきゅう（♥を 2回 まもる）",
    mosSubjects: [],
    fields: ["セキュリティ"]
  },
  /* ===== Lv 70 ===== */
  {
    key: "ciso", name: "CISO", level: 70,
    colors: ["#9a2a3e", "#621a28", "#f0c040", "#2a1c24"],
    outfit: OUTFIT_CAPE,
    perks: { heartGuard: 1, comboKeep: 1 },
    perkName: "そしきの まもり",
    perk: "1回の たたかいで 1回だけ、まちがえても ♥が へらない。コンボも 1回だけ 半分 のこる。",
    perkWhy: "会社全体の守りのルールを決めて、事故が起きても被害を小さく、すぐ立ち直れるようにするのが仕事。",
    about: "最高情報セキュリティ責任者（Chief Information Security Officer）。会社の情報セキュリティの方針（ポリシー）を決め、守りの体制をつくる責任者。事故が起きたときは、経営者として対応をみちびく。",
    exam: "「情報セキュリティ管理」（情報セキュリティポリシー・リスクマネジメント・ISMS・CSIRT など）と「法務」。",
    bestFor: "むげんの めいきゅう（まもり＋コンボ）",
    mosSubjects: [],
    fields: ["セキュリティ", "法務", "企業活動"]
  },
  /* ===== Lv 80 ===== */
  {
    key: "cto", name: "CTO", level: 80,
    colors: ["#c8ccd8", "#8c92a4", "#4ae0e0", "#2a2a40"],
    outfit: OUTFIT_CAPE,
    headgear: { 0: "....g.g..g.g....", 1: "....gggggggg...." },
    headColors: ["#f0c040", "#f0c040"],
    perks: { startGauge: 20, crit: 0.04, gaugeCombo: 8 },
    perkName: "ぎじゅつの かじとり",
    perk: "ひっさつゲージ 20 で はじまる。かいしんが 出やすい。コンボ5いじょうの せいかいで ゲージが たまりやすい。",
    perkWhy: "会社の技術ぜんぶを見わたし、どの技術に力を入れるかを決める、技術の最高責任者。",
    about: "最高技術責任者（Chief Technology Officer）。会社がどんな技術を使い、どう育てていくかを決める責任者。技術の方向を決め、エンジニアのチームをひきいる。",
    exam: "テクノロジ系の全分野と、技術の戦略（技術開発戦略・技術のロードマップなど）。",
    bestFor: "まおうの城・どこでも",
    mosSubjects: ["excel", "word"],
    fields: ["アルゴリズムとプログラミング", "システム構成要素", "ネットワーク", "データベース", "セキュリティ", "経営戦略マネジメント"]
  }
];

function jobDef(key) {
  for (var i = 0; i < JOBS.length; i++) if (JOBS[i].key === key) return JOBS[i];
  return JOBS[0];
}
function avatarPart(kind, key) {
  var list = AVATAR_PARTS[kind];
  for (var i = 0; i < list.length; i++) if (list[i].key === key) return list[i];
  return list[0];
}
/* はじめての人のアバター（ランダム） */
function randomAvatar() {
  var a = {};
  AVATAR_PART_ORDER.forEach(function (p) {
    var list = AVATAR_PARTS[p[0]];
    a[p[0]] = list[Math.floor(Math.random() * list.length)].key;
  });
  return a;
}

/* しょくぎょうレベル5の「いろちがい」の服の色（色相を まわす。白っぽい服は、青みを つける） */
function avatarAltColor(hex) {
  var r = parseInt(hex.substr(1, 2), 16) / 255, g = parseInt(hex.substr(3, 2), 16) / 255, b = parseInt(hex.substr(5, 2), 16) / 255;
  var mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn, h = 0, sat = 0;
  if (d) {
    sat = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h /= 6;
  }
  if (d < 0.12) { h = 0.12; sat = 0.6; l = Math.min(l, 0.72); }   /* 白・灰色の服（色みが少ない）は、金色っぽく */
  else h = (h + 0.45) % 1;
  function f(n) {
    var k = (n + h * 12) % 12, a = sat * Math.min(l, 1 - l);
    var c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return ("0" + Math.round(c * 255).toString(16)).slice(-2);
  }
  return "#" + f(0) + f(8) + f(4);
}

/* アバターを canvas に描く（avatar: {hair, hairColor, skin, eyes}、jobKey: しょくぎょう、alt: いろちがいの服） */
function drawAvatar(canvas, avatar, jobKey, scale, alt) {
  avatar = avatar || {};
  var job = jobDef(jobKey);
  var grid = AVATAR_BODY.map(function (r) { return r.split(""); });
  function over(rows) {
    Object.keys(rows || {}).forEach(function (y) {
      rows[y].split("").forEach(function (ch, x) { if (ch !== ".") grid[y][x] = ch; });
    });
  }
  over(job.outfit);
  /* 目の行は、顔の内側の「.」を はだに もどす（ほかの目の形の点が残らないように） */
  var eyes = avatarPart("eyes", avatar.eyes).rows;
  Object.keys(eyes).forEach(function (y) {
    eyes[y].split("").forEach(function (ch, x) { if (x >= 4 && x <= 11) grid[y][x] = ch === "." ? "S" : ch; });
  });
  over(avatarPart("hair", avatar.hair).rows);
  over(job.headgear);
  var skin = avatarPart("skin", avatar.skin).colors;
  var hair = avatarPart("hairColor", avatar.hairColor).colors;
  var col = {
    B: SPRITE_BLACK, S: skin[0], s: skin[1], W: SPRITE_WHITE, K: SPRITE_BLACK, H: hair[0], h: hair[1],
    O: alt ? avatarAltColor(job.colors[0]) : job.colors[0], o: alt ? avatarAltColor(job.colors[1]) : job.colors[1],
    A: alt ? avatarAltColor(job.colors[2]) : job.colors[2], P: job.colors[3], X: "#4a3020",
    G: job.headColors ? job.headColors[0] : "#2a2a3a", g: job.headColors ? job.headColors[1] : "#e05252", L: "#7ab0f0"
  };
  canvas.width = AVATAR_W * scale;
  canvas.height = AVATAR_H * scale;
  var ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (var y = 0; y < AVATAR_H; y++) {
    for (var x = 0; x < AVATAR_W; x++) {
      var c = col[grid[y][x]];
      if (!c) continue;
      ctx.fillStyle = c;
      ctx.fillRect(x * scale, y * scale, scale, scale);
    }
  }
}
