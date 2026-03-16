"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/services/firebase";
import { logQuizAttempt } from "@/services/progressService";

// ══════════════════════════════════════════════════════════════════════════════
// ── Types & Interfaces ──
// ══════════════════════════════════════════════════════════════════════════════

type GamePhase = "intro" | "playing" | "result";

interface LetterColor {
  bg: string;
  ring: string;
  hex: string;
}

interface FallingLetter {
  id: number;
  letter: string;
  x: number;
  y: number;
  speed: number;
  isCorrectNext: boolean;
  isDecoy: boolean;
  color: LetterColor;
  removing: boolean;
  hitType: "hit" | "miss" | null;
  removeAt?: number;
}

interface HitEffect {
  id: number;
  type: "hit" | "miss";
}

interface DifficultyConfig {
  fallSpeed: number;
  spawnInterval: number;
  maxLettersOnScreen: number;
  decoyCount: number;
  timeLimit: number;
}

interface GameSessionData {
  user_id: string;
  game_type: string;
  level: number;
  score: number;
  words_completed: number;
  accuracy: number;
  timestamp: string;
}

// ══════════════════════════════════════════════════════════════════════════════
// ── Constants ──
// ══════════════════════════════════════════════════════════════════════════════

const WORD_BANK: Record<number, string[]> = {
  1: ["CAT", "DOG", "HAT", "BIG", "RUN", "SIT", "FUN", "PEN"],
  2: ["FROG", "SHIP", "PLAN", "CLAP", "DRUM", "FLIP", "GRIN"],
  3: ["BREAD", "TRAIN", "CLOUD", "PLANT", "SHOUT", "CRISP"],
  4: ["BRIDGE", "FLIGHT", "STRONG", "CHROME", "SPLASH"],
  5: ["THROUGH", "SCRATCH", "BROUGHT", "THOUGHT", "STRETCH"],
};

const LETTER_COLORS: LetterColor[] = [
  { bg: "bg-indigo-500", ring: "ring-indigo-400", hex: "#6366f1" },
  { bg: "bg-rose-500", ring: "ring-rose-400", hex: "#f43f5e" },
  { bg: "bg-amber-500", ring: "ring-amber-400", hex: "#f59e0b" },
  { bg: "bg-emerald-500", ring: "ring-emerald-400", hex: "#10b981" },
  { bg: "bg-violet-500", ring: "ring-violet-400", hex: "#8b5cf6" },
  { bg: "bg-sky-500", ring: "ring-sky-400", hex: "#0ea5e9" },
  { bg: "bg-orange-500", ring: "ring-orange-400", hex: "#f97316" },
];

const ALL_LETTERS: string = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

// ══════════════════════════════════════════════════════════════════════════════
// ── Helper Functions ──
// ══════════════════════════════════════════════════════════════════════════════

let nextId = 0;
function uid(): number {
  return ++nextId;
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickRandomColor(): LetterColor {
  return LETTER_COLORS[Math.floor(Math.random() * LETTER_COLORS.length)];
}

function randomX(existingLetters: FallingLetter[]): number {
  const MIN_GAP = 12; // minimum % gap between letter centers
  for (let attempt = 0; attempt < 20; attempt++) {
    const x = 5 + Math.random() * 85;
    const tooClose = existingLetters.some(
      (l) => l.y < 30 && Math.abs(l.x - x) < MIN_GAP
    );
    if (!tooClose) return x;
  }
  return 5 + Math.random() * 85;
}

function getDifficultyConfig(level: number): DifficultyConfig {
  return {
    fallSpeed: 0.15 + level * 0.08,
    spawnInterval: Math.max(400, 1200 - level * 150),
    maxLettersOnScreen: Math.min(12, 6 + level),
    decoyCount: 2 + level,
    timeLimit: 30,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// ── CSS Keyframes ──
// ══════════════════════════════════════════════════════════════════════════════

const GAME_STYLES = `
@keyframes hitBurst {
  0%   { transform: scale(1);   opacity: 1; }
  50%  { transform: scale(1.6); opacity: 0.8; }
  100% { transform: scale(0);   opacity: 0; }
}

@keyframes missTap {
  0%, 100% { transform: translateX(0); }
  25%      { transform: translateX(-8px); }
  75%      { transform: translateX(8px); }
}

@keyframes wordComplete {
  0%   { transform: scale(1);    }
  50%  { transform: scale(1.3);  color: #22c55e; }
  100% { transform: scale(1);    }
}

@keyframes correctPulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(99,102,241,0.7); }
  50%      { box-shadow: 0 0 0 12px rgba(99,102,241,0); }
}

@keyframes comboPop {
  0%   { transform: scale(0.5) translateY(10px); opacity: 0; }
  30%  { transform: scale(1.15) translateY(0); opacity: 1; }
  100% { transform: scale(1) translateY(0); opacity: 1; }
}

@keyframes introFall {
  0%   { transform: translateY(-40px); opacity: 0; }
  60%  { opacity: 1; }
  100% { transform: translateY(120px); opacity: 0; }
}

@keyframes screenShake {
  0%, 100% { transform: translateX(0); }
  20%      { transform: translateX(-4px); }
  40%      { transform: translateX(4px); }
  60%      { transform: translateX(-3px); }
  80%      { transform: translateX(3px); }
}

@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(-6px); }
}

@keyframes fadeSlideUp {
  0%   { opacity: 0; transform: translateY(20px); }
  100% { opacity: 1; transform: translateY(0); }
}

.letter-hit {
  animation: hitBurst 0.4s ease-out forwards;
}

.letter-miss {
  animation: missTap 0.35s ease-in-out;
}

.word-complete-anim {
  animation: wordComplete 0.5s ease-in-out;
}

.correct-pulse {
  animation: correctPulse 1.2s ease-in-out infinite;
}

.combo-pop {
  animation: comboPop 0.3s ease-out;
}

.screen-shake {
  animation: screenShake 0.4s ease-in-out;
}

.bounce-anim {
  animation: bounce 0.6s ease-in-out infinite;
}

.intro-letter-fall {
  animation: introFall 3s ease-in infinite;
}

.fade-slide-up {
  animation: fadeSlideUp 0.4s ease-out;
}
`;

// ══════════════════════════════════════════════════════════════════════════════
// ── Main Component ──
// ══════════════════════════════════════════════════════════════════════════════

export default function ClapTrap() {
  const router = useRouter();

  // ── State ──
  const [gamePhase, setGamePhase] = useState<GamePhase>("intro");
  const [targetWord, setTargetWord] = useState<string>("");
  const [letterIndex, setLetterIndex] = useState<number>(0);
  const [fallingLetters, setFallingLetters] = useState<FallingLetter[]>([]);
  const [score, setScore] = useState<number>(0);
  const [lives, setLives] = useState<number>(3);
  const [level, setLevel] = useState<number>(1);
  const [combo, setCombo] = useState<number>(0);
  const [hitEffect, setHitEffect] = useState<HitEffect | null>(null);
  const [wordComplete, setWordComplete] = useState<boolean>(false);
  const [timeLeft, setTimeLeft] = useState<number>(30);
  const [wordsCompleted, setWordsCompleted] = useState<number>(0);
  const [correctHits, setCorrectHits] = useState<number>(0);
  const [totalTaps, setTotalTaps] = useState<number>(0);
  const [shakeScreen, setShakeScreen] = useState<boolean>(false);
  const [showCombo, setShowCombo] = useState<boolean>(false);

  // ── Refs (avoid stale closures) ──
  const rafRef = useRef<number | null>(null);
  const lettersRef = useRef<FallingLetter[]>([]);
  const letterIndexRef = useRef<number>(0);
  const targetWordRef = useRef<string>("");
  const livesRef = useRef<number>(3);
  const levelRef = useRef<number>(1);
  const lastSpawnRef = useRef<number>(0);
  const lastFrameRef = useRef<number>(0);
  const scoreRef = useRef<number>(0);
  const comboRef = useRef<number>(0);
  const timeLeftRef = useRef<number>(30);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const gamePhaseRef = useRef<GamePhase>("intro");
  const wordsCompletedRef = useRef<number>(0);
  const correctHitsRef = useRef<number>(0);
  const totalTapsRef = useRef<number>(0);

  // ── Sync refs with state ──
  useEffect(() => {
    gamePhaseRef.current = gamePhase;
  }, [gamePhase]);

  // ── Pick a random word for the current level ──
  const pickWord = useCallback((lvl: number): string => {
    const maxLevel = Math.min(lvl, 5) as keyof typeof WORD_BANK;
    const words = WORD_BANK[maxLevel];
    return pickRandom(words);
  }, []);

  // ── Load a new target word ──
  const loadWord = useCallback(
    (lvl: number): void => {
      const word = pickWord(lvl);
      setTargetWord(word);
      targetWordRef.current = word;
      setLetterIndex(0);
      letterIndexRef.current = 0;
      setWordComplete(false);
    },
    [pickWord]
  );

  // ── Spawn a letter ──
  const spawnLetter = useCallback((): void => {
    const letters = lettersRef.current;
    const config = getDifficultyConfig(levelRef.current);

    if (letters.length >= Math.min(12, config.maxLettersOnScreen)) return;

    const word = targetWordRef.current;
    const idx = letterIndexRef.current;
    if (!word || idx >= word.length) return;

    const correctLetter = word[idx];

    // Ensure at least one correct letter is always on screen
    const hasCorrect = letters.some(
      (l) => l.letter === correctLetter && !l.removing
    );

    const toSpawn: FallingLetter[] = [];

    if (!hasCorrect) {
      // Must spawn correct letter
      toSpawn.push({
        id: uid(),
        letter: correctLetter,
        x: randomX(letters),
        y: -10,
        speed: config.fallSpeed,
        isCorrectNext: true,
        isDecoy: false,
        color: pickRandomColor(),
        removing: false,
        hitType: null,
      });
    }

    // Fill with decoys (or sometimes another correct letter)
    const remaining = Math.min(
      2,
      Math.min(12, config.maxLettersOnScreen) - letters.length - toSpawn.length
    );
    for (let i = 0; i < remaining; i++) {
      const isCorrect = Math.random() < 0.25;
      const letter = isCorrect
        ? correctLetter
        : ALL_LETTERS[Math.floor(Math.random() * 26)];
      toSpawn.push({
        id: uid(),
        letter,
        x: randomX([...letters, ...toSpawn]),
        y: -10,
        speed: config.fallSpeed + (Math.random() - 0.5) * 0.04,
        isCorrectNext: letter === correctLetter,
        isDecoy: letter !== correctLetter,
        color: pickRandomColor(),
        removing: false,
        hitType: null,
      });
    }

    lettersRef.current = [...letters, ...toSpawn];
  }, []);

  // ── End game ──
  const endGame = useCallback((): void => {
    setGamePhase("result");
    gamePhaseRef.current = "result";
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
    }
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
    }

    // Save score to Firestore for analytics
    const uid = auth.currentUser?.uid;
    if (uid && totalTapsRef.current > 0) {
      logQuizAttempt(uid, {
        score: correctHitsRef.current,
        totalQuestions: totalTapsRef.current,
        topic: "little_blitz",
      }).catch(() => {});
    }
  }, []);

  // ── Game loop ──
  const gameLoop = useCallback(
    (timestamp: number): void => {
      if (gamePhaseRef.current !== "playing") return;

      if (!lastFrameRef.current) lastFrameRef.current = timestamp;
      const delta = timestamp - lastFrameRef.current;
      lastFrameRef.current = timestamp;

      // Normalized movement (target 60fps)
      const factor = delta / 16.67;

      let letters = lettersRef.current;
      const word = targetWordRef.current;
      const idx = letterIndexRef.current;
      let currentLives = livesRef.current;

      // Move letters down
      letters = letters.map((l) => ({
        ...l,
        y: l.removing ? l.y : l.y + l.speed * factor,
      }));

      // Check for letters that fell off screen
      const fellOff = letters.filter((l) => l.y > 110 && !l.removing);
      const correctFellOff = fellOff.some(
        (l) => word && idx < word.length && l.letter === word[idx]
      );

      if (correctFellOff) {
        // Check if there's still another correct letter on screen
        const remainingCorrect = letters.filter(
          (l) =>
            l.letter === word[idx] &&
            !l.removing &&
            l.y <= 110 &&
            !fellOff.includes(l)
        );
        if (remainingCorrect.length === 0) {
          // Lost a life — correct letter fell off with no replacements
          currentLives = Math.max(0, currentLives - 1);
          livesRef.current = currentLives;
          setLives(currentLives);
          setShakeScreen(true);
          setTimeout(() => setShakeScreen(false), 400);

          if (currentLives <= 0) {
            lettersRef.current = [];
            setFallingLetters([]);
            endGame();
            return;
          }
        }
      }

      // Remove off-screen letters
      letters = letters.filter((l) => l.y <= 110 || l.removing);

      // Remove letters that finished their hit/miss animation
      letters = letters.filter((l) => {
        if (l.removing && l.removeAt && Date.now() > l.removeAt) return false;
        return true;
      });

      lettersRef.current = letters;

      // Spawn new letters
      const now = Date.now();
      const config = getDifficultyConfig(levelRef.current);
      if (now - lastSpawnRef.current > config.spawnInterval) {
        spawnLetter();
        lastSpawnRef.current = now;
      }

      // Ensure correct letter guarantee
      if (word && idx < word.length) {
        const hasCorrect = lettersRef.current.some(
          (l) => l.letter === word[idx] && !l.removing
        );
        if (!hasCorrect) {
          spawnLetter();
        }
      }

      setFallingLetters([...lettersRef.current]);

      rafRef.current = requestAnimationFrame(gameLoop);
    },
    [spawnLetter, endGame]
  );

  // ── Start game ──
  const startGame = useCallback((): void => {
    // Reset all state
    const startLevel = 1;
    setScore(0);
    scoreRef.current = 0;
    setLives(3);
    livesRef.current = 3;
    setLevel(startLevel);
    levelRef.current = startLevel;
    setCombo(0);
    comboRef.current = 0;
    setTimeLeft(30);
    timeLeftRef.current = 30;
    setWordsCompleted(0);
    wordsCompletedRef.current = 0;
    setCorrectHits(0);
    correctHitsRef.current = 0;
    setTotalTaps(0);
    totalTapsRef.current = 0;
    setHitEffect(null);
    setShakeScreen(false);
    setShowCombo(false);
    lettersRef.current = [];
    setFallingLetters([]);
    lastSpawnRef.current = 0;
    lastFrameRef.current = 0;

    loadWord(startLevel);
    setGamePhase("playing");
    gamePhaseRef.current = "playing";

    // Start countdown timer
    timerRef.current = setInterval(() => {
      timeLeftRef.current -= 1;
      setTimeLeft(timeLeftRef.current);
      if (timeLeftRef.current <= 0) {
        endGame();
      }
    }, 1000);

    // Start game loop
    rafRef.current = requestAnimationFrame(gameLoop);
  }, [loadWord, endGame, gameLoop]);

  // ── Continue to next level ──
  const nextLevel = useCallback((): void => {
    const newLevel = Math.min(levelRef.current + 1, 5);
    setLevel(newLevel);
    levelRef.current = newLevel;
    setTimeLeft(30);
    timeLeftRef.current = 30;
    setCombo(0);
    comboRef.current = 0;
    setHitEffect(null);
    setShakeScreen(false);
    setShowCombo(false);
    lettersRef.current = [];
    setFallingLetters([]);
    lastSpawnRef.current = 0;
    lastFrameRef.current = 0;

    loadWord(newLevel);
    setGamePhase("playing");
    gamePhaseRef.current = "playing";

    timerRef.current = setInterval(() => {
      timeLeftRef.current -= 1;
      setTimeLeft(timeLeftRef.current);
      if (timeLeftRef.current <= 0) {
        endGame();
      }
    }, 1000);

    rafRef.current = requestAnimationFrame(gameLoop);
  }, [loadWord, endGame, gameLoop]);

  // ── Handle letter click/tap ──
  const handleLetterClick = useCallback(
    (letterObj: FallingLetter): void => {
      if (gamePhaseRef.current !== "playing") return;
      if (letterObj.removing) return;

      const word = targetWordRef.current;
      const idx = letterIndexRef.current;

      totalTapsRef.current += 1;
      setTotalTaps(totalTapsRef.current);

      if (letterObj.letter === word[idx]) {
        // Correct hit!
        correctHitsRef.current += 1;
        setCorrectHits(correctHitsRef.current);

        comboRef.current += 1;
        setCombo(comboRef.current);

        const points = 10 * Math.max(1, comboRef.current);
        scoreRef.current += points;
        setScore(scoreRef.current);

        setHitEffect({ id: letterObj.id, type: "hit" });

        // Mark letter for removal with hit animation
        lettersRef.current = lettersRef.current.map((l) =>
          l.id === letterObj.id
            ? { ...l, removing: true, hitType: "hit", removeAt: Date.now() + 400 }
            : l
        );

        const newIdx = idx + 1;
        letterIndexRef.current = newIdx;
        setLetterIndex(newIdx);

        // Show combo banner
        if (comboRef.current >= 3) {
          setShowCombo(true);
          setTimeout(() => setShowCombo(false), 1000);
        }

        // Check word complete
        if (newIdx >= word.length) {
          setWordComplete(true);
          wordsCompletedRef.current += 1;
          setWordsCompleted(wordsCompletedRef.current);

          // Bonus points for completing a word
          scoreRef.current += 50;
          setScore(scoreRef.current);

          // Clear remaining letters
          setTimeout(() => {
            lettersRef.current = [];
            loadWord(levelRef.current);
          }, 600);
        } else {
          // Update isCorrectNext for remaining letters
          const nextLetter = word[newIdx];
          lettersRef.current = lettersRef.current.map((l) =>
            l.removing
              ? l
              : {
                  ...l,
                  isCorrectNext: l.letter === nextLetter,
                  isDecoy: l.letter !== nextLetter,
                }
          );
        }
      } else {
        // Wrong letter
        setHitEffect({ id: letterObj.id, type: "miss" });
        comboRef.current = 0;
        setCombo(0);

        // Mark with miss animation but don't remove
        lettersRef.current = lettersRef.current.map((l) =>
          l.id === letterObj.id ? { ...l, hitType: "miss" } : l
        );
        // Clear miss animation after delay
        setTimeout(() => {
          lettersRef.current = lettersRef.current.map((l) =>
            l.id === letterObj.id ? { ...l, hitType: null } : l
          );
        }, 350);
      }

      setFallingLetters([...lettersRef.current]);
    },
    [loadWord]
  );

  // ── Cleanup on unmount ──
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
      if (timerRef.current !== null) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  // ── Accuracy calculation ──
  const accuracy =
    totalTaps > 0 ? Math.round((correctHits / totalTaps) * 100) : 0;

  // ═══════════════════════════════════════════════════════════════════════════
  // ── INTRO PHASE ──
  // ═══════════════════════════════════════════════════════════════════════════
  if (gamePhase === "intro") {
    return (
      <>
        <style>{GAME_STYLES}</style>
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-gray-950 flex items-center justify-center p-6 overflow-hidden relative">
          {/* Animated preview letters */}
          {(["L", "E", "T"] as const).map((ch, i) => (
            <div
              key={ch}
              className="intro-letter-fall absolute text-3xl font-black text-white/20 select-none pointer-events-none"
              style={{
                left: `${25 + i * 25}%`,
                top: "0%",
                animationDelay: `${i * 0.8}s`,
              }}
            >
              <div
                className={`w-14 h-14 rounded-full flex items-center justify-center ${LETTER_COLORS[i].bg} text-white font-black text-xl`}
              >
                {ch}
              </div>
            </div>
          ))}

          <div className="text-center max-w-md z-10 fade-slide-up">
            <h1 className="text-5xl sm:text-6xl font-black text-white mb-3">
              Letter Blitz
            </h1>
            <p className="text-indigo-400 text-lg font-medium mb-6">
              Lightning-fast letter recognition
            </p>

            <div className="bg-white/5 rounded-2xl p-5 mb-8 text-left space-y-3 border border-white/10">
              <p className="text-white/70 text-sm">
                Letters fall from above — tap them in order to spell the word!
              </p>
              <div className="flex items-center gap-2 text-white/50 text-xs">
                <span className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold text-sm">
                  C
                </span>
                <span className="text-white/30">then</span>
                <span className="w-8 h-8 rounded-full bg-rose-500 flex items-center justify-center text-white font-bold text-sm">
                  A
                </span>
                <span className="text-white/30">then</span>
                <span className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center text-white font-bold text-sm">
                  T
                </span>
                <span className="text-emerald-400 font-bold ml-2">= CAT!</span>
              </div>
              <p className="text-white/40 text-xs">
                Trains rapid letter recognition, sequential ordering, and visual
                tracking — key skills for dyslexia support.
              </p>
            </div>

            <button
              onClick={startGame}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-lg px-12 py-4 rounded-2xl transition-colors shadow-lg shadow-indigo-600/30 active:scale-95"
              style={{ transition: "transform 0.1s, background-color 0.2s" }}
            >
              Play
            </button>
          </div>
        </div>
      </>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ── RESULT PHASE ──
  // ═══════════════════════════════════════════════════════════════════════════
  if (gamePhase === "result") {
    const canAdvance = score > 100 * level;
    return (
      <>
        <style>{GAME_STYLES}</style>
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-gray-950 flex items-center justify-center p-6">
          <div className="text-center max-w-sm fade-slide-up">
            <h2 className="text-4xl font-black text-white mb-2">Game Over!</h2>
            <p className="text-white/40 mb-6">Level {level}</p>

            <div className="bg-white/5 rounded-2xl p-6 mb-6 space-y-4 border border-white/10">
              <div>
                <p className="text-white/40 text-xs uppercase tracking-wider">
                  Score
                </p>
                <p className="text-4xl font-black text-indigo-400">{score}</p>
              </div>
              <div className="flex justify-between">
                <div>
                  <p className="text-white/40 text-xs uppercase tracking-wider">
                    Words
                  </p>
                  <p className="text-2xl font-bold text-white">
                    {wordsCompleted}
                  </p>
                </div>
                <div>
                  <p className="text-white/40 text-xs uppercase tracking-wider">
                    Accuracy
                  </p>
                  <p className="text-2xl font-bold text-white">{accuracy}%</p>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={() => {
                  setLevel(1);
                  levelRef.current = 1;
                  setGamePhase("intro");
                  gamePhaseRef.current = "intro";
                }}
                className="bg-white/10 hover:bg-white/20 text-white font-bold text-base px-8 py-3 rounded-xl transition-colors"
              >
                Play Again
              </button>
              {canAdvance && level < 5 && (
                <button
                  onClick={nextLevel}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-base px-8 py-3 rounded-xl transition-colors shadow-lg shadow-indigo-600/30"
                >
                  Next Level
                </button>
              )}
              <button
                onClick={() => router.back()}
                className="text-white/40 hover:text-white/60 text-sm transition-colors mt-2"
              >
                Back to Games
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ── PLAYING PHASE ──
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <>
      <style>{GAME_STYLES}</style>
      <div
        className={`min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-gray-950 flex flex-col select-none ${
          shakeScreen ? "screen-shake" : ""
        }`}
      >
        {/* ── Top Bar ── */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 bg-black/20 border-b border-white/5">
          <div className="flex items-center gap-4">
            <span className="text-white/60 text-sm font-medium">
              Level {level}
            </span>
            <span className="text-indigo-400 font-bold text-sm">
              Score: {score}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {[...Array(3)].map((_, i) => (
              <span
                key={i}
                className={`text-lg ${i < lives ? "opacity-100" : "opacity-20"}`}
              >
                &#10084;&#65039;
              </span>
            ))}
          </div>
        </div>

        {/* ── Target Word Display ── */}
        <div className="px-4 sm:px-6 py-4 text-center" aria-live="polite">
          <p className="text-white/40 text-xs uppercase tracking-wider mb-2">
            Spell:
          </p>
          <div
            className={`flex items-center justify-center gap-2 sm:gap-3 ${
              wordComplete ? "word-complete-anim" : ""
            }`}
          >
            {targetWord.split("").map((ch, i) => {
              const isCompleted = i < letterIndex;
              const isCurrent = i === letterIndex;
              const isUpcoming = i > letterIndex;
              return (
                <div
                  key={i}
                  className={`w-10 h-10 sm:w-12 sm:h-12 rounded-lg flex items-center justify-center font-black text-lg sm:text-xl border-2 transition-all duration-200 ${
                    isCompleted
                      ? "bg-emerald-500/20 border-emerald-500 text-emerald-400"
                      : isCurrent
                        ? "bg-indigo-500/20 border-indigo-400 text-white bounce-anim"
                        : isUpcoming
                          ? "bg-white/5 border-white/20 text-white/30"
                          : ""
                  }`}
                >
                  {ch}
                </div>
              );
            })}
          </div>
          <p className="text-white/30 text-xs mt-2">
            Tap the letters in order!
          </p>
        </div>

        {/* ── Falling Letter Arena ── */}
        <div
          className="flex-1 relative overflow-hidden mx-3 sm:mx-5 rounded-2xl border border-white/10 bg-black/20"
          style={{ minHeight: "300px", touchAction: "none" }}
        >
          {fallingLetters.map((l) => {
            const isCorrectNext =
              targetWord &&
              letterIndex < targetWord.length &&
              l.letter === targetWord[letterIndex] &&
              !l.removing;

            return (
              <div
                key={l.id}
                role="button"
                tabIndex={0}
                aria-label={l.letter}
                className={`absolute cursor-pointer flex items-center justify-center font-black text-white text-xl sm:text-2xl rounded-full transition-shadow duration-200 ${
                  l.color.bg
                } ${
                  l.hitType === "hit"
                    ? "letter-hit"
                    : l.hitType === "miss"
                      ? "letter-miss"
                      : ""
                } ${isCorrectNext ? "correct-pulse ring-2 " + l.color.ring : ""}`}
                style={{
                  width: "clamp(56px, 10vw, 80px)",
                  height: "clamp(56px, 10vw, 80px)",
                  left: `${l.x}%`,
                  top: `${l.y}%`,
                  transform: "translate(-50%, -50%)",
                  zIndex: isCorrectNext ? 10 : 1,
                  fontSize: "clamp(18px, 3vw, 28px)",
                }}
                onClick={() => handleLetterClick(l)}
                onTouchStart={(e: React.TouchEvent<HTMLDivElement>) => {
                  e.preventDefault();
                  handleLetterClick(l);
                }}
                onKeyDown={(e: React.KeyboardEvent<HTMLDivElement>) => {
                  if (e.key === "Enter" || e.key === " ") handleLetterClick(l);
                }}
              >
                {l.letter}
              </div>
            );
          })}

          {/* Combo banner */}
          {showCombo && combo >= 3 && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 combo-pop z-20">
              <div className="bg-amber-500/90 text-white font-black text-lg px-5 py-2 rounded-full shadow-lg">
                x{combo} COMBO!
              </div>
            </div>
          )}
        </div>

        {/* ── Timer Bar ── */}
        <div className="px-4 sm:px-6 py-3 flex items-center justify-center gap-3">
          <div className="w-full max-w-xs bg-white/10 rounded-full h-2 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-1000 ${
                timeLeft > 10
                  ? "bg-indigo-500"
                  : timeLeft > 5
                    ? "bg-amber-500"
                    : "bg-rose-500"
              }`}
              style={{ width: `${(timeLeft / 30) * 100}%` }}
            />
          </div>
          <span
            className={`text-sm font-bold min-w-[48px] text-right ${
              timeLeft > 10
                ? "text-white/60"
                : timeLeft > 5
                  ? "text-amber-400"
                  : "text-rose-400"
            }`}
          >
            {timeLeft}s
          </span>
        </div>
      </div>
    </>
  );
}
