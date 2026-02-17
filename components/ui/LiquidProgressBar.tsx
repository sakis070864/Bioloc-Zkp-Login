"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { clsx } from "clsx";

interface LiquidProgressBarProps {
    current: number;
    total: number;
    label?: string;
}

export default function LiquidProgressBar({ current, total, label }: LiquidProgressBarProps) {
    const percentage = Math.min(100, Math.max(0, (current / total) * 100));
    const [pulse, setPulse] = useState(false);

    useEffect(() => {
        // Trigger pulse effect on progress change
        const timeout = setTimeout(() => {
            setPulse(true);
            setTimeout(() => setPulse(false), 500);
        }, 0);
        return () => clearTimeout(timeout);
    }, [current]);

    return (
        <div className="w-full max-w-md mx-auto my-8">
            <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-cyan-400 uppercase tracking-widest text-glow">
                    {label || "Profile Strength"}
                </span>
                <span className="text-xl font-bold text-white font-mono">
                    {Math.round(percentage)}%
                </span>
            </div>

            {/* Container */}
            <div className="relative h-6 bg-slate-900/50 rounded-full overflow-hidden border border-slate-700 shadow-inner">

                {/* Liquid Fill */}
                <motion.div
                    className={clsx(
                        "absolute top-0 bottom-0 left-0 liquid-gradient rounded-full shadow-[0_0_20px_rgba(14,165,233,0.6)]",
                        pulse && "brightness-125"
                    )}
                    initial={{ width: "0%" }}
                    animate={{ width: `${percentage}%` }}
                    transition={{ type: "spring", stiffness: 60, damping: 15 }}
                >
                    {/* Bubbles/Shine Effect Overlay */}
                    <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay"></div>
                    <div className="absolute top-0 right-0 bottom-0 w-4 bg-white/30 blur-sm transform skew-x-12 translate-x-2"></div>
                </motion.div>

            </div>

            {/* Status Message */}
            <div className="mt-2 text-center text-xs text-slate-400 italic">
                {percentage < 30 && "Initializing biometric capture..."}
                {percentage >= 30 && percentage < 70 && "Analysing rhythm patterns..."}
                {percentage >= 70 && percentage < 100 && "Solidifying neural profile..."}
                {percentage === 100 && <span className="text-green-400 font-bold">System Locked & Secured.</span>}
            </div>
        </div>
    );
}
