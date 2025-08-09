import * as SQLite from 'expo-sqlite';

export type Row = { id: string; text?: string; source?: string; dim?: number; data?: Uint8Array; data_text?: string; updatedAt?: number };

let db: SQLite.SQLiteDatabase | null = null;

export function getDb() {
  if (!db) db = SQLite.openDatabaseSync('antisocial.db');
  return db;
}

export function initDb() {
  const d = getDb();
  d.execSync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS docs (
      id TEXT PRIMARY KEY,
      text TEXT NOT NULL,
      source TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS vectors (
      id TEXT PRIMARY KEY,
      dim INTEGER NOT NULL,
      data BLOB NOT NULL
    );
    CREATE TABLE IF NOT EXISTS prompts (
      id TEXT PRIMARY KEY,
      data_text TEXT NOT NULL,
      updatedAt INTEGER NOT NULL
    );
  `);
}

export function upsertDocs(rows: { id: string; text: string; source: string }[]) {
  const d = getDb();
  const stmt = d.prepareSync('INSERT OR REPLACE INTO docs (id, text, source) VALUES (?, ?, ?)');
  d.withTransactionSync(() => {
    for (const r of rows) stmt.executeSync([r.id, r.text, r.source]);
    stmt.finalizeSync();
  });
}

export function upsertVectors(rows: { id: string; dim: number; data: Uint8Array }[]) {
  const d = getDb();
  const stmt = d.prepareSync('INSERT OR REPLACE INTO vectors (id, dim, data) VALUES (?, ?, ?)');
  d.withTransactionSync(() => {
    for (const r of rows) stmt.executeSync([r.id, r.dim, r.data]);
    stmt.finalizeSync();
  });
}

export function getAllVectors(): { id: string; dim: number; data: Uint8Array }[] {
  const d = getDb();
  const res = d.getAllSync<Row>('SELECT id, dim, data FROM vectors');
  return res.map((r) => ({ id: r.id, dim: r.dim!, data: r.data! }));
}

export function getDocsByIds(ids: string[]): { id: string; text: string; source: string }[] {
  if (ids.length === 0) return [];
  const placeholders = ids.map(() => '?').join(',');
  const d = getDb();
  const res = d.getAllSync<Row>(`SELECT id, text, source FROM docs WHERE id IN (${placeholders})`, ids);
  return res.map((r) => ({ id: r.id, text: r.text!, source: r.source! }));
}

export function getCachedPrompts(id: string): string[] | null {
  const d = getDb();
  const row = d.getFirstSync<Row>('SELECT data_text FROM prompts WHERE id = ?', [id]);
  if (!row || !row.data_text) return null;
  try {
    const parsed = JSON.parse(row.data_text) as string[];
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function setCachedPrompts(id: string, prompts: string[]) {
  const d = getDb();
  const stmt = d.prepareSync('INSERT OR REPLACE INTO prompts (id, data_text, updatedAt) VALUES (?, ?, ?)');
  stmt.executeSync([id, JSON.stringify(prompts), Date.now()]);
  stmt.finalizeSync();
}

export function clearAllPrompts() {
  const d = getDb();
  d.execSync('DELETE FROM prompts');
}

export function clearPromptsForIds(ids: string[]) {
  if (ids.length === 0) return;
  const d = getDb();
  const stmt = d.prepareSync('DELETE FROM prompts WHERE id = ?');
  d.withTransactionSync(() => {
    for (const id of ids) stmt.executeSync([id]);
    stmt.finalizeSync();
  });
}
