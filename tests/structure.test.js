/**
 * 入口頁的靜態結構檢查。
 *
 * 這個測試不需要瀏覽器，只讀 HTML 檔；目的是防止有人把 inline style/
 * script 或重複 id 帶回來，破壞 CSP、模組拆分與 DOM 查找。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

// 三頁都應該只載入外部 CSS/JS，不把樣式或程式碼塞回 HTML。
test("entry pages have no inline style or script blocks", async () => {
  for (const file of ["index.html", "studio.html", "viewer.html"]) {
    const html = await readFile(file, "utf8");
    assert.equal(/<style[\s>]/i.test(html), false, file + " has inline style");
    assert.equal(/<script(?![^>]*\bsrc=)[^>]*>/i.test(html), false, file + " has inline script");
  }
});

// 重複 id 會讓 byId() 抓到錯的元素，屬早期就要擋下的結構錯誤。
test("entry pages do not contain duplicate ids", async () => {
  for (const file of ["index.html", "studio.html", "viewer.html"]) {
    const html = await readFile(file, "utf8");
    const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
    const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
    assert.deepEqual([...new Set(duplicates)], [], file + " has duplicate ids");
  }
});
