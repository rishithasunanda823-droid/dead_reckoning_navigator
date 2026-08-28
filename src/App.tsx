/**
 * App — the navigation dashboard orchestration.
 *
 * State machine:
 *   idle ──Start──▶ gps (live GPS fixes drive the marker)
 *   gps  ──Lose──▶ dr  (Dead Reckoning drives the marker from sensors/sim)
 *   dr   ──Restore──▶ gps (snap to GPS fix, measure error, continue)
 *
 * Sensor data (real or simulated) flows through the DeadReckoningEngine,
 * which produces the estimated position that the map displays.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigation, Radio, Sparkles } from "lucide-react";

import { MapView, type MapState } from "@/components/MapView";
import { StatusPanel } from "@/components/StatusPanel";
import { StatsCards } from "@/components/StatsCards";
import { SensorPanel } from "@/components/SensorPanel";
import { Controls } from "@/components/Controls";
import { LocationPicker, PRESETS } from "@/components/LocationPicker";

import { gpsService, type GpsStatus } from "@/services/gps";
import { useSensors, type MotionData, type OrientationData } from "@/sensors/useSensors";
import { DeadReckoningEngine } from "@/algorithms/deadReckoning";
import { SimulationEngine } from "@/simulation/SimulationEngine";
import { classifyActivity, type Activity } from "@/algorithms/activityRecognition";
import { haversineDistance, type LatLng } from "@/utils/geo";

type Mode = "idle" | "gps" | "dr";

export default function App() {
  const sensors = useSensors();

  const [gpsStatus, setGpsStatus] = useState<GpsStatus>("idle");
  const [mode, setMode] = useState<Mode>("idle");
  const [navActive, setNavActive] = useState(false);
  const [gpsLost, setGpsLost] = useState(false);
  const [simulation, setSimulation] = useState(false);
  const [pickMode, setPickMode] = useState(false);

  const [startPos, setStartPos] = useState<LatLng>(PRESETS[0].pos);
  const [position, setPosition] = useState<LatLng>(PRESETS[0].pos);
  const [heading, setHeading] = useState(0);
  const [steps, setSteps] = useState(0);
  const [distance, setDistance] = useState(0);
  const [accuracy, setAccuracy] = useState<number | undefined>(undefined);
  const [error, setError] = useState<number | null>(null);
  const [activity, setActivity] = useState<Activity>("Stationary");
  const [drRoute, setDrRoute] = useState<LatLng[]>([]);
  const [truthRoute, setTruthRoute] = useState<LatLng[]>([]);
  const [gpsCompare, setGpsCompare] = useState<LatLng | null>(null);
  const [showCompare, setShowCompare] = useState(false);
  const [follow, setFollow] = useState(true);

  const drRef = useRef<DeadReckoningEngine | null>(null);
  const simRef = useRef<SimulationEngine | null>(null);
  const activityWindowRef = useRef<{ steps: number; t: number; headingStart: number; accel: number[] }>({
    steps: 0,
    t: Date.now(),
    headingStart: 0,
    accel: [],
  });

  // Subscribe to GPS status.
  useEffect(() => {
    return gpsService.onStatus((s) => setGpsStatus(s));
  }, []);

  // Subscribe to GPS fixes — drive the position while in GPS mode.
  useEffect(() => {
    return gpsService.onFix((fix) => {
      if (mode !== "gps") return;
      setPosition({ lat: fix.lat, lng: fix.lng });
      setAccuracy(fix.accuracy);
      // Keep the DR engine synced to the GPS fix so it's ready to take over,
      // without resetting step/distance counters.
      drRef.current?.syncPosition({ lat: fix.lat, lng: fix.lng });
    });
  }, [mode]);

  // Feed sensor data into the DR engine + activity classifier (when in DR mode).
  useEffect(() => {
    if (mode !== "dr") return;
    const m = sensors.motion;
    const o = sensors.orientation;
    if (!m) return;

    const dr = drRef.current;
    if (!dr) return;

    // Feed heading
    if (o && o.alpha !== null) {
      dr.feedHeading({ compass: o.alpha, gyroZ: m.gyro.z, t: m.t });
      setHeading(dr.state.heading);
    } else {
      dr.feedHeading({ compass: null, gyroZ: m.gyro.z, t: m.t });
      setHeading(dr.state.heading);
    }

    // Feed accelerometer + detect steps
    const advanced = dr.feedAccel({
      x: m.accel.x,
      y: m.accel.y,
      z: m.accel.z,
      t: m.t,
    });

    // Track activity features
    const win = activityWindowRef.current;
    win.accel.push(Math.sqrt(m.accel.x ** 2 + m.accel.y ** 2 + m.accel.z ** 2) - 9.81);
    if (win.accel.length > 50) win.accel.shift();

    if (advanced) {
      setPosition({ ...dr.state.position });
      setSteps(dr.state.steps);
      setDistance(dr.state.distance);
      setDrRoute((r) => [...r, { ...dr.state.position }]);
      win.steps += 1;
    }

    // Recompute activity every ~1s
    const now = Date.now();
    if (now - win.t > 1000) {
      const elapsed = (now - win.t) / 1000;
      const variance =
        win.accel.length > 1
          ? win.accel.reduce((s, v) => s + v * v, 0) / win.accel.length
          : 0;
      const headingDelta = Math.abs(((dr.state.heading - win.headingStart + 540) % 360) - 180);
      const act = classifyActivity({
        stepCount: win.steps,
        windowSec: elapsed,
        accelVariance: variance,
        headingDelta,
      });
      setActivity(act);
      win.steps = 0;
      win.t = now;
      win.headingStart = dr.state.heading;
    }
  }, [mode, sensors.motion, sensors.orientation]);

  // ---- Actions ----

  const handleStart = useCallback(async () => {
    // Request sensor permissions (iOS) — must be from a user gesture.
    await sensors.requestPermission();

    const start = startPos;
    drRef.current = new DeadReckoningEngine(start);
    setPosition(start);
    setHeading(0);
    setSteps(0);
    setDistance(0);
    setActivity("Stationary");
    setDrRoute([start]);
    setTruthRoute([start]);
    setError(null);
    setShowCompare(false);
    setGpsCompare(null);
    setNavActive(true);
    setGpsLost(false);

    // Try real GPS first.
    const ok = gpsService.start();
    if (ok) {
      setMode("gps");
    } else {
      // No GPS available — go straight to DR (desktop demo).
      setMode("dr");
      setGpsLost(true);
    }
  }, [startPos, sensors]);

  const handleLoseGps = useCallback(() => {
    gpsService.lose();
    setGpsLost(true);
    setMode("dr");
    setShowCompare(false);
    setGpsCompare(null);
    // Seed the DR engine at the current position if it isn't already.
    if (drRef.current) {
      drRef.current.reset(position);
      setDrRoute([position]);
    }
  }, [position]);

  const handleRestoreGps = useCallback(async () => {
    // Capture the DR position BEFORE correction for the comparison overlay.
    const drPos = drRef.current ? { ...drRef.current.state.position } : position;
    setGpsCompare(drPos);
    setShowCompare(true);

    try {
      const fix = await gpsService.once();
      // Measure the error between DR and GPS.
      const err = drRef.current ? drRef.current.correctTo(fix) : haversineDistance(drPos, fix);
      setError(err);
      setGpsLost(false);
      setMode("gps");
      setPosition({ lat: fix.lat, lng: fix.lng });
      setAccuracy(fix.accuracy);
      setDrRoute((r) => [...r, { lat: fix.lat, lng: fix.lng }]);
      gpsService.restore();
    } catch {
      // If GPS still unavailable, just snap to the truth (sim) position.
      if (simRef.current) {
        const truth = simRef.current.getTruthPosition();
        const err = drRef.current ? drRef.current.correctTo(truth) : 0;
        setError(err);
        setMode("gps");
        setPosition(truth);
      }
    }
  }, [position]);

  const handleReset = useCallback(() => {
    gpsService.stop();
    simRef.current?.stop();
    setNavActive(false);
    setGpsLost(false);
    setMode("idle");
    setSimulation(false);
    setSteps(0);
    setDistance(0);
    setHeading(0);
    setActivity("Stationary");
    setError(null);
    setDrRoute([]);
    setTruthRoute([]);
    setShowCompare(false);
    setGpsCompare(null);
    setAccuracy(undefined);
    setPosition(startPos);
    drRef.current = null;
    simRef.current = null;
  }, [startPos]);

  const handleToggleSimulation = useCallback(() => {
    if (simulation) {
      simRef.current?.stop();
      simRef.current = null;
      setSimulation(false);
      return;
    }
    if (!navActive) return; // only meaningful during navigation
    const sim = new SimulationEngine(
      {
        start: position,
        speed: 1.4, // ~5 km/h walking
        stepLength: 0.73,
        driftDegPerSec: 0.4, // small heading drift to accumulate error
      },
      ({ motion, orientation }) => {
        sensors.injectMotion(motion);
        sensors.injectOrientation(orientation);
      }
    );
    simRef.current = sim;
    sim.start();
    setSimulation(true);
  }, [simulation, navActive, position, sensors]);

  const handleTurn = useCallback(
    (deg: number) => {
      if (simRef.current) {
        const newH = (simRef.current.getHeading() + deg + 360) % 360;
        simRef.current.setHeading(newH);
      } else if (drRef.current) {
        const newH = (drRef.current.state.heading + deg + 360) % 360;
        drRef.current.setHeading(newH);
        setHeading(newH);
      }
    },
    []
  );

  const handlePick = useCallback(
    (pos: LatLng) => {
      setStartPos(pos);
      setPickMode(false);
      if (!navActive) setPosition(pos);
    },
    [navActive]
  );

  // ---- Map state memo ----
  const mapState: MapState = useMemo(
    () => ({
      position,
      mode,
      accuracy,
      heading,
      drRoute,
      truthRoute,
      gpsCompare,
      showCompare,
      follow,
    }),
    [position, mode, accuracy, heading, drRoute, truthRoute, gpsCompare, showCompare, follow]
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-slate-950/80 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <Navigation className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold leading-tight">Dead Reckoning Navigator</h1>
              <p className="text-[11px] text-slate-400 leading-tight">AI/ML-based Intelligent PDR · SIH Prototype</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-[11px]">
            <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-slate-800 border border-slate-700">
              <Radio className="w-3 h-3 text-cyan-400" /> {mode === "idle" ? "Idle" : mode === "gps" ? "GPS" : "DR"}
            </span>
            <button
              onClick={() => setFollow((f) => !f)}
              className={`px-2 py-1 rounded-full border transition ${
                follow ? "bg-cyan-600 border-cyan-400 text-white" : "bg-slate-800 border-slate-700 text-slate-300"
              }`}
            >
              {follow ? "Following" : "Free pan"}
            </button>
          </div>
        </div>
      </header>

      {/* Main grid */}
      <main className="max-w-7xl mx-auto px-4 py-4 grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-4">
        {/* Map column */}
        <div className="flex flex-col gap-3">
          <div className="h-[55vh] lg:h-[calc(100vh-160px)]">
            <MapView state={mapState} onMapClick={handlePick} pickMode={pickMode} />
          </div>
          <StatusPanel gps={gpsStatus} navigation={navActive ? "active" : "stopped"} mode={mode} activity={activity} />
        </div>

        {/* Sidebar */}
        <aside className="flex flex-col gap-3">
          <Controls
            navActive={navActive}
            gpsLost={gpsLost}
            simulation={simulation}
            canRestore={navActive && gpsLost}
            onStart={handleStart}
            onLoseGps={handleLoseGps}
            onRestoreGps={handleRestoreGps}
            onReset={handleReset}
            onToggleSimulation={handleToggleSimulation}
            onTurn={handleTurn}
          />
          <StatsCards
            lat={position.lat}
            lng={position.lng}
            steps={steps}
            distance={distance}
            heading={heading}
            activity={activity}
            error={error}
          />
          <SensorPanel status={sensors.status} motion={sensors.motion} orientation={sensors.orientation} />
          <LocationPicker
            selected={startPos}
            onPick={handlePick}
            pickMode={pickMode}
            onTogglePick={() => setPickMode((p) => !p)}
          />
          <DemoBanner />
        </aside>
      </main>
    </div>
  );
}

function DemoBanner() {
  return (
    <div className="rounded-xl bg-gradient-to-br from-cyan-900/40 to-blue-900/30 border border-cyan-700/40 p-3 text-[12px] text-slate-300">
      <div className="flex items-center gap-1.5 font-semibold text-cyan-300 mb-1">
        <Sparkles className="w-3.5 h-3.5" /> Demo Scenario
      </div>
      <ol className="list-decimal list-inside space-y-0.5 text-slate-400">
        <li>Pick a start location → Start Navigation</li>
        <li>Click Simulate GPS Loss → marker turns amber (DR)</li>
        <li>Start Sim → marker moves from synthetic steps</li>
        <li>Turn ±45° to change direction, watch the route</li>
        <li>Restore GPS → see error + correction</li>
      </ol>
    </div>
  );
}
