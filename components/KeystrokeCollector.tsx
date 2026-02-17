'use client';

import { useEffect, useRef } from 'react';

/**
 * Hook to collect keystroke flight times (time between release of prev key and press of next).
 */
export function useKeystrokes() {
  const flightTimes = useRef<number[]>([]);
  const lastKeyUpTime = useRef<number | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore modifier keys alone, or maintain logic
      // flight time = current press - last release
      const now = performance.now();
      
      if (lastKeyUpTime.current !== null) {
        const flight = now - lastKeyUpTime.current;
        // Basic filtering: flight time < 1000ms (ignore long pauses) and > 0
        if (flight > 0 && flight < 2000) {
          flightTimes.current.push(flight);
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      lastKeyUpTime.current = performance.now();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const getFlightTimes = () => flightTimes.current;
  const resetFlightTimes = () => {
    flightTimes.current = [];
    lastKeyUpTime.current = null;
  };

  return { getFlightTimes, resetFlightTimes };
}
