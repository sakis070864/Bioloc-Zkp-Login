/**
 * @file biometrics.ts
 * @security_notice PROPRIETARY MILITARY-GRADE PROTOCOLS
 * * For security reasons and to protect Intellectual Property (IP) related to 
 * Pedersen Commitment and Manhattan distance biometric analysis, the core logic 
 * of this file has been moved to a private, air-gapped environment.
 * * Technical auditing and live execution demonstrations are available upon request 
 * during professional interviews.
 * * @author Athanasios Athanasopoulos
 * @version 2026.1.0
 */

// Hardened Adaptive 30-Factor Engine

export interface KeyEvent {
    code: string;
    time: number;
    type: "keydown" | "keyup";
}

export interface DeviceSensorData {
    beta?: number | null;
    gamma?: number | null;
    accelX?: number | null;
    accelY?: number | null;
    accelZ?: number | null;
}

export interface BiometricFactors {
    flightTimeAvg: number; dwellTimeAvg: number; rhythmVariance: number;
    pinkyIndexRatio: number; shiftBalance: number;
    spacebarImpact: number; spaceDwellTime: number; shiftHoldTime: number; enterLatency: number;
    errorRate: number; postErrorSlowdown: number; deleteSeekTime: number; deleteDwellTime: number;
    glideFactor: number; doubleTapSpeed: number; trigraphVelocity: number;
    burstSpeed: number; hesitationRatio: number; wordPause: number; sentencePause: number;
    vowelSpeed: number; consonantSpeed: number; commonNgrams: number; sequenceFlow: number;
    startupLatency: number; fatigueRate: number; consistencyScore: number;
    holdingAngleMean: number; holdingStability: number; gaitEnergy: number;
}

export function compareBiometrics(profile: BiometricFactors, session: SessionData): { score: number, distance: number, confidence: number } {
    const keys = Array.isArray(session) ? session : session.keys;
    const sensors = Array.isArray(session) ? [] : (session.sensors || []);
    const startTime = Array.isArray(session) ? undefined : (session as SessionData).startTime;

    const loginFactors = analyzeBiometric30(keys, sensors, startTime);

    // Weights for all 30 Factors
    const weights: Record<keyof BiometricFactors, number> = {
        flightTimeAvg: 2.0, dwellTimeAvg: 2.0, rhythmVariance: 1.5,
        pinkyIndexRatio: 1.0, shiftBalance: 0.8,
        spacebarImpact: 1.2, spaceDwellTime: 1.0, shiftHoldTime: 1.0, enterLatency: 1.5,
        errorRate: 1.5, postErrorSlowdown: 2.0, deleteSeekTime: 2.0, deleteDwellTime: 1.5,
        glideFactor: 1.2, doubleTapSpeed: 1.5, trigraphVelocity: 1.5,
        burstSpeed: 2.5, hesitationRatio: 2.0, wordPause: 1.5, sentencePause: 1.5,
        vowelSpeed: 1.0, consonantSpeed: 1.0, commonNgrams: 2.0, sequenceFlow: 1.5,
        startupLatency: 0.5, fatigueRate: 1.0, consistencyScore: 2.0,
        holdingAngleMean: 3.0, holdingStability: 2.5, gaitEnergy: 2.5
    };

    let totalScorePoints = 0;
    let totalMaxPossible = 0;
    const factorKeys = Object.keys(profile) as (keyof BiometricFactors)[];

    // --- SECURITY CHECK 1: ANTI-ROBOTIC (Statistical Uniformity) ---
    // Humans are imperfect. If variance is near zero, it's a script.
    if (loginFactors.rhythmVariance < 5.0 || loginFactors.consistencyScore < 0.02) {
        console.warn("🚨 REJECTION: Robotic Uniformity Detected.");
        return { score: 0, distance: 100, confidence: 0 }; // Immediate fail
    }

    // Factors that are strictly BEHAVIORAL and should NOT be skipped if missing in session
    // (e.g., if I usually make errors, a perfect run is suspicious)
    const strictBehavioralFactors = new Set([
        'errorRate', 'postErrorSlowdown', 'deleteSeekTime', 'deleteDwellTime',
        'shiftHoldTime', 'doubleTapSpeed'
    ]);

    for (const key of factorKeys) {
        const pVal = profile[key];
        const lVal = loginFactors[key];

        // ---------------- ADAPTIVE LOGIC V2 (HARDENED) ----------------

        // CASE A: Hardware / Environmental Missing Data (Mobile vs Desktop)
        // If it's a sensor value & missing, we STILL IGNORE it to support Cross-Platform.
        // Doing otherwise would lock mobile users out of desktop.
        if (['holdingAngleMean', 'holdingStability', 'gaitEnergy'].includes(key)) {
            if (!pVal || !lVal || pVal === 0 || lVal === 0) continue;
        }

        // CASE B: Behavioral Missing Data (The "Factor Exclusion Attack" Fix)
        // If user profile has this trait (e.g. errorRate > 0) but session is 0,
        // we DO NOT skip. We evaluate it. 0 vs 0.05 will correctly penalize the score.
        else if (strictBehavioralFactors.has(key)) {
            // Check if profile HAS meaningful data but session is 0 (Missing)
            if (pVal > 0 && lVal === 0) {
                // PENALTY APPLIED by proceeding to calculation:
                // diff will be high, similarity low.
                // We do NOT continue.
            } else if (!pVal && !lVal) {
                // Both 0? Then it's truly irrelevant.
                continue;
            }
        }

        // CASE C: Standard Adaptive (Safety Net)
        // For other factors, if both are 0, skip.
        else if (!pVal || !lVal || pVal === 0 || lVal === 0) {
            continue;
        }

        // --------------------------------------------------------------

        const diff = Math.abs(pVal - lVal);
        let similarity = Math.max(0, 1.0 - (diff / (pVal || 1))); // Prevent div/0

        // Strictness Boost for key Cognitive Factors
        if (['burstSpeed', 'deleteSeekTime'].includes(key)) {
            similarity = Math.pow(similarity, 1.5);
        }

        totalScorePoints += similarity * weights[key];
        totalMaxPossible += weights[key];
    }

    const finalScore = totalMaxPossible > 0 ? (totalScorePoints / totalMaxPossible) * 100 : 0;

    return {
        score: Math.round(finalScore),
        distance: Math.round(Math.abs(100 - finalScore)),
        confidence: 100
    };
}

// Renamed to 30 to reflect upgrade
export function analyzeBiometric30(
    events: KeyEvent[],
    sensorData: DeviceSensorData[] = [],
    startTime?: number
): BiometricFactors {

    // Reuse Base 12 for core metrics
    const base = analyzeBiometric12(events, startTime);

    // --- NEW COGNITIVE ANALYSIS ---
    const downEvents = events.filter(e => e.type === "keydown");

    // Helper: Map for fast Dwell lookup
    const keyUpMap = new Map<string, number[]>();
    events.filter(e => e.type === "keyup").forEach(e => {
        if (!keyUpMap.has(e.code)) keyUpMap.set(e.code, []);
        keyUpMap.get(e.code)?.push(e.time);
    });
    const getDwell = (down: KeyEvent) => {
        const ups = keyUpMap.get(down.code) || [];
        const rel = ups.find(t => t > down.time);
        return rel ? rel - down.time : 0;
    };


    // 13-16. Specific Key Dwells & Latencies
    const spaceDwells: number[] = [];
    const shiftDwells: number[] = [];
    const deleteDwells: number[] = [];
    const enterLatencies: number[] = [];
    const deleteSeeks: number[] = [];

    for (let i = 0; i < downEvents.length; i++) {
        const e = downEvents[i];
        const dwell = getDwell(e);

        if (e.code === "Space") spaceDwells.push(dwell);
        if (e.code.includes("Shift")) shiftDwells.push(dwell);
        if (e.code === "Backspace") {
            deleteDwells.push(dwell);
            if (i > 0) deleteSeeks.push(e.time - downEvents[i - 1].time);
        }
        if (e.code === "Enter" && i > 0) {
            enterLatencies.push(e.time - downEvents[i - 1].time);
        }
    }

    // 17-20. Burst & Pause Analysis
    const flightTimes: number[] = [];
    for (let i = 1; i < downEvents.length; i++) flightTimes.push(downEvents[i].time - downEvents[i - 1].time);

    // Burst Speed (Top 30% fastest typing)
    const sortedFlights = [...flightTimes].sort((a, b) => a - b);
    const top30Count = Math.ceil(flightTimes.length * 0.3) || 1;
    const burstSpeed = avg(sortedFlights.slice(0, top30Count));

    // Hesitation Ratio
    const hesitations = flightTimes.filter(f => f > 500); // 500ms pauses
    const hesitationRatio = hesitations.length / (flightTimes.length || 1);

    // Pause after Word/Sentence
    const wordPauses: number[] = [];
    const sentencePauses: number[] = [];
    for (let i = 1; i < downEvents.length; i++) {
        const prev = downEvents[i - 1];
        if (prev.code === "Space") wordPauses.push(flightTimes[i - 1]);
        if (prev.code === "Enter" || prev.code === "Period") sentencePauses.push(flightTimes[i - 1]);
    }

    // 21-24. Linguistic / Muscle Memory
    const vowels = new Set(['KeyA', 'KeyE', 'KeyI', 'KeyO', 'KeyU']);
    const vowelFlights: number[] = [];
    const consFlights: number[] = [];

    // N-gram Approximation (Top 30 English Bigrams)
    // Ensures unique data even for short passwords like "secret" (SE, RE, ET) or "password" (AS, OR).
    // Source: Norvig / Jones English frequency data.
    const commonPairs = new Set([
        'KeyT+KeyH', 'KeyH+KeyE', 'KeyI+KeyN', 'KeyE+KeyR', 'KeyA+KeyN', 'KeyR+KeyE',
        'KeyN+KeyD', 'KeyA+KeyT', 'KeyO+KeyN', 'KeyN+KeyT', 'KeyH+KeyA', 'KeyE+KeyS',
        'KeyS+KeyT', 'KeyE+KeyN', 'KeyP+KeyI', 'KeyO+KeyU', 'KeyA+KeyR', 'KeyA+KeyL',
        'T+KeyI', 'KeyI+KeyT', 'KeyS+KeyA', 'KeyA+KeyS', 'KeyO+KeyR', 'KeyE+KeyT',
        'KeyT+KeyE', 'KeyS+KeyE', 'KeyL+KeyE', 'KeyI+KeyS', 'KeyS+KeyI', 'KeyL+KeyL'
    ]);
    let ngramSum = 0, ngramCount = 0;

    for (let i = 1; i < downEvents.length; i++) {
        const curr = downEvents[i];
        const prev = downEvents[i - 1];
        const flight = curr.time - prev.time;

        if (vowels.has(curr.code)) vowelFlights.push(flight);
        else if (curr.code.startsWith('Key')) consFlights.push(flight);

        const pair = prev.code + '+' + curr.code;
        if (commonPairs.has(pair)) {
            ngramSum += flight;
            ngramCount++;
        }
    }

    // 25-27. Dynamics
    // Fatigue: Simple slope of flight times (first half avg vs last half avg)
    const mid = Math.floor(flightTimes.length / 2);
    const firstHalf = avg(flightTimes.slice(0, mid));
    const lastHalf = avg(flightTimes.slice(mid));
    const fatigueRate = firstHalf > 0 ? lastHalf / firstHalf : 1;

    // Consistency: StdDev of Dwells / Avg Dwell
    const allDwells = downEvents.map(e => getDwell(e)).filter(d => d > 0);
    const dwellAvg = avg(allDwells);
    const dwellStd = stdDev(allDwells);
    const consistencyScore = dwellAvg > 0 ? (dwellStd / dwellAvg) : 0;

    // Flow: Smoothed Variance (Mean of Rolling Variances) - distinct from simple variance
    const flowVariances = [];
    for (let i = 0; i < flightTimes.length - 4; i++) {
        const window = flightTimes.slice(i, i + 5);
        flowVariances.push(stdDev(window));
    }
    const sequenceFlow = avg(flowVariances);


    // --- MOBILE SENSORS (Existing Logic) ---
    const mobileData = { holdingAngleMean: 0, holdingStability: 0, gaitEnergy: 0 };
    if (sensorData && sensorData.length > 0) {
        const betas = sensorData.filter(d => d.beta !== null).map(d => d.beta || 0);
        const gammas = sensorData.filter(d => d.gamma !== null).map(d => d.gamma || 0);
        const accels = sensorData.filter(d => d.accelX !== null).map(d =>
            Math.sqrt(Math.pow(d.accelX || 0, 2) + Math.pow(d.accelY || 0, 2) + Math.pow(d.accelZ || 0, 2))
        );
        mobileData.holdingAngleMean = avg(betas);
        mobileData.holdingStability = stdDev(gammas);
        mobileData.gaitEnergy = avg(accels);
    }

    // STRICT RETURN: No Fallbacks. If data is missing, we want 0.
    // This allows the adaptive engine (ignore 0s) to work correctly.
    // Fallbacks to global averages create false similarity.
    return {
        ...base,
        spaceDwellTime: avg(spaceDwells) || 0, // Should NOT be dwellTimeAvg
        shiftHoldTime: avg(shiftDwells) || 0,
        enterLatency: avg(enterLatencies) || 0, // Should NOT be flightTimeAvg
        deleteSeekTime: avg(deleteSeeks) || 0,
        deleteDwellTime: avg(deleteDwells) || 0,
        burstSpeed,
        hesitationRatio,
        wordPause: avg(wordPauses) || 0,
        sentencePause: avg(sentencePauses) || 0,
        vowelSpeed: avg(vowelFlights) || 0,
        consonantSpeed: avg(consFlights) || 0,
        commonNgrams: ngramCount > 0 ? ngramSum / ngramCount : 0,
        sequenceFlow: sequenceFlow || 0,
        fatigueRate,
        consistencyScore,
        ...mobileData
    };
}

export interface SessionData {
    keys: KeyEvent[];
    sensors?: DeviceSensorData[];
    mouse?: any[];
    startTime?: number; // Added for correct Startup Latency
    timestamp?: number;
}

/**
 * Extracts "Flight Times" (intervals between key presses) from a session.
 * Ignores the first key press (no interval).
 */
export function extractFeatures(events: KeyEvent[]): number[] {
    // Safety check
    if (!Array.isArray(events)) {
        console.error("Biometrics Error: extractFeatures received non-array", events);
        return [];
    }

    // 1. Filter only KeyDown events
    // 2. Filter out Modifiers (Shift, Ctrl, etc) that don't add text
    const ignoredCodes = new Set([
        "ShiftLeft", "ShiftRight",
        "ControlLeft", "ControlRight",
        "AltLeft", "AltRight",
        "CapsLock", "Tab", "Enter", "MetaLeft", "MetaRight"
    ]);

    const downEvents = events.filter(e =>
        e.type === "keydown" && !ignoredCodes.has(e.code)
    );

    // 3. Simulate Backspace (Stack Algorithm)
    const cleanStack: KeyEvent[] = [];
    for (const e of downEvents) {
        if (e.code === "Backspace") {
            cleanStack.pop();
        } else {
            cleanStack.push(e);
        }
    }

    // 4. Optimize KeyUp Search (O(N) Map)
    const keyUpMap = new Map<string, number[]>();
    for (const e of events) {
        if (e.type === "keyup") {
            if (!keyUpMap.has(e.code)) keyUpMap.set(e.code, []);
            keyUpMap.get(e.code)?.push(e.time);
        }
    }

    // Sort times to ensure we find the *next* keyup after keydown
    keyUpMap.forEach(times => times.sort((a, b) => a - b));

    // 5. Calculate Features
    // 5. Calculate Features
    const flightTimes: number[] = [];
    const dwellTimes: number[] = [];
    const rawDwellObservations: number[] = [];

    for (let i = 0; i < cleanStack.length; i++) {
        const current = cleanStack[i];

        // Flight Time (Fix 1: Negative Flight Time)
        if (i > 0) {
            const prev = cleanStack[i - 1];
            flightTimes.push(Math.max(0, current.time - prev.time));
        }

        // Dwell Time (O(1) with Map, effectively)
        const possibleReleases = keyUpMap.get(current.code) || [];
        // Find first release strictly after press time
        const releaseTime = possibleReleases.find(t => t > current.time);

        if (releaseTime) {
            const dt = releaseTime - current.time;
            dwellTimes.push(dt);
            rawDwellObservations.push(dt);
        } else {
            dwellTimes.push(-1); // Mark for fallback
        }
    }

    // Fix 2: Missed KeyUp Fallback (Use Session Average)
    const sessionDwellAvg = rawDwellObservations.length > 0
        ? rawDwellObservations.reduce((a, b) => a + b, 0) / rawDwellObservations.length
        : 100;

    for (let i = 0; i < dwellTimes.length; i++) {
        if (dwellTimes[i] === -1) {
            dwellTimes[i] = sessionDwellAvg;
        }
    }

    // Combine Vectors
    const combinedVector: number[] = [];
    for (let i = 0; i < flightTimes.length; i++) {
        // Standard Biometric Alignment: [Dwell N, Flight N->N+1]
        // 1. Dwell (Hold Key N)
        if (i < dwellTimes.length) {
            combinedVector.push(dwellTimes[i]);
        } else {
            combinedVector.push(sessionDwellAvg);
        }

        // 2. Flight (Move to Key N+1)
        combinedVector.push(flightTimes[i]);
    }

    return combinedVector;
}

/**
 * Creates a "Profile" (Average Factors) from multiple training sessions.
 */
/**
 * Creates a "Profile" (Average Factors) from multiple training sessions.
 */
export function createProfile(sessions: SessionData[]): BiometricFactors {
    if (!Array.isArray(sessions) || sessions.length === 0) {
        // Return explicit 0s for all 30 factors to satisfy TS
        return {
            flightTimeAvg: 0, dwellTimeAvg: 0, rhythmVariance: 0, pinkyIndexRatio: 0, shiftBalance: 0,
            spacebarImpact: 0, spaceDwellTime: 0, shiftHoldTime: 0, enterLatency: 0,
            errorRate: 0, postErrorSlowdown: 0, deleteSeekTime: 0, deleteDwellTime: 0,
            glideFactor: 0, doubleTapSpeed: 0, trigraphVelocity: 0,
            burstSpeed: 0, hesitationRatio: 0, wordPause: 0, sentencePause: 0,
            vowelSpeed: 0, consonantSpeed: 0, commonNgrams: 0, sequenceFlow: 0,
            startupLatency: 0, fatigueRate: 0, consistencyScore: 0,
            holdingAngleMean: 0, holdingStability: 0, gaitEnergy: 0
        };
    }

    // Convert each session to a factor object
    const allFactors = sessions.map(s => {
        const keys = Array.isArray(s) ? s : s.keys;
        const sensors = Array.isArray(s) ? [] : (s.sensors || []);
        const startTime = Array.isArray(s) ? undefined : (s as SessionData).startTime;
        return analyzeBiometric30(keys, sensors, startTime);
    });

    // Average each field
    const keys = Object.keys(allFactors[0]) as (keyof BiometricFactors)[];
    const profile = {} as BiometricFactors;

    for (const key of keys) {
        const sum = allFactors.reduce((acc, curr) => acc + (curr[key] || 0), 0);
        profile[key] = sum / allFactors.length;
    }

    return profile;
}


export function analyzeBiometric12(events: KeyEvent[], startTime?: number): BiometricFactors {
    if (!events || events.length === 0) {
        return {
            flightTimeAvg: 0, dwellTimeAvg: 0, rhythmVariance: 0, pinkyIndexRatio: 0,
            shiftBalance: 0, spacebarImpact: 0, errorRate: 0, postErrorSlowdown: 0,
            glideFactor: 0, doubleTapSpeed: 0, trigraphVelocity: 0, startupLatency: 0,
            // New 30-Factor defaults
            spaceDwellTime: 0, shiftHoldTime: 0, enterLatency: 0,
            deleteSeekTime: 0, deleteDwellTime: 0, burstSpeed: 0, hesitationRatio: 0,
            wordPause: 0, sentencePause: 0, vowelSpeed: 0, consonantSpeed: 0,
            commonNgrams: 0, sequenceFlow: 0, fatigueRate: 0, consistencyScore: 0,
            holdingAngleMean: 0, holdingStability: 0, gaitEnergy: 0
        };
    }

    // --- PRE-PROCESSING ---
    const downEvents = events.filter(e => e.type === "keydown");
    const upEvents = events.filter(e => e.type === "keyup");

    // O(N) Pre-processing for KeyUps
    const keyUpMap = new Map<string, number[]>();
    for (const e of events) {
        if (e.type === "keyup") {
            if (!keyUpMap.has(e.code)) keyUpMap.set(e.code, []);
            keyUpMap.get(e.code)?.push(e.time);
        }
    }
    // Ensure chronological order
    keyUpMap.forEach(times => times.sort((a, b) => a - b));

    // 1. & 2. Flight & Dwell Times
    const flightTimes: number[] = [];
    const dwellTimes: number[] = [];

    for (let i = 0; i < downEvents.length; i++) {
        const curr = downEvents[i];

        // Flight
        if (i > 0) {
            const prev = downEvents[i - 1];
            flightTimes.push(curr.time - prev.time);
        }

        // Dwell
        const possibleReleases = keyUpMap.get(curr.code) || [];
        const releaseTime = possibleReleases.find(t => t > curr.time);

        if (releaseTime) dwellTimes.push(releaseTime - curr.time);
    }

    const flightTimeAvg = avg(flightTimes);
    const dwellTimeAvg = avg(dwellTimes);

    // 3. Rhythm Variance (Standard Deviation of Flight Times)
    const rhythmVariance = stdDev(flightTimes);

    // 4. Pinky-Index Ratio
    const pinkyKeys = new Set(["KeyQ", "KeyZ", "KeyP", "KeyL", "ShiftLeft", "ShiftRight", "Enter", "Backspace", "Tab"]);
    const indexKeys = new Set(["KeyF", "KeyG", "KeyH", "KeyJ", "KeyB", "KeyN", "KeyM", "KeyY", "KeyU", "KeyR", "KeyT", "KeyV", "KeyC"]);

    let pinkySum = 0, pinkyCount = 0;
    let indexSum = 0, indexCount = 0;

    for (let i = 0; i < downEvents.length; i++) {
        if (i === 0) continue;
        const flight = downEvents[i].time - downEvents[i - 1].time;

        if (pinkyKeys.has(downEvents[i].code)) {
            pinkySum += flight;
            pinkyCount++;
        } else if (indexKeys.has(downEvents[i].code)) {
            indexSum += flight;
            indexCount++;
        }
    }
    const pinkyIndexRatio = indexCount > 0 && pinkyCount > 0 ? (pinkySum / pinkyCount) / (indexSum / indexCount) : 1;

    // 5. Shift Balance (-1 Left, +1 Right, 0 Neutral)
    let leftShifts = 0;
    let rightShifts = 0;
    for (const e of downEvents) {
        if (e.code === "ShiftLeft") leftShifts++;
        if (e.code === "ShiftRight") rightShifts++;
    }
    const totalShifts = leftShifts + rightShifts;
    const shiftBalance = totalShifts === 0 ? 0 : (rightShifts - leftShifts) / totalShifts;

    // 6. Spacebar Impact (Latency before/after space)
    const spaceLatencies: number[] = [];
    for (let i = 1; i < downEvents.length; i++) {
        if (downEvents[i].code === "Space") {
            spaceLatencies.push(downEvents[i].time - downEvents[i - 1].time);
        } else if (downEvents[i - 1].code === "Space") {
            spaceLatencies.push(downEvents[i].time - downEvents[i - 1].time);
        }
    }
    const spacebarImpact = avg(spaceLatencies);

    // 7. Error Correction Rate
    let backspaces = 0;
    for (const e of downEvents) if (e.code === "Backspace") backspaces++;
    const errorRate = downEvents.length > 0 ? backspaces / downEvents.length : 0;

    // 8. Post-Error Slowdown
    let normalFlightSum = 0, normalCount = 0;
    let postErrorSum = 0, postErrorCount = 0;

    for (let i = 1; i < downEvents.length; i++) {
        const flight = downEvents[i].time - downEvents[i - 1].time;
        if (downEvents[i - 1].code === "Backspace") {
            postErrorSum += flight;
            postErrorCount++;
        } else {
            normalFlightSum += flight;
            normalCount++;
        }
    }
    const avgNormal = normalCount > 0 ? normalFlightSum / normalCount : 1;
    const avgPostError = postErrorCount > 0 ? postErrorSum / postErrorCount : 1;
    const postErrorSlowdown = avgPostError / avgNormal;

    // 9. Glide Factor (Dwell / Flight) ratio
    const glideFactor = flightTimeAvg > 0 ? dwellTimeAvg / flightTimeAvg : 0;

    // 10. Double-Tap Agility
    let doubleTapSum = 0, doubleTapCount = 0;
    for (let i = 1; i < downEvents.length; i++) {
        if (downEvents[i].code === downEvents[i - 1].code) {
            doubleTapSum += (downEvents[i].time - downEvents[i - 1].time);
            doubleTapCount++;
        }
    }
    const doubleTapSpeed = doubleTapCount > 0 ? doubleTapSum / doubleTapCount : 0;

    // 11. Tri-Graph Velocity (Rolling speed of 3 keys)
    let trigraphSum = 0, trigraphCount = 0;
    for (let i = 2; i < downEvents.length; i++) {
        const t3 = downEvents[i].time;
        const t1 = downEvents[i - 2].time;
        trigraphSum += (t3 - t1);
        trigraphCount++;
    }
    const trigraphVelocity = trigraphCount > 0 ? trigraphSum / trigraphCount : 0;

    // 12. Startup Latency (Time from Prompt to First Key)
    let startupLatency = 0;
    // Check if startTime is provided and valid. If so, calculate latency.
    if (startTime !== undefined && startTime > 0 && downEvents.length > 0) {
        startupLatency = downEvents[0].time - startTime;
    }

    return {
        flightTimeAvg, dwellTimeAvg, rhythmVariance, pinkyIndexRatio,
        shiftBalance, spacebarImpact, errorRate, postErrorSlowdown,
        glideFactor, doubleTapSpeed, trigraphVelocity, startupLatency,
        // New 30-Factor defaults (Not calculated in Legacy 12)
        spaceDwellTime: 0, shiftHoldTime: 0, enterLatency: 0,
        deleteSeekTime: 0, deleteDwellTime: 0, burstSpeed: 0, hesitationRatio: 0,
        wordPause: 0, sentencePause: 0, vowelSpeed: 0, consonantSpeed: 0,
        commonNgrams: 0, sequenceFlow: 0, fatigueRate: 0, consistencyScore: 0,
        holdingAngleMean: 0, holdingStability: 0, gaitEnergy: 0
    };
}

// Helpers
function avg(arr: number[]) {
    if (arr.length === 0) return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function stdDev(arr: number[]) {
    if (arr.length === 0) return 0;
    const mean = avg(arr);
    const squareDiffs = arr.map(v => Math.pow(v - mean, 2));
    const avgSquareDiff = avg(squareDiffs);
    return Math.sqrt(avgSquareDiff);
}
