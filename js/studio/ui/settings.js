/**
 * 「AR 顯示位置」控制項。
 *
 * `settings` 的單位是公分；示意圖只是比例尺，不是真實 AR 場景，因此
 * 用固定像素換算（1cm ≈ 12px）讓使用者能直覺調整，不要當成精準預覽。
 */
import { studioState as state } from "../state.js";
import { studioDom as dom, orientationButtons, positionButtons } from "../dom.js";
import { clamp } from "../../utils/format.js";

/**
 * 把 state.settings 同步到所有 range/select/按鈕與數字標籤。
 * 由 initSettings 的事件與 restoreSession 呼叫。
 */
export function updateSettingsUi() {
  dom.gapValue.textContent = state.settings.gapCm.toFixed(2) + " cm";
  dom.offsetXValue.textContent = state.settings.offsetXCm.toFixed(1) + " cm";
  dom.offsetYValue.textContent = state.settings.offsetYCm.toFixed(1) + " cm";
  dom.scaleValue.textContent = Math.round(state.settings.scale * 100) + "%";
  dom.gapRange.value = state.settings.gapCm;
  dom.offsetXRange.value = state.settings.offsetXCm;
  dom.offsetYRange.value = state.settings.offsetYCm;
  dom.scaleRange.value = state.settings.scale;
  dom.stabilitySelect.value = state.settings.stability;

  positionButtons.forEach((btn) => {
    btn.classList.toggle("active", btn.getAttribute("data-position") === state.settings.position);
  });
  orientationButtons.forEach((btn) => {
    btn.classList.toggle("active", btn.getAttribute("data-orientation") === state.settings.orientation);
  });

  updateDiagram();
}

/**
 * 重畫「卡面 + 內容」示意圖。
 *
 * 這裡用簡化的矩形與固定像素比例，目的只是讓使用者知道內容會出現在
 * 卡片的上/下/左/右，以及 offset 是否會讓內容壓到卡面；真正的 3D 位置
 * 由 `js/ar/content.js` 的 layoutCard 計算。
 */
export function updateDiagram() {
  const rect = dom.diagram.getBoundingClientRect();
  const width = rect.width || 290;
  const height = rect.height || 210;
  const cardW = 122;
  const cardH = 77;
  const contentW = 96;
  const contentH = 54;
  // gapPx 是「卡片與內容之間的視覺間距」；offset 是額外平移。
  // 兩者分開，使用者才能先把內容放遠，再微調到想要的位置。
  const gapPx = 8 + state.settings.gapCm * 14;
  const offX = state.settings.offsetXCm * 12;
  const offY = state.settings.offsetYCm * 12;
  const cx = width / 2;
  const cy = height / 2;
  let x = cx;
  let y = cy;
  let overlap = state.settings.position === "center";

  if (state.settings.position === "above") {
    y = cy - cardH / 2 - gapPx - contentH / 2;
    if (offY < -state.settings.gapCm * 11.5) overlap = true;
  } else if (state.settings.position === "below") {
    y = cy + cardH / 2 + gapPx + contentH / 2;
    if (offY > state.settings.gapCm * 11.5) overlap = true;
  } else if (state.settings.position === "left") {
    x = cx - cardW / 2 - gapPx - contentW / 2;
    if (offX > state.settings.gapCm * 11.5) overlap = true;
  } else if (state.settings.position === "right") {
    x = cx + cardW / 2 + gapPx + contentW / 2;
    if (offX < -state.settings.gapCm * 11.5) overlap = true;
  }

  x = clamp(x + offX, contentW / 2 + 10, width - contentW / 2 - 10);
  y = clamp(y + offY, contentH / 2 + 10, height - contentH / 2 - 10);
  dom.diagramContent.style.left = x + "px";
  dom.diagramContent.style.top = y + "px";
  dom.diagramContent.classList.toggle("overlap", overlap);
  dom.overlapHint.hidden = !overlap;
}

/** 綁定位置/方向/間距/位移/大小/穩定度與 resize；由 initApp() 呼叫一次。 */
export function initSettings() {
  positionButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      state.settings.position = btn.getAttribute("data-position");
      updateSettingsUi();
    });
  });
  orientationButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      state.settings.orientation = btn.getAttribute("data-orientation");
      updateSettingsUi();
    });
  });
  dom.gapRange.addEventListener("input", () => { state.settings.gapCm = Number(dom.gapRange.value); updateSettingsUi(); });
  dom.offsetXRange.addEventListener("input", () => { state.settings.offsetXCm = Number(dom.offsetXRange.value); updateSettingsUi(); });
  dom.offsetYRange.addEventListener("input", () => { state.settings.offsetYCm = Number(dom.offsetYRange.value); updateSettingsUi(); });
  dom.scaleRange.addEventListener("input", () => { state.settings.scale = Number(dom.scaleRange.value); updateSettingsUi(); });
  dom.stabilitySelect.addEventListener("change", () => { state.settings.stability = dom.stabilitySelect.value; });
  window.addEventListener("resize", updateDiagram);
}
