import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface BiometricProfile {
    id: string;
    timestamp: number;
    rawData: any[]; // KeystrokeData[]
    version: string;
}

interface BioLockDB extends DBSchema {
    profiles: {
        key: string;
        value: BiometricProfile;
    };
}

const DB_NAME = 'zkp-biolock-db';
const STORE_NAME = 'profiles';

let dbPromise: Promise<IDBPDatabase<BioLockDB>>;

if (typeof window !== 'undefined') {
    dbPromise = openDB<BioLockDB>(DB_NAME, 1, {
        upgrade(db) {
            db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        },
    });
}

export const saveProfile = async (rawData: any[]) => {
    if (!dbPromise) return;
    const db = await dbPromise;

    const profile: BiometricProfile = {
        id: `profile_${Date.now()}`,
        timestamp: Date.now(),
        rawData,
        version: 'v1.0'
    };

    await db.put(STORE_NAME, profile);
    return profile.id;
};

export const getLatestProfile = async () => {
    if (!dbPromise) return null;
    const db = await dbPromise;
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const all = await store.getAll();

    if (all.length === 0) return null;
    // Return the most recent one
    return all.sort((a, b) => b.timestamp - a.timestamp)[0];
};

export const clearProfiles = async () => {
    if (!dbPromise) return;
    const db = await dbPromise;
    await db.clear(STORE_NAME);
}
