/**
 * 「編譯並進入 AR」按鈕的可用狀態與文案。
 *
 * 只有四個條件都成立才能按：MindAR Compiler 已載入、不在上傳/編譯/
 * 還原中，而且至少有一個 target。按鈕文案會顯示目前數量，讓使用者
 * 知道這次會編譯幾張圖。
 */
import { studioState as state } from "../state.js";
import { studioDom as dom } from "../dom.js";
import { getCompilerClass } from "../../media/compiler.js";

/** 依目前狀態更新 disabled 與按鈕文字。 */
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
