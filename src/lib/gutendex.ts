import { fallbackBooks, type BookExcerpt } from "@/data/fallback-books";

type GutendexBook = {
  id: number;
  title: string;
  authors: { name: string }[];
  formats: Record<string, string>;
  languages: string[];
};

const POPULAR_IDS = [
  1342, 11, 84, 1661, 2701, 98, 1952, 345, 43, 174, 2542, 1080, 120, 2591,
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

const CHUNK_SIZE = 3000;

function extractWindow(text: string): string {
  // Normalize whitespace but preserve paragraph breaks as single spaces.
  const normalized = text
    .replace(/\n{2,}/g, " ")
    .replace(/\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (normalized.length <= CHUNK_SIZE) return normalized;

  // Truly random offset anywhere in the body.
  const maxStart = normalized.length - CHUNK_SIZE;
  let start = Math.floor(Math.random() * maxStart);
  let end = start + CHUNK_SIZE;

  // Snap edges to the nearest word boundary so we don't cut a word in half.
  const nextSpace = normalized.indexOf(" ", start);
  if (nextSpace !== -1 && nextSpace - start < 40) start = nextSpace + 1;
  const prevSpace = normalized.lastIndexOf(" ", end);
  if (prevSpace > start) end = prevSpace;

  return normalized.slice(start, end).trim();
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

function formatAuthor(name: string | undefined): string {
  if (!name) return "Unknown";
  const cleaned = name.replace(/\s*\([^)]*\)/g, "").trim();
  const parts = cleaned.split(",").map((s) => s.trim());
  return parts.length === 2 ? `${parts[1]} ${parts[0]}` : cleaned || "Unknown";
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function tryGutendex(): Promise<BookExcerpt | null> {
  const id = pickRandom(POPULAR_IDS);
  const cached = CACHE.get(id);
  let bookMeta: GutendexBook | null = null;
  try {
    const metaRes = await fetch(`https://gutendex.com/books/${id}/`, {
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
  if (excerpt.length < 400) return null;

  return {
    title: bookMeta.title.replace(/\s*[:;]\s*.+$/, ""),
    author: formatAuthor(bookMeta.authors[0]?.name),
    text: excerpt,
  };
}

export async function getRandomExcerpt(): Promise<BookExcerpt> {
  for (let i = 0; i < 2; i++) {
    const book = await tryGutendex();
    if (book) return book;
  }
  // Ensure fallback excerpts are long enough to fill the page by tiling.
  const pick = pickRandom(fallbackBooks);
  let text = pick.text;
  while (text.length < 2500) text += " " + pick.text;
  return { ...pick, text };
}
