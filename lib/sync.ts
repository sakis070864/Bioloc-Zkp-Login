import { db } from "./firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

interface SyncProofParams {
    userId: string;
    companyId: string;
    displayName: string;
    riskScore: number;
    status: "LOCKED" | "PENDING" | "REJECTED";
    zkProof?: {
        commitment: string;
        proof: any;
    };
    biometricProfile?: any; // Added for Guard Window persistence
    phrase?: string; // The "Password" text used for training
}

export const syncProofToFirebase = async ({ userId, companyId, displayName, riskScore, status, zkProof, biometricProfile, phrase }: SyncProofParams) => {
    try {
        console.log("Syncing proof to Firebase via Server API...", { userId, companyId, status });

        const res = await fetch('/api/auth/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId,
                companyId,
                displayName,
                riskScore,
                status,
                biometricProfile
            })
        });

        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || "Failed to sync to server");
        }

        console.log("Proof synced successfully via Server!");
    } catch (error) {
        console.error("Failed to sync proof to Firebase:", error);
    }
};
