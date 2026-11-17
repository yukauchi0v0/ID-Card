import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("entry pages have no inline style or script blocks", async () => {
  for (const file of ["index.html", "studio.html", "viewer.html"]) {
    const html = await readFile(file, "utf8");
    assert.equal(/<style[\s>]/i.test(html), false, file + " has inline style");
    assert.equal(/<script(?![^>]*\bsrc=)[^>]*>/i.test(html), false, file + " has inline script");
  }
});

test("entry pages do not contain duplicate ids", async () => {
  for (const file of ["index.html", "studio.html", "viewer.html"]) {
    const html = await readFile(file, "utf8");
    const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
    const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
    assert.deepEqual([...new Set(duplicates)], [], file + " has duplicate ids");
  }
});
