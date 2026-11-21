import type { DatasetIndex, RawDatasetWord, WordRecord } from '../types/vocab';
import { POS_LABEL } from '../types/vocab';
import { db, getMeta, setMeta } from './vocketDb';

export interface LoadProgress {
  loadedFiles: number;
  totalFiles: number;
  loadedWords: number;
  totalWords: number;
  stage: 'fetching' | 'indexing' | 'done';
}

const SUFFIXES = [
  'ational',
  'ization',
  'fulness',
  'ousness',
  'iveness',
  'ically',
  'ement',
  'ments',
  'ation',
  'ition',
  'ative',
  'itive',
  'fully',
  'ingly',
  'edly',
  'able',
  'ible',
  'ment',
  'ness',
  'less',
  'tion',
  'sion',
  'ship',
  'hood',
  'ical',
  'ious',
  'eous',
  'ive',
  'ous',
  'ful',
  'ing',
  'ize',
  'ise',
  'ify',
  'ate',
  'ity',
  'ist',
  'ism',
  'ant',
  'ent',
  'ary',
  'ory',
  'al',
  'er',
  'or',
  'ly',
  'ed',
  'es',
  'ic',
  'y',
  's'
];

function computeMorphStem(word: string): string {
  const clean = word.toLowerCase().trim();
  if (clean.length <= 4 || clean.includes(' ') || clean.includes('-')) {
    return clean;
  }
  for (const suffix of SUFFIXES) {
    if (clean.endsWith(suffix) && clean.length - suffix.length >= 4) {
      let stem = clean.slice(0, -suffix.length);
      if (stem.endsWith('i') && suffix.startsWith('c') === false) {
        stem = stem.slice(0, -1);
      }
      return stem;
    }
  }
  return clean;
}

function tokenizeText(word: string, translations: string[]): string[] {
  const tokens = new Set<string>();
  const lowerWord = word.toLowerCase().trim();
  tokens.add(lowerWord);
  if (lowerWord.length >= 2) {
    tokens.add(lowerWord.slice(0, 2));
  }
  if (lowerWord.length >= 3) {
    tokens.add(lowerWord.slice(0, 3));
  }

  for (const tr of translations) {
    const parts = tr
      .toLowerCase()
      .split(/[\s,;/()-]+/)
      .filter((p) => p.length >= 2);
    for (const p of parts) {
      tokens.add(p);
    }
  }
  return Array.from(tokens);
}

export async function getDatasetBaseUrl(): Promise<string> {
  const saved = await getMeta('datasetBaseUrl', '');
  if (saved.trim()) {
    return saved.trim().replace(/\/+$/, '');
  }
  const envUrl = import.meta.env.VITE_DATASET_BASE_URL as string | undefined;
  if (envUrl && envUrl.trim()) {
    return envUrl.trim().replace(/\/+$/, '');
  }
  return '/dataset';
}

export async function isDatasetLoaded(): Promise<boolean> {
  const count = await db.words.count();
  return count >= 1000;
}

export async function loadDatasetIntoDexie(
  onProgress?: (progress: LoadProgress) => void
): Promise<{ totalWords: number; version: number }> {
  const baseUrl = await getDatasetBaseUrl();

  const fetchJson = async <T>(fileName: string): Promise<T> => {
    try {
      const res = await fetch(`${baseUrl}/${fileName}`);
      if (res.ok) {
        return (await res.json()) as T;
      }
    } catch {
      // Fallback ke static local /dataset jika remote GitHub gagal
    }
    if (baseUrl !== '/dataset') {
      const fallbackRes = await fetch(`/dataset/${fileName}`);
      if (!fallbackRes.ok) {
        throw new Error(`Gagal memuat ${fileName}`);
      }
      return (await fallbackRes.json()) as T;
    }
    throw new Error(`Gagal memuat ${fileName}`);
  };

  const index = await fetchJson<DatasetIndex>('index.json');
  const totalFiles = index.levels.length;
  const rawWords: RawDatasetWord[] = [];

  for (let i = 0; i < totalFiles; i++) {
    const lvl = index.levels[i];
    const chunk = await fetchJson<RawDatasetWord[]>(lvl.file);
    rawWords.push(...chunk);
    onProgress?.({
      loadedFiles: i + 1,
      totalFiles,
      loadedWords: rawWords.length,
      totalWords: index.total_words,
      stage: 'fetching'
    });
  }

  onProgress?.({
    loadedFiles: totalFiles,
    totalFiles,
    loadedWords: rawWords.length,
    totalWords: index.total_words,
    stage: 'indexing'
  });

  // 1. Bangun peta synset -> daftar kata untuk sinonim otomatis
  const synsetToWords = new Map<string, Set<string>>();
  // 2. Bangun peta stem -> daftar kata untuk Word Family (derivatives)
  const stemToEntries = new Map<string, Array<{ id: string; pos: string }>>();

  for (const item of rawWords) {
    for (const m of item.meanings || []) {
      if (m.synset) {
        let set = synsetToWords.get(m.synset);
        if (!set) {
          set = new Set<string>();
          synsetToWords.set(m.synset, set);
        }
        set.add(item.id);
      }
    }
    const stem = computeMorphStem(item.id);
    if (stem.length >= 4) {
      let arr = stemToEntries.get(stem);
      if (!arr) {
        arr = [];
        stemToEntries.set(stem, arr);
      }
      arr.push({ id: item.id, pos: item.pos?.[0] || 'n' });
    }
  }

  const records: WordRecord[] = rawWords.map((item) => {
    const primaryMeaning = item.meanings?.[0];
    const primaryPos = item.pos?.[0] || primaryMeaning?.pos || 'n';

    const translationCandidates =
      primaryMeaning?.id && primaryMeaning.id.length > 0
        ? primaryMeaning.id.slice(0, 3)
        : item.accept_id.slice(0, 3);
    const translationId = translationCandidates.join(', ');

    const definitionEn = primaryMeaning?.def || '';

    // Cari contoh kalimat yang paling baik (prioritaskan yang mengandung kata target untuk Cloze Test)
    let bestExample = '';
    const escapedWord = item.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const wordRegex = new RegExp(`\\b${escapedWord}\\b`, 'i');
    for (const m of item.meanings || []) {
      for (const ex of m.ex || []) {
        if (!bestExample) bestExample = ex;
        if (wordRegex.test(ex)) {
          bestExample = ex;
          break;
        }
      }
      if (bestExample && wordRegex.test(bestExample)) break;
    }

    // Sinonim dari synset yang sama
    const synSet = new Set<string>();
    for (const m of item.meanings || []) {
      if (m.synset) {
        const siblings = synsetToWords.get(m.synset);
        if (siblings) {
          for (const w of siblings) {
            if (w !== item.id) synSet.add(w);
          }
        }
      }
    }

    // Word family dari stem morfologi yang sama
    const stem = computeMorphStem(item.id);
    const familyEntries = stemToEntries.get(stem) || [];
    const derivatives = familyEntries
      .filter((e) => e.id !== item.id)
      .slice(0, 5)
      .map((e) => `${e.id} (${POS_LABEL[e.pos] || e.pos})`);

    return {
      id: item.id,
      order: item.order,
      level: item.level,
      pos: primaryPos,
      posList: item.pos || [primaryPos],
      zipf: item.zipf,
      ipaUs: item.ipa?.us || item.ipa?.uk || '',
      ipaUk: item.ipa?.uk || item.ipa?.us || '',
      audioUs: item.audio?.us || null,
      audioUk: item.audio?.uk || null,
      translationId,
      acceptId: item.accept_id || [],
      definitionEn,
      example: bestExample,
      synonyms: Array.from(synSet).slice(0, 6),
      derivatives,
      searchTokens: tokenizeText(item.id, item.accept_id || [])
    };
  });

  await db.transaction('rw', db.words, db.appMeta, async () => {
    await db.words.clear();
    // Bulk insert per 500 baris agar tetap responsif di mobile
    const chunkSize = 500;
    for (let i = 0; i < records.length; i += chunkSize) {
      await db.words.bulkPut(records.slice(i, i + chunkSize));
    }
    await setMeta('datasetVersion', String(index.version));
    await setMeta('datasetTotalWords', String(records.length));
  });

  onProgress?.({
    loadedFiles: totalFiles,
    totalFiles,
    loadedWords: records.length,
    totalWords: records.length,
    stage: 'done'
  });

  return { totalWords: records.length, version: index.version };
}
