import { useState } from 'react';
import { ChevronDown, ChevronUp, Mic, Volume2 } from 'lucide-react';
import type { AssignedWordWithDetails } from '../types/vocab';
import { POS_LABEL } from '../types/vocab';
import { speakWord, type Accent } from '../services/ttsService';

interface Props {
  item: AssignedWordWithDetails;
  accent: Accent;
  onPracticeSpeak: (item: AssignedWordWithDetails) => void;
}

export function VocabCard({ item, accent, onPracticeSpeak }: Props) {
  const { word, assigned } = item;
  const [expanded, setExpanded] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  const ipa = accent === 'uk' ? word.ipaUk || word.ipaUs : word.ipaUs || word.ipaUk;
  const posText = POS_LABEL[word.pos] || word.pos;

  const handleSpeak = async (rate: number) => {
    setSpeaking(true);
    try {
      await speakWord(word, { accent, rate, preferNativeAudio: rate === 1.0 });
    } finally {
      setSpeaking(false);
    }
  };

  return (
    <article className="rounded-2xl bg-white border border-slate-200/80 p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-lg font-bold tracking-tight text-slate-900">{word.id}</h3>
            <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-600">
              {posText}
            </span>
            {assigned.sourceType === 'CUSTOM' && (
              <span className="rounded-md bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-600">
                Custom
              </span>
            )}
            {assigned.masteryScore === 2 && (
              <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                Lulus
              </span>
            )}
            {assigned.masteryScore === 1 && (
              <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                Remedial
              </span>
            )}
          </div>
          {ipa && <p className="mt-0.5 font-mono text-xs text-slate-400">{ipa}</p>}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => handleSpeak(1.0)}
            aria-label="Listen"
            className={`h-9 w-9 rounded-xl border flex items-center justify-center transition active:scale-95 ${
              speaking
                ? 'bg-indigo-600 border-indigo-600 text-white'
                : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Volume2 className="h-4 w-4" />
          </button>
          <button
            onClick={() => onPracticeSpeak(item)}
            aria-label="Speak"
            className="h-9 px-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 text-xs font-medium flex items-center gap-1 transition active:scale-95"
          >
            <Mic className="h-3.5 w-3.5" />
            {assigned.pronunciationScore > 0 ? (
              <span className="font-mono text-[11px]">{assigned.pronunciationScore}</span>
            ) : null}
          </button>
        </div>
      </div>

      <p className="mt-2.5 text-sm font-medium text-slate-800">{word.translationId}</p>

      {word.derivatives.length > 0 && (
        <div className="mt-3 rounded-xl bg-slate-50 border border-slate-100 px-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
            Word Family
          </p>
          <div className="flex flex-wrap gap-1.5">
            {word.derivatives.map((d) => (
              <span
                key={d}
                className="rounded-lg bg-white border border-slate-200/80 px-2 py-0.5 text-[11px] text-slate-700"
              >
                {d}
              </span>
            ))}
          </div>
        </div>
      )}

      {expanded && (
        <div className="mt-3 pt-3 border-t border-slate-100 space-y-2.5 text-xs text-slate-600">
          {word.definitionEn && (
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block mb-0.5">
                Definition
              </span>
              <p className="leading-relaxed text-slate-700">{word.definitionEn}</p>
            </div>
          )}

          {word.example && (
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block mb-0.5">
                Example
              </span>
              <p className="italic text-slate-700 leading-relaxed">{word.example}</p>
            </div>
          )}

          {word.synonyms.length > 0 && (
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
                Synonyms
              </span>
              <div className="flex flex-wrap gap-1">
                {word.synonyms.map((s) => (
                  <span
                    key={s}
                    className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="pt-1 flex items-center gap-2">
            <button
              onClick={() => handleSpeak(0.55)}
              className="h-8 px-3 rounded-lg bg-slate-100 text-slate-700 text-xs font-medium active:scale-95 transition"
            >
              Slow 0.5x
            </button>
          </div>
        </div>
      )}

      <button
        onClick={() => setExpanded((v) => !v)}
        className="mt-2.5 w-full flex items-center justify-center gap-1 py-1 text-[11px] font-medium text-slate-400 hover:text-slate-600 transition"
      >
        {expanded ? (
          <>
            Ringkas <ChevronUp className="h-3.5 w-3.5" />
          </>
        ) : (
          <>
            Detail <ChevronDown className="h-3.5 w-3.5" />
          </>
        )}
      </button>
    </article>
  );
}
