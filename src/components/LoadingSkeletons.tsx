import { Loader2 } from 'lucide-react';

export function LoadingDots({ className = 'bg-teal-700' }: { className?: string }) {
  return (
    <span className="inline-flex items-center gap-1" aria-hidden="true">
      <span className={`vocket-dot h-1.5 w-1.5 rounded-full ${className}`} />
      <span className={`vocket-dot vocket-dot-2 h-1.5 w-1.5 rounded-full ${className}`} />
      <span className={`vocket-dot vocket-dot-3 h-1.5 w-1.5 rounded-full ${className}`} />
    </span>
  );
}

export function HomeScreenSkeleton() {
  return (
    <div className="space-y-4 pb-28" aria-busy="true" aria-label="Memuat tugas harian">
      {/* Batch Hero Skeleton */}
      <div className="rounded-[24px] bg-gradient-to-br from-[#115E59]/90 to-[#134E4A]/90 p-5 shadow-float space-y-4">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <div className="vocket-shimmer-dark h-3 w-16 rounded-full" />
            <div className="vocket-shimmer-dark h-5 w-36 rounded-lg" />
          </div>
          <div className="vocket-shimmer-dark h-7 w-16 rounded-full" />
        </div>
        <div className="vocket-shimmer-dark h-2 w-full rounded-full" />
      </div>

      {/* Section Header */}
      <div className="flex items-center justify-between pt-1 px-0.5">
        <div className="vocket-shimmer h-3 w-28 rounded-full" />
        <div className="vocket-shimmer h-3 w-32 rounded-full" />
      </div>

      {/* Vocab Card Skeletons */}
      <div className="space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-[22px] bg-white border border-[#E6E4DD] p-4 shadow-card space-y-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-2 flex-1">
                <div className="flex items-center gap-2">
                  <div className="vocket-shimmer h-5 w-28 rounded-lg" />
                  <div className="vocket-shimmer h-4 w-12 rounded-full" />
                </div>
                <div className="vocket-shimmer h-3 w-24 rounded-full" />
              </div>
              <div className="flex items-center gap-1.5">
                <div className="vocket-shimmer h-9 w-9 rounded-full" />
                <div className="vocket-shimmer h-9 w-9 rounded-full" />
              </div>
            </div>
            <div className="vocket-shimmer h-4 w-3/4 rounded-md" />
            <div className="vocket-shimmer h-3 w-5/6 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function SpeakScreenSkeleton() {
  return (
    <div className="space-y-4 pb-28" aria-busy="true" aria-label="Memuat daftar pelafalan">
      <div className="grid grid-cols-2 gap-3">
        {[0, 1].map((i) => (
          <div key={i} className="rounded-[22px] bg-white border border-[#E6E4DD] p-4 shadow-card space-y-2.5">
            <div className="vocket-shimmer h-3 w-16 rounded-full" />
            <div className="vocket-shimmer h-7 w-20 rounded-lg" />
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 py-0.5">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="vocket-shimmer h-9 w-16 rounded-full" />
        ))}
      </div>

      <div className="space-y-2.5">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="rounded-[20px] bg-white border border-[#E6E4DD] p-3.5 shadow-card flex items-center justify-between gap-3"
          >
            <div className="space-y-2 flex-1">
              <div className="vocket-shimmer h-4 w-32 rounded-md" />
              <div className="vocket-shimmer h-3 w-44 rounded-md" />
            </div>
            <div className="flex items-center gap-2">
              <div className="vocket-shimmer h-9 w-9 rounded-full" />
              <div className="vocket-shimmer h-9 w-9 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DictListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-2.5" aria-busy="true" aria-label="Memuat daftar kamus">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-[20px] bg-white border border-[#E6E4DD] p-4 shadow-card space-y-2.5"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <div className="vocket-shimmer h-4 w-24 rounded-md" />
                <div className="vocket-shimmer h-4 w-10 rounded-full" />
              </div>
              <div className="vocket-shimmer h-3 w-20 rounded-full" />
            </div>
            <div className="flex items-center gap-1.5">
              <div className="vocket-shimmer h-8 w-8 rounded-full" />
              <div className="vocket-shimmer h-8 w-16 rounded-full" />
            </div>
          </div>
          <div className="vocket-shimmer h-3.5 w-4/5 rounded-md" />
        </div>
      ))}
    </div>
  );
}

export function GameHistorySkeleton() {
  return (
    <div className="space-y-2" aria-busy="true" aria-label="Memuat riwayat permainan">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="rounded-[20px] bg-white border border-[#E6E4DD] px-4 py-3 shadow-card flex items-center justify-between"
        >
          <div className="space-y-2">
            <div className="vocket-shimmer h-3.5 w-28 rounded-md" />
            <div className="vocket-shimmer h-3 w-36 rounded-md" />
          </div>
          <div className="space-y-1.5 flex flex-col items-end">
            <div className="vocket-shimmer h-4 w-10 rounded-md" />
            <div className="vocket-shimmer h-2.5 w-8 rounded-md" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function GameBoardSkeleton() {
  return (
    <div className="space-y-4 pb-28" aria-busy="true" aria-label="Menyiapkan ronde permainan">
      <div className="rounded-[22px] bg-white border border-[#E6E4DD] px-4 py-3 shadow-card flex items-center justify-between">
        <div className="vocket-shimmer h-5 w-16 rounded-md" />
        <div className="vocket-shimmer h-6 w-12 rounded-md" />
        <div className="vocket-shimmer h-8 w-16 rounded-full" />
      </div>

      <div className="rounded-[26px] bg-white border border-[#E6E4DD] p-4 shadow-card space-y-4">
        <div className="grid grid-cols-6 gap-2">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="vocket-shimmer aspect-square rounded-2xl" />
          ))}
        </div>
        <div className="rounded-2xl bg-[#F6F5F1] border border-[#E6E4DD] p-3 space-y-2">
          <div className="vocket-shimmer h-2.5 w-36 mx-auto rounded-full" />
          <div className="grid grid-cols-6 gap-2">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="vocket-shimmer aspect-square rounded-xl" />
            ))}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="vocket-shimmer h-11 rounded-full" />
          ))}
        </div>
      </div>
    </div>
  );
}

export function QuizLoadingOverlay({ label = 'Menyiapkan soal kuis...' }: { label?: string }) {
  return (
    <div
      className="fixed inset-0 z-50 bg-[#18221F]/40 backdrop-blur-sm flex items-center justify-center p-5"
      role="status"
      aria-live="polite"
    >
      <div className="w-full max-w-[260px] rounded-[26px] bg-white border border-[#E6E4DD] p-6 shadow-float flex flex-col items-center text-center">
        <div className="relative mb-3.5">
          <span className="vocket-pulse-ring absolute inset-0 rounded-2xl bg-teal-600/25" />
          <div className="relative h-12 w-12 rounded-2xl bg-teal-700 text-white flex items-center justify-center shadow-sm">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        </div>
        <p className="text-sm font-bold text-[#18221F]">{label}</p>
        <div className="mt-2">
          <LoadingDots />
        </div>
      </div>
    </div>
  );
}
