import { useRef, useState } from 'react';
import { Mic, MicOff, Volume2, X } from 'lucide-react';
import type { AssignedWordWithDetails } from '../types/vocab';
import { POS_LABEL } from '../types/vocab';
import { speakWord, stopAllSpeech, type Accent } from '../services/ttsService';
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
  const [interimText, setInterimText] = useState('');
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

    stopAllSpeech();
    setError(null);
    setResult(null);
    setInterimText('');
    setRecording(true);

    const session = listenAndScorePronunciation(word.id, (txt) => setInterimText(txt));
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
    <div className="fixed inset-0 z-50 bg-[#18221F]/45 backdrop-blur-sm flex items-end justify-center p-2.5">
      <div className="w-full max-w-[420px] rounded-[30px] bg-white border border-[#E6E4DD] p-5 safe-bottom shadow-float">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Mic className="h-4 w-4 text-teal-700" />
            <h2 className="text-sm font-bold text-[#18221F]">Pronunciation</h2>
          </div>
          <button
            onClick={() => {
              stopRef.current?.();
              stopAllSpeech();
              setResult(null);
              setError(null);
              setInterimText('');
              onClose();
            }}
            className="h-8 w-8 rounded-full bg-[#F6F5F1] text-[#64706B] flex items-center justify-center"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="rounded-[24px] bg-[#F6F5F1] border border-[#E6E4DD] p-5 text-center mb-4">
          <span className="inline-block rounded-full bg-white border border-[#E6E4DD] px-2.5 py-0.5 text-[10px] font-semibold uppercase text-[#64706B]">
            {POS_LABEL[word.pos] || word.pos}
          </span>
          <h3 className="mt-2 text-2xl font-extrabold tracking-tight text-[#18221F]">{word.id}</h3>
          {ipa && <p className="mt-1 font-mono text-xs text-[#7B8681]">{ipa}</p>}
          <p className="mt-2 text-sm font-medium text-[#2A3733]">{word.translationId}</p>

          {word.derivatives.length > 0 && (
            <div className="mt-3 flex flex-wrap justify-center gap-1.5">
              {word.derivatives.slice(0, 4).map((d) => (
                <span
                  key={d}
                  className="rounded-full bg-white border border-[#E6E4DD] px-2.5 py-0.5 text-[11px] font-medium text-[#4E5B56]"
                >
                  {d}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2.5 mb-4">
          <button
            onClick={() => speakWord(word, { accent, rate: 1.0, preferNativeAudio: true })}
            className="h-11 rounded-full border border-[#E6E4DD] bg-white text-[#18221F] text-xs font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition"
          >
            <Volume2 className="h-4 w-4 text-teal-700" />
            Normal 1.0x
          </button>
          <button
            onClick={() => speakWord(word, { accent, rate: 0.5, preferNativeAudio: false })}
            className="h-11 rounded-full border border-[#E6E4DD] bg-white text-[#18221F] text-xs font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition"
          >
            <Volume2 className="h-4 w-4 text-[#64706B]" />
            Slow 0.5x
          </button>
        </div>

        {recording && (
          <div className="rounded-2xl bg-teal-50 border border-teal-200 px-3.5 py-2.5 text-xs text-teal-900 mb-4 flex items-center justify-between">
            <span className="font-medium">Mendengarkan... ucapkan &ldquo;{word.id}&rdquo;</span>
            {interimText && <span className="font-mono font-bold">{interimText}</span>}
          </div>
        )}

        {result && (
          <div className="rounded-2xl border border-[#E6E4DD] bg-[#F6F5F1]/60 p-4 mb-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#7B8681]">Hasil</p>
              <p className="text-sm font-medium text-[#18221F] mt-0.5">
                Terdengar: <span className="font-mono font-semibold">{result.heard || '-'}</span>
              </p>
              <p className="text-[11px] text-[#64706B] mt-0.5">
                Skor terbaik: <span className="font-mono font-semibold">{bestScore}</span>
              </p>
            </div>
            <div
              className={`h-14 w-14 rounded-2xl flex items-center justify-center font-mono text-xl font-bold ${
                result.score >= 80
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-amber-50 text-amber-800 border border-amber-200'
              }`}
            >
              {result.score}
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-2xl bg-rose-50 border border-rose-200 px-3.5 py-2.5 text-xs text-rose-800 mb-4 leading-relaxed">
            {error}
          </div>
        )}

        {!sttReady && (
          <div className="rounded-2xl bg-amber-50 border border-amber-200 px-3.5 py-2.5 text-xs text-amber-900 mb-4">
            Browser ini belum mendukung Web Speech Recognition. Gunakan Chrome / Edge / Safari terbaru.
          </div>
        )}

        <button
          onClick={handleRecord}
          disabled={!sttReady}
          className={`w-full h-12 rounded-full text-sm font-bold flex items-center justify-center gap-2 transition active:scale-[0.98] disabled:opacity-40 ${
            recording ? 'bg-rose-600 text-white' : 'bg-teal-700 hover:bg-teal-800 text-white shadow-fab'
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
