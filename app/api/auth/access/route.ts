import { NextResponse } from 'next/server';
import { verifySession, setSessionCookie } from '@/lib/auth-cookie';

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get('token');

    if (!token) {
        return NextResponse.json({ error: "Missing token" }, { status: 400 });
    }

    const payload = await verifySession(token);

    if (!payload || !payload.companyId) {
        return NextResponse.json({ error: "Invalid or Expired Token" }, { status: 401 });
    }

    // Token is valid. Set it as the HTTP-only session cookie.
    await setSessionCookie(token);

    // Redirect to Dashboard with setup param
    const destination = new URL('/dashboard', req.url);
    destination.searchParams.set('setup_company_id', payload.companyId as string);

    return NextResponse.redirect(destination);
}
