/* =========================================================
 * MOS QUEST じっせん道場（実データ差分採点）問題データ
 *
 * 選択式ではなく、実際のExcelファイルをダウンロード→操作→
 * アップロードして採点する「じっせん道場」専用の問題一覧。
 *
 * 採点は必ずサーバー側（GAS）で行う。正解データ（採点対象セルや
 * 期待値）はここには一切含めない・持たせない。もし正解データを
 * クライアントに持たせてしまうと、生徒が開発者ツールで正解を
 * 覗けてしまうため（このゲームの他の機能とは違い、これは本当に
 * 「採点」目的の機能のため、そこだけは譲れない一線）。
 *
 * 問題ファイル（filePath）は正解と違って秘匿の必要がないので、
 * assets/practical/ に静的アセットとしてそのまま置いている。
 * 対応する正解ファイルは gas/mos_quest_backend.gs 側の説明を参照し、
 * 先生自身のGoogle Driveにアップロードして setupAnswerKey() を
 * 実行してもらう運用（README参照）。
 * ========================================================= */

var PRACTICAL_TASKS = [
  {
    id: "P1",
    title: "うりあげ集計ブック",
    subject: "excel",
    instructions:
      "配布ファイルを開いて、D2からD4に「数量×単価」で金額を求める数式を入力してください。" +
      "さらにD6に、D2からD4の金額の合計をSUM関数で求めてください。入力できたら上書き保存して、" +
      "このファイルをアップロードして採点してください。",
    fileName: "P1_problem.xlsx",
    filePath: "assets/practical/P1_problem.xlsx",
    passRatio: 0.7,
    expReward: 40,
    passBonusExp: 60
  },
  {
    id: "P2",
    title: "せいせき判定ブック",
    subject: "excel",
    instructions:
      "配布ファイルを開いて、C2からC4にIF関数を入力してください。" +
      "B列の点数が60点以上なら「合格」、60点未満なら「不合格」と表示するようにします。" +
      "入力できたら上書き保存して、このファイルをアップロードして採点してください。",
    fileName: "P2_problem.xlsx",
    filePath: "assets/practical/P2_problem.xlsx",
    passRatio: 0.7,
    expReward: 40,
    passBonusExp: 60
  },
  {
    id: "P3",
    title: "へいきん・けんすうブック",
    subject: "excel",
    instructions:
      "配布ファイルを開いて、C8にB2からB6の平均点をAVERAGE関数で、" +
      "C9にB2からB6のうち60点以上の人数をCOUNTIF関数で求めてください。" +
      "入力できたら上書き保存して、このファイルをアップロードして採点してください。",
    fileName: "P3_problem.xlsx",
    filePath: "assets/practical/P3_problem.xlsx",
    passRatio: 0.7,
    expReward: 40,
    passBonusExp: 60
  }
];
