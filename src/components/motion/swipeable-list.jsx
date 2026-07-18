"use client";
// beui.dev/components/blocks/swipeable-list

import { animate, motion, useMotionValue, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

// Distance-based release spring keeps short rebounds and full reveals feeling
// equally direct, closer to native mobile list interactions.
const ROW_SETTLE = {
  type: "spring",
  stiffness: 560,
  damping: 48,
  mass: 0.82,
  restDelta: 0.5,
  restSpeed: 8
};
const OPEN_DISTANCE_RATIO = 0.46;
const CLOSE_DISTANCE_RATIO = 0.72;
const OPEN_VELOCITY = 720;
const CLOSE_VELOCITY = 320;
const FLING_DISTANCE = 14;
const RELEASE_VELOCITY_LIMIT = 1500;

const ACTION_TONE_CLASS = {
  neutral: "text-muted-foreground group-hover:text-foreground",
  primary: "text-foreground",
  success: "text-emerald-600 dark:text-emerald-400",
  warning: "text-amber-600 dark:text-amber-400",
  danger: "text-destructive",
};

function useControllableSwipeValue({
  value,
  defaultValue,
  onValueChange
}) {
  const [internalValue, setInternalValue] = useState(defaultValue ?? null);
  const isControlled = value !== undefined;
  const currentValue = value ?? internalValue;

  const setValue = useCallback((next) => {
    if (!isControlled) {
      setInternalValue(next);
    }

    onValueChange?.(next);
  }, [isControlled, onValueChange]);

  return [currentValue, setValue];
}

function isActionableSide(value, sideWidth) {
  return sideWidth > 0 && Math.abs(value) > 0;
}

function clampReleaseVelocity(velocity) {
  return Math.max(-RELEASE_VELOCITY_LIMIT, Math.min(RELEASE_VELOCITY_LIMIT, velocity));
}

function SwipeActionButton({
  action,
  actionWidth,
  side,
  focusable,
  onAction,
  className
}) {
  return (
    <button
      type="button"
      disabled={action.disabled}
      tabIndex={focusable ? 0 : -1}
      aria-label={typeof action.label === "string" ? action.label : undefined}
      onClick={() => onAction(action, side)}
      className={cn(
        "group flex h-full shrink-0 items-center justify-center outline-none",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "disabled:pointer-events-none disabled:opacity-50",
        className
      )}
      style={{ width: actionWidth }}>
      <span
        className={cn(
          "grid size-9 place-items-center rounded-full transition-[background-color,color,transform] duration-150 group-hover:bg-background group-active:scale-[0.96]",
          ACTION_TONE_CLASS[action.tone ?? "neutral"]
        )}>
        {action.icon}
      </span>
      <span className="sr-only">{action.label}</span>
    </button>
  );
}

function SwipeableListRow({
  item,
  actionWidth,
  revealThreshold,
  openValue,
  setOpenValue,
  closeOnAction,
  onAction,
  classNames,
  renderItem
}) {
  const reduce = useReducedMotion();
  const x = useMotionValue(0);
  const animationRef = useRef(null);
  const commandedTargetRef = useRef(0);
  const leftActions = item.leftActions ?? [];
  const rightActions = item.rightActions ?? [];
  const leftWidth = leftActions.length * actionWidth;
  const rightWidth = rightActions.length * actionWidth;
  const openSide = openValue?.id === item.id ? openValue.side : null;
  const targetX =
    openSide === "left" ? leftWidth : openSide === "right" ? -rightWidth : 0;

  const settleX = useCallback((nextX, velocity = 0) => {
    commandedTargetRef.current = nextX;
    animationRef.current?.stop();

    if (reduce) {
      x.set(nextX);
      return;
    }

    animationRef.current = animate(x, nextX, {
      ...ROW_SETTLE,
      velocity: clampReleaseVelocity(velocity),
      onComplete: () => x.set(nextX),
    });
  }, [reduce, x]);

  useEffect(() => {
    return () => animationRef.current?.stop();
  }, []);

  useEffect(() => {
    if (commandedTargetRef.current === targetX) {
      return;
    }

    settleX(targetX);
  }, [settleX, targetX]);

  const getTargetX = useCallback((side) =>
    side === "left" ? leftWidth : side === "right" ? -rightWidth : 0, [leftWidth, rightWidth]);

  const snapTo = useCallback((side, velocity = 0) => {
    setOpenValue(side ? { id: item.id, side } : null);
    settleX(getTargetX(side), velocity);
  }, [getTargetX, item.id, setOpenValue, settleX]);

  const onDragStart = useCallback(() => {
    animationRef.current?.stop();

    if (openValue && openValue.id !== item.id) {
      setOpenValue(null);
    }
  }, [item.id, openValue, setOpenValue]);

  const onDragEnd = useCallback((_, info) => {
    const velocity = info.velocity.x;
    const latest = x.get();
    const leftOpenThreshold = Math.max(revealThreshold, leftWidth * OPEN_DISTANCE_RATIO);
    const rightOpenThreshold = Math.max(revealThreshold, rightWidth * OPEN_DISTANCE_RATIO);

    if (openSide === "left") {
      if (
        latest < leftWidth * CLOSE_DISTANCE_RATIO ||
        velocity < -CLOSE_VELOCITY
      ) {
        snapTo(null, velocity);
        return;
      }

      snapTo("left", velocity);
      return;
    }

    if (openSide === "right") {
      if (
        Math.abs(latest) < rightWidth * CLOSE_DISTANCE_RATIO ||
        velocity > CLOSE_VELOCITY
      ) {
        snapTo(null, velocity);
        return;
      }

      snapTo("right", velocity);
      return;
    }

    if (
      isActionableSide(latest, leftWidth) &&
      (latest > leftOpenThreshold ||
        (velocity > OPEN_VELOCITY && latest > FLING_DISTANCE))
    ) {
      snapTo("left", velocity);
      return;
    }

    if (
      isActionableSide(latest, rightWidth) &&
      (latest < -rightOpenThreshold ||
        (velocity < -OPEN_VELOCITY && latest < -FLING_DISTANCE))
    ) {
      snapTo("right", velocity);
      return;
    }

    snapTo(null, velocity);
  }, [
    leftWidth,
    openSide,
    revealThreshold,
    rightWidth,
    snapTo,
    x,
  ]);

  const handleAction = useCallback((action, side) => {
    action.onClick?.(item);
    onAction?.({ item, action, side });

    if (closeOnAction) {
      snapTo(null);
    }
  }, [closeOnAction, item, onAction, snapTo]);

  const defaultContent = (
    <div className="flex min-w-0 items-center gap-3">
      {item.leading ? (
        <div className={cn("shrink-0", classNames?.leading)}>
          {item.leading}
        </div>
      ) : null}
      <div className={cn("min-w-0 flex-1", classNames?.content)}>
        {item.title ? (
          <div
            className={cn("truncate text-sm font-medium text-foreground", classNames?.title)}>
            {item.title}
          </div>
        ) : null}
        {item.description ? (
          <div
            className={cn("mt-0.5 truncate text-xs text-muted-foreground", classNames?.description)}>
            {item.description}
          </div>
        ) : null}
      </div>
      {item.meta ? (
        <div
          className={cn("shrink-0 text-xs font-medium text-muted-foreground", classNames?.meta)}>
          {item.meta}
        </div>
      ) : null}
    </div>
  );

  return (
    <div
      className={cn(
        "relative isolate overflow-hidden rounded-2xl bg-muted",
        item.disabled && "opacity-60",
        classNames?.item
      )}>
      <div
        aria-hidden={!openSide}
        className={cn("absolute inset-0 z-0 flex overflow-hidden rounded-2xl", classNames?.rail)}>
        <div className="flex h-full overflow-hidden rounded-l-2xl">
          {leftActions.map((action) => (
            <SwipeActionButton
              key={action.id}
              action={action}
              actionWidth={actionWidth}
              className={classNames?.action}
              focusable={openSide === "left"}
              onAction={handleAction}
              side="left" />
          ))}
        </div>
        <div className="ml-auto flex h-full overflow-hidden rounded-r-2xl">
          {rightActions.map((action) => (
            <SwipeActionButton
              key={action.id}
              action={action}
              actionWidth={actionWidth}
              className={classNames?.action}
              focusable={openSide === "right"}
              onAction={handleAction}
              side="right" />
          ))}
        </div>
      </div>
      <motion.div
        drag={item.disabled ? false : "x"}
        dragConstraints={{ left: -rightWidth, right: leftWidth }}
        dragElastic={0.04}
        dragMomentum={false}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        style={{ x }}
        className={cn(
          "relative z-10 min-h-[72px] cursor-grab touch-pan-y select-none rounded-2xl border border-border bg-card px-4 py-3 shadow-sm active:cursor-grabbing",
          classNames?.surface
        )}>
        {renderItem ? renderItem(item) : item.content ?? defaultContent}
      </motion.div>
    </div>
  );
}

export function SwipeableList({
  items,
  value,
  defaultValue = null,
  onValueChange,
  onAction,
  actionWidth = 56,
  revealThreshold = 34,
  closeOnAction = true,
  className,
  classNames,
  renderItem
}) {
  const [openValue, setOpenValue] = useControllableSwipeValue({
    value,
    defaultValue,
    onValueChange,
  });

  return (
    <div className={cn("flex w-full flex-col gap-2", className, classNames?.root)}>
      {items.map((item) => (
        <SwipeableListRow
          key={item.id}
          item={item}
          actionWidth={actionWidth}
          revealThreshold={revealThreshold}
          openValue={openValue}
          setOpenValue={setOpenValue}
          closeOnAction={closeOnAction}
          onAction={onAction}
          classNames={classNames}
          renderItem={renderItem} />
      ))}
    </div>
  );
}
