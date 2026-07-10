import { describe, expect, it } from "vitest";
import { matchProjectCandidates, type ProjectCandidate } from "@/lib/notion/migration/project-matcher";

type Key = "alpha" | "beta" | "gamma";

const CANDIDATES: ProjectCandidate<Key>[] = [
  { key: "alpha", keywords: ["alpha project", "project a"] },
  { key: "beta", keywords: ["beta rollout"] },
  { key: "gamma", keywords: ["gamma", "documentation support"] },
];

describe("matchProjectCandidates - project derivation", () => {
  it("returns a single unambiguous match", () => {
    const result = matchProjectCandidates("Worked on the Alpha Project today", CANDIDATES);
    expect(result.matchedKeys).toEqual(["alpha"]);
    expect(result.primaryKey).toBe("alpha");
    expect(result.ambiguous).toBe(false);
  });

  it("matches case-insensitively", () => {
    const result = matchProjectCandidates("BETA ROLLOUT prep", CANDIDATES);
    expect(result.primaryKey).toBe("beta");
  });

  it("returns no match and a null primary key when nothing matches", () => {
    const result = matchProjectCandidates("General admin and email", CANDIDATES);
    expect(result.matchedKeys).toEqual([]);
    expect(result.primaryKey).toBeNull();
    expect(result.ambiguous).toBe(false);
  });

  it("flags ambiguous when text matches more than one candidate", () => {
    const result = matchProjectCandidates("Alpha Project documentation support work", CANDIDATES);
    expect(result.matchedKeys).toEqual(["alpha", "gamma"]);
    expect(result.ambiguous).toBe(true);
  });

  it("picks the primary key by candidate array order, not text order", () => {
    // "gamma" keyword appears first in the text, but "alpha" is first in
    // the candidates array, so it should still win as primary.
    const result = matchProjectCandidates("gamma work then alpha project follow-up", CANDIDATES);
    expect(result.matchedKeys).toEqual(["alpha", "gamma"]);
    expect(result.primaryKey).toBe("alpha");
  });

  it("returns an empty result for an empty candidate list", () => {
    const result = matchProjectCandidates("anything", []);
    expect(result.matchedKeys).toEqual([]);
    expect(result.primaryKey).toBeNull();
    expect(result.ambiguous).toBe(false);
  });
});
