import type { AssignedWord, PriorityQueueItem, QuizHistoryRecord } from '../types/vocab';
import { db, getMeta, setMeta } from '../db/vocketDb';

export interface SyncPayload {
  priorityQueue: PriorityQueueItem[];
  assignedWords: AssignedWord[];
  quizHistory: QuizHistoryRecord[];
}

export interface SyncResult {
  syncedAt: string;
  pulledAssigned: number;
  pulledQueue: number;
  pulledHistory: number;
}

export function generateSyncKey(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let part1 = '';
  let part2 = '';
  for (let i = 0; i < 4; i++) {
    part1 += chars[Math.floor(Math.random() * chars.length)];
    part2 += chars[Math.floor(Math.random() * chars.length)];
  }
  return `VCK-${part1}-${part2}`;
}

export async function getApiBaseUrl(): Promise<string> {
  const saved = await getMeta('apiBaseUrl', '');
  if (saved.trim()) return saved.trim().replace(/\/+$/, '');
  const envUrl = import.meta.env.VITE_API_BASE_URL as string | undefined;
  return envUrl ? envUrl.trim().replace(/\/+$/, '') : '';
}

export async function getOrCreateSyncKey(): Promise<string> {
  let key = await getMeta('syncKey', '');
  if (!key) {
    key = generateSyncKey();
    await setMeta('syncKey', key);
  }
  return key;
}

export async function syncWithCloudflareD1(): Promise<SyncResult> {
  const apiBase = await getApiBaseUrl();
  if (!apiBase) {
    throw new Error('URL Cloudflare Worker belum diatur.');
  }
  const syncKey = await getOrCreateSyncKey();

  const [priorityQueue, assignedWords, quizHistory] = await Promise.all([
    db.priorityQueue.toArray(),
    db.assignedWords.toArray(),
    db.quizHistory.toArray()
  ]);

  const response = await fetch(`${apiBase}/api/sync/${encodeURIComponent(syncKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      priorityQueue,
      assignedWords,
      quizHistory
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(errText || `Sync gagal (HTTP ${response.status})`);
  }

  const remote = (await response.json()) as SyncPayload & { serverTime?: string };

  await db.transaction('rw', db.priorityQueue, db.assignedWords, db.quizHistory, db.appMeta, async () => {
    // Merge assignedWords: ambil updatedAt terbaru atau skor tertinggi
    for (const item of remote.assignedWords || []) {
      const local = await db.assignedWords.get(item.wordId);
      if (!local) {
        await db.assignedWords.put(item);
      } else {
        const useRemote = (item.updatedAt || '') > (local.updatedAt || '');
        await db.assignedWords.put({
          ...(useRemote ? item : local),
          pronunciationScore: Math.max(local.pronunciationScore, item.pronunciationScore),
          pronunciationAttempts: Math.max(local.pronunciationAttempts, item.pronunciationAttempts),
          remedialCount: Math.max(local.remedialCount, item.remedialCount)
        });
      }
    }

    // Merge priorityQueue (kecuali yang sudah masuk assignedWords)
    const assignedIds = new Set((await db.assignedWords.toArray()).map((a) => a.wordId));
    for (const q of remote.priorityQueue || []) {
      if (!assignedIds.has(q.wordId)) {
        await db.priorityQueue.put(q);
      }
    }

    // Merge quizHistory berdasarkan clientId unik
    for (const h of remote.quizHistory || []) {
      const exists = await db.quizHistory.where('clientId').equals(h.clientId).first();
      if (!exists) {
        const { id: _ignore, ...rest } = h;
        await db.quizHistory.add(rest);
      }
    }

    const syncedAt = remote.serverTime || new Date().toISOString();
    await setMeta('lastSyncedAt', syncedAt);
  });

  const syncedAt = await getMeta('lastSyncedAt', new Date().toISOString());
  return {
    syncedAt,
    pulledAssigned: remote.assignedWords?.length || 0,
    pulledQueue: remote.priorityQueue?.length || 0,
    pulledHistory: remote.quizHistory?.length || 0
  };
}
