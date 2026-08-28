/**
 * Sensor hooks — bridge between browser sensor events and the app.
 *
 * Browsers expose motion/orientation via:
 *  - DeviceMotionEvent (accelerometer + gyroscope rotation rates)
 *  - DeviceOrientationEvent (compass / attitude)
 *  - DeviceOrientationEvent.requestPermission() on iOS 13+ (must be triggered
 *    by a user gesture — that's why we request permission from the button click)
 *
 * On desktop browsers these events never fire, which is exactly why the
 * Simulation Mode exists: it generates synthetic sensor data so the full
 * pipeline (step detection → heading → dead reckoning → map) can be demoed.
 */

import { useEffect, useRef, useState, useCallback } from "react";

export interface MotionData {
  accel: { x: number; y: number; z: number };
  gyro: { x: number; y: number; z: number }; // rotation rates deg/s
  t: number;
}

export interface OrientationData {
  alpha: number | null; // compass heading (z-axis)
  beta: number | null; // front-back tilt
  gamma: number | null; // left-right tilt
  absolute: boolean;
  t: number;
}

export interface SensorStatus {
  motion: "unavailable" | "denied" | "active";
  orientation: "unavailable" | "denied" | "active";
  hasAbsolute: boolean;
}

interface UseSensorsApi {
  status: SensorStatus;
  motion: MotionData | null;
  orientation: OrientationData | null;
  requestPermission: () => Promise<void>;
  /** Inject synthetic data (used by simulation mode). */
  injectMotion: (m: MotionData) => void;
  injectOrientation: (o: OrientationData) => void;
}

export function useSensors(): UseSensorsApi {
  const [status, setStatus] = useState<SensorStatus>({
    motion: "unavailable",
    orientation: "unavailable",
    hasAbsolute: false,
  });
  const [motion, setMotion] = useState<MotionData | null>(null);
  const [orientation, setOrientation] = useState<OrientationData | null>(null);
  const listenersRef = useRef<{
    motion?: (e: DeviceMotionEvent) => void;
    orient?: (e: DeviceOrientationEvent) => void;
  }>({});

  const requestPermission = useCallback(async () => {
    // iOS 13+ requires an explicit permission request from a user gesture.
    const anyMotion = DeviceMotionEvent as unknown as {
      requestPermission?: () => Promise<string>;
    };
    const anyOrient = DeviceOrientationEvent as unknown as {
      requestPermission?: () => Promise<string>;
    };

    let motionState: SensorStatus["motion"] = "active";
    let orientState: SensorStatus["orientation"] = "active";

    try {
      if (typeof anyMotion.requestPermission === "function") {
        const res = await anyMotion.requestPermission();
        motionState = res === "granted" ? "active" : "denied";
      }
    } catch {
      motionState = "denied";
    }
    try {
      if (typeof anyOrient.requestPermission === "function") {
        const res = await anyOrient.requestPermission();
        orientState = res === "granted" ? "active" : "denied";
      }
    } catch {
      orientState = "denied";
    }

    setStatus((s) => ({
      ...s,
      motion: motionState,
      orientation: orientState,
    }));
  }, []);

  // Attach native event listeners once permission is (potentially) granted.
  useEffect(() => {
    const handleMotion = (e: DeviceMotionEvent) => {
      const a = e.accelerationIncludingGravity ?? e.acceleration;
      const g = e.rotationRate;
      if (!a) return;
      setStatus((s) =>
        s.motion === "active" ? s : { ...s, motion: "active" }
      );
      setMotion({
        accel: { x: a.x ?? 0, y: a.y ?? 0, z: a.z ?? 0 },
        gyro: { x: g?.alpha ?? 0, y: g?.beta ?? 0, z: g?.gamma ?? 0 },
        t: Date.now(),
      });
    };

    const handleOrient = (e: DeviceOrientationEvent) => {
      setStatus((s) => ({
        ...s,
        orientation: "active",
        hasAbsolute: s.hasAbsolute || e.absolute === true,
      }));
      setOrientation({
        alpha: e.alpha,
        beta: e.beta,
        gamma: e.gamma,
        absolute: e.absolute === true,
        t: Date.now(),
      });
    };

    // Some desktop/Android browsers fire without permission; attach anyway.
    window.addEventListener("devicemotion", handleMotion);
    window.addEventListener("deviceorientation", handleOrient);
    window.addEventListener("deviceorientationabsolute", handleOrient as EventListener);

    listenersRef.current = { motion: handleMotion, orient: handleOrient };

    return () => {
      window.removeEventListener("devicemotion", handleMotion);
      window.removeEventListener("deviceorientation", handleOrient);
      window.removeEventListener(
        "deviceorientationabsolute",
        handleOrient as EventListener
      );
    };
  }, []);

  const injectMotion = useCallback((m: MotionData) => {
    setStatus((s) => ({ ...s, motion: "active" }));
    setMotion(m);
  }, []);

  const injectOrientation = useCallback((o: OrientationData) => {
    setStatus((s) => ({
      ...s,
      orientation: "active",
      hasAbsolute: s.hasAbsolute || o.absolute,
    }));
    setOrientation(o);
  }, []);

  return { status, motion, orientation, requestPermission, injectMotion, injectOrientation };
}
