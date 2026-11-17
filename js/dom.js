// Every id used by JavaScript is resolved once, here. Feature modules never
// query the document for a static element by id.

function byId(id) {
  const el = document.getElementById(id);
  if (!el) throw new Error("Missing required element #" + id);
  return el;
}

export const dom = {
  setup: byId("setup"),
  arRoot: byId("arRoot"),
  arHud: byId("arHud"),
  cards: byId("cards"),
  emptyHint: byId("emptyHint"),
  countBadge: byId("countBadge"),
  dropZone: byId("dropZone"),
  fileInput: byId("fileInput"),
  enterBtn: byId("enterBtn"),
  backBtn: byId("backBtn"),
  errorBackBtn: byId("errorBackBtn"),
  errorPanel: byId("errorPanel"),
  hudLabel: byId("hudLabel"),
  hudMode: byId("hudMode"),
  dots: byId("dots"),
  pageCounter: byId("pageCounter"),
  swipeHint: byId("swipeHint"),
  scanGuide: byId("scanGuide"),
  compileOverlay: byId("compileOverlay"),
  compileTitle: byId("compileTitle"),
  compileMsg: byId("compileMsg"),
  progressBar: byId("progressBar"),
  compilePct: byId("compilePct"),
  toast: byId("toast"),
  diagram: byId("diagram"),
  diagramContent: byId("diagramContent"),
  overlapHint: byId("overlapHint"),
  gapRange: byId("gapRange"),
  gapValue: byId("gapValue"),
  offsetXRange: byId("offsetXRange"),
  offsetXValue: byId("offsetXValue"),
  offsetYRange: byId("offsetYRange"),
  offsetYValue: byId("offsetYValue"),
  scaleRange: byId("scaleRange"),
  scaleValue: byId("scaleValue"),
  stabilitySelect: byId("stabilitySelect"),
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
  clearSavedBtn: byId("clearSavedBtn")
};

export const positionButtons = Array.from(document.querySelectorAll("[data-position]"));
export const orientationButtons = Array.from(document.querySelectorAll("[data-orientation]"));
