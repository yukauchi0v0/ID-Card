/**
 * 發布與分享：觀看網址、QR 與卡片包下載。
 *
 * 觀看網址來自雲端名片代碼（`viewer.html?card=<code>`）；未登入時沒有
 * 代碼，按下發布會提示先登入。卡片包匯出仍在 card-package.js，當作
 * 離線備援，兩者都要求目前已編譯且 signature 與卡蓋圖一致。
 */
import { studioState } from "./state.js";
import { studioDom } from "./dom.js";
import { slugify } from "../utils/slug.js";
import { exportCardPackage } from "./card-package.js";
import { targetSignature } from "./session.js";
import { toast } from "../shared/toast.js";
import { currentCardCode } from "./cloud-ui.js";

/**
 * 產生 viewer 的完整網址。
 *
 * @returns {string} 例如 `https://example.com/viewer.html?card=k7m2p9qd`；
 *   尚未登入或沒有名片代碼時回空字串。
 */
export function viewerUrl() {
  const code = currentCardCode();
  if (!code) return "";
  const url = new URL("viewer.html", window.location.href);
  url.search = "?card=" + encodeURIComponent(code);
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
 * 先檢查 targets、已編譯的 signature 與名片代碼；不讓使用者分享一個
 * 沒有內容、內容與卡蓋圖不一致，或根本還不存在的網址。
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
  const url = viewerUrl();
  if (!url) {
    toast("請先登入並發布，才能取得公開網址。", 4600);
    return;
  }
  studioDom.shareUrl.value = url;
  studioDom.shareOverlay.hidden = false;
  renderQr();
  studioDom.shareUrl.focus();
  studioDom.shareUrl.select();
}

/**
 * 綁定發布面板的事件；由 cloud-ui.js 在發布成功後呼叫一次。
 * `#publishBtn` 由 cloud-ui.js 綁定，這裡不要再綁，否則會發布兩次。
 */
export function initShare() {
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
