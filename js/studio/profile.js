/**
 * 名片資料表單與 `studioState.profile` 的雙向同步。
 *
 * 輸入時即時寫入 state，讓使用者在還沒離開欄位時就能看到示意圖/發布
 * 網址更新；slug 例外：只在 change（離開欄位）時正規化，否則邊打字邊
 * 被改寫會很難輸入。
 */
import { slugify } from "../utils/slug.js";
import { studioState } from "./state.js";
import { studioDom } from "./dom.js";
import { renderSocialLinks } from "./social-ui.js";

// 欄位名稱要與 studio.html 的 id 後綴、DEFAULT_PROFILE 的 key 一致。
// 社群連結（links）不在這裡：它由 social-ui.js 產生的勾選列同步。
const FIELDS = ["name", "title", "company", "phone", "email", "website", "slug"];

// profileName / profileTitle / ... 由欄位名稱組出對應的 DOM 參照。
function inputFor(key) {
  return studioDom["profile" + key[0].toUpperCase() + key.slice(1)];
}

/** 把 state 的 profile 寫回表單；restoreSession 後會呼叫。 */
export function renderProfile() {
  FIELDS.forEach((key) => {
    const input = inputFor(key);
    if (input) input.value = studioState.profile[key] || "";
  });
  renderSocialLinks();
}

/** 綁定所有 profile 欄位的事件；由 initApp() 呼叫一次。 */
export function initProfile() {
  FIELDS.forEach((key) => {
    const input = inputFor(key);
    if (!input) return;
    input.addEventListener("input", () => {
      studioState.profile[key] = input.value;
    });
    if (key === "slug") {
      // 離開欄位才正規化，避免使用者打到一半被改成 hash 或連字號。
      input.addEventListener("change", () => {
        studioState.profile.slug = slugify(input.value);
        input.value = studioState.profile.slug;
      });
    }
  });
  renderProfile();
}
