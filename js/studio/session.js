/**
 * 製作端本機暫存（IndexedDB）。
 *
 * 之後接上 Supabase 雲端存檔時，這裡仍然是「離線備援」，不是主要來源。
 */
import { DB_KEY, DB_NAME, DB_STORE, MAX_TARGETS } from "../config.js";
import { studioState as state } from "./state.js";
import { studioDom as dom } from "./dom.js";
import { pad2 } from "../utils/format.js";
import { signatureOf } from "../utils/signature.js";
import { loadImage, prepareImageForCompiler } from "../utils/files.js";
import { slugify } from "../utils/slug.js";
import { renderCards } from "./ui/targets.js";
import { updateSettingsUi } from "./ui/settings.js";
import { updateEnterButton } from "./ui/enter-button.js";
import { renderProfile } from "./profile.js";
import { toast } from "../shared/toast.js";

/**
 * 卡蓋圖的「指紋」。
 *
 * 實作在 `js/utils/signature.js`，這裡只是綁定到目前的製作端狀態。
 * 只要指紋不同，快取的 `.mind` 就不能重用，必須重新編譯。
 *
 * @returns {string}
 */
export function targetSignature() {
  return signatureOf(state.targets);
}

// 本機暫存是否已經載入過內容；雲端還原後就不該再被本機資料覆蓋。
let loaded = false;

/**
 * 本機暫存是否已有內容。
 * 已登入時雲端草稿優先；本機只有在「雲端是空的」而且這裡回傳 true 時
 * 才會被寫上雲端，避免空白裝置蓋掉已經存好的草稿。
 */
export function hasLocalSession() {
  return loaded;
}

/**
 * 開啟（必要時建立）儲存用的 IndexedDB。
 * 每個函式各自開關連線，避免長時間持有 transaction 造成 blocked。
 *
 * @returns {Promise<IDBDatabase>}
 */
function openSessionDb() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) { reject(new Error("瀏覽器不支援 IndexedDB")); return; }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(DB_STORE)) db.createObjectStore(DB_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("IndexedDB 開啟失敗"));
  });
}

/**
 * 把目前編輯狀態寫入 IndexedDB（離線備援；雲端由 cloud.js 負責）。
 *
 * 沒有 targets 時直接跳過：這不是錯誤，只是還沒東西可存。
 * Blob/File 可以直接放進 IndexedDB，不需要先轉 base64。
 *
 * @param {{ ownerId?: string }} [options] 目前登入者；用來分辨暫存屬於哪個帳號。
 * @returns {Promise<void>}
 */
export async function saveSession(options = {}) {
  if (!state.targets.length || !state.mindBlob) return;
  const db = await openSessionDb();
  try {
    const payload = {
      version: 1,
      savedAt: Date.now(),
      ownerId: options.ownerId || "",
      profile: Object.assign({}, state.profile),
      settings: Object.assign({}, state.settings),
      signature: state.mindSignature,
      mindBlob: state.mindBlob,
      targets: state.targets.map((target) => ({
        id: target.id,
        label: target.label,
        contentType: target.contentType,
        text: target.text,
        url: target.url,
        targetName: target.file ? target.file.name : "cover.png",
        targetMime: target.file ? target.file.type : "image/png",
        targetLastModified: target.file ? target.file.lastModified : Date.now(),
        targetBlob: target.file,
        contentName: target.contentName,
        contentMime: target.contentMime,
        contentSize: target.contentSize,
        contentBlob: target.contentFile
      }))
    };
    await new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, "readwrite");
      tx.objectStore(DB_STORE).put(payload, DB_KEY);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error || new Error("IndexedDB 寫入失敗"));
      tx.onabort = () => reject(tx.error || new Error("IndexedDB 寫入被中止"));
    });
  } finally {
    db.close();
  }
}

/**
 * 從 IndexedDB 還原上一次的編輯狀態。
 *
 * 還原時會重新建立 File 與 object URL，並把卡蓋圖重新縮到編譯尺寸；
 * 不能直接沿用上次的 canvas，因為瀏覽器關掉後記憶體中的 canvas 已經
 * 沒了。任何單一 target 失敗都只跳過該張，不讓整個還原失敗。
 *
 * @param {{ silent?: boolean, ownerId?: string }} [options]
 *   silent：雲端還原時不想再跳「本機設定」提示。
 *   ownerId：目前登入者；與暫存擁有者不同時不還原。
 * @returns {Promise<boolean>} 有還原至少一個 target 時回傳 true。
 */
export async function restoreSession(options = {}) {
  // restoring 會讓「進入 AR」與上傳按鈕暫時 disabled，避免使用者在
  // 非同步還原途中又上傳新圖，造成 state 競爭。
  state.restoring = true;
  updateEnterButton();
  let db = null;
  try {
    db = await openSessionDb();
    const record = await new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, "readonly");
      const req = tx.objectStore(DB_STORE).get(DB_KEY);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error || new Error("IndexedDB 讀取失敗"));
    });
    if (!record || !Array.isArray(record.targets) || !record.targets.length) return false;

    const restored = [];
    for (const item of record.targets) {
      if (!item || !item.targetBlob) continue;
      const targetName = item.targetName || "cover.png";
      const targetFile = item.targetBlob instanceof File && item.targetBlob.name
        ? item.targetBlob
        : new File([item.targetBlob], targetName, { type: item.targetMime || "image/png", lastModified: item.targetLastModified || Date.now() });
      const previewUrl = URL.createObjectURL(targetFile);
      try {
        const original = await loadImage(previewUrl);
        const prepared = await prepareImageForCompiler(original);
        let contentFile = null;
        let contentObjectUrl = null;
        if (item.contentBlob) {
          contentFile = item.contentBlob instanceof File && item.contentBlob.name
            ? item.contentBlob
            : new File([item.contentBlob], item.contentName || "content", { type: item.contentMime || "" });
          contentObjectUrl = URL.createObjectURL(contentFile);
        }
        restored.push({
          id: item.id || ++state.uid,
          file: targetFile,
          previewUrl,
          img: prepared,
          label: item.label || "卡蓋 " + pad2(restored.length + 1),
          contentType: item.contentType || "text",
          text: item.text || "",
          url: item.url || "",
          contentFile,
          contentObjectUrl,
          contentName: item.contentName || (contentFile ? contentFile.name : ""),
          contentSize: item.contentSize || (contentFile ? contentFile.size : 0),
          contentMime: item.contentMime || (contentFile ? contentFile.type : "")
        });
      } catch (err) {
        URL.revokeObjectURL(previewUrl);
        console.warn("[ID Card] 還原其中一個圖案失敗", err);
      }
    }
    if (!restored.length) return false;

    // 換裝置時，先前登入留下的本機暫存可能是「別的帳號」的內容。
    // 這種情況直接丟掉，避免雲端草稿讀取失敗時把別人的名片存到自己帳號。
    const previousOwner = record.ownerId || "";
    if (options.ownerId && previousOwner && previousOwner !== options.ownerId) {
      restored.forEach((target) => {
        if (target.previewUrl) URL.revokeObjectURL(target.previewUrl);
        if (target.contentObjectUrl) URL.revokeObjectURL(target.contentObjectUrl);
      });
      console.warn("[ID Card] 本機暫存屬於其他帳號，已略過。");
      return false;
    }

    state.targets = restored;
    state.uid = Math.max.apply(null, restored.map((target) => target.id).concat([state.uid]));
    // profile 可能是舊版沒有 slug 的資料；用 name 補一個穩定 slug。
    state.profile = Object.assign({}, state.profile, record.profile || {});
    state.profile.slug = slugify(state.profile.slug || state.profile.name);
    state.settings = Object.assign({}, state.settings, record.settings || {});
    state.mindBlob = record.mindBlob || null;
    state.mindSignature = record.signature || "";
    state.ownerId = previousOwner;
    loaded = true;
    // 先讓表單與設定 UI 反映還原值，再重畫卡片清單。
    renderProfile();
    updateSettingsUi();
    renderCards();
    if (!options.silent) toast("已載入上次儲存在這台手機的設定。", 3600);
    return true;
  } catch (err) {
    console.warn("[ID Card] 讀取本機設定失敗", err);
    return false;
  } finally {
    if (db) db.close();
    state.restoring = false;
    dom.fileInput.disabled = state.adding || state.targets.length >= MAX_TARGETS;
    dom.dropZone.classList.toggle("is-full", state.targets.length >= MAX_TARGETS);
    updateEnterButton();
  }
}

/**
 * 綁定「清除本機紀錄」按鈕。
 * 這是破壞性操作，所以使用 native confirm；成功後 reload 讓所有 UI
 * 回到乾淨狀態，比逐一重設每個模組的狀態可靠。
 */
export function initSessionControls() {
  dom.clearSavedBtn.addEventListener("click", () => {
    if (!window.confirm("清除這台手機上儲存的卡蓋圖案與內容？")) return;
    if (!window.indexedDB) { window.location.reload(); return; }
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => window.location.reload();
    request.onerror = () => toast("清除失敗，請重新整理頁面後再試。", 5000);
    request.onblocked = () => toast("請關閉其他分頁後再試一次。", 5000);
  });
}
