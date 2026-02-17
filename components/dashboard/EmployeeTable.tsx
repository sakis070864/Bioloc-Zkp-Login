"use client";

import React from "react";
import { createPortal } from "react-dom";

import { motion } from "framer-motion";
import { User, Smartphone, AlertTriangle, CheckCircle, Clock, Trash2, ShieldCheck, Copy } from "lucide-react";
import { clsx } from "clsx";
import { doc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

// Types matching Firestore
export interface Employee {
    id: string; // Document ID
    userId: string;
    displayName?: string;
    riskScore: number;
    lastProofStatus: "LOCKED" | "PENDING" | "REJECTED";
    lastProofTimestamp: { seconds: number; nanoseconds: number } | Date | null; // Firestore Timestamp
    isOnline: boolean;
}

interface EmployeeTableProps {
    employees: Employee[];
    companyId: string;
}

function formatActivity(timestamp: any) {
    if (!timestamp) return "Never";
    try {
        let date: Date;

        // Handle Firestore Timestamp (has .toDate())
        if (typeof timestamp.toDate === 'function') {
            date = timestamp.toDate();
        }
        // Handle Firestore-like object { seconds, nanoseconds }
        else if (timestamp.seconds) {
            date = new Date(timestamp.seconds * 1000);
        }
        // Handle ISO String or Number
        else {
            date = new Date(timestamp);
        }

        if (isNaN(date.getTime())) return "Invalid Date";

        return date.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: 'numeric',
            hour12: true
        });
    } catch (e) {
        return "Error";
    }
}

export default function EmployeeTable({ employees, companyId }: EmployeeTableProps) {
    if (employees.length === 0) {
        return (
            <div className="text-center py-20 text-slate-500">
                No active employees found. Connect a device to start tracking.
            </div>
        );
    }

    return (
        <div className="glass-panel rounded-2xl overflow-hidden border border-slate-700/50">
            <div className="p-6 border-b border-slate-700/50 flex items-center justify-between">
                <h3 className="font-bold text-white text-lg">Live Personnel Monitor</h3>
                <span className="text-xs bg-cyan-500/10 text-cyan-400 px-3 py-1 rounded-full border border-cyan-500/20 animate-pulse">
                    ● Live Feed
                </span>
            </div>

            <table className="w-full text-left">
                <thead className="bg-slate-900/50 text-slate-400 text-xs uppercase tracking-wider font-medium">
                    <tr>
                        <th className="p-4 pl-6">Employee</th>
                        <th className="p-4">Device</th>
                        <th className="p-4">Proof Status</th>
                        <th className="p-4">Risk Score</th>
                        <th className="p-4 text-right pr-6">Activity</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                    {employees.map((emp) => (
                        <motion.tr
                            key={emp.id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="hover:bg-slate-800/30 transition-colors group"
                        >
                            <td className="p-4 pl-6">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700">
                                        <User className="w-5 h-5 text-slate-400" />
                                    </div>
                                    <div>
                                        <div className="text-white font-medium">{emp.displayName || emp.userId || "Unknown"}</div>
                                        <div className="text-xs text-slate-500 uppercase">{emp.userId || ""}</div>
                                    </div>
                                </div>
                            </td>
                            <td className="p-4">
                                <div className="flex items-center gap-2 text-slate-400 text-sm">
                                    <Smartphone className="w-4 h-4" />
                                    <span>Chrome / Win10</span>
                                </div>
                            </td>
                            <td className="p-4">
                                <StatusBadge status={emp.lastProofStatus} />
                            </td>
                            <td className="p-4">
                                <div className="flex items-center gap-2">
                                    <div className="flex-1 w-24 h-2 bg-slate-800 rounded-full overflow-hidden">
                                        <div
                                            className={clsx(
                                                "h-full rounded-full",
                                                emp.riskScore > 90 ? "bg-cyan-500" : emp.riskScore > 70 ? "bg-yellow-500" : "bg-red-500"
                                            )}
                                            style={{ width: `${emp.riskScore}%` }}
                                        />
                                    </div>
                                    <span className={clsx(
                                        "text-sm font-bold font-mono",
                                        emp.riskScore > 90 ? "text-cyan-400" : emp.riskScore > 70 ? "text-yellow-400" : "text-red-400"
                                    )}>
                                        {emp.riskScore}%
                                    </span>
                                </div>
                            </td>
                            <td className="p-4 text-right pr-6 text-sm text-slate-500">
                                <div className="flex items-center justify-end gap-3">
                                    <span className="font-mono text-xs text-slate-400">
                                        {formatActivity(emp.lastProofTimestamp)}
                                    </span>
                                    {companyId && (
                                        <>
                                            <SimulateButton
                                                companyId={companyId}
                                                employeeId={emp.id}
                                            />
                                            <DeleteEmployeeButton
                                                companyId={companyId}
                                                employeeId={emp.id}
                                                employeeName={emp.displayName || emp.userId}
                                            />
                                        </>
                                    )}
                                </div>
                            </td>
                        </motion.tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function DeleteEmployeeButton({ companyId, employeeId, employeeName }: { companyId: string, employeeId: string, employeeName: string }) {
    const handleDelete = async () => {
        if (!confirm(`Revoke access for ${employeeName}? This will delete their biometric profile.`)) return;

        try {
            console.log(`Attempting to delete user: ${employeeId} from company: ${companyId}`);
            const { collection, getDocs, deleteDoc, doc } = await import("firebase/firestore");

            // 1. Recursive Delete: Clean up "history" subcollection
            const historyRef = collection(db, "companies", companyId, "users", employeeId, "history");
            const snapshot = await getDocs(historyRef);

            if (!snapshot.empty) {
                console.log(`Deleting ${snapshot.size} history records...`);
                const deletePromises = snapshot.docs.map(d => deleteDoc(d.ref));
                await Promise.all(deletePromises);
            }

            // 2. Delete the User Document
            await deleteDoc(doc(db, "companies", companyId, "users", employeeId));
            console.log("User deleted successfully.");

        } catch (error) {
            console.error("Failed to delete employee:", error);
            alert("Error deleting employee. Check console for details.");
        }
    };

    return (
        <button
            onClick={handleDelete}
            className="text-slate-600 hover:text-red-400 transition-all p-2 hover:bg-red-950/30 rounded-lg"
            title="Revoke Access"
        >
            <Trash2 className="w-4 h-4" />
        </button>
    );
}



function SimulateButton({ companyId, employeeId }: { companyId: string, employeeId: string }) {
    const [showModal, setShowModal] = React.useState(false);
    const link = typeof window !== 'undefined'
        ? `${window.location.origin}/secure-login?companyId=${companyId}&userId=${employeeId}`
        : '';

    const handleCopy = () => {
        navigator.clipboard.writeText(link);
        alert("Link Copied! Open it in an Incognito window to simulate a real user.");
        setShowModal(false);
    };

    const [mounted, setMounted] = React.useState(false);
    React.useEffect(() => setMounted(true), []);

    return (
        <>
            <button
                onClick={() => setShowModal(true)}
                className="text-slate-600 hover:text-blue-400 transition-all p-2 hover:bg-blue-950/30 rounded-lg"
                title="Simulate Secure Login"
            >
                <ShieldCheck className="w-4 h-4" />
            </button>

            {showModal && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="relative bg-slate-900 border border-slate-700 rounded-xl p-6 max-w-md w-full shadow-2xl">
                        <button
                            onClick={() => setShowModal(false)}
                            className="absolute top-4 right-4 z-50 text-slate-400 hover:text-white transition-colors p-1"
                        >
                            ✕
                        </button>

                        <div className="flex flex-col items-center mb-6">
                            <div className="w-12 h-12 bg-blue-900/30 rounded-full flex items-center justify-center mb-4 border border-blue-500/30">
                                <ShieldCheck className="w-6 h-6 text-blue-400" />
                            </div>
                            <h3 className="text-xl font-bold text-white">Simulate Client Login</h3>
                            <p className="text-slate-400 text-sm text-center mt-2">
                                Test the Biometric Guard as if you were this employee.
                            </p>
                        </div>

                        <div className="bg-black/50 p-4 rounded-lg border border-slate-800 mb-6 font-mono text-xs text-slate-300 break-all">
                            {link}
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={handleCopy}
                                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-colors"
                            >
                                <Copy className="w-4 h-4" /> Copy Link
                            </button>
                            <button
                                onClick={() => window.open(link, '_blank')}
                                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-3 rounded-lg transition-colors border border-slate-700"
                            >
                                Open Now
                            </button>
                        </div>

                        <div className="mt-4 flex items-start gap-2 text-[10px] text-yellow-500/80 bg-yellow-900/10 p-2 rounded">
                            <AlertTriangle size={12} className="mt-0.5" />
                            <span>Warning: Opening directly will allow the demo to close this tab on failure. Copying to Incognito is recommended for realism.</span>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </>
    );
}

function StatusBadge({ status }: { status: string }) {
    switch (status) {
        case "LOCKED":
            return (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-green-500/10 text-green-400 border border-green-500/20">
                    <CheckCircle className="w-3 h-3" /> VERIFIED
                </span>
            );
        case "PENDING":
            return (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
                    <Clock className="w-3 h-3" /> ANALYZING
                </span>
            );
        case "REJECTED":
            return (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-500/10 text-red-400 border border-red-500/20">
                    <AlertTriangle className="w-3 h-3" /> REJECTED
                </span>
            );
        default:
            return <span className="text-slate-500">-</span>;
    }
}
