// Main App component for NeuroLex
// Routes: / (Landing), /dashboard, /lecture, /reading, /handwriting, /generator, /analytics
// Uses AuthProvider, ThemeProvider, DyslexiaProvider and ProtectedRoute for auth
// AccessibilityToolbar + ReadingRuler available on all pages

import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Landing from './pages/Landing';
import Dashboard from './pages/Dashboard';
import About from './pages/About';
import Login from './pages/Login';
import Signup from './pages/Signup';
import LecturePage from './pages/LecturePage';
import ReadingPage from './pages/ReadingPage';
import HandwritingPage from './pages/HandwritingPage';
import GeneratorPage from './pages/GeneratorPage';
import AnalyticsPage from './pages/AnalyticsPage';
import Onboarding from './pages/Onboarding';
import GamesHub from './pages/games/GamesHub';
import DotConnector from './pages/games/DotConnector';
import MonolinePuzzle from './pages/games/MonolinePuzzle';
import NBackChallenge from './pages/games/NBackChallenge';
import ClapTrap from './pages/games/ClapTrap';
import InhibitionStroop from './pages/games/InhibitionStroop';
import ProtectedRoute from './components/common/ProtectedRoute';
import AccessibilityToolbar from './components/common/AccessibilityToolbar';
import DyslexiaProvider from './components/common/DyslexiaProvider';
import ReadingRuler from './components/common/ReadingRuler';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <DyslexiaProvider>
          <Router>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/about" element={<About />} />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/lecture"
                element={
                  <ProtectedRoute>
                    <LecturePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/reading"
                element={
                  <ProtectedRoute>
                    <ReadingPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/handwriting"
                element={
                  <ProtectedRoute>
                    <HandwritingPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/generator"
                element={
                  <ProtectedRoute>
                    <GeneratorPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/analytics"
                element={
                  <ProtectedRoute>
                    <AnalyticsPage />
                  </ProtectedRoute>
                }
              />
              <Route path="/onboarding" element={<Onboarding />} />
              <Route
                path="/games"
                element={
                  <ProtectedRoute>
                    <GamesHub />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/games/dot-connector"
                element={
                  <ProtectedRoute>
                    <DotConnector />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/games/monoline"
                element={
                  <ProtectedRoute>
                    <MonolinePuzzle />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/games/nback"
                element={
                  <ProtectedRoute>
                    <NBackChallenge />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/games/clap-trap"
                element={
                  <ProtectedRoute>
                    <ClapTrap />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/games/stroop"
                element={
                  <ProtectedRoute>
                    <InhibitionStroop />
                  </ProtectedRoute>
                }
              />
            </Routes>
          </Router>
          <AccessibilityToolbar />
          <ReadingRuler />
        </DyslexiaProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}