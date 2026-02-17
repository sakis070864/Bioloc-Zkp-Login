import { useState, useEffect, useCallback } from 'react';

export interface DeviceSensorData {
    alpha: number | null; // Z-axis rotation (0-360)
    beta: number | null;  // X-axis rotation (front/back tilt)
    gamma: number | null; // Y-axis rotation (left/right tilt)
    accelX: number | null;
    accelY: number | null;
    accelZ: number | null;
    time: number;
}

export const useDeviceSensors = (isActive: boolean = true) => {
    const [sensorData, setSensorData] = useState<DeviceSensorData[]>([]);

    const handleOrientation = useCallback((e: DeviceOrientationEvent) => {
        if (!isActive) return;

        // Sampling: We don't need 60fps, maybe throttle? 
        // For now, raw capture for high fidelity analysis.
        const data: DeviceSensorData = {
            alpha: e.alpha,
            beta: e.beta,
            gamma: e.gamma,
            accelX: null,
            accelY: null,
            accelZ: null,
            time: performance.now()
        };

        // We merge with latest motion data if possible, but distinct events are easier
        setSensorData(prev => [...prev.slice(-400), data]); // Keep last ~400 samples
    }, [isActive]);

    const handleMotion = useCallback((e: DeviceMotionEvent) => {
        if (!isActive) return;

        const data: DeviceSensorData = {
            alpha: null, beta: null, gamma: null,
            accelX: e.acceleration?.x || 0,
            accelY: e.acceleration?.y || 0,
            accelZ: e.acceleration?.z || 0,
            time: performance.now()
        };
        setSensorData(prev => [...prev.slice(-400), data]);
    }, [isActive]);

    useEffect(() => {
        if (typeof window !== 'undefined' && window.DeviceOrientationEvent) {
            window.addEventListener('deviceorientation', handleOrientation);
            window.addEventListener('devicemotion', handleMotion);
        }

        return () => {
            window.removeEventListener('deviceorientation', handleOrientation);
            window.removeEventListener('devicemotion', handleMotion);
        };
    }, [handleOrientation, handleMotion]);

    const resetSensors = () => setSensorData([]);

    return { sensorData, resetSensors };
};
