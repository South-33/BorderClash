"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";
import NewsCard from "./NewsCard";
import { NewsArticle } from "@/types";

interface NewsSectionProps {
    title: string;
    subtitle: string;
    icon: ReactNode;
    articles: NewsArticle[];
    perspective: "thailand" | "cambodia" | "neutral";
    accentColor: string;
    children?: ReactNode;
}

export default function NewsSection({
    title,
    subtitle,
    icon,
    articles,
    perspective,
    accentColor,
    children
}: NewsSectionProps) {
    const sectionClass = perspective === "cambodia"
        ? "cambodia-section"
        : perspective === "thailand"
            ? "thai-section"
            : "neutral-section";

    return (
        <section className={`${sectionClass} h-full flex flex-col`}>
            {/* Section Header */}
            <motion.div
                className="sticky top-20 z-10 glass-effect border-b border-[var(--angkor-blue)]/10 px-4 lg:px-6 py-4"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
            >
                <div className="flex items-center gap-3 mb-2">
                    <div
                        className="p-2 rounded-xl"
                        style={{ backgroundColor: `${accentColor}20` }}
                    >
                        {icon}
                    </div>
                    <div>
                        <h2
                            className="text-lg lg:text-xl font-bold"
                            style={{
                                fontFamily: "var(--font-cinzel)",
                                color: accentColor
                            }}
                        >
                            {title}
                        </h2>
                        <p className="text-xs text-[var(--angkor-blue)]/60">
                            {subtitle}
                        </p>
                    </div>
                </div>

                {/* Article Count Badge */}
                <div className="flex items-center gap-2">
                    <span
                        className="px-2 py-0.5 rounded-full text-xs font-medium"
                        style={{
                            backgroundColor: `${accentColor}15`,
                            color: accentColor
                        }}
                    >
                        {articles.length} articles
                    </span>
                    <span className="text-xs text-[var(--angkor-blue)]/40">
                        Updated live
                    </span>
                </div>
            </motion.div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto px-4 lg:px-6 py-4 space-y-4">
                {children ? (
                    children
                ) : (
                    articles.map((article, index) => (
                        <NewsCard
                            key={article.id}
                            article={article}
                            index={index}
                            perspective={perspective}
                        />
                    ))
                )}
            </div>

            {/* Bottom Gradient Fade */}
            <div
                className="h-8 pointer-events-none"
                style={{
                    background: `linear-gradient(to top, var(--angkor-cream), transparent)`
                }}
            />
        </section>
    );
}
