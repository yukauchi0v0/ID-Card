/**
 * 名片資訊裡的「社群與聯絡方式」勾選列。
 *
 * 每個平台一列：勾選框 + 帳號輸入框。勾選才顯示輸入框，取消勾選會把
 * 該平台從 `studioState.profile.links` 移除。資料一律存成
 * `[{ platform, account }]`，寫入 state 前先經過 `normalizeLinks()`，
 * 確保送到觀看端與雲端的是乾淨格式。
 */
import { SOCIAL_PLATFORMS } from "../config.js";
import { normalizeLinks } from "../shared/social.js";
import { studioState } from "./state.js";
import { studioDom } from "./dom.js";

// 依 profile.links 重建整張清單；restoreSession / 雲端載入後呼叫。
// 用重建而不是逐列更新，避免遠端資料的平台順序與畫面不一致。
export function renderSocialLinks() {
  const links = normalizeLinks(studioState.profile.links);
  studioDom.socialList.innerHTML = "";

  SOCIAL_PLATFORMS.forEach((platform) => {
    const link = links.find((item) => item.platform === platform.id);
    const row = document.createElement("div");
    row.className = "social-row" + (link ? " is-on" : "");

    const toggleId = "social-" + platform.id + "-toggle";
    const inputId = "social-" + platform.id;

    // 結構固定、文字與屬性一律用 DOM API 寫入，避免平台名稱或帳號內容
    // 被當成 HTML 解析。
    const toggleLabel = document.createElement("label");
    toggleLabel.className = "social-toggle";
    const toggle = document.createElement("input");
    toggle.id = toggleId;
    toggle.type = "checkbox";
    toggle.checked = Boolean(link);
    const toggleText = document.createElement("span");
    toggleText.textContent = platform.label;
    toggleLabel.append(toggle, toggleText);

    const account = document.createElement("input");
    account.id = inputId;
    account.className = "social-account";
    account.type = "text";
    account.maxLength = 120;
    account.setAttribute("inputmode", "url");
    account.setAttribute("autocomplete", "off");
    account.placeholder = platform.placeholder;
    account.value = link ? link.account : "";
    account.hidden = !link;
    account.setAttribute("aria-label", platform.label + " 帳號或網址");

    row.append(toggleLabel, account);
    studioDom.socialList.appendChild(row);

    toggle.addEventListener("change", () => {
      account.hidden = !toggle.checked;
      row.classList.toggle("is-on", toggle.checked);
      if (toggle.checked) {
        setLink(platform.id, account.value);
        account.focus();
      } else {
        account.value = "";
        setLink(platform.id, "");
      }
    });

    account.addEventListener("input", () => {
      setLink(platform.id, account.value);
    });
  });
}

/** 更新單一平台的帳號；空字串代表移除。 */
function setLink(platform, account) {
  const others = normalizeLinks(studioState.profile.links).filter((item) => item.platform !== platform);
  studioState.profile.links = normalizeLinks(
    account.trim() ? others.concat({ platform, account }) : others
  );
}

/** 綁定事件（實際事件綁在 renderSocialLinks 建立的節點上）並先畫一次。 */
export function initSocialLinks() {
  renderSocialLinks();
}
