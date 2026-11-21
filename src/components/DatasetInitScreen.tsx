import { Database, RefreshCw } from 'lucide-react';
import type { LoadProgress } from '../db/datasetLoader';

interface Props {
  progress: LoadProgress | null;
  error: string | null;
  onRetry: () => void;
}

export function DatasetInitScreen({ progress, error, onRetry }: Props) {
  const pct =
    progress && progress.totalFiles > 0
      ? Math.min(100, Math.round((progress.loadedFiles / progress.totalFiles) * 100))
      : 0;

  return (
    <div className="min-h-dvh flex items-center justify-center bg-[#F6F5F1] p-5">
      <div className="w-full max-w-sm rounded-[28px] bg-white p-7 shadow-float border border-[#E6E4DD]">
        <div className="flex items-center gap-3.5 mb-6">
          <div className="h-12 w-12 rounded-2xl bg-teal-700 text-white flex items-center justify-center shadow-sm">
            <Database className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-[#18221F]">vocket</h1>
            <p className="text-xs font-medium text-[#64706B]">Menyiapkan kamus offline</p>
          </div>
        </div>

        {error ? (
          <div className="space-y-4">
            <div className="rounded-2xl bg-rose-50 border border-rose-200 p-3.5 text-xs text-rose-800 leading-relaxed">
              {error}
            </div>
            <button
              onClick={onRetry}
              className="w-full h-11 rounded-full bg-[#18221F] text-white text-sm font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition"
            >
              <RefreshCw className="h-4 w-4" />
              Coba Lagi
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-[#4E5B56]">
              <span className="font-medium">
                {progress?.stage === 'indexing'
                  ? 'Mengindeks ke IndexedDB...'
                  : 'Mengunduh dataset...'}
              </span>
              <span className="font-mono font-semibold text-teal-700">{pct}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-[#ECEAE3] overflow-hidden">
              <div
                className="h-full rounded-full bg-teal-700 transition-all duration-200"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="text-[11px] font-medium text-[#7B8681]">
              {progress
                ? `${progress.loadedWords.toLocaleString('id-ID')} / ${progress.totalWords.toLocaleString('id-ID')} kata`
                : 'Menghubungkan ke dataset...'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
