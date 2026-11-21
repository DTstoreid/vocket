import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Check,
  Clock,
  Delete,
  Loader2,
  Play,
  RotateCcw,
  Send,
  Shuffle,
  Sparkles,
  Trophy
} from 'lucide-react';
import type { ScrambleRound } from '../types/vocab';
import { db } from '../db/vocketDb';
import {
  calculateWordScore,
  DEFAULT_ROUND_SECONDS,
  loadScrambleRounds,
  pickNextRound,
  saveGameRun,
  validateScrambleWord
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

type Phase = 'IDLE' | 'PLAYING' | 'FINISHED';

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
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [roundIndex, setRoundIndex] = useState(0);
  const [round, setRound] = useState<ScrambleRound | null>(null);
  const [tiles, setTiles] = useState<LetterTile[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [found, setFound] = useState<FoundEntry[]>([]);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(DEFAULT_ROUND_SECONDS);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const assignedList = useLiveQuery(() => db.assignedWords.toArray(), [], []);
  const gameRuns = useLiveQuery(
    () => db.gameRuns.orderBy('playedAt').reverse().limit(15).toArray(),
    []
  );

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

  const finishRound = async (
    finalScore: number,
    finalFound: FoundEntry[],
    activeRound: ScrambleRound,
    activeRoundIdx: number,
    elapsedSeconds: number
  ) => {
    setPhase('FINISHED');
    await saveGameRun({
      roundIndex: activeRoundIdx,
      letters: activeRound.letters,
      score: finalScore,
      foundCount: finalFound.length,
      totalWords: activeRound.words.length,
      pangramsFound: finalFound.filter((f) => f.isPangram).length,
      assignedBonusCount: finalFound.filter((f) => f.isAssigned).length,
      durationSeconds: elapsedSeconds,
      playedAt: new Date().toISOString()
    });
  };

  useEffect(() => {
    if (phase !== 'PLAYING' || !round) return;
    if (timeLeft <= 0) {
      finishRound(score, found, round, roundIndex, DEFAULT_ROUND_SECONDS);
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
        finishRound(nextScore, nextFound, round, roundIndex, DEFAULT_ROUND_SECONDS - timeLeft);
      }
    } finally {
      setSubmitting(false);
    }
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
                Susun kata bahasa Inggris 3–6 huruf dalam 90 detik. Kata di kamus &amp; hafalanmu tetap mendapat poin.
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
                Total Main
              </p>
              <p className="font-mono text-xl font-bold mt-0.5">{runsSafe.length}</p>
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
            <span>Pangram (6 huruf): +5</span>
            <span className="font-semibold text-teal-700">Kata Tugas: x2</span>
          </div>
        </section>

        {/* Riwayat Game */}
        <div>
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#64706B] mb-2 px-1">
            Riwayat ({runsSafe.length})
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
                      {run.foundCount} kata ditemukan
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

  // --- PHASE 3: FINISHED ---
  if (phase === 'FINISHED' && round) {
    const missedPangrams = round.pangrams.filter((p) => !foundSet.has(p));
    return (
      <div className="space-y-4 pb-28 vocket-content-enter">
        <section className="rounded-[26px] bg-gradient-to-br from-[#115E59] to-[#134E4A] text-white p-6 text-center shadow-float">
          <div className="mx-auto h-11 w-11 rounded-2xl bg-white/15 flex items-center justify-center mb-3">
            <Trophy className="h-5 w-5 text-teal-200" />
          </div>
          <p className="text-xs font-semibold uppercase tracking-wider text-teal-200">Ronde Selesai</p>
          <p className="mt-1 font-mono text-5xl font-extrabold">{score}</p>
          <p className="mt-2 text-xs text-teal-100">
            {roundFoundCount}/{round.words.length} kata ronde
            {bonusWordCount > 0 ? ` + ${bonusWordCount} kata kamus` : ''} • Terbaik:{' '}
            {Math.max(bestScore, score)}
          </p>

          <div className="mt-5 grid grid-cols-2 gap-2.5">
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
        </section>

        {missedPangrams.length > 0 && (
          <section className="rounded-[22px] bg-white border border-[#E6E4DD] p-4 shadow-card">
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

        <section className="rounded-[22px] bg-white border border-[#E6E4DD] p-4 shadow-card">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#7B8681] mb-2.5">
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
            finishRound(score, found, round, roundIndex, DEFAULT_ROUND_SECONDS - timeLeft)
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
