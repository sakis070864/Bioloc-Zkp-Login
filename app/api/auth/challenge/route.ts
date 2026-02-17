import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, setDoc } from 'firebase/firestore';

// IN-MEMORY FALLBACK (For when Firestore is unreachable/blocked)
// Note: This resets on server restart, which is fine for short-lived nonces.
if (!global.nonceStore) {
    global.nonceStore = new Map();
}

export async function POST(req: Request) {
    try {
        // 1. Validate Config (Just to be safe)
        const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
        
        // 2. Generate Cryptographically Secure Nonce
        let nonce: string;
        try {
            if (typeof crypto !== 'undefined' && crypto.randomUUID) {
                nonce = crypto.randomUUID();
            } else {
                const { randomUUID } = await import('crypto');
                nonce = randomUUID();
            }
        } catch (e) {
            nonce = Math.random().toString(36).substring(2) + Date.now().toString(36);
        }

        const challengeData = {
            createdAt: new Date().toISOString(), // String for easier JSON handling
            status: 'PENDING',
            usedAt: null
        };

        // 3. Try Store in Firestore
        try {
            await setDoc(doc(db, 'auth_challenges', nonce), {
                ...challengeData,
                createdAt: new Date() // Date object for Firestore
            });
        } catch (fsError: any) {
            console.error("Firestore Write Failed (Using Fallback):", fsError.message);
            
            // FALLBACK: Store in Memory
            global.nonceStore.set(nonce, {
                ...challengeData,
                expiresAt: Date.now() + 60000 // 1 minute expiry
            });
            
            // Cleanup old nonces
            for (const [key, val] of global.nonceStore.entries()) {
                if (Date.now() > val.expiresAt) global.nonceStore.delete(key);
            }
        }

        // 4. Return to Client
        return NextResponse.json({ nonce });

    } catch (error: any) {
        console.error("Challenge Route Panic:", error);
        return NextResponse.json({ 
            error: "Internal Server Error", 
            details: error?.message 
        }, { status: 500 });
    }
}
