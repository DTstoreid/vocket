import type { WordRecord } from '../types/vocab';

export type Accent = 'us' | 'uk';
export type FlashcardStep = 'WORD' | 'PAUSE_THINK' | 'TRANSLATION' | 'EXAMPLE' | 'PAUSE_NEXT';

let currentAudio: HTMLAudioElement | null = null;

export function stopAllSpeech(): void {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }
}

function getBestVoice(langPrefix: string): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  const exact = voices.find((v) => v.lang.toLowerCase() === langPrefix.toLowerCase());
  if (exact) return exact;
  const prefix = langPrefix.split('-')[0].toLowerCase();
  return voices.find((v) => v.lang.toLowerCase().startsWith(prefix)) || null;
}

export function speakText(text: string, lang: 'en-US' | 'en-GB' | 'id-ID' = 'en-US', rate = 1.0): Promise<void> {
  return new Promise((resolve) => {
    if (!text.trim() || typeof window === 'undefined' || !('speechSynthesis' in window)) {
      resolve();
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = rate;

    const voice = getBestVoice(lang);
    if (voice) {
      utterance.voice = voice;
    }

    let settled = false;
    const finish = () => {
      if (!settled) {
        settled = true;
        resolve();
      }
    };

    utterance.onend = finish;
    utterance.onerror = finish;

    // Fallback timeout agar loop audio tidak macet di mobile browser tertentu
    const estimatedMs = Math.max(2500, Math.min(12000, text.length * 120));
    const timer = window.setTimeout(finish, estimatedMs);
    utterance.onend = () => {
      window.clearTimeout(timer);
      finish();
    };
    utterance.onerror = () => {
      window.clearTimeout(timer);
      finish();
    };

    window.speechSynthesis.speak(utterance);
  });
}

export async function speakWord(
  word: WordRecord,
  options?: { accent?: Accent; rate?: number; preferNativeAudio?: boolean }
): Promise<void> {
  const accent = options?.accent ?? 'us';
  const rate = options?.rate ?? 1.0;
  const preferNative = options?.preferNativeAudio ?? (rate === 1.0);

  stopAllSpeech();

  const audioUrl = accent === 'uk' ? word.audioUk || word.audioUs : word.audioUs || word.audioUk;

  if (preferNative && audioUrl && rate === 1.0) {
    try {
      await new Promise<void>((resolve, reject) => {
        const audio = new Audio(audioUrl);
        currentAudio = audio;
        audio.onended = () => {
          currentAudio = null;
          resolve();
        };
        audio.onerror = () => {
          currentAudio = null;
          reject(new Error('Audio playback failed'));
        };
        const playPromise = audio.play();
        if (playPromise) {
          playPromise.catch((err) => {
            currentAudio = null;
            reject(err);
          });
        }
      });
      return;
    } catch {
      // Fallback mulus ke Web Speech API TTS jika offline atau file audio gagal diputar
    }
  }

  await speakText(word.id, accent === 'uk' ? 'en-GB' : 'en-US', rate);
}

export function delayMs(ms: number, signal?: AbortSignal): Promise<boolean> {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve(false);
      return;
    }
    const timer = window.setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve(true);
    }, ms);
    const onAbort = () => {
      window.clearTimeout(timer);
      resolve(false);
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}
