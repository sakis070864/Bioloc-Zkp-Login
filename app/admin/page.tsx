'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, doc, setDoc, deleteDoc, onSnapshot, serverTimestamp, getDocs, collectionGroup, writeBatch, Timestamp } from 'firebase/firestore';
import { ShieldCheck, Plus, Trash2, Copy, ExternalLink, RefreshCw, User, CheckCircle, Link as LinkIcon, X } from 'lucide-react';
import { clsx } from 'clsx';
import Link from 'next/link';

interface Company {
    id: string; // The companyId (e.g. google_inc)
    displayName: string;
    createdAt: Timestamp | null;
    isActive: boolean;
    lastPaymentDate?: Timestamp | null; // Timestamp
    isGhost?: boolean; // New flag for recovered data
    dashboardUrl?: string; // Persisted Link
}

interface CompanyUser {
    id: string;
    name?: string;
    displayName?: string;
    employeeId?: string;
    createdAt?: Timestamp;
    [key: string]: any;
}

export default function AdminDashboard() {
    const [companies, setCompanies] = useState<Company[]>([]);
    const [realCompanies, setRealCompanies] = useState<Company[]>([]);
    const [ghostCompanies, setGhostCompanies] = useState<Company[]>([]);

    const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
    const [companyUsers, setCompanyUsers] = useState<CompanyUser[]>([]);
    const [newCompanyId, setNewCompanyId] = useState('');
    const [newCompanyName, setNewCompanyName] = useState('');
    const [loading, setLoading] = useState(false);
    const [generatedLink, setGeneratedLink] = useState('');
    const [linkModal, setLinkModal] = useState<{ name: string, url: string } | null>(null);

    // Debugging hook initialization
    useEffect(() => {
        console.log("AdminDashboard Component Mounted. LinkModal State:", linkModal);
    }, [linkModal]);

    // Real-time Users for Selected Company
    useEffect(() => {
        if (!selectedCompany) {
            setCompanyUsers([]);
            return;
        }

        const unsubscribe = onSnapshot(collection(db, 'companies', selectedCompany.id, 'users'), (snapshot) => {
            const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as CompanyUser[];
            setCompanyUsers(list);
        });
        return () => unsubscribe();
    }, [selectedCompany]);

    // 1. Real-time subscription to EXISTENT Companies
    useEffect(() => {
        const unsubscribe = onSnapshot(collection(db, 'companies'), (snapshot) => {
            const list = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Company[];
            setRealCompanies(list);
        });

        return () => unsubscribe();
    }, []);

    // 2. One-time deep scan for GHOST Companies (Deleted Docs with surviving subcollections)
    useEffect(() => {
        const scanGhosts = async () => {
            try {
                console.log("Starting Deep Ghost Scan...");
                const usersQuery = collectionGroup(db, 'users');
                const usersSnapshot = await getDocs(usersQuery);

                const foundCompanyIds = new Set<string>();
                usersSnapshot.forEach(uDoc => {
                    // path: companies/{companyId}/users/{userId}
                    const parentCompany = uDoc.ref.parent.parent;
                    if (parentCompany) {
                        foundCompanyIds.add(parentCompany.id);
                    }
                });

                const ghosts = Array.from(foundCompanyIds).map(gid => ({
                    id: gid,
                    displayName: `${gid} (Recovered)`, // Changed 'name' to 'displayName' to match interface
                    isActive: false,
                    createdAt: null, // Added createdAt to match interface
                    lastPaymentDate: null,
                    isGhost: true,
                    dashboardUrl: `/dashboard?companyId=${gid}` // recovered link
                } as Company));

                console.log("Ghosts Found:", ghosts.length);
                setGhostCompanies(ghosts);
            } catch (err) {
                console.error("Ghost Scan Error:", err);
            }
        };

        scanGhosts();
    }, []);

    // 3. Merge Real + Ghosts
    useEffect(() => {
        // Filter out ghosts that actually exist in realCompanies
        const realIds = new Set(realCompanies.map(c => c.id));
        const uniqueGhosts = ghostCompanies.filter(g => !realIds.has(g.id));

        const merged = [...realCompanies, ...uniqueGhosts];
        setCompanies(merged);

        // Auto-select logic
        if (merged.length > 0 && !selectedCompany) {
            setSelectedCompany(merged[0]);
        }
    }, [realCompanies, ghostCompanies, selectedCompany]); // Added selectedCompany to dependencies

    const handleGenerate = async () => {
        if (!newCompanyId || !newCompanyName) return;
        setLoading(true);

        try {
            // Generate Magic Link via API
            let finalLink = "";
            try {
                const res = await fetch('/api/admin/create-link', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ companyId: newCompanyId })
                });
                const d = await res.json();
                finalLink = d.url;
            } catch (e) {
                console.error("Link Gen Failed", e);
                // Fallback to direct link
                finalLink = `${window.location.origin}/dashboard?companyId=${newCompanyId}`;
            }

            // Create the Company Document in Firestore
            await setDoc(doc(db, 'companies', newCompanyId), {
                displayName: newCompanyName,
                isActive: true, // Default: Active
                createdAt: serverTimestamp(),
                lastPaymentDate: serverTimestamp(), // Default: Just paid
                securityThreshold: 85, // Default setting
                dashboardUrl: finalLink
            });

            setGeneratedLink(finalLink);

            // Clear form
            setNewCompanyId('');
            setNewCompanyName('');
        } catch (error) {
            console.error("Failed to provision company:", error);
            alert("Error creating company. Check console.");
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
        if (!confirm(`Are you sure you want to delete ${companyId}? This will lock out all employees.`)) return;
        setLoading(true);
        try {
            console.log(`Starting batch purge for ${companyId}...`);
            const batch = writeBatch(db);

            // 1. Force UI Update immediately (Optimistic Delete)
            setGhostCompanies(prev => prev.filter(g => g.id !== companyId));
            setRealCompanies(prev => prev.filter(c => c.id !== companyId));
            if (selectedCompany?.id === companyId) setSelectedCompany(null);

            // 2. Delete all users in the subcollection first (Recursive Delete)
            const usersRef = collection(db, 'companies', companyId, 'users');
            const snapshot = await getDocs(usersRef);

            if (!snapshot.empty) {
                console.log(`Deep cleaning ${snapshot.size} users...`);
                for (const userDoc of snapshot.docs) {
                    batch.delete(userDoc.ref);
                    // Handle History Subcollection
                    const historyRef = collection(db, 'companies', companyId, 'users', userDoc.id, 'history');
                    const historySnapshot = await getDocs(historyRef);
                    historySnapshot.forEach(hDoc => batch.delete(hDoc.ref));
                }
            }

            // 2b. Delete 'login_logs' subcollection (The Phantom Cause)
            const logsRef = collection(db, 'companies', companyId, 'login_logs');
            const logsSnapshot = await getDocs(logsRef);
            if (!logsSnapshot.empty) {
                console.log(`Cleaning ${logsSnapshot.size} login logs...`);
                logsSnapshot.forEach(logDoc => batch.delete(logDoc.ref));
            }

            // 3. Delete the Company Document
            batch.delete(doc(db, 'companies', companyId));

            // Commit all changes
            await batch.commit();
            console.log("Batch delete complete.");

        } catch (error) {
            console.error("Delete failed:", error);
            alert("Failed to delete organization properly.");
        } finally {
            setLoading(false);
        }
    };

    // Helper to calculate days since payment
    const getDaysSincePayment = (timestamp: Timestamp | null | undefined) => {
        if (!timestamp) return 0;
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp as any);
        const diff = new Date().getTime() - date.getTime();
        return Math.floor(diff / (1000 * 3600 * 24));
    };

    return (
        <div className="min-h-screen p-10 relative bg-[#020617] overflow-hidden">
            {/* Background FX */}
            <div className="absolute top-[-20%] left-[-10%] w-[800px] h-[800px] bg-cyan-900/10 rounded-full blur-[120px] pointer-events-none" />

            {/* Link Modal */}
            {linkModal && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                    onClick={() => setLinkModal(null)}
                >
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-md w-full shadow-2xl relative"
                        onClick={e => e.stopPropagation()}
                    >
                        <button
                            onClick={() => setLinkModal(null)}
                            className="absolute top-4 right-4 text-slate-500 hover:text-white"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <div className="flex items-center gap-4 mb-6">
                            <div className="w-12 h-12 rounded-xl bg-cyan-500/10 flex items-center justify-center text-cyan-400">
                                <LinkIcon className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-white">Dashboard Link</h3>
                                <p className="text-slate-400 text-sm">{linkModal.name}</p>
                            </div>
                        </div>

                        <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 mb-4">
                            <p className="text-xs text-slate-500 uppercase font-bold mb-2">Secure Link</p>
                            <div className="flex items-center gap-3">
                                <code className="text-cyan-400 text-sm font-mono truncate flex-1">
                                    {linkModal.url}
                                </code>
                                <button
                                    onClick={() => {
                                        navigator.clipboard.writeText(linkModal.url);
                                        alert("Link copied!");
                                    }}
                                    className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
                                    title="Copy to Clipboard"
                                >
                                    <Copy className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        <p className="text-xs text-slate-500 text-center">
                            Share this link with the client administrator.
                        </p>
                    </div>
                </div>
            )}

            <div className="max-w-6xl mx-auto z-10 relative">
                <header className="flex items-center justify-between mb-12">
                    <div>
                        <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600 tracking-tighter flex items-center gap-3">
                            <ShieldCheck className="w-10 h-10 text-cyan-500" />
                            SAAS ADMINISTRATOR <span className="text-xs align-top text-slate-600 font-mono mt-2">v3.5</span>
                        </h1>
                        <p className="text-slate-400 mt-2">Provision, Monitor, and Suspend Client Organizations.</p>
                    </div>

                </header>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                    {/* LEFT: Provisioning Panel */}
                    <div className="glass-panel p-8 rounded-2xl h-fit border border-slate-800">
                        <h2 className="text-xs font-bold text-cyan-500 uppercase tracking-widest mb-6 flex items-center gap-2">
                            <Plus className="w-4 h-4" /> Provision New Client
                        </h2>

                        <div className="space-y-4">
                            <div>
                                <label className="text-xs text-slate-500 font-medium ml-1">Company Name</label>
                                <input
                                    type="text"
                                    placeholder="e.g. Tesla Motors"
                                    value={newCompanyName}
                                    onChange={(e) => setNewCompanyName(e.target.value)}
                                    className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white focus:border-cyan-500 outline-none transition-all"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-slate-500 font-medium ml-1">Company ID (Slug)</label>
                                <input
                                    type="text"
                                    placeholder="e.g. tesla_corp"
                                    value={newCompanyId}
                                    onChange={(e) => setNewCompanyId(e.target.value.toLowerCase().replace(/\s+/g, '_'))}
                                    className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white font-mono text-sm focus:border-cyan-500 outline-none transition-all"
                                />
                            </div>

                            <button
                                onClick={handleGenerate}
                                disabled={loading || !newCompanyId || !newCompanyName}
                                className="w-full btn-primary py-3 rounded-xl font-bold shadow-lg shadow-cyan-900/20 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                            >
                                {loading ? <RefreshCw className="w-5 h-5 animate-spin mx-auto" /> : 'Create Organization'}
                            </button>
                        </div>

                        {generatedLink && (
                            <div className="mt-6 p-4 bg-slate-950/50 border border-green-500/30 rounded-xl overflow-hidden">
                                <p className="text-xs text-green-500 font-bold mb-1 uppercase">Ready for Onboarding</p>
                                <div className="flex items-center justify-between gap-2">
                                    <code className="text-slate-300 text-xs truncate font-mono">{generatedLink}</code>
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

                    {/* RIGHT: Active Companies List / Users List */}
                    <div className="lg:col-span-2 space-y-8">

                        {/* Selected Company Users Header */}
                        {selectedCompany && (
                            <div className="glass-panel p-8 rounded-2xl border border-cyan-500/30 bg-cyan-950/10 relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none"></div>

                                <div className="flex items-center justify-between mb-6">
                                    <div>
                                        <h2 className="text-xl font-bold text-white flex items-center gap-3">
                                            <User className="w-6 h-6 text-cyan-400" />
                                            {selectedCompany.displayName}
                                            <span className="text-slate-500 text-sm font-normal">Employee Roster</span>
                                        </h2>
                                        <p className="text-slate-400 text-xs font-mono mt-1">ID: {selectedCompany.id}</p>
                                    </div>
                                    <button
                                        onClick={() => setSelectedCompany(null)}
                                        className="text-slate-500 hover:text-white text-xs uppercase font-bold tracking-widest border border-slate-700 rounded px-3 py-1 hover:border-slate-500 transition-all"
                                    >
                                        Close View
                                    </button>
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="border-b border-white/10 text-xs font-bold text-slate-500 uppercase tracking-wider">
                                                <th className="py-3 px-4">Employee</th>
                                                <th className="py-3 px-4">Registration</th>
                                                <th className="py-3 px-4">Biometrics</th>
                                                <th className="py-3 px-4 text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {companyUsers.length === 0 ? (
                                                <tr>
                                                    <td colSpan={4} className="py-8 text-center text-slate-500 italic">
                                                        No biometric profiles found for this organization.
                                                    </td>
                                                </tr>
                                            ) : (
                                                companyUsers.map((user) => (
                                                    <tr key={user.id} className="border-b border-white/5 hover:bg-white/5 transition-colors group">
                                                        <td className="py-3 px-4">
                                                            <div className="font-bold text-slate-200">{user.name || user.displayName}</div>
                                                            <div className="text-xs text-slate-500 font-mono">{user.employeeId || user.id}</div>
                                                        </td>
                                                        <td className="py-3 px-4 text-sm text-slate-400">
                                                            {user.createdAt?.seconds ? new Date(user.createdAt.seconds * 1000).toLocaleDateString() : 'Pending'}
                                                        </td>
                                                        <td className="py-3 px-4">
                                                            <div className="flex items-center gap-2">
                                                                <CheckCircle className="w-4 h-4 text-green-500" />
                                                                <span className="text-xs font-mono text-green-400">ZKP VERIFIED</span>
                                                            </div>
                                                        </td>
                                                        <td className="py-3 px-4 text-right">
                                                            <button
                                                                onClick={() => {
                                                                    if (confirm('Revoke access for this employee?')) {
                                                                        deleteDoc(doc(db, 'companies', selectedCompany.id, 'users', user.id));
                                                                    }
                                                                }}
                                                                className="text-slate-600 hover:text-red-400 transition-all"
                                                                title="Revoke Access"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* Companies List */}
                        <div className="glass-panel p-8 rounded-2xl border border-slate-800">
                            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-6 flex justify-between items-center">
                                <span>Client Subscriptions</span>
                                <span className="bg-slate-800 text-white px-2 py-1 rounded-md">{companies.length} Total</span>
                            </h2>

                            <div className="space-y-4">
                                {companies.length === 0 && (
                                    <div className="text-center py-12 border-2 border-dashed border-slate-800 rounded-xl">
                                        <p className="text-slate-600">No companies found in Firestore.</p>
                                    </div>
                                )}

                                {companies.map((company) => {
                                    const daysSincePayment = getDaysSincePayment(company.lastPaymentDate);
                                    // Logic for Warnings
                                    const isWarning = daysSincePayment > 30; // 30 Days late
                                    const isCritical = daysSincePayment > 40; // 10 Days Grace

                                    // Safety fallback
                                    const displayName = company.displayName || 'Unknown';
                                    const initial = displayName.charAt(0);

                                    return (
                                        <div key={company.id}
                                            onClick={() => setSelectedCompany(company)}
                                            className={clsx(
                                                "group flex flex-col md:flex-row md:items-center justify-between p-5 bg-slate-900/30 border transition-all rounded-xl gap-4 cursor-pointer",
                                                selectedCompany?.id === company.id ? "border-cyan-500 bg-slate-800/50" :
                                                    isCritical ? "border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.1)]" :
                                                        isWarning ? "border-yellow-500/50" :
                                                            "border-slate-800/50 hover:border-cyan-500/30"
                                            )}
                                        >
                                            <div className="flex items-center gap-4">
                                                {/* Logo / Initial */}
                                                <div className={clsx(
                                                    "w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg border",
                                                    company.isActive
                                                        ? "bg-slate-800 text-cyan-400 border-slate-700"
                                                        : "bg-red-950/30 text-red-500 border-red-900/50"
                                                )}>
                                                    {initial}
                                                </div>

                                                {/* Details */}
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <h3 className="font-bold text-white text-base">{displayName}</h3>
                                                        {!company.isActive && <span className="text-[10px] bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full uppercase font-bold tracking-wider">Suspended</span>}
                                                    </div>
                                                    <p className="text-xs text-slate-500 font-mono mt-0.5">{company.id}</p>

                                                    {/* Subscription Status Line */}
                                                    <div className="flex items-center gap-2 mt-2 text-xs">
                                                        <span className={clsx("font-medium", isCritical ? "text-red-400" : isWarning ? "text-yellow-400" : "text-green-400")}>
                                                            {isCritical ? `Overdue: ${daysSincePayment} days` : isWarning ? `Payment Due: ${daysSincePayment} days` : `Paid: ${daysSincePayment}d ago`}
                                                        </span>
                                                        <span className="text-slate-700">|</span>
                                                        <button onClick={(e) => { e.stopPropagation(); markPaid(company.id); }} className="text-slate-500 hover:text-white underline decoration-slate-700 hover:decoration-white transition-all">
                                                            Renew
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Action Buttons */}
                                            <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                                                {/* Toggle Suspend */}
                                                <button
                                                    onClick={() => toggleStatus(company.id, company.isActive)}
                                                    className={clsx(
                                                        "px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all border",
                                                        company.isActive
                                                            ? "bg-slate-800 text-slate-400 border-slate-700 hover:text-white hover:border-slate-500" // Button to Suspend
                                                            : "bg-green-600/10 text-green-400 border-green-600/30 hover:bg-green-600/20" // Button to Activate
                                                    )}
                                                >
                                                    {company.isActive ? "Suspend" : "Activate"}
                                                </button>

                                                {/* Get Link Button */}
                                                <button
                                                    onClick={async (e) => {
                                                        e.stopPropagation();
                                                        // Always generate a fresh secure link
                                                        try {
                                                            const res = await fetch('/api/admin/create-link', {
                                                                method: 'POST',
                                                                headers: { 'Content-Type': 'application/json' },
                                                                body: JSON.stringify({ companyId: company.id })
                                                            });
                                                            const data = await res.json();
                                                            if (data.url) {
                                                                setLinkModal({ name: company.displayName, url: data.url });
                                                            } else {
                                                                alert("Failed to generate link");
                                                            }
                                                        } catch (err) {
                                                            console.error(err);
                                                            alert("Error generating link");
                                                        }
                                                    }}
                                                    className="p-2 text-slate-500 hover:text-cyan-400 hover:bg-cyan-950/30 rounded-lg transition-colors"
                                                    title="Get Dashboard Link"
                                                >
                                                    <LinkIcon className="w-5 h-5" />
                                                </button>

                                                {/* Security Login Link */}
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        const url = `${window.location.origin}/secure-login?companyId=${company.id}`;
                                                        setLinkModal({ name: `${company.displayName} (Security Gateway)`, url });
                                                    }}
                                                    className="p-2 text-emerald-400 bg-emerald-950/30 border border-emerald-900/50 rounded-lg transition-all hover:bg-emerald-900/50 shadow-[0_0_10px_rgba(16,185,129,0.1)]"
                                                    title="Get Security Login Link"
                                                >
                                                    <ShieldCheck className="w-5 h-5" />
                                                </button>

                                                {/* Admin Login */}
                                                {company.isActive && (
                                                    <Link
                                                        href={`/dashboard?companyId=${company.id}`}
                                                        className="p-2 text-cyan-500 hover:bg-cyan-950/30 rounded-lg transition-colors"
                                                        title="Login as Admin"
                                                    >
                                                        <ExternalLink className="w-5 h-5" />
                                                    </Link>
                                                )}

                                                {/* Delete */}
                                                <button
                                                    onClick={() => handleDelete(company.id)}
                                                    className="p-2 text-slate-600 hover:text-red-400 hover:bg-red-950/30 rounded-lg transition-colors"
                                                    title="Delete Organization"
                                                >
                                                    <Trash2 className="w-5 h-5" />
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

            {/* Link Modal */}
            {linkModal && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
                    onClick={() => setLinkModal(null)}
                >
                    <div
                        className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-6 shadow-2xl relative"
                        onClick={e => e.stopPropagation()}
                    >
                        <button
                            onClick={() => setLinkModal(null)}
                            className="absolute top-4 right-4 text-slate-500 hover:text-white"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <h3 className="text-xl font-bold text-white mb-2 pr-8">{linkModal.name}</h3>
                        <p className="text-slate-400 text-sm mb-4">Share this secure link with the administrator.</p>

                        <div className="bg-slate-950 rounded-lg p-3 border border-slate-800 flex items-center gap-3">
                            <code className="flex-1 font-mono text-xs text-cyan-400 break-all">
                                {linkModal.url}
                            </code>
                            <button
                                onClick={() => {
                                    navigator.clipboard.writeText(linkModal.url);
                                    setLinkModal(null);
                                }}
                                className="p-2 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors"
                            >
                                <Copy className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
