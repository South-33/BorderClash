"use client";

import { motion } from "framer-motion";
import {
    Users,
    Home,
    AlertTriangle,
    TrendingUp,
    Clock,
    MapPin
} from "lucide-react";
import { OverviewStats } from "@/types";


interface StatsOverviewProps {
    stats: OverviewStats;
}

export default function StatsOverview({ stats }: StatsOverviewProps) {
    const statCards = [
        {
            label: "Total Casualties",
            value: stats.combined.totalCasualties,
            subtext: `${stats.thailand.casualties.confirmed} TH + ${stats.cambodia.casualties.confirmed} KH`,
            icon: AlertTriangle,
            color: "var(--danger)",
            bgColor: "rgba(239, 68, 68, 0.1)",
        },
        {
            label: "Displaced Persons",
            value: stats.combined.totalDisplaced.toLocaleString(),
            subtext: `${stats.thailand.displacement.sheltersActive + stats.cambodia.displacement.sheltersActive} shelters active`,
            icon: Users,
            color: "var(--warning)",
            bgColor: "rgba(245, 158, 11, 0.1)",
        },
        {
            label: "Conflict Duration",
            value: stats.combined.conflictDays,
            subtext: "days",
            icon: Clock,
            color: "var(--angkor-blue)",
            bgColor: "rgba(44, 74, 124, 0.1)",
        },
        {
            label: "Structures Damaged",
            value: stats.thailand.damage.buildingsDestroyed + stats.cambodia.damage.buildingsDestroyed,
            subtext: `Est. $${((stats.thailand.damage.estimatedCostUSD + stats.cambodia.damage.estimatedCostUSD) / 1000).toFixed(0)}K`,
            icon: Home,
            color: "var(--cambodia-red)",
            bgColor: "rgba(224, 60, 49, 0.1)",
        },
    ];

    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
            {statCards.map((stat, index) => (
                <motion.div
                    key={stat.label}
                    className="relative overflow-hidden rounded-xl p-4 lg:p-5 glass-effect border border-[var(--angkor-blue)]/10"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: index * 0.1 }}
                    whileHover={{ scale: 1.02, y: -2 }}
                >
                    {/* Background Icon */}
                    <div
                        className="absolute -right-2 -bottom-2 opacity-[0.07]"
                        style={{ color: stat.color }}
                    >
                        <stat.icon className="w-20 h-20" />
                    </div>

                    {/* Content */}
                    <div className="relative z-10">
                        <div
                            className="inline-flex p-2 rounded-lg mb-3"
                            style={{ backgroundColor: stat.bgColor }}
                        >
                            <stat.icon className="w-4 h-4" style={{ color: stat.color }} />
                        </div>

                        <div className="space-y-1">
                            <motion.p
                                className="stat-number text-2xl lg:text-3xl"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ duration: 0.6, delay: index * 0.1 + 0.2 }}
                                style={{
                                    background: `linear-gradient(135deg, ${stat.color}, var(--angkor-blue-light))`,
                                    WebkitBackgroundClip: 'text',
                                    WebkitTextFillColor: 'transparent'
                                }}
                            >
                                {stat.value}
                            </motion.p>
                            <p className="text-xs lg:text-sm font-medium text-[var(--angkor-blue)]">
                                {stat.label}
                            </p>
                            <p className="text-xs text-[var(--angkor-blue)]/50">
                                {stat.subtext}
                            </p>
                        </div>
                    </div>
                </motion.div>
            ))}
        </div>
    );
}
