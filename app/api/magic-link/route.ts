import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

// In a real app, this should be protected by admin authentication middleware
// or session check. For now, we assume the caller is authorized via ZKP/session context.

export async function POST(req: Request) {
    try {
        const { companyId, name, id } = await req.json();

        if (!companyId || !name || !id) {
            return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
        }

        // Generate a secure, random token
        const tokenArray = new Uint8Array(32);
        crypto.getRandomValues(tokenArray);
        const token = Array.from(tokenArray).map(b => b.toString(16).padStart(2, '0')).join('');

        // Expiration: 24 hours
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 24);

        // Store the magic link token in Firestore
        await addDoc(collection(db, "magic_links"), {
            token,
            companyId,
            name,
            employeeId: id,
            expiresAt,
            createdAt: serverTimestamp(),
            active: true
        });

        // Construct the Magic Link
        // Instead of embedding PII in URL, we embed the TOKEN.
        const origin = new URL(req.url).origin;
        const magicLink = `${origin}/login?token=${token}`;

        return NextResponse.json({ magicLink });

    } catch (error) {
        console.error("Magic Link Generation Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
