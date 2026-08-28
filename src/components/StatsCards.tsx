/**
 * Statistics cards — the quantitative navigation readout.
 * Each card shows one key metric of the Dead Reckoning state.
 */

import { MapPin, Footprints, Ruler, Compass, Gauge, AlertTriangle } from "lucide-react";
import { fmtCoord } from "@/utils/geo";

interface StatsCardsProps {
  lat: number;
  lng: number;
  steps: number;
  distance: number;
  heading: number;
  activity: string;
  error: number | null;
}

function Card({
  icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  accent: string;
}) {
  return (
    <div className="rounded-xl bg-slate-800/60 border border-slate-700/50 p-3">
      <div className="flex items-center gap-2 text-slate-400">
        <span className={accent}>{icon}</span>
        <span className="text-[10px] uppercase tracking-wider">{label}</span>
      </div>
      <div className="mt-1 text-lg font-bold text-slate-100 tabular-nums">{value}</div>
      {sub && <div className="text-[11px] text-slate-500">{sub}</div>}
    </div>
  );
}

export function StatsCards({ lat, lng, steps, distance, heading, activity, error }: StatsCardsProps) {
  const headingLabel = `${Math.round(heading)}° ${compassDir(heading)}`;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
      <Card icon={<MapPin className="w-4 h-4" />} label="Latitude" value={fmtCoord(lat)} accent="text-cyan-400" />
      <Card icon={<MapPin className="w-4 h-4" />} label="Longitude" value={fmtCoord(lng)} accent="text-cyan-400" />
      <Card icon={<Footprints className="w-4 h-4" />} label="Steps" value={String(steps)} accent="text-amber-400" />
      <Card icon={<Ruler className="w-4 h-4" />} label="Distance" value={`${distance.toFixed(1)} m`} accent="text-emerald-400" />
      <Card icon={<Compass className="w-4 h-4" />} label="Heading" value={headingLabel} accent="text-violet-400" />
      <Card icon={<Gauge className="w-4 h-4" />} label="Activity" value={activity} accent="text-violet-300" />
      <Card
        icon={<AlertTriangle className="w-4 h-4" />}
        label="Position Error"
        value={error === null ? "—" : `${error.toFixed(2)} m`}
        accent={error === null ? "text-slate-400" : error < 3 ? "text-emerald-400" : error < 10 ? "text-amber-400" : "text-rose-400"}
        sub={error === null ? "Restore GPS to measure" : "GPS vs DR divergence"}
      />
      <Card icon={<Compass className="w-4 h-4" />} label="Mode" value={error === null ? "DR" : "Corrected"} accent="text-cyan-300" />
    </div>
  );
}

function compassDir(deg: number): string {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round(deg / 45) % 8];
}
