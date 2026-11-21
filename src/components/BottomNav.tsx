import { BookOpen, Headphones, Layers, Mic } from 'lucide-react';

export type NavTab = 'today' | 'speak' | 'dict';

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
  { id: 'dict', label: 'Dict', icon: BookOpen }
];

export function BottomNav({ active, onChange, remedialCount, showAudioFab, onOpenAudio }: Props) {
  return (
    <div className="fixed left-1/2 -translate-x-1/2 w-full max-w-[430px] px-4 z-30 pointer-events-none safe-float-bottom">
      <div className="flex items-center justify-between gap-2.5">
        {/* Flying Pill Navigation Dock */}
        <nav
          aria-label="Navigasi utama"
          className="pointer-events-auto flex-1 rounded-full bg-white/92 backdrop-blur-xl border border-[#E6E4DD] p-1.5 shadow-float"
        >
          <div className="grid grid-cols-3 gap-1">
            {ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = active === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onChange(item.id)}
                  className={`relative h-11 rounded-full flex items-center justify-center gap-1.5 px-3 transition-all duration-200 active:scale-95 ${
                    isActive
                      ? 'bg-[#18221F] text-white shadow-sm'
                      : 'text-[#64706B] hover:text-[#18221F] hover:bg-[#F6F5F1]'
                  }`}
                >
                  <div className="relative flex items-center">
                    <Icon className="h-[18px] w-[18px]" strokeWidth={isActive ? 2.2 : 1.9} />
                    {item.id === 'today' && remedialCount > 0 && (
                      <span className="absolute -top-1 -right-1.5 h-2 w-2 rounded-full bg-amber-500 ring-2 ring-white" />
                    )}
                  </div>
                  <span className="text-xs font-semibold tracking-tight">{item.label}</span>
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
