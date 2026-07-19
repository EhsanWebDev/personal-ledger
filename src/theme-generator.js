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

const baseNames = ["coal", "ember", "espresso", "olive", "moss", "pine", "teal", "abyss", "navy", "ink", "plum", "wine"];
const accentNames = ["pomegranate", "coral", "apricot", "brass", "chartreuse", "mint", "aqua", "ice", "sky", "periwinkle", "orchid", "rose"];
const chromaCaps = [0.18, 0.16, 0.15, 0.16, 0.17, 0.13, 0.1, 0.11, 0.13, 0.15, 0.16, 0.18];

const wrapHue = (hue) => (hue + 360) % 360;
const oklch = (lightness, chroma, hue, alpha) => `oklch(${lightness.toFixed(3)} ${chroma.toFixed(3)} ${wrapHue(hue).toFixed(1)}${alpha === undefined ? "" : ` / ${alpha}`})`;
const colorName = (names, hue) => names[Math.floor(wrapHue(hue) / 30)];

function oklchToRgb(lightness, chroma, hue) {
  const radians = wrapHue(hue) * Math.PI / 180;
  const a = chroma * Math.cos(radians);
  const b = chroma * Math.sin(radians);
  const lPrime = lightness + 0.3963377774 * a + 0.2158037573 * b;
  const mPrime = lightness - 0.1055613458 * a - 0.0638541728 * b;
  const sPrime = lightness - 0.0894841775 * a - 1.291485548 * b;
  const l = lPrime ** 3;
  const m = mPrime ** 3;
  const s = sPrime ** 3;
  const linear = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];

  return linear.map((channel) => {
    const value = channel <= 0.0031308 ? 12.92 * channel : 1.055 * channel ** (1 / 2.4) - 0.055;
    return Math.round(Math.min(1, Math.max(0, value)) * 255);
  });
}

const toHex = (rgb) => `#${rgb.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;

export function createRandomTheme({ id, name }, random = Math.random) {
  const accentHue = Math.floor(random() * 360);
  const tonal = random() < 0.82;
  const baseOffset = tonal ? Math.round(random() * 30 - 15) : Math.round(45 + random() * 45);
  const baseHue = wrapHue(accentHue + baseOffset);
  const baseLightness = 0.14 + random() * 0.022;
  const baseChroma = 0.008 + random() * 0.022;
  const accentLightness = 0.72 + random() * 0.11;
  const accentCap = chromaCaps[Math.floor(accentHue / 30)];
  const accentChroma = accentCap * (0.42 + random() * 0.58);
  const accentRgb = oklchToRgb(accentLightness, accentChroma, accentHue);
  const background = oklch(baseLightness, baseChroma, baseHue);
  const accent = oklch(accentLightness, accentChroma, accentHue);
  const surface = oklch(baseLightness + 0.065, Math.min(0.04, baseChroma + 0.012), baseHue);
  const muted = oklch(0.7, Math.min(0.04, baseChroma + 0.012), baseHue);
  const heading = oklch(0.975, 0.012, accentHue);

  return {
    id,
    name,
    note: `${colorName(baseNames, baseHue)} & ${colorName(accentNames, accentHue)}`,
    colors: [background, accent],
    shaderColors: [toHex(oklchToRgb(baseLightness, baseChroma, baseHue)), toHex(accentRgb)],
    veilHue: Math.round(accentHue - 180),
    custom: true,
    version: 3,
    style: {
      "--bg": background,
      "--surface": oklch(baseLightness + 0.085, Math.min(0.045, baseChroma + 0.015), baseHue, 0.66),
      "--surface-solid": surface,
      "--glass": oklch(baseLightness + 0.085, Math.min(0.045, baseChroma + 0.015), baseHue, 0.48),
      "--glass-border": oklch(0.95, 0.014, accentHue, 0.15),
      "--text": oklch(0.94, 0.014, accentHue),
      "--heading": heading,
      "--muted": muted,
      "--accent": accent,
      "--accent-rgb": accentRgb.join(", "),
      "--accent-ink": oklch(0.16, 0.02, baseHue),
      "--glow-a": oklch(0.68, Math.min(0.13, accentChroma), accentHue, 0.32),
      "--glow-b": oklch(0.62, Math.min(0.08, baseChroma + 0.04), baseHue, 0.15),
    },
  };
}
