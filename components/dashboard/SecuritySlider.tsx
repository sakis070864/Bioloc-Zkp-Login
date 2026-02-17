"use client";

import { motion } from "framer-motion";
import { Shield, Lock, Unlock } from "lucide-react";
import { useState } from "react";

interface SecuritySliderProps {
    value: number;
    onChange: (val: number) => void;
}

export default function SecuritySlider({ value, onChange }: SecuritySliderProps) {
    return (
        <div className="glass-panel p-6 rounded-2xl space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-white font-bold text-lg flex items-center gap-2">
                        <Shield className="w-5 h-5 text-cyan-400" />
                        ZKP Threshold
                    </h3>
                    <p className="text-slate-400 text-sm">
                        Adjust the confidence required to pass authentication.
                    </p>
                </div>
                <div className="text-2xl font-mono font-bold text-cyan-400">
                    {value}%
                </div>
            </div>

            <div className="relative h-12 flex items-center">
                {/* Track */}
                <div className="absolute w-full h-4 bg-slate-800 rounded-full overflow-hidden">
                    <motion.div
                        className="h-full bg-gradient-to-r from-cyan-600 to-purple-600"
                        initial={{ width: 0 }}
                        animate={{ width: `${value}%` }}
                    />
                </div>

                {/* Slider Input (Invisible but interactive) */}
                <input
                    type="range"
                    min="0"
                    max="100"
                    value={value}
                    onChange={(e) => onChange(Number(e.target.value))}
                    className="w-full absolute z-20 opacity-0 cursor-pointer h-full"
                />

                {/* Thumb (Visual only) */}
                <motion.div
                    className="absolute h-8 w-8 bg-white rounded-full shadow-lg border-4 border-slate-900 pointer-events-none z-10"
                    style={{ left: `calc(${value}% - 16px)` }}
                    layoutId="slider-thumb"
                />
            </div>

            <div className="flex justify-between text-xs font-medium uppercase tracking-wider text-slate-500">
                <span className="flex items-center gap-1"><Unlock className="w-3 h-3" /> Low Friction</span>
                <span className="flex items-center gap-1">High Security <Lock className="w-3 h-3" /></span>
            </div>

            {/* Dynamic Explanation */}
            <div className="p-4 bg-slate-900/50 rounded-xl border border-slate-800">
                <p className="text-sm text-slate-300">
                    {value < 50 ? (
                        <span className="text-yellow-400">⚠️ Relaxed Mode:</span>
                    ) : value < 85 ? (
                        <span className="text-cyan-400">✅ Balanced Mode:</span>
                    ) : (
                        <span className="text-purple-400">🔒 Fortress Mode:</span>
                    )}
                    {" "}
                    {value < 50
                        ? "Allows minor typing deviations. Good for user convenience."
                        : value < 85
                            ? "Standard biometric verification. Recommended for daily use."
                            : "Strict adherence to profile required. May cause false rejections."
                    }
                </p>
            </div>
        </div>
    );
}
