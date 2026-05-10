# Blackout Poetry

A web app for creating blackout poetry from classic literature. Click or drag across words to black them out, then export your creation as a beautiful PNG. 📜🪶

## Features

- **Random book excerpts** — Fetches pages from Project Gutenberg classics (with fallback to built-in excerpts)
- **Intuitive interaction** — Click or drag to black out words
- **Paper texture** — Realistic paper card with texture and vignette effects
- **Export to PNG** — Download your blackout poem as a high-quality image

## Tech Stack

- Next.js 15 + React 19
- TypeScript
- Tailwind CSS 4
- Paper Design Shaders (for paper texture effects)
- html-to-image (for export)

## Getting Started

```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to get started.

## How It Works

1. The app fetches a random excerpt from Project Gutenberg via the Gutendex API
2. Text is tokenized and displayed on a paper-styled card
3. Click or drag across words to black them out
4. Click "Export PNG" to download your creation

The paper texture and visual effects are rendered using WebGL shaders from the Paper Design library.
