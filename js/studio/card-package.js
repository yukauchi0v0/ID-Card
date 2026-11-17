import { studioState } from "./state.js";
import { buildCardManifest } from "./manifest.js";
import { targetSignature } from "./session.js";
import { slugify } from "../utils/slug.js";
import { toast } from "../shared/toast.js";

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
