import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, updateDoc, increment } from 'firebase/firestore';

const WINDOW_MS = 15 * 60 * 1000; // 15 Minutes
const MAX_ATTEMPTS = 5;

export async function POST(req: Request) {
    try {
        const ip = req.headers.get("x-forwarded-for") || "unknown-ip";
        // Sanitize IP for Firestore doc ID (replace . and : with _)
        const safeIp = ip.replace(/[\.:]/g, '_');

        const rateRef = doc(db, 'rate_limits', `admin_${safeIp}`);
        const rateSnap = await getDoc(rateRef);
        const now = Date.now();

        if (rateSnap.exists()) {
            const data = rateSnap.data();
            const lastStart = data.startTime || 0;

            if (now - lastStart > WINDOW_MS) {
                // Reset Window
                await setDoc(rateRef, { count: 1, startTime: now }, { merge: true });
            } else {
                if (data.count >= MAX_ATTEMPTS) {
                    return NextResponse.json(
                        { error: "Too many attempts. Locked out for 15 minutes." },
                        { status: 429 }
                    );
                }
                // Increment
                await updateDoc(rateRef, { count: increment(1) });
            }
        } else {
            // First attempt
            await setDoc(rateRef, { count: 1, startTime: now });
        }

        const body = await req.json();
        const { password } = body;

        // 2. Validate Password
        const VALID_PASSWORD = process.env.ADMIN_PASSWORD;

        console.log("--- ADMIN AUTH ATTEMPT ---");
        // REMOVED SAFE LOGS ONLY
        console.log("------------------------");

        if (!VALID_PASSWORD) {
            console.error("ADMIN_PASSWORD environment variable is not set");
            return NextResponse.json({ error: "Server Configuration Error" }, { status: 500 });
        }

        if (password === VALID_PASSWORD) {
            // SUCCESS: Issue Admin Session
            const { createSession, setSessionCookie } = await import('@/lib/auth-cookie');
            const token = await createSession({
                userId: 'nexus_admin',
                role: 'admin',
                name: 'System Admin',
                biometricVerified: true // Admin override
            });
            await setSessionCookie(token);

            return NextResponse.json({ success: true });
        } else {
            console.log("Auth Failed: Credentials mismatch");
            return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
        }
    } catch (error) {
        console.error("Auth Error:", error);
        return NextResponse.json({ error: "Server Error" }, { status: 500 });
    }
}
