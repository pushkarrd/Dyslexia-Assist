"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AudioUpload from "@/components/lecture/AudioUpload";
import { useAuth } from "@/context/AuthContext";
import useDyslexiaStore from "@/stores/dyslexiaStore";
import {
  Sparkles, BookOpen, Mic, PenTool, FileText,
  BarChart3, Gamepad2, ClipboardCheck, Flame,
  Eye, TrendingUp, Calendar, Activity, Zap,
} from "lucide-react";
import { createLecture } from "@/services/backendApi";
import { motion } from "framer-motion";

// ── Visit / streak helpers (localStorage) ─────────────────────────────────
function getTodayKey() {
  return new Date().toISOString().split("T")[0];
}

interface VisitData {
  currentStreak: number;
  bestStreak: number;
  todayVisits: number;
  totalVisits: number;
  lastVisitDate: string;
  dailyHistory: Record<string, number>;
}

function loadVisitData(): VisitData {
  try {
    const raw = localStorage.getItem("NeuroLexVisitData");
    if (raw) return JSON.parse(raw);
  } catch {}
  return { currentStreak: 0, bestStreak: 0, todayVisits: 0, totalVisits: 0, lastVisitDate: "", dailyHistory: {} };
}

function recordVisit(): VisitData {
  const today = getTodayKey();
  const data = loadVisitData();

  if (data.lastVisitDate !== today) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayKey = yesterday.toISOString().split("T")[0];
    if (data.lastVisitDate === yesterdayKey) {
      data.currentStreak += 1;
    } else if (data.lastVisitDate === "") {
      data.currentStreak = 1;
    } else {
      data.currentStreak = 1;
    }
    data.bestStreak = Math.max(data.bestStreak, data.currentStreak);
    data.lastVisitDate = today;
    data.todayVisits = 0;
  }

  data.todayVisits += 1;
  data.totalVisits += 1;
  data.dailyHistory[today] = data.todayVisits;
  const keys = Object.keys(data.dailyHistory).sort();
  if (keys.length > 7) {
    keys.slice(0, keys.length - 7).forEach(k => delete data.dailyHistory[k]);
  }
  try { localStorage.setItem("NeuroLexVisitData", JSON.stringify(data)); } catch {}
  return data;
}

function getLast7Days(history: Record<string, number>) {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split("T")[0];
    days.push({ key, label: d.toLocaleDateString("en", { weekday: "short" }), count: history[key] || 0 });
  }
  return days;
}

// ── Feature cards ──────────────────────────────────────────────────────────
const quickActions = [
  { label: "Reading Assistant", href: "/reading", icon: BookOpen, color: "from-indigo-500 to-blue-500", desc: "Read with dyslexia-friendly tools" },
  { label: "Lecture", href: "/lecture", icon: Mic, color: "from-violet-500 to-purple-500", desc: "Save & simplify lecture notes" },
  { label: "Handwriting", href: "/handwriting", icon: PenTool, color: "from-pink-500 to-rose-500", desc: "Analyse handwriting samples" },
  { label: "Content Generator", href: "/generator", icon: FileText, color: "from-amber-500 to-orange-500", desc: "Flashcards, quizzes & mind maps" },
  { label: "Progress Analytics", href: "/analytics", icon: BarChart3, color: "from-teal-500 to-green-500", desc: "Track your reading progress" },
  { label: "Games", href: "/games", icon: Gamepad2, color: "from-yellow-500 to-lime-500", desc: "Brain-training mini-games" },
  { label: "Screening Assessment", href: "/onboarding", icon: ClipboardCheck, color: "from-sky-500 to-cyan-500", desc: "Dyslexia screening questionnaire" },
];

export default function Dashboard() {
  const { dyslexicFont, toggleDyslexicFont } = useDyslexiaStore();
  const { currentUser } = useAuth();
  const router = useRouter();
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [visitData, setVisitData] = useState<VisitData>({
    currentStreak: 0, bestStreak: 0, todayVisits: 0,
    totalVisits: 0, lastVisitDate: "", dailyHistory: {},
  });

  useEffect(() => {
    const data = recordVisit();
    setVisitData(data);
    if (typeof window !== "undefined") {
      localStorage.setItem("dashboardVisited", "true");
      window.dispatchEvent(new Event("dashboardVisited"));
    }
  }, []);

  const getUserFirstName = () => {
    if (currentUser?.displayName) return currentUser.displayName.split(" ")[0];
    if (currentUser?.email) return currentUser.email.split("@")[0];
    return "Student";
  };

  const weekDays = getLast7Days(visitData.dailyHistory);
  const maxCount = Math.max(...weekDays.map(d => d.count), 1);

  const handleAudioUploadComplete = async (transcription: string) => {
    try {
      setShowUploadModal(false);
      if (!currentUser?.uid) { alert("Please log in to save your recording"); return; }
      const lectureId = await createLecture(currentUser.uid, transcription);
      router.push(`/lecture?id=${lectureId}&autoProcess=true`);
    } catch {
      alert("Failed to save transcription. Please try again.");
    }
  };

  return (
    <div className="min-h-screen">
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8 space-y-6 content-blur-card p-4 sm:p-6 md:p-8 m-4">

        {/* Welcome Banner */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4
                     rounded-2xl p-6
                     bg-gradient-to-r from-violet-600/30 via-purple-600/20 to-indigo-600/30
                     border border-violet-500/40 backdrop-blur-xl shadow-xl"
        >
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold text-foreground drop-shadow-md">
              Welcome back, {getUserFirstName()}! 👋
            </h1>
            <p className="text-foreground/70 mt-1 text-base font-medium">
              Ready to make learning easier today?
            </p>
          </div>
          <button
            onClick={toggleDyslexicFont}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all shrink-0 shadow-md ${
              dyslexicFont
                ? "bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-violet-500/40"
                : "bg-white/15 border border-white/25 text-foreground hover:bg-white/25 backdrop-blur-sm"
            }`}
          >
            <Sparkles className={`w-4 h-4 ${dyslexicFont ? "animate-pulse" : ""}`} />
            {dyslexicFont ? "Dyslexic Mode ON" : "Enable Dyslexic Mode"}
          </button>
        </motion.div>

        {/* Real-time Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { icon: Flame, label: "Day Streak", value: visitData.currentStreak, unit: "consecutive days", color: "text-orange-400", bg: "from-orange-500/25 to-red-500/15", border: "border-orange-500/35" },
            { icon: Eye, label: "Today's Visits", value: visitData.todayVisits, unit: "times today", color: "text-indigo-400", bg: "from-indigo-500/25 to-blue-500/15", border: "border-indigo-500/35" },
            { icon: TrendingUp, label: "Best Streak", value: visitData.bestStreak, unit: "personal best", color: "text-green-400", bg: "from-green-500/25 to-teal-500/15", border: "border-green-500/35" },
            { icon: Activity, label: "Total Visits", value: visitData.totalVisits, unit: "all time", color: "text-violet-400", bg: "from-violet-500/25 to-purple-500/15", border: "border-violet-500/35" },
          ].map(({ icon: Icon, label, value, unit, color, bg, border }) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`rounded-2xl p-5 bg-gradient-to-br ${bg} border ${border} backdrop-blur-xl shadow-lg focus-dimmable`}
            >
              <div className="flex items-center gap-2 mb-2">
                <Icon className={`w-4 h-4 ${color}`} />
                <span className="text-xs font-semibold text-foreground/60 uppercase tracking-wide">{label}</span>
              </div>
              <p className={`text-4xl font-black ${color} drop-shadow`}>{value}</p>
              <p className="text-xs text-foreground/50 mt-1 font-medium">{unit}</p>
            </motion.div>
          ))}
        </div>

        {/* Weekly Activity Bar Chart */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl p-6 bg-white/8 border border-white/15 backdrop-blur-xl shadow-xl"
        >
          <div className="flex items-center gap-2 mb-5">
            <Calendar className="w-5 h-5 text-violet-400" />
            <h2 className="text-lg font-bold text-foreground">Activity This Week</h2>
            <span className="ml-auto text-xs text-foreground/50 font-medium">visits per day</span>
          </div>
          <div className="flex items-end gap-2 h-28">
            {weekDays.map((day) => (
              <div key={day.key} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex items-end justify-center" style={{ height: "80px" }}>
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: `${Math.max((day.count / maxCount) * 80, day.count ? 8 : 0)}px` }}
                    transition={{ duration: 0.7, ease: "easeOut" }}
                    className={`w-full rounded-t-lg transition-all ${
                      day.key === getTodayKey()
                        ? "bg-gradient-to-t from-violet-600 to-purple-400 shadow-lg shadow-violet-500/30"
                        : day.count > 0
                        ? "bg-violet-500/45"
                        : "bg-white/8"
                    }`}
                  />
                </div>
                <span className="text-[10px] font-medium text-foreground/50">{day.label}</span>
              </div>
            ))}
          </div>
          {visitData.todayVisits > 1 && (
            <p className="mt-3 text-sm text-violet-300 font-medium flex items-center gap-2">
              <Zap className="w-4 h-4 text-yellow-400" />
              You&apos;ve opened NeuroLex <strong className="text-yellow-300">{visitData.todayVisits}×</strong> today — great dedication!
            </p>
          )}
        </motion.div>

        {/* Quick Actions */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-5 h-5 text-yellow-400" />
            <h2 className="text-lg font-bold text-foreground">Features</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {quickActions.map(({ label, href, icon: Icon, color, desc }) => (
              <Link key={href} href={href}>
                <motion.div
                  whileHover={{ scale: 1.03, y: -3 }}
                  whileTap={{ scale: 0.97 }}
                  className="rounded-2xl p-5 bg-white/8 border border-white/12 backdrop-blur-xl
                             hover:bg-white/14 hover:border-white/22 transition-all cursor-pointer group shadow-md hover:shadow-xl focus-dimmable"
                >
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center mb-3 shadow-lg group-hover:scale-110 transition-transform`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <p className="font-bold text-foreground text-sm">{label}</p>
                  <p className="text-xs text-foreground/55 mt-1 leading-relaxed font-medium">{desc}</p>
                </motion.div>
              </Link>
            ))}

            {/* Upload audio card */}
            <motion.div
              whileHover={{ scale: 1.03, y: -3 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => setShowUploadModal(true)}
              className="rounded-2xl p-5 bg-white/8 border border-dashed border-violet-500/50 backdrop-blur-xl
                         hover:bg-white/14 hover:border-violet-400/70 transition-all cursor-pointer group shadow-md hover:shadow-xl"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center mb-3 shadow-lg group-hover:scale-110 transition-transform">
                <Mic className="w-5 h-5 text-white" />
              </div>
              <p className="font-bold text-foreground text-sm">Upload Audio</p>
              <p className="text-xs text-foreground/55 mt-1 leading-relaxed font-medium">Upload a lecture recording to simplify</p>
            </motion.div>
          </div>
        </div>

        {/* Streak celebration */}
        {visitData.currentStreak >= 3 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-2xl p-5 bg-gradient-to-r from-orange-500/20 to-yellow-500/15
                       border border-orange-500/35 backdrop-blur-xl shadow-lg flex items-center gap-4"
          >
            <Flame className="w-8 h-8 text-orange-400 shrink-0" />
            <div>
              <p className="font-bold text-foreground text-base">
                🔥 {visitData.currentStreak}-day streak!
              </p>
              <p className="text-sm text-foreground/65 font-medium mt-0.5">
                You&apos;ve been practising consistently. Keep it going!
              </p>
            </div>
          </motion.div>
        )}

      </div>

      {showUploadModal && (
        <AudioUpload
          onUploadComplete={handleAudioUploadComplete}
          onClose={() => setShowUploadModal(false)}
        />
      )}
    </div>
  );
}
