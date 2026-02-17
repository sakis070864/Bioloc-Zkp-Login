
import React from 'react';
import { AlertTriangle, ShieldAlert } from 'lucide-react';
import Link from 'next/link';

export default function AccessDeniedPage({ searchParams }: { searchParams: { violation?: string } }) {
    return (
        <div className="min-h-screen bg-black text-red-600 flex flex-col items-center justify-center p-4 font-mono uppercase">
            <div className="max-w-md w-full border-4 border-red-600 p-8 relative overflow-hidden animate-pulse">

                {/* Background Scanlines */}
                <div className="absolute inset-0 pointer-events-none opacity-10"
                    style={{ backgroundImage: 'linear-gradient(transparent 50%, rgba(255,0,0,0.5) 50%)', backgroundSize: '100% 4px' }}>
                </div>

                <div className="flex flex-col items-center z-10 relative">
                    <ShieldAlert size={80} className="mb-6 animate-bounce" />

                    <h1 className="text-4xl font-bold mb-2 text-center text-red-500 tracking-widest">
                        SYSTEM LOCKED
                    </h1>

                    <div className="w-full h-1 bg-red-600 my-4" />

                    <h2 className="text-xl font-bold mb-6 text-center">
                        UNAUTHORIZED ACCESS DETECTED
                    </h2>

                    <div className="bg-red-900/20 w-full p-4 border border-red-600 mb-6 text-sm">
                        <p className="mb-2">ERROR_CODE: <span className="text-white">BIO_AUTH_FAIL_098</span></p>
                        <p className="mb-2">REASON: <span className="text-white">BIOMETRIC MISMATCH DETECTED</span></p>
                        <p>ACTION: <span className="text-white">SESSION TERMINATED</span></p>
                    </div>

                    <p className="text-xs text-center text-red-400 mb-8 leading-relaxed">
                        Your IP address and biometric telemetry have been logged for the System Administrator.
                        Repeated attempts will result in permanent blacklist.
                    </p>

                    <Link href="/" className="px-6 py-3 border border-red-800 text-red-800 hover:bg-red-900/30 hover:text-red-500 transition-colors text-xs tracking-widest">
                        RETURN TO HOMEPAGE
                    </Link>
                </div>
            </div>
        </div>
    );
}
