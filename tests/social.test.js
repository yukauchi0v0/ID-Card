import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeLinks, isSafeHttpUrl, contactHref, contactLabel,
  contactActions, escapeVCard, toVCard, vCardFileName
} from "../js/shared/social.js";

test("normalizeLinks 只留已知平台與非空帳號，每平台取第一筆", () => {
  const links = normalizeLinks([
    { platform: "line", account: "linyi" },
    { platform: "line", account: "linyi-2" },
    { platform: "nope", account: "x" },
    { platform: "instagram", account: "   " },
    { platform: "instagram", account: "@linyi" },
    null,
    "string",
    { platform: "custom", account: "https://example.com" }
  ]);
  assert.deepEqual(links, [
    { platform: "line", account: "linyi" },
    { platform: "instagram", account: "@linyi" },
    { platform: "custom", account: "https://example.com" }
  ]);
});

test("normalizeLinks 對非陣列輸入回空陣列", () => {
  assert.deepEqual(normalizeLinks(undefined), []);
  assert.deepEqual(normalizeLinks({ line: "a" }), []);
  assert.deepEqual(normalizeLinks(null), []);
});

test("normalizeLinks 截斷過長帳號並限制 8 筆", () => {
  const many = [
    { platform: "line", account: "l".repeat(200) },
    { platform: "instagram", account: "a" },
    { platform: "threads", account: "a" },
    { platform: "facebook", account: "a" },
    { platform: "x", account: "a" },
    { platform: "linkedin", account: "a" },
    { platform: "github", account: "a" },
    { platform: "custom", account: "https://a.example" },
    { platform: "line", account: "dup" }
  ];
  const links = normalizeLinks(many);
  assert.equal(links.length, 8);
  assert.equal(links[0].account.length, 120);
});

test("isSafeHttpUrl 擋掉不安全 scheme", () => {
  assert.equal(isSafeHttpUrl("https://instagram.com/linyi"), true);
  assert.equal(isSafeHttpUrl("javascript:alert(1)"), false);
  assert.equal(isSafeHttpUrl("data:text/html,<b>x</b>"), false);
  assert.equal(isSafeHttpUrl("  https://x.com/a  "), true);
  assert.equal(isSafeHttpUrl(""), false);
  assert.equal(isSafeHttpUrl(null), false);
});

test("contactHref 用平台前綴組帳號，貼完整網址則沿用", () => {
  assert.equal(contactHref({ platform: "instagram", account: "@linyi" }), "https://instagram.com/linyi");
  assert.equal(contactHref({ platform: "x", account: "@linyi" }), "https://x.com/linyi");
  assert.equal(contactHref({ platform: "line", account: "linyi" }), "https://line.me/R/ti/p/~linyi");
  assert.equal(contactHref({ platform: "facebook", account: "https://fb.com/linyi" }), "https://fb.com/linyi");
  assert.equal(contactHref({ platform: "custom", account: "example.com" }), "");
  assert.equal(contactHref({ platform: "instagram", account: "javascript:alert(1)" }), "");
  assert.equal(contactHref({ platform: "instagram", account: "/lin yi/" }), "https://instagram.com/lin-yi");
});

test("normalizeLinks 丟掉壞掉的帳號，不寫進資料庫", () => {
  const links = normalizeLinks([
    { platform: "x", account: "javascript:alert(1)" },
    { platform: "custom", account: "not a url" },
    { platform: "instagram", account: "  linyi  " },
    { platform: "instagram", account: "other" }
  ]);
  assert.deepEqual(links, [{ platform: "instagram", account: "linyi" }]);
});

test("contactLabel 回平台名稱", () => {
  assert.equal(contactLabel({ platform: "line", account: "a" }), "LINE");
  assert.equal(contactLabel({ platform: "unknown", account: "a" }), "");
});

test("contactActions 產生社群、撥號、Email，最多 8 個", () => {
  const actions = contactActions({
    phone: "0912 345 678",
    email: "hello@example.com",
    links: [
      { platform: "line", account: "linyi" },
      { platform: "instagram", account: "linyi" },
      { platform: "custom", account: "https://example.com" }
    ]
  });
  assert.deepEqual(actions.map((a) => a.kind), ["link", "link", "link", "call", "mail"]);
  assert.equal(actions[3].href, "tel:0912345678");
  assert.equal(actions[0].external, true);
  assert.equal(actions[3].external, false);
});

test("contactActions 丟棄不安全的社群連結，並在超過 8 個時截斷", () => {
  const actions = contactActions({
    phone: "1",
    email: "a@b.c",
    links: [
      { platform: "line", account: "javascript:alert(1)" },
      { platform: "facebook", account: "a" },
      { platform: "threads", account: "a" },
      { platform: "x", account: "a" },
      { platform: "linkedin", account: "a" },
      { platform: "github", account: "a" },
      { platform: "custom", account: "https://a.example" },
      { platform: "instagram", account: "a" }
    ]
  });
  // LINE 的 javascript: 帳號被丟棄 → 7 個社群 + 電話 + Email = 9，截到 8 個。
  assert.equal(actions.length, 8);
  assert.ok(actions.every((a) => !a.href.startsWith("javascript:")));
  assert.deepEqual(actions.map((a) => a.kind), ["link", "link", "link", "link", "link", "link", "link", "call"]);
});

test("vCard 的網址欄位會補成 https，不安全 scheme 會被丟掉", () => {
  assert.match(toVCard({ name: "林一", website: "example.com/blog" }), /\r\nURL:https:\/\/example\.com\/blog\r\n/);
  assert.doesNotMatch(toVCard({ name: "林一", website: "javascript:alert(1)" }), /URL:/);
});

test("escapeVCard 轉義特殊字元與換行", () => {
  assert.equal(escapeVCard("a,b;c\\d\ne"), "a\\,b\\;c\\\\d\\ne");
  assert.equal(escapeVCard(undefined), "");
});

test("toVCard 不會被姓名裡的換行注入欄位", () => {
  const card = toVCard({
    name: "林一\nURL:https://evil.example",
    title: "設計師",
    company: "島嶼,工作室",
    phone: "0912",
    email: "a@b.c",
    website: "https://example.com",
    links: [{ platform: "instagram", account: "linyi" }]
  });
  assert.ok(card.startsWith("BEGIN:VCARD\r\nVERSION:3.0\r\n"));
  assert.ok(card.endsWith("END:VCARD\r\n"));
  assert.ok(!/\r\nURL:https:\/\/evil/.test(card));
  // 姓名裡的換行被轉成字面 `\n`，整段留在同一行，不會變成新的 URL 欄位。
  assert.ok(card.includes("林一\\nURL:https://evil.example\r\n"));
  assert.ok(card.includes("ORG:島嶼\\,工作室\r\n"));
  assert.ok(card.includes("TEL;TYPE=CELL:0912\r\n"));
  assert.ok(card.includes("EMAIL;TYPE=INTERNET:a@b.c\r\n"));
  assert.ok(card.includes("X-SOCIALPROFILE;TYPE=instagram:https://instagram.com/linyi\r\n"));
});

test("toVCard 沒有姓名時用公司或預設名稱", () => {
  assert.ok(toVCard({ company: "島嶼工作室" }).includes("FN:島嶼工作室\r\n"));
  assert.ok(toVCard({}).includes("FN:ID Card\r\n"));
  assert.ok(!toVCard({ name: "林一", website: "javascript:alert(1)" }).includes("URL:"));
});

test("vCardFileName 去掉路徑字元", () => {
  assert.equal(vCardFileName("林一"), "林一.vcf");
  assert.equal(vCardFileName('a/b:c*?"<>|'), "a-b-c.vcf");
  assert.equal(vCardFileName(""), "id-card.vcf");
});
