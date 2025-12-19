"use client";

import { motion } from "framer-motion";
import {
    ExternalLink,
    Clock,
    CheckCircle2,
    AlertCircle,
    Newspaper,
    Building2,
    Radio,
    TrendingUp,
    TrendingDown,
    Minus
} from "lucide-react";
import { NewsArticle } from "@/types";
import { formatRelativeTime } from "@/lib/utils";

interface NewsCardProps {
    article: NewsArticle;
    index: number;
    perspective: "thailand" | "cambodia" | "neutral";
}

const categoryIcons = {
    military: "🎖️",
    political: "🏛️",
    humanitarian: "❤️",
    diplomatic: "🤝",
    economic: "📊",
};

const categoryColors = {
    military: "bg-red-500/10 text-red-600 border-red-500/20",
    political: "bg-purple-500/10 text-purple-600 border-purple-500/20",
    humanitarian: "bg-pink-500/10 text-pink-600 border-pink-500/20",
    diplomatic: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    economic: "bg-green-500/10 text-green-600 border-green-500/20",
};

const sentimentIcons = {
    positive: <TrendingUp className="w-3 h-3" />,
    negative: <TrendingDown className="w-3 h-3" />,
    neutral: <Minus className="w-3 h-3" />,
};

const sentimentColors = {
    positive: "text-green-500",
    negative: "text-red-500",
    neutral: "text-gray-500",
};

const sourceTypeIcons = {
    government: <Building2 className="w-3 h-3" />,
    media: <Newspaper className="w-3 h-3" />,
    agency: <Radio className="w-3 h-3" />,
    social: <ExternalLink className="w-3 h-3" />,
};

export default function NewsCard({ article, index, perspective }: NewsCardProps) {
    const accentColor = perspective === "cambodia"
        ? "var(--cambodia-red)"
        : perspective === "thailand"
            ? "var(--thai-gold)"
            : "var(--angkor-blue)";

    return (
        <motion.article
            className="news-card p-4 lg:p-5 shadow-sm hover:shadow-lg cursor-pointer group"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: index * 0.1 }}
            whileHover={{ y: -4 }}
        >
            {/* Top Bar with Source & Time */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    {/* Source Badge */}
                    <div className="source-badge">
                        {sourceTypeIcons[article.source.type]}
                        <span>{article.source.name}</span>
                    </div>

                    {/* Verified Badge */}
                    {article.verified && (
                        <div className="flex items-center gap-1 text-[var(--success)]">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                        </div>
                    )}
                </div>

                {/* Time */}
                <div className="flex items-center gap-1 text-xs text-[var(--angkor-blue)]/50">
                    <Clock className="w-3 h-3" />
                    <span>{formatRelativeTime(article.publishedAt)}</span>
                </div>
            </div>

            {/* Category & Sentiment */}
            <div className="flex items-center gap-2 mb-3">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border ${categoryColors[article.category]}`}>
                    <span>{categoryIcons[article.category]}</span>
                    <span className="capitalize">{article.category}</span>
                </span>

                <span className={`flex items-center gap-1 text-xs ${sentimentColors[article.sentiment]}`}>
                    {sentimentIcons[article.sentiment]}
                    <span className="capitalize">{article.sentiment}</span>
                </span>
            </div>

            {/* Title */}
            <h3
                className="text-base lg:text-lg font-semibold text-[var(--angkor-blue-deep)] mb-2 leading-tight group-hover:text-[var(--angkor-blue)] transition-colors line-clamp-2"
                style={{ fontFamily: "var(--font-cinzel)" }}
            >
                {article.title}
            </h3>

            {/* Summary */}
            <p className="text-sm text-[var(--angkor-blue)]/70 leading-relaxed line-clamp-3 mb-4">
                {article.summary}
            </p>

            {/* Footer */}
            <div className="flex items-center justify-between pt-3 border-t border-[var(--angkor-blue)]/10">
                {/* Credibility Score */}
                <div className="flex items-center gap-2">
                    <div
                        className="h-1.5 rounded-full bg-[var(--angkor-blue)]/10 w-16 overflow-hidden"
                    >
                        <motion.div
                            className="h-full rounded-full"
                            style={{ backgroundColor: accentColor }}
                            initial={{ width: 0 }}
                            animate={{ width: `${article.source.credibilityScore}%` }}
                            transition={{ duration: 0.8, delay: index * 0.1 + 0.3 }}
                        />
                    </div>
                    <span className="text-xs text-[var(--angkor-blue)]/50">
                        {article.source.credibilityScore}% credibility
                    </span>
                </div>

                {/* Read More */}
                <motion.button
                    className="flex items-center gap-1 text-xs font-medium text-[var(--angkor-blue)] hover:text-[var(--angkor-blue-deep)] transition-colors"
                    whileHover={{ x: 4 }}
                >
                    Read More
                    <ExternalLink className="w-3 h-3" />
                </motion.button>
            </div>

            {/* Accent Line (varies by perspective) */}
            <div
                className="absolute top-0 left-0 w-1 h-full rounded-l-2xl transition-all duration-300 group-hover:w-1.5"
                style={{ backgroundColor: accentColor }}
            />
        </motion.article>
    );
}
