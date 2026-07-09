/* =========================================================
 * MOS QUEST 設定ファイル
 * せんせいが編集するのは このファイルだけでOK！
 * ========================================================= */
var GAME_CONFIG = {

  // 成績送信用の GAS ウェブアプリURL（送信専用・一覧の読み取りはできません）。
  // 空文字 "" のままでもゲームは動きます（成績の送信だけ無効になります）。
  // 設定方法は game/README.md の「成績の送信・共有の設定」を参照。
  SYNC_URL: "https://script.google.com/macros/s/AKfycbyo5AHlg0GTavIB81JawrPWgycHyEErqjXG6vYnJGJ0o2Pp4wVoKCiuJXIIyonXkVfE/exec",

  // 合言葉（APIキー）。GAS側のスクリプトプロパティ API_KEY と完全に同じ文字列にすること。
  // 無関係なアクセスや自動巡回を防ぐための簡易的な門番（詳しくは README の「セキュリティについて」参照）。
  API_KEY: "GGpsZJmbZ2ro8-0otcZ2k1TDTl5rR59E",

  // 生徒が登録時に選ぶクラス名のリスト。自由に書き換えてください。
  CLASSES: ["1年IT", "2年IT", "1年SE", "2年SE"]
};
