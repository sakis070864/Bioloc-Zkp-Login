import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

export async function POST(req: Request) {
    try {
        const { userId, companyId, displayName, riskScore, status, biometricProfile } = await req.json();

        if (!userId || !companyId) {
            return NextResponse.json({ error: "Missing required sync data" }, { status: 400 });
        }

        const userRef = doc(db, 'companies', companyId, 'users', userId);
        
        const payload: any = {
            id: userId,
            companyId,
            displayName,
            riskScore: riskScore || 0,
            lastProofStatus: status || 'PENDING',
            lastProofTimestamp: serverTimestamp(),
            isOnline: true,
        };

        if (biometricProfile) {
            const isMobile = biometricProfile.holdingAngleMean && biometricProfile.holdingAngleMean > 0;

            if (isMobile) {
                payload.mobileProfile = biometricProfile;
                payload.lastUsedDevice = "MOBILE";
            } else {
                payload.desktopProfile = biometricProfile;
                payload.lastUsedDevice = "DESKTOP";
            }
            // For backward compatibility
            payload.biometricProfile = biometricProfile;
        }

        await setDoc(userRef, payload, { merge: true });

        // Audit Log
        const historyRef = doc(db, 'companies', companyId, 'users', userId, 'history', `${Date.now()}`);
        await setDoc(historyRef, {
            timestamp: serverTimestamp(),
            riskScore: riskScore || 0,
            status: status || 'PENDING',
            deviceType: biometricProfile?.holdingAngleMean > 0 ? "MOBILE" : "DESKTOP"
        });

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error("Server Sync Error:", error);
        return NextResponse.json({ error: "Failed to sync data to server" }, { status: 500 });
    }
}
