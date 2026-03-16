/**
 * PronunciationAnalyser — Compares spoken words against target words,
 * scores pronunciation, and classifies dyslexia-specific error types.
 */

// ──────────── Types ────────────

export enum PronunciationErrorType {
    LETTER_REVERSAL = 'LETTER_REVERSAL',
    PHONEME_SUBSTITUTION = 'PHONEME_SUBSTITUTION',
    OMISSION = 'OMISSION',
    ADDITION = 'ADDITION',
    WHOLE_WORD_ERROR = 'WHOLE_WORD_ERROR',
    CORRECT = 'CORRECT',
}

export interface PronunciationScore {
    targetWord: string;
    spokenWord: string;
    isCorrect: boolean;
    score: number;
    errorType: PronunciationErrorType | null;
    phoneticTarget: string;
    phoneticSpoken: string;
    timestamp: number;
}

export interface SessionPronunciationStats {
    totalWords: number;
    correctCount: number;
    accuracy: number;
    errorTypeCounts: Record<PronunciationErrorType, number>;
    mostStruggledWords: { word: string; attempts: number; avgScore: number }[];
    mostStruggledPhonemes: { phoneme: string; errorCount: number }[];
    wordsToWatch: string[];
}

// ──────────── Constants ────────────

const REVERSAL_PAIRS: [string, string][] = [
    ['b', 'd'], ['p', 'q'], ['m', 'w'], ['n', 'u'],
    ['was', 'saw'], ['on', 'no'], ['god', 'dog'],
    ['left', 'felt'], ['net', 'ten'], ['rat', 'tar'],
];

const ARPA_TO_READABLE: Record<string, string> = {
    AA: 'ah', AE: 'a', AH: 'uh', AO: 'aw', AW: 'ow',
    AY: 'i', B: 'b', CH: 'ch', D: 'd', DH: 'th',
    EH: 'e', ER: 'er', EY: 'ay', F: 'f', G: 'g',
    HH: 'h', IH: 'i', IY: 'ee', JH: 'j', K: 'k',
    L: 'l', M: 'm', N: 'n', NG: 'ng', OW: 'oh',
    OY: 'oy', P: 'p', R: 'r', S: 's', SH: 'sh',
    T: 't', TH: 'th', UH: 'oo', UW: 'oo', V: 'v',
    W: 'w', Y: 'y', Z: 'z', ZH: 'zh',
};

const SIMPLE_PHONEME_MAP: Record<string, string> = {
    a: 'AE', b: 'B', c: 'K', d: 'D', e: 'EH', f: 'F', g: 'G',
    h: 'HH', i: 'IH', j: 'JH', k: 'K', l: 'L', m: 'M', n: 'N',
    o: 'AO', p: 'P', q: 'K', r: 'R', s: 'S', t: 'T', u: 'UH',
    v: 'V', w: 'W', x: 'K', y: 'Y', z: 'Z',
};

// ──────────── Service ────────────

class PronunciationAnalyser {
    phonemeDictionary = new Map<string, string[]>();
    private pronunciationHistory = new Map<string, PronunciationScore[]>();
    isLoaded = false;

    async loadPhonemes(): Promise<void> {
        if (this.isLoaded) return;
        try {
            const data = await import('../data/cmuPhonemes.js');
            const dict = data.default || data;
            if (dict && typeof dict === 'object') {
                for (const [word, phonemes] of Object.entries(dict)) {
                    if (Array.isArray(phonemes)) {
                        // Strip stress markers (digits) from ARPAbet
                        this.phonemeDictionary.set(
                            word.toLowerCase(),
                            (phonemes as string[]).map(p => p.replace(/[0-9]/g, '')),
                        );
                    }
                }
            }
            this.isLoaded = true;
            console.log('[PronunciationAnalyser] Phoneme dictionary loaded');
        } catch (e) {
            console.warn('[PronunciationAnalyser] Failed to load phonemes:', e);
        }
    }

    analyseWord(
        targetWord: string,
        spokenWord: string,
        _lipVisemes: string[] = [],
    ): PronunciationScore {
        const target = targetWord.toLowerCase().replace(/[^a-z]/g, '');
        const spoken = spokenWord.toLowerCase().replace(/[^a-z]/g, '');
        const now = Date.now();

        // Quick checks
        if (target === spoken) {
            return this.buildScore(target, spoken, true, 1.0, PronunciationErrorType.CORRECT, now);
        }

        if (this.levenshtein(target, spoken) <= 1) {
            return this.buildScore(target, spoken, true, 0.9, PronunciationErrorType.CORRECT, now);
        }

        // Reversal check
        for (const [a, b] of REVERSAL_PAIRS) {
            if ((target === a && spoken === b) || (target === b && spoken === a)) {
                return this.buildScore(target, spoken, false, 0.2, PronunciationErrorType.LETTER_REVERSAL, now);
            }
        }

        // Check single-letter reversals (b/d, p/q)
        if (this.hasLetterReversal(target, spoken)) {
            return this.buildScore(target, spoken, false, 0.3, PronunciationErrorType.LETTER_REVERSAL, now);
        }

        // Phoneme comparison
        const targetPhonemes = this.phonemeDictionary.get(target) || this.estimatePhonemes(target);
        const spokenPhonemes = this.phonemeDictionary.get(spoken) || this.estimatePhonemes(spoken);

        const { matches, substitutions, deletions, insertions } = this.alignPhonemes(
            targetPhonemes,
            spokenPhonemes,
        );

        const score = targetPhonemes.length > 0 ? matches / targetPhonemes.length : 0;
        // More lenient threshold — speech recognition often gives slight
        // variations; only flag clearly wrong pronunciations
        const isCorrect = score >= 0.50;

        let errorType: PronunciationErrorType;
        if (isCorrect) {
            errorType = PronunciationErrorType.CORRECT;
        } else if (score < 0.2) {
            errorType = PronunciationErrorType.WHOLE_WORD_ERROR;
        } else if (deletions > insertions) {
            errorType = PronunciationErrorType.OMISSION;
        } else if (insertions > deletions) {
            errorType = PronunciationErrorType.ADDITION;
        } else if (substitutions > 0) {
            errorType = PronunciationErrorType.PHONEME_SUBSTITUTION;
        } else {
            errorType = PronunciationErrorType.WHOLE_WORD_ERROR;
        }

        return this.buildScore(target, spoken, isCorrect, score, errorType, now);
    }

    estimatePhonemes(word: string): string[] {
        const phonemes: string[] = [];
        const w = word.toLowerCase();
        let i = 0;

        while (i < w.length) {
            // Multi-char patterns
            if (i + 3 < w.length && w.substring(i, i + 4) === 'tion') {
                phonemes.push('SH', 'AH', 'N');
                i += 4;
                continue;
            }
            if (i + 2 < w.length && w.substring(i, i + 3) === 'ing') {
                phonemes.push('IH', 'NG');
                i += 3;
                continue;
            }
            if (i + 1 < w.length) {
                const di = w.substring(i, i + 2);
                if (di === 'sh') { phonemes.push('SH'); i += 2; continue; }
                if (di === 'ch') { phonemes.push('CH'); i += 2; continue; }
                if (di === 'th') { phonemes.push('TH'); i += 2; continue; }
                if (di === 'ph') { phonemes.push('F'); i += 2; continue; }
                if (di === 'oo') { phonemes.push('UW'); i += 2; continue; }
                if (di === 'ee') { phonemes.push('IY'); i += 2; continue; }
                if (di === 'ai' || di === 'ay') { phonemes.push('EY'); i += 2; continue; }
            }

            // Silent e at end
            if (i === w.length - 1 && w[i] === 'e' && w.length > 2) break;

            const mapped = SIMPLE_PHONEME_MAP[w[i]];
            if (mapped) phonemes.push(mapped);
            i++;
        }

        return phonemes;
    }

    private buildScore(
        target: string,
        spoken: string,
        isCorrect: boolean,
        score: number,
        errorType: PronunciationErrorType,
        timestamp: number,
    ): PronunciationScore {
        const targetPhonemes = this.phonemeDictionary.get(target) || this.estimatePhonemes(target);
        const spokenPhonemes = this.phonemeDictionary.get(spoken) || this.estimatePhonemes(spoken);

        const phoneticTarget = targetPhonemes
            .map(p => ARPA_TO_READABLE[p] || p.toLowerCase())
            .join('-');
        const phoneticSpoken = spokenPhonemes
            .map(p => ARPA_TO_READABLE[p] || p.toLowerCase())
            .join('-');

        const result: PronunciationScore = {
            targetWord: target,
            spokenWord: spoken,
            isCorrect,
            score,
            errorType,
            phoneticTarget,
            phoneticSpoken,
            timestamp,
        };

        // Store in history
        const history = this.pronunciationHistory.get(target) || [];
        history.push(result);
        this.pronunciationHistory.set(target, history);

        return result;
    }

    private hasLetterReversal(target: string, spoken: string): boolean {
        if (target.length !== spoken.length) return false;
        const reversals = [['b', 'd'], ['p', 'q'], ['m', 'w'], ['n', 'u']];
        let diffCount = 0;
        let isReversal = false;

        for (let i = 0; i < target.length; i++) {
            if (target[i] !== spoken[i]) {
                diffCount++;
                for (const [a, b] of reversals) {
                    if ((target[i] === a && spoken[i] === b) || (target[i] === b && spoken[i] === a)) {
                        isReversal = true;
                    }
                }
            }
        }

        return diffCount <= 2 && isReversal;
    }

    private alignPhonemes(
        target: string[],
        spoken: string[],
    ): { matches: number; substitutions: number; deletions: number; insertions: number } {
        const m = target.length;
        const n = spoken.length;
        const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));

        for (let i = 0; i <= m; i++) dp[i][0] = i;
        for (let j = 0; j <= n; j++) dp[0][j] = j;

        for (let i = 1; i <= m; i++) {
            for (let j = 1; j <= n; j++) {
                const cost = target[i - 1] === spoken[j - 1] ? 0 : 1;
                dp[i][j] = Math.min(
                    dp[i - 1][j] + 1,
                    dp[i][j - 1] + 1,
                    dp[i - 1][j - 1] + cost,
                );
            }
        }

        // Traceback
        let i = m;
        let j = n;
        let matches = 0;
        let substitutions = 0;
        let deletions = 0;
        let insertions = 0;

        while (i > 0 || j > 0) {
            if (i > 0 && j > 0 && dp[i][j] === dp[i - 1][j - 1] + (target[i - 1] === spoken[j - 1] ? 0 : 1)) {
                if (target[i - 1] === spoken[j - 1]) matches++;
                else substitutions++;
                i--;
                j--;
            } else if (i > 0 && dp[i][j] === dp[i - 1][j] + 1) {
                deletions++;
                i--;
            } else {
                insertions++;
                j--;
            }
        }

        return { matches, substitutions, deletions, insertions };
    }

    private levenshtein(a: string, b: string): number {
        const m = a.length;
        const n = b.length;
        const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));

        for (let i = 0; i <= m; i++) dp[i][0] = i;
        for (let j = 0; j <= n; j++) dp[0][j] = j;

        for (let i = 1; i <= m; i++) {
            for (let j = 1; j <= n; j++) {
                const cost = a[i - 1] === b[j - 1] ? 0 : 1;
                dp[i][j] = Math.min(
                    dp[i - 1][j] + 1,
                    dp[i][j - 1] + 1,
                    dp[i - 1][j - 1] + cost,
                );
            }
        }

        return dp[m][n];
    }

    // ──────────── Stats ────────────

    getSessionStats(): SessionPronunciationStats {
        const errorTypeCounts: Record<PronunciationErrorType, number> = {
            [PronunciationErrorType.LETTER_REVERSAL]: 0,
            [PronunciationErrorType.PHONEME_SUBSTITUTION]: 0,
            [PronunciationErrorType.OMISSION]: 0,
            [PronunciationErrorType.ADDITION]: 0,
            [PronunciationErrorType.WHOLE_WORD_ERROR]: 0,
            [PronunciationErrorType.CORRECT]: 0,
        };

        let totalWords = 0;
        let correctCount = 0;
        const wordStats: { word: string; attempts: number; avgScore: number }[] = [];
        const wordsToWatch: string[] = [];

        for (const [word, scores] of this.pronunciationHistory) {
            totalWords += scores.length;
            const correct = scores.filter(s => s.isCorrect).length;
            correctCount += correct;
            const avg = scores.reduce((a, s) => a + s.score, 0) / scores.length;

            for (const s of scores) {
                if (s.errorType) errorTypeCounts[s.errorType]++;
            }

            wordStats.push({ word, attempts: scores.length, avgScore: avg });

            if (scores.filter(s => !s.isCorrect).length >= 3) {
                wordsToWatch.push(word);
            }
        }

        wordStats.sort((a, b) => a.avgScore - b.avgScore);

        return {
            totalWords,
            correctCount,
            accuracy: totalWords > 0 ? correctCount / totalWords : 1,
            errorTypeCounts,
            mostStruggledWords: wordStats.slice(0, 10),
            mostStruggledPhonemes: [], // NeuroLex — phoneme-level not tracked individually
            wordsToWatch,
        };
    }

    getMostStruggledWords(limit = 10): { word: string; avgScore: number }[] {
        const results: { word: string; avgScore: number }[] = [];
        for (const [word, scores] of this.pronunciationHistory) {
            const avg = scores.reduce((a, s) => a + s.score, 0) / scores.length;
            results.push({ word, avgScore: avg });
        }
        results.sort((a, b) => a.avgScore - b.avgScore);
        return results.slice(0, limit);
    }

    getWordPronunciationHistory(word: string): PronunciationScore[] {
        return this.pronunciationHistory.get(word.toLowerCase()) || [];
    }

    reset(): void {
        this.pronunciationHistory.clear();
    }
}

export const pronunciationAnalyser = new PronunciationAnalyser();
