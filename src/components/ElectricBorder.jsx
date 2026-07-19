import { useCallback, useEffect, useRef } from "react";
import "./ElectricBorder.css";

export default function ElectricBorder({
  children,
  color = "#5227ff",
  speed = 1,
  chaos = 0.12,
  borderRadius = 24,
  className,
  style,
}) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const animationRef = useRef(null);
  const timeRef = useRef(0);
  const lastFrameTimeRef = useRef(0);

  const random = useCallback((x) => (Math.sin(x * 12.9898) * 43758.5453) % 1, []);

  const noise2D = useCallback((x, y) => {
    const i = Math.floor(x);
    const j = Math.floor(y);
    const fx = x - i;
    const fy = y - j;
    const a = random(i + j * 57);
    const b = random(i + 1 + j * 57);
    const c = random(i + (j + 1) * 57);
    const d = random(i + 1 + (j + 1) * 57);
    const ux = fx * fx * (3 - 2 * fx);
    const uy = fy * fy * (3 - 2 * fy);

    return a * (1 - ux) * (1 - uy) + b * ux * (1 - uy) + c * (1 - ux) * uy + d * ux * uy;
  }, [random]);

  const octavedNoise = useCallback((x, octaves, lacunarity, gain, baseAmplitude, baseFrequency, time, seed, baseFlatness) => {
    let y = 0;
    let amplitude = baseAmplitude;
    let frequency = baseFrequency;

    for (let i = 0; i < octaves; i += 1) {
      y += amplitude * (i === 0 ? baseFlatness : 1) * noise2D(frequency * x + seed * 100, time * frequency * 0.3);
      frequency *= lacunarity;
      amplitude *= gain;
    }

    return y;
  }, [noise2D]);

  const getCornerPoint = useCallback((centerX, centerY, radius, startAngle, arcLength, progress) => {
    const angle = startAngle + progress * arcLength;
    return { x: centerX + radius * Math.cos(angle), y: centerY + radius * Math.sin(angle) };
  }, []);

  const getRoundedRectPoint = useCallback((t, left, top, width, height, radius) => {
    const straightWidth = width - 2 * radius;
    const straightHeight = height - 2 * radius;
    const cornerArc = (Math.PI * radius) / 2;
    const distance = t * (2 * straightWidth + 2 * straightHeight + 4 * cornerArc);
    let accumulated = 0;

    if (distance <= accumulated + straightWidth) {
      return { x: left + radius + ((distance - accumulated) / straightWidth) * straightWidth, y: top };
    }
    accumulated += straightWidth;
    if (distance <= accumulated + cornerArc) {
      return getCornerPoint(left + width - radius, top + radius, radius, -Math.PI / 2, Math.PI / 2, (distance - accumulated) / cornerArc);
    }
    accumulated += cornerArc;
    if (distance <= accumulated + straightHeight) {
      return { x: left + width, y: top + radius + ((distance - accumulated) / straightHeight) * straightHeight };
    }
    accumulated += straightHeight;
    if (distance <= accumulated + cornerArc) {
      return getCornerPoint(left + width - radius, top + height - radius, radius, 0, Math.PI / 2, (distance - accumulated) / cornerArc);
    }
    accumulated += cornerArc;
    if (distance <= accumulated + straightWidth) {
      return { x: left + width - radius - ((distance - accumulated) / straightWidth) * straightWidth, y: top + height };
    }
    accumulated += straightWidth;
    if (distance <= accumulated + cornerArc) {
      return getCornerPoint(left + radius, top + height - radius, radius, Math.PI / 2, Math.PI / 2, (distance - accumulated) / cornerArc);
    }
    accumulated += cornerArc;
    if (distance <= accumulated + straightHeight) {
      return { x: left, y: top + height - radius - ((distance - accumulated) / straightHeight) * straightHeight };
    }
    accumulated += straightHeight;
    return getCornerPoint(left + radius, top + radius, radius, Math.PI, Math.PI / 2, (distance - accumulated) / cornerArc);
  }, [getCornerPoint]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !container || !context) return undefined;

    const borderOffset = 60;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let width;
    let height;
    let dpr;

    const updateSize = () => {
      const rect = container.getBoundingClientRect();
      width = rect.width + borderOffset * 2;
      height = rect.height + borderOffset * 2;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    };

    const draw = (currentTime) => {
      if (!lastFrameTimeRef.current) lastFrameTimeRef.current = currentTime;
      timeRef.current += ((currentTime - lastFrameTimeRef.current) / 1000) * speed;
      lastFrameTimeRef.current = currentTime;

      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.scale(dpr, dpr);
      context.strokeStyle = getComputedStyle(container).color;
      context.lineWidth = 1;
      context.lineCap = "round";
      context.lineJoin = "round";

      const borderWidth = width - 2 * borderOffset;
      const borderHeight = height - 2 * borderOffset;
      const radius = Math.min(borderRadius, Math.min(borderWidth, borderHeight) / 2);
      const sampleCount = Math.max(1, Math.floor((2 * (borderWidth + borderHeight) + 2 * Math.PI * radius) / 2));

      context.beginPath();
      for (let i = 0; i <= sampleCount; i += 1) {
        const progress = i / sampleCount;
        const point = getRoundedRectPoint(progress, borderOffset, borderOffset, borderWidth, borderHeight, radius);
        const x = point.x + octavedNoise(progress * 8, 10, 1.6, 0.7, chaos, 10, timeRef.current, 0, 0) * 60;
        const y = point.y + octavedNoise(progress * 8, 10, 1.6, 0.7, chaos, 10, timeRef.current, 1, 0) * 60;
        if (i === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      }
      context.closePath();
      context.stroke();

      if (!reduceMotion) animationRef.current = requestAnimationFrame(draw);
    };

    updateSize();
    const resizeObserver = new ResizeObserver(() => {
      updateSize();
      if (reduceMotion) draw(performance.now());
    });
    resizeObserver.observe(container);
    animationRef.current = requestAnimationFrame(draw);

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      resizeObserver.disconnect();
      lastFrameTimeRef.current = 0;
    };
  }, [borderRadius, chaos, color, getRoundedRectPoint, octavedNoise, speed]);

  return <div
    ref={containerRef}
    className={`electric-border${className ? ` ${className}` : ""}`}
    style={{ "--electric-border-color": color, borderRadius, ...style }}
  >
    <div className="eb-canvas-container" aria-hidden="true"><canvas ref={canvasRef} className="eb-canvas" /></div>
    <div className="eb-layers" aria-hidden="true">
      <div className="eb-glow-1" />
      <div className="eb-glow-2" />
      <div className="eb-background-glow" />
    </div>
    <div className="eb-content">{children}</div>
  </div>;
}
