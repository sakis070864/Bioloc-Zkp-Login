
import { zkp } from "../lib/zkp";

// Need to wrap in async for top level await or use .then
(async () => {
    console.log("🔒 Starting Zero Service Knowledge Proof (ZKP) Verification...");

    // 1. Simulation Data
    const SECRET_ID = "employee_5599_secure";
    console.log(`\n1. Simulating User (Prover) with Secret ID: "${SECRET_ID}"`);

    // 2. Generate Proof
    console.log("   - Generating Cryptographic Proof...");
    const startTime = performance.now();
    const nonce = "test-nonce-" + Date.now();
    const { commitment, proof } = await zkp.generateProof(SECRET_ID, nonce);
    const endTime = performance.now();

    console.log(`   ✅ Proof Generated in ${(endTime - startTime).toFixed(2)}ms`);
    console.log(`   - Public Commitment: ${commitment.substring(0, 32)}...`);
    // Safe substring access
    const z_v_str = proof.z_v ? proof.z_v.toString() : "";
    console.log(`   - Random Challenge Response (z_v): ${z_v_str.substring(0, 16)}...`);

    // 3. Verify Proof
    console.log(`\n2. Simulating Admin (Verifier)`);
    console.log("   - Verifying Proof against Commitment...");

    const isValid = await zkp.verifyProof(commitment, proof, nonce);

    if (isValid) {
        console.log("\n✅ SUCCESS: Mathematical Proof Verified!");
        console.log("   The Prover knows the Secret ID, but the Verifier never saw it.");
    } else {
        console.error("\n❌ FAILURE: Proof Rejected.");
        process.exit(1);
    }

    // 4. Test Tampering
    console.log("\n3. Testing Security (Tampering Attempt)");
    // proof.z_v is a string "0x...", so we convert to BigInt, add 1, then back to hex string
    const tamperedVal = BigInt(proof.z_v) + 1n;
    const tamperedProof = { ...proof, z_v: "0x" + tamperedVal.toString(16) }; 
    
    const isTamperedValid = await zkp.verifyProof(commitment, tamperedProof, nonce);

    if (!isTamperedValid) {
        console.log("   ✅ SUCCESS: Tampered proof was correctly REJECTED.");
    } else {
        console.error("   ❌ CRITICAL FAILURE: Tampered proof was ACCEPTED!");
    }
})();
