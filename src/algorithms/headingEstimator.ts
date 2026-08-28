/**
 * Heading estimation from device orientation / magnetometer data.
 *
 * The browser's DeviceOrientationEvent gives us the device's orientation
 * in 3D space. The "alpha" rotation (z-axis) is the compass heading when
 * `deviceorientationabsolute` is available, or a relative heading otherwise.
 *
 * We fuse:
 *  - The absolute compass heading (alpha) when available
 *  - The gyroscope rotation rate to smooth out noise between compass fixes
 *
 * A simple complementary filter blends a slow-but-accurate compass with a
 * fast-but-drifty gyro: heading = α·compass + (1-α)·(heading + gyroΔ).
 *
 * All headings are in degrees, 0° = North, clockwise positive.
 */

export interface HeadingSample {
  /** Compass/alpha heading in degrees, or null if unavailable. */
  compass: number | null;
  /** Gyroscope z-axis rotation rate in deg/s, or null. */
  gyroZ: number | null;
  /** ms timestamp. */
  t: number;
}

export class HeadingEstimator {
  private heading = 0;
  private hasCompass = false;
  private lastT = 0;
  // Complementary filter weight for the compass (trust it more than gyro drift)
  private readonly alpha = 0.95;

  process(sample: HeadingSample): number {
    const dt = this.lastT ? (sample.t - this.lastT) / 1000 : 0;
    this.lastT = sample.t;

    // If we have a compass reading, trust it as the anchor and correct drift.
    if (sample.compass !== null && !isNaN(sample.compass)) {
      if (!this.hasCompass) {
        // First compass reading — adopt it directly
        this.heading = sample.compass;
        this.hasCompass = true;
      } else {
        // Complementary filter: blend compass with gyro-integrated heading.
        let gyroDelta = 0;
        if (sample.gyroZ !== null && !isNaN(sample.gyroZ) && dt > 0) {
          gyroDelta = sample.gyroZ * dt;
        }
        const predicted = (this.heading + gyroDelta + 360) % 360;
        // Shortest angular path between predicted and compass
        let diff = ((sample.compass - predicted + 540) % 360) - 180;
        this.heading = (predicted + this.alpha * diff + 360) % 360;
      }
    } else if (sample.gyroZ !== null && !isNaN(sample.gyroZ) && dt > 0) {
      // No compass — dead-reckon heading from gyro only (will drift over time)
      this.heading = (this.heading + sample.gyroZ * dt + 360) % 360;
    }

    return this.heading;
  }

  get current(): number {
    return this.heading;
  }

  reset(): void {
    this.heading = 0;
    this.hasCompass = false;
    this.lastT = 0;
  }
}
