import "server-only";
import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import { SCHEMA_SQL } from "./schema";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "afp-workspace.db");

declare global {
  var __afpDb: Database.Database | undefined;
}

/**
 * CREATE TABLE IF NOT EXISTS is a no-op against a table that already exists
 * on disk, so additive schema changes need an explicit column migration -
 * otherwise inserts referencing a new column fail against pre-existing local
 * database files.
 */
function addMissingColumns(db: Database.Database, table: string, columns: Record<string, string>): void {
  const existing = new Set((db.pragma(`table_info(${table})`) as Array<{ name: string }>).map((c) => c.name));
  for (const [column, definition] of Object.entries(columns)) {
    if (!existing.has(column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

function createConnection(): Database.Database {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA_SQL);
  addMissingColumns(db, "report_settings", {
    website: "TEXT NOT NULL DEFAULT ''",
    invoice_footer: "TEXT NOT NULL DEFAULT ''",
    payment_instructions: "TEXT NOT NULL DEFAULT ''",
  });
  return db;
}

/**
 * Singleton SQLite connection. Cached on `global` so Next.js dev-mode
 * module reloads don't open a new file handle per request.
 */
export function getDb(): Database.Database {
  if (!global.__afpDb) {
    global.__afpDb = createConnection();
  }
  return global.__afpDb;
}
