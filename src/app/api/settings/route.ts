import { NextRequest, NextResponse } from "next/server";
import { getDataProvider } from "@/lib/data/provider";
import { dataErrorResponse, NO_STORE_HEADERS } from "@/lib/data/route-utils";
import type { Client } from "@/types/domain";
import type { SettingsResponse, UpdateClientSettingsInput } from "@/types/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const provider = await getDataProvider();
    const [workspace, client] = await Promise.all([provider.workspace(), provider.clients.list().then((rows) => rows[0] ?? null)]);
    return NextResponse.json<SettingsResponse>({ workspace, client }, { headers: NO_STORE_HEADERS });
  } catch (error) { return dataErrorResponse(error); }
}
export async function PATCH(request: NextRequest) {
  try {
    const provider = await getDataProvider();
    const client = (await provider.clients.list())[0];
    if (!client) return NextResponse.json({ error: "No client configured." }, { status: 404 });
    const body = await request.json() as UpdateClientSettingsInput;
    const rate = body.defaultHourlyRate === undefined ? client.defaultHourlyRate : Number(body.defaultHourlyRate);
    if (!Number.isFinite(rate) || rate < 0) return NextResponse.json({ error: "Default rate must be non-negative." }, { status: 400 });
    const updated: Client = {
      ...client,
      name: body.name?.trim() || client.name,
      timezone: body.timezone?.trim() || client.timezone,
      notes: body.notes ?? client.notes,
      defaultHourlyRate: rate,
      updatedAt: new Date().toISOString(),
    };
    return NextResponse.json((await provider.clients.update(client.id, updated)).entity);
  } catch (error) { return dataErrorResponse(error); }
}
