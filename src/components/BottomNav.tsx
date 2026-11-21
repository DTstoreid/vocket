import { BookOpen, Gamepad2, Headphones, Layers, Mic, PieChart } from 'lucide-react';

export type NavTab = 'today' | 'speak' | 'game' | 'dict' | 'dash';

interface Props {
  active: NavTab;
  onChange: (tab: NavTab) => void;
  remedialCount: number;
  showAudioFab: boolean;
  onOpenAudio: () => void;
  darkSurface?: boolean;
}

const ITEMS: Array<{ id: NavTab; label: string; icon: typeof Layers }> = [
  { id: 'today', label: 'Today', icon: Layers },
  { id: 'speak', label: 'Speak', icon: Mic },
  { id: 'game', label: 'Game', icon: Gamepad2 },
  { id: 'dict', label: 'Dict', icon: BookOpen },
  { id: 'dash', label: 'Dash', icon: PieChart }
];

export function BottomNav({
  active,
  onChange,
  remedialCount,
  showAudioFab,
  onOpenAudio,
  darkSurface = false
}: Props) {
  return (
    <div className="fixed left-1/2 -translate-x-1/2 w-full max-w-[430px] px-3 z-30 pointer-events-none safe-float-bottom">
      <div className="flex items-center justify-between gap-2">
        {/* Flying Pill Navigation Dock */}
        <nav
          aria-label="Navigasi utama"
          className={`pointer-events-auto flex-1 rounded-full backdrop-blur-xl p-1.5 shadow-float transition-colors ${
            darkSurface
              ? 'bg-[#0B221E]/90 border border-white/15'
              : 'bg-white/92 border border-[#E6E4DD]'
          }`}
        >
          <div className="grid grid-cols-5 gap-0.5">
            {ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = active === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onChange(item.id)}
                  className={`relative h-11 rounded-full flex flex-col items-center justify-center gap-0.5 px-1 transition-all duration-200 active:scale-95 ${
                    isActive
                      ? darkSurface
                        ? 'bg-teal-500 text-[#0B221E] shadow-sm'
                        : 'bg-[#18221F] text-white shadow-sm'
                      : darkSurface
                        ? 'text-teal-100/70 hover:text-white hover:bg-white/10'
                        : 'text-[#64706B] hover:text-[#18221F] hover:bg-[#F6F5F1]'
                  }`}
                >
                  <div className="relative flex items-center">
                    <Icon className="h-[15px] w-[15px]" strokeWidth={isActive ? 2.3 : 1.9} />
                    {item.id === 'today' && remedialCount > 0 && (
                      <span className="absolute -top-0.5 -right-1.5 h-2 w-2 rounded-full bg-amber-500 ring-2 ring-white" />
                    )}
                  </div>
                  <span className="text-[9.5px] font-semibold leading-none tracking-tight">
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>
        </nav>

        {/* Flying Audio FAB */}
        {showAudioFab && (
          <button
            onClick={onOpenAudio}
            aria-label="Audio Flashcard"
            className="pointer-events-auto h-14 w-14 shrink-0 rounded-full bg-teal-700 hover:bg-teal-800 text-white shadow-fab flex items-center justify-center transition-all duration-200 active:scale-90"
          >
            <Headphones className="h-5 w-5" strokeWidth={2.2} />
          </button>
        )}
      </div>
    </div>
  );
}
