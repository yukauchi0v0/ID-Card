import { mountArShell } from "../ar/shell.js";

// The AR shell must exist before app.js (and shared/toast.js) resolves arDom.
mountArShell({ backLabel: "返回設定" });

const { initApp } = await import("./app.js");
initApp();
