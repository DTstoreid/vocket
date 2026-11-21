import { AlertCircle, Award, Headphones, Lock, RotateCcw } from 'lucide-react';
import type { AssignedWordWithDetails, DailyProgressSummary } from '../types/vocab';
import type { Accent } from '../services/ttsService';
import { VocabCard } from '../components/VocabCard';

interface Props {
  summary: DailyProgressSummary;
  accent: Accent;
  onStartBatchQuiz: () => void;
  onStartRemedialQuiz: () => void;
  onStartCumulativeQuiz: () => void;
  onOpenAudio: () => void;
  onPracticeSpeak: (item: AssignedWordWithDetails) => void;
}

export function HomeScreen({
  summary,
  accent,
  onStartBatchQuiz,
  onStartRemedialQuiz,
  onStartCumulativeQuiz,
  onOpenAudio,
  onPracticeSpeak
}: Props) {
  const batchPct = Math.min(100, Math.round((summary.batchCount / summary.batchTarget) * 100));

  return (
    <div className="space-y-4 pb-24">
      {/* Batch Progress Card */}
      <section className="rounded-2xl bg-slate-900 text-white p-4 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
              Batch #{summary.batchNumber}
            </p>
            <h2 className="text-base font-bold mt-0.5">
              Hari {summary.dayNumber} dari {summary.daysPerBatch}
            </h2>
          </div>
          <div className="text-right">
            <span className="font-mono text-lg font-bold">{summary.batchCount}</span>
            <span className="font-mono text-xs text-slate-400"> / {summary.batchTarget}</span>
          </div>
        </div>
        <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
          <div
            className="h-full rounded-full bg-indigo-400 transition-all duration-300"
            style={{ width: `${batchPct}%` }}
          />
        </div>
      </section>

      {/* 50-Word Evaluation Gate Banner */}
      {summary.gateStatus === 'BATCH_QUIZ' && (
        <section className="rounded-2xl bg-indigo-600 text-white p-4 flex items-center justify-between gap-3">
          <div className="flex items-start gap-2.5 min-w-0">
            <Lock className="h-4 w-4 mt-0.5 shrink-0 text-indigo-200" />
            <div>
              <p className="text-sm font-semibold">Evaluasi Batch #{summary.batchNumber}</p>
              <p className="text-xs text-indigo-100 mt-0.5">
                50 kata terkumpul. Selesaikan kuis untuk buka Batch berikutnya.
              </p>
            </div>
          </div>
          <button
            onClick={onStartBatchQuiz}
            className="shrink-0 h-9 px-3.5 rounded-xl bg-white text-indigo-700 text-xs font-semibold active:scale-95 transition"
          >
            Quiz
          </button>
        </section>
      )}

      {/* Cumulative Review Banner (tiap 5 Batch) */}
      {summary.gateStatus === 'CUMULATIVE_QUIZ' && (
        <section className="rounded-2xl bg-emerald-600 text-white p-4 flex items-center justify-between gap-3">
          <div className="flex items-start gap-2.5 min-w-0">
            <Award className="h-4 w-4 mt-0.5 shrink-0 text-emerald-100" />
            <div>
              <p className="text-sm font-semibold">Cumulative Review</p>
              <p className="text-xs text-emerald-100 mt-0.5">
                Milestone 5 Batch tercapai. Uji 25 kata acak dari batch sebelumnya.
              </p>
            </div>
          </div>
          <button
            onClick={onStartCumulativeQuiz}
            className="shrink-0 h-9 px-3.5 rounded-xl bg-white text-emerald-700 text-xs font-semibold active:scale-95 transition"
          >
            Review
          </button>
        </section>
      )}

      {/* Remedial Banner */}
      {summary.remedialCount > 0 && (
        <section className="rounded-2xl bg-amber-50 border border-amber-200/90 px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
            <p className="text-xs font-medium text-amber-900">
              <span className="font-bold font-mono">{summary.remedialCount}</span> kata perlu remedial
            </p>
          </div>
          <button
            onClick={onStartRemedialQuiz}
            className="shrink-0 h-8 px-3 rounded-lg bg-amber-600 text-white text-xs font-semibold flex items-center gap-1.5 active:scale-95 transition"
          >
            <RotateCcw className="h-3 w-3" />
            Remedial
          </button>
        </section>
      )}

      {/* Section Header */}
      <div className="flex items-center justify-between pt-1">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Tugas Hari Ini ({summary.todayWords.length})
        </h3>
        <button
          onClick={onOpenAudio}
          className="h-8 px-3 rounded-lg bg-white border border-slate-200 text-slate-700 text-xs font-medium flex items-center gap-1.5 active:scale-95 transition"
        >
          <Headphones className="h-3.5 w-3.5 text-indigo-600" />
          Audio
        </button>
      </div>

      {/* Daily Cards */}
      <div className="space-y-3">
        {summary.todayWords.map((item) => (
          <VocabCard
            key={item.word.id}
            item={item}
            accent={accent}
            onPracticeSpeak={onPracticeSpeak}
          />
        ))}
      </div>
    </div>
  );
}
