/**
 * 雲端資料列的純函式測試。
 *
 * 不連線 Supabase、也不碰 DOM：`cloud.js` 只在函式被呼叫時才取 client，
 * 所以這裡可以測「資料怎麼整理」與「上傳上限」。
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  toCardRow,
  coverPath,
  mediaPath,
  publishedPath,
  checkUpload
} from "../js/studio/cloud.js";
import { extensionFor } from "../js/utils/extension.js";
import { UPLOAD_LIMITS } from "../js/config.js";

test("資料列只保留可序列化的 target 欄位", () => {
  const row = toCardRow({
    userId: "u1",
    profile: { name: "林一" },
    settings: { scale: 100 },
    signature: "a.png:10",
    mindPath: "u1/draft/card.mind",
    targets: [
      {
        label: "作品",
        contentType: "image",
        text: "",
        url: "",
        markerAspect: 0.625,
        contentFile: { name: "p.png", type: "image/png" }
      }
    ]
  });
  assert.equal(row.signature, "a.png:10");
  assert.equal(row.mind_path, "u1/draft/card.mind");
  assert.equal(row.targets[0].mediaPath, "u1/draft/media/1.png");
  assert.equal("contentFile" in row.targets[0], false);
});

test("文字頁不會產生 mediaPath", () => {
  const row = toCardRow({
    userId: "u1",
    profile: {},
    settings: {},
    targets: [{ label: "A", contentType: "text", text: "hi", markerAspect: 0.6 }]
  });
  assert.equal(row.targets[0].mediaPath, null);
  assert.equal(row.mind_path, null);
});

test("Storage 路徑都在自己的資料夾底下", () => {
  assert.equal(coverPath("u1", 2), "u1/draft/covers/2.png");
  assert.equal(mediaPath("u1", 3, "mp4"), "u1/draft/media/3.mp4");
  assert.equal(publishedPath("u1", 4, "card.mind"), "u1/published/4/card.mind");
});

test("上傳上限與設計一致", () => {
  assert.equal(UPLOAD_LIMITS.cover, 2097152);
  assert.equal(UPLOAD_LIMITS.photo, 8388608);
  assert.equal(UPLOAD_LIMITS.video, 62914560);
  assert.equal(UPLOAD_LIMITS.pdf, 15728640);
  assert.equal(UPLOAD_LIMITS.card, 157286400);
});

test("超過上限時回傳中文訊息", () => {
  const big = { size: UPLOAD_LIMITS.video + 1 };
  const result = checkUpload("video", big);
  assert.equal(result.ok, false);
  assert.match(result.message, /影片超過 60 MB/);
});

test("總容量超過 150 MB 會被擋下", () => {
  const result = checkUpload("photo", { size: 1024 }, UPLOAD_LIMITS.card);
  assert.equal(result.ok, false);
  assert.match(result.message, /150 MB/);
});

test("容量內回傳 ok", () => {
  assert.deepEqual(checkUpload("cover", { size: 1024 }), { ok: true });
});

test("副檔名優先取檔名，其次看 MIME", () => {
  assert.equal(extensionFor("a/b.PNG", ""), "png");
  assert.equal(extensionFor("photo", "image/jpeg"), "jpg");
  assert.equal(extensionFor("", "video/mp4"), "mp4");
  assert.equal(extensionFor("unknown", ""), "bin");
});

test("卡蓋圖指紋相同輸入得到相同結果", async () => {
  const { signatureOf } = await import("../js/utils/signature.js");
  const targets = [{ file: { name: "a.png", size: 10 } }, { file: { name: "b.png", size: 20 } }];
  assert.equal(signatureOf(targets), "a.png:10|b.png:20");
  assert.equal(signatureOf(targets), signatureOf(targets));
});
