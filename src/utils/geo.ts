/**
 * Geo utilities — distance, bearing, and displacement calculations.
 *
 * All distance math uses the Haversine formula for the curvature of the Earth,
 * and bearing math uses the great-circle initial-bearing formula. These are
 * the foundations that let Dead Reckoning convert "I walked N meters heading X°"
 * into a new latitude/longitude.
 */

export interface LatLng {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_M = 6371000; // mean Earth radius in meters
const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

/** Haversine distance between two points, in meters. */
export function haversineDistance(a: LatLng, b: LatLng): number {
  const dLat = (b.lat - a.lat) * DEG2RAD;
  const dLng = (b.lng - a.lng) * DEG2RAD;
  const lat1 = a.lat * DEG2RAD;
  const lat2 = b.lat * DEG2RAD;

  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h =
    sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Initial bearing (compass heading) from point a to point b, in degrees [0, 360).
 * 0° = North, 90° = East. This is the great-circle initial bearing.
 */
export function bearingBetween(a: LatLng, b: LatLng): number {
  const lat1 = a.lat * DEG2RAD;
  const lat2 = b.lat * DEG2RAD;
  const dLng = (b.lng - a.lng) * DEG2RAD;

  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (Math.atan2(y, x) * RAD2DEG + 360) % 360;
}

/**
 * Destination point given a start, a distance (meters), and a bearing (degrees).
 *
 * This is the core of Dead Reckoning: New Position = Previous + Distance + Heading.
 * We use the spherical "direct" (haversine destination) formula so the result
 * is a proper lat/lng, not a flat-Earth approximation.
 */
export function destinationPoint(
  start: LatLng,
  distanceMeters: number,
  bearingDeg: number
): LatLng {
  const angDist = distanceMeters / EARTH_RADIUS_M;
  const bearing = bearingDeg * DEG2RAD;
  const lat1 = start.lat * DEG2RAD;
  const lng1 = start.lng * DEG2RAD;

  const sinLat2 =
    Math.sin(lat1) * Math.cos(angDist) +
    Math.cos(lat1) * Math.sin(angDist) * Math.cos(bearing);
  const lat2 = Math.asin(sinLat2);
  const y = Math.sin(bearing) * Math.sin(angDist) * Math.cos(lat1);
  const x = Math.cos(angDist) - Math.sin(lat1) * sinLat2;
  const lng2 = lng1 + Math.atan2(y, x);

  return {
    lat: lat2 * RAD2DEG,
    lng: ((lng2 * RAD2DEG + 540) % 360) - 180, // normalize to [-180, 180]
  };
}

/** Linear-interpolate between two headings, taking the shortest way around the compass. */
export function lerpHeading(a: number, b: number, t: number): number {
  let diff = ((b - a + 540) % 360) - 180; // shortest signed delta
  return (a + diff * t + 360) % 360;
}

/** Clamp a value to [min, max]. */
export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/** Format a coordinate for display, fixed decimals. */
export function fmtCoord(v: number): string {
  return v.toFixed(6);
}
