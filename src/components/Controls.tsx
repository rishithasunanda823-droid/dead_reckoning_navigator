/**
 * Navigation controls — the primary action buttons.
 * Every button here performs a real action in the app logic (see App.tsx).
 */

import {
  Play,
  WifiOff,
  Satellite,
  RotateCcw,
  Hand,
  Footprints,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

interface ControlsProps {
  navActive: boolean;
  gpsLost: boolean;
  simulation: boolean;
  canRestore: boolean;
  onStart: () => void;
  onLoseGps: () => void;
  onRestoreGps: () => void;
  onReset: () => void;
  onToggleSimulation: () => void;
  onTurn: (deg: number) => void;
}

function Btn({
  onClick,
  disabled,
  variant,
  icon,
  label,
}: {
  onClick: () => void;
  disabled?: boolean;
  variant: "primary" | "danger" | "success" | "neutral" | "ghost";
  icon: React.ReactNode;
  label: string;
}) {
  const variants = {
    primary: "bg-cyan-600 hover:bg-cyan-500 text-white border-cyan-400/50",
    danger: "bg-rose-600 hover:bg-rose-500 text-white border-rose-400/50",
    success: "bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400/50",
    neutral: "bg-slate-700 hover:bg-slate-600 text-slate-100 border-slate-500/50",
    ghost: "bg-slate-800/60 hover:bg-slate-700 text-slate-300 border-slate-700",
  } as const;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold border transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] ${variants[variant]}`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

export function Controls({
  navActive,
  gpsLost,
  simulation,
  canRestore,
  onStart,
  onLoseGps,
  onRestoreGps,
  onReset,
  onToggleSimulation,
  onTurn,
}: ControlsProps) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <Btn
          onClick={onStart}
          disabled={navActive}
          variant="primary"
          icon={<Play className="w-4 h-4" />}
          label="Start Navigation"
        />
        <Btn
          onClick={onLoseGps}
          disabled={!navActive || gpsLost}
          variant="danger"
          icon={<WifiOff className="w-4 h-4" />}
          label="Simulate GPS Loss"
        />
        <Btn
          onClick={onRestoreGps}
          disabled={!canRestore}
          variant="success"
          icon={<Satellite className="w-4 h-4" />}
          label="Restore GPS"
        />
        <Btn
          onClick={onReset}
          variant="neutral"
          icon={<RotateCcw className="w-4 h-4" />}
          label="Reset Navigation"
        />
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Btn
          onClick={onToggleSimulation}
          variant={simulation ? "primary" : "ghost"}
          icon={<Footprints className="w-4 h-4" />}
          label={simulation ? "Stop Sim" : "Start Sim"}
        />
        <Btn
          onClick={() => onTurn(-45)}
          disabled={!navActive}
          variant="ghost"
          icon={<ChevronLeft className="w-4 h-4" />}
          label="Turn −45°"
        />
        <Btn
          onClick={() => onTurn(45)}
          disabled={!navActive}
          variant="ghost"
          icon={<ChevronRight className="w-4 h-4" />}
          label="Turn +45°"
        />
      </div>

      {simulation && (
        <div className="flex items-center gap-2 text-[11px] text-slate-400 rounded-lg bg-slate-900/40 border border-slate-700/40 px-3 py-2">
          <Hand className="w-3.5 h-3.5 text-cyan-400" />
          Simulation active: synthetic sensor data is feeding the real step detector and heading estimator.
        </div>
      )}
    </div>
  );
}
