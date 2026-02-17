import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { sha256, generateSalt } from '@/lib/hash';

export async function POST(req: Request) {
    try {
        const { companyId, userId, name, password } = await req.json();

        if (!companyId || !userId || !password || !name) {
            return NextResponse.json({ error: "Missing registration data" }, { status: 400 });
        }

        const salt = generateSalt();
        const hash = await sha256(password, salt);

        const userRef = doc(db, 'companies', companyId, 'users', userId);
        
        await setDoc(userRef, {
            phraseHash: hash,
            salt: salt,
            phrase: null, // Ensure plaintext is never stored
            displayName: name,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        }, { merge: true });

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error("Registration Error:", error);
        return NextResponse.json({ error: "Failed to secure account" }, { status: 500 });
    }
}
