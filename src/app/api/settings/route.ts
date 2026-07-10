import { NextRequest, NextResponse } from "next/server";
import { initDb, clientRepo, workspaceRepo, nowISO } from "@/lib/db";
import { syncEntityNow } from "@/lib/notion/sync-engine";
import type { Client } from "@/types/domain";
import type { SettingsResponse, UpdateClientSettingsInput } from "@/types/api";

export type { SettingsResponse, UpdateClientSettingsInput };

/**
 * Single-tenant app: "the" workspace/client are the first seeded rows.
 * See project instructions - no multi-tenant selector UI in scope.
 */
export async function GET() {
  initDb();
  const workspace = workspaceRepo.all()[0] ?? null;
  const client = clientRepo.all()[0] ?? null;
  return NextResponse.json<SettingsResponse>({ workspace, client });
}

export async function PATCH(request: NextRequest) {
  initDb();

  const client = clientRepo.all()[0];
  if (!client) {
    return NextResponse.json({ error: "No client configured" }, { status: 404 });
  }

  const body = (await request.json()) as UpdateClientSettingsInput;

  const name = body.name !== undefined ? body.name.trim() : client.name;
  const timezone = body.timezone !== undefined ? body.timezone.trim() : client.timezone;
  const notes = body.notes !== undefined ? body.notes : client.notes;

  let defaultHourlyRate = client.defaultHourlyRate;
  if (body.defaultHourlyRate !== undefined) {
    const rate = Number(body.defaultHourlyRate);
    if (!Number.isFinite(rate) || rate < 0) {
      return NextResponse.json(
        { error: "defaultHourlyRate must be a non-negative number" },
        { status: 400 },
      );
    }
    defaultHourlyRate = rate;
  }

  if (name !== undefined && name.length === 0) {
    return NextResponse.json({ error: "name cannot be empty" }, { status: 400 });
  }

  const updated: Client = {
    ...client,
    name,
    defaultHourlyRate,
    timezone,
    notes,
    updatedAt: nowISO(),
  };

  clientRepo.update(client.id, updated);
  await syncEntityNow("client", client.id);

  return NextResponse.json<Client>(updated);
}
