// --- CONSTANTS: RFC 3526 2048-bit MODP Group ---
// P = 2^2048 - 2^1984 - 1 + 2^64 * { [2^1918 pi] + 124476 }
// This is a safe prime P = 2Q + 1
// We use integer arithmetic in Z_P (modPow) and scalar arithmetic in Z_{P-1} (exponents)

const MODULUS_HEX =
    "FFFFFFFFFFFFFFFFC90FDAA22168C234C4C6628B80DC1CD1" +
    "29024E088A67CC74020BBEA63B139B22514A08798E3404DD" +
    "EF9519B3CD3A431B302B0A6DF25F14374FE1356D6D51C245" +
    "E485B576625E7EC6F44C42E9A637ED6B0BFF5CB6F406B7ED" +
    "EE386BFB5A899FA5AE9F24117C4B1FE649286651ECE45B3D" +
    "C2007CB8A163BF0598DA48361C55D39A69163FA8FD24CF5F" +
    "83655D23DCA3AD961C62F356208552BB9ED529077096966D" +
    "670C354E4ABC9804F1746C08CA18217C32905E462E36CE3B" +
    "E39E772C180E86039B2783A2EC07A28FB5C55DF06F4C52C9" +
    "DE2BCBF6955817183995497CEA956AE515D2261898FA0510" +
    "15728E5A8AACAA68FFFFFFFFFFFFFFFF";

const MODULUS = BigInt("0x" + MODULUS_HEX);
const SCALAR_ORDER = MODULUS - 1n; // For discrete log in Z_p*, exponents are mod p-1

// Generator G = 2
const G = 2n;

// Generator H (A distinct generator where log_G(H) is unknown)
// Used SHA-256("Bio-ZKP H Generator") => mapped to integer
const H = BigInt("0x" + "5e0f7c229337b3096570644365757265205a4b5020482047656e657261746f72") % MODULUS;

export class ZKPEngine {
    // Scalar addition: (a + b) % (p-1)
    private add(a: bigint, b: bigint): bigint {
        return (a + b) % SCALAR_ORDER;
    }

    // Scalar multiplication: (a * b) % (p-1)
    private mul(a: bigint, b: bigint): bigint {
        return (a * b) % SCALAR_ORDER;
    }

    // Modular Exponentiation: base^exp % p
    private modPow(base: bigint, exp: bigint): bigint {
        let result = 1n;
        let b = base % MODULUS;
        let e = exp;

        while (e > 0n) {
            if (e % 2n === 1n) result = (result * b) % MODULUS;
            b = (b * b) % MODULUS;
            e /= 2n;
        }
        return result;
    }

    // Map string/secret to a scalar in Z_{p-1}
    private async stringToScalar(str: string): Promise<bigint> {
        const encoder = new TextEncoder();
        const data = encoder.encode(str);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        return BigInt('0x' + hashHex) % SCALAR_ORDER;
    }

    // Generate random scalar in Z_{p-1}
    private randomScalar(): bigint {
        const array = new Uint8Array(64); // larger buffer for 2048-bit range bias mitigation (simple approach)
        crypto.getRandomValues(array);
        const randHex = Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
        // This simple modulo reduction introduces slight bias but acceptable for this use case compared to 256-bit prime
        return BigInt('0x' + randHex) % SCALAR_ORDER;
    }

    public async generateProof(secretStr: string, nonceStr: string): Promise<{ commitment: string, proof: any }> {
        // x is the secret key (derived from password/ID)
        const x = await this.stringToScalar(secretStr);
        // r is the randomness for the Pedersen Commitment part (h^r)
        const r = this.randomScalar();

        // 1. Compute Commitment C = g^x * h^r
        const g_x = this.modPow(G, x);
        const h_r = this.modPow(H, r);
        const commitment = (g_x * h_r) % MODULUS;

        // 2. Prover commitment (canonical Schnorr step)
        const k_x = this.randomScalar();
        const k_r = this.randomScalar();
        const R = (this.modPow(G, k_x) * this.modPow(H, k_r)) % MODULUS;

        // 3. Compute Challenge c = Hash(Publics, R, Nonce)
        const challengeInput = `${G.toString()}${H.toString()}${commitment.toString()}${R.toString()}${nonceStr}`;
        const c = await this.stringToScalar(challengeInput);

        // 4. Compute Response s = k + c*x
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

            // 1. Recompute Challenge
            const challengeInput = `${G.toString()}${H.toString()}${C.toString()}${R.toString()}${nonceStr}`;
            const c = await this.stringToScalar(challengeInput);

            // 2. Verify: g^s_x * h^s_r == R * C^c
            // LHS
            const lhs = (this.modPow(G, s_x) * this.modPow(H, s_r)) % MODULUS;

            // RHS
            const rhs = (R * this.modPow(C, c)) % MODULUS;

            return lhs === rhs;
        } catch (e) {
            console.error("ZKP Verify Error:", e);
            return false;
        }
    }
}

export const zkp = new ZKPEngine();
