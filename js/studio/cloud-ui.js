/**
 * 雲端帳號與存檔的畫面層。
 *
 * 這一層負責「什麼時候該問使用者登入、按鈕按下去要做什麼」；
 * 真正的資料讀寫都在 `cloud.js`，登入流程在 `auth.js`。
 *
 * 未登入時整個製作端仍然可以試用：只有存檔、發布與觀看網址會要求登入。
 */
import { studioState as state } from "./state.js";
import { studioDom as dom } from "./dom.js";
import { arDom } from "../ar/dom.js";
import { getSession, onAuthChange, signInWithEmail, signOut } from "./auth.js";
import {
  createDraftFromTargets,
  getMyProfile,
  loadDraft,
  publishCard,
  saveDraft,
  updateDisplayName
} from "./cloud.js";
import { renderCards } from "./ui/targets.js";
import { updateSettingsUi } from "./ui/settings.js";
import { renderProfile } from "./profile.js";
import { targetSignature } from "./session.js";
import { initShare, openShare } from "./share.js";
import { pad2 } from "../utils/format.js";
import { slugify } from "../utils/slug.js";
import { toast } from "../shared/toast.js";

// 目前登入者與名片代碼；未登入時都是 null / ""。
let userId = null;
let cardCode = "";
let bound = false;

/** 目前的名片代碼（給 share.js 產生網址用）。 */
export function currentCardCode() {
  return cardCode;
}

/** 是否已登入。 */
export function isSignedIn() {
  return Boolean(userId);
}

/** 切換登入前後的兩塊畫面。 */
function renderAccount(email) {
  const signedIn = Boolean(userId);
  dom.accountSignedOut.hidden = signedIn;
  dom.accountSignedIn.hidden = !signedIn;
  dom.accountEmail.textContent = email || "";
  dom.cardCodeText.textContent = cardCode || "------";
  dom.displayName.value = state.profile.name || "";
  dom.saveBtn.disabled = !signedIn;
}

/** 顯示一段登入提示，讓使用者知道為什麼被擋下來。 */
export function showSignInPrompt(reason) {
  toast(reason, 5200);
  if (userId) return;
  dom.signInEmail.focus();
}

/** 只有已登入才有名片代碼可分享。 */
function publishedText() {
  if (!cardCode) return "尚未發布。";
  return "名片代碼：" + cardCode + "；發布後把觀看網址或 QR 給對方即可。";
}

/**
 * 把雲端草稿還原到製作端。
 *
 * 雲端草稿優於本機 IndexedDB：換裝置登入時，本機可能是空的或舊的。
 *
 * @param {object} draft loadDraft() 的結果
 */
async function restoreDraft(draft) {
  const { row, mindBlob, coverBlobs, mediaBlobs } = draft;
  state.restoring = true;
  const restored = [];
  try {
    for (let i = 0; i < row.targets.length; i += 1) {
      const stored = row.targets[i];
      const cover = coverBlobs.find((item) => item.index === i + 1);
      if (!cover) continue;
      const file = new File([cover.blob], "cover-" + (i + 1) + ".png", { type: "image/png" });
      const previewUrl = URL.createObjectURL(file);
      // 這裡沿用 session.js 的載入方式：先取得原始尺寸再縮到編譯尺寸。
      const { loadImage, prepareImageForCompiler } = await import("../utils/files.js");
      const original = await loadImage(previewUrl);
      const img = await prepareImageForCompiler(original);
      const media = mediaBlobs.find((item) => item.index === i + 1);
      let contentFile = null;
      let contentObjectUrl = null;
      if (media) {
        const name = stored.mediaName || "content-" + (i + 1);
        contentFile = new File([media.blob], name, { type: stored.mediaMime || media.blob.type || "" });
        contentObjectUrl = URL.createObjectURL(contentFile);
      }
      restored.push({
        id: ++state.uid,
        file,
        previewUrl,
        img,
        label: stored.label || "卡蓋 " + pad2(i + 1),
        contentType: stored.contentType || "text",
        text: stored.text || "",
        url: stored.url || "",
        contentFile,
        contentObjectUrl,
        contentName: contentFile ? contentFile.name : "",
        contentSize: contentFile ? contentFile.size : 0,
        contentMime: contentFile ? contentFile.type : ""
      });
    }
  } finally {
    state.restoring = false;
  }
  if (!restored.length) return;

  state.targets = restored;
  state.profile = Object.assign({}, state.profile, row.profile || {});
  state.profile.slug = slugify(state.profile.slug || state.profile.name);
  state.settings = Object.assign({}, state.settings, row.settings || {});
  state.mindBlob = mindBlob || null;
  state.mindSignature = mindBlob ? row.signature || "" : "";
  renderProfile();
  updateSettingsUi();
  renderCards();
  dom.publishedInfo.textContent = publishedText();
  toast("已從雲端載入上次的名片。", 3600);
}

/**
 * 登入後（或頁面載入時已登入）的初始化：
 * 取得名片代碼、載入雲端草稿；沒有草稿但有本機卡蓋圖時，建立新草稿。
 *
 * @param {object} session Supabase session
 */
async function onSignedIn(session) {
  userId = session.user.id;
  const me = await getMyProfile();
  cardCode = me.cardCode;
  if (me.displayName && !state.profile.name) {
    state.profile.name = me.displayName;
    if (dom.profileSlug) dom.profileSlug.value = slugify(me.displayName);
  }
  renderProfile();
  renderAccount(session.user.email);

  const draft = await loadDraft(userId);
  if (draft) {
    await restoreDraft(draft);
    toast("已登入：" + (session.user.email || "你的帳號"), 3200);
    return;
  }
  if (state.targets.length) {
    // 先在本機做好、之後才登入：把這份內容建立成雲端草稿。
    await createDraftFromTargets({
      userId,
      profile: state.profile,
      settings: state.settings,
      targets: state.targets
    });
    toast("已把目前的內容存成你的雲端名片。", 4200);
    return;
  }
  toast("已登入：" + (session.user.email || "你的帳號") + "，可以開始建立名片。", 3600);
}

/** 登出後回到「未登入」畫面；畫面上的編輯內容保留，不會被刪除。 */
function onSignedOut() {
  userId = null;
  cardCode = "";
  dom.signInStatus.textContent = "已登出。要存檔或發布時，再登入即可。";
  dom.publishedInfo.textContent = publishedText();
  renderAccount("");
  toast("已登出。", 3000);
}

/**
 * 存到雲端。
 *
 * @param {{ changed?: object, silent?: boolean }} [options]
 *   changed：這次要重傳的檔案索引（預設全部重傳，首版夠用）。
 */
export async function syncToCloud(options = {}) {
  if (!userId) {
    showSignInPrompt("請先登入，才能存到雲端。");
    return;
  }
  if (!state.targets.length) {
    toast("先上傳至少一張卡蓋圖案，再存檔。", 4200);
    return;
  }
  const changed = options.changed || {
    covers: state.targets.map((target, index) => index + 1),
    media: state.targets.map((target, index) => index + 1),
    mind: Boolean(state.mindBlob)
  };
  await saveDraft({
    userId,
    profile: state.profile,
    settings: state.settings,
    targets: state.targets,
    mindBlob: state.mindBlob,
    signature: state.mindBlob ? state.mindSignature : targetSignature(),
    changed
  });
  if (!options.silent) toast("已存到雲端。", 3200);
}

/** 發布目前內容，成功後開啟分享面板（網址 + QR）。 */
async function handlePublish() {
  if (!userId) {
    showSignInPrompt("請先登入，才能取得公開網址。");
    return;
  }
  if (!state.mindBlob) {
    toast("請先編譯名片，再發布。", 4200);
    return;
  }
  dom.publishBtn.disabled = true;
  dom.publishBtn.textContent = "發布中…";
  try {
    await syncToCloud({
      silent: true,
      changed: {
        covers: state.targets.map((target, index) => index + 1),
        media: state.targets.map((target, index) => index + 1),
        mind: true
      }
    });
    const result = await publishCard({
      userId,
      profile: state.profile,
      settings: state.settings,
      targets: state.targets,
      mindBlob: state.mindBlob,
      mindSignature: state.mindSignature
    });
    cardCode = result.code;
    dom.cardCodeText.textContent = cardCode;
    dom.publishedInfo.textContent = "已發布第 " + result.version + " 版：" + result.publicUrl;
    toast("已發布，把網址或 QR 給對方就可以看了。", 4200);
    openShare();
  } catch (err) {
    toast("發布失敗：" + (err && err.message ? err.message : "請稍後再試。"), 6000);
  } finally {
    dom.publishBtn.disabled = false;
    dom.publishBtn.textContent = "發布";
  }
}

/**
 * 初始化雲端功能；由 studio/app.js 在 initApp() 中呼叫。
 *
 * 這裡會等到「登入狀態」確定之後才回傳，讓 app.js 知道要不要再載入
 * 本機暫存（已登入時雲端草稿優先）。
 *
 * @returns {Promise<boolean>} 已登入並處理完草稿時回傳 true。
 */
export async function initCloudUi() {
  if (!bound) {
    bound = true;
    initShare();

    dom.signInBtn.addEventListener("click", async () => {
      const email = dom.signInEmail.value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        dom.signInEmail.focus();
        dom.signInStatus.textContent = "請先填入完整的 email。";
        toast("請先填入完整的 email。", 4200);
        return;
      }
      dom.signInBtn.disabled = true;
      try {
        await signInWithEmail(email);
        dom.signInStatus.textContent = "登入連結已寄出，請到信箱點開（也可能在垃圾信件匣）。";
        toast("登入連結已寄出。", 4200);
      } catch (err) {
        dom.signInStatus.textContent = err.message || "寄出失敗，請稍後再試。";
      } finally {
        dom.signInBtn.disabled = false;
      }
    });

    dom.signInEmail.addEventListener("keydown", (event) => {
      if (event.key === "Enter") dom.signInBtn.click();
    });

    dom.saveDisplayName.addEventListener("click", async () => {
      const name = dom.displayName.value.trim();
      try {
        await updateDisplayName(name);
        state.profile.name = name;
        if (dom.profileName) dom.profileName.value = name;
        toast("顯示 ID 已更新；網址不會改變。", 3600);
      } catch (err) {
        toast("更新失敗：" + (err && err.message ? err.message : "請稍後再試。"), 5200);
      }
    });

    dom.signOutBtn.addEventListener("click", async () => {
      try {
        await signOut();
      } catch (err) {
        toast(err.message || "登出失敗。", 4200);
      }
    });

    dom.saveBtn.addEventListener("click", () => {
      if (!userId) {
        showSignInPrompt("請先登入，才能存到雲端。");
        return;
      }
      if (!state.targets.length) {
        toast("先上傳至少一張卡蓋圖案，再存檔。", 4200);
        return;
      }
      syncToCloud().catch((err) => {
        toast("存檔失敗：" + (err && err.message ? err.message : "請稍後再試。"), 6000);
      });
    });

    dom.publishBtn.addEventListener("click", handlePublish);

    onAuthChange((session) => {
      if (!session) {
        if (userId) onSignedOut();
        return;
      }
      if (session.user.id === userId) return;
      onSignedIn(session).catch((err) => {
        toast("讀取雲端資料失敗：" + (err && err.message ? err.message : "請稍後再試。"), 6000);
      });
    });

    if (!arDom.toast) {
      // toast 由 ar/shell.js 注入；沒有它時仍可運作，只是沒有提示。
      console.warn("[ID Card] toast 尚未就緒");
    }
  }

  renderAccount("");
  try {
    const session = await getSession();
    if (!session) return false;
    await onSignedIn(session);
    return true;
  } catch (err) {
    // 未載入 bundle（離線或舊快取）時，製作端仍要能用。
    dom.signInStatus.textContent = err.message || "雲端服務暫時無法使用。";
    return false;
  }
}
