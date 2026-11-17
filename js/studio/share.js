/**
 * 發布與分享：觀看網址、QR 與卡片包下載。
 *
 * 這裡只產生「要給對方打開的連結」；實際的卡片包由 card-package.js
 * 匯出，兩者都要求目前已編譯且 signature 與卡蓋圖一致，避免分享到
 * 舊內容。
 */
import { studioState } from "./state.js";
import { studioDom } from "./dom.js";
import { slugify } from "../utils/slug.js";
import { exportCardPackage } from "./card-package.js";
import { targetSignature } from "./session.js";
import { toast } from "../shared/toast.js";

/**
 * 產生 viewer 的完整網址。
 *
 * 保留 `cards/<slug>/card.json` 的斜線（只編碼 slug），讓網址在瀏覽器
 * 網址列與 QR 中都可讀；`URLSearchParams` 會自行處理必要的編碼。
 *
 * @returns {string} 例如 `https://example.com/viewer.html?card=cards/lin/card.json`
 */
export function viewerUrl() {
  const slug = slugify(studioState.profile.slug || studioState.profile.name);
  const url = new URL("viewer.html", window.location.href);
  const cardPath = "cards/" + slug + "/card.json";
  url.search = "?card=" + encodeURIComponent(cardPath).replace(/%2F/g, "/");
  return url.href;
}

/**
 * 依目前輸入的網址重畫 QR。
 * 使用者可以手動修改 `#shareUrl`（例如換成正式網域），QR 會跟著更新。
 */
function renderQr() {
  const url = studioDom.shareUrl.value.trim();
  studioDom.shareQr.replaceChildren();
  if (!url) return;
  if (!window.qrcode) {
    studioDom.shareQr.textContent = "QR 元件未載入，請直接複製網址。";
    return;
  }
  try {
    const qr = window.qrcode(0, "M");
    qr.addData(url);
    qr.make();
    studioDom.shareQr.innerHTML = qr.createSvgTag({ cellSize: 6, margin: 2 });
  } catch (err) {
    studioDom.shareQr.textContent = "這段網址無法產生 QR；請縮短網址或直接複製連結。";
  }
}

/**
 * 關閉發布面板並把焦點還給觸發按鈕，方便鍵盤使用者繼續操作。
 */
function closeShare() {
  studioDom.shareOverlay.hidden = true;
  studioDom.publishBtn.focus();
}

/**
 * 開啟發布面板。
 * 先檢查 targets 與已編譯的 signature；不讓使用者分享一個沒有內容或
 * 內容與卡蓋圖不一致的網址。
 */
export function openShare() {
  if (!studioState.targets.length) {
    toast("先上傳至少一張卡蓋圖案，再發布。");
    return;
  }
  if (!studioState.mindBlob || studioState.mindSignature !== targetSignature()) {
    toast("請先編譯名片，再發布。", 4200);
    return;
  }
  studioDom.shareUrl.value = viewerUrl();
  studioDom.shareOverlay.hidden = false;
  renderQr();
  studioDom.shareUrl.focus();
  studioDom.shareUrl.select();
}

/**
 * 綁定發布面板的所有事件；由 initApp() 呼叫一次。
 *
 * 注意：`#publishBtn` 只在這裡綁定，其他地方不要重複 addEventListener，
 * 否則點一次會下載兩份卡片包。
 */
export function initShare() {
  studioDom.publishBtn.addEventListener("click", openShare);
  studioDom.shareUrl.addEventListener("input", renderQr);
  studioDom.shareClose.addEventListener("click", closeShare);
  studioDom.shareOverlay.addEventListener("click", (event) => {
    if (event.target === studioDom.shareOverlay) closeShare();
  });

  studioDom.shareCopy.addEventListener("click", async () => {
    const url = studioDom.shareUrl.value.trim();
    if (!url) return;
    try {
      // clipboard 只在 HTTPS/localhost 且使用者有授權時可用；
      // 失敗時退回「選取網址」，讓使用者自己按 Ctrl/Cmd+C。
      if (!navigator.clipboard || !navigator.clipboard.writeText) throw new Error("clipboard unavailable");
      await navigator.clipboard.writeText(url);
      toast("已複製觀看網址。");
    } catch (err) {
      studioDom.shareUrl.focus();
      studioDom.shareUrl.select();
      toast("請按 Ctrl/Cmd+C 複製網址。", 4200);
    }
  });

  studioDom.shareDownload.addEventListener("click", () => {
    exportCardPackage();
  });

  studioDom.shareQrDownload.addEventListener("click", () => {
    const svg = studioDom.shareQr.querySelector("svg");
    if (!svg) {
      toast("QR 尚未產生。", 3200);
      return;
    }
    // 直接把 QR 的 SVG 序列化成檔案，不經過 canvas，因此向量邊緣不會模糊。
    const blob = new Blob([new XMLSerializer().serializeToString(svg)], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = slugify(studioState.profile.slug || studioState.profile.name) + "-qr.svg";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  // Escape 關閉面板；背景點擊也關閉，但點面板內容本身不會。
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !studioDom.shareOverlay.hidden) closeShare();
  });
}
