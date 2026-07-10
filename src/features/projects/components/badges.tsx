/**
 * @deprecated Prefer importing from `@/components/shared/*`.
 * Thin re-exports so existing project feature imports keep working.
 */
export {
  ProjectStatusBadge as StatusBadge,
  ColorSwatch,
  STATUS_OPTIONS,
  STATUS_LABEL,
  DEFAULT_PROJECT_COLOR,
  PROJECT_COLOR_PRESETS,
} from "@/components/shared/project-status-badge";
export {
  PriorityBadge,
  PRIORITY_LABEL,
  PRIORITY_VALUES as PRIORITY_OPTIONS,
} from "@/components/shared/priority-badge";
