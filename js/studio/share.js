import { studioState } from "./state.js";
import { studioDom } from "./dom.js";
import { slugify } from "../utils/slug.js";
import { exportCardPackage } from "./card-package.js";
import { toast } from "../shared/toast.js";

export function viewerUrl() {
  const slug = slugify(studioState.profile.slug || studioState.profile.name);
  const url = new URL("viewer.html", window.location.href);
  const cardPath = "cards/" + slug + "/card.json";
  url.search = "?card=" + encodeURIComponent(cardPath).replace(/%2F/g, "/");
  return url.href;
}

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

function closeShare() {
  studioDom.shareOverlay.hidden = true;
  studioDom.publishBtn.focus();
}

export function openShare() {
  if (!studioState.targets.length) {
    toast("先上傳至少一張卡蓋圖案，再發布。");
    return;
  }
  studioDom.shareUrl.value = viewerUrl();
  studioDom.shareOverlay.hidden = false;
  renderQr();
  studioDom.shareUrl.focus();
  studioDom.shareUrl.select();
}

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

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !studioDom.shareOverlay.hidden) closeShare();
  });
}
