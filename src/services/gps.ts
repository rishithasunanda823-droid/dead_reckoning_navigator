/**
 * GPS service — wraps the browser Geolocation API.
 *
 * The browser Geolocation API gives us real GPS fixes (when available) via
 * navigator.geolocation.watchPosition. We expose a small subscribe/unsubscribe
 * API so the rest of the app can treat GPS as a stream of fixes.
 *
 * "GPS loss" is simulated by simply unsubscribing from the live stream and
 * continuing with Dead Reckoning — exactly what would happen if the GPS
 * receiver lost signal in a tunnel or urban canyon.
 */

import type { LatLng } from "@/utils/geo";

export interface GpsFix extends LatLng {
  accuracy: number; // meters
  t: number;
}

export type GpsStatus = "idle" | "acquiring" | "active" | "lost" | "denied" | "unavailable";

type Listener = (fix: GpsFix) => void;
type StatusListener = (status: GpsStatus) => void;

export class GpsService {
  private watchId: number | null = null;
  private listeners = new Set<Listener>();
  private statusListeners = new Set<StatusListener>();
  private status: GpsStatus = "idle";
  private simulatedLoss = false;

  /** Start watching the GPS. Returns true if the API is available. */
  start(): boolean {
    if (!("geolocation" in navigator)) {
      this.setStatus("unavailable");
      return false;
    }
    this.stop();
    this.simulatedLoss = false;
    this.setStatus("acquiring");
    try {
      this.watchId = navigator.geolocation.watchPosition(
        (pos) => {
          if (this.simulatedLoss) return; // ignore fixes while loss is simulated
          this.setStatus("active");
          const fix: GpsFix = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            t: pos.timestamp,
          };
          this.listeners.forEach((l) => l(fix));
        },
        (err) => {
          if (err.code === err.PERMISSION_DENIED) this.setStatus("denied");
          else this.setStatus("unavailable");
        },
        { enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 }
      );
      return true;
    } catch {
      this.setStatus("unavailable");
      return false;
    }
  }

  stop(): void {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
  }

  /** Simulate GPS loss: keep the watch and mark status as lost. */
  lose(): void {
    this.simulatedLoss = true;
    this.stop();
    this.setStatus("lost");
  }

  /** Restore GPS after a simulated loss. */
  restore(): void {
    this.simulatedLoss = false;
    this.start();
  }

  /** Get a single one-shot fix (used when restoring + comparing). */
  once(): Promise<GpsFix> {
    return new Promise((resolve, reject) => {
      if (!("geolocation" in navigator)) {
        reject(new Error("geolocation unavailable"));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          resolve({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            t: pos.timestamp,
          }),
        (err) => reject(err),
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    });
  }

  onFix(l: Listener): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }

  onStatus(l: StatusListener): () => void {
    this.statusListeners.add(l);
    return () => this.statusListeners.delete(l);
  }

  getStatus(): GpsStatus {
    return this.status;
  }

  private setStatus(s: GpsStatus): void {
    this.status = s;
    this.statusListeners.forEach((l) => l(s));
  }
}

export const gpsService = new GpsService();
