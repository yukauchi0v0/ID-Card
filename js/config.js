/**
 * 全站共用常數。
 *
 * 這個檔案刻意只放「資料」與「預設值」，不碰 DOM、不初始化任何東西；
 * 製作端（studio）與觀看端（viewer）都從這裡取得同一套規則，避免兩邊
 * 對卡片尺寸、內容型態或追蹤參數有不同的認知。
 */

// 卡蓋圖案數量與編譯前縮圖的最長邊上限。
// 8 張是介面與行動裝置記憶體都能接受的實務上限。

export const MAX_TARGETS = 8;
export const MAX_TARGET_EDGE = 1024;

// 本機暫存的 IndexedDB 名稱；「清除本機紀錄」會整個刪掉這個資料庫。
// 只存在使用者自己的瀏覽器，不會上傳到伺服器。
export const DB_NAME = "id-card-ar";
export const DB_STORE = "session";
export const DB_KEY = "current";

// 平面文字內容的 canvas 材質尺寸。固定 2:1，讓文字卡在 AR 裡不會被拉伸。
export const TEX_W = 1024;
export const TEX_H = 512;

// 標準卡片比例（85.6mm × 54mm）。AR 內以 CARD_W = 1 為基準，
// 其他尺寸都用比例換算，之後改卡片大小時只要動這兩個公分值。
export const CARD_W_CM = 8.56;
export const CARD_H_CM = 5.4;
export const CARD_W = 1;
export const CARD_H = CARD_H_CM / CARD_W_CM;

// 以繁體中文優先的字型堆疊：macOS/iOS 用 PingFang，Windows 用 JhengHei，
// 最後才退回系統 sans-serif，避免中文落到襯線字型。
export const FONT_STACK =
  '"PingFang TC","Hiragino Sans CNS","Noto Sans TC","Microsoft JhengHei",' +
  'system-ui,-apple-system,"Segoe UI",sans-serif';

// MindAR 追蹤參數。數字不是愈高愈好：
// - filterMinCF/filterBeta 影響平滑與跟隨速度的取捨。
// - missTolerance 是「連續幾幀沒看到才判定離開」，太低會一直閃斷。
// - warmupTolerance 是啟動後先容忍幾幀，避免相機一開就誤判。
// stable 適合手會抖的場合；responsive 留給需要快速跟隨的測試。
export const TRACKING = {
  stable: { filterMinCF: 0.0005, filterBeta: 100, missTolerance: 12, warmupTolerance: 5 },
  balanced: { filterMinCF: 0.001, filterBeta: 1000, missTolerance: 6, warmupTolerance: 5 },
  responsive: { filterMinCF: 0.004, filterBeta: 1800, missTolerance: 3, warmupTolerance: 3 }
};

// 內容型態的顯示名稱。新增型態時要同步更新這裡、PANEL_TYPES 與
// `js/studio/ui/targets.js` 的編輯器，否則 UI 會出現空白選項。
export const TYPE_LABELS = {
  text: "平面文字",
  image: "照片 / PNG",
  video: "影片檔案",
  videoLink: "影片連結",
  webpage: "互動網頁",
  pdf: "PDF"
};

// 這幾種內容不是貼在 AR 平面上的材質，而是另外開底部內容面板；
// 判斷「要不要顯示開啟面板按鈕」時會用到。
export const PANEL_TYPES = new Set(["videoLink", "webpage", "pdf"]);

// 平面文字卡片的三組配色，依頁碼循環使用；不改使用者上傳的圖片。
export const TEXT_PALETTES = [
  { accent: "#99ddcc", soft: "#eaf9f4" },
  { accent: "#bad7df", soft: "#eef7fa" },
  { accent: "#ffe2e2", soft: "#fff3f3" }
];

// 新增文字頁時的起點；讓朋友第一次開啟就知道每個區塊要填什麼。
export const DEFAULT_TEXT =
  "姓名 / 職稱 / 技能 / 簡介\n" +
  "在這裡填寫這一頁要顯示的文字。\n" +
  "卡蓋圖案只負責觸發，內容和圖案外觀無關。";

// AR 內容的預設位置：卡片上方、留 0.45cm、平放、穩定追蹤。
// 這些值會寫進發布包，viewer 不需要再問使用者一次。
export const DEFAULT_SETTINGS = {
  position: "above",
  gapCm: 0.45,
  offsetXCm: 0,
  offsetYCm: 0,
  scale: 1,
  orientation: "flat",
  stability: "stable"
};

// 名片資料的空白預設值。slug 故意留空，讓 `slugify` 在第一次儲存時
// 依姓名或使用者輸入產生；不是每個人都會自己取網址代稱。
// links 是名片上的社群聯絡方式（`[{ platform, account }]`），預設不勾選。
export const DEFAULT_PROFILE = {
  name: "",
  title: "",
  company: "",
  phone: "",
  email: "",
  website: "",
  slug: "",
  links: []
};

// 名片上的社群平台。
// - `httpPrefix` 讓「只填帳號」也能組成合法網址（空字串代表必須貼完整網址）。
// - `match` 只做文件用途，說明這個平台通常對應哪個網域。
// 新增平台時只要加在這裡，製作端的勾選列與觀看端的按鈕都會自動出現。
export const SOCIAL_PLATFORMS = [
  { id: "line", label: "LINE", placeholder: "LINE ID 或加好友連結", httpPrefix: "https://line.me/R/ti/p/~" },
  { id: "instagram", label: "Instagram", placeholder: "帳號或網址", match: ["instagram.com"], httpPrefix: "https://instagram.com/" },
  { id: "threads", label: "Threads", placeholder: "帳號或網址", match: ["threads.net"], httpPrefix: "https://threads.net/@" },
  { id: "facebook", label: "Facebook", placeholder: "帳號或網址", match: ["facebook.com"], httpPrefix: "https://facebook.com/" },
  { id: "x", label: "X", placeholder: "帳號或網址", match: ["x.com", "twitter.com"], httpPrefix: "https://x.com/" },
  { id: "linkedin", label: "LinkedIn", placeholder: "帳號或網址", match: ["linkedin.com"], httpPrefix: "https://linkedin.com/in/" },
  { id: "github", label: "GitHub", placeholder: "帳號或網址", match: ["github.com"], httpPrefix: "https://github.com/" },
  { id: "custom", label: "其他網站", placeholder: "完整網址 https://", httpPrefix: "" }
];

// 內容檔案大小上限（bytes）。這些是「單一檔案」限制，不是總容量；
// 超過時在選檔階段就擋下，避免編譯到一半才失敗。
export const CONTENT_FILE_LIMITS = {
  video: 100 * 1024 * 1024,
  pdf: 40 * 1024 * 1024,
  image: 25 * 1024 * 1024
};

// 雲端存檔的上傳上限（bytes）。刻意比本機限制更嚴，因為這些檔案要
// 放在 Supabase Storage（免費方案總共 1 GB），而且對方播放影片時
// 也吃流量。上傳前先用 `checkUpload()` 在瀏覽器擋一次。
export const UPLOAD_LIMITS = {
  cover: 2 * 1024 * 1024,
  photo: 8 * 1024 * 1024,
  video: 60 * 1024 * 1024,
  pdf: 15 * 1024 * 1024,
  card: 150 * 1024 * 1024
};
