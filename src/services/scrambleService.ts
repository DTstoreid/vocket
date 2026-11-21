import type { GameRunRecord, ScrambleDataset, ScrambleRound, WordRecord } from '../types/vocab';
import { getDatasetBaseUrl } from '../db/datasetLoader';
import { db } from '../db/vocketDb';

export const DEFAULT_ROUND_SECONDS = 90;
export const MAX_GAME_HISTORY = 5;
export const MAX_MATCH_WORDS = 7;
export const MATCH_BONUS_POINTS = 2;

let cachedRounds: ScrambleRound[] | null = null;
let cachedGlobalScrambleWords: Set<string> | null = null;
let cachedDerivativeMap: Map<string, WordRecord> | null = null;

export interface MatchWordItem {
  word: string;
  translation: string;
  points: number;
}

export interface MatchOptionItem {
  id: string;
  translation: string;
}

const IRREGULAR_LEMMAS: Record<string, string> = {
  ate: 'eat',
  began: 'begin',
  begun: 'begin',
  bent: 'bend',
  bit: 'bite',
  bled: 'bleed',
  blew: 'blow',
  bore: 'bear',
  born: 'bear',
  bought: 'buy',
  bound: 'bind',
  bred: 'breed',
  broke: 'break',
  built: 'build',
  burnt: 'burn',
  came: 'come',
  caught: 'catch',
  chose: 'choose',
  clung: 'cling',
  crept: 'creep',
  dealt: 'deal',
  did: 'do',
  done: 'do',
  drank: 'drink',
  drawn: 'draw',
  dreamt: 'dream',
  drew: 'draw',
  driven: 'drive',
  drove: 'drive',
  drunk: 'drink',
  dug: 'dig',
  eaten: 'eat',
  fallen: 'fall',
  fed: 'feed',
  feet: 'foot',
  fell: 'fall',
  felt: 'feel',
  fled: 'flee',
  flew: 'fly',
  flown: 'fly',
  fought: 'fight',
  found: 'find',
  froze: 'freeze',
  gave: 'give',
  geese: 'goose',
  given: 'give',
  gone: 'go',
  got: 'get',
  gotten: 'get',
  grew: 'grow',
  grown: 'grow',
  had: 'have',
  halves: 'half',
  has: 'have',
  heard: 'hear',
  held: 'hold',
  hid: 'hide',
  hidden: 'hide',
  hung: 'hang',
  kept: 'keep',
  knelt: 'kneel',
  knew: 'know',
  knives: 'knife',
  known: 'know',
  laid: 'lay',
  lain: 'lie',
  leapt: 'leap',
  learnt: 'learn',
  leaves: 'leaf',
  led: 'lead',
  left: 'leave',
  lent: 'lend',
  lit: 'light',
  lives: 'life',
  loaves: 'loaf',
  lost: 'lose',
  made: 'make',
  meant: 'mean',
  men: 'man',
  met: 'meet',
  mice: 'mouse',
  paid: 'pay',
  ran: 'run',
  rang: 'ring',
  ridden: 'ride',
  risen: 'rise',
  rode: 'ride',
  rose: 'rise',
  rung: 'ring',
  said: 'say',
  sang: 'sing',
  sank: 'sink',
  sat: 'sit',
  saw: 'see',
  seen: 'see',
  sent: 'send',
  shaken: 'shake',
  shone: 'shine',
  shook: 'shake',
  shot: 'shoot',
  shown: 'show',
  slid: 'slide',
  slept: 'sleep',
  sold: 'sell',
  sought: 'seek',
  sped: 'speed',
  spent: 'spend',
  spoke: 'speak',
  spoken: 'speak',
  spun: 'spin',
  stole: 'steal',
  stolen: 'steal',
  stood: 'stand',
  struck: 'strike',
  stuck: 'stick',
  stung: 'sting',
  sung: 'sing',
  sunk: 'sink',
  swam: 'swim',
  swept: 'sweep',
  swore: 'swear',
  sworn: 'swear',
  swum: 'swim',
  swung: 'swing',
  taken: 'take',
  taught: 'teach',
  teeth: 'tooth',
  threw: 'throw',
  thrown: 'throw',
  told: 'tell',
  took: 'take',
  tore: 'tear',
  torn: 'tear',
  was: 'be',
  went: 'go',
  wept: 'weep',
  were: 'be',
  wives: 'wife',
  woke: 'wake',
  woken: 'wake',
  wolves: 'wolf',
  women: 'woman',
  won: 'win',
  wore: 'wear',
  worn: 'wear',
  worse: 'bad',
  worst: 'bad',
  better: 'good',
  best: 'good',
  wrote: 'write'
};

function formatShortTranslation(record: WordRecord): string {
  const raw = record.translationId || record.acceptId?.[0] || '';
  const parts = raw
    .split(/[,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length === 0) return raw.trim();
  return parts.slice(0, 2).join(', ');
}

function getStemCandidates(word: string): string[] {
  const w = word.toLowerCase();
  const cands = new Set<string>();

  if (IRREGULAR_LEMMAS[w]) {
    cands.add(IRREGULAR_LEMMAS[w]);
  }

  if (w.endsWith('ies') && w.length > 4) cands.add(`${w.slice(0, -3)}y`);
  if (w.endsWith('ves') && w.length > 4) {
    cands.add(`${w.slice(0, -3)}f`);
    cands.add(`${w.slice(0, -3)}fe`);
  }
  if (w.endsWith('es') && w.length > 3) {
    cands.add(w.slice(0, -2));
    cands.add(w.slice(0, -1));
  }
  if (w.endsWith('s') && w.length > 3) cands.add(w.slice(0, -1));

  if (w.endsWith('ied') && w.length > 4) cands.add(`${w.slice(0, -3)}y`);
  if (w.endsWith('ed') && w.length > 4) {
    const base = w.slice(0, -2);
    cands.add(base);
    cands.add(w.slice(0, -1));
    if (base.length >= 3 && base[base.length - 1] === base[base.length - 2]) {
      cands.add(base.slice(0, -1));
    }
  }

  if (w.endsWith('ing') && w.length > 5) {
    const base = w.slice(0, -3);
    cands.add(base);
    cands.add(`${base}e`);
    if (base.length >= 3 && base[base.length - 1] === base[base.length - 2]) {
      cands.add(base.slice(0, -1));
    }
  }

  if (w.endsWith('ier') && w.length > 4) cands.add(`${w.slice(0, -3)}y`);
  if (w.endsWith('er') && w.length > 4) {
    const base = w.slice(0, -2);
    cands.add(base);
    cands.add(w.slice(0, -1));
    if (base.length >= 3 && base[base.length - 1] === base[base.length - 2]) {
      cands.add(base.slice(0, -1));
    }
  }

  if (w.endsWith('iest') && w.length > 5) cands.add(`${w.slice(0, -4)}y`);
  if (w.endsWith('est') && w.length > 5) {
    const base = w.slice(0, -3);
    cands.add(base);
    cands.add(w.slice(0, -2));
    if (base.length >= 3 && base[base.length - 1] === base[base.length - 2]) {
      cands.add(base.slice(0, -1));
    }
  }

  return Array.from(cands);
}

async function getDerivativeMap(): Promise<Map<string, WordRecord>> {
  if (cachedDerivativeMap) return cachedDerivativeMap;
  const allWords = await db.words.toArray();
  const map = new Map<string, WordRecord>();
  for (const w of allWords) {
    for (const d of w.derivatives) {
      const key = d.toLowerCase().trim();
      if (key && !map.has(key)) {
        map.set(key, w);
      }
    }
  }
  cachedDerivativeMap = map;
  return map;
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

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
 * Menyiapkan daftar pasangan kata Inggris -> terjemahan Indonesia
 * sejumlah kata yang berhasil ditemukan pemain (maksimal 7 kata jika ditemukan >= 7).
 */
export async function buildTranslationMatchSession(
  foundEntries: Array<{ word: string; points: number }>
): Promise<{ items: MatchWordItem[]; options: MatchOptionItem[] }> {
  if (foundEntries.length === 0) {
    return { items: [], options: [] };
  }

  const lowerWords = foundEntries.map((f) => f.word.toLowerCase());
  const exactRecords = await db.words.bulkGet(lowerWords);
  let derivMap: Map<string, WordRecord> | null = null;

  const matchedAll: MatchWordItem[] = [];

  for (let i = 0; i < foundEntries.length; i++) {
    const entry = foundEntries[i];
    const clean = entry.word.toLowerCase();
    let record: WordRecord | undefined = exactRecords[i];

    if (!record) {
      const stems = getStemCandidates(clean);
      if (stems.length > 0) {
        const stemRecs = await db.words.bulkGet(stems);
        record = stemRecs.find((r): r is WordRecord => Boolean(r));
      }
    }

    if (!record) {
      if (!derivMap) {
        derivMap = await getDerivativeMap();
      }
      record = derivMap.get(clean);
    }

    if (record) {
      const translation = formatShortTranslation(record);
      if (translation) {
        matchedAll.push({
          word: entry.word,
          translation,
          points: entry.points
        });
      }
    }
  }

  if (matchedAll.length === 0) {
    return { items: [], options: [] };
  }

  // Jika kata yang ditemukan >= 7, pilih maksimal 7 kata saja secara acak
  const items =
    matchedAll.length > MAX_MATCH_WORDS
      ? shuffle(matchedAll).slice(0, MAX_MATCH_WORDS)
      : matchedAll;

  const usedTranslations = new Set(items.map((it) => it.translation.toLowerCase()));
  const optionList: MatchOptionItem[] = items.map((item, idx) => ({
    id: `opt_${idx}_${item.word}`,
    translation: item.translation
  }));

  // Jika hanya 1 kata yang punya terjemahan, tambahkan 2 pengecoh agar tetap menantang
  if (items.length === 1) {
    const sample = await db.words.limit(40).toArray();
    for (const cand of shuffle(sample)) {
      if (optionList.length >= 3) break;
      const tr = formatShortTranslation(cand);
      if (tr && !usedTranslations.has(tr.toLowerCase())) {
        usedTranslations.add(tr.toLowerCase());
        optionList.push({
          id: `dist_${cand.id}`,
          translation: tr
        });
      }
    }
  }

  return {
    items,
    options: shuffle(optionList)
  };
}

/**
 * Pilih ronde acak tanpa mengulang ronde yang baru saja dimainkan.
 */
export async function pickNextRound(
  rounds: ScrambleRound[]
): Promise<{ roundIndex: number; round: ScrambleRound }> {
  const recentRuns = await db.gameRuns
    .orderBy('playedAt')
    .reverse()
    .limit(MAX_GAME_HISTORY)
    .toArray();
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

/**
 * Hapus otomatis riwayat terlama agar hanya tersisa 5 riwayat terbaru.
 */
export async function pruneGameRuns(maxKeep = MAX_GAME_HISTORY): Promise<void> {
  await db.transaction('rw', db.gameRuns, async () => {
    const allRuns = await db.gameRuns.orderBy('playedAt').reverse().toArray();
    if (allRuns.length <= maxKeep) return;
    const oldIds = allRuns
      .slice(maxKeep)
      .map((r) => r.id)
      .filter((id): id is number => typeof id === 'number');
    if (oldIds.length > 0) {
      await db.gameRuns.bulkDelete(oldIds);
    }
  });
}

/**
 * Simpan sesi permainan baru dan langsung hapus data terlama di luar 5 terbaru.
 */
export async function saveGameRun(run: Omit<GameRunRecord, 'id'>): Promise<void> {
  await db.transaction('rw', db.gameRuns, async () => {
    await db.gameRuns.add(run);
    const allRuns = await db.gameRuns.orderBy('playedAt').reverse().toArray();
    if (allRuns.length > MAX_GAME_HISTORY) {
      const oldIds = allRuns
        .slice(MAX_GAME_HISTORY)
        .map((r) => r.id)
        .filter((id): id is number => typeof id === 'number');
      if (oldIds.length > 0) {
        await db.gameRuns.bulkDelete(oldIds);
      }
    }
  });
}
