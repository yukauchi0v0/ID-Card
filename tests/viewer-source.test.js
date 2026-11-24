/**
 * 觀看端「資料來源」判斷的測試。
 *
 * 只測純函式：真正打 Supabase 的流程要在瀏覽器裡用實際代碼驗證。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { isCardCode } from "../js/viewer/manifest.js";

test("名片代碼是 8 碼小寫英數", () => {
  assert.equal(isCardCode("k7m2p9qd"), true);
  assert.equal(isCardCode("abcd2345"), true);
});

test("大寫或長度不對都不是名片代碼", () => {
  assert.equal(isCardCode("K7M2P9QD"), false);
  assert.equal(isCardCode("short"), false);
  assert.equal(isCardCode("k7m2p9qdx"), false);
});

test("舊版靜態包路徑不會被當成名片代碼", () => {
  assert.equal(isCardCode("cards/slug/card.json"), false);
  assert.equal(isCardCode(""), false);
  assert.equal(isCardCode(undefined), false);
});
