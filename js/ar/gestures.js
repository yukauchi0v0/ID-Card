import { emit } from "../events.js";
import { arState } from "./state.js";

export function initGestures() {
  let touchStart = null;

  window.addEventListener("touchstart", (event) => {
    if (!arState.interactive || event.touches.length !== 1) { touchStart = null; return; }
    if (event.target.closest && event.target.closest("button, input, textarea, select, a, #contentPanel")) {
      touchStart = null;
      return;
    }
    const t = event.touches[0];
    touchStart = { x: t.clientX, y: t.clientY };
  }, { passive: true });

  window.addEventListener("touchmove", () => { /* only touchend displacement matters */ }, { passive: true });

  window.addEventListener("touchend", (event) => {
    if (!touchStart || !arState.interactive) { touchStart = null; return; }
    const t = event.changedTouches[0];
    const dx = t.clientX - touchStart.x;
    const dy = t.clientY - touchStart.y;
    touchStart = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      emit("page:request", arState.currentPage + (dx < 0 ? 1 : -1));
    }
  }, { passive: true });

  window.addEventListener("touchcancel", () => { touchStart = null; }, { passive: true });
}
