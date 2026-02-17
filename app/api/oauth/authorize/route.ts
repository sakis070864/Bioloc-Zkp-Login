import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * OAuth 2.0 Authorization Endpoint
 * 
 * Handles the initial step of OAuth flow where customer's app redirects users here
 * 
 * Required Parameters:
 * - client_id: Customer's app ID (registered on dashboard)
 * - redirect_uri: Where to send user after auth (must match registered URI)
 * - response_type: Must be "code" (authorization code flow)
 * - state: Random value for CSRF protection (customer generates, must verify on callback)
 * - scope: What data to return (profile, email, biometric_verified)
 * - nonce: For replay attack prevention
 * 
 * @example
 * GET /oauth/authorize?client_id=cust_acme_001&redirect_uri=https://acme.com/callback&response_type=code&state=xyz&scope=profile
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        
        const client_id = searchParams.get('client_id');
        const redirect_uri = searchParams.get('redirect_uri');
        const response_type = searchParams.get('response_type');
        const state = searchParams.get('state');
        const scope = searchParams.get('scope');
        const nonce = searchParams.get('nonce');

        // Validate required parameters
        if (!client_id || !redirect_uri || !response_type || !state) {
            return NextResponse.json(
                { error: 'Missing required parameters' },
                { status: 400 }
            );
        }

        if (response_type !== 'code') {
            return NextResponse.json(
                { error: 'response_type must be "code"' },
                { status: 400 }
            );
        }

        // TODO: Validate client_id is registered on dashboard
        // TODO: Validate redirect_uri matches registered URI for this client
        
        // Store OAuth session data for later retrieval
        // In production, use secure session store or Redis
        const oauthState = {
            client_id,
            redirect_uri,
            state,
            scope: scope?.split(' ') || ['profile'],
            nonce,
            created_at: Date.now(),
            expires_at: Date.now() + (5 * 60 * 1000) // 5 minutes
        };

        // TODO: Store oauthState securely (Redis, session store, etc.)
        
        // Redirect to login page with OAuth session encoded
        const loginUrl = new URL('/login', request.url);
        loginUrl.searchParams.append('oauth_state', Buffer.from(JSON.stringify(oauthState)).toString('base64'));
        
        return NextResponse.redirect(loginUrl);

    } catch (error) {
        console.error('OAuth Authorize Error:', error);
        return NextResponse.json(
            { error: 'Authorization failed' },
            { status: 500 }
        );
    }
}
