
import { zkp } from "../lib/zkp";

// Wraps the script in an async function to allow top-level await if needed, 
// though ts-node/Node with modules support top-level await.
(async () => {
console.log("\n🕵️  STARTING SECURITY AUDIT: ZKP LOGIN FLOW\n");

// ==========================================
// SCENARIO 1: LEGITIMATE USER (Happy Path)
// ==========================================
console.log("🟢 SCENARIO 1: Legitimate User Login");
const userSecret = "employee_12345";
const nonce = "session-" + Date.now();
console.log(`   User inputs Secret ID: "${userSecret}"`);

// 1. Client Generates Proof
console.log("   [Client] Generating Zero Knowledge Proof...");
const legitProof = await zkp.generateProof(userSecret, nonce);
console.log(`   [Client] Proof Generated.`);
console.log(`   - Commitment: ${legitProof.commitment.substring(0, 20)}...`);
console.log(`   - Randomness r: [HIDDEN]`);

// 2. Network Transmission (Simulated)
// The user sends { commitment, proof } to Server
const payload = { ...legitProof };

// 3. Admin Verification
console.log("   [Admin] Verifying Proof...");
const isLegitValid = await zkp.verifyProof(payload.commitment, payload.proof, nonce);

if (isLegitValid) {
    console.log("   ✅ SUCCESS: Legitimate user authorized.");
} else {
    console.error("   ❌ FAILURE: Legitimate user rejected (Bug!).");
}

// ==========================================
// SCENARIO 2: REPLAY ATTACK (Statelessness Check)
// ==========================================
console.log("\n🔴 SCENARIO 2: Replay Attack");
console.log("   Hacker intercepts the valid proof from Scenario 1.");
console.log("   Hacker tries to reuse it in a NEW session (New Nonce).");

const attackerNonce = "attacker-session-" + Date.now();
const isReplayValid = await zkp.verifyProof(payload.commitment, payload.proof, attackerNonce);

if (isReplayValid) {
    console.error("   ❌ CRITICAL FAILURE: Replay Attack Succeeded!");
} else {
    console.log("   🛡️  SECURE: Replay Attack Blocked (Nonce Mismatch).");
}

// ==========================================
// SCENARIO 3: THE HACKER (Forged Proof)
// ==========================================
console.log("\n🟠 SCENARIO 3: Forgery Attack");
console.log("   Hacker generates a random fake commitment and proof.");

const fakeCommitment = "0x123456789abcdef"; // Junk data
const fakeProof = {
    T: "0xdeadbeef",
    z_v: "0x000000",
    z_r: "0x111111"
};

console.log("   [Admin] Verifying Fake Proof...");
try {
    const isHackerValid = await zkp.verifyProof(fakeCommitment, fakeProof, nonce);
    if (isHackerValid) {
        console.error("   ❌ CRITICAL FAILURE: Hacker bypassed security!");
    } else {
        console.log("   🛡️  SECURE: Hacker proof rejected.");
    }
} catch (e) {
    console.log("   🛡️  SECURE: Hacker proof rejected (Invalid Format).");
}
// ==========================================
// SCENARIO 3: MAN-IN-THE-MIDDLE (Tampering)
// ==========================================
console.log("\n🟠 SCENARIO 3: Tampering Attack");
console.log("   User sends valid proof, but Hacker intercepts and changes one character.");

const tamperedProof = {
    ...legitProof,
    proof: {
        ...legitProof.proof,
        // Hacker adds 1 to the response value
        z_v: "0x" + (BigInt(legitProof.proof.z_v) + 1n).toString(16)
    }
};

console.log("   [Admin] Verifying Tampered Proof...");
const isTamperedValid = await zkp.verifyProof(tamperedProof.commitment, tamperedProof.proof, nonce);

if (isTamperedValid) {
    console.error("   ❌ CRITICAL FAILURE: Tampered data accepted!");
} else {
    console.log("   🛡️  SECURE: Tampered data rejected.");
}

console.log("\n==========================================");
console.log("AUDIT COMPLETE");
})();
