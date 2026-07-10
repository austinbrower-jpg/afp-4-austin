import { NextRequest, NextResponse } from "next/server";
import { getDataProvider } from "@/lib/data/provider";
import { dataErrorResponse, NO_STORE_HEADERS } from "@/lib/data/route-utils";
import { validationMessages, workLogInputSchema } from "@/lib/data/validation";
import type { WorkLog } from "@/types/domain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Context) {
  try {
    const provider = await getDataProvider();
    const entry = await provider.workLogs.findById((await params).id);
    if (!entry) return NextResponse.json({ error: "Work Done entry not found." }, { status: 404 });
    return NextResponse.json(entry, { headers: NO_STORE_HEADERS });
  } catch (error) { return dataErrorResponse(error); }
}
export async function PATCH(request: NextRequest, { params }: Context) {
  try {
    const provider = await getDataProvider();
    const { id } = await params;
    const existing = await provider.workLogs.findById(id);
    if (!existing) return NextResponse.json({ error: "Work Done entry not found." }, { status: 404 });
    const body = await request.json().catch(() => null);
    const parsed = workLogInputSchema.safeParse({ ...existing, ...body });
    if (!parsed.success) return NextResponse.json({ error: "Invalid Work Done entry.", details: validationMessages(parsed.error) }, { status: 400 });
    const updated: WorkLog = { ...existing, ...parsed.data, updatedAt: new Date().toISOString() };
    const saved = await provider.workLogs.update(id, updated);
    return NextResponse.json({ ...saved.entity, persistence: saved }, { headers: NO_STORE_HEADERS });
  } catch (error) { return dataErrorResponse(error); }
}

export async function DELETE(_request: NextRequest, { params }: Context) {
  try {
    const provider = await getDataProvider();
    await provider.workLogs.remove((await params).id);
    return NextResponse.json({ ok: true });
  } catch (error) { return dataErrorResponse(error); }
}
