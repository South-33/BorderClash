'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

// =============================================================================
// CASCADE LAYOUT HOOK - SINGLE CYCLE PATTERN
// =============================================================================
// Trigger → Fade out → Force desktop → Check if fits → Decide → Fade in
// Only checks overflow in 'analysis' viewMode
// =============================================================================

const FADE_MS = 150;
const BREAKPOINT = 1280;

export interface CascadeLayoutResult {
    containerRef: React.RefObject<HTMLDivElement | null>;
    neutralCardRef: React.RefObject<HTMLDivElement | null>;
    isDesktop: boolean;
    containerWidth: number | null;
    neutralRatio: number;
    forceMobile: boolean;
    lang: 'en' | 'th' | 'kh';
    isLayoutReady: boolean;
    setLang: (newLang: 'en' | 'th' | 'kh') => void;
}

export interface CascadeLayoutOptions {
    viewMode?: 'analysis' | 'timeline' | 'guide';
}

export function useCascadeLayout({ viewMode = 'analysis' }: CascadeLayoutOptions = {}): CascadeLayoutResult {
    // Refs
    const containerRef = useRef<HTMLDivElement>(null);
    const neutralCardRef = useRef<HTMLDivElement>(null);
    const isTransitioning = useRef(false);

    // State
    const [isDesktop, setIsDesktop] = useState(false);
    const [forceMobile, setForceMobile] = useState(false);
    const [lang, setLangState] = useState<'en' | 'th' | 'kh'>('en');
    const [isLayoutReady, setIsLayoutReady] = useState(false);

    // Interface compatibility
    const [containerWidth] = useState<number | null>(null);
    const [neutralRatio] = useState(1);

    // Check if neutral card overflows
    const checkOverflow = useCallback((): boolean => {
        const el = neutralCardRef.current;
        if (!el) return false;
        if (el.clientHeight < 100) return false;
        const result = el.scrollHeight > el.clientHeight + 2;
        console.log('[Cascade] checkOverflow:', { scrollH: el.scrollHeight, clientH: el.clientHeight, result });
        return result;
    }, []);

    // === THE RECALCULATE CYCLE ===
    // 1. Fade out
    // 2. Force desktop/analysis layout
    // 3. Check if fits (only in analysis mode)
    // 4. If doesn't fit, switch to mobile
    // 5. Fade in
    const recalculate = useCallback((newLang?: 'en' | 'th' | 'kh') => {
        if (isTransitioning.current) return;
        isTransitioning.current = true;

        const langToUse = newLang ?? lang;
        const isDesktopNow = window.innerWidth >= BREAKPOINT;

        console.log('[Cascade] recalculate', { langToUse, isDesktopNow, viewMode, windowWidth: window.innerWidth });

        // 1. FADE OUT
        setIsLayoutReady(false);

        setTimeout(() => {
            // 2. UPDATE LANG (always)
            setLangState(langToUse);

            // If not desktop screen, just go mobile directly
            if (!isDesktopNow) {
                console.log('[Cascade] Not desktop, going mobile');
                setIsDesktop(false);
                setForceMobile(false);
                setIsLayoutReady(true);
                isTransitioning.current = false;
                return;
            }

            // 3. FORCE DESKTOP LAYOUT
            setIsDesktop(true);

            // Only check overflow in analysis mode
            if (viewMode !== 'analysis') {
                console.log('[Cascade] Not analysis mode, staying desktop');
                setForceMobile(false);
                setIsLayoutReady(true);
                isTransitioning.current = false;
                return;
            }

            // 4. FORCE DESKTOP LAYOUT to check overflow (analysis mode only)
            console.log('[Cascade] Analysis mode - forcing desktop to check overflow');
            setForceMobile(false);

            // 5. WAIT FOR RENDER, then check overflow
            requestAnimationFrame(() => {
                setTimeout(() => {
                    const needsMobile = checkOverflow();
                    console.log('[Cascade] Overflow result:', needsMobile);

                    // 6. SET FINAL STATE
                    setForceMobile(needsMobile);

                    // 7. FADE IN
                    setIsLayoutReady(true);
                    isTransitioning.current = false;
                }, 100);
            });
        }, FADE_MS);
    }, [lang, viewMode, checkOverflow]);

    // === INITIAL MOUNT ===
    useEffect(() => {
        const isDesktopNow = window.innerWidth >= BREAKPOINT;
        setIsDesktop(isDesktopNow);

        // Wait for content, check overflow, reveal
        setTimeout(() => {
            if (isDesktopNow) {
                setForceMobile(checkOverflow());
            }
            setIsLayoutReady(true);
        }, 150);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // === RESIZE HANDLER ===
    useEffect(() => {
        let timeout: number;

        const handleResize = () => {
            clearTimeout(timeout);
            timeout = window.setTimeout(() => {
                recalculate();
            }, 150);
        };

        window.addEventListener('resize', handleResize);
        return () => {
            clearTimeout(timeout);
            window.removeEventListener('resize', handleResize);
        };
    }, [recalculate]);

    // === LANGUAGE SETTER ===
    const setLang = useCallback((newLang: 'en' | 'th' | 'kh') => {
        if (newLang === lang) return;
        recalculate(newLang);
    }, [lang, recalculate]);

    return {
        containerRef,
        neutralCardRef,
        isDesktop,
        containerWidth,
        neutralRatio,
        forceMobile,
        lang,
        isLayoutReady,
        setLang,
    };
}
