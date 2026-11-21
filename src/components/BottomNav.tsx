import { BookOpen, Gamepad2, Headphones, Layers, Mic } from 'lucide-react';

export type NavTab = 'today' | 'speak' | 'game' | 'dict';

interface Props {
  active: NavTab;
  onChange: (tab: NavTab) => void;
  remedialCount: number;
  showAudioFab: boolean;
  onOpenAudio: () => void;
}

const ITEMS: Array<{ id: NavTab; label: string; icon: typeof Layers }> = [
  { id: 'today', label: 'Today', icon: Layers },
  { id: 'speak', label: 'Speak', icon: Mic },
  { id: 'game', label: 'Game', icon: Gamepad2 },
  { id: 'dict', label: 'Dict', icon: BookOpen }
];

export function BottomNav({ active, onChange, remedialCount, showAudioFab, onOpenAudio }: Props) {
  return (
    <div className="fixed left-1/2 -translate-x-1/2 w-full max-w-[430px] px-3.5 z-30 pointer-events-none safe-float-bottom">
      <div className="flex items-center justify-between gap-2">
        {/* Flying Pill Navigation Dock */}
        <nav
          aria-label="Navigasi utama"
          className="pointer-events-auto flex-1 rounded-full bg-white/92 backdrop-blur-xl border border-[#E6E4DD] p-1.5 shadow-float"
        >
          <div className="grid grid-cols-4 gap-1">
            {ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = active === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onChange(item.id)}
                  className={`relative h-11 rounded-full flex flex-col items-center justify-center gap-0.5 px-1.5 transition-all duration-200 active:scale-95 ${
                    isActive
                      ? 'bg-[#18221F] text-white shadow-sm'
                      : 'text-[#64706B] hover:text-[#18221F] hover:bg-[#F6F5F1]'
                  }`}
                >
                  <div className="relative flex items-center">
                    <Icon className="h-[16px] w-[16px]" strokeWidth={isActive ? 2.2 : 1.9} />
                    {item.id === 'today' && remedialCount > 0 && (
                      <span className="absolute -top-0.5 -right-1.5 h-2 w-2 rounded-full bg-amber-500 ring-2 ring-white" />
                    )}
                  </div>
                  <span className="text-[10px] font-semibold leading-none tracking-tight">
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
