import test from "node:test";
import assert from "node:assert/strict";
import { normalizeManifest } from "../js/viewer/manifest.js";

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

test("rejects empty targets", () => {
  assert.throws(() => normalizeManifest({ targets: [] }, "https://example.com/card.json"), /沒有卡面資料/);
});

test("rejects image targets without media", () => {
  assert.throws(() => normalizeManifest({
    targets: [{ label: "照片", contentType: "image" }]
  }, "https://example.com/card.json"), /缺少 media/);
});

test("rejects webpage targets without an http url", () => {
  assert.throws(() => normalizeManifest({
    targets: [{ label: "網頁", contentType: "webpage", url: "ftp://example.com" }]
  }, "https://example.com/card.json"), /網址無效/);
});
