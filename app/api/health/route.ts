import { NextResponse } from 'next/server';

/**
 * Health Check Endpoint
 * 
 * Returns service health status
 * Used by Docker healthcheck and load balancers
 */
export async function GET() {
    return NextResponse.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'secure-login',
        version: '1.0.0',
        uptime: process.uptime()
    }, { status: 200 });
}
