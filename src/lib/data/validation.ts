import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD.");
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use 24-hour HH:mm.");
const nullableId = z.string().trim().min(1).nullable().default(null);

export const hoursInputSchema = z.object({
  date: isoDate,
  startTime: time,
  endTime: time,
  breakMinutes: z.coerce.number().int().min(0).max(1440).default(0),
  hourlyRate: z.coerce.number().min(0).max(100_000),
  billable: z.boolean().default(true),
  location: z.string().max(2000).default(""),
  projectId: nullableId,
  relatedWorkLogId: nullableId,
  notes: z.string().max(2000).default(""),
  source: z.enum(["timer", "manual"]).default("manual"),
});

export const projectInputSchema = z.object({
  name: z.string().trim().min(1).max(2000),
  description: z.string().max(2000).default(""),
  status: z.enum(["active", "on-hold", "completed", "archived"]).default("active"),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  color: z.string().max(100).default("#6366f1"),
  tags: z.array(z.string().trim().min(1).max(100)).default([]),
  notes: z.string().max(2000).default(""),
});

const attachmentSchema = z.object({
  id: z.string(),
  name: z.string(),
  url: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number(),
  addedAt: z.string(),
});

export const workLogInputSchema = z.object({
  projectId: nullableId,
  title: z.string().trim().min(1).max(2000),
  date: isoDate,
  summary: z.string().max(2000).default(""),
  detailedNotes: z.string().max(20_000).default(""),
  invoiceDescription: z.string().max(20_000).default(""),
  status: z.enum(["not-started", "in-progress", "blocked", "done"]).default("not-started"),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  relatedHoursIds: z.array(z.string()).default([]),
  relatedKnowledgeIds: z.array(z.string()).default([]),
  evidence: z.array(z.string().max(2000)).default([]),
  githubLink: z.string().url().nullable().or(z.literal("").transform(() => null)).default(null),
  attachments: z.array(attachmentSchema).default([]),
  detailedWorkDescription: z.string().max(20_000).default(""),
  internalNotes: z.string().max(20_000).default(""),
  clientVisible: z.boolean().default(false),
  includeInInvoice: z.boolean().default(false),
  includeInWorkReport: z.boolean().default(false),
  evidenceLinks: z.array(z.string().max(2000)).default([]),
});

export type ValidHoursInput = z.infer<typeof hoursInputSchema>;
export type ValidProjectInput = z.infer<typeof projectInputSchema>;
export type ValidWorkLogInput = z.infer<typeof workLogInputSchema>;

export function validationMessages(error: z.ZodError): string[] {
  return error.issues.map((issue) => `${issue.path.join(".") || "request"}: ${issue.message}`);
}
