import { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Check,
  Clock,
  Delete,
  Languages,
  Loader2,
  Play,
  RotateCcw,
  Send,
  Shuffle,
  Sparkles,
  Trophy,
  X
} from 'lucide-react';
import type { ScrambleRound } from '../types/vocab';
import { db } from '../db/vocketDb';
import {
  buildTranslationMatchSession,
  calculateWordScore,
  DEFAULT_ROUND_SECONDS,
  loadScrambleRounds,
  MATCH_BONUS_POINTS,
  MAX_GAME_HISTORY,
  pickNextRound,
  pruneGameRuns,
  saveGameRun,
  validateScrambleWord,
  type MatchOptionItem,
  type MatchWordItem
} from '../services/scrambleService';
import { GameBoardSkeleton, GameHistorySkeleton } from '../components/LoadingSkeletons';

interface LetterTile {
  id: number;
  char: string;
}

interface FoundEntry {
  word: string;
  points: number;
  isPangram: boolean;
  isAssigned: boolean;
  inRound: boolean;
}

type Phase = 'IDLE' | 'PLAYING' | 'RESULT';
type ResultStage = 'MATCHING' | 'REVIEWED';

function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function GameScreen() {
  const [phase, setPhase] = useState<Phase>('IDLE');
  const [resultStage, setResultStage] = useState<ResultStage>('MATCHING');
  const [loading, setLoading] = useState(false);
  const [preparingMatch, setPreparingMatch] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [roundIndex, setRoundIndex] = useState(0);
  const [round, setRound] = useState<ScrambleRound | null>(null);
  const [tiles, setTiles] = useState<LetterTile[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [found, setFound] = useState<FoundEntry[]>([]);
  const [score, setScore] = useState(0);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [timeLeft, setTimeLeft] = useState(DEFAULT_ROUND_SECONDS);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // State sesi pencocokan terjemahan & review in-place
  const [matchItems, setMatchItems] = useState<MatchWordItem[]>([]);
  const [matchOptions, setMatchOptions] = useState<MatchOptionItem[]>([]);
  const [activeWord, setActiveWord] = useState<string | null>(null);
  const [userPairs, setUserPairs] = useState<Record<string, MatchOptionItem>>({});
  const [matchBonus, setMatchBonus] = useState(0);
  const [matchCorrectCount, setMatchCorrectCount] = useState(0);
  const finishingRef = useRef(false);

  const assignedList = useLiveQuery(() => db.assignedWords.toArray(), [], []);
  const gameRuns = useLiveQuery(
    () => db.gameRuns.orderBy('playedAt').reverse().limit(MAX_GAME_HISTORY).toArray(),
    []
  );

  // Pastikan data lama >5 langsung dibersihkan saat membuka layar Game
  useEffect(() => {
    pruneGameRuns(MAX_GAME_HISTORY).catch(() => {});
  }, []);

  const runsSafe = gameRuns ?? [];

  const assignedSet = useMemo(
    () => new Set(assignedList.map((a) => a.wordId.toLowerCase())),
    [assignedList]
  );

  const bestScore = useMemo(
    () => runsSafe.reduce((max, r) => Math.max(max, r.score), 0),
    [runsSafe]
  );

  const validWordSet = useMemo(() => {
    if (!round) return new Set<string>();
    return new Set(round.words.map((w) => w.toLowerCase()));
  }, [round]);

  const foundSet = useMemo(() => new Set(found.map((f) => f.word)), [found]);
  const roundFoundCount = useMemo(() => found.filter((f) => f.inRound).length, [found]);
  const bonusWordCount = useMemo(() => found.filter((f) => !f.inRound).length, [found]);

  const selectedTiles = useMemo(() => {
    const map = new Map(tiles.map((t) => [t.id, t]));
    return selectedIds.map((id) => map.get(id)).filter((t): t is LetterTile => Boolean(t));
  }, [tiles, selectedIds]);

  const currentWord = selectedTiles.map((t) => t.char).join('');

  const usedOptionIds = useMemo(
    () => new Set(Object.values(userPairs).map((opt) => opt.id)),
    [userPairs]
  );

  const pairedCount = Object.keys(userPairs).length;
  const allMatched = matchItems.length > 0 && pairedCount === matchItems.length;

  const persistRun = async (
    finalTotalScore: number,
    finalFound: FoundEntry[],
    activeRound: ScrambleRound,
    activeRoundIdx: number,
    durationSec: number,
    correctMatches: number,
    totalMatches: number
  ) => {
    await saveGameRun({
      roundIndex: activeRoundIdx,
      letters: activeRound.letters,
      score: finalTotalScore,
      foundCount: finalFound.length,
      totalWords: activeRound.words.length,
      pangramsFound: finalFound.filter((f) => f.isPangram).length,
      assignedBonusCount: finalFound.filter((f) => f.isAssigned).length,
      matchCorrect: correctMatches,
      matchTotal: totalMatches,
      durationSeconds: durationSec,
      playedAt: new Date().toISOString()
    });
  };

  /**
   * Masuk ke panel hasil & sesi mencocokkan terjemahan Indonesia
   * setelah waktu habis atau tombol Selesai ditekan.
   */
  const proceedToMatchingOrFinish = async (
    currentScore: number,
    currentFound: FoundEntry[],
    activeRound: ScrambleRound,
    activeRoundIdx: number,
    durationSec: number
  ) => {
    if (finishingRef.current) return;
    finishingRef.current = true;
    setElapsedSec(durationSec);
    setPreparingMatch(true);
    setPhase('RESULT');

    try {
      const session = await buildTranslationMatchSession(currentFound);
      setMatchItems(session.items);
      setMatchOptions(session.options);
      setUserPairs({});
      setMatchBonus(0);
      setMatchCorrectCount(0);

      if (session.items.length > 0) {
        setActiveWord(session.items[0].word);
        setResultStage('MATCHING');
      } else {
        setActiveWord(null);
        setResultStage('REVIEWED');
        await persistRun(
          currentScore,
          currentFound,
          activeRound,
          activeRoundIdx,
          durationSec,
          0,
          0
        );
      }
    } finally {
      setPreparingMatch(false);
    }
  };

  useEffect(() => {
    if (phase !== 'PLAYING' || !round) return;
    if (timeLeft <= 0) {
      proceedToMatchingOrFinish(score, found, round, roundIndex, DEFAULT_ROUND_SECONDS);
      return;
    }
    const timer = window.setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [phase, timeLeft, score, found, round, roundIndex]);

  useEffect(() => {
    if (!feedback) return;
    const t = window.setTimeout(() => setFeedback(null), 1800);
    return () => window.clearTimeout(t);
  }, [feedback]);

  const startNewRound = async () => {
    setLoading(true);
    setLoadError(null);
    finishingRef.current = false;
    try {
      const rounds = await loadScrambleRounds();
      const picked = await pickNextRound(rounds);
      const initialTiles: LetterTile[] = shuffleArray(
        picked.round.letters.split('').map((char, idx) => ({ id: idx, char: char.toLowerCase() }))
      );

      setRoundIndex(picked.roundIndex);
      setRound(picked.round);
      setTiles(initialTiles);
      setSelectedIds([]);
      setFound([]);
      setScore(0);
      setElapsedSec(0);
      setMatchItems([]);
      setMatchOptions([]);
      setUserPairs({});
      setActiveWord(null);
      setMatchBonus(0);
      setMatchCorrectCount(0);
      setResultStage('MATCHING');
      setTimeLeft(DEFAULT_ROUND_SECONDS);
      setFeedback(null);
      setPhase('PLAYING');
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Gagal memulai permainan.');
    } finally {
      setLoading(false);
    }
  };

  const handleTapTile = (tileId: number) => {
    if (phase !== 'PLAYING') return;
    if (selectedIds.includes(tileId) || selectedIds.length >= 6) return;
    setSelectedIds((prev) => [...prev, tileId]);
  };

  const handleRemoveSelectedAt = (posIndex: number) => {
    if (phase !== 'PLAYING') return;
    setSelectedIds((prev) => prev.filter((_, idx) => idx !== posIndex));
  };

  const handleBackspace = () => {
    setSelectedIds((prev) => prev.slice(0, -1));
  };

  const handleShuffle = () => {
    setTiles((prev) => shuffleArray(prev));
  };

  const handleSubmit = async () => {
    if (!round || phase !== 'PLAYING' || submitting) return;
    const candidate = currentWord.toLowerCase().trim();

    if (candidate.length < 3) {
      setFeedback({ type: 'err', text: 'Minimal 3 huruf.' });
      return;
    }

    if (foundSet.has(candidate)) {
      setFeedback({ type: 'err', text: 'Kata sudah ditemukan.' });
      setSelectedIds([]);
      return;
    }

    setSubmitting(true);
    try {
      const validation = await validateScrambleWord(candidate, validWordSet);
      if (!validation.valid) {
        setFeedback({ type: 'err', text: `"${candidate}" tidak ditemukan di kamus.` });
        setSelectedIds([]);
        return;
      }

      const res = calculateWordScore(candidate, round, assignedSet);
      const entry: FoundEntry = {
        word: candidate,
        points: res.points,
        isPangram: res.isPangram,
        isAssigned: res.isAssigned,
        inRound: validation.inRound
      };

      const nextFound = [entry, ...found];
      const nextScore = score + res.points;
      setFound(nextFound);
      setScore(nextScore);
      setSelectedIds([]);

      const tags: string[] = [];
      if (!validation.inRound) tags.push('Kamus');
      if (res.isPangram) tags.push('Pangram +5');
      if (res.isAssigned) tags.push('Hafalan x2');
      setFeedback({
        type: 'ok',
        text: `+${res.points} poin${tags.length ? ` (${tags.join(', ')})` : ''}`
      });

      const nextRoundFound = nextFound.filter((f) => f.inRound).length;
      if (nextRoundFound === round.words.length) {
        proceedToMatchingOrFinish(
          nextScore,
          nextFound,
          round,
          roundIndex,
          DEFAULT_ROUND_SECONDS - timeLeft
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  // --- INTERAKSI PENCOCOKAN TERJEMAHAN ---
  const handleSelectWordSlot = (word: string) => {
    if (resultStage !== 'MATCHING') return;
    if (userPairs[word]) {
      // Tap slot yang sudah terisi -> lepaskan pasangannya agar mudah diganti
      setUserPairs((prev) => {
        const next = { ...prev };
        delete next[word];
        return next;
      });
    }
    setActiveWord(word);
  };

  const handlePickTranslationOption = (option: MatchOptionItem) => {
    if (resultStage !== 'MATCHING') return;

    // Tentukan kata target: gunakan activeWord, atau otomatis cari kata pertama yang belum dipasangkan
    const targetWord =
      activeWord && !userPairs[activeWord]
        ? activeWord
        : activeWord ?? matchItems.find((item) => !userPairs[item.word])?.word ?? null;

    if (!targetWord) return;

    const nextPairs: Record<string, MatchOptionItem> = { ...userPairs };
    // Jika opsi ini sebelumnya dipakai kata lain, lepaskan dulu
    for (const [k, v] of Object.entries(nextPairs)) {
      if (v.id === option.id) {
        delete nextPairs[k];
      }
    }
    nextPairs[targetWord] = option;
    setUserPairs(nextPairs);

    // Pindahkan fokus otomatis ke kata berikutnya yang masih kosong
    const nextEmpty = matchItems.find((item) => !nextPairs[item.word]);
    setActiveWord(nextEmpty ? nextEmpty.word : null);
  };

  /**
   * Review langsung di panel hasil user dengan transisi smooth (tanpa pindah panel)
   */
  const handleCheckMatches = async () => {
    if (!round || resultStage === 'REVIEWED') return;

    let correct = 0;
    for (const item of matchItems) {
      const picked = userPairs[item.word];
      if (picked && picked.translation.toLowerCase() === item.translation.toLowerCase()) {
        correct++;
      }
    }

    const bonus = correct * MATCH_BONUS_POINTS;
    const finalTotalScore = score + bonus;

    setMatchCorrectCount(correct);
    setMatchBonus(bonus);
    setActiveWord(null);
    setResultStage('REVIEWED');

    await persistRun(
      finalTotalScore,
      found,
      round,
      roundIndex,
      elapsedSec,
      correct,
      matchItems.length
    );
  };

  // --- LOADING NEW ROUND SKELETON ---
  if (loading) {
    return <GameBoardSkeleton />;
  }

  // --- PHASE 1: IDLE / LOBBY ---
  if (phase === 'IDLE') {
    return (
      <div className="space-y-4 pb-28 vocket-content-enter">
        <section className="rounded-[26px] bg-gradient-to-br from-[#115E59] to-[#134E4A] text-white p-5 shadow-float">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-teal-200/90">
                Mini Game
              </p>
              <h2 className="text-xl font-extrabold tracking-tight mt-0.5">Susun Kata</h2>
              <p className="text-xs text-teal-100/90 mt-1.5 leading-relaxed">
                Susun kata bahasa Inggris 3–6 huruf dalam 90 detik, lalu cocokkan terjemahan
                Indonesianya untuk bonus poin.
              </p>
            </div>
            <div className="h-11 w-11 rounded-2xl bg-white/15 flex items-center justify-center shrink-0">
              <Sparkles className="h-5 w-5 text-teal-200" />
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2.5">
            <div className="rounded-2xl bg-black/20 px-3.5 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-teal-200/80">
                Skor Tertinggi
              </p>
              <p className="font-mono text-xl font-bold mt-0.5">{bestScore}</p>
            </div>
            <div className="rounded-2xl bg-black/20 px-3.5 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-teal-200/80">
                Riwayat Terbaru
              </p>
              <p className="font-mono text-xl font-bold mt-0.5">
                {runsSafe.length}/{MAX_GAME_HISTORY}
              </p>
            </div>
          </div>

          <button
            onClick={startNewRound}
            disabled={loading}
            className="mt-4 w-full h-12 rounded-full bg-white text-[#115E59] text-sm font-bold flex items-center justify-center gap-2 shadow-sm active:scale-[0.98] transition disabled:opacity-60"
          >
            <Play className="h-4 w-4 fill-current" />
            Mulai
          </button>
        </section>

        {loadError && (
          <div className="rounded-2xl bg-rose-50 border border-rose-200 px-4 py-3 text-xs text-rose-800">
            {loadError}
          </div>
        )}

        {/* Aturan Skor Singkat */}
        <section className="rounded-[22px] bg-white border border-[#E6E4DD] p-4 shadow-card">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#7B8681] mb-2.5">
            Aturan Poin
          </p>
          <div className="grid grid-cols-4 gap-2 text-center">
            {[
              { l: '3 huruf', p: '+1' },
              { l: '4 huruf', p: '+2' },
              { l: '5 huruf', p: '+4' },
              { l: '6 huruf', p: '+8' }
            ].map((r) => (
              <div key={r.l} className="rounded-2xl bg-[#F6F5F1] py-2 px-1">
                <p className="font-mono text-sm font-bold text-teal-700">{r.p}</p>
                <p className="text-[10px] font-medium text-[#64706B] mt-0.5">{r.l}</p>
              </div>
            ))}
          </div>
          <div className="mt-2.5 flex items-center justify-between text-[11px] text-[#5C6863] bg-[#F6F5F1] rounded-xl px-3 py-2">
            <span>Pangram: +5 • Arti cocok: +{MATCH_BONUS_POINTS}</span>
            <span className="font-semibold text-teal-700">Tugas: x2</span>
          </div>
        </section>

        {/* Riwayat Game (Maks 5 Terbaru) */}
        <div>
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#64706B] mb-2 px-1">
            5 Riwayat Terbaru ({runsSafe.length})
          </h3>
          {gameRuns === undefined ? (
            <GameHistorySkeleton />
          ) : runsSafe.length === 0 ? (
            <div className="rounded-[22px] bg-white border border-[#E6E4DD] p-6 text-center text-xs text-[#7B8681]">
              Belum ada riwayat permainan.
            </div>
          ) : (
            <div className="space-y-2">
              {runsSafe.map((run) => (
                <div
                  key={run.id}
                  className="rounded-[20px] bg-white border border-[#E6E4DD] px-4 py-3 shadow-card flex items-center justify-between"
                >
                  <div>
                    <p className="font-mono text-xs font-bold uppercase tracking-widest text-[#18221F]">
                      {run.letters.split('').join(' ')}
                    </p>
                    <p className="text-[11px] text-[#7B8681] mt-0.5">
                      {run.foundCount} kata
                      {typeof run.matchTotal === 'number' && run.matchTotal > 0
                        ? ` • Cocok ${run.matchCorrect ?? 0}/${run.matchTotal}`
                        : ''}
                      {run.assignedBonusCount > 0 ? ` • ${run.assignedBonusCount} hafalan` : ''}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-base font-bold text-teal-700">{run.score}</p>
                    <p className="text-[10px] text-[#8A948F]">poin</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // --- PHASE 3: UNIFIED RESULT + TRANSLATION MATCHING + IN-PLACE SMOOTH REVIEW ---
  if (phase === 'RESULT' && round) {
    const isReviewed = resultStage === 'REVIEWED';
    const totalFinalScore = score + matchBonus;
    const missedPangrams = round.pangrams.filter((p) => !foundSet.has(p));
    const matchedWordSet = new Set(matchItems.map((m) => m.word));
    const extraFoundWords = found.filter((f) => !matchedWordSet.has(f.word));

    return (
      <div className="space-y-4 pb-28 vocket-content-enter">
        {/* Hero Score Card (bertransisi mulus dari skor susun kata ke skor akhir) */}
        <section className="rounded-[26px] bg-gradient-to-br from-[#115E59] to-[#134E4A] text-white p-5 text-center shadow-float transition-all duration-500">
          <div className="mx-auto h-11 w-11 rounded-2xl bg-white/15 flex items-center justify-center mb-2.5">
            {isReviewed ? (
              <Trophy className="h-5 w-5 text-teal-200" />
            ) : (
              <Languages className="h-5 w-5 text-teal-200" />
            )}
          </div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-teal-200">
            {isReviewed ? 'Hasil Akhir Ronde' : 'Sesi Lanjutan • Cocokkan Arti'}
          </p>
          <p className="mt-1 font-mono text-4xl font-extrabold transition-all duration-500">
            {totalFinalScore}
          </p>
          <p className="mt-1.5 text-xs text-teal-100/90">
            {isReviewed ? (
              <>
                Susun kata {score}
                {matchBonus > 0 ? ` + Cocokkan ${matchBonus}` : ''}
                {matchItems.length > 0
                  ? ` • Arti benar ${matchCorrectCount}/${matchItems.length}`
                  : ''}
              </>
            ) : (
              <>
                {roundFoundCount}/{round.words.length} kata ronde
                {bonusWordCount > 0 ? ` + ${bonusWordCount} kata kamus` : ''} • Pasangkan arti
                Indonesianya
              </>
            )}
          </p>

          {/* Tombol Aksi Akhir (muncul mulus saat sudah direview) */}
          <div
            className={`grid transition-[grid-template-rows,opacity,margin] duration-500 ease-out ${
              isReviewed ? 'grid-rows-[1fr] opacity-100 mt-4' : 'grid-rows-[0fr] opacity-0 mt-0'
            }`}
          >
            <div className="overflow-hidden">
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  onClick={() => setPhase('IDLE')}
                  className="h-11 rounded-full bg-white/15 text-white text-xs font-bold active:scale-95 transition"
                >
                  Riwayat
                </button>
                <button
                  onClick={startNewRound}
                  className="h-11 rounded-full bg-white text-[#115E59] text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95 transition"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Main Lagi
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Panel Pencocokan & Review In-Place (SATU panel yang sama!) */}
        {preparingMatch ? (
          <section className="rounded-[24px] bg-white border border-[#E6E4DD] p-4 shadow-card space-y-3">
            <div className="vocket-shimmer h-4 w-44 rounded-md" />
            {[0, 1, 2].map((i) => (
              <div key={i} className="vocket-shimmer h-14 w-full rounded-2xl" />
            ))}
          </section>
        ) : matchItems.length > 0 ? (
          <section className="rounded-[24px] bg-white border border-[#E6E4DD] p-4 shadow-card space-y-3.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#64706B]">
                {isReviewed
                  ? `Review Pencocokan (${matchCorrectCount}/${matchItems.length} Benar)`
                  : `Cocokkan Terjemahan (${pairedCount}/${matchItems.length})`}
              </p>
              {!isReviewed && (
                <span className="text-[10px] font-semibold text-teal-700 bg-teal-50 border border-teal-200/70 rounded-full px-2.5 py-0.5">
                  +{MATCH_BONUS_POINTS} / benar
                </span>
              )}
            </div>

            {/* Daftar Baris Kata User — Review langsung terjadi pada baris-baris ini */}
            <div className="space-y-2">
              {matchItems.map((item, idx) => {
                const picked = userPairs[item.word];
                const isActive = !isReviewed && activeWord === item.word;
                const isCorrect =
                  isReviewed &&
                  Boolean(picked) &&
                  picked.translation.toLowerCase() === item.translation.toLowerCase();
                const isWrong = isReviewed && !isCorrect;

                return (
                  <div
                    key={item.word}
                    style={{ transitionDelay: isReviewed ? `${idx * 65}ms` : '0ms' }}
                    className={`rounded-2xl border p-3 transition-all duration-500 ease-out ${
                      isCorrect
                        ? 'border-emerald-300 bg-emerald-50/75'
                        : isWrong
                          ? 'border-rose-300 bg-rose-50/70'
                          : isActive
                            ? 'border-teal-600 bg-teal-50/50 ring-2 ring-teal-600/20'
                            : 'border-[#E6E4DD] bg-[#F9F8F5]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2.5">
                      <button
                        type="button"
                        disabled={isReviewed}
                        onClick={() => handleSelectWordSlot(item.word)}
                        className="text-left min-w-0 flex items-center gap-2"
                      >
                        <span className="text-sm font-extrabold text-[#18221F]">{item.word}</span>
                        <span className="font-mono text-[10px] font-bold text-[#7B8681]">
                          +{item.points}
                        </span>
                      </button>

                      <button
                        type="button"
                        disabled={isReviewed}
                        onClick={() => handleSelectWordSlot(item.word)}
                        className={`max-w-[60%] rounded-xl px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 transition-all duration-300 ${
                          isCorrect
                            ? 'bg-emerald-600 text-white shadow-sm'
                            : isWrong
                              ? 'bg-rose-100 text-rose-800 border border-rose-200'
                              : picked
                                ? 'bg-teal-700 text-white shadow-sm active:scale-95'
                                : isActive
                                  ? 'bg-white border border-dashed border-teal-500 text-teal-700'
                                  : 'bg-white border border-dashed border-[#D6D3C9] text-[#8A948F]'
                        }`}
                      >
                        {isCorrect && <Check className="h-3.5 w-3.5 shrink-0" />}
                        {isWrong && <X className="h-3.5 w-3.5 shrink-0" />}
                        <span className={`truncate ${isWrong && picked ? 'line-through' : ''}`}>
                          {picked ? picked.translation : isReviewed ? 'Tidak dipilih' : 'Pilih arti'}
                        </span>
                        {isCorrect && (
                          <span className="font-mono text-[10px] bg-white/20 rounded-full px-1.5 py-0.2 shrink-0">
                            +{MATCH_BONUS_POINTS}
                          </span>
                        )}
                      </button>
                    </div>

                    {/* Transisi smooth inline untuk menampilkan pencocokan yang benar langsung di baris user */}
                    <div
                      style={{ transitionDelay: isReviewed ? `${idx * 65 + 120}ms` : '0ms' }}
                      className={`grid transition-[grid-template-rows,opacity,margin] duration-500 ease-out ${
                        isWrong
                          ? 'grid-rows-[1fr] opacity-100 mt-2.5'
                          : 'grid-rows-[0fr] opacity-0 mt-0'
                      }`}
                    >
                      <div className="overflow-hidden">
                        <div className="rounded-xl bg-emerald-50 border border-emerald-200/90 px-3 py-1.5 flex items-center justify-between gap-2">
                          <span className="text-[11px] font-bold text-emerald-800 flex items-center gap-1.5">
                            <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                            Benar:
                          </span>
                          <span className="text-xs font-bold text-emerald-900 text-right">
                            {item.translation}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bank Pilihan Terjemahan Indonesia — menutup mulus saat masuk review */}
            <div
              className={`grid transition-[grid-template-rows,opacity] duration-500 ease-out ${
                !isReviewed ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
              }`}
            >
              <div className="overflow-hidden space-y-3 pt-1">
                <div className="rounded-2xl bg-[#F6F5F1] border border-[#E6E4DD] p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#7B8681] mb-2">
                    Pilihan Terjemahan Indonesia (tap untuk pasangkan)
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {matchOptions.map((opt) => {
                      const used = usedOptionIds.has(opt.id);
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => handlePickTranslationOption(opt)}
                          className={`rounded-full px-3.5 py-1.5 text-xs font-semibold border transition-all duration-200 active:scale-95 ${
                            used
                              ? 'bg-[#EAE8E1] border-transparent text-[#9BA39F]'
                              : 'bg-white border-[#DDDAD0] text-[#18221F] hover:border-teal-600 shadow-sm'
                          }`}
                        >
                          {opt.translation}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={handleCheckMatches}
                    className="h-11 rounded-full bg-[#F2F1EC] text-[#5C6863] text-xs font-bold active:scale-95 transition"
                  >
                    Lewati
                  </button>
                  <button
                    type="button"
                    disabled={!allMatched}
                    onClick={handleCheckMatches}
                    className="col-span-2 h-11 rounded-full bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-fab disabled:opacity-40 disabled:shadow-none active:scale-95 transition"
                  >
                    <Check className="h-4 w-4" />
                    Periksa Hasil
                  </button>
                </div>
              </div>
            </div>
          </section>
        ) : (
          <section className="rounded-[22px] bg-white border border-[#E6E4DD] p-4 shadow-card">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#7B8681] mb-2">
              Kata Ditemukan ({found.length})
            </p>
            {found.length === 0 ? (
              <p className="text-xs text-[#7B8681]">Belum ada kata yang ditemukan.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {found.map((f) => (
                  <span
                    key={f.word}
                    className="rounded-full bg-[#F6F5F1] border border-[#E6E4DD] px-3 py-1 text-xs font-semibold text-[#18221F] flex items-center gap-1.5"
                  >
                    {f.word}
                    <span className="font-mono text-[10px] text-teal-700">+{f.points}</span>
                  </span>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Kata tambahan tanpa entri terjemahan di kamus lokal */}
        {extraFoundWords.length > 0 && matchItems.length > 0 && (
          <section className="rounded-[22px] bg-white border border-[#E6E4DD] p-4 shadow-card">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#7B8681] mb-2">
              Kata Lain yang Ditemukan ({extraFoundWords.length})
            </p>
            <div className="flex flex-wrap gap-1.5">
              {extraFoundWords.map((f) => (
                <span
                  key={f.word}
                  className="rounded-full bg-[#F6F5F1] border border-[#E6E4DD] px-3 py-1 text-xs font-semibold text-[#18221F] flex items-center gap-1.5"
                >
                  {f.word}
                  <span className="font-mono text-[10px] text-teal-700">+{f.points}</span>
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Pangram Ronde Ini (muncul setelah review) */}
        {isReviewed && missedPangrams.length > 0 && (
          <section className="rounded-[22px] bg-white border border-[#E6E4DD] p-4 shadow-card vocket-content-enter">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#7B8681] mb-2">
              Pangram Ronde Ini
            </p>
            <div className="flex flex-wrap gap-1.5">
              {round.pangrams.map((p) => (
                <span
                  key={p}
                  className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${
                    foundSet.has(p)
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-[#F6F5F1] text-[#4E5B56] border border-[#E6E4DD]'
                  }`}
                >
                  {p}
                </span>
              ))}
            </div>
          </section>
        )}
      </div>
    );
  }

  // --- PHASE 2: PLAYING ---
  return (
    <div className="space-y-4 pb-28 vocket-content-enter">
      {/* Top Status Bar */}
      <div className="rounded-[22px] bg-white border border-[#E6E4DD] px-4 py-3 shadow-card flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className={`h-4 w-4 ${timeLeft <= 15 ? 'text-rose-600' : 'text-teal-700'}`} />
          <span
            className={`font-mono text-base font-bold ${
              timeLeft <= 15 ? 'text-rose-600' : 'text-[#18221F]'
            }`}
          >
            {formatTime(timeLeft)}
          </span>
        </div>

        <div className="text-center">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#7B8681]">Skor</p>
          <p className="font-mono text-base font-extrabold text-teal-700 leading-none mt-0.5">
            {score}
          </p>
        </div>

        <button
          onClick={() =>
            round &&
            proceedToMatchingOrFinish(
              score,
              found,
              round,
              roundIndex,
              DEFAULT_ROUND_SECONDS - timeLeft
            )
          }
          className="h-8 px-3 rounded-full bg-[#F2F1EC] text-[#4E5B56] text-xs font-semibold active:scale-95 transition"
        >
          Selesai
        </button>
      </div>

      {/* Indicator: Ditemukan X dari Y kata */}
      <div className="flex items-center justify-between gap-2 px-1">
        <span className="text-xs font-semibold text-[#4E5B56]">
          Ditemukan <span className="font-mono font-bold text-[#18221F]">{roundFoundCount}</span>{' '}
          dari <span className="font-mono font-bold text-[#18221F]">{round?.words.length || 0}</span>{' '}
          kata{bonusWordCount > 0 ? ` (+${bonusWordCount})` : ''}
        </span>
        {feedback && (
          <span
            className={`text-xs font-bold shrink-0 ${
              feedback.type === 'ok' ? 'text-teal-700' : 'text-rose-600'
            }`}
          >
            {feedback.text}
          </span>
        )}
      </div>

      {/* 6 Huruf Acak (Bagian Atas - Tap untuk memilih) */}
      <section className="rounded-[26px] bg-white border border-[#E6E4DD] p-4 shadow-card space-y-4">
        <div className="grid grid-cols-6 gap-2">
          {tiles.map((tile) => {
            const used = selectedIds.includes(tile.id);
            return (
              <button
                key={tile.id}
                onClick={() => handleTapTile(tile.id)}
                disabled={used}
                className={`aspect-square rounded-2xl font-mono text-xl font-extrabold uppercase flex items-center justify-center transition-all active:scale-90 ${
                  used
                    ? 'bg-[#F2F1EC] text-[#C5C3BA] border border-transparent'
                    : 'bg-[#F6F5F1] hover:bg-teal-50 text-[#18221F] border border-[#DFDDD4] shadow-sm'
                }`}
              >
                {tile.char}
              </button>
            );
          })}
        </div>

        {/* Susunan Huruf yang Diklik (Bagian Bawah) */}
        <div className="rounded-2xl bg-[#F6F5F1] border border-[#E6E4DD] p-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#8A948F] text-center mb-2">
            Susunan Kata (tap huruf untuk batal)
          </p>
          <div className="grid grid-cols-6 gap-2">
            {Array.from({ length: 6 }).map((_, idx) => {
              const tile = selectedTiles[idx];
              return (
                <button
                  key={idx}
                  type="button"
                  disabled={!tile}
                  onClick={() => tile && handleRemoveSelectedAt(idx)}
                  className={`aspect-square rounded-xl font-mono text-lg font-extrabold uppercase flex items-center justify-center transition ${
                    tile
                      ? 'bg-teal-700 text-white shadow-sm active:scale-90'
                      : 'bg-white/70 border border-dashed border-[#D6D3C9] text-transparent'
                  }`}
                >
                  {tile ? tile.char : '-'}
                </button>
              );
            })}
          </div>
        </div>

        {/* Kontrol: Acak, Hapus, Kirim */}
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={handleShuffle}
            className="h-11 rounded-full bg-[#F6F5F1] border border-[#E6E4DD] text-[#18221F] text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95 transition"
          >
            <Shuffle className="h-3.5 w-3.5 text-[#5C6863]" />
            Acak
          </button>

          <button
            onClick={handleBackspace}
            disabled={selectedIds.length === 0}
            className="h-11 rounded-full bg-[#F6F5F1] border border-[#E6E4DD] text-[#18221F] text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-40 active:scale-95 transition"
          >
            <Delete className="h-3.5 w-3.5 text-[#5C6863]" />
            Hapus
          </button>

          <button
            onClick={handleSubmit}
            disabled={selectedIds.length < 3 || submitting}
            className="h-11 rounded-full bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-fab disabled:opacity-40 disabled:shadow-none active:scale-95 transition"
          >
            {submitting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            Kirim
          </button>
        </div>
      </section>

      {/* Daftar Kata Ditemukan */}
      <section className="rounded-[22px] bg-white border border-[#E6E4DD] p-4 shadow-card">
        <p className="text-[11px] font-bold uppercase tracking-wider text-[#7B8681] mb-2.5">
          Terkumpul ({found.length})
        </p>
        {found.length === 0 ? (
          <p className="text-xs text-[#8A948F]">Ketuk huruf di atas untuk mulai menyusun kata.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {found.map((f) => (
              <span
                key={f.word}
                className={`rounded-full px-3 py-1 text-xs font-semibold flex items-center gap-1.5 border ${
                  f.isPangram
                    ? 'bg-teal-50 border-teal-200 text-teal-900'
                    : 'bg-[#F6F5F1] border-[#E6E4DD] text-[#18221F]'
                }`}
              >
                <Check className="h-3 w-3 text-teal-700" />
                {f.word}
                <span className="font-mono text-[10px] font-bold text-teal-700">+{f.points}</span>
                {!f.inRound && (
                  <span className="rounded-full bg-[#E6E4DD] text-[#4E5B56] px-1.5 text-[9px] font-bold">
                    Kamus
                  </span>
                )}
                {f.isAssigned && (
                  <span className="rounded-full bg-teal-700 text-white px-1.5 text-[9px] font-bold">
                    x2
                  </span>
                )}
              </span>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
