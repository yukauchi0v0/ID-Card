import { PANEL_TYPES, TYPE_LABELS } from "../config.js";
import { arState } from "./state.js";
import { arDom } from "./dom.js";
import { clamp, pad2 } from "../utils/format.js";
import { emit } from "../events.js";

export function buildDots() {
  arDom.dots.innerHTML = "";
  arState.targets.forEach((target, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "dot";
    button.dataset.page = String(index);
    button.setAttribute("role", "tab");
    button.setAttribute("aria-label", "第 " + (index + 1) + " 頁：" + (target.label || "未命名"));
    button.addEventListener("click", () => emit("page:request", index));
    arDom.dots.appendChild(button);
  });
  updateHud();
}

export function updateDots() {
  arDom.dots.querySelectorAll(".dot").forEach((dot, index) => {
    dot.classList.toggle("active", index === arState.currentPage);
    dot.setAttribute("aria-selected", index === arState.currentPage ? "true" : "false");
    dot.disabled = !arState.interactive;
  });
}

export function updateHud() {
  const total = arState.targets.length;
  const safePage = total ? clamp(arState.currentPage, 0, total - 1) : 0;
  const page = total ? arState.targets[safePage] : null;
  const label = page ? (page.label || "內容 " + (safePage + 1)) : "等待識別";

  arDom.pageCounter.textContent = pad2(safePage + 1) + " / " + pad2(Math.max(1, total));
  arDom.hudLabel.textContent = arState.cameraError
    ? "相機沒有啟動"
    : (arState.interactive ? label : (arState.everFound ? "卡蓋已離開畫面" : "等待識別"));
  arDom.hudMode.textContent = arState.cameraError
    ? "相機錯誤"
    : (arState.interactive ? "已鎖定" : ((arState.sceneReady || arState.everFound) ? "掃描中" : "等待相機"));
  arDom.hudMode.classList.toggle("ok", arState.interactive);
  arDom.scanGuide.classList.toggle("is-hidden", arState.interactive);
  arDom.swipeHint.hidden = !(arState.interactive && total > 1 && !arState.panelOpen);
  updateDots();

  arDom.panelPrev.disabled = !arState.interactive || total < 2;
  arDom.panelNext.disabled = !arState.interactive || total < 2;
  arDom.panelOpenBtn.hidden = !(arState.interactive && page && PANEL_TYPES.has(page.contentType) && !arState.panelOpen);
  arDom.videoSoundBtn.hidden = !(arState.interactive && page && page.contentType === "video" && arState.activeVideo);
  arDom.videoSoundBtn.textContent = arState.videoMuted ? "開啟聲音" : "靜音";

  if (arState.panelOpen) {
    arDom.panelKicker.textContent = (page ? TYPE_LABELS[page.contentType] : "內容") +
      " · " + pad2(safePage + 1) + " / " + pad2(Math.max(1, total)) +
      (arState.interactive ? "" : " · 卡蓋已離開");
  }
}

export function initHud() {
  arDom.videoSoundBtn.addEventListener("click", async () => {
    if (!arState.activeVideo) return;
    arState.videoMuted = !arState.videoMuted;
    arState.activeVideo.muted = arState.videoMuted;
    try { await arState.activeVideo.play(); } catch (err) { /* noop */ }
    updateHud();
  });
}
