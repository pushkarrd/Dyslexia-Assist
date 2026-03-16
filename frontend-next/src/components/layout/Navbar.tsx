"use client";

// Navigation bar component for NeuroLex
// Floating glassmorphic navbar with responsive mobile menu

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Moon, Sun, Menu, X, LogOut, LayoutDashboard } from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';

const NAV_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/games', label: 'Games' },
  { href: '/about', label: 'About' },
];

const AI_TOOLS_LINKS = [
  { href: '/reading', label: 'Reading Assistant', emoji: '📖' },
  { href: '/handwriting', label: 'Handwriting', emoji: '✍️' },
  { href: '/generator', label: 'Generator', emoji: '✨' },
  { href: '/analytics', label: 'Analytics', emoji: '📊' },
  { href: '/onboarding', label: 'Screening', emoji: '🧠' },
];

export default function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [dashboardVisited, setDashboardVisited] = useState(false);
  const { isDark, toggleTheme } = useTheme();
  const { currentUser, logout } = useAuth();
  const pathname = usePathname();
  const userMenuRef = useRef<HTMLDivElement>(null);

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

    if (typeof window !== 'undefined') {
      window.addEventListener('storage', handleStorageChange);
      window.addEventListener('focus', handleStorageChange);
      window.addEventListener('dashboardVisited', handleDashboardVisit);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('storage', handleStorageChange);
        window.removeEventListener('focus', handleStorageChange);
        window.removeEventListener('dashboardVisited', handleDashboardVisit);
      }
    };
  }, []);

  // Track scroll for navbar background
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close user menu on outside click
  useEffect(() => {
    if (!userMenuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [userMenuOpen]);

  return (
    <motion.nav
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      className={`sticky top-0 z-50 transition-all duration-300 ${scrolled
          ? 'bg-background/80 backdrop-blur-xl border-b border-border shadow-lg shadow-primary/5'
          : 'bg-background/50 backdrop-blur-md border-b border-transparent'
        }`}
    >
      <div className="w-full px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="flex justify-between items-center h-16 md:h-18">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 flex-shrink-0">
            <span className="text-xl sm:text-2xl font-black flex items-center gap-2">
              <span className="gradient-text">NeuroLex</span>
            </span>
          </Link>

          {/* Desktop nav links */}
          <div className="hidden lg:flex items-center gap-1">
            {NAV_LINKS.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`relative px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${isActive
                      ? 'text-primary'
                      : 'text-muted-foreground hover:text-foreground'
                    }`}
                >
                  {link.label}
                  {isActive && (
                    <motion.div
                      layoutId="navbar-indicator"
                      className="absolute bottom-0 left-2 right-2 h-0.5 bg-primary rounded-full"
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    />
                  )}
                </Link>
              );
            })}

            {/* AI Learning Tools - Only show after dashboard visit */}
            {dashboardVisited && AI_TOOLS_LINKS.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`relative px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${isActive
                      ? 'text-primary'
                      : 'text-muted-foreground hover:text-foreground'
                    }`}
                >
                  {link.label}
                  {isActive && (
                    <motion.div
                      layoutId="navbar-indicator"
                      className="absolute bottom-0 left-2 right-2 h-0.5 bg-primary rounded-full"
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    />
                  )}
                </Link>
              );
            })}
          </div>

          {/* Right side: theme toggle + auth */}
          <div className="hidden lg:flex items-center gap-3">
            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              style={{ minHeight: '40px', minWidth: '40px' }}
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {isDark ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            {!currentUser ? (
              <div className="flex items-center gap-2">
                <Link href="/login">
                  <Button variant="ghost" size="sm" className="font-medium">
                    Sign In
                  </Button>
                </Link>
                <Link href="/signup">
                  <Button
                    size="sm"
                    className="font-semibold bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white border-0"
                  >
                    Get Started
                  </Button>
                </Link>
              </div>
            ) : (
              <div ref={userMenuRef} className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg font-medium transition-all hover:bg-accent"
                  style={{ minHeight: '40px' }}
                >
                  <span className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center text-white text-sm font-bold">
                    {currentUser.email?.[0].toUpperCase()}
                  </span>
                  <span className="hidden xl:inline text-sm text-foreground">
                    {currentUser.displayName || currentUser.email?.split('@')[0]}
                  </span>
                </button>

                <AnimatePresence>
                  {userMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 mt-2 w-64 rounded-xl shadow-xl overflow-hidden glass border border-border"
                    >
                      <div className="px-4 py-3 border-b border-border">
                        <p className="text-sm font-semibold truncate text-foreground">
                          {currentUser.displayName || currentUser.email}
                        </p>
                        <p className="text-xs truncate text-muted-foreground">
                          {currentUser.email}
                        </p>
                      </div>
                      <Link
                        href="/dashboard"
                        className="flex items-center gap-2 px-4 py-2.5 text-sm text-foreground hover:bg-accent transition-colors"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        <LayoutDashboard size={16} />
                        Dashboard
                      </Link>
                      <button
                        onClick={() => {
                          logout();
                          setUserMenuOpen(false);
                        }}
                        className="w-full flex items-center gap-2 text-left px-4 py-2.5 text-sm border-t border-border text-destructive hover:bg-accent transition-colors"
                      >
                        <LogOut size={16} />
                        Sign Out
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="flex items-center gap-2 lg:hidden">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg text-muted-foreground"
              style={{ minHeight: '40px', minWidth: '40px' }}
            >
              {isDark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button
              className="p-2 text-foreground"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle mobile menu"
              style={{ minHeight: '40px', minWidth: '40px' }}
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="lg:hidden overflow-hidden border-t border-border bg-background/95 backdrop-blur-xl"
          >
            <div className="px-4 py-4 space-y-1">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`block py-3 px-3 rounded-lg text-base font-medium transition-colors ${pathname === link.href
                      ? 'text-primary bg-primary/10'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                    }`}
                >
                  {link.label}
                </Link>
              ))}

              {/* AI Learning Tools - Only show after dashboard visit */}
              {dashboardVisited && AI_TOOLS_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`block py-3 px-3 rounded-lg text-base font-medium transition-colors ${pathname === link.href
                      ? 'text-primary bg-primary/10'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                    }`}
                >
                  {link.emoji} {link.label}
                </Link>
              ))}

              <div className="pt-3 mt-3 border-t border-border space-y-2">
                {!currentUser ? (
                  <>
                    <Link href="/login" onClick={() => setMobileMenuOpen(false)} className="block">
                      <Button variant="outline" className="w-full">Sign In</Button>
                    </Link>
                    <Link href="/signup" onClick={() => setMobileMenuOpen(false)} className="block">
                      <Button className="w-full bg-gradient-to-r from-violet-600 to-purple-600 text-white border-0">
                        Get Started
                      </Button>
                    </Link>
                  </>
                ) : (
                  <button
                    onClick={() => {
                      logout();
                      setMobileMenuOpen(false);
                    }}
                    className="w-full flex items-center justify-center gap-2 py-3 text-destructive font-medium"
                  >
                    <LogOut size={18} />
                    Sign Out
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
}
