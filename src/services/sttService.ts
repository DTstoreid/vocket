export interface PronunciationEvaluation {
  score: number;
  heard: string;
  alternatives: string[];
  matchType: 'EXACT' | 'ALTERNATIVE' | 'SIMILARITY';
}

interface SpeechRecognitionAlternativeLike {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionResultLike {
  length: number;
  [index: number]: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionEventLike {
  results: {
    length: number;
    [index: number]: SpeechRecognitionResultLike;
  };
}

interface SpeechRecognitionErrorEventLike {
  error: string;
}

interface SpeechRecognitionInstance {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

function getSpeechRecognitionConstructor(): (new () => SpeechRecognitionInstance) | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function isSttSupported(): boolean {
  return getSpeechRecognitionConstructor() !== null;
}

function normalizeToken(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z\s'-]/g, '')
    .trim();
}

/**
 * Dice's Coefficient (Bigram String Similarity) 0..1
 */
export function diceCoefficient(a: string, b: string): number {
  const s1 = normalizeToken(a).replace(/\s+/g, '');
  const s2 = normalizeToken(b).replace(/\s+/g, '');

  if (!s1 && !s2) return 1;
  if (!s1 || !s2) return 0;
  if (s1 === s2) return 1;
  if (s1.length < 2 || s2.length < 2) {
    return s1[0] === s2[0] ? 0.5 : 0;
  }

  const bigrams = new Map<string, number>();
  for (let i = 0; i < s1.length - 1; i++) {
    const bg = s1.slice(i, i + 2);
    bigrams.set(bg, (bigrams.get(bg) || 0) + 1);
  }

  let intersection = 0;
  for (let i = 0; i < s2.length - 1; i++) {
    const bg = s2.slice(i, i + 2);
    const count = bigrams.get(bg) || 0;
    if (count > 0) {
      bigrams.set(bg, count - 1);
      intersection++;
    }
  }

  return (2 * intersection) / (s1.length - 1 + (s2.length - 1));
}

/**
 * Algoritma Penilaian Pelafalan 0-100 sesuai spesifikasi:
 * - Exact Match (tebakan utama): clamp(round(confidence * 100), 85, 100) atau 90 jika confidence <= 0
 * - Alternative Match (urutan 2 atau 3+): 75 atau 70
 * - Partial Similarity: round(diceSimilarity * 70)
 */
export function scorePronunciation(
  targetWord: string,
  candidates: Array<{ transcript: string; confidence: number }>
): PronunciationEvaluation {
  const target = normalizeToken(targetWord);
  const cleaned = candidates
    .map((c) => ({
      raw: c.transcript.trim(),
      norm: normalizeToken(c.transcript),
      confidence: c.confidence
    }))
    .filter((c) => c.norm.length > 0);

  if (cleaned.length === 0) {
    return { score: 0, heard: '', alternatives: [], matchType: 'SIMILARITY' };
  }

  const first = cleaned[0];
  const alternatives = cleaned.map((c) => c.raw);

  // Cek exact match di tebakan utama (atau sebagai salah satu kata di frase)
  const firstWords = first.norm.split(/\s+/);
  if (first.norm === target || firstWords.includes(target)) {
    const rawScore = first.confidence > 0 ? Math.round(first.confidence * 100) : 90;
    const clamped = Math.max(85, Math.min(100, rawScore));
    return {
      score: clamped,
      heard: first.raw,
      alternatives,
      matchType: 'EXACT'
    };
  }

  // Cek alternative match (urutan 2 -> 75, urutan 3+ -> 70)
  for (let i = 1; i < cleaned.length; i++) {
    const words = cleaned[i].norm.split(/\s+/);
    if (cleaned[i].norm === target || words.includes(target)) {
      return {
        score: i === 1 ? 75 : 70,
        heard: first.raw,
        alternatives,
        matchType: 'ALTERNATIVE'
      };
    }
  }

  // Partial Similarity menggunakan Dice's Coefficient
  const similarity = diceCoefficient(target, first.norm);
  const simScore = Math.max(0, Math.min(70, Math.round(similarity * 70)));

  return {
    score: simScore,
    heard: first.raw,
    alternatives,
    matchType: 'SIMILARITY'
  };
}

export function listenAndScorePronunciation(targetWord: string): {
  promise: Promise<PronunciationEvaluation>;
  stop: () => void;
} {
  const Ctor = getSpeechRecognitionConstructor();
  if (!Ctor) {
    return {
      promise: Promise.reject(new Error('Browser tidak mendukung Speech Recognition.')),
      stop: () => {}
    };
  }

  const recognition = new Ctor();
  recognition.lang = 'en-US';
  recognition.interimResults = false;
  recognition.maxAlternatives = 5;
  recognition.continuous = false;

  const promise = new Promise<PronunciationEvaluation>((resolve, reject) => {
    let settled = false;

    recognition.onresult = (event) => {
      if (settled) return;
      settled = true;
      const result = event.results[0];
      const candidates: Array<{ transcript: string; confidence: number }> = [];
      for (let i = 0; i < result.length; i++) {
        candidates.push({
          transcript: result[i].transcript,
          confidence: result[i].confidence
        });
      }
      resolve(scorePronunciation(targetWord, candidates));
    };

    recognition.onerror = (event) => {
      if (settled) return;
      settled = true;
      if (event.error === 'no-speech') {
        reject(new Error('Suara tidak terdeteksi. Coba ucapkan lebih dekat ke mikrofon.'));
      } else if (event.error === 'not-allowed') {
        reject(new Error('Izin mikrofon ditolak. Aktifkan izin mikrofon di browser.'));
      } else {
        reject(new Error(`Gagal mengenali suara (${event.error}).`));
      }
    };

    recognition.onend = () => {
      if (!settled) {
        settled = true;
        reject(new Error('Rekaman selesai tanpa hasil suara.'));
      }
    };

    try {
      recognition.start();
    } catch (err) {
      settled = true;
      reject(err instanceof Error ? err : new Error('Gagal memulai mikrofon.'));
    }
  });

  return {
    promise,
    stop: () => {
      try {
        recognition.stop();
      } catch {
        // ignore
      }
    }
  };
}
