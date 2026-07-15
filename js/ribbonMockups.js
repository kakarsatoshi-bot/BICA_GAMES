/* =========================================================
 * MOS QUEST リボンUIモックアップ
 * 実際のOffice画面に近い、フラットな見た目のリボンUIを
 * HTML/CSSだけで再現する（画像アセットは一切使わない）。
 * 「画面ホットスポット問題」（どこをクリックする？）で使う。
 *
 * 各モックアップは render(container) でDOMを組み立てるだけで、
 * 各ボタン要素に data-region="キー名" を振っておく。
 * 番号バッジの座標は描画後に getBoundingClientRect() で
 * 自動計測するので、レイアウトを変えても座標の再調整は不要。
 * ========================================================= */

var RIBBON_MOCKUPS = {

  excelHome: {
    label: "Excel ホームタブ",
    render: function (container) {
      container.innerHTML =
        '<div class="ribbon-mock">' +
          '<div class="ribbon-tabs">' +
            '<span>ファイル</span>' +
            '<span class="ribbon-tab-active">ホーム</span>' +
            '<span>挿入</span><span>ページレイアウト</span><span>数式</span><span>データ</span>' +
          '</div>' +
          '<div class="ribbon-groups">' +
            '<div class="ribbon-group" data-region="bold"><span class="ribbon-btn ribbon-btn-b">B</span></div>' +
            '<div class="ribbon-group" data-region="italic"><span class="ribbon-btn ribbon-btn-i">I</span></div>' +
            '<div class="ribbon-group" data-region="underline"><span class="ribbon-btn ribbon-btn-u">U</span></div>' +
            '<div class="ribbon-group" data-region="fontSize"><span class="ribbon-select">11 ▾</span></div>' +
            '<div class="ribbon-group" data-region="fillColor"><span class="ribbon-btn">🪣</span></div>' +
            '<div class="ribbon-group" data-region="mergeCenter"><span class="ribbon-btn-wide">結合して中央そろえ</span></div>' +
            '<div class="ribbon-group" data-region="numberFormat"><span class="ribbon-select">標準 ▾</span></div>' +
            '<div class="ribbon-group" data-region="conditionalFormat"><span class="ribbon-btn-wide">条件付き書式</span></div>' +
          '</div>' +
          '<div class="ribbon-sheet">' +
            '<div class="ribbon-formula-bar">fx&nbsp;&nbsp;=SUM(B2:B9)</div>' +
            '<div class="ribbon-grid"></div>' +
          '</div>' +
        '</div>';
    }
  },

  wordHome: {
    label: "Word ホームタブ",
    render: function (container) {
      container.innerHTML =
        '<div class="ribbon-mock">' +
          '<div class="ribbon-tabs">' +
            '<span>ファイル</span>' +
            '<span class="ribbon-tab-active">ホーム</span>' +
            '<span>挿入</span><span>デザイン</span><span>レイアウト</span><span>参考資料</span>' +
          '</div>' +
          '<div class="ribbon-groups">' +
            '<div class="ribbon-group" data-region="bold"><span class="ribbon-btn ribbon-btn-b">B</span></div>' +
            '<div class="ribbon-group" data-region="italic"><span class="ribbon-btn ribbon-btn-i">I</span></div>' +
            '<div class="ribbon-group" data-region="underline"><span class="ribbon-btn ribbon-btn-u">U</span></div>' +
            '<div class="ribbon-group" data-region="fontColor"><span class="ribbon-btn ribbon-btn-a">A</span></div>' +
            '<div class="ribbon-group" data-region="bullets"><span class="ribbon-btn">≡</span></div>' +
            '<div class="ribbon-group" data-region="alignLeft"><span class="ribbon-btn">◧</span></div>' +
            '<div class="ribbon-group" data-region="alignCenter"><span class="ribbon-btn">▣</span></div>' +
            '<div class="ribbon-group" data-region="alignRight"><span class="ribbon-btn">◨</span></div>' +
            '<div class="ribbon-group" data-region="lineSpacing"><span class="ribbon-btn">↕</span></div>' +
          '</div>' +
          '<div class="ribbon-sheet ribbon-doc">' +
            '<div class="ribbon-doc-line"></div>' +
            '<div class="ribbon-doc-line short"></div>' +
          '</div>' +
        '</div>';
    }
  }
};

/* container 内の data-region 要素を探し、containerを基準にした「右上かど」の座標を返す
 * （見つからなければ null）。ボタンの中心ではなく右上に置くのは、既存の「.badge」通知バッジ
 * （メニューの復習件数バッジなど）と同じ配置ルールにそろえ、ラベル文字と重ならないようにするため。 */
function ribbonMarkerPosition(container, targetKey) {
  var el = container.querySelector('[data-region="' + targetKey + '"]');
  if (!el) return null;
  var cRect = container.getBoundingClientRect();
  var eRect = el.getBoundingClientRect();
  return {
    x: eRect.right - cRect.left,
    y: eRect.top - cRect.top
  };
}
