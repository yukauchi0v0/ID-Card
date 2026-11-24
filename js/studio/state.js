/**
 * 製作端專用的可變狀態。
 *
 * AR 執行期有自己的 singleton（`js/ar/state.js`）；這裡只放上傳、編譯、
 * 名片資料與發布相關的狀態。viewer 不會載入這個檔案，也不會共用這裡的
 * 任何資料，避免「製作端暫存」被誤認為「已發布內容」。
 */
import { DEFAULT_PROFILE, DEFAULT_SETTINGS } from "../config.js";

export const studioState = {
  // targets 是目前編輯中的卡蓋頁面；順序就是卡片 1、2、3…
  targets: [],
  adding: false,
  compiling: false,
  restoring: false,

  // mindBlob/mindSignature 是「最近一次編譯」的結果。
  // 發布前會比對 signature，避免把舊的 .mind 搭配新的卡蓋圖發布。
  mindBlob: null,
  mindSignature: "",
  uid: 0,

  profile: { ...DEFAULT_PROFILE, links: [] },
  settings: { ...DEFAULT_SETTINGS }
};
