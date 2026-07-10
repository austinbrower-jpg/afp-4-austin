/**
 * Generic keyword-based project matcher. Kept independent of the AFP
 * historical fixture so it's unit-testable with synthetic candidates/text,
 * not just the real source data (see project-matcher.test.ts).
 */

export interface ProjectCandidate<K extends string = string> {
  key: K;
  /** Lowercase phrases; a candidate matches if any phrase is a substring of the (lowercased) text. */
  keywords: string[];
}

export interface ProjectMatchResult<K extends string = string> {
  /** All matched candidate keys, in candidate-array (priority) order. */
  matchedKeys: K[];
  /** First matched key by priority order, or null if nothing matched. */
  primaryKey: K | null;
  /** True when more than one distinct project was matched in the same text. */
  ambiguous: boolean;
}

export function matchProjectCandidates<K extends string>(
  text: string,
  candidates: ProjectCandidate<K>[],
): ProjectMatchResult<K> {
  const haystack = text.toLowerCase();
  const matchedKeys = candidates
    .filter((c) => c.keywords.some((kw) => haystack.includes(kw.toLowerCase())))
    .map((c) => c.key);

  return {
    matchedKeys,
    primaryKey: matchedKeys[0] ?? null,
    ambiguous: matchedKeys.length > 1,
  };
}
