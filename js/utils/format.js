/**
 * 與畫面無關的小型格式化工具。
 * 保持純函式，方便在 studio、viewer 與測試中重複使用。
 */

/** 補零到兩位，例如 1 → "01"。 */
export const pad2 = (n) => String(n).padStart(2, "0");

/** 把數值限制在 min 與 max 之間；min 大於 max 時以 min 為準。 */
export const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

/**
 * 轉義要放進 innerHTML 的使用者文字，避免 `<`、`&`、引號破壞版面或
 * 注入 HTML。純文字插入（textContent）不需要先呼叫這個。
 *
 * @param {unknown} value
 * @returns {string}
 */
export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[ch]));
}

/**
 * 等到瀏覽器真的完成一次繪製後才 resolve。
 * 用在「先顯示進度/遮罩，再開始耗時工作」的流程，讓使用者看得到狀態。
 *
 * @returns {Promise<void>}
 */
export function nextPaint() {
  return new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));
}

/**
 * 把 bytes 轉成人類可讀的 KB/MB 字串。
 *
 * @param {number} bytes
 * @returns {string}
 */
export function byteLabel(bytes) {
  if (!bytes) return "0 B";
  if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}
