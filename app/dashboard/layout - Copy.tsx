"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { LogOut } from "lucide-react";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const router = useRouter();
    const [companyId, setCompanyId] = useState<string | null>(null);

    const searchParams = useSearchParams();
    const urlCompanyId = searchParams.get("companyId");

    useEffect(() => {
        // Check URL first (allow deep linking / admin redirect)
        if (urlCompanyId) {
            sessionStorage.setItem("zkp_company_id", urlCompanyId);
            setCompanyId(urlCompanyId);
            return;
        }

        // Basic session check
        const storedId = sessionStorage.getItem("zkp_company_id");
        if (!storedId) {
            router.push("/login");
        } else {
            setCompanyId(storedId);
        }
    }, [router, urlCompanyId]);

    if (!companyId) return null; // Or a loading spinner

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
                        {/* The Health Pulse Indicator */}
                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-[#020617] z-20 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-ping z-10" />
                    </div>

                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="font-bold text-white tracking-tight leading-tight">ZKP BioLock</h1>
                            <span className="text-[10px] bg-green-500/10 text-green-400 px-1.5 py-0.5 rounded border border-green-500/20 font-mono font-bold uppercase">
                                Healthy
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
