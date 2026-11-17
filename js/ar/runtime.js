import { DEFAULT_SETTINGS } from "../config.js";
import { arDom } from "./dom.js";
import { arState } from "./state.js";
import { buildDots, initHud, updateHud } from "./hud.js";
import { closePanel, initPanel } from "./panel.js";
import { initGestures } from "./gestures.js";
import { mountArScene, teardownScene } from "./scene.js";
import { disposePageCaches, stopActiveVideo } from "../media/textures.js";

let uiReady = false;

export function initArUi() {
  if (uiReady) return;
  uiReady = true;
  initHud();
  initPanel();
  initGestures();
}

async function requestWakeLock() {
  if (!("wakeLock" in navigator) || arState.wakeLock) return;
  try {
    const lock = await navigator.wakeLock.request("screen");
    if (arState.sceneEl) arState.wakeLock = lock;
    else { try { lock.release(); } catch (err) { /* noop */ } }
  } catch (err) { /* noop */ }
}

function releaseWakeLock() {
  if (!arState.wakeLock) return;
  try { arState.wakeLock.release(); } catch (err) { /* noop */ }
  arState.wakeLock = null;
}

export function startAr({ targets, settings, mindUrl, onReady, onError }) {
  teardownScene();
  closePanel();
  stopActiveVideo();
  disposePageCaches(arState.targets);
  window.clearTimeout(arState.readyTimer);

  arState.targets = targets;
  arState.settings = Object.assign({}, DEFAULT_SETTINGS, settings);
  arState.mindUrl = mindUrl;
  arState.onReady = onReady || null;
  arState.onError = onError || null;
  arState.sceneReady = false;
  arState.cameraError = false;
  arState.interactive = false;
  arState.everFound = false;
  arState.currentPage = 0;
  arState.activeTarget = -1;
  arState.activeCard = null;
  arState.panelOpen = false;
  arState.panelPage = -1;
  arState.activeVideo = null;
  arState.videoMuted = true;
  arState.renderToken++;
  arDom.errorPanel.hidden = true;
  arDom.arRoot.hidden = false;
  arDom.arHud.hidden = false;
  document.body.classList.add("ar-active");
  buildDots();
  mountArScene(mindUrl);
  requestWakeLock().catch(() => {});
}

export function stopAr() {
  window.clearTimeout(arState.readyTimer);
  arState.readyTimer = null;
  arState.interactive = false;
  arState.everFound = false;
  arState.cameraError = false;
  arState.activeTarget = -1;
  arState.activeCard = null;
  arState.sceneReady = false;
  arState.panelOpen = false;
  arState.panelPage = -1;
  arState.renderToken++;
  closePanel();
  stopActiveVideo();
  teardownScene();
  disposePageCaches(arState.targets);
  if (arState.mindUrl) {
    URL.revokeObjectURL(arState.mindUrl);
    arState.mindUrl = null;
  }
  releaseWakeLock();
  arDom.errorPanel.hidden = true;
  arDom.arRoot.hidden = true;
  arDom.arHud.hidden = true;
  arDom.videoSoundBtn.hidden = true;
  arDom.panelOpenBtn.hidden = true;
  document.body.classList.remove("ar-active", "panel-open");
  arState.sceneEl = null;
  arState.cards = [];
  arState.targets = [];
  arState.onReady = null;
  arState.onError = null;
  arState.settings = { ...DEFAULT_SETTINGS };
  arState.currentPage = 0;
  arState.activeVideo = null;
  arState.videoMuted = true;
  updateHud();
}
