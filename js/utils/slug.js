/**
 * 產生資料夾與網址用的 slug。
 *
 * 先嘗試純 ASCII；中文姓名（例如「林一」）沒有 ASCII 時，不能全部變成
 * `my-card`，否則不同人的卡片會撞在同一個 `cards/my-card/`。因此用姓名
 * 的 code point 算一個穩定的小雜湊，產生 `card-xxxx`。同一個名字每次
 * 都會得到相同結果，適合靜態卡片包。
 *
 * @param {string} value 姓名或使用者自訂的 slug。
 * @returns {string} 只含小寫英數與連字號的 slug。
 */
export function slugify(value) {
  const ascii = String(value || "")
    .normalize("NFKD")
    .replace(/[^\x00-\x7F]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (ascii) return ascii;
  if (!String(value || "").trim()) return "my-card";
  // 完全沒有 ASCII 的名字仍需要穩定、不易碰撞的資料夾名稱。
  // 這裡的雜湊只用於靜態單卡網址，不需要密碼學強度。
  let hash = 0;
  for (const ch of String(value)) hash = (hash * 31 + ch.codePointAt(0)) >>> 0;
  return "card-" + hash.toString(36);
}
