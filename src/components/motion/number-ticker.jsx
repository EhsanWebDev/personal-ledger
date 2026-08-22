"use client";
// beui.dev/components/motion/number

import { animate, useInView, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { EASE_OUT } from "@/lib/ease";
import { cn } from "@/lib/utils";

const DIGIT_HEIGHT_EM = 1.1;
const DIGITS = Array.from({ length: 10 }, (_, n) => n);
// One digit is exactly a tenth of the ten-digit column. Stepping in percent
// keeps the roll aligned whatever the font-size resolves to — `em` here was
// measured against a stale font-size and left digits parked between rows.
const DIGIT_STEP = 100 / DIGITS.length;
// Gap between a clipped column's bottom edge and the glyph baseline inside it.
const BASELINE_DROP_EM = -0.24;

export function NumberTicker({
  value,
  pad,
  duration = 0.9,
  stagger = 0.04,
  startOnView = true,
  prefix,
  suffix,
  blur = false,
  className,
  digitClassName,
  locale,
  format
}) {
  const containerRef = useRef(null);
  const inView = useInView(containerRef, { once: true, amount: 0.6 });
  const [armed, setArmed] = useState(!startOnView);

  useEffect(() => {
    if (!startOnView || armed) return;
    if (inView) return setArmed(true);
    // IntersectionObserver never reports while the document is hidden, so a
    // screen mounted in a backgrounded tab would sit on its placeholder
    // forever. Arm anyway — the reveal is a flourish, the value is not.
    const t = window.setTimeout(() => setArmed(true), 400);
    return () => window.clearTimeout(t);
  }, [startOnView, inView, armed]);

  const text = useMemo(() => {
    const rounded = Math.round(value);
    const formatted = format
      ? format(rounded)
      : locale
        ? rounded.toLocaleString()
        : rounded.toString();
    return pad ? formatted.padStart(pad, "0") : formatted;
  }, [value, pad, format, locale]);
  const glyphs = useMemo(() => {
    const chars = text.split("");
    // Key by place value (position from the right): a changing digit keeps its
    // identity and rolls to the new value instead of remounting and replaying
    // from 0. Growing numbers add glyphs on the left without re-keying the
    // ones, tens, hundreds already on screen.
    return chars.map((char, i) => ({ char, id: `g-${chars.length - 1 - i}` }));
  }, [text]);
  const readableText = `${prefix ?? ""}${text}${suffix ?? ""}`;

  // Stagger is an entrance flourish. Once the reveal has played, value
  // changes roll every digit immediately — a per-digit delay on live updates
  // reads as lag.
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    if (!armed || entered) return;
    const total = (duration + glyphs.length * stagger) * 1000;
    const t = window.setTimeout(() => setEntered(true), total);
    return () => window.clearTimeout(t);
  }, [armed, entered, duration, stagger, glyphs.length]);

  return (
    <span
      ref={containerRef}
      // The digit columns clip their overflow, so the flex box synthesises its
      // baseline from their bottom edge and inline tickers ride up like a
      // superscript. Drop the whole box back onto the text baseline — the nudge
      // has to live out here, since vertical-align does nothing on a flex item.
      style={{ verticalAlign: `${BASELINE_DROP_EM}em` }}
      className={cn("inline-flex items-center tabular-nums", className)}>
      <span className="sr-only">{readableText}</span>
      <span aria-hidden="true" className="inline-flex items-center">
        {prefix ? <span>{prefix}</span> : null}
        {glyphs.map(({ char, id }, i) => {
          const isDigit = /\d/.test(char);
          if (!isDigit) {
            return (
              <span key={id} className="inline-block">
                {char}
              </span>
            );
          }
          const digit = Number(char);
          return (
            <Digit
              key={id}
              digit={armed ? digit : 0}
              delay={entered ? 0 : i * stagger}
              duration={duration}
              blur={blur}
              className={digitClassName} />
          );
        })}
        {suffix ? <span>{suffix}</span> : null}
      </span>
    </span>
  );
}

function Digit({
  digit,
  delay,
  duration,
  blur,
  className
}) {
  const reduce = useReducedMotion();
  const columnRef = useRef(null);

  useEffect(() => {
    if (reduce || !blur || !columnRef.current || !Number.isFinite(digit)) {
      return;
    }

    const node = columnRef.current;
    const controls = animate(node, { filter: ["blur(10px)", "blur(0px)"] }, {
      duration: Math.min(duration * 0.75, 0.32),
      delay,
      ease: EASE_OUT,
    });

    return () => {
      controls.stop();
      node.style.filter = "blur(0px)";
    };
  }, [blur, delay, digit, duration, reduce]);

  return (
    <span
      className={cn("relative inline-block overflow-hidden", className)}
      style={{ height: `${DIGIT_HEIGHT_EM}em`, width: "1ch" }}>
      {/* The resting offset is plain CSS, not an animated value: a rAF-driven
          roll never settles while the document is hidden, which left every
          ticker parked on 0. The transition decorates the change; the
          transform alone is enough to be correct. */}
      <span
        ref={columnRef}
        style={{
          transform: `translateY(-${digit * DIGIT_STEP}%)`,
          transition: reduce ? "none" : `transform ${duration}s var(--ease-out) ${delay}s`,
        }}
        className="absolute inset-x-0 top-0 flex flex-col items-center will-change-[transform,filter]">
        {DIGITS.map((n) => (
          <span
            key={n}
            className="flex h-[1.1em] items-center justify-center leading-none">
            {n}
          </span>
        ))}
      </span>
    </span>
  );
}
