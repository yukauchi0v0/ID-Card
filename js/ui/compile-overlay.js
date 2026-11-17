import { dom } from "../dom.js";

export function setCompileProgress(percent, message) {
  const value = Math.max(0, Math.min(100, Math.round(percent)));
  dom.progressBar.style.width = value + "%";
  dom.compilePct.textContent = value + "%";
  if (message) dom.compileMsg.textContent = message;
}

export function showCompileOverlay(show) {
  dom.compileOverlay.hidden = !show;
  if (show) dom.compileTitle.textContent = "正在編譯卡蓋圖案";
}
