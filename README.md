# Blackout Poetry

A small Next.js app that pulls a random page of text from a public-domain book and lets you redact words to craft a poem. Paper and halftone shader effects sit behind and above the text so exports feel like a photographed page.

## Stack

- Next.js 15 (App Router) + TypeScript + Tailwind v4
- `@paper-design/shaders-react` — `PaperTexture` below the text, `HalftoneDots` (minimum size) on top
- `html-to-image` — PNG export (captures WebGL canvases)
- Fonts: **PP Writer** (local, for page text), **Archivo** (UI), **PT Mono** (small all-caps captions)

## Run

```bash
npm install
npm run dev
```

Open <http://localhost:3000>.

## How it works

- `GET /api/page` tries the [Gutendex](https://gutendex.com) API (a random popular Project Gutenberg book), strips the Gutenberg header/footer, and slices a random ~180-word window on a sentence boundary. If the network fails, it falls back to a bundled set of ~8 classics in `src/data/fallback-books.ts`.
- Click a word to black it out; click again to restore. Drag across words to paint (or erase, if you start from a blacked-out word).
- **Export PNG** captures the paper card with all shader effects baked in.
