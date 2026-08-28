/**
 * Step detection from accelerometer data.
 *
 * Pedestrian Dead Reckoning relies on detecting each step the user takes.
 * A phone carried on the body produces a characteristic acceleration spike
 * with every footfall: the body rises and falls, so the vertical (gravity-removed)
 * acceleration magnitude shows a peak followed by a trough each step.
 *
 * Algorithm:
 *  1. Compute the total acceleration magnitude |a| = sqrt(x² + y² + z²).
 *  2. Remove gravity (~9.81 m/s²) to get the dynamic component.
 *  3. Low-pass filter the magnitude to smooth sensor noise.
 *  4. Detect a step when the filtered value rises above a threshold, then
 *     falls back below a lower threshold (hysteresis) — this prevents one
 *     spike from being counted multiple times.
 *  5. Enforce a minimum time between steps (cadence limit) so noise bursts
 *     don't register as impossible running.
 *
 * The thresholds are tuned for a phone held in the hand or in a pocket.
 */

export interface AccelSample {
  x: number;
  y: number;
  z: number;
  t: number; // ms timestamp
}

export interface StepResult {
  step: boolean;
  magnitude: number;
  filtered: number;
}

const GRAVITY = 9.81;
const STEP_THRESHOLD_HIGH = 1.6; // m/s² above gravity to trigger a step
const STEP_THRESHOLD_LOW = 0.8; // must fall below this to re-arm
const MIN_STEP_INTERVAL_MS = 280; // max cadence ~214 steps/min
const FILTER_ALPHA = 0.2; // low-pass smoothing factor

export class StepDetector {
  private filtered = 0;
  private armed = true; // armed = ready to detect a new step
  private lastStepTime = 0;

  /** Process one accelerometer sample; returns whether a step was detected. */
  process(sample: AccelSample): StepResult {
    // Total acceleration magnitude
    const mag = Math.sqrt(sample.x ** 2 + sample.y ** 2 + sample.z ** 2);
    // Remove gravity to isolate the dynamic (motion) component
    const dynamic = Math.abs(mag - GRAVITY);

    // Low-pass filter to reduce high-frequency sensor noise
    this.filtered = this.filtered * (1 - FILTER_ALPHA) + dynamic * FILTER_ALPHA;

    let step = false;

    // Hysteresis-based peak detection:
    // - Only register a step if we're "armed" (the previous step fully reset)
    // - The filtered signal must exceed the high threshold...
    // - ...then we disarm until it drops below the low threshold
    if (this.armed && this.filtered > STEP_THRESHOLD_HIGH) {
      if (sample.t - this.lastStepTime >= MIN_STEP_INTERVAL_MS) {
        step = true;
        this.lastStepTime = sample.t;
        this.armed = false;
      }
    }
    if (!this.armed && this.filtered < STEP_THRESHOLD_LOW) {
      this.armed = true;
    }

    return { step, magnitude: dynamic, filtered: this.filtered };
  }

  reset(): void {
    this.filtered = 0;
    this.armed = true;
    this.lastStepTime = 0;
  }
}

/**
 * Estimate step length from height (meters).
 * A common heuristic: step length ≈ 0.415 × height for walking.
 * Without a known height we default to ~0.73 m (average adult walking step).
 */
export function estimateStepLength(heightM?: number): number {
  if (heightM && heightM > 0.5 && heightM < 2.5) {
    return 0.415 * heightM;
  }
  return 0.73;
}
