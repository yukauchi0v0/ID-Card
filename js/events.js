/**
 * 極簡事件匯流排。
 *
 * 用來解開 AR 內容、HUD 與內容面板之間的循環依賴：
 * 內容模組只負責發出 `page:request`，實際換頁由 content.js 的監聽器處理。
 * 事件只存在於同一個頁面，不會跨視窗或跨頁傳遞。
 */
const listeners = new Map();

/**
 * 訂閱事件。
 *
 * @param {string} name 事件名稱，例如 `page:request`。
 * @param {(detail: any) => void} handler 收到事件時呼叫的函式。
 * @returns {() => void} 取消訂閱；呼叫後 handler 不會再被觸發。
 */
export function on(name, handler) {
  if (!listeners.has(name)) listeners.set(name, new Set());
  listeners.get(name).add(handler);
  return () => listeners.get(name)?.delete(handler);
}

/**
 * 發出事件。
 *
 * 先複製一份 handler 清單再逐一呼叫，避免某個 handler 在執行中取消
 * 訂閱（或新增訂閱）時，讓這一輪的迭代漏掉其他 listener。
 *
 * @param {string} name 事件名稱。
 * @param {any} [detail] 傳給 handler 的資料。
 */
export function emit(name, detail) {
  const handlers = listeners.get(name);
  if (!handlers) return;
  for (const handler of [...handlers]) handler(detail);
}
