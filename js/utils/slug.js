export function slugify(value) {
  const ascii = String(value || "")
    .normalize("NFKD")
    .replace(/[^\x00-\x7F]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (ascii) return ascii;
  if (!String(value || "").trim()) return "my-card";
  // Names with no ASCII letters (for example 林怡君) still need a stable,
  // collision-resistant folder name. A small deterministic hash is enough
  // for a single-card static package and keeps URLs ASCII-only.
  let hash = 0;
  for (const ch of String(value)) hash = (hash * 31 + ch.codePointAt(0)) >>> 0;
  return "card-" + hash.toString(36);
}
