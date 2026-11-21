import { useCallback, useEffect, useState } from 'react';
import { Cloud } from 'lucide-react';
import type {
  AssignedWordWithDetails,
  DailyProgressSummary,
  QuizDetailItem,
  QuizQuestion,
  QuizType
} from './types/vocab';
import { isDatasetLoaded, loadDatasetIntoDexie, type LoadProgress } from './db/datasetLoader';
import {
  ensureDailyTaskAndGetSummary,
  getAllAssignedWithDetails,
  saveQuizCompletion
} from './db/progressService';
import { getMeta, setMeta } from './db/vocketDb';
import {
  generateBatchQuiz,
  generateCumulativeQuiz,
  generateRemedialQuiz
} from './services/quizEngine';
import type { Accent } from './services/ttsService';
import { DatasetInitScreen } from './components/DatasetInitScreen';
import { SplashScreen } from './components/SplashScreen';
import { BottomNav, type NavTab } from './components/BottomNav';
import { AudioFlashcardSheet } from './components/AudioFlashcardSheet';
import { QuizModal } from './components/QuizModal';
import { PronunciationSheet } from './components/PronunciationSheet';
import { SyncSheet } from './components/SyncSheet';
import { HomeScreen } from './screens/HomeScreen';
import { SpeakScreen } from './screens/SpeakScreen';
import { GameScreen } from './screens/GameScreen';
import { DictScreen } from './screens/DictScreen';
import { DashboardScreen } from './screens/DashboardScreen';

export function App() {
  const [ready, setReady] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [needsDatasetInit, setNeedsDatasetInit] = useState(false);
  const [loadProgress, setLoadProgress] = useState<LoadProgress | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<NavTab>('today');
  const [accent, setAccent] = useState<Accent>('us');
  const [summary, setSummary] = useState<DailyProgressSummary | null>(null);
  const [allAssigned, setAllAssigned] = useState<AssignedWordWithDetails[]>([]);

  const [audioOpen, setAudioOpen] = useState(false);
  const [syncOpen, setSyncOpen] = useState(false);
  const [practiceItem, setPracticeItem] = useState<AssignedWordWithDetails | null>(null);

  const [quizState, setQuizState] = useState<{
    open: boolean;
    type: QuizType;
    batchNumber: number;
    questions: QuizQuestion[];
  }>({
    open: false,
    type: 'BATCH',
    batchNumber: 1,
    questions: []
  });

  const refreshData = useCallback(async () => {
    const [daily, all] = await Promise.all([
      ensureDailyTaskAndGetSummary(),
      getAllAssignedWithDetails()
    ]);
    setSummary(daily);
    setAllAssigned(all);
  }, []);

  const bootstrap = useCallback(
    async (forceReload = false) => {
      setLoadError(null);
      setReady(false);
      try {
        const savedAccent = await getMeta('accent', 'us');
        if (savedAccent === 'uk' || savedAccent === 'us') {
          setAccent(savedAccent);
        }

        const loaded = forceReload ? false : await isDatasetLoaded();
        if (!loaded) {
          setNeedsDatasetInit(true);
          setShowSplash(false);
          await loadDatasetIntoDexie((p) => setLoadProgress(p));
        }

        await refreshData();
        setNeedsDatasetInit(false);
        setReady(true);
      } catch (err) {
        setNeedsDatasetInit(true);
        setShowSplash(false);
        setLoadError(err instanceof Error ? err.message : 'Gagal memuat dataset.');
      }
    },
    [refreshData]
  );

  useEffect(() => {
    bootstrap(false);
  }, [bootstrap]);

  const handleAccentChange = async (next: Accent) => {
    setAccent(next);
    await setMeta('accent', next);
  };

  const startBatchQuiz = async () => {
    if (!summary) return;
    const questions = await generateBatchQuiz(summary.batchWords);
    if (questions.length === 0) return;
    setQuizState({
      open: true,
      type: 'BATCH',
      batchNumber: summary.batchNumber,
      questions
    });
  };

  const startRemedialQuiz = async () => {
    if (!summary) return;
    const questions = await generateRemedialQuiz();
    if (questions.length === 0) return;
    setQuizState({
      open: true,
      type: 'REMEDIAL',
      batchNumber: summary.batchNumber,
      questions
    });
  };

  const startCumulativeQuiz = async () => {
    if (!summary) return;
    const targetBatch = summary.pendingCumulativeBatch || summary.batchNumber;
    const questions = await generateCumulativeQuiz(targetBatch, 25);
    if (questions.length === 0) return;
    setQuizState({
      open: true,
      type: 'CUMULATIVE',
      batchNumber: targetBatch,
      questions
    });
  };

  const handleQuizComplete = async (details: QuizDetailItem[]) => {
    await saveQuizCompletion({
      batchNumber: quizState.batchNumber,
      quizType: quizState.type,
      details
    });
    await refreshData();
  };

  if (needsDatasetInit && (!ready || loadError)) {
    return (
      <DatasetInitScreen
        progress={loadProgress}
        error={loadError}
        onRetry={() => bootstrap(true)}
      />
    );
  }

  const isDash = activeTab === 'dash';

  return (
    <>
      {showSplash && (
        <SplashScreen ready={ready && Boolean(summary)} onDone={() => setShowSplash(false)} />
      )}

      {ready && summary && (
        <div
          className={`min-h-dvh flex justify-center transition-colors duration-300 ${
            isDash ? 'bg-[#081A17]' : 'bg-[#ECEAE3]'
          }`}
        >
          <div
            className={`w-full max-w-[430px] min-h-dvh shadow-sm flex flex-col transition-colors duration-300 ${
              isDash
                ? 'bg-gradient-to-b from-[#0E2B26] via-[#10352F] to-[#0B221E] sm:border-x border-white/10'
                : 'bg-[#F6F5F1] sm:border-x border-[#E6E4DD]'
            }`}
          >
            {/* Clean Minimal Sticky Header */}
            <header
              className={`sticky top-0 z-20 h-14 px-4 backdrop-blur-xl flex items-center justify-between transition-colors ${
                isDash ? 'bg-[#0E2B26]/80' : 'bg-[#F6F5F1]/90'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-xl bg-teal-600 flex items-center justify-center shadow-sm">
                  <span className="text-sm font-extrabold text-white tracking-tight">v</span>
                </div>
                <span
                  className={`text-[17px] font-extrabold tracking-tight ${
                    isDash ? 'text-[#F6F5F1]' : 'text-[#18221F]'
                  }`}
                >
                  vocket
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleAccentChange(accent === 'us' ? 'uk' : 'us')}
                  className={`h-8 px-3 rounded-full font-mono text-[11px] font-semibold uppercase active:scale-95 transition ${
                    isDash
                      ? 'bg-white/10 border border-white/15 text-teal-50'
                      : 'bg-white border border-[#E6E4DD] text-[#273430] shadow-card'
                  }`}
                >
                  {accent}
                </button>
                <button
                  onClick={() => setSyncOpen(true)}
                  aria-label="Sync"
                  className={`h-8 px-3 rounded-full text-xs font-semibold flex items-center gap-1.5 active:scale-95 transition ${
                    isDash
                      ? 'bg-white/10 border border-white/15 text-teal-50'
                      : 'bg-white border border-[#E6E4DD] text-[#18221F] shadow-card'
                  }`}
                >
                  <Cloud className={`h-3.5 w-3.5 ${isDash ? 'text-teal-300' : 'text-teal-700'}`} />
                  Sync
                </button>
              </div>
            </header>

            {/* Main Scroll Content */}
            <main className="flex-1 px-4 pt-2">
              {activeTab === 'today' && (
                <HomeScreen
                  summary={summary}
                  accent={accent}
                  onStartBatchQuiz={startBatchQuiz}
                  onStartRemedialQuiz={startRemedialQuiz}
                  onStartCumulativeQuiz={startCumulativeQuiz}
                  onPracticeSpeak={(item) => setPracticeItem(item)}
                />
              )}

              {activeTab === 'speak' && (
                <SpeakScreen
                  items={allAssigned}
                  accent={accent}
                  onSelectWord={(item) => setPracticeItem(item)}
                />
              )}

              {activeTab === 'game' && <GameScreen />}

              {activeTab === 'dict' && <DictScreen accent={accent} />}

              {activeTab === 'dash' && <DashboardScreen />}
            </main>

            {/* Flying Pill Navigation + Audio FAB */}
            <BottomNav
              active={activeTab}
              onChange={setActiveTab}
              remedialCount={summary.remedialCount}
              showAudioFab={activeTab === 'today'}
              onOpenAudio={() => setAudioOpen(true)}
              darkSurface={isDash}
            />

            {/* Sheets & Modals */}
            <AudioFlashcardSheet
              open={audioOpen}
              onClose={() => setAudioOpen(false)}
              todayWords={summary.todayWords}
              batchWords={summary.batchWords}
              accent={accent}
            />

            <PronunciationSheet
              item={practiceItem}
              accent={accent}
              onClose={() => setPracticeItem(null)}
              onUpdated={refreshData}
            />

            <SyncSheet
              open={syncOpen}
              onClose={() => setSyncOpen(false)}
              accent={accent}
              onAccentChange={handleAccentChange}
              onReloadDataset={() => bootstrap(true)}
              onSynced={refreshData}
            />

            <QuizModal
              open={quizState.open}
              quizType={quizState.type}
              batchNumber={quizState.batchNumber}
              questions={quizState.questions}
              onClose={() => setQuizState((s) => ({ ...s, open: false }))}
              onComplete={handleQuizComplete}
            />
          </div>
        </div>
      )}
    </>
  );
}
export default App;
