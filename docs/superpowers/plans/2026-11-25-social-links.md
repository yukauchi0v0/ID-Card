# 社群聯絡卡、儲存名片與分享 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓收到名片的人在觀看端一眼看到「可以怎麼聯絡我」，點一下就能開 LINE / IG / 撥號，並能「儲存名片到通訊錄」與「分享這張名片」。

**Architecture:** 只擴充既有資料流，不新增伺服器。製作端在 `profile.links` 收集勾選的平台與帳號，`buildCardManifest` 把它寫進 manifest（`get_public_card` 本來就回傳整份 manifest，資料庫與 SQL 都不用改）。觀看端用純函式 `js/shared/social.js` 產生安全連結與 vCard 文字（可單元測試），再由 `js/viewer/contact.js` 與 `js/viewer/sharing.js` 綁 UI。

**Tech Stack:** 原生 ESM（無 build step）、`node:test`、既有 `styles/*.css` 設計權杖。

**Spec:** `docs/superpowers/specs/2026-11-25-social-links-design.md`

## Global Constraints

- 只用既有相依；**不新增 npm 套件或 CDN**。
- 所有對外網址必須是 `http(s):`；`javascript:`、`data:` 等一律丟棄。
- 每個帳號最多 120 字元；最多 8 個平台；名片上最多 8 個聯絡按鈕。
- 介面文案一律繁體中文，語氣與現有頁面一致。
- 每個 Task 前後都跑 `node --test "tests/*.test.js"`，既有測試不得失敗。
- `vendor/` 內第三方檔案不得修改。
- 沒有 `profile.links` 的舊 manifest（雲端舊版或 `cards/<slug>/card.json`）必須照舊顯示。

## Review Focus

1. `profile.links` 不是陣列（物件、字串、`null`）：觀看端只少了社群按鈕，**不能**整頁錯誤。→ Task 3 測試。
2. 帳號填 `javascript:alert(1)` 或 `data:text/html,...`：卡片上不得出現可點的危險連結。→ Task 1/3 測試。
3. 姓名或公司含換行、逗號、分號、反斜線：vCard 不得被注入額外欄位。→ Task 1 測試。
4. 同平台填兩次：只出現一個按鈕。→ Task 1 測試。
5. 沒有 Web Share / 剪貼簿時按「分享名片」：仍要看得到可複製的網址，不能靜默失敗。→ Task 5 驗證。

---

### Task 1: 社群連結純函式 `js/shared/social.js`

**Files:**
- Create: `js/shared/social.js`
- Create: `tests/social.test.js`
- Modify: `js/config.js`（新增 `SOCIAL_PLATFORMS`、`DEFAULT_PROFILE.links`）

**Interfaces:**
- Consumes: 無。
- Produces:
  - `SOCIAL_PLATFORMS: Array<{ id, label, placeholder, match?: string[], httpPrefix: string }>`（`js/config.js`）
  - `normalizeLinks(value: unknown): Array<{ platform: string, account: string }>`
  - `isSafeHttpUrl(value: unknown): boolean`
  - `contactHref(link): string`
  - `contactLabel(link): string`
  - `contactActions(profile): Array<{ kind: "link"|"call"|"mail", href: string, label: string, external: boolean }>`
  - `escapeVCard(value: unknown): string`
  - `vCardFileName(name: unknown): string`
  - `toVCard(profile): string`

- [ ] **Step 1: `js/config.js` 加入平台定義，`DEFAULT_PROFILE` 加 `links: []`**

```js
// 名片上的社群平台。`match` 用來說明這個平台屬於哪個網域（文件用途），
// `httpPrefix` 用來把「只填帳號」的情況組成合法網址；空字串代表必須貼完整網址。
export const SOCIAL_PLATFORMS = [
  { id: "line", label: "LINE", placeholder: "LINE ID 或加好友連結", httpPrefix: "https://line.me/R/ti/p/~" },
  { id: "instagram", label: "Instagram", placeholder: "帳號或網址", match: ["instagram.com"], httpPrefix: "https://instagram.com/" },
  { id: "threads", label: "Threads", placeholder: "帳號或網址", match: ["threads.net"], httpPrefix: "https://threads.net/@" },
  { id: "facebook", label: "Facebook", placeholder: "帳號或網址", match: ["facebook.com"], httpPrefix: "https://facebook.com/" },
  { id: "x", label: "X", placeholder: "帳號或網址", match: ["x.com", "twitter.com"], httpPrefix: "https://x.com/" },
  { id: "linkedin", label: "LinkedIn", placeholder: "帳號或網址", match: ["linkedin.com"], httpPrefix: "https://linkedin.com/in/" },
  { id: "github", label: "GitHub", placeholder: "帳號或網址", match: ["github.com"], httpPrefix: "https://github.com/" },
  { id: "custom", label: "其他網站", placeholder: "完整網址 https://", httpPrefix: "" }
];
```

- [ ] **Step 2: 寫失敗測試 `tests/social.test.js`**

```js
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

test("isSafeHttpUrl 擋掉不安全 scheme", () => {
  assert.equal(isSafeHttpUrl("https://instagram.com/linyi"), true);
  assert.equal(isSafeHttpUrl("javascript:alert(1)"), false);
  assert.equal(isSafeHttpUrl("data:text/html,<b>x</b>"), false);
  assert.equal(isSafeHttpUrl("  https://x.com/a  "), true);
  assert.equal(isSafeHttpUrl(""), false);
});

test("contactHref 用平台前綴組帳號，貼完整網址則沿用", () => {
  assert.equal(contactHref({ platform: "instagram", account: "@linyi" }), "https://instagram.com/linyi");
  assert.equal(contactHref({ platform: "x", account: "@linyi" }), "https://x.com/linyi");
  assert.equal(contactHref({ platform: "line", account: "linyi" }), "https://line.me/R/ti/p/~linyi");
  assert.equal(contactHref({ platform: "facebook", account: "https://fb.com/linyi" }), "https://fb.com/linyi");
  assert.equal(contactHref({ platform: "custom", account: "example.com" }), "");
  assert.equal(contactHref({ platform: "instagram", account: "javascript:alert(1)" }), "");
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
  assert.ok(card.includes("\\nURL:https\\://evil.example"));
  assert.ok(card.includes("ORG:島嶼\\,工作室\r\n"));
  assert.ok(card.includes("TEL;TYPE=CELL:0912\r\n"));
  assert.ok(card.includes("EMAIL;TYPE=INTERNET:a@b.c\r\n"));
  assert.ok(card.includes("X-SOCIALPROFILE;TYPE=instagram:https://instagram.com/linyi\r\n"));
});

test("vCardFileName 去掉路徑字元", () => {
  assert.equal(vCardFileName("林一"), "林一.vcf");
  assert.equal(vCardFileName('a/b:c*?"<>|'), "a-b-c.vcf");
  assert.equal(vCardFileName(""), "id-card.vcf");
});
```

- [ ] **Step 3: 跑測試確認失敗**

Run: `node --test tests/social.test.js`
Expected: FAIL — `Cannot find module '../js/shared/social.js'`。

- [ ] **Step 4: 實作 `js/shared/social.js`**

照這幾條規則實作（刻意照做，不要簡化）：

- `normalizeLinks`：非陣列回 `[]`；每筆必須是物件；`platform` 要在 `SOCIAL_PLATFORMS` 裡；`account` 轉字串、`trim()` 後非空；同平台保留第一筆；`account` 截到 120 字元；最多 8 筆。
- `isSafeHttpUrl`：`String(value).trim()` 後 `new URL()`；`protocol` 必須是 `http:` 或 `https:`；解析失敗回 `false`。
- `contactHref`：`account` trim；若本身是安全 http(s) 網址 → 回 `new URL(...).href`；否則找平台，`httpPrefix` 為空 → `""`；帳號去掉前導 `@`、前後 `/`、空白轉 `-`，與 `httpPrefix` 相接，最後再用 `isSafeHttpUrl` 驗一次。
- `contactLabel`：回平台 `label`，找不到回 `""`。
- `contactActions`：先放社群（`href` 非空者），再放電話（`tel:` + 去空白電話），再放 Email（`mailto:`）；社群 `external: true`，電話/Email `false`；`slice(0, 8)`。
- `escapeVCard`：非字串回 `""`；依序把 `\\`→`\\\\`、`\n`→`\\n`、`\r`去掉、`,`→`\\,`、`;`→`\\;`。
- `vCardFileName`：`name` 去頭尾空白，空字串用 `id-card`；把 `\\ / : * ? " < > |` 與控制字元換成 `-`；補 `.vcf`。
- `toVCard`：每行 `\r\n`；`N:` 與 `FN:` 用 escape 後的姓名（無姓名但有公司時用公司；兩者皆空用 `ID Card`）；`TITLE`/`ORG`/`EMAIL`/`URL`/`X-SOCIALPROFILE;TYPE=<id>` 皆用 escape；`TEL;TYPE=CELL:` 只保留 `+`、數字、`-`、`(`、`)`。`URL` 只放安全 http(s)。

- [ ] **Step 5: 跑測試確認通過**

Run: `node --test tests/social.test.js`
Expected: PASS ×9。

- [ ] **Step 6: 跑全套測試**

Run: `node --test "tests/*.test.js"`
Expected: 全 PASS。

- [ ] **Step 7: Commit**

```bash
git add js/shared/social.js tests/social.test.js js/config.js
git commit -m "feat: add social link helpers and vCard builder"
```

---

### Task 2: 製作端編輯社群連結

**Files:**
- Create: `js/studio/links.js`
- Modify: `studio.html`（「01 · 名片資訊」的 `.profile-grid` 之後）
- Modify: `js/studio/dom.js`
- Modify: `js/studio/profile.js`
- Modify: `js/studio/app.js`
- Modify: `js/studio/manifest.js`
- Modify: `js/studio/session.js`
- Modify: `styles/studio.css`
- Test: `tests/manifest.test.js`

**Interfaces:**
- Consumes: `SOCIAL_PLATFORMS`（Task 1）、`normalizeLinks`（Task 1）。
- Produces:
  - `initLinks(): void`、`renderLinks(): void`（`js/studio/links.js`）
  - manifest `profile.links: Array<{platform, account}>`

- [ ] **Step 1: 先寫失敗測試（追加到 `tests/manifest.test.js`）**

```js
test("buildCardManifest 帶入正規化後的社群連結", () => {
  const manifest = buildCardManifest({
    profile: { name: "林一", links: [
      { platform: "line", account: "linyi" },
      { platform: "line", account: "dup" },
      { platform: "bogus", account: "x" }
    ] },
    targets: [{ label: "A", contentType: "text", text: "t" }],
    settings: {}
  });
  assert.deepEqual(manifest.profile.links, [{ platform: "line", account: "linyi" }]);
});

test("buildCardManifest 沒有 links 時給空陣列", () => {
  const manifest = buildCardManifest({
    profile: { name: "林一" },
    targets: [{ label: "A", contentType: "text", text: "t" }],
    settings: {}
  });
  assert.deepEqual(manifest.profile.links, []);
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `node --test tests/manifest.test.js`
Expected: FAIL — `profile.links` 是 `undefined`。

- [ ] **Step 3: `js/studio/manifest.js` 的 profile 加 `links: normalizeLinks(profile.links)` 並 import**

- [ ] **Step 4: 跑測試確認通過**

Run: `node --test tests/manifest.test.js`
Expected: PASS。

- [ ] **Step 5: `studio.html` 在 `.profile-grid` 之後加入**

```html
<div class="links-editor">
  <p class="links-title">社群聯絡（勾選後會出現在名片上）</p>
  <div id="socialList" class="social-list"></div>
  <p class="control-help">可以貼完整網址，或只填帳號（例如 <code>@linyi</code>）。沒勾選的不會顯示。</p>
</div>
```

- [ ] **Step 6: `js/studio/dom.js` 加 `socialList: byId("socialList")`**

- [ ] **Step 7: 實作 `js/studio/links.js`**

- `initLinks()`：清空 `socialList`，依 `SOCIAL_PLATFORMS` 建立列：
  ```html
  <label class="social-row" data-platform="line">
    <input type="checkbox" class="social-toggle" />
    <span class="social-name">LINE</span>
    <input type="text" class="social-input" maxlength="120" placeholder="..." disabled />
  </label>
  ```
  - 勾選 → 啟用輸入框並 focus；取消 → 清空該平台帳號、停用輸入框；每次變更後 `syncLinks()`。
  - 輸入 → `syncLinks()`（打字中不 trim、不清空）。
- `syncLinks()`（內部）：把勾選且有內容的列組成陣列寫回 `studioState.profile.links`（保留輸入中的空白）。
- `renderLinks()`：以 `normalizeLinks(studioState.profile.links)` 為準，勾選/填值；其他列取消勾選、清空、停用。
- `initLinks()` 最後呼叫 `renderLinks()`。

- [ ] **Step 8: `js/studio/profile.js` 的 `renderProfile()` 末尾呼叫 `renderLinks()`；`js/studio/app.js` 在 `initProfile()` 之後呼叫 `initLinks()`**

- [ ] **Step 9: `js/studio/session.js` restore 時 `profile.links = normalizeLinks(...)`**

- [ ] **Step 10: `styles/studio.css` 加樣式**

`.links-editor`（上邊距 18px、上邊框 1px）、`.links-title`（600、14px）、`.social-list`（grid 兩欄、gap 10px；`@media (max-width: 680px)` 單欄）、`.social-row`（flex、align-center、gap 8px、padding 10px 12px、1px 邊框、圓角）、`.social-input`（flex 1、min-width 0）、`.social-row:has(.social-input:disabled)` 降低名稱透明度（不支援 `:has` 時就靠 input 本身的 disabled 樣式）。

- [ ] **Step 11: 瀏覽器驗證（studio）**

本機 `python -m http.server 8767` + 無頭 Chrome（CDP 9346），確認：
- `#socialList` 有 8 列，全部 unchecked、input 全部 disabled。
- 勾 LINE、輸入 `linyi` → `studioState.profile.links` 等於 `[{platform:"line", account:"linyi"}]`。
- 重新載入頁面（IndexedDB 還原）後仍勾選並顯示 `linyi`。
- console 0 error。

- [ ] **Step 12: Commit**

```bash
git add js/studio/links.js js/studio/dom.js js/studio/profile.js js/studio/app.js js/studio/manifest.js js/studio/session.js studio.html styles/studio.css tests/manifest.test.js
git commit -m "feat: let makers pick social platforms and accounts"
```

---

### Task 3: 觀看端讀取 `profile.links`

**Files:**
- Modify: `js/viewer/manifest.js`
- Modify: `tests/viewer-manifest.test.js`

**Interfaces:**
- Consumes: `normalizeLinks`（Task 1）。
- Produces: `manifest.profile.links`（已正規化、必定是陣列）。

- [ ] **Step 1: 先寫失敗測試**

```js
test("normalizeManifest 正規化 profile.links 並容忍壞資料", () => {
  const ok = normalizeManifest({
    targets: [{ contentType: "text", text: "t" }],
    profile: { name: "林一", links: [{ platform: "line", account: "linyi" }, { platform: "x", account: " " }] }
  }, "https://example.com/cards/a/card.json");
  assert.deepEqual(ok.profile.links, [{ platform: "line", account: "linyi" }]);

  const bad = normalizeManifest({
    targets: [{ contentType: "text", text: "t" }],
    profile: { name: "林一", links: { line: "linyi" } }
  }, "https://example.com/card.json");
  assert.deepEqual(bad.profile.links, []);
});

test("沒有 profile 的舊 manifest 仍可載入", () => {
  const m = normalizeManifest({ targets: [{ contentType: "text", text: "t" }] }, "https://example.com/card.json");
  assert.deepEqual(m.profile.links, []);
  assert.equal(m.profile.name, "");
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `node --test tests/viewer-manifest.test.js`
Expected: FAIL — `profile.links` 是 `undefined`。

- [ ] **Step 3: `js/viewer/manifest.js` 的 profile 加 `links: normalizeLinks(raw.profile && raw.profile.links)` 並 import**

- [ ] **Step 4: 跑測試確認通過（含全套）**

Run: `node --test "tests/*.test.js"`
Expected: 全 PASS。

- [ ] **Step 5: Commit**

```bash
git add js/viewer/manifest.js tests/viewer-manifest.test.js
git commit -m "feat: read social links from card manifests"
```

---

### Task 4: 觀看端社群按鈕

**Files:**
- Create: `js/viewer/contact.js`
- Modify: `viewer.html`
- Modify: `js/viewer/dom.js`
- Modify: `js/viewer/app.js`
- Modify: `styles/viewer.css`

**Interfaces:**
- Consumes: `contactActions`（Task 1）、`viewerDom.contact`。
- Produces: `renderContact(profile): void`。

- [ ] **Step 1: `viewer.html` 在 `#viewerArBtn` 之前加入**

```html
<div id="viewerContact" class="viewer-contact-actions" hidden></div>
```

- [ ] **Step 2: `js/viewer/dom.js` 加 `contact: byId("viewerContact")`**

- [ ] **Step 3: 實作 `js/viewer/contact.js`**

`renderContact(profile)`：
- `const actions = contactActions(profile)`；空 → `viewerDom.contact.hidden = true`、`replaceChildren()`、return。
- 非空 → `hidden = false`；`replaceChildren(title, ...buttons)`。
- `title` 是 `<p class="viewer-contact-title">看完之後，歡迎聯絡我</p>`。
- 每個 action 用 `document.createElement("a")`（**不要用 innerHTML**）：`class="contact-action"`、`data-kind`、`href`、`textContent = action.label`；`external` 為真時 `target="_blank"`、`rel="noopener noreferrer"`。

- [ ] **Step 4: `js/viewer/app.js` 的 `renderProfile()` 末尾呼叫 `renderContact(profile)`**

- [ ] **Step 5: `styles/viewer.css` 加樣式**

`.viewer-contact-actions`（grid、`repeat(auto-fit, minmax(120px, 1fr))`、gap 10px、上邊距 18px、上邊框 1px 虛線）、`.viewer-contact-title`（13px、次要色、margin 0 0 2px、`grid-column: 1 / -1`）、`.contact-action`（padding 12px、圓角、1px 邊框、600、置中、hover 底部色）。

- [ ] **Step 6: 瀏覽器驗證（viewer）**

用本機測試 manifest（複製 `cards/photo-test` 並在 `profile` 加 `links`），確認：
- 出現 LINE、Instagram、撥號、寄 Email 按鈕。
- LINE 的 `href` 是 `https://line.me/R/ti/p/~linyi`、`target=_blank`。
- 沒有 `links` 的卡片 `#viewerContact` 為 `hidden`。
- console 0 error。

- [ ] **Step 7: Commit**

```bash
git add js/viewer/contact.js js/viewer/dom.js js/viewer/app.js viewer.html styles/viewer.css
git commit -m "feat: show contact buttons on the viewer card"
```

---

### Task 5: 儲存名片與分享名片

**Files:**
- Create: `js/viewer/sharing.js`
- Modify: `viewer.html`
- Modify: `js/viewer/dom.js`
- Modify: `js/viewer/app.js`
- Modify: `styles/viewer.css`

**Interfaces:**
- Consumes: `toVCard`、`vCardFileName`（Task 1）、`manifest.profile`。
- Produces: `initSharing(profile): void`。

- [ ] **Step 1: `viewer.html` 在 `#viewerContact` 之後加入**

```html
<div id="viewerActions" class="viewer-actions" hidden>
  <button id="viewerSaveBtn" class="secondary-btn" type="button">儲存名片</button>
  <button id="viewerShareBtn" class="secondary-btn" type="button">分享名片</button>
</div>
<p id="viewerShareStatus" class="viewer-hint" role="status" aria-live="polite" hidden></p>
```

- [ ] **Step 2: `js/viewer/dom.js` 加 `actions`、`saveBtn`、`shareBtn`、`shareStatus`**

- [ ] **Step 3: 實作 `js/viewer/sharing.js`**

- `setStatus(message)`：寫入 `shareStatus.textContent`、`hidden = !message`；`message` 空就清除 timer；4 秒後清空並隱藏（每次呼叫先 `clearTimeout` 舊 timer）。
- `saveContact(profile)`：`new Blob([toVCard(profile)], { type: "text/vcard;charset=utf-8" })` → object URL → `<a download>` append → click → remove → 1 秒後 `revokeObjectURL` → `setStatus("名片已下載，開啟檔案就能加入通訊錄。")`。
- `shareCard(profile)`：`url = location.href`、`title = (profile.name || "ID Card") + " · 名片"`。
  - `navigator.share` 存在 → `await navigator.share({ title, url })`；`err.name === "AbortError"` 直接 return；其他錯誤落到 fallback。
  - fallback：`await navigator.clipboard.writeText(url)` 成功 → `setStatus("網址已複製，可以貼給朋友。")`；失敗 → `setStatus("請長按複製網址：" + url)`。
- `initSharing(profile)`：`actions.hidden = !(profile.name || profile.company)`；綁兩個按鈕；`shareCard`/`saveContact` 的錯誤都以 `setStatus` 呈現，不讓 promise rejection 冒到 console。

- [ ] **Step 4: `js/viewer/app.js` 在 `renderProfile(manifest.profile)` 之後呼叫 `initSharing(manifest.profile)`**

- [ ] **Step 5: `styles/viewer.css` 加 `.viewer-actions`（flex、gap 10px、上邊距 12px、按鈕 `flex: 1`）**

- [ ] **Step 6: 瀏覽器驗證**

- 點「儲存名片」→ 下載 `.vcf`；讀檔確認 `BEGIN:VCARD`、`FN:`、`TEL;TYPE=CELL:`、`X-SOCIALPROFILE`。
- 點「分享名片」→ 無頭 Chrome 沒有 `navigator.share`，`#viewerShareStatus` 必須顯示「網址已複製…」或「請長按複製網址…」。
- console 0 error。

- [ ] **Step 7: Commit**

```bash
git add js/viewer/sharing.js js/viewer/dom.js js/viewer/app.js viewer.html styles/viewer.css
git commit -m "feat: save contact as vCard and share the card link"
```

---

### Task 6: 文件、全套回歸、部署

**Files:**
- Modify: `README.md`

- [ ] **Step 1: `README.md` 加「社群聯絡與分享」一段**：勾選流程、vCard 內容、分享行為、限制（危險 scheme 會被丟棄、最多 8 個按鈕、沒有 Web Share 時用複製）。

- [ ] **Step 2: 語法與測試**

```bash
node --check js/shared/social.js
node --check js/viewer/contact.js
node --check js/viewer/sharing.js
node --test "tests/*.test.js"
```

- [ ] **Step 3: 端到端回歸**

1. studio：勾 LINE + Instagram、填帳號 → 匯出卡片包 → 解壓檢查 `card.json` 的 `profile.links`。
2. viewer：用該包確認按鈕、儲存名片、分享名片。
3. 用沒有 links 的舊包確認不顯示社群區塊、不出現空白。
4. AR 進入/返回、控制台 0 error。

- [ ] **Step 4: Commit 與 push**

```bash
git add README.md
git commit -m "docs: document social links and card sharing"
git push origin main
```

- [ ] **Step 5: 部署驗證**

`https://yukauchi0v0.github.io/ID-Card/js/shared/social.js`、`js/viewer/contact.js`、`js/viewer/sharing.js` 回 200；viewer 頁載入 0 console error。

## 執行紀錄

- Task 1 social.js / config SOCAL_PLATFORMS / tests/social.test.js：完成（tests/social.test.js 14 通過）。
- Task 2 studio 勾選（social-ui.js、studio.html .social-picker、styles/studio.css）：完成。
- Task 3 manifest 串接 links（studio/manifest.js、studio/cloud.js、viewer/manifest.js）：完成。
- Task 4 viewer 聯絡區（contact.js、viewer.html #viewerContact、styles/viewer.css）：完成。
- 「看完 AR 才出現聯絡區」：ar/shell.js #viewerContactCta、ar/hud.js 依 arState.host==='viewer' 顯示、viewer/app.js revealContact()：完成。
- 額外修正：ar/scene.js 接住 MindAR 解碼 .mind 失敗（錯誤卡＋onError，不再 unhandled rejection）；utils/format.js 新增 normalizeHttpUrl；social.js 的 normalizeLinks 丟棄不可用網址；shared/supabase.js 過濾 Supabase 登入網址相關 console.error；studio/session.js hasLocalSession() 避免空白裝置覆蓋雲端草稿。
- 驗證：node --test tests/*.test.js 38 通過；.tmp/test-viewer-contact.mjs 全數斷言通過、0 console 錯誤；.tmp/test-cloud-e2e.mjs 存檔→載入→發布→觀看端→匿名 RPC 全通。
