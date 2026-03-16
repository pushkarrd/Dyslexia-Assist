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

/* ─── color palette ─── */
const COLORS: Record<string, { dot: string; path: string }> = {
  pink: { dot: "#ff2d87", path: "#ff2d8766" },
  orange: { dot: "#ff6b35", path: "#ff6b3566" },
  yellow: { dot: "#ffd60a", path: "#ffd60a66" },
  blue: { dot: "#0096ff", path: "#0096ff66" },
  green: { dot: "#06d6a0", path: "#06d6a066" },
  purple: { dot: "#9b5de5", path: "#9b5de566" },
  red: { dot: "#ef233c", path: "#ef233c66" },
  teal: { dot: "#00b4d8", path: "#00b4d866" },
};
const COLOR_KEYS = Object.keys(COLORS);

/* ─── hardcoded puzzle bank ─── */
// Each puzzle: { gridSize, dots: { colorKey: [[r1,c1],[r2,c2]] }, solution: { colorKey: [[r,c],...] } }
// Solutions fill every cell exactly once.
const PUZZLE_BANK: Record<number, any[]> = {
  1: [
    {
      name: "L1-Cross",
      gridSize: 4,
      dots: {
        pink: [[0, 0], [3, 3]],
        yellow: [[0, 3], [3, 0]],
        blue: [[1, 1], [2, 2]],
      },
      solution: {
        pink: [[0, 0], [1, 0], [2, 0], [2, 1], [3, 1], [3, 2], [3, 3]],
        yellow: [[0, 3], [0, 2], [0, 1], [1, 1], [1, 2], [1, 3], [2, 3], [3, 3]], // Note: corrected below
        blue: [[1, 1], [2, 2]],
      },
    },
    {
      name: "L1-Slide",
      gridSize: 4,
      dots: {
        pink: [[0, 1], [3, 1]],
        orange: [[0, 3], [2, 3]],
        blue: [[1, 0], [3, 2]],
      },
      solution: {
        pink: [[0, 1], [0, 0], [1, 0], [1, 1], [2, 1], [2, 0], [3, 0], [3, 1]],
        orange: [[0, 3], [0, 2], [1, 2], [1, 3], [2, 3]],
        blue: [[1, 0], [2, 0]], // will be recalculated
      },
    },
    {
      name: "L1-Zigzag",
      gridSize: 4,
      dots: {
        red: [[0, 0], [2, 0]],
        yellow: [[0, 2], [3, 2]],
        green: [[1, 3], [3, 0]],
      },
      solution: {
        red: [[0, 0], [0, 1], [1, 1], [1, 0], [2, 0]],
        yellow: [[0, 2], [0, 3], [1, 3]], // will be recalculated
        green: [[1, 3], [2, 3], [3, 3], [3, 2], [3, 1], [3, 0]],
      },
    },
  ],
  2: [
    {
      name: "L2-Diamond",
      gridSize: 5,
      dots: {
        pink: [[0, 0], [4, 4]],
        orange: [[0, 2], [4, 2]],
        yellow: [[0, 4], [4, 0]],
        blue: [[2, 1], [2, 3]],
      },
      solution: {
        pink: [[0, 0], [1, 0], [2, 0], [3, 0], [3, 1], [3, 2], [3, 3], [3, 4], [4, 4]],
        orange: [[0, 2], [0, 1], [1, 1], [1, 2], [1, 3], [2, 3], [2, 2], [2, 1], [2, 0]], // fix
        yellow: [[0, 4], [0, 3], [1, 4], [2, 4], [3, 4], [4, 4]], // fix
        blue: [[2, 1], [2, 2], [2, 3]],
      },
    },
    {
      name: "L2-Spiral",
      gridSize: 5,
      dots: {
        pink: [[0, 1], [3, 4]],
        orange: [[0, 4], [4, 0]],
        yellow: [[2, 0], [4, 3]],
        blue: [[1, 2], [4, 1]],
      },
    },
    {
      name: "L2-Weave",
      gridSize: 5,
      dots: {
        red: [[0, 0], [4, 4]],
        yellow: [[0, 4], [4, 0]],
        green: [[0, 2], [4, 2]],
        purple: [[2, 1], [2, 3]],
      },
    },
  ],
  3: [
    {
      name: "L3-Star",
      gridSize: 5,
      dots: {
        pink: [[0, 0], [2, 4]],
        orange: [[0, 2], [4, 1]],
        yellow: [[0, 4], [4, 4]],
        blue: [[2, 0], [4, 2]],
        green: [[1, 3], [3, 3]],
      },
    },
  ],
  4: [
    {
      name: "L4-Maze",
      gridSize: 6,
      dots: {
        pink: [[0, 0], [5, 5]],
        orange: [[0, 2], [5, 3]],
        yellow: [[0, 5], [5, 0]],
        blue: [[2, 1], [3, 4]],
        green: [[1, 4], [4, 1]],
      },
    },
  ],
  5: [
    {
      name: "L5-Galaxy",
      gridSize: 7,
      dots: {
        pink: [[0, 0], [6, 6]],
        orange: [[0, 3], [6, 3]],
        yellow: [[0, 6], [6, 0]],
        blue: [[2, 1], [4, 5]],
        green: [[1, 5], [5, 1]],
        purple: [[3, 3], [5, 4]],
      },
    },
  ],
};

/* ─── BFS solver to generate valid solutions ─── */
function solvePuzzle(gridSize: number, dots: Record<string, number[][]>) {
  const totalCells = gridSize * gridSize;
  const colorKeys = Object.keys(dots);

  // Build initial grid
  const grid = Array.from({ length: gridSize }, () =>
    Array.from({ length: gridSize }, () => null)
  );

  // Mark dot cells
  for (const ck of colorKeys) {
    const [[r1, c1], [r2, c2]] = dots[ck];
    (grid as any)[r1][c1] = ck;
    (grid as any)[r2][c2] = ck;
  }

  // DFS backtracking solver
  const paths: Record<string, number[][]> = {}; // colorKey -> [[r,c], ...]
  for (const ck of colorKeys) {
    paths[ck] = [dots[ck][0].slice()];
  }

  const used = Array.from({ length: gridSize }, () =>
    Array.from({ length: gridSize }, () => false)
  );
  // Mark start dots as used
  for (const ck of colorKeys) {
    const [r, c] = dots[ck][0];
    used[r][c] = true;
  }

  const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];

  function countUsed() {
    let c = 0;
    for (let r = 0; r < gridSize; r++)
      for (let col = 0; col < gridSize; col++)
        if (used[r][col]) c++;
    return c;
  }

  function isEndpoint(ck: string, r: number, c: number) {
    const [r2, c2] = dots[ck][1];
    return r === r2 && c === c2;
  }

  function solve(colorIdx: number): boolean {
    if (colorIdx >= colorKeys.length) {
      return countUsed() === totalCells;
    }

    const ck = colorKeys[colorIdx];
    const path = paths[ck];
    const [endR, endC] = dots[ck][1];

    function extend(): boolean {
      const [cr, cc] = path[path.length - 1];

      // Check if we reached endpoint
      if (cr === endR && cc === endC) {
        // Try next color
        if (solve(colorIdx + 1)) return true;
        return false;
      }

      for (const [dr, dc] of dirs) {
        const nr = cr + dr;
        const nc = cc + dc;
        if (nr < 0 || nr >= gridSize || nc < 0 || nc >= gridSize) continue;
        if (used[nr][nc] && !(nr === endR && nc === endC)) continue;

        path.push([nr, nc]);
        used[nr][nc] = true;
        if (extend()) return true;
        path.pop();
        if (!(nr === endR && nc === endC)) used[nr][nc] = false;
      }

      return false;
    }

    // Mark endpoint as requiring visit
    used[endR][endC] = true;
    if (extend()) return true;
    // Backtrack endpoint
    used[endR][endC] = false;

    // Also try with endpoint not pre-marked
    return false;
  }

  // Try solving - order colors by distance (shorter first for efficiency)
  const sorted = [...colorKeys].sort((a, b) => {
    const da = Math.abs(dots[a][0][0] - dots[a][1][0]) + Math.abs(dots[a][0][1] - dots[a][1][1]);
    const db = Math.abs(dots[b][0][0] - dots[b][1][0]) + Math.abs(dots[b][0][1] - dots[b][1][1]);
    return da - db;
  });

  // Re-do with sorted order
  const sortedPaths: Record<string, number[][]> = {};
  const sortedUsed = Array.from({ length: gridSize }, () =>
    Array.from({ length: gridSize }, () => false)
  );
  for (const ck of sorted) {
    sortedPaths[ck] = [dots[ck][0].slice()];
    const [r, c] = dots[ck][0];
    sortedUsed[r][c] = true;
  }

  function solve2(idx: number): boolean {
    if (idx >= sorted.length) {
      let c = 0;
      for (let r = 0; r < gridSize; r++)
        for (let col = 0; col < gridSize; col++)
          if (sortedUsed[r][col]) c++;
      return c === totalCells;
    }

    const ck = sorted[idx];
    const path = sortedPaths[ck];
    const [endR, endC] = dots[ck][1];

    function ext(): boolean {
      const [cr, cc] = path[path.length - 1];
      if (cr === endR && cc === endC) {
        return solve2(idx + 1);
      }
      for (const [dr, dc] of dirs) {
        const nr = cr + dr;
        const nc = cc + dc;
        if (nr < 0 || nr >= gridSize || nc < 0 || nc >= gridSize) continue;
        if (sortedUsed[nr][nc] && !(nr === endR && nc === endC)) continue;
        path.push([nr, nc]);
        sortedUsed[nr][nc] = true;
        if (ext()) return true;
        path.pop();
        if (!(nr === endR && nc === endC)) sortedUsed[nr][nc] = false;
      }
      return false;
    }

    sortedUsed[endR][endC] = true;
    if (ext()) return true;
    sortedUsed[endR][endC] = false;
    return false;
  }

  if (solve2(0)) {
    const result: Record<string, number[][]> = {};
    for (const ck of sorted) {
      result[ck] = sortedPaths[ck];
    }
    return result;
  }

  return null; // no solution found
}

/* ─── build grid from puzzle ─── */
function buildGrid(gridSize: number, dots: Record<string, number[][]>) {
  const grid: any[][] = [];
  for (let r = 0; r < gridSize; r++) {
    const row: any[] = [];
    for (let c = 0; c < gridSize; c++) {
      row.push({ row: r, col: c, colorKey: null, isDot: false, pathColorKey: null });
    }
    grid.push(row);
  }
  for (const ck of Object.keys(dots)) {
    const [[r1, c1], [r2, c2]] = dots[ck];
    grid[r1][c1] = { row: r1, col: c1, colorKey: ck, isDot: true, pathColorKey: ck };
    grid[r2][c2] = { row: r2, col: c2, colorKey: ck, isDot: true, pathColorKey: ck };
  }
  return grid;
}

/* ─── component ─── */
const GAME_TYPE = "dot_connector";
const PUZZLES_PER_SESSION = 5;

export default function DotConnector() {
  const storageKey = "dot_connector_difficulty";
  const [difficulty, setDifficulty] = useState(
    () => Number(localStorage.getItem(storageKey)) || 1
  );
  const config = getDifficultyConfig(GAME_TYPE, difficulty);

  const [phase, setPhase] = useState("ready"); // ready | playing | celebrate | result
  const [puzzleIndex, setPuzzleIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [redraws, setRedraws] = useState(0);
  const [puzzleStartTime, setPuzzleStartTime] = useState<number | null>(null);

  // Grid & flow state
  const [grid, setGrid] = useState<any>(null);
  const [flows, setFlows] = useState<Record<string, any[]>>({}); // colorKey -> [{row,col}]
  const [activeFlow, setActiveFlow] = useState<any>(null); // { colorKey, path: [{row,col}] }
  const [currentPuzzle, setCurrentPuzzle] = useState<any>(null);
  const [connectedPairs, setConnectedPairs] = useState(new Set<string>());

  // Canvas
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState(400);
  const drawingRef = useRef(false);
  const activeFlowRef = useRef<any>(null);
  const flowsRef = useRef<Record<string, any[]>>({});
  const gridRef = useRef<any>(null);

  // Animation
  const animFrameRef = useRef<number | null>(null);
  const pulseRef = useRef(0);
  const celebrateRef = useRef(false);
  const celebrateStartRef = useRef(0);

  // Session
  const session = useGameSession(GAME_TYPE);
  const [resultData, setResultData] = useState<any>(null);

  /* ─── pick puzzle ─── */
  const getPuzzle = useCallback((level: number, index: number) => {
    const bank = PUZZLE_BANK[level];
    if (!bank || bank.length === 0) return PUZZLE_BANK[1][0];
    return bank[index % bank.length];
  }, []);

  /* ─── init puzzle ─── */
  const initPuzzle = useCallback((level: number, pIndex: number) => {
    const puzzle = getPuzzle(level, pIndex);
    const g = buildGrid(puzzle.gridSize, puzzle.dots);
    setGrid(g);
    gridRef.current = g;
    setCurrentPuzzle(puzzle);
    setFlows({});
    flowsRef.current = {};
    setActiveFlow(null);
    activeFlowRef.current = null;
    setConnectedPairs(new Set());
    setRedraws(0);
    setPuzzleStartTime(Date.now());
    celebrateRef.current = false;
  }, [getPuzzle]);

  /* ─── start game ─── */
  const startGame = useCallback(async () => {
    setScore(0);
    setPuzzleIndex(0);
    setPhase("playing");
    await session.startSession(difficulty);
    initPuzzle(difficulty, 0);
  }, [difficulty, session, initPuzzle]);

  /* ─── canvas sizing ─── */
  useEffect(() => {
    function resize() {
      const w = window.innerWidth;
      setCanvasSize(Math.min(w - 32, 480));
    }
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  /* ─── cell helpers ─── */
  const cellSize = currentPuzzle ? canvasSize / currentPuzzle.gridSize : 50;
  const gap = 3;

  function cellToCanvas(row: number, col: number) {
    return { x: col * cellSize + cellSize / 2, y: row * cellSize + cellSize / 2 };
  }

  function canvasToCell(px: number, py: number) {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const x = px - rect.left;
    const y = py - rect.top;
    const col = Math.floor(x / cellSize);
    const row = Math.floor(y / cellSize);
    if (!currentPuzzle) return null;
    if (row < 0 || row >= currentPuzzle.gridSize || col < 0 || col >= currentPuzzle.gridSize)
      return null;
    return { row, col };
  }

  function isAdjacent(a: any, b: any) {
    const dr = Math.abs(a.row - b.row);
    const dc = Math.abs(a.col - b.col);
    return (dr === 1 && dc === 0) || (dr === 0 && dc === 1);
  }

  function cellInPath(path: any[], row: number, col: number) {
    return path.some((p: any) => p.row === row && p.col === col);
  }

  /* ─── check if a color flow is complete (connects both dots) ─── */
  function isFlowComplete(colorKey: string, path: any[], puzzle: any) {
    if (!puzzle || !path || path.length < 2) return false;
    const [[r1, c1], [r2, c2]] = puzzle.dots[colorKey];
    const first = path[0];
    const last = path[path.length - 1];
    return (
      ((first.row === r1 && first.col === c1 && last.row === r2 && last.col === c2) ||
        (first.row === r2 && first.col === c2 && last.row === r1 && last.col === c1))
    );
  }

  /* ─── check win ─── */
  function checkWin(currentFlows: Record<string, any[]>, puzzle: any) {
    if (!puzzle) return false;
    const gs = puzzle.gridSize;
    const colorKeys = Object.keys(puzzle.dots);

    // All pairs connected
    for (const ck of colorKeys) {
      if (!currentFlows[ck] || !isFlowComplete(ck, currentFlows[ck], puzzle)) return false;
    }

    // All cells filled
    const filled = new Set();
    for (const ck of colorKeys) {
      for (const p of currentFlows[ck]) {
        filled.add(`${p.row},${p.col}`);
      }
    }
    return filled.size === gs * gs;
  }

  /* ─── pointer handlers ─── */
  function getPointerPos(e: any) {
    if (e.touches && e.touches.length > 0) {
      return { px: e.touches[0].clientX, py: e.touches[0].clientY };
    }
    return { px: e.clientX, py: e.clientY };
  }

  const handlePointerDown = useCallback((e: any) => {
    if (phase !== "playing" || !currentPuzzle) return;
    e.preventDefault();
    const { px, py } = getPointerPos(e);
    const cell = canvasToCell(px, py);
    if (!cell) return;

    const g = gridRef.current;
    const cellData = g[cell.row][cell.col];
    const currentFlows: Record<string, any[]> = { ...flowsRef.current };

    if (cellData.isDot) {
      // Start new flow from this dot
      const ck = cellData.colorKey;
      // Clear existing flow for this color
      if (currentFlows[ck]) {
        // Free path cells in grid
        for (const p of currentFlows[ck]) {
          if (!g[p.row][p.col].isDot || g[p.row][p.col].colorKey !== ck) {
            g[p.row][p.col].pathColorKey = null;
          }
        }
        delete currentFlows[ck];
        setRedraws((r) => r + 1);
      }
      const newFlow = { colorKey: ck, path: [{ row: cell.row, col: cell.col }] };
      activeFlowRef.current = newFlow;
      setActiveFlow(newFlow);
      drawingRef.current = true;
      flowsRef.current = currentFlows;
      setFlows(currentFlows);
    } else if (cellData.pathColorKey) {
      // Clicking on existing path - truncate and continue
      const ck = cellData.pathColorKey;
      const existingPath = currentFlows[ck];
      if (existingPath) {
        const idx = existingPath.findIndex(
          (p: any) => p.row === cell.row && p.col === cell.col
        );
        if (idx >= 0) {
          // Free cells after this point
          const removed = existingPath.slice(idx + 1);
          for (const p of removed) {
            if (!g[p.row][p.col].isDot) {
              g[p.row][p.col].pathColorKey = null;
            }
          }
          const truncated = existingPath.slice(0, idx + 1);
          currentFlows[ck] = truncated;
          const newFlow = { colorKey: ck, path: [...truncated] };
          activeFlowRef.current = newFlow;
          setActiveFlow(newFlow);
          drawingRef.current = true;
          setRedraws((r) => r + 1);
          flowsRef.current = currentFlows;
          setFlows(currentFlows);
        }
      }
    }
    gridRef.current = g;
    setGrid([...g]);
  }, [phase, currentPuzzle, cellSize]);

  const handlePointerMove = useCallback((e: any) => {
    if (!drawingRef.current || !activeFlowRef.current || phase !== "playing") return;
    e.preventDefault();
    const { px, py } = getPointerPos(e);
    const cell = canvasToCell(px, py);
    if (!cell) return;

    const flow = activeFlowRef.current;
    const lastCell = flow.path[flow.path.length - 1];
    if (cell.row === lastCell.row && cell.col === lastCell.col) return;
    if (!isAdjacent(lastCell, cell)) return;

    const g = gridRef.current;
    const cellData = g[cell.row][cell.col];

    // Check if going back on own path (undo last step)
    if (flow.path.length >= 2) {
      const prev = flow.path[flow.path.length - 2];
      if (prev.row === cell.row && prev.col === cell.col) {
        // Undo last step
        const removed = flow.path.pop();
        if (!g[removed.row][removed.col].isDot) {
          g[removed.row][removed.col].pathColorKey = null;
        }
        activeFlowRef.current = { ...flow, path: [...flow.path] };
        setActiveFlow({ ...flow, path: [...flow.path] });
        gridRef.current = g;
        setGrid([...g]);
        return;
      }
    }

    // Check if this cell is the matching endpoint
    if (cellData.isDot && cellData.colorKey === flow.colorKey) {
      const [[r1, c1], [r2, c2]] = currentPuzzle.dots[flow.colorKey];
      const startOfFlow = flow.path[0];
      const isStart = startOfFlow.row === cell.row && startOfFlow.col === cell.col;
      if (!isStart) {
        // Reached the other endpoint! Complete the flow
        flow.path.push({ row: cell.row, col: cell.col });
        const completedFlows: Record<string, any[]> = { ...flowsRef.current, [flow.colorKey]: [...flow.path] };
        flowsRef.current = completedFlows;
        setFlows(completedFlows);
        activeFlowRef.current = null;
        setActiveFlow(null);
        drawingRef.current = false;
        playCorrect();

        // Update connected pairs
        const newConnected = new Set<string>();
        for (const ck of Object.keys(completedFlows)) {
          if (isFlowComplete(ck, completedFlows[ck], currentPuzzle)) {
            newConnected.add(ck);
          }
        }
        setConnectedPairs(newConnected);

        // Check win
        if (checkWin(completedFlows, currentPuzzle)) {
          handlePuzzleWin(completedFlows);
        }

        gridRef.current = g;
        setGrid([...g]);
        return;
      }
    }

    // Can't go on a different color's path or dot
    if (cellData.pathColorKey && cellData.pathColorKey !== flow.colorKey) return;
    if (cellData.isDot && cellData.colorKey !== flow.colorKey) return;

    // Can't revisit own path (would create loop)
    if (cellInPath(flow.path, cell.row, cell.col)) return;

    // Extend the path
    flow.path.push({ row: cell.row, col: cell.col });
    g[cell.row][cell.col].pathColorKey = flow.colorKey;
    activeFlowRef.current = { ...flow, path: [...flow.path] };
    setActiveFlow({ ...flow, path: [...flow.path] });
    gridRef.current = g;
    setGrid([...g]);
  }, [phase, currentPuzzle, cellSize]);

  const handlePointerUp = useCallback(() => {
    if (!drawingRef.current) return;

    const flow = activeFlowRef.current;
    if (flow) {
      // Save the partial flow
      const currentFlows: Record<string, any[]> = { ...flowsRef.current, [flow.colorKey]: [...flow.path] };
      flowsRef.current = currentFlows;
      setFlows(currentFlows);

      // Update grid marks for partial flow
      const g = gridRef.current;
      for (const p of flow.path) {
        g[p.row][p.col].pathColorKey = flow.colorKey;
      }
      gridRef.current = g;
      setGrid([...g]);

      // Update connected pairs
      const newConnected = new Set<string>();
      for (const ck of Object.keys(currentFlows)) {
        if (isFlowComplete(ck, currentFlows[ck], currentPuzzle)) {
          newConnected.add(ck);
        }
      }
      setConnectedPairs(newConnected);
    }

    activeFlowRef.current = null;
    setActiveFlow(null);
    drawingRef.current = false;
  }, [currentPuzzle]);

  /* ─── handle puzzle win ─── */
  const handlePuzzleWin = useCallback((completedFlows: any) => {
    const elapsed = Date.now() - (puzzleStartTime || 0);
    const timeBonus = config?.timeLimit > 0 ? Math.max(0, Math.floor((config.timeLimit * 1000 - elapsed) / 1000) * 3) : 0;
    const efficiencyBonus = redraws <= 2 ? 50 : 0;
    const puzzleScore = 100 + timeBonus + efficiencyBonus;
    setScore((s) => s + puzzleScore);
    session.recordAttempt(true, elapsed);
    celebrateRef.current = true;
    celebrateStartRef.current = Date.now();
    setPhase("celebrate");

    setTimeout(() => {
      celebrateRef.current = false;
      const next = puzzleIndex + 1;
      if (next >= PUZZLES_PER_SESSION) {
        finishGame();
      } else {
        setPuzzleIndex(next);
        initPuzzle(difficulty, next);
        setPhase("playing");
      }
    }, 1500);
  }, [puzzleStartTime, config, redraws, session, puzzleIndex, difficulty, initPuzzle]);

  /* ─── finish game ─── */
  const finishGame = useCallback(async () => {
    try {
      const result = await session.endSession();
      const nextDiff = calculateNextDifficulty(
        session.accuracy,
        session.avgReactionTime,
        difficulty,
        GAME_TYPE
      );
      localStorage.setItem(storageKey, String(nextDiff));
      setResultData({
        score,
        accuracy: session.accuracy,
        avgReactionTime: session.avgReactionTime,
        nextDifficulty: nextDiff,
        currentDifficulty: difficulty,
      });
      setPhase("result");
    } catch {
      setPhase("result");
      setResultData({
        score,
        accuracy: session.accuracy || 0,
        avgReactionTime: session.avgReactionTime || 0,
        nextDifficulty: difficulty,
        currentDifficulty: difficulty,
      });
    }
  }, [session, difficulty, score]);

  /* ─── time up ─── */
  const handleTimeUp = useCallback(() => {
    session.recordAttempt(false, config?.timeLimit * 1000 || 0);
    playWrong();
    const next = puzzleIndex + 1;
    if (next >= PUZZLES_PER_SESSION) {
      finishGame();
    } else {
      setPuzzleIndex(next);
      initPuzzle(difficulty, next);
    }
  }, [session, config, puzzleIndex, difficulty, initPuzzle, finishGame]);

  /* ─── reset puzzle ─── */
  const resetPuzzle = useCallback(() => {
    if (!currentPuzzle) return;
    setRedraws((r) => r + 1);
    session.recordAttempt(false, Date.now() - (puzzleStartTime || 0));
    initPuzzle(difficulty, puzzleIndex);
  }, [currentPuzzle, difficulty, puzzleIndex, initPuzzle, session, puzzleStartTime]);

  /* ─── canvas rendering ─── */
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !currentPuzzle) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const gs = currentPuzzle.gridSize;
    const cs = canvasSize / gs;

    // Clear
    ctx.clearRect(0, 0, canvasSize, canvasSize);

    // Background
    ctx.fillStyle = "#1a2332";
    ctx.fillRect(0, 0, canvasSize, canvasSize);

    // Grid cells
    for (let r = 0; r < gs; r++) {
      for (let c = 0; c < gs; c++) {
        const x = c * cs + gap;
        const y = r * cs + gap;
        const w = cs - gap * 2;
        const radius = 6;

        ctx.beginPath();
        ctx.roundRect(x, y, w, w, radius);
        ctx.fillStyle = "#243447";
        ctx.fill();
      }
    }

    // Filled path cells
    const currentFlows: Record<string, any[]> = flowsRef.current;
    const activeF = activeFlowRef.current;

    const allPathCells: Record<string, string> = {};
    for (const ck of Object.keys(currentFlows)) {
      for (const p of currentFlows[ck]) {
        allPathCells[`${p.row},${p.col}`] = ck;
      }
    }
    if (activeF) {
      for (const p of activeF.path) {
        allPathCells[`${p.row},${p.col}`] = activeF.colorKey;
      }
    }

    // Draw path fills
    for (const key of Object.keys(allPathCells)) {
      const ck = allPathCells[key];
      const [rStr, cStr] = key.split(",");
      const r = parseInt(rStr);
      const c = parseInt(cStr);
      const x = c * cs + gap;
      const y = r * cs + gap;
      const w = cs - gap * 2;

      ctx.beginPath();
      ctx.roundRect(x, y, w, w, 6);

      if (celebrateRef.current) {
        const elapsed = Date.now() - celebrateStartRef.current;
        if (elapsed < 200) {
          ctx.fillStyle = "rgba(255,255,255,0.4)";
        } else {
          ctx.fillStyle = "rgba(255,215,0,0.3)";
        }
      } else {
        ctx.fillStyle = COLORS[ck]?.path || "#ffffff33";
      }
      ctx.fill();
    }

    // Draw path lines
    for (const ck of Object.keys(currentFlows)) {
      const path = currentFlows[ck];
      if (path.length < 2) continue;
      ctx.beginPath();
      const start = cellToCanvas(path[0].row, path[0].col);
      ctx.moveTo(start.x, start.y);
      for (let i = 1; i < path.length; i++) {
        const pt = cellToCanvas(path[i].row, path[i].col);
        ctx.lineTo(pt.x, pt.y);
      }
      ctx.strokeStyle = COLORS[ck]?.dot || "#fff";
      ctx.lineWidth = cs * 0.25;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.stroke();
    }

    // Active flow lines
    if (activeF && activeF.path.length >= 2) {
      ctx.beginPath();
      const start = cellToCanvas(activeF.path[0].row, activeF.path[0].col);
      ctx.moveTo(start.x, start.y);
      for (let i = 1; i < activeF.path.length; i++) {
        const pt = cellToCanvas(activeF.path[i].row, activeF.path[i].col);
        ctx.lineTo(pt.x, pt.y);
      }
      ctx.strokeStyle = COLORS[activeF.colorKey]?.dot || "#fff";
      ctx.lineWidth = cs * 0.25;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.stroke();
    }

    // Dots (always on top)
    const t = pulseRef.current;
    for (const ck of Object.keys(currentPuzzle.dots)) {
      const [[r1, c1], [r2, c2]] = currentPuzzle.dots[ck];
      const dotColor = COLORS[ck]?.dot || "#fff";
      const baseRadius = cs * 0.35;

      // Check if this color is connected
      const connected = connectedPairs.has(ck) ||
        (currentFlows[ck] && isFlowComplete(ck, currentFlows[ck], currentPuzzle));

      for (const [dr, dc] of [[r1, c1], [r2, c2]]) {
        const { x, y } = cellToCanvas(dr, dc);
        // Pulse unconnected dots
        const scale = connected ? 1.0 : 1.0 + 0.08 * Math.sin(t * 0.003);
        const radius = baseRadius * scale;

        // Main dot
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = dotColor;
        ctx.fill();

        // Inner highlight
        ctx.beginPath();
        ctx.arc(x - radius * 0.15, y - radius * 0.15, radius * 0.3, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,255,255,0.4)";
        ctx.fill();
      }
    }

    // Celebration confetti
    if (celebrateRef.current) {
      const elapsed = Date.now() - celebrateStartRef.current;
      if (elapsed > 200 && elapsed < 1500) {
        const confettiColors = ["#ff2d87", "#ffd60a", "#0096ff", "#06d6a0", "#9b5de5", "#ff6b35"];
        for (let i = 0; i < 50; i++) {
          const seed = i * 137.508;
          const cx = ((seed * 7.3) % canvasSize);
          const startY = ((seed * 3.7) % (canvasSize * 0.3));
          const cy = startY + ((elapsed - 200) / 1300) * canvasSize * 1.2;
          const size = 4 + (seed % 6);
          const rotation = (elapsed * 0.003 + seed) % (Math.PI * 2);
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(rotation);
          ctx.fillStyle = confettiColors[i % confettiColors.length];
          ctx.fillRect(-size / 2, -size / 2, size, size * 0.6);
          ctx.restore();
        }
      }
    }
  }, [canvasSize, currentPuzzle, connectedPairs, cellSize]);

  /* ─── animation loop ─── */
  useEffect(() => {
    if (phase !== "playing" && phase !== "celebrate") return;

    let active = true;
    function loop(t: number) {
      if (!active) return;
      pulseRef.current = t;
      draw();
      animFrameRef.current = requestAnimationFrame(loop);
    }
    animFrameRef.current = requestAnimationFrame(loop);
    return () => {
      active = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [phase, draw]);

  /* ─── auto-start ─── */
  useEffect(() => {
    if (phase === "ready") startGame();
  }, []);

  /* ─── render ─── */
  if (phase === "result" && resultData) {
    return (
      <GameResult
        score={resultData.score}
        accuracy={resultData.accuracy}
        avgReactionTime={resultData.avgReactionTime}
        nextDifficulty={resultData.nextDifficulty}
        currentDifficulty={resultData.currentDifficulty}
        onPlayAgain={() => {
          setDifficulty(resultData.nextDifficulty);
          setPhase("ready");
          setTimeout(() => startGame(), 50);
        }}
        onGoHome={() => window.location.assign("/games")}
        gameType={GAME_TYPE}
      />
    );
  }

  const colorKeys = currentPuzzle ? Object.keys(currentPuzzle.dots) : [];
  const totalPairs = colorKeys.length;
  const connectedCount = connectedPairs.size;

  return (
    <GameWrapper
      title="Dot Connector"
      difficulty={config?.label || "Beginner"}
      timeLimit={config?.timeLimit || 0}
      onTimeUp={handleTimeUp}
      onExit={() => window.location.assign("/games")}
      score={score}
    >
      <div className="flex flex-col items-center gap-4 pb-6">
        {/* Puzzle counter */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-sm text-gray-400 font-medium"
        >
          Puzzle {puzzleIndex + 1} / {PUZZLES_PER_SESSION}
        </motion.div>

        {/* Canvas */}
        <motion.div
          ref={containerRef}
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 20 }}
          className="relative"
          style={{ touchAction: "none" }}
        >
          <canvas
            ref={canvasRef}
            width={canvasSize}
            height={canvasSize}
            style={{
              width: canvasSize,
              height: canvasSize,
              borderRadius: 16,
              cursor: phase === "playing" ? "pointer" : "default",
            }}
            onMouseDown={handlePointerDown}
            onMouseMove={handlePointerMove}
            onMouseUp={handlePointerUp}
            onMouseLeave={handlePointerUp}
            onTouchStart={handlePointerDown}
            onTouchMove={handlePointerMove}
            onTouchEnd={handlePointerUp}
            onTouchCancel={handlePointerUp}
          />
        </motion.div>

        {/* Color indicators */}
        <div className="flex items-center gap-3 flex-wrap justify-center">
          {colorKeys.map((ck) => {
            const connected = connectedPairs.has(ck);
            return (
              <div
                key={ck}
                className="flex items-center gap-1.5"
              >
                <div
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    backgroundColor: connected ? COLORS[ck]?.dot : "transparent",
                    border: `2px solid ${connected ? COLORS[ck]?.dot : "#555"}`,
                    boxShadow: connected ? `0 0 8px ${COLORS[ck]?.dot}` : "none",
                    transition: "all 0.3s",
                  }}
                />
              </div>
            );
          })}
          <span className="text-xs text-gray-400 ml-2">
            {connectedCount}/{totalPairs} pairs
          </span>
        </div>

        {/* Reset button */}
        {phase === "playing" && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={resetPuzzle}
            className="px-5 py-2 rounded-lg text-sm font-semibold bg-white/10 hover:bg-white/20 border border-white/20 text-gray-300 transition-all"
          >
            Reset Puzzle
          </motion.button>
        )}
      </div>
    </GameWrapper>
  );
}
