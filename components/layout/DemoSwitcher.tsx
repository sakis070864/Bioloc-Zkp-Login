"use client";

import { usePathname, useRouter } from "next/navigation";
import { User, ShieldCheck, ArrowRightLeft } from "lucide-react";
import { clsx } from "clsx";

export default function DemoSwitcher() {
    const pathname = usePathname();
    const router = useRouter();

    // Don't show on login page to avoid clutter
    if (pathname === "/login") return null;

    const isAdmin = pathname.startsWith("/dashboard");

    return (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 p-1 bg-slate-900/90 backdrop-blur-md border border-slate-700 rounded-full shadow-2xl">
            <button
                onClick={() => router.push("/")}
                className={clsx(
                    "px-4 py-2 rounded-full flex items-center gap-2 text-sm font-medium transition-all",
                    !isAdmin
                        ? "bg-cyan-600 text-white shadow-lg"
                        : "text-slate-400 hover:text-white hover:bg-slate-800"
                )}
            >
                <User className="w-4 h-4" />
                Employee App
            </button>

            <div className="text-slate-600">
                <ArrowRightLeft className="w-4 h-4" />
            </div>

            <button
                onClick={() => router.push("/dashboard")}
                className={clsx(
                    "px-4 py-2 rounded-full flex items-center gap-2 text-sm font-medium transition-all",
                    isAdmin
                        ? "bg-purple-600 text-white shadow-lg"
                        : "text-slate-400 hover:text-white hover:bg-slate-800"
                )}
            >
                <ShieldCheck className="w-4 h-4" />
                Admin HQ
            </button>
        </div>
    );
}
