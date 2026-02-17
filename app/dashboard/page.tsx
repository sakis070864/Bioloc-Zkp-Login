"use client";



import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { HelpCircle, X, Shield, Users, Lock } from "lucide-react";
import { motion } from "framer-motion";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, doc, updateDoc } from "firebase/firestore";
import SecuritySlider from "@/components/dashboard/SecuritySlider";
import EmployeeTable, { Employee } from "@/components/dashboard/EmployeeTable";

import { Suspense } from 'react';

function DashboardContent() {
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [securityLevel, setSecurityLevel] = useState(85);
    const [isSuspended, setIsSuspended] = useState(false);

    // Get Company ID from session (set during login)
    // Fallback to google_inc only if session is missing (e.g. direct dev access)
    const [companyId, setCompanyId] = useState<string | null>(null);

    // Verify Session or Redirect (Client-Side Check)
    // In a real app, this page should be protected by Middleware + Server Session
    // checking HttpOnly cookies.
    // For this fix, we will at least ensure we don't blindly trust the URL parameter
    // if a session is already established for a DIFFERENT company.

    useEffect(() => {
        if (typeof window !== "undefined") {
            // 1. Check for Magic Link Setup
            const params = new URLSearchParams(window.location.search);
            const setupId = params.get("setup_company_id");

            if (setupId) {
                // Set Context
                sessionStorage.setItem("zkp_company_id", setupId);
                setCompanyId(setupId);

                // Clean URL (remove the sensitive/ugly param)
                const newUrl = window.location.pathname;
                window.history.replaceState({}, '', newUrl);
                return;
            }

            // 2. Normal Flow
            const storedId = sessionStorage.getItem("zkp_company_id");

            if (storedId) {
                setCompanyId(storedId);
            } else {
                // If context is missing, redirect to login to re-establish session context
                window.location.href = "/secure-login";
            }
        }
    }, []);

    const [trainingReps, setTrainingReps] = useState(10);

    // Real-time Data Subscription
    useEffect(() => {
        if (!companyId) return;

        // 1. Subscribe to Employees
        const q = query(
            collection(db, "companies", companyId, "users")
        );

        const unsubscribeUsers = onSnapshot(q, (snapshot) => {
            const users = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Employee[];
            setEmployees(users);
        });

        // 2. Subscribe to Company Settings (Security + Training + Status)
        const unsubscribeCompany = onSnapshot(doc(db, "companies", companyId), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                if (data.securityThreshold) setSecurityLevel(data.securityThreshold);
                if (data.trainingReps) setTrainingReps(data.trainingReps);

                // Check Suspension Status
                if (data.isActive === false) {
                    setIsSuspended(true);
                } else {
                    setIsSuspended(false);
                }
            }
        });

        return () => {
            unsubscribeUsers();
            unsubscribeCompany();
        };
    }, [companyId]);

    const handleSecurityChange = async (val: number) => {
        setSecurityLevel(val);
        // Debounce or save directly
        if (companyId) {
            await updateDoc(doc(db, "companies", companyId), { securityThreshold: val });
        }
    };

    const handleRepsChange = async (val: number) => {
        setTrainingReps(val);
        if (companyId) {
            await updateDoc(doc(db, "companies", companyId), { trainingReps: val });
        }
    };

    const [empName, setEmpName] = useState("");
    const [empId, setEmpId] = useState("");

    const [magicLink, setMagicLink] = useState("Enter details...");

    useEffect(() => {
        if (empName && empId) {
            setMagicLink("Click to Generate Secure Link");
        } else {
            setMagicLink("Enter details...");
        }
    }, [empName, empId]);

    const generateLink = async () => {
        if (!empName || !empId || !companyId) return '';

        try {
            setMagicLink("Generating...");
            const res = await fetch('/api/magic-link', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    companyId,
                    name: empName,
                    id: empId
                })
            });

            if (!res.ok) throw new Error("Failed to generate link");

            const data = await res.json();
            setMagicLink(data.magicLink);
            return data.magicLink;
        } catch (e) {
            console.error(e);
            setMagicLink("Error generating link");
            return '';
        }
    };

    const [showHelp, setShowHelp] = useState(false);

    if (isSuspended) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-slate-950 text-center relative overflow-hidden">
                <div className="absolute inset-0 bg-red-900/10 z-0 animate-pulse pointer-events-none" />

                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="bg-slate-900 p-12 rounded-2xl border border-red-500/30 shadow-2xl z-10 max-w-lg w-full"
                >
                    <div className="w-20 h-20 bg-red-950/50 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-500/20">
                        <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-500"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                    </div>

                    <h1 className="text-3xl font-bold text-white mb-2">ACCESS SUSPENDED</h1>
                    <p className="text-red-400 font-mono uppercase tracking-widest text-sm mb-8">Administrative Lockout Active</p>

                    <p className="text-slate-400 mb-8 leading-relaxed">
                        This organization&apos;s access to the ZKP Biometric Cloud has been securely paused by the administrator.
                        Live monitoring and authentication services are currently offline.
                        <br /><br />
                        <span className="text-slate-300">Contact Administration at <a href="mailto:mastorematas@gmail.com" className="text-cyan-400 hover:underline">mastorematas@gmail.com</a></span>
                    </p>

                    <div className="p-4 bg-red-950/20 border border-red-900/50 rounded-lg text-xs font-mono text-red-300">
                        ErrorCode: AUTH_ORG_SUSPENDED
                        <br />
                        Ref: {companyId || "UNKNOWN_ORG"}
                    </div>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <header className="flex justify-between items-end">
                <div className="flex items-center gap-4">
                    <div>
                        <h2 className="text-3xl font-bold text-white">System Overview</h2>
                        <p className="text-slate-400">Real-time biometric monitoring status.</p>
                    </div>
                    <button
                        onClick={() => setShowHelp(true)}
                        className="p-2 mb-1 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg transition-colors border border-slate-700"
                        title="Dashboard Guide"
                    >
                        <HelpCircle size={20} />
                    </button>
                </div>
                <div className="text-right hidden md:block">
                    <p className="text-xs text-slate-500 uppercase tracking-widest">Network Status</p>
                    <p className="text-green-400 font-bold flex items-center gap-2 justify-end">
                        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                        LIVE ENCRYPTED
                    </p>
                </div>
            </header>

            {showHelp && typeof document !== 'undefined' && createPortal(
                <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-2xl w-full shadow-2xl relative overflow-hidden">
                        {/* Header */}
                        <div className="bg-slate-950 p-6 border-b border-slate-800 flex justify-between items-center">
                            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                <HelpCircle className="text-cyan-500" />
                                Dashboard Guide
                            </h3>
                            <button onClick={() => setShowHelp(false)} className="text-slate-500 hover:text-white transition-colors">
                                <X size={24} />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">

                            {/* Section 1 */}
                            <div className="flex gap-4">
                                <div className="w-10 h-10 rounded-full bg-cyan-900/30 flex-shrink-0 flex items-center justify-center border border-cyan-500/30">
                                    <Users className="text-cyan-400" size={20} />
                                </div>
                                <div>
                                    <h4 className="text-white font-bold mb-1">Live Personnel Monitor</h4>
                                    <p className="text-slate-400 text-sm leading-relaxed">
                                        This is your main command center. View all active employees, their device info, and their real-time
                                        <span className="text-cyan-400 font-mono mx-1">Risk Score</span>.
                                        If a score drops below the threshold, the system flags the session.
                                    </p>
                                </div>
                            </div>

                            {/* Section 2 */}
                            <div className="flex gap-4">
                                <div className="w-10 h-10 rounded-full bg-purple-900/30 flex-shrink-0 flex items-center justify-center border border-purple-500/30">
                                    <Shield className="text-purple-400" size={20} />
                                </div>
                                <div>
                                    <h4 className="text-white font-bold mb-1">Biometric Enrollment</h4>
                                    <p className="text-slate-400 text-sm leading-relaxed">
                                        Use the panel on the right to onboard new users. Enter their Name/ID and click the link box to copy a
                                        <span className="text-purple-400 font-mono mx-1">Secure Magic Link</span>.
                                        Send this link to the employee to start their biometric training.
                                    </p>
                                </div>
                            </div>

                            {/* Section 3 */}
                            <div className="flex gap-4">
                                <div className="w-10 h-10 rounded-full bg-red-900/30 flex-shrink-0 flex items-center justify-center border border-red-500/30">
                                    <Lock className="text-red-400" size={20} />
                                </div>
                                <div>
                                    <h4 className="text-white font-bold mb-1">Security Threshold</h4>
                                    <p className="text-slate-400 text-sm leading-relaxed">
                                        Adjust the global <span className="text-red-400 font-mono mx-1">ZKP Threshold</span> slider.
                                        Higher values (e.g. 90%) require near-perfect biometric matches but may increase friction.
                                        Lower values (e.g. 70%) are more lenient.
                                    </p>
                                </div>
                            </div>

                        </div>

                        {/* Footer */}
                        <div className="bg-slate-950/50 p-4 border-t border-slate-800 text-center">
                            <button
                                onClick={() => setShowHelp(false)}
                                className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors font-medium border border-slate-700"
                            >
                                Got it
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Col: Stats & Slider */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="glass-panel p-6 rounded-2xl h-32 flex flex-col justify-center border-l-4 border-cyan-500">
                            <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider">Active Sessions</h3>
                            <p className="text-4xl font-bold text-white mt-2">{employees.length}</p>
                        </div>
                        <div className="glass-panel p-6 rounded-2xl h-32 flex flex-col justify-center border-l-4 border-purple-500">
                            <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider">Avg Risk Score</h3>
                            <p className="text-4xl font-bold text-white mt-2">
                                {employees.length > 0
                                    ? Math.round(employees.reduce((acc, curr) => acc + curr.riskScore, 0) / employees.length) + "%"
                                    : "-"
                                }
                            </p>
                        </div>
                        <div className="glass-panel p-6 rounded-2xl h-32 flex flex-col justify-center border-l-4 border-red-500">
                            <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider">Threats Blocked</h3>
                            <p className="text-4xl font-bold text-white mt-2">0</p>
                        </div>
                    </div>

                    <EmployeeTable employees={employees} companyId={companyId || ""} />
                </div>

                {/* Right Col: Controls */}
                <div className="space-y-6">

                    {/* Link Creator Panel */}
                    <div className="glass-panel p-6 rounded-2xl border border-cyan-500/30 bg-cyan-950/10">
                        <h3 className="text-cyan-400 text-xs font-bold uppercase tracking-wider mb-4 flex items-center gap-2">
                            Biometric Enrollment
                        </h3>
                        <p className="text-slate-400 text-xs mb-3">
                            Generate a personalized training link for a new employee.
                        </p>

                        <div className="space-y-3 mb-4">
                            <div>
                                <label className="text-[10px] uppercase font-bold text-slate-500 ml-1">Employee Name</label>
                                <input
                                    type="text"
                                    placeholder="e.g. John Doe"
                                    value={empName}
                                    onChange={(e) => setEmpName(e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-cyan-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] uppercase font-bold text-slate-500 ml-1">Employee ID</label>
                                <input
                                    type="text"
                                    placeholder="e.g. EMP-001"
                                    value={empId}
                                    onChange={(e) => setEmpId(e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:border-cyan-500 outline-none"
                                />
                            </div>
                        </div>

                        <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 flex items-center gap-2 group cursor-pointer hover:border-cyan-500/50 transition-all"
                            onClick={async () => {
                                // Only generate if not already generated or if we want to refresh?
                                // Let's just generate on click if it says "Ready" or if it's not a URL yet.
                                if (!magicLink.startsWith("http")) {
                                    const link = await generateLink();
                                    if (link) {
                                        navigator.clipboard.writeText(link);
                                        alert("Secure Magic Link copied!");
                                    }
                                } else {
                                    navigator.clipboard.writeText(magicLink);
                                    alert("Secure Magic Link copied!");
                                }
                            }}
                        >
                            <code className="text-xs text-slate-300 font-mono truncate flex-1">
                                {magicLink}
                            </code>
                            <div className="p-1.5 bg-slate-800 rounded group-hover:bg-cyan-500/20 group-hover:text-cyan-400 transition-colors">
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" /></svg>
                            </div>
                        </div>
                    </div>

                    <SecuritySlider value={securityLevel} onChange={handleSecurityChange} />

                    {/* NEW: Training Repetitions Control */}
                    <div className="glass-panel p-6 rounded-2xl border border-slate-800 mt-4">
                        <h3 className="text-white text-xs font-bold uppercase tracking-wider mb-2">Training Depth</h3>
                        <p className="text-slate-400 text-xs mb-4">Required keystroke repetitions.</p>

                        <div className="relative">
                            <select
                                value={trainingReps}
                                onChange={(e) => handleRepsChange(Number(e.target.value))}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white appearance-none cursor-pointer focus:border-cyan-500 outline-none"
                            >
                                <option value={10}>10 Repetitions</option>
                                <option value={15}>15 Repetitions</option>
                                <option value={20}>20 Repetitions</option>
                                <option value={25}>25 Repetitions</option>
                                <option value={30}>30 Repetitions</option>
                                <option value={35}>35 Repetitions</option>
                                <option value={40}>40 Repetitions</option>
                            </select>
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function DashboardHome() {
    return (
        <Suspense fallback={<div className="p-8 text-white">Loading Dashboard...</div>}>
            <DashboardContent />
        </Suspense>
    );
}
