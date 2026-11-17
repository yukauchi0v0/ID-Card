import { CARD_H, DEFAULT_SETTINGS } from "../config.js";
import { slugify } from "../utils/slug.js";

export function markerAspect(target) {
  if (Number(target.markerAspect) > 0) return Number(target.markerAspect);
  const img = target.img;
  if (img && img.width) return (img.height || 1) / img.width;
  return CARD_H;
}

export function buildCardManifest({ profile, targets, settings, mediaPaths = [] }) {
  const slug = slugify(profile.slug || profile.name);
  return {
    version: 1,
    slug,
    profile: {
      name: profile.name || "",
      title: profile.title || "",
      company: profile.company || "",
      phone: profile.phone || "",
      email: profile.email || "",
      website: profile.website || ""
    },
    settings: Object.assign({}, DEFAULT_SETTINGS, settings || {}),
    mind: "card.mind",
    targets: targets.map((target, index) => {
      const page = {
        label: target.label || "內容 " + (index + 1),
        contentType: target.contentType,
        text: target.text || "",
        url: target.url || "",
        markerAspect: markerAspect(target)
      };
      if (mediaPaths[index]) {
        page.media = mediaPaths[index];
        page.mediaName = target.contentName || "";
        page.mediaMime = target.contentMime || "";
      }
      return page;
    })
  };
}
