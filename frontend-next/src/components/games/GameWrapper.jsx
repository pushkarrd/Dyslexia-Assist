import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { DIFFICULTY_LABELS } from "../../utils/difficultyEngine";

const DIFF_COLORS = {
  1: "bg-green-500",
  2: "bg-emerald-500",
  3: "bg-yellow-500",
  4: "bg-orange-500",
  5: "bg-red-500",
};

const TIMER_COLOR = (pct) =>
  pct > 0.5 ? "bg-green-500" : pct > 0.25 ? "bg-yellow-500" : "bg-red-500";

export default function GameWrapper({
  title,
  difficulty = 1,
  timeLimit = 0,
  onTimeUp,
  onExit,
  score = 0,
  lives = null,
  children,
}) {
  const [remaining, setRemaining] = useState(timeLimit);
  const prevScore = useRef(score);
  const [scorePopups, setScorePopups] = useState([]);
  const popupId = useRef(0);

  // Countdown timer
  useEffect(() => {
    if (timeLimit <= 0) return;
    setRemaining(timeLimit);
  }, [timeLimit]);

  useEffect(() => {
    if (timeLimit <= 0 || remaining <= 0) return;
    const id = setInterval(() => {
      setRemaining((r) => {
        const next = r - 1;
        if (next <= 0) {
          clearInterval(id);
          onTimeUp?.();
          return 0;
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [timeLimit, onTimeUp]);

  // +score popup on score increase
  useEffect(() => {
    const diff = score - prevScore.current;
    if (diff > 0) {
      const id = ++popupId.current;
      setScorePopups((p) => [...p, { id, value: diff }]);
      setTimeout(() => {
        setScorePopups((p) => p.filter((item) => item.id !== id));
      }, 900);
    }
    prevScore.current = score;
  }, [score]);

  const pct = timeLimit > 0 ? remaining / timeLimit : 1;
  const diffLabel = DIFFICULTY_LABELS[difficulty] || `Lv ${difficulty}`;
  const diffColor = DIFF_COLORS[difficulty] || "bg-gray-500";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-gray-950 flex flex-col"
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 sm:px-6">
        {/* Exit */}
        <button
          onClick={onExit}
          className="text-white/70 hover:text-white transition-colors p-2 -ml-2 rounded-lg hover:bg-white/10"
          aria-label="Exit game"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* Title + difficulty */}
        <div className="flex items-center gap-2">
          <h1 className="text-white font-bold text-lg sm:text-xl truncate max-w-[180px] sm:max-w-none">
            {title}
          </h1>
          <span
            className={`${diffColor} text-white text-xs font-semibold px-2.5 py-0.5 rounded-full whitespace-nowrap`}
          >
            {diffLabel}
          </span>
        </div>

        {/* Score + lives */}
        <div className="flex items-center gap-3">
          {lives != null && (
            <div className="flex gap-0.5">
              {Array.from({ length: lives }).map((_, i) => (
                <span key={i} className="text-red-500 text-lg">
                  ♥
                </span>
              ))}
            </div>
          )}
          <div className="relative">
            <span className="text-white font-bold text-lg tabular-nums">{score}</span>
            <AnimatePresence>
              {scorePopups.map((p) => (
                <motion.span
                  key={p.id}
                  initial={{ opacity: 1, y: 0 }}
                  animate={{ opacity: 0, y: -28 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.8 }}
                  className="absolute -top-1 left-1/2 -translate-x-1/2 text-green-400 font-bold text-sm pointer-events-none"
                >
                  +{p.value}
                </motion.span>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Timer bar */}
      {timeLimit > 0 && (
        <div className="w-full h-1.5 bg-white/10">
          <motion.div
            className={`h-full ${TIMER_COLOR(pct)} rounded-r-full`}
            initial={{ width: "100%" }}
            animate={{ width: `${pct * 100}%` }}
            transition={{ duration: 0.4, ease: "linear" }}
          />
        </div>
      )}

      {/* Game content */}
      <div className="flex-1 flex flex-col">{children}</div>
    </motion.div>
  );
}