import type { KnowledgeType } from "@/types/domain";

/**
 * Bidirectional mapping between the URL slug used under /knowledge/[type]
 * and the KnowledgeType value stored in the DB. These are NOT the same
 * string for every type (e.g. "flow-maps" URL slug <-> "flow-map" domain
 * value), so every lookup must go through these maps rather than assuming
 * slug === type.
 *
 * Only documentation, notes, flow-maps, research, and meeting-notes have a
 * sidebar entry (see src/lib/nav-config.ts KNOWLEDGE_TYPE_ROUTES), but every
 * KnowledgeType gets a reachable slug here so idea/sop/reference/project-note
 * pages (which exist in seeded data) stay reachable via direct link, search,
 * or the "All types" view.
 */
export const SLUG_TO_TYPE: Record<string, KnowledgeType> = {
  documentation: "documentation",
  notes: "notes",
  "flow-maps": "flow-map",
  research: "research",
  "meeting-notes": "meeting-notes",
  ideas: "idea",
  sops: "sop",
  "reference-documents": "reference",
  "project-notes": "project-note",
};

export const TYPE_TO_SLUG: Record<KnowledgeType, string> = {
  documentation: "documentation",
  notes: "notes",
  "flow-map": "flow-maps",
  research: "research",
  "meeting-notes": "meeting-notes",
  idea: "ideas",
  sop: "sops",
  reference: "reference-documents",
  "project-note": "project-notes",
};

export const TYPE_LABELS: Record<KnowledgeType, string> = {
  documentation: "Documentation",
  notes: "Notes",
  "flow-map": "Flow Map",
  research: "Research",
  "meeting-notes": "Meeting Notes",
  idea: "Idea",
  sop: "SOP",
  reference: "Reference Document",
  "project-note": "Project Note",
};

/** Slug for the "everything, all types" list view. */
export const ALL_TYPES_SLUG = "all";

export const ALL_KNOWLEDGE_TYPES: KnowledgeType[] = [
  "documentation",
  "notes",
  "flow-map",
  "research",
  "meeting-notes",
  "idea",
  "sop",
  "reference",
  "project-note",
];

export function slugToType(slug: string): KnowledgeType | null {
  return SLUG_TO_TYPE[slug] ?? null;
}

export function typeToSlug(type: KnowledgeType): string {
  return TYPE_TO_SLUG[type];
}

export function isValidSlug(slug: string): boolean {
  return slug === ALL_TYPES_SLUG || slug in SLUG_TO_TYPE;
}

/** Human label for a slug, including the special "all" slug. */
export function slugLabel(slug: string): string {
  if (slug === ALL_TYPES_SLUG) return "All Types";
  const type = slugToType(slug);
  return type ? TYPE_LABELS[type] : slug;
}
