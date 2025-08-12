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

export function getDocIdsBySource(source: string): string[] {
  const d = getDb();
  const rows = d.getAllSync<Row>('SELECT id FROM docs WHERE source = ?', [source]);
  return rows.map((r) => r.id);
}

export function getDocIdsByPrefix(prefix: string): string[] {
  const d = getDb();
  const rows = d.getAllSync<Row>('SELECT id FROM docs WHERE id LIKE ?', [`${prefix}%`]);
  return rows.map((r) => r.id);
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

// ----------------------
// Chat threads and messages
// ----------------------

export type ThreadRow = { id: string; title: string; createdAt: number; updatedAt: number };
export type ChatMessageRow = {
  id: string; // e.g., t{threadId}_m{n}
  threadId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: number;
};

export function ensureChatTables() {
  const d = getDb();
  d.execSync(`
    CREATE TABLE IF NOT EXISTS threads (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      threadId TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      createdAt INTEGER NOT NULL,
      FOREIGN KEY(threadId) REFERENCES threads(id)
    );
    CREATE INDEX IF NOT EXISTS idx_chat_messages_thread_time ON chat_messages(threadId, createdAt);
  `);
}

export function upsertThread(input: { id: string; title: string }): ThreadRow {
  const d = getDb();
  const now = Date.now();
  d.withTransactionSync(() => {
    // Insert if missing
    const insertStmt = d.prepareSync('INSERT OR IGNORE INTO threads (id, title, createdAt, updatedAt) VALUES (?, ?, ?, ?)');
    insertStmt.executeSync([input.id, input.title, now, now]);
    insertStmt.finalizeSync();
    // Always update title and updatedAt
    const updateStmt = d.prepareSync('UPDATE threads SET title = ?, updatedAt = ? WHERE id = ?');
    updateStmt.executeSync([input.title, now, input.id]);
    updateStmt.finalizeSync();
  });
  const row = d.getFirstSync<Row>('SELECT id, title, createdAt, updatedAt FROM threads WHERE id = ?', [input.id]);
  return { id: row!.id, title: (row as any).title, createdAt: (row as any).createdAt, updatedAt: (row as any).updatedAt } as ThreadRow;
}

export function appendMessage(input: { threadId: string; role: 'user' | 'assistant' | 'system'; content: string }): ChatMessageRow {
  const d = getDb();
  const now = Date.now();
  // Determine next message index n for this thread
  const countRow = d.getFirstSync<{ c: number }>('SELECT COUNT(1) as c FROM chat_messages WHERE threadId = ?', [input.threadId]);
  const n = Number(countRow?.c ?? 0) + 1;
  const msgId = `t${input.threadId}_m${n}`;
  d.withTransactionSync(() => {
    const insertMsg = d.prepareSync('INSERT OR REPLACE INTO chat_messages (id, threadId, role, content, createdAt) VALUES (?, ?, ?, ?, ?)');
    insertMsg.executeSync([msgId, input.threadId, input.role, input.content, now]);
    insertMsg.finalizeSync();
    const updateThread = d.prepareSync('UPDATE threads SET updatedAt = ? WHERE id = ?');
    updateThread.executeSync([now, input.threadId]);
    updateThread.finalizeSync();
  });
  return { id: msgId, threadId: input.threadId, role: input.role, content: input.content, createdAt: now };
}

export function getThread(threadId: string): ThreadRow | null {
  const d = getDb();
  const row = d.getFirstSync<Row>('SELECT id, title, createdAt, updatedAt FROM threads WHERE id = ?', [threadId]);
  if (!row) return null;
  return { id: row.id, title: (row as any).title, createdAt: (row as any).createdAt, updatedAt: (row as any).updatedAt } as ThreadRow;
}

export function getMessages(threadId: string, limit?: number): ChatMessageRow[] {
  const d = getDb();
  const sql = limit
    ? 'SELECT id, threadId, role, content, createdAt FROM chat_messages WHERE threadId = ? ORDER BY createdAt ASC LIMIT ?'
    : 'SELECT id, threadId, role, content, createdAt FROM chat_messages WHERE threadId = ? ORDER BY createdAt ASC';
  const rows = limit ? d.getAllSync<Row>(sql, [threadId, limit]) : d.getAllSync<Row>(sql, [threadId]);
  return rows.map((r) => ({ id: r.id, threadId, role: (r as any).role, content: (r as any).content, createdAt: (r as any).createdAt }));
}

// Optional: Upsert recent thread messages into docs/vectors for retrieval blending
import { embedTextsFallback } from './embeddings';

function float32ToUint8(arr: number[]): Uint8Array {
  const buf = new ArrayBuffer(arr.length * 4);
  const view = new DataView(buf);
  for (let i = 0; i < arr.length; i++) view.setFloat32(i * 4, arr[i], true);
  return new Uint8Array(buf);
}

export function upsertThreadVectors(threadId: string, messages: { id: string; content: string }[]) {
  if (!messages || messages.length === 0) return;
  const docs = messages.map((m) => ({ id: `thread_${threadId}_${m.id}`, text: m.content, source: 'thread' as const }));
  upsertDocs(docs);
  const vecs = embedTextsFallback(docs.map((d) => d.text));
  const dim = vecs[0]?.length || 0;
  const rows = vecs.map((v, i) => ({ id: docs[i].id, dim, data: float32ToUint8(v) }));
  upsertVectors(rows);
}
