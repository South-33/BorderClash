'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

// =============================================================================
// CASCADE LAYOUT HOOK - ADAPTIVE SNUG FIT ALGORITHM
// =============================================================================
// ALGORITHM STEPS:
// 1. Min Width Check (Min "Snug" Width). Fits? -> Done.
// 2. Max Width Check (Window Width). Fails? -> Go to Step 3. 
//      -> Fits? -> Perform Binary Search between Min and Max to find "Snug" width.
//                  (Stops when precision is within 100px).
// 3. Max Ratio Check (Ratio 1.5, Max Width). Fits? -> Done.
// 4. Force Mobile.
// =============================================================================

const FADE_MS = 150;
const MOBILE_BREAKPOINT = 1280; // Below this = automatic mobile view
const MIN_SNUG_WIDTH = 1800;
const MAX_RATIO = 1.35;

// Precision Settings
const SEARCH_PRECISION_PX = 100; // Stop searching when range is smaller than this
const MAX_SEARCH_STEPS = 5;      // Hard cap to prevent layout thrashing

export interface CascadeLayoutResult {
    containerRef: React.RefObject<HTMLDivElement | null>;
    neutralCardRef: React.RefObject<HTMLDivElement | null>;
    isDesktop: boolean;
    containerWidth: number | null;
    neutralRatio: number;
    forceMobile: boolean;
    lang: 'en' | 'th' | 'kh';
    isLayoutReady: boolean;
    isMeasuring: boolean;
    setLang: (newLang: 'en' | 'th' | 'kh') => void;
}

export interface CascadeLayoutOptions {
    viewMode?: 'analysis' | 'timeline' | 'guide';
    isLoading?: boolean;
}

export function useCascadeLayout({ viewMode = 'analysis', isLoading = false }: CascadeLayoutOptions = {}): CascadeLayoutResult {
    // Refs
    const containerRef = useRef<HTMLDivElement>(null);
    const neutralCardRef = useRef<HTMLDivElement>(null);
    const isTransitioning = useRef(false);
    const prevLoading = useRef(isLoading);
    const lastProcessedWidth = useRef<number | null>(null);

    // State
    const [layoutState, setLayoutState] = useState({
        isDesktop: false,
        forceMobile: false,
        containerWidth: null as number | null,
        neutralRatio: 1.0,
        isLayoutReady: false,
        isMeasuring: false
    });
    const [lang, setLangState] = useState<'en' | 'th' | 'kh'>('en');

    // Helper to update partial state
    const updateState = (updates: Partial<typeof layoutState>) => {
        setLayoutState(prev => ({ ...prev, ...updates }));
    };

    // Check if neutral card overflows
    const checkOverflow = useCallback((): boolean => {
        const el = neutralCardRef.current;
        if (!el) return false;
        return el.scrollHeight > el.clientHeight + 2;
    }, []);

    // Optimized frame waiter
    const nextFrame = () => new Promise<void>(resolve => {
        requestAnimationFrame(() => setTimeout(resolve, 0));
    });

    // === THE ADAPTIVE RECALCULATION ===
    const recalculate = useCallback(async (newLang?: 'en' | 'th' | 'kh') => {
        if (isTransitioning.current) return;
        isTransitioning.current = true;

        const langToUse = newLang ?? lang;
        const windowWidth = window.innerWidth;
        const isDesktopNow = windowWidth >= MOBILE_BREAKPOINT;

        // Track processed width to prevent height-only resize events (mobile address bar) from triggering recalc
        lastProcessedWidth.current = windowWidth;



        // 0. FADE OUT & RESET
        updateState({ isLayoutReady: false });
        await new Promise(r => setTimeout(r, FADE_MS));

        // Now that we're faded out, enable measuring mode (shows ANALYSIS view for measurements)
        updateState({ isMeasuring: true });
        setLangState(langToUse);

        // If physically on mobile/tablet, skip all logic
        if (!isDesktopNow) {
            updateState({
                isDesktop: false,
                forceMobile: false,
                containerWidth: null,
                neutralRatio: 1.0,
                isMeasuring: false,
                isLayoutReady: true
            });
            isTransitioning.current = false;
            return;
        }

        // Determine the target minimum width (clamped to window size if window is smaller than target)
        const targetMinWidth = Math.min(windowWidth, MIN_SNUG_WIDTH);

        // === STEP 1: MINIMUM WIDTH ===
        updateState({
            isDesktop: true,
            forceMobile: false,
            containerWidth: targetMinWidth,
            neutralRatio: 1.0
        });
        await nextFrame();

        if (!checkOverflow()) {
            updateState({ isMeasuring: false, isLayoutReady: true });
            isTransitioning.current = false;
            return;
        }

        // === STEP 2: MAX WIDTH CHECK ===
        updateState({ containerWidth: windowWidth });
        await nextFrame();

        const fitsAtMax = !checkOverflow();

        if (fitsAtMax) {
            // It fits at Max, and failed at Min.
            // SEARCH: Find the "Snug" fit using Adaptive Binary Search

            let min = targetMinWidth;
            let max = windowWidth;
            let bestFit = windowWidth;
            let steps = 0;

            // ADAPTIVE LOOP: Run until precision is good OR steps maxed out
            while ((max - min) > SEARCH_PRECISION_PX && steps < MAX_SEARCH_STEPS) {
                steps++;
                const mid = Math.floor((min + max) / 2);

                updateState({ containerWidth: mid });
                await nextFrame();

                if (!checkOverflow()) {
                    // Fits here, store as best known fit, try smaller
                    bestFit = mid;
                    max = mid;
                } else {
                    // Overflows here, need larger
                    min = mid;
                }
            }


            updateState({ containerWidth: bestFit, isMeasuring: false, isLayoutReady: true });
            isTransitioning.current = false;
            return;
        }

        // === STEP 3: BINARY SEARCH RATIO ===
        // Content overflows even at max width. Try finding minimum ratio that fits.

        let minRatio = 1.0;
        let maxRatio = MAX_RATIO;
        let bestRatio = MAX_RATIO;
        let ratioSteps = 0;
        const RATIO_PRECISION = 0.05; // Stop when range is smaller than 5%
        const MAX_RATIO_STEPS = 5;

        // First check if MAX_RATIO even works
        updateState({ containerWidth: windowWidth, neutralRatio: MAX_RATIO });
        await nextFrame();

        if (!checkOverflow()) {
            // MAX_RATIO works, binary search for minimum
            while ((maxRatio - minRatio) > RATIO_PRECISION && ratioSteps < MAX_RATIO_STEPS) {
                ratioSteps++;
                const midRatio = (minRatio + maxRatio) / 2;

                updateState({ neutralRatio: midRatio });
                await nextFrame();

                if (!checkOverflow()) {
                    // Fits at this ratio, try smaller
                    bestRatio = midRatio;
                    maxRatio = midRatio;
                } else {
                    // Overflows, need larger ratio
                    minRatio = midRatio;
                }
            }

            updateState({ neutralRatio: bestRatio, isMeasuring: false, isLayoutReady: true });
            isTransitioning.current = false;
            return;
        }

        // === STEP 4: MOBILE FALLBACK ===
        updateState({
            forceMobile: true,
            neutralRatio: 1.0,
            containerWidth: null,
            isMeasuring: false,
            isLayoutReady: true
        });
        isTransitioning.current = false;

    }, [lang, checkOverflow]);

    // === HANDLERS ===
    useEffect(() => {
        let timeout: number;
        const handleResize = () => {
            // Only recalculate if WIDTH changed (ignore height-only changes from mobile address bar)
            const currentWidth = window.innerWidth;
            if (lastProcessedWidth.current !== null && lastProcessedWidth.current === currentWidth) {
                return; // Width unchanged, skip (likely mobile scroll causing address bar hide/show)
            }
            clearTimeout(timeout);
            timeout = window.setTimeout(() => recalculate(), 150);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [recalculate]);

    useEffect(() => {
        recalculate();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const setLang = useCallback((newLang: 'en' | 'th' | 'kh') => {
        if (newLang === lang) return;
        recalculate(newLang);
    }, [lang, recalculate]);

    useEffect(() => {
        if (prevLoading.current && !isLoading) {
            setTimeout(() => recalculate(), 100);
        }
        prevLoading.current = isLoading;
    }, [isLoading, recalculate]);

    return {
        containerRef,
        neutralCardRef,
        isDesktop: layoutState.isDesktop,
        containerWidth: layoutState.containerWidth,
        neutralRatio: layoutState.neutralRatio,
        forceMobile: layoutState.forceMobile,
        lang,
        isLayoutReady: layoutState.isLayoutReady,
        isMeasuring: layoutState.isMeasuring,
        setLang,
    };
}
