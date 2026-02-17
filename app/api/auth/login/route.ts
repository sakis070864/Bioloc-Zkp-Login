import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';
import { sha256, generateSalt } from '@/lib/hash';
import { createSession } from '@/lib/auth-cookie';

export async function POST(req: Request) {
    try {
        const { companyId, userId, password, name } = await req.json();

        if (!companyId || !userId || !password) {
            return NextResponse.json({ error: "Missing credentials" }, { status: 400 });
        }

        const userRef = doc(db, 'companies', companyId, 'users', userId);
        const userSnap = await getDoc(userRef);

        let userData: any;
        let isValid = false;

        if (!userSnap.exists()) {
            if (name) {
                const salt = generateSalt();
                const hash = await sha256(password, salt);
                userData = {
                    displayName: name,
                    phraseHash: hash,
                    salt: salt,
                    role: 'user',
                    createdAt: new Date().toISOString()
                };
                await setDoc(userRef, userData);
                isValid = true;
            } else {
                return NextResponse.json({ error: "User not found. Provide name to enroll." }, { status: 401 });
            }
        } else {
            userData = userSnap.data();
            if (userData.phraseHash) {
                const salt = userData.salt || "";
                const inputHash = await sha256(password, salt);
                if (inputHash === userData.phraseHash) isValid = true;
            } else if (userData.phrase) {
                if (userData.phrase === password) {
                    isValid = true;
                    const newSalt = generateSalt();
                    const newHash = await sha256(password, newSalt);
                    await updateDoc(userRef, { phraseHash: newHash, salt: newSalt, phrase: null });
                }
            } else if (name && userData.displayName && userData.displayName.toLowerCase() === name.toLowerCase()) {
                isValid = true;
                const newSalt = generateSalt();
                const newHash = await sha256(password, newSalt);
                await updateDoc(userRef, { phraseHash: newHash, salt: newSalt, phrase: null });
            }
        }

        if (!isValid) {
            return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
        }

        const companySnap = await getDoc(doc(db, 'companies', companyId));
        const threshold = companySnap.exists() ? (companySnap.data().securityThreshold || 40) : 40;

        const sessionPayload = {
            companyId,
            userId,
            role: userData.role || 'user',
            name: userData.displayName || userId
        };

        const intentToken = await createSession({ ...sessionPayload, type: 'biometric-intent' });

        return NextResponse.json({
            success: true,
            intentToken,
            user: sessionPayload,
            threshold
        });

    } catch (error) {
        console.error("Login API Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
