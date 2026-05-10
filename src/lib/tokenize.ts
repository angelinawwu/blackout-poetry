export type Token =
  | { kind: "word"; text: string; idx: number; italic?: boolean }
  | { kind: "space"; text: string };

export function tokenize(text: string): Token[] {
  // Convert HTML italic tags to markdown-style for consistent parsing
  let normalized = text.replace(/<\/?i>/gi, "_");
  
  const tokens: Token[] = [];
  // Split preserving whitespace; words keep attached punctuation.
  const parts = normalized.split(/(\s+)/);
  let wordIdx = 0;
  let inItalic = false;
  
  for (const p of parts) {
    if (!p) continue;
    if (/^\s+$/.test(p)) {
      tokens.push({ kind: "space", text: p });
    } else {
      // Check if this word is wrapped in italic delimiters
      let wordText = p;
      let isItalic = inItalic;
      
      // Check for leading underscore
      if (wordText.startsWith("_")) {
        isItalic = !isItalic;
        wordText = wordText.slice(1);
      }
      // Check for trailing underscore
      if (wordText.endsWith("_")) {
        isItalic = !isItalic;
        wordText = wordText.slice(0, -1);
      }
      
      tokens.push({ kind: "word", text: wordText, idx: wordIdx++, italic: isItalic });
    }
  }
  return tokens;
}
