"use client";

import Link from "next/link";
import { Mic, Radio, Bot, Save, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import Footer from "@/components/layout/Footer";

const steps = [
  {
    num: "01",
    icon: Mic,
    title: "Audio Recording",
    color: "from-violet-500 to-purple-500",
    items: [
      "Record Audio (Web Audio API)",
      "Convert to Text (Web Speech API) - REAL-TIME!",
      "Send text chunks to backend every 5-10 seconds",
    ],
  },
  {
    num: "02",
    icon: Radio,
    title: "Real-time Transfer",
    color: "from-purple-500 to-fuchsia-500",
    items: [
      "WebSocket or HTTP POST",
      "Real-time text chunks transmission",
      "Continuous data streaming",
    ],
  },
  {
    num: "03",
    icon: Bot,
    title: "Backend Processing",
    color: "from-emerald-500 to-teal-500",
    items: [
      "Receive Text Chunk \u2192 Process with Gemini",
      "Simplify to Simple English",
      "Generate Step-by-Step Explanation",
    ],
  },
  {
    num: "04",
    icon: Save,
    title: "Export and Save",
    color: "from-amber-500 to-orange-500",
    items: [
      "Save to Firestore",
      "Frontend listens in real-time",
      "Instant updates and synchronization",
    ],
  },
];

export default function About() {
  return (
    <div className="min-h-screen">
      {/* How It Works Section */}
      <section className="py-24 md:py-32 px-6 sm:px-8 md:px-12">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16 md:mb-20"
          >
            <h2 className="text-4xl sm:text-5xl md:text-6xl font-black mb-6 leading-tight text-foreground">
              How NeuroLex Works
            </h2>
            <p className="reading-content text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
              Three-step detection pipeline
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map((s, i) => (
              <motion.div
                key={s.num}
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                whileHover={{ scale: 1.04, y: -4 }}
                className="glass-card p-8 rounded-3xl transition-all duration-300 hover:shadow-xl focus-dimmable"
              >
                <div className="text-center mb-6">
                  <div className="text-6xl font-black text-foreground/20 mb-3">
                    {s.num}
                  </div>
                  <div className="flex justify-center mb-4">
                    <div
                      className={`p-3 rounded-xl bg-gradient-to-br ${s.color} shadow-lg`}
                    >
                      <s.icon className="w-10 h-10 text-white" />
                    </div>
                  </div>
                </div>
                <h3 className="text-xl font-bold mb-3 text-foreground text-center">
                  {s.title}
                </h3>
                <div className="reading-content text-xs leading-relaxed text-muted-foreground space-y-1.5">
                  {s.items.map((item, j) => (
                    <p key={j}>&bull; {item}</p>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features CTA */}
      <section className="py-12 px-6 sm:px-8 md:px-12 text-center">
        <Link href="/#features">
          <button className="inline-flex items-center gap-2 px-8 py-4 rounded-full font-semibold text-lg bg-gradient-to-r from-violet-600 to-purple-600 text-white hover:from-violet-700 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl hover:shadow-violet-500/25">
            Explore Features
            <ArrowRight className="w-5 h-5" />
          </button>
        </Link>
      </section>

      <Footer />
    </div>
  );
}
