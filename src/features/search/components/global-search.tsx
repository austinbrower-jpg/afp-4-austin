"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Clock,
  ClipboardList,
  FolderKanban,
  BookOpen,
  FileText,
  Search,
} from "lucide-react";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { useGlobalSearch } from "../hooks/use-global-search";
import type { SearchResultItem } from "../api";

const TYPE_ICON: Record<SearchResultItem["type"], typeof Clock> = {
  hours: Clock,
  worklog: ClipboardList,
  project: FolderKanban,
  knowledge: BookOpen,
  invoice: FileText,
};

const TYPE_LABEL: Record<SearchResultItem["type"], string> = {
  hours: "Hours",
  worklog: "Work Done",
  project: "Projects",
  knowledge: "Work Stuff",
  invoice: "Invoice Reports",
};

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const router = useRouter();
  const { data: results, isFetching } = useGlobalSearch(term);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const grouped = (results ?? []).reduce<Record<string, SearchResultItem[]>>((acc, r) => {
    (acc[r.type] ??= []).push(r);
    return acc;
  }, {});

  function select(item: SearchResultItem) {
    setOpen(false);
    setTerm("");
    router.push(item.href);
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="text-muted-foreground w-56 justify-start gap-2 font-normal"
        onClick={() => setOpen(true)}
      >
        <Search className="size-4" />
        Search everything
        <kbd className="ml-auto rounded border bg-muted px-1.5 py-0.5 text-[10px] font-mono">
          ⌘K
        </kbd>
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen} title="Search" description="Search across hours, work logs, projects, and knowledge">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search hours, work logs, projects, notes, docs, invoices..."
            value={term}
            onValueChange={setTerm}
          />
          <CommandList>
            {term.trim().length < 2 ? (
              <CommandEmpty>Type at least 2 characters to search.</CommandEmpty>
            ) : isFetching ? (
              <CommandEmpty>Searching…</CommandEmpty>
            ) : !results?.length ? (
              <CommandEmpty>No results found.</CommandEmpty>
            ) : (
              Object.entries(grouped).map(([type, items]) => {
                const Icon = TYPE_ICON[type as SearchResultItem["type"]];
                return (
                  <CommandGroup key={type} heading={TYPE_LABEL[type as SearchResultItem["type"]]}>
                    {items.map((item) => (
                      <CommandItem key={item.id} value={item.id} onSelect={() => select(item)}>
                        <Icon />
                        <div className="flex flex-col overflow-hidden">
                          <span className="truncate">{item.title}</span>
                          <span className="truncate text-xs text-muted-foreground">
                            {item.subtitle}
                          </span>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                );
              })
            )}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}
