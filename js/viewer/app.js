import { viewerDom } from "./dom.js";
import { loadManifest } from "./manifest.js";
import { arDom } from "../ar/dom.js";
import { initArUi, startAr, stopAr } from "../ar/runtime.js";

let manifest = null;

function showProfile() {
  viewerDom.profile.hidden = false;
  viewerDom.error.hidden = true;
  viewerDom.loading.hidden = true;
  viewerDom.arBtn.disabled = !manifest || manifest.targets.length === 0;
  document.body.classList.remove("ar-active");
}

function showError(message) {
  viewerDom.profile.hidden = true;
  viewerDom.loading.hidden = true;
  viewerDom.error.hidden = false;
  viewerDom.errorMsg.textContent = message;
  document.body.classList.remove("ar-active");
}

function contactLink(el, value, href) {
  const item = el.closest("li");
  if (!value || !href) {
    item.hidden = true;
    return;
  }
  item.hidden = false;
  el.textContent = value;
  el.href = href;
}

function renderProfile(profile) {
  viewerDom.name.textContent = profile.name || "ID Card";
  viewerDom.title.textContent = profile.title;
  viewerDom.title.hidden = !profile.title;
  viewerDom.company.textContent = profile.company;
  viewerDom.company.hidden = !profile.company;

  const phone = profile.phone ? profile.phone.replace(/\s+/g, "") : "";
  contactLink(viewerDom.phone, profile.phone, phone ? "tel:" + phone : "");
  contactLink(viewerDom.email, profile.email, profile.email ? "mailto:" + profile.email : "");

  let website = "";
  try {
    const parsed = new URL(profile.website);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") website = parsed.href;
  } catch (err) {
    // 沒有有效網址時只隱藏那一列。
  }
  contactLink(viewerDom.website, website, website);

  document.title = profile.name ? profile.name + " · ID Card" : "ID Card · Viewer";
}

async function init() {
  initArUi();

  const cardUrl = new URLSearchParams(window.location.search).get("card");
  if (!cardUrl) {
    showError("這個連結沒有卡片資料。請掃名片上的 QR，或回到製作端發布。");
    return;
  }

  try {
    manifest = await loadManifest(cardUrl);
    renderProfile(manifest.profile);
    viewerDom.arBtn.disabled = manifest.targets.length === 0;
  } catch (err) {
    showError(err.message || "卡片資料格式不正確。");
    return;
  }

  viewerDom.arBtn.addEventListener("click", () => {
    if (!manifest) return;
    viewerDom.arBtn.disabled = true;
    viewerDom.profile.hidden = true;
    viewerDom.loading.hidden = false;

    try {
      startAr({
        targets: manifest.targets,
        settings: manifest.settings,
        mindUrl: manifest.mindUrl,
        onReady: () => {
          viewerDom.loading.hidden = true;
        },
        onError: () => {
          viewerDom.loading.hidden = true;
        }
      });
    } catch (err) {
      try { stopAr(); } catch (stopErr) { /* best effort */ }
      viewerDom.loading.hidden = true;
      showError("無法啟動 AR：" + (err.message || "請重新整理再試。"));
    }
  });

  arDom.backBtn.addEventListener("click", () => {
    stopAr();
    showProfile();
  });
  arDom.errorBackBtn.addEventListener("click", () => {
    stopAr();
    showProfile();
  });
  window.addEventListener("beforeunload", () => {
    if (manifest) stopAr();
  });
}

init().catch((err) => {
  showError("無法載入觀看頁：" + (err.message || "請重新整理再試。"));
});
