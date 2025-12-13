"use client";

import { motion } from "framer-motion";
import {
    Brain,
    Scale,
    AlertTriangle,
    CheckCircle2,
    TrendingUp,
    Clock,
    FileText,
    Lightbulb,
    ChevronRight,
    Sparkles
} from "lucide-react";
import { AIAnalysis } from "@/types";
import { formatRelativeTime } from "@/lib/mockData";

interface NeutralAnalysisPanelProps {
    analysis: AIAnalysis;
}

export default function NeutralAnalysisPanel({ analysis }: NeutralAnalysisPanelProps) {
    return (
        <div className="space-y-6">
            {/* AI Header Card */}
            <motion.div
                className="relative overflow-hidden rounded-2xl p-6 glass-blue text-[var(--angkor-cream)]"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
            >
                {/* Background Pattern */}
                <div className="absolute inset-0 opacity-10">
                    <div className="absolute inset-0" style={{
                        backgroundImage: `radial-gradient(circle at 2px 2px, currentColor 1px, transparent 0)`,
                        backgroundSize: '24px 24px'
                    }} />
                </div>

                <div className="relative z-10">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-xl bg-white/10 backdrop-blur-sm">
                                <Brain className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold" style={{ fontFamily: "var(--font-cinzel)" }}>
                                    AI SYNTHESIS
                                </h3>
                                <p className="text-xs opacity-70">Neutral Analysis Engine</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10">
                            <Sparkles className="w-4 h-4 text-yellow-300" />
                            <span className="text-sm font-medium">{analysis.confidence}% Confidence</span>
                        </div>
                    </div>

                    <p className="text-sm leading-relaxed opacity-90 mb-4">
                        {analysis.summary}
                    </p>

                    <div className="flex items-center gap-4 text-xs opacity-70">
                        <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>Generated {formatRelativeTime(analysis.generatedAt)}</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <FileText className="w-3 h-3" />
                            <span>{analysis.sourcesAnalyzed} sources analyzed</span>
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* Credibility Comparison */}
            <motion.div
                className="news-card p-5"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 }}
            >
                <div className="flex items-center gap-2 mb-4">
                    <Scale className="w-5 h-5 text-[var(--angkor-blue)]" />
                    <h4 className="font-semibold text-[var(--angkor-blue-deep)]" style={{ fontFamily: "var(--font-cinzel)" }}>
                        Credibility Assessment
                    </h4>
                </div>

                <div className="space-y-4">
                    {/* Thai Credibility */}
                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <span className="text-sm font-medium text-[var(--angkor-blue)]">Thailand Sources</span>
                            <span className="text-sm font-bold text-[var(--thai-gold)]">{analysis.credibilityAssessment.thai}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-[var(--angkor-blue)]/10 overflow-hidden">
                            <motion.div
                                className="h-full rounded-full bg-gradient-to-r from-[var(--thai-red)] to-[var(--thai-gold)]"
                                initial={{ width: 0 }}
                                animate={{ width: `${analysis.credibilityAssessment.thai}%` }}
                                transition={{ duration: 1, delay: 0.3 }}
                            />
                        </div>
                    </div>

                    {/* Cambodia Credibility */}
                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <span className="text-sm font-medium text-[var(--angkor-blue)]">Cambodia Sources</span>
                            <span className="text-sm font-bold text-[var(--cambodia-red)]">{analysis.credibilityAssessment.cambodia}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-[var(--angkor-blue)]/10 overflow-hidden">
                            <motion.div
                                className="h-full rounded-full bg-gradient-to-r from-[var(--cambodia-red)] to-[#ff6b5b]"
                                initial={{ width: 0 }}
                                animate={{ width: `${analysis.credibilityAssessment.cambodia}%` }}
                                transition={{ duration: 1, delay: 0.4 }}
                            />
                        </div>
                    </div>
                </div>

                <p className="mt-4 text-sm text-[var(--angkor-blue)]/70 italic border-l-2 border-[var(--angkor-blue)]/20 pl-3">
                    {analysis.credibilityAssessment.notes}
                </p>
            </motion.div>

            {/* Key Findings */}
            <motion.div
                className="news-card p-5"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.2 }}
            >
                <div className="flex items-center gap-2 mb-4">
                    <TrendingUp className="w-5 h-5 text-[var(--angkor-blue)]" />
                    <h4 className="font-semibold text-[var(--angkor-blue-deep)]" style={{ fontFamily: "var(--font-cinzel)" }}>
                        Key Findings
                    </h4>
                </div>

                <ul className="space-y-3">
                    {analysis.keyFindings.map((finding, index) => (
                        <motion.li
                            key={index}
                            className="flex items-start gap-3"
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.3, delay: 0.3 + index * 0.1 }}
                        >
                            <div className="mt-1 p-1 rounded-full bg-[var(--angkor-blue)]/10">
                                <CheckCircle2 className="w-3 h-3 text-[var(--angkor-blue)]" />
                            </div>
                            <span className="text-sm text-[var(--angkor-blue)]/80 leading-relaxed">{finding}</span>
                        </motion.li>
                    ))}
                </ul>
            </motion.div>

            {/* Recommendations */}
            <motion.div
                className="news-card p-5"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.3 }}
            >
                <div className="flex items-center gap-2 mb-4">
                    <Lightbulb className="w-5 h-5 text-[var(--thai-gold)]" />
                    <h4 className="font-semibold text-[var(--angkor-blue-deep)]" style={{ fontFamily: "var(--font-cinzel)" }}>
                        Recommendations
                    </h4>
                </div>

                <ul className="space-y-2">
                    {analysis.recommendations.map((rec, index) => (
                        <motion.li
                            key={index}
                            className="flex items-center gap-2 p-3 rounded-lg bg-[var(--angkor-cream-dark)]/50 hover:bg-[var(--angkor-cream-dark)] transition-colors cursor-pointer group"
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.3, delay: 0.4 + index * 0.1 }}
                            whileHover={{ x: 4 }}
                        >
                            <ChevronRight className="w-4 h-4 text-[var(--angkor-blue)] group-hover:text-[var(--thai-gold)] transition-colors" />
                            <span className="text-sm text-[var(--angkor-blue)]/80">{rec}</span>
                        </motion.li>
                    ))}
                </ul>
            </motion.div>
        </div>
    );
}
