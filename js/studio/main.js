/**
 * 製作端入口。
 *
 * 必須先注入 AR 外殼，再動態載入 app.js；因為 `shared/toast.js` 與
 * `ar/dom.js` 會在 module 求值時解析 `#toast` 等元素。這個順序不能顛倒。
 */
import { mountArShell } from "../ar/shell.js";

// 先建立 AR HUD/面板的 DOM，app.js 才能安全地 import arDom。
mountArShell({ backLabel: "返回設定" });

const { initApp } = await import("./app.js");
initApp();
