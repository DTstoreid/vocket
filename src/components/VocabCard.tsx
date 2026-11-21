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
    <article className="rounded-[22px] bg-white border border-[#E6E4DD] p-4 shadow-card transition-all">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <h3 className="text-[19px] font-bold tracking-tight text-[#18221F] leading-snug">
              {word.id}
            </h3>
            <span className="rounded-full bg-[#F2F1EC] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#5C6863]">
              {posText}
            </span>
            {assigned.sourceType === 'CUSTOM' && (
              <span className="rounded-full bg-teal-50 border border-teal-200/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-teal-700">
                Custom
              </span>
            )}
            {assigned.masteryScore === 2 && (
              <span className="rounded-full bg-emerald-50 border border-emerald-200/70 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                Lulus
              </span>
            )}
            {assigned.masteryScore === 1 && (
              <span className="rounded-full bg-amber-50 border border-amber-200/80 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                Remedial
              </span>
            )}
          </div>
          {ipa && <p className="mt-0.5 font-mono text-xs text-[#7B8681]">{ipa}</p>}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => handleSpeak(1.0)}
            aria-label="Listen"
            className={`h-9 w-9 rounded-full border flex items-center justify-center transition active:scale-90 ${
              speaking
                ? 'bg-teal-700 border-teal-700 text-white'
                : 'bg-[#F6F5F1] border-[#E6E4DD] text-[#273430] hover:bg-[#ECEAE3]'
            }`}
          >
            <Volume2 className="h-4 w-4" />
          </button>
          <button
            onClick={() => onPracticeSpeak(item)}
            aria-label="Speak"
            className="h-9 px-3 rounded-full border border-[#E6E4DD] bg-[#F6F5F1] text-[#273430] hover:bg-[#ECEAE3] text-xs font-semibold flex items-center gap-1.5 transition active:scale-90"
          >
            <Mic className="h-3.5 w-3.5 text-teal-700" />
            {assigned.pronunciationScore > 0 ? (
              <span className="font-mono text-[11px]">{assigned.pronunciationScore}</span>
            ) : null}
          </button>
        </div>
      </div>

      <p className="mt-2.5 text-[14.5px] font-medium text-[#2A3733] leading-relaxed">
        {word.translationId}
      </p>

      {word.derivatives.length > 0 && (
        <div className="mt-3 rounded-2xl bg-[#F6F5F1] px-3 py-2.5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#7B8681] mb-1.5">
            Word Family
          </p>
          <div className="flex flex-wrap gap-1.5">
            {word.derivatives.map((d) => (
              <span
                key={d}
                className="rounded-full bg-white border border-[#E6E4DD] px-2.5 py-0.5 text-[11px] font-medium text-[#374540]"
              >
                {d}
              </span>
            ))}
          </div>
        </div>
      )}

      {expanded && (
        <div className="mt-3 pt-3 border-t border-[#ECEAE3] space-y-2.5 text-xs text-[#4E5B56]">
          {word.definitionEn && (
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#7B8681] block mb-0.5">
                Definition
              </span>
              <p className="leading-relaxed text-[#2A3733]">{word.definitionEn}</p>
            </div>
          )}

          {word.example && (
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#7B8681] block mb-0.5">
                Example
              </span>
              <p className="italic text-[#2A3733] leading-relaxed">{word.example}</p>
            </div>
          )}

          {word.synonyms.length > 0 && (
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#7B8681] block mb-1">
                Synonyms
              </span>
              <div className="flex flex-wrap gap-1.5">
                {word.synonyms.map((s) => (
                  <span
                    key={s}
                    className="rounded-full bg-[#F2F1EC] px-2.5 py-0.5 text-[11px] font-medium text-[#374540]"
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
              className="h-8 px-3.5 rounded-full bg-[#F2F1EC] hover:bg-[#E6E4DD] text-[#18221F] text-xs font-semibold active:scale-95 transition"
            >
              Slow 0.5x
            </button>
          </div>
        </div>
      )}

      <button
        onClick={() => setExpanded((v) => !v)}
        className="mt-2.5 w-full flex items-center justify-center gap-1 py-1 text-[11px] font-semibold text-[#7B8681] hover:text-[#18221F] transition"
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
