
'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, doc, setDoc, deleteDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { ShieldCheck, Plus, Trash2, Copy, ExternalLink, RefreshCw, Lock, Terminal } from 'lucide-react';
import { clsx } from 'clsx';
import Link from 'next/link';

// --- TYPE DEFINITIONS ---
interface Company {
    id: string;
    displayName: string;
    createdAt: any;
    isActive: boolean;
    lastPaymentDate: any;
}

export default function NexusControl() {
    const [isUnlocked, setIsUnlocked] = useState(false);
    const [password, setPassword] = useState('');
    const [error, setError] = useState(false);

    // --- STEALTH LAYER (FAKE 404) ---
    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();

        try {
            const res = await fetch('/api/admin/auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password })
            });

            if (res.ok) {
                setIsUnlocked(true);
            } else {
                setError(true);
                setTimeout(() => setError(false), 1000);
            }
        } catch (err) {
            console.error(err);
            setError(true);
        }
    };

    if (!isUnlocked) {
        return (
            <div className="min-h-screen bg-black text-slate-500 font-mono p-10 flex flex-col items-center justify-center">
                <div className="text-center space-y-4 max-w-lg">
                    <h1 className="text-6xl font-bold text-slate-800">404</h1>
                    <p className="text-xl">PAGE NOT FOUND</p>
                    <p className="text-sm text-slate-700">The requested resource could not be found on this server.</p>
                </div>

                {/* Hidden Input Field disguised as something else or just invisible */}
                <form onSubmit={handleAuth} className="mt-20 opacity-0 hover:opacity-100 transition-opacity duration-500">
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className={clsx(
                            "bg-slate-900 border border-slate-800 text-white px-4 py-2 rounded focus:border-red-500 outline-none",
                            error && "border-red-500 animate-shake"
                        )}
                        placeholder="System Override..."
                        autoFocus
                    />
                </form>
            </div>
        );
    }

    // --- REAL DASHBOARD CONTENT ---
    return <DashboardContent />;
}

function DashboardContent() {
    const [companies, setCompanies] = useState<Company[]>([]);
    const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
    const [companyUsers, setCompanyUsers] = useState<any[]>([]);
    const [newCompanyId, setNewCompanyId] = useState('');
    const [newCompanyName, setNewCompanyName] = useState('');
    const [loading, setLoading] = useState(false);
    const [generatedLink, setGeneratedLink] = useState('');


    // Real-time subscription to Companies
    useEffect(() => {
        const unsubscribe = onSnapshot(collection(db, 'companies'), (snapshot) => {
            const list = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Company[];
            setCompanies(list);
        });

        return () => unsubscribe();
    }, []);

    const handleGenerate = async () => {
        if (!newCompanyId || !newCompanyName) return;
        setLoading(true);

        try {
            await setDoc(doc(db, 'companies', newCompanyId), {
                displayName: newCompanyName,
                isActive: true,
                createdAt: serverTimestamp(),
                lastPaymentDate: serverTimestamp(),
                securityThreshold: 85
            });

            const host = window.location.origin;
            setGeneratedLink(`${host}/login?companyId=${newCompanyId}`);

            setNewCompanyId('');
            setNewCompanyName('');
        } catch (error) {
            console.error("Failed to provision:", error);
            alert("Error creating company.");
        } finally {
            setLoading(false);
        }
    };

    const toggleStatus = async (companyId: string, currentStatus: boolean) => {
        try {
            await setDoc(doc(db, 'companies', companyId), {
                isActive: !currentStatus
            }, { merge: true });
        } catch (error) {
            console.error("Error toggling status:", error);
        }
    };

    const markPaid = async (companyId: string) => {
        try {
            await setDoc(doc(db, 'companies', companyId), {
                lastPaymentDate: serverTimestamp()
            }, { merge: true });
        } catch (error) {
            console.error("Error updating payment:", error);
        }
    };

    const handleDelete = async (companyId: string) => {
        if (!confirm(`Delete ${companyId}? This is irreversible.`)) return;
        try {
            await deleteDoc(doc(db, 'companies', companyId));
        } catch (error) {
            console.error(error);
        }
    };

    const getDaysSincePayment = (timestamp: any) => {
        if (!timestamp) return 0;
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        const diff = new Date().getTime() - date.getTime();
        return Math.floor(diff / (1000 * 3600 * 24));
    };

    return (
        <div className="min-h-screen p-10 relative bg-[#020617] overflow-hidden text-slate-300">
            {/* Background FX */}
            <div className="absolute top-[-20%] left-[-10%] w-[800px] h-[800px] bg-red-900/5 rounded-full blur-[120px] pointer-events-none" />

            <div className="max-w-6xl mx-auto z-10 relative">
                <header className="flex items-center justify-between mb-12 border-b border-slate-800 pb-6">
                    <div>
                        <h1 className="text-4xl font-mono font-bold text-red-500 tracking-tighter flex items-center gap-3">
                            <Terminal className="w-10 h-10" />
                            NEXUS::CONTROL
                        </h1>
                        <p className="text-slate-500 mt-2 font-mono text-sm">ROOT ACCESS GRANTED // OVERRIDE ACTIVE</p>
                    </div>
                    <Link href="/" className="text-xs text-slate-600 hover:text-red-500 font-mono uppercase tracking-widest transition-colors">
                        [ Logout Session ]
                    </Link>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* LEFT: Provisioning Panel */}
                    <div className="bg-slate-900/50 backdrop-blur-md p-8 rounded-none border border-red-900/30">
                        <h2 className="text-xs font-bold text-red-500 uppercase tracking-widest mb-6 flex items-center gap-2">
                            Provision Target
                        </h2>

                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Target Name</label>
                                <input
                                    type="text"
                                    placeholder="CORP_NAME"
                                    value={newCompanyName}
                                    onChange={(e) => setNewCompanyName(e.target.value)}
                                    className="w-full bg-black border border-slate-800 p-3 text-white focus:border-red-500 outline-none font-mono text-sm"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Protocol ID</label>
                                <input
                                    type="text"
                                    placeholder="corp_id_slug"
                                    value={newCompanyId}
                                    onChange={(e) => setNewCompanyId(e.target.value.toLowerCase().replace(/\s+/g, '_'))}
                                    className="w-full bg-black border border-slate-800 p-3 text-white focus:border-red-500 outline-none font-mono text-sm"
                                />
                            </div>

                            <button
                                onClick={handleGenerate}
                                disabled={loading || !newCompanyId || !newCompanyName}
                                className="w-full bg-red-900/20 hover:bg-red-900/40 text-red-500 border border-red-900/50 py-3 font-mono font-bold uppercase tracking-widest transition-all mt-4"
                            >
                                {loading ? "EXECUTING..." : "INITIALIZE PROTOCOL"}
                            </button>
                        </div>

                        {generatedLink && (
                            <div className="mt-6 p-4 bg-black border border-green-900/50">
                                <p className="text-[10px] text-green-500 font-bold mb-2 uppercase">INFILTRATION VECTOR GENERATED</p>
                                <div className="flex items-center justify-between gap-2">
                                    <code className="text-green-400/80 text-xs truncate font-mono bg-green-900/10 p-2 w-full">{generatedLink}</code>
                                    <button
                                        onClick={() => navigator.clipboard.writeText(generatedLink)}
                                        className="text-slate-500 hover:text-white"
                                    >
                                        <Copy className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* RIGHT: Active Companies List */}
                    <div className="lg:col-span-2 bg-slate-900/50 backdrop-blur-md p-8 rounded-none border border-slate-800">
                        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-6 border-b border-slate-800 pb-2">
                            Active Protocols ({companies.length})
                        </h2>

                        <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                            {companies.map((company) => {
                                const days = getDaysSincePayment(company.lastPaymentDate);
                                return (
                                    <div key={company.id}
                                        className="group flex flex-col md:flex-row md:items-center justify-between p-4 bg-black border border-slate-800 hover:border-red-900/50 transition-all cursor-crosshair"
                                    >
                                        <div>
                                            <div className="flex items-center gap-3">
                                                <div className={clsx("w-2 h-2 rounded-full", company.isActive ? "bg-green-500 animate-pulse" : "bg-red-500")} />
                                                <h3 className="font-mono text-white text-sm tracking-wider">{company.displayName.toUpperCase()}</h3>
                                            </div>
                                            <div className="ml-5 mt-1 text-[10px] text-slate-600 font-mono">
                                                ID: {company.id} | UPTIME: {days}D
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-4 mt-4 md:mt-0 opacity-100 transition-opacity">
                                            <a
                                                href={`/dashboard?setup_company_id=${company.id}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="bg-blue-600 text-white px-2 py-1 rounded text-[10px] uppercase font-bold hover:bg-blue-500 mr-4 border border-blue-400"
                                            >
                                                [ VIEW_DASHBOARD ]
                                            </a>

                                            <button
                                                onClick={() => toggleStatus(company.id, company.isActive)}
                                                className="text-[10px] uppercase font-bold text-slate-500 hover:text-white"
                                            >
                                                [{company.isActive ? "FREEZE" : "RESUME"}]
                                            </button>

                                            <button
                                                onClick={() => markPaid(company.id)}
                                                className="text-[10px] uppercase font-bold text-slate-500 hover:text-green-400"
                                            >
                                                [RENEW]
                                            </button>

                                            <button
                                                onClick={() => handleDelete(company.id)}
                                                className="text-[10px] uppercase font-bold text-red-900 hover:text-red-500"
                                            >
                                                [TERMINATE]
                                            </button>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
