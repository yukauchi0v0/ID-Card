/**
 * 觀看端入口。
 *
 * 與製作端相同：先注入 AR 外殼，再載入 app.js。觀看端沒有上傳、編譯或
 * IndexedDB 邏輯，只讀 `card.json`、顯示名片，並在需要時啟動共用 AR。
 *
 * 動態載入時帶上版本號，避免瀏覽器繼續執行快取的舊模組。
 */
import { mountArShell } from "../ar/shell.js";
import { APP_VERSION } from "../version.js";

mountArShell({ backLabel: "返回名片" });

await import("./app.js?v=" + APP_VERSION);
