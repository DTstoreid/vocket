export interface RawMeaning {
  pos: string;
  def: string;
  id: string[];
  ex: string[];
  src?: string[];
  synset?: string;
}

export interface RawDatasetWord {
  id: string;
  pos: string[];
  zipf: number;
  ipa: {
    uk: string | null;
    us: string | null;
  };
  audio: {
    uk: string | null;
    us: string | null;
  };
  meanings: RawMeaning[];
  id_extra?: string[];
  accept_id: string[];
  order: number;
  day: number;
  level: number;
}

export interface DatasetIndex {
  version: number;
  generated_at: string;
  total_words: number;
  words_per_day: number;
  days_per_level: number;
  quiz_every_days: number;
  levels: Array<{
    level: number;
    file: string;
    count: number;
    first_day: number;
    last_day: number;
    bytes: number;
  }>;
  sources: string[];
}

export interface WordRecord {
  id: string;
  order: number;
  level: number;
  pos: string;
  posList: string[];
  zipf: number;
  ipaUs: string;
  ipaUk: string;
  audioUs: string | null;
  audioUk: string | null;
  translationId: string;
  acceptId: string[];
  definitionEn: string;
  example: string;
  synonyms: string[];
  derivatives: string[];
  searchTokens: string[];
}

export interface PriorityQueueItem {
  wordId: string;
  queuedAt: string;
}

export type SourceType = 'AUTO' | 'CUSTOM';
export type MasteryScore = 0 | 1 | 2; // 0 = Belum diuji, 1 = Perlu Remedial, 2 = Lulus

export interface AssignedWord {
  wordId: string;
  batchNumber: number;
  dayNumber: number;
  assignedDate: string; // YYYY-MM-DD
  sourceType: SourceType;
  masteryScore: MasteryScore;
  remedialCount: number;
  lastTestedAt: string | null;
  pronunciationScore: number;
  pronunciationAttempts: number;
  updatedAt: string;
}

export type QuizType = 'BATCH' | 'REMEDIAL' | 'CUMULATIVE';
export type QuizQuestionType = 'EN_TO_ID' | 'ID_TO_EN' | 'SYNONYM' | 'DEFINITION' | 'CLOZE';

export interface QuizQuestion {
  id: string;
  wordId: string;
  type: QuizQuestionType;
  prompt: string;
  subPrompt?: string;
  options: string[];
  correctAnswer: string;
  pos: string;
}

export interface QuizDetailItem {
  wordId: string;
  questionType: QuizQuestionType;
  correct: boolean;
  selected: string;
  expected: string;
}

export interface QuizHistoryRecord {
  id?: number;
  clientId: string;
  batchNumber: number;
  quizType: QuizType;
  completedAt: string;
  totalQuestions: number;
  totalCorrect: number;
  details: QuizDetailItem[];
}

export interface AppMetaRecord {
  key: string;
  value: string;
}

export interface AssignedWordWithDetails {
  assigned: AssignedWord;
  word: WordRecord;
}

export type GateStatus = 'OPEN' | 'BATCH_QUIZ' | 'CUMULATIVE_QUIZ';

export interface DailyProgressSummary {
  batchNumber: number;
  batchCount: number;
  batchTarget: number;
  dayNumber: number;
  daysPerBatch: number;
  gateStatus: GateStatus;
  pendingCumulativeBatch: number | null;
  remedialCount: number;
  todayWords: AssignedWordWithDetails[];
  batchWords: AssignedWordWithDetails[];
}

export const POS_LABEL: Record<string, string> = {
  n: 'noun',
  v: 'verb',
  a: 'adj',
  s: 'adj',
  r: 'adv'
};
