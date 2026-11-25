/**
 * 觀看端「聯絡區」：社群按鈕、儲存名片（vCard）、分享名片。
 *
 * 這個模組只負責把名片資料變成按鈕與檔案，不決定何時顯示；
 * 顯示時機由 `app.js` 的 `showProfile()` 決定（名片一載入就顯示）。
 *
 * iOS Safari 的限制：`navigator.share()` 必須在使用者手勢中「直接」呼叫，
 * 一旦先 await 其他 Promise（例如產生 vCard Blob），Safari 會判定不是
 * 手勢而拒絕。因此分享時優先直接分享目前網址，不先做任何非同步工作。
 */
import { contactActions, normalizeLinks, toVCard, vCardFileName } from "../shared/social.js";
import { viewerDom } from "./dom.js";

let currentProfile = null;

/**
 * 依 profile 重建聯絡按鈕：社群連結、電話、Email。
 * 沒有任何可用連結時整區輸入框清空，由 app.js 決定要不要顯示聯絡區。
 *
 * @param {object} profile
 */
export function renderContactActions(profile) {
  currentProfile = profile || {};
  viewerDom.links.innerHTML = "";

  contactActions(currentProfile).forEach((action) => {
    const link = document.createElement("a");
    link.className = "viewer-link viewer-link-" + action.kind;
    link.href = action.href;
    link.textContent = action.label;
    if (action.external) {
      link.target = "_blank";
      link.rel = "noopener noreferrer";
    }
    viewerDom.links.appendChild(link);
  });

  // 社群按鈕區可能全空（只剩電話/Email）；空的時候不留一整塊空白。
  viewerDom.links.hidden = viewerDom.links.childElementCount === 0;
}

/** 下載 vCard：用 Blob + 暫時的 <a download>，不離開名片頁。 */
function saveContact() {
  const profile = currentProfile || {};
  const blob = new Blob([toVCard(profile)], { type: "text/vcard;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = vCardFileName(profile.name);
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // 立刻 revoke 會讓部分瀏覽器（Safari）來不及開始下載，延後釋放。
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/**
 * 分享目前名片網址。
 * 有 `navigator.share` 就直接分享（同步呼叫，保住使用者手勢）；
 * 不支援或使用者取消時，退回到複製連結並顯示提示。
 */
async function shareCard() {
  const profile = currentProfile || {};
  const url = window.location.href;
  const title = profile.name ? profile.name + " 的名片" : "ID Card";

  if (typeof navigator.share === "function") {
    try {
      await navigator.share({ title, url });
      hideShareTip();
      return;
    } catch (err) {
      // AbortError 代表使用者自己取消，不需要再跳出複製。
      if (err && err.name === "AbortError") return;
    }
  }

  try {
    if (!navigator.clipboard || !navigator.clipboard.writeText) throw new Error("no clipboard");
    await navigator.clipboard.writeText(url);
    showShareTip("已複製名片連結，貼給朋友就能打開。");
  } catch (err) {
    showShareTip("無法自動複製，請長按網址列複製：" + url);
  }
}

function showShareTip(message) {
  viewerDom.shareTip.textContent = message;
  viewerDom.shareTip.hidden = false;
}

function hideShareTip() {
  viewerDom.shareTip.hidden = true;
  viewerDom.shareTip.textContent = "";
}

/** 綁定儲存/分享按鈕；由 viewer 的 init() 呼叫一次。 */
export function initContactActions() {
  viewerDom.saveBtn.addEventListener("click", saveContact);
  viewerDom.shareBtn.addEventListener("click", shareCard);
}

/**
 * 名片是否有值得顯示的聯絡方式。
 * 只有姓名/公司時不顯示聯絡區，避免出現一個空白的「聯絡我」區塊。
 *
 * @param {object} profile
 * @returns {boolean}
 */
export function hasContactInfo(profile) {
  return contactActions(profile).length > 0 || normalizeLinks(profile.links).length > 0;
}
