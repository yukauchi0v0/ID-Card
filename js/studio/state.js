import { DEFAULT_SETTINGS } from "../config.js";

// Studio-only mutable store. The AR runtime keeps its own singleton
// (js/ar/state.js), so the studio page and the viewer never share session data.
export const studioState = {
  targets: [],
  adding: false,
  compiling: false,
  restoring: false,
  mindBlob: null,
  mindSignature: "",
  uid: 0,
  settings: { ...DEFAULT_SETTINGS }
};
