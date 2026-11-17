import { state } from "../state.js";
import { dom } from "../dom.js";
import { getCompilerClass } from "../media/compiler.js";

export function updateEnterButton() {
  const ready = Boolean(getCompilerClass()) && !state.adding && !state.compiling && !state.restoring;
  dom.enterBtn.disabled = !state.targets.length || !ready;
  const label = dom.enterBtn.querySelector("span");
  if (label) {
    label.textContent = state.compiling
      ? "正在編譯…"
      : (state.targets.length ? "編譯 " + state.targets.length + " 個圖案並進入 AR" : "編譯並進入 AR");
  }
}
