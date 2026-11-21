import { useEffect, useState } from 'react';

interface Props {
  ready: boolean;
  onDone: () => void;
}

export function SplashScreen({ ready, onDone }: Props) {
  const [minElapsed, setMinElapsed] = useState(false);
  const [exiting, setExiting] = useState(false);

  // Durasi minimum agar animasi 3D tampil tuntas tanpa terasa lama
  useEffect(() => {
    const t = window.setTimeout(() => setMinElapsed(true), 1450);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!ready || !minElapsed || exiting) return;
    setExiting(true);
    const t = window.setTimeout(onDone, 360);
    return () => window.clearTimeout(t);
  }, [ready, minElapsed, exiting, onDone]);

  const handleSkip = () => {
    if (!ready || exiting) return;
    setExiting(true);
    window.setTimeout(onDone, 260);
  };

  return (
    <div
      onClick={handleSkip}
      role="presentation"
      className={`fixed inset-0 z-50 flex items-center justify-center bg-[#F6F5F1] transition-opacity duration-300 ease-out ${
        exiting ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      <div className="flex flex-col items-center select-none">
        {/* 3D Animated Cube Emblem */}
        <div className="vocket-scene h-28 flex flex-col items-center justify-center">
          <div className="vocket-cube">
            <div className="vocket-face vocket-face-front">
              <span className="text-3xl font-extrabold tracking-tight text-white">v</span>
            </div>
            <div className="vocket-face vocket-face-back">
              <span className="font-mono text-sm font-bold text-teal-100/90">EN</span>
            </div>
            <div className="vocket-face vocket-face-right">
              <span className="font-mono text-sm font-bold text-teal-100/90">ID</span>
            </div>
            <div className="vocket-face vocket-face-left">
              <span className="font-mono text-xs font-bold text-teal-200/80">TTS</span>
            </div>
            <div className="vocket-face vocket-face-top">
              <span className="h-2.5 w-2.5 rounded-full bg-white/85" />
            </div>
            <div className="vocket-face vocket-face-bottom" />
          </div>
          <div className="vocket-shadow mt-5" />
        </div>

        {/* Brand Wordmark */}
        <div className="vocket-fade-up mt-4 text-center">
          <h1 className="text-2xl font-extrabold tracking-tight text-[#18221F]">vocket</h1>
          <p className="mt-1 text-xs font-medium text-[#64706B]">
            English &ndash; Indonesian Vocab
          </p>
        </div>

        <p className="fixed bottom-8 font-mono text-[11px] text-[#8A948F]">
          v{__APP_VERSION__}
        </p>
      </div>
    </div>
  );
}
