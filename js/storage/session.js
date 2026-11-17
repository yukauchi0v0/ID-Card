import { DB_KEY, DB_NAME, DB_STORE, MAX_TARGETS } from "../config.js";
import { state } from "../state.js";
import { dom } from "../dom.js";
import { pad2 } from "../utils/format.js";
import { loadImage, prepareImageForCompiler } from "../utils/files.js";
import { renderCards } from "../ui/targets.js";
import { updateSettingsUi } from "../ui/settings.js";
import { updateEnterButton } from "../ui/enter-button.js";
import { toast } from "../ui/toast.js";

export function targetSignature() {
  return state.targets.map((target) => {
    const file = target.file;
    return [file ? file.name : "", file ? file.size : 0].join(":");
  }).join("|");
}

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

export async function saveSession() {
  if (!state.targets.length || !state.mindBlob) return;
  const db = await openSessionDb();
  try {
    const payload = {
      version: 1,
      savedAt: Date.now(),
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

export async function restoreSession() {
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

    state.targets = restored;
    state.uid = Math.max.apply(null, restored.map((target) => target.id).concat([state.uid]));
    state.settings = Object.assign({}, state.settings, record.settings || {});
    state.mindBlob = record.mindBlob || null;
    state.mindSignature = record.signature || "";
    updateSettingsUi();
    renderCards();
    toast("已載入上次儲存在這台手機的設定。", 3600);
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
