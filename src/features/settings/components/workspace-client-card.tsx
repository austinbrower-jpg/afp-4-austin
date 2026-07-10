"use client";

import { useState } from "react";
import { Building2 } from "lucide-react";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useSettings, useUpdateClientSettings } from "../hooks/use-settings";

interface FormState {
  name: string;
  defaultHourlyRate: string;
  timezone: string;
  notes: string;
}

function toFormState(client: { name: string; defaultHourlyRate: number; timezone: string; notes: string }): FormState {
  return {
    name: client.name,
    defaultHourlyRate: String(client.defaultHourlyRate),
    timezone: client.timezone,
    notes: client.notes,
  };
}

export function WorkspaceClientCard() {
  const { data, isLoading } = useSettings();
  const { mutate: updateClient, isPending } = useUpdateClientSettings();

  const [form, setForm] = useState<FormState | null>(null);
  // Populate the form once, the first time client data loads - adjusted
  // during render (idempotent once `form` is non-null) rather than in an
  // effect, per React's guidance for this pattern.
  if (data?.client && form === null) {
    setForm(toFormState(data.client));
  }

  const client = data?.client;
  const isDirty =
    !!client &&
    !!form &&
    (form.name !== client.name ||
      form.defaultHourlyRate !== String(client.defaultHourlyRate) ||
      form.timezone !== client.timezone ||
      form.notes !== client.notes);

  function handleSave() {
    if (!form) return;
    const rate = Number(form.defaultHourlyRate);
    if (!form.name.trim()) {
      return;
    }
    if (!Number.isFinite(rate) || rate < 0) {
      return;
    }
    updateClient({
      name: form.name.trim(),
      defaultHourlyRate: rate,
      timezone: form.timezone.trim(),
      notes: form.notes,
    });
  }

  function handleReset() {
    if (client) setForm(toFormState(client));
  }

  if (isLoading || !form) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Workspace & Client</CardTitle>
          <CardDescription>Loading configuration…</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  const rateInvalid =
    form.defaultHourlyRate.trim() === "" ||
    !Number.isFinite(Number(form.defaultHourlyRate)) ||
    Number(form.defaultHourlyRate) < 0;
  const nameInvalid = form.name.trim().length === 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="size-4 text-muted-foreground" />
          Workspace & Client
        </CardTitle>
        <CardDescription>
          {data?.workspace?.name ?? "Workspace"} · client billing configuration
        </CardDescription>
        <CardAction>
          <Badge variant="outline">{client?.status ?? "active"}</Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="client-name">Client name</Label>
            <Input
              id="client-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              aria-invalid={nameInvalid}
              placeholder="Client name"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="hourly-rate">Default hourly rate (USD)</Label>
            <Input
              id="hourly-rate"
              type="number"
              min="0"
              step="0.01"
              value={form.defaultHourlyRate}
              onChange={(e) =>
                setForm({ ...form, defaultHourlyRate: e.target.value })
              }
              aria-invalid={rateInvalid}
              placeholder="65.00"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="timezone">Timezone</Label>
          <Input
            id="timezone"
            value={form.timezone}
            onChange={(e) => setForm({ ...form, timezone: e.target.value })}
            placeholder="America/New_York"
          />
          <p className="text-xs text-muted-foreground">
            IANA timezone name, e.g. America/New_York, Europe/London, Asia/Kolkata.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            id="notes"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="Internal notes about this client…"
            className="min-h-24"
          />
        </div>
        <div className="flex items-center justify-end gap-2 pt-1">
          {isDirty && (
            <Button variant="ghost" onClick={handleReset} disabled={isPending}>
              Discard
            </Button>
          )}
          <Button
            onClick={handleSave}
            disabled={!isDirty || isPending || rateInvalid || nameInvalid}
          >
            {isPending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
