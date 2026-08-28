/**
 * Location picker — lets the user choose a starting location for the demo.
 * Provides a set of preset locations and supports clicking on the map.
 */

import { MapPin } from "lucide-react";
import type { LatLng } from "@/utils/geo";

export interface PresetLocation {
  name: string;
  pos: LatLng;
}

export const PRESETS: PresetLocation[] = [
  { name: "IIT Bombay Gate", pos: { lat: 19.1334, lng: 72.9134 } },
  { name: "India Gate, Delhi", pos: { lat: 28.6129, lng: 77.2295 } },
  { name: "Marine Drive, Mumbai", pos: { lat: 18.9436, lng: 72.8236 } },
  { name: "Connaught Place, Delhi", pos: { lat: 28.6315, lng: 77.2167 } },
  { name: "Current GPS", pos: { lat: 0, lng: 0 } },
];

interface LocationPickerProps {
  selected: LatLng;
  onPick: (pos: LatLng) => void;
  pickMode: boolean;
  onTogglePick: () => void;
}

export function LocationPicker({ selected, onPick, pickMode, onTogglePick }: LocationPickerProps) {
  return (
    <div className="rounded-xl bg-slate-800/60 border border-slate-700/50 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-300 flex items-center gap-2">
          <MapPin className="w-4 h-4 text-cyan-400" /> Start Location
        </span>
        <button
          onClick={onTogglePick}
          className={`text-[11px] px-2 py-1 rounded-md border transition ${
            pickMode
              ? "bg-cyan-600 border-cyan-400 text-white"
              : "bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600"
          }`}
        >
          {pickMode ? "Click map to set" : "Pick on map"}
        </button>
      </div>
      <div className="text-[11px] text-slate-500 tabular-nums">
        {selected.lat.toFixed(5)}, {selected.lng.toFixed(5)}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((p) => (
          <button
            key={p.name}
            onClick={() => onPick(p.pos)}
            className="text-[11px] px-2 py-1 rounded-md bg-slate-900/50 border border-slate-700/50 text-slate-300 hover:bg-slate-700 hover:text-white transition"
          >
            {p.name}
          </button>
        ))}
      </div>
    </div>
  );
}
