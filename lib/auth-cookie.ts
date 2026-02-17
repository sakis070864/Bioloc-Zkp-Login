import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

// --- SECURITY HARDENING ---
// Removed hardcoded fallback. The app MUST fail if no secret is provided.
const secretKey = process.env.AUTH_SECRET;
if (!secretKey) {
    throw new Error("FATAL: AUTH_SECRET is not defined in environment variables.");
}
const key = new TextEncoder().encode(secretKey);

export async function encrypt(payload: any) {
    return await new SignJWT(payload)
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("10m") // Reduced session time for security
        .sign(key);
}

export async function decrypt(input: string): Promise<any> {
    const { payload } = await jwtVerify(input, key, {
        algorithms: ["HS256"],
    });
    return payload;
}

export const createSession = encrypt;

export async function verifySession(token: string) {
    try {
        return await decrypt(token);
    } catch {
        return null;
    }
}

export async function setSessionCookie(token: string) {
    const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    (await cookies()).set("auth_token", token, {
        httpOnly: true,
        secure: true,
        expires: expires,
        sameSite: "lax",
        path: "/",
    });
}


export async function deleteSession() {
    (await cookies()).delete("auth_token");
}
