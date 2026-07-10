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

function createConnection(): Database.Database {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA_SQL);
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
