import { arDom } from "../ar/dom.js";

let timer = null;
let hideTimer = null;

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
