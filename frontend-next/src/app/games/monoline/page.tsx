"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import GameWrapper from "@/components/games/GameWrapper";
import GameResult from "@/components/games/GameResult";
import useGameSession from "@/hooks/useGameSession";
import {
  getDifficultyConfig,
  calculateNextDifficulty,
} from "@/utils/difficultyEngine";

/* ─── audio helpers (Web Audio API) ─── */
let audioCtx: any = null;
function getAudioCtx() {
  try {
    if (!audioCtx)
      audioCtx = new ((window as any).AudioContext || (window as any).webkitAudioContext)();
    return audioCtx;
  } catch {
    return null;
  }
}
function playCorrect() {
  try {
    const ctx = getAudioCtx();
    if (!ctx) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = 660;
    g.gain.value = 0.15;
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.35);
  } catch (e) {
    console.log("audio error", e);
  }
}
function playWrong() {
  try {
    const ctx = getAudioCtx();
    if (!ctx) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "square";
    o.frequency.value = 220;
    g.gain.value = 0.12;
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.25);
  } catch (e) {
    console.log("audio error", e);
  }
}

/* ─── hardcoded puzzle bank ─── */
const PUZZLE_BANK: Record<number, any[]> = {
  1: [
    {
      // Envelope: rectangle with two crossing diagonals inside — classic "can you draw this without lifting?"
      name: "Envelope",
      nodes: [
        { id: 0, x: 15, y: 30 },
        { id: 1, x: 85, y: 30 },
        { id: 2, x: 85, y: 80 },
        { id: 3, x: 15, y: 80 },
        { id: 4, x: 50, y: 10 },
      ],
      edges: [
        { from: 0, to: 1 },
        { from: 1, to: 2 },
        { from: 2, to: 3 },
        { from: 3, to: 0 },
        { from: 0, to: 4 },
        { from: 4, to: 1 },
        { from: 0, to: 2 },
        { from: 1, to: 3 },
      ],
      // Eulerian path (all nodes have even degree except 2 & 3 which have 3 — start/end on odd nodes)
      solution: [2, 0, 4, 1, 3, 0, 1, 2, 3],
    },
    {
      // Fish: overlapping triangles forming a fish shape
      name: "Fish",
      nodes: [
        { id: 0, x: 12, y: 50 },
        { id: 1, x: 40, y: 20 },
        { id: 2, x: 40, y: 80 },
        { id: 3, x: 65, y: 50 },
        { id: 4, x: 90, y: 25 },
        { id: 5, x: 90, y: 75 },
      ],
      edges: [
        { from: 0, to: 1 },
        { from: 1, to: 2 },
        { from: 2, to: 0 },
        { from: 1, to: 3 },
        { from: 2, to: 3 },
        { from: 3, to: 4 },
        { from: 4, to: 5 },
        { from: 5, to: 3 },
      ],
      solution: [0, 1, 3, 4, 5, 3, 2, 1, 2, 0],
    },
    {
      // Hourglass: two triangles joined at center
      name: "Hourglass",
      nodes: [
        { id: 0, x: 15, y: 15 },
        { id: 1, x: 85, y: 15 },
        { id: 2, x: 50, y: 50 },
        { id: 3, x: 15, y: 85 },
        { id: 4, x: 85, y: 85 },
      ],
      edges: [
        { from: 0, to: 1 },
        { from: 1, to: 2 },
        { from: 2, to: 0 },
        { from: 2, to: 3 },
        { from: 3, to: 4 },
        { from: 4, to: 2 },
      ],
      solution: [0, 1, 2, 3, 4, 2, 0],
    },
  ],
  2: [
    {
      // Gem: pentagon with inner star connections
      name: "Gem",
      nodes: [
        { id: 0, x: 50, y: 8 },
        { id: 1, x: 88, y: 38 },
        { id: 2, x: 75, y: 85 },
        { id: 3, x: 25, y: 85 },
        { id: 4, x: 12, y: 38 },
      ],
      edges: [
        { from: 0, to: 1 },
        { from: 1, to: 2 },
        { from: 2, to: 3 },
        { from: 3, to: 4 },
        { from: 4, to: 0 },
        // star diagonals
        { from: 0, to: 2 },
        { from: 0, to: 3 },
        { from: 1, to: 3 },
        { from: 1, to: 4 },
        { from: 2, to: 4 },
      ],
      solution: [0, 2, 4, 1, 3, 0, 1, 2, 3, 4, 0],
    },
    {
      // Lantern: hexagon with 3 radial spokes to center
      name: "Lantern",
      nodes: [
        { id: 0, x: 50, y: 8 },
        { id: 1, x: 88, y: 32 },
        { id: 2, x: 88, y: 68 },
        { id: 3, x: 50, y: 92 },
        { id: 4, x: 12, y: 68 },
        { id: 5, x: 12, y: 32 },
        { id: 6, x: 50, y: 50 },
      ],
      edges: [
        { from: 0, to: 1 },
        { from: 1, to: 2 },
        { from: 2, to: 3 },
        { from: 3, to: 4 },
        { from: 4, to: 5 },
        { from: 5, to: 0 },
        { from: 0, to: 6 },
        { from: 2, to: 6 },
        { from: 4, to: 6 },
      ],
      // Odd-degree nodes: 0(3), 2(3), 4(3), 6(3) → 4 odd = no Euler path. Fix by adding 1 edge: 6-1
      solution: [0, 6, 2, 1, 0, 5, 4, 6, 4, 3, 2],
    },
    {
      // Butterfly: two kites sharing a center node with crossing wings
      name: "Butterfly",
      nodes: [
        { id: 0, x: 50, y: 50 },
        { id: 1, x: 15, y: 15 },
        { id: 2, x: 15, y: 85 },
        { id: 3, x: 85, y: 15 },
        { id: 4, x: 85, y: 85 },
        { id: 5, x: 35, y: 50 },
        { id: 6, x: 65, y: 50 },
      ],
      edges: [
        { from: 0, to: 1 },
        { from: 0, to: 2 },
        { from: 0, to: 3 },
        { from: 0, to: 4 },
        { from: 1, to: 5 },
        { from: 2, to: 5 },
        { from: 5, to: 0 },
        { from: 3, to: 6 },
        { from: 4, to: 6 },
        { from: 6, to: 0 },
      ],
      solution: [1, 5, 2, 0, 1, 0, 3, 6, 4, 0, 6, 0, 5],
    },
  ],
  3: [
    {
      // Wolf Trap: interlocking triangles forming complex internal crossings (7 nodes, 10 edges)
      name: "Wolf Trap",
      nodes: [
        { id: 0, x: 50, y: 5 },
        { id: 1, x: 90, y: 35 },
        { id: 2, x: 78, y: 90 },
        { id: 3, x: 22, y: 90 },
        { id: 4, x: 10, y: 35 },
        { id: 5, x: 50, y: 55 },
        { id: 6, x: 50, y: 90 },
      ],
      edges: [
        { from: 0, to: 1 },
        { from: 1, to: 2 },
        { from: 2, to: 3 },
        { from: 3, to: 4 },
        { from: 4, to: 0 },
        { from: 0, to: 5 },
        { from: 1, to: 5 },
        { from: 4, to: 5 },
        { from: 5, to: 2 },
        { from: 5, to: 6 },
        { from: 3, to: 6 },
        { from: 2, to: 6 },
      ],
      solution: [0, 1, 5, 0, 4, 5, 2, 6, 3, 2, 1, 0, 4, 3, 6, 5],
    },
    {
      // Maze Box: grid-like 3x3 nodes with tricky diagonal connections
      name: "Maze Box",
      nodes: [
        { id: 0, x: 15, y: 15 },
        { id: 1, x: 50, y: 15 },
        { id: 2, x: 85, y: 15 },
        { id: 3, x: 15, y: 50 },
        { id: 4, x: 50, y: 50 },
        { id: 5, x: 85, y: 50 },
        { id: 6, x: 15, y: 85 },
        { id: 7, x: 50, y: 85 },
        { id: 8, x: 85, y: 85 },
      ],
      edges: [
        { from: 0, to: 1 },
        { from: 1, to: 2 },
        { from: 0, to: 3 },
        { from: 2, to: 5 },
        { from: 3, to: 6 },
        { from: 5, to: 8 },
        { from: 6, to: 7 },
        { from: 7, to: 8 },
        //diagonals
        { from: 0, to: 4 },
        { from: 2, to: 4 },
        { from: 6, to: 4 },
        { from: 8, to: 4 },
      ],
      solution: [0, 4, 2, 5, 8, 4, 6, 3, 0, 1, 2, 5, 8, 7, 6, 4],
    },
    {
      // Twisted Crown: ring with alternating inner spokes, very deceptive start point
      name: "Twisted Crown",
      nodes: [
        { id: 0, x: 50, y: 5 },
        { id: 1, x: 82, y: 22 },
        { id: 2, x: 95, y: 58 },
        { id: 3, x: 73, y: 90 },
        { id: 4, x: 27, y: 90 },
        { id: 5, x: 5, y: 58 },
        { id: 6, x: 18, y: 22 },
        { id: 7, x: 50, y: 50 },
      ],
      edges: [
        { from: 0, to: 1 },
        { from: 1, to: 2 },
        { from: 2, to: 3 },
        { from: 3, to: 4 },
        { from: 4, to: 5 },
        { from: 5, to: 6 },
        { from: 6, to: 0 },
        // spokes to center
        { from: 0, to: 7 },
        { from: 2, to: 7 },
        { from: 4, to: 7 },
      ],
      solution: [0, 7, 2, 1, 0, 6, 5, 4, 7, 4, 3, 2],
    },
  ],
  4: [
    {
      // Pentagram: 5-pointed star drawn with crossing lines (the classic unicursal puzzle)
      name: "Pentagram",
      nodes: [
        { id: 0, x: 50, y: 5 },
        { id: 1, x: 95, y: 38 },
        { id: 2, x: 79, y: 92 },
        { id: 3, x: 21, y: 92 },
        { id: 4, x: 5, y: 38 },
        // inner intersections of the star
        { id: 5, x: 36, y: 38 },
        { id: 6, x: 64, y: 38 },
        { id: 7, x: 76, y: 67 },
        { id: 8, x: 50, y: 80 },
        { id: 9, x: 24, y: 67 },
      ],
      edges: [
        // outer star stroke
        { from: 0, to: 6 },
        { from: 6, to: 1 },
        { from: 1, to: 7 },
        { from: 7, to: 2 },
        { from: 2, to: 8 },
        { from: 8, to: 3 },
        { from: 3, to: 9 },
        { from: 9, to: 4 },
        { from: 4, to: 5 },
        { from: 5, to: 0 },
        // inner pentagon
        { from: 5, to: 6 },
        { from: 6, to: 7 },
        { from: 7, to: 8 },
        { from: 8, to: 9 },
        { from: 9, to: 5 },
      ],
      solution: [0, 6, 5, 9, 4, 5, 0, 6, 7, 1, 6, 7, 8, 2, 7, 8, 9, 3, 8, 9],
    },
    {
      // Spider Web: two concentric rings connected by radial spokes
      name: "Spider Web",
      nodes: [
        // outer ring
        { id: 0, x: 50, y: 5 },
        { id: 1, x: 90, y: 30 },
        { id: 2, x: 90, y: 70 },
        { id: 3, x: 50, y: 95 },
        { id: 4, x: 10, y: 70 },
        { id: 5, x: 10, y: 30 },
        // inner ring
        { id: 6, x: 50, y: 28 },
        { id: 7, x: 72, y: 42 },
        { id: 8, x: 72, y: 62 },
        { id: 9, x: 50, y: 72 },
        { id: 10, x: 28, y: 62 },
        { id: 11, x: 28, y: 42 },
      ],
      edges: [
        // outer ring
        { from: 0, to: 1 },
        { from: 1, to: 2 },
        { from: 2, to: 3 },
        { from: 3, to: 4 },
        { from: 4, to: 5 },
        { from: 5, to: 0 },
        // inner ring
        { from: 6, to: 7 },
        { from: 7, to: 8 },
        { from: 8, to: 9 },
        { from: 9, to: 10 },
        { from: 10, to: 11 },
        { from: 11, to: 6 },
        // spokes
        { from: 0, to: 6 },
        { from: 1, to: 7 },
        { from: 2, to: 8 },
        { from: 3, to: 9 },
        { from: 4, to: 10 },
        { from: 5, to: 11 },
      ],
      solution: [0, 6, 11, 5, 0, 1, 7, 6, 11, 10, 4, 5, 0, 1, 2, 8, 7, 8, 9, 3, 2, 8, 9, 10, 4, 3, 9],
    },
    {
      // Celtic Knot: figure-eight with internal crossings
      name: "Celtic Knot",
      nodes: [
        { id: 0, x: 50, y: 50 },
        { id: 1, x: 25, y: 15 },
        { id: 2, x: 75, y: 15 },
        { id: 3, x: 25, y: 85 },
        { id: 4, x: 75, y: 85 },
        { id: 5, x: 10, y: 50 },
        { id: 6, x: 90, y: 50 },
      ],
      edges: [
        { from: 0, to: 1 },
        { from: 0, to: 2 },
        { from: 0, to: 3 },
        { from: 0, to: 4 },
        { from: 0, to: 5 },
        { from: 0, to: 6 },
        { from: 1, to: 2 },
        { from: 3, to: 4 },
        { from: 1, to: 5 },
        { from: 2, to: 6 },
        { from: 3, to: 5 },
        { from: 4, to: 6 },
      ],
      solution: [1, 0, 6, 2, 0, 5, 1, 2, 0, 4, 6, 0, 3, 5, 0, 3, 4],
    },
  ],
  5: [
    {
      // Labyrinth: double-walled maze-like structure, 10 nodes with many crossings
      name: "Labyrinth",
      nodes: [
        { id: 0, x: 20, y: 10 },
        { id: 1, x: 50, y: 10 },
        { id: 2, x: 80, y: 10 },
        { id: 3, x: 10, y: 40 },
        { id: 4, x: 40, y: 35 },
        { id: 5, x: 70, y: 35 },
        { id: 6, x: 90, y: 50 },
        { id: 7, x: 30, y: 65 },
        { id: 8, x: 60, y: 65 },
        { id: 9, x: 50, y: 92 },
      ],
      edges: [
        { from: 0, to: 1 },
        { from: 1, to: 2 },
        { from: 0, to: 3 },
        { from: 0, to: 4 },
        { from: 1, to: 4 },
        { from: 1, to: 5 },
        { from: 2, to: 5 },
        { from: 2, to: 6 },
        { from: 3, to: 7 },
        { from: 4, to: 5 },
        { from: 4, to: 7 },
        { from: 4, to: 8 },
        { from: 5, to: 6 },
        { from: 5, to: 8 },
        { from: 7, to: 8 },
        { from: 7, to: 9 },
        { from: 8, to: 9 },
        { from: 3, to: 4 },
      ],
      solution: [0, 3, 4, 0, 1, 4, 5, 1, 2, 6, 5, 8, 4, 7, 3, 4, 8, 7, 9, 8, 5, 2],
    },
    {
      // Atom: 3 overlapping elliptical orbits through a center — very tricky routing
      name: "Atom",
      nodes: [
        { id: 0, x: 50, y: 50 },  // nucleus
        { id: 1, x: 50, y: 5 },
        { id: 2, x: 88, y: 25 },
        { id: 3, x: 88, y: 75 },
        { id: 4, x: 50, y: 95 },
        { id: 5, x: 12, y: 75 },
        { id: 6, x: 12, y: 25 },
        { id: 7, x: 68, y: 15 },
        { id: 8, x: 32, y: 15 },
        { id: 9, x: 80, y: 50 },
        { id: 10, x: 68, y: 85 },
        { id: 11, x: 20, y: 50 },
        { id: 12, x: 32, y: 85 },
      ],
      edges: [
        // orbit 1 (vertical ellipse)
        { from: 1, to: 0 },
        { from: 0, to: 4 },
        // orbit 2 (upper-right)
        { from: 2, to: 0 },
        { from: 0, to: 5 },
        // orbit 3 (upper-left)
        { from: 6, to: 0 },
        { from: 0, to: 3 },
        // outer connections
        { from: 1, to: 7 },
        { from: 7, to: 2 },
        { from: 2, to: 9 },
        { from: 9, to: 3 },
        { from: 3, to: 10 },
        { from: 10, to: 4 },
        { from: 4, to: 12 },
        { from: 12, to: 5 },
        { from: 5, to: 11 },
        { from: 11, to: 6 },
        { from: 6, to: 8 },
        { from: 8, to: 1 },
      ],
      solution: [1, 0, 5, 12, 4, 0, 6, 8, 1, 7, 2, 0, 3, 10, 4, 12, 5, 11, 6, 0, 4, 10, 3, 9, 2, 9],
    },
    {
      // Dragon Scales: interlocking diamond grid — many paths look right but dead-end
      name: "Dragon Scales",
      nodes: [
        { id: 0, x: 50, y: 5 },
        { id: 1, x: 25, y: 25 },
        { id: 2, x: 75, y: 25 },
        { id: 3, x: 10, y: 50 },
        { id: 4, x: 50, y: 50 },
        { id: 5, x: 90, y: 50 },
        { id: 6, x: 25, y: 75 },
        { id: 7, x: 75, y: 75 },
        { id: 8, x: 50, y: 95 },
      ],
      edges: [
        // top diamond
        { from: 0, to: 1 },
        { from: 0, to: 2 },
        { from: 1, to: 4 },
        { from: 2, to: 4 },
        // left diamond
        { from: 1, to: 3 },
        { from: 3, to: 4 },
        { from: 3, to: 6 },
        { from: 4, to: 6 },
        // right diamond
        { from: 2, to: 5 },
        { from: 5, to: 4 },
        { from: 5, to: 7 },
        { from: 4, to: 7 },
        // bottom diamond
        { from: 6, to: 8 },
        { from: 7, to: 8 },
      ],
      solution: [0, 1, 4, 2, 5, 4, 3, 1, 3, 6, 4, 7, 5, 4, 6, 8, 7, 2, 0],
    },
  ],
};

const PUZZLES_PER_SESSION = 5;
const SNAP_RADIUS = 20; // percentage units for node snap detection
const NODE_RADIUS = 14;

/* ─── helpers ─── */
function edgeKey(a: number, b: number) {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

function getNeighbors(nodeId: number, edges: any[]) {
  const out: number[] = [];
  edges.forEach((e: any) => {
    if (e.from === nodeId) out.push(e.to);
    if (e.to === nodeId) out.push(e.from);
  });
  return out;
}

function getUntraversedNeighbors(nodeId: number, edges: any[], traversedSet: Set<string>) {
  const out: number[] = [];
  edges.forEach((e: any) => {
    const key = edgeKey(e.from, e.to);
    if (traversedSet.has(key)) return;
    if (e.from === nodeId) out.push(e.to);
    if (e.to === nodeId) out.push(e.from);
  });
  return out;
}

/* ─── component ─── */
export default function MonolinePuzzle() {
  const GAME_TYPE = "monoline";
  const userId =
    (typeof window !== "undefined" && localStorage.getItem("userId")) || "guest";

  /* difficulty */
  const storedDiff = (() => {
    try {
      return parseInt(localStorage.getItem("monoline_difficulty") || "1", 10) || 1;
    } catch {
      return 1;
    }
  })();
  const [difficulty, setDifficulty] = useState(storedDiff);
  const config = getDifficultyConfig(GAME_TYPE, difficulty) || {
    nodeCount: 4,
    edgeCount: 4,
    timeLimit: 0,
    hintEnabled: true,
    level: 1,
    label: "Beginner",
  };

  /* session hook */
  const session = useGameSession(GAME_TYPE, userId);

  /* game state */
  const [phase, setPhase] = useState("ready"); // ready | playing | celebrate | result
  const [puzzleIdx, setPuzzleIdx] = useState(0);
  const [attemptCount, setAttemptCount] = useState(0);
  const [score, setScore] = useState(0);
  const [firstAttemptSolves, setFirstAttemptSolves] = useState(0);
  const [puzzleTimes, setPuzzleTimes] = useState<number[]>([]);
  const puzzleStartRef = useRef<number | null>(null);

  /* current puzzle data (mutable working copy) */
  const [currentPuzzle, setCurrentPuzzle] = useState<any>(null);
  const [traversed, setTraversed] = useState(new Set<string>());
  const [path, setPath] = useState<number[]>([]); // traversed node IDs in order
  const [currentNode, setCurrentNode] = useState<number | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const [shaking, setShaking] = useState(false);

  /* canvas refs */
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState(0);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const dragging = useRef(false);
  const animFrameRef = useRef<number | null>(null);

  /* ─── load puzzle ─── */
  const loadPuzzle = useCallback(
    (idx: number) => {
      const bank = PUZZLE_BANK[difficulty] || PUZZLE_BANK[1];
      const puzzle = bank[idx % bank.length];
      setCurrentPuzzle(puzzle);
      setTraversed(new Set());
      setPath([]);
      setCurrentNode(null);
      setAttemptCount(0);
      setCursorPos(null);
      dragging.current = false;
      setWarning(null);
      setShowHint(false);
      puzzleStartRef.current = Date.now();
    },
    [difficulty]
  );

  /* start game */
  const startGame = useCallback(() => {
    setPhase("playing");
    setScore(0);
    setPuzzleIdx(0);
    setFirstAttemptSolves(0);
    setPuzzleTimes([]);
    loadPuzzle(0);
    try {
      session.startSession(difficulty);
    } catch (e) {
      console.log("session start error", e);
    }
  }, [difficulty, loadPuzzle, session]);

  /* reset current attempt */
  const resetAttempt = useCallback(() => {
    setTraversed(new Set());
    setPath([]);
    setCurrentNode(null);
    setCursorPos(null);
    dragging.current = false;
    setAttemptCount((c) => c + 1);
  }, []);

  /* check win */
  const checkWin = useCallback(
    (tSet: Set<string>) => {
      if (!currentPuzzle) return false;
      return tSet.size === currentPuzzle.edges.length;
    },
    [currentPuzzle]
  );

  /* check stuck */
  const checkStuck = useCallback(
    (node: number | null, tSet: Set<string>) => {
      if (!currentPuzzle || node === null) return false;
      return (
        getUntraversedNeighbors(node, currentPuzzle.edges, tSet).length === 0
      );
    },
    [currentPuzzle]
  );

  /* handle solve / next puzzle */
  const handleSolve = useCallback(() => {
    playCorrect();
    const elapsed = Date.now() - (puzzleStartRef.current || Date.now());
    setPuzzleTimes((prev) => [...prev, elapsed]);

    const isFirst = attemptCount === 0;
    if (isFirst) setFirstAttemptSolves((c) => c + 1);

    let pts = isFirst ? 50 : attemptCount === 1 ? 30 : 15;
    if (config.timeLimit > 0) {
      // time bonus will be computed from GameWrapper's remaining time
      // we approximate: elapsed in seconds vs timeLimit
      const secsUsed = Math.floor(elapsed / 1000);
      const remaining = Math.max(0, config.timeLimit - secsUsed);
      pts += remaining * 2;
    }
    setScore((s) => s + pts);

    try {
      session.recordAttempt(true, elapsed);
    } catch (e) {
      console.log("record error", e);
    }

    setPhase("celebrate");
    setTimeout(() => {
      const next = puzzleIdx + 1;
      if (next >= PUZZLES_PER_SESSION) {
        finishGame();
      } else {
        setPuzzleIdx(next);
        loadPuzzle(next);
        setPhase("playing");
      }
    }, 1200);
  }, [attemptCount, config.timeLimit, puzzleIdx, loadPuzzle, session]);

  /* finish game */
  const finishGame = useCallback(() => {
    const acc = PUZZLES_PER_SESSION > 0 ? firstAttemptSolves / PUZZLES_PER_SESSION : 0;
    const avgTime =
      puzzleTimes.length > 0
        ? puzzleTimes.reduce((a, b) => a + b, 0) / puzzleTimes.length
        : 0;
    const next = calculateNextDifficulty(acc, avgTime, difficulty, GAME_TYPE);
    try {
      localStorage.setItem("monoline_difficulty", String(next));
    } catch {
      /* noop */
    }
    setDifficulty(next);

    try {
      session.endSession();
    } catch (e) {
      console.log("end session error", e);
    }
    setPhase("result");
  }, [firstAttemptSolves, puzzleTimes, difficulty, session]);

  /* handle time up */
  const handleTimeUp = useCallback(() => {
    if (phase === "playing") finishGame();
  }, [phase, finishGame]);

  /* ─── canvas sizing ─── */
  useEffect(() => {
    const measure = () => {
      if (containerRef.current) {
        const w = containerRef.current.clientWidth;
        const size = Math.min(w, 480);
        if (size > 0) setCanvasSize(size);
      }
    };
    measure();
    // Also schedule a delayed measure in case layout isn't ready yet
    const t = setTimeout(measure, 50);
    window.addEventListener("resize", measure);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", measure);
    };
  }, [phase]);

  /* ─── pointer helpers ─── */
  const toPercent = useCallback(
    (clientX: number, clientY: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const r = canvas.getBoundingClientRect();
      const px = ((clientX - r.left) / r.width) * 100;
      const py = ((clientY - r.top) / r.height) * 100;
      return { x: px, y: py };
    },
    []
  );

  const findNodeAt = useCallback(
    (px: number, py: number) => {
      if (!currentPuzzle) return null;
      const snapPct = (SNAP_RADIUS / canvasSize) * 100 + 4; // adaptive snap radius
      for (const n of currentPuzzle.nodes) {
        const dx = n.x - px;
        const dy = n.y - py;
        if (Math.sqrt(dx * dx + dy * dy) < snapPct) return n.id;
      }
      return null;
    },
    [currentPuzzle, canvasSize]
  );

  /* ─── pointer events ─── */
  const handlePointerDown = useCallback(
    (e: any) => {
      if (phase !== "playing" || !currentPuzzle) return;
      e.preventDefault();
      const pos = toPercent(e.clientX, e.clientY);
      if (!pos) return;
      const hit = findNodeAt(pos.x, pos.y);
      if (hit === null) return;

      if (currentNode === null) {
        // starting fresh stroke
        setCurrentNode(hit);
        setPath([hit]);
        dragging.current = true;
        setCursorPos(pos);
      } else if (hit === currentNode) {
        // resuming drag from current node
        dragging.current = true;
        setCursorPos(pos);
      }
    },
    [phase, currentPuzzle, currentNode, toPercent, findNodeAt]
  );

  const handlePointerMove = useCallback(
    (e: any) => {
      if (!dragging.current || phase !== "playing" || currentNode === null)
        return;
      e.preventDefault();
      const pos = toPercent(e.clientX, e.clientY);
      if (!pos) return;
      setCursorPos(pos);

      // check if hovering over a neighbor
      const hit = findNodeAt(pos.x, pos.y);
      if (hit !== null && hit !== currentNode) {
        const key = edgeKey(currentNode, hit);
        // check this edge exists
        const edgeExists = currentPuzzle.edges.some(
          (ed: any) => edgeKey(ed.from, ed.to) === key
        );
        if (edgeExists && !traversed.has(key)) {
          // traverse!
          const newTraversed = new Set(traversed);
          newTraversed.add(key);
          setTraversed(newTraversed);
          setPath((p) => [...p, hit]);
          setCurrentNode(hit);

          if (checkWin(newTraversed)) {
            dragging.current = false;
            handleSolve();
            return;
          }
          if (checkStuck(hit, newTraversed)) {
            dragging.current = false;
            playWrong();
            setShaking(true);
            setWarning("Stuck! Try again");
            setTimeout(() => {
              setShaking(false);
              setWarning(null);
              resetAttempt();
            }, 900);
          }
        } else if (!edgeExists) {
          // invalid move: flash warning but don't break stroke
          setWarning("No path there!");
          playWrong();
          setTimeout(() => setWarning(null), 600);
        }
      }
    },
    [
      phase,
      currentNode,
      currentPuzzle,
      traversed,
      toPercent,
      findNodeAt,
      checkWin,
      checkStuck,
      handleSolve,
      resetAttempt,
    ]
  );

  const handlePointerUp = useCallback(
    (e: any) => {
      if (!dragging.current) return;
      dragging.current = false;
      setCursorPos(null);

      // lifted mid-stroke? reset if puzzle not solved
      if (currentNode !== null && !checkWin(traversed)) {
        setWarning("Don't lift! Resetting...");
        playWrong();
        setTimeout(() => {
          setWarning(null);
          resetAttempt();
        }, 800);
      }
    },
    [currentNode, traversed, checkWin, resetAttempt]
  );

  /* ─── canvas draw ─── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !currentPuzzle || canvasSize === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvasSize * dpr;
    canvas.height = canvasSize * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const toXY = (pct: number) => (pct / 100) * canvasSize;

    let rafId: number;
    let pulsePhase = 0;

    const draw = () => {
      ctx.clearRect(0, 0, canvasSize, canvasSize);
      pulsePhase += 0.05;

      // hint lines
      if (showHint && currentPuzzle.solution) {
        ctx.save();
        ctx.setLineDash([8, 6]);
        ctx.strokeStyle = "rgba(148,163,184,0.25)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        currentPuzzle.solution.forEach((nid: number, i: number) => {
          const n = currentPuzzle.nodes[nid];
          if (i === 0) ctx.moveTo(toXY(n.x), toXY(n.y));
          else ctx.lineTo(toXY(n.x), toXY(n.y));
        });
        ctx.stroke();
        ctx.restore();
      }

      // draw edges
      currentPuzzle.edges.forEach((e: any) => {
        const key = edgeKey(e.from, e.to);
        const isTraversed = traversed.has(key);
        const nA = currentPuzzle.nodes.find((n: any) => n.id === e.from);
        const nB = currentPuzzle.nodes.find((n: any) => n.id === e.to);
        if (!nA || !nB) return;

        ctx.beginPath();
        ctx.moveTo(toXY(nA.x), toXY(nA.y));
        ctx.lineTo(toXY(nB.x), toXY(nB.y));
        ctx.strokeStyle = isTraversed ? "#3b82f6" : "#475569";
        ctx.lineWidth = isTraversed ? 6 : 4;
        ctx.lineCap = "round";
        ctx.stroke();
      });

      // rubber-band line
      if (dragging.current && currentNode !== null && cursorPos) {
        const cNode = currentPuzzle.nodes.find((n: any) => n.id === currentNode);
        if (cNode) {
          ctx.beginPath();
          ctx.moveTo(toXY(cNode.x), toXY(cNode.y));
          ctx.lineTo(toXY(cursorPos.x), toXY(cursorPos.y));
          ctx.strokeStyle = "rgba(59,130,246,0.5)";
          ctx.lineWidth = 4;
          ctx.setLineDash([6, 4]);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }

      // draw nodes
      const validNexts =
        currentNode !== null
          ? new Set(
            getUntraversedNeighbors(
              currentNode,
              currentPuzzle.edges,
              traversed
            )
          )
          : new Set<number>();

      currentPuzzle.nodes.forEach((n: any) => {
        const cx = toXY(n.x);
        const cy = toXY(n.y);
        const isStart = path.length > 0 && path[0] === n.id && currentNode !== n.id;
        const isCurrent = currentNode === n.id;
        const isValidNext = validNexts.has(n.id);

        // valid next highlight
        if (isValidNext) {
          ctx.beginPath();
          ctx.arc(cx, cy, NODE_RADIUS + 6, 0, Math.PI * 2);
          ctx.strokeStyle = "rgba(234,179,8,0.6)";
          ctx.lineWidth = 3;
          ctx.stroke();
        }

        // current node pulse
        if (isCurrent) {
          const pulseR = NODE_RADIUS + 8 + Math.sin(pulsePhase) * 4;
          ctx.beginPath();
          ctx.arc(cx, cy, pulseR, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(59,130,246,${0.4 + Math.sin(pulsePhase) * 0.2})`;
          ctx.lineWidth = 3;
          ctx.stroke();
        }

        // node body
        ctx.beginPath();
        ctx.arc(cx, cy, NODE_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = isCurrent
          ? "#3b82f6"
          : isStart
            ? "#22c55e"
            : "#ffffff";
        ctx.fill();
        ctx.strokeStyle = isCurrent
          ? "#2563eb"
          : isStart
            ? "#16a34a"
            : "#475569";
        ctx.lineWidth = 3;
        ctx.stroke();
      });

      // celebration sparkles
      if (phase === "celebrate") {
        for (let i = 0; i < 20; i++) {
          const angle = (pulsePhase * 2 + i * 0.314) % (Math.PI * 2);
          const r = 30 + Math.sin(pulsePhase + i) * 60;
          const sx = canvasSize / 2 + Math.cos(angle) * r;
          const sy = canvasSize / 2 + Math.sin(angle) * r;
          ctx.beginPath();
          ctx.arc(sx, sy, 3 + Math.sin(pulsePhase + i * 0.5) * 2, 0, Math.PI * 2);
          ctx.fillStyle = `hsl(${(i * 36 + pulsePhase * 50) % 360}, 80%, 65%)`;
          ctx.fill();
        }
        // flash edges gold
        currentPuzzle.edges.forEach((e: any) => {
          const nA = currentPuzzle.nodes.find((n: any) => n.id === e.from);
          const nB = currentPuzzle.nodes.find((n: any) => n.id === e.to);
          if (!nA || !nB) return;
          ctx.beginPath();
          ctx.moveTo(toXY(nA.x), toXY(nA.y));
          ctx.lineTo(toXY(nB.x), toXY(nB.y));
          ctx.strokeStyle = `rgba(234,179,8,${0.6 + Math.sin(pulsePhase * 3) * 0.4})`;
          ctx.lineWidth = 7;
          ctx.lineCap = "round";
          ctx.stroke();
        });
      }

      rafId = requestAnimationFrame(draw);
    };

    rafId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafId);
  }, [
    currentPuzzle,
    canvasSize,
    traversed,
    currentNode,
    cursorPos,
    path,
    showHint,
    phase,
  ]);

  /* ─── render ─── */
  if (phase === "result") {
    const acc =
      PUZZLES_PER_SESSION > 0 ? firstAttemptSolves / PUZZLES_PER_SESSION : 0;
    const avg =
      puzzleTimes.length > 0
        ? Math.round(
          puzzleTimes.reduce((a, b) => a + b, 0) / puzzleTimes.length
        )
        : 0;
    return (
      <GameResult
        score={score}
        accuracy={acc}
        avgReactionTime={avg}
        nextDifficulty={difficulty}
        currentDifficulty={storedDiff}
        onPlayAgain={() => {
          setPhase("ready");
        }}
        onGoHome={() => {
          window.location.href = "/games";
        }}
        gameType={GAME_TYPE}
      />
    );
  }

  if (phase === "ready") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 flex items-center justify-center p-4">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-full max-w-sm bg-slate-800/80 backdrop-blur rounded-3xl p-6 sm:p-8 text-center shadow-2xl ring-1 ring-white/10"
        >
          <div className="text-6xl mb-4">✏️</div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white mb-2">
            Monoline Puzzle
          </h1>
          <p className="text-gray-400 text-sm mb-6">
            Trace every line in one continuous stroke without lifting!
          </p>
          <div className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-blue-500/20 text-blue-300 ring-1 ring-blue-500/30 mb-6">
            Level {config.level} — {config.label}
          </div>
          <button
            onClick={startGame}
            className="w-full py-3 rounded-xl font-bold text-lg bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white transition-all shadow-lg"
          >
            Start
          </button>
          <button
            onClick={() => (window.location.href = "/games")}
            className="mt-3 w-full py-2 rounded-xl font-semibold text-sm text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 transition-all"
          >
            ← Back to Games
          </button>
        </motion.div>
      </div>
    );
  }

  /* playing / celebrate */
  return (
    <GameWrapper
      title="Monoline Puzzle"
      difficulty={config.level}
      timeLimit={config.timeLimit}
      onTimeUp={handleTimeUp}
      onExit={() => (window.location.href = "/games")}
      score={score}
    >
      <div className="flex flex-col items-center w-full px-2">
        {/* instruction on first puzzle */}
        {puzzleIdx === 0 && attemptCount === 0 && path.length === 0 && (
          <motion.p
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-gray-400 text-xs sm:text-sm mb-2 text-center"
          >
            Trace all lines without lifting your finger!
          </motion.p>
        )}

        {/* warning banner */}
        {warning && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-2 px-4 py-1.5 rounded-lg bg-red-500/20 text-red-300 text-xs sm:text-sm font-semibold ring-1 ring-red-500/30"
          >
            {warning}
          </motion.div>
        )}

        {/* canvas */}
        <motion.div
          ref={containerRef}
          animate={shaking ? { x: [0, -6, 6, -4, 4, 0] } : {}}
          transition={{ duration: 0.4 }}
          className="w-full max-w-[480px] aspect-square relative select-none touch-none"
        >
          <canvas
            ref={canvasRef}
            style={{ width: canvasSize, height: canvasSize }}
            className="rounded-2xl bg-gray-900/60 ring-1 ring-white/10 cursor-crosshair"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
          />
        </motion.div>

        {/* controls row */}
        <div className="mt-3 flex flex-wrap items-center justify-center gap-3">
          {/* puzzle indicator */}
          <span className="text-gray-400 text-xs sm:text-sm font-semibold">
            Puzzle {puzzleIdx + 1} of {PUZZLES_PER_SESSION}
          </span>

          {/* attempt dots */}
          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(attemptCount + 1, 5) }).map(
              (_, i) => (
                <span
                  key={i}
                  className={`w-2 h-2 rounded-full ${i < attemptCount ? "bg-orange-400" : "bg-gray-600"
                    }`}
                />
              )
            )}
          </div>

          {/* reset button */}
          <button
            onClick={resetAttempt}
            disabled={phase === "celebrate"}
            className="px-3 py-1 rounded-lg text-xs font-semibold bg-white/10 hover:bg-white/20 text-gray-300 transition-all disabled:opacity-40"
          >
            Reset
          </button>

          {/* hint toggle */}
          {config.hintEnabled && (
            <button
              onClick={() => setShowHint((h) => !h)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${showHint
                  ? "bg-yellow-500/20 text-yellow-300 ring-1 ring-yellow-500/30"
                  : "bg-white/10 text-gray-300 hover:bg-white/20"
                }`}
            >
              {showHint ? "Hide Hint" : "Show Hint"}
            </button>
          )}
        </div>

        {/* puzzle name */}
        {currentPuzzle && (
          <p className="mt-2 text-gray-500 text-[10px] uppercase tracking-widest font-bold">
            {currentPuzzle.name}
          </p>
        )}
      </div>
    </GameWrapper>
  );
}
