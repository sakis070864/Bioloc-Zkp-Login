import Link from "next/link";
import Image from "next/image";

export default function HelpPage() {
    return (
        <main className="min-h-screen bg-zinc-950 text-white font-sans selection:bg-blue-500/30 p-8 flex flex-col items-center">

            {/* HEADER */}
            <div className="text-center mb-16 mt-8 animate-in fade-in slide-in-from-top-4 duration-700">
                <h1 className="text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500 mb-4">
                    User Guide - Biometric AI
                </h1>
                <p className="text-blue-400/60 text-xs font-mono tracking-widest uppercase animate-pulse">
                    Created by A.Athanasopoulos
                </p>
            </div>

            <div className="w-full max-w-4xl space-y-16">

                {/* STEP 1 */}
                <section className="flex flex-col md:flex-row items-center gap-8 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-100">
                    <div className="flex-1 space-y-4">
                        <h2 className="text-2xl font-bold text-blue-400 border-l-4 border-blue-500 pl-4">
                            Step 1: Model Training
                        </h2>
                        <p className="text-zinc-300 leading-relaxed">
                            As soon as we click on <span className="text-white font-bold">training</span>, we type the password <code className="bg-zinc-800 px-2 py-1 rounded text-blue-300 font-mono">SecurityTest@2026</code>.
                        </p>
                    </div>
                    <div className="flex-1">
                        <div className="relative group perspective-1000">
                            <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
                            <Image
                                src="/help-images/Pic_1.png"
                                alt="Step 1 Training"
                                width={600}
                                height={400}
                                className="relative rounded-xl border border-zinc-700 shadow-2xl shadow-black/50 transform group-hover:scale-[1.02] transition duration-500"
                            />
                        </div>
                    </div>
                </section>

                {/* STEP 2 */}
                <section className="flex flex-col md:flex-row-reverse items-center gap-8 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
                    <div className="flex-1 space-y-4">
                        <h2 className="text-2xl font-bold text-purple-400 border-r-4 border-purple-500 pr-4 text-right">
                            Step 2: Data Collection
                        </h2>
                        <p className="text-zinc-300 leading-relaxed text-right pl-8">
                            We save the user&#39;s <strong>behavior</strong> to the database (temporary memory). We repeat this <strong>4, 5-6 times</strong> to train the AI so it learns our typing pattern.
                        </p>
                    </div>
                    <div className="flex-1">
                        <div className="relative group">
                            <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
                            <Image
                                src="/help-images/Pic_2.png"
                                alt="Step 2 Data Collection"
                                width={600}
                                height={400}
                                className="relative rounded-xl border border-zinc-700 shadow-2xl shadow-black/50 transform group-hover:scale-[1.02] transition duration-500"
                            />
                        </div>
                    </div>
                </section>

                {/* STEP 3 */}
                <section className="flex flex-col md:flex-row items-center gap-8 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-300">
                    <div className="flex-1 space-y-4">
                        <h2 className="text-2xl font-bold text-emerald-400 border-l-4 border-emerald-500 pl-4">
                            Step 3: Identity Verification
                        </h2>
                        <p className="text-zinc-300 leading-relaxed">
                            Below we can see how many repetitions we have done. We click the <span className="text-white font-bold">Security check</span> button, enter the password in the field, and click the <span className="text-white font-bold">Verify Identity</span> button.
                        </p>
                    </div>
                    <div className="flex-1">
                        <div className="relative group">
                            <div className="absolute -inset-1 bg-gradient-to-r from-emerald-600 to-teal-600 rounded-xl blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
                            <Image
                                src="/help-images/Pic_3.png"
                                alt="Step 3 Verification"
                                width={600}
                                height={400}
                                className="relative rounded-xl border border-zinc-700 shadow-2xl shadow-black/50 transform group-hover:scale-[1.02] transition duration-500"
                            />
                        </div>
                    </div>
                </section>

                {/* STEP 4 */}
                <section className="flex flex-col md:flex-row-reverse items-center gap-8 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-400">
                    <div className="flex-1 space-y-4">
                        <h2 className="text-2xl font-bold text-pink-400 border-r-4 border-pink-500 pr-4 text-right">
                            Step 4: Security Result
                        </h2>
                        <p className="text-zinc-300 leading-relaxed text-right pl-8">
                            Finally, we see the result. The system compares the biometric typing pattern with the trained model and displays the <span className="text-white font-bold">Success Score (%)</span>. If the score is high enough, identity is verified!
                        </p>
                    </div>
                    <div className="flex-1">
                        <div className="relative group">
                            <div className="absolute -inset-1 bg-gradient-to-r from-pink-600 to-rose-600 rounded-xl blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
                            <Image
                                src="/help-images/Pic_4.png"
                                alt="Step 4 Result"
                                width={600}
                                height={400}
                                className="relative rounded-xl border border-zinc-700 shadow-2xl shadow-black/50 transform group-hover:scale-[1.02] transition duration-500"
                            />
                        </div>
                    </div>
                </section>
            </div>

            {/* FOOTER */}
            <div className="mt-20 mb-8 animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-500">
                <Link href="/">
                    <button className="px-8 py-3 bg-zinc-900 border border-zinc-700 rounded-full hover:bg-zinc-800 hover:border-blue-500/50 hover:shadow-[0_0_20px_rgba(59,130,246,0.2)] transition-all duration-300 text-zinc-300 font-bold tracking-wide group flex items-center gap-2">
                        <span className="group-hover:-translate-x-1 transition-transform">←</span> Back to Home
                    </button>
                </Link>
            </div>

        </main>
    );
}
