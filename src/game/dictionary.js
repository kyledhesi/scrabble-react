// Ported from model/Dictionary.java. The Java version stored words in an
// ArrayList and validated with .contains() (an O(n) scan against ~280,000
// words on every single word check). Behaviourally a Set is identical -
// exact same membership test - it's just O(1) instead of O(n), which matters
// a lot in a browser on every submitted move.

// dictionary.txt uses CRLF line endings and (per the source file) the very
// last line has no trailing newline - splitting on /\r\n|\n/ and filtering
// blanks handles both cleanly.
export function parseDictionary(text) {
  const words = text.split(/\r\n|\n/).filter((w) => w.length > 0);
  return new Set(words);
}

// Browser entry point: fetch the word list shipped as a static asset.
export async function loadDictionary(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load dictionary (${response.status})`);
  }
  const text = await response.text();
  return parseDictionary(text);
}
