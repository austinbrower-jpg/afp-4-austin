/**
 * SQLite schema for the local cache. Notion remains the source of truth;
 * this database exists so the app is fast offline and so the sync engine
 * has somewhere to diff against. See lib/notion/sync-engine.ts.
 */
export const SCHEMA_SQL = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  notion_workspace_name TEXT,
  notion_page_id TEXT,
  notion_database_id TEXT,
  sync_status TEXT NOT NULL DEFAULT 'local-only',
  last_synced_at TEXT,
  notion_last_edited_time TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6366f1',
  status TEXT NOT NULL DEFAULT 'active',
  default_hourly_rate REAL NOT NULL DEFAULT 0,
  timezone TEXT NOT NULL DEFAULT 'America/New_York',
  notes TEXT NOT NULL DEFAULT '',
  notion_page_id TEXT,
  notion_database_id TEXT,
  sync_status TEXT NOT NULL DEFAULT 'local-only',
  last_synced_at TEXT,
  notion_last_edited_time TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active',
  priority TEXT NOT NULL DEFAULT 'medium',
  color TEXT NOT NULL DEFAULT '#6366f1',
  tags TEXT NOT NULL DEFAULT '[]',
  notes TEXT NOT NULL DEFAULT '',
  notion_page_id TEXT,
  notion_database_id TEXT,
  sync_status TEXT NOT NULL DEFAULT 'local-only',
  last_synced_at TEXT,
  notion_last_edited_time TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS hours_entries (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
  date TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  break_minutes INTEGER NOT NULL DEFAULT 0,
  total_hours REAL NOT NULL DEFAULT 0,
  hourly_rate REAL NOT NULL DEFAULT 0,
  billable INTEGER NOT NULL DEFAULT 1,
  location TEXT NOT NULL DEFAULT '',
  related_work_log_id TEXT REFERENCES work_logs(id) ON DELETE SET NULL,
  notes TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'manual',
  notion_page_id TEXT,
  notion_database_id TEXT,
  sync_status TEXT NOT NULL DEFAULT 'local-only',
  last_synced_at TEXT,
  notion_last_edited_time TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS work_logs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  date TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  detailed_notes TEXT NOT NULL DEFAULT '',
  invoice_description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'not-started',
  priority TEXT NOT NULL DEFAULT 'medium',
  related_hours_ids TEXT NOT NULL DEFAULT '[]',
  related_knowledge_ids TEXT NOT NULL DEFAULT '[]',
  evidence TEXT NOT NULL DEFAULT '[]',
  github_link TEXT,
  attachments TEXT NOT NULL DEFAULT '[]',
  notion_page_id TEXT,
  notion_database_id TEXT,
  sync_status TEXT NOT NULL DEFAULT 'local-only',
  last_synced_at TEXT,
  notion_last_edited_time TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS knowledge_pages (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  client_id TEXT REFERENCES clients(id) ON DELETE SET NULL,
  project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  tags TEXT NOT NULL DEFAULT '[]',
  parent_id TEXT REFERENCES knowledge_pages(id) ON DELETE SET NULL,
  backlink_ids TEXT NOT NULL DEFAULT '[]',
  notion_page_id TEXT,
  notion_database_id TEXT,
  sync_status TEXT NOT NULL DEFAULT 'local-only',
  last_synced_at TEXT,
  notion_last_edited_time TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS invoice_reports (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  hourly_rate REAL NOT NULL DEFAULT 0,
  total_hours REAL NOT NULL DEFAULT 0,
  total_amount REAL NOT NULL DEFAULT 0,
  summary TEXT NOT NULL DEFAULT '',
  line_items TEXT NOT NULL DEFAULT '[]',
  hours_entry_ids TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'draft',
  notion_page_id TEXT,
  notion_database_id TEXT,
  sync_status TEXT NOT NULL DEFAULT 'local-only',
  last_synced_at TEXT,
  notion_last_edited_time TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sync_queue (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  operation TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sync_log (
  id TEXT PRIMARY KEY,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  direction TEXT NOT NULL,
  trigger_source TEXT NOT NULL,
  entities_synced INTEGER NOT NULL DEFAULT 0,
  conflicts INTEGER NOT NULL DEFAULT 0,
  errors INTEGER NOT NULL DEFAULT 0,
  message TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS sync_conflicts (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  local_updated_at TEXT NOT NULL,
  notion_updated_at TEXT NOT NULL,
  local_snapshot TEXT NOT NULL,
  notion_snapshot TEXT NOT NULL,
  detected_at TEXT NOT NULL,
  resolved_at TEXT,
  resolution TEXT
);

CREATE INDEX IF NOT EXISTS idx_hours_date ON hours_entries(date);
CREATE INDEX IF NOT EXISTS idx_hours_project ON hours_entries(project_id);
CREATE INDEX IF NOT EXISTS idx_worklogs_project ON work_logs(project_id);
CREATE INDEX IF NOT EXISTS idx_worklogs_date ON work_logs(date);
CREATE INDEX IF NOT EXISTS idx_knowledge_type ON knowledge_pages(type);
CREATE INDEX IF NOT EXISTS idx_knowledge_parent ON knowledge_pages(parent_id);
CREATE INDEX IF NOT EXISTS idx_invoices_client ON invoice_reports(client_id);
`;
