import type {
  AssignedWord,
  AssignedWordWithDetails,
  DailyProgressSummary,
  GateStatus,
  QuizDetailItem,
  QuizType,
  WordRecord
} from '../types/vocab';
import { db } from './vocketDb';

export const DAILY_QUOTA = 10;
export const BATCH_SIZE = 50;
export const DAYS_PER_BATCH = 5;
export const CUMULATIVE_EVERY_BATCHES = 5;

export function getTodayIsoDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

async function hydrateAssigned(rows: AssignedWord[]): Promise<AssignedWordWithDetails[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.wordId);
  const words = await db.words.bulkGet(ids);
  const wordMap = new Map<string, WordRecord>();
  for (const w of words) {
    if (w) wordMap.set(w.id, w);
  }
  const result: AssignedWordWithDetails[] = [];
  for (const assigned of rows) {
    const word = wordMap.get(assigned.wordId);
    if (word) {
      result.push({ assigned, word });
    }
  }
  return result;
}

export async function ensureDailyTaskAndGetSummary(): Promise<DailyProgressSummary> {
  const today = getTodayIsoDate();
  const allAssigned = await db.assignedWords.toArray();
  const allHistory = await db.quizHistory.toArray();

  // Cari batch terbesar saat ini
  let currentBatch = 1;
  for (const row of allAssigned) {
    if (row.batchNumber > currentBatch) {
      currentBatch = row.batchNumber;
    }
  }

  let batchRows = allAssigned.filter((r) => r.batchNumber === currentBatch);
  const completedBatchQuizzes = new Set(
    allHistory.filter((h) => h.quizType === 'BATCH').map((h) => h.batchNumber)
  );
  const completedCumulativeQuizzes = new Set(
    allHistory.filter((h) => h.quizType === 'CUMULATIVE').map((h) => h.batchNumber)
  );

  let gateStatus: GateStatus = 'OPEN';
  let pendingCumulativeBatch: number | null = null;

  // Cek apakah batch saat ini sudah 50 kata
  if (batchRows.length >= BATCH_SIZE) {
    if (!completedBatchQuizzes.has(currentBatch)) {
      gateStatus = 'BATCH_QUIZ';
    } else if (
      currentBatch % CUMULATIVE_EVERY_BATCHES === 0 &&
      !completedCumulativeQuizzes.has(currentBatch)
    ) {
      gateStatus = 'CUMULATIVE_QUIZ';
      pendingCumulativeBatch = currentBatch;
    } else {
      // Batch selesai penuh & kuis selesai -> lanjut batch baru
      currentBatch += 1;
      batchRows = [];
      gateStatus = 'OPEN';
    }
  }

  // Cek apakah hari ini sudah punya kata yang ditugaskan
  const assignedToday = allAssigned.filter((r) => r.assignedDate === today);

  if (gateStatus === 'OPEN' && assignedToday.length === 0) {
    const remainingBatchSlots = BATCH_SIZE - batchRows.length;
    const slotsToFill = Math.min(DAILY_QUOTA, remainingBatchSlots);

    if (slotsToFill > 0) {
      const existingDays = new Set(batchRows.map((r) => r.dayNumber));
      const nextDayNumber = Math.min(DAYS_PER_BATCH, existingDays.size + 1);
      const assignedSet = new Set(allAssigned.map((r) => r.wordId));
      const nowIso = new Date().toISOString();
      const newRows: AssignedWord[] = [];

      // Prioritas 1: Priority Queue (CUSTOM)
      const queueItems = await db.priorityQueue.orderBy('queuedAt').toArray();
      const usedQueueIds: string[] = [];

      for (const q of queueItems) {
        if (newRows.length >= slotsToFill) break;
        if (assignedSet.has(q.wordId)) {
          usedQueueIds.push(q.wordId);
          continue;
        }
        const existsInDict = await db.words.get(q.wordId);
        if (!existsInDict) {
          usedQueueIds.push(q.wordId);
          continue;
        }
        newRows.push({
          wordId: q.wordId,
          batchNumber: currentBatch,
          dayNumber: nextDayNumber,
          assignedDate: today,
          sourceType: 'CUSTOM',
          masteryScore: 0,
          remedialCount: 0,
          lastTestedAt: null,
          pronunciationScore: 0,
          pronunciationAttempts: 0,
          updatedAt: nowIso
        });
        assignedSet.add(q.wordId);
        usedQueueIds.push(q.wordId);
      }

      // Prioritas 2: freq_rank ASC (AUTO)
      if (newRows.length < slotsToFill) {
        const needed = slotsToFill - newRows.length;
        const orderedWords = await db.words.orderBy('order').toArray();
        for (const w of orderedWords) {
          if (newRows.length >= slotsToFill) break;
          if (!assignedSet.has(w.id)) {
            newRows.push({
              wordId: w.id,
              batchNumber: currentBatch,
              dayNumber: nextDayNumber,
              assignedDate: today,
              sourceType: 'AUTO',
              masteryScore: 0,
              remedialCount: 0,
              lastTestedAt: null,
              pronunciationScore: 0,
              pronunciationAttempts: 0,
              updatedAt: nowIso
            });
            assignedSet.add(w.id);
          }
          if (newRows.length >= needed && newRows.length >= slotsToFill) break;
        }
      }

      if (newRows.length > 0 || usedQueueIds.length > 0) {
        await db.transaction('rw', db.assignedWords, db.priorityQueue, async () => {
          if (newRows.length > 0) {
            await db.assignedWords.bulkPut(newRows);
          }
          if (usedQueueIds.length > 0) {
            await db.priorityQueue.bulkDelete(usedQueueIds);
          }
        });

        batchRows = [...batchRows, ...newRows];
        if (batchRows.length >= BATCH_SIZE && !completedBatchQuizzes.has(currentBatch)) {
          gateStatus = 'BATCH_QUIZ';
        }
      }
    }
  }

  // Ambil daftar kata terbaru hari ini (atau hari terakhir di batch aktif)
  const latestBatchRows = await db.assignedWords.where('batchNumber').equals(currentBatch).toArray();
  const maxDayInBatch = latestBatchRows.reduce((acc, r) => Math.max(acc, r.dayNumber), 1);

  const todayRows = latestBatchRows.filter((r) => r.assignedDate === today);
  const displayRows =
    todayRows.length > 0
      ? todayRows
      : latestBatchRows.filter((r) => r.dayNumber === maxDayInBatch);

  // Urutkan: CUSTOM dulu, lalu berdasarkan order kamus
  const hydratedToday = await hydrateAssigned(displayRows);
  hydratedToday.sort((a, b) => {
    if (a.assigned.sourceType !== b.assigned.sourceType) {
      return a.assigned.sourceType === 'CUSTOM' ? -1 : 1;
    }
    return a.word.order - b.word.order;
  });

  const hydratedBatch = await hydrateAssigned(latestBatchRows);
  hydratedBatch.sort((a, b) => a.word.order - b.word.order);

  const remedialCount = await db.assignedWords.where('masteryScore').equals(1).count();

  return {
    batchNumber: currentBatch,
    batchCount: latestBatchRows.length,
    batchTarget: BATCH_SIZE,
    dayNumber: maxDayInBatch,
    daysPerBatch: DAYS_PER_BATCH,
    gateStatus,
    pendingCumulativeBatch,
    remedialCount,
    todayWords: hydratedToday,
    batchWords: hydratedBatch
  };
}

export async function addToPriorityQueue(wordId: string): Promise<void> {
  const alreadyAssigned = await db.assignedWords.get(wordId);
  if (alreadyAssigned) return;
  await db.priorityQueue.put({
    wordId,
    queuedAt: new Date().toISOString()
  });
}

export async function removeFromPriorityQueue(wordId: string): Promise<void> {
  await db.priorityQueue.delete(wordId);
}

export async function updatePronunciationResult(wordId: string, score: number): Promise<AssignedWord | null> {
  const existing = await db.assignedWords.get(wordId);
  if (!existing) return null;
  const updated: AssignedWord = {
    ...existing,
    pronunciationScore: Math.max(existing.pronunciationScore, score),
    pronunciationAttempts: existing.pronunciationAttempts + 1,
    updatedAt: new Date().toISOString()
  };
  await db.assignedWords.put(updated);
  return updated;
}

export async function saveQuizCompletion(params: {
  batchNumber: number;
  quizType: QuizType;
  details: QuizDetailItem[];
}): Promise<void> {
  const today = getTodayIsoDate();
  const nowIso = new Date().toISOString();
  const totalQuestions = params.details.length;
  const totalCorrect = params.details.filter((d) => d.correct).length;
  const clientId = `${params.quizType}_${params.batchNumber}_${Date.now()}`;

  await db.transaction('rw', db.assignedWords, db.quizHistory, async () => {
    for (const item of params.details) {
      const existing = await db.assignedWords.get(item.wordId);
      if (!existing) continue;

      if (item.correct) {
        await db.assignedWords.put({
          ...existing,
          masteryScore: 2,
          lastTestedAt: today,
          updatedAt: nowIso
        });
      } else {
        await db.assignedWords.put({
          ...existing,
          masteryScore: 1,
          remedialCount: existing.remedialCount + 1,
          lastTestedAt: today,
          updatedAt: nowIso
        });
      }
    }

    await db.quizHistory.add({
      clientId,
      batchNumber: params.batchNumber,
      quizType: params.quizType,
      completedAt: nowIso,
      totalQuestions,
      totalCorrect,
      details: params.details
    });
  });
}

export async function getAllAssignedWithDetails(): Promise<AssignedWordWithDetails[]> {
  const rows = await db.assignedWords.toArray();
  const hydrated = await hydrateAssigned(rows);
  hydrated.sort((a, b) => {
    if (a.assigned.batchNumber !== b.assigned.batchNumber) {
      return b.assigned.batchNumber - a.assigned.batchNumber;
    }
    return a.word.order - b.word.order;
  });
  return hydrated;
}

export async function searchDictionary(query: string, limit = 40): Promise<WordRecord[]> {
  const q = query.trim().toLowerCase();
  if (!q) {
    return db.words.orderBy('order').limit(limit).toArray();
  }

  // Pencarian cepat di IndexedDB: prefix match pada searchTokens + filter substring akurat
  const prefixMatches = await db.words
    .where('searchTokens')
    .startsWith(q.split(/\s+/)[0])
    .distinct()
    .limit(limit * 3)
    .toArray();

  const exactWord = await db.words.get(q);
  const map = new Map<string, WordRecord>();
  if (exactWord) map.set(exactWord.id, exactWord);
  for (const w of prefixMatches) {
    map.set(w.id, w);
  }

  const results = Array.from(map.values()).filter((w) => {
    if (w.id.toLowerCase().includes(q)) return true;
    if (w.translationId.toLowerCase().includes(q)) return true;
    return w.acceptId.some((t) => t.toLowerCase().includes(q));
  });

  results.sort((a, b) => {
    const aExact = a.id.toLowerCase() === q ? 0 : a.id.toLowerCase().startsWith(q) ? 1 : 2;
    const bExact = b.id.toLowerCase() === q ? 0 : b.id.toLowerCase().startsWith(q) ? 1 : 2;
    if (aExact !== bExact) return aExact - bExact;
    return a.order - b.order;
  });

  return results.slice(0, limit);
}
