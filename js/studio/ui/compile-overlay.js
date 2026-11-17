/**
 * 編譯進度遮罩。
 *
 * MindAR 的 compileImageTargets 會回報 0–100；這裡只負責把數字與文案
 * 畫到畫面上，不決定什麼時候開始/結束（那是 studio/app.js 的職責）。
 */
import { studioDom as dom } from "../dom.js";

/**
 * 更新進度條、百分比與說明文字。
 * percent 會被 clamp 到 0–100，避免編譯器回報浮點/超界值讓 UI 破版。
 *
 * @param {number} percent
 * @param {string} [message] 有值才更新說明文字，避免每個 tick 都重寫。
 */
export function setCompileProgress(percent, message) {
  const value = Math.max(0, Math.min(100, Math.round(percent)));
  dom.progressBar.style.width = value + "%";
  dom.compilePct.textContent = value + "%";
  if (message) dom.compileMsg.textContent = message;
}

/**
 * 顯示/隱藏編譯遮罩；每次顯示都重設標題，避免沿用上一次的狀態。
 *
 * @param {boolean} show
 */
export function showCompileOverlay(show) {
  dom.compileOverlay.hidden = !show;
  if (show) dom.compileTitle.textContent = "正在編譯卡蓋圖案";
}
