"use client";

// Combined providers wrapper for the application
import React from 'react';
import { ThemeProvider } from '@/context/ThemeContext';
import { AuthProvider } from '@/context/AuthContext';
import DyslexiaProvider from '@/components/providers/DyslexiaProvider';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <DyslexiaProvider>
          {children}
        </DyslexiaProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
