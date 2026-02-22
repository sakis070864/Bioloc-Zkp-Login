"use client";

import { Suspense } from "react";
import SecureBiometricLogin from "@/components/SecureBiometricLogin";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#050505]">
      <Suspense fallback={<div className="text-slate-400">Loading Secure Environment...</div>}>
        <SecureBiometricLogin />
      </Suspense>
    </main>
  );
}
