import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, updateDoc, deleteField } from 'firebase/firestore';

export async function POST(req: Request) {
    try {
        const { companyId, userId } = await req.json();

        if (!companyId || !userId) {
            return NextResponse.json({ error: "Missing identity data" }, { status: 400 });
        }

        const userRef = doc(db, 'companies', companyId, 'users', userId);
        
        // Remove all possible profile fields
        await updateDoc(userRef, {
            biometricProfile: deleteField(),
            mobileProfile: deleteField(),
            desktopProfile: deleteField(),
            lastProofStatus: deleteField(),
            lastProofTimestamp: deleteField()
        });

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error("Reset Error:", error);
        return NextResponse.json({ error: "Failed to reset profile" }, { status: 500 });
    }
}
