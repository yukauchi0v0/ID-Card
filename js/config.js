// Application-wide constants. No DOM or runtime side effects belong here.

export const MAX_TARGETS = 8;
export const MAX_TARGET_EDGE = 1024;

export const DB_NAME = "id-card-ar";
export const DB_STORE = "session";
export const DB_KEY = "current";

export const TEX_W = 1024;
export const TEX_H = 512;

export const CARD_W_CM = 8.56;
export const CARD_H_CM = 5.4;
export const CARD_W = 1;
export const CARD_H = CARD_H_CM / CARD_W_CM;

export const FONT_STACK =
  '"PingFang TC","Hiragino Sans CNS","Noto Sans TC","Microsoft JhengHei",' +
  'system-ui,-apple-system,"Segoe UI",sans-serif';

export const TRACKING = {
  stable: { filterMinCF: 0.0005, filterBeta: 100, missTolerance: 12, warmupTolerance: 5 },
  balanced: { filterMinCF: 0.001, filterBeta: 1000, missTolerance: 6, warmupTolerance: 5 },
  responsive: { filterMinCF: 0.004, filterBeta: 1800, missTolerance: 3, warmupTolerance: 3 }
};

export const TYPE_LABELS = {
  text: "平面文字",
  image: "照片 / PNG",
  video: "影片檔案",
  videoLink: "影片連結",
  webpage: "互動網頁",
  pdf: "PDF"
};

export const PANEL_TYPES = new Set(["videoLink", "webpage", "pdf"]);

export const TEXT_PALETTES = [
  { accent: "#99ddcc", soft: "#eaf9f4" },
  { accent: "#bad7df", soft: "#eef7fa" },
  { accent: "#ffe2e2", soft: "#fff3f3" }
];

export const DEFAULT_TEXT =
  "姓名 / 職稱 / 技能 / 簡介\n" +
  "在這裡填寫這一頁要顯示的文字。\n" +
  "卡蓋圖案只負責觸發，內容和圖案外觀無關。";

export const DEFAULT_SETTINGS = {
  position: "above",
  gapCm: 0.45,
  offsetXCm: 0,
  offsetYCm: 0,
  scale: 1,
  orientation: "flat",
  stability: "stable"
};

export const DEFAULT_PROFILE = {
  name: "",
  title: "",
  company: "",
  phone: "",
  email: "",
  website: "",
  slug: ""
};

export const CONTENT_FILE_LIMITS = {
  video: 100 * 1024 * 1024,
  pdf: 40 * 1024 * 1024,
  image: 25 * 1024 * 1024
};
