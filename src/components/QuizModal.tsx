import { useState } from 'react';
import { ArrowRight, Check, Loader2, RotateCcw, X } from 'lucide-react';
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
    if (selected === null || saving) return;
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
      <div className="fixed inset-0 z-50 bg-[#ECEAE3] flex justify-center">
        <div className="w-full max-w-[430px] h-dvh flex flex-col bg-[#F6F5F1] vocket-content-enter">
          <div className="flex items-center justify-between px-4 h-14 border-b border-[#E6E4DD] bg-[#F6F5F1]">
            <span className="text-sm font-bold text-[#18221F]">
              {TITLE_MAP[quizType]} #{batchNumber}
            </span>
            <button
              onClick={resetAndClose}
              className="h-8 w-8 rounded-full bg-white border border-[#E6E4DD] text-[#64706B] flex items-center justify-center"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            <div className="rounded-[28px] bg-gradient-to-br from-[#115E59] to-[#134E4A] text-white p-6 text-center shadow-float">
              <p className="text-xs font-semibold uppercase tracking-wider text-teal-200">
                Skor Akhir
              </p>
              <p className="mt-2 text-5xl font-extrabold font-mono">{scorePct}%</p>
              <p className="mt-2 text-xs text-teal-100">
                {correctCount} benar dari {details.length} soal
              </p>
            </div>

            {wrongItems.length > 0 ? (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#64706B] mb-2.5">
                  Masuk Antrean Remedial ({wrongItems.length})
                </p>
                <div className="space-y-2">
                  {wrongItems.map((w, i) => (
                    <div
                      key={`${w.wordId}_${i}`}
                      className="rounded-2xl border border-amber-200/80 bg-amber-50/80 px-4 py-3 flex items-center justify-between gap-2"
                    >
                      <div>
                        <p className="text-sm font-bold text-[#18221F]">{w.wordId}</p>
                        <p className="text-xs text-[#5C6863]">Jawaban benar: {w.expected}</p>
                      </div>
                      <RotateCcw className="h-4 w-4 text-amber-700 shrink-0" />
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-center text-xs font-semibold text-emerald-800">
                Semua soal dijawab benar.
              </div>
            )}
          </div>

          <div className="p-4 border-t border-[#E6E4DD] bg-[#F6F5F1] safe-bottom">
            <button
              onClick={resetAndClose}
              className="w-full h-12 rounded-full bg-[#18221F] text-white text-sm font-bold active:scale-[0.98] transition"
            >
              Selesai
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-[#ECEAE3] flex justify-center">
      <div className="w-full max-w-[430px] h-dvh flex flex-col bg-[#F6F5F1]">
        <div className="flex items-center justify-between px-4 h-14 border-b border-[#E6E4DD]">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-[#18221F]">{TITLE_MAP[quizType]}</span>
            <span className="font-mono text-xs text-[#7B8681]">
              {idx + 1}/{questions.length}
            </span>
          </div>
          <button
            onClick={resetAndClose}
            className="h-8 w-8 rounded-full bg-white border border-[#E6E4DD] text-[#64706B] flex items-center justify-center"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="h-1.5 w-full bg-[#E6E4DD]">
          <div className="h-full bg-teal-700 transition-all duration-200" style={{ width: `${pct}%` }} />
        </div>

        <div className="flex-1 overflow-y-auto p-5 flex flex-col">
          <div className="mb-3">
            <span className="inline-block rounded-full bg-teal-50 border border-teal-200/80 px-3 py-0.5 text-[11px] font-bold text-teal-800">
              {TYPE_TAG[current.type]}
            </span>
          </div>

          <div className="rounded-[24px] bg-white border border-[#E6E4DD] p-5 mb-5 shadow-card">
            <p className="text-xl font-extrabold text-[#18221F] leading-snug">{current.prompt}</p>
            {current.subPrompt && (
              <p className="mt-2 text-xs font-medium text-[#64706B]">{current.subPrompt}</p>
            )}
          </div>

          <div className="space-y-2.5">
            {current.options.map((opt) => {
              const isSelected = selected === opt;
              const isCorrect = opt === current.correctAnswer;
              let style = 'border-[#E6E4DD] bg-white text-[#18221F] hover:bg-[#F2F1EC] shadow-card';

              if (selected !== null) {
                if (isCorrect) {
                  style = 'border-emerald-500 bg-emerald-50 text-emerald-900 font-bold';
                } else if (isSelected && !isCorrect) {
                  style = 'border-rose-400 bg-rose-50 text-rose-900';
                } else {
                  style = 'border-[#ECEAE3] bg-[#F2F1EC]/70 text-[#8A948F]';
                }
              }

              return (
                <button
                  key={opt}
                  onClick={() => handleChoose(opt)}
                  disabled={selected !== null}
                  className={`w-full min-h-12 px-4 py-3.5 rounded-2xl border text-left text-sm flex items-center justify-between gap-3 transition active:scale-[0.99] ${style}`}
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

        <div className="p-4 border-t border-[#E6E4DD] safe-bottom">
          <button
            onClick={handleNext}
            disabled={selected === null || saving}
            className="w-full h-12 rounded-full bg-teal-700 hover:bg-teal-800 text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-35 active:scale-[0.98] transition"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Menyimpan...
              </>
            ) : (
              <>
                {idx + 1 < questions.length ? 'Next' : 'Finish'}
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
