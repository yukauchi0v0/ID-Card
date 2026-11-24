/**
 * 卡蓋圖指紋（純函式）。
 *
 * 只用檔名 + 大小，不讀圖片內容；對這個用途足夠，而且同步、便宜。
 * 指紋不同時，快取的 `.mind` 與雲端草稿都不能視為同一份內容。
 *
 * 放在 utils 是為了讓製作端、雲端模組與 node 測試共用同一份實作，
 * 不需要載入會碰 DOM 的 `session.js`。
 *
 * @param {Array<object>} targets
 * @returns {string}
 */
export function signatureOf(targets) {
  return targets.map((target) => {
    const file = target.file;
    return [file ? file.name : "", file ? file.size : 0].join(":");
  }).join("|");
}
