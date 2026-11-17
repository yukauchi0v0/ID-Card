/**
 * 全站共用的小型提示訊息。
 *
 * 依賴 AR shell 注入的 `#toast`，所以宿主頁面必須先呼叫 `mountArShell()`。
 * 不自動建立 DOM，是為了讓 studio 與 viewer 使用同一個位置與樣式。
 */
import { arDom } from "../ar/dom.js";

let timer = null;
let hideTimer = null;

/**
 * 顯示一則 toast；新的訊息會蓋掉上一則。
 *
 * 先移除 `.show` 再加回去，讓連續呼叫時動畫會重新播放；
 * duration 後淡出，220ms 後才設 hidden，避免元素還看得見就被藏起來。
 *
 * @param {string} message 要顯示的文字。
 * @param {number} [duration] 停留毫秒數，預設 3600。
 */
export function toast(message, duration = 3600) {
  window.clearTimeout(timer);
  window.clearTimeout(hideTimer);
  arDom.toast.textContent = message;
  arDom.toast.hidden = false;
  requestAnimationFrame(() => arDom.toast.classList.add("show"));
  timer = window.setTimeout(() => {
    arDom.toast.classList.remove("show");
    hideTimer = window.setTimeout(() => { arDom.toast.hidden = true; }, 220);
  }, duration);
}
