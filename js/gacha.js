/* =========================================================
 * STUDY QUEST まなびメダル・まなびガチャ・スタンプカード
 * メダルは 勉強でしか たまらない（正解・復習・ミッション・まいにちの スタンプ）。本物のお金は使わない。
 * ガチャで出るのは「用語カード」「そうび」「髪の色」。どれも解説カードつきで、引いたあと すぐ「確認クイズ」を1問 解ける。
 * ⚠️ GACHA_CARDS・GACHA_COLORS の key は生徒のセーブに保存される。変えない・消さない（足すのはよい）。
 * 用語カードの解説は、作り手とは別の確認役（AI）が確かめている（DHCP・著作権の2件を直した）。
 * ========================================================= */

var GACHA_COST = 30;                 // 1回ぶんの メダル
var MEDAL_CORRECT = 1;               // 正解1問（もぎけんていもふくむ）
var MEDAL_REVIEW = 2;                // 復習（ふっかつのほこら）の正解1問
var MEDAL_MISSION = 10;              // きょうの ミッション 1つ たっせい
var MEDAL_QUIZ = 10;                 // ガチャのあとの 確認クイズに 正解
var MEDAL_DUP = 10;                  // もっている カード・髪の色が かさなったとき（メダルで もどる）
/* まいにちの スタンプ（連続ログインの 1〜7日目。7日目のあとは また1日目から。連続が切れても1日目から） */
var STAMP_REWARDS = [10, 15, 20, 25, 30, 40, 60];
/* ガチャの めずらしさの確率（合計 1） */
var GACHA_RATES = { super: 0.05, rare: 0.25, normal: 0.70 };

/* 用語カード。field は IPA の問題の分野（確認クイズに使う）、quest は MOS のクエスト id（同じく） */
var GACHA_CARDS = [
  /* ----- IPA 基本情報 ----- */
  { key: "c_cpu", course: "ipa_fe", rarity: "normal", term: "CPU（中央処理装置）", field: "コンピュータ構成要素",
    about: "プログラムの命令を読み出し、解読し、実行する装置。計算をする部分（演算装置）と、全体に指示を出す部分（制御装置）からできている。",
    exam: "命令の実行の流れ、クロック周波数、CPI・MIPS などの性能の計算。" },
  { key: "c_os", course: "ipa_fe", rarity: "normal", term: "OS（オペレーティングシステム）", field: "ソフトウェア",
    about: "コンピュータ全体を管理する基本のソフトウェア。CPU・メモリ・ファイル・入出力装置を、アプリケーションが使えるように うまく割り当てる。",
    exam: "タスク管理（実行・実行可能・待ちの状態）、記憶管理、ファイル管理。" },
  { key: "c_vm", course: "ipa_fe", rarity: "rare", term: "仮想記憶", field: "ソフトウェア",
    about: "主記憶（メモリ）より大きなプログラムでも動かせるように、補助記憶（ディスクなど）の一部をメモリのように使うしくみ。必要な部分（ページ）だけを主記憶に読みこむ。",
    exam: "ページング、ページの置きかえ（LRU・FIFO など）、スラッシング。" },
  { key: "c_avail", course: "ipa_fe", rarity: "rare", term: "稼働率", field: "システム構成要素",
    about: "システムが使える状態にある時間の割合。稼働率 ＝ MTBF ÷（MTBF ＋ MTTR）。MTBF は平均故障間隔（こわれずに動く時間の平均）、MTTR は平均修理時間。",
    exam: "稼働率の計算。直列は A×B、並列は 1−(1−A)(1−B)。" },
  { key: "c_ip", course: "ipa_fe", rarity: "normal", term: "IPアドレス", field: "ネットワーク",
    about: "ネットワークにつながる機器を見分けるための番号。IPv4 は 32ビットで、192.168.1.10 のように 8ビットずつ 10進数で書く。サブネットマスクで、ネットワークの部分と ホスト（機器）の部分を分ける。",
    exam: "サブネットマスク、ネットワークアドレス、つなげられる機器の数の計算。IPv6（128ビット）。" },
  { key: "c_dns", course: "ipa_fe", rarity: "normal", term: "DNS", field: "ネットワーク",
    about: "www.example.jp のような ドメイン名を、IP アドレスに変換する（名前解決する）しくみ。",
    exam: "DNS・DHCP・NTP・SMTP・POP3 などの プロトコルの役割。" },
  { key: "c_dhcp", course: "ipa_fe", rarity: "rare", term: "DHCP", field: "ネットワーク",
    about: "ネットワークにつないだ機器に、IP アドレスなどの設定を自動で割り当てるしくみ。",
    exam: "DNS など ほかのプロトコルとの役割の ちがい。NAT（アドレスを変換する技術）との ちがい。" },
  { key: "c_normal", course: "ipa_fe", rarity: "rare", term: "正規化", field: "データベース",
    about: "表のデータの重なり（冗長）を なくし、更新したときに食いちがいが起きないように、表を分けて整理すること。第1正規形・第2正規形・第3正規形と段階がある。",
    exam: "関数従属を見て、第何正規形かを判断する問題。" },
  { key: "c_pk", course: "ipa_fe", rarity: "normal", term: "主キー", field: "データベース",
    about: "表の中の行を、1つに決めるための列（または列の組み合わせ）。同じ値は入れられず、空（NULL）にもできない。",
    exam: "主キー・外部キー・参照整合性、SQL の結合（JOIN）。" },
  { key: "c_tx", course: "ipa_fe", rarity: "rare", term: "トランザクション（ACID特性）", field: "データベース",
    about: "いくつかの処理を ひとまとまりにしたもの。ぜんぶ成功するか、ぜんぶ取り消すか のどちらかにする。原子性（A）・一貫性（C）・独立性（I）・耐久性（D）をもつべきとされる。",
    exam: "コミットとロールバック、排他制御（ロック）、障害からの回復。" },
  { key: "c_sym", course: "ipa_fe", rarity: "normal", term: "共通鍵暗号", field: "セキュリティ",
    about: "暗号化と復号に、同じ鍵を使う方式（例：AES）。処理は速いが、鍵を相手に安全に わたす方法が問題になる。",
    exam: "公開鍵暗号との ちがい、必要な鍵の数（n人のあいだなら n(n−1)/2 個）。" },
  { key: "c_mfa", course: "ipa_fe", rarity: "normal", term: "多要素認証", field: "セキュリティ",
    about: "知識（パスワードなど）・所持（スマートフォンなど）・生体（指紋など）のうち、ちがう種類の要素を2つ以上 組み合わせて本人を確かめること。",
    exam: "どの組み合わせが多要素（2要素）認証になるか。同じ種類を2つ重ねても多要素にはならない。" },
  { key: "c_sqli", course: "ipa_fe", rarity: "rare", term: "SQLインジェクション", field: "セキュリティ",
    about: "Web アプリケーションの入力欄に、SQL の命令の一部を入れて、データベースを不正に操作する攻撃。",
    exam: "対策：プレースホルダ（バインド機構）を使う、入力された文字を正しく処理する。" },
  { key: "c_ransom", course: "ipa_fe", rarity: "normal", term: "ランサムウェア", field: "セキュリティ",
    about: "コンピュータの中のファイルを勝手に暗号化して使えなくし、元にもどすことと引きかえに お金（身代金）を要求する不正なプログラム。",
    exam: "対策：バックアップ（ネットワークから切りはなした場所にも保管）、OS やソフトウェアの更新。" },
  { key: "c_stack", course: "ipa_fe", rarity: "normal", term: "スタックとキュー", field: "アルゴリズムとプログラミング",
    about: "スタックは、あとから入れたデータを先に取り出す（後入れ先出し：LIFO）。キューは、先に入れたデータを先に取り出す（先入れ先出し：FIFO）。",
    exam: "push・pop、enqueue・dequeue の操作のあとの状態を答える問題。" },
  { key: "c_order", course: "ipa_fe", rarity: "super", term: "計算量（オーダ）", field: "アルゴリズムとプログラミング",
    about: "データの数 n が増えたとき、処理の手間が どのくらい増えるかを表す。線形探索は O(n)、二分探索は O(log n)、バブルソートは O(n²)。",
    exam: "探索・整列のアルゴリズムの計算量の くらべ。" },
  { key: "c_logic", course: "ipa_fe", rarity: "normal", term: "論理演算（AND・OR・XOR）", field: "基礎理論",
    about: "AND は両方が1のときだけ1、OR はどちらかが1なら1、XOR は2つが ちがうときだけ1になる。NOT は 0 と 1 を反対にする。",
    exam: "真理値表、論理回路、ビット演算（マスク）。" },
  { key: "c_waterfall", course: "ipa_fe", rarity: "normal", term: "ウォーターフォールモデル", field: "ソフトウェア開発管理技術",
    about: "要件定義 → 設計 → プログラミング → テスト のように、工程を上から順番に進める開発の進め方。前の工程に もどらないことが前提。",
    exam: "アジャイル・スパイラルモデル・プロトタイピングとの ちがい。" },
  { key: "c_blackbox", course: "ipa_fe", rarity: "normal", term: "ブラックボックステスト", field: "システム開発技術",
    about: "プログラムの中身（内部の作り）を見ずに、入力と出力だけで正しく動くかを確かめるテスト。同値分割や限界値分析で テストデータを決める。",
    exam: "ホワイトボックステスト（命令網羅・条件網羅など）との ちがい。" },
  { key: "c_sla", course: "ipa_fe", rarity: "rare", term: "SLA（サービスレベル合意書）", field: "サービスマネジメント",
    about: "IT サービスを提供する側と受ける側が、サービスの質（稼働率・問い合わせへの対応時間など）について合意した内容を まとめたもの。",
    exam: "サービスレベル管理、インシデント管理・問題管理との関係。" },
  { key: "c_copyright", course: "ipa_fe", rarity: "normal", term: "著作権", field: "法務",
    about: "文章・音楽・絵・プログラムなどの作品（著作物）について、原則として 作った人（著作者）がもつ権利。作ったときに自動で生まれ、届け出は いらない。",
    exam: "プログラムは著作物になるが、アルゴリズムやプログラム言語そのものは保護されない。職務著作。" },
  { key: "c_privacy", course: "ipa_fe", rarity: "rare", term: "個人情報保護法", field: "法務",
    about: "生きている個人を特定できる情報（氏名・生年月日・顔写真など）を あつかう事業者が守るべきルールを決めた法律。使う目的を はっきりさせ、本人の同意なしに 第三者へ わたしてはいけない（例外もある）。",
    exam: "個人情報にあたるもの、第三者提供のルール、要配慮個人情報。" },
  { key: "c_ppm", course: "ipa_fe", rarity: "rare", term: "PPM（プロダクトポートフォリオマネジメント）", field: "経営戦略マネジメント",
    about: "市場の成長率と、市場の中での自社の占有率（シェア）の2つの軸で、事業や商品を「花形」「金のなる木」「問題児」「負け犬」の4つに分ける分析の方法。",
    exam: "4つの区分の特徴（金のなる木＝成長率は低いがシェアが高く、お金を生む）。" },

  /* ----- MOS（Word・Excel） ----- */
  { key: "m_relref", course: "mos", rarity: "normal", term: "相対参照", quest: "XL1",
    about: "=A1 のように $ を付けない参照。数式をコピーすると、コピーした先に合わせて 参照するセルも ずれる。",
    exam: "コピーしたあとの式（1つ下にコピーすると =A2）。絶対参照・複合参照との ちがい。" },
  { key: "m_name", course: "mos", rarity: "rare", term: "名前の定義", quest: "XL1",
    about: "セルやセル範囲に「うりあげ」のような名前を付けて、数式で =SUM(うりあげ) のように使えるようにする機能。名前ボックスから その範囲へ すぐ移動もできる。",
    exam: "「数式」タブの「名前の定義」、名前ボックス。" },
  { key: "m_counta", course: "mos", rarity: "normal", term: "COUNTA 関数", quest: "XL2",
    about: "範囲の中で、空白でないセル（数値も文字もふくむ）の数を数える関数。COUNT は数値のセルだけ、COUNTBLANK は空白のセルを数える。",
    exam: "COUNT・COUNTA・COUNTBLANK の ちがい。" },
  { key: "m_if", course: "mos", rarity: "normal", term: "IF 関数", quest: "XL2",
    about: "=IF(条件, 成り立つときの値, 成り立たないときの値) の形で、条件によって結果を変える関数。例：=IF(A1>=60,\"合格\",\"不合格\")。",
    exam: "条件式（>=・<> など）と、表示される結果。" },
  { key: "m_numfmt", course: "mos", rarity: "rare", term: "ユーザー定義の表示形式", quest: "XL3",
    about: "「セルの書式設定」の「ユーザー定義」で、表示のしかたを自分で決められる。0000 と指定すると 7 が 0007 と表示される（値そのものは 7 のまま）。",
    exam: "表示形式を変えても値は変わらないこと。桁区切り・パーセント・日付の表示形式。" },
  { key: "m_table", course: "mos", rarity: "normal", term: "テーブル", quest: "XL4",
    about: "表のセル範囲を「テーブル」に変換すると、しま模様のスタイル・見出しのフィルターボタン・集計行などが使えるようになる。データを足すと、テーブルの範囲も自動で広がる。",
    exam: "テーブルへの変換、集計行、テーブルスタイル、範囲に変換（解除）。" },
  { key: "m_sortlv", course: "mos", rarity: "rare", term: "並べ替え（複数のレベル）", quest: "XL4",
    about: "「並べ替え」ダイアログで「レベルの追加」をすると、「クラス順 → 同じクラスなら点数の高い順」のように、優先順位をつけて並べ替えられる。",
    exam: "昇順・降順、レベルの追加、ユーザー設定リスト。" },
  { key: "m_spark", course: "mos", rarity: "rare", term: "スパークライン", quest: "XL5",
    about: "1つのセルの中に表示する小さなグラフ（折れ線・縦棒・勝敗）。データの傾向を ひと目で見られる。「挿入」タブにある。",
    exam: "スパークラインの挿入、種類の変更。" },
  { key: "m_printtitle", course: "mos", rarity: "normal", term: "印刷タイトル", quest: "XL6",
    about: "複数のページに分かれて印刷される表で、見出しの行（や列）を すべてのページに印刷する設定。「ページレイアウト」タブにある。",
    exam: "印刷タイトル、印刷範囲の設定、拡大縮小印刷。" },
  { key: "m_inspect", course: "mos", rarity: "rare", term: "ドキュメント検査", quest: "XL6",
    about: "ファイルを人に配る前に、コメント・個人情報・かくれた内容などが残っていないかを調べて、取りのぞく機能。「ファイル」タブの「情報」にある。",
    exam: "ドキュメント検査、アクセシビリティチェック、互換性チェック。" },
  { key: "m_hanging", course: "mos", rarity: "normal", term: "ぶら下げインデント", quest: "WD2",
    about: "段落の 2行目以降を、1行目より下げる インデント。箇条書きのような見た目になる。1行目だけを下げるのは「1行目のインデント（字下げ）」。",
    exam: "ルーラーや「段落」ダイアログでの設定、1行目のインデントとの ちがい。" },
  { key: "m_numbering", course: "mos", rarity: "normal", term: "段落番号", quest: "WD2",
    about: "段落の先頭に「1. 2. 3.」のような番号を自動で付ける機能。行頭の記号を付けるのは箇条書き。番号は「1から再開」で振り直せる。",
    exam: "段落番号と箇条書きの ちがい、番号の振り直し。" },
  { key: "m_wrap", course: "mos", rarity: "normal", term: "文字列の折り返し", quest: "WD3",
    about: "画像や図形のまわりに、文章をどう配置するかの設定。「四角形」「上下」「前面」「背面」などがある。",
    exam: "文字列の折り返しの種類、図の位置。" },
  { key: "m_section", course: "mos", rarity: "rare", term: "セクション区切り", quest: "WD4",
    about: "文書を いくつかのセクションに分ける区切り。セクションごとに、用紙の向き・余白・ヘッダー・ページ番号・段組みを変えられる。",
    exam: "「レイアウト」タブの「区切り」、改ページとの ちがい、「前と同じヘッダー/フッター」。" },
  { key: "m_footnote", course: "mos", rarity: "normal", term: "脚注と文末脚注", quest: "WD5",
    about: "本文の語句に番号を付けて、補足の説明を書く機能。脚注は その ページの下、文末脚注は 文書（またはセクション）の最後に まとめて書く。「参考資料」タブにある。",
    exam: "脚注と文末脚注の ちがい、番号の書式。" }
];

/* ガチャで出る 髪の色（カラーコード）。アバターの「かみの いろ」に足される（手に入れるまでは えらべない） */
var GACHA_COLORS = [
  { key: "cyan", label: "シアン", colors: ["#3ce8ff", "#1aa8c0"], rarity: "rare", code: "#00FFFF",
    about: "画面の色は、光の三原色 R（赤）・G（緑）・B（青）の明るさを、それぞれ 0〜255 の 256段階で組み合わせて表す。#00FFFF は R＝0・G＝255・B＝255 で、緑と青の光をまぜたシアン。16進数2けたで 0〜255 を表す（FF＝255）。" },
  { key: "magenta", label: "マゼンタ", colors: ["#ff5ce8", "#c02aa8"], rarity: "rare", code: "#FF00FF",
    about: "#FF00FF は R＝255・G＝0・B＝255。赤と青の光をまぜると マゼンタになる。光の三原色は、まぜるほど明るくなり、ぜんぶ 255 にすると 白（#FFFFFF）になる（加法混色）。" },
  { key: "lime", label: "ライム", colors: ["#7cff4a", "#3cb820"], rarity: "rare", code: "#00FF00",
    about: "#00FF00 は R＝0・G＝255・B＝0 で、緑の光だけ。RGB で1色を表すのに 8ビット×3＝24ビットを使い、約1677万色（256×256×256）を表せる。" },
  { key: "gold", label: "ゴールド", colors: ["#ffd23b", "#c49a10"], rarity: "super", code: "#FFD700",
    about: "#FFD700 は R＝255・G＝215・B＝0。D7 は16進数で 13×16＋7＝215。印刷では、光の三原色ではなく シアン・マゼンタ・イエローの インク（CMY。黒を足して CMYK）を重ねて色を作る（減法混色）。" }
];

function gachaCard(key) {
  for (var i = 0; i < GACHA_CARDS.length; i++) if (GACHA_CARDS[i].key === key) return GACHA_CARDS[i];
  return null;
}
function gachaColor(key) {
  for (var i = 0; i < GACHA_COLORS.length; i++) if (GACHA_COLORS[i].key === key) return GACHA_COLORS[i];
  return null;
}
/* ガチャの髪の色を、アバターの「かみの いろ」に足す（gacha: true のものは、手に入れるまで えらべない） */
GACHA_COLORS.forEach(function (c) {
  AVATAR_PARTS.hairColor.push({ key: c.key, label: c.label, colors: c.colors, gacha: true });
});
