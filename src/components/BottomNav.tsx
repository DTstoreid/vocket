import { BookOpen, Layers, Mic } from 'lucide-react';

export type NavTab = 'today' | 'speak' | 'dict';

interface Props {
  active: NavTab;
  onChange: (tab: NavTab) => void;
  remedialCount: number;
}

const ITEMS: Array<{ id: NavTab; label: string; icon: typeof Layers }> = [
  { id: 'today', label: 'Today', icon: Layers },
  { id: 'speak', label: 'Speak', icon: Mic },
  { id: 'dict', label: 'Dict', icon: BookOpen }
];

export function BottomNav({ active, onChange, remedialCount }: Props) {
  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] bg-white/95 backdrop-blur-md border-t border-slate-200/80 z-30 safe-bottom">
      <div className="grid grid-cols-3 h-16 px-2">
        {ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onChange(item.id)}
              className={`relative flex flex-col items-center justify-center gap-1 rounded-xl transition ${
                isActive ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <div className="relative">
                <Icon className="h-5 w-5" strokeWidth={isActive ? 2.25 : 1.9} />
                {item.id === 'today' && remedialCount > 0 && (
                  <span className="absolute -top-1 -right-2 h-2 w-2 rounded-full bg-amber-500" />
                )}
              </div>
              <span className={`text-[11px] leading-none ${isActive ? 'font-semibold' : 'font-medium'}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
