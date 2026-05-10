"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  const cardRef = useRef<HTMLDivElement | null>(null);
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
    <main className="min-h-dvh flex flex-col items-center px-6 py-10 sm:py-16">
      {/* Header */}
      <header className="w-full max-w-[720px] flex items-center justify-between mb-10">
        <span className="caption">Blackout Poetry</span>
        <span className="caption text-right">
          Project Gutenberg · English classics
        </span>
      </header>

      {/* Paper card */}
      <PaperCard ref={cardRef}>
        <div
          className={`relative p-10 sm:p-14 ${painting ? "painting" : ""}`}
          style={{
            fontFamily: "var(--font-pp-writer), Georgia, serif",
            fontSize: "18px",
            lineHeight: 1.9,
            color: "var(--ink)",
            minHeight: 700,
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {/* Attribution on the page */}
          {excerpt && (
            <div
              className="caption mb-8"
              style={{ opacity: 0.55 }}
            >
              From <span style={{ fontStyle: "normal" }}>{excerpt.title}</span>
              {" · "}
              {excerpt.author}
            </div>
          )}

          {/* Body text */}
          {loading && !excerpt && (
            <div className="caption" style={{ opacity: 0.6 }}>
              Fetching a page…
            </div>
          )}

          {excerpt && (
            <p style={{ margin: 0 }}>
              {tokens.map((t, i) => {
                if (t.kind === "space") {
                  return (
                    <span key={i} style={{ whiteSpace: "pre-wrap" }}>
                      {t.text}
                    </span>
                  );
                }
                const isR = redacted.has(t.idx);
                return (
                  <span
                    key={i}
                    data-word-idx={t.idx}
                    className={`word ${isR ? "is-redacted" : ""}`}
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
      <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
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

      <footer className="mt-16 caption" style={{ opacity: 0.5 }}>
        Click or drag across words to black them out
      </footer>
    </main>
  );
}
