/**
 * 觀看端主流程：讀 manifest → 顯示普通名片 → 使用者按「用 AR 看」才開相機。
 *
 * 這個順序是刻意的：收到名片的人先看到姓名/電話/Email，即使相機權限被
 * 拒絕或裝置不支援 AR，資訊仍然可用。AR 只是加分，不應阻擋名片內容。
 */
import { viewerDom } from "./dom.js";
import { resolveManifest } from "./manifest.js";
import { arDom } from "../ar/dom.js";
import { initArUi, startAr, stopAr } from "../ar/runtime.js";

let manifest = null;

/** 回到名片頁，並依 manifest 狀態決定 AR 按鈕是否可用。 */
function showProfile() {
  viewerDom.profile.hidden = false;
  viewerDom.error.hidden = true;
  viewerDom.loading.hidden = true;
  viewerDom.arBtn.disabled = !manifest || manifest.targets.length === 0;
  document.body.classList.remove("ar-active");
}

/** 顯示錯誤卡片（缺 card 參數、404、格式錯誤等），並隱藏名片與 loading。 */
function showError(message) {
  viewerDom.profile.hidden = true;
  viewerDom.loading.hidden = true;
  viewerDom.error.hidden = false;
  viewerDom.errorMsg.textContent = message;
  document.body.classList.remove("ar-active");
}

/**
 * 設定一個聯絡方式列；value/href 任一為空就整列隱藏。
 * 這樣空的名片欄位不會留下「電話：」這種空殼。
 *
 * @param {HTMLElement} el
 * @param {string} value 顯示文字
 * @param {string} href tel:/mailto:/https:
 */
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

/**
 * 把 manifest.profile 寫進名片頁。
 * 電話會移除空白後放進 tel:；網站只接受 http(s)，避免 javascript: 等
 * 不安全的 scheme 被放進 href。
 *
 * @param {object} profile
 */
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

/**
 * 初始化觀看端。
 *
 * 沒有 `?card` 時不啟動 AR，直接顯示錯誤；有卡片時才載入 manifest。
 * AR 按鈕只在 manifest 成功載入且至少有一個 target 時可用。
 */
async function init() {
  initArUi();

  const cardUrl = new URLSearchParams(window.location.search).get("card");
  if (!cardUrl) {
    showError("這個連結沒有卡片資料。請掃名片上的 QR，或回到製作端發布。");
    return;
  }

  try {
    manifest = await resolveManifest(cardUrl);
    renderProfile(manifest.profile);
    viewerDom.arBtn.disabled = manifest.targets.length === 0;
  } catch (err) {
    showError(err.message || "卡片資料格式不正確。");
    return;
  }

  viewerDom.arBtn.addEventListener("click", () => {
    if (!manifest) return;
    // 先隱藏名片、顯示 loading，再啟動 AR；若 startAr 同步 throw，
    // catch 會負責收掉 loading 並顯示錯誤，不會留下空白頁。
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
  // 任何未預期的初始化錯誤都要有可見的錯誤畫面，不能只留在 console。
  showError("無法載入觀看頁：" + (err.message || "請重新整理再試。"));
});
