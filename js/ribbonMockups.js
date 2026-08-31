/* =========================================================
 * MOS QUEST リボンUIモックアップ
 * 実際のOffice画面のレイアウト・配色を参考に、HTML/CSSだけで
 * 独自に描き起こしたイラストとして再現する（Microsoftのスクリーン
 * ショット・ロゴ・アイコン画像は一切使わない自作の図なので、
 * docs/microsoft-ip-guidelines.md の制約を受けない）。
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
        '<div class="ribbon-mock ribbon-mock-excel">' +
          '<div class="ribbon-titlebar"><span class="ribbon-app-icon">X</span>ブック1 - Excel</div>' +
          '<div class="ribbon-tabs">' +
            '<span>ファイル</span>' +
            '<span class="ribbon-tab-active">ホーム</span>' +
            '<span>挿入</span><span>ページレイアウト</span><span>数式</span><span>データ</span><span>校閲</span><span>表示</span>' +
          '</div>' +
          '<div class="ribbon-groups">' +
            '<div class="ribbon-cluster">' +
              '<div class="ribbon-row"><span class="ribbon-select ribbon-select-font">游ゴシック ▾</span><span class="ribbon-select ribbon-select-sm" data-region="fontSize">11 ▾</span></div>' +
              '<div class="ribbon-row">' +
                '<span class="ribbon-btn ribbon-btn-b" data-region="bold">B</span>' +
                '<span class="ribbon-btn ribbon-btn-i" data-region="italic">I</span>' +
                '<span class="ribbon-btn ribbon-btn-u" data-region="underline">U</span>' +
                '<span class="ribbon-btn ribbon-btn-fill" data-region="fillColor">🪣<i class="ribbon-swatch ribbon-swatch-yellow"></i></span>' +
              '</div>' +
              '<div class="ribbon-caption">フォント <span class="ribbon-launcher">⇲</span></div>' +
            '</div>' +
            '<span class="ribbon-sep"></span>' +
            '<div class="ribbon-cluster">' +
              '<div class="ribbon-row ribbon-row-icons"><span class="ribbon-mini">◧</span><span class="ribbon-mini">▣</span><span class="ribbon-mini">◨</span></div>' +
              '<div class="ribbon-row"><span class="ribbon-btn-wide" data-region="mergeCenter">結合して中央そろえ ▾</span></div>' +
              '<div class="ribbon-caption">配置</div>' +
            '</div>' +
            '<span class="ribbon-sep"></span>' +
            '<div class="ribbon-cluster">' +
              '<div class="ribbon-row"><span class="ribbon-select" data-region="numberFormat">標準 ▾</span></div>' +
              '<div class="ribbon-row ribbon-row-icons"><span class="ribbon-mini">%</span><span class="ribbon-mini">,</span></div>' +
              '<div class="ribbon-caption">数値 <span class="ribbon-launcher">⇲</span></div>' +
            '</div>' +
            '<span class="ribbon-sep"></span>' +
            '<div class="ribbon-cluster">' +
              '<div class="ribbon-row"><span class="ribbon-btn-wide" data-region="conditionalFormat">🎨 条件付き書式 ▾</span></div>' +
              '<div class="ribbon-row"><span class="ribbon-btn-wide">セルのスタイル ▾</span></div>' +
              '<div class="ribbon-caption">スタイル</div>' +
            '</div>' +
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
        '<div class="ribbon-mock ribbon-mock-word">' +
          '<div class="ribbon-titlebar"><span class="ribbon-app-icon">W</span>文書1 - Word</div>' +
          '<div class="ribbon-tabs">' +
            '<span>ファイル</span>' +
            '<span class="ribbon-tab-active">ホーム</span>' +
            '<span>挿入</span><span>デザイン</span><span>レイアウト</span><span>参考資料</span><span>差し込み文書</span>' +
          '</div>' +
          '<div class="ribbon-groups">' +
            '<div class="ribbon-cluster">' +
              '<div class="ribbon-row"><span class="ribbon-select ribbon-select-font">游明朝 ▾</span><span class="ribbon-select ribbon-select-sm">10.5 ▾</span></div>' +
              '<div class="ribbon-row">' +
                '<span class="ribbon-btn ribbon-btn-b" data-region="bold">B</span>' +
                '<span class="ribbon-btn ribbon-btn-i" data-region="italic">I</span>' +
                '<span class="ribbon-btn ribbon-btn-u" data-region="underline">U</span>' +
                '<span class="ribbon-btn ribbon-btn-fontcolor" data-region="fontColor">A<i class="ribbon-swatch ribbon-swatch-red"></i></span>' +
              '</div>' +
              '<div class="ribbon-caption">フォント <span class="ribbon-launcher">⇲</span></div>' +
            '</div>' +
            '<span class="ribbon-sep"></span>' +
            '<div class="ribbon-cluster">' +
              '<div class="ribbon-row"><span class="ribbon-btn" data-region="bullets">≡</span><span class="ribbon-mini">①</span><span class="ribbon-mini">≡+</span></div>' +
              '<div class="ribbon-row ribbon-row-icons">' +
                '<span class="ribbon-mini" data-region="alignLeft">◧</span>' +
                '<span class="ribbon-mini" data-region="alignCenter">▣</span>' +
                '<span class="ribbon-mini" data-region="alignRight">◨</span>' +
                '<span class="ribbon-mini" data-region="lineSpacing">↕</span>' +
              '</div>' +
              '<div class="ribbon-caption">段落 <span class="ribbon-launcher">⇲</span></div>' +
            '</div>' +
            '<span class="ribbon-sep"></span>' +
            '<div class="ribbon-cluster">' +
              '<div class="ribbon-row"><span class="ribbon-btn-wide">標準</span><span class="ribbon-btn-wide ribbon-btn-active">見出し1</span></div>' +
              '<div class="ribbon-caption">スタイル</div>' +
            '</div>' +
          '</div>' +
          '<div class="ribbon-sheet ribbon-doc">' +
            '<div class="ribbon-doc-line"></div>' +
            '<div class="ribbon-doc-line short"></div>' +
            '<div class="ribbon-doc-line"></div>' +
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
