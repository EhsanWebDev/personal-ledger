"use client";
// beui.dev/components/motion/shader-background

import {
  ColorPanels,
  Dithering,
  DotGrid,
  DotOrbit,
  GodRays,
  GrainGradient,
  Metaballs,
  MeshGradient,
  NeuroNoise,
  PerlinNoise,
  PulsingBorder,
  SimplexNoise,
  SmokeRing,
  Spiral,
  StaticMeshGradient,
  StaticRadialGradient,
  Swirl,
  Voronoi,
  Warp,
  Water,
  Waves,
} from "@paper-design/shaders-react";
import { useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

const VARIANT_COMPONENTS = {
  "mesh-gradient": MeshGradient,
  "grain-gradient": GrainGradient,
  "dot-grid": DotGrid,
  "dot-orbit": DotOrbit,
  warp: Warp,
  waves: Waves,
  water: Water,
  voronoi: Voronoi,
  swirl: Swirl,
  "smoke-ring": SmokeRing,
  "static-radial-gradient": StaticRadialGradient,
  "neuro-noise": NeuroNoise,
  metaballs: Metaballs,
  "god-rays": GodRays,
  spiral: Spiral,
  dithering: Dithering,
  "pulsing-border": PulsingBorder,
  "color-panels": ColorPanels,
  "static-mesh-gradient": StaticMeshGradient,
  "simplex-noise": SimplexNoise,
  "perlin-noise": PerlinNoise,
};

export const SHADER_BACKGROUND_VARIANTS = Object.keys(VARIANT_COMPONENTS);

/**
 * Not every variant animates (e.g. dot-grid is a static pattern), so `speed`
 * is only frozen for reduced motion when the variant actually exposes it.
 */
export function ShaderBackground({ variant, className, ...rest }) {
  const reducedMotion = useReducedMotion();
  const Shader = VARIANT_COMPONENTS[variant];
  const props = rest;
  const speedProps = reducedMotion && "speed" in props ? { speed: 0 } : {};

  return <Shader {...props} {...speedProps} className={cn("h-full w-full", className)} />;
}
