"use client";
// beui.dev/components/motion/loader

import { motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { EASE_IN_OUT } from "@/lib/ease";
import { cn } from "@/lib/utils";

const SCRAMBLE_TARGET = "LOADING";
const SCRAMBLE_GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<>/*#@";

export function Loader({
  variant = "dots",
  size = 32,
  speed = 1,
  label = "Loading",
  className,
}) {
  const reduce = useReducedMotion() ?? false;

  return (
    <span
      role="status"
      aria-label={label}
      className={cn("inline-flex items-center justify-center text-foreground", className)}
    >
      {variant === "dots" ? (
        <Dots size={size} speed={speed} reduce={reduce} />
      ) : (
        <Scramble size={size} speed={speed} reduce={reduce} />
      )}
      <span className="sr-only">{label}</span>
    </span>
  );
}

function Dots({ size, speed, reduce }) {
  const dot = size * 0.24;

  return (
    <span className="flex items-center" style={{ gap: size * 0.14 }}>
      {[0, 1, 2].map((index) => (
        <motion.span
          key={index}
          className="rounded-full bg-current"
          style={{ width: dot, height: dot }}
          animate={reduce
            ? { opacity: [0.4, 1, 0.4] }
            : { y: [0, -size * 0.3, 0], opacity: [0.5, 1, 0.5] }}
          transition={{
            duration: speed,
            ease: EASE_IN_OUT,
            repeat: Infinity,
            delay: index * speed * 0.16,
          }}
        />
      ))}
    </span>
  );
}

function Scramble({ size, speed, reduce }) {
  const [value, setValue] = useState(SCRAMBLE_TARGET);

  useEffect(() => {
    if (reduce) {
      setValue(SCRAMBLE_TARGET);
      return undefined;
    }

    let tick = 0;
    const total = SCRAMBLE_TARGET.length + 4;
    const interval = window.setInterval(() => {
      const reveal = tick % total;
      setValue(Array.from(SCRAMBLE_TARGET, (letter, index) => (
        index < reveal
          ? letter
          : SCRAMBLE_GLYPHS[Math.floor(Math.random() * SCRAMBLE_GLYPHS.length)]
      )).join(""));
      tick += 1;
    }, (speed / SCRAMBLE_TARGET.length) * 550);

    return () => window.clearInterval(interval);
  }, [reduce, speed]);

  return (
    <span
      className="font-mono font-medium tracking-[0.2em] tabular-nums"
      style={{ fontSize: size * 0.42 }}
    >
      {value}
    </span>
  );
}
