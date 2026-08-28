/**
 * Sensor panel — shows raw motion/orientation readings and sensor availability.
 * Useful during the demo to prove the app is reading real (or simulated) sensors.
 */

import { Activity, Compass, Cpu, Gauge } from "lucide-react";
import type { MotionData, OrientationData, SensorStatus } from "@/sensors/useSensors";

interface SensorPanelProps {
  status: SensorStatus;
  motion: MotionData | null;
  orientation: OrientationData | null;
}

function StatusBadge({ s }: { s: SensorStatus["motion"] | SensorStatus["orientation"] }) {
  const map = {
    unavailable: { txt: "Unavailable", cls: "bg-slate-700 text-slate-400" },
    denied: { txt: "Denied", cls: "bg-rose-900/60 text-rose-300" },
    active: { txt: "Active", cls: "bg-emerald-900/60 text-emerald-300" },
  } as const;
  const m = map[s as keyof typeof map];
  return <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${m.cls}`}>{m.txt}</span>;
}

export function SensorPanel({ status, motion, orientation }: SensorPanelProps) {
  return (
    <div className="rounded-xl bg-slate-800/60 border border-slate-700/50 p-3 space-y-3">
      <div className="flex items-center gap-2 text-slate-300">
        <Cpu className="w-4 h-4 text-cyan-400" />
        <span className="text-sm font-semibold">Sensor Status</span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="flex items-center justify-between rounded-lg bg-slate-900/50 px-2 py-1.5">
          <span className="flex items-center gap-1.5 text-slate-400"><Activity className="w-3.5 h-3.5" /> Motion</span>
          <StatusBadge s={status.motion} />
        </div>
        <div className="flex items-center justify-between rounded-lg bg-slate-900/50 px-2 py-1.5">
          <span className="flex items-center gap-1.5 text-slate-400"><Compass className="w-3.5 h-3.5" /> Orientation</span>
          <StatusBadge s={status.orientation} />
        </div>
      </div>

      <div className="space-y-2">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Accelerometer (m/s²)</div>
          <div className="grid grid-cols-3 gap-1.5 text-xs tabular-nums">
            <Axis label="X" value={motion?.accel.x} />
            <Axis label="Y" value={motion?.accel.y} />
            <Axis label="Z" value={motion?.accel.z} />
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Gyroscope (°/s)</div>
          <div className="grid grid-cols-3 gap-1.5 text-xs tabular-nums">
            <Axis label="X" value={motion?.gyro.x} />
            <Axis label="Y" value={motion?.gyro.y} />
            <Axis label="Z" value={motion?.gyro.z} />
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Orientation (°)</div>
          <div className="grid grid-cols-3 gap-1.5 text-xs tabular-nums">
            <Axis label="α" value={orientation?.alpha} />
            <Axis label="β" value={orientation?.beta} />
            <Axis label="γ" value={orientation?.gamma} />
          </div>
          <div className="mt-1 text-[10px] text-slate-500 flex items-center gap-1">
            <Gauge className="w-3 h-3" />
            {status.hasAbsolute ? "Absolute compass available" : "Relative orientation only"}
          </div>
        </div>
      </div>
    </div>
  );
}

function Axis({ label, value }: { label: string; value?: number | null }) {
  return (
    <div className="rounded-md bg-slate-900/60 px-2 py-1 flex items-center justify-between">
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-200">{value === undefined || value === null ? "—" : value.toFixed(2)}</span>
    </div>
  );
}
