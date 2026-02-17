import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

/**
 * OAuth 2.0 User Info Endpoint
 * 
 * Returns user information from a valid access token
 * 
 * Request:
 * GET /oauth/userinfo
 * Authorization: Bearer eyJhbGc...
 * 
 * Response:
 * {
 *   "sub": "user_id|company_id",
 *   "email": "user@company.com",
 *   "name": "John Doe",
 *   "biometric_verified": true,
 *   "biometric_score": 98
 * }
 */
export async function GET(req: Request) {
    try {
        // Extract authorization header
        const authHeader = req.headers.get('authorization');
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json(
                { error: 'invalid_token' },
                { status: 401 }
            );
        }

        const token = authHeader.substring('Bearer '.length);

        // TODO: Verify and decode token
        // TODO: Return user info from decoded token

        return NextResponse.json({
            sub: 'user_id|company_id',
            email: 'user@company.com',
            name: 'John Doe',
            biometric_verified: true,
            biometric_score: 98
        });

    } catch (error) {
        console.error('OAuth UserInfo Error:', error);
        return NextResponse.json(
            { error: 'invalid_token' },
            { status: 401 }
        );
    }
}
