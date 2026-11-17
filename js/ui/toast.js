import { state } from "../state.js";
import { dom } from "../dom.js";

export function toast(message, duration = 3600) {
  window.clearTimeout(state.toastTimer);
  window.clearTimeout(state.toastHideTimer);
  dom.toast.textContent = message;
  dom.toast.hidden = false;
  requestAnimationFrame(() => dom.toast.classList.add("show"));
  state.toastTimer = window.setTimeout(() => {
    dom.toast.classList.remove("show");
    state.toastHideTimer = window.setTimeout(() => { dom.toast.hidden = true; }, 220);
  }, duration);
}
