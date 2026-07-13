/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from "vitest";
import { buildInvoiceTimeline } from "./timeline";
describe("buildInvoiceTimeline", () => { it("adds read-only lifecycle events with future viewed support", () => { const invoice:any={createdAt:"2026-07-01T00:00:00.000Z",updatedAt:"2026-07-02T00:00:00.000Z",notionPageId:"n",sentDate:"2026-07-03",paidDate:null,status:"sent"}; expect(buildInvoiceTimeline(invoice).map(e=>[e.type,e.status])).toEqual([["created","complete"],["saved","complete"],["sent","complete"],["viewed","future"],["paid","future"],["voided","future"]]); }); });
