import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/vocketDb';

function polarToCartesian(cx: number, cy: number, radius: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(rad),
    y: cy + radius * Math.sin(rad)
  };
}

/**
 * Membuat path SVG segmen donat berbentuk chevron saling mengait searah jarum jam
 */
function buildChevronArcPath(
  cx: number,
  cy: number,
  rInner: number,
  rOuter: number,
  startDeg: number,
  endDeg: number,
  tipOffsetDeg = 13
): string {
  const rMid = (rInner + rOuter) / 2;
  const pOuterStart = polarToCartesian(cx, cy, rOuter, startDeg);
  const pOuterEnd = polarToCartesian(cx, cy, rOuter, endDeg);
  const pTipEnd = polarToCartesian(cx, cy, rMid, endDeg + tipOffsetDeg);
  const pInnerEnd = polarToCartesian(cx, cy, rInner, endDeg);
  const pInnerStart = polarToCartesian(cx, cy, rInner, startDeg);
  const pNotchStart = polarToCartesian(cx, cy, rMid, startDeg + tipOffsetDeg);

  const sweep = ((endDeg - startDeg) % 360 + 360) % 360;
  const largeArc = sweep > 180 ? 1 : 0;

  return [
    `M ${pOuterStart.x.toFixed(2)} ${pOuterStart.y.toFixed(2)}`,
    `A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${pOuterEnd.x.toFixed(2)} ${pOuterEnd.y.toFixed(2)}`,
    `L ${pTipEnd.x.toFixed(2)} ${pTipEnd.y.toFixed(2)}`,
    `L ${pInnerEnd.x.toFixed(2)} ${pInnerEnd.y.toFixed(2)}`,
    `A ${rInner} ${rInner} 0 ${largeArc} 0 ${pInnerStart.x.toFixed(2)} ${pInnerStart.y.toFixed(2)}`,
    `L ${pNotchStart.x.toFixed(2)} ${pNotchStart.y.toFixed(2)}`,
    'Z'
  ].join(' ');
}

export function DashboardScreen() {
  const assignedList = useLiveQuery(() => db.assignedWords.toArray(), []);
  const quizHistory = useLiveQuery(() => db.quizHistory.toArray(), []);
  const [minDelayDone, setMinDelayDone] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setMinDelayDone(true), 320);
    return () => window.clearTimeout(timer);
  }, []);

  const isLoading = assignedList === undefined || quizHistory === undefined || !minDelayDone;

  const stats = useMemo(() => {
    const assigned = assignedList ?? [];
    const quizzes = quizHistory ?? [];

    const totalAssigned = assigned.length;
    const masteredWords = assigned.filter((a) => a.masteryScore === 2).length;
    const activeBatch = assigned.reduce((max, a) => Math.max(max, a.batchNumber), 1);

    const totalQuizzes = quizzes.length;
    const passedQuizzes = quizzes.filter(
      (q) => q.totalQuestions > 0 && q.totalCorrect / q.totalQuestions >= 0.7
    ).length;

    const practiced = assigned.filter((a) => a.pronunciationAttempts > 0);
    const fluentCount = assigned.filter((a) => a.pronunciationScore >= 80).length;
    const avgPronunciation =
      practiced.length > 0
        ? Math.round(
            practiced.reduce((sum, a) => sum + a.pronunciationScore, 0) / practiced.length
          )
        : 0;

    return {
      totalAssigned,
      masteredWords,
      activeBatch,
      passedQuizzes,
      totalQuizzes,
      avgPronunciation,
      practicedCount: practiced.length,
      fluentCount
    };
  }, [assignedList, quizHistory]);

  const cx = 200;
  const cy = 200;
  const rInner = 64;
  const rOuter = 132;

  // 3 segmen 120 derajat dengan celah halus 4 derajat
  const segAssigned = buildChevronArcPath(cx, cy, rInner, rOuter, 152, 268, 13);
  const segPassed = buildChevronArcPath(cx, cy, rInner, rOuter, 272, 388, 13);
  const segPronun = buildChevronArcPath(cx, cy, rInner, rOuter, 32, 148, 13);

  const labelAssignedPos = polarToCartesian(cx, cy, 98, 212);
  const labelPassedPos = polarToCartesian(cx, cy, 98, 332);
  const labelPronunPos = polarToCartesian(cx, cy, 98, 92);

  return (
    <div className="min-h-[calc(100dvh-7.5rem)] flex flex-col items-center justify-center pb-24 pt-2 px-1">
      {/* Title */}
      <div className="text-center mb-3">
        <h1 className="text-[22px] font-extrabold tracking-[0.14em] uppercase text-[#F6F5F1]">
          Dashboard
        </h1>
        <p className="mt-0.5 text-[11px] font-medium text-teal-200/70">
          Ringkasan progres belajar vocket
        </p>
      </div>

      {isLoading ? (
        <div
          className="w-full max-w-[360px] flex flex-col items-center animate-pulse"
          aria-busy="true"
          aria-label="Memuat statistik dashboard"
        >
          {/* Pie Chart Skeleton */}
          <div className="w-full max-w-[300px] aspect-square flex items-center justify-center my-1">
            <svg viewBox="40 40 320 320" className="w-full h-auto overflow-visible">
              <circle
                cx={cx}
                cy={cy}
                r={142}
                fill="none"
                stroke="rgba(255,255,255,0.06)"
                strokeWidth="1.5"
                strokeDasharray="4 6"
              />
              <path d={segAssigned} fill="rgba(255,255,255,0.11)" />
              <path d={segPassed} fill="rgba(255,255,255,0.08)" />
              <path d={segPronun} fill="rgba(255,255,255,0.10)" />
              <circle
                cx={cx}
                cy={cy}
                r={58}
                fill="rgba(14,30,48,0.65)"
                stroke="rgba(255,255,255,0.08)"
                strokeWidth="2"
              />
              <rect x="176" y="186" width="48" height="28" rx="6" fill="rgba(255,255,255,0.12)" />
            </svg>
          </div>

          {/* Legend Cards Skeleton */}
          <div className="w-full mt-2 space-y-2.5 px-1">
            {[0, 1, 2].map((idx) => (
              <div
                key={idx}
                className="flex items-center gap-3 rounded-2xl bg-white/[0.06] border border-white/10 px-4 py-3"
              >
                <span className="h-3 w-3 rounded-full bg-white/20 shrink-0" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="h-3 w-28 rounded-md bg-white/15" />
                  <div className="h-2.5 w-44 rounded-md bg-white/10" />
                </div>
                <div className="h-5 w-10 rounded-md bg-white/15 shrink-0" />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* Main 3-Segment Interlocking Chevron Pie Chart */}
          <div className="w-full max-w-[300px] my-1">
            <svg
              viewBox="40 40 320 320"
              className="w-full h-auto overflow-visible drop-shadow-[0_18px_36px_rgba(0,0,0,0.35)]"
              role="img"
              aria-label="Pie chart statistik Vocket"
            >
              <defs>
                <linearGradient id="gradAssigned" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#FCD34D" />
                  <stop offset="100%" stopColor="#EAB308" />
                </linearGradient>
                <linearGradient id="gradPassed" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#38D9E8" />
                  <stop offset="100%" stopColor="#0EA5B7" />
                </linearGradient>
                <linearGradient id="gradPronun" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#A855F7" />
                  <stop offset="100%" stopColor="#7E22CE" />
                </linearGradient>
                <radialGradient id="gradCenter" cx="35%" cy="30%" r="75%">
                  <stop offset="0%" stopColor="#1B3654" />
                  <stop offset="100%" stopColor="#0E1E30" />
                </radialGradient>
                <filter id="softGlow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow
                    dx="0"
                    dy="4"
                    stdDeviation="5"
                    floodColor="#04120F"
                    floodOpacity="0.4"
                  />
                </filter>
              </defs>

              {/* Subtle ambient ring */}
              <circle
                cx={cx}
                cy={cy}
                r={142}
                fill="none"
                stroke="rgba(255,255,255,0.06)"
                strokeWidth="1.5"
                strokeDasharray="4 6"
              />

              {/* Segment 1: Total Assigned (Gold / Amber) */}
              <path d={segAssigned} fill="url(#gradAssigned)" filter="url(#softGlow)" />

              {/* Segment 2: Quiz Passed (Aqua Cyan) */}
              <path d={segPassed} fill="url(#gradPassed)" filter="url(#softGlow)" />

              {/* Segment 3: Pronunciation Avg Score (Violet) */}
              <path d={segPronun} fill="url(#gradPronun)" filter="url(#softGlow)" />

              {/* Center Medallion + Open Book Vector */}
              <circle
                cx={cx}
                cy={cy}
                r={58}
                fill="url(#gradCenter)"
                stroke="rgba(255,255,255,0.12)"
                strokeWidth="2"
              />
              <g transform="translate(200, 200)">
                {/* Shadow under book */}
                <ellipse cx="0" cy="22" rx="30" ry="7" fill="rgba(0,0,0,0.32)" />
                {/* Book cover base */}
                <path
                  d="M -32 8 L 0 21 L 32 8 L 28 -14 L 0 -3 L -28 -14 Z"
                  fill="#60A5FA"
                  opacity="0.35"
                />
                {/* Left page */}
                <path
                  d="M -2 -20 C -11 -22 -22 -18 -30 -10 L -26 11 C -18 5 -9 3 -1 12 Z"
                  fill="#F8FAFC"
                />
                {/* Right page */}
                <path
                  d="M 2 -20 C 11 -22 22 -18 30 -10 L 26 11 C 18 5 9 3 1 12 Z"
                  fill="#E2E8F0"
                />
                {/* Spine crease */}
                <path d="M 0 -19 L 0 12" stroke="#94A3B8" strokeWidth="1.6" />
                {/* Page text lines left */}
                <path
                  d="M -23 -8 L -7 -12 M -22 -2 L -7 -6 M -21 4 L -7 0"
                  stroke="#CBD5E1"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
                {/* Page text lines right */}
                <path
                  d="M 7 -12 L 23 -8 M 7 -6 L 22 -2 M 7 0 L 21 4"
                  stroke="#94A3B8"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </g>

              {/* Value 1: Total Assigned */}
              <text
                x={labelAssignedPos.x}
                y={labelAssignedPos.y + 8}
                textAnchor="middle"
                className="font-extrabold"
                style={{
                  fontFamily: '"Plus Jakarta Sans", sans-serif',
                  fontSize: '28px',
                  fill: '#18221F',
                  paintOrder: 'stroke',
                  stroke: 'rgba(255,255,255,0.72)',
                  strokeWidth: '3.5px',
                  strokeLinejoin: 'round'
                }}
              >
                {stats.totalAssigned}
              </text>

              {/* Value 2: Quiz Passed */}
              <text
                x={labelPassedPos.x}
                y={labelPassedPos.y + 8}
                textAnchor="middle"
                className="font-extrabold"
                style={{
                  fontFamily: '"Plus Jakarta Sans", sans-serif',
                  fontSize: '24px',
                  fill: '#0B221E',
                  paintOrder: 'stroke',
                  stroke: 'rgba(255,255,255,0.78)',
                  strokeWidth: '3.5px',
                  strokeLinejoin: 'round'
                }}
              >
                {stats.passedQuizzes}/{stats.totalQuizzes}
              </text>

              {/* Value 3: Pronunciation Avg */}
              <text
                x={labelPronunPos.x}
                y={labelPronunPos.y + 9}
                textAnchor="middle"
                className="font-extrabold"
                style={{
                  fontFamily: '"Plus Jakarta Sans", sans-serif',
                  fontSize: '28px',
                  fill: '#FFFFFF',
                  paintOrder: 'stroke',
                  stroke: 'rgba(24,14,44,0.65)',
                  strokeWidth: '3.5px',
                  strokeLinejoin: 'round'
                }}
              >
                {stats.avgPronunciation}
              </text>
            </svg>
          </div>

          {/* Harmonious Callout Legend Directly Paired with the 3 Pie Segments */}
          <div className="w-full max-w-[360px] mt-2 space-y-2.5 px-1">
            <div className="flex items-center gap-3 rounded-2xl bg-white/[0.06] border border-white/10 px-4 py-3 backdrop-blur-sm">
              <span className="h-3 w-3 rounded-full bg-[#F5C531] shrink-0 shadow-[0_0_10px_rgba(245,197,49,0.6)]" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-extrabold uppercase tracking-wider text-[#FCD34D]">
                  Total Assigned
                </p>
                <p className="text-[11px] text-teal-50/75 mt-0.5">
                  {stats.masteredWords} kata lulus &bull; Batch #{stats.activeBatch}
                </p>
              </div>
              <span className="font-mono text-lg font-extrabold text-white">
                {stats.totalAssigned}
              </span>
            </div>

            <div className="flex items-center gap-3 rounded-2xl bg-white/[0.06] border border-white/10 px-4 py-3 backdrop-blur-sm">
              <span className="h-3 w-3 rounded-full bg-[#22D3EE] shrink-0 shadow-[0_0_10px_rgba(34,211,238,0.6)]" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-extrabold uppercase tracking-wider text-[#38D9E8]">
                  Quiz Passed
                </p>
                <p className="text-[11px] text-teal-50/75 mt-0.5">
                  {stats.totalQuizzes > 0
                    ? `${stats.passedQuizzes} lulus dari ${stats.totalQuizzes} sesi kuis (min. 70%)`
                    : 'Belum ada sesi kuis diselesaikan'}
                </p>
              </div>
              <span className="font-mono text-lg font-extrabold text-white">
                {stats.passedQuizzes}/{stats.totalQuizzes}
              </span>
            </div>

            <div className="flex items-center gap-3 rounded-2xl bg-white/[0.06] border border-white/10 px-4 py-3 backdrop-blur-sm">
              <span className="h-3 w-3 rounded-full bg-[#A855F7] shrink-0 shadow-[0_0_10px_rgba(168,85,247,0.65)]" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-extrabold uppercase tracking-wider text-[#C084FC]">
                  Pronunciation Avg Score
                </p>
                <p className="text-[11px] text-teal-50/75 mt-0.5">
                  {stats.practicedCount > 0
                    ? `${stats.fluentCount} kata fasih (80+) dari ${stats.practicedCount} dilatih`
                    : 'Belum ada latihan pelafalan'}
                </p>
              </div>
              <span className="font-mono text-lg font-extrabold text-white">
                {stats.avgPronunciation}
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
