"use client";

import { useRef, useEffect, useCallback } from "react";
import { useTheme } from "@/context/ThemeContext";

// ─── Constants ────────────────────────────────────
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const COLORS_DARK = [
  "#FF3B3B", "#FF7A00", "#FFD600", "#00E676", "#00B0FF",
  "#AA00FF", "#F50057", "#FF6D00", "#76FF03", "#1DE9B6",
  "#FFFFFF", "#FF4081", "#40C4FF", "#CCFF90", "#FFD740",
];
const COLORS_LIGHT = [
  "#7C3AED", "#A78BFA", "#C4B5FD", "#D946EF", "#F59E0B",
  "#D97706", "#10B981", "#06B6D4", "#8B5CF6", "#EC4899",
];

const TOTAL = 240;
const REPEL_RADIUS = 130;
const REPEL_FORCE = 6;

function rand(a: number, b: number) {
  return a + Math.random() * (b - a);
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ─── Letter class ─────────────────────────────────
class LetterParticle {
  x = 0;
  y = 0;
  baseVY = 0;
  vy = 0;
  vx = 0;
  char = "A";
  color = "#fff";
  size = 24;
  alpha = 1;
  rot = 0;
  rotSpeed = 0;
  fx = 0;
  fy = 0;

  constructor(
    private canvasW: number,
    private canvasH: number,
    private colors: string[],
    fromTop: boolean
  ) {
    this.reset(fromTop);
  }

  reset(fromTop: boolean) {
    this.x = rand(0, this.canvasW);
    this.y = fromTop ? rand(-300, -10) : rand(-this.canvasH, this.canvasH);
    this.baseVY = rand(1.2, 4.8);
    this.vy = this.baseVY;
    this.vx = rand(-0.5, 0.5);
    this.char = pick(LETTERS.split(""));
    this.color = pick(this.colors);
    this.size = rand(14, 52);
    this.alpha = rand(0.5, 1.0);
    this.rot = rand(-Math.PI, Math.PI);
    this.rotSpeed = rand(-0.025, 0.025);
    this.fx = 0;
    this.fy = 0;
  }

  update(mouseX: number, mouseY: number, scrollBoost: number) {
    const dx = this.x - mouseX;
    const dy = this.y - mouseY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < REPEL_RADIUS && dist > 0) {
      const strength = (1 - dist / REPEL_RADIUS) * REPEL_FORCE;
      this.fx += (dx / dist) * strength;
      this.fy += (dy / dist) * strength;
    }

    this.fx *= 0.88;
    this.fy *= 0.88;
    this.x += this.vx + this.fx;
    this.y += this.vy + this.fy + scrollBoost;
    this.rot += this.rotSpeed;

    if (Math.random() < 0.003) this.char = pick(LETTERS.split(""));

    return (
      this.y > this.canvasH + 100 ||
      this.x < -100 ||
      this.x > this.canvasW + 100
    );
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    ctx.globalAlpha = this.alpha;
    ctx.fillStyle = this.color;
    ctx.font = `bold ${this.size}px Arial, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(this.char, 0, 0);
    ctx.restore();
  }

  updateDimensions(w: number, h: number) {
    this.canvasW = w;
    this.canvasH = h;
  }
}

// ─── Component ────────────────────────────────────
export default function AlphabetRain() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lettersRef = useRef<LetterParticle[]>([]);
  const mouseRef = useRef({ x: 0, y: 0 });
  const scrollRef = useRef({ y: 0, prevY: 0 });
  const rafRef = useRef<number>(0);
  const { isDark } = useTheme();
  const isDarkRef = useRef(isDark);

  // Keep the ref in sync
  useEffect(() => {
    isDarkRef.current = isDark;
  }, [isDark]);

  // Check for reduced motion preference
  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

  const initLetters = useCallback(
    (w: number, h: number) => {
      const colors = isDarkRef.current ? COLORS_DARK : COLORS_LIGHT;
      const arr: LetterParticle[] = [];
      for (let i = 0; i < TOTAL; i++) {
        arr.push(new LetterParticle(w, h, colors, false));
      }
      return arr;
    },
    []
  );

  useEffect(() => {
    if (prefersReducedMotion) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Resize handler
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      // Update all letter dimensions
      for (const l of lettersRef.current) {
        l.updateDimensions(canvas.width, canvas.height);
      }
    };
    resize();

    // Initialize letters
    lettersRef.current = initLetters(canvas.width, canvas.height);

    // Mouse handler
    const onMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };

    // Touch handler
    const onTouchMove = (e: TouchEvent) => {
      const t = e.touches[0];
      mouseRef.current = { x: t.clientX, y: t.clientY };
    };

    // Scroll handler
    const onScroll = () => {
      scrollRef.current.y = window.scrollY;
    };

    // Click burst handler
    const onClick = (e: MouseEvent) => {
      const colors = isDarkRef.current ? COLORS_DARK : COLORS_LIGHT;
      for (let i = 0; i < 12; i++) {
        const l = new LetterParticle(canvas.width, canvas.height, colors, false);
        l.x = e.clientX + rand(-20, 20);
        l.y = e.clientY + rand(-20, 20);
        l.vy = rand(2, 6);
        l.vx = rand(-3, 3);
        lettersRef.current.push(l);
      }
    };

    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("scroll", onScroll);
    window.addEventListener("click", onClick);

    // Animation loop
    const animate = () => {
      const scrollVel = (scrollRef.current.y - scrollRef.current.prevY) * 0.4;
      scrollRef.current.prevY = scrollRef.current.y;
      const scrollBoost = Math.max(0, Math.min(scrollVel, 12));

      const dark = isDarkRef.current;

      // Clear
      if (dark) {
        ctx.fillStyle = "#000";
      } else {
        ctx.fillStyle = "#FFF9F0";
      }
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Update & draw
      const letters = lettersRef.current;
      for (let i = letters.length - 1; i >= 0; i--) {
        const l = letters[i];
        const dead = l.update(
          mouseRef.current.x,
          mouseRef.current.y,
          scrollBoost
        );
        // Reduce alpha in light mode for subtlety
        if (!dark) {
          ctx.globalAlpha = 0.35;
        }
        l.draw(ctx);
        ctx.globalAlpha = 1;

        if (dead) {
          if (i < TOTAL) {
            // Recycle core letters
            l.updateDimensions(canvas.width, canvas.height);
            const colors = dark ? COLORS_DARK : COLORS_LIGHT;
            l.color = pick(colors);
            l.reset(true);
          } else {
            // Remove burst letters
            letters.splice(i, 1);
          }
        }
      }

      // Cursor glow
      const grd = ctx.createRadialGradient(
        mouseRef.current.x, mouseRef.current.y, 0,
        mouseRef.current.x, mouseRef.current.y, 100
      );
      if (dark) {
        grd.addColorStop(0, "rgba(255,255,255,0.06)");
        grd.addColorStop(1, "rgba(0,0,0,0)");
      } else {
        grd.addColorStop(0, "rgba(124,58,237,0.06)");
        grd.addColorStop(1, "rgba(255,249,240,0)");
      }
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("click", onClick);
    };
  }, [prefersReducedMotion, initLetters]);

  // Reduced motion fallback
  if (prefersReducedMotion) {
    return (
      <div
        className="fixed inset-0 z-0 bg-background"
        aria-hidden="true"
      />
    );
  }

  return (
    <>
      <canvas
        ref={canvasRef}
        className="fixed inset-0 z-0"
        style={{ width: "100%", height: "100%" }}
        aria-hidden="true"
      />
    </>
  );
}
