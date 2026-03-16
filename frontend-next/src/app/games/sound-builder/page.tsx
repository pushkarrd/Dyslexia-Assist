"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import GameWrapper from "@/components/games/GameWrapper";
import GameResult from "@/components/games/GameResult";
import useGameSession from "@/hooks/useGameSession";
import { getDifficultyConfig } from "@/utils/difficultyEngine";

const WORD_BANK = [
  { word: "cat", emoji: "🐱" },
  { word: "bat", emoji: "🦇" },
  { word: "hit", emoji: "👊" },
  { word: "sit", emoji: "🪑" },
  { word: "run", emoji: "🏃" },
  { word: "fun", emoji: "🎉" },
  { word: "big", emoji: "🐘" },
  { word: "dig", emoji: "⛏️" },
  { word: "hop", emoji: "🐇" },
  { word: "mop", emoji: "🧹" },
  { word: "red", emoji: "🔴" },
  { word: "bed", emoji: "🛏️" },
  { word: "cup", emoji: "☕" },
  { word: "pup", emoji: "🐶" },
  { word: "fish", emoji: "🐟" },
  { word: "wish", emoji: "⭐" },
  { word: "ship", emoji: "🚢" },
  { word: "chip", emoji: "🍟" },
];

const ALL_LETTERS = "abcdefghijklmnopqrstuvwxyz".split("");

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

let audioCtx: any = null;
function getAudioCtx() {
  if (!audioCtx) audioCtx = new ((window as any).AudioContext || (window as any).webkitAudioContext)();
  return audioCtx;
}

function playTone(freq: number, duration = 0.1) {
  try {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.value = 0.15;
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch { }
}

function buildRound(entry: { word: string; emoji: string }, distractorCount: number) {
  const { word, emoji } = entry;
  const blankIdx = Math.floor(Math.random() * word.length);
  const missing = word[blankIdx];
  const distractors = shuffle(
    ALL_LETTERS.filter((l) => l !== missing)
  ).slice(0, distractorCount);
  const tiles = shuffle([missing, ...distractors]);
  return { word, emoji, blankIdx, missing, tiles };
}

const STORAGE_KEY = "sound_builder_difficulty";
const TOTAL_ROUNDS = 10;

export default function SoundBuilder() {
  const [difficulty, setDifficulty] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? Math.max(1, Math.min(5, Number(saved))) : 1;
  });
  const [phase, setPhase] = useState("ready");
  const [rounds, setRounds] = useState<any[]>([]);
  const [current, setCurrent] = useState(0);
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [resultData, setResultData] = useState<any>(null);
  const [dragOverBlank, setDragOverBlank] = useState(false);

  const itemShowTime = useRef(0);
  const feedbackTimer = useRef<any>(null);

  const config = useMemo(() => getDifficultyConfig("sound_builder", difficulty), [difficulty]);
  const session = useGameSession("sound_builder", "test-user");

  const generateRounds = useCallback(() => {
    const maxLen = config.wordLength || 4;
    const pool = WORD_BANK.filter((w) => w.word.length <= maxLen);
    const picked = shuffle(pool.length >= TOTAL_ROUNDS ? pool : [...pool, ...pool]).slice(0, TOTAL_ROUNDS);
    return picked.map((entry) => buildRound(entry, config.distractors || 2));
  }, [config]);

  const startGame = useCallback(async () => {
    const r = generateRounds();
    setRounds(r);
    setCurrent(0);
    setScore(0);
    setFeedback(null);
    setResultData(null);
    setPhase("playing");
    await session.startSession(difficulty);
    itemShowTime.current = Date.now();
  }, [generateRounds, difficulty, session]);

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

  useEffect(() => () => { if (feedbackTimer.current) clearTimeout(feedbackTimer.current); }, []);

  const advance = useCallback(() => {
    const next = current + 1;
    if (next >= rounds.length) {
      finishGame();
    } else {
      setCurrent(next);
      itemShowTime.current = Date.now();
    }
  }, [current, rounds.length, finishGame]);

  const handleSelect = useCallback(
    (letter: string) => {
      if (feedback) return;
      const rt = Date.now() - itemShowTime.current;
      const round = rounds[current];
      const correct = letter === round.missing;

      session.recordAttempt(correct, rt);

      if (correct) {
        playTone(440, 0.1);
        setScore((s) => s + 20);
        setFeedback("correct");
      } else {
        playTone(220, 0.1);
        setFeedback("wrong");
      }

      feedbackTimer.current = setTimeout(() => {
        setFeedback(null);
        advance();
      }, correct ? 700 : 1100);
    },
    [feedback, rounds, current, session, advance]
  );

  const onDragStart = (e: React.DragEvent, letter: string) => {
    e.dataTransfer.setData("text/plain", letter);
    e.dataTransfer.effectAllowed = "move";
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverBlank(true);
  };

  const onDragLeave = () => setDragOverBlank(false);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverBlank(false);
    const letter = e.dataTransfer.getData("text/plain");
    if (letter) handleSelect(letter);
  };

  const handleTimeUp = useCallback(() => {
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    setFeedback(null);
    finishGame();
  }, [finishGame]);

  const handlePlayAgain = useCallback(() => {
    if (resultData) setDifficulty(resultData.nextDifficulty);
    setPhase("ready");
  }, [resultData]);

  const handleGoHome = useCallback(() => window.history.back(), []);

  if (phase === "ready") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-gray-950 flex items-center justify-center p-6">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center max-w-sm">
          <span className="text-7xl mb-4 block">🔤</span>
          <h1 className="text-4xl font-black text-white mb-2">Sound Builder</h1>
          <p className="text-white/50 mb-1">Level: {config.label}</p>
          <p className="text-white/40 text-sm mb-6">
            Fill the missing letter in {TOTAL_ROUNDS} words
            {config.hintEnabled && " · Hints ON"}
          </p>
          <button
            onClick={startGame}
            className="bg-violet-600 hover:bg-violet-500 text-white font-bold text-lg px-10 py-4 rounded-2xl transition-colors"
          >
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
        gameType="sound_builder"
      />
    );
  }

  const round = rounds[current];
  if (!round) return null;
  const progress = rounds.length > 0 ? (current / rounds.length) * 100 : 0;
  const wordLetters = round.word.split("");

  return (
    <GameWrapper
      title="Sound Builder"
      difficulty={difficulty}
      timeLimit={config.timeLimit || 0}
      onTimeUp={handleTimeUp}
      onExit={handleGoHome}
      score={score}
    >
      <div className="px-4 sm:px-6 pt-3">
        <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
          <motion.div className="h-full bg-violet-500 rounded-full" animate={{ width: `${progress}%` }} transition={{ duration: 0.3 }} />
        </div>
        <p className="text-white/40 text-xs mt-1 text-right">{current + 1} / {rounds.length}</p>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-4 gap-6">
        {config.hintEnabled && (
          <motion.span
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-6xl"
          >
            {round.emoji}
          </motion.span>
        )}

        <AnimatePresence mode="wait">
          <motion.div
            key={current}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.25 }}
            className="flex items-center justify-center gap-1"
          >
            {wordLetters.map((letter: string, i: number) => {
              const isBlank = i === round.blankIdx;
              const filled = isBlank && feedback === "correct";
              const wrong = isBlank && feedback === "wrong";

              if (isBlank) {
                return (
                  <div
                    key={i}
                    onDragOver={onDragOver}
                    onDragLeave={onDragLeave}
                    onDrop={onDrop}
                    className={`w-14 h-16 sm:w-16 sm:h-20 rounded-xl border-2 border-dashed flex items-center justify-center text-3xl sm:text-4xl font-black transition-all duration-200 ${filled
                        ? "bg-green-600/30 border-green-400 text-green-300"
                        : wrong
                          ? "bg-red-600/30 border-red-400 text-red-300"
                          : dragOverBlank
                            ? "bg-violet-600/30 border-violet-400 scale-110"
                            : "bg-white/5 border-violet-500/60 text-violet-400"
                      }`}
                  >
                    {filled ? round.missing : wrong ? round.missing : "___"}
                  </div>
                );
              }

              return (
                <span
                  key={i}
                  className="w-14 h-16 sm:w-16 sm:h-20 rounded-xl bg-white/10 flex items-center justify-center text-3xl sm:text-4xl font-black text-white"
                >
                  {letter}
                </span>
              );
            })}
          </motion.div>
        </AnimatePresence>

        <AnimatePresence>
          {feedback === "correct" && (
            <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-green-400 font-bold text-xl">
              ✓ Nice! +20
            </motion.p>
          )}
          {feedback === "wrong" && (
            <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-red-400 font-bold text-xl">
              ✗ The missing letter was &quot;{round.missing}&quot;
            </motion.p>
          )}
        </AnimatePresence>

        <div className="flex flex-wrap justify-center gap-3 mt-2">
          {round.tiles.map((letter: string, i: number) => (
            <motion.div
              key={`${current}-${i}`}
              draggable={!feedback}
              onDragStart={(e: any) => onDragStart(e, letter)}
              onClick={() => handleSelect(letter)}
              whileTap={!feedback ? { scale: 0.9 } : {}}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06, type: "spring", stiffness: 300, damping: 20 }}
              className={`w-14 h-14 sm:w-16 sm:h-16 rounded-xl flex items-center justify-center text-2xl sm:text-3xl font-black select-none transition-colors duration-200 ${feedback
                  ? letter === round.missing
                    ? "bg-green-600 text-white ring-2 ring-green-400"
                    : "bg-white/5 text-white/20"
                  : "bg-indigo-600 text-white cursor-grab active:cursor-grabbing hover:bg-indigo-500"
                }`}
            >
              {letter}
            </motion.div>
          ))}
        </div>
      </div>
    </GameWrapper>
  );
}
