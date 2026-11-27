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

/* ---------- ITの しょくぎょう ----------
 * 特ちょう（perk）は、ボスを倒すのに必要な正解の数を変えない（正解の数＝勉強の量を守る）。
 * もぎけんてい（本番と同じ条件）では、どの特ちょうも効かない。
 * fields は、解説カードの「ちょうせん」で出す IPA 基本情報の分野（問題の field）。 */
var JOBS = [
  {
    key: "programmer", name: "プログラマー", level: 1,
    colors: ["#5a6a8a", "#3a4660", "#f0f0f8", "#2a2a40"],
    outfit: {
      12: "....BOOAAOOB....", 13: "...BOOOAAOOOB...", 14: "..BOBOOOOOOBOB..", 15: "..BSBOOOOOOBSB..",
      16: "..BBBoOOOOoBBB..", 17: "....BPPPPPPB....", 18: "....BPPBBPPB...."
    },
    headgear: {
      1: ".....GGGGGG.....", 2: "....G......G....", 3: "...G........G...", 4: "...G........G...",
      5: "..GGg......gGG..", 6: "..GGg......gGG..", 7: "..GG........GG.."
    },
    perkName: "じどうかの ちから",
    perk: "コンボ 5いじょうで せいかいすると、ひっさつゲージが いつもより たまる。",
    perkWhy: "同じ作業をくり返すときは、プログラムで自動化すると速い。くり返し（コンボ）に強い しょくぎょう。",
    about: "設計書をもとに、コンピュータへの命令（プログラム）を書く仕事。書いたプログラムが正しく動くかをテストし、まちがい（バグ）を見つけて直す（デバッグ）。",
    exam: "科目B の「アルゴリズムとプログラミング」（擬似言語のプログラムを読む問題）。科目A でも、流れ図・配列・探索・整列・再帰などが出る。",
    fields: ["アルゴリズムとプログラミング", "ソフトウェア開発管理技術", "システム開発技術"]
  },
  {
    key: "security", name: "セキュリティエンジニア", level: 1,
    colors: ["#2a3a72", "#1a2450", "#f0c040", "#2a2a40"],
    outfit: {
      12: "....BOOOOOOB....", 13: "...BOOOOOAOOB...", 14: "..BOBOOOOAAOBOB.", 15: "..BSBOOOOOOBSB..",
      16: "..BBBoOOOOoBBB..", 17: "....BPPPPPPB....", 18: "....BPPBBPPB...."
    },
    perkName: "まもりの かまえ",
    perk: "1回の たたかいで 1回だけ、まちがえても ♥が へらない。",
    perkWhy: "不正アクセスやウイルスから、システムと情報を守るのが仕事。攻撃を1回ふせぐ。",
    about: "不正アクセスやコンピュータウイルスなどから、システムと情報を守る仕事。システムの弱いところ（脆弱性）を調べたり、守るための対策を考えたりする。国家試験「情報処理安全確保支援士試験」もある。",
    exam: "「情報セキュリティ」（暗号・認証・攻撃の手口と対策など）。科目B の問6 は、情報セキュリティの事例の問題。",
    fields: ["セキュリティ"]
  },
  {
    key: "network", name: "ネットワークエンジニア", level: 1,
    colors: ["#eef0f6", "#c8ccd8", "#f08c3a", "#3a3a5a"],
    outfit: {
      12: "....BAOOOOAB....", 13: "...BAAOOOOAAB...", 14: "..BOBAAOOAABOB..", 15: "..BSBAAOOAABSB..",
      16: "..BBBAAOOAABBB..", 17: "....BPPPPPPB....", 18: "....BPPBBPPB...."
    },
    perkName: "つうしんの あんてい",
    perk: "1回の たたかいで 1回だけ、まちがえても コンボが ぜんぶは きれず、半分 のこる。",
    perkWhy: "ネットワークは、一部がこわれても通信が止まらないように、予備の道（冗長化）を用意しておく。",
    about: "コンピュータどうしをつなぐネットワークを設計して組み立て、止まらないように見守る（運用・監視する）仕事。",
    exam: "「ネットワーク」（IP アドレス・プロトコル・LAN など）と、コンピュータやハードウェアのしくみ。",
    fields: ["ネットワーク", "コンピュータ構成要素", "ハードウェア", "ソフトウェア"]
  },
  {
    key: "database", name: "データベースエンジニア", level: 1,
    colors: ["#eef2fa", "#b8c4d8", "#4a8ae0", "#3a3a5a"],
    outfit: {
      12: "....BOOooOOB....", 13: "...BOOOooOAOB...", 14: "..BOBOOooOOBOB..", 15: "..BSBOOooOOBSB..",
      16: "..BOBOOooOOBOB..", 17: "....BOOPPOOB....", 18: "....BPPBBPPB...."
    },
    perkName: "データの せいり",
    perk: "ふっかつのほこら（復習）で もらえる EXP が 1わり ふえる。",
    perkWhy: "たくさんのデータを整理しなおして、必要なときにすぐ取り出せるようにするのが仕事。おぼえたことの整理（復習）に強い。",
    about: "たくさんのデータを整理して保存し、速く正しく取り出せるデータベースを設計・管理する仕事。",
    exam: "「データベース」（関係データベース・正規化・SQL・トランザクションなど）。",
    fields: ["データベース"]
  },
  {
    key: "pm", name: "プロジェクトマネージャ", level: 20,
    colors: ["#343a52", "#222638", "#d04a4a", "#262a3c"],
    outfit: {
      12: "....BOOWWOOB....", 13: "...BOOOAAOOOB...", 14: "..BOBOOOAOOBOB..", 15: "..BSBOOOAOOBSB..",
      16: "..BBBOOOOOOBBB..", 17: "....BPPPPPPB....", 18: "....BPPBBPPB...."
    },
    perkName: "けいかくの ちから",
    perk: "きょうの ミッションを たっせいしたときの ボーナス EXP が ふえる。",
    perkWhy: "計画を立てて、予定どおりに進めるのが仕事。決めた目標（ミッション）を達成するのが得意。",
    about: "システムを作るプロジェクトの計画を立て、予定・費用・品質・メンバーを管理して、完成までみちびく仕事。国家試験「プロジェクトマネージャ試験」もある。",
    exam: "「プロジェクトマネジメント」（WBS・アローダイアグラム・クリティカルパス・見積りなど）と、サービスマネジメント・システム監査。",
    fields: ["プロジェクトマネジメント", "サービスマネジメント", "システム監査"]
  },
  {
    key: "architect", name: "システムアーキテクト", level: 30,
    colors: ["#6a4ab0", "#47307a", "#f0c040", "#2a2a40"],
    outfit: {
      11: "...BAABSSBAAB...", 12: "..BOOBWWWWBOOB..", 13: "..BOOBWAAWBOOB..", 14: "..BOOBWWWWBOOB..",
      15: "..BOOSWWWWSOOB..", 16: "..BOOBWWWWBOOB..", 17: "..BoOBPPPPBOoB..", 18: "..BBBBPBBPBBBB.."
    },
    perkName: "ぜんたいを みる目",
    perk: "かいしんの いちげきが 出やすくなる。",
    perkWhy: "システム全体を見わたして、どこをどう組み合わせるかを決めるのが仕事。急所（かいしん）を見ぬく。",
    about: "仕事の目的に合わせて、システム全体の組み立て（どんな部品を、どう組み合わせるか）を考える仕事。国家試験「システムアーキテクト試験」もある。",
    exam: "「システム構成要素」（信頼性・稼働率など）と、システム戦略・経営戦略・企業活動。",
    fields: ["システム構成要素", "システム戦略", "経営戦略マネジメント", "企業活動", "ビジネスインダストリ"]
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

/* アバターを canvas に描く（avatar: {hair, hairColor, skin, eyes}、jobKey: しょくぎょう） */
function drawAvatar(canvas, avatar, jobKey, scale) {
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
    O: job.colors[0], o: job.colors[1], A: job.colors[2], P: job.colors[3], X: "#4a3020",
    G: "#2a2a3a", g: "#e05252", L: "#7ab0f0"
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
