/**
 * 觀看端 DOM 參照。
 *
 * 這裡的 id 都必須存在於 `viewer.html`；缺任何一個就在載入時 throw，
 * 讓錯誤早點浮現，而不是等到某個事件才出現 undefined。
 */
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

  // 聯絡區（看完 AR 後才顯示）：社群按鈕、儲存名片、分享名片。
  contact: byId("viewerContact"),
  links: byId("viewerLinks"),
  actions: byId("viewerActions"),
  saveBtn: byId("viewerSaveBtn"),
  shareBtn: byId("viewerShareBtn"),
  shareTip: byId("viewerShareTip"),

  error: byId("viewerError"),
  errorMsg: byId("viewerErrorMsg"),
  loading: byId("viewerLoading")
};
