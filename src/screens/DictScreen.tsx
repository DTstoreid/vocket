import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Check, Plus, Search, Trash2, Volume2 } from 'lucide-react';
import type { WordRecord } from '../types/vocab';
import { POS_LABEL } from '../types/vocab';
import { db } from '../db/vocketDb';
import {
  addToPriorityQueue,
  removeFromPriorityQueue,
  searchDictionary
} from '../db/progressService';
import { speakWord, type Accent } from '../services/ttsService';

type DictSection = 'search' | 'queue' | 'stats';

interface Props {
  accent: Accent;
}

export function DictScreen({ accent }: Props) {
  const [section, setSection] = useState<DictSection>('search');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<WordRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const totalWords = useLiveQuery(() => db.words.count(), [], 0);
  const assignedList = useLiveQuery(() => db.assignedWords.toArray(), [], []);
  const queueList = useLiveQuery(() => db.priorityQueue.orderBy('queuedAt').toArray(), [], []);
  const historyList = useLiveQuery(
    () => db.quizHistory.orderBy('completedAt').reverse().limit(20).toArray(),
    [],
    []
  );

  const assignedSet = new Set(assignedList.map((a) => a.wordId));
  const queueSet = new Set(queueList.map((q) => q.wordId));

  const queueWords = useLiveQuery(async () => {
    if (queueList.length === 0) return [];
    const words = await db.words.bulkGet(queueList.map((q) => q.wordId));
    return words.filter((w): w is WordRecord => Boolean(w));
  }, [queueList], []);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(async () => {
      setLoading(true);
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

  const masteredCount = assignedList.filter((a) => a.masteryScore === 2).length;
  const masteryPct = totalWords > 0 ? Math.round((masteredCount / totalWords) * 100) : 0;

  return (
    <div className="space-y-4 pb-24">
      {/* Sub-navigation */}
      <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-slate-200/70">
        {[
          { id: 'search' as const, label: 'Kamus' },
          { id: 'queue' as const, label: `Antrean (${queueList.length})` },
          { id: 'stats' as const, label: 'Stats' }
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setSection(t.id)}
            className={`h-8 rounded-lg text-xs font-semibold transition ${
              section === t.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
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
            <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Cari ${totalWords.toLocaleString('id-ID')} kata (EN / ID)...`}
              className="w-full h-11 rounded-2xl bg-white border border-slate-200 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {loading && results.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">Mencari...</div>
          ) : results.length === 0 ? (
            <div className="rounded-2xl bg-white border border-slate-200/80 p-8 text-center text-xs text-slate-400">
              Kata tidak ditemukan.
            </div>
          ) : (
            <div className="space-y-2.5">
              {results.map((w) => {
                const isAssigned = assignedSet.has(w.id);
                const isQueued = queueSet.has(w.id);
                const ipa = accent === 'uk' ? w.ipaUk || w.ipaUs : w.ipaUs || w.ipaUk;

                return (
                  <div
                    key={w.id}
                    className="rounded-2xl bg-white border border-slate-200/80 p-3.5 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-base font-bold text-slate-900">{w.id}</span>
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium uppercase text-slate-500">
                            {POS_LABEL[w.pos] || w.pos}
                          </span>
                          <span className="font-mono text-[10px] text-slate-400">#{w.order}</span>
                        </div>
                        {ipa && <p className="font-mono text-[11px] text-slate-400">{ipa}</p>}
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => speakWord(w, { accent, rate: 1.0, preferNativeAudio: true })}
                          aria-label="Listen"
                          className="h-8 w-8 rounded-lg bg-slate-50 border border-slate-200 text-slate-600 flex items-center justify-center"
                        >
                          <Volume2 className="h-3.5 w-3.5" />
                        </button>

                        {isAssigned ? (
                          <span className="h-8 px-2.5 rounded-lg bg-emerald-50 text-emerald-700 text-[11px] font-semibold flex items-center gap-1">
                            <Check className="h-3 w-3" />
                            Tugas
                          </span>
                        ) : isQueued ? (
                          <button
                            onClick={() => removeFromPriorityQueue(w.id)}
                            className="h-8 px-2.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 text-[11px] font-semibold"
                          >
                            Antre
                          </button>
                        ) : (
                          <button
                            onClick={() => addToPriorityQueue(w.id)}
                            className="h-8 px-2.5 rounded-lg bg-slate-900 text-white text-[11px] font-semibold flex items-center gap-1 active:scale-95 transition"
                          >
                            <Plus className="h-3 w-3" />
                            Besok
                          </button>
                        )}
                      </div>
                    </div>

                    <p className="text-xs font-medium text-slate-700">{w.translationId}</p>

                    {w.derivatives.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-0.5">
                        {w.derivatives.map((d) => (
                          <span
                            key={d}
                            className="rounded-md bg-slate-50 border border-slate-200/70 px-1.5 py-0.5 text-[10px] text-slate-600"
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
          <p className="text-xs text-slate-500">
            Kata di antrean ini diprioritaskan masuk ke jatah 10 kata harian berikutnya.
          </p>
          {queueWords.length === 0 ? (
            <div className="rounded-2xl bg-white border border-slate-200/80 p-8 text-center text-xs text-slate-400">
              Antrean kosong. Tambahkan kata dari tab Kamus dengan tombol + Besok.
            </div>
          ) : (
            <div className="space-y-2">
              {queueWords.map((w, i) => (
                <div
                  key={w.id}
                  className="rounded-2xl bg-white border border-slate-200/80 px-4 py-3 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-indigo-600 font-semibold">
                        {i + 1}.
                      </span>
                      <span className="text-sm font-bold text-slate-900">{w.id}</span>
                    </div>
                    <p className="text-xs text-slate-500 truncate mt-0.5">{w.translationId}</p>
                  </div>
                  <button
                    onClick={() => removeFromPriorityQueue(w.id)}
                    aria-label="Hapus"
                    className="h-8 w-8 rounded-lg bg-slate-50 border border-slate-200 text-slate-500 hover:text-rose-600 flex items-center justify-center shrink-0"
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
          <div className="rounded-2xl bg-white border border-slate-200/80 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Penguasaan Total
              </span>
              <span className="font-mono text-xs font-bold text-indigo-600">{masteryPct}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-indigo-600 transition-all"
                style={{ width: `${masteryPct}%` }}
              />
            </div>
            <div className="grid grid-cols-3 gap-2 pt-1 text-center">
              <div className="rounded-xl bg-slate-50 p-2.5">
                <p className="font-mono text-base font-bold text-slate-900">{assignedList.length}</p>
                <p className="text-[10px] text-slate-500">Ditugaskan</p>
              </div>
              <div className="rounded-xl bg-emerald-50/70 p-2.5">
                <p className="font-mono text-base font-bold text-emerald-700">{masteredCount}</p>
                <p className="text-[10px] text-emerald-700">Lulus</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-2.5">
                <p className="font-mono text-base font-bold text-slate-900">{totalWords}</p>
                <p className="text-[10px] text-slate-500">Kamus</p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Riwayat Kuis ({historyList.length})
            </h3>
            {historyList.length === 0 ? (
              <div className="rounded-2xl bg-white border border-slate-200/80 p-6 text-center text-xs text-slate-400">
                Belum ada riwayat kuis.
              </div>
            ) : (
              <div className="space-y-2">
                {historyList.map((h) => {
                  const pct =
                    h.totalQuestions > 0 ? Math.round((h.totalCorrect / h.totalQuestions) * 100) : 0;
                  return (
                    <div
                      key={h.clientId}
                      className="rounded-2xl bg-white border border-slate-200/80 px-4 py-3 flex items-center justify-between"
                    >
                      <div>
                        <p className="text-xs font-semibold text-slate-900">
                          {h.quizType} #{h.batchNumber}
                        </p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {new Date(h.completedAt).toLocaleDateString('id-ID', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono text-sm font-bold text-slate-900">{pct}%</p>
                        <p className="font-mono text-[10px] text-slate-400">
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
  );
}
