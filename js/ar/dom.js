/**
 * AR shell 的 DOM 參照。
 *
 * 這個模組必須在 `mountArShell()` 之後才被 import；因為下方的 byId()
 * 會在 module 求值時立刻抓元素。若缺元素就丟錯，讓「注入順序寫錯」
 * 在開發時馬上暴露，而不是等到某個按鈕默默沒反應才發現。
 */
function byId(id) {
  const el = document.getElementById(id);
  if (!el) throw new Error("Missing required AR element #" + id);
  return el;
}

export const arDom = {
  // 整個 AR 圖層與 HUD 容器。
  arRoot: byId("arRoot"),
  arHud: byId("arHud"),
  backBtn: byId("backBtn"),
  errorBackBtn: byId("errorBackBtn"),
  errorPanel: byId("errorPanel"),

  // 頂部狀態與掃描提示。
  hudLabel: byId("hudLabel"),
  hudMode: byId("hudMode"),
  dots: byId("dots"),
  pageCounter: byId("pageCounter"),
  swipeHint: byId("swipeHint"),
  scanGuide: byId("scanGuide"),

  // 底部內容面板（PDF / 網頁 / 影片連結）。
  contentPanel: byId("contentPanel"),
  panelBody: byId("panelBody"),
  panelTitle: byId("panelTitle"),
  panelKicker: byId("panelKicker"),
  panelOpenExternal: byId("panelOpenExternal"),
  panelPrev: byId("panelPrev"),
  panelNext: byId("panelNext"),
  panelClose: byId("panelClose"),

  // 浮動按鈕與 toast。
  videoSoundBtn: byId("videoSoundBtn"),
  panelOpenBtn: byId("panelOpenBtn"),
  toast: byId("toast")
};
