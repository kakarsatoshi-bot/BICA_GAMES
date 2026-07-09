/* =========================================================
 * MOS QUEST 設定ファイル
 * せんせいが編集するのは このファイルだけでOK！
 * ========================================================= */
var GAME_CONFIG = {

  // ランキング同期用の GAS ウェブアプリURL。
  // 空文字 "" のままでもゲームは動きます（ランキングだけ無効になります）。
  // 設定方法は game/README.md の「ランキングの設定」を参照。
  SYNC_URL: "https://script.google.com/macros/s/AKfycbyo5AHlg0GTavIB81JawrPWgycHyEErqjXG6vYnJGJ0o2Pp4wVoKCiuJXIIyonXkVfE/exec",

  // 生徒が登録時に選ぶクラス名のリスト。自由に書き換えてください。
  CLASSES: ["1年A組", "1年B組", "2年A組", "2年B組"],

  // ランキングに表示する人数
  RANKING_LIMIT: 30
};
