export const generatedThemeTokens = [
  "--bg",
  "--surface",
  "--surface-solid",
  "--glass",
  "--glass-border",
  "--text",
  "--heading",
  "--muted",
  "--accent",
  "--accent-rgb",
  "--accent-ink",
  "--glow-a",
  "--glow-b",
];

const wrapHue = (hue) => ((hue % 360) + 360) % 360;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const between = (random, [min, max]) => min + random() * (max - min);
const swing = (random, min, max) => (random() < 0.5 ? -1 : 1) * (min + random() * (max - min));
const pickWeighted = (random, items) => {
  let ticket = random() * items.reduce((total, item) => total + item.weight, 0);
  return items.find((item) => (ticket -= item.weight) < 0) ?? items[items.length - 1];
};

/* How far the background hue sits from the accent, and where the second glow lands.
   The old generator only ever drew a tonal pair, so every roll looked like the last. */
const harmonies = [
  { id: "mono", label: "Monochrome", weight: 9, spread: (random) => [swing(random, 0, 10), swing(random, 8, 26)] },
  { id: "analogous", label: "Analogous", weight: 14, spread: (random) => [swing(random, 18, 46), swing(random, 24, 62)] },
  { id: "adjacent", label: "Adjacent", weight: 10, spread: (random) => [swing(random, 55, 95), swing(random, 30, 80)] },
  { id: "split", label: "Split complement", weight: 12, spread: (random) => { const side = random() < 0.5 ? -1 : 1; return [side * (148 + random() * 26), -side * (148 + random() * 26)]; } },
  { id: "complement", label: "Complementary", weight: 11, spread: (random) => [180 + swing(random, 0, 12), swing(random, 150, 180)] },
  { id: "triad", label: "Triadic", weight: 10, spread: (random) => { const side = random() < 0.5 ? -1 : 1; return [side * (112 + random() * 16), -side * (112 + random() * 16)]; } },
  { id: "neutral", label: "Neutral ground", weight: 12, baseChromaScale: 0.18, spread: (random) => [swing(random, 0, 180), swing(random, 20, 70)] },
];

/* Each finish is a whole tonal envelope — how deep the ground sits, how much
   chroma it carries, and where the accent lives. Ranges overlap as little as
   possible so two rolls from different finishes never read as the same theme. */
const finishes = [
  { id: "obsidian", label: "Obsidian", weight: 11, bgLightness: [0.095, 0.125], bgChroma: [0.006, 0.028], lift: [0.075, 0.1], accentLightness: [0.74, 0.86], accentChroma: [0.45, 0.72], minContrast: 5.5, glow: [0.34, 0.16], mutedLightness: 0.7, borderAlpha: 0.13 },
  { id: "ink", label: "Ink", weight: 11, bgLightness: [0.135, 0.17], bgChroma: [0.012, 0.038], lift: [0.06, 0.09], accentLightness: [0.72, 0.84], accentChroma: [0.4, 0.68], minContrast: 5, glow: [0.32, 0.15], mutedLightness: 0.7, borderAlpha: 0.15 },
  { id: "dusk", label: "Dusk", weight: 9, bgLightness: [0.185, 0.235], bgChroma: [0.018, 0.05], lift: [0.05, 0.075], accentLightness: [0.74, 0.85], accentChroma: [0.3, 0.55], minContrast: 4.5, glow: [0.26, 0.14], mutedLightness: 0.74, borderAlpha: 0.17, accentWord: "hazy" },
  { id: "stone", label: "Stone", weight: 9, bgLightness: [0.15, 0.205], bgChroma: [0.002, 0.01], lift: [0.06, 0.085], accentLightness: [0.72, 0.86], accentChroma: [0.28, 0.5], minContrast: 5, glow: [0.24, 0.12], mutedLightness: 0.72, borderAlpha: 0.14 },
  { id: "neon", label: "Neon", weight: 10, bgLightness: [0.085, 0.115], bgChroma: [0.008, 0.03], lift: [0.07, 0.1], accentLightness: [0.7, 0.82], accentChroma: [0.86, 1], minContrast: 6, glow: [0.42, 0.2], mutedLightness: 0.68, borderAlpha: 0.12, accentWord: "neon" },
  { id: "pastel", label: "Pastel", weight: 9, bgLightness: [0.15, 0.2], bgChroma: [0.014, 0.04], lift: [0.06, 0.09], accentLightness: [0.86, 0.93], accentChroma: [0.18, 0.36], minContrast: 6, glow: [0.24, 0.13], mutedLightness: 0.74, borderAlpha: 0.16, accentWord: "soft" },
  { id: "ember", label: "Ember", weight: 9, bgLightness: [0.12, 0.16], bgChroma: [0.028, 0.058], lift: [0.065, 0.095], accentLightness: [0.62, 0.72], accentChroma: [0.72, 0.96], minContrast: 4.2, glow: [0.36, 0.18], mutedLightness: 0.7, borderAlpha: 0.15, accentWord: "molten" },
  { id: "porcelain", label: "Porcelain", weight: 8, bgLightness: [0.14, 0.195], bgChroma: [0.006, 0.028], lift: [0.06, 0.085], accentLightness: [0.9, 0.965], accentChroma: [0.05, 0.16], minContrast: 8, glow: [0.2, 0.12], mutedLightness: 0.72, borderAlpha: 0.18 },
  { id: "velvet", label: "Velvet", weight: 9, bgLightness: [0.165, 0.215], bgChroma: [0.042, 0.075], lift: [0.055, 0.08], accentLightness: [0.76, 0.87], accentChroma: [0.36, 0.62], minContrast: 4.6, glow: [0.3, 0.2], mutedLightness: 0.74, borderAlpha: 0.16, accentWord: "dusty" },
];

const baseNames = ["ember", "brick", "rust", "clay", "umber", "espresso", "olive", "moss", "fern", "forest", "pine", "jade", "teal", "lagoon", "abyss", "harbor", "navy", "indigo", "midnight", "iris", "plum", "mulberry", "wine", "garnet"];
const accentNames = ["coral", "salmon", "apricot", "amber", "brass", "citron", "chartreuse", "lime", "spring", "emerald", "mint", "seafoam", "aqua", "turquoise", "sky", "azure", "cornflower", "periwinkle", "lavender", "violet", "orchid", "magenta", "fuchsia", "rose"];
const neutralBaseNames = ["coal", "graphite", "basalt", "slate", "ash", "pewter", "onyx", "charcoal"];
const neutralAccentNames = ["porcelain", "pearl", "bone", "chalk", "frost", "silver", "ivory", "linen"];

function oklchToLinearRgb(lightness, chroma, hue) {
  const radians = wrapHue(hue) * Math.PI / 180;
  const a = chroma * Math.cos(radians);
  const b = chroma * Math.sin(radians);
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;

  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

const encodeChannel = (channel) => {
  const value = channel <= 0.0031308 ? 12.92 * channel : 1.055 * channel ** (1 / 2.4) - 0.055;
  return Math.round(clamp(value, 0, 1) * 255);
};
const oklchToRgb = (lightness, chroma, hue) => oklchToLinearRgb(lightness, chroma, hue).map(encodeChannel);
const inGamut = (lightness, chroma, hue) => oklchToLinearRgb(lightness, chroma, hue).every((channel) => channel >= -0.0002 && channel <= 1.0002);

/* Chroma the hue can actually hold at this lightness. Asking for more doesn't
   fail loudly — sRGB clips per channel, which twists the hue and lands every
   over-saturated accent on the same flat wall. A fixed per-hue cap can't know
   that, so it gets searched instead. */
function fitChroma(lightness, chroma, hue) {
  if (inGamut(lightness, chroma, hue)) return chroma;
  let low = 0;
  let high = chroma;
  for (let step = 0; step < 16; step += 1) {
    const mid = (low + high) / 2;
    if (inGamut(lightness, mid, hue)) low = mid; else high = mid;
  }
  return low;
}

const chromaCeiling = (lightness, hue) => fitChroma(lightness, 0.42, hue);
const tone = (lightness, chroma, hue) => ({ lightness: clamp(lightness, 0, 1), chroma: fitChroma(clamp(lightness, 0, 1), Math.max(0, chroma), hue), hue: wrapHue(hue) });
const css = ({ lightness, chroma, hue }, alpha) => `oklch(${lightness.toFixed(3)} ${chroma.toFixed(3)} ${hue.toFixed(1)}${alpha === undefined ? "" : ` / ${alpha}`})`;
const rgbOf = ({ lightness, chroma, hue }) => oklchToRgb(lightness, chroma, hue);
const hexOf = (value) => `#${rgbOf(value).map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
const alphaOf = (random, value) => Number((value * (0.9 + random() * 0.2)).toFixed(2));

const relativeLuminance = (rgb) => {
  const [r, g, b] = rgb.map((channel) => { const value = channel / 255; return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const first = relativeLuminance(a);
  const second = relativeLuminance(b);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
};

/* Widening the envelopes means a roll can land unreadable, so instead of
   rejecting it the tone is walked up until it clears its target. */
function liftToContrast(target, candidate, backdrop, ceiling = 0.98) {
  let lifted = tone(candidate.lightness, candidate.chroma, candidate.hue);
  while (lifted.lightness < ceiling && contrast(rgbOf(lifted), backdrop) < target) {
    lifted = tone(Math.min(ceiling, lifted.lightness + 0.015), candidate.chroma, candidate.hue);
  }
  return lifted;
}

const parseOklch = (value) => value.match(/oklch\(([\d.]+) ([\d.]+) ([\d.]+)/).slice(1).map(Number);
export const contrastOf = (first, second) => contrast(oklchToRgb(...parseOklch(first)), oklchToRgb(...parseOklch(second)));

const nameFor = (names, neutrals, { chroma, hue }, threshold) => (chroma < threshold ? neutrals[Math.floor(wrapHue(hue) / 45)] : names[Math.floor(wrapHue(hue) / 15)]);
const capitalize = (value) => value.charAt(0).toUpperCase() + value.slice(1);

export function createRandomTheme({ id, name, hue }, random = Math.random) {
  const accentHue = wrapHue(Number.isFinite(hue) ? hue : random() * 360);
  const harmony = pickWeighted(random, harmonies);
  const finish = pickWeighted(random, finishes);
  const [baseOffset, secondOffset] = harmony.spread(random);
  const baseHue = wrapHue(accentHue + baseOffset);
  const secondHue = wrapHue(accentHue + secondOffset);

  const background = tone(between(random, finish.bgLightness), between(random, finish.bgChroma) * (harmony.baseChromaScale ?? 1), baseHue);
  const backgroundRgb = rgbOf(background);
  const accentLightness = between(random, finish.accentLightness);
  const accent = liftToContrast(finish.minContrast, { lightness: accentLightness, chroma: chromaCeiling(accentLightness, accentHue) * between(random, finish.accentChroma), hue: accentHue }, backgroundRgb, 0.94);
  const accentRgb = rgbOf(accent);

  const lift = between(random, finish.lift);
  const surface = tone(background.lightness + lift, background.chroma * 1.35 + 0.004, baseHue);
  const muted = liftToContrast(4.6, { lightness: finish.mutedLightness, chroma: Math.min(0.045, background.chroma + 0.016), hue: baseHue }, backgroundRgb);
  const text = liftToContrast(11, { lightness: 0.94, chroma: Math.min(0.02, accent.chroma * 0.12), hue: accentHue }, backgroundRgb);
  const heading = tone(Math.min(0.985, text.lightness + 0.035), text.chroma * 0.8, accentHue);
  const darkInk = tone(Math.min(0.2, background.lightness + 0.04), Math.min(0.032, background.chroma + 0.012), baseHue);
  const lightInk = tone(0.97, 0.012, accentHue);
  const accentInk = contrast(rgbOf(darkInk), accentRgb) >= contrast(rgbOf(lightInk), accentRgb) ? darkInk : lightInk;
  const glowAccent = tone(Math.max(0.5, accent.lightness - 0.06), Math.min(0.17, accent.chroma), accentHue);
  const glowSecond = tone(between(random, [0.58, 0.72]), chromaCeiling(0.65, secondHue) * between(random, [0.3, 0.6]), secondHue);
  const surfaceAlpha = Number(between(random, [0.6, 0.72]).toFixed(2));

  return {
    id,
    name,
    note: capitalize(`${nameFor(baseNames, neutralBaseNames, background, 0.014)} & ${finish.accentWord ? `${finish.accentWord} ` : ""}${nameFor(accentNames, neutralAccentNames, accent, 0.035)}`),
    finish: finish.label,
    harmony: harmony.label,
    colors: [css(background), css(accent)],
    palette: [css(background), css(surface), css(glowSecond), css(accent)],
    shaderColors: [hexOf(background), hexOf(accent)],
    veilHue: Math.round(accent.hue) - 180,
    custom: true,
    version: 4,
    style: {
      "--bg": css(background),
      "--surface": css(surface, surfaceAlpha),
      "--surface-solid": css(surface),
      "--glass": css(surface, Number((surfaceAlpha - 0.18).toFixed(2))),
      "--glass-border": css(tone(0.95, 0.014, accentHue), alphaOf(random, finish.borderAlpha)),
      "--text": css(text),
      "--heading": css(heading),
      "--muted": css(muted),
      "--accent": css(accent),
      "--accent-rgb": accentRgb.join(", "),
      "--accent-ink": css(accentInk),
      "--glow-a": css(glowAccent, alphaOf(random, finish.glow[0])),
      "--glow-b": css(glowSecond, alphaOf(random, finish.glow[1])),
    },
  };
}

/* One press should offer a spread, not a single lucky roll — accent hues are
   dealt around the wheel so the batch can't come back as six of the same. */
export function createThemeVariants(seed, count = 6, random = Math.random) {
  const start = random() * 360;
  return Array.from({ length: count }, (_, index) => createRandomTheme({ ...seed, hue: start + (index * 360) / count + swing(random, 0, 180 / count) }, random));
}
