import { randomBytes, createHash } from 'crypto';

// --- CONSTANTS: BN254 SCALAR FIELD ---
// Order q = 21888242871839275222246405745257275088548364400416034343698204186575808495617
const GROUP_ORDER = BigInt("21888242871839275222246405745257275088548364400416034343698204186575808495617");

// Generators (nothing up my sleeve points - derived from keccak256 of string)
const G = BigInt("10360307372296483688696048126938971550972627918451842886708684742918542981504");
const H = BigInt("18619624510103657753133670691866442655380126562634351333469324637777017772648");

export class ZKPEngine {
    private add(a: bigint, b: bigint): bigint {
        return (a + b) % GROUP_ORDER;
    }

    private mul(a: bigint, b: bigint): bigint {
        return (a * b) % GROUP_ORDER;
    }

    private sub(a: bigint, b: bigint): bigint {
        return (a >= b) ? (a - b) : (a - b + GROUP_ORDER);
    }

    private modPow(base: bigint, exp: bigint): bigint {
        let result = 1n;
        let b = base % GROUP_ORDER;
        let e = exp;

        while (e > 0n) {
            if (e % 2n === 1n) result = (result * b) % GROUP_ORDER;
            b = (b * b) % GROUP_ORDER;
            e /= 2n;
        }
        return result;
    }

    private stringToBigInt(str: string): bigint {
        const hash = createHash('sha256').update(str).digest('hex');
        return BigInt('0x' + hash) % GROUP_ORDER;
    }

    private randomBigInt(): bigint {
        const randHex = randomBytes(32).toString('hex');
        return BigInt('0x' + randHex) % GROUP_ORDER;
    }

    public async generateProof(secretStr: string, nonceStr: string): Promise<{ commitment: string, proof: any }> {
        const x = this.stringToBigInt(secretStr);
        // CRITICAL FIX: Use secure random blinding factor instead of deriving from nonce
        const r = this.randomBigInt(); 

        // C = G^x * H^r
        const g_x = this.modPow(G, x);
        const h_r = this.modPow(H, r);
        const commitment = this.mul(g_x, h_r);

        // 1. Commit phase
        const k_x = this.randomBigInt();
        const k_r = this.randomBigInt();
        const R = this.mul(this.modPow(G, k_x), this.modPow(H, k_r));

        // 2. Challenge phase (Fiat-Shamir heuristics including nonce for replay protection)
        const challengeInput = `${G.toString()}${H.toString()}${commitment.toString()}${R.toString()}${nonceStr}`;
        const c = this.stringToBigInt(challengeInput);

        // 3. Response phase
        const s_x = this.add(k_x, this.mul(c, x));
        const s_r = this.add(k_r, this.mul(c, r));

        return {
            commitment: commitment.toString(16),
            proof: {
                R: R.toString(16),
                s_x: s_x.toString(16),
                s_r: s_r.toString(16)
            }
        };
    }

    public async verifyProof(commitmentHex: string, proof: any, nonceStr: string): Promise<boolean> {
        try {
            const C = BigInt('0x' + commitmentHex);
            const R = BigInt('0x' + proof.R);
            const s_x = BigInt('0x' + proof.s_x);
            const s_r = BigInt('0x' + proof.s_r);

            const challengeInput = `${G.toString()}${H.toString()}${C.toString()}${R.toString()}${nonceStr}`;
            const c = this.stringToBigInt(challengeInput);

            const lhs = this.mul(this.modPow(G, s_x), this.modPow(H, s_r));
            const rhs = this.mul(R, this.modPow(C, c));

            return lhs === rhs;
        } catch (e) {
            return false;
        }
    }
}

export const zkp = new ZKPEngine();
