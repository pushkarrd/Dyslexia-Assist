/**
 * WordRegistry — Maps every rendered word to its screen position
 * so gaze coordinates can be matched to specific words.
 *
 * Parts:
 *   A — Wrap text nodes in <span data-word-index> elements (pixel-identical layout)
 *   B — Build the word registry (index, line, rect, text)
 *   C — Gaze-to-word spatial matching (Gaussian-weighted candidates)
 *   D — Live registry updates via ResizeObserver + MutationObserver
 */

// ======================== CONSTANTS ========================

/** Default search radius (px) around gaze point */
const DEFAULT_RADIUS = 150;

/** Gaussian sigma for weighting candidates by distance */
const SIGMA = 60;

/** Max candidates returned from a single query */
const MAX_CANDIDATES = 5;

/** Y-tolerance (px) for grouping words on the same line */
const LINE_Y_TOLERANCE = 4;

/** Debounce interval (ms) for observer-triggered rebuilds */
const REBUILD_DEBOUNCE_MS = 200;

// ======================== TYPES ========================

export interface WordEntry {
    wordIndex: number;
    lineIndex: number;
    text: string;
    rawText: string;
    centerX: number;
    centerY: number;
    rect: DOMRect;
}

export interface WordCandidate {
    wordIndex: number;
    lineIndex: number;
    text: string;
    rawText: string;
    centerX: number;
    centerY: number;
    distance: number;
    weight: number;
}

// ======================== HELPERS ========================

/** Strip leading/trailing punctuation from a word for phoneme matching. */
function stripPunctuation(raw: string): string {
    return raw.replace(/^[^a-zA-Z0-9]+/, '').replace(/[^a-zA-Z0-9]+$/, '');
}

/** Gaussian weight: high near center, falls off with distance. */
function gaussianWeight(distance: number): number {
    return Math.exp(-(distance * distance) / (2 * SIGMA * SIGMA));
}

// ======================== PART A — TEXT WRAPPING ========================

/**
 * Walk all text nodes inside a container and wrap each word in an inline
 * <span data-word-index="N" data-word-text="word">. The wrapping is designed
 * to be pixel-identical to the original layout.
 */
function wrapContentInWordSpans(container: HTMLElement): number {
    if (!container) return 0;

    // If already wrapped, strip existing word spans first
    _unwrapWordSpans(container);

    let wordIndex = 0;
    const textNodes = _collectTextNodes(container);

    for (const textNode of textNodes) {
        const content = textNode.textContent;
        if (!content || !content.trim()) continue;

        const tokens = content.split(/(\s+)/);
        const frag = document.createDocumentFragment();

        for (const token of tokens) {
            if (/^\s+$/.test(token)) {
                frag.appendChild(document.createTextNode(token));
            } else if (token.length > 0) {
                const span = document.createElement('span');
                span.setAttribute('data-word-index', String(wordIndex));
                span.setAttribute('data-word-text', stripPunctuation(token).toLowerCase());
                span.textContent = token;
                span.style.cssText = 'display:inline;margin:0;padding:0;border:0;background:none;';
                frag.appendChild(span);
                wordIndex++;
            }
        }

        textNode.parentNode!.replaceChild(frag, textNode);
    }

    return wordIndex;
}

/** Collect all Text nodes under a root (depth-first, skip script/style). */
function _collectTextNodes(root: HTMLElement): Text[] {
    const nodes: Text[] = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode(node: Text) {
            const parent = node.parentElement;
            if (!parent) return NodeFilter.FILTER_REJECT;
            const tag = parent.tagName;
            if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT') {
                return NodeFilter.FILTER_REJECT;
            }
            if (parent.hasAttribute('data-word-index')) return NodeFilter.FILTER_REJECT;
            return NodeFilter.FILTER_ACCEPT;
        },
    });
    while (walker.nextNode()) nodes.push(walker.currentNode as Text);
    return nodes;
}

/** Remove word-span wrappers, restoring original text nodes. */
function _unwrapWordSpans(container: HTMLElement): void {
    const spans = container.querySelectorAll('[data-word-index]');
    for (const span of spans) {
        const parent = span.parentNode;
        if (!parent) continue;
        const text = document.createTextNode(span.textContent || '');
        parent.replaceChild(text, span);
    }
    container.normalize();
}

// ======================== PART B — REGISTRY BUILDING ========================

/**
 * Build the word registry from existing data-word-index spans in the container.
 * Computes line indices by grouping words with similar Y centers.
 */
function buildRegistryFromSpans(container: HTMLElement): WordEntry[] {
    if (!container) return [];

    const spans = container.querySelectorAll('[data-word-index]');
    if (spans.length === 0) return [];

    const entries: WordEntry[] = [];

    for (const span of spans) {
        const rect = span.getBoundingClientRect();
        const idx = parseInt(span.getAttribute('data-word-index')!, 10);
        const rawText = span.textContent || '';
        entries.push({
            wordIndex: idx,
            lineIndex: -1,
            text: stripPunctuation(rawText).toLowerCase(),
            rawText,
            centerX: rect.left + rect.width / 2,
            centerY: rect.top + rect.height / 2,
            rect,
        });
    }

    // Assign line indices by clustering Y centres
    if (entries.length > 0) {
        const sorted = [...entries].sort((a, b) => a.centerY - b.centerY);
        let lineIdx = 0;
        let lineY = sorted[0].centerY;

        for (const entry of sorted) {
            if (Math.abs(entry.centerY - lineY) > LINE_Y_TOLERANCE) {
                lineIdx++;
                lineY = entry.centerY;
            }
            entry.lineIndex = lineIdx;
        }
    }

    entries.sort((a, b) => a.wordIndex - b.wordIndex);
    return entries;
}

// ======================== PART C — GAZE-TO-WORD MATCHING ========================

/**
 * Find candidate words near a gaze point, weighted by Gaussian proximity.
 */
function getWordCandidatesFromGaze(
    registry: WordEntry[],
    gazeX: number,
    gazeY: number,
    radius: number = DEFAULT_RADIUS,
): WordCandidate[] {
    let candidates = _findInRadius(registry, gazeX, gazeY, radius);

    if (candidates.length === 0) {
        candidates = _findInRadius(registry, gazeX, gazeY, radius * 2);
    }

    candidates.sort((a, b) => b.weight - a.weight);
    return candidates.slice(0, MAX_CANDIDATES);
}

function _findInRadius(
    registry: WordEntry[],
    gx: number,
    gy: number,
    r: number,
): WordCandidate[] {
    const rSq = r * r;
    const results: WordCandidate[] = [];

    for (const entry of registry) {
        const dx = entry.centerX - gx;
        const dy = entry.centerY - gy;
        const distSq = dx * dx + dy * dy;
        if (distSq > rSq) continue;

        const distance = Math.sqrt(distSq);
        results.push({
            wordIndex: entry.wordIndex,
            lineIndex: entry.lineIndex,
            text: entry.text,
            rawText: entry.rawText,
            centerX: entry.centerX,
            centerY: entry.centerY,
            distance,
            weight: gaussianWeight(distance),
        });
    }

    return results;
}

// ======================== PART D — MANAGER CLASS ========================

export class WordRegistryManager {
    private _container: HTMLElement | null = null;
    public wordRegistry: WordEntry[] = [];
    private _attached = false;

    private _resizeObs: ResizeObserver | null = null;
    private _mutationObs: MutationObserver | null = null;
    private _rebuildTimer: ReturnType<typeof setTimeout> | null = null;

    private _onResize = this._scheduleRebuild.bind(this);
    private _onMutate = this._scheduleRebuild.bind(this);

    // ---------- attach / detach ----------

    attach(container: HTMLElement): void {
        if (!container) return;
        this.detach();

        this._container = container;
        this._attached = true;

        wrapContentInWordSpans(container);
        this.wordRegistry = buildRegistryFromSpans(container);

        try {
            this._resizeObs = new ResizeObserver(this._onResize);
            this._resizeObs.observe(container);
        } catch {
            window.addEventListener('resize', this._onResize);
        }

        try {
            this._mutationObs = new MutationObserver(this._onMutate);
            this._mutationObs.observe(container, {
                childList: true,
                subtree: true,
                characterData: true,
            });
        } catch { /* ignore */ }
    }

    detach(): void {
        if (this._rebuildTimer) {
            clearTimeout(this._rebuildTimer);
            this._rebuildTimer = null;
        }

        if (this._resizeObs) {
            this._resizeObs.disconnect();
            this._resizeObs = null;
        } else {
            window.removeEventListener('resize', this._onResize);
        }

        if (this._mutationObs) {
            this._mutationObs.disconnect();
            this._mutationObs = null;
        }

        if (this._container) {
            _unwrapWordSpans(this._container);
        }

        this._container = null;
        this.wordRegistry = [];
        this._attached = false;
    }

    // ---------- rebuild ----------

    private _scheduleRebuild(): void {
        if (!this._attached) return;
        if (this._rebuildTimer) clearTimeout(this._rebuildTimer);

        this._rebuildTimer = setTimeout(() => {
            this._rebuild();
        }, REBUILD_DEBOUNCE_MS);
    }

    private _rebuild(): void {
        if (!this._container || !this._attached) return;

        if (this._mutationObs) this._mutationObs.disconnect();

        const existing = this._container.querySelector('[data-word-index]');
        if (!existing) {
            wrapContentInWordSpans(this._container);
        }

        this.wordRegistry = buildRegistryFromSpans(this._container);

        if (this._mutationObs && this._container) {
            try {
                this._mutationObs.observe(this._container, {
                    childList: true,
                    subtree: true,
                    characterData: true,
                });
            } catch { /* ignore */ }
        }
    }

    rebuild(): void {
        this._rebuild();
    }

    // ---------- queries ----------

    getWordCandidates(gazeX: number, gazeY: number, radius?: number): WordCandidate[] {
        return getWordCandidatesFromGaze(this.wordRegistry, gazeX, gazeY, radius);
    }

    getWordByIndex(index: number): WordEntry | null {
        return this.wordRegistry.find((w) => w.wordIndex === index) || null;
    }

    get wordCount(): number {
        return this.wordRegistry.length;
    }

    get lineCount(): number {
        if (this.wordRegistry.length === 0) return 0;
        return this.wordRegistry[this.wordRegistry.length - 1].lineIndex + 1;
    }

    // ---------- highlighting ----------

    highlightWord(wordIndex: number, color: string): void {
        if (!this._container) return;
        const span = this._container.querySelector(
            `[data-word-index="${wordIndex}"]`,
        ) as HTMLElement | null;
        if (span) {
            span.style.backgroundColor = color;
            span.style.borderRadius = '3px';
            span.style.transition = 'background-color 150ms ease';
        }
    }

    clearHighlight(wordIndex: number): void {
        if (!this._container) return;
        const span = this._container.querySelector(
            `[data-word-index="${wordIndex}"]`,
        ) as HTMLElement | null;
        if (span) {
            span.style.backgroundColor = '';
            span.style.borderRadius = '';
            span.style.boxShadow = '';
        }
    }

    clearAllHighlights(): void {
        if (!this._container) return;
        const spans = this._container.querySelectorAll('[data-word-index]');
        for (const s of spans) {
            const span = s as HTMLElement;
            span.style.backgroundColor = '';
            span.style.borderRadius = '';
            span.style.boxShadow = '';
        }
    }

    addWordClass(wordIndex: number, className: string): void {
        if (!this._container) return;
        const span = this._container.querySelector(`[data-word-index="${wordIndex}"]`);
        if (span) span.classList.add(className);
    }

    removeWordClass(wordIndex: number, className: string): void {
        if (!this._container) return;
        const span = this._container.querySelector(`[data-word-index="${wordIndex}"]`);
        if (span) span.classList.remove(className);
    }
}

// ======================== STANDALONE EXPORTS ========================

export {
    wrapContentInWordSpans,
    buildRegistryFromSpans,
    getWordCandidatesFromGaze,
    stripPunctuation,
};

export default WordRegistryManager;
