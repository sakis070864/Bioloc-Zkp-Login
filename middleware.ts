import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { decrypt } from '@/lib/auth-cookie';

export async function middleware(request: NextRequest) {
    const path = request.nextUrl.pathname;
    const adminRoute = (process.env.ADMIN_ROUTE || 'nexus-control').replace(/^\//, '');
    const legacyRoute = process.env.LEGACY_ADMIN_KEY || 'DISABLED_ROUTE';

    // 1. Handle Secret Route Rewriting & Masking
    if (path === '/admin') {
        // Mask direct access to /admin with a 404
        return NextResponse.rewrite(new URL('/404', request.url));
    }

    let effectivePath = path;
    let isSecretRoute = false;

    // Check if path matches either the configured secret route or the legacy route
    if (path.startsWith(`/${adminRoute}`)) {
        isSecretRoute = true;
        effectivePath = path.replace(`/${adminRoute}`, '/nexus-control');
    } else if (legacyRoute !== 'DISABLED_ROUTE' && path.startsWith(`/${legacyRoute}`)) {
        isSecretRoute = true;
        effectivePath = path.replace(`/${legacyRoute}`, '/nexus-control');
    }

    const response = isSecretRoute
        ? NextResponse.rewrite(new URL(effectivePath, request.url))
        : NextResponse.next();

    // Skip security headers for internal Next.js requests
    if (
        path.startsWith('/_next') ||
        request.headers.get('x-nextjs-data') ||
        request.headers.get('rsc')
    ) {
        return response;
    }

    // --- 2. SECURITY HEADERS ---
    if (process.env.NODE_ENV === 'production') {
        response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
        response.headers.set('X-Frame-Options', 'DENY');
        response.headers.set('X-Content-Type-Options', 'nosniff');
        response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
        response.headers.set(
            'Content-Security-Policy',
            "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: https://*.google.com https://*.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://*.cloudfunctions.net;"
        );
    }

    // --- 3. PROTECTION LOGIC ---
    // Protect standard /admin and /dashboard routes
    // We EXCLUDE isSecretRoute from the forced /login redirect because it handles its own stealth auth
    if (!isSecretRoute && (effectivePath.startsWith('/admin') || effectivePath.startsWith('/dashboard'))) {
        const token = request.cookies.get('auth_token')?.value;
        if (!token) {
            return NextResponse.redirect(new URL('/login', request.url));
        }

        try {
            const payload = await decrypt(token);

            // STRICT: Ensure Biometric Verification occurred
            if (!payload.biometricVerified) {
                console.warn("Middleware: Access attempt with unverified biometrics.");
                return NextResponse.redirect(new URL('/login', request.url));
            }

            // Check for admin role
            if (effectivePath.startsWith('/admin') && payload.role !== 'admin') {
                return NextResponse.redirect(new URL('/access-denied', request.url));
            }
        } catch (err) {
            return NextResponse.redirect(new URL('/login', request.url));
        }
    }

    return response;
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for static assets
         */
        '/((?!_next/static|_next/image|favicon.ico).*)',
    ],
};
