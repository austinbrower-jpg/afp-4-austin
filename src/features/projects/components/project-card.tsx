import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, ClipboardList, BookOpen } from "lucide-react";
import { ColorSwatch, PriorityBadge, StatusBadge } from "./badges";
import type { ProjectListItem } from "../api";

export function ProjectCard({ project }: { project: ProjectListItem }) {
  return (
    <Link href={`/projects/${project.id}`} className="block">
      <Card className="h-full transition-colors hover:bg-muted/40">
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <ColorSwatch color={project.color} />
              <CardTitle className="truncate">{project.name}</CardTitle>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <StatusBadge status={project.status} />
            <PriorityBadge priority={project.priority} />
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {project.description ? (
            <p className="line-clamp-2 text-sm text-muted-foreground">{project.description}</p>
          ) : (
            <p className="text-sm text-muted-foreground/60 italic">No description</p>
          )}

          {project.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {project.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-[0.7rem]">
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          <div className="flex items-center gap-4 pt-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="size-3.5" />
              {project.hoursCount}
            </span>
            <span className="flex items-center gap-1">
              <ClipboardList className="size-3.5" />
              {project.workLogCount}
            </span>
            <span className="flex items-center gap-1">
              <BookOpen className="size-3.5" />
              {project.knowledgeCount}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
