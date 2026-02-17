"use client";

import { motion } from "framer-motion";

export default function Header() {
    return (
        <header className="fixed top-0 left-0 right-0 z-50 px-6 py-4">
            <div className="max-w-7xl mx-auto flex justify-between items-center glass-panel rounded-2xl px-6 py-3">

                {/* Logo / Title */}
                <motion.div
                    className="flex items-center gap-2"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.5 }}
                >
                    <div className="w-8 h-8 rounded bg-gradient-to-tr from-cyan-500 to-purple-600 animate-pulse"></div>
                    <h1 className="text-2xl font-bold tracking-tighter">
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-purple-500">
                            ZKP
                        </span>
                        <span className="text-white ml-2">BioLock</span>
                    </h1>
                </motion.div>

                {/* Status */}
                <div className="hidden md:flex items-center gap-2">
                    <div className="flex flex-col items-end">
                        <span className="text-[10px] text-slate-400 uppercase tracking-widest">System Status</span>
                        <span className="text-xs font-semibold text-green-400 flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-green-500 animate-ping"></span>
                            ONLINE
                        </span>
                    </div>
                </div>

            </div>
        </header>
    );
}
