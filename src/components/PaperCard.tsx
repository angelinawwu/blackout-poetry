"use client";

import { PaperTexture, HalftoneDots } from "@paper-design/shaders-react";
import { forwardRef, useEffect, useRef, useState } from "react";

type Props = {
  children: React.ReactNode;
  width?: number;
  height?: number;
};

// 1x1 off-white PNG — drives HalftoneDots so we get uniform speckle.
const FLAT_PAPER_PX =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=";

export const PaperCard = forwardRef<HTMLDivElement, Props>(function PaperCard(
  { children },
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
      className="relative isolate card-enter"
      style={{
        width: "min(640px, calc(100vw - 48px))",
        minHeight: 800,
        background: "var(--paper)",
        borderRadius: 2,
        boxShadow:
          "0 1px 0 rgba(255,255,255,0.4) inset, 0 0 0 1px rgba(60,45,20,0.12), 0 30px 60px -20px rgba(40,30,10,0.35), 0 10px 20px -10px rgba(40,30,10,0.25)",
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
          colorBack="#f3ead3"
          colorFront="#b8a779"
          contrast={0.32}
          roughness={0.55}
          fiber={0.45}
          fiberSize={0.22}
          crumples={0.18}
          crumpleSize={0.5}
          folds={0.25}
          foldCount={3}
          drops={0.08}
          fade={0}
          seed={4.2}
          scale={0.9}
          fit="cover"
          style={{ width: "100%", height: "100%", display: "block" }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10">{children}</div>

      {/* Halftone dots on top — tiny speckle, low opacity, multiply */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden"
        style={{
          borderRadius: "inherit",
          zIndex: 20,
          mixBlendMode: "multiply",
          opacity: 0.22,
        }}
      >
        <HalftoneDots
          width={size.w}
          height={size.h}
          image={FLAT_PAPER_PX}
          colorBack="#f3ead3"
          colorFront="#2b2419"
          originalColors={false}
          type="classic"
          grid="square"
          inverted={false}
          size={0}
          radius={0.9}
          contrast={0.5}
          grainMixer={0}
          grainOverlay={0}
          grainSize={0.5}
          fit="cover"
          style={{ width: "100%", height: "100%", display: "block" }}
        />
      </div>

      {/* Vignette / edge darkening for aged feel */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          borderRadius: "inherit",
          zIndex: 21,
          background:
            "radial-gradient(ellipse at 50% 50%, transparent 55%, rgba(70,50,20,0.12) 100%)",
          mixBlendMode: "multiply",
        }}
      />
    </div>
  );
});
