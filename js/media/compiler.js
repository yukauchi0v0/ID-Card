/**
 * MindAR 編譯器的取得與結果統計。
 *
 * 這個小模組刻意隔離 MindAR 的版本差異：頁面同時載入 core ESM 與 A-Frame
 * bundle，兩者都可能提供 Compiler，但只有 bundle 的那份擁有 WebGL 版
 * TensorFlow；拿錯會讓編譯卡在 CPU fallback。
 */

/**
 * 取得可用的 MindAR Compiler 建構子。
 * 優先使用 `js/mindar-bundle-ref.js` 保存的 bundle 參照，再退回全域 MINDAR。
 *
 * @returns {Function|null} Compiler 類別；尚未載入完成時回傳 null。
 */
export function getCompilerClass() {
  // 優先使用 bundle 的參照：它擁有 WebGL-backed TensorFlow。
  // 另外載入的 core ESM 在某些瀏覽器會把 window.MINDAR 換成 CPU-only
  // fallback，導致 BinomialFilter 之類的 WebGL kernel 找不到。
  const bundled = window.__MINDAR_AFRAME_IMAGE__;
  if (bundled && bundled.Compiler) return bundled.Compiler;
  const ns = window.MINDAR || {};
  return (ns.IMAGE && ns.IMAGE.Compiler) || ns.Compiler || null;
}

/**
 * 粗略統計編譯後的特徵點數量，只用來顯示「這張圖好不好辨識」的參考。
 * MindAR 的資料結構是每個 target 有多個 keyframe，每個 keyframe 各有
 * maxima/minima 點；這裡只加總點數，不代表辨識成功率。
 *
 * @param {Array<object>} data MindAR `exportData()` 的結果。
 * @returns {number} 特徵點總數。
 */
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
