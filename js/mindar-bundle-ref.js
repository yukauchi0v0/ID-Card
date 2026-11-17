/**
 * 保存 MindAR A-Frame bundle 的命名空間。
 *
 * MindAR 1.2.2 的 A-Frame bundle 是自包含的，裡面有 WebGL 版 compiler；
 * 另外載入的 core ESM 會晚一步執行，並可能覆蓋 `window.MINDAR`。因此在
 * bundle 載入後立刻留下參照，讓 `js/media/compiler.js` 優先使用這份，
 * 避免編譯退回到 CPU backend 而卡住。
 */
window.__MINDAR_AFRAME_IMAGE__ = window.MINDAR && window.MINDAR.IMAGE;
