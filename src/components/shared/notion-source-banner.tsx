import { ExternalLink, Info } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

/**
 * Notion is the permanent source of truth (Phase 16). Any editing UI left in
 * this app produces local drafts only, so every page that still allows edits
 * shows this banner and links back to the live Notion record when available.
 */
export function NotionSourceBanner({
  notionUrl,
  entityLabel = "record",
}: {
  notionUrl?: string | null;
  entityLabel?: string;
}) {
  return (
    <Alert>
      <Info />
      <AlertTitle>Notion is the source of truth</AlertTitle>
      <AlertDescription>
        Changes made here are local drafts and are not written back to Notion automatically.
        {notionUrl && (
          <a
            href={notionUrl}
            target="_blank"
            rel="noreferrer"
            className="ml-1 inline-flex items-center gap-1 underline underline-offset-2"
          >
            Open this {entityLabel} in Notion
            <ExternalLink className="size-3.5" />
          </a>
        )}
      </AlertDescription>
    </Alert>
  );
}
