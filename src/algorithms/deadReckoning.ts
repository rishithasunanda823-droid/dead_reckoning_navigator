/**
 * Pedestrian Dead Reckoning (PDR) engine.
 *
 * Dead Reckoning estimates the current position by integrating motion from
 * the last known position:
 *
 *     New Position = Previous Position + Distance × Heading
 *
 * For walking, "Distance" is accumulated step length, and "Heading" comes from
 * the compass/gyro estimator. Each detected step advances the position by one
 * step length in the current heading direction.
 *
 * The displacement is converted to latitude/longitude using the spherical
 * destination-point formula (see utils/geo.ts), which correctly accounts for
 * the Earth's curvature and the convergence of meridians at higher latitudes.
 *
 * Error accumulates over time because:
 *  - Step length is an estimate (varies per person / pace)
 *  - Heading drifts without an absolute compass reference
 *  - Missed/false steps bias the distance
 * When GPS returns, we measure the true error and snap back to the GPS fix.
 */

import { destinationPoint, haversineDistance, type LatLng } from "@/utils/geo";
import {
  estimateStepLength,
  StepDetector,
  type AccelSample,
} from "@/algorithms/stepDetection";
import { HeadingEstimator, type HeadingSample } from "@/algorithms/headingEstimator";

export interface DeadReckoningState {
  position: LatLng;
  heading: number;
  steps: number;
  distance: number; // meters
  /** Accumulated drift error when GPS is restored, in meters. */
  error: number | null;
}

export class DeadReckoningEngine {
  private stepDetector = new StepDetector();
  private headingEstimator = new HeadingEstimator();
  private stepLength: number;
  private position: LatLng;
  private steps = 0;
  private distance = 0;

  constructor(start: LatLng, heightM?: number) {
    this.position = start;
    this.stepLength = estimateStepLength(heightM);
  }

  /** Feed an accelerometer sample; returns true if a new step advanced the position. */
  feedAccel(sample: AccelSample): boolean {
    const { step } = this.stepDetector.process(sample);
    if (step) {
      this.steps += 1;
      this.distance += this.stepLength;
      // Advance position by one step length in the current heading.
      this.position = destinationPoint(
        this.position,
        this.stepLength,
        this.headingEstimator.current
      );
      return true;
    }
    return false;
  }

  /** Feed orientation/gyro data to update the heading estimate. */
  feedHeading(sample: HeadingSample): void {
    this.headingEstimator.process(sample);
  }

  /** Manually override heading (e.g. from a UI control in simulation). */
  setHeading(deg: number): void {
    this.headingEstimator.process({
      compass: deg,
      gyroZ: null,
      t: Date.now(),
    });
  }

  /** Force a synthetic step (used by the simulation engine). */
  forceStep(headingDeg?: number): void {
    if (headingDeg !== undefined) this.setHeading(headingDeg);
    this.steps += 1;
    this.distance += this.stepLength;
    this.position = destinationPoint(
      this.position,
      this.stepLength,
      this.headingEstimator.current
    );
  }

  /** Sync the engine's position to a GPS fix without resetting step/distance counters. */
  syncPosition(gps: LatLng): void {
    this.position = gps;
  }

  /** Correct the position to a known-good GPS fix (recalibration). */
  correctTo(gps: LatLng): number {
    const err = haversineDistance(this.position, gps);
    this.position = gps;
    return err;
  }

  get state(): DeadReckoningState {
    return {
      position: this.position,
      heading: this.headingEstimator.current,
      steps: this.steps,
      distance: this.distance,
      error: null,
    };
  }

  reset(start: LatLng): void {
    this.stepDetector.reset();
    this.headingEstimator.reset();
    this.position = start;
    this.steps = 0;
    this.distance = 0;
  }
}
