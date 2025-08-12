export type LogListener = (line: string) => void;

const listeners = new Set<LogListener>();
const buffer: string[] = [];
const MAX_LINES = 100;

export function logDebug(message: string) {
  const ts = new Date().toISOString().slice(11, 19);
  const line = `${ts} ${message}`;
  buffer.push(line);
  if (buffer.length > MAX_LINES) buffer.shift();
  for (const l of listeners) l(line);
  try { console.log(line); } catch {}
}

export function subscribe(listener: LogListener): () => void {
  listeners.add(listener);
  // send existing buffer
  for (const line of buffer) listener(line);
  return () => listeners.delete(listener);
}

export function getBuffer(): string[] {
  return [...buffer];
}
