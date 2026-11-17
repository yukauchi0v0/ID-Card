/**
 * viewer manifest 正規化測試。
 *
 * 這些測試直接餵 raw JSON，確保相對路徑解析、預設值與錯誤訊息符合
 * viewer 的預期；不需要真的 fetch 或開相機。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { normalizeManifest } from "../js/viewer/manifest.js";

// card.mind 與 media/ 都必須以 card.json 的 URL 為基準解析。
test("resolves mind and media against card.json URL", () => {
  const result = normalizeManifest({
    version: 1,
    profile: { name: "林一" },
    mind: "card.mind",
    targets: [
      { label: "文字", contentType: "text", text: "hi", markerAspect: 0.75 },
      { label: "照片", contentType: "image", media: "media/page-2.png", markerAspect: 0.75 }
    ]
  }, "https://example.com/cards/lin/card.json");
  assert.equal(result.mindUrl, "https://example.com/cards/lin/card.mind");
  assert.equal(result.targets[1].contentObjectUrl, "https://example.com/cards/lin/media/page-2.png");
  assert.equal(result.settings.position, "above");
});

// 沒有 targets 的卡片不能進入 AR，應在載入階段就擋下。
test("rejects empty targets", () => {
  assert.throws(() => normalizeManifest({ targets: [] }, "https://example.com/card.json"), /沒有卡面資料/);
});

// 圖片頁沒有 media 就沒有東西可顯示，屬於發布包損壞。
test("rejects image targets without media", () => {
  assert.throws(() => normalizeManifest({
    targets: [{ label: "照片", contentType: "image" }]
  }, "https://example.com/card.json"), /缺少 media/);
});

// webpage 只接受 http(s)；ftp/javascript 等 scheme 一律視為無效。
test("rejects webpage targets without an http url", () => {
  assert.throws(() => normalizeManifest({
    targets: [{ label: "網頁", contentType: "webpage", url: "ftp://example.com" }]
  }, "https://example.com/card.json"), /網址無效/);
});
