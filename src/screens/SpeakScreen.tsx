import { useMemo, useState } from 'react';
import { Mic, Volume2 } from 'lucide-react';
import type { AssignedWordWithDetails } from '../types/vocab';
import { speakWord, type Accent } from '../services/ttsService';

type SpeakFilter = 'ALL' | 'NEW' | 'LOW' | 'FLUENT';

interface Props {
  items: AssignedWordWithDetails[];
  accent: Accent;
  onSelectWord: (item: AssignedWordWithDetails) => void;
}

const FILTERS: Array<{ id: SpeakFilter; label: string }> = [
  { id: 'ALL', label: 'All' },
  { id: 'NEW', label: 'New' },
  { id: 'LOW', label: '< 80' },
  { id: 'FLUENT', label: '80+' }
];

export function SpeakScreen({ items, accent, onSelectWord }: Props) {
  const [filter, setFilter] = useState<SpeakFilter>('ALL');

  const stats = useMemo(() => {
    const practiced = items.filter((i) => i.assigned.pronunciationAttempts > 0);
    const fluent = items.filter((i) => i.assigned.pronunciationScore >= 80);
    const avg =
      practiced.length > 0
        ? Math.round(
            practiced.reduce((sum, i) => sum + i.assigned.pronunciationScore, 0) / practiced.length
          )
        : 0;
    return { avg, fluent: fluent.length, total: items.length };
  }, [items]);

  const filtered = useMemo(() => {
    return items.filter((item) => {
      const { pronunciationScore, pronunciationAttempts } = item.assigned;
      if (filter === 'NEW') return pronunciationAttempts === 0;
      if (filter === 'LOW') return pronunciationAttempts > 0 && pronunciationScore < 80;
      if (filter === 'FLUENT') return pronunciationScore >= 80;
      return true;
    });
  }, [items, filter]);

  return (
    <div className="space-y-4 pb-28">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-[22px] bg-white border border-[#E6E4DD] p-4 shadow-card">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#7B8681]">
            Rata-rata
          </p>
          <p className="mt-1.5 font-mono text-2xl font-bold text-[#18221F]">
            {stats.avg}
            <span className="text-xs font-normal text-[#7B8681]"> / 100</span>
          </p>
        </div>
        <div className="rounded-[22px] bg-white border border-[#E6E4DD] p-4 shadow-card">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#7B8681]">
            Fasih (80+)
          </p>
          <p className="mt-1.5 font-mono text-2xl font-bold text-teal-700">
            {stats.fluent}
            <span className="text-xs font-normal text-[#7B8681]"> / {stats.total}</span>
          </p>
        </div>
      </div>

      {/* Filter Chips */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`h-9 px-4 rounded-full text-xs font-semibold shrink-0 transition active:scale-95 ${
              filter === f.id
                ? 'bg-[#18221F] text-white shadow-sm'
                : 'bg-white border border-[#E6E4DD] text-[#4E5B56]'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Word List */}
      {filtered.length === 0 ? (
        <div className="rounded-[22px] bg-white border border-[#E6E4DD] p-8 text-center text-xs font-medium text-[#7B8681]">
          Tidak ada kata pada filter ini.
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((item) => {
            const { word, assigned } = item;
            const ipa = accent === 'uk' ? word.ipaUk || word.ipaUs : word.ipaUs || word.ipaUk;
            const score = assigned.pronunciationScore;

            return (
              <div
                key={word.id}
                onClick={() => onSelectWord(item)}
                className="rounded-[20px] bg-white border border-[#E6E4DD] p-3.5 shadow-card flex items-center justify-between gap-3 cursor-pointer active:scale-[0.99] transition"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[15px] font-bold text-[#18221F]">{word.id}</span>
                    {ipa && (
                      <span className="font-mono text-[11px] text-[#7B8681] truncate">{ipa}</span>
                    )}
                  </div>
                  <p className="text-xs text-[#5C6863] truncate mt-0.5">{word.translationId}</p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      speakWord(word, { accent, rate: 1.0, preferNativeAudio: true });
                    }}
                    aria-label="Listen"
                    className="h-9 w-9 rounded-full bg-[#F6F5F1] border border-[#E6E4DD] text-[#273430] flex items-center justify-center active:scale-90 transition"
                  >
                    <Volume2 className="h-3.5 w-3.5" />
                  </button>

                  {assigned.pronunciationAttempts > 0 ? (
                    <span
                      className={`h-9 min-w-11 px-2.5 rounded-full font-mono text-xs font-bold flex items-center justify-center ${
                        score >= 80
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/80'
                          : 'bg-amber-50 text-amber-800 border border-amber-200/80'
                      }`}
                    >
                      {score}
                    </span>
                  ) : (
                    <span className="h-9 w-9 rounded-full bg-teal-50 border border-teal-200/70 text-teal-700 flex items-center justify-center">
                      <Mic className="h-3.5 w-3.5" />
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
