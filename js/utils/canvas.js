/**
 * Canvas 文字換行。
 *
 * 中文沒有空白可分詞，所以逐字量測；英文/數字則盡量把整個單字放在同一行，
 * 避免 `https://example.com` 被拆成難以閱讀的片段。這是「夠用於卡片排版」
 * 的簡單演算法，不是完整的 Unicode 斷行實作。
 *
 * @param {CanvasRenderingContext2D} ctx 已設定好字型的 context。
 * @param {string} text 原始文字，支援 \n 分段。
 * @param {number} maxWidth 單行最大寬度（px）。
 * @returns {string[]} 分行後的文字。
 */
export function wrapCanvasText(ctx, text, maxWidth) {
  const lines = [];
  const paragraphs = String(text).replace(/\t/g, "    ").split(/\r?\n/);
  for (const paragraph of paragraphs) {
    if (!paragraph) { lines.push(""); continue; }
    // 先把連續的英數/網址字元視為一個單位，其餘（含 CJK、標點、空白）
    // 逐字處理；這樣中文可以斷行，網址又不會被隨意拆開。
    const units = paragraph.match(/[A-Za-z0-9_@#$%&*+\-./:]+|\s+|[\s\S]/g) || [];
    let line = "";
    for (const unit of units) {
      const candidate = line + unit;
      if (ctx.measureText(candidate).width <= maxWidth || !line) { line = candidate; continue; }
      if (line.trim()) lines.push(line.trimEnd());
      line = "";
      // 單一單位本身比整行還寬（通常是超長網址）時，只能逐字硬切。
      if (ctx.measureText(unit).width > maxWidth) {
        for (const ch of unit) {
          if (ctx.measureText(line + ch).width > maxWidth && line) { lines.push(line); line = ""; }
          line += ch;
        }
      } else {
        line = unit.trimStart();
      }
    }
    lines.push(line.trimEnd());
  }
  return lines;
}
