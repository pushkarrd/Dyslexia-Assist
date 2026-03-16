// Zustand store for dyslexia accessibility settings
// Persisted to localStorage so settings survive page refreshes

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface DyslexiaState {
    // Font settings
    dyslexicFont: boolean;
    fontSize: number;

    // Spacing settings
    letterSpacing: number;
    wordSpacing: number;
    lineHeight: number;

    // Visual settings
    colorOverlay: string;
    fontColor: string;
    highContrast: boolean;
    focusMode: boolean;

    // Reading ruler
    readingRuler: boolean;
    rulerHeight: number;

    // Toolbar visibility
    toolbarOpen: boolean;

    // Actions
    toggleDyslexicFont: () => void;
    setFontSize: (size: number) => void;
    setLetterSpacing: (val: number) => void;
    setWordSpacing: (val: number) => void;
    setLineHeight: (val: number) => void;
    setColorOverlay: (color: string) => void;
    setFontColor: (color: string) => void;
    toggleHighContrast: () => void;
    toggleFocusMode: () => void;
    toggleReadingRuler: () => void;
    setRulerHeight: (h: number) => void;
    toggleToolbar: () => void;
    resetAll: () => void;
}

const useDyslexiaStore = create<DyslexiaState>()(
    persist(
        (set) => ({
            // Font settings
            dyslexicFont: false,
            fontSize: 18,

            // Spacing settings
            letterSpacing: 0,
            wordSpacing: 0,
            lineHeight: 1.6,

            // Visual settings
            colorOverlay: 'none',
            fontColor: 'default',
            highContrast: false,
            focusMode: false,

            // Reading ruler
            readingRuler: false,
            rulerHeight: 40,

            // Toolbar visibility
            toolbarOpen: false,

            // Actions
            toggleDyslexicFont: () => set((s) => ({ dyslexicFont: !s.dyslexicFont })),
            setFontSize: (size) => set({ fontSize: size }),
            setLetterSpacing: (val) => set({ letterSpacing: val }),
            setWordSpacing: (val) => set({ wordSpacing: val }),
            setLineHeight: (val) => set({ lineHeight: val }),
            setColorOverlay: (color) => set({ colorOverlay: color }),
            setFontColor: (color) => set({ fontColor: color }),
            toggleHighContrast: () => set((s) => ({ highContrast: !s.highContrast })),
            toggleFocusMode: () => set((s) => ({ focusMode: !s.focusMode })),
            toggleReadingRuler: () => set((s) => ({ readingRuler: !s.readingRuler })),
            setRulerHeight: (h) => set({ rulerHeight: h }),
            toggleToolbar: () => set((s) => ({ toolbarOpen: !s.toolbarOpen })),

            // Reset all settings
            resetAll: () => set({
                dyslexicFont: false,
                fontSize: 18,
                letterSpacing: 0,
                wordSpacing: 0,
                lineHeight: 1.6,
                colorOverlay: 'none',
                fontColor: 'default',
                highContrast: false,
                focusMode: false,
                readingRuler: false,
                rulerHeight: 40,
            }),
        }),
        {
            name: 'simplifi-ed-accessibility',
        }
    )
);

export default useDyslexiaStore;
