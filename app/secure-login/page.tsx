"use client";

export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { doc, getDoc, onSnapshot, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { Lock, ShieldCheck, ShieldAlert, Activity, Eye, Play, ChevronRight, EyeOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from "clsx";

// IMPORTING FROZEN BIOMETRIC ENGINE (READ-ONLY)
import { compareBiometrics, BiometricFactors, SessionData } from '@/lib/biometrics';
import { generateSalt, sha256 } from '@/lib/hash';
import { zkp } from '@/lib/zkp';


// Local definition because KeyEvent is not exported from the frozen file
interface KeyEvent {
    code: string;
    time: number;
    type: "keydown" | "keyup";
}

type GuardState = 'LOADING' | 'IDLE' | 'ANALYZING' | 'SUCCESS' | 'FAIL' | 'LOCKED';

const SecureLoginPage = () => {
    const searchParams = useSearchParams();
    const router = useRouter();
    const companyId = searchParams.get('companyId');
    // We do NOT use userId from URL anymore for the initial check, user must enter it.
    // unless we want to pre-fill it? Plan says "Single form (Name, User ID, Password)".
    // So we ignore URL userId for the Gatekeeper.

    const [isAuthenticated, setIsAuthenticated] = useState(false); // The Gate State

    // Gatekeeper Form State
    const [gateName, setGateName] = useState("");
    const [gateId, setGateId] = useState("");
    const [gatePassword, setGatePassword] = useState("");
    const [gateError, setGateError] = useState("");
    const [gateLoading, setGateLoading] = useState(false);
    const [showGatePassword, setShowGatePassword] = useState(false);

    // Biometric Shield State
    const [state, setState] = useState<GuardState>('IDLE'); // Start Idle for Biometrics (once auth)
    const [profileData, setProfileData] = useState<any>(null);
    const [phrase, setPhrase] = useState(""); // The simplified phrase (likely same as password)
    const [retries, setRetries] = useState(0);
    const [countdown, setCountdown] = useState(5);
    const [errorMsg, setErrorMsg] = useState("");
    const [securityThreshold, setSecurityThreshold] = useState(80);
    const [isSessionActive, setIsSessionActive] = useState(false);

    // Silent Capture Refs
    const keysBuffer = useRef<KeyEvent[]>([]);
    const startTimeRef = useRef<number>(0);
    const inputRef = useRef<HTMLInputElement>(null);

    // 1. Safety Check: Company Existence
    // 1. Safety Check: Company Existence
    const [isRevoked, setIsRevoked] = useState(false);

    useEffect(() => {
        if (!companyId) return;
        const unsubscribe = onSnapshot(doc(db, 'companies', companyId), (snap) => {
            if (!snap.exists() || snap.data().isActive === false) {
                console.warn("🚨 LINK REVOKED");
                setGateError("ACCESS REVOKED: THIS LINK IS INVALID.");
                setIsRevoked(true);
            } else {
                setIsRevoked(false);
                setGateError(""); // Clear error if reactivated
                if (snap.data().securityThreshold) {
                    setSecurityThreshold(snap.data().securityThreshold);
                }
            }
        });
        return () => unsubscribe();
    }, [companyId]);


    // State for Stage 2 Enforcement
    const [intentToken, setIntentToken] = useState("");

    // GATEKEEPER LOGIC
    const handleGateVerification = async (e: React.FormEvent) => {
        e.preventDefault();

        // STRICT SECURITY BLOCK
        if (isRevoked) {
            setGateError("ACCESS PERMANENTLY REVOKED.");
            return;
        }

        setGateError("");
        if (!gateName || !gateId || !gatePassword || !companyId) {
            setGateError("Please fill all fields.");
            return;
        }

        setGateLoading(true);

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    companyId,
                    userId: gateId,
                    password: gatePassword,
                    name: gateName
                })
            });

            const data = await res.json();

            if (!res.ok) {
                setGateError(data.error || "Verification Failed");
                return;
            }

            // SUCCESS (Stage 1)
            setIntentToken(data.intentToken);

            // 1. Store companyId in sessionStorage for the Dashboard to use as context
            if (typeof window !== "undefined") {
                sessionStorage.setItem("zkp_company_id", companyId);
            }

            // 2. Log Attempt (Client side log for visual consistency, or rely on server?)
            // The server doesn't log the "login_logs" in Firestore in my simplified route.
            // The original code did: await addDoc(collection(db, 'companies', companyId, 'login_logs')...
            // I should probably keep this logging here for feature parity if the server doesn't do it.
            // But for now, let's keep it minimal or restore it.
            // The original code logged "SUCCESS".
            // Let's restore the logging call for maintaining the "Audit Log" feature visible in Dashboard.
            await addDoc(collection(db, 'companies', companyId, 'login_logs'), {
                timestamp: serverTimestamp(),
                userId: gateId,
                nameAttempt: gateName,
                status: "SUCCESS",
                failReason: "",
                method: "GATEKEEPER"
            });

            setIsAuthenticated(true);

            // If we want to auto-redirect to dashboard after "Biometric Shield" or immediately?
            // The user originally had internal state switch. I will keep internal state switch to show Biometrics.
            // but the User *can* now navigate to /dashboard.

            // Note: The original code fetched 'profileData'.
            // I need to fetch profileData here to support the Biometric step!
            // My API login didn't return the full profile data.
            // So I need to fetch it here again? Or have the API return it?
            // "Login API" returned { user: sessionPayload }.
            // I should probably fetch the user doc here to get 'mobileProfile', etc.

            const userRef = doc(db, 'companies', companyId, 'users', gateId);
            const userSnap = await getDoc(userRef);
            if (userSnap.exists()) {
                setProfileData(userSnap.data());
            }

        } catch (err) {
            console.error("Gate Error:", err);
            setGateError("Connection Error. Try again.");
        } finally {
            setGateLoading(false);
        }
    };


    // --- BIOMETRIC & VISUALIZER LOGIC (Existing) ---
    const spikeRef = useRef(0);
    const triggerVisualSpike = (intensity: number) => {
        spikeRef.current = Math.min(spikeRef.current + intensity, 1.5);
    };

    useEffect(() => {
        const handleMouseMove = () => triggerVisualSpike(0.1);
        if (isAuthenticated) window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, [isAuthenticated]);

    const canvasRef = useRef<HTMLCanvasElement>(null);
    useEffect(() => {
        if (!isAuthenticated) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animationId: number;
        let t = 0;

        const draw = () => {
            if (!canvas || !ctx) return;
            const width = canvas.width;
            const height = canvas.height;

            ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
            ctx.fillRect(0, 0, width, height);
            ctx.lineWidth = 2;

            if (state === 'FAIL' || state === 'LOCKED') ctx.strokeStyle = '#ef4444';
            else if (state === 'SUCCESS') ctx.strokeStyle = '#22c55e';
            else {
                ctx.strokeStyle = `rgb(${50 + spikeRef.current * 100}, ${150 + spikeRef.current * 50}, ${255})`;
            }

            ctx.beginPath();
            for (let x = 0; x < width; x += 2) {
                let y = (height / 2) + Math.sin(x * 0.02 + t) * (height * 0.2);
                if (spikeRef.current > 0.05) {
                    const noise = (Math.random() - 0.5) * (height * 0.8) * spikeRef.current;
                    y += noise;
                }
                if (x === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.stroke();
            t += 0.1;
            spikeRef.current *= 0.95;
            animationId = requestAnimationFrame(draw);
        };
        draw();
        return () => cancelAnimationFrame(animationId);
    }, [isAuthenticated, state]);


    // Biometric Handlers
    const handleStartSession = async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (typeof (DeviceMotionEvent as any).requestPermission === 'function') {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            try { await (DeviceMotionEvent as any).requestPermission(); } catch { }
        }
        setIsSessionActive(true);
        setTimeout(() => inputRef.current?.focus(), 100);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        triggerVisualSpike(0.8);
        if (state !== 'IDLE' && state !== 'FAIL') return;
        const now = performance.now();
        if (keysBuffer.current.length === 0) startTimeRef.current = now;
        keysBuffer.current.push({ code: e.code, time: now, type: 'keydown' });
        if (e.key === 'Enter') handleAnalyze();
    };

    const handleKeyUp = (e: React.KeyboardEvent) => {
        if (state !== 'IDLE' && state !== 'FAIL') return;
        keysBuffer.current.push({ code: e.code, time: performance.now(), type: 'keyup' });
    };

    const handleAnalyze = async () => {
        // STRICT PASSWORD ENFORCEMENT
        if (phrase !== gatePassword) {
            setState('FAIL');
            setErrorMsg("CRITICAL: INCORRECT PASSPHRASE");
            return;
        }

        // We don't need profileData for server-side verify, but we might want it for local visual cues?
        // Actually, let's trust the server entirely.

        setState('ANALYZING');

        // Prepare Session Data
        const session: SessionData = {
            keys: keysBuffer.current,
            startTime: startTimeRef.current,
            timestamp: Date.now()
        };

        try {
            // 1. Fetch Security Challenge (Nonce)
            const challengeRes = await fetch('/api/auth/challenge', { method: 'POST' });
            if (!challengeRes.ok) {
                const errorData = await challengeRes.json().catch(() => ({}));
                throw new Error(errorData.error || errorData.details || "Connection failed: Could not get security challenge.");
            }
            const { nonce } = await challengeRes.json();

            // 2. Generate ZKP Proof using Password (Phrase)
            const proof = await zkp.generateProof(phrase, nonce);

            // --- SERVER-SIDE VERIFICATION ---
            // We send the 'intentToken' (from Stage 1) and the raw biometric data.
            // The server fetches the profile, compares, checks threshold, and issues cookie.

            const verifyRes = await fetch('/api/auth/verify-biometrics', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    temp_token: intentToken, // From Stage 1
                    biometricData: session,
                    zkpProof: proof,
                    nonce: nonce // Send authoritative server nonce
                })
            });

            const verifyData = await verifyRes.json();

            if (!verifyRes.ok) {
                // FAILED
                const score = verifyData.details?.score || 0;
                const threshold = verifyData.details?.threshold || 0;

                // Log failure locally for UI
                addDoc(collection(db, 'companies', companyId!, 'login_logs'), {
                    timestamp: serverTimestamp(),
                    userId: gateId,
                    score: score,
                    status: "BIOMETRIC_FAIL",
                    method: "BIOMETRIC_SERVER",
                    details: verifyData.error
                });

                throw new Error(`Biometric Mismatch (${score}% < ${threshold}%).`);
            }

            // SUCCESS
            // Log success
            addDoc(collection(db, 'companies', companyId!, 'login_logs'), {
                timestamp: serverTimestamp(),
                userId: gateId,
                status: "BIOMETRIC_SUCCESS",
                method: "BIOMETRIC_SERVER"
            });

            setState('SUCCESS');
            setTimeout(() => {
                router.push('/dashboard');
            }, 1500);

        } catch (err: any) {
            console.error("Biometric Verification Error:", err);

            if (retries >= 1) {
                handleLockdown();
            } else {
                setRetries(prev => prev + 1);
                setState('FAIL');
                setErrorMsg(`${err.message || "Verification Failed"} 1 ATTEMPT REMAINING.`);
                setPhrase("");
                keysBuffer.current = [];
                inputRef.current?.focus();
            }
        }
    };

    const handleLockdown = () => {
        setState('LOCKED');
        let count = 5;
        setCountdown(count);
        const timer = setInterval(() => {
            count--;
            setCountdown(count);
            if (count <= 0) {
                clearInterval(timer);
                if (window.opener) window.close();
                else router.push('/access-denied');
            }
        }, 1000);
    };


    return (
        <div className="min-h-screen bg-[#050510] text-blue-200 flex flex-col items-center justify-center p-4 font-mono relative overflow-hidden">
            {/* Background Mesh */}
            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle, #2563eb 1px, transparent 1px)', backgroundSize: '30px 30px' }}></div>

            {/* Credits */}
            <div className="absolute top-10 text-xs text-slate-500 font-mono tracking-widest text-center z-20">
                This App is Developed and Engineered by Athanasios Athanasopoulos contact with me in <a href="https://www.linkedin.com/in/sakis-athan" target="_blank" rel="noopener noreferrer" className="text-cyan-500 hover:text-cyan-400 underline underline-offset-4 decoration-cyan-500/30 hover:decoration-cyan-500 transition-all cursor-pointer">Linkedin</a>
            </div>

            <AnimatePresence mode="wait">
                {!isAuthenticated ? (
                    // --- GATEKEEPER UI ---
                    <motion.div
                        key="gatekeeper"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 1.05 }}
                        className="max-w-md w-full bg-[#0f172a]/90 backdrop-blur-md border border-blue-900/50 rounded-2xl shadow-2xl p-8 relative z-30"
                    >
                        <div className="text-center mb-8">
                            <div className="w-16 h-16 bg-slate-900 rounded-full mx-auto flex items-center justify-center mb-4 border border-slate-700 shadow-[0_0_15px_rgba(37,99,235,0.2)]">
                                <Lock className="w-8 h-8 text-blue-500" />
                            </div>
                            <h2 className="text-xl font-bold text-white tracking-wider">SECURITY GATEWAY</h2>
                            <p className="text-slate-500 text-xs mt-2 tracking-widest">IDENTITY VERIFICATION REQUIRED</p>
                        </div>

                        <form onSubmit={handleGateVerification} className="space-y-4" autoComplete="off">
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Full Name</label>
                                <input
                                    type="text"
                                    value={gateName}
                                    onChange={(e) => setGateName(e.target.value)}
                                    placeholder="e.g. John Doe"
                                    autoComplete="off"
                                    data-form-type="other"
                                    className="w-full bg-slate-950/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-all"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Identity Code</label>
                                <input
                                    type="text"
                                    value={gateId}
                                    onChange={(e) => setGateId(e.target.value)}
                                    placeholder="e.g. ID-001"
                                    disabled={isRevoked}
                                    autoComplete="off"
                                    data-form-type="other"
                                    className="w-full bg-slate-950/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Access Password</label>
                                <div className="relative">
                                    <input
                                        type={showGatePassword ? "text" : "password"}
                                        value={gatePassword}
                                        onChange={(e) => setGatePassword(e.target.value)}
                                        placeholder="••••••••"
                                        autoComplete="new-password"
                                        data-form-type="other"
                                        className="w-full bg-slate-950/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-all font-mono tracking-widest"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowGatePassword(!showGatePassword)}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                                    >
                                        {showGatePassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                            </div>

                            {gateError && (
                                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-xs text-center font-bold animate-pulse">
                                    {gateError}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={gateLoading || isRevoked}
                                className={clsx(
                                    "w-full font-bold py-4 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 mt-2",
                                    isRevoked
                                        ? "bg-red-900/20 text-red-500 border border-red-900/50 cursor-not-allowed"
                                        : "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/20"
                                )}
                            >
                                {gateLoading ? (
                                    <span className="animate-pulse">VERIFYING...</span>
                                ) : (
                                    <>
                                        VERIFICATION <ChevronRight className="w-4 h-4" />
                                    </>
                                )}
                            </button>

                        </form>
                    </motion.div>
                ) : (
                    // --- BIOMETRIC SHIELD UI ---
                    <motion.div
                        key="shield"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className={`max-w-xl w-full bg-[#0f172a]/80 backdrop-blur-md border px-8 py-12 rounded-xl shadow-2xl relative z-10
                                   ${state === 'FAIL' ? 'border-red-500 shadow-red-500/20' :
                                state === 'SUCCESS' ? 'border-green-500 shadow-green-500/20' :
                                    state === 'LOCKED' ? 'border-red-900 bg-red-950/90' : 'border-blue-900/50'}`}
                    >
                        <div className="flex justify-center mb-8">
                            <div className={`p-4 rounded-full border-2
                                ${state === 'LOCKED' ? 'bg-red-900 border-red-500 animate-pulse' :
                                    state === 'SUCCESS' ? 'bg-green-900/20 border-green-500' : 'bg-blue-900/20 border-blue-500'}`}>
                                {state === 'LOCKED' ? <ShieldAlert size={48} className="text-red-500" /> :
                                    state === 'SUCCESS' ? <ShieldCheck size={48} className="text-green-500" /> :
                                        <Lock size={48} className="text-blue-500" />}
                            </div>
                        </div>

                        <h1 className="text-2xl font-bold text-center mb-2 tracking-wider">
                            {state === 'LOCKED' ? 'SYSTEM LOCKDOWN' :
                                state === 'SUCCESS' ? 'IDENTITY VERIFIED' :
                                    'SECURE GATEWAY'}
                        </h1>
                        <p className={`text-center text-xs mb-8 uppercase tracking-widest ${state === 'FAIL' ? 'text-red-400' : 'text-slate-400'}`}>
                            {state === 'LOADING' ? 'FETCHING ENCRYPTED PROFILE...' :
                                state === 'ANALYZING' ? 'ANALYZING BIOMETRIC SIGNATURE...' :
                                    state === 'LOCKED' ? 'TERMINATING SESSION...' :
                                        state === 'SUCCESS' ? 'ACCESS GRANTED' :
                                            !isSessionActive ? 'USER INTERACTION REQUIRED' :
                                                'BIOMETRIC AUTHENTICATION REQUIRED'}
                        </p>

                        <div className="h-24 bg-black/50 rounded-lg border border-slate-800 mb-6 relative overflow-hidden flex items-center justify-center">
                            {state === 'LOCKED' ? (
                                <h2 className="text-5xl font-bold text-red-600 animate-ping">{countdown}</h2>
                            ) : (
                                <canvas ref={canvasRef} className="w-full h-full opacity-80" width={500} height={100} />
                            )}
                            <AnimatePresence>
                                {state === 'ANALYZING' && (
                                    <motion.div
                                        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                        className="absolute inset-0 flex items-center justify-center bg-blue-900/10 backdrop-blur-sm"
                                    >
                                        <Activity size={32} className="text-blue-400 animate-spin" />
                                    </motion.div>
                                )}
                                {state === 'FAIL' && errorMsg && (
                                    <motion.div
                                        initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
                                        className="absolute bottom-2 left-0 right-0 text-center text-[10px] text-red-500 font-bold"
                                    >
                                        {errorMsg}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {!isSessionActive ? (
                            <button
                                onClick={handleStartSession}
                                disabled={state !== 'IDLE'}
                                className={`w-full py-4 rounded-lg font-bold tracking-widest transition-all duration-300 flex items-center justify-center gap-2
                                    ${state === 'IDLE'
                                        ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20'
                                        : 'bg-slate-800 text-slate-500 cursor-not-allowed'}`}
                            >
                                {state === 'LOADING' ? (
                                    <span>INITIALIZING SYSTEM...</span>
                                ) : (
                                    <>
                                        <Play size={16} /> ACTIVATE BIOMETRIC GUARD
                                    </>
                                )}
                            </button>
                        ) : (
                            (state === 'IDLE' || state === 'FAIL') && (
                                <div className="relative mb-6">
                                    <input
                                        ref={inputRef}
                                        type="text"
                                        value={phrase}
                                        onChange={(e) => setPhrase(e.target.value)}
                                        onKeyDown={handleKeyDown}
                                        onKeyUp={handleKeyUp}
                                        className="w-full bg-[#1e293b] border border-slate-700 text-center text-xl text-white py-4 rounded-lg focus:outline-none focus:border-blue-500 transition-colors tracking-widest"
                                        placeholder="TYPE PASSPHRASE"
                                        autoComplete="off"
                                    />
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600">
                                        <Eye size={20} />
                                    </div>
                                </div>
                            )
                        )}

                        <div className="flex justify-between items-center text-[10px] text-slate-500 uppercase mt-8">
                            <span>SECURE CONNECTION: <span className="text-green-500">TLS 1.3</span></span>
                            <span>ATTEMPTS: <span className={state === 'FAIL' ? 'text-red-500' : 'text-white'}>{retries}/2</span></span>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

export default function SuspenseWrapper() {
    return (
        <React.Suspense fallback={<div className="min-h-screen bg-black flex items-center justify-center text-blue-500">INITIALIZING SECURITY PROTOCOLS...</div>}>
            <SecureLoginPage />
        </React.Suspense>
    );
}
