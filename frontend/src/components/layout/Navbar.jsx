// Navigation bar component for EchoNotes
// Sticky at top, shows logo and navigation links
// Links: Home, Dashboard, New Lecture, Settings
// Right side: Sign In button (if not logged in) or user menu (if logged in)
// Mobile responsive: hamburger menu on small screens
// Uses dyslexia-friendly font and accessible design
// Background: white with shadow

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Button from '../common/Button';
import StarBorder from '../common/StarBorder';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { Moon, Sun, ChevronDown } from 'lucide-react';

export default function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [toolsMenuOpen, setToolsMenuOpen] = useState(false);
  const [dashboardVisited, setDashboardVisited] = useState(false);
  const { isDark, toggleTheme } = useTheme();
  const { currentUser, logout } = useAuth();

  // Check if dashboard has been visited
  useEffect(() => {
    const visited = localStorage.getItem('dashboardVisited') === 'true';
    setDashboardVisited(visited);
  }, []);

  // Update state when dashboard is visited (listen for storage changes)
  useEffect(() => {
    const handleStorageChange = () => {
      const visited = localStorage.getItem('dashboardVisited') === 'true';
      setDashboardVisited(visited);
    };

    // Listen for custom event from Dashboard
    const handleDashboardVisit = () => {
      const visited = localStorage.getItem('dashboardVisited') === 'true';
      setDashboardVisited(visited);
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('focus', handleStorageChange);
    window.addEventListener('dashboardVisited', handleDashboardVisit);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('focus', handleStorageChange);
      window.removeEventListener('dashboardVisited', handleDashboardVisit);
    };
  }, []);

  return (
    <nav className="sticky top-0 z-50 bg-gray-900/95 backdrop-blur-md border-b border-gray-800 transition-colors duration-300 touch-none">
      <div className="w-full px-3 sm:px-4 md:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16 md:h-20">
          {/* Logo section */}
          <Link to="/" className="flex items-center gap-2 flex-shrink-0">
            <span className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">

              <span className="bg-linear-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">NeuroLex</span>
            </span>
          </Link>

          {/* Desktop navigation links */}
          <div className="hidden lg:flex items-center gap-6 xl:gap-8">
            <Link to="/" className="text-gray-300 hover:text-white font-semibold transition-colors text-sm lg:text-base">
              Home
            </Link>
            <a href="/#features" className="text-gray-300 hover:text-white font-semibold transition-colors text-sm lg:text-base">
              Features
            </a>
            <Link to="/dashboard" className="text-gray-300 hover:text-white font-semibold transition-colors text-sm lg:text-base">
              Dashboard
            </Link>

            {/* AI Learning Tools - Only show after dashboard visit */}
            {dashboardVisited && (
              <>
                <Link to="/reading" className="text-gray-300 hover:text-white font-semibold transition-colors text-sm lg:text-base">
                  Reading Assistant
                </Link>
                <Link to="/handwriting" className="text-gray-300 hover:text-white font-semibold transition-colors text-sm lg:text-base">
                  Handwriting
                </Link>
                <Link to="/generator" className="text-gray-300 hover:text-white font-semibold transition-colors text-sm lg:text-base">
                  Generator
                </Link>
                <Link to="/analytics" className="text-gray-300 hover:text-white font-semibold transition-colors text-sm lg:text-base">
                  Analytics
                </Link>
                <Link to="/onboarding" className="text-gray-300 hover:text-white font-semibold transition-colors text-sm lg:text-base">
                  Screening
                </Link>
              </>
            )}

            <Link to="/games" className="text-gray-300 hover:text-white font-semibold transition-colors text-sm lg:text-base">
              Games
            </Link>
            <Link to="/about" className="text-gray-300 hover:text-white font-semibold transition-colors text-sm lg:text-base">
              About
            </Link>
          </div>

          {/* Sign in button or user menu */}
          <div className="hidden lg:flex items-center gap-3 xl:gap-4">
            {!currentUser ? (
              <>
                <Link to="/login">
                  <StarBorder
                    as="div"
                    color="cyan"
                    speed="5s"
                    className="cursor-pointer"
                  >
                    Sign In
                  </StarBorder>
                </Link>
                <Link to="/signup">
                  <button className="px-6 py-2 rounded-lg font-semibold bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white transition-all">
                    Get Started
                  </button>
                </Link>
              </>
            ) : (
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-all ${isDark
                    ? 'bg-gray-700 text-white hover:bg-gray-600'
                    : 'bg-gray-200 text-gray-900 hover:bg-gray-300'
                    }`}
                >
                  <span className="w-8 h-8 rounded-full bg-linear-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-sm font-bold">
                    {currentUser.email?.[0].toUpperCase()}
                  </span>
                  <span className="hidden sm:inline">{currentUser.displayName || currentUser.email?.split('@')[0]}</span>
                </button>

                {userMenuOpen && (
                  <div className={`absolute right-0 mt-2 w-64 rounded-lg shadow-lg z-50 overflow-hidden ${isDark ? 'bg-gray-700' : 'bg-white'}`}>
                    <div className={`px-4 py-3 border-b ${isDark ? 'border-gray-600' : 'border-gray-200'}`}>
                      <p className={`text-sm font-semibold truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {currentUser.displayName || currentUser.email}
                      </p>
                      <p className={`text-xs truncate ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        {currentUser.email}
                      </p>
                    </div>
                    <Link
                      to="/dashboard"
                      className={`block px-4 py-2 text-sm ${isDark ? 'text-gray-300 hover:bg-gray-600' : 'text-gray-900 hover:bg-gray-100'}`}
                      onClick={() => setUserMenuOpen(false)}
                    >
                      Dashboard
                    </Link>
                    <button
                      onClick={() => {
                        logout();
                        setUserMenuOpen(false);
                      }}
                      className={`w-full text-left px-4 py-2 text-sm border-t ${isDark ? 'border-gray-600 text-red-400 hover:bg-gray-600' : 'border-gray-200 text-red-600 hover:bg-gray-100'}`}
                    >
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Mobile menu button */}
          {/* Shows on mobile, hidden on desktop */}
          <button
            className={`lg:hidden p-2 -mr-2 ${isDark ? 'text-gray-300 hover:text-white' : 'text-textDark hover:text-primary'}`}
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle mobile menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {/* Shows when mobileMenuOpen is true */}
      {mobileMenuOpen && (
        <div className={`lg:hidden ${isDark ? 'bg-gray-800/95 border-t border-gray-700' : 'bg-white/95 border-t'}`}>
          <div className="px-3 sm:px-4 py-4 space-y-3">
            <Link to="/" onClick={() => setMobileMenuOpen(false)} className={`block py-2 px-2 rounded text-base sm:text-lg ${isDark ? 'text-gray-300 hover:text-white hover:bg-gray-700' : 'text-textDark hover:text-primary hover:bg-gray-100'} font-semibold transition-colors`}>
              Home
            </Link>
            <a href="/#features" onClick={() => setMobileMenuOpen(false)} className={`block py-2 px-2 rounded text-base sm:text-lg ${isDark ? 'text-gray-300 hover:text-white hover:bg-gray-700' : 'text-textDark hover:text-primary hover:bg-gray-100'} font-semibold transition-colors`}>
              Features
            </a>
            <Link to="/dashboard" onClick={() => setMobileMenuOpen(false)} className={`block py-2 px-2 rounded text-base sm:text-lg ${isDark ? 'text-gray-300 hover:text-white hover:bg-gray-700' : 'text-textDark hover:text-primary hover:bg-gray-100'} font-semibold transition-colors`}>
              Dashboard
            </Link>

            {/* AI Learning Tools - Only show after dashboard visit */}
            {dashboardVisited && (
              <>
                <Link to="/reading" onClick={() => setMobileMenuOpen(false)} className={`block py-2 px-2 rounded text-base sm:text-lg ${isDark ? 'text-gray-300 hover:text-white hover:bg-gray-700' : 'text-textDark hover:text-primary hover:bg-gray-100'} font-semibold transition-colors`}>
                  📖 Reading Assistant
                </Link>
                <Link to="/handwriting" onClick={() => setMobileMenuOpen(false)} className={`block py-2 px-2 rounded text-base sm:text-lg ${isDark ? 'text-gray-300 hover:text-white hover:bg-gray-700' : 'text-textDark hover:text-primary hover:bg-gray-100'} font-semibold transition-colors`}>
                  ✍️ Handwriting
                </Link>
                <Link to="/generator" onClick={() => setMobileMenuOpen(false)} className={`block py-2 px-2 rounded text-base sm:text-lg ${isDark ? 'text-gray-300 hover:text-white hover:bg-gray-700' : 'text-textDark hover:text-primary hover:bg-gray-100'} font-semibold transition-colors`}>
                  ✨ Generator
                </Link>
                <Link to="/analytics" onClick={() => setMobileMenuOpen(false)} className={`block py-2 px-2 rounded text-base sm:text-lg ${isDark ? 'text-gray-300 hover:text-white hover:bg-gray-700' : 'text-textDark hover:text-primary hover:bg-gray-100'} font-semibold transition-colors`}>
                  📊 Analytics
                </Link>
                <Link to="/onboarding" onClick={() => setMobileMenuOpen(false)} className={`block py-2 px-2 rounded text-base sm:text-lg ${isDark ? 'text-gray-300 hover:text-white hover:bg-gray-700' : 'text-textDark hover:text-primary hover:bg-gray-100'} font-semibold transition-colors`}>
                  🧠 Screening
                </Link>
              </>
            )}

            <Link to="/games" onClick={() => setMobileMenuOpen(false)} className={`block py-2 px-2 rounded text-base sm:text-lg ${isDark ? 'text-gray-300 hover:text-white hover:bg-gray-700' : 'text-textDark hover:text-primary hover:bg-gray-100'} font-semibold transition-colors`}>
              Games
            </Link>
            <Link to="/about" onClick={() => setMobileMenuOpen(false)} className={`block py-2 px-2 rounded text-base sm:text-lg ${isDark ? 'text-gray-300 hover:text-white hover:bg-gray-700' : 'text-textDark hover:text-primary hover:bg-gray-100'} font-semibold transition-colors`}>
              About
            </Link>
            <div className="pt-3 mt-3 border-t" style={{ borderColor: isDark ? '#4B5563' : '#e5e7eb' }}>
              <Link to="/login" onClick={() => setMobileMenuOpen(false)} className="block mb-2">
                <button className="w-full px-4 py-3 rounded-lg font-semibold text-white bg-gray-700 hover:bg-gray-600 transition-colors touch-target">
                  Sign In
                </button>
              </Link>
              <Link to="/signup" onClick={() => setMobileMenuOpen(false)} className="block">
                <button className="w-full px-4 py-3 rounded-lg font-semibold bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white transition-all touch-target">
                  Get Started
                </button>
              </Link>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}