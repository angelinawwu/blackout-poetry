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
      let wordText = p;
      
      // Check for leading underscore - toggles italic state
      if (wordText.startsWith("_")) {
        inItalic = !inItalic;
        wordText = wordText.slice(1);
      }
      
      // Check for trailing underscore - remove it and toggle italic state for subsequent words
      if (wordText.endsWith("_")) {
        wordText = wordText.slice(0, -1);
        // The word itself is italic (since it's inside the span)
        tokens.push({ kind: "word", text: wordText, idx: wordIdx++, italic: inItalic });
        // Toggle state for words after this one
        inItalic = !inItalic;
      } else {
        // The word itself is italic if we're in an italic span
        tokens.push({ kind: "word", text: wordText, idx: wordIdx++, italic: inItalic });
      }
    }
  }
  return tokens;
}
