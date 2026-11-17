/**
 * AR 頁面的觸控換頁手勢。
 *
 * 只在內容已鎖定（interactive）時生效，且避開按鈕、表單、連結與內容面板，
 * 避免使用者想操作面板時被誤判成換頁。手勢門檻刻意保守：水平位移要
 * 超過 50px，且明顯大於垂直位移，才視為左右滑動。
 */
import { emit } from "../events.js";
import { arState } from "./state.js";

export function initGestures() {
  let touchStart = null;

  window.addEventListener("touchstart", (event) => {
    // 內容還沒鎖定、或不是單指操作，就不記錄起點。
    if (!arState.interactive || event.touches.length !== 1) { touchStart = null; return; }
    // 按鈕、表單、連結與面板上的觸控要留給原本的互動，不能拿來換頁。
    if (event.target.closest && event.target.closest("button, input, textarea, select, a, #contentPanel")) {
      touchStart = null;
      return;
    }
    const t = event.touches[0];
    touchStart = { x: t.clientX, y: t.clientY };
  }, { passive: true });

  // touchmove 只負責維持被動監聽；真正的位移判斷放在 touchend，
  // 避免使用者在滑動過程中就被反覆換頁。
  window.addEventListener("touchmove", () => { /* only touchend displacement matters */ }, { passive: true });

  window.addEventListener("touchend", (event) => {
    if (!touchStart || !arState.interactive) { touchStart = null; return; }
    const t = event.changedTouches[0];
    const dx = t.clientX - touchStart.x;
    const dy = t.clientY - touchStart.y;
    touchStart = null;
    // 水平位移要超過 50px，且大於垂直位移的 1.5 倍；避免斜向滑動
    // 或只是手指抖動就觸發換頁。dx < 0 是往左滑，代表下一頁。
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      emit("page:request", arState.currentPage + (dx < 0 ? 1 : -1));
    }
  }, { passive: true });

  // 系統手勢中斷（例如通知中心）時清掉起點，避免下一次觸控誤判。
  window.addEventListener("touchcancel", () => { touchStart = null; }, { passive: true });
}
