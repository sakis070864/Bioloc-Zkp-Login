import { useRef, useCallback } from 'react';

export interface KeyEvent {
    code: string;
    time: number;
    type: "keydown" | "keyup";
}

export const useBiometricCapture = () => {
    // Optimization: Use Ref for the mutable buffer to avoid O(N^2) re-renders on every keystroke
    const dataRef = useRef<KeyEvent[]>([]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent | KeyboardEvent) => {
        if (e.repeat) return;

        const event: KeyEvent = {
            code: e.code,
            time: performance.now(),
            type: "keydown"
        };
        dataRef.current.push(event);
    }, []);

    const handleKeyUp = useCallback((e: React.KeyboardEvent | KeyboardEvent) => {
        const event: KeyEvent = {
            code: e.code,
            time: performance.now(),
            type: "keyup"
        };
        dataRef.current.push(event);
    }, []);

    const resetCapture = useCallback(() => {
        dataRef.current = [];
    }, []);

    const getData = useCallback(() => dataRef.current, []);

    return {
        getData,
        handleKeyDown,
        handleKeyUp,
        resetCapture
    };
};
