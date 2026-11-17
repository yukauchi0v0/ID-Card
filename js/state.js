import { DEFAULT_SETTINGS } from "./config.js";

// Single mutable store shared by feature modules. It intentionally contains
// only serialisable/runtime values; DOM elements live in dom.js.
export const state = {
  targets: [],
  adding: false,
  compiling: false,
  sceneEl: null,
  sceneReady: false,
  mindUrl: null,
  cards: [],
  activeTarget: -1,
  activeCard: null,
  currentPage: 0,
  interactive: false,
  everFound: false,
  cameraError: false,
  restoring: false,
  mindBlob: null,
  mindSignature: "",
  panelOpen: false,
  panelPage: -1,
  activeVideo: null,
  videoMuted: true,
  renderToken: 0,
  readyTimer: null,
  toastTimer: null,
  toastHideTimer: null,
  uid: 0,
  wakeLock: null,
  settings: { ...DEFAULT_SETTINGS }
};
