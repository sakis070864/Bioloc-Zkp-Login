"use client";

import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { useBiometricCapture } from "@/hooks/useBiometricCapture";
import { useMouseTracker } from "@/hooks/useMouseTracker";
import { useDeviceSensors } from "@/hooks/useDeviceSensors";
import { SessionData } from "@/lib/biometrics";
import { clsx } from "clsx";
import RhythmVisualizer from "@/components/ui/RhythmVisualizer";

interface BiometricCaptureProps {
    onComplete: (profile: { rawData: SessionData[]; phrase: string }) => void;
    mode?: "train" | "verify";
    trainingReps?: number;
    initialPhrase?: string; // New prop for passing the training phrase
}

const TARGET_PHRASE = "SecurityTest@2026";

export default function BiometricCapture({ onComplete, mode = "train", trainingReps = 10, initialPhrase }: BiometricCaptureProps) {
    const REQUIRED_REPS = mode === "train" ? trainingReps : 1;
    // Use initialPhrase if provided, otherwise default logic
    const [targetPhrase, setTargetPhrase] = useState(initialPhrase || (mode === "train" ? "" : TARGET_PHRASE));
    const [isPhraseSet, setIsPhraseSet] = useState(!!initialPhrase || mode === "verify");

    const [inputValue, setInputValue] = useState("");
    const [completedReps, setCompletedReps] = useState(0);
    const [feedback, setFeedback] = useState<"neutral" | "good" | "bad">("neutral");
    const [isTyping, setIsTyping] = useState(false);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const { getData, handleKeyDown, handleKeyUp, resetCapture } = useBiometricCapture();
    const { mouseData, resetMouse } = useMouseTracker(true);
    const { sensorData, resetSensors } = useDeviceSensors(true);
    const inputRef = useRef<HTMLInputElement>(null);

    // Focus input on mount
    useEffect(() => {
        inputRef.current?.focus();
    }, [isPhraseSet]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setInputValue(val);

        if (!isPhraseSet) return; // Don't check biometrics if just typing password

        // Typing activity detection
        setIsTyping(true);
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => setIsTyping(false), 500);

        // Check if phrase matches target
        if (val === targetPhrase) {
            handleSuccessRep();
        } else if (!targetPhrase.startsWith(val)) {
            // Simple error feedback if they type wrong character
            setFeedback("bad");
        }
    };

    const confirmPassword = () => {
        if (inputValue.length < 8) {
            alert("Password must be at least 8 characters.");
            return;
        }
        setTargetPhrase(inputValue);
        setIsPhraseSet(true);
        setInputValue(""); // Clear for training
    };

    const [history, setHistory] = useState<SessionData[]>([]); // Array of sessions

    const startTimeRef = useRef(0);

    // Set initial start time on mount or when phrase is set
    useEffect(() => {
        if (isPhraseSet && startTimeRef.current === 0) {
            startTimeRef.current = performance.now();
        }
    }, [isPhraseSet]);

    const handleSuccessRep = () => {
        // Validation Placeholder
        setFeedback("good");

        // Capture the current session data
        const currentSession: SessionData = {
            keys: [...getData()],
            mouse: [...mouseData],
            sensors: [...sensorData],
            startTime: startTimeRef.current, // Added: Reference start time for this rep
            timestamp: Date.now()
        };
        setHistory(prev => [...prev, currentSession]);

        setCompletedReps((prev) => prev + 1);

        // Reset for next rep
        setTimeout(() => {
            setInputValue("");
            setFeedback("neutral");
            resetCapture(); // Vital: Clear buffer for next rep
            resetMouse();
            resetSensors();
            startTimeRef.current = performance.now(); // Reset start time for next rep
        }, 500);

        if (completedReps + 1 >= REQUIRED_REPS) {
            // Include the final session we just captured
            const finalHistory = [...history, currentSession];
            onComplete({ rawData: finalHistory, phrase: targetPhrase });
        }
    };

    const progressPercentage = (completedReps / REQUIRED_REPS) * 100;

    // --- PHASE 1: CREATE PASSWORD ---
    if (!isPhraseSet && mode === "train") {
        return (
            <div className="w-full max-w-xl mx-auto p-6 flex flex-col items-center gap-6 glass-panel rounded-2xl">
                <div className="text-center">
                    <h3 className="text-2xl font-bold text-white mb-2">Create Your Key</h3>
                    <p className="text-slate-400 text-sm">
                        This phrase will be your biometric signature. <br />
                        Choose something you can type rhythmically.
                    </p>
                </div>

                <div className="w-full">
                    <label className="text-xs font-bold text-cyan-500 uppercase tracking-widest mb-2 block">Set Password / Phrase</label>
                    <input
                        ref={inputRef}
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:border-cyan-500 outline-none transition-colors"
                        placeholder="e.g. MySecretPhrase123"
                        onKeyDown={(e) => e.key === 'Enter' && confirmPassword()}
                    />
                </div>

                <button
                    onClick={confirmPassword}
                    className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-cyan-900/20"
                >
                    Confirm & Start Training
                </button>
            </div>
        )
    }

    // --- PHASE 2: TRAINING / VERIFY ---
    return (
        <div className="w-full max-w-3xl mx-auto p-6 flex flex-col items-center gap-8">

            {/* Header / Instructions */}
            <div className="text-center space-y-2">
                <h3 className="text-2xl text-white font-bold tracking-wider">
                    {mode === "train" ? "SYSTEM CALIBRATION" : "IDENTITY VERIFICATION"}
                </h3>
                <p className="text-slate-400">
                    {mode === "train"
                        ? "Type the phrase below. Maintain a consistent rhythm."
                        : "Type the phrase once to verify your identity."}
                </p>
            </div>

            {/* Target Phrase Display */}
            <div className="text-4xl md:text-5xl font-mono font-bold text-cyan-400 tracking-widest text-glow select-none pointer-events-none">
                {targetPhrase}
            </div>

            {/* Input Field Input Field Input Field */}
            <div className="relative w-full max-w-lg">
                <input
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onChange={handleChange}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    onKeyDown={handleKeyDown as any}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    onKeyUp={handleKeyUp as any}
                    className={clsx(
                        "w-full bg-slate-900/50 border-2 rounded-xl px-6 py-4 text-center text-xl text-white font-mono tracking-widest focus:outline-none transition-all duration-300",
                        feedback === "neutral" && "border-slate-700 focus:border-cyan-500",
                        feedback === "good" && "border-green-500 shadow-[0_0_15px_rgba(34,197,94,0.3)]",
                        feedback === "bad" && "border-red-500 animate-shake"
                    )}
                    placeholder="Start typing..."
                    autoComplete="off"
                    spellCheck="false"
                />

                {/* Helper/Error Text */}
                <div className="absolute -bottom-8 left-0 right-0 text-center h-6">
                    {feedback === "bad" && (
                        <span className="text-red-400 text-sm font-medium animate-pulse">
                            Typing error. Retry.
                        </span>
                    )}
                    {feedback === "good" && (
                        <span className="text-green-400 text-sm font-medium">
                            Excellent rhythm.
                        </span>
                    )}
                </div>
            </div>

            {/* Confidence / Progress Bar */}
            <div className="w-full max-w-md space-y-2">
                <div className="flex justify-between text-xs text-slate-500 uppercase tracking-widest">
                    <span>Profile Stability</span>
                    <span>{Math.round(progressPercentage)}%</span>
                </div>
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                    <motion.div
                        className="h-full bg-gradient-to-r from-cyan-500 to-blue-600"
                        initial={{ width: 0 }}
                        animate={{ width: `${progressPercentage}%` }}
                        transition={{ type: "spring", stiffness: 50 }}
                    />
                </div>
            </div>

            {/* Visualizer Placeholder */}
            <div className="w-full h-32 bg-slate-900/30 border border-slate-800 rounded-lg flex items-center justify-center relative overflow-hidden">
                <div className="absolute inset-0 opacity-50">
                    <RhythmVisualizer isTyping={isTyping} typingSpeed={[]} />
                </div>
                <div className="absolute inset-0 bg-grid-slate-800/[0.1] bg-[length:20px_20px] pointer-events-none"></div>
            </div>

        </div>
    );
}
