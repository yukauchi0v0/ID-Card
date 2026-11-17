# Viewer / Studio Split Implementation Plan

## Review Focus

請 reviewer 先確認以下決策，再開始實作：

1. AR 使用 singleton `arState` / `arDom`，每個頁面只有一個 AR session。
2. AR shell 由 `js/ar/shell.js` 注入，且必須在 app dynamic import 前完成。
3. 觀看端只讀 `card.json`、`card.mind`、`media/`，不編譯、不寫 IndexedDB。
4. 發布包是靜態 zip；QR 指向 `viewer.html?card=cards/<slug>/card.json`。
5. `vendor/fflate.js` 與 `vendor/qrcode.min.js` 為本地 vendored 檔案，不依賴執行時 CDN。

## Current State

- Repo：`https://github.com/yukauchi0v0/ID-Card.git`
- Branch：`feature/viewer-studio-split`（從 `main` `3097f17` 開出）
- Live：`https://yukauchi0v0.github.io/ID-Card/`
- 目前只有 design doc 未追蹤；尚未改應用程式碼。
- 現有單檔入口 `index.html` 同時含製作端與 AR shell；AR 模組直接依賴製作端 `js/state.js`、`js/dom.js`、`js/ui/hud.js`、`js/ui/toast.js`。

## Task 1: Extract shared AR core, split studio entry

**Goal:** 讓 `studio.html` 使用共用的 `js/ar` 核心，`index.html` 變成 landing；功能與視覺不變。

**Files:**

- Move:
  - `js/main.js` → `js/studio/main.js`
  - `js/app.js` → `js/studio/app.js`
  - `js/state.js` → `js/studio/state.js`
  - `js/dom.js` → `js/studio/dom.js`
  - `js/ui/` → `js/studio/ui/`
  - `js/ui/hud.js` → `js/ar/hud.js`
  - `js/ui/toast.js` → `js/shared/toast.js`
  - `js/storage/session.js` → `js/studio/session.js`
- New:
  - `js/ar/state.js`
  - `js/ar/dom.js`
  - `js/ar/shell.js`
  - `js/ar/runtime.js`
  - `js/ar/gestures.js`
  - `js/studio/ui/compile-overlay.js` (from `js/ui/compile-overlay.js`)
- HTML:
  - `studio.html`
  - `index.html` (landing)
- CSS:
  - `styles/landing.css`

**Step 1: Move files and create directories**

```powershell
New-Item -ItemType Directory -Force js/studio, js/shared | Out-Null
git mv js/main.js js/studio/main.js
git mv js/app.js js/studio/app.js
git mv js/state.js js/studio/state.js
git mv js/dom.js js/studio/dom.js
git mv js/ui js/studio/ui
git mv js/studio/ui/hud.js js/ar/hud.js
git mv js/studio/ui/toast.js js/shared/toast.js
git mv js/storage/session.js js/studio/session.js
Remove-Item js/storage -Recurse -Force
```

**Step 2: Add `js/ar/state.js`**

```js
import { DEFAULT_SETTINGS } from "../config.js";

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
```

**Step 3: Add `js/ar/dom.js`**

Resolve only IDs that live in the injected AR shell:

```js
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
```

**Step 4: Add `js/ar/shell.js`**

Copy the current markup from `index.html` lines 137–196 and 209 (AR root, HUD, video button, panel button, content panel, toast) into a template literal. Keep all IDs and classes identical. Do not include `#compileOverlay` or studio IDs.

```js
let mounted = false;

export function mountArShell({ backLabel = "返回設定" } = {}) {
  if (mounted || document.getElementById("arRoot")) return;
  mounted = true;
  const shell = `
    <div id="arRoot" hidden></div>
    <div id="arHud" hidden>
      ... exact HUD markup from index.html ...
    </div>
    <button id="videoSoundBtn" class="video-sound-btn" type="button" hidden>開啟聲音</button>
    <button id="panelOpenBtn" class="panel-open-btn" type="button" hidden>開啟內容面板</button>
    <section id="contentPanel" aria-label="內容面板" aria-hidden="true" inert>...</section>
    <div id="toast" class="toast" role="status" aria-live="polite" hidden></div>
  `;
  document.body.insertAdjacentHTML("beforeend", shell);
  const back = document.getElementById("backBtn");
  if (back) {
    back.setAttribute("aria-label", backLabel);
    const label = back.querySelector("span");
    if (label) label.textContent = backLabel;
  }
  const errorBack = document.getElementById("errorBackBtn");
  if (errorBack) errorBack.textContent = backLabel;
}
```

The `... exact HUD markup ...` line is a directive to move the existing HUD block verbatim, not new content.

**Step 5: Rewrite AR imports**

Apply these replacements in `js/ar/hud.js`, `js/ar/panel.js`, `js/ar/content.js`, `js/ar/scene.js`:

- `import { state } from "../state.js"` → `import { arState } from "./state.js"`
- `import { dom } from "../dom.js"` → `import { arDom } from "./dom.js"`
- `import { updateHud } from "../ui/hud.js"` → `import { updateHud } from "./hud.js"`
- `import { toast } from "../ui/toast.js"` → `import { toast } from "../shared/toast.js"`
- Every `state.` → `arState.`
- Every `dom.` → `arDom.`

In `js/ar/scene.js` remove `import { showCompileOverlay } ...` and replace calls with callbacks:

```js
sceneEl.addEventListener("arReady", () => {
  if (arState.sceneEl !== sceneEl) return;
  arState.sceneReady = true;
  arState.cameraError = false;
  window.clearTimeout(arState.readyTimer);
  arDom.errorPanel.hidden = true;
  updateHud();
  if (typeof arState.onReady === "function") arState.onReady();
  toast("相機已啟動，將鏡頭對準卡蓋圖案；若內容超出畫面，把手機往後退一點。", 4200);
});

sceneEl.addEventListener("arError", (event) => {
  if (arState.sceneEl !== sceneEl) return;
  window.clearTimeout(arState.readyTimer);
  arState.sceneReady = false;
  arState.cameraError = true;
  arState.interactive = false;
  arState.activeTarget = -1;
  arState.activeCard = null;
  arDom.errorPanel.hidden = false;
  updateHud();
  if (typeof arState.onError === "function") arState.onError(event);
});
```

Remove the 22-second timeout's `showCompileOverlay(false)` line. Keep the toast, and call the runtime error hook so the hosting page can dismiss its own overlay/loading state without opening the error panel:

```js
if (!arState.sceneReady && typeof arState.onError === "function") {
  arState.onError(new Error("相機啟動逾時"));
  toast("相機啟動逾時；請確認相機權限，或重新整理再試。", 5200);
}
```

**Step 6: Change texture signatures**

In `js/media/textures.js`:

```js
import { arState } from "../ar/state.js";
import { arDom } from "../ar/dom.js";

export function getPageMedia(page, index, total) {
  if (page.contentType === "text") {
    return Promise.resolve({
      texture: makeTextTexture(page, index, total),
      aspect: 2
    });
  }
  if (page.contentType === "image") return ensureImage(page);
  if (page.contentType === "video") return ensureVideo(page);
  return Promise.reject(new Error("此內容類型不使用 3D 平面"));
}

export function stopActiveVideo() {
  if (arState.activeVideo) {
    try { arState.activeVideo.pause(); } catch (err) { /* noop */ }
    arState.activeVideo = null;
  }
  arDom.videoSoundBtn.hidden = true;
}

export function disposePageCaches(targets = arState.targets) {
  targets.forEach((target) => { /* body unchanged */ });
  arState.activeVideo = null;
}
```

In `js/ar/content.js`, call `getPageMedia(page, arState.currentPage, arState.targets.length)`.

Replace the marker-height calculation in `layoutCard`:

```js
const markerAspect = Number(page.markerAspect) > 0 ? Number(page.markerAspect) : CARD_H;
const halfMarkerHeight = Math.max(CARD_H / 2, markerAspect / 2);
```

**Step 7: Add `js/ar/runtime.js` and `js/ar/gestures.js`**

`js/ar/gestures.js` is the current `initGestures()` from `js/app.js`, with `state` → `arState`, exported as `initGestures`.

`js/ar/runtime.js`:

```js
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
```

**Step 8: Convert studio state/dom/app/main**

`js/studio/state.js`:

```js
import { DEFAULT_SETTINGS } from "../config.js";

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
```

`js/studio/dom.js` keeps only studio IDs: `setup`, `cards`, `emptyHint`, `countBadge`, `dropZone`, `fileInput`, `enterBtn`, `compileOverlay`, `compileTitle`, `compileMsg`, `progressBar`, `compilePct`, `diagram`, `diagramContent`, `overlapHint`, all settings controls, `clearSavedBtn`. Rename `dom` to `studioDom` and export `positionButtons`/`orientationButtons` as before.

`js/studio/main.js`:

```js
import { mountArShell } from "../ar/shell.js";

mountArShell({ backLabel: "返回設定" });

const { initApp } = await import("./app.js");
initApp();
```

`js/studio/app.js` changes:

- Imports: `studioState`/`studioDom`; `initArUi, startAr, stopAr`; `arDom`; no `buildDots`, `mountArScene`, `teardownScene`, `closePanel`, `initPanel`, `initHud`, `stopActiveVideo`, `disposePageCaches`, `showCompileOverlay` only for compile progress.
- `showArUi()` only hides setup. Do **not** call `updateHud()` here and do **not** reference `errorPanel`: `startAr` owns AR root/HUD/body, and `errorPanel` lives in `arDom`.
  ```js
  function showArUi() {
    studioDom.setup.hidden = true;
  }
  ```
- Replace cached branch:
  ```js
  studioState.mindUrl = URL.createObjectURL(studioState.mindBlob);
  setCompileProgress(100, "正在啟動相機…");
  studioDom.compileTitle.textContent = "正在啟動相機";
  showArUi();
  startAr({
    targets: studioState.targets,
    settings: studioState.settings,
    mindUrl: studioState.mindUrl,
    onReady: () => showCompileOverlay(false),
    onError: () => showCompileOverlay(false)
  });
  ```
- Replace fresh compile branch similarly.
- Remove local `requestWakeLock`/`releaseWakeLock`; runtime owns them.
- `exitAr()`:
  ```js
  function exitAr() {
    if (!document.body.classList.contains("ar-active") && !studioDom.setup.hidden) return;
    stopAr();
    studioState.mindUrl = null;
    studioState.compiling = false;
    studioDom.setup.hidden = false;
    updateEnterButton();
    window.scrollTo(0, 0);
  }
  ```
- `initApp()`:
  ```js
  initArUi();
  initSettings();
  initTargets();
  initSessionControls();
  updateSettingsUi();
  renderCards();
  restoreSession();
  arDom.backBtn.addEventListener("click", exitAr);
  arDom.errorBackBtn.addEventListener("click", exitAr);
  ...
  ```
  Bind `studioDom.enterBtn`; no `initPanel`/`initHud`/`initGestures`.
- On `beforeunload`: revoke target URLs, call `stopAr()` (best effort), no local wake lock.
- In `enterAr` catch: `showCompileOverlay(false)` and call `exitAr()` to restore setup and stop any partially-mounted scene; do not call `disposePageCaches()` directly. `exitAr()` is safe when AR never became active because it returns early only when setup is already visible.
- Remove `updateHud` import unless needed for `showArUi`; `startAr` calls it. Keep `arDom` for back buttons.

`js/studio/ui/*` import updates:

- `targets.js`: `studioState`, `studioDom`; `../../config.js`; `../../utils/...`; `../../shared/toast.js`; `./enter-button.js`; remove `updateDots` import and `updateDots()` call.
- `settings.js`: `studioState`, `studioDom`; `../../utils/format.js`.
- `enter-button.js`: `studioState`, `studioDom`; `../../media/compiler.js`.
- `compile-overlay.js`: `studioDom`.
- `session.js`: `studioState`, `studioDom`; `../config.js`; `../utils/...`; `../shared/toast.js`; `./ui/targets.js`; `./ui/settings.js`; `./ui/enter-button.js`.

`js/shared/toast.js`:

```js
import { arDom } from "../ar/dom.js";
let timer = null;
let hideTimer = null;

export function toast(message, duration = 3600) {
  window.clearTimeout(timer);
  window.clearTimeout(hideTimer);
  arDom.toast.textContent = message;
  arDom.toast.hidden = false;
  requestAnimationFrame(() => arDom.toast.classList.add("show"));
  timer = window.setTimeout(() => {
    arDom.toast.classList.remove("show");
    hideTimer = window.setTimeout(() => { arDom.toast.hidden = true; }, 220);
  }, duration);
}
```

**Step 9: Create `studio.html`**

Copy current `index.html` to `studio.html`, then:

- `<title>ID Card · Studio</title>`
- Keep `#setup` and `#compileOverlay`.
- Delete `#arRoot`, `#arHud`, `#videoSoundBtn`, `#panelOpenBtn`, `#contentPanel`, `#toast`; the shell injects them.
- Change module script to `js/studio/main.js`.
- Add `vendor/fflate.js` and `vendor/qrcode.min.js` only when those tasks are done; for Task 1 just the module script.
- Add action buttons later; current `#enterBtn` remains.

**Step 10: Create landing `index.html`**

Replace `index.html` with a static landing page:

```html
<!DOCTYPE html>
<html lang="zh-Hant">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>ID Card</title>
  <link rel="stylesheet" href="styles/landing.css" />
</head>
<body>
  <main class="landing">
    <div class="landing-inner">
      <p class="eyebrow">ID CARD · WEBAR</p>
      <h1>一張名片，<br />兩種入口。</h1>
      <p class="landing-lede">收到名片的人看內容；製作名片的人進入工作室。</p>
      <div class="entry-grid">
        <a class="entry-card" href="viewer.html">
          <span class="entry-num">01</span>
          <h2>觀看名片</h2>
          <p>使用名片上的 QR 或連結；進入後可看聯絡資訊與 AR 內容。</p>
        </a>
        <a class="entry-card" href="studio.html">
          <span class="entry-num">02</span>
          <h2>製作名片</h2>
          <p>上傳卡蓋圖案、編輯內容、編譯並發布自己的名片。</p>
        </a>
      </div>
      <p class="landing-note">觀看端需要名片上的卡片連結；直接打開首頁不會有卡片資料。</p>
    </div>
  </main>
</body>
</html>
```

`styles/landing.css`:

```css
@import "tokens.css";
@import "base.css";

body { min-height: 100vh; }
.landing { min-height: 100vh; display: grid; place-items: center; padding: 32px 20px; }
.landing-inner { width: min(900px, 100%); }
.eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  padding: 7px 12px;
  border: 1px solid var(--line);
  border-radius: 999px;
  color: var(--ink-soft);
  background: rgba(255, 255, 255, 0.6);
  font-size: 10px;
  font-weight: 750;
  letter-spacing: 0.18em;
}
.entry-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; margin-top: 32px; }
.entry-card { display: block; padding: 24px; border-radius: 24px; background: rgba(255,255,255,.82); color: inherit; text-decoration: none; border: 1px solid rgba(31,47,47,.1); }
.entry-card:hover { transform: translateY(-2px); }
@media (max-width: 640px) { .entry-grid { grid-template-columns: 1fr; } }
```

Use existing CSS variables from `tokens.css`; do not invent new palette.

**Step 11: Verify and commit**

```powershell
Get-ChildItem js -Recurse -Filter *.js | ForEach-Object { node --check $_.FullName }
python -m http.server 8767
```

Open `http://127.0.0.1:8767/studio.html`:

- setup visible, no duplicate IDs
- `#arRoot` exists after module loads; `AFRAME`/`MINDAR` exist
- upload one target, compile, enter AR, back to setup
- console 0 errors

Open `http://127.0.0.1:8767/`:

- landing renders, links go to `viewer.html` / `studio.html`
- no A-Frame request on landing

```powershell
git add -A
git commit -m "refactor: share AR core between studio and viewer entries"
```

## Task 2: Add profile, session persistence, card package

**Goal:** Studio 可以填名片資訊、保存/還原，並下載 `cards/<slug>/` zip。

**Files:**

- `js/config.js` add `DEFAULT_PROFILE`
- `js/utils/slug.js`
- `js/studio/profile.js`
- `js/studio/manifest.js`
- `js/studio/card-package.js`
- `js/studio/dom.js` profile/publish refs
- `js/studio/state.js` profile
- `js/studio/session.js` profile save/restore
- `studio.html` profile section and publish button
- `styles/studio.css` (imported from `styles.css`)
- `vendor/fflate.js`, `vendor/README.md`

**Step 1: Add default profile and slugify**

`js/config.js`:

```js
export const DEFAULT_PROFILE = {
  name: "",
  title: "",
  company: "",
  phone: "",
  email: "",
  website: "",
  slug: ""
};
```

`js/utils/slug.js`:

```js
export function slugify(value) {
  const ascii = String(value || "")
    .normalize("NFKD")
    .replace(/[^\x00-\x7F]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (ascii) return ascii;
  if (!String(value || "").trim()) return "my-card";
  // Names with no ASCII letters (for example 林怡君) still need a stable,
  // collision-resistant folder name. A small deterministic hash is enough
  // for a single-card static package and keeps URLs ASCII-only.
  let hash = 0;
  for (const ch of String(value)) hash = (hash * 31 + ch.codePointAt(0)) >>> 0;
  return "card-" + hash.toString(36);
}
```

**Step 2: Add profile UI**

In `studio.html`, insert before the target section:

```html
<section class="panel">
  <div class="panel-head">
    <div>
      <h2>01 · 名片資訊</h2>
      <p>這些欄位會顯示在觀看端的普通名片頁；空白欄位不會顯示。</p>
    </div>
  </div>
  <div class="profile-grid">
    <label class="field"><span>姓名</span><input id="profileName" maxlength="60" autocomplete="name" /></label>
    <label class="field"><span>職稱</span><input id="profileTitle" maxlength="80" autocomplete="organization-title" /></label>
    <label class="field"><span>公司</span><input id="profileCompany" maxlength="80" autocomplete="organization" /></label>
    <label class="field"><span>電話</span><input id="profilePhone" type="tel" maxlength="40" autocomplete="tel" /></label>
    <label class="field"><span>Email</span><input id="profileEmail" type="email" maxlength="120" autocomplete="email" /></label>
    <label class="field"><span>網站</span><input id="profileWebsite" type="url" maxlength="200" placeholder="https://" autocomplete="url" /></label>
    <label class="field"><span>卡片網址代稱（slug）</span><input id="profileSlug" maxlength="40" pattern="[a-z0-9-]*" placeholder="my-card" /></label>
  </div>
</section>
```

Renumber existing sections to `02 · 卡蓋圖案與內容` and `03 · AR 顯示位置`.

Add `#publishBtn` in `.action-bar` after `#enterBtn`:

```html
<button id="publishBtn" class="secondary-btn" type="button">下載卡片包</button>
```

`js/studio/dom.js` add refs:

```js
profileName: byId("profileName"),
profileTitle: byId("profileTitle"),
profileCompany: byId("profileCompany"),
profilePhone: byId("profilePhone"),
profileEmail: byId("profileEmail"),
profileWebsite: byId("profileWebsite"),
profileSlug: byId("profileSlug"),
publishBtn: byId("publishBtn")
```

`js/studio/state.js` add:

```js
import { DEFAULT_PROFILE, DEFAULT_SETTINGS } from "../config.js";
profile: { ...DEFAULT_PROFILE }
```

`js/studio/profile.js`:

```js
import { slugify } from "../utils/slug.js";
import { studioState } from "./state.js";
import { studioDom } from "./dom.js";

const FIELDS = ["name", "title", "company", "phone", "email", "website", "slug"];

export function renderProfile() {
  FIELDS.forEach((key) => {
    const input = studioDom["profile" + key[0].toUpperCase() + key.slice(1)];
    if (input) input.value = studioState.profile[key] || "";
  });
}

export function initProfile() {
  FIELDS.forEach((key) => {
    const input = studioDom["profile" + key[0].toUpperCase() + key.slice(1)];
    if (!input) return;
    input.addEventListener("input", () => {
      studioState.profile[key] = input.value;
      if (key === "slug") studioState.profile.slug = slugify(input.value);
    });
  });
  renderProfile();
}
```

For slug input, do not rewrite while typing on every keystroke; use `change`:

```js
if (key === "slug") {
  input.addEventListener("change", () => {
    studioState.profile.slug = slugify(input.value);
    input.value = studioState.profile.slug;
  });
}
```

**Step 3: Session persistence**

In `js/studio/session.js`:

- Save: `profile: Object.assign({}, studioState.profile)`.
- Restore: 
  ```js
  studioState.profile = Object.assign({}, studioState.profile, record.profile || {});
  studioState.profile.slug = slugify(studioState.profile.slug || studioState.profile.name);
  ```
- Call `renderProfile()` and `initProfile()` order: `initProfile()` once in `initApp` **before** `restoreSession()`, `renderProfile()` after restore.
- In `js/studio/session.js`, import `renderProfile` and call it after merging the restored profile.
- In `js/studio/app.js`, import `initProfile` and add `initProfile();` before `restoreSession();`.
- Import `slugify` in `js/studio/session.js`.
- `saveSession` guard still requires `mindBlob`; profile edits before compile won't save until compile. Acceptable; document. If desired, save profile when `publish`/compile.

**Step 4: Build manifest (pure)**

`js/studio/manifest.js`:

```js
import { CARD_H, DEFAULT_SETTINGS } from "../config.js";
import { slugify } from "../utils/slug.js";

export function markerAspect(target) {
  if (Number(target.markerAspect) > 0) return Number(target.markerAspect);
  const img = target.img;
  if (img && img.width) return (img.height || 1) / img.width;
  return CARD_H;
}

export function buildCardManifest({ profile, targets, settings, mediaPaths = [] }) {
  const slug = slugify(profile.slug || profile.name);
  return {
    version: 1,
    slug,
    profile: {
      name: profile.name || "",
      title: profile.title || "",
      company: profile.company || "",
      phone: profile.phone || "",
      email: profile.email || "",
      website: profile.website || ""
    },
    settings: Object.assign({}, DEFAULT_SETTINGS, settings || {}),
    mind: "card.mind",
    targets: targets.map((target, index) => {
      const page = {
        label: target.label || "內容 " + (index + 1),
        contentType: target.contentType,
        text: target.text || "",
        url: target.url || "",
        markerAspect: markerAspect(target)
      };
      if (mediaPaths[index]) {
        page.media = mediaPaths[index];
        page.mediaName = target.contentName || "";
        page.mediaMime = target.contentMime || "";
      }
      return page;
    })
  };
}
```

`DEFAULT_PROFILE` is intentionally not imported here; the manifest only needs `DEFAULT_SETTINGS`.

**Step 5: Download vendor fflate**

```powershell
New-Item -ItemType Directory -Force vendor | Out-Null
Invoke-WebRequest https://cdn.jsdelivr.net/npm/fflate@0.8.2/umd/index.js -OutFile vendor/fflate.js
@'
fflate 0.8.2 (MIT)
https://github.com/101arrowz/fflate
Downloaded from https://cdn.jsdelivr.net/npm/fflate@0.8.2/umd/index.js
'@ | Set-Content vendor/README.md
```

`vendor/fflate.js` exposes `window.fflate`; add `<script src="vendor/fflate.js"></script>` before `js/studio/main.js` in `studio.html`.

**Step 6: Card package exporter**

`js/studio/card-package.js`:

```js
import { studioState } from "./state.js";
import { buildCardManifest } from "./manifest.js";
import { targetSignature } from "./session.js";
import { toast } from "../shared/toast.js";

function extensionFor(target) {
  const name = target.contentName || "";
  const ext = name.split(".").pop().toLowerCase();
  if (/^[a-z0-9]{2,5}$/.test(ext)) return ext;
  if (target.contentMime === "application/pdf") return "pdf";
  if (target.contentMime === "video/mp4") return "mp4";
  return "bin";
}

function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function exportCardPackage() {
  const fflate = window.fflate;
  if (!fflate) { toast("打包工具沒有載入，請重新整理。", 5200); return null; }
  if (!studioState.mindBlob || studioState.mindSignature !== targetSignature()) {
    toast("請先編譯卡蓋圖案，再下載卡片包。", 5200);
    return null;
  }

  const slug = buildCardManifest({
    profile: studioState.profile,
    targets: studioState.targets,
    settings: studioState.settings
  }).slug;

  const entries = {};
  const mediaPaths = [];
  const base = `cards/${slug}/`;

  for (let i = 0; i < studioState.targets.length; i++) {
    const target = studioState.targets[i];
    if (!["image", "video", "pdf"].includes(target.contentType)) continue;
    if (!target.contentFile) {
      toast("第 " + (i + 1) + " 頁還沒有內容檔案。", 5200);
      return null;
    }
    const path = `media/page-${i + 1}.${extensionFor(target)}`;
    mediaPaths[i] = path;
    entries[base + path] = new Uint8Array(await target.contentFile.arrayBuffer());
  }

  const manifest = buildCardManifest({
    profile: studioState.profile,
    targets: studioState.targets,
    settings: studioState.settings,
    mediaPaths
  });
  entries[base + "card.json"] = fflate.strToU8(JSON.stringify(manifest, null, 2));
  entries[base + "card.mind"] = new Uint8Array(await studioState.mindBlob.arrayBuffer());

  const zip = fflate.zipSync(entries, { level: 0 });
  const blob = new Blob([zip], { type: "application/zip" });
  download(blob, slug + "-card.zip");
  toast("已下載 " + slug + "-card.zip。解壓後把 cards/" + slug + "/ 放到網站根目錄。", 6200);
  return { slug, fileName: slug + "-card.zip" };
}
```

**Step 7: Do not bind the publish button here**

Task 4 adds `js/studio/share.js` with `initShare()`, which owns `publishBtn`, the share overlay and QR. Do not add a second `publishBtn` listener in `studio/app.js`; two listeners would download twice.

`studio.html` includes `vendor/fflate.js` before the module entry.

**Step 8: CSS**

Add `styles/studio.css`:

```css
.profile-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}
.profile-grid .field:last-child { grid-column: 1 / -1; }
.secondary-btn {
  min-height: 44px;
  padding: 0 16px;
  border: 1px solid var(--line);
  border-radius: 999px;
  color: var(--ink);
  background: #fff;
  font-size: 12.5px;
  font-weight: 750;
  cursor: pointer;
}
.secondary-btn:hover { background: var(--mint-soft); }
.share-card {
  width: min(100%, 430px);
  padding: 24px;
  border: 1px solid var(--line);
  border-radius: 24px;
  background: #fff;
  box-shadow: 0 30px 90px rgba(31, 47, 47, 0.18);
}
.share-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.share-head h2 { margin: 8px 0 0; font-size: 22px; letter-spacing: -0.02em; }
.share-note { margin: 14px 0; color: var(--muted); font-size: 11.5px; line-height: 1.65; }
.share-note code { color: var(--ink-soft); }
.share-qr { display: grid; place-items: center; min-height: 180px; padding: 12px; border: 1px dashed var(--line-strong); border-radius: 18px; background: var(--surface-soft); }
.share-qr svg { width: min(100%, 220px); height: auto; }
.share-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px; }
@media (max-width: 640px) { .profile-grid { grid-template-columns: 1fr; } .share-actions .primary-btn { width: 100%; } }
```

Add `@import url("./styles/studio.css");` to `styles.css` before `responsive.css`.

**Step 9: Verify and commit**

```powershell
node --test tests
python -m http.server 8767
```

- Fill profile, compile one target, reload: profile restored.
- Click download; inspect zip:
  ```powershell
  Expand-Archive .\my-card-card.zip -DestinationPath .\tmp-card -Force
  Get-ChildItem .\tmp-card -Recurse
  ```
  Verify `cards/my-card/card.json`, `card.mind`, `media/...`.
- `card.json` includes profile, settings, targets, `markerAspect`.
- 0 console errors.

Commit: `feat: add card profile and static package export`.

## Task 3: Add viewer page

**Goal:** `viewer.html?card=...` 顯示名片、啟動共用 AR、返回名片。

**Files:**

- `viewer.html`
- `js/viewer/main.js`
- `js/viewer/app.js`
- `js/viewer/dom.js`
- `js/viewer/manifest.js`
- `styles/viewer.css`

**Step 1: Viewer manifest**

`js/viewer/manifest.js`:

```js
import { CARD_H, DEFAULT_SETTINGS, TYPE_LABELS } from "../config.js";

function text(value) { return typeof value === "string" ? value : ""; }

export function normalizeManifest(raw, baseUrl) {
  if (!raw || typeof raw !== "object") throw new Error("card.json 格式不正確");
  if (!Array.isArray(raw.targets) || raw.targets.length === 0) throw new Error("card.json 沒有卡面資料");
  if (raw.targets.length > 8) throw new Error("card.json 超過 8 張卡面");

  const mindUrl = new URL(raw.mind || "card.mind", baseUrl).href;
  const targets = raw.targets.map((item, index) => {
    const contentType = Object.prototype.hasOwnProperty.call(TYPE_LABELS, item.contentType)
      ? item.contentType : "text";
    const page = {
      id: index + 1,
      label: text(item.label) || "內容 " + (index + 1),
      contentType,
      text: text(item.text),
      url: text(item.url),
      markerAspect: Number(item.markerAspect) > 0 ? Number(item.markerAspect) : CARD_H,
      contentObjectUrl: null,
      contentName: text(item.mediaName),
      contentMime: text(item.mediaMime)
    };
    if (item.media) page.contentObjectUrl = new URL(item.media, baseUrl).href;
    if (["image", "video", "pdf"].includes(contentType) && !page.contentObjectUrl) {
      throw new Error("第 " + (index + 1) + " 頁缺少 media");
    }
    if (["webpage", "videoLink"].includes(contentType) && !/^https?:\/\//i.test(page.url)) {
      throw new Error("第 " + (index + 1) + " 頁網址無效");
    }
    return page;
  });

  return {
    version: Number(raw.version) || 1,
    slug: text(raw.slug),
    profile: {
      name: text(raw.profile && raw.profile.name),
      title: text(raw.profile && raw.profile.title),
      company: text(raw.profile && raw.profile.company),
      phone: text(raw.profile && raw.profile.phone),
      email: text(raw.profile && raw.profile.email),
      website: text(raw.profile && raw.profile.website)
    },
    settings: Object.assign({}, DEFAULT_SETTINGS, raw.settings || {}),
    mindUrl,
    targets
  };
}

export async function loadManifest(url) {
  const absolute = new URL(url, window.location.href);
  const response = await fetch(absolute, { cache: "no-store" });
  if (!response.ok) throw new Error("讀不到卡片資料（HTTP " + response.status + "）");
  const raw = await response.json();
  return normalizeManifest(raw, absolute.href);
}
```

**Step 2: Viewer DOM and HTML**

`viewer.html`:

```html
<!DOCTYPE html>
<html lang="zh-Hant">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
  <meta name="theme-color" content="#f6f6f6" />
  <title>ID Card · Viewer</title>
  <link rel="stylesheet" href="styles/viewer.css" />
  <script src="https://aframe.io/releases/1.5.0/aframe.min.js"></script>
</head>
<body>
  <main id="viewer">
    <section id="viewerProfile" class="viewer-card">
      <p class="viewer-eyebrow">ID CARD</p>
      <h1 id="viewerName">ID Card</h1>
      <p id="viewerTitle" class="viewer-title"></p>
      <p id="viewerCompany" class="viewer-company"></p>
      <ul class="viewer-contact">
        <li id="viewerPhoneItem"><a id="viewerPhone"></a></li>
        <li id="viewerEmailItem"><a id="viewerEmail"></a></li>
        <li id="viewerWebsiteItem"><a id="viewerWebsite" target="_blank" rel="noopener"></a></li>
      </ul>
      <button id="viewerArBtn" class="primary-btn" type="button" disabled>用 AR 看 <span class="arrow">→</span></button>
      <p class="viewer-hint">需要相機權限；建議用手機開啟。看不到 AR 時，名片資訊仍可使用。</p>
    </section>

    <section id="viewerError" class="viewer-card viewer-error" hidden>
      <p class="viewer-eyebrow">ID CARD</p>
      <h1>讀不到這張名片</h1>
      <p id="viewerErrorMsg"></p>
      <a class="primary-btn" href="index.html">回首頁</a>
    </section>

    <div id="viewerLoading" class="viewer-loading" hidden>
      <div class="compile-orbit"></div>
      <p>正在啟動相機…</p>
    </div>
  </main>

  <script type="module" src="https://cdn.jsdelivr.net/npm/mind-ar@1.2.2/dist/mindar-image.prod.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/mind-ar@1.2.2/dist/mindar-image-aframe.prod.js"></script>
  <script src="js/mindar-bundle-ref.js"></script>
  <script type="module" src="js/viewer/main.js"></script>
</body>
</html>
```

`js/viewer/dom.js`:

```js
function byId(id) {
  const el = document.getElementById(id);
  if (!el) throw new Error("Missing element #" + id);
  return el;
}
export const viewerDom = {
  viewer: byId("viewer"),
  profile: byId("viewerProfile"),
  name: byId("viewerName"),
  title: byId("viewerTitle"),
  company: byId("viewerCompany"),
  phoneItem: byId("viewerPhoneItem"),
  phone: byId("viewerPhone"),
  emailItem: byId("viewerEmailItem"),
  email: byId("viewerEmail"),
  websiteItem: byId("viewerWebsiteItem"),
  website: byId("viewerWebsite"),
  arBtn: byId("viewerArBtn"),
  error: byId("viewerError"),
  errorMsg: byId("viewerErrorMsg"),
  loading: byId("viewerLoading")
};
```

**Step 3: Viewer app**

`js/viewer/main.js`:

```js
import { mountArShell } from "../ar/shell.js";

mountArShell({ backLabel: "返回名片" });

await import("./app.js");
```

`js/viewer/app.js`:

```js
import { viewerDom } from "./dom.js";
import { loadManifest } from "./manifest.js";
import { arDom } from "../ar/dom.js";
import { initArUi, startAr, stopAr } from "../ar/runtime.js";

let manifest = null;

function showProfile() {
  viewerDom.profile.hidden = false;
  viewerDom.error.hidden = true;
  viewerDom.loading.hidden = true;
  document.body.classList.remove("ar-active");
}

function showError(message) {
  viewerDom.profile.hidden = true;
  viewerDom.loading.hidden = true;
  viewerDom.error.hidden = false;
  viewerDom.errorMsg.textContent = message;
}

function contactLink(el, value, href) {
  const item = el.closest("li");
  if (!value || !href) { item.hidden = true; return; }
  item.hidden = false;
  el.textContent = value;
  el.href = href;
}

function renderProfile(profile) {
  viewerDom.name.textContent = profile.name || "ID Card";
  viewerDom.title.textContent = profile.title;
  viewerDom.title.hidden = !profile.title;
  viewerDom.company.textContent = profile.company;
  viewerDom.company.hidden = !profile.company;
  contactLink(viewerDom.phone, profile.phone, profile.phone ? "tel:" + profile.phone.replace(/\s+/g, "") : "");
  contactLink(viewerDom.email, profile.email, profile.email ? "mailto:" + profile.email : "");
  let website = "";
  try {
    const u = new URL(profile.website);
    if (u.protocol === "http:" || u.protocol === "https:") website = u.href;
  } catch (err) { /* noop */ }
  contactLink(viewerDom.website, website, website);
  document.title = (profile.name || "ID Card") + " · ID Card";
}

async function init() {
  initArUi();
  const cardUrl = new URLSearchParams(window.location.search).get("card");
  if (!cardUrl) {
    showError("這個連結沒有卡片資料。請掃名片上的 QR，或回到製作端發布。");
    return;
  }

  try {
    manifest = await loadManifest(cardUrl);
    renderProfile(manifest.profile);
    viewerDom.arBtn.disabled = manifest.targets.length === 0;
  } catch (err) {
    showError(err.message || "卡片資料格式不正確。");
    return;
  }

  viewerDom.arBtn.addEventListener("click", () => {
    if (!manifest) return;
    viewerDom.profile.hidden = true;
    viewerDom.loading.hidden = false;
    try {
      startAr({
        targets: manifest.targets,
        settings: manifest.settings,
        mindUrl: manifest.mindUrl,
        onReady: () => { viewerDom.loading.hidden = true; },
        onError: () => { viewerDom.loading.hidden = true; }
      });
    } catch (err) {
      try { stopAr(); } catch (stopErr) { /* best effort */ }
      viewerDom.loading.hidden = true;
      showError("無法啟動 AR：" + (err.message || "請重新整理再試。"));
    }
  });

  arDom.backBtn.addEventListener("click", () => { stopAr(); showProfile(); });
  arDom.errorBackBtn.addEventListener("click", () => { stopAr(); showProfile(); });
  window.addEventListener("beforeunload", () => { if (manifest) stopAr(); });
}

init();
```

`viewer` on AR error: `arDom.errorPanel` shows; `onError` hides loading; back returns profile. Good.

**Step 4: Viewer CSS**

`styles/viewer.css`:

```css
@import "tokens.css";
@import "base.css";
@import "setup.css";
@import "ar.css";
@import "panel.css";
@import "overlays.css";

body { min-height: 100vh; }
#viewer { min-height: 100vh; display: grid; place-items: center; padding: 28px 18px; }
.viewer-card { width: min(460px, 100%); padding: 28px; border-radius: 28px; background: rgba(255,255,255,.86); border: 1px solid var(--line); box-shadow: var(--shadow); }
.viewer-eyebrow { margin: 0; color: var(--mint-strong); font-size: 10px; font-weight: 800; letter-spacing: .2em; }
#viewer h1 { margin: 12px 0 4px; font-size: clamp(34px, 9vw, 48px); line-height: 1.05; letter-spacing: -.04em; }
.viewer-title { margin: 0; color: var(--ink-soft); font-size: 15px; font-weight: 700; }
.viewer-company { margin: 4px 0 0; color: var(--muted); font-size: 13px; }
.viewer-contact { list-style: none; padding: 0; margin: 18px 0; color: var(--ink-soft); font-size: 13px; }
.viewer-contact li { margin: 8px 0; }
.viewer-contact a { color: inherit; text-decoration-color: var(--mint-strong); text-underline-offset: 3px; }
.viewer-hint { margin: 14px 0 0; color: var(--muted); font-size: 11px; line-height: 1.6; }
.viewer-error { border-color: rgba(217, 94, 94, .28); }
.viewer-loading { position: fixed; inset: 0; display: grid; place-items: center; background: rgba(246,246,246,.84); z-index: 10; }
```

Add responsive rules for small screens. Do not change `ar.css`.

**Step 5: Verify and commit**

Use a package from Task 2:

```powershell
Expand-Archive .\my-card-card.zip -DestinationPath .\tmp-card -Force
# copy tmp-card/cards/my-card to cards/my-card for local test
python -m http.server 8767
```

Open `http://127.0.0.1:8767/viewer.html?card=cards/my-card/card.json`:

- profile renders; empty fields hidden
- AR button starts camera; forced target shows content
- back returns profile; scenarios=0, videos=0
- invalid `?card` shows error; no console errors

Commit: `feat: add viewer entry point for published cards`.

## Task 4: Add QR and share flow

**Goal:** Studio 可以複製 viewer URL、產生 QR、下載 QR。

**Files:**

- `vendor/qrcode.min.js`
- `js/studio/share.js`
- `studio.html` share overlay
- `styles/studio.css` share styles
- `js/studio/app.js` bind

**Step 1: Vendor QR**

```powershell
Invoke-WebRequest https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js -OutFile vendor/qrcode.min.js
Add-Content vendor/README.md "`nqrcode-generator 1.4.4 (MIT)`nhttps://github.com/kazuhikoarase/qrcode-generator`nDownloaded from https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js"
```

Add `<script src="vendor/qrcode.min.js"></script>` to `studio.html` before `js/studio/main.js`.

**Step 2: Share UI**

Add to `studio.html` before `#compileOverlay`:

```html
<div id="shareOverlay" class="overlay" hidden>
  <div class="share-card">
    <div class="share-head">
      <div>
        <p class="compile-kicker">SHARE CARD</p>
        <h2>發布名片</h2>
      </div>
      <button id="shareClose" class="panel-close" type="button">關閉</button>
    </div>
    <p class="share-note">先下載卡片包，解壓後把 <code>cards/&lt;slug&gt;/</code> 放到網站根目錄，再把下面的網址給對方。</p>
    <label class="field">
      <span>觀看網址</span>
      <input id="shareUrl" type="url" />
    </label>
    <div id="shareQr" class="share-qr" aria-label="名片 QR code"></div>
    <div class="share-actions">
      <button id="shareCopy" class="secondary-btn" type="button">複製連結</button>
      <button id="shareDownload" class="primary-btn" type="button">下載卡片包</button>
      <button id="shareQrDownload" class="secondary-btn" type="button">下載 QR</button>
    </div>
  </div>
</div>
```

`js/studio/dom.js` add refs for `shareOverlay`, `shareUrl`, `shareQr`, `shareCopy`, `shareDownload`, `shareQrDownload`, `shareClose`.

**Step 3: Share logic**

`js/studio/share.js`:

```js
import { studioState } from "./state.js";
import { studioDom } from "./dom.js";
import { slugify } from "../utils/slug.js";
import { exportCardPackage } from "./card-package.js";
import { toast } from "../shared/toast.js";

export function viewerUrl() {
  const slug = slugify(studioState.profile.slug || studioState.profile.name);
  const url = new URL("viewer.html", window.location.href);
  url.searchParams.set("card", "cards/" + slug + "/card.json");
  return url.href;
}

function renderQr() {
  const url = studioDom.shareUrl.value.trim();
  studioDom.shareQr.replaceChildren();
  if (!url || !window.qrcode) {
    studioDom.shareQr.textContent = url ? "QR 元件未載入，請直接複製網址。" : "";
    return;
  }
  try {
    const qr = window.qrcode(0, "M");
    qr.addData(url);
    qr.make();
    studioDom.shareQr.innerHTML = qr.createSvgTag({ cellSize: 6, margin: 2 });
  } catch (err) {
    studioDom.shareQr.textContent = "這段網址無法產生 QR；請縮短網址或直接複製連結。";
  }
}

export function openShare() {
  studioDom.shareUrl.value = viewerUrl();
  studioDom.shareOverlay.hidden = false;
  renderQr();
}

export function initShare() {
  studioDom.publishBtn.addEventListener("click", openShare);
  studioDom.shareUrl.addEventListener("input", renderQr);
  studioDom.shareClose.addEventListener("click", () => { studioDom.shareOverlay.hidden = true; });
  studioDom.shareCopy.addEventListener("click", async () => {
    const url = studioDom.shareUrl.value.trim();
    if (!url) return;
    try { await navigator.clipboard.writeText(url); toast("已複製觀看網址。"); }
    catch (err) { studioDom.shareUrl.select(); toast("請按 Ctrl/Cmd+C 複製網址。", 4200); }
  });
  studioDom.shareDownload.addEventListener("click", () => { exportCardPackage(); });
  studioDom.shareQrDownload.addEventListener("click", () => {
    const svg = studioDom.shareQr.querySelector("svg");
    if (!svg) { toast("QR 尚未產生。", 3200); return; }
    const blob = new Blob([new XMLSerializer().serializeToString(svg)], { type: "image/svg+xml" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "card-qr.svg";
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
}
```

`shareUrl` must stay editable so a user can paste the deployed URL; do not add `readonly`. Re-render the QR on every edit:

```js
studioDom.shareUrl.addEventListener("input", renderQr);
```

In `js/studio/app.js`, import `initShare` from `./share.js` and call `initShare();` once inside `initApp()` after `initArUi()`; remove the direct `publishBtn` binding from Task 2 so only one listener exists.

**Step 4: Verify and commit**

- Open share; URL ends `viewer.html?card=cards/my-card/card.json`.
- QR SVG has modules; copy link works; QR download creates SVG.
- Download package from overlay; zip still valid.
- 0 console errors.

Commit: `feat: add card share URL and QR`.

## Task 5: Add tests, docs, and full regression

**Goal:** 自動化純函式與結構檢查；更新 README；跑完整瀏覽器回歸。

**Files:**

- `package.json`
- `tests/manifest.test.js`
- `tests/viewer-manifest.test.js`
- `tests/structure.test.js`
- `README.md`

**Step 1: Package and tests**

`package.json`:

```json
{
  "name": "id-card-viewer-studio",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test tests"
  }
}
```

`tests/manifest.test.js`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { buildCardManifest } from "../js/studio/manifest.js";
import { slugify } from "../js/utils/slug.js";

test("slugify keeps ascii slugs and hashes non-ascii names", () => {
  assert.equal(slugify("Lin Yi"), "lin-yi");
  assert.equal(slugify(""), "my-card");
  assert.match(slugify("林一"), /^card-[a-z0-9]+$/);
  assert.notEqual(slugify("林一"), slugify("林二"));
});

test("manifest carries profile, settings, targets and media paths", () => {
  const manifest = buildCardManifest({
    profile: { name: "林一", title: "設計", company: "Studio", phone: "0912", email: "hi@example.com", website: "https://example.com", slug: "Lin Yi" },
    targets: [
      { label: "文字", contentType: "text", text: "hello", img: { width: 800, height: 600 } },
      { label: "照片", contentType: "image", contentName: "p.png", contentMime: "image/png", img: { width: 800, height: 600 } }
    ],
    settings: { position: "below", gapCm: 0.2 },
    mediaPaths: [null, "media/page-2.png"]
  });
  assert.equal(manifest.version, 1);
  assert.equal(manifest.slug, "lin-yi");
  assert.equal(manifest.profile.name, "林一");
  assert.equal(manifest.settings.position, "below");
  assert.equal(manifest.targets[0].markerAspect, 0.75);
  assert.equal(manifest.targets[1].media, "media/page-2.png");
});
```

`tests/viewer-manifest.test.js`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { normalizeManifest } from "../js/viewer/manifest.js";

test("resolves mind and media against card.json URL", () => {
  const result = normalizeManifest({
    version: 1,
    profile: { name: "林一" },
    mind: "card.mind",
    targets: [
      { label: "文字", contentType: "text", text: "hi", markerAspect: 0.75 },
      { label: "照片", contentType: "image", media: "media/page-2.png", markerAspect: 0.75 }
    ]
  }, "https://example.com/cards/lin/card.json");
  assert.equal(result.mindUrl, "https://example.com/cards/lin/card.mind");
  assert.equal(result.targets[1].contentObjectUrl, "https://example.com/cards/lin/media/page-2.png");
  assert.equal(result.settings.position, "above");
});

test("rejects empty targets", () => {
  assert.throws(() => normalizeManifest({ targets: [] }, "https://example.com/card.json"), /沒有卡面資料/);
});
```

`tests/structure.test.js` (no DOM):

```js
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("entry pages have no inline style or script blocks", async () => {
  for (const file of ["index.html", "studio.html", "viewer.html"]) {
    const html = await readFile(file, "utf8");
    assert.equal(/<style[\s>]/i.test(html), false, file + " has inline style");
    assert.equal(/<script(?![^>]*\bsrc=)[^>]*>/i.test(html), false, file + " has inline script");
  }
});
```

Add more checks if needed: no duplicate IDs, every `byId` exists; can use regex. Keep simple to avoid brittle.

**Step 2: Run tests**

```powershell
node --test tests
Get-ChildItem js -Recurse -Filter *.js | ForEach-Object { node --check $_.FullName }
```

**Step 3: README**

Update `README.md`:

- New three entries and URLs.
- Studio flow: profile → targets → settings → compile → share/download.
- Viewer flow: QR → profile → AR.
- Publish: unzip `cards/<slug>/` to site root; URL format.
- Local dev: `python -m http.server 8767`; open `/`, `/studio.html`, `/viewer.html?card=...`.
- Limitations: HTTPS camera; no backend; no privacy for static package.
- File tree includes `js/ar`, `js/studio`, `js/viewer`, `js/shared`, `vendor`.

**Step 4: Browser regression**

Use GPU Chrome (do not use `--disable-gpu`; MindAR needs WebGL):

```powershell
& $chrome --headless=new --remote-debugging-port=9346 `
  --user-data-dir="$env:TEMP/idcard-viewer-chrome" `
  --use-fake-ui-for-media-stream --use-fake-device-for-media-stream `
  --autoplay-policy=no-user-gesture-required --no-sandbox `
  --enable-unsafe-swiftshader --use-gl=angle --use-angle=swiftshader `
  --window-size=430,932 http://127.0.0.1:8767/
```

Checklist:

- Landing: two entries; no A-Frame network.
- Studio: profile save/restore; 1 and 4 target compile; cached `.mind`; all four content types; settings; download zip.
- Viewer: valid package; profile; AR; targetFound/targetLost; dot/touch; back; invalid `?card`; camera error.
- 0 console errors.

**Step 5: Commit**

```powershell
git add -A
git commit -m "test: cover manifests and entry structure"
```

## Task 6: Merge and deploy

**Step 1: Final diff review**

```powershell
git status
git diff main...HEAD --stat
git diff main...HEAD --check
```

**Step 2: Merge**

```powershell
git checkout main
git merge --ff-only feature/viewer-studio-split
git push origin main
```

**Step 3: Verify Pages**

```powershell
Invoke-WebRequest https://yukauchi0v0.github.io/ID-Card/ -UseBasicParsing
Invoke-WebRequest https://yukauchi0v0.github.io/ID-Card/studio.html -UseBasicParsing
Invoke-WebRequest https://yukauchi0v0.github.io/ID-Card/viewer.html -UseBasicParsing
Invoke-WebRequest https://yukauchi0v0.github.io/ID-Card/js/ar/runtime.js -UseBasicParsing
```

Open live landing/studio/viewer; check 0 errors. Deploy a test `cards/demo/` package to verify viewer on Pages, then remove it or keep as demo.

## Acceptance Criteria

- `/` landing with viewer/studio entries.
- `/studio.html` keeps all existing compile/AR functions, adds profile and package download.
- `/viewer.html?card=...` shows profile first, starts AR on demand, returns to profile.
- `card.json` + `card.mind` + `media/` works from a static folder.
- QR points to viewer, not landing.
- `node --test tests` passes; `node --check` passes; browser regression 0 errors.
- No backend, no account, no cross-origin hosting.
