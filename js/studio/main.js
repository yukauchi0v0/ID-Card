/**
 * 製作端入口。
 *
 * 必須先注入 AR 外殼，再載入 app.js；因為 `shared/toast.js` 與
 * `ar/dom.js` 會在 module 求值時解析 `#toast` 等元素。這個順序不能顛倒。
 *
 * 動態載入時帶上版本號（`?v=APP_VERSION`），這樣更新程式後手機不會
 * 繼續執行快取的舊模組（曾發生「卡蓋圖明明有存、雲端卻少了檔案」的
 * 問題，就是舊模組留在瀏覽器快取裡）。
 */
import { mountArShell } from "../ar/shell.js";
import { APP_VERSION } from "../version.js";

// 先建立 AR HUD/面板的 DOM，app.js 才能安全地 import arDom。
mountArShell({ backLabel: "返回設定" });

const { initApp } = await import("./app.js?v=" + APP_VERSION);
initApp();
