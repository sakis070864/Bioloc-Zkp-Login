"use client";

import SecureBiometricLogin from "@/components/SecureBiometricLogin";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#050505]">
      <SecureBiometricLogin />
    </main>
  );
}
