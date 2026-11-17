import { DEFAULT_SETTINGS } from "../config.js";

// Single AR session per page. Studio and viewer both use this store; the
// hosting page owns everything outside AR (setup, profile, publish).
export const arState = {
  targets: [],
  settings: { ...DEFAULT_SETTINGS },
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
  panelOpen: false,
  panelPage: -1,
  activeVideo: null,
  videoMuted: true,
  renderToken: 0,
  readyTimer: null,
  wakeLock: null,
  onReady: null,
  onError: null
};
