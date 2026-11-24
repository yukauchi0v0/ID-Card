/**
 * 雲端存檔與發布：把製作端的草稿、卡蓋圖、內容檔與編譯結果放進 Supabase。
 *
 * 分工：
 * - `cards` 表存一份「草稿」（profile / settings / targets / 目前簽章）。
 * - Storage 的 `{userId}/draft/` 放草稿用到的檔案。
 * - 發布時另外寫一份不可變的快照到 `{userId}/published/{version}/`，
 *   並在 `card_versions` 留下當時的 manifest；viewer 只讀快照。
 *
 * 這樣「草稿」可以一直改，而已經公開的網址內容不會在對方看的時候改變。
 */
import { getClient } from "../shared/supabase.js";
import { UPLOAD_LIMITS } from "../config.js";
import { markerAspect } from "./manifest.js";
import { signatureOf } from "../utils/signature.js";

const BUCKET = "card-assets";
const NO_CLOUD = "雲端服務未載入，請重新整理頁面。";

/** 取得 client，未載入時丟出可讀錯誤。 */
function client() {
  const c = getClient();
  if (!c) throw new Error(NO_CLOUD);
  return c;
}

/** 把 Supabase error 轉成中文訊息。 */
function fail(prefix, error) {
  const message = error && error.message ? error.message : "未知錯誤";
  return new Error(prefix + "：" + message);
}

/** 從檔名或 MIME 推斷副檔名；推不出來時回 "bin"。 */
export function extensionFor(name, mime) {
  const match = /\.([a-z0-9]{2,5})$/i.exec(String(name || ""));
  if (match) return match[1].toLowerCase();
  const byMime = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
    "image/gif": "gif",
    "video/mp4": "mp4",
    "video/webm": "webm",
    "application/pdf": "pdf"
  };
  return byMime[mime] || "bin";
}

/**
 * 卡的草稿檔案路徑。
 * @param {string} userId
 * @param {number} index 第幾頁（1 開始）
 */
export function coverPath(userId, index) {
  return userId + "/draft/covers/" + index + ".png";
}

/**
 * 內容檔的路徑（圖片/影片/PDF）。
 * @param {string} userId
 * @param {number} index 第幾頁（1 開始）
 * @param {string} ext 副檔名
 */
export function mediaPath(userId, index, ext) {
  return userId + "/draft/media/" + index + "." + ext;
}

/** 已發布快照的存放位置。 */
export function publishedPath(userId, version, file) {
  return userId + "/published/" + version + "/" + file;
}

/**
 * 把 target 轉成可存進資料庫的純資料（去掉 Blob/File）。
 *
 * mediaPath 必須由呼叫端先算好（需要 userId 與頁碼），因為這裡
 * 只是在描述「這一頁要指向哪個檔案」。
 */
function toStoredTarget(target, index, userId) {
  const file = target.contentFile || null;
  const stored = {
    label: target.label || "內容 " + index,
    contentType: target.contentType,
    text: target.text || "",
    url: target.url || "",
    markerAspect: markerAspect(target),
    mediaPath: null,
    mediaName: file ? file.name || "" : "",
    mediaMime: file ? file.type || "" : ""
  };
  if (file) {
    stored.mediaPath = mediaPath(userId, index, extensionFor(file.name, file.type));
  }
  return stored;
}

/**
 * 產生要寫進 `cards` 的資料列。
 *
 * @param {object} options
 * @param {string} options.userId
 * @param {object} options.profile
 * @param {object} options.settings
 * @param {Array<object>} options.targets
 * @param {string} [options.signature]
 * @param {string} [options.mindPath]
 * @returns {{profile: object, settings: object, targets: Array<object>, signature: string, mind_path: string|null}}
 */
export function toCardRow({ userId, profile, settings, targets, signature = "", mindPath = null }) {
  return {
    profile: {
      name: profile.name || "",
      title: profile.title || "",
      company: profile.company || "",
      phone: profile.phone || "",
      email: profile.email || "",
      website: profile.website || ""
    },
    settings: Object.assign({}, settings || {}),
    targets: targets.map((target, index) => toStoredTarget(target, index + 1, userId)),
    signature,
    mind_path: mindPath
  };
}

/**
 * 檢查單一檔案是否超過上限，以及名片總容量是否爆掉。
 *
 * @param {"cover"|"photo"|"video"|"pdf"} kind
 * @param {File} file
 * @param {number} [usedBytes] 目前這張名片已使用的位元組
 * @returns {{ok: true} | {ok: false, message: string}}
 */
export function checkUpload(kind, file, usedBytes = 0) {
  const limit = UPLOAD_LIMITS[kind];
  const size = Number(file && file.size) || 0;
  if (limit && size > limit) {
    const mb = Math.round(limit / 1024 / 1024);
    const labels = { cover: "卡蓋圖", photo: "照片", video: "影片", pdf: "PDF" };
    const hint = kind === "video" ? "，請改用 YouTube 連結。" : "。";
    return { ok: false, message: (labels[kind] || "檔案") + "超過 " + mb + " MB" + hint };
  }
  if (usedBytes + size > UPLOAD_LIMITS.card) {
    return {
      ok: false,
      message: "這張名片已超過 150 MB 上限，請移除內容或改用連結。"
    };
  }
  return { ok: true };
}

/** 上傳單一檔案（已存在就覆蓋）。 */
async function upload(path, blob, contentType) {
  const { error } = await client()
    .storage.from(BUCKET)
    .upload(path, blob, { upsert: true, contentType: contentType || "application/octet-stream" });
  if (error) throw fail("上傳檔案失敗", error);
}

/** 下載單一檔案；不存在時回傳 null。 */
async function download(path) {
  const { data, error } = await client().storage.from(BUCKET).download(path);
  if (error) {
    if (/not\s*found|404/i.test(error.message || "")) return null;
    throw fail("下載檔案失敗", error);
  }
  return data;
}

/**
 * 儲存草稿。
 *
 * `changed` 讓呼叫端只上傳「這次改動」的檔案，避免每次存檔都重傳
 * 幾十 MB 的影片。
 *
 * @param {object} options
 * @param {string} options.userId
 * @param {object} options.profile
 * @param {object} options.settings
 * @param {Array<object>} options.targets
 * @param {Blob|null} [options.mindBlob] 已編譯的 .mind（可為 null）
 * @param {string} [options.signature] 卡蓋圖簽章
 * @param {{covers?: number[], media?: number[], mind?: boolean}} [options.changed]
 * @returns {Promise<object>} 寫入後的 cards 資料列
 */
export async function saveDraft({ userId, profile, settings, targets, mindBlob = null, signature = "", changed = {} }) {
  const coverIdx = new Set(changed.covers || []);
  const mediaIdx = new Set(changed.media || []);

  for (const index of coverIdx) {
    const target = targets[index - 1];
    const image = target && target.img;
    if (!image) continue;
    const blob = await new Promise((resolve) => {
      if (image.toBlob) image.toBlob(resolve, "image/png");
      else resolve(null);
    });
    if (blob) await upload(coverPath(userId, index), blob, "image/png");
  }

  for (const index of mediaIdx) {
    const target = targets[index - 1];
    const file = target && target.contentFile;
    if (!file) continue;
    await upload(
      mediaPath(userId, index, extensionFor(file.name, file.type)),
      file,
      file.type || "application/octet-stream"
    );
  }

  let mindPath = null;
  if (mindBlob && changed.mind) {
    mindPath = publishedPath(userId, "draft", "card.mind");
    await upload(mindPath, mindBlob, "application/octet-stream");
  }

  const row = toCardRow({ userId, profile, settings, targets, signature, mindPath });
  const existing = await client().from("cards").select("mind_path").eq("user_id", userId).maybeSingle();
  if (existing.error) throw fail("讀取草稿失敗", existing.error);
  if (!mindPath && existing.data && existing.data.mind_path) row.mind_path = existing.data.mind_path;

  const { data, error } = await client()
    .from("cards")
    .upsert(Object.assign({ user_id: userId, updated_at: new Date().toISOString() }, row), { onConflict: "user_id" })
    .select()
    .single();
  if (error) throw fail("儲存草稿失敗", error);
  return data;
}

/**
 * 讀取草稿（含檔案）。
 *
 * @param {string} userId
 * @returns {Promise<null|{row: object, mindBlob: Blob|null, coverBlobs: Array<{index:number, blob:Blob}>, mediaBlobs: Array<{index:number, blob:Blob}>}>}
 */
export async function loadDraft(userId) {
  const { data: row, error } = await client().from("cards").select().eq("user_id", userId).maybeSingle();
  if (error) throw fail("讀取草稿失敗", error);
  if (!row) return null;

  const mindBlob = row.mind_path ? await download(row.mind_path) : null;
  const coverBlobs = [];
  const mediaBlobs = [];
  for (let i = 0; i < row.targets.length; i += 1) {
    const index = i + 1;
    const cover = await download(coverPath(userId, index));
    if (cover) coverBlobs.push({ index, blob: cover });
    const path = row.targets[i].mediaPath;
    if (path) {
      const blob = await download(path);
      if (blob) mediaBlobs.push({ index, blob });
    }
  }
  return { row, mindBlob, coverBlobs, mediaBlobs };
}

/**
 * 取得（必要時建立）自己的 profile：顯示名稱與固定不變的名片代碼。
 * @returns {Promise<{displayName: string, cardCode: string}>}
 */
export async function getMyProfile() {
  const { data, error } = await client().rpc("ensure_profile");
  if (error) throw fail("取得名片代碼失敗", error);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error("取得名片代碼失敗：沒有回傳資料。");
  return { displayName: row.display_name || "", cardCode: row.card_code };
}

/**
 * 更新顯示名稱。名片代碼不會跟著改，網址永遠不變。
 * @param {string} displayName
 */
export async function updateDisplayName(displayName) {
  const { error } = await client()
    .from("profiles")
    .update({ display_name: displayName.trim() })
    .eq("id", (await client().auth.getUser()).data.user.id);
  if (error) throw fail("更新顯示名稱失敗", error);
}

/** 已發布版本的公開網址（Storage public URL）。 */
function publicUrl(path) {
  return client().storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

/**
 * 發布目前內容：把 .mind 與內容檔複製成一份新版本，並寫入 `card_versions`。
 *
 * 只有「已經存在」的草稿檔案會被複製（Storage 沒有伺服器端複製 API，
 * 這裡先下載再上傳）。沒有編譯結果時直接擋下，避免發布出打不開的名片。
 *
 * @param {object} options
 * @param {string} options.userId
 * @param {object} options.profile
 * @param {object} options.settings
 * @param {Array<object>} options.targets
 * @param {Blob|null} options.mindBlob
 * @param {string} [options.mindSignature]
 * @returns {Promise<{version: number, code: string, publicUrl: string}>}
 */
export async function publishCard({ userId, profile, settings, targets, mindBlob, mindSignature = "" }) {
  if (!mindBlob) throw new Error("請先編譯名片，再發布。");

  const { data: card, error: cardError } = await client()
    .from("cards")
    .select("id, published_version_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (cardError) throw fail("讀取名片失敗", cardError);
  if (!card) throw new Error("找不到這張名片的草稿，請先存到雲端。");

  const { data: latest, error: versionError } = await client()
    .from("card_versions")
    .select("version")
    .eq("card_id", card.id)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (versionError) throw fail("讀取版本失敗", versionError);
  const version = (latest ? latest.version : 0) + 1;

  const mindFile = "card.mind";
  await upload(publishedPath(userId, version, mindFile), mindBlob, "application/octet-stream");

  const publicTargets = [];
  for (let i = 0; i < targets.length; i += 1) {
    const target = targets[i];
    const stored = toStoredTarget(target, i + 1, userId);
    const page = {
      label: stored.label,
      contentType: stored.contentType,
      text: stored.text,
      url: stored.url,
      markerAspect: stored.markerAspect
    };
    if (stored.mediaPath) {
      const file = target.contentFile;
      const ext = extensionFor(file.name, file.type);
      const name = "media-" + (i + 1) + "." + ext;
      await upload(publishedPath(userId, version, name), file, file.type || "application/octet-stream");
      page.media = publicUrl(publishedPath(userId, version, name));
      page.mediaName = stored.mediaName;
      page.mediaMime = stored.mediaMime;
    }
    publicTargets.push(page);
  }

  const manifest = {
    version: 1,
    slug: (profile.name || "card").trim(),
    profile: {
      name: profile.name || "",
      title: profile.title || "",
      company: profile.company || "",
      phone: profile.phone || "",
      email: profile.email || "",
      website: profile.website || ""
    },
    settings: Object.assign({}, settings || {}),
    mind: publicUrl(publishedPath(userId, version, mindFile)),
    targets: publicTargets,
    signature: mindSignature || signatureOf(targets)
  };

  const { data: inserted, error: insertError } = await client()
    .from("card_versions")
    .insert({ card_id: card.id, version, manifest, published_at: new Date().toISOString() })
    .select("id, version")
    .single();
  if (insertError) throw fail("寫入版本失敗", insertError);

  const { error: updateError } = await client()
    .from("cards")
    .update({ published_version_id: inserted.id })
    .eq("id", card.id);
  if (updateError) throw fail("更新發布狀態失敗", updateError);

  const me = await getMyProfile();
  return {
    version: inserted.version,
    code: me.cardCode,
    publicUrl: "viewer.html?card=" + me.cardCode
  };
}
