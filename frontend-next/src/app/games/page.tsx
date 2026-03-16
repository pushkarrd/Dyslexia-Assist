"use client";

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';

const GAMES = [
  {
    id: 'dot_connector',
    title: 'Dot Connector',
    emoji: '🔴',
    description: 'Connect matching dots and fill every cell of the board.',
    gradient: 'from-amber-500/30 to-orange-600/30',
    border: 'border-amber-400/30 hover:border-amber-400/60',
    path: '/games/dot-connector',
    tag: 'Spatial',
  },
  {
    id: 'monoline',
    title: 'Monoline Puzzle',
    emoji: '✏️',
    description: 'Trace the entire diagram in one continuous stroke without lifting.',
    gradient: 'from-blue-500/30 to-cyan-600/30',
    border: 'border-blue-400/30 hover:border-blue-400/60',
    path: '/games/monoline',
    tag: 'Spatial',
  },
  {
    id: 'nback',
    title: 'N-Back Challenge',
    emoji: '🧠',
    description: 'Train your working memory by spotting repeated patterns.',
    gradient: 'from-purple-500/30 to-violet-600/30',
    border: 'border-purple-400/30 hover:border-purple-400/60',
    path: '/games/nback',
    tag: 'Memory',
  },
  {
    id: 'clap-trap',
    title: 'Little Blitz',
    emoji: '👏',
    description: 'Feel the rhythm — clap on the beat to build timing skills.',
    gradient: 'from-rose-500/30 to-pink-600/30',
    border: 'border-rose-400/30 hover:border-rose-400/60',
    path: '/games/clap-trap',
    tag: 'Rhythm',
  },
  {
    id: 'stroop',
    title: 'Inhibition Stroop',
    emoji: '🎨',
    description: 'Pick the ink color, not the word — train focus & inhibition.',
    gradient: 'from-emerald-500/30 to-teal-600/30',
    border: 'border-emerald-400/30 hover:border-emerald-400/60',
    path: '/games/stroop',
    tag: 'Focus',
  },
];

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

const card = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 260, damping: 20 } },
};

export default function GamesHub() {
  const router = useRouter();

  return (
    <div className="min-h-screen">

      <div className="w-full max-w-6xl mx-4 sm:mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-6 md:py-10 content-blur-card p-4 sm:p-8 mt-4 mb-4">
        {/* Header */}
        <div className="mb-8 md:mb-10 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <motion.h1
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-3xl sm:text-4xl md:text-5xl font-extrabold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent"
            >
              Therapy Games
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.15 }}
              className="mt-2 text-sm sm:text-base text-muted-foreground max-w-lg"
            >
              Fun, adaptive exercises designed to strengthen reading, memory, rhythm &amp; focus.
            </motion.p>
          </div>

          <button
            onClick={() => router.push('/dashboard')}
            className="self-start sm:self-auto px-4 py-2 rounded-lg text-sm font-semibold bg-white/10 hover:bg-white/20 border border-white/20 transition-all"
          >
            ← Dashboard
          </button>
        </div>

        {/* Game cards */}
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6"
        >
          {GAMES.map((game) => (
            <motion.div key={game.id} variants={card}>
              <Link href={game.path} className="block group h-full">
                <div
                  className={`relative bg-gradient-to-br ${game.gradient} backdrop-blur-sm border-2 ${game.border} rounded-2xl p-5 sm:p-6 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.03] h-full flex flex-col`}
                >
                  {/* Tag */}
                  <span className="absolute top-3 right-3 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-white/10 text-foreground/70 border border-white/20">
                    {game.tag}
                  </span>

                  <div className="text-4xl sm:text-5xl mb-3">{game.emoji}</div>
                  <h2 className="text-lg sm:text-xl font-bold text-white mb-1 group-hover:text-blue-200 transition-colors">
                    {game.title}
                  </h2>
                  <p className="text-xs sm:text-sm text-foreground/70 leading-relaxed flex-1">
                    {game.description}
                  </p>

                  <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-blue-300 group-hover:text-blue-200 transition-colors">
                    Play now
                    <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </div>
  );
}
