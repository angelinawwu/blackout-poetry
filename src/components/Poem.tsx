"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { PaperCard } from "./PaperCard";
import { tokenize } from "@/lib/tokenize";
import type { BookExcerpt } from "@/data/fallback-books";

type DragState = {
  active: boolean;
  mode: "paint" | "erase" | null;
  startIdx: number | null;
  moved: boolean;
  touched: Set<number>;
};

export function Poem() {
  const [excerpt, setExcerpt] = useState<BookExcerpt | null>(null);
  const [loading, setLoading] = useState(true);
  const [redacted, setRedacted] = useState<Set<number>>(new Set());
  const [exporting, setExporting] = useState(false);
  const [painting, setPainting] = useState(false);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
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

  const fetchPage = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/page", { cache: "no-store" });
      const data = (await res.json()) as BookExcerpt;
      setExcerpt(data);
      setRedacted(new Set());
    } catch {
      // swallow
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
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
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(cardRef.current, {
        pixelRatio: 2,
        cacheBust: true,
        backgroundColor: "transparent",
        skipFonts: false,
      });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `blackout-poem-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      console.error("Export failed", err);
    } finally {
      setExporting(false);
    }
  };

  const clearAll = () => setRedacted(new Set());

  return (
    <main className="h-dvh overflow-hidden flex flex-col items-center px-6 py-4 sm:py-6">
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
      <PaperCard ref={cardRef}>
        <div
          ref={bodyRef}
          className={`relative h-full p-6 sm:p-10 overflow-hidden flex flex-col ${
            Number.isFinite(visibleWordCount) ? "justify-center" : "justify-start"
          } ${painting ? "painting" : ""}`}
          style={{
            fontFamily: "var(--font-cardo), Georgia, serif",
            fontSize: "16px",
            lineHeight: 1.75,
            color: "var(--ink)",
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
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
                const isHovered = hoveredIdx === t.idx;
                return (
                  <span
                    key={i}
                    data-word-idx={t.idx}
                    className={`word ${isR ? "is-redacted" : ""} ${isHovered ? "is-hover-preview" : ""}`}
                    onPointerEnter={() => setHoveredIdx(t.idx)}
                    onPointerLeave={() => setHoveredIdx(null)}
                  >
                    {t.text}
                  </span>
                );
              })}
            </p>
          )}
        </div>
      </PaperCard>

      {/* Controls */}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-3 shrink-0">
        <button
          type="button"
          className="btn"
          onClick={fetchPage}
          disabled={loading}
        >
          {loading ? "Turning page…" : "Find a different page"}
        </button>
        <button
          type="button"
          className="btn"
          onClick={clearAll}
          disabled={redacted.size === 0}
        >
          Clear marks
        </button>
        <button
          type="button"
          className="btn"
          data-variant="primary"
          onClick={handleExport}
          disabled={exporting || !excerpt}
        >
          {exporting ? "Exporting…" : "Export PNG"}
        </button>
      </div>

      <footer className="mt-3 caption shrink-0" style={{ opacity: 0.5 }}>
        Click or drag across words to black them out
      </footer>
    </main>
  );
}
