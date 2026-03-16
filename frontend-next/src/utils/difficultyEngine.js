export const DIFFICULTY_LABELS = {
  1: "Beginner",
  2: "Easy",
  3: "Medium",
  4: "Hard",
  5: "Expert",
};

const GAME_CONFIGS = {
  rapid_naming: [
    { itemCount: 6, timeLimit: 30, speedMultiplier: 1.0 },
    { itemCount: 8, timeLimit: 25, speedMultiplier: 1.2 },
    { itemCount: 10, timeLimit: 20, speedMultiplier: 1.4 },
    { itemCount: 14, timeLimit: 15, speedMultiplier: 1.7 },
    { itemCount: 18, timeLimit: 12, speedMultiplier: 2.0 },
  ],
  sound_builder: [
    { wordLength: 3, distractors: 1, hintEnabled: true },
    { wordLength: 3, distractors: 2, hintEnabled: true },
    { wordLength: 4, distractors: 2, hintEnabled: false },
    { wordLength: 5, distractors: 3, hintEnabled: false },
    { wordLength: 6, distractors: 4, hintEnabled: false },
  ],
  nback: [
    { n: 1, gridSize: 3, intervalMs: 2500 },
    { n: 1, gridSize: 3, intervalMs: 2000 },
    { n: 2, gridSize: 3, intervalMs: 2000 },
    { n: 2, gridSize: 4, intervalMs: 1500 },
    { n: 3, gridSize: 4, intervalMs: 1200 },
  ],
  clap_trap: [
    { bpm: 60, sequenceLength: 4, distractors: 0 },
    { bpm: 80, sequenceLength: 5, distractors: 1 },
    { bpm: 100, sequenceLength: 6, distractors: 2 },
    { bpm: 120, sequenceLength: 7, distractors: 3 },
    { bpm: 140, sequenceLength: 8, distractors: 4 },
  ],
  stroop: [
    { timeLimit: 30, distractors: 1, wordCount: 6 },
    { timeLimit: 25, distractors: 2, wordCount: 8 },
    { timeLimit: 20, distractors: 2, wordCount: 10 },
    { timeLimit: 15, distractors: 3, wordCount: 14 },
    { timeLimit: 12, distractors: 4, wordCount: 18 },
  ],
  monoline: [
    { nodeCount: 4, edgeCount: 4, timeLimit: 0, hintEnabled: true },
    { nodeCount: 5, edgeCount: 6, timeLimit: 0, hintEnabled: true },
    { nodeCount: 6, edgeCount: 8, timeLimit: 90, hintEnabled: false },
    { nodeCount: 7, edgeCount: 10, timeLimit: 60, hintEnabled: false },
    { nodeCount: 8, edgeCount: 12, timeLimit: 45, hintEnabled: false },
  ],
  dot_connector: [
    { gridSize: 4, colorCount: 3, timeLimit: 0 },
    { gridSize: 5, colorCount: 4, timeLimit: 0 },
    { gridSize: 5, colorCount: 5, timeLimit: 120 },
    { gridSize: 6, colorCount: 5, timeLimit: 90 },
    { gridSize: 7, colorCount: 6, timeLimit: 60 },
  ],
};

const REACTION_THRESHOLDS = {
  rapid_naming: 1200,
  sound_builder: 3000,
  nback: 1500,
  clap_trap: 800,
  stroop: 1000,
  monoline: 20000,
  dot_connector: 60000,
};

export function getDifficultyConfig(gameType, level) {
  const configs = GAME_CONFIGS[gameType];
  if (!configs) return null;
  const clamped = Math.max(1, Math.min(5, level));
  return { ...configs[clamped - 1], level: clamped, label: DIFFICULTY_LABELS[clamped] };
}

export function calculateNextDifficulty(accuracy, reactionTimeMs, currentLevel, gameType) {
  const threshold = (gameType && REACTION_THRESHOLDS[gameType]) || 1500;
  let next = currentLevel;

  if (accuracy > 0.85 && reactionTimeMs < threshold) {
    next = currentLevel + 1;
  } else if (accuracy < 0.5) {
    next = currentLevel - 1;
  }

  return Math.max(1, Math.min(5, next));
}