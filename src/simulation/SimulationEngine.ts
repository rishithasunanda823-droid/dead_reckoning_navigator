/**
 * Simulation engine — generates realistic synthetic motion so the full
 * Dead Reckoning pipeline can be demonstrated on a desktop (no sensors).
 *
 * The simulator models a pedestrian walking along a path with a chosen
 * heading and speed. It produces:
 *  - Synthetic accelerometer samples (with a step-like sinusoidal bounce +
 *    noise) that feed the real StepDetector
 *  - Synthetic orientation/compass samples that feed the real HeadingEstimator
 *  - An optional heading-drift term so the DR position diverges from the
 *    "true" simulated position — this makes the accumulated error visible
 *    when GPS is restored.
 *
 * Because the synthetic data flows through the SAME step detector and heading
 * estimator as real sensor data, the demo behaves like a real session rather
 * than just moving a marker on the map.
 */

import type { LatLng } from "@/utils/geo";
import type { MotionData, OrientationData } from "@/sensors/useSensors";

export interface SimulationConfig {
  start: LatLng;
  speed: number; // m/s walking speed
  stepLength: number; // meters per step
  /** Heading drift in deg/s applied to the DR estimate (not the truth). */
  driftDegPerSec: number;
}

export interface SimulationTruth {
  position: LatLng;
  heading: number;
  steps: number;
  distance: number;
}

export type SimDataCallback = (data: {
  motion: MotionData;
  orientation: OrientationData;
  truth: SimulationTruth;
}) => void;

export class SimulationEngine {
  private cfg: SimulationConfig;
  private heading = 0; // deg, current commanded heading
  private truthPos: LatLng;
  private truthSteps = 0;
  private truthDistance = 0;
  private timer: number | null = null;
  private lastT = 0;
  private stepPhase = 0;
  private onTick: SimDataCallback;
  private running = false;

  constructor(cfg: SimulationConfig, onTick: SimDataCallback) {
    this.cfg = cfg;
    this.truthPos = { ...cfg.start };
    this.onTick = onTick;
  }

  setHeading(deg: number): void {
    this.heading = ((deg % 360) + 360) % 360;
  }

  getHeading(): number {
    return this.heading;
  }

  setSpeed(mps: number): void {
    this.cfg.speed = mps;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastT = performance.now();
    // ~50 Hz tick rate, close to real sensor cadence
    this.timer = window.setInterval(() => this.tick(), 20);
  }

  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.running = false;
  }

  isRunning(): boolean {
    return this.running;
  }

  /** Current ground-truth position (for recalibration when GPS is unavailable). */
  getTruthPosition(): LatLng {
    return { ...this.truthPos };
  }

  private tick(): void {
    const now = performance.now();
    const dt = (now - this.lastT) / 1000; // seconds
    this.lastT = now;

    // Advance the "true" position by speed * dt in the commanded heading.
    const dist = this.cfg.speed * dt;
    this.truthDistance += dist;
    // How many steps does this distance correspond to?
    const stepsNow = Math.floor(this.truthDistance / this.cfg.stepLength);
    const newSteps = stepsNow - this.truthSteps;
    this.truthSteps = stepsNow;

    if (dist > 0) {
      this.truthPos = this.advance(this.truthPos, dist, this.heading);
    }

    // Generate a synthetic accelerometer sample.
    // Walking produces a ~2 Hz vertical bounce; running ~3 Hz.
    const stepFreq = this.cfg.speed > 2 ? 3 : 2; // Hz
    this.stepPhase += dt * stepFreq * 2 * Math.PI;
    const bounce = Math.sin(this.stepPhase) * (this.cfg.speed > 2 ? 4 : 2.2);
    const noise = (Math.random() - 0.5) * 0.6;
    const vertical = bounce + noise; // dynamic component
    // accelerationIncludingGravity: gravity along z (~9.81) + dynamic
    const ax = (Math.random() - 0.5) * 0.4;
    const ay = (Math.random() - 0.5) * 0.4;
    const az = 9.81 + vertical;

    // Gyroscope z-rate: heading change per second (deg/s) + drift + noise.
    // The DR estimator sees a slightly drifted compass, so error accumulates.
    const gyroZ =
      this.heading !== 0
        ? 0 // steady heading => no rotation
        : 0;

    // Compass: report the true heading PLUS a slowly growing drift so the
    // DR estimate diverges from truth (demonstrates accumulated error).
    const driftedHeading =
      (this.heading + this.cfg.driftDegPerSec * (this.lastT / 1000) + 360) % 360;

    const motion: MotionData = {
      accel: { x: ax, y: ay, z: az },
      gyro: { x: 0, y: 0, z: gyroZ },
      t: Date.now(),
    };
    const orientation: OrientationData = {
      alpha: driftedHeading,
      beta: 0,
      gamma: 0,
      absolute: true,
      t: Date.now(),
    };

    this.onTick({
      motion,
      orientation,
      truth: {
        position: this.truthPos,
        heading: this.heading,
        steps: this.truthSteps,
        distance: this.truthDistance,
      },
    });
  }

  /** Move a latlng by `dist` meters along `headingDeg` (flat-Earth approx is fine here for truth). */
  private advance(pos: LatLng, dist: number, headingDeg: number): LatLng {
    // Use a small-angle flat-earth approximation for the truth track.
    const dLat = (dist * Math.cos((headingDeg * Math.PI) / 180)) / 111320;
    const dLng =
      (dist * Math.sin((headingDeg * Math.PI) / 180)) /
      (111320 * Math.cos((pos.lat * Math.PI) / 180));
    return { lat: pos.lat + dLat, lng: pos.lng + dLng };
  }

  reset(start: LatLng): void {
    this.stop();
    this.truthPos = { ...start };
    this.truthSteps = 0;
    this.truthDistance = 0;
    this.stepPhase = 0;
    this.heading = 0;
  }
}
