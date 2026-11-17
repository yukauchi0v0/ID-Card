/**
 * 匯出可上傳的靜態卡片包。
 *
 * 產出的 zip 結構：
 *   cards/<slug>/card.json
 *   cards/<slug>/card.mind
 *   cards/<slug>/media/page-N.<ext>
 *
 * 使用 `fflate` 在瀏覽器端打包，不經過伺服器；因此卡面與內容檔案都不會
 * 被上傳到第三方。`level: 0` 是刻意選的：媒體檔多半已壓縮，再壓縮只會
 * 增加 CPU 時間與記憶體用量。
 */
import { studioState } from "./state.js";
import { buildCardManifest } from "./manifest.js";
import { targetSignature } from "./session.js";
import { slugify } from "../utils/slug.js";
import { toast } from "../shared/toast.js";

/**
 * 決定 media 檔案的副檔名。
 * 先用原檔名；若檔名沒有可用副檔名（例如 `photo`），才依 MIME 推斷。
 *
 * @param {object} target
 * @returns {string}
 */
function extensionFor(target) {
  const name = target.contentName || "";
  const dot = name.lastIndexOf(".");
  if (dot > -1) {
    const ext = name.slice(dot + 1).toLowerCase();
    if (/^[a-z0-9]{2,5}$/.test(ext)) return ext;
  }
  const byMime = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
    "image/gif": "gif",
    "video/mp4": "mp4",
    "video/webm": "webm",
    "application/pdf": "pdf"
  };
  return byMime[target.contentMime] || "bin";
}

/**
 * 用暫存的 `<a download>` 觸發瀏覽器下載。
 * 先 append 再 click，某些瀏覽器（尤其 Safari）才不會忽略 click。
 *
 * @param {Blob} blob
 * @param {string} filename
 */
function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * 匯出目前編輯中的卡片包。
 *
 * 發布前會檢查 `.mind` 是否存在、且 signature 與目前卡蓋圖一致；避免
 * 使用者在改了卡蓋圖之後，還把舊的 `.mind` 一起發布。
 *
 * @returns {Promise<{slug: string, fileName: string}|null>} 成功時回傳檔名，
 *   缺少工具/尚未編譯/缺少媒體檔時回傳 null。
 */
export async function exportCardPackage() {
  const fflate = window.fflate;
  if (!fflate) {
    toast("打包工具沒有載入，請重新整理。", 5200);
    return null;
  }
  if (!studioState.mindBlob || studioState.mindSignature !== targetSignature()) {
    toast("請先編譯並進入 AR 一次，再下載卡片包。", 5200);
    return null;
  }

  const slug = slugify(studioState.profile.slug || studioState.profile.name);
  const entries = {};
  const mediaPaths = [];
  const base = "cards/" + slug + "/";

  for (let i = 0; i < studioState.targets.length; i++) {
    const target = studioState.targets[i];
    if (!["image", "video", "pdf"].includes(target.contentType)) continue;
    if (!target.contentFile) {
      toast("第 " + (i + 1) + " 頁還沒有內容檔案。", 5200);
      return null;
    }
    const path = "media/page-" + (i + 1) + "." + extensionFor(target);
    mediaPaths[i] = path;
    entries[base + path] = new Uint8Array(await target.contentFile.arrayBuffer());
  }

  const withMedia = buildCardManifest({
    profile: studioState.profile,
    targets: studioState.targets,
    settings: studioState.settings,
    mediaPaths
  });
  entries[base + "card.json"] = fflate.strToU8(JSON.stringify(withMedia, null, 2));
  entries[base + "card.mind"] = new Uint8Array(await studioState.mindBlob.arrayBuffer());

  const zip = fflate.zipSync(entries, { level: 0 });
  const blob = new Blob([zip], { type: "application/zip" });
  download(blob, slug + "-card.zip");
  toast("已下載 " + slug + "-card.zip。解壓後把 cards/" + slug + "/ 放到網站根目錄。", 6200);
  return { slug, fileName: slug + "-card.zip" };
}
