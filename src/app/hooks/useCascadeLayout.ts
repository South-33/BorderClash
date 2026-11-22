'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { flushSync } from 'react-dom';

// =============================================================================
// CASCADE LAYOUT HOOK - ADAPTIVE SNUG FIT ALGORITHM
// =============================================================================
// ALGORITHM STEPS:
// 1. Min Width Check (Min "Snug" Width). Fits? -> Done.
// 2. Max Width Check (Window Width). Fails? -> Go to Step 3. 
//      -> Fits? -> Perform Binary Search between Min and Max to find "Snug" width.
//                  (Stops when precision is within 100px).
// 3. Max Ratio Check (Ratio 1.35, Max Width). Fits? -> Done.
// 4. Force Mobile.
// =============================================================================

const FADE_MS = 150;
const MOBILE_BREAKPOINT = 1280; // Below this = automatic mobile view
const MIN_SNUG_WIDTH = 1800;
const MAX_RATIO = 1.35;
const LANGUAGE_STORAGE_KEY = 'borderclash-language';

// Precision Settings
const SEARCH_PRECISION_PX = 100; // Stop searching when range is smaller than this
const MAX_SEARCH_STEPS = 5;      // Hard cap to prevent layout thrashing

export interface CascadeLayoutResult {
    containerRef: React.RefObject<HTMLDivElement | null>;
    sidebarRef: React.RefObject<HTMLElement | null>;
    neutralCardRef: React.RefObject<HTMLDivElement | null>;
    perspectivesRef: React.RefObject<HTMLDivElement | null>;
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
    awaitBeforeMeasure?: () => Promise<void>;
}

export function useCascadeLayout({ awaitBeforeMeasure }: CascadeLayoutOptions = {}): CascadeLayoutResult {
    // Refs
    const containerRef = useRef<HTMLDivElement>(null);
    const sidebarRef = useRef<HTMLElement>(null);
    const neutralCardRef = useRef<HTMLDivElement>(null);
    const perspectivesRef = useRef<HTMLDivElement>(null);
    const isTransitioning = useRef(false);
    const lastProcessedWidth = useRef<number | null>(null);

    // State
    const [layoutState, setLayoutState] = useState({
        // The shell starts hidden, and the normal responsive CSS already
        // stacks below the desktop breakpoint. Starting in desktop mode keeps
        // the first desktop measurement out of the force-mobile override and
        // removes a race between the mount effect and the first DOM read.
        isDesktop: true,
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
        // Short desktop layouts intentionally make the neutral synthesis an
        // internal scroll area so the whole dashboard can remain one viewport.
        // That vertical overflow is expected and must not trigger mobile mode.
        if (window.innerWidth >= MOBILE_BREAKPOINT && window.innerHeight <= 960) {
            return false;
        }
        return el.scrollHeight > el.clientHeight + 2;
    }, []);

    // Measurement probes run only while the dashboard shell is fully hidden.
    // Write candidate geometry directly, let the browser synchronously resolve
    // layout on the following overflow read, then commit only the final result
    // to React. This avoids a render + animation-frame round trip per probe.
    const probeGeometry = useCallback((width: number, ratio = 1) => {
        if (containerRef.current) {
            containerRef.current.style.maxWidth = `${width}px`;
        }
        if (perspectivesRef.current) {
            perspectivesRef.current.style.gridTemplateColumns = `minmax(0, 1fr) minmax(0, ${ratio}fr) minmax(0, 1fr)`;
        }
        return !checkOverflow();
    }, [checkOverflow]);

    const nextFrame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));

    const setSidebarHeight = useCallback((sidebarHeight?: number) => {
        if (sidebarHeight && containerRef.current) {
            containerRef.current.style.setProperty('--dashboard-sidebar-height', `${sidebarHeight}px`);
        }
    }, []);

    const settleTypographyAndSidebar = useCallback(async () => {
        // Measurement state is committed synchronously before this runs, so we
        // only need to wait for the font set that the committed text requires.
        await document.fonts.ready;

        // The main views intentionally match the natural sidebar height on
        // desktop. Keep that geometry in the same measurement transaction as
        // the adaptive fit instead of racing a separate ResizeObserver/state
        // update against the neutral-card overflow checks.
        setSidebarHeight(sidebarRef.current?.offsetHeight);
        await nextFrame();
    }, [setSidebarHeight]);

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
        if (awaitBeforeMeasure) {
            await awaitBeforeMeasure();
        } else {
            await new Promise(r => setTimeout(r, FADE_MS));
        }

        // Final geometry must be committed and painted once while hidden
        // before the shell fades back in.
        const reveal = async (updates: Partial<typeof layoutState> = {}) => {
            flushSync(() => updateState({
                ...updates,
                isMeasuring: false,
                isLayoutReady: false,
            }));
            await nextFrame();
            updateState({ isLayoutReady: true });
            isTransitioning.current = false;
        };

        // Apply the language hint before font/layout work. We always fit
        // against Analysis while hidden, even if the user changed language
        // from Timeline/Guide, so returning to Overview cannot reveal a stale
        // fit from the previous language.
        document.documentElement.lang = langToUse === 'kh' ? 'km' : langToUse;

        // If physically on mobile/tablet, skip all logic
        if (!isDesktopNow) {
            flushSync(() => {
                setLangState(langToUse);
                updateState({
                    isDesktop: false,
                    forceMobile: false,
                    containerWidth: null,
                    neutralRatio: 1.0,
                    isMeasuring: false,
                    isLayoutReady: false,
                });
            });
            await settleTypographyAndSidebar();
            await reveal();
            return;
        }

        // Determine the target minimum width (clamped to window size if window is smaller than target)
        const targetMinWidth = Math.min(windowWidth, MIN_SNUG_WIDTH);

        // === STEP 1: MINIMUM WIDTH ===
        // Establish the real desktop/sidebar geometry before the first overflow
        // read. This also removes a separate setup frame from the old cascade.
        flushSync(() => {
            setLangState(langToUse);
            updateState({
                isDesktop: true,
                forceMobile: false,
                containerWidth: targetMinWidth,
                neutralRatio: 1.0,
                isMeasuring: true,
                isLayoutReady: false,
            });
        });
        probeGeometry(targetMinWidth, 1);
        await settleTypographyAndSidebar();

        if (!checkOverflow()) {
            await reveal({ containerWidth: targetMinWidth, neutralRatio: 1.0 });
            return;
        }

        // === STEP 2: MAX WIDTH CHECK ===
        const fitsAtMax = probeGeometry(windowWidth);

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

                if (probeGeometry(mid)) {
                    // Fits here, store as best known fit, try smaller
                    bestFit = mid;
                    max = mid;
                } else {
                    // Overflows here, need larger
                    min = mid;
                }
            }

            probeGeometry(bestFit);
            await reveal({ containerWidth: bestFit, neutralRatio: 1.0 });
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
        if (probeGeometry(windowWidth, MAX_RATIO)) {
            // MAX_RATIO works, binary search for minimum
            while ((maxRatio - minRatio) > RATIO_PRECISION && ratioSteps < MAX_RATIO_STEPS) {
                ratioSteps++;
                const midRatio = (minRatio + maxRatio) / 2;

                if (probeGeometry(windowWidth, midRatio)) {
                    // Fits at this ratio, try smaller
                    bestRatio = midRatio;
                    maxRatio = midRatio;
                } else {
                    // Overflows, need larger ratio
                    minRatio = midRatio;
                }
            }

            probeGeometry(windowWidth, bestRatio);
            await reveal({
                containerWidth: windowWidth,
                neutralRatio: bestRatio,
            });
            return;
        }

        // === STEP 4: MOBILE FALLBACK ===
        await reveal({
            isDesktop: true,
            forceMobile: true,
            neutralRatio: 1.0,
            containerWidth: null,
        });

    // updateState is a local state helper. Keeping it out preserves the original
    // recalculation lifecycle instead of recreating this callback on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [lang, checkOverflow, probeGeometry, awaitBeforeMeasure, settleTypographyAndSidebar]);

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
        const sidebar = sidebarRef.current;
        if (!sidebar) return;

        const resizeObserver = new ResizeObserver(([entry]) => {
            const borderBox = Array.isArray(entry.borderBoxSize)
                ? entry.borderBoxSize[0]
                : entry.borderBoxSize;
            setSidebarHeight(borderBox?.blockSize ?? entry.target.getBoundingClientRect().height);
        });
        resizeObserver.observe(sidebar);
        return () => resizeObserver.disconnect();
    }, [setSidebarHeight]);

    useEffect(() => {
        // This hook intentionally starts its DOM measurement state machine on mount.
        let initialLang: 'en' | 'th' | 'kh' | undefined;
        try {
            const savedLang = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
            if (savedLang === 'en' || savedLang === 'th' || savedLang === 'kh') {
                initialLang = savedLang;
            }
        } catch {
            // Storage can be unavailable in strict privacy modes. Language
            // persistence is an enhancement; the dashboard must still load.
        }
        recalculate(initialLang);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const setLang = useCallback((newLang: 'en' | 'th' | 'kh') => {
        if (newLang === lang) return;
        try {
            window.localStorage.setItem(LANGUAGE_STORAGE_KEY, newLang);
        } catch {
            // Keep the language switch functional even if persistence fails.
        }
        recalculate(newLang);
    }, [lang, recalculate]);

    return {
        containerRef,
        sidebarRef,
        neutralCardRef,
        perspectivesRef,
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
