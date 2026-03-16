"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import GameWrapper from "@/components/games/GameWrapper";
import GameResult from "@/components/games/GameResult";
import useGameSession from "@/hooks/useGameSession";
import { getDifficultyConfig } from "@/utils/difficultyEngine";

const STORAGE_KEY = "stroop_difficulty";

const COLORS = [
  { name: "RED", tw: "bg-red-600", text: "text-red-500", hex: "#ef4444" },
  { name: "BLUE", tw: "bg-blue-600", text: "text-blue-500", hex: "#3b82f6" },
  { name: "GREEN", tw: "bg-green-600", text: "text-green-500", hex: "#22c55e" },
  { name: "YELLOW", tw: "bg-yellow-500", text: "text-yellow-400", hex: "#eab308" },
];

const FLANKER_WORDS = ["LEFT", "RIGHT", "UP", "DOWN", "STOP", "GO"];

function pickRandom(arr: typeof COLORS, exclude?: string) {
  const filtered = exclude != null ? arr.filter((x) => x.name !== exclude) : arr;
  return filtered[Math.floor(Math.random() * filtered.length)];
}

function generateItems(count: number, level: number) {
  const items: any[] = [];
  const allowSame = level >= 3;

  for (let i = 0; i < count; i++) {
    const inkColor = COLORS[Math.floor(Math.random() * COLORS.length)];
    let wordColor;

    if (allowSame && Math.random() < 0.2) {
      wordColor = inkColor;
    } else {
      wordColor = pickRandom(COLORS, inkColor.name);
    }

    const showFlankers = level >= 5;
    const flankers = showFlankers
      ? [
        FLANKER_WORDS[Math.floor(Math.random() * FLANKER_WORDS.length)],
        FLANKER_WORDS[Math.floor(Math.random() * FLANKER_WORDS.length)],
      ]
      : null;

    items.push({
      word: wordColor.name,
      inkColor,
      flankers,
    });
  }
  return items;
}

const DIRECTIONS = [
  { x: -120, y: 0 },
  { x: 120, y: 0 },
  { x: 0, y: -100 },
  { x: 0, y: 100 },
];

export default function InhibitionStroop() {
  const [difficulty, setDifficulty] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? Math.max(1, Math.min(5, Number(saved))) : 1;
  });
  const [phase, setPhase] = useState("ready");
  const [items, setItems] = useState<any[]>([]);
  const [current, setCurrent] = useState(0);
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState<any>(null);
  const [blank, setBlank] = useState(false);
  const [resultData, setResultData] = useState<any>(null);

  const itemShowTime = useRef(0);
  const feedbackTimer = useRef<any>(null);
  const blankTimer = useRef<any>(null);
  const dirRef = useRef(DIRECTIONS[0]);

  const config = useMemo(() => getDifficultyConfig("stroop", difficulty), [difficulty]);
  const session = useGameSession("stroop", "test-user");

  const wordCount = config.wordCount || 10;
  const timeLimit = config.timeLimit || 0;

  const startGame = useCallback(async () => {
    const gen = generateItems(wordCount, difficulty);
    setItems(gen);
    setCurrent(0);
    setScore(0);
    setFeedback(null);
    setBlank(false);
    setResultData(null);
    setPhase("playing");
    await session.startSession(difficulty);
    dirRef.current = DIRECTIONS[Math.floor(Math.random() * DIRECTIONS.length)];
    itemShowTime.current = Date.now();
  }, [wordCount, difficulty, session]);

  useEffect(
    () => () => {
      clearTimeout(feedbackTimer.current);
      clearTimeout(blankTimer.current);
    },
    []
  );

  const advance = useCallback(() => {
    const next = current + 1;
    if (next >= items.length) {
      finishGame();
    } else {
      setBlank(true);
      blankTimer.current = setTimeout(() => {
        setBlank(false);
        setCurrent(next);
        dirRef.current = DIRECTIONS[Math.floor(Math.random() * DIRECTIONS.length)];
        itemShowTime.current = Date.now();
      }, 500);
    }
  }, [current, items.length]);

  const handleAnswer = useCallback(
    (color: typeof COLORS[0]) => {
      if (feedback || blank) return;
      const rt = Date.now() - itemShowTime.current;
      const item = items[current];
      const correct = color.name === item.inkColor.name;

      session.recordAttempt(correct, rt);

      if (correct) {
        setScore((s) => s + 15);
        setFeedback({ type: "correct", color: color.name });
      } else {
        setFeedback({ type: "wrong", color: color.name });
      }

      feedbackTimer.current = setTimeout(() => {
        setFeedback(null);
        advance();
      }, correct ? 500 : 800);
    },
    [feedback, blank, items, current, session, advance]
  );

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

  const handleTimeUp = useCallback(() => {
    clearTimeout(feedbackTimer.current);
    clearTimeout(blankTimer.current);
    setFeedback(null);
    setBlank(false);
    finishGame();
  }, [finishGame]);

  const handlePlayAgain = useCallback(() => {
    if (resultData) setDifficulty(resultData.nextDifficulty);
    setPhase("ready");
  }, [resultData]);

  const handleGoHome = useCallback(() => window.history.back(), []);

  const runningAcc = useMemo(() => {
    const total = session.attempts;
    if (total === 0) return 100;
    return Math.round((session.correctCount / total) * 100);
  }, [session.attempts, session.correctCount]);

  if (phase === "ready") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-gray-950 flex items-center justify-center p-6">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center max-w-sm">
          <span className="text-7xl mb-4 block">🎨</span>
          <h1 className="text-4xl font-black text-white mb-2">Inhibition Stroop</h1>
          <p className="text-white/50 mb-1">Level: {config.label}</p>
          <div className="bg-white/5 rounded-xl p-4 mb-6 text-left space-y-1">
            <p className="text-white/40 text-sm">Pick the <span className="text-white font-semibold">INK COLOR</span>, not the word!</p>
            <p className="text-white/40 text-sm">{wordCount} items · {timeLimit > 0 ? `${timeLimit}s` : "No time limit"}</p>
          </div>
          <button onClick={startGame} className="bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-bold text-lg px-10 py-4 rounded-2xl transition-colors">
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
        gameType="stroop"
      />
    );
  }

  const item = items[current];
  const progress = items.length > 0 ? (current / items.length) * 100 : 0;

  return (
    <GameWrapper title="Inhibition Stroop" difficulty={difficulty} timeLimit={timeLimit} onTimeUp={handleTimeUp} onExit={handleGoHome} score={score}>
      <div className="flex items-center justify-between px-4 sm:px-6 pt-3">
        <div className="flex-1">
          <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
            <motion.div className="h-full bg-fuchsia-500 rounded-full" animate={{ width: `${progress}%` }} transition={{ duration: 0.3 }} />
          </div>
          <p className="text-white/40 text-xs mt-1">{current + 1} / {items.length}</p>
        </div>
        <span className={`ml-4 text-sm font-bold px-2.5 py-0.5 rounded-full ${runningAcc >= 80 ? "bg-green-500/20 text-green-400" : runningAcc >= 60 ? "bg-yellow-500/20 text-yellow-400" : "bg-red-500/20 text-red-400"
          }`}>
          {runningAcc}%
        </span>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-4 gap-8">
        <div className="h-40 flex items-center justify-center relative w-full">
          {blank ? (
            <div />
          ) : item ? (
            <AnimatePresence mode="wait">
              <motion.div
                key={current}
                initial={{ opacity: 0, x: dirRef.current.x, y: dirRef.current.y }}
                animate={{ opacity: 1, x: 0, y: 0 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ type: "spring", stiffness: 300, damping: 22 }}
                className="flex items-center gap-4"
              >
                {item.flankers && (
                  <span className="text-2xl font-bold text-white/10 select-none hidden sm:block">
                    {item.flankers[0]}
                  </span>
                )}
                <span
                  className="text-6xl sm:text-7xl font-black select-none tracking-wider"
                  style={{ color: item.inkColor.hex }}
                >
                  {item.word}
                </span>
                {item.flankers && (
                  <span className="text-2xl font-bold text-white/10 select-none hidden sm:block">
                    {item.flankers[1]}
                  </span>
                )}
              </motion.div>
            </AnimatePresence>
          ) : null}
        </div>

        <p className="text-white/30 text-sm">Tap the <span className="font-bold text-white/50">ink color</span></p>

        <div className="grid grid-cols-2 gap-3 w-full max-w-xs">
          {COLORS.map((color) => {
            const isCorrect = feedback?.type === "correct" && feedback.color === color.name;
            const isWrong = feedback?.type === "wrong" && feedback.color === color.name;
            const isAnswer = feedback?.type === "wrong" && item?.inkColor.name === color.name;

            let btnClass = `${color.tw} py-4 rounded-xl text-lg font-black text-white transition-all duration-150 `;

            if (isCorrect) {
              btnClass += "ring-4 ring-green-300 scale-105 brightness-125";
            } else if (isWrong) {
              btnClass += "ring-4 ring-red-400 brightness-75";
            } else if (isAnswer) {
              btnClass += "ring-2 ring-white/50";
            } else if (feedback) {
              btnClass += "opacity-40";
            } else {
              btnClass += "hover:brightness-110 active:scale-95 cursor-pointer";
            }

            return (
              <motion.button
                key={color.name}
                whileTap={!feedback ? { scale: 0.92 } : {}}
                animate={isWrong ? { x: [0, -8, 8, -6, 6, 0] } : {}}
                transition={isWrong ? { duration: 0.4 } : {}}
                onClick={() => handleAnswer(color)}
                disabled={!!feedback || blank}
                className={btnClass}
              >
                {color.name}
              </motion.button>
            );
          })}
        </div>

        <AnimatePresence>
          {feedback?.type === "correct" && (
            <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-green-400 font-bold text-xl">
              ✓ Correct! +15
            </motion.p>
          )}
          {feedback?.type === "wrong" && (
            <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-red-400 font-bold text-xl">
              ✗ It was {item?.inkColor.name}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </GameWrapper>
  );
}
