"use client";
// beui.dev/components/blocks/dynamic-island

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { EASE_OUT } from "@/lib/ease";
import { cn } from "@/lib/utils";

const IslandContext = createContext(null);

const SHELL_SPRING = {
  type: "spring",
  duration: 0.8,
  bounce: 0.2,
};

const CONTENT_SPRING = {
  type: "spring",
  duration: 0.8,
  bounce: 0.35,
};

const RADIUS = 32;
const PILL_WIDTH = 126;
const PILL_HEIGHT = 37;

function useContentSize() {
  const ref = useRef(null);
  const [size, setSize] = useState(null);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    setSize({ width: element.offsetWidth, height: element.offsetHeight });
  }, []);

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      setSize({ width: element.offsetWidth, height: element.offsetHeight });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return [ref, size];
}

function Slot({ keyId, children, className }) {
  const reduce = useReducedMotion();

  return (
    <motion.div
      key={keyId}
      initial={reduce
        ? { opacity: 0, filter: "blur(0px)" }
        : { opacity: 0, scale: 0.9, y: -8, filter: "blur(5px)" }}
      animate={reduce
        ? { opacity: 1, filter: "blur(0px)" }
        : { opacity: 1, scale: 1, y: 0, filter: "blur(0px)" }}
      exit={reduce
        ? { opacity: 0, filter: "blur(0px)", transition: { duration: 0.1 } }
        : {
            opacity: 0,
            scale: 0.9,
            y: -6,
            filter: "blur(0px)",
            transition: { duration: 0.08, ease: EASE_OUT },
          }}
      transition={reduce ? { duration: 0.15 } : CONTENT_SPRING}
      style={{ transformOrigin: "top center" }}
      className={cn("flex items-center justify-center", className)}
    >
      {children}
    </motion.div>
  );
}

export function DynamicIsland({ view, compact, children, className }) {
  const reduce = useReducedMotion();
  const expanded = view !== null;
  const [sizerRef, size] = useContentSize();
  const contextValue = useMemo(() => ({ view }), [view]);

  return (
    <IslandContext.Provider value={contextValue}>
      <motion.div
        role="status"
        aria-live="polite"
        initial={false}
        animate={size
          ? { width: size.width, height: size.height }
          : { width: PILL_WIDTH, height: PILL_HEIGHT }}
        transition={reduce ? { duration: 0 } : SHELL_SPRING}
        style={{ borderRadius: RADIUS }}
        className={cn(
          "relative inline-flex items-start justify-center overflow-hidden",
          "bg-foreground text-background shadow-2xl",
          className,
        )}
      >
        <div ref={sizerRef} className="w-max">
          <AnimatePresence mode="popLayout" initial={false}>
            {!expanded && compact ? (
              <Slot
                keyId="compact"
                className="min-h-[37px] min-w-[126px] gap-2 px-4 py-1.5 text-xs font-medium"
              >
                {compact}
              </Slot>
            ) : null}
          </AnimatePresence>
          {children}
        </div>
      </motion.div>
    </IslandContext.Provider>
  );
}

export function DynamicIslandView({ id, children, className }) {
  const context = useContext(IslandContext);
  if (!context) {
    throw new Error("DynamicIslandView must be used inside <DynamicIsland>");
  }

  return (
    <AnimatePresence mode="popLayout" initial={false}>
      {context.view === id ? (
        <Slot keyId={id} className={cn("px-6 py-4", className)}>
          {children}
        </Slot>
      ) : null}
    </AnimatePresence>
  );
}
