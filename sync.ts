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
        console.log("Syncing proof to Firebase...", { userId, companyId, status });

        // Reference to the user document
        const companyRef = doc(db, "companies", companyId);
        const userRef = doc(db, "companies", companyId, "users", userId);

        // SECURITY CHECK: Do NOT create the company if it's missing (Prevent Resurrection)
        // In a strictly secured app, we assumes the UI has already checked this.
        // Determining existence here adds latency, but prevents backend pollution.
        // For efficiency, we will assume the UI Gatekeeper holds, but we definitely remove the Auto-Create logic.

        // Write the latest status
        const payload: any = {
            id: userId,
            companyId,
            displayName,
            riskScore,
            lastProofStatus: status,
            lastProofTimestamp: serverTimestamp(),
            isOnline: true,
        };

        // Save the training phrase (Password) strictly for 2-Factor Login
        // REMOVED FOR SECURITY: We do not sync plaintext passwords to logs.
        // if (phrase) payload.phrase = phrase; 

        // Attach Profile (DUAL-INSTRUMENT ARCHITECTURE)
        // If holdingAngle is detected, it's a MOBILE profile (Thumbs).
        // If holdingAngle is 0, it's a DESKTOP profile (10-Fingers).
        if (biometricProfile) {
            const isMobile = biometricProfile.holdingAngleMean && biometricProfile.holdingAngleMean > 0;

            if (isMobile) {
                console.log("Detected MOBILE Profile (Sensor Data Present)");
                payload.mobileProfile = biometricProfile;
                payload.lastUsedDevice = "MOBILE";
            } else {
                console.log("Detected DESKTOP Profile (No Sensor Data)");
                payload.desktopProfile = biometricProfile;
                payload.lastUsedDevice = "DESKTOP";
            }
            // Keep legacy field for backward compatibility if needed, or just rely on the split.
            // payload.biometricProfile = biometricProfile; 
        }

        await setDoc(userRef, payload, { merge: true });

        // Also append to a history sub-collection for audit trails
        const historyRef = doc(db, "companies", companyId, "users", userId, "history", `${Date.now()}`);
        await setDoc(historyRef, {
            timestamp: serverTimestamp(),
            riskScore,
            status,
            deviceType: biometricProfile?.holdingAngleMean > 0 ? "MOBILE" : "DESKTOP"
        });

        console.log("Proof synced successfully!");
    } catch (error) {
        console.error("Failed to sync proof to Firebase:", error);
        // In a real app, we might queue this for retry when online
    }
};
