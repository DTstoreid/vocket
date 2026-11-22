import type {
  AssignedWord,
  AssignedWordWithDetails,
  DailyProgressSummary,
  DailyStage,
  GateStatus,
  QuizDetailItem,
  QuizHistoryRecord,
  QuizType,
  WordRecord
} from '../types/vocab';
import { db } from './vocketDb';

export const STAGE_QUOTA: Record<DailyStage, number> = {
  1: 15,
  2: 25,
  3: 35
};

export const DAYS_PER_BATCH = 3;
export const CUMULATIVE_EVERY_BATCHES = 3;
export const STAGE_UP_MIN_SCORE = 0.8;
export const STAGE_KEEP_MIN_SCORE = 0.7;
export const STREAK_TO_PROMOTE = 2;

/**
 * Menghitung Stage otomatis berdasarkan konsistensi hasil Kuis Batch:
 * - Default: Stage 1 (15 kata/hari)
 * - 2 kuis Batch berturut-turut skor >= 80% -> naik 1 Stage (Stage 1 -> 2 -> 3)
 * - Skor 70% - 79% -> bertahan di Stage saat ini, streak promosi reset ke 0
 * - Skor < 70% -> turun 1 Stage otomatis (minimal Stage 1), streak reset ke 0
 */
export function computeAutoStageFromHistory(history: QuizHistoryRecord[]): {
  stage: DailyStage;
  quizStreak: number;
  streakTargetForNextStage: number;
} {
  const batchQuizzes = history
    .filter((h) => h.quizType === 'BATCH' && h.totalQuestions > 0)
    .sort((a, b) => a.completedAt.localeCompare(b.completedAt));

  let stage: DailyStage = 1;
  let quizStreak = 0;

  for (const q of batchQuizzes) {
    const ratio = q.totalCorrect / q.totalQuestions;
    if (ratio >= STAGE_UP_MIN_SCORE) {
      quizStreak += 1;
      if (stage < 3 && quizStreak >= STREAK_TO_PROMOTE) {
        stage = (stage + 1) as DailyStage;
        quizStreak = 0;
      }
    } else if (ratio < STAGE_KEEP_MIN_SCORE) {
      quizStreak = 0;
      if (stage > 1) {
        stage = (stage - 1) as DailyStage;
      }
    } else {
      // 70% - 79%: aman bertahan, tapi streak menuju naik stage direset
      quizStreak = 0;
    }
  }

  return {
    stage,
    quizStreak: stage === 3 ? STREAK_TO_PROMOTE : quizStreak,
    streakTargetForNextStage: stage === 3 ? 0 : STREAK_TO_PROMOTE
  };
}

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

  const { stage, quizStreak, streakTargetForNextStage } = computeAutoStageFromHistory(allHistory);
  const dailyQuota = STAGE_QUOTA[stage];
  const batchTarget = dailyQuota * DAYS_PER_BATCH;

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

  const distinctBatchDates = new Set(batchRows.map((r) => r.assignedDate));
  const batchReachedCycle =
    distinctBatchDates.size >= DAYS_PER_BATCH || batchRows.length >= batchTarget;

  let gateStatus: GateStatus = 'OPEN';
  let pendingCumulativeBatch: number | null = null;

  // Cek apakah batch saat ini sudah mencapai siklus 3 hari atau target batch
  if (batchReachedCycle) {
    if (!completedBatchQuizzes.has(currentBatch)) {
      gateStatus = 'BATCH_QUIZ';
    } else if (
      currentBatch % CUMULATIVE_EVERY_BATCHES === 0 &&
      !completedCumulativeQuizzes.has(currentBatch)
    ) {
      gateStatus = 'CUMULATIVE_QUIZ';
      pendingCumulativeBatch = currentBatch;
    } else {
      // Batch 3 hari & kuis selesai -> lanjut batch baru
      currentBatch += 1;
      batchRows = [];
      gateStatus = 'OPEN';
    }
  }

  // Cek kata yang sudah ditugaskan hari ini di batch aktif
  const assignedTodayInBatch = batchRows.filter((r) => r.assignedDate === today);
  const assignedTodayGlobal = allAssigned.filter((r) => r.assignedDate === today);
  const existingDaysBeforeToday = new Set(
    batchRows.filter((r) => r.assignedDate !== today).map((r) => r.assignedDate)
  );

  const canAssignToday =
    gateStatus === 'OPEN' &&
    (assignedTodayGlobal.length === 0 || assignedTodayInBatch.length < dailyQuota);

  if (canAssignToday) {
    const dayNumberForToday = Math.min(DAYS_PER_BATCH, existingDaysBeforeToday.size + 1);
    const alreadyTodayCount = assignedTodayInBatch.length;
    const neededForToday = Math.max(0, dailyQuota - alreadyTodayCount);
    const remainingBatchSlots = Math.max(0, batchTarget - batchRows.length);
    const slotsToFill =
      dayNumberForToday === DAYS_PER_BATCH
        ? neededForToday
        : Math.min(neededForToday, Math.max(neededForToday, remainingBatchSlots));

    if (slotsToFill > 0) {
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
          dayNumber: dayNumberForToday,
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
        const orderedWords = await db.words.orderBy('order').toArray();
        for (const w of orderedWords) {
          if (newRows.length >= slotsToFill) break;
          if (!assignedSet.has(w.id)) {
            newRows.push({
              wordId: w.id,
              batchNumber: currentBatch,
              dayNumber: dayNumberForToday,
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
        const updatedDates = new Set(batchRows.map((r) => r.assignedDate));
        if (
          (updatedDates.size >= DAYS_PER_BATCH || batchRows.length >= batchTarget) &&
          !completedBatchQuizzes.has(currentBatch)
        ) {
          gateStatus = 'BATCH_QUIZ';
        }
      }
    }
  }

  // Ambil daftar kata terbaru hari ini (atau hari terakhir di batch aktif)
  const latestBatchRows = await db.assignedWords.where('batchNumber').equals(currentBatch).toArray();
  const distinctLatestDates = new Set(latestBatchRows.map((r) => r.assignedDate));
  const maxDayInBatch = Math.min(
    DAYS_PER_BATCH,
    Math.max(
      1,
      distinctLatestDates.size,
      latestBatchRows.reduce((acc, r) => Math.max(acc, r.dayNumber), 1)
    )
  );

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
  const evaluatedToday = allHistory.some(
    (h) => h.quizType === 'BATCH' && h.completedAt.slice(0, 10) === today
  );
  const isEvaluationDay =
    maxDayInBatch >= DAYS_PER_BATCH || gateStatus !== 'OPEN' || evaluatedToday;

  const effectiveBatchTarget = Math.max(batchTarget, latestBatchRows.length);

  return {
    stage,
    dailyQuota,
    quizStreak,
    streakTargetForNextStage,
    batchNumber: currentBatch,
    batchCount: latestBatchRows.length,
    batchTarget: effectiveBatchTarget,
    dayNumber: maxDayInBatch,
    daysPerBatch: DAYS_PER_BATCH,
    isEvaluationDay,
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
