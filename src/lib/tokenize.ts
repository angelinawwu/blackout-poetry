export type Token =
  | { kind: "word"; text: string; idx: number; italic?: boolean }
  | { kind: "space"; text: string };

export function tokenize(text: string): Token[] {
  // Convert HTML italic tags to markdown-style for consistent parsing
  let normalized = text.replace(/<\/?i>/gi, "_");
  
  // Find all italic spans by matching underscore pairs
  const italicSpans: [number, number][] = [];
  let pos = 0;
  while (pos < normalized.length) {
    if (normalized[pos] === "_") {
      const nextUnderscore = normalized.indexOf("_", pos + 1);
      if (nextUnderscore !== -1) {
        italicSpans.push([pos, nextUnderscore]);
        pos = nextUnderscore + 1;
      } else {
        pos++;
      }
    } else {
      pos++;
    }
  }
  
  // Remove the underscore delimiters from the text
  let cleaned = "";
  const offsetMap: number[] = []; // maps positions in cleaned text to original positions
  let skipPositions = new Set<number>();
  for (const [start, end] of italicSpans) {
    skipPositions.add(start);
    skipPositions.add(end);
  }
  
  for (let i = 0; i < normalized.length; i++) {
    if (!skipPositions.has(i)) {
      offsetMap.push(i);
      cleaned += normalized[i];
    }
  }
  
  // Tokenize the cleaned text
  const tokens: Token[] = [];
  const parts = cleaned.split(/(\s+)/);
  let wordIdx = 0;
  let cleanedPos = 0;
  
  for (const p of parts) {
    if (!p) continue;
    if (/^\s+$/.test(p)) {
      tokens.push({ kind: "space", text: p });
      cleanedPos += p.length;
    } else {
      // Check if this word falls within any italic span
      const wordStart = cleanedPos;
      const wordEnd = cleanedPos + p.length;
      let isItalic = false;
      
      for (const [start, end] of italicSpans) {
        // Map the span boundaries to cleaned text positions
        const cleanedStart = offsetMap.indexOf(start + 1); // +1 to skip opening underscore
        const cleanedEnd = offsetMap.indexOf(end - 1); // -1 to skip closing underscore
        
        if (cleanedStart !== -1 && cleanedEnd !== -1) {
          // Check if word overlaps with this italic span
          if (wordStart <= cleanedEnd && wordEnd >= cleanedStart) {
            isItalic = true;
            break;
          }
        }
      }
      
      tokens.push({ kind: "word", text: p, idx: wordIdx++, italic: isItalic });
      cleanedPos += p.length;
    }
  }
  return tokens;
}
