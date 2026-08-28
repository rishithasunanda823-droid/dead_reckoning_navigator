# AI/ML-Based Intelligent Dead Reckoning System for Seamless Navigation

A mobile-friendly navigation prototype that estimates and displays a user's position when GPS becomes unavailable, using smartphone motion sensors and Pedestrian Dead Reckoning (PDR). Built for the **Smart India Hackathon (SIH)**.

The app works **with real sensors** (on a phone) and **without them** (on a desktop) thanks to a built-in Simulation Mode that feeds synthetic motion data through the *same* algorithms the real sensors use — so the demo behaves like a real navigation session, not just numbers changing on screen.

---

## Quick Start

```bash
npm install
npm run dev
```

Open the printed URL on your phone (same Wi-Fi network) or desktop. No paid APIs required — maps use free OpenStreetMap tiles.

### Requirements
- Node 18+
- A modern browser. For real sensors: a phone with Chrome/Edge/Safari (iOS 13+ requires granting motion permission via the Start button).

---

## Folder Structure

```
src/
  algorithms/
    stepDetection.ts       # Step detection from accelerometer (hysteresis + low-pass filter)
    headingEstimator.ts     # Compass + gyro complementary filter for heading
    activityRecognition.ts  # Rule-based classifier: Stationary/Walking/Running/Turning
    deadReckoning.ts        # PDR engine: New Position = Previous + Distance + Heading
  sensors/
    useSensors.ts           # React hook bridging DeviceMotion/DeviceOrientation events
  services/
    gps.ts                  # Wrapper around the browser Geolocation API
  simulation/
    SimulationEngine.ts     # Synthetic pedestrian motion (desktop demo)
  components/
    MapView.tsx             # Leaflet/OpenStreetMap map (markers, routes, accuracy circle)
    StatusPanel.tsx         # GPS / Navigation / Mode / Activity status strip
    StatsCards.tsx          # Lat, Lng, Steps, Distance, Heading, Activity, Error
    SensorPanel.tsx         # Raw accelerometer/gyro/orientation readout
    Controls.tsx            # Start / Lose GPS / Restore GPS / Reset / Sim / Turn
    LocationPicker.tsx      # Preset + click-on-map start location
  utils/
    geo.ts                  # Haversine distance, bearing, destination-point math
  App.tsx                   # Dashboard orchestration + state machine
  main.tsx, index.css       # Entry point + Tailwind
```

---

## How the Dead Reckoning Algorithm Works

Pedestrian Dead Reckoning (PDR) estimates position by integrating motion from the last known GPS fix:

```
New Position = Previous Position + Distance × Heading
```

### 1. Step Detection (`algorithms/stepDetection.ts`)
Each footfall produces a spike in acceleration magnitude. We:
1. Compute `|a| = sqrt(x² + y² + z²)` and subtract gravity (9.81 m/s²) → dynamic component.
2. Low-pass filter it to suppress sensor noise.
3. Detect a step with **hysteresis**: the signal must cross a high threshold, then drop below a low threshold before the next step can register. This prevents one spike being counted twice.
4. Enforce a minimum step interval (cadence limit) so noise bursts don't register as impossible running.

### 2. Step Length (`estimateStepLength`)
Step length ≈ `0.415 × body height`. Without a known height we default to **0.73 m** (average adult walking step).

### 3. Heading Estimation (`algorithms/headingEstimator.ts`)
A **complementary filter** fuses:
- The **compass** (`deviceorientationabsolute.alpha`) — accurate but noisy/jumpy
- The **gyroscope** z-rotation rate — smooth between fixes but drifts over time

`heading = α·compass + (1−α)·(heading + gyroΔ)` with α = 0.95 (trust the compass more).

### 4. Position Update (`algorithms/deadReckoning.ts`)
For every detected step:
1. Estimate distance = step length.
2. Obtain heading from the estimator.
3. Convert displacement into a lat/lng delta using the **spherical destination-point formula** (in `utils/geo.ts`), which correctly accounts for Earth's curvature and meridian convergence at higher latitudes.
4. Update the position and append it to the route polyline.

### 5. Error Correction (`handleRestoreGps` in `App.tsx`)
When GPS returns:
1. Capture the DR position *before* correction.
2. Get a fresh GPS fix.
3. Compute the Haversine distance between DR and GPS → **positioning error**.
4. Snap the DR engine to the GPS fix (recalibration).
5. Show both markers + a red dashed line on the map so the error is visible.

---

## The AI/ML Component (`algorithms/activityRecognition.ts`)

The "AI" part is **pedestrian activity recognition** — classifying the user's motion into `Stationary`, `Walking`, `Running`, or `Turning`.

We extract features over a 1-second sliding window:
- **Step cadence** (steps/sec)
- **Acceleration variance** (motion energy)
- **Heading change rate** (turning)

A **rule-based decision-tree classifier** maps features → activity. This is intentionally explainable (a judge can read the rules), and the feature extraction mirrors what a trained model would consume. Swapping in a trained **Random Forest / SVM / small neural net** trained on labeled sensor data is a drop-in change to `classifyActivity()`. See the file header for the rationale.

---

## SIH Demo Instructions

### On a desktop (Simulation Mode)
1. Pick a start location (preset button or "Pick on map" → click the map).
2. Click **Start Navigation**. The marker shows the GPS position (green).
3. Click **Simulate GPS Loss**. The marker turns amber (Dead Reckoning).
4. Click **Start Sim**. Synthetic walking motion feeds the real step detector — the marker moves, steps/distance/heading update, the route draws.
5. Click **Turn ±45°** to change direction. Watch the route curve.
6. Let it run ~20–30 seconds to accumulate drift.
7. Click **Restore GPS**. You'll see the green GPS marker, the red DR marker, and a dashed line between them = the **positioning error**. The stats card shows the error in meters.
8. The position corrects to GPS. Continue navigation.
9. Click **Reset Navigation** to clear and restart.

### On an Android phone (real sensors)
1. Serve the app over HTTPS (Bolt's preview URL works, or use `npm run dev -- --host` and open via your machine's LAN IP on the same Wi-Fi).
2. Open the URL on the phone.
3. Click **Start Navigation** → grant Location and Motion/Orientation permissions when prompted.
4. Walk outdoors to get a GPS fix (green marker).
5. Click **Simulate GPS Loss** → the marker turns amber.
6. Hold the phone and walk. Real accelerometer/compass data drives step detection and heading — the marker moves with you.
7. Watch the stats: steps increment, distance grows, heading follows your direction, activity switches between Walking/Stationary/Turning.
8. Click **Restore GPS** to measure the accumulated error and recalibrate.

### Testing on Android
- Use Chrome or Edge on Android 6+.
- The page **must be served over HTTPS** for `DeviceMotion`/`DeviceOrientation` to fire. Bolt's preview is HTTPS; if running locally, use a tool like `ngrok` or `vite --host` + `--https`.
- Grant motion permission via the Start button (iOS 13+) — it must be triggered by a user gesture.
- Hold the phone reasonably steady; the step detector is tuned for hand-held or pocket carry.

---

## Technical Stack
- **React + Vite + TypeScript** — fast, modern, no paid services.
- **Leaflet + OpenStreetMap** — free, interactive maps (no API key).
- **Browser Geolocation API** — real GPS.
- **DeviceMotionEvent / DeviceOrientationEvent** — accelerometer, gyroscope, compass.
- **Tailwind CSS** — responsive, mobile-first UI.
- **lucide-react** — icons.

## Scripts
```bash
npm install      # install dependencies
npm run dev      # start the dev server
npm run build    # production build
npm run typecheck
```

## Notes
- On desktop, sensor events don't fire — that's why Simulation Mode exists. It generates realistic accelerometer/orientation samples that flow through the *same* `StepDetector` and `HeadingEstimator` as real data, so the entire pipeline is exercised.
- The simulation adds a small heading drift so the DR position diverges from the ground truth — making the error visible when GPS is restored.
- No Supabase / backend is required for this prototype; it runs entirely in the browser.
