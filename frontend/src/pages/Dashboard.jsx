// Dashboard page - main hub after login
// Shows welcome message with user name
// Quick action cards: Start New Lecture, Upload Audio, View History
// Recent lectures list (empty state if no lectures)
// Stats cards: Total lectures, Total hours recorded, This week count
// Uses grid layout, responsive design

import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Navbar from '../components/layout/Navbar';
import Silk from '../components/common/Silk';
import Button from '../components/common/Button';
import AudioUpload from '../components/lecture/AudioUpload';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { Sparkles, Home, TrendingUp, Clock, Users, Heart, Map, Brain, BookOpen, Trophy, GraduationCap, Instagram, Youtube, Twitter } from 'lucide-react';
import { createLecture } from '../services/backendApi';

export default function Dashboard() {
  const { isDyslexicMode, toggleDyslexicMode, isDark } = useTheme();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [todayProgress, setTodayProgress] = useState(0);
  const [conceptsCompleted, setConceptsCompleted] = useState(0);
  const [points, setPoints] = useState(0);
  const [dayStreak, setDayStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth >= 1024); // Start open on desktop, closed on mobile

  // Responsive sidebar handling
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setSidebarOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Get user's first name from display name or email
  const getUserFirstName = () => {
    if (currentUser?.displayName) {
      return currentUser.displayName.split(' ')[0];
    }
    if (currentUser?.email) {
      return currentUser.email.split('@')[0];
    }
    return 'Student';
  };

  const userName = getUserFirstName();

  // Set menu activation flag on dashboard visit
  useEffect(() => {
    localStorage.setItem('dashboardVisited', 'true');
    // Trigger a custom event to notify Navbar
    window.dispatchEvent(new Event('dashboardVisited'));
  }, []);

  // Handle audio upload completion
  const handleAudioUploadComplete = async (transcription) => {
    try {
      setShowUploadModal(false);

      if (!currentUser?.uid) {
        alert('Please log in to save your recording');
        return;
      }

      // Create lecture with transcription
      const lectureId = await createLecture(currentUser.uid, transcription);

      // Navigate to lecture page which will auto-process
      navigate(`/lecture?id=${lectureId}&autoProcess=true`);

    } catch (error) {
      console.error('Error saving uploaded audio transcription:', error);
      alert('Failed to save transcription. Please try again.');
    }
  };

  const sidebarItems = [
    { icon: Home, label: 'Home', path: '/' },
    { icon: TrendingUp, label: 'Progress', path: '/analytics' },
    { icon: Clock, label: 'Screen Time', path: '/analytics' },
    { icon: Users, label: 'Community', path: '#' },
    { icon: Heart, label: 'Motivation', path: '#' },
    { icon: Map, label: 'Roadmap', path: '#' },
    { icon: Brain, label: 'Quiz Center', path: '/onboarding' },
    { icon: BookOpen, label: 'Courses', path: '/lecture' },
    { icon: Trophy, label: 'Leaderboard', path: '#' },
    { icon: GraduationCap, label: 'Learning', path: '/games' },
  ];

  return (
    <div className="min-h-screen relative bg-black overflow-hidden flex">
      {/* Silk Background - Covers entire page */}
      {/* Dark base layer */}
      <div className="fixed inset-0 w-full h-full bg-gradient-to-br from-black via-blue-950 to-slate-950 pointer-events-none z-0"></div>

      {/* Primary Silk layer - Bright Blue */}
      <div className="fixed inset-0 w-full h-full pointer-events-none opacity-60 z-0">
        <Silk
          speed={2}
          scale={1.2}
          color="#3B82F6"
          noiseIntensity={0.8}
          rotation={0.3}
        />
      </div>

      {/* Secondary Silk layer - Purple */}
      <div className="fixed inset-0 w-full h-full pointer-events-none opacity-40 z-0">
        <Silk
          speed={1.5}
          scale={1}
          color="#8B5CF6"
          noiseIntensity={1.2}
          rotation={-0.2}
        />
      </div>

      {/* Tertiary Silk layer - Cyan */}
      <div className="fixed inset-0 w-full h-full pointer-events-none opacity-30 z-0">
        <Silk
          speed={2.5}
          scale={0.8}
          color="#06B6D4"
          noiseIntensity={1}
          rotation={0.5}
        />
      </div>

      {/* Left Sidebar Navigation */}
      <div className={`fixed left-0 top-0 h-screen bg-gray-900/50 backdrop-blur-md border-r border-white/10 transition-all duration-300 z-40 ${sidebarOpen ? 'w-64' : 'w-0 lg:w-20'} overflow-hidden`}>
        <div className="p-4 pt-6">
          <div className="flex items-center justify-between mb-8 mt-4">
            {sidebarOpen && (
              <h2 className="text-xl font-bold bg-white/10 backdrop-blur-sm px-3 py-2 rounded-lg">
                <span className="text-white">Menu</span>
              </h2>
            )}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 rounded-lg bg-white/10 backdrop-blur-sm hover:bg-white/20 transition-colors flex-shrink-0"
            >
              <span className="text-white text-xl">{sidebarOpen ? '←' : '→'}</span>
            </button>
          </div>
          <nav className="space-y-2 overflow-y-auto max-h-[calc(100vh-120px)]">
            {sidebarItems.map((item, index) => (
              <Link
                key={index}
                to={item.path}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-white/5 backdrop-blur-sm hover:bg-white/10 transition-all group"
              >
                <item.icon className="w-5 h-5 text-blue-400 group-hover:text-blue-300 flex-shrink-0" />
                {sidebarOpen && <span className="text-white text-sm font-medium whitespace-nowrap">{item.label}</span>}
              </Link>
            ))}
          </nav>
        </div>
      </div>

      {/* Mobile Sidebar Toggle Button */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className={`fixed top-20 left-4 z-50 lg:hidden p-3 rounded-lg bg-gray-900/80 backdrop-blur-md border border-white/10 hover:bg-gray-900/90 transition-all ${sidebarOpen ? 'hidden' : 'block'}`}
      >
        <span className="text-white text-xl">☰</span>
      </button>

      {/* Overlay for mobile sidebar */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        ></div>
      )}

      {/* Main Content */}
      <div className={`flex-1 relative z-10 transition-all duration-300 ${sidebarOpen ? 'lg:ml-64' : 'lg:ml-20'}`}>
        <Navbar />

        <div className="w-full max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-6 md:py-8">
          {/* Welcome section with Dyslexic Mode Button */}
          <div className="mb-6 md:mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex-1 bg-black/30 backdrop-blur-md px-6 py-4 rounded-xl border border-white/10">
              <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-2 drop-shadow-lg">
                Welcome back, {userName}! 👋
              </h1>
              <p className="text-base sm:text-lg md:text-xl text-gray-100 drop-shadow-md">
                Ready to make learning easier today?
              </p>
            </div>

            {/* Dyslexic User Toggle Button */}
            <button
              onClick={toggleDyslexicMode}
              className={`
                flex items-center gap-2 sm:gap-3 px-4 sm:px-6 py-2 sm:py-3 rounded-lg font-semibold text-sm sm:text-base
                transition-all duration-300 transform hover:scale-105 shadow-lg flex-shrink-0 touch-target
                ${isDyslexicMode
                  ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-blue-500/50'
                  : 'bg-white/10 backdrop-blur-sm text-white border-2 border-white/30 hover:bg-white/20'
                }
              `}
            >
              <Sparkles className={`w-4 sm:w-5 h-4 sm:h-5 ${isDyslexicMode ? 'animate-pulse' : ''}`} />
              <span className="whitespace-nowrap">{isDyslexicMode ? 'Dyslexic ON' : 'Dyslexic User'}</span>
            </button>
          </div>

          {/* Dashboard Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Current Streak Card */}
            <div className="bg-black/30 backdrop-blur-md p-6 rounded-xl border border-white/10">
              <h3 className="text-lg font-semibold text-white mb-2">Current Streak</h3>
              <div className="flex items-center gap-2">
                <span className="text-4xl font-bold text-orange-400">{currentStreak}</span>
                <span className="text-xl text-white">Days</span>
              </div>
            </div>

            {/* Today's Challenge Card */}
            <div className="bg-black/30 backdrop-blur-md p-6 rounded-xl border border-white/10">
              <h3 className="text-lg font-semibold text-white mb-2">Today's Challenge</h3>
              <p className="text-sm text-gray-300 mb-3">Goal: 60 minutes</p>
              <div className="w-full bg-gray-700/50 rounded-full h-4 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-blue-500 to-purple-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${(todayProgress / 60) * 100}%` }}
                ></div>
              </div>
              <p className="text-sm text-gray-400 mt-2">{todayProgress}/60 minutes</p>
            </div>
          </div>

          {/* Your Progress Section */}
          <div className="bg-black/30 backdrop-blur-md p-6 rounded-xl border border-white/10 mb-6">
            <h2 className="text-2xl font-bold text-white mb-4">Your Progress</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white/5 backdrop-blur-sm p-4 rounded-lg">
                <p className="text-sm text-gray-400 mb-1">Concepts Completed</p>
                <p className="text-2xl font-bold text-white">{conceptsCompleted}/45</p>
              </div>
              <div className="bg-white/5 backdrop-blur-sm p-4 rounded-lg">
                <p className="text-sm text-gray-400 mb-1">Points</p>
                <p className="text-2xl font-bold text-yellow-400">{points}</p>
              </div>
              <div className="bg-white/5 backdrop-blur-sm p-4 rounded-lg">
                <p className="text-sm text-gray-400 mb-1">Day Streak</p>
                <p className="text-2xl font-bold text-orange-400">{dayStreak}</p>
              </div>
              <div className="bg-white/5 backdrop-blur-sm p-4 rounded-lg">
                <p className="text-sm text-gray-400 mb-1">Best</p>
                <p className="text-2xl font-bold text-green-400">{bestStreak}</p>
              </div>
            </div>
          </div>

          {/* Screen Time Section */}
          <div className="bg-black/30 backdrop-blur-md p-6 rounded-xl border border-white/10 mb-6">
            <h2 className="text-2xl font-bold text-white mb-4">Screen Time</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between bg-white/5 backdrop-blur-sm p-4 rounded-lg">
                <div className="flex items-center gap-3">
                  <Instagram className="w-6 h-6 text-pink-500" />
                  <span className="text-white font-medium">Instagram</span>
                </div>
                <span className="text-gray-400 text-sm">social</span>
              </div>
              <div className="flex items-center justify-between bg-white/5 backdrop-blur-sm p-4 rounded-lg">
                <div className="flex items-center gap-3">
                  <Youtube className="w-6 h-6 text-red-500" />
                  <span className="text-white font-medium">YouTube</span>
                </div>
                <span className="text-gray-400 text-sm">entertainment</span>
              </div>
              <div className="flex items-center justify-between bg-white/5 backdrop-blur-sm p-4 rounded-lg">
                <div className="flex items-center gap-3">
                  <Twitter className="w-6 h-6 text-blue-400" />
                  <span className="text-white font-medium">Twitter</span>
                </div>
                <span className="text-gray-400 text-sm">social</span>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-black/30 backdrop-blur-md p-6 rounded-xl border border-white/10">
            <h2 className="text-2xl font-bold text-white mb-4">Quick Actions</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Link to="/lecture" className="block">
                <button className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-3 px-6 rounded-lg transition-all transform hover:scale-105">
                  Start New Learning Path
                </button>
              </Link>
              <Link to="/analytics" className="block">
                <button className="w-full bg-white/10 backdrop-blur-sm hover:bg-white/20 text-white font-semibold py-3 px-6 rounded-lg border border-white/20 transition-all transform hover:scale-105">
                  View All Paths
                </button>
              </Link>
              <Link to="/onboarding" className="block">
                <button className="w-full bg-white/10 backdrop-blur-sm hover:bg-white/20 text-white font-semibold py-3 px-6 rounded-lg border border-white/20 transition-all transform hover:scale-105">
                  Take a Quiz
                </button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Audio Upload Modal */}
      {showUploadModal && (
        <AudioUpload
          onUploadComplete={handleAudioUploadComplete}
          onClose={() => setShowUploadModal(false)}
        />
      )}
    </div>
  );
}