// CJK-friendly line breaking for the Canvas text card. Latin words stay
// together; punctuation and CJK glyphs may break individually.
export function wrapCanvasText(ctx, text, maxWidth) {
  const lines = [];
  const paragraphs = String(text).replace(/\t/g, "    ").split(/\r?\n/);
  for (const paragraph of paragraphs) {
    if (!paragraph) { lines.push(""); continue; }
    const units = paragraph.match(/[A-Za-z0-9_@#$%&*+\-./:]+|\s+|[\s\S]/g) || [];
    let line = "";
    for (const unit of units) {
      const candidate = line + unit;
      if (ctx.measureText(candidate).width <= maxWidth || !line) { line = candidate; continue; }
      if (line.trim()) lines.push(line.trimEnd());
      line = "";
      if (ctx.measureText(unit).width > maxWidth) {
        for (const ch of unit) {
          if (ctx.measureText(line + ch).width > maxWidth && line) { lines.push(line); line = ""; }
          line += ch;
        }
      } else {
        line = unit.trimStart();
      }
    }
    lines.push(line.trimEnd());
  }
  return lines;
}
