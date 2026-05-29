const SIMPLE_SYMBOLS = /[\s•·\-_.,،؛:!؟?'"()[\]{}|\\/]+/g;

const ARABIC_NORMALIZE: [RegExp, string][] = [
  [/أ|إ|آ|ٱ/g, "ا"],
  [/ى/g, "ي"],
  [/ة/g, "ه"],
  [/ؤ/g, "و"],
  [/ئ/g, "ي"],
];

export type RoundMode = "stopped" | "normal" | "reverse";

export const WIN_LIMIT_OPTIONS = [2, 10, 20, 50, 100] as const;

export type WinLimit = (typeof WIN_LIMIT_OPTIONS)[number];

export function reverseArabicLine(text: string): string {
  return [...text.trim()].reverse().join("");
}

export function decorateLine(text: string): string {
  return text
    .trim()
    .split(/\s+/)
    .map((word) => [...word].join(" "))
    .join(" • ");
}

export function normalizeText(text: string): string {
  let normalized = text.trim().toLowerCase().replace(SIMPLE_SYMBOLS, "");
  for (const [pattern, replacement] of ARABIC_NORMALIZE) {
    normalized = normalized.replace(pattern, replacement);
  }
  return normalized;
}

function levenshtein(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const matrix = Array.from({ length: rows }, () => Array<number>(cols).fill(0));

  for (let i = 0; i < rows; i += 1) matrix[i][0] = i;
  for (let j = 0; j < cols; j += 1) matrix[0][j] = j;

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }

  return matrix[a.length][b.length];
}

export function similarity(a: string, b: string): number {
  const left = normalizeText(a);
  const right = normalizeText(b);

  if (!left && !right) return 100;
  if (!left || !right) return 0;
  if (left === right) return 100;

  const maxLen = Math.max(left.length, right.length);
  const distance = levenshtein(left, right);
  return Math.round((1 - distance / maxLen) * 100);
}

export function isCopyAttempt(userText: string, displayedText: string): boolean {
  return similarity(userText, displayedText) > 90;
}

export function isCorrectAnswer(userText: string, originalText: string): boolean {
  return similarity(userText, originalText) >= 92;
}

export function pickRandomLine(lines: string[]): string | null {
  const pool = lines.map((line) => line.trim()).filter(Boolean);
  if (!pool.length) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function roundModeLabel(mode: RoundMode): string {
  switch (mode) {
    case "stopped":
      return "متوقفة";
    case "normal":
      return "عادية";
    case "reverse":
      return "عكسية";
  }
}

export function buildDisplayedLine(original: string, useDecoration: boolean): string {
  const reversed = reverseArabicLine(original);
  return useDecoration ? decorateLine(reversed) : reversed;
}
