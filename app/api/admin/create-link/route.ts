import { NextResponse } from 'next/server';
import { createSession, decrypt } from '@/lib/auth-cookie';
import { cookies } from 'next/headers';

export async function POST(req: Request) {
    try {
        // --- SECURITY CHECK: REQUIRE ADMIN SESSION ---
        const sessionToken = (await cookies()).get('auth_token')?.value;
        if (!sessionToken) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        try {
            // Verify token signature & expiration
            const payload = await decrypt(sessionToken);
            if (payload.role !== 'admin') {
                return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
            }
        } catch (e) {
            return NextResponse.json({ error: "Invalid Session" }, { status: 403 });
        }
        // ---------------------------------------------

        const body = await req.json();
        const { companyId } = body;

        if (!companyId) {
            return NextResponse.json({ error: "Missing companyId" }, { status: 400 });
        }

        // Create a shorter-lived token specifically for this link?
        // Reuse createSession but maybe add a specific 'type' claim if we want to distinguish later.
        // For now, a standard session token is fine, as it will be exchanged for a cookie.
        // We might want to set a shorter expiration if it's just a link, but 24h is the default in createSession.

        const token = await createSession({
            companyId,
            role: 'admin-link',
            type: 'magic-link',
            isTemporary: true,
            biometricVerified: true // Magic links grant immediate access
        });

        // Construct the access URL
        const origin = new URL(req.url).origin;
        const accessUrl = `${origin}/api/auth/access?token=${token}`;

        return NextResponse.json({ url: accessUrl });

    } catch (error) {
        console.error("Link Gen Error:", error);
        return NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}
