"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import GameWrapper from "@/components/games/GameWrapper";
import GameResult from "@/components/games/GameResult";
import useGameSession from "@/hooks/useGameSession";
import { getDifficultyConfig } from "@/utils/difficultyEngine";

const TOTAL_ROUNDS = 20;
const LIGHT_DURATION = 800;
const STORAGE_KEY = "nback_difficulty";

function generateSequence(gridSize: number, n: number, totalRounds: number) {
  const totalCells = gridSize * gridSize;
  const seq: number[] = [];
  const matchableRounds = totalRounds - n;
  const matchCount = Math.max(3, Math.floor(matchableRounds * 0.35));
  const matchRounds = new Set<number>();
  while (matchRounds.size < matchCount) {
    matchRounds.add(n + Math.floor(Math.random() * matchableRounds));
  }

  for (let i = 0; i < totalRounds; i++) {
    if (matchRounds.has(i) && i >= n) {
      seq.push(seq[i - n]);
    } else {
      let cell;
      do {
        cell = Math.floor(Math.random() * totalCells);
      } while (i >= n && cell === seq[i - n]);
      seq.push(cell);
    }
  }
  return { sequence: seq, matchSet: matchRounds };
}

export default function NBackChallenge() {
  const [difficulty, setDifficulty] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? Math.max(1, Math.min(5, Number(saved))) : 1;
  });
  const [phase, setPhase] = useState("ready");
  const [round, setRound] = useState(0);
  const [activeCell, setActiveCell] = useState(-1);
  const [score, setScore] = useState(0);
  const [hits, setHits] = useState(0);
  const [misses, setMisses] = useState(0);
  const [falseAlarms, setFalseAlarms] = useState(0);
  const [correctRejections, setCorrectRejections] = useState(0);
  const [responded, setResponded] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [resultData, setResultData] = useState<any>(null);

  const seqRef = useRef({ sequence: [] as number[], matchSet: new Set<number>() });
  const roundTimerRef = useRef<any>(null);
  const lightTimerRef = useRef<any>(null);
  const roundStartRef = useRef(0);

  const config = useMemo(() => getDifficultyConfig("nback", difficulty), [difficulty]);
  const session = useGameSession("nback", "test-user");

  const n = config.n;
  const gridSize = config.gridSize;
  const intervalMs = config.intervalMs;
  const showHints = difficulty <= 2;

  const startGame = useCallback(async () => {
    const { sequence, matchSet } = generateSequence(gridSize, n, TOTAL_ROUNDS);
    seqRef.current = { sequence, matchSet };
    setRound(0);
    setActiveCell(-1);
    setScore(0);
    setHits(0);
    setMisses(0);
    setFalseAlarms(0);
    setCorrectRejections(0);
    setResponded(false);
    setFeedback(null);
    setResultData(null);
    setPhase("playing");
    await session.startSession(difficulty);
  }, [gridSize, n, difficulty, session]);

  useEffect(() => {
    if (phase !== "playing") return;
    if (round >= TOTAL_ROUNDS) {
      finishGame();
      return;
    }

    const { sequence } = seqRef.current;
    const cell = sequence[round];

    setActiveCell(cell);
    setResponded(false);
    setFeedback(null);
    roundStartRef.current = Date.now();

    lightTimerRef.current = setTimeout(() => setActiveCell(-1), LIGHT_DURATION);

    roundTimerRef.current = setTimeout(() => {
      evaluateRound();
    }, intervalMs);

    return () => {
      clearTimeout(lightTimerRef.current);
      clearTimeout(roundTimerRef.current);
    };
  }, [phase, round]);

  const evaluateRound = useCallback(() => {
    const { matchSet } = seqRef.current;
    const isMatch = matchSet.has(round) && round >= n;

    setResponded((prev) => {
      if (!prev) {
        if (isMatch) {
          setMisses((m) => m + 1);
          setFeedback("miss");
          session.recordAttempt(false, intervalMs);
        } else {
          setCorrectRejections((cr) => cr + 1);
          setScore((s) => s + 5);
          session.recordAttempt(true, intervalMs);
        }
      }
      return prev;
    });

    setTimeout(() => {
      setFeedback(null);
      setRound((r) => r + 1);
    }, 350);
  }, [round, n, intervalMs, session]);

  const handleMatch = useCallback(() => {
    if (phase !== "playing" || responded || round < n) return;
    setResponded(true);

    const rt = Date.now() - roundStartRef.current;
    const { matchSet } = seqRef.current;
    const isMatch = matchSet.has(round);

    if (isMatch) {
      setHits((h) => h + 1);
      setScore((s) => s + 15);
      setFeedback("hit");
      session.recordAttempt(true, rt);
    } else {
      setFalseAlarms((f) => f + 1);
      setScore((s) => Math.max(0, s - 10));
      setFeedback("false");
      session.recordAttempt(false, rt);
    }
  }, [phase, responded, round, n, session]);

  const finishGame = useCallback(async () => {
    setPhase("result");
    const result = await session.endSession();
    const next = result?.nextDifficulty ?? difficulty;
    localStorage.setItem(STORAGE_KEY, String(next));
    setResultData({
      score,
      accuracy: session.accuracy,
      avgReactionTime: session.avgReactionTime,
      nextDifficulty: next,
      currentDifficulty: difficulty,
    });
  }, [session, difficulty, score]);

  const handlePlayAgain = useCallback(() => {
    if (resultData) setDifficulty(resultData.nextDifficulty);
    setPhase("ready");
  }, [resultData]);

  const handleGoHome = useCallback(() => window.history.back(), []);

  const ghostCells = useMemo(() => {
    if (!showHints || round < 1) return [];
    const { sequence } = seqRef.current;
    const ghosts: number[] = [];
    for (let i = Math.max(0, round - n); i < round; i++) {
      ghosts.push(sequence[i]);
    }
    return ghosts;
  }, [showHints, round, n]);

  if (phase === "ready") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-gray-950 flex items-center justify-center p-6">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center max-w-sm">
          <span className="text-7xl mb-4 block">🧠</span>
          <h1 className="text-4xl font-black text-white mb-2">N-Back Challenge</h1>
          <p className="text-white/50 mb-1">Level: {config.label}</p>
          <div className="bg-white/5 rounded-xl p-4 mb-6 text-left space-y-1">
            <p className="text-cyan-400 font-semibold">N = {n}</p>
            <p className="text-white/40 text-sm">Grid: {gridSize}×{gridSize} · Pace: {intervalMs}ms</p>
            <p className="text-white/40 text-sm">{TOTAL_ROUNDS} rounds · Press MATCH if the cell matches {n} step{n > 1 ? "s" : ""} back</p>
            {showHints && <p className="text-yellow-400/70 text-xs mt-1">💡 Ghost hints enabled</p>}
          </div>
          <button onClick={startGame} className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-lg px-10 py-4 rounded-2xl transition-colors">
            Start →
          </button>
        </motion.div>
      </div>
    );
  }

  if (phase === "result" && resultData) {
    return (
      <GameResult
        score={resultData.score}
        accuracy={resultData.accuracy}
        avgReactionTime={resultData.avgReactionTime}
        nextDifficulty={resultData.nextDifficulty}
        currentDifficulty={resultData.currentDifficulty}
        onPlayAgain={handlePlayAgain}
        onGoHome={handleGoHome}
        gameType="nback"
      />
    );
  }

  const totalCells = gridSize * gridSize;

  return (
    <GameWrapper title="N-Back Challenge" difficulty={difficulty} timeLimit={0} onTimeUp={() => { }} onExit={handleGoHome} score={score}>
      <div className="flex items-center justify-between px-4 sm:px-6 pt-3">
        <span className="text-white/40 text-sm">Round {Math.min(round + 1, TOTAL_ROUNDS)}/{TOTAL_ROUNDS}</span>
        <span className="bg-cyan-600/20 text-cyan-400 text-sm font-bold px-3 py-1 rounded-full ring-1 ring-cyan-500/30">
          N = {n}
        </span>
      </div>

      <div className="px-4 sm:px-6 pt-2">
        <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-cyan-500 rounded-full"
            animate={{ width: `${(round / TOTAL_ROUNDS) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-4 gap-6">
        <div
          className="grid gap-2 sm:gap-3"
          style={{
            gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))`,
            width: `min(${gridSize * 80}px, 90vw)`,
          }}
        >
          {Array.from({ length: totalCells }).map((_, i) => {
            const isActive = i === activeCell;
            const isGhost = ghostCells.includes(i);

            return (
              <motion.div
                key={i}
                animate={
                  isActive
                    ? { backgroundColor: "rgb(6 182 212)", boxShadow: "0 0 24px 6px rgba(6,182,212,0.5)" }
                    : { backgroundColor: "rgba(255,255,255,0.06)", boxShadow: "0 0 0 0 transparent" }
                }
                transition={{ duration: 0.2 }}
                className={`aspect-square rounded-xl relative ${isGhost && !isActive ? "ring-1 ring-cyan-500/20" : ""
                  }`}
              >
                {isGhost && !isActive && (
                  <div className="absolute inset-0 rounded-xl bg-cyan-500/10" />
                )}
              </motion.div>
            );
          })}
        </div>

        <div className="flex flex-col items-center gap-3">
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={handleMatch}
            disabled={responded || round < n}
            className={`px-12 py-5 rounded-2xl text-xl font-black transition-all duration-200 ${responded
                ? feedback === "hit"
                  ? "bg-green-600 text-white"
                  : feedback === "false"
                    ? "bg-red-600 text-white"
                    : "bg-white/10 text-white/30"
                : round < n
                  ? "bg-white/5 text-white/20 cursor-not-allowed"
                  : "bg-cyan-600 text-white hover:bg-cyan-500 active:bg-cyan-700 cursor-pointer"
              }`}
          >
            {responded
              ? feedback === "hit"
                ? "✓ Match!"
                : "✗ No match"
              : "MATCH"}
          </motion.button>

          {round < n && (
            <p className="text-white/30 text-sm">Wait {n - round} more round{n - round > 1 ? "s" : ""}…</p>
          )}
        </div>

        <AnimatePresence>
          {feedback === "hit" && (
            <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-green-400 font-bold">
              ✓ Correct match! +15
            </motion.p>
          )}
          {feedback === "false" && (
            <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-red-400 font-bold">
              ✗ False alarm −10
            </motion.p>
          )}
          {feedback === "miss" && (
            <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-orange-400 font-bold">
              Missed a match!
            </motion.p>
          )}
          {feedback === "reject" && (
            <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-white/50 font-medium">
              Correct skip +5
            </motion.p>
          )}
        </AnimatePresence>

        <div className="flex gap-4 text-sm">
          <span className="text-green-400">Hits {hits}</span>
          <span className="text-orange-400">Misses {misses}</span>
          <span className="text-red-400">False {falseAlarms}</span>
        </div>
      </div>
    </GameWrapper>
  );
}
