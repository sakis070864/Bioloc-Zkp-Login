# Biometric Security System: Architectural Oversight

## 1. System Components
- **App 1 (Training):** The "Factory." Captures baseline biometrics (keystrokes, sensors) and generates a signed `BiometricProfile`.
- **App 2 (Verification):** The "Gatekeeper." A Dockerized "Black Box" that compares live session data against the stored profile.
- **Shared Core (`/packages/core`):** A shared library containing the mathematical algorithms, scoring logic, and TypeScript types used by both apps to ensure logic parity.

## 2. Data Strategy (Firebase)
- **Multi-tenancy:** Data is partitioned by `tenantId`.
- **Integrity:** Profiles are HMAC-signed by App 1. App 2 verifies this signature before processing to prevent manual tampering in the database.
- **Privacy:** Biometric data is never stored in raw form; only mathematical "templates" or ZKP-ready hashes are persisted.

## 3. Integration & Deployment
- **Model:** Dockerized "Black Box" (On-Premise) or SaaS Gateway.
- **Handshake:** OIDC-style flow. App 2 issues a signed `AttestationToken` after successful verification.
- **Server-Side Enforcement:** The customer's backend MUST verify the token via a back-channel API call to the "Black Box" before granting access.

## 4. Security Mandates
- **Zero-Trust UI:** App 2 runs in an isolated environment (iframe/popup) to prevent host-page interference.
- **Nonce-Based Verification:** Prevents replay attacks by requiring a server-generated challenge for every session.
- **Pure Logic Shared Core:** The shared library must have no side effects and no secrets.

## 5. Directory Structure Goal (Monorepo)
```
/root
  ├── /apps
  │    ├── /training-app
  │    └── /verification-app
  ├── /packages
  │    └── /core (Shared Logic)
  └── ARCHITECTURE_OVERSIGHT.md
```
