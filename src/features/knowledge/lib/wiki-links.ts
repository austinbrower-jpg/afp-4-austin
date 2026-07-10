import type { KnowledgePage } from "@/types/domain";

const WIKI_LINK_RE = /\[\[([^\]]+)\]\]/g;

/** Extracts the raw titles referenced via [[Title]] syntax in a page's content. */
export function extractWikiLinkTitles(content: string): string[] {
  const titles: string[] = [];
  for (const match of content.matchAll(WIKI_LINK_RE)) {
    const title = match[1]?.trim();
    if (title) titles.push(title);
  }
  return titles;
}

/**
 * Given the current page and the full set of pages, finds every other page
 * whose content contains a [[Wiki Link]] matching (case-insensitively) the
 * current page's title. This is the "linked from" / inbound-backlink view,
 * distinct from KnowledgePage.backlinkIds (which are explicit outbound
 * relations stored on the page itself).
 */
export function findInboundWikiLinks(
  page: KnowledgePage,
  allPages: KnowledgePage[],
): KnowledgePage[] {
  const targetTitle = page.title.trim().toLowerCase();
  if (!targetTitle) return [];
  return allPages.filter((other) => {
    if (other.id === page.id) return false;
    return extractWikiLinkTitles(other.content).some(
      (title) => title.toLowerCase() === targetTitle,
    );
  });
}

/**
 * Rewrites [[Wiki Link]] occurrences in markdown content into real markdown
 * links to matching pages (by title, case-insensitive). Unmatched wiki-links
 * are rendered as inline code so they read as an unresolved reference rather
 * than silently vanishing.
 */
export function resolveWikiLinksToMarkdown(
  content: string,
  allPages: KnowledgePage[],
  currentPageId?: string,
): string {
  const titleToId = new Map<string, string>();
  for (const p of allPages) {
    titleToId.set(p.title.trim().toLowerCase(), p.id);
  }

  return content.replace(WIKI_LINK_RE, (full, rawTitle: string) => {
    const title = rawTitle.trim();
    const id = titleToId.get(title.toLowerCase());
    if (!id || id === currentPageId) {
      return `\`[[${title}]]\``;
    }
    return `[${title}](/knowledge/page/${id})`;
  });
}
