
"use client";

import { useState, Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Header from "@/components/layout/Header";
import BiometricCapture from "@/components/features/BiometricCapture";
import { motion, AnimatePresence } from "framer-motion";
import { syncProofToFirebase } from "@/lib/sync";
import IdentityForm from "@/components/features/IdentityForm";
import { clsx } from "clsx";
import { createProfile, compareBiometrics } from "@/lib/biometrics";
import { doc, getDoc, onSnapshot, collection, query, where, getDocs } from "firebase/firestore";
import { db } from '@/lib/firebase';

// Main Content Component
function LoginContent() {
    const searchParams = useSearchParams();
    const companyId = searchParams.get("companyId");

    const [userData, setUserData] = useState<{ name: string, id: string, companyId: string } | null>(null);
    const [isCalibrating, setIsCalibrating] = useState(false);
    const [isVerifying, setIsVerifying] = useState(false);
    const [profile, setProfile] = useState<any>(null);
    const [computedProfile, setComputedProfile] = useState<number[]>([]);
    const [verificationResult, setVerificationResult] = useState<{ score: number, distance: number } | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    // Auto-set Company ID if in URL and Handle Magic Links
    const [trainingReps, setTrainingReps] = useState(10); // Default to 10
    const [accessDenied, setAccessDenied] = useState(false); // New blocking state

    // REAL-TIME SECURITY: Kill Switch for Enrollment
    useEffect(() => {
        if (!companyId) return;

        const unsubscribe = onSnapshot(doc(db, "companies", companyId), (snap) => {
            // If document disappears OR is suspended
            if (!snap.exists() || snap.data().isActive === false) {
                console.warn("🚨 SESSION TERMINATED: Organization dissolved.");
                setAccessDenied(true);
                setUserData(null); // Clear any active session
            }
        });

        return () => unsubscribe();
    }, [companyId]);

    const [token, setToken] = useState<string | null>(null);
    const [isResolving, setIsResolving] = useState(false);

    const [magicLinkIdentity, setMagicLinkIdentity] = useState<{ name: string, id: string, companyId: string } | null>(null);

    useEffect(() => {
        const checkAndLogin = async () => {
            const urlToken = searchParams.get("token");
            const urlCompanyId = searchParams.get("companyId"); 

            // 1. If Company ID is present in URL (Standard Flow)
            if (urlCompanyId) {
                // Verify Company Existence FIRST
                const snap = await getDoc(doc(db, "companies", urlCompanyId));

                if (!snap.exists() || snap.data().isActive === false) {
                    console.warn("🚨 LOGIN BLOCKED: Organization does not exist or suspended.");
                    setAccessDenied(true);
                    return; // HALT HERE
                }

                // If exists, apply settings
                const data = snap.data();
                if (data.trainingReps) setTrainingReps(data.trainingReps);
            }
            
            // 2. Handle Magic Link Token (Secure Flow)
            if (urlToken) {
                 setIsResolving(true);
                 setToken(urlToken);
                 
                 try {
                     // Query Firestore for the token
                     const q = query(
                         collection(db, "magic_links"), 
                         where("token", "==", urlToken),
                         where("active", "==", true)
                     );
                     
                     const querySnapshot = await getDocs(q);
                     
                     if (!querySnapshot.empty) {
                         const linkDoc = querySnapshot.docs[0];
                         const linkData = linkDoc.data();
                         
                         // Check Expiration
                         if (linkData.expiresAt?.toDate() < new Date()) {
                             console.warn("Link expired");
                             setAccessDenied(true);
                         } else {
                             // Valid Link - Pass data to IdentityForm via state
                             // We do NOT set userData directly anymore to force the IdentityForm
                             // to run its "Create Password" check logic.
                             setMagicLinkIdentity({
                                 name: linkData.name,
                                 id: linkData.employeeId,
                                 companyId: linkData.companyId
                             });
                         }
                     } else {
                         console.warn("Invalid Magic Link Token");
                         setAccessDenied(true);
                     }
                 } catch (e) {
                     console.error("Error resolving magic link:", e);
                     setAccessDenied(true);
                 } finally {
                     setIsResolving(false);
                 }
            }
        };

        checkAndLogin();
    }, [searchParams]);


    // Phase 1: Training Complete
    const handleCalibrationComplete = async (data: any) => {
        setIsSaving(true);
        await new Promise(r => setTimeout(r, 800));

        const trainingData = data.rawData;
        // Fix: Pass full session objects (with sensors) now that createProfile handles it
        const avgProfile = createProfile(trainingData);

        setComputedProfile(avgProfile as any);
        setProfile(data);

        // Sync to Firebase
        if (userData) {
            const mockRiskScore = 95;
            await syncProofToFirebase({
                userId: userData.id,
                companyId: userData.companyId, // Use the one from form or URL
                displayName: userData.name,
                riskScore: mockRiskScore,
                status: "LOCKED",
                // @ts-ignore
                zkp: (userData as any).zkp,
                biometricProfile: avgProfile, // SAVE TO DB
                phrase: data.phrase // Save text password
            });
        }
        setIsSaving(false);
    };

    // Phase 2: Verification Complete
    const handleVerificationComplete = async (data: any) => {
        setIsVerifying(false);
        const loginSession = data.rawData[0];
        // Fix: Pass full session object
        const result = compareBiometrics(computedProfile as any, loginSession);
        setVerificationResult(result);
    };

    if (isResolving) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#020617] text-white">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-500 mx-auto"></div>
                    <p className="mt-4 text-sm tracking-widest text-slate-500">SECURING CONNECTION...</p>
                </div>
            </div>
        );
    }

    // Only block if we have NO companyId AND NO resolved userData
    if ((!companyId && !userData?.companyId && !magicLinkIdentity?.companyId) || accessDenied) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#020617] text-slate-400">
                <div className="text-center space-y-4">
                    <h1 className="text-red-500 font-bold text-2xl">Access Denied</h1>
                    <p>{accessDenied ? "This link is expired or the organization is suspended." : "Missing Organization Identifier."}</p>
                </div>
            </div>
        )
    }

    // Determine the active company ID (URL or Resolved)
    const activeCompanyId = companyId || userData?.companyId || magicLinkIdentity?.companyId || "";

    return (
        <main className="min-h-screen pt-32 pb-20 px-4 relative overflow-hidden flex flex-col items-center bg-[#020617]">
            {/* Background Decorative Glows */}
            <div className="fixed top-20 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl -z-10 animate-pulse"></div>
            <div className="fixed bottom-20 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl -z-10 animate-pulse delay-1000"></div>

            <Header />

            <div className="flex flex-col items-center mb-8">
                <span className="text-xs font-mono text-cyan-500 uppercase tracking-widest mb-2">Secure Gateway</span>
                <h1 className="text-2xl text-white font-bold">{activeCompanyId.toUpperCase().replace(/_/g, " ")}</h1>
                {userData && (
                    <div className="mt-2 text-center">
                        <p className="text-lg text-cyan-400 font-medium">{userData.name}</p>
                        <p className="text-xs text-slate-500 font-mono tracking-wider">{userData.id}</p>
                    </div>
                )}
            </div>

            <AnimatePresence mode="wait">
                {!userData ? (
                    <motion.div
                        key="identity"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, y: -20 }}
                    >
                        <IdentityForm 
                            initialCompanyId={activeCompanyId} 
                            initialToken={token} 
                            initialName={magicLinkIdentity?.name}
                            initialId={magicLinkIdentity?.id}
                            onComplete={(data) => setUserData(data)} 
                        />
                    </motion.div>
                ) : !isCalibrating && !profile ? (
                    <motion.div
                        key="intro"
                        className="max-w-2xl w-full text-center space-y-8 glass-panel p-8 rounded-3xl"
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -30 }}
                        transition={{ duration: 0.5 }}
                    >
                        {/* Intro */}
                        <div className="space-y-4">
                            <h2 className="text-4xl md:text-5xl font-bold text-white tracking-tight">
                                Behavioral <span className="text-cyan-400">Fingerprint</span>
                            </h2>
                            <p className="text-slate-400 text-lg max-w-lg mx-auto leading-relaxed">
                                We are building a mathematical model of your movement, kept
                                <span className="text-white font-semibold"> 100% private </span>
                                on this device.
                            </p>
                        </div>

                        {/* Action Area */}
                        <div className="pt-8 flex flex-col items-center gap-4">
                            <button
                                onClick={() => setIsCalibrating(true)}
                                className="group relative px-8 py-4 bg-slate-900 rounded-xl overflow-hidden shadow-2xl transition-all hover:scale-105 active:scale-95 border border-slate-700 hover:border-cyan-500/50"
                            >
                                <div className="absolute inset-0 bg-gradient-to-r from-cyan-600 to-purple-600 opacity-20 group-hover:opacity-40 transition-opacity"></div>
                                <span className="relative font-bold text-white tracking-wider flex items-center gap-2">
                                    START CALIBRATION
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
                                </span>
                            </button>
                        </div>
                    </motion.div>
                ) : isCalibrating && !profile ? (
                    <motion.div
                        key="calibration"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 1.05 }}
                        transition={{ duration: 0.5 }}
                        className="w-full"
                    >
                        <BiometricCapture
                            onComplete={handleCalibrationComplete}
                            mode="train"
                            trainingReps={trainingReps}
                            initialPhrase={(userData as any).password}
                        />
                    </motion.div>
                ) : isVerifying ? (
                    <motion.div
                        key="verification"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 1.05 }}
                        className="w-full"
                    >
                        <BiometricCapture
                            onComplete={handleVerificationComplete}
                            mode="verify"
                            initialPhrase={profile?.phrase} // Pass the custom phrase
                        />
                    </motion.div>
                ) : (
                    <motion.div
                        key="success"
                        className="max-w-2xl w-full text-center space-y-8 glass-panel p-8 rounded-3xl"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                    >
                        {verificationResult ? (
                            // --- RESULT VIEW ---
                            <div className="space-y-6">
                                <div className="flex flex-col items-center">
                                    <div className={clsx(
                                        "text-6xl font-black tracking-tighter mb-2",
                                        verificationResult.score > 80 ? "text-green-400" :
                                            verificationResult.score > 50 ? "text-yellow-400" : "text-red-500"
                                    )}>
                                        {verificationResult.score}%
                                    </div>
                                    <div className="text-sm uppercase tracking-widest text-slate-500">Behavioral Match</div>
                                </div>

                                <div className="p-4 bg-slate-900 rounded-xl border border-slate-800 text-left space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-400">Deviation</span>
                                        <span className="text-white font-mono">{verificationResult.distance}ms</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-400">Status</span>
                                        <span className={clsx("font-bold", verificationResult.score > 80 ? "text-green-400" : "text-red-400")}>
                                            {verificationResult.score > 80 ? "AUTHORIZED" : "REJECTED"}
                                        </span>
                                    </div>
                                </div>

                                <button
                                    onClick={() => setVerificationResult(null)}
                                    className="w-full py-4 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold transition-colors"
                                >
                                    Try Again
                                </button>
                            </div>
                        ) : (
                            // --- DEFAULT SUCCESS VIEW ---
                            <>
                                <div className="text-6xl mb-4">💎</div>
                                <h2 className="text-3xl font-bold text-white">Identity Minted</h2>
                                <p className="text-slate-400">
                                    Your behavioral profile has been secured locally.
                                </p>
                                <div className="p-4 bg-slate-900/50 rounded-lg border border-slate-700 font-mono text-xs text-left text-cyan-400 overflow-hidden">
                                    {JSON.stringify(profile?.rawData?.slice(0, 3) || {}, null, 2)}
                                    <div className="text-slate-600 italic mt-2">... (truncated)</div>
                                </div>

                                <div className="flex flex-col gap-3 pt-4">
                                    <button
                                        onClick={() => setIsVerifying(true)}
                                        className="w-full py-4 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-bold shadow-lg shadow-cyan-900/20 transition-all"
                                    >
                                        Test Login (Biometrics)
                                    </button>

                                    <button
                                        onClick={() => {
                                            setProfile(null);
                                            setIsCalibrating(false);
                                            setVerificationResult(null);
                                            setComputedProfile([]);
                                        }}
                                        className="text-slate-400 hover:text-white underline underline-offset-4 text-sm"
                                    >
                                        Reset Demo
                                    </button>
                                </div>
                            </>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </main >
    );
}

// Suspense Wrapper
export default function LoginPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-[#020617] text-white">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-500 mx-auto"></div>
                    <p className="mt-4 text-sm tracking-widest text-slate-500">INITIATING SECURE ENVIRONMENT</p>
                </div>
            </div>
        }>
            <LoginContent />
        </Suspense>
    );
}
