/**
 * Status panel — the compact "at a glance" indicator strip.
 * Shows GPS status, navigation state, and current positioning mode.
 */

import { Satellite, Navigation, Compass, Activity } from "lucide-react";
import type { GpsStatus } from "@/services/gps";

interface StatusPanelProps {
  gps: GpsStatus;
  navigation: "active" | "stopped";
  mode: "gps" | "dr" | "idle";
  activity: string;
}

function dot(color: string) {
  return (
    <span className="relative flex h-2.5 w-2.5">
      <span className={`absolute inline-flex h-full w-full rounded-full ${color} opacity-60 animate-ping`} />
      <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${color}`} />
    </span>
  );
}

export function StatusPanel({ gps, navigation, mode, activity }: StatusPanelProps) {
  const gpsOk = gps === "active";
  const navActive = navigation === "active";

  const rows = [
    {
      icon: <Satellite className="w-4 h-4" />,
      label: "GPS",
      value: gps === "active" ? "Available" : gps === "lost" ? "Lost" : gps === "acquiring" ? "Acquiring" : gps === "denied" ? "Denied" : "Unavailable",
      color: gpsOk ? "text-emerald-400" : "text-rose-400",
      dot: gpsOk ? "bg-emerald-400" : "bg-rose-400",
    },
    {
      icon: <Navigation className="w-4 h-4" />,
      label: "Navigation",
      value: navActive ? "Active" : "Stopped",
      color: navActive ? "text-cyan-400" : "text-slate-400",
      dot: navActive ? "bg-cyan-400" : "bg-slate-500",
    },
    {
      icon: <Compass className="w-4 h-4" />,
      label: "Mode",
      value: mode === "gps" ? "GPS" : mode === "dr" ? "Dead Reckoning" : "Idle",
      color: mode === "gps" ? "text-emerald-400" : mode === "dr" ? "text-amber-400" : "text-slate-400",
      dot: mode === "gps" ? "bg-emerald-400" : mode === "dr" ? "bg-amber-400" : "bg-slate-500",
    },
    {
      icon: <Activity className="w-4 h-4" />,
      label: "Activity",
      value: activity,
      color: "text-violet-300",
      dot: "bg-violet-400",
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      {rows.map((r) => (
        <div
          key={r.label}
          className="flex items-center gap-2 rounded-xl bg-slate-800/60 border border-slate-700/50 px-3 py-2"
        >
          <span className="text-slate-400">{r.icon}</span>
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wider text-slate-500">{r.label}</div>
            <div className={`flex items-center gap-1.5 text-sm font-semibold ${r.color}`}>
              {dot(r.dot)}
              <span className="truncate">{r.value}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
