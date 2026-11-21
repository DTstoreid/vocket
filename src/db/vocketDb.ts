import Dexie, { type Table } from 'dexie';
import type {
  AppMetaRecord,
  AssignedWord,
  PriorityQueueItem,
  QuizHistoryRecord,
  WordRecord
} from '../types/vocab';

export class VocketDatabase extends Dexie {
  words!: Table<WordRecord, string>;
  priorityQueue!: Table<PriorityQueueItem, string>;
  assignedWords!: Table<AssignedWord, string>;
  quizHistory!: Table<QuizHistoryRecord, number>;
  appMeta!: Table<AppMetaRecord, string>;

  constructor() {
    super('vocket_db');

    this.version(1).stores({
      words: 'id, order, level, pos, *searchTokens',
      priorityQueue: 'wordId, queuedAt',
      assignedWords: 'wordId, batchNumber, assignedDate, masteryScore, pronunciationScore, lastTestedAt',
      quizHistory: '++id, &clientId, batchNumber, quizType, completedAt',
      appMeta: 'key'
    });
  }
}

export const db = new VocketDatabase();

export async function getMeta(key: string, fallback = ''): Promise<string> {
  const row = await db.appMeta.get(key);
  return row ? row.value : fallback;
}

export async function setMeta(key: string, value: string): Promise<void> {
  await db.appMeta.put({ key, value });
}
