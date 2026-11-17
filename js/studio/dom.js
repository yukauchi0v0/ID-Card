// Studio-only elements. AR-shell ids live in js/ar/dom.js and are injected by
// js/ar/shell.js before the studio app is imported.
function byId(id) {
  const el = document.getElementById(id);
  if (!el) throw new Error("Missing required element #" + id);
  return el;
}

export const studioDom = {
  setup: byId("setup"),
  cards: byId("cards"),
  emptyHint: byId("emptyHint"),
  countBadge: byId("countBadge"),
  dropZone: byId("dropZone"),
  fileInput: byId("fileInput"),
  enterBtn: byId("enterBtn"),
  compileOverlay: byId("compileOverlay"),
  compileTitle: byId("compileTitle"),
  compileMsg: byId("compileMsg"),
  progressBar: byId("progressBar"),
  compilePct: byId("compilePct"),
  profileName: byId("profileName"),
  profileTitle: byId("profileTitle"),
  profileCompany: byId("profileCompany"),
  profilePhone: byId("profilePhone"),
  profileEmail: byId("profileEmail"),
  profileWebsite: byId("profileWebsite"),
  profileSlug: byId("profileSlug"),
  publishBtn: byId("publishBtn"),
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
  clearSavedBtn: byId("clearSavedBtn"),
  shareOverlay: byId("shareOverlay"),
  shareUrl: byId("shareUrl"),
  shareQr: byId("shareQr"),
  shareCopy: byId("shareCopy"),
  shareDownload: byId("shareDownload"),
  shareQrDownload: byId("shareQrDownload"),
  shareClose: byId("shareClose")
};

export const positionButtons = Array.from(document.querySelectorAll("[data-position]"));
export const orientationButtons = Array.from(document.querySelectorAll("[data-orientation]"));
