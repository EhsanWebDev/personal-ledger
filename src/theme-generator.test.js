import assert from "node:assert/strict";
import test from "node:test";
import { contrastOf, createRandomTheme, createThemeVariants, generatedThemeTokens } from "./theme-generator.js";

const seeded = (seed) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let value = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
  return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
};
const rolls = (count) => Array.from({ length: count }, (_, index) => createRandomTheme({ id: "iris", name: "Roll" }, seeded(index * 7919)));

test("creates a complete, deterministic theme replacement", () => {
  const theme = createRandomTheme({ id: "iris", name: "Afterglow" }, seeded(42));

  assert.equal(theme.id, "iris");
  assert.equal(theme.name, "Afterglow");
  assert.equal(theme.custom, true);
  assert.equal(theme.version, 4);
  assert.equal(theme.colors.length, 2);
  assert.equal(theme.palette.length, 4);
  assert.match(theme.colors[0], /^oklch\(/);
  assert.match(theme.shaderColors[1], /^#[0-9a-f]{6}$/);
  assert.match(theme.note, /^[A-Z]/);
  assert.ok(theme.finish && theme.harmony);
  assert.deepEqual(Object.keys(theme.style), generatedThemeTokens);
  assert.deepEqual(theme, createRandomTheme({ id: "iris", name: "Afterglow" }, seeded(42)));
});

test("spans finishes, harmonies and ground depth instead of one tonal recipe", () => {
  const themes = rolls(240);
  const depths = themes.map(({ style }) => Number(style["--bg"].match(/oklch\(([\d.]+)/)[1]));

  assert.ok(new Set(themes.map(({ finish }) => finish)).size >= 8);
  assert.ok(new Set(themes.map(({ harmony }) => harmony)).size >= 6);
  assert.ok(new Set(themes.map(({ note }) => note)).size >= 60);
  assert.ok(Math.max(...depths) - Math.min(...depths) > 0.09);
});

test("keeps every roll readable against its own ground", () => {
  for (const { style } of rolls(240)) {
    assert.ok(contrastOf(style["--text"], style["--bg"]) >= 10.5);
    assert.ok(contrastOf(style["--muted"], style["--bg"]) >= 4.5);
    assert.ok(contrastOf(style["--accent"], style["--bg"]) >= 4);
    assert.ok(contrastOf(style["--accent-ink"], style["--accent"]) >= 4.5);
  }
});

test("deals a batch of variations around the hue wheel", () => {
  const variants = createThemeVariants({ id: "iris", name: "Roll" }, 6, seeded(11));
  const hues = variants.map(({ style }) => Number(style["--accent"].match(/oklch\([\d.]+ [\d.]+ ([\d.]+)/)[1]));

  assert.equal(variants.length, 6);
  assert.equal(new Set(hues.map((hue) => Math.floor(hue / 30))).size, 6);
  assert.equal(new Set(variants.map(({ note }) => note)).size, 6);
});
