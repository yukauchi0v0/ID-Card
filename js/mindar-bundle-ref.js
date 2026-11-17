// MindAR 1.2.2's A-Frame bundle is self-contained and exposes the WebGL-backed
// compiler. The ESM core file is also loaded for stack parity, but because it
// runs later it replaces window.MINDAR. Keep the bundle's namespace first.
window.__MINDAR_AFRAME_IMAGE__ = window.MINDAR && window.MINDAR.IMAGE;
