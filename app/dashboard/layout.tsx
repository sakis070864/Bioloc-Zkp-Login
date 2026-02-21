"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LogOut } from "lucide-react";
import { db } from "@/lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";
import { clsx } from "clsx";

import { Suspense } from "react";

function DashboardLayoutContent({
    children,
}: {
    children: React.ReactNode;
}) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const urlCompanyId = searchParams.get("companyId");

    const [companyId, setCompanyId] = useState<string | null>(null);
    const [isSuspended, setIsSuspended] = useState(false);

    useEffect(() => {
        // Initial load of company ID - Client Side Only
        const storedId = sessionStorage.getItem("zkp_company_id");

        // Check for Setup Param (Magic Link)
        const setupId = new URLSearchParams(window.location.search).get("setup_company_id");

        if (urlCompanyId) {
            sessionStorage.setItem("zkp_company_id", urlCompanyId);
            // eslint-disable-next-line react-hooks/exhaustive-deps
            setCompanyId(urlCompanyId);
        } else if (setupId) {
            // Handle Magic Link Setup
            sessionStorage.setItem("zkp_company_id", setupId);
            setCompanyId(setupId);
            // Clean URL
            const newUrl = window.location.pathname;
            window.history.replaceState({}, '', newUrl);
        } else if (storedId) {
            setCompanyId(storedId);
        } else {
            // Check if we are already securely traversing?
            // If strictly no ID, redirect to secure login
            router.push("/");
        }
    }, [urlCompanyId, router]);

    // Listen for Suspension Status AND Deletion (Kill Switch)
    useEffect(() => {
        if (!companyId) return;
        const unsubscribe = onSnapshot(doc(db, "companies", companyId), (docSnap) => {
            if (docSnap.exists()) {
                setIsSuspended(docSnap.data().isActive === false);
            } else {
                // KILL SWITCH: Document Deleted while user is active
                console.warn(`🚨 Security Alert: Organization ${companyId} has been deleted. Terminating session.`);
                sessionStorage.removeItem("zkp_company_id"); // Destroy Credentials
                alert("ACCESS REVOKED: This organization has been dissolved.");
                window.location.href = '/'; // Hard Redirect
            }
        });
        return () => unsubscribe();
    }, [companyId]);

    // if (!companyId) return null; // Removed to prevent flicker, let children render or show partial UI if needed, but logic implies we wait?
    // Actually, keeping the check but returning a loader makes more sense inside the content.
    if (!companyId) return <div className="min-h-screen bg-[#020617] text-cyan-500 p-10">Initializing Secure Session...</div>;

    return (
        <div className="min-h-screen bg-[#020617] flex flex-col">
            {/* Top Header */}
            <header className="border-b border-slate-800/50 bg-slate-900/30 backdrop-blur-xl sticky top-0 z-40 px-8 py-4 flex items-center justify-between">

                {/* Logo Area */}
                <div className="flex items-center gap-4">
                    <div className="relative">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center font-bold text-white shadow-lg shadow-cyan-500/20 relative z-10">
                            Z
                        </div>

                        {/* Dynamic Health Pulse Indicator */}
                        <div className={clsx(
                            "absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-[#020617] z-20",
                            isSuspended ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]" : "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"
                        )} />
                        <div className={clsx(
                            "absolute -top-1 -right-1 w-3 h-3 rounded-full animate-ping z-10",
                            isSuspended ? "bg-red-500" : "bg-green-500"
                        )} />
                    </div>

                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="font-bold text-white tracking-tight leading-tight">ZKP BioLock</h1>
                            <span className={clsx(
                                "text-[10px] px-1.5 py-0.5 rounded border font-mono font-bold uppercase",
                                isSuspended
                                    ? "bg-red-500/10 text-red-400 border-red-500/20"
                                    : "bg-green-500/10 text-green-400 border-green-500/20"
                            )}>
                                {isSuspended ? "Suspended" : "Healthy"}
                            </span>
                        </div>
                        <p className="text-[10px] text-slate-500 font-mono uppercase tracking-widest">{companyId}</p>
                    </div>
                </div>

                {/* Sign Out Button */}
                <button
                    onClick={() => {
                        sessionStorage.removeItem("zkp_company_id");
                        router.push("/login");
                    }}
                    className="flex items-center gap-2 px-4 py-2 text-slate-400 hover:text-white transition-colors hover:bg-slate-800 rounded-lg text-sm border border-transparent hover:border-slate-700"
                >
                    <LogOut className="w-4 h-4" />
                    <span className="hidden sm:inline">Sign Out</span>
                </button>
            </header>

            {/* Main Content */}
            <main className="flex-1 w-full">
                <div className="max-w-7xl mx-auto p-8">
                    {children}
                </div>
            </main>
        </div>
    );
}

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <Suspense fallback={<div className="min-h-screen bg-[#020617] text-white p-10">Loading Environment...</div>}>
            <DashboardLayoutContent>{children}</DashboardLayoutContent>
        </Suspense>
    );
}
