import { AlertCircle, Award, Lock, RotateCcw } from 'lucide-react';
import type { AssignedWordWithDetails, DailyProgressSummary } from '../types/vocab';
import type { Accent } from '../services/ttsService';
import { VocabCard } from '../components/VocabCard';
import { HomeScreenSkeleton } from '../components/LoadingSkeletons';

interface Props {
  summary: DailyProgressSummary;
  accent: Accent;
  loading?: boolean;
  onStartBatchQuiz: () => void;
  onStartRemedialQuiz: () => void;
  onStartCumulativeQuiz: () => void;
  onPracticeSpeak: (item: AssignedWordWithDetails) => void;
}

export function HomeScreen({
  summary,
  accent,
  loading = false,
  onStartBatchQuiz,
  onStartRemedialQuiz,
  onStartCumulativeQuiz,
  onPracticeSpeak
}: Props) {
  if (loading) {
    return <HomeScreenSkeleton />;
  }

  const batchPct = Math.min(100, Math.round((summary.batchCount / summary.batchTarget) * 100));

  return (
    <div className="space-y-4 pb-28 vocket-content-enter">
      {/* Batch Progress Hero Card - Calm Deep Teal Gradient */}
      <section className="rounded-[24px] bg-gradient-to-br from-[#115E59] to-[#134E4A] text-white p-5 shadow-float">
        <div className="flex items-start justify-between mb-3.5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-teal-200/90">
              Batch #{summary.batchNumber}
            </p>
            <h2 className="text-lg font-bold tracking-tight mt-0.5">
              Hari {summary.dayNumber} dari {summary.daysPerBatch}
            </h2>
          </div>
          <div className="rounded-full bg-white/15 px-3 py-1 backdrop-blur-sm">
            <span className="font-mono text-sm font-bold">{summary.batchCount}</span>
            <span className="font-mono text-xs text-teal-100/80"> / {summary.batchTarget}</span>
          </div>
        </div>

        <div className="h-2 w-full rounded-full bg-black/20 overflow-hidden">
          <div
            className="h-full rounded-full bg-teal-300 transition-all duration-300"
            style={{ width: `${batchPct}%` }}
          />
        </div>
      </section>

      {/* 50-Word Evaluation Gate Banner */}
      {summary.gateStatus === 'BATCH_QUIZ' && (
        <section className="rounded-[22px] bg-[#18221F] text-white p-4 flex items-center justify-between gap-3 shadow-card">
          <div className="flex items-start gap-2.5 min-w-0">
            <Lock className="h-4 w-4 mt-0.5 shrink-0 text-teal-300" />
            <div>
              <p className="text-sm font-bold">Evaluasi Batch #{summary.batchNumber}</p>
              <p className="text-xs text-stone-300 mt-0.5 leading-relaxed">
                50 kata terkumpul. Selesaikan kuis untuk membuka Batch baru.
              </p>
            </div>
          </div>
          <button
            onClick={onStartBatchQuiz}
            className="shrink-0 h-9 px-4 rounded-full bg-teal-500 hover:bg-teal-400 text-[#0E2421] text-xs font-bold active:scale-95 transition"
          >
            Quiz
          </button>
        </section>
      )}

      {/* Cumulative Review Banner (tiap 5 Batch) */}
      {summary.gateStatus === 'CUMULATIVE_QUIZ' && (
        <section className="rounded-[22px] bg-emerald-800 text-white p-4 flex items-center justify-between gap-3 shadow-card">
          <div className="flex items-start gap-2.5 min-w-0">
            <Award className="h-4 w-4 mt-0.5 shrink-0 text-emerald-200" />
            <div>
              <p className="text-sm font-bold">Cumulative Review</p>
              <p className="text-xs text-emerald-100 mt-0.5 leading-relaxed">
                Milestone 5 Batch. Uji 25 kata acak dari batch sebelumnya.
              </p>
            </div>
          </div>
          <button
            onClick={onStartCumulativeQuiz}
            className="shrink-0 h-9 px-4 rounded-full bg-white text-emerald-900 text-xs font-bold active:scale-95 transition"
          >
            Review
          </button>
        </section>
      )}

      {/* Remedial Banner */}
      {summary.remedialCount > 0 && (
        <section className="rounded-[20px] bg-amber-50/90 border border-amber-200/80 px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <AlertCircle className="h-4 w-4 text-amber-700 shrink-0" />
            <p className="text-xs font-semibold text-amber-950">
              <span className="font-mono font-bold">{summary.remedialCount}</span> kata perlu remedial
            </p>
          </div>
          <button
            onClick={onStartRemedialQuiz}
            className="shrink-0 h-8 px-3.5 rounded-full bg-amber-700 text-white text-xs font-semibold flex items-center gap-1.5 active:scale-95 transition"
          >
            <RotateCcw className="h-3 w-3" />
            Remedial
          </button>
        </section>
      )}

      {/* Section Header */}
      <div className="flex items-center justify-between pt-1 px-0.5">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#64706B]">
          Tugas Hari Ini ({summary.todayWords.length})
        </h3>
        <span className="text-[11px] font-medium text-[#7B8681]">Tap Audio di kanan bawah</span>
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
