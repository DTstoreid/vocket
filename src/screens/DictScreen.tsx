import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Check, Loader2, Plus, Search, Trash2, Volume2 } from 'lucide-react';
import type { WordRecord } from '../types/vocab';
import { POS_LABEL } from '../types/vocab';
import { db } from '../db/vocketDb';
import {
  addToPriorityQueue,
  removeFromPriorityQueue,
  searchDictionary
} from '../db/progressService';
import { speakWord, type Accent } from '../services/ttsService';
import { DictListSkeleton } from '../components/LoadingSkeletons';

type DictSection = 'search' | 'queue' | 'stats';

interface Props {
  accent: Accent;
}

export function DictScreen({ accent }: Props) {
  const [section, setSection] = useState<DictSection>('search');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<WordRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const totalWords = useLiveQuery(() => db.words.count(), []);
  const assignedList = useLiveQuery(() => db.assignedWords.toArray(), []);
  const queueList = useLiveQuery(() => db.priorityQueue.orderBy('queuedAt').toArray(), []);
  const historyList = useLiveQuery(
    () => db.quizHistory.orderBy('completedAt').reverse().limit(20).toArray(),
    []
  );

  const assignedSafe = assignedList ?? [];
  const queueSafe = queueList ?? [];
  const totalSafe = totalWords ?? 0;

  const assignedSet = new Set(assignedSafe.map((a) => a.wordId));
  const queueSet = new Set(queueSafe.map((q) => q.wordId));

  const queueWords = useLiveQuery(async () => {
    if (queueList === undefined) return undefined;
    if (queueList.length === 0) return [];
    const words = await db.words.bulkGet(queueList.map((q) => q.wordId));
    return words.filter((w): w is WordRecord => Boolean(w));
  }, [queueList]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const res = await searchDictionary(query, 40);
        if (active) setResults(res);
      } finally {
        if (active) setLoading(false);
      }
    }, 120);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [query]);

  const masteredCount = assignedSafe.filter((a) => a.masteryScore === 2).length;
  const masteryPct = totalSafe > 0 ? Math.round((masteredCount / totalSafe) * 100) : 0;

  return (
    <div className="space-y-4 pb-28 vocket-content-enter">
      {/* Sub-navigation Pill */}
      <div className="grid grid-cols-3 gap-1 p-1 rounded-full bg-[#E8E6DF]">
        {[
          { id: 'search' as const, label: 'Kamus' },
          { id: 'queue' as const, label: `Antrean (${queueSafe.length})` },
          { id: 'stats' as const, label: 'Stats' }
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setSection(t.id)}
            className={`h-9 rounded-full text-xs font-semibold transition ${
              section === t.id ? 'bg-white text-[#18221F] shadow-sm' : 'text-[#5C6863]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* SECTION 1: SEARCH DICTIONARY */}
      {section === 'search' && (
        <div className="space-y-3">
          <div className="relative">
            <Search className="h-4 w-4 text-[#7B8681] absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Cari ${totalSafe.toLocaleString('id-ID')} kata (EN / ID)...`}
              className="w-full h-12 rounded-full bg-white border border-[#E6E4DD] pl-11 pr-11 text-sm text-[#18221F] placeholder:text-[#8A948F] shadow-card focus:outline-none focus:border-teal-700"
            />
            {loading && (
              <Loader2 className="h-4 w-4 text-teal-700 animate-spin absolute right-4 top-1/2 -translate-y-1/2" />
            )}
          </div>

          {loading ? (
            <DictListSkeleton count={4} />
          ) : results.length === 0 ? (
            <div className="rounded-[22px] bg-white border border-[#E6E4DD] p-8 text-center text-xs text-[#7B8681]">
              Kata tidak ditemukan.
            </div>
          ) : (
            <div className="space-y-2.5 vocket-content-enter">
              {results.map((w) => {
                const isAssigned = assignedSet.has(w.id);
                const isQueued = queueSet.has(w.id);
                const ipa = accent === 'uk' ? w.ipaUk || w.ipaUs : w.ipaUs || w.ipaUk;

                return (
                  <div
                    key={w.id}
                    className="rounded-[20px] bg-white border border-[#E6E4DD] p-4 shadow-card space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-base font-bold text-[#18221F]">{w.id}</span>
                          <span className="rounded-full bg-[#F2F1EC] px-2 py-0.5 text-[10px] font-semibold uppercase text-[#5C6863]">
                            {POS_LABEL[w.pos] || w.pos}
                          </span>
                          <span className="font-mono text-[10px] text-[#8A948F]">#{w.order}</span>
                        </div>
                        {ipa && <p className="font-mono text-[11px] text-[#7B8681]">{ipa}</p>}
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => speakWord(w, { accent, rate: 1.0, preferNativeAudio: true })}
                          aria-label="Listen"
                          className="h-8 w-8 rounded-full bg-[#F6F5F1] border border-[#E6E4DD] text-[#273430] flex items-center justify-center active:scale-90 transition"
                        >
                          <Volume2 className="h-3.5 w-3.5" />
                        </button>

                        {isAssigned ? (
                          <span className="h-8 px-3 rounded-full bg-emerald-50 border border-emerald-200/70 text-emerald-700 text-[11px] font-semibold flex items-center gap-1">
                            <Check className="h-3 w-3" />
                            Tugas
                          </span>
                        ) : isQueued ? (
                          <button
                            onClick={() => removeFromPriorityQueue(w.id)}
                            className="h-8 px-3 rounded-full bg-teal-50 border border-teal-200 text-teal-700 text-[11px] font-semibold"
                          >
                            Antre
                          </button>
                        ) : (
                          <button
                            onClick={() => addToPriorityQueue(w.id)}
                            className="h-8 px-3 rounded-full bg-[#18221F] text-white text-[11px] font-semibold flex items-center gap-1 active:scale-95 transition"
                          >
                            <Plus className="h-3 w-3" />
                            Besok
                          </button>
                        )}
                      </div>
                    </div>

                    <p className="text-xs font-medium text-[#2A3733]">{w.translationId}</p>

                    {w.derivatives.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {w.derivatives.map((d) => (
                          <span
                            key={d}
                            className="rounded-full bg-[#F6F5F1] border border-[#E6E4DD] px-2 py-0.5 text-[10px] font-medium text-[#4E5B56]"
                          >
                            {d}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SECTION 2: PRIORITY QUEUE */}
      {section === 'queue' && (
        <div className="space-y-3">
          <p className="text-xs font-medium text-[#64706B] px-1">
            Kata di antrean ini diprioritaskan masuk ke jatah kata harian sesuai Stage aktif.
          </p>
          {queueWords === undefined ? (
            <DictListSkeleton count={3} />
          ) : queueWords.length === 0 ? (
            <div className="rounded-[22px] bg-white border border-[#E6E4DD] p-8 text-center text-xs text-[#7B8681]">
              Antrean kosong. Tambahkan kata dari tab Kamus dengan tombol + Besok.
            </div>
          ) : (
            <div className="space-y-2.5 vocket-content-enter">
              {queueWords.map((w, i) => (
                <div
                  key={w.id}
                  className="rounded-[20px] bg-white border border-[#E6E4DD] px-4 py-3 shadow-card flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-teal-700 font-bold">{i + 1}.</span>
                      <span className="text-sm font-bold text-[#18221F]">{w.id}</span>
                    </div>
                    <p className="text-xs text-[#5C6863] truncate mt-0.5">{w.translationId}</p>
                  </div>
                  <button
                    onClick={() => removeFromPriorityQueue(w.id)}
                    aria-label="Hapus"
                    className="h-8 w-8 rounded-full bg-[#F6F5F1] border border-[#E6E4DD] text-[#64706B] hover:text-rose-600 flex items-center justify-center shrink-0"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SECTION 3: STATS & HISTORY */}
      {section === 'stats' && (
        <div className="space-y-4">
          {assignedList === undefined || totalWords === undefined ? (
            <DictListSkeleton count={3} />
          ) : (
            <div className="space-y-4 vocket-content-enter">
              <div className="rounded-[22px] bg-white border border-[#E6E4DD] p-4 shadow-card space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#7B8681]">
                    Penguasaan Total
                  </span>
                  <span className="font-mono text-xs font-bold text-teal-700">{masteryPct}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-[#ECEAE3] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-teal-700 transition-all"
                    style={{ width: `${masteryPct}%` }}
                  />
                </div>
                <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                  <div className="rounded-2xl bg-[#F6F5F1] p-2.5">
                    <p className="font-mono text-base font-bold text-[#18221F]">
                      {assignedSafe.length}
                    </p>
                    <p className="text-[10px] font-medium text-[#64706B]">Ditugaskan</p>
                  </div>
                  <div className="rounded-2xl bg-teal-50/80 p-2.5">
                    <p className="font-mono text-base font-bold text-teal-800">{masteredCount}</p>
                    <p className="text-[10px] font-medium text-teal-800">Lulus</p>
                  </div>
                  <div className="rounded-2xl bg-[#F6F5F1] p-2.5">
                    <p className="font-mono text-base font-bold text-[#18221F]">{totalSafe}</p>
                    <p className="text-[10px] font-medium text-[#64706B]">Kamus</p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#64706B] mb-2 px-1">
                  Riwayat Kuis ({historyList?.length ?? 0})
                </h3>
                {historyList === undefined ? (
                  <DictListSkeleton count={2} />
                ) : historyList.length === 0 ? (
                  <div className="rounded-[22px] bg-white border border-[#E6E4DD] p-6 text-center text-xs text-[#7B8681]">
                    Belum ada riwayat kuis.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {historyList.map((h) => {
                      const pct =
                        h.totalQuestions > 0
                          ? Math.round((h.totalCorrect / h.totalQuestions) * 100)
                          : 0;
                      return (
                        <div
                          key={h.clientId}
                          className="rounded-[20px] bg-white border border-[#E6E4DD] px-4 py-3 shadow-card flex items-center justify-between"
                        >
                          <div>
                            <p className="text-xs font-bold text-[#18221F]">
                              {h.quizType} #{h.batchNumber}
                            </p>
                            <p className="text-[11px] text-[#7B8681] mt-0.5">
                              {new Date(h.completedAt).toLocaleDateString('id-ID', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric'
                              })}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-mono text-sm font-bold text-teal-700">{pct}%</p>
                            <p className="font-mono text-[10px] text-[#7B8681]">
                              {h.totalCorrect}/{h.totalQuestions}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
