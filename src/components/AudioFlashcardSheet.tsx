import { useEffect, useRef, useState } from 'react';
import { Pause, Play, Repeat, SkipBack, SkipForward, Volume2, X } from 'lucide-react';
import type { AssignedWordWithDetails } from '../types/vocab';
import {
  delayMs,
  speakText,
  speakWord,
  stopAllSpeech,
  unlockMobileAudio,
  type Accent,
  type FlashcardStep
} from '../services/ttsService';

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

        setStep('WORD');
        await speakWord(w, {
          accent,
          rate: 1.0,
          preferNativeAudio: true,
          signal: controller.signal
        });
        if (controller.signal.aborted) break;

        setStep('PAUSE_THINK');
        if (!(await delayMs(2500, controller.signal))) break;

        setStep('TRANSLATION');
        await speakText(w.translationId, 'id-ID', 0.95, controller.signal);
        if (controller.signal.aborted) break;

        if (w.example) {
          setStep('EXAMPLE');
          await speakText(
            w.example,
            accent === 'uk' ? 'en-GB' : 'en-US',
            1.0,
            controller.signal
          );
          if (controller.signal.aborted) break;
        }

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

  const handleTogglePlay = () => {
    if (playing) {
      stopPlayback();
    } else {
      unlockMobileAudio();
      setPlaying(true);
    }
  };

  const handleJump = (delta: number) => {
    if (list.length === 0) return;
    const wasPlaying = playing;
    stopPlayback();
    const nextIdx = (index + delta + list.length) % list.length;
    setIndex(nextIdx);
    if (wasPlaying) {
      unlockMobileAudio();
      window.setTimeout(() => setPlaying(true), 60);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#18221F]/45 backdrop-blur-sm flex items-end justify-center p-2.5">
      <div className="w-full max-w-[420px] rounded-[30px] bg-white border border-[#E6E4DD] p-5 safe-bottom shadow-float">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Volume2 className="h-4 w-4 text-teal-700" />
            <h2 className="text-sm font-bold text-[#18221F]">Audio Flashcard</h2>
          </div>
          <button
            onClick={() => {
              stopPlayback();
              onClose();
            }}
            className="h-8 w-8 rounded-full bg-[#F6F5F1] text-[#64706B] flex items-center justify-center"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-1 p-1 rounded-full bg-[#ECEAE3] mb-5">
          <button
            onClick={() => setScope('today')}
            className={`h-8 rounded-full text-xs font-semibold transition ${
              scope === 'today' ? 'bg-white text-[#18221F] shadow-sm' : 'text-[#5C6863]'
            }`}
          >
            Today ({todayWords.length})
          </button>
          <button
            onClick={() => setScope('batch')}
            className={`h-8 rounded-full text-xs font-semibold transition ${
              scope === 'batch' ? 'bg-white text-[#18221F] shadow-sm' : 'text-[#5C6863]'
            }`}
          >
            Batch ({batchWords.length})
          </button>
        </div>

        {current ? (
          <div className="rounded-[24px] bg-[#F6F5F1] border border-[#E6E4DD] p-5 text-center mb-5">
            <div className="flex items-center justify-between text-[11px] text-[#7B8681] mb-3">
              <span className="font-mono font-medium">
                {index + 1} / {list.length}
              </span>
              <span className="font-semibold text-teal-700">
                {playing ? STEP_LABEL[step] : 'Siap'}
              </span>
            </div>
            <p className="text-2xl font-extrabold tracking-tight text-[#18221F]">{current.id}</p>
            {(current.ipaUs || current.ipaUk) && (
              <p className="mt-1 font-mono text-xs text-[#7B8681]">
                {accent === 'uk' ? current.ipaUk || current.ipaUs : current.ipaUs || current.ipaUk}
              </p>
            )}
            <p className="mt-3 text-sm font-semibold text-[#2A3733]">{current.translationId}</p>
            {current.example && (
              <p className="mt-2 text-xs italic text-[#64706B] line-clamp-2">{current.example}</p>
            )}
          </div>
        ) : (
          <div className="rounded-[24px] bg-[#F6F5F1] p-6 text-center text-xs text-[#7B8681] mb-5">
            Belum ada kata di daftar ini.
          </div>
        )}

        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => setRepeat((r) => !r)}
            aria-label="Repeat"
            className={`h-10 w-10 rounded-full border flex items-center justify-center transition ${
              repeat
                ? 'border-teal-200 bg-teal-50 text-teal-700'
                : 'border-[#E6E4DD] bg-white text-[#8A948F]'
            }`}
          >
            <Repeat className="h-4 w-4" />
          </button>

          <button
            onClick={() => handleJump(-1)}
            aria-label="Prev"
            className="h-11 w-11 rounded-full bg-[#F6F5F1] border border-[#E6E4DD] text-[#18221F] flex items-center justify-center active:scale-90 transition"
          >
            <SkipBack className="h-4 w-4" />
          </button>

          <button
            onClick={handleTogglePlay}
            disabled={list.length === 0}
            aria-label={playing ? 'Pause' : 'Play'}
            className="h-14 w-14 rounded-full bg-teal-700 hover:bg-teal-800 text-white flex items-center justify-center shadow-fab active:scale-90 transition disabled:opacity-40"
          >
            {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
          </button>

          <button
            onClick={() => handleJump(1)}
            aria-label="Next"
            className="h-11 w-11 rounded-full bg-[#F6F5F1] border border-[#E6E4DD] text-[#18221F] flex items-center justify-center active:scale-90 transition"
          >
            <SkipForward className="h-4 w-4" />
          </button>

          <div className="w-10" />
        </div>
      </div>
    </div>
  );
}
