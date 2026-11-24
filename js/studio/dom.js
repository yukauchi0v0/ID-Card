/**
 * 製作端專用的 DOM 參照。
 *
 * AR 外殼的 id（`#arRoot`、`#toast`、`#contentPanel` 等）在
 * `js/ar/dom.js`，由 `js/ar/shell.js` 在 app 載入前注入；兩邊不要互相
 * 抓取，否則很容易出現「元素還沒存在」的初始化順序問題。
 */
function byId(id) {
  const el = document.getElementById(id);
  if (!el) throw new Error("Missing required element #" + id);
  return el;
}

export const studioDom = {
  // 主要設定頁與卡蓋清單。
  setup: byId("setup"),
  cards: byId("cards"),
  emptyHint: byId("emptyHint"),
  countBadge: byId("countBadge"),
  dropZone: byId("dropZone"),
  fileInput: byId("fileInput"),

  // 編譯遮罩與進入 AR 按鈕。
  enterBtn: byId("enterBtn"),
  compileOverlay: byId("compileOverlay"),
  compileTitle: byId("compileTitle"),
  compileMsg: byId("compileMsg"),
  progressBar: byId("progressBar"),
  compilePct: byId("compilePct"),

  // 名片資料（viewer 的普通名片頁）。
  profileName: byId("profileName"),
  profileTitle: byId("profileTitle"),
  profileCompany: byId("profileCompany"),
  profilePhone: byId("profilePhone"),
  profileEmail: byId("profileEmail"),
  profileWebsite: byId("profileWebsite"),
  profileSlug: byId("profileSlug"),
  publishBtn: byId("publishBtn"),

  // AR 顯示位置示意圖與控制項。
  diagram: byId("diagram"),
  diagramContent: byId("diagramContent"),
  overlapHint: byId("overlapHint"),
  gapRange: byId("gapRange"),
  gapValue: byId("gapValue"),
  offsetXRange: byId("offsetXRange"),
  offsetXValue: byId("offsetXValue"),
  offsetYRange: byId("offsetYRange"),
  offsetYValue: byId("offsetYValue"),
  scaleRange: byId("scaleRange"),
  scaleValue: byId("scaleValue"),
  stabilitySelect: byId("stabilitySelect"),

  // 雲端帳號：登入表單、登入後的顯示名稱與名片代碼。
  accountSignedOut: byId("accountSignedOut"),
  accountSignedIn: byId("accountSignedIn"),
  accountEmail: byId("accountEmail"),
  displayName: byId("displayName"),
  saveDisplayName: byId("saveDisplayName"),
  cardCodeText: byId("cardCodeText"),
  signOutBtn: byId("signOutBtn"),
  signInEmail: byId("signInEmail"),
  signInBtn: byId("signInBtn"),
  signInStatus: byId("signInStatus"),
  saveBtn: byId("saveBtn"),
  publishedInfo: byId("publishedInfo"),

  // 本機紀錄與發布/QR 面板。
  clearSavedBtn: byId("clearSavedBtn"),
  shareOverlay: byId("shareOverlay"),
  shareUrl: byId("shareUrl"),
  shareQr: byId("shareQr"),
  shareCopy: byId("shareCopy"),
  shareDownload: byId("shareDownload"),
  shareQrDownload: byId("shareQrDownload"),
  shareClose: byId("shareClose")
};

// 這兩個是「按鈕群組」，不是單一元素；用 querySelectorAll 一次抓齊，
// 由 settings.js 依資料屬性綁定。
export const positionButtons = Array.from(document.querySelectorAll("[data-position]"));
export const orientationButtons = Array.from(document.querySelectorAll("[data-orientation]"));
