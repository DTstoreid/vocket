import type { GameRunRecord, ScrambleDataset, ScrambleRound } from '../types/vocab';
import { getDatasetBaseUrl } from '../db/datasetLoader';
import { db } from '../db/vocketDb';

export const DEFAULT_ROUND_SECONDS = 90;

let cachedRounds: ScrambleRound[] | null = null;
let cachedGlobalScrambleWords: Set<string> | null = null;

export async function loadScrambleRounds(): Promise<ScrambleRound[]> {
  if (cachedRounds) return cachedRounds;

  const baseUrl = await getDatasetBaseUrl();
  const tryFetch = async (url: string): Promise<ScrambleDataset | null> => {
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      return (await res.json()) as ScrambleDataset;
    } catch {
      return null;
    }
  };

  let data = await tryFetch(`${baseUrl}/game_scramble.json`);
  if (!data && baseUrl !== '/dataset') {
    data = await tryFetch('/dataset/game_scramble.json');
  }
  if (!data || !Array.isArray(data.rounds) || data.rounds.length === 0) {
    throw new Error('Gagal memuat data game_scramble.json.');
  }

  cachedRounds = data.rounds;

  // Bangun kamus cepat dari seluruh kata valid di semua ronde game_scramble.json
  const globalSet = new Set<string>();
  for (const r of data.rounds) {
    for (const w of r.words) {
      globalSet.add(w.toLowerCase());
    }
    for (const p of r.pangrams) {
      globalSet.add(p.toLowerCase());
    }
  }
  cachedGlobalScrambleWords = globalSet;

  return cachedRounds;
}

/**
 * Validasi kata 3 lapis:
 * 1. Ada di daftar kata ronde aktif (round.words)
 * 2. Ada di kamus vocab Dexie (db.words)
 * 3. Ada di kamus bahasa Inggris gabungan dari seluruh ronde game_scramble.json
 */
export async function validateScrambleWord(
  candidate: string,
  roundWordSet: Set<string>
): Promise<{ valid: boolean; inRound: boolean }> {
  const clean = candidate.toLowerCase().trim();
  if (clean.length < 3) {
    return { valid: false, inRound: false };
  }

  if (roundWordSet.has(clean)) {
    return { valid: true, inRound: true };
  }

  const inVocabDb = await db.words.get(clean);
  if (inVocabDb) {
    return { valid: true, inRound: false };
  }

  if (cachedGlobalScrambleWords && cachedGlobalScrambleWords.has(clean)) {
    return { valid: true, inRound: false };
  }

  return { valid: false, inRound: false };
}

/**
 * Pilih ronde acak tanpa mengulang ronde yang baru saja dimainkan.
 */
export async function pickNextRound(
  rounds: ScrambleRound[]
): Promise<{ roundIndex: number; round: ScrambleRound }> {
  const recentRuns = await db.gameRuns.orderBy('playedAt').reverse().limit(30).toArray();
  const recentSet = new Set(recentRuns.map((r) => r.roundIndex));

  const candidates: number[] = [];
  for (let i = 0; i < rounds.length; i++) {
    if (!recentSet.has(i)) candidates.push(i);
  }

  const pool = candidates.length > 0 ? candidates : rounds.map((_, i) => i);
  const roundIndex = pool[Math.floor(Math.random() * pool.length)];
  return { roundIndex, round: rounds[roundIndex] };
}

/**
 * Aturan skor Susun Kata:
 * - 3 huruf = 1, 4 huruf = 2, 5 huruf = 4, 6 huruf = 8
 * - Pangram (kata 6 huruf / di pangrams[]) bonus +5
 * - Kata yang ada di assignedWords pemain mendapat bonus x2
 */
export function calculateWordScore(
  word: string,
  round: ScrambleRound,
  assignedWordSet: Set<string>
): { points: number; isPangram: boolean; isAssigned: boolean } {
  const clean = word.toLowerCase().trim();
  const len = clean.length;
  let base = 0;
  if (len === 3) base = 1;
  else if (len === 4) base = 2;
  else if (len === 5) base = 4;
  else if (len >= 6) base = 8;

  const isPangram = len >= 6 || round.pangrams.includes(clean);
  if (isPangram) base += 5;

  const isAssigned = assignedWordSet.has(clean);
  const points = isAssigned ? base * 2 : base;

  return { points, isPangram, isAssigned };
}

export async function saveGameRun(run: Omit<GameRunRecord, 'id'>): Promise<void> {
  await db.gameRuns.add(run);
}
