/**
 * AR 場景的建立、追蹤事件與拆除。
 *
 * 這裡是整套 AR 最貼近 A-Frame / MindAR 的地方：動態建立 `<a-scene>`、
 * 為每個卡蓋建立 anchor/plane，並把 MindAR 的 targetFound/Lost 接到
 * `content.js`。UI 與頁面狀態不放這裡，避免場景程式碼越長越難維護。
 *
 * 座標約定：MindAR 的 target 寬度是 1，卡片本身是 1 × CARD_H；
 * 內容平面的位置由 `content.js` 的 layoutCard() 計算。
 */
import { TRACKING } from "../config.js";
import { arState } from "./state.js";
import { arDom } from "./dom.js";
import { handleTargetFound, handleTargetLost } from "./content.js";
import { updateHud } from "./hud.js";
import { toast } from "../shared/toast.js";

// 自訂 A-Frame component：讓內容平面永遠面向相機。
// 只補償「父層 anchor 的旋轉」，不改變 anchor 的位置，所以卡片仍貼在
// 卡蓋上，內容則像立牌一樣轉向使用者。
if (window.AFRAME) {
  window.AFRAME.registerComponent("billboard-content", {
    tick: function () {
      const scene = this.el.sceneEl;
      const camera = scene && scene.camera;
      if (!camera || !this.el.object3D.parent) return;
      const THREE = window.AFRAME.THREE;
      const parentQ = new THREE.Quaternion();
      const camQ = new THREE.Quaternion();
      this.el.object3D.parent.getWorldQuaternion(parentQ);
      camera.getWorldQuaternion(camQ);
      this.el.object3D.quaternion.copy(parentQ.invert().multiply(camQ));
    }
  });
}

/**
 * 建立並掛載 AR 場景。
 *
 * 呼叫前必須先設定好 `arState.targets` 與 `arState.settings`；函式會同步
 * 建立 scene，之後非同步等待 MindAR 的 `arReady` / `arError`。
 *
 * @param {string} imageTargetSrc 編譯後的 `.mind` Blob URL。
 */
export function mountArScene(imageTargetSrc) {
  const sceneEl = document.createElement("a-scene");
  // embedded：不要讓 A-Frame 自己產生全螢幕樣式；外層由 #arRoot 控制。
  sceneEl.setAttribute("embedded", "");
  sceneEl.setAttribute("loading-screen", { enabled: false });
  sceneEl.setAttribute("vr-mode-ui", { enabled: false });
  sceneEl.setAttribute("device-orientation-permission-ui", { enabled: false });

  // 追蹤參數來自設定頁；找不到 preset 時退回 stable，避免整頁壞掉。
  const track = TRACKING[arState.settings.stability] || TRACKING.stable;
  sceneEl.setAttribute("mindar-image", {
    imageTargetSrc,
    maxTrack: 1,
    autoStart: true,
    uiLoading: "no",
    uiScanning: "no",
    uiError: "no",
    filterMinCF: track.filterMinCF,
    filterBeta: track.filterBeta,
    missTolerance: track.missTolerance,
    warmupTolerance: track.warmupTolerance
  });

  // 關掉 A-Frame 內建的 look/wasd controls：手機 AR 只靠 MindAR 的
  // 相機矩陣，不需要使用者用滑鼠拖動視角。
  const cameraEl = document.createElement("a-camera");
  cameraEl.setAttribute("position", "0 0 0");
  cameraEl.setAttribute("look-controls", { enabled: false });
  cameraEl.setAttribute("wasd-controls", { enabled: false });
  sceneEl.appendChild(cameraEl);

  // 每個 target 一組 anchor → root → frame/media plane。
  // anchor 由 MindAR 控制位置；root 由 layoutCard() 控制內容位置。
  const cards = [];
  arState.targets.forEach((target, index) => {
    const anchorEl = document.createElement("a-entity");
    anchorEl.setAttribute("mindar-image-target", { targetIndex: index });

    const rootEl = document.createElement("a-entity");
    rootEl.setAttribute("position", "0 0 0");
    if (arState.settings.orientation === "billboard") rootEl.setAttribute("billboard-content", "");
    rootEl.setAttribute("visible", false);

    const frameEl = document.createElement("a-plane");
    frameEl.setAttribute("width", 0.85);
    frameEl.setAttribute("height", 0.45);
    frameEl.setAttribute("position", "0 0 -0.006");
    frameEl.setAttribute("material", "shader: flat; side: double; color: #f6f6f6; transparent: true; opacity: 0.96");
    frameEl.setAttribute("visible", false);

    const mediaEl = document.createElement("a-plane");
    mediaEl.setAttribute("width", 0.82);
    mediaEl.setAttribute("height", 0.41);
    mediaEl.setAttribute("material", "shader: flat; side: double; color: #ffffff; transparent: true; opacity: 1");
    mediaEl.setAttribute("visible", false);

    rootEl.appendChild(frameEl);
    rootEl.appendChild(mediaEl);
    anchorEl.appendChild(rootEl);
    sceneEl.appendChild(anchorEl);

    const card = {
      index,
      target,
      anchorEl,
      rootEl,
      frameEl,
      mediaEl,
      mediaMesh: null,
      frameMesh: null
    };

    // A-Frame 的 mesh 是非同步建立的；object3dset / loaded 都可能比
    // 這裡晚發生，所以 attach 會重複呼叫，已設定過的欄位會覆蓋成同一份。
    const attach = () => {
      const mediaMesh = mediaEl.getObject3D("mesh");
      const frameMesh = frameEl.getObject3D("mesh");
      if (mediaMesh) {
        card.mediaMesh = mediaMesh;
        mediaMesh.frustumCulled = false;
        mediaMesh.material.toneMapped = false;
        if (card.currentMedia && card.currentMedia.texture) {
          mediaMesh.material.map = card.currentMedia.texture;
          mediaMesh.material.needsUpdate = true;
        }
      }
      if (frameMesh) {
        card.frameMesh = frameMesh;
        frameMesh.frustumCulled = false;
      }
    };

    mediaEl.addEventListener("object3dset", (event) => {
      if (event.detail && event.detail.type === "mesh") attach();
    });
    frameEl.addEventListener("object3dset", (event) => {
      if (event.detail && event.detail.type === "mesh") attach();
    });
    mediaEl.addEventListener("loaded", attach);
    frameEl.addEventListener("loaded", attach);

    anchorEl.addEventListener("targetFound", () => {
      if (arState.sceneEl === sceneEl) handleTargetFound(index);
    });
    anchorEl.addEventListener("targetLost", () => {
      if (arState.sceneEl === sceneEl) handleTargetLost(index);
    });

    cards.push(card);
  });

  // 等 renderer 啟動後才能查詢最大 anisotropy；提高紋理銳利度，
  // 但上限 8 是行動 GPU 與效能之間的折衷。
  sceneEl.addEventListener("renderstart", () => {
    const renderer = sceneEl.renderer;
    const max = renderer && renderer.capabilities ? renderer.capabilities.getMaxAnisotropy() : 1;
    arState.targets.forEach((target) => {
      const textures = [target._textTexture, target._imageTexture, target._videoTexture].filter(Boolean);
      textures.forEach((texture) => {
        texture.anisotropy = Math.min(8, max || 1);
        texture.needsUpdate = true;
      });
    });
  }, { once: true });

  // arReady 代表相機與 MindAR 已啟動；此時才收掉宿主的載入遮罩。
  // 仍然可能還沒掃到卡蓋，所以 HUD 會顯示「掃描中」。
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

  // 相機錯誤（權限、HTTPS、裝置不支援）要留在 AR 圖層內顯示，
  // 而不是退回宿主頁面；由 onError 讓宿主收掉自己的 loading。
  sceneEl.addEventListener("arError", (event) => {
    if (arState.sceneEl !== sceneEl) return;
    console.error("[ID Card] 相機錯誤", event && event.detail);
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

  arState.cards = cards;
  arState.sceneEl = sceneEl;
  arState.sceneReady = false;
  arDom.arRoot.replaceChildren(sceneEl);

  // MindAR 的 _resize() 在相機尚未拿到畫面時可能讀到 null video；
  // 這裡包一層守衛，避免行動瀏覽器在切換前景/背景時噴錯。
  const applyResizeGuard = () => {
    const system = sceneEl.systems && sceneEl.systems["mindar-image-system"];
    if (!system || system.__resizeGuarded || typeof system._resize !== "function") return;
    const original = system._resize;
    system.__resizeGuarded = true;
    system._resize = function () {
      if (!this.video || !this.video.videoWidth || !this.controller) return;
      return original.apply(this, arguments);
    };
  };
  applyResizeGuard();
  sceneEl.addEventListener("loaded", applyResizeGuard, { once: true });
  window.setTimeout(applyResizeGuard, 0);

  // 22 秒是實務上相機權限/初始化可能卡住的界線；逾時後顯示錯誤卡，
  // 並通知宿主收掉載入遮罩。若期間已 ready，這個 timer 會被清掉。
  arState.readyTimer = window.setTimeout(() => {
    if (arState.sceneEl !== sceneEl || arState.sceneReady || arState.cameraError) return;
    arState.cameraError = true;
    toast("相機啟動較慢，請檢查權限或返回後重試。", 5200);
    arDom.errorPanel.hidden = false;
    updateHud();
    if (typeof arState.onError === "function") {
      arState.onError(new Error("相機啟動逾時"));
    }
  }, 22000);
}

/**
 * 拆除 scene 並停止相機。
 *
 * 不直接呼叫 MindAR 的 stop()，而是手動停掉 video tracks、dispose controller，
 * 再把 scene 從 DOM 移除；這樣可同時處理「正常返回」與「初始化到一半失敗」
 * 兩種情況，且不會留下仍開著的相機。
 */
export function teardownScene() {
  const sceneEl = arState.sceneEl;
  if (!sceneEl) { arDom.arRoot.replaceChildren(); return; }
  const system = sceneEl.systems && sceneEl.systems["mindar-image-system"];
  if (system) {
    try {
      if (system.video) {
        const video = system.video;
        try { video.pause(); } catch (err) { /* noop */ }
        if (video.srcObject) {
          video.srcObject.getTracks().forEach((track) => track.stop());
          video.srcObject = null;
        }
        if (video.parentNode) video.parentNode.removeChild(video);
        system.video = null;
      }
    } catch (err) { console.warn("[ID Card] 停止相機失敗", err); }
    try { if (system.controller) system.controller.dispose(); } catch (err) { /* noop */ }
    system.stop = function () {};
  }
  try { if (sceneEl.parentNode) sceneEl.parentNode.removeChild(sceneEl); } catch (err) { /* noop */ }
  arDom.arRoot.replaceChildren();
}
