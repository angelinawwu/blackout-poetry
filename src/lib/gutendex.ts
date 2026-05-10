import { fallbackBooks, type BookExcerpt } from "@/data/fallback-books";

type GutendexBook = {
  id: number;
  title: string;
  authors: { name: string }[];
  formats: Record<string, string>;
  languages: string[];
};

const POPULAR_IDS = [
  1342, 11, 84, 1661, 2701, 98, 1952, 345, 43, 174, 76, 2542, 1080, 120, 2591,
  25344, 219, 16328, 2600, 64317, 145, 158, 768, 408, 205, 74,
];

const CACHE = new Map<number, string>();

function cleanGutenbergText(raw: string): string {
  let text = raw.replace(/\r\n/g, "\n");
  const startMatches = [
    /\*\*\*\s*START OF (?:THE|THIS) PROJECT GUTENBERG[^*]+\*\*\*/i,
    /\*END\*THE SMALL PRINT[^*]+\*END\*/i,
  ];
  for (const re of startMatches) {
    const m = text.match(re);
    if (m && m.index !== undefined) {
      text = text.slice(m.index + m[0].length);
      break;
    }
  }
  const endMatch = text.match(
    /\*\*\*\s*END OF (?:THE|THIS) PROJECT GUTENBERG[^*]+\*\*\*/i
  );
  if (endMatch && endMatch.index !== undefined) {
    text = text.slice(0, endMatch.index);
  }
  return text.trim();
}

function extractWindow(text: string, targetWords = 180): string {
  // Collapse paragraphs into sentences, pick a random sentence-bounded window.
  const normalized = text
    .replace(/\n{2,}/g, " \u00B6 ")
    .replace(/\n/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s*\u00B6\s*/g, " ")
    .trim();

  const sentences = normalized.match(/[^.!?]+[.!?]+["']?/g);
  if (!sentences || sentences.length < 4) {
    // Fall back to a raw word-count window.
    const words = normalized.split(" ");
    const start = Math.max(
      0,
      Math.floor(Math.random() * Math.max(1, words.length - targetWords - 50))
    );
    return words.slice(start, start + targetWords).join(" ");
  }

  // Avoid the first 15% of the book (title pages, prefaces often survive cleaning).
  const minIdx = Math.floor(sentences.length * 0.15);
  const maxIdx = Math.max(minIdx + 1, Math.floor(sentences.length * 0.85));
  const startIdx = minIdx + Math.floor(Math.random() * (maxIdx - minIdx));

  let out: string[] = [];
  let count = 0;
  for (let i = startIdx; i < sentences.length && count < targetWords; i++) {
    const s = sentences[i].trim();
    if (!s) continue;
    out.push(s);
    count += s.split(/\s+/).length;
  }
  return out.join(" ").trim();
}

async function fetchText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "blackout-poetry/0.1" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function tryGutendex(): Promise<BookExcerpt | null> {
  const id = pickRandom(POPULAR_IDS);
  const cached = CACHE.get(id);
  let bookMeta: GutendexBook | null = null;
  try {
    const metaRes = await fetch(`https://gutendex.com/books/${id}`, {
      signal: AbortSignal.timeout(6000),
    });
    if (!metaRes.ok) return null;
    bookMeta = (await metaRes.json()) as GutendexBook;
  } catch {
    return null;
  }
  if (!bookMeta) return null;

  let raw = cached ?? null;
  if (!raw) {
    const txtFormat = Object.entries(bookMeta.formats).find(
      ([k]) => k.startsWith("text/plain") && !k.includes("zip")
    );
    if (!txtFormat) return null;
    const url = txtFormat[1].replace(/^http:/, "https:");
    raw = await fetchText(url);
    if (!raw) return null;
    if (CACHE.size > 12) CACHE.clear();
    CACHE.set(id, raw);
  }

  const cleaned = cleanGutenbergText(raw);
  const excerpt = extractWindow(cleaned);
  if (excerpt.split(/\s+/).length < 80) return null;

  return {
    title: bookMeta.title.replace(/\s*[:;]\s*.+$/, ""),
    author: bookMeta.authors[0]?.name ?? "Unknown",
    text: excerpt,
  };
}

export async function getRandomExcerpt(): Promise<BookExcerpt> {
  for (let i = 0; i < 2; i++) {
    const book = await tryGutendex();
    if (book) return book;
  }
  return pickRandom(fallbackBooks);
}
