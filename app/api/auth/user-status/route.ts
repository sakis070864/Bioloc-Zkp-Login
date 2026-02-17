import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

export async function POST(req: Request) {
    try {
        const { companyId, userId, name } = await req.json();

        if (!companyId || !userId) {
            return NextResponse.json({ error: "Missing identity parameters" }, { status: 400 });
        }

        const userRef = doc(db, 'companies', companyId, 'users', userId);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
            // New user registration flow
            return NextResponse.json({ 
                exists: false, 
                requiresPassword: true 
            });
        }

        const userData = userSnap.data();

        // Check if name matches (if name was provided)
        if (name && userData.displayName && userData.displayName.toLowerCase() !== name.toLowerCase()) {
            return NextResponse.json({ error: "User details do not match" }, { status: 403 });
        }

        return NextResponse.json({
            exists: true,
            requiresPassword: !userData.phraseHash && !userData.phrase,
            hasHash: !!userData.phraseHash,
            displayName: userData.displayName
        });

    } catch (error) {
        console.error("User Status Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
