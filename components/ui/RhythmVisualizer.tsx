"use client";

import { useEffect, useRef } from "react";

interface RhythmVisualizerProps {
    typingSpeed: number[]; // Array of recent flight times or speeds
    isTyping: boolean;
}

export default function RhythmVisualizer({ typingSpeed, isTyping }: RhythmVisualizerProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationRef = useRef<number>(0);
    const offsetRef = useRef<number>(0);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const animate = () => {
            // Clear canvas
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            const width = canvas.width;
            const height = canvas.height;
            const centerY = height / 2;

            offsetRef.current += isTyping ? 3 : 0.5; // Move faster when typing

            // Style
            const gradient = ctx.createLinearGradient(0, 0, width, 0);
            gradient.addColorStop(0, "rgba(6, 182, 212, 0)"); // Fade in
            gradient.addColorStop(0.2, "rgba(6, 182, 212, 0.5)"); // Cyan
            gradient.addColorStop(0.5, "rgba(139, 92, 246, 0.8)"); // Purple
            gradient.addColorStop(0.8, "rgba(6, 182, 212, 0.5)"); // Cyan
            gradient.addColorStop(1, "rgba(6, 182, 212, 0)"); // Fade out

            ctx.lineWidth = 2;
            ctx.strokeStyle = gradient;
            ctx.beginPath();

            // Draw Wave
            for (let x = 0; x < width; x++) {
                // Create a base sine wave
                const frequency = 0.02;
                // Chaos factor depends on typing activity (placeholder logic)
                const amplitude = isTyping ? 15 : 5;

                const y = centerY + Math.sin(x * frequency - offsetRef.current * 0.1) * amplitude;

                if (x === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            }

            ctx.stroke();

            // Draw "Beat" particles if typing
            if (isTyping) {
                // ... (particle logic can be added here for extra polish)
            }

            animationRef.current = requestAnimationFrame(animate);
        };

        animate();

        return () => cancelAnimationFrame(animationRef.current);
    }, [isTyping, typingSpeed]);

    return (
        <canvas
            ref={canvasRef}
            width={600}
            height={128}
            className="w-full h-full"
        />
    );
}
