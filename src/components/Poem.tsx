"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { PaperCard } from "./PaperCard";
import { MarkerCanvas, type Stroke } from "./MarkerCanvas";
import { tokenize } from "@/lib/tokenize";
import type { BookExcerpt } from "@/data/fallback-books";

type DragState = {
  active: boolean;
  mode: "paint" | "erase" | null;
  startIdx: number | null;
  moved: boolean;
  touched: Set<number>;
};

type Phase = "redact" | "marker";
type TurnState = "idle" | "out" | "in";

const MARKER_PALETTE: { name: string; color: string }[] = [
  { name: "Charcoal", color: "#2a2724" },
  { name: "Oxblood", color: "#7a2a26" },
  { name: "Ochre", color: "#b88a2a" },
  { name: "Navy", color: "#1f3a5f" },
  { name: "Sage", color: "#5b6e4a" },
  { name: "Plum", color: "#5a3a55" },
];

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export function Poem() {
  const [excerpt, setExcerpt] = useState<BookExcerpt | null>(null);
  const [loading, setLoading] = useState(true);
  const [redacted, setRedacted] = useState<Set<number>>(new Set());
  const [exporting, setExporting] = useState(false);
  const [painting, setPainting] = useState(false);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [phase, setPhase] = useState<Phase>("redact");
  const [markerColor, setMarkerColor] = useState<string>(
    MARKER_PALETTE[0].color,
  );
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [turn, setTurn] = useState<TurnState>("idle");
  const [flashing, setFlashing] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const paragraphRef = useRef<HTMLParagraphElement | null>(null);
  const [visibleWordCount, setVisibleWordCount] = useState<number>(Infinity);
  const dragRef = useRef<DragState>({
    active: false,
    mode: null,
    startIdx: null,
    moved: false,
    touched: new Set(),
  });

  const loadExcerpt = useCallback(async () => {
    const res = await fetch("/api/page", { cache: "no-store" });
    const data = (await res.json()) as BookExcerpt;
    setExcerpt(data);
    setRedacted(new Set());
    setStrokes([]);
  }, []);

  const excerptRef = useRef<BookExcerpt | null>(null);
  excerptRef.current = excerpt;

  const fetchPage = useCallback(async () => {
    if (turn !== "idle") return;
    setLoading(true);
    const hasExisting = excerptRef.current != null;
    if (!hasExisting || prefersReducedMotion()) {
      try {
        await loadExcerpt();
      } catch {
        // swallow
      } finally {
        setLoading(false);
      }
      return;
    }
    try {
      // Curl out
      setTurn("out");
      await new Promise((r) => setTimeout(r, 280));
      await loadExcerpt();
      // Curl in
      setTurn("in");
      await new Promise((r) => setTimeout(r, 320));
    } catch {
      // swallow
    } finally {
      setTurn("idle");
      setLoading(false);
    }
  }, [loadExcerpt, turn]);

  const didInitRef = useRef(false);
  useEffect(() => {
    if (didInitRef.current) return;
    didInitRef.current = true;
    fetchPage();
  }, [fetchPage]);

  const tokens = excerpt ? tokenize(excerpt.text) : [];

  // Measure: find the largest word index whose span still fits inside the
  // body container, then clip the token list to that index. Re-runs whenever
  // the excerpt changes or the container resizes.
  useLayoutEffect(() => {
    if (!excerpt) return;
    const body = bodyRef.current;
    if (!body || !paragraphRef.current) return;

    const measure = () => {
      // Reset to render all tokens, then measure.
      setVisibleWordCount(Infinity);
      // Defer measurement until after the browser lays out the full text.
      requestAnimationFrame(() => {
        if (!bodyRef.current || !paragraphRef.current) return;
        const containerRect = bodyRef.current.getBoundingClientRect();
        const cs = getComputedStyle(bodyRef.current);
        const paddingBottom = parseFloat(cs.paddingBottom) || 0;
        const lineHeight = parseFloat(cs.lineHeight) || 0;
        // Stay within the content box, with a half-line buffer so descenders
        // don't kiss the padding edge.
        const maxBottom =
          containerRect.bottom - paddingBottom - lineHeight * 0.5;
        const spans = paragraphRef.current.querySelectorAll<HTMLElement>(
          "[data-word-idx]",
        );
        if (spans.length === 0) return;
        let lastFitIdx = -1;
        for (const span of spans) {
          const r = span.getBoundingClientRect();
          if (r.bottom <= maxBottom + 0.5) {
            const v = span.getAttribute("data-word-idx");
            if (v != null) lastFitIdx = Math.max(lastFitIdx, Number(v));
          } else {
            break;
          }
        }
        setVisibleWordCount(lastFitIdx + 1);
      });
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(body);
    return () => ro.disconnect();
  }, [excerpt]);

  const applyToIdx = useCallback(
    (idx: number, mode: "paint" | "erase") => {
      setRedacted((prev) => {
        const has = prev.has(idx);
        if (mode === "paint" && has) return prev;
        if (mode === "erase" && !has) return prev;
        const next = new Set(prev);
        if (mode === "paint") next.add(idx);
        else next.delete(idx);
        return next;
      });
    },
    [],
  );

  const getWordIdxFromPoint = (x: number, y: number): number | null => {
    const el = document.elementFromPoint(x, y);
    if (!el) return null;
    const word = (el as HTMLElement).closest("[data-word-idx]") as HTMLElement | null;
    if (!word) return null;
    const v = word.getAttribute("data-word-idx");
    return v == null ? null : Number(v);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLElement>) => {
    const target = (e.target as HTMLElement).closest("[data-word-idx]") as HTMLElement | null;
    if (!target) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    const idx = Number(target.getAttribute("data-word-idx"));
    const isRedacted = redacted.has(idx);
    // Drag mode = inverse of the starting word's state.
    const mode: "paint" | "erase" = isRedacted ? "erase" : "paint";
    dragRef.current = {
      active: true,
      mode,
      startIdx: idx,
      moved: false,
      touched: new Set([idx]),
    };
    setPainting(true);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLElement>) => {
    const d = dragRef.current;
    if (!d.active || !d.mode) return;
    const idx = getWordIdxFromPoint(e.clientX, e.clientY);
    if (idx == null) return;
    if (!d.moved && idx !== d.startIdx) d.moved = true;
    if (d.moved && !d.touched.has(idx)) {
      d.touched.add(idx);
      applyToIdx(idx, d.mode);
      // Also apply to startIdx on first movement so drag feels continuous.
      if (d.startIdx != null && !d.touched.has(d.startIdx)) {
        d.touched.add(d.startIdx);
        applyToIdx(d.startIdx, d.mode);
      } else if (d.startIdx != null) {
        applyToIdx(d.startIdx, d.mode);
      }
    }
  };

  const onPointerUp = () => {
    const d = dragRef.current;
    if (!d.active) return;
    if (!d.moved && d.startIdx != null) {
      // Treat as click toggle.
      setRedacted((prev) => {
        const next = new Set(prev);
        if (next.has(d.startIdx!)) next.delete(d.startIdx!);
        else next.add(d.startIdx!);
        return next;
      });
    }
    dragRef.current = {
      active: false,
      mode: null,
      startIdx: null,
      moved: false,
      touched: new Set(),
    };
    setPainting(false);
  };

  const handleExport = async () => {
    if (!cardRef.current) return;
    setExporting(true);
    try {
      const card = cardRef.current;
      const dpr = 2;
      const W = Math.round(card.offsetWidth * dpr);
      const H = Math.round(card.offsetHeight * dpr);

      // Synchronously snapshot every WebGL canvas before any async work.
      // WebGL uses preserveDrawingBuffer=false by default, so pixels are only
      // available in the same frame — grab them now before awaiting anything.
      const canvasSnapshots = Array.from(
        card.querySelectorAll<HTMLCanvasElement>("canvas"),
      ).map((canvas) => {
        const parentStyle = getComputedStyle(canvas.parentElement!);
        let dataUrl: string | null = null;
        try {
          dataUrl = canvas.toDataURL("image/png");
        } catch {
          /* tainted / blank — will be skipped */
        }
        return {
          dataUrl,
          blendMode: parentStyle.mixBlendMode || "normal",
          opacity: parseFloat(parentStyle.opacity) || 1,
        };
      });

      const loadImg = (src: string) =>
        new Promise<HTMLImageElement>((res, rej) => {
          const img = new Image();
          img.onload = () => res(img);
          img.onerror = rej;
          img.src = src;
        });

      // Build the composite canvas.
      const output = document.createElement("canvas");
      output.width = W;
      output.height = H;
      const ctx = output.getContext("2d")!;

      // 1. Paper base colour (CSS background on the card element).
      ctx.fillStyle = getComputedStyle(card).backgroundColor || "#ebeae9";
      ctx.fillRect(0, 0, W, H);

      // 2. PaperTexture canvas (first canvas, sits below the text at z-index 0).
      const textureSnap = canvasSnapshots[0];
      if (textureSnap?.dataUrl) {
        const img = await loadImg(textureSnap.dataUrl);
        ctx.save();
        ctx.globalAlpha = textureSnap.opacity;
        if (textureSnap.blendMode !== "normal")
          ctx.globalCompositeOperation =
            textureSnap.blendMode as GlobalCompositeOperation;
        ctx.drawImage(img, 0, 0, W, H);
        ctx.restore();
      }

      // 3. Text / blackout layer — capture only the content wrapper div
      //    (card.children[1] = <div class="relative z-10 h-full">). That div
      //    has no background of its own, so the output is transparent except
      //    for text and redaction marks.
      const { toPng } = await import("html-to-image");
      const contentWrapper = card.children[1] as HTMLElement | null;
      if (contentWrapper) {
        const textUrl = await toPng(contentWrapper, {
          pixelRatio: dpr,
          cacheBust: true,
          backgroundColor: "transparent",
          skipFonts: false,
          // Skip the marker canvas — it's redrawn from the canvas snapshot
          // loop below at correct alpha. html-to-image would double it.
          filter: (node) => {
            if (node instanceof HTMLElement) {
              if (node.hasAttribute("data-marker-canvas")) return false;
            }
            return true;
          },
        });
        const textImg = await loadImg(textUrl);
        ctx.drawImage(textImg, 0, 0, W, H);
      }

      // 4. HalftoneDots canvases (above text: z-index 19 multiply, z-index 20 screen).
      for (let i = 1; i < canvasSnapshots.length; i++) {
        const snap = canvasSnapshots[i];
        if (!snap?.dataUrl) continue;
        const img = await loadImg(snap.dataUrl);
        ctx.save();
        ctx.globalAlpha = snap.opacity;
        if (snap.blendMode !== "normal")
          ctx.globalCompositeOperation =
            snap.blendMode as GlobalCompositeOperation;
        ctx.drawImage(img, 0, 0, W, H);
        ctx.restore();
      }

      // 5. Vignette (approximates the CSS radial-gradient multiply overlay).
      ctx.save();
      ctx.globalCompositeOperation = "multiply";
      const outerR = Math.sqrt((W / 2) ** 2 + (H / 2) ** 2);
      const innerR = outerR * 0.55;
      const vig = ctx.createRadialGradient(W / 2, H / 2, innerR, W / 2, H / 2, outerR);
      vig.addColorStop(0, "rgba(200,190,179,0)");
      vig.addColorStop(1, "rgba(200,190,179,0.12)");
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();

      const dataUrl = output.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `blackout-poem-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();

      // Feedback: flash overlay + button "Saved" state.
      if (!prefersReducedMotion()) {
        setFlashing(true);
        window.setTimeout(() => setFlashing(false), 520);
      }
      setJustSaved(true);
      window.setTimeout(() => setJustSaved(false), 1400);
    } catch (err) {
      console.error("Export failed", err);
    } finally {
      setExporting(false);
    }
  };

  const clearAll = () => {
    if (phase === "marker") setStrokes([]);
    else setRedacted(new Set());
  };

  const togglePhase = () => {
    if (turn !== "idle") return;
    setPhase((p) => (p === "redact" ? "marker" : "redact"));
  };

  const turnClass =
    turn === "out" ? "paper-turn-out" : turn === "in" ? "paper-turn-in" : "";

  const canClear =
    phase === "marker" ? strokes.length > 0 : redacted.size > 0;

  return (
    <main className="h-dvh overflow-hidden flex flex-col items-center px-6 py-4 sm:py-6 page-stage">
      {/* Header */}
      <header className="w-full max-w-[720px] flex items-center justify-between mb-3 shrink-0">
        <span className="caption">Blackout Poetry</span>
        <span className="caption text-right">
          {excerpt ? (
            <>
              <span>{excerpt.title}</span>
              <span style={{ opacity: 0.55 }}> · {excerpt.author}</span>
            </>
          ) : (
            "Project Gutenberg · English classics"
          )}
        </span>
      </header>

      {/* Paper card */}
      <PaperCard ref={cardRef} className={turnClass}>
        <div
          ref={bodyRef}
          className={`relative h-full p-6 sm:p-10 overflow-hidden flex flex-col phase-${phase} ${
            Number.isFinite(visibleWordCount) ? "justify-center" : "justify-start"
          } ${painting ? "painting" : ""}`}
          style={{
            fontFamily: "var(--font-cardo), Georgia, serif",
            fontSize: "16px",
            lineHeight: 1.75,
            color: "var(--ink)",
          }}
          onPointerDown={phase === "redact" ? onPointerDown : undefined}
          onPointerMove={phase === "redact" ? onPointerMove : undefined}
          onPointerUp={phase === "redact" ? onPointerUp : undefined}
          onPointerCancel={phase === "redact" ? onPointerUp : undefined}
        >
          {/* Body text */}
          {loading && !excerpt && (
            <div className="caption" style={{ opacity: 0.6 }}>
              Fetching a page…
            </div>
          )}

          {excerpt && (
            <p ref={paragraphRef} style={{ margin: 0 }}>
              {tokens.map((t, i) => {
                if (t.kind === "space") {
                  // Hide trailing whitespace that follows the last visible word.
                  const nextWord = tokens
                    .slice(i + 1)
                    .find((n) => n.kind === "word");
                  if (
                    nextWord &&
                    nextWord.kind === "word" &&
                    nextWord.idx >= visibleWordCount
                  ) {
                    return null;
                  }
                  return (
                    <span key={i} style={{ whiteSpace: "pre-wrap" }}>
                      {t.text}
                    </span>
                  );
                }
                if (t.idx >= visibleWordCount) return null;
                const isR = redacted.has(t.idx);
                const isHovered = phase === "redact" && hoveredIdx === t.idx;
                return (
                  <span
                    key={i}
                    data-word-idx={t.idx}
                    className={`word ${isR ? "is-redacted" : ""} ${isHovered ? "is-hover-preview" : ""}`}
                    style={{ fontStyle: t.italic ? "italic" : "normal" }}
                    onPointerEnter={
                      phase === "redact"
                        ? () => setHoveredIdx(t.idx)
                        : undefined
                    }
                    onPointerLeave={
                      phase === "redact"
                        ? () => setHoveredIdx(null)
                        : undefined
                    }
                  >
                    {t.text}
                  </span>
                );
              })}
            </p>
          )}

          {/* Marker drawing layer */}
          <MarkerCanvas
            active={phase === "marker"}
            color={markerColor}
            strokes={strokes}
            onStrokesChange={setStrokes}
          />
        </div>

        {/* Marker palette — only visible during marker phase */}
        {phase === "marker" && (
          <aside className="palette" aria-label="Marker color palette">
            <span className="palette-label">Marker</span>
            {MARKER_PALETTE.map((p, i) => (
              <button
                key={p.color}
                type="button"
                className="swatch"
                aria-label={p.name}
                aria-pressed={p.color === markerColor}
                onClick={() => setMarkerColor(p.color)}
                style={
                  {
                    background: p.color,
                    ["--swatch-delay" as string]: `${i * 30}ms`,
                  } as React.CSSProperties
                }
              />
            ))}
          </aside>
        )}

        {/* Export flash overlay */}
        <div
          aria-hidden
          className={`flash-overlay ${flashing ? "is-flashing" : ""}`}
        />
      </PaperCard>

      {/* Controls */}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-3 shrink-0">
        <button
          type="button"
          className="btn"
          onClick={fetchPage}
          disabled={loading || turn !== "idle"}
        >
          {loading ? "Turning page…" : "Find a different page"}
        </button>
        <button
          type="button"
          className="btn"
          onClick={clearAll}
          disabled={!canClear}
        >
          {phase === "marker" ? "Clear marks" : "Clear"}
        </button>
        <button
          type="button"
          className="btn"
          data-variant="primary"
          data-state={justSaved ? "saved" : undefined}
          onClick={handleExport}
          disabled={exporting || !excerpt || justSaved}
        >
          {justSaved ? "✓ Saved" : exporting ? "Exporting…" : "Export PNG"}
        </button>
        <button
          type="button"
          className="btn"
          onClick={togglePhase}
          disabled={!excerpt || turn !== "idle"}
        >
          {phase === "redact" ? "Done → Draw" : "Back to poem"}
        </button>
      </div>

      <footer className="mt-3 caption shrink-0" style={{ opacity: 0.5 }}>
        {phase === "redact"
          ? "Click or drag across words to black them out"
          : "Draw on the paper · pick a color from the palette"}
      </footer>
    </main>
  );
}
