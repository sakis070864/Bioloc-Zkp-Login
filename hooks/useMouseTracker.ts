import { useState, useRef, useEffect, useCallback } from 'react';

export interface MouseEventData {
    x: number;
    y: number;
    time: number;
    type: "move" | "click" | "down" | "up";
}

export interface MouseMetrics {
    velocity: number;   // px/ms
    jitter: number;     // variance from smooth path
    curvature: number;  // deviations from straight line
}

export const useMouseTracker = (isActive: boolean = true) => {
    const [mouseData, setMouseData] = useState<MouseEventData[]>([]);
    const lastPos = useRef<{ x: number, y: number, time: number } | null>(null);

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!isActive) return;

        const now = performance.now();
        const event: MouseEventData = {
            x: e.clientX,
            y: e.clientY,
            time: now,
            type: "move"
        };

        // Sampling rate limit (e.g., every ~20ms) to avoid memory explosion
        // but need high fidelity for jitter. Let's start with raw capture for short sessions.
        setMouseData(prev => {
            // Keep buffer manageable, maybe last 500 events?
            // For calibration we might need the whole sequence.
            return [...prev, event];
        });
    }, [isActive]);

    const handleMouseClick = useCallback((e: MouseEvent) => {
        if (!isActive) return;
        setMouseData(prev => [...prev, {
            x: e.clientX,
            y: e.clientY,
            time: performance.now(),
            type: e.type === "mousedown" ? "down" : "up"
        }]);
    }, [isActive]);

    useEffect(() => {
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mousedown', handleMouseClick);
        window.addEventListener('mouseup', handleMouseClick);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mousedown', handleMouseClick);
            window.removeEventListener('mouseup', handleMouseClick);
        };
    }, [handleMouseMove, handleMouseClick]);

    const resetMouse = () => setMouseData([]);

    return { mouseData, resetMouse };
};
