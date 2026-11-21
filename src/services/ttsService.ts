```typescript
import type { WordRecord } from '../types/vocab';

export type Accent = 'us' | 'uk';
export type FlashcardStep = 'WORD' | 'PAUSE_THINK' | 'TRANSLATION' | 'EXAMPLE' | 'PAUSE_NEXT';

let currentAudio: HTMLAudioElement | null = null;
let sharedAudioEl: HTMLAudioElement | null = null;

function getSharedAudio(): HTMLAudioElement {
  if (!sharedAudioEl) {
    sharedAudioEl = new Audio();
    sharedAudioEl.preload = 'auto';
  }
  return sharedAudioEl;
}

/**
 * Wajib dipanggil secara sinkron di dalam event onClick tombol Play
 * agar browser mobile (Android Chrome / iOS Safari) membuka izin audio & TTS.
 */
export function unlockMobileAudio(): void {
  if (typeof window === 'undefined') return;
  if ('speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
      window.speechSynthesis.resume();
      const primer = new SpeechSynthesisUtterance(' ');
      primer.volume = 0;
      primer.rate = 2;
      window.speechSynthesis.speak(primer);
    } catch {
      // ignore
    }
  }
  try {
    const audio = getSharedAudio();
    audio.muted = true;
    const p = audio.play();
    if (p) {
      p.then(() => {
        audio.pause();
        audio.muted = false;
      }).catch(() => {
        audio.muted = false;
      });
    }
  } catch {
    // ignore
  }
}

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

export function speakText(
  text: string,
  lang: 'en-US' | 'en-GB' | 'id-ID' = 'en-US',
  rate = 1.0,
  signal?: AbortSignal
): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted || !text.trim() || typeof window === 'undefined' || !('speechSynthesis' in window)) {
      resolve();
      return;
    }

    const synth = window.speechSynthesis;
    synth.cancel();

    let settled = false;
    let fallbackTimer = 0;

    const finish = () => {
      if (!settled) {
        settled = true;
        window.clearTimeout(fallbackTimer);
        signal?.removeEventListener('abort', onAbort);
        resolve();
      }
    };

    const onAbort = () => {
      synth.cancel();
      finish();
    };
    signal?.addEventListener('abort', onAbort, { once: true });

    // Jeda 60ms setelah cancel() agar Chrome Android tidak ikut membatalkan utterance baru
    window.setTimeout(() => {
      if (settled || signal?.aborted) {
        finish();
        return;
      }

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang;
      utterance.rate = rate;
      utterance.volume = 1;

      const voice = getBestVoice(lang);
      if (voice) {
        utterance.voice = voice;
      }

      utterance.onend = finish;
      utterance.onerror = finish;

      const estimatedMs = Math.max(3000, Math.min(12000, text.length * 140));
      fallbackTimer = window.setTimeout(finish, estimatedMs);

      synth.resume();
      synth.speak(utterance);
    }, 60);
  });
}

export async function speakWord(
  word: WordRecord,
  options?: { accent?: Accent; rate?: number; preferNativeAudio?: boolean; signal?: AbortSignal }
): Promise<void> {
  const accent = options?.accent ?? 'us';
  const rate = options?.rate ?? 1.0;
  const preferNative = options?.preferNativeAudio ?? rate === 1.0;
  const signal = options?.signal;

  if (signal?.aborted) return;
  stopAllSpeech();

  const audioUrl = accent === 'uk' ? word.audioUk || word.audioUs : word.audioUs || word.audioUk;

  if (preferNative && audioUrl && rate === 1.0) {
    try {
      await new Promise<void>((resolve, reject) => {
        if (signal?.aborted) {
          resolve();
          return;
        }
        const audio = getSharedAudio();
        currentAudio = audio;
        audio.muted = false;
        audio.src = audioUrl;

        const cleanup = () => {
          audio.onended = null;
          audio.onerror = null;
          signal?.removeEventListener('abort', onAbort);
          if (currentAudio === audio) currentAudio = null;
        };

        const onAbort = () => {
          audio.pause();
          cleanup();
          resolve();
        };

        signal?.addEventListener('abort', onAbort, { once: true });
        audio.onended = () => {
          cleanup();
          resolve();
        };
        audio.onerror = () => {
          cleanup();
          reject(new Error('Audio playback failed'));
        };

        const playPromise = audio.play();
        if (playPromise) {
          playPromise.catch((err) => {
            cleanup();
            reject(err);
          });
        }
      });
      return;
    } catch {
      // Fallback mulus ke Web Speech API TTS jika offline atau file audio gagal diputar
    }
  }

  await speakText(word.id, accent === 'uk' ? 'en-GB' : 'en-US', rate, signal);
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
```
