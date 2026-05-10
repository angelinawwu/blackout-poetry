export type Token =
  | { kind: "word"; text: string; idx: number }
  | { kind: "space"; text: string };

export function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  // Split preserving whitespace; words keep attached punctuation.
  const parts = text.split(/(\s+)/);
  let wordIdx = 0;
  for (const p of parts) {
    if (!p) continue;
    if (/^\s+$/.test(p)) {
      tokens.push({ kind: "space", text: p });
    } else {
      tokens.push({ kind: "word", text: p, idx: wordIdx++ });
    }
  }
  return tokens;
}
