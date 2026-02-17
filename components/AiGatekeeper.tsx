"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Message {
    role: "user" | "model";
    content: string;
}

interface AiGatekeeperProps {
    onVerified: () => void;
    onClose: () => void;
}

export default function AiGatekeeper({ onVerified, onClose }: AiGatekeeperProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [status, setStatus] = useState<"ACTIVE" | "APPROVED" | "REJECTED">("ACTIVE");
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Initial greeting
    useEffect(() => {
        const initChat = async () => {
            setIsLoading(true);
            try {
                const res = await fetch("/api/verify-intent", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ history: [] })
                });
                const data = await res.json();
                if (data.error) {
                    throw new Error(data.error);
                }
                setMessages([{ role: "model", content: data.reply }]);
            } catch (err: any) {
                setMessages([{ role: "model", content: `ERROR: ${err.message || "NEURAL LINK SEVERED."}` }]);
            } finally {
                setIsLoading(false);
            }
        };
        initChat();
    }, []);

    const handleSend = async () => {
        if (!input.trim() || isLoading || status !== "ACTIVE") return;

        const newMessages = [...messages, { role: "user", content: input } as Message];
        setMessages(newMessages);
        setInput("");
        setIsLoading(true);

        try {
            const res = await fetch("/api/verify-intent", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ history: newMessages })
            });
            const data = await res.json();

            setMessages((prev) => [...prev, { role: "model", content: data.reply }]);

            if (data.status === "APPROVED") {
                setStatus("APPROVED");
                setTimeout(onVerified, 2000); // Wait a bit then trigger success
            } else if (data.status === "REJECTED") {
                setStatus("REJECTED");
            }

        } catch (err) {
            setMessages((prev) => [...prev, { role: "model", content: "ERROR: PACKET LOSS. RETRY." }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl"
        >
            <div className="w-full max-w-2xl bg-black border border-cyan-500/50 rounded-lg shadow-[0_0_50px_rgba(6,182,212,0.2)] overflow-hidden flex flex-col h-[600px] relative">

                {/* Header */}
                <div className="bg-slate-900/50 p-4 border-b border-white/10 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                        <h2 className="text-cyan-400 font-mono tracking-widest text-sm">SENTIENT GUARDIAN PROTOCOL</h2>
                    </div>
                    <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                {/* Chat Area */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4 font-mono text-sm scrollbar-thin scrollbar-thumb-cyan-900 scrollbar-track-transparent">
                    {messages.map((msg, idx) => (
                        <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                            <div
                                className={`max-w-[80%] p-4 rounded-lg relative ${msg.role === "user"
                                    ? "bg-slate-800 text-white border border-slate-700"
                                    : "bg-cyan-950/30 text-cyan-200 border border-cyan-500/30 group"
                                    }`}
                            >
                                {/* Decorator for AI */}
                                {msg.role === "model" && (
                                    <>
                                        <div className="absolute top-0 left-0 w-1 h-full bg-cyan-500/50 rounded-l-lg"></div>
                                        {/* Copy Button */}
                                        <button
                                            onClick={() => navigator.clipboard.writeText(msg.content)}
                                            className="absolute top-2 right-2 p-1.5 text-cyan-500/50 hover:text-cyan-400 bg-cyan-950/50 hover:bg-cyan-900/50 rounded transition-colors opacity-0 group-hover:opacity-100"
                                            title="Copy Question"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" /></svg>
                                        </button>
                                    </>
                                )}
                                {msg.content}

                                {/* Critical Question Instruction - Index 4 is typically the 3rd model message (0, 2, 4) */}
                                {msg.role === "model" && idx === 4 && (
                                    <div className="mt-4 pt-4 border-t border-red-500/20 text-xs text-red-500 font-bold leading-relaxed">
                                        If you don&apos;t know the question yourself, copy the text and ask your favorite AI to give you the answer, and paste it here.
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}

                    {isLoading && (
                        <div className="flex justify-start">
                            <div className="bg-cyan-950/10 text-cyan-500/50 p-3 rounded-lg border border-cyan-500/10 animate-pulse font-mono text-xs">
                                &gt; ANALYZING SEMANTICS...
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="p-4 bg-slate-900/50 border-t border-white/10">
                    {status === "ACTIVE" ? (
                        <div className="relative flex items-center">
                            <span className="absolute left-4 text-cyan-500 font-mono">&gt;</span>
                            <input
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                                placeholder="Provide required data..."
                                autoFocus
                                className="w-full bg-black border border-slate-700 rounded text-white py-3 pl-8 pr-12 font-mono text-sm focus:border-cyan-500 outline-none transition-colors placeholder:text-slate-700"
                            />
                            <button
                                onClick={handleSend}
                                disabled={!input.trim()}
                                className="absolute right-2 p-2 text-cyan-500 hover:text-white disabled:opacity-30 transition-colors"
                            >
                                ⏎
                            </button>
                        </div>
                    ) : (
                        <div className={`p-4 text-center font-bold tracking-widest font-mono text-sm ${status === "APPROVED" ? "text-green-500 bg-green-500/10 border border-green-500/30" : "text-red-500 bg-red-500/10 border border-red-500/30"}`}>
                            {status === "APPROVED" ? "ACCESS GRANTED. PROCEED." : "ACCESS DENIED. TERMINATING."}
                        </div>
                    )}
                </div>

                {/* Rejection Popup */}
                <AnimatePresence>
                    {status === "REJECTED" && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-6"
                        >
                            <div className="bg-slate-900 border border-red-500/50 rounded-xl p-8 max-w-md w-full shadow-[0_0_50px_rgba(239,68,68,0.2)] text-center relative overflow-hidden">
                                {/* Alert Icon */}
                                <div className="mx-auto w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-6 border border-red-500/20">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                </div>

                                <h3 className="text-2xl font-bold text-white mb-2">ACCESS DENIED</h3>
                                <p className="text-slate-400 mb-6">
                                    Your responses failed the verification protocol.
                                </p>

                                <div className="bg-slate-950 rounded-lg p-4 border border-slate-800 text-left mb-6 relative z-10">
                                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Instructions</p>
                                    <p className="text-slate-300 text-sm leading-relaxed">
                                        If you believe this is an error, please contact the administrator directly at:
                                    </p>
                                    <a
                                        href="mailto:mastorematas@gmail.com"
                                        className="mt-3 bg-slate-900 p-3 rounded border border-slate-700/50 block hover:bg-slate-800/80 transition-all cursor-pointer hover:border-cyan-500/50 hover:shadow-[0_0_15px_rgba(6,182,212,0.1)] group"
                                    >
                                        <code className="text-cyan-400 font-mono select-all selection:bg-cyan-500/30 group-hover:text-cyan-300 transition-colors pointer-events-none">mastorematas@gmail.com</code>
                                    </a>
                                </div>

                                <button
                                    onClick={onClose}
                                    className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors font-medium border border-slate-700 relative z-10"
                                >
                                    Close Terminal
                                </button>

                                {/* Decorative scan lines */}
                                <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] z-0 bg-[length:100%_4px,6px_100%] opacity-20"></div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

            </div>
        </motion.div>
    );
}
