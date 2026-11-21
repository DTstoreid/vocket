import { useState } from 'react';
import { ArrowRight, Check, RotateCcw, X } from 'lucide-react';
import type { QuizDetailItem, QuizQuestion, QuizQuestionType, QuizType } from '../types/vocab';

interface Props {
  open: boolean;
  quizType: QuizType;
  batchNumber: number;
  questions: QuizQuestion[];
  onClose: () => void;
  onComplete: (details: QuizDetailItem[]) => Promise<void>;
}

const TYPE_TAG: Record<QuizQuestionType, string> = {
  EN_TO_ID: 'EN -> ID',
  ID_TO_EN: 'ID -> EN',
  SYNONYM: 'Sinonim',
  DEFINITION: 'Definisi',
  CLOZE: 'Cloze'
};

const TITLE_MAP: Record<QuizType, string> = {
  BATCH: 'Batch Quiz',
  REMEDIAL: 'Remedial',
  CUMULATIVE: 'Cumulative'
};

export function QuizModal({ open, quizType, batchNumber, questions, onClose, onComplete }: Props) {
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [details, setDetails] = useState<QuizDetailItem[]>([]);
  const [finished, setFinished] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!open || questions.length === 0) return null;

  const current = questions[idx];
  const pct = Math.round(((idx + (selected ? 1 : 0)) / questions.length) * 100);

  const handleChoose = (option: string) => {
    if (selected !== null) return;
    setSelected(option);
  };

  const handleNext = async () => {
    if (selected === null) return;
    const nextDetails: QuizDetailItem[] = [
      ...details,
      {
        wordId: current.wordId,
        questionType: current.type,
        correct: selected === current.correctAnswer,
        selected,
        expected: current.correctAnswer
      }
    ];
    setDetails(nextDetails);
    setSelected(null);

    if (idx + 1 < questions.length) {
      setIdx(idx + 1);
    } else {
      setSaving(true);
      try {
        await onComplete(nextDetails);
      } finally {
        setSaving(false);
        setFinished(true);
      }
    }
  };

  const resetAndClose = () => {
    setIdx(0);
    setSelected(null);
    setDetails([]);
    setFinished(false);
    onClose();
  };

  if (finished) {
    const correctCount = details.filter((d) => d.correct).length;
    const wrongItems = details.filter((d) => !d.correct);
    const scorePct = Math.round((correctCount / details.length) * 100);

    return (
      <div className="fixed inset-0 z-50 bg-slate-50 flex justify-center">
        <div className="w-full max-w-[430px] h-dvh flex flex-col bg-white">
          <div className="flex items-center justify-between px-4 h-14 border-b border-slate-100">
            <span className="text-sm font-semibold text-slate-900">
              {TITLE_MAP[quizType]} #{batchNumber}
            </span>
            <button
              onClick={resetAndClose}
              className="h-8 w-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            <div className="rounded-3xl bg-slate-900 text-white p-6 text-center">
              <p className="text-xs uppercase tracking-wider text-slate-400">Skor Akhir</p>
              <p className="mt-2 text-5xl font-bold font-mono">{scorePct}%</p>
              <p className="mt-2 text-xs text-slate-300">
                {correctCount} benar dari {details.length} soal
              </p>
            </div>

            {wrongItems.length > 0 ? (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2.5">
                  Masuk Antrean Remedial ({wrongItems.length})
                </p>
                <div className="space-y-2">
                  {wrongItems.map((w, i) => (
                    <div
                      key={`${w.wordId}_${i}`}
                      className="rounded-xl border border-amber-200/80 bg-amber-50/50 px-3.5 py-2.5 flex items-center justify-between gap-2"
                    >
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{w.wordId}</p>
                        <p className="text-xs text-slate-500">Jawaban benar: {w.expected}</p>
                      </div>
                      <RotateCcw className="h-4 w-4 text-amber-600 shrink-0" />
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-center text-xs font-medium text-emerald-700">
                Semua soal dijawab benar.
              </div>
            )}
          </div>

          <div className="p-4 border-t border-slate-100 safe-bottom">
            <button
              onClick={resetAndClose}
              className="w-full h-12 rounded-xl bg-slate-900 text-white text-sm font-semibold active:scale-[0.98] transition"
            >
              Selesai
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-50 flex justify-center">
      <div className="w-full max-w-[430px] h-dvh flex flex-col bg-white">
        <div className="flex items-center justify-between px-4 h-14 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-900">{TITLE_MAP[quizType]}</span>
            <span className="font-mono text-xs text-slate-400">
              {idx + 1}/{questions.length}
            </span>
          </div>
          <button
            onClick={resetAndClose}
            className="h-8 w-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="h-1 w-full bg-slate-100">
          <div className="h-full bg-indigo-600 transition-all duration-200" style={{ width: `${pct}%` }} />
        </div>

        <div className="flex-1 overflow-y-auto p-5 flex flex-col">
          <div className="mb-3">
            <span className="inline-block rounded-md bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-600">
              {TYPE_TAG[current.type]}
            </span>
          </div>

          <div className="rounded-2xl bg-slate-50 border border-slate-200/80 p-5 mb-6">
            <p className="text-xl font-bold text-slate-900 leading-snug">{current.prompt}</p>
            {current.subPrompt && (
              <p className="mt-2 text-xs text-slate-500">{current.subPrompt}</p>
            )}
          </div>

          <div className="space-y-2.5">
            {current.options.map((opt) => {
              const isSelected = selected === opt;
              const isCorrect = opt === current.correctAnswer;
              let style = 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50';

              if (selected !== null) {
                if (isCorrect) {
                  style = 'border-emerald-500 bg-emerald-50 text-emerald-900 font-semibold';
                } else if (isSelected && !isCorrect) {
                  style = 'border-rose-400 bg-rose-50 text-rose-900';
                } else {
                  style = 'border-slate-100 bg-slate-50 text-slate-400';
                }
              }

              return (
                <button
                  key={opt}
                  onClick={() => handleChoose(opt)}
                  disabled={selected !== null}
                  className={`w-full min-h-12 px-4 py-3 rounded-xl border text-left text-sm flex items-center justify-between gap-3 transition active:scale-[0.99] ${style}`}
                >
                  <span className="leading-snug">{opt}</span>
                  {selected !== null && isCorrect && (
                    <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                  )}
                  {selected !== null && isSelected && !isCorrect && (
                    <X className="h-4 w-4 text-rose-600 shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-4 border-t border-slate-100 safe-bottom">
          <button
            onClick={handleNext}
            disabled={selected === null || saving}
            className="w-full h-12 rounded-xl bg-slate-900 text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-35 active:scale-[0.98] transition"
          >
            {idx + 1 < questions.length ? 'Next' : 'Finish'}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
