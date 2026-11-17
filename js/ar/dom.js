// AR shell refs. This module is imported only after mountArShell() has
// injected the markup, so a missing element always means an ordering bug.
function byId(id) {
  const el = document.getElementById(id);
  if (!el) throw new Error("Missing required AR element #" + id);
  return el;
}

export const arDom = {
  arRoot: byId("arRoot"),
  arHud: byId("arHud"),
  backBtn: byId("backBtn"),
  errorBackBtn: byId("errorBackBtn"),
  errorPanel: byId("errorPanel"),
  hudLabel: byId("hudLabel"),
  hudMode: byId("hudMode"),
  dots: byId("dots"),
  pageCounter: byId("pageCounter"),
  swipeHint: byId("swipeHint"),
  scanGuide: byId("scanGuide"),
  contentPanel: byId("contentPanel"),
  panelBody: byId("panelBody"),
  panelTitle: byId("panelTitle"),
  panelKicker: byId("panelKicker"),
  panelOpenExternal: byId("panelOpenExternal"),
  panelPrev: byId("panelPrev"),
  panelNext: byId("panelNext"),
  panelClose: byId("panelClose"),
  videoSoundBtn: byId("videoSoundBtn"),
  panelOpenBtn: byId("panelOpenBtn"),
  toast: byId("toast")
};
