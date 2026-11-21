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
    <div className="min-h-dvh flex items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-sm rounded-3xl bg-white p-7 shadow-sm border border-slate-200/80">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-11 w-11 rounded-2xl bg-slate-900 text-white flex items-center justify-center">
            <Database className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-slate-900">vocket</h1>
            <p className="text-xs text-slate-500">Menyiapkan kamus offline</p>
          </div>
        </div>

        {error ? (
          <div className="space-y-4">
            <div className="rounded-2xl bg-rose-50 border border-rose-200 p-3.5 text-xs text-rose-700 leading-relaxed">
              {error}
            </div>
            <button
              onClick={onRetry}
              className="w-full h-11 rounded-xl bg-slate-900 text-white text-sm font-medium flex items-center justify-center gap-2 active:scale-[0.98] transition"
            >
              <RefreshCw className="h-4 w-4" />
              Coba Lagi
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-600">
              <span>
                {progress?.stage === 'indexing'
                  ? 'Mengindeks ke IndexedDB...'
                  : 'Mengunduh dataset...'}
              </span>
              <span className="font-mono font-medium text-slate-900">{pct}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-indigo-600 transition-all duration-200"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="text-[11px] text-slate-400">
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
