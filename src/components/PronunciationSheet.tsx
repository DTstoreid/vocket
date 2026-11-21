import { useRef, useState } from 'react';
import { Mic, MicOff, Volume2, X } from 'lucide-react';
import type { AssignedWordWithDetails } from '../types/vocab';
import { POS_LABEL } from '../types/vocab';
import { speakWord, type Accent } from '../services/ttsService';
import {
  isSttSupported,
  listenAndScorePronunciation,
  type PronunciationEvaluation
} from '../services/sttService';
import { updatePronunciationResult } from '../db/progressService';

interface Props {
  item: AssignedWordWithDetails | null;
  accent: Accent;
  onClose: () => void;
  onUpdated: () => void;
}

export function PronunciationSheet({ item, accent, onClose, onUpdated }: Props) {
  const [recording, setRecording] = useState(false);
  const [result, setResult] = useState<PronunciationEvaluation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const stopRef = useRef<(() => void) | null>(null);

  if (!item) return null;

  const { word, assigned } = item;
  const ipa = accent === 'uk' ? word.ipaUk || word.ipaUs : word.ipaUs || word.ipaUk;
  const sttReady = isSttSupported();

  const handleRecord = async () => {
    if (recording) {
      stopRef.current?.();
      setRecording(false);
      return;
    }

    setError(null);
    setResult(null);
    setRecording(true);

    const session = listenAndScorePronunciation(word.id);
    stopRef.current = session.stop;

    try {
      const evaluation = await session.promise;
      setResult(evaluation);
      await updatePronunciationResult(word.id, evaluation.score);
      onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal merekam suara.');
    } finally {
      setRecording(false);
      stopRef.current = null;
    }
  };

  const bestScore = Math.max(assigned.pronunciationScore, result?.score || 0);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-end justify-center">
      <div className="w-full max-w-[430px] rounded-t-3xl bg-white p-5 safe-bottom shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Mic className="h-4 w-4 text-indigo-600" />
            <h2 className="text-sm font-semibold text-slate-900">Pronunciation</h2>
          </div>
          <button
            onClick={() => {
              stopRef.current?.();
              setResult(null);
              setError(null);
              onClose();
            }}
            className="h-8 w-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="rounded-2xl bg-slate-50 border border-slate-200/80 p-5 text-center mb-4">
          <span className="inline-block rounded-md bg-white border border-slate-200 px-2 py-0.5 text-[10px] font-medium uppercase text-slate-500">
            {POS_LABEL[word.pos] || word.pos}
          </span>
          <h3 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{word.id}</h3>
          {ipa && <p className="mt-1 font-mono text-xs text-slate-400">{ipa}</p>}
          <p className="mt-2 text-sm text-slate-700">{word.translationId}</p>

          {word.derivatives.length > 0 && (
            <div className="mt-3 flex flex-wrap justify-center gap-1">
              {word.derivatives.slice(0, 4).map((d) => (
                <span
                  key={d}
                  className="rounded-md bg-white border border-slate-200 px-2 py-0.5 text-[11px] text-slate-600"
                >
                  {d}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2.5 mb-5">
          <button
            onClick={() => speakWord(word, { accent, rate: 1.0, preferNativeAudio: true })}
            className="h-11 rounded-xl border border-slate-200 bg-white text-slate-800 text-xs font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition"
          >
            <Volume2 className="h-4 w-4 text-indigo-600" />
            Normal 1.0x
          </button>
          <button
            onClick={() => speakWord(word, { accent, rate: 0.5, preferNativeAudio: false })}
            className="h-11 rounded-xl border border-slate-200 bg-white text-slate-800 text-xs font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition"
          >
            <Volume2 className="h-4 w-4 text-slate-500" />
            Slow 0.5x
          </button>
        </div>

        {result && (
          <div className="rounded-2xl border border-slate-200 p-4 mb-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-slate-400">Hasil</p>
              <p className="text-sm font-medium text-slate-800 mt-0.5">
                Terdengar: <span className="font-mono">{result.heard || '-'}</span>
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Skor terbaik: <span className="font-mono font-semibold">{bestScore}</span>
              </p>
            </div>
            <div
              className={`h-14 w-14 rounded-2xl flex items-center justify-center font-mono text-xl font-bold ${
                result.score >= 80
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border border-amber-200'
              }`}
            >
              {result.score}
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-xl bg-rose-50 border border-rose-200 px-3.5 py-2.5 text-xs text-rose-700 mb-4">
            {error}
          </div>
        )}

        {!sttReady && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 px-3.5 py-2.5 text-xs text-amber-800 mb-4">
            Browser ini belum mendukung Web Speech Recognition. Gunakan Chrome / Edge / Safari terbaru.
          </div>
        )}

        <button
          onClick={handleRecord}
          disabled={!sttReady}
          className={`w-full h-12 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition active:scale-[0.98] disabled:opacity-40 ${
            recording
              ? 'bg-rose-600 text-white'
              : 'bg-slate-900 text-white'
          }`}
        >
          {recording ? (
            <>
              <MicOff className="h-4 w-4" />
              Stop
            </>
          ) : (
            <>
              <Mic className="h-4 w-4" />
              Bicara
            </>
          )}
        </button>
      </div>
    </div>
  );
}
