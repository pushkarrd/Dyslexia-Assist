"use client";

// DyslexiaProvider - applies global accessibility styles based on store settings
import React, { useEffect } from 'react';
import useDyslexiaStore from '@/stores/dyslexiaStore';

export default function DyslexiaProvider({ children }: { children: React.ReactNode }) {
    const {
        dyslexicFont, fontSize, letterSpacing, wordSpacing,
        lineHeight, fontColor, highContrast, focusMode,
    } = useDyslexiaStore();

    useEffect(() => {
        const root = document.documentElement;

        // Toggle dyslexic font
        if (dyslexicFont) {
            document.body.classList.add('dyslexic-mode');
        } else {
            document.body.classList.remove('dyslexic-mode');
        }

        // Apply CSS variables on <html> for .reading-content and global selectors
        root.style.setProperty('--a11y-font-size', `${fontSize}px`);
        root.style.setProperty('--a11y-letter-spacing', `${letterSpacing}px`);
        root.style.setProperty('--a11y-word-spacing', `${wordSpacing}px`);
        root.style.setProperty('--a11y-line-height', `${lineHeight}`);

        // Apply font-size directly on body so it scales globally
        document.body.style.fontSize = `${fontSize}px`;

        // Apply font color (skip home page via CSS scoping, and skip 'default')
        if (fontColor && fontColor !== 'default') {
            root.style.setProperty('--a11y-font-color', fontColor);
            document.body.classList.add('a11y-font-color');
        } else {
            root.style.removeProperty('--a11y-font-color');
            document.body.classList.remove('a11y-font-color');
        }

        // High contrast
        if (highContrast) {
            document.body.classList.add('high-contrast');
        } else {
            document.body.classList.remove('high-contrast');
        }

        // Focus mode
        if (focusMode) {
            document.body.classList.add('focus-mode');
        } else {
            document.body.classList.remove('focus-mode');
        }

        return () => {
            document.body.classList.remove('dyslexic-mode', 'high-contrast', 'focus-mode', 'a11y-font-color');
            document.body.style.fontSize = '';
            root.style.removeProperty('--a11y-font-color');
        };
    }, [dyslexicFont, fontSize, letterSpacing, wordSpacing, lineHeight, fontColor, highContrast, focusMode]);

    return <>{children}</>;
}
