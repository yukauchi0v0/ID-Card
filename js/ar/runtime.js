/**
 * AR 生命週期協調層。
 *
 * 把「建立/銷毀 AR」與「宿主頁面自己的 UI」切開：
 * - studio 用它在編譯後進入 AR，返回時回到設定頁。
 * - viewer 用它在名片頁按下「用 AR 看」後進入 AR，返回時回到名片。
 *
 * 這個模組只處理 AR 內部狀態與資源；下載、發布、名片資料都不在這裡。
 */
import { DEFAULT_SETTINGS } from "../config.js";
import { arDom } from "./dom.js";
import { arState } from "./state.js";
import { buildDots, initHud, updateHud } from "./hud.js";
import { closePanel, initPanel } from "./panel.js";
import { initGestures } from "./gestures.js";
import { mountArScene, teardownScene } from "./scene.js";
import { disposePageCaches, stopActiveVideo } from "../media/textures.js";

let uiReady = false;

/**
 * 初始化 AR UI 的事件監聽；整個頁面只需一次。
 * 必須在 `mountArShell()` 之後呼叫，因為 HUD/panel 的 DOM 已經解析完成。
 */
export function initArUi() {
  if (uiReady) return;
  uiReady = true;
  initHud();
  initPanel();
  initGestures();
}

// 螢幕喚醒鎖定：避免使用者掃卡時手機自動鎖屏。
// 瀏覽器不支援或使用者拒絕時安靜失敗，不影響 AR。
async function requestWakeLock() {
  if (!("wakeLock" in navigator) || arState.wakeLock) return;
  try {
    const lock = await navigator.wakeLock.request("screen");
    if (arState.sceneEl) arState.wakeLock = lock;
    else { try { lock.release(); } catch (err) { /* noop */ } }
  } catch (err) { /* noop */ }
}

function releaseWakeLock() {
  if (!arState.wakeLock) return;
  try { arState.wakeLock.release(); } catch (err) { /* noop */ }
  arState.wakeLock = null;
}

/**
 * 啟動一次 AR session。
 *
 * 先把上一輪的 scene、影片、材質與 Blob URL 清乾淨，再重設狀態；這樣
 * studio 重新編譯或 viewer 來回切換時，不會殘留舊頁面或舊相機。
 * `onReady` / `onError` 由宿主頁面提供，AR 核心只回報結果，不直接操作
 * 製作端或觀看端的載入遮罩。
 *
 * @param {object} options
 * @param {Array<object>} options.targets 卡蓋與內容資料。
 * @param {object} options.settings 位置、大小、追蹤等設定。
 * @param {string} options.mindUrl 編譯後的 `.mind` Blob URL。
 * @param {() => void} [options.onReady] 相機與 scene 就緒時呼叫。
 * @param {(error: any) => void} [options.onError] 啟動失敗時呼叫。
 * @param {"studio"|"viewer"} [options.host] 目前入口，決定 HUD 是否顯示
 *   「看完了？聯絡我」按鈕。
 */
export function startAr({ targets, settings, mindUrl, onReady, onError, host = "" }) {
  teardownScene();
  closePanel();
  stopActiveVideo();
  disposePageCaches(arState.targets);
  window.clearTimeout(arState.readyTimer);

  arState.targets = targets;
  arState.settings = Object.assign({}, DEFAULT_SETTINGS, settings);
  arState.mindUrl = mindUrl;
  arState.onReady = onReady || null;
  arState.onError = onError || null;
  arState.host = host;
  arState.sceneReady = false;
  arState.cameraError = false;
  arState.interactive = false;
  arState.everFound = false;
  arState.currentPage = 0;
  arState.activeTarget = -1;
  arState.activeCard = null;
  arState.panelOpen = false;
  arState.panelPage = -1;
  arState.activeVideo = null;
  arState.videoMuted = true;
  arState.renderToken++;
  arDom.errorPanel.hidden = true;
  arDom.arRoot.hidden = false;
  arDom.arHud.hidden = false;
  document.body.classList.add("ar-active");
  buildDots();
  mountArScene(mindUrl);
  requestWakeLock().catch(() => {});
}

/**
 * 停止 AR 並把共用狀態回到初始值。
 *
 * 清理順序很重要：先停面板/影片與 scene，再釋放材質與 `.mind` Blob URL；
 * 若先 revoke URL，MindAR 可能還在讀取，會留下相機或網路錯誤。
 */
export function stopAr() {
  window.clearTimeout(arState.readyTimer);
  arState.readyTimer = null;
  arState.interactive = false;
  arState.everFound = false;
  arState.cameraError = false;
  arState.activeTarget = -1;
  arState.activeCard = null;
  arState.sceneReady = false;
  arState.panelOpen = false;
  arState.panelPage = -1;
  arState.renderToken++;
  closePanel();
  stopActiveVideo();
  teardownScene();
  disposePageCaches(arState.targets);
  if (arState.mindUrl) {
    URL.revokeObjectURL(arState.mindUrl);
    arState.mindUrl = null;
  }
  releaseWakeLock();
  arDom.errorPanel.hidden = true;
  arDom.arRoot.hidden = true;
  arDom.arHud.hidden = true;
  arDom.videoSoundBtn.hidden = true;
  arDom.panelOpenBtn.hidden = true;
  arDom.viewerContactCta.hidden = true;
  document.body.classList.remove("ar-active", "panel-open");
  arState.sceneEl = null;
  arState.cards = [];
  arState.targets = [];
  arState.onReady = null;
  arState.onError = null;
  arState.host = "";
  arState.settings = { ...DEFAULT_SETTINGS };
  arState.currentPage = 0;
  arState.activeVideo = null;
  arState.videoMuted = true;
  updateHud();
}
