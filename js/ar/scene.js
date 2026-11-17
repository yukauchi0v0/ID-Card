import { TRACKING } from "../config.js";
import { arState } from "./state.js";
import { arDom } from "./dom.js";
import { handleTargetFound, handleTargetLost } from "./content.js";
import { updateHud } from "./hud.js";
import { toast } from "../shared/toast.js";

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

export function mountArScene(imageTargetSrc) {
  const sceneEl = document.createElement("a-scene");
  sceneEl.setAttribute("embedded", "");
  sceneEl.setAttribute("loading-screen", { enabled: false });
  sceneEl.setAttribute("vr-mode-ui", { enabled: false });
  sceneEl.setAttribute("device-orientation-permission-ui", { enabled: false });

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

  const cameraEl = document.createElement("a-camera");
  cameraEl.setAttribute("position", "0 0 0");
  cameraEl.setAttribute("look-controls", { enabled: false });
  cameraEl.setAttribute("wasd-controls", { enabled: false });
  sceneEl.appendChild(cameraEl);

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

  arState.readyTimer = window.setTimeout(() => {
    if (arState.sceneEl !== sceneEl || arState.sceneReady) return;
    if (!arState.cameraError) toast("相機啟動較慢，請檢查權限或返回後重試。", 5200);
    if (!arState.sceneReady && typeof arState.onError === "function") {
      arState.onError(new Error("相機啟動逾時"));
    }
  }, 22000);
}

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
