/**
 * 發布 manifest 與 slug 的單元測試。
 *
 * 這裡不啟動瀏覽器：manifest.js 與 slug.js 都是純函式，可直接在 Node
 * 執行。測試重點是「viewer 讀得到」的契約，而不是 studio UI。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { buildCardManifest } from "../js/studio/manifest.js";
import { slugify } from "../js/utils/slug.js";

// 中文姓名不能全部變成 my-card；不同姓名必須產生不同 slug。
test("slugify keeps ascii slugs and hashes non-ascii names", () => {
  assert.equal(slugify("Lin Yi"), "lin-yi");
  assert.equal(slugify(""), "my-card");
  assert.match(slugify("林一"), /^card-[a-z0-9]+$/);
  assert.notEqual(slugify("林一"), slugify("林二"));
});

// 確認 profile/settings/targets/media 都有被帶進 manifest，且 markerAspect 正確。
test("manifest carries profile, settings, targets and media paths", () => {
  const manifest = buildCardManifest({
    profile: { name: "林一", title: "設計", company: "Studio", phone: "0912", email: "hi@example.com", website: "https://example.com", slug: "Lin Yi" },
    targets: [
      { label: "文字", contentType: "text", text: "hello", img: { width: 800, height: 600 } },
      { label: "照片", contentType: "image", contentName: "p.png", contentMime: "image/png", img: { width: 800, height: 600 } }
    ],
    settings: { position: "below", gapCm: 0.2 },
    mediaPaths: [null, "media/page-2.png"]
  });
  assert.equal(manifest.version, 1);
  assert.equal(manifest.slug, "lin-yi");
  assert.equal(manifest.profile.name, "林一");
  assert.equal(manifest.settings.position, "below");
  assert.equal(manifest.targets[0].markerAspect, 0.75);
  assert.equal(manifest.targets[1].media, "media/page-2.png");
});

// slug 留空時，用姓名產生；這是 viewer URL 的 fallback 規則。
test("manifest uses the profile name when slug is empty", () => {
  const manifest = buildCardManifest({
    profile: { name: "Lin Yi", slug: "" },
    targets: [{ label: "Text", contentType: "text", text: "hi" }]
  });
  assert.equal(manifest.slug, "lin-yi");
});
