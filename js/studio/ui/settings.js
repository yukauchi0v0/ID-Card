import { studioState as state } from "../state.js";
import { studioDom as dom, orientationButtons, positionButtons } from "../dom.js";
import { clamp } from "../../utils/format.js";

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

export function updateDiagram() {
  const rect = dom.diagram.getBoundingClientRect();
  const width = rect.width || 290;
  const height = rect.height || 210;
  const cardW = 122;
  const cardH = 77;
  const contentW = 96;
  const contentH = 54;
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
