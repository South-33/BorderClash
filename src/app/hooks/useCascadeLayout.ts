'use client';

import { useState, useRef, useLayoutEffect, useEffect, useCallback } from 'react';

// =============================================================================
// CASCADE LAYOUT HOOK
// =============================================================================
// This hook encapsulates ALL logic for the "snug-fit" cascade layout.
// 
// GOAL: The neutral card (center) drives the layout width. The algorithm:
// 1. Measures the neutral card's text content
// 2. Adjusts the neutral column ratio (1.0 → 1.5) to prevent overflow
// 3. Shrinks the overall container to find the tightest "snug" fit
// 4. Falls back to mobile layout if text still overflows at max ratio
//
// USAGE:
//   const cascade = useCascadeLayout({ isDesktop, lang, contentKey });
//   <div ref={cascade.containerRef} style={cascade.containerStyle}>
//     <div ref={cascade.gridRef} style={cascade.gridStyle}>
//       <div ref={cascade.neutralTextRef}>...neutral content...</div>
//     </div>
//   </div>
// =============================================================================

export interface CascadeLayoutOptions {
    /** Whether we're on desktop (xl+ breakpoint) */
    isDesktop: boolean;
    /** Current language - affects text metrics */
    lang: 'en' | 'th' | 'kh';
    /** Any value that changes when content changes (triggers recalculation) */
    contentKey: string | null;
    /** Enable/disable the cascade algorithm (false = static layout) */
    enabled?: boolean;
}

export interface CascadeLayoutResult {
    /** Attach to the outermost layout container */
    containerRef: React.RefObject<HTMLDivElement | null>;
    /** Attach to the perspectives grid */
    gridRef: React.RefObject<HTMLDivElement | null>;
    /** Attach to the neutral card's text content div */
    neutralTextRef: React.RefObject<HTMLDivElement | null>;
    /** Style for the container (maxWidth) */
    containerStyle: React.CSSProperties;
    /** Style for the grid (gridTemplateColumns) */
    gridStyle: React.CSSProperties;
    /** CSS class for fade-in transition */
    containerClass: string;
    /** Whether layout calculation is complete */
    isReady: boolean;
    /** Current neutral ratio (1.0 - 1.5) */
    neutralRatio: number;
    /** Calculated layout width in pixels (null = no constraint) */
    layoutWidth: number | null;
    /** Force mobile layout due to overflow */
    forceMobile: boolean;
}

export function useCascadeLayout(options: CascadeLayoutOptions): CascadeLayoutResult {
    const { isDesktop, lang, contentKey, enabled = true } = options;

    // --- REFS ---
    const containerRef = useRef<HTMLDivElement>(null);
    const gridRef = useRef<HTMLDivElement>(null);
    const neutralTextRef = useRef<HTMLDivElement>(null);

    // --- STATE ---
    const [isReady, setIsReady] = useState(!enabled); // Ready immediately if disabled
    const [neutralRatio, setNeutralRatio] = useState(1.5); // Default static ratio
    const [layoutWidth, setLayoutWidth] = useState<number | null>(null);
    const [forceMobile, setForceMobile] = useState(false);

    // --- CALCULATION TRACKING ---
    // --- CALCULATION TRACKING ---
    const lastViewportWidth = useRef<number>(0);
    const skipNextCheck = useRef(false); // Skip one calc cycle after switching to desktop

    // --- CORE ALGORITHM ---
    const calculateSnugWidth = useCallback(() => {
        if (!enabled || !isDesktop) {
            setIsReady(true);
            return;
        }

        const container = containerRef.current;
        const textEl = neutralTextRef.current;
        const grid = gridRef.current;

        if (!container || !textEl) {
            setIsReady(true);
            return;
        }

        // Skip this calculation if we just switched layouts (let DOM update first)
        if (skipNextCheck.current) {
            skipNextCheck.current = false;
            setIsReady(true);
            return;
        }

        const viewportWidth = window.innerWidth;
        const previousWidth = lastViewportWidth.current;
        const widthIncreased = viewportWidth > previousWidth;
        const widthDecreased = viewportWidth < previousWidth;

        // --- SIMPLE LOGIC ---
        // Width shrinks → stay in current mode (don't recalculate)
        // Width grows → try desktop, check if fits

        if (forceMobile && widthDecreased) {
            // Shrinking while in mobile → stay in mobile
            lastViewportWidth.current = viewportWidth;
            setIsReady(true);
            return;
        }

        if (forceMobile && widthIncreased) {
            // Growing while in mobile → switch to desktop and let React re-render
            // Set skip flag so next calc waits for DOM update
            lastViewportWidth.current = viewportWidth;
            skipNextCheck.current = true; // Skip the NEXT calculation
            setForceMobile(false);
            setIsReady(true);
            return;
        }

        // Update tracking
        lastViewportWidth.current = viewportWidth;

        // =========================================================================
        // SNUG-FIT ALGORITHM
        // =========================================================================

        // viewportWidth already declared above in hysteresis check
        const maxWidth = viewportWidth * 1;
        const MIN_RATIO = 1.0;
        const MAX_RATIO = 1.5;
        const RATIO_STEP = 0.05;

        // Helper: Check if neutral content is visually clipped
        // Uses bounding rect to check if last child extends beyond visible container
        const checkOverflow = (): boolean => {
            // Find the Card's content container
            const cardContent = textEl.closest('.flex-1.flex-col.space-y-2') as HTMLElement | null;
            if (!cardContent) {
                return textEl.scrollHeight > textEl.clientHeight + 2;
            }

            // Get the card element (the one with overflow-hidden)
            const card = cardContent.closest('[class*="border-dotted"]') as HTMLElement | null;
            if (!card) {
                return textEl.scrollHeight > textEl.clientHeight + 2;
            }

            // Get the KEY DEVELOPMENTS section (last major child in the content)
            // This is the div with "mt-auto pt-2 border-t" containing the bullet list
            const keyDevSection = cardContent.querySelector('.mt-auto.pt-2') as HTMLElement | null;

            // If KEY DEVELOPMENTS doesn't exist, check the last child
            const elementToCheck = keyDevSection || cardContent.lastElementChild as HTMLElement | null;

            if (!elementToCheck) {
                return false;
            }

            // Get bounding rects
            const cardRect = card.getBoundingClientRect();
            const elementRect = elementToCheck.getBoundingClientRect();

            // Check if the element's bottom extends beyond the card's visible bottom
            // Add small buffer (5px) to account for borders/padding
            const isClipped = elementRect.bottom > cardRect.bottom + 5;



            return isClipped;
        };

        // Helper: Apply ratio to grid
        const applyRatio = (ratio: number) => {
            if (grid) {
                grid.style.gridTemplateColumns = `1fr ${ratio}fr 1fr`;
                void grid.offsetHeight; // Force reflow
            }
        };

        // --- PHASE 1: Start with min ratio ---
        let currentRatio = MIN_RATIO;
        // container.style.transition = 'none'; // REMOVED: broken fade-in
        container.style.maxWidth = `${maxWidth}px`;
        applyRatio(currentRatio);

        let overflows = checkOverflow();

        // --- PHASE 2: Increase ratio until content fits or max reached ---
        while (overflows && currentRatio < MAX_RATIO) {
            currentRatio = Math.min(currentRatio + RATIO_STEP, MAX_RATIO);
            applyRatio(currentRatio);
            overflows = checkOverflow();
        }

        // --- PHASE 3: If still overflows at max ratio, force mobile ---
        if (overflows) {
            container.style.removeProperty('max-width');
            container.style.removeProperty('transition');
            if (grid) grid.style.removeProperty('grid-template-columns');

            setLayoutWidth(null);
            setNeutralRatio(1.5);
            setForceMobile(true);
            lastViewportWidth.current = viewportWidth;


            requestAnimationFrame(() => setIsReady(true));
            return;
        }

        // --- PHASE 4: Snug-fit shrinking (DISABLED) ---
        // TODO: Uncomment when ready to implement snug-fit
        // For now, just use max width
        /*
        let width = maxWidth;
        let lastGoodWidth = maxWidth;
    
        while (width > minWidth) {
            container.style.maxWidth = `${width}px`;
            void textEl.offsetHeight;
    
            if (checkOverflow()) {
                break;
            }
            lastGoodWidth = width;
            width -= WIDTH_STEP;
        }
    
        // Final width: use last good if we broke due to overflow
        const finalWidth = checkOverflow() ? lastGoodWidth : width;
        const snugWidth = Math.min(Math.round(finalWidth), maxWidth);
        */

        // Use full max width (snug-fit disabled)
        const snugWidth = maxWidth;

        // Apply final values
        container.style.maxWidth = `${snugWidth}px`;
        setLayoutWidth(null); // null = no constraint in React styles
        setNeutralRatio(currentRatio);
        setForceMobile(false);
        lastViewportWidth.current = viewportWidth;

        // Clean up inline styles (React state will handle from here)
        if (grid) grid.style.removeProperty('grid-template-columns');
        container.style.removeProperty('max-width'); // Let CSS handle it

        requestAnimationFrame(() => {
            container.style.removeProperty('transition');
            setIsReady(true);
        });
    }, [enabled, isDesktop, forceMobile]);

    // --- EFFECT: Calculate on mount and content changes ---
    useLayoutEffect(() => {
        if (!enabled) return;

        // On mobile, do nothing - just stay ready
        if (!isDesktop) {
            setIsReady(true);
            return;
        }

        // Reset ready state on content change (desktop only)
        setIsReady(false);

        // If content changed and we're in mobile mode, we MUST reset to desktop first
        // to give the new content a chance to fit.
        if (forceMobile) {
            setForceMobile(false);
            skipNextCheck.current = true; // Wait for re-render
            // The state change will trigger re-render, which triggers the hook again
            return;
        }

        // Wait 75ms for fast fade-out to complete
        const timer = setTimeout(() => {
            calculateSnugWidth();
        }, 75);

        return () => clearTimeout(timer);
    }, [calculateSnugWidth, contentKey, lang, forceMobile, isDesktop]); // Added isDesktop dependency

    // --- EFFECT: Recalculate on significant resize (debounced) ---
    useEffect(() => {
        if (!enabled || !isDesktop) return;

        let debounceTimer: NodeJS.Timeout | null = null;
        let hasFadedOut = false;

        const handleResize = () => {
            const currentWidth = window.innerWidth;
            const diff = Math.abs(currentWidth - lastViewportWidth.current);

            // Only act on significant resize (>50px)
            if (diff > 50) {
                // Fade out immediately (only once per resize session)
                if (!hasFadedOut) {
                    setIsReady(false);
                    hasFadedOut = true;
                }

                // Clear previous debounce timer
                if (debounceTimer) clearTimeout(debounceTimer);

                // Wait 150ms after resize stops to prevent stuttering during drag
                debounceTimer = setTimeout(() => {
                    calculateSnugWidth();
                    hasFadedOut = false; // Reset for next resize session
                }, 150);
            }
        };

        window.addEventListener('resize', handleResize);
        return () => {
            window.removeEventListener('resize', handleResize);
            if (debounceTimer) clearTimeout(debounceTimer);
        };
    }, [enabled, isDesktop, calculateSnugWidth]);

    // --- BUILD RETURN VALUE ---
    const containerStyle: React.CSSProperties = enabled && isDesktop && layoutWidth
        ? { maxWidth: `${layoutWidth}px` }
        : {};

    const gridStyle: React.CSSProperties = enabled && isDesktop && !forceMobile
        ? { gridTemplateColumns: `minmax(0,1fr) minmax(0,${neutralRatio}fr) minmax(0,1fr)` }
        : {};

    const containerClass = enabled
        ? (isReady ? 'transition-opacity duration-200 opacity-100' : 'transition-opacity duration-75 opacity-0')
        : '';

    return {
        containerRef,
        gridRef,
        neutralTextRef,
        containerStyle,
        gridStyle,
        containerClass,
        isReady,
        neutralRatio,
        layoutWidth,
        forceMobile,
    };
}
