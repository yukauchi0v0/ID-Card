/**
 * AR HUD 的顯示邏輯。
 *
 * 這裡只根據 `arState` 決定「現在該顯示什麼」，不主動改變追蹤或場景。
 * 幾個容易混淆的狀態：
 * - sceneReady：相機與 scene 已啟動，但還沒看到卡蓋。
 * - everFound：這次 AR session 曾經找到過卡蓋，用來區分「還沒掃到」與
 *   「掃到後又離開」。
 * - interactive：目前有卡蓋鎖定，才允許換頁、開面板與播放影片。
 */
import { PANEL_TYPES, TYPE_LABELS } from "../config.js";
import { arState } from "./state.js";
import { arDom } from "./dom.js";
import { clamp, pad2 } from "../utils/format.js";
import { emit } from "../events.js";

/**
 * 依目前的 targets 重建頁面圓點。
 * 每次 startAr 或卡片數量改變時呼叫；點擊圓點只發出事件，不直接換頁。
 */
export function buildDots() {
  arDom.dots.innerHTML = "";
  arState.targets.forEach((target, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "dot";
    button.dataset.page = String(index);
    button.setAttribute("role", "tab");
    button.setAttribute("aria-label", "第 " + (index + 1) + " 頁：" + (target.label || "未命名"));
    button.addEventListener("click", () => emit("page:request", index));
    arDom.dots.appendChild(button);
  });
  updateHud();
}

/**
 * 同步圓點的選取狀態與可用性。
 * 未鎖定卡蓋時全部 disabled，避免使用者在掃描中誤觸換頁。
 */
export function updateDots() {
  arDom.dots.querySelectorAll(".dot").forEach((dot, index) => {
    dot.classList.toggle("active", index === arState.currentPage);
    dot.setAttribute("aria-selected", index === arState.currentPage ? "true" : "false");
    dot.disabled = !arState.interactive;
  });
}

/**
 * 更新整個 HUD 的文字、狀態與按鈕。
 *
 * 這是純顯示函式：只讀 arState，不改追蹤或頁面。頁碼會先 clamp，
 * 避免刪除卡片後 currentPage 還停在舊的超出範圍值。
 */
export function updateHud() {
  const total = arState.targets.length;
  const safePage = total ? clamp(arState.currentPage, 0, total - 1) : 0;
  const page = total ? arState.targets[safePage] : null;
  const label = page ? (page.label || "內容 " + (safePage + 1)) : "等待識別";

  arDom.pageCounter.textContent = pad2(safePage + 1) + " / " + pad2(Math.max(1, total));
  // 標題優先用「卡蓋已離開」而不是「等待識別」，讓使用者知道剛剛其實
  // 有掃到，只是鏡頭移開了；cameraError 的優先級最高。
  arDom.hudLabel.textContent = arState.cameraError
    ? "相機沒有啟動"
    : (arState.interactive ? label : (arState.everFound ? "卡蓋已離開畫面" : "等待識別"));
  arDom.hudMode.textContent = arState.cameraError
    ? "相機錯誤"
    : (arState.interactive ? "已鎖定" : ((arState.sceneReady || arState.everFound) ? "掃描中" : "等待相機"));
  arDom.hudMode.classList.toggle("ok", arState.interactive);
  arDom.scanGuide.classList.toggle("is-hidden", arState.interactive);
  arDom.swipeHint.hidden = !(arState.interactive && total > 1 && !arState.panelOpen);
  updateDots();

  arDom.panelPrev.disabled = !arState.interactive || total < 2;
  arDom.panelNext.disabled = !arState.interactive || total < 2;
  arDom.panelOpenBtn.hidden = !(arState.interactive && page && PANEL_TYPES.has(page.contentType) && !arState.panelOpen);
  arDom.videoSoundBtn.hidden = !(arState.interactive && page && page.contentType === "video" && arState.activeVideo);
  arDom.videoSoundBtn.textContent = arState.videoMuted ? "開啟聲音" : "靜音";

  if (arState.panelOpen) {
    arDom.panelKicker.textContent = (page ? TYPE_LABELS[page.contentType] : "內容") +
      " · " + pad2(safePage + 1) + " / " + pad2(Math.max(1, total)) +
      (arState.interactive ? "" : " · 卡蓋已離開");
  }
}

/**
 * 綁定 HUD 上的一次性控制項（目前是影片聲音）。
 * 由 `initArUi()` 呼叫，只綁一次。
 */
export function initHud() {
  arDom.videoSoundBtn.addEventListener("click", async () => {
    if (!arState.activeVideo) return;
    arState.videoMuted = !arState.videoMuted;
    arState.activeVideo.muted = arState.videoMuted;
    try { await arState.activeVideo.play(); } catch (err) { /* 使用者手勢不足時瀏覽器會拒絕，忽略即可 */ }
    updateHud();
  });
}
