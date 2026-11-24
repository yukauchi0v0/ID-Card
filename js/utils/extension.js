/**
 * 從檔名或 MIME 推斷副檔名；推不出來時回 "bin"。
 *
 * 這支函式在 Supabase 模組裡也會用到，所以放在 utils，讓測試與
 * 瀏覽器端共用同一份實作。
 *
 * @param {string} name
 * @param {string} [mime]
 * @returns {string}
 */
export function extensionFor(name, mime) {
  const match = /\.([a-z0-9]{2,5})$/i.exec(String(name || ""));
  if (match) return match[1].toLowerCase();
  const byMime = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
    "image/gif": "gif",
    "video/mp4": "mp4",
    "video/webm": "webm",
    "application/pdf": "pdf"
  };
  return byMime[mime] || "bin";
}
