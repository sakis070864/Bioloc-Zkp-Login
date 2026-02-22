"use client";

import React, { useEffect, useState } from 'react';

export default function TestGatewayClientApp() {
    const [status, setStatus] = useState<string>("Doors Locked. 🔒 Waiting for Biometric Token...");
    const [tokenReceipt, setTokenReceipt] = useState<any>(null);

    // 1. The React Function simulating the Customer's Login Button
    const handleZkpLogin = () => {
        // The ID of the customer
        const COMPANY_ID = "johan_corp";

        // The exact URL where the user wants to go when finished
        const DESIRED_DESTINATION = "https://oikoinvest.com";

        // Build the URL to our ZKP Gateway (using localhost since we are testing)
        const zkpUrl = `http://localhost:3000/?companyId=${COMPANY_ID}&redirectUrl=${encodeURIComponent(DESIRED_DESTINATION)}`;

        setStatus("Redirecting you to the ZKP Gateway... ⏳");

        // STANDARD OAUTH REDIRECT (Like Google Login or Auth0)
        // This safely redirects the entire browser tab, avoiding pesky popup blockers entirely!
        window.location.href = zkpUrl;
    };

    // 2. The Listener to catch the redirected Token when the user comes back
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            const token = params.get('zkp_token');

            if (token) {
                setStatus("Doors Unlocked! 🔓");
                try {
                    // Decode the JWT purely for visual proof on the frontend.
                    const base64Url = token.split('.')[1];
                    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
                    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function (c) {
                        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
                    }).join(''));
                    setTokenReceipt(JSON.parse(jsonPayload));
                } catch (e) {
                    setTokenReceipt({ error: "Could not decode Token visually", rawToken: token });
                }
            }
        }
    }, []);

    return (
        <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-8 font-sans">
            <div className="bg-slate-800 p-8 rounded-xl border border-slate-700 max-w-lg w-full text-center shadow-2xl">
                <h1 className="text-2xl font-bold text-sky-400 mb-4">Sakis Corp Portal (Test App)</h1>
                <p className="text-slate-400 mb-8">This is a simulated external client application testing the React JSON snippet gateway.</p>

                <div className={`mb-8 p-6 rounded-lg text-sm border-2 transition-colors duration-500 ${tokenReceipt ? 'border-emerald-500 bg-emerald-900/20 text-emerald-300' : 'border-slate-600 bg-slate-900 text-slate-400'}`}>
                    <p className="font-semibold text-lg mb-2">{status}</p>

                    {tokenReceipt && (
                        <div className="mt-4 text-left bg-black/30 p-4 rounded overflow-hidden">
                            <p className="text-xs text-emerald-500 mb-2 uppercase tracking-wide">Payload Received:</p>
                            <pre className="text-xs text-white">{JSON.stringify(tokenReceipt, null, 2)}</pre>
                        </div>
                    )}
                </div>

                {!tokenReceipt && (
                    <button
                        onClick={handleZkpLogin}
                        className="w-full py-4 bg-sky-500 hover:bg-sky-600 text-white font-bold rounded-lg transition-colors text-lg"
                    >
                        Login with Bio-ZKP
                    </button>
                )}

                {tokenReceipt && (
                    <button
                        onClick={() => window.location.href = '/test-gateway'}
                        className="w-full py-3 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-lg transition-colors"
                    >
                        Reset Test
                    </button>
                )}
            </div>
        </div>
    );
}
