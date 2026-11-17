/**
 * 製作端主流程：上傳 → 驗證 → 編譯 → 進入 AR → 發布。
 *
 * 這裡只負責「把各模組串起來」與流程狀態；UI 細節在 `ui/`，編譯器細節
 * 在 `media/`，卡片包在 `card-package.js`。若之後要換掉某個環節，盡量
 * 改對應模組，不要把邏輯再塞回這個檔案。
 */
import { TYPE_LABELS } from "../config.js";
import { studioState as state } from "./state.js";
import { studioDom as dom } from "./dom.js";
import { nextPaint } from "../utils/format.js";
import { countCompiledFeatures, getCompilerClass } from "../media/compiler.js";
import { setCompileProgress, showCompileOverlay } from "./ui/compile-overlay.js";
import { initTargets, renderCards } from "./ui/targets.js";
import { initSettings, updateSettingsUi } from "./ui/settings.js";
import { initProfile } from "./profile.js";
import { initShare } from "./share.js";
import { initArUi, startAr, stopAr } from "../ar/runtime.js";
import { arDom } from "../ar/dom.js";
import {
  initSessionControls,
  restoreSession,
  saveSession,
  targetSignature
} from "./session.js";
import { updateEnterButton } from "./ui/enter-button.js";
import { toast } from "../shared/toast.js";

/**
 * 進入 AR 時把設定頁藏起來；AR 的 HUD/面板由 shell 控制。
 * 不在這裡呼叫 updateHud()，因為 AR 尚未啟動，HUD 還沒有資料。
 */
function showArUi() {
  dom.setup.hidden = true;
}

/**
 * 檢查每一頁是否有足夠的內容可以編譯/發布。
 * 文字頁允許空白（會用預設文案），檔案型與連結型則必須有對應資料。
 *
 * @returns {boolean} 驗證通過回傳 true；失敗會顯示 toast 並回傳 false。
 */
function validateTargets() {
  if (!state.targets.length) { toast("先上傳至少一張卡蓋圖案。"); return false; }
  for (let i = 0; i < state.targets.length; i++) {
    const target = state.targets[i];
    const n = i + 1;
    if (target.contentType === "text") {
      // Text may be blank; a default description is rendered.
    } else if (target.contentType === "image" || target.contentType === "video" || target.contentType === "pdf") {
      if (!target.contentFile || !target.contentObjectUrl) {
        toast("第 " + n + " 頁還沒選「" + TYPE_LABELS[target.contentType] + "」檔案。", 5000);
        return false;
      }
    } else if (target.contentType === "videoLink" || target.contentType === "webpage") {
      if (!/^https?:\/\//i.test(target.url || "")) {
        toast("第 " + n + " 頁的網址不是有效的 http(s) 網址。", 5000);
        return false;
      }
    }
  }
  return true;
}

/**
 * 進入 AR。
 *
 * 有兩種路徑：
 * 1. 快取命中：卡蓋 signature 與上次相同，直接重用 `.mind`，不必重編譯。
 * 2. 重新編譯：呼叫 MindAR Compiler，exportData 後存成 Blob。
 *
 * 編譯期間會鎖住按鈕並顯示進度遮罩；失敗時要同時收掉遮罩、恢復設定頁，
 * 不能只顯示 toast 讓畫面卡在空白。
 */
async function enterAr() {
  // 先做「不用花時間」的檢查，避免使用者等完編譯才發現缺檔。
  if (state.compiling) return;
  if (state.adding) { toast("圖片還在讀取，請稍等一下。"); return; }
  if (!validateTargets()) return;
  if (!window.isSecureContext) { toast("相機需要 HTTPS 或 localhost，請用 https:// 網址打開。", 5200); return; }
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    toast("目前瀏覽器不支援相機，請使用 iOS Safari 或 Chrome。", 5200);
    return;
  }
  const Compiler = getCompilerClass();
  if (!Compiler) { toast("MindAR 還沒載入完成，請檢查網路後重新整理。", 5200); return; }

  // signature 由「檔名 + 大小」組成；只要卡蓋圖換了，快取就會失效。
  const signature = targetSignature();
  state.compiling = true;
  updateEnterButton();
  setCompileProgress(0, "全部在本機完成，不會上傳卡面。");
  showCompileOverlay(true);
  await nextPaint();

  // 同一組卡蓋圖：重用上次的 .mind，跳過最耗時的編譯。
  if (state.mindBlob && state.mindSignature === signature) {
    try {
      setCompileProgress(12, "正在讀取上次編譯的 .mind…");
      state.mindUrl = URL.createObjectURL(state.mindBlob);
      setCompileProgress(100, "正在啟動相機…");
      dom.compileTitle.textContent = "正在啟動相機";
      showArUi();
      startAr({
        targets: state.targets,
        settings: state.settings,
        mindUrl: state.mindUrl,
        onReady: () => showCompileOverlay(false),
        onError: () => showCompileOverlay(false)
      });
      state.compiling = false;
      updateEnterButton();
      saveSession().catch((err) => {
        console.warn("[ID Card] 本機儲存失敗", err);
        toast("這次設定無法寫入手機儲存空間，可能已滿。", 5200);
      });
      return;
    } catch (err) {
      console.error("[ID Card] 載入快取 .mind 失敗", err);
      state.compiling = false;
      updateEnterButton();
      showCompileOverlay(false);
      if (document.body.classList.contains("ar-active")) exitAr();
      else if (state.mindUrl) { URL.revokeObjectURL(state.mindUrl); state.mindUrl = null; }
      toast("載入上次編譯失敗，請重新整理後再試。", 5000);
      return;
    }
  }

  try {
    setCompileProgress(1, "正在準備卡蓋圖案…");
    const compiler = new Compiler();
    // compileImageTargets 會針對每張圖回報 0–100 的進度；這裡把進度
    // 分成「提取匹配特徵」與「提取追蹤特徵」兩段文案，讓等待有回饋。
    const dataList = await compiler.compileImageTargets(
      state.targets.map((target) => target.img),
      (progress) => setCompileProgress(progress, progress < 50 ? "正在提取匹配特徵…" : "正在提取追蹤特徵（可能需要一點時間）…")
    );
    const featureCount = countCompiledFeatures(dataList);
    console.info("[ID Card] 編譯完成，特徵點約 " + featureCount + " 個。");
    if (featureCount < 40) console.warn("[ID Card] 卡蓋圖案特徵偏少，追蹤可能較不穩。");

    setCompileProgress(99, "正在打包 .mind 資料…");
    const exported = await Promise.resolve(compiler.exportData());
    if (!exported) throw new Error("編譯結果為空");
    const blob = new Blob([exported], { type: "application/octet-stream" });
    state.mindBlob = blob;
    state.mindSignature = signature;
    state.mindUrl = URL.createObjectURL(blob);

    setCompileProgress(100, "正在啟動相機…");
    dom.compileTitle.textContent = "正在啟動相機";
    showArUi();
    startAr({
      targets: state.targets,
      settings: state.settings,
      mindUrl: state.mindUrl,
      onReady: () => showCompileOverlay(false),
      onError: () => showCompileOverlay(false)
    });
    state.compiling = false;
    updateEnterButton();
    // 儲存是「盡力而為」：即使 IndexedDB 滿了，也不應阻止使用者進入 AR。
    saveSession().catch((err) => {
      console.warn("[ID Card] 本機儲存失敗", err);
      toast("這次設定無法寫入手機儲存空間，可能已滿。", 5200);
    });
    if (featureCount < 40) {
      window.setTimeout(() => toast("這張卡蓋圖案的特徵偏少，若一直抖動，建議換成霧面卡套或加高對比圖案。", 6200), 2600);
    }
  } catch (err) {
    console.error("[ID Card] 編譯失敗", err);
    state.compiling = false;
    updateEnterButton();
    showCompileOverlay(false);
    // 可能已經建立了部分 scene；exitAr 會把相機與 AR 圖層收乾淨。
    exitAr();
    toast("編譯失敗：" + (err && err.message ? err.message : "請換一張圖案重試。"), 5600);
  }
}

/** 離開 AR，恢復設定頁並重設按鈕狀態。 */
function exitAr() {
  if (!document.body.classList.contains("ar-active") && !dom.setup.hidden) return;
  stopAr();
  state.mindUrl = null;
  state.compiling = false;
  dom.setup.hidden = false;
  updateEnterButton();
  window.scrollTo(0, 0);
}

/**
 * 初始化製作端：先建立各區塊的事件，再載入本機暫存。
 * 順序很重要：initProfile 必須在 restoreSession 之前，restore 才能把
 * profile 寫回表單；renderCards 也要在 restore 前先建好空清單。
 */
export function initApp() {
  initArUi();
  initShare();
  initSettings();
  initTargets();
  initSessionControls();

  updateSettingsUi();
  renderCards();
  initProfile();
  restoreSession();

  arDom.backBtn.addEventListener("click", exitAr);
  arDom.errorBackBtn.addEventListener("click", exitAr);
  dom.enterBtn.addEventListener("click", enterAr);

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && document.body.classList.contains("ar-active")) exitAr();
  });

  window.addEventListener("beforeunload", () => {
    state.targets.forEach((target) => {
      if (target.previewUrl) URL.revokeObjectURL(target.previewUrl);
      if (target.contentObjectUrl) URL.revokeObjectURL(target.contentObjectUrl);
    });
    if (state.mindUrl) URL.revokeObjectURL(state.mindUrl);
    if (document.body.classList.contains("ar-active")) stopAr();
  });

  if (!window.AFRAME) toast("A-Frame 載入失敗，請檢查網路後重新整理。", 6000);
  else if (!getCompilerClass()) toast("MindAR 載入失敗，請檢查網路後重新整理。", 6000);
}
