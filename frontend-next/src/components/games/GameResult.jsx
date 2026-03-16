import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { DIFFICULTY_LABELS } from "../../utils/difficultyEngine";

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.15, delayChildren: 0.3 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
};

function AnimatedCounter({ target, duration = 1200 }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    if (target <= 0) { setDisplay(0); return; }
    const start = performance.now();
    let raf;
    const tick = (now) => {
      const t = Math.min((now - start) / duration, 1);
      setDisplay(Math.round(t * target));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return <>{display}</>;
}

function Stars({ count }) {
  return (
    <div className="flex justify-center gap-1 mb-2">
      {[1, 2, 3].map((i) => (
        <motion.span
          key={i}
          initial={{ scale: 0, rotate: -45 }}
          animate={i <= count ? { scale: 1, rotate: 0 } : { scale: 1, rotate: 0 }}
          transition={{ delay: 0.6 + i * 0.18, type: "spring", stiffness: 260, damping: 14 }}
          className={`text-4xl sm:text-5xl ${i <= count ? "grayscale-0" : "grayscale opacity-30"}`}
        >
          ⭐
        </motion.span>
      ))}
    </div>
  );
}

export default function GameResult({
  score = 0,
  accuracy = 0,
  avgReactionTime = 0,
  nextDifficulty = 1,
  currentDifficulty = 1,
  onPlayAgain,
  onGoHome,
  gameType,
}) {
  const accPct = Math.round(accuracy * 100);
  const stars = accPct >= 85 ? 3 : accPct >= 60 ? 2 : 1;
  const accColor =
    accPct >= 80 ? "bg-green-500/20 text-green-400 ring-green-500/40"
    : accPct >= 60 ? "bg-yellow-500/20 text-yellow-400 ring-yellow-500/40"
    : "bg-red-500/20 text-red-400 ring-red-500/40";

  const leveledUp = nextDifficulty > currentDifficulty;
  const leveledDown = nextDifficulty < currentDifficulty;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      >
        <motion.div
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 240, damping: 22 }}
          className="w-full max-w-sm bg-gradient-to-b from-slate-800 to-slate-900 rounded-3xl p-6 sm:p-8 shadow-2xl ring-1 ring-white/10"
        >
          <motion.div variants={stagger} initial="hidden" animate="show">
            {/* Stars */}
            <motion.div variants={fadeUp}>
              <Stars count={stars} />
            </motion.div>

            {/* Score */}
            <motion.div variants={fadeUp} className="text-center mb-5">
              <p className="text-white/50 text-sm uppercase tracking-wider mb-1">Score</p>
              <p className="text-5xl sm:text-6xl font-black text-white tabular-nums">
                <AnimatedCounter target={score} />
              </p>
            </motion.div>

            {/* Level banner */}
            {(leveledUp || leveledDown) && (
              <motion.div
                variants={fadeUp}
                className={`text-center rounded-xl py-2 px-4 mb-5 ${
                  leveledUp
                    ? "bg-green-500/15 ring-1 ring-green-500/30"
                    : "bg-orange-500/15 ring-1 ring-orange-500/30"
                }`}
              >
                <p className={`font-bold text-lg ${leveledUp ? "text-green-400" : "text-orange-400"}`}>
                  {leveledUp ? "Level Up! 🎉" : "Keep practicing 💪"}
                </p>
                <p className="text-white/50 text-xs mt-0.5">
                  {DIFFICULTY_LABELS[currentDifficulty]} → {DIFFICULTY_LABELS[nextDifficulty]}
                </p>
              </motion.div>
            )}

            {/* Stats row */}
            <motion.div variants={fadeUp} className="grid grid-cols-2 gap-3 mb-6">
              {/* Accuracy */}
              <div className="bg-white/5 rounded-xl p-3 text-center">
                <p className="text-white/40 text-xs uppercase mb-1">Accuracy</p>
                <span className={`inline-block text-xl font-bold px-3 py-0.5 rounded-full ring-1 ${accColor}`}>
                  {accPct}%
                </span>
              </div>

              {/* Reaction time */}
              <div className="bg-white/5 rounded-xl p-3 text-center">
                <p className="text-white/40 text-xs uppercase mb-1">Avg Speed</p>
                <p className="text-xl font-bold text-cyan-400">{avgReactionTime}<span className="text-sm font-normal text-white/40"> ms</span></p>
              </div>
            </motion.div>

            {/* Buttons */}
            <motion.div variants={fadeUp} className="flex flex-col gap-3">
              <button
                onClick={onPlayAgain}
                className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-base transition-colors"
              >
                Play Again
              </button>
              <button
                onClick={onGoHome}
                className="w-full py-3 rounded-xl bg-white/10 hover:bg-white/15 text-white/70 font-medium text-base transition-colors"
              >
                Back to Dashboard
              </button>
            </motion.div>
          </motion.div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}