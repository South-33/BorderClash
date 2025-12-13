"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
    Activity,
    Clock,
    RefreshCw,
    Shield,
    Zap,
    Radio,
    Globe
} from "lucide-react";
import { updateStatus, formatCountdown } from "@/lib/mockData";

export default function Header() {
    const [countdown, setCountdown] = useState("5:00");
    const [isLive, setIsLive] = useState(true);

    useEffect(() => {
        const updateCountdown = () => {
            const now = new Date();
            const nextUpdate = new Date(updateStatus.nextUpdate);
            setCountdown(formatCountdown(nextUpdate));
        };

        updateCountdown();
        const interval = setInterval(updateCountdown, 1000);
        return () => clearInterval(interval);
    }, []);

    // Simulate live indicator
    useEffect(() => {
        const interval = setInterval(() => {
            setIsLive(prev => !prev);
        }, 3000);
        return () => clearInterval(interval);
    }, []);

    return (
        <header className="fixed top-0 left-0 right-0 z-50 glass-effect border-b border-[var(--angkor-blue)]/10">
            <div className="max-w-[1920px] mx-auto px-4 lg:px-8">
                <div className="flex items-center justify-between h-16 lg:h-20">
                    {/* Logo & Title */}
                    <motion.div
                        className="flex items-center gap-3"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.5 }}
                    >
                        <div className="relative">
                            <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-xl glass-blue flex items-center justify-center">
                                <Shield className="w-5 h-5 lg:w-6 lg:h-6 text-[var(--angkor-cream)]" />
                            </div>
                            {/* Live Pulse */}
                            <motion.div
                                className="absolute -top-1 -right-1 w-3 h-3 bg-[var(--success)] rounded-full"
                                animate={{ scale: [1, 1.2, 1], opacity: [1, 0.7, 1] }}
                                transition={{ duration: 2, repeat: Infinity }}
                            />
                        </div>
                        <div>
                            <h1 className="text-lg lg:text-xl font-bold tracking-tight" style={{ fontFamily: "var(--font-cinzel)" }}>
                                <span className="text-[var(--angkor-blue)]">BORDER</span>
                                <span className="text-[var(--cambodia-red)]">CLASH</span>
                            </h1>
                            <p className="text-[10px] lg:text-xs text-[var(--angkor-blue)]/60 tracking-widest uppercase">
                                Thailand • Cambodia Intelligence
                            </p>
                        </div>
                    </motion.div>

                    {/* Center Status */}
                    <motion.div
                        className="hidden md:flex items-center gap-6"
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.2 }}
                    >
                        {/* Live Status */}
                        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--success)]/10 border border-[var(--success)]/20">
                            <div className="live-dot" />
                            <span className="text-sm font-medium text-[var(--success)]">LIVE MONITORING</span>
                        </div>

                        {/* Sources Active */}
                        <div className="flex items-center gap-2 text-[var(--angkor-blue)]/70">
                            <Radio className="w-4 h-4" />
                            <span className="text-sm">
                                <span className="font-semibold text-[var(--angkor-blue)]">{updateStatus.sourcesChecked}</span> Sources Active
                            </span>
                        </div>

                        {/* Update Countdown */}
                        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--angkor-blue)]/5 border border-[var(--angkor-blue)]/10">
                            <RefreshCw className={`w-4 h-4 text-[var(--angkor-blue)] ${countdown === "Updating..." ? "animate-spin" : ""}`} />
                            <span className="text-sm font-mono text-[var(--angkor-blue)]">
                                Next Update: <span className="font-bold">{countdown}</span>
                            </span>
                        </div>
                    </motion.div>

                    {/* Right Side Actions */}
                    <motion.div
                        className="flex items-center gap-3"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.5, delay: 0.3 }}
                    >
                        {/* Mobile Live Indicator */}
                        <div className="md:hidden flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--success)]/10">
                            <div className="live-dot" />
                            <span className="text-xs font-medium text-[var(--success)]">LIVE</span>
                        </div>

                        {/* Time Display */}
                        <div className="hidden lg:flex items-center gap-2 text-[var(--angkor-blue)]/70">
                            <Clock className="w-4 h-4" />
                            <span className="text-sm font-mono">
                                {new Date().toLocaleTimeString("en-US", { hour12: false })}
                            </span>
                        </div>

                        {/* Globe Icon */}
                        <button className="p-2 rounded-lg hover:bg-[var(--angkor-blue)]/5 transition-colors">
                            <Globe className="w-5 h-5 text-[var(--angkor-blue)]" />
                        </button>
                    </motion.div>
                </div>
            </div>

            {/* Animated Bottom Border */}
            <motion.div
                className="h-0.5 bg-gradient-to-r from-[var(--cambodia-red)] via-[var(--angkor-blue)] to-[var(--thai-gold)]"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 1, delay: 0.5 }}
                style={{ transformOrigin: "left" }}
            />
        </header>
    );
}
