import type {
  AssignedWordWithDetails,
  QuizQuestion,
  QuizQuestionType,
  WordRecord
} from '../types/vocab';
import { POS_LABEL } from '../types/vocab';
import { db } from '../db/vocketDb';

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Mengganti kata target di dalam contoh kalimat dengan _______ (case-insensitive)
 */
export function formatClozeSentence(example: string, targetWord: string): string | null {
  if (!example || !targetWord) return null;
  const escaped = targetWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`\\b${escaped}\\b`, 'gi');
  if (!regex.test(example)) return null;
  return example.replace(regex, '_______');
}

function pickDistractors(
  pool: WordRecord[],
  target: WordRecord,
  selector: (w: WordRecord) => string,
  correctVal: string,
  count = 3
): string[] {
  const samePos = shuffle(pool.filter((w) => w.id !== target.id && w.pos === target.pos));
  const fallback = shuffle(pool.filter((w) => w.id !== target.id && w.pos !== target.pos));
  const combined = [...samePos, ...fallback];

  const chosen = new Set<string>();
  const lowerCorrect = correctVal.toLowerCase().trim();

  for (const candidate of combined) {
    if (chosen.size >= count) break;
    const val = selector(candidate).trim();
    if (!val) continue;
    if (val.toLowerCase() === lowerCorrect) continue;
    chosen.add(val);
  }

  return Array.from(chosen);
}

function buildQuestionForWord(word: WordRecord, pool: WordRecord[], index: number): QuizQuestion {
  const availableTypes: QuizQuestionType[] = ['EN_TO_ID', 'ID_TO_EN'];

  if (word.synonyms.length > 0) {
    availableTypes.push('SYNONYM');
  }
  if (word.definitionEn && word.definitionEn.length >= 10) {
    availableTypes.push('DEFINITION');
  }
  const clozeSentence = formatClozeSentence(word.example, word.id);
  if (clozeSentence) {
    availableTypes.push('CLOZE');
  }

  // Distribusikan 5 tipe soal secara variatif
  const chosenType = availableTypes[index % availableTypes.length];
  const posText = POS_LABEL[word.pos] || word.pos;

  if (chosenType === 'EN_TO_ID') {
    const correct = word.translationId;
    const distractors = pickDistractors(pool, word, (w) => w.translationId, correct, 3);
    return {
      id: `${word.id}_${index}_enid`,
      wordId: word.id,
      type: 'EN_TO_ID',
      prompt: word.id,
      subPrompt: `${posText}${word.ipaUs ? `  ${word.ipaUs}` : ''}`,
      options: shuffle([correct, ...distractors]),
      correctAnswer: correct,
      pos: posText
    };
  }

  if (chosenType === 'ID_TO_EN') {
    const correct = word.id;
    const distractors = pickDistractors(pool, word, (w) => w.id, correct, 3);
    return {
      id: `${word.id}_${index}_iden`,
      wordId: word.id,
      type: 'ID_TO_EN',
      prompt: word.translationId,
      subPrompt: `Pilih kata bahasa Inggris (${posText})`,
      options: shuffle([correct, ...distractors]),
      correctAnswer: correct,
      pos: posText
    };
  }

  if (chosenType === 'SYNONYM') {
    const correct = word.synonyms[0];
    const distractors = pickDistractors(
      pool.filter((w) => !word.synonyms.includes(w.id)),
      word,
      (w) => w.id,
      correct,
      3
    );
    return {
      id: `${word.id}_${index}_syn`,
      wordId: word.id,
      type: 'SYNONYM',
      prompt: word.id,
      subPrompt: `Pilih sinonim yang paling tepat (${posText})`,
      options: shuffle([correct, ...distractors]),
      correctAnswer: correct,
      pos: posText
    };
  }

  if (chosenType === 'DEFINITION') {
    const correct = word.id;
    const distractors = pickDistractors(pool, word, (w) => w.id, correct, 3);
    return {
      id: `${word.id}_${index}_def`,
      wordId: word.id,
      type: 'DEFINITION',
      prompt: word.definitionEn,
      subPrompt: `Tebak kata dari definisi (${posText})`,
      options: shuffle([correct, ...distractors]),
      correctAnswer: correct,
      pos: posText
    };
  }

  // CLOZE
  const correct = word.id;
  const distractors = pickDistractors(pool, word, (w) => w.id, correct, 3);
  return {
    id: `${word.id}_${index}_cloze`,
    wordId: word.id,
    type: 'CLOZE',
    prompt: clozeSentence || word.example,
    subPrompt: `Lengkapi kalimat (${posText})`,
    options: shuffle([correct, ...distractors]),
    correctAnswer: correct,
    pos: posText
  };
}

async function getDistractorPool(): Promise<WordRecord[]> {
  return db.words.orderBy('order').limit(600).toArray();
}

export async function generateBatchQuiz(batchWords: AssignedWordWithDetails[]): Promise<QuizQuestion[]> {
  const pool = await getDistractorPool();
  const shuffledWords = shuffle(batchWords.map((b) => b.word));
  return shuffledWords.map((w, idx) => buildQuestionForWord(w, pool, idx));
}

export async function generateRemedialQuiz(): Promise<QuizQuestion[]> {
  const remedialRows = await db.assignedWords.where('masteryScore').equals(1).toArray();
  const words = (await db.words.bulkGet(remedialRows.map((r) => r.wordId))).filter(
    (w): w is WordRecord => Boolean(w)
  );
  const pool = await getDistractorPool();
  return shuffle(words).map((w, idx) => buildQuestionForWord(w, pool, idx));
}

/**
 * Cumulative Mini-Quiz (setiap kelipatan 5 Batch): 25 soal acak
 * Prioritaskan kata dengan remedialCount > 0 atau lastTestedAt paling lama
 */
export async function generateCumulativeQuiz(upToBatch: number, count = 25): Promise<QuizQuestion[]> {
  const allPrior = await db.assignedWords
    .where('batchNumber')
    .belowOrEqual(upToBatch)
    .toArray();

  allPrior.sort((a, b) => {
    if (b.remedialCount !== a.remedialCount) {
      return b.remedialCount - a.remedialCount;
    }
    const aTime = a.lastTestedAt || '1970-01-01';
    const bTime = b.lastTestedAt || '1970-01-01';
    return aTime.localeCompare(bTime);
  });

  const selected = allPrior.slice(0, count);
  const words = (await db.words.bulkGet(selected.map((r) => r.wordId))).filter(
    (w): w is WordRecord => Boolean(w)
  );
  const pool = await getDistractorPool();
  return shuffle(words).map((w, idx) => buildQuestionForWord(w, pool, idx));
}
