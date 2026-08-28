/**
 * Map view — an interactive Leaflet/OpenStreetMap map.
 *
 * We use plain Leaflet (not react-leaflet) for direct imperative control of
 * markers and polylines, which is the easiest way to update them at ~50 Hz
 * without React re-render overhead.
 *
 * Layers:
 *  - position marker (color-coded by mode: green = GPS, amber = Dead Reckoning)
 *  - accuracy circle (GPS fix uncertainty)
 *  - DR route polyline (estimated path)
 *  - truth route polyline (simulation ground truth, dashed)
 *  - GPS-vs-DR comparison markers when GPS is restored
 */

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { LatLng } from "@/utils/geo";

export interface MapState {
  position: LatLng;
  mode: "gps" | "dr" | "idle";
  accuracy?: number;
  heading?: number;
  drRoute: LatLng[];
  truthRoute: LatLng[];
  gpsCompare?: LatLng | null;
  showCompare: boolean;
  follow: boolean;
}

interface MapViewProps {
  state: MapState;
  onMapClick?: (latlng: LatLng) => void;
  pickMode?: boolean;
}

// Custom div-icon marker that rotates to show heading.
function makeMarkerIcon(color: string, heading = 0): L.DivIcon {
  return L.divIcon({
    className: "nav-marker",
    html: `<div style="transform: rotate(${heading}deg);">
      <svg width="34" height="34" viewBox="0 0 34 34" xmlns="http://www.w3.org/2000/svg">
        <circle cx="17" cy="17" r="15" fill="${color}" fill-opacity="0.25" stroke="${color}" stroke-width="2"/>
        <path d="M17 6 L22 20 L17 16 L12 20 Z" fill="${color}"/>
      </svg>
    </div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });
}

export function MapView({ state, onMapClick, pickMode }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const accCircleRef = useRef<L.Circle | null>(null);
  const drRouteRef = useRef<L.Polyline | null>(null);
  const truthRouteRef = useRef<L.Polyline | null>(null);
  const gpsMarkerRef = useRef<L.Marker | null>(null);
  const drCompareMarkerRef = useRef<L.Marker | null>(null);
  const compareLineRef = useRef<L.Polyline | null>(null);
  const clickHandlerRef = useRef(onMapClick);

  // Keep latest click handler without re-creating the map.
  useEffect(() => {
    clickHandlerRef.current = onMapClick;
  }, [onMapClick]);

  // Initialize the map once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      center: [state.position.lat, state.position.lng],
      zoom: 18,
      zoomControl: true,
    });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
      maxZoom: 22,
    }).addTo(map);

    drRouteRef.current = L.polyline([], {
      color: "#f59e0b",
      weight: 3,
      opacity: 0.9,
    }).addTo(map);
    truthRouteRef.current = L.polyline([], {
      color: "#64748b",
      weight: 2,
      opacity: 0.7,
      dashArray: "6 6",
    }).addTo(map);
    compareLineRef.current = L.polyline([], {
      color: "#ef4444",
      weight: 2,
      dashArray: "4 4",
    }).addTo(map);

    map.on("click", (e: L.LeafletMouseEvent) => {
      clickHandlerRef.current?.({ lat: e.latlng.lat, lng: e.latlng.lng });
    });

    mapRef.current = map;
    // Fix tile rendering after the container gets its size.
    setTimeout(() => map.invalidateSize(), 100);

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update marker + routes when state changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const color = state.mode === "gps" ? "#10b981" : state.mode === "dr" ? "#f59e0b" : "#6366f1";

    // Position marker
    if (!markerRef.current) {
      markerRef.current = L.marker([state.position.lat, state.position.lng], {
        icon: makeMarkerIcon(color, state.heading ?? 0),
      }).addTo(map);
    } else {
      markerRef.current.setLatLng([state.position.lat, state.position.lng]);
      markerRef.current.setIcon(makeMarkerIcon(color, state.heading ?? 0));
    }

    // Accuracy circle
    if (state.accuracy && state.accuracy > 0) {
      if (!accCircleRef.current) {
        accCircleRef.current = L.circle([state.position.lat, state.position.lng], {
          radius: state.accuracy,
          color: "#10b981",
          fillColor: "#10b981",
          fillOpacity: 0.08,
          weight: 1,
        }).addTo(map);
      } else {
        accCircleRef.current.setLatLng([state.position.lat, state.position.lng]);
        accCircleRef.current.setRadius(state.accuracy);
      }
    } else if (accCircleRef.current) {
      accCircleRef.current.remove();
      accCircleRef.current = null;
    }

    // DR route
    drRouteRef.current?.setLatLngs(state.drRoute.map((p) => [p.lat, p.lng] as [number, number]));
    // Truth route
    truthRouteRef.current?.setLatLngs(state.truthRoute.map((p) => [p.lat, p.lng] as [number, number]));

    // GPS vs DR comparison overlay
    if (state.showCompare && state.gpsCompare) {
      if (!gpsMarkerRef.current) {
        gpsMarkerRef.current = L.marker([state.gpsCompare.lat, state.gpsCompare.lng], {
          icon: makeMarkerIcon("#10b981", 0),
        }).addTo(map);
      } else {
        gpsMarkerRef.current.setLatLng([state.gpsCompare.lat, state.gpsCompare.lng]);
      }
      if (!drCompareMarkerRef.current) {
        drCompareMarkerRef.current = L.marker([state.position.lat, state.position.lng], {
          icon: makeMarkerIcon("#ef4444", state.heading ?? 0),
        }).addTo(map);
      } else {
        drCompareMarkerRef.current.setLatLng([state.position.lat, state.position.lng]);
      }
      compareLineRef.current?.setLatLngs([
        [state.gpsCompare.lat, state.gpsCompare.lng],
        [state.position.lat, state.position.lng],
      ]);
    } else {
      gpsMarkerRef.current?.remove();
      gpsMarkerRef.current = null;
      drCompareMarkerRef.current?.remove();
      drCompareMarkerRef.current = null;
      compareLineRef.current?.setLatLngs([]);
    }

    // Follow the marker
    if (state.follow) {
      map.setView([state.position.lat, state.position.lng], map.getZoom(), {
        animate: true,
        duration: 0.3,
      });
    }
  }, [state]);

  return (
    <div
      ref={containerRef}
      className={`w-full h-full min-h-[320px] rounded-2xl overflow-hidden border border-slate-700/50 ${
        pickMode ? "ring-2 ring-cyan-400 cursor-crosshair" : ""
      }`}
    />
  );
}
