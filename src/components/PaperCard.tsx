"use client";

import { PaperTexture } from "@paper-design/shaders-react";
import { forwardRef, useEffect, useRef, useState } from "react";

type Props = {
  children: React.ReactNode;
  width?: number;
  height?: number;
  className?: string;
};

export const PaperCard = forwardRef<HTMLDivElement, Props>(function PaperCard(
  { children, className = "" },
  ref,
) {
  const innerRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 640, h: 800 });

  // Watch the card size so shaders render at the correct resolution.
  useEffect(() => {
    if (!innerRef.current) return;
    const el = innerRef.current;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        const { width, height } = e.contentRect;
        setSize({ w: Math.ceil(width), h: Math.ceil(height) });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={(node) => {
        innerRef.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
      }}
      className={`relative isolate card-enter min-h-0 ${className}`}
      style={{
        width: "min(640px, calc(100vw - 48px))",
        flex: "1 1 0%",
        minHeight: 0,
        background: "var(--paper)",
        borderRadius: 2,
        transform: "rotate(-0.3deg)",
      }}
    >
      {/* Paper texture shader — absolute, below text */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden"
        style={{ borderRadius: "inherit", zIndex: 0, mixBlendMode: "multiply" }}
      >
        <PaperTexture
          width={size.w}
          height={size.h}
          colorBack="#ffffff"
          colorFront="#e6e3dc"
          contrast={0.52}
          roughness={0.75}
          fiber={0.35}
          fiberSize={0.42}
          crumples={0.58}
          crumpleSize={0.5}
          folds={0.95}
          foldCount={5}
          drops={0.28}
          fade={0}
          seed={4.5}
          scale={0.9}
          fit="cover"
          style={{ width: "100%", height: "100%", display: "block" }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 h-full">{children}</div>

      {/* Vignette / edge darkening for aged feel */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          borderRadius: "inherit",
          zIndex: 21,
          background:
            "radial-gradient(ellipse at 50% 50%, transparent 55%, rgba(200, 190, 179, 0.12) 100%)",
          mixBlendMode: "multiply",
        }}
      />

    </div>
  );
});
