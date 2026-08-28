/**
 * Pedestrian activity recognition.
 *
 * This is the "AI/ML component" of the system. We classify the user's current
 * activity from motion features using a lightweight rule-based classifier
 * (a decision tree over hand-crafted features). This is a common and
 * explainable approach for a prototype:
 *
 *  Features used:
 *   - Step cadence (steps per second) over a sliding window
 *   - Acceleration variance (energy of motion)
 *   - Heading change rate (turning detection)
 *
 *  Classes:
 *   - Stationary  : negligible motion, no steps
 *   - Walking     : steady low cadence, moderate energy
 *   - Running     : high cadence, high energy
 *   - Turning     : significant heading change regardless of speed
 *
 * A production system would train a model (Random Forest / SVM / small neural net)
 * on labeled sensor data; the feature extraction here mirrors what such a model
 * would consume, so swapping in a trained classifier is straightforward.
 */

export type Activity = "Stationary" | "Walking" | "Running" | "Turning";

export interface ActivityFeatures {
  /** Steps detected in the last window. */
  stepCount: number;
  /** Window duration in seconds. */
  windowSec: number;
  /** Variance of acceleration magnitude in the window. */
  accelVariance: number;
  /** Absolute heading change in degrees over the window. */
  headingDelta: number;
}

export function classifyActivity(f: ActivityFeatures): Activity {
  const cadence = f.windowSec > 0 ? f.stepCount / f.windowSec : 0;

  // Turning dominates: a large heading change is "Turning" even while walking.
  if (f.headingDelta > 40) {
    return "Turning";
  }

  // Stationary: no steps and very low motion energy.
  if (cadence < 0.3 && f.accelVariance < 0.5) {
    return "Stationary";
  }

  // Running: high cadence (roughly > 2.5 steps/sec) and high energy.
  if (cadence > 2.5 || (cadence > 1.8 && f.accelVariance > 6)) {
    return "Running";
  }

  // Otherwise it's walking.
  return "Walking";
}
