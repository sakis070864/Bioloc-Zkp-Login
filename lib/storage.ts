import { openDB } from "idb";
import type { BiometricFactors } from "./biometrics";

// --- SECURITY: AES-GCM ENCRYPTION ---
const algorithm = { name: "AES-GCM", length: 256 };

// Helper: Convert string to Key (In a real app, derive this from User Session/Password)
// For this demo, we use a session-stored key or generate one.
async function getEncryptionKey(): Promise<CryptoKey> {
    // Try to get existing key from Session Storage (so it clears on close)
    const storedKeyJwk = sessionStorage.getItem("bio_enc_key");
    if (storedKeyJwk) {
        return window.crypto.subtle.importKey(
            "jwk",
            JSON.parse(storedKeyJwk),
            algorithm,
            true,
            ["encrypt", "decrypt"]
        );
    }

    // Generate new key
    const key = await window.crypto.subtle.generateKey(algorithm, true, ["encrypt", "decrypt"]);
    const exported = await window.crypto.subtle.exportKey("jwk", key);
    sessionStorage.setItem("bio_enc_key", JSON.stringify(exported));
    return key;
}

async function encryptData(data: any): Promise<{ ciphertext: ArrayBuffer, iv: Uint8Array }> {
    const key = await getEncryptionKey();
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(JSON.stringify(data));

    const ciphertext = await window.crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        key,
        encoded
    );

    return { ciphertext, iv };
}

async function decryptData(ciphertext: ArrayBuffer, iv: Uint8Array): Promise<any> {
    try {
        const key = await getEncryptionKey();
        const decrypted = await window.crypto.subtle.decrypt(
            { name: "AES-GCM", iv: iv as any },
            key,
            ciphertext
        );
        return JSON.parse(new TextDecoder().decode(decrypted));
    } catch (e) {
        console.error("Decryption failed", e);
        return null; // Tampered or wrong key
    }
}

// --- INDEXED DB ---
const DB_NAME = "bio-storage-v2"; // Bumped version for new schema
const STORE_NAME = "profiles";

async function getDB() {
    return openDB(DB_NAME, 1, {
        upgrade(db) {
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        },
    });
}

export async function saveBiometricProfile(userId: string, profile: BiometricFactors) {
    const db = await getDB();
    const encrypted = await encryptData(profile);
    await db.put(STORE_NAME, encrypted, userId);
}

export async function loadBiometricProfile(userId: string): Promise<BiometricFactors | null> {
    const db = await getDB();
    const record = await db.get(STORE_NAME, userId);
    if (!record) return null;

    return await decryptData(record.ciphertext, record.iv);
}
