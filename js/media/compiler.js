export function getCompilerClass() {
  // Prefer the A-Frame bundle reference captured in js/mindar-bundle-ref.js.
  // It owns the WebGL-backed TensorFlow instance; the separately loaded core
  // ESM can replace window.MINDAR with a CPU-only fallback in some browsers.
  const bundled = window.__MINDAR_AFRAME_IMAGE__;
  if (bundled && bundled.Compiler) return bundled.Compiler;
  const ns = window.MINDAR || {};
  return (ns.IMAGE && ns.IMAGE.Compiler) || ns.Compiler || null;
}

export function countCompiledFeatures(data) {
  let count = 0;
  (data || []).forEach((item) => {
    (item.matchingData || []).forEach((keyframe) => {
      count += keyframe.maximaPoints ? keyframe.maximaPoints.length : 0;
      count += keyframe.minimaPoints ? keyframe.minimaPoints.length : 0;
    });
  });
  return count;
}
