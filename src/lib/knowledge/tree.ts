import type { KnowledgePage } from "@/types/domain";

export function buildChildrenMap(pages: KnowledgePage[]): Map<string, KnowledgePage[]> {
  const map = new Map<string, KnowledgePage[]>();
  for (const p of pages) {
    if (!p.parentId) continue;
    const arr = map.get(p.parentId) ?? [];
    arr.push(p);
    map.set(p.parentId, arr);
  }
  for (const arr of map.values()) {
    arr.sort((a, b) => a.title.localeCompare(b.title));
  }
  return map;
}

/** All descendant ids (children, grandchildren, ...) of a page. */
export function getDescendantIds(pageId: string, allPages: KnowledgePage[]): Set<string> {
  const childrenMap = buildChildrenMap(allPages);
  const result = new Set<string>();
  const stack = [pageId];
  while (stack.length) {
    const current = stack.pop();
    if (!current) continue;
    for (const child of childrenMap.get(current) ?? []) {
      if (!result.has(child.id)) {
        result.add(child.id);
        stack.push(child.id);
      }
    }
  }
  return result;
}

/** Pages safe to pick as a parent for `excludeId` (not itself, not a descendant). */
export function validParentOptions(allPages: KnowledgePage[], excludeId?: string): KnowledgePage[] {
  if (!excludeId) return allPages;
  const descendants = getDescendantIds(excludeId, allPages);
  return allPages.filter((p) => p.id !== excludeId && !descendants.has(p.id));
}

/** Ancestor chain (root-first, excluding the page itself) for breadcrumbs. */
export function getAncestorChain(page: KnowledgePage, allPages: KnowledgePage[]): KnowledgePage[] {
  const byId = new Map(allPages.map((p) => [p.id, p]));
  const chain: KnowledgePage[] = [];
  let current = page.parentId ? byId.get(page.parentId) : undefined;
  const seen = new Set<string>();
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    chain.unshift(current);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return chain;
}
