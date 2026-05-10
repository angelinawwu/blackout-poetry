"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";

export type Stroke = {
  color: string;
  // Normalized coords (0..1) so strokes survive resizes.
  points: { x: number; y: number }[];
};

export type MarkerCanvasHandle = {
  clear: () => void;
  redraw: () => void;
};

type Props = {
  active: boolean;
  color: string;
  strokes: Stroke[];
  onStrokesChange: (next: Stroke[]) => void;
};

export const MarkerCanvas = forwardRef<MarkerCanvasHandle, Props>(
  function MarkerCanvas({ active, color, strokes, onStrokesChange }, ref) {
    const wrapRef = useRef<HTMLDivElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const sizeRef = useRef<{ w: number; h: number; dpr: number }>({
      w: 0,
      h: 0,
      dpr: 1,
    });
    const drawingRef = useRef<{ active: boolean; pointerId: number | null }>({
      active: false,
      pointerId: null,
    });
    // Live stroke kept in a ref so pointermove doesn't thrash React state.
    const liveStrokeRef = useRef<Stroke | null>(null);
    const strokesRef = useRef<Stroke[]>(strokes);
    strokesRef.current = strokes;
    const rafRef = useRef<number | null>(null);

    const draw = useCallback(() => {
      rafRef.current = null;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const { w, h, dpr } = sizeRef.current;
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.scale(dpr, dpr);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.globalAlpha = 0.7;
      const drawStroke = (s: Stroke) => {
        if (s.points.length === 0) return;
        ctx.strokeStyle = s.color;
        ctx.lineWidth = 6;
        ctx.beginPath();
        const p0 = s.points[0];
        ctx.moveTo(p0.x * w, p0.y * h);
        if (s.points.length === 1) {
          // Render a dot.
          ctx.lineTo(p0.x * w + 0.01, p0.y * h + 0.01);
        } else {
          for (let i = 1; i < s.points.length; i++) {
            const p = s.points[i];
            ctx.lineTo(p.x * w, p.y * h);
          }
        }
        ctx.stroke();
      };
      for (const s of strokesRef.current) drawStroke(s);
      if (liveStrokeRef.current) drawStroke(liveStrokeRef.current);
      ctx.restore();
    }, []);

    const scheduleDraw = useCallback(() => {
      if (rafRef.current != null) return;
      rafRef.current = requestAnimationFrame(draw);
    }, [draw]);

    // Resize handling.
    useEffect(() => {
      const wrap = wrapRef.current;
      const canvas = canvasRef.current;
      if (!wrap || !canvas) return;
      const ro = new ResizeObserver(() => {
        const rect = wrap.getBoundingClientRect();
        const dpr = Math.max(1, window.devicePixelRatio || 1);
        sizeRef.current = { w: rect.width, h: rect.height, dpr };
        canvas.width = Math.round(rect.width * dpr);
        canvas.height = Math.round(rect.height * dpr);
        canvas.style.width = `${rect.width}px`;
        canvas.style.height = `${rect.height}px`;
        scheduleDraw();
      });
      ro.observe(wrap);
      return () => ro.disconnect();
    }, [scheduleDraw]);

    // Redraw whenever committed strokes change.
    useEffect(() => {
      scheduleDraw();
    }, [strokes, scheduleDraw]);

    useImperativeHandle(
      ref,
      () => ({
        clear: () => {
          liveStrokeRef.current = null;
          onStrokesChange([]);
        },
        redraw: scheduleDraw,
      }),
      [onStrokesChange, scheduleDraw],
    );

    const toNorm = (e: React.PointerEvent) => {
      const wrap = wrapRef.current;
      if (!wrap) return null;
      const r = wrap.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      const y = (e.clientY - r.top) / r.height;
      return { x, y };
    };

    const onPointerDown = (e: React.PointerEvent) => {
      if (!active) return;
      e.preventDefault();
      const p = toNorm(e);
      if (!p) return;
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
      drawingRef.current = { active: true, pointerId: e.pointerId };
      liveStrokeRef.current = { color, points: [p] };
      scheduleDraw();
    };

    const onPointerMove = (e: React.PointerEvent) => {
      if (!active) return;
      const d = drawingRef.current;
      if (!d.active) return;
      const p = toNorm(e);
      if (!p) return;
      const live = liveStrokeRef.current;
      if (!live) return;
      const last = live.points[live.points.length - 1];
      // Skip near-duplicate points to keep arrays small.
      const dx = (p.x - last.x) * sizeRef.current.w;
      const dy = (p.y - last.y) * sizeRef.current.h;
      if (dx * dx + dy * dy < 1.5) return;
      live.points.push(p);
      scheduleDraw();
    };

    const finishStroke = () => {
      const d = drawingRef.current;
      if (!d.active) return;
      drawingRef.current = { active: false, pointerId: null };
      const live = liveStrokeRef.current;
      liveStrokeRef.current = null;
      if (live && live.points.length > 0) {
        onStrokesChange([...strokesRef.current, live]);
      } else {
        scheduleDraw();
      }
    };

    // Build a cursor SVG tinted with the active marker color.
    const cursorSvg = `<svg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 20 20'><circle cx='10' cy='10' r='6' fill='${color}' fill-opacity='0.7' stroke='${color}' stroke-opacity='0.9' stroke-width='1'/></svg>`;
    const cursorUrl = `url("data:image/svg+xml;utf8,${encodeURIComponent(cursorSvg)}") 10 10, crosshair`;

    return (
      <div
        ref={wrapRef}
        data-marker-canvas=""
        className="absolute inset-0"
        style={{
          zIndex: 15,
          pointerEvents: active ? "auto" : "none",
          cursor: active ? cursorUrl : "default",
          touchAction: active ? "none" : "auto",
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finishStroke}
        onPointerCancel={finishStroke}
        onPointerLeave={finishStroke}
      >
        <canvas
          ref={canvasRef}
          style={{ display: "block", width: "100%", height: "100%" }}
        />
      </div>
    );
  },
);
