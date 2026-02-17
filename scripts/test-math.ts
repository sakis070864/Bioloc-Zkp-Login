
const p = 2305843009213693951n; // 2^61 - 1
const g = 3n;
const h = 7n; // Second generator
const order = p - 1n; // Using p-1 as order for exponents

function modPow(base: bigint, exp: bigint, mod: bigint): bigint {
    let res = 1n;
    base = base % mod;
    while (exp > 0n) {
        if (exp % 2n === 1n) res = (res * base) % mod;
        exp = exp / 2n;
        base = (base * base) % mod;
    }
    return res;
}

console.log("--- Math Check ---");
console.log(`p: ${p}`);

// 4. Full Pedersen Check (2 Generators)
console.log("\n4. Full Pedersen Commitment Check");
const x_val = 12345n;    // Secret Value
const r_val = 67890n;    // Randomness
// C = g^x * h^r
const C_val = (modPow(g, x_val, p) * modPow(h, r_val, p)) % p;

const v_blind = 11111n;  // Blind Value
const r_blind = 22222n;  // Blind Randomness
// T = g^v * h^r_blind
const T_val = (modPow(g, v_blind, p) * modPow(h, r_blind, p)) % p;

const c_chal = 99999n;   // Challenge

// Responses calculated mod (p-1)
const z_v_val = (v_blind + c_chal * x_val) % order;
const z_r_val = (r_blind + c_chal * r_val) % order;

// Verification: g^z_v * h^z_r == T * C^c
const left_ped = (modPow(g, z_v_val, p) * modPow(h, z_r_val, p)) % p;
const right_p1 = T_val;
const right_p2 = modPow(C_val, c_chal, p);
const right_ped = (right_p1 * right_p2) % p;

console.log(`Pedersen Verification:`);
console.log(`Left : ${left_ped}`);
console.log(`Right: ${right_ped}`);
console.log(`Match: ${left_ped === right_ped}`);

if (left_ped === right_ped) {
    console.log("✅ MATH VALID: The ZKP Logic is sound.");
} else {
    console.log("❌ MATH FAIL: The ZKP Logic is broken.");
}
