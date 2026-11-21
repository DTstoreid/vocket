import { useEffect, useRef, useState } from 'react';
import { Pause, Play, Repeat, SkipBack, SkipForward, Volume2, X } from 'lucide-react';
import type { AssignedWordWithDetails } from '../types/vocab';
import { delayMs, speakText, stopAllSpeech, type Accent, type FlashcardStep } from '../services/ttsService';

interface Props {
  open: boolean;
  onClose: () => void;
  todayWords: AssignedWordWithDetails[];
  batchWords: AssignedWordWithDetails[];
  accent: Accent;
}

const STEP_LABEL: Record<FlashcardStep, string> = {
  WORD: 'Kata (EN)',
  PAUSE_THINK: 'Ingat arti (2.5s)',
  TRANSLATION: 'Arti (ID)',
  EXAMPLE: 'Contoh kalimat',
  PAUSE_NEXT: 'Lanjut...'
};

export function AudioFlashcardSheet({ open, onClose, todayWords, batchWords, accent }: Props) {
  const [scope, setScope] = useState<'today' | 'batch'>('today');
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [repeat, setRepeat] = useState(true);
  const [step, setStep] = useState<FlashcardStep>('WORD');

  const abortRef = useRef<AbortController | null>(null);
  const list = scope === 'today' ? todayWords : batchWords;
  const current = list[index]?.word;

  const stopPlayback = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    stopAllSpeech();
    setPlaying(false);
  };

  useEffect(() => {
    if (!open) {
      stopPlayback();
    }
    return () => {
      stopPlayback();
    };
  }, [open]);

  useEffect(() => {
    setIndex(0);
    stopPlayback();
  }, [scope]);

  useEffect(() => {
    if (!playing || !open || list.length === 0) return;

    const controller = new AbortController();
    abortRef.current = controller;

    const runLoop = async () => {
      let i = index;
      while (!controller.signal.aborted && i < list.length) {
        setIndex(i);
        const w = list[i].word;

        // Step 1: Word EN (0.9x)
        setStep('WORD');
        await speakText(w.id, accent === 'uk' ? 'en-GB' : 'en-US', 0.9);
        if (controller.signal.aborted) break;

        // Step 2: Silent Delay 2.5s
        setStep('PAUSE_THINK');
        if (!(await delayMs(2500, controller.signal))) break;

        // Step 3: Indonesian Translation
        setStep('TRANSLATION');
        await speakText(w.translationId, 'id-ID', 0.95);
        if (controller.signal.aborted) break;

        // Step 4: Example sentence (1.0x)
        if (w.example) {
          setStep('EXAMPLE');
          await speakText(w.example, accent === 'uk' ? 'en-GB' : 'en-US', 1.0);
          if (controller.signal.aborted) break;
        }

        // Step 5: Silent Delay 1.5s
        setStep('PAUSE_NEXT');
        if (!(await delayMs(1500, controller.signal))) break;

        i += 1;
        if (i >= list.length) {
          if (repeat) {
            i = 0;
          } else {
            setPlaying(false);
            break;
          }
        }
      }
    };

    runLoop();

    return () => {
      controller.abort();
      stopAllSpeech();
    };
  }, [playing, open, scope, repeat, accent]);

  if (!open) return null;

  const handleJump = (delta: number) => {
    if (list.length === 0) return;
    const wasPlaying = playing;
    stopPlayback();
    const nextIdx = (index + delta + list.length) % list.length;
    setIndex(nextIdx);
    if (wasPlaying) {
      window.setTimeout(() => setPlaying(true), 50);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-end justify-center">
      <div className="w-full max-w-[430px] rounded-t-3xl bg-white p-5 safe-bottom shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Volume2 className="h-4 w-4 text-indigo-600" />
            <h2 className="text-sm font-semibold text-slate-900">Audio Flashcard</h2>
          </div>
          <button
            onClick={() => {
              stopPlayback();
              onClose();
            }}
            className="h-8 w-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-slate-100 mb-5">
          <button
            onClick={() => setScope('today')}
            className={`h-8 rounded-lg text-xs font-medium transition ${
              scope === 'today' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
            }`}
          >
            Today ({todayWords.length})
          </button>
          <button
            onClick={() => setScope('batch')}
            className={`h-8 rounded-lg text-xs font-medium transition ${
              scope === 'batch' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
            }`}
          >
            Batch ({batchWords.length})
          </button>
        </div>

        {current ? (
          <div className="rounded-2xl bg-slate-50 border border-slate-200/80 p-5 text-center mb-5">
            <div className="flex items-center justify-between text-[11px] text-slate-400 mb-3">
              <span className="font-mono">
                {index + 1} / {list.length}
              </span>
              <span className="font-medium text-indigo-600">{playing ? STEP_LABEL[step] : 'Siap'}</span>
            </div>
            <p className="text-2xl font-bold tracking-tight text-slate-900">{current.id}</p>
            {(current.ipaUs || current.ipaUk) && (
              <p className="mt-1 font-mono text-xs text-slate-400">
                {accent === 'uk' ? current.ipaUk || current.ipaUs : current.ipaUs || current.ipaUk}
              </p>
            )}
            <p className="mt-3 text-sm font-medium text-slate-700">{current.translationId}</p>
            {current.example && (
              <p className="mt-2 text-xs italic text-slate-500 line-clamp-2">{current.example}</p>
            )}
          </div>
        ) : (
          <div className="rounded-2xl bg-slate-50 p-6 text-center text-xs text-slate-500 mb-5">
            Belum ada kata di daftar ini.
          </div>
        )}

        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => setRepeat((r) => !r)}
            aria-label="Repeat"
            className={`h-10 w-10 rounded-full border flex items-center justify-center transition ${
              repeat
                ? 'border-indigo-200 bg-indigo-50 text-indigo-600'
                : 'border-slate-200 bg-white text-slate-400'
            }`}
          >
            <Repeat className="h-4 w-4" />
          </button>

          <button
            onClick={() => handleJump(-1)}
            aria-label="Prev"
            className="h-11 w-11 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center active:scale-95 transition"
          >
            <SkipBack className="h-4 w-4" />
          </button>

          <button
            onClick={() => (playing ? stopPlayback() : setPlaying(true))}
            disabled={list.length === 0}
            aria-label={playing ? 'Pause' : 'Play'}
            className="h-14 w-14 rounded-full bg-slate-900 text-white flex items-center justify-center shadow-md active:scale-95 transition disabled:opacity-40"
          >
            {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
          </button>

          <button
            onClick={() => handleJump(1)}
            aria-label="Next"
            className="h-11 w-11 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center active:scale-95 transition"
          >
            <SkipForward className="h-4 w-4" />
          </button>

          <div className="w-10" />
        </div>
      </div>
    </div>
  );
}
