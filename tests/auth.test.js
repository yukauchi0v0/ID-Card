/**
 * 登入相關的純函式測試。
 *
 * 這裡不碰真的 Supabase：`auth.js` 只在函式被呼叫時才取 client，
 * 所以 import 階段不需要 browser 環境。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { authRedirectUrl } from "../js/studio/auth.js";

test("登入回跳網址會去掉 query 與 hash", () => {
  assert.equal(
    authRedirectUrl("https://example.com/ID-Card/studio.html?foo=1#bar"),
    "https://example.com/ID-Card/studio.html"
  );
});

test("沒有 query 時回跳網址保持不變", () => {
  assert.equal(
    authRedirectUrl("https://yukauchi0v0.github.io/ID-Card/studio.html"),
    "https://yukauchi0v0.github.io/ID-Card/studio.html"
  );
});

test("路徑結尾不是斜線時也不會被改寫", () => {
  assert.equal(
    authRedirectUrl("https://example.com/dir/studio.html?code=abc"),
    "https://example.com/dir/studio.html"
  );
});
