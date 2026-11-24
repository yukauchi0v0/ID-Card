import { DEFAULT_SETTINGS } from "../config.js";

/**
 * 單一 AR session 的共用狀態。
 *
 * 一個頁面一次只會有一個 AR 場景，所以這裡用 singleton，而不是把狀態
 * 一層層傳進每個函式。studio 與 viewer 都使用這份狀態；但製作端的
 * 上傳、名片資料、發布等狀態仍留在 `js/studio/state.js`，兩者不要混用。
 *
 * 欄位分成三組：
 * 1. 場景與追蹤：targets / sceneEl / sceneReady / mindUrl / cards / activeTarget。
 * 2. 畫面與互動：currentPage / interactive / everFound / panelOpen / activeVideo。
 * 3. 生命週期：renderToken（避免非同步渲染競態）、readyTimer、wakeLock、
 *    onReady / onError（由宿主頁面提供，用來收掉載入遮罩或顯示錯誤）。
 */
export const arState = {
  // 這一輪 AR 要顯示的卡蓋資料；viewer 從 manifest 來，studio 從上傳清單來。
  targets: [],
  settings: { ...DEFAULT_SETTINGS },

  // 場景本身。sceneEl 是動態建立的 <a-scene>，sceneReady 代表相機與
  // MindAR system 已啟動；mindUrl 是 Blob URL，停止 AR 時要 revoke。
  sceneEl: null,
  sceneReady: false,
  mindUrl: null,
  cards: [],

  // 目前鎖定的卡蓋與頁面。activeTarget 是 targets 的索引，-1 表示沒鎖定。
  activeTarget: -1,
  activeCard: null,
  currentPage: 0,
  interactive: false,
  everFound: false,
  cameraError: false,

  // 內容面板與影片。panelPage 是面板目前顯示的頁碼，-1 表示沒開。
  panelOpen: false,
  panelPage: -1,
  activeVideo: null,
  videoMuted: true,

  // renderToken 每次換頁/重設都遞增；非同步的材質載入完成後若 token
  // 已改變，就放棄舊結果，避免快速換頁時舊圖片蓋掉新頁面。
  renderToken: 0,
  readyTimer: null,
  wakeLock: null,

  // 由宿主頁面（studio/viewer）注入；AR 核心不直接操作它們的 UI。
  onReady: null,
  onError: null,

  // 目前是哪個入口在跑 AR（"studio" 或 "viewer"）。viewer 會在 HUD 多顯示
  // 一顆「看完了？聯絡我」按鈕，studio 不需要。
  host: ""
};
