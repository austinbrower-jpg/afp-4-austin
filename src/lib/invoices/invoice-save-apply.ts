/**
 * Phase 13 invoice save apply — targeted pages.create/update only.
 * Gated by NOTION_INVOICE_SAVE_ENABLED; never uses general sync engine.
 */
import type { Client as NotionClient } from "@notionhq/client";

type NotionPageProperties = Parameters<NotionClient["pages"]["update"]>[0]["properties"];
import {
  hoursInvoiceLockProperties,
  invoiceRelationalProperties,
  invoiceToNotionProperties,
  workInvoiceRelationProperties,
} from "@/lib/notion/mappers";
import type { InvoiceReport } from "@/types/domain";
import {
  assertInvoiceSaveAllowed,
  buildInvoiceSavePlan,
  type InvoiceSaveApplyResult,
  type InvoiceSaveRequest,
} from "./invoice-save";
import type { ReportDataset, ReportSettings } from "@/lib/reports/types";
import type { HoursEntry, WorkLog } from "@/types/domain";
import { newEntityBase } from "@/lib/data/entities";

export interface InvoiceSaveApplyContext {
  notion: NotionClient;
  invoiceDatabaseId: string;
  dataset: ReportDataset;
  settings: ReportSettings;
  request: InvoiceSaveRequest;
  existingInvoices: InvoiceReport[];
  allHours: HoursEntry[];
  allWork: WorkLog[];
  workspaceId: string;
}

function hoursAlreadyLocked(hours: HoursEntry, invoiceId: string): boolean {
  return (
    hours.billingStatus === "invoiced" &&
    hours.invoiceReportId === invoiceId
  );
}

function workAlreadyLinked(work: WorkLog, invoiceId: string): boolean {
  return work.invoiceReportId === invoiceId;
}

export async function applyInvoiceSave(ctx: InvoiceSaveApplyContext): Promise<InvoiceSaveApplyResult> {
  assertInvoiceSaveAllowed(ctx.request.confirmationPhrase);

  const plan = buildInvoiceSavePlan(
    ctx.dataset,
    ctx.settings,
    ctx.request,
    ctx.existingInvoices,
    ctx.allHours,
    ctx.allWork,
  );

  if (!plan.preflight.ready) {
    return {
      success: false,
      stoppedEarly: true,
      error: plan.preflight.gatingReasons.join("; ") || "Preflight not ready",
      appliedSteps: [],
      skippedSteps: [],
    };
  }

  const appliedSteps: string[] = [];
  const skippedSteps: string[] = [];
  const hoursUpdated: string[] = [];
  const workUpdated: string[] = [];
  let invoiceId = plan.existingInvoiceId;

  try {
    if (!invoiceId) {
      const base = newEntityBase("invoice");
      const invoice: InvoiceReport = {
        ...base,
        workspaceId: ctx.workspaceId,
        ...plan.invoicePayload,
        lineItems: plan.invoicePayload.lineItems ?? [],
      };
      const created = await ctx.notion.pages.create({
        parent: { database_id: ctx.invoiceDatabaseId },
        properties: invoiceToNotionProperties(invoice),
      });
      invoiceId = created.id;
      appliedSteps.push(`create-invoice:${invoice.invoiceNumber}`);
    } else {
      skippedSteps.push(`create-invoice:existing:${invoiceId}`);
    }

    if (!invoiceId) throw new Error("Invoice page id missing after create/resolve");

    const relationProps = invoiceRelationalProperties({
      clientId: plan.invoicePayload.clientId,
      includedHoursIds: plan.preflight.lockPlan.proposedRelations.invoiceToHours,
      includedWorkDoneIds: plan.preflight.lockPlan.proposedRelations.invoiceToWorkDone,
    });
    if (Object.keys(relationProps).length > 0) {
      await ctx.notion.pages.update({
        page_id: invoiceId,
        properties: relationProps as NotionPageProperties,
      });
      appliedSteps.push(`link-invoice-relations:${invoiceId}`);
    }

    for (const hoursId of plan.preflight.lockPlan.proposedRelations.invoiceToHours) {
      const hours = ctx.allHours.find((h) => h.id === hoursId);
      if (!hours) throw new Error(`Hours not found: ${hoursId}`);
      if (hoursAlreadyLocked(hours, invoiceId)) {
        skippedSteps.push(`lock-hours:${hoursId}`);
        continue;
      }
      await ctx.notion.pages.update({
        page_id: hours.notionPageId ?? hoursId,
        properties: hoursInvoiceLockProperties(invoiceId) as NotionPageProperties,
      });
      hoursUpdated.push(hoursId);
      appliedSteps.push(`lock-hours:${hoursId}`);
    }

    for (const workId of plan.preflight.lockPlan.proposedRelations.invoiceToWorkDone) {
      const work = ctx.allWork.find((w) => w.id === workId);
      if (!work) throw new Error(`Work Done not found: ${workId}`);
      if (workAlreadyLinked(work, invoiceId)) {
        skippedSteps.push(`link-work:${workId}`);
        continue;
      }
      await ctx.notion.pages.update({
        page_id: work.notionPageId ?? workId,
        properties: workInvoiceRelationProperties(invoiceId) as NotionPageProperties,
      });
      workUpdated.push(workId);
      appliedSteps.push(`link-work:${workId}`);
    }

    const page = await ctx.notion.pages.retrieve({ page_id: invoiceId });
    const url = "url" in page ? page.url : undefined;

    return {
      success: true,
      stoppedEarly: false,
      notionPageId: invoiceId,
      notionUrl: url,
      invoiceNumber: plan.invoicePayload.invoiceNumber,
      appliedSteps,
      skippedSteps,
      partialState: {
        invoiceId,
        hoursUpdated,
        workUpdated,
        hoursRemaining: [],
        workRemaining: [],
      },
    };
  } catch (err) {
    const remainingHours = plan.preflight.lockPlan.proposedRelations.invoiceToHours.filter(
      (id) => !hoursUpdated.includes(id),
    );
    const remainingWork = plan.preflight.lockPlan.proposedRelations.invoiceToWorkDone.filter(
      (id) => !workUpdated.includes(id),
    );
    return {
      success: false,
      stoppedEarly: true,
      error: err instanceof Error ? err.message : String(err),
      notionPageId: invoiceId ?? undefined,
      appliedSteps,
      skippedSteps,
      partialState: {
        invoiceId: invoiceId ?? null,
        hoursUpdated,
        workUpdated,
        hoursRemaining: remainingHours,
        workRemaining: remainingWork,
      },
    };
  }
}
