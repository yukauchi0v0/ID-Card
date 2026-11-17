import { PANEL_TYPES, TYPE_LABELS } from "../config.js";
import { state } from "../state.js";
import { dom } from "../dom.js";
import { clamp, pad2 } from "../utils/format.js";
import { emit } from "../events.js";

export function buildDots() {
  dom.dots.innerHTML = "";
  state.targets.forEach((target, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "dot";
    button.dataset.page = String(index);
    button.setAttribute("role", "tab");
    button.setAttribute("aria-label", "第 " + (index + 1) + " 頁：" + (target.label || "未命名"));
    button.addEventListener("click", () => emit("page:request", index));
    dom.dots.appendChild(button);
  });
  updateHud();
}

export function updateDots() {
  dom.dots.querySelectorAll(".dot").forEach((dot, index) => {
    dot.classList.toggle("active", index === state.currentPage);
    dot.setAttribute("aria-selected", index === state.currentPage ? "true" : "false");
    dot.disabled = !state.interactive;
  });
}

export function updateHud() {
  const total = state.targets.length;
  const safePage = total ? clamp(state.currentPage, 0, total - 1) : 0;
  const page = total ? state.targets[safePage] : null;
  const label = page ? (page.label || "內容 " + (safePage + 1)) : "等待識別";

  dom.pageCounter.textContent = pad2(safePage + 1) + " / " + pad2(Math.max(1, total));
  dom.hudLabel.textContent = state.cameraError
    ? "相機沒有啟動"
    : (state.interactive ? label : (state.everFound ? "卡蓋已離開畫面" : "等待識別"));
  dom.hudMode.textContent = state.cameraError
    ? "相機錯誤"
    : (state.interactive ? "已鎖定" : ((state.sceneReady || state.everFound) ? "掃描中" : "等待相機"));
  dom.hudMode.classList.toggle("ok", state.interactive);
  dom.scanGuide.classList.toggle("is-hidden", state.interactive);
  dom.swipeHint.hidden = !(state.interactive && total > 1 && !state.panelOpen);
  updateDots();

  dom.panelPrev.disabled = !state.interactive || total < 2;
  dom.panelNext.disabled = !state.interactive || total < 2;
  dom.panelOpenBtn.hidden = !(state.interactive && page && PANEL_TYPES.has(page.contentType) && !state.panelOpen);
  dom.videoSoundBtn.hidden = !(state.interactive && page && page.contentType === "video" && state.activeVideo);
  dom.videoSoundBtn.textContent = state.videoMuted ? "開啟聲音" : "靜音";

  if (state.panelOpen) {
    dom.panelKicker.textContent = (page ? TYPE_LABELS[page.contentType] : "內容") +
      " · " + pad2(safePage + 1) + " / " + pad2(Math.max(1, total)) +
      (state.interactive ? "" : " · 卡蓋已離開");
  }
}

export function initHud() {
  dom.videoSoundBtn.addEventListener("click", async () => {
    if (!state.activeVideo) return;
    state.videoMuted = !state.videoMuted;
    state.activeVideo.muted = state.videoMuted;
    try { await state.activeVideo.play(); } catch (err) { /* noop */ }
    updateHud();
  });
}
