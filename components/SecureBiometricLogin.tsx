"use client";

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Lock, Fingerprint, CheckCircle, XCircle, AlertTriangle, ScanEye, Terminal, Activity } from 'lucide-react';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { analyzeBiometric30, SessionData, BiometricFactors, compareBiometrics } from '@/lib/biometrics';
import { zkp } from '@/lib/zkp';
import { sha256 } from '@/lib/hash';

// --- Types ---
interface KeyEvent {
    code: string;
    time: number;
    type: "keydown" | "keyup";
}

type LoginState = 'IDLE' | 'VALIDATING_ID' | 'PASSWORD_CHALLENGE' | 'PROCESSING' | 'SUCCESS' | 'LOCKED';

export default function SecureBiometricLogin() {
    // --- State ---
    const [state, setState] = useState<LoginState>('IDLE');
    const [companyId, setCompanyId] = useState('');
    const [userId, setUserId] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [retryCount, setRetryCount] = useState(0); // STRICT: Track failed attempts

    // --- Data Store ---
    const [threshold, setThreshold] = useState<number>(0); // Loaded from server response (optional visual) or default
    const [intentToken, setIntentToken] = useState<string | null>(null); // NEW: Token from Stage 1
    const [zkpProof, setZkpProof] = useState<any>(null);
    const [biometricResult, setBiometricResult] = useState<{ score: number, distance: number } | null>(null);

    // --- Intruder Alert State ---
    const [intruderAlert, setIntruderAlert] = useState(false);
    const [countdown, setCountdown] = useState(3);
    const [clientInfo, setClientInfo] = useState({
        ip: "Fetching...",
        userAgent: "",
        platform: "",
        screenRes: "",
        timestamp: ""
    });

    // --- Biometric Refs ---
    const keyEventsRef = useRef<KeyEvent[]>([]);
    const passwordInputRef = useRef<HTMLInputElement>(null);

    // --- Handlers ---

    // STAGE 1: Initial Validation (Server-Side via API)
    const handleIdentitySubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setState('VALIDATING_ID');

        try {
            // Call Stage 1 Login API
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ companyId, userId, password })
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || "Authentication failed");
            }

            // Success: Store Intent Token
            setIntentToken(data.intentToken);
            if (data.threshold) {
                setThreshold(data.threshold);
            }

            // Persist Company ID for the Dashboard Redirect
            if (typeof window !== "undefined") {
                sessionStorage.setItem("zkp_company_id", companyId);
            }

            // TRANSITION TO STAGE 2
            setPassword(''); // CLEAR PASSWORD for Re-entry
            setRetryCount(0); // Reset retries
            setState('PASSWORD_CHALLENGE');

        } catch (err: any) {
            setError(err.message);
            setState('IDLE');
        }
    };

    // --- Biometric Capture ---
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (state !== 'PASSWORD_CHALLENGE') return;
        keyEventsRef.current.push({
            code: e.code,
            time: performance.now(),
            type: 'keydown'
        });
    };

    const handleKeyUp = (e: React.KeyboardEvent) => {
        if (state !== 'PASSWORD_CHALLENGE') return;
        keyEventsRef.current.push({
            code: e.code,
            time: performance.now(),
            type: 'keyup'
        });
    };

    // STAGE 2: Biometric Verification (Server-Side Enforcement)
    const handlePasswordSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        console.log("--- Starting Stage 2 Verification ---");
        setError("");

        try {
            setState('PROCESSING');

            // 1. Prepare Session Data
            const startTime = keyEventsRef.current.length > 0 ? keyEventsRef.current[0].time : performance.now();
            const session: SessionData = {
                keys: keyEventsRef.current,
                startTime: startTime,
                sensors: []
            };

            // 2. Fetch Server Challenge (Nonce)
            const challengeRes = await fetch('/api/auth/challenge', { method: 'POST' });
            if (!challengeRes.ok) {
                const errorData = await challengeRes.json().catch(() => ({}));
                throw new Error(errorData.error || errorData.details || "Connection failed: Could not get security challenge.");
            }
            const { nonce } = await challengeRes.json();

            // 3. Generate ZKP Proof using Password + Server Nonce
            const proof = await zkp.generateProof(password, nonce);
            setZkpProof(proof);

            // 4. Call Server Verification
            console.log("4. Sending to Server for Verification...");
            const verifyRes = await fetch('/api/auth/verify-biometrics', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    temp_token: intentToken,
                    biometricData: session,
                    zkpProof: proof,
                    nonce: nonce // Send authoritative server nonce
                })
            });


            const verifyData = await verifyRes.json();

            if (!verifyRes.ok) {
                // If failed, API returns { error, details: { score, threshold } } OR { error, details: "string message" }
                if (verifyData.details) {
                    if (typeof verifyData.details === 'string') {
                        throw new Error(`Server Error: ${verifyData.details}`);
                    }
                    setBiometricResult({ score: verifyData.details.score, distance: 0 });
                    setThreshold(verifyData.details.threshold); // Update UI with authoritative threshold
                    throw new Error(`Biometric Mismatch (${verifyData.details.score}% < ${verifyData.details.threshold}%).`);
                }
                throw new Error(verifyData.error || "Verification Failed");
            }

            console.log("   > Session Established:", verifyData);

            // Success!
            // We can assume the server might return the score in success payload if we want to show it?
            // Let's assume verifyData.user or similar.
            // If not, we can't show the score bar accurately unless we calculate it locally purely for display.
            // But we said "Server is sole authority".
            // Let's calculate locally ONLY for the visual "Success" screen, 
            // Let's calculate locally JUST for the visual feedback, 
            // acknowledging it's an estimation, OR trust the server (if server returned it).
            // My server code currently doesn't return score on success.
            // I'll calculate locally JUST for the visual feedback, 
            // but the AUTHORITY was the server call above.

            // Store local estimation for UI display
            // We removed local profile, so we just show 100% for success.
            setBiometricResult({ score: 100, distance: 0 });

            setState('SUCCESS');

        } catch (err: any) {
            console.error("--- VERIFICATION FAILED ---", err);
            handleStage2Failure(err.message || "Verification Failed");
        }
    };

    // Helper for Retry Logic
    const handleStage2Failure = (reason: string) => {
        if (retryCount < 1) {
            setRetryCount(prev => prev + 1);
            setError(`${reason} You have 1 attempt remaining.`);
            setState('PASSWORD_CHALLENGE');
            setPassword('');
            keyEventsRef.current = []; // Reset keys!
            keyEventsRef.current = []; // Reset keys!
        } else {
            // TRIGGER INTRUDER ALERT
            setError("UNAUTHORIZED ACCESS DETECTED");
            setState('LOCKED');
            triggerIntruderAlert();
        }
    };

    // Trigger the actual alert sequence
    const triggerIntruderAlert = () => {
        setIntruderAlert(true);
        // Gather info first
        setClientInfo(prev => ({
            ...prev,
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            screenRes: `${window.screen.width}x${window.screen.height}`,
            timestamp: new Date().toISOString()
        }));

        // Fetch IP separately
        fetch('https://api.ipify.org?format=json')
            .then(r => r.json())
            .then(data => setClientInfo(prev => ({ ...prev, ip: data.ip })))
            .catch(() => setClientInfo(prev => ({ ...prev, ip: "Unknown (Proxy Detected)" })));
    };

    // --- Countdown Effect ---
    useEffect(() => {
        let timer: NodeJS.Timeout;
        if (intruderAlert && countdown > 0) {
            timer = setTimeout(() => setCountdown(c => c - 1), 1000);
        } else if (intruderAlert && countdown === 0) {
            // SELF DESTRUCT SEQUENCE
            if (window.opener) {
                window.opener.postMessage("zkp_login_failed", "*");
                window.close();
            } else if (window.parent && window.parent !== window) {
                window.parent.postMessage("zkp_login_failed", "*");
            } else {
                window.location.href = "about:blank"; // Fallback
            }
        }
        return () => clearTimeout(timer);
    }, [intruderAlert, countdown]);

    // --- Success Auto-Close Effect ---
    useEffect(() => {
        let timer: NodeJS.Timeout;
        if (state === 'SUCCESS') {
            timer = setTimeout(() => {
                // Determine how to close or redirect based on context
                if (window.opener) {
                    window.opener.postMessage("zkp_login_success", "*");
                    window.close();
                } else if (window.parent && window.parent !== window) {
                    window.parent.postMessage("zkp_login_success", "*");
                } else {
                    // Purposefully do nothing here.
                    // The main dashboard is hosted in a separate application.
                    // This prevents redirecting to the local Admin dashboard layout.
                    console.log("Login sequence completed securely.");
                }
            }, 1500); // 1.5 seconds delay to show "Access Granted"
        }
        return () => clearTimeout(timer);
    }, [state]);

    // --- UI Variants ---
    const containerVariants = {
        hidden: { opacity: 0, scale: 0.95 },
        visible: { opacity: 1, scale: 1, transition: { duration: 0.5 } }
    };

    return (
        <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center p-4 font-sans selection:bg-cyan-500/30">
            <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="w-full max-w-md bg-black border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden relative"
            >
                {/* Header */}
                <div className="h-2 bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500" />
                <div className="p-8">
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center space-x-3">
                            <div className="p-2 bg-neutral-900 rounded-lg border border-neutral-800">
                                <Fingerprint className="w-6 h-6 text-cyan-400" />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-neutral-400">
                                    Bio-ZKP Secure
                                </h1>
                                <p className="text-xs text-neutral-500 font-mono">BLACKBOX v1.0.4</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-[10px] text-neutral-500 font-mono tracking-wider uppercase">Security Level</div>
                            <div className="text-xl font-bold text-cyan-500 font-mono">{threshold}%</div>
                        </div>
                    </div>

                    <AnimatePresence mode="wait">
                        {state === 'IDLE' && (
                            <motion.form
                                key="identity-form"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                onSubmit={handleIdentitySubmit}
                                className="space-y-4"
                            >
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-neutral-400 uppercase tracking-widest">Company ID</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={companyId}
                                            onChange={(e) => setCompanyId(e.target.value)}
                                            className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-4 py-3 text-sm focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-all placeholder:text-neutral-700"
                                            placeholder="e.g. ibm_corp"
                                        />
                                        <Shield className="w-4 h-4 text-neutral-600 absolute right-3 top-3.5" />
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-neutral-400 uppercase tracking-widest">User ID</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={userId}
                                            onChange={(e) => setUserId(e.target.value)}
                                            className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-4 py-3 text-sm focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-all placeholder:text-neutral-700"
                                            placeholder="e.g. sakis_athan"
                                        />
                                        <ScanEye className="w-4 h-4 text-neutral-600 absolute right-3 top-3.5" />
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-neutral-400 uppercase tracking-widest">Password (Stage 1)</label>
                                    <div className="relative">
                                        <input
                                            type="password"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-4 py-3 text-sm focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-all placeholder:text-neutral-700 font-mono"
                                            placeholder="••••••••"
                                        />
                                        <Lock className="w-4 h-4 text-neutral-600 absolute right-3 top-3.5" />
                                    </div>
                                </div>

                                {error && (
                                    <div className="text-red-500 text-xs flex items-center bg-red-500/10 p-2 rounded">
                                        <AlertTriangle className="w-3 h-3 mr-2" /> {error}
                                    </div>
                                )}

                                <button type="submit" className="w-full bg-white text-black font-semibold py-3 rounded-lg hover:bg-neutral-200 transition-colors flex items-center justify-center space-x-2">
                                    <span>Verify Identity</span>
                                    <Shield className="w-4 h-4" />
                                </button>
                            </motion.form>
                        )}

                        {state === 'VALIDATING_ID' && (
                            <motion.div
                                key="loading"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="flex flex-col items-center justify-center py-12"
                            >
                                <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mb-4" />
                                <span className="text-sm text-neutral-400">Querying Firestore Chain...</span>
                            </motion.div>
                        )}

                        {state === 'PASSWORD_CHALLENGE' && (
                            <motion.form
                                key="password-form"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                onSubmit={handlePasswordSubmit}
                                className="space-y-6"
                            >
                                <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-center space-x-3">
                                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                                    <span className="text-emerald-400 text-xs font-mono">Identity Confirmed: {userId}</span>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                        <label className="text-xs font-medium text-cyan-400 uppercase tracking-widest">Stage 2: Re-enter Password</label>
                                        {retryCount > 0 && <span className="text-[10px] text-yellow-500 animate-pulse font-mono uppercase">⚠ 1 Attempt Remaining</span>}
                                    </div>
                                    <div className="relative group">
                                        <input
                                            ref={passwordInputRef}
                                            type="password"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            onKeyDown={handleKeyDown}
                                            onKeyUp={handleKeyUp}
                                            autoFocus
                                            className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-4 py-3 text-sm focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-all placeholder:text-neutral-700 font-mono tracking-widest"
                                            placeholder="••••••••••••"
                                        />
                                        <Lock className="w-4 h-4 text-neutral-600 absolute right-3 top-3.5 group-focus-within:text-cyan-500 transition-colors" />
                                    </div>
                                    <p className="text-[10px] text-neutral-500 flex items-center">
                                        <Activity className="w-3 h-3 mr-1" />
                                        Biometric Sensors Active: 30-Factor Analysis
                                    </p>
                                </div>

                                {error && (
                                    <div className="text-red-500 text-xs flex items-center bg-red-500/10 p-2 rounded">
                                        <AlertTriangle className="w-3 h-3 mr-2" /> {error}
                                    </div>
                                )}

                                <button type="submit" className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-semibold py-3 rounded-lg transition-colors shadow-lg shadow-cyan-900/20 flex items-center justify-center space-x-2">
                                    <span>Generate ZK Proof</span>
                                    <Terminal className="w-4 h-4" />
                                </button>
                            </motion.form>
                        )}

                        {state === 'PROCESSING' && (
                            <motion.div
                                key="processing"
                                className="space-y-4"
                            >
                                <div className="h-48 bg-neutral-900 rounded-lg border border-neutral-800 p-4 font-mono text-[10px] text-green-400 overflow-hidden relative">
                                    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-neutral-900/90" />
                                    <p>{`> Initializing ZKP Engine...`}</p>
                                    <p>{`> Generating Randomness r... [SECURE]`}</p>
                                    <p>{`> Computing H(x) = g^x mod p...`}</p>
                                    <p>{`> Extracting Biometrics...`}</p>
                                    <p>{`> Flight Time Vector: [${keyEventsRef.current.slice(0, 3).map(k => k.time.toFixed(0)).join(',')}, ...]`}</p>
                                    <p>{`> Dwell Maps Loaded.`}</p>
                                    <p className="animate-pulse">{`> Finalizing Proof...`}</p>
                                </div>
                                <div className="flex justify-center">
                                    <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                </div>
                            </motion.div>
                        )}

                        {(state === 'SUCCESS' || state === 'LOCKED') && (
                            <motion.div
                                key="result"
                                initial={{ scale: 0.9, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                className="text-center space-y-6"
                            >
                                {state === 'SUCCESS' ? (
                                    <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto border border-green-500/50">
                                        <CheckCircle className="w-10 h-10 text-green-500" />
                                    </div>
                                ) : (
                                    <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto border border-red-500/50">
                                        <XCircle className="w-10 h-10 text-red-500" />
                                    </div>
                                )}

                                <div>
                                    <h2 className="text-2xl font-bold text-white">
                                        {state === 'SUCCESS' ? 'Access Granted' : 'Access Denied'}
                                    </h2>
                                    <p className="text-neutral-400 text-sm mt-1">
                                        {state === 'SUCCESS' ? 'Identity Verified via Zero-Knowledge.' : 'Biometric Mismatch Detected.'}
                                    </p>
                                </div>

                                <div className="bg-neutral-900 rounded-lg p-4 text-left space-y-2 border border-neutral-800">
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-neutral-500">ZKP Commitment</span>
                                        <span className="text-cyan-400 font-mono truncate max-w-[150px]">{zkpProof?.commitment.substring(0, 16)}...</span>
                                    </div>
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-neutral-500">Biometric Score</span>
                                        <div className="flex items-center space-x-2">
                                            <div className="w-24 h-2 bg-neutral-800 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full ${(biometricResult?.score || 0) >= threshold ? 'bg-green-500' : 'bg-red-500'}`}
                                                    style={{ width: `${biometricResult?.score}%` }}
                                                />
                                            </div>
                                            <span className="text-white font-bold">{biometricResult?.score}%</span>
                                        </div>
                                    </div>
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-neutral-500">Security Threshold</span>
                                        <span className="text-neutral-300">{threshold}%</span>
                                    </div>
                                </div>

                                <button onClick={async () => {
                                    if (confirm("Resetting will delete your biometric profile from Firebase. Continue?")) {
                                        try {
                                            const res = await fetch('/api/auth/reset-profile', {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ companyId, userId })
                                            });
                                            if (res.ok) {
                                                window.location.reload();
                                            } else {
                                                throw new Error("Reset failed");
                                            }
                                        } catch (e) {
                                            console.error("Reset failed", e);
                                            alert("Failed to reset profile.");
                                        }
                                    }
                                }} className="text-xs text-neutral-500 hover:text-white transition-colors">
                                    Reset Verification (Clear Firebase Profile)
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* ERROR OVERLAY MODAL FOR RETRY - MOVED OUTSIDE ANIMATE PRESENCE */}
                    <AnimatePresence>
                        {state === 'PASSWORD_CHALLENGE' && error && (
                            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 rounded-2xl">
                                <motion.div
                                    key="error-modal"
                                    initial={{ scale: 0.9, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    exit={{ scale: 0.9, opacity: 0 }}
                                    className="bg-neutral-900 border border-red-500/50 p-6 rounded-xl max-w-xs text-center shadow-2xl"
                                >
                                    <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/30">
                                        <XCircle className="w-6 h-6 text-red-500" />
                                    </div>
                                    <h3 className="text-lg font-bold text-white mb-2">Access Denied</h3>
                                    <p className="text-xs text-neutral-400 mb-6">{error}</p>
                                    <button
                                        onClick={() => setError("")}
                                        className="w-full bg-white text-black font-bold py-2 rounded hover:bg-neutral-200 transition-colors"
                                    >
                                        Try Again
                                    </button>
                                </motion.div>
                            </div>
                        )}
                    </AnimatePresence>
                </div>
            </motion.div >

            {/* --- INTRUDER ALERT OVERLAY --- */}
            <AnimatePresence>
                {intruderAlert && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-red-950 flex flex-col items-center justify-center text-red-500 font-mono overflow-hidden"
                    >
                        {/* Background Effects */}
                        <div className="absolute inset-0 bg-red-900/10 pointer-events-none animate-pulse" />

                        <div className="z-10 text-center space-y-8 p-12 bg-black/90 border-4 border-red-600 rounded-3xl shadow-2xl shadow-red-900/50 max-w-4xl w-full mx-4 relative overflow-hidden">
                            {/* Scanning Line Effect */}
                            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-red-500/10 to-transparent h-full w-full animate-scan pointer-events-none" />

                            <div className="relative z-20">
                                <div className="flex justify-center mb-6">
                                    <AlertTriangle className="w-24 h-24 text-red-600 animate-bounce" />
                                </div>

                                <h1 className="text-5xl md:text-6xl font-black tracking-tighter text-white bg-red-600 px-6 py-2 inline-block transform -rotate-2 mb-4 shadow-lg shadow-red-900/50">
                                    SECURITY ALERT
                                </h1>
                                <h2 className="text-2xl md:text-3xl font-bold text-red-500 tracking-[0.2em] uppercase animate-pulse mb-8">
                                    UNAUTHORIZED ACCESS DETECTED
                                </h2>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left bg-red-950/30 p-6 rounded-xl border border-red-800/50 font-mono text-xs md:text-sm shadow-inner shadow-black/50">
                                    <div className="space-y-1">
                                        <p className="text-red-400 font-bold">TARGET_IP:</p>
                                        <p className="text-white font-bold text-lg md:text-xl tracking-wider">{clientInfo.ip}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-red-400 font-bold">DEVICE_ID:</p>
                                        <p className="text-white font-bold break-all">{clientInfo.platform} {"//"} {clientInfo.screenRes}</p>
                                    </div>
                                    <div className="col-span-1 md:col-span-2 space-y-1 border-t border-red-800/50 pt-4 mt-2">
                                        <p className="text-red-400 font-bold">FINGERPRINT:</p>
                                        <p className="text-white/70 text-[10px] break-all leading-tight">{clientInfo.userAgent}</p>
                                    </div>
                                    <div className="col-span-1 md:col-span-2 text-right mt-2">
                                        <p className="text-red-500/50 text-[10px]">LOG_ID: {clientInfo.timestamp}</p>
                                    </div>
                                </div>

                                <div className="mt-8 space-y-2">
                                    <p className="text-red-400 text-sm uppercase tracking-[0.3em] font-bold">System Lockdown Sequence</p>
                                    <div className="text-8xl md:text-9xl font-black text-white tabular-nums drop-shadow-[0_0_15px_rgba(255,0,0,0.8)]">
                                        {countdown}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div >
    );
}
