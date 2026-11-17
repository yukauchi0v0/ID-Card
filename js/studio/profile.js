import { slugify } from "../utils/slug.js";
import { studioState } from "./state.js";
import { studioDom } from "./dom.js";

const FIELDS = ["name", "title", "company", "phone", "email", "website", "slug"];

function inputFor(key) {
  return studioDom["profile" + key[0].toUpperCase() + key.slice(1)];
}

export function renderProfile() {
  FIELDS.forEach((key) => {
    const input = inputFor(key);
    if (input) input.value = studioState.profile[key] || "";
  });
}

export function initProfile() {
  FIELDS.forEach((key) => {
    const input = inputFor(key);
    if (!input) return;
    input.addEventListener("input", () => {
      studioState.profile[key] = input.value;
    });
    if (key === "slug") {
      // Normalise only after the field is left, so typing does not fight the user.
      input.addEventListener("change", () => {
        studioState.profile.slug = slugify(input.value);
        input.value = studioState.profile.slug;
      });
    }
  });
  renderProfile();
}
