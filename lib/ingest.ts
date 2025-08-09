import * as FileSystem from 'expo-file-system';
import { Asset } from 'expo-asset';
import projects from '../assets/projects.json';
import chatAsset from '../chat.html';

export type Project = { id: string; title: string; blurb: string; tags: string[] };
export type Message = { id: string; title?: string; text: string; createdAt?: string };
export type Idea = { id: string; title: string; blurb: string; tags: string[] };

export async function loadProjects(): Promise<Project[]> {
  try {
    return projects as Project[];
  } catch (_e) {
    return [];
  }
}

async function tryAsset(moduleId: number): Promise<string | null> {
  try {
    const asset = Asset.fromModule(moduleId);
    await asset.downloadAsync();
    const uri = asset.localUri ?? asset.uri;
    if (uri) return await FileSystem.readAsStringAsync(uri);
  } catch {}
  return null;
}

async function readChatHtml(): Promise<string | null> {
  // Prefer bundled asset import
  const fromImport = await tryAsset(chatAsset as unknown as number);
  if (fromImport) return fromImport;

  // Fallback to bundle paths
  try {
    const candidates = ['chat.html', 'assets/chat.html'];
    for (const name of candidates) {
      const path = FileSystem.bundleDirectory + name;
      const stat = await FileSystem.getInfoAsync(path);
      if (stat.exists) return await FileSystem.readAsStringAsync(path);
    }
  } catch {}

  return null;
}

// Minimal HTML extraction: grabs visible text and simple headings
export async function parseChatHtml(): Promise<Message[]> {
  const html = await readChatHtml();
  if (!html) return [];

  const messages: Message[] = [];

  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
  if (titleMatch) {
    messages.push({ id: 't0', title: titleMatch[1], text: titleMatch[1] });
  }

  const paragraphRegex = /<(p|li|div)[^>]*>(([\s\S]*?)<\/\1>)/gi;
  let match: RegExpExecArray | null;
  let idx = 0;
  while ((match = paragraphRegex.exec(html))) {
    const inner = match[2] ?? '';
    const raw = inner
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .trim();
    if (raw.length >= 40) {
      messages.push({ id: `m${idx++}`, text: raw });
    }
  }

  return messages;
}

export type IngestData = { projects: Project[]; messages: Message[] };

export async function ingestAll(): Promise<IngestData> {
  const [p, m] = await Promise.all([loadProjects(), parseChatHtml().catch(() => [])]);
  return { projects: p, messages: m };
}
