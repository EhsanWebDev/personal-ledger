import assert from "node:assert/strict";
import test from "node:test";
import { createRandomTheme, generatedThemeTokens } from "./theme-generator.js";

test("creates a complete, deterministic theme replacement", () => {
  const values = [0.5, 0.25, 0.75, 0.4, 0.6, 0.55, 0.7];
  let index = 0;
  const theme = createRandomTheme({ id: "iris", name: "Afterglow" }, () => values[index++]);

  assert.equal(theme.id, "iris");
  assert.equal(theme.name, "Afterglow");
  assert.equal(theme.custom, true);
  assert.equal(theme.version, 3);
  assert.match(theme.colors[0], /^oklch\(/);
  assert.match(theme.shaderColors[1], /^#[0-9a-f]{6}$/);
  assert.equal(theme.colors.length, 2);
  assert.equal(theme.shaderColors.length, 2);
  assert.deepEqual(Object.keys(theme.style), generatedThemeTokens);
});

test("varies two-color finishes across tonal and contrasting families", () => {
  const tonal = createRandomTheme({ id: "a", name: "Tonal" }, (() => { const values = [0.1, 0.1, 0.5, 0.5, 0.5, 0.5, 0.5]; let index = 0; return () => values[index++]; })());
  const contrast = createRandomTheme({ id: "b", name: "Contrast" }, (() => { const values = [0.8, 0.9, 0.8, 0.2, 0.2, 0.8, 0.9]; let index = 0; return () => values[index++]; })());

  assert.notDeepEqual(tonal.colors, contrast.colors);
  assert.notEqual(tonal.note, contrast.note);
});
