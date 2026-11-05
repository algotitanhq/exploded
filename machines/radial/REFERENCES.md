# Radial: references

Radial is a model of a Pratt & Whitney R-2800 Double Wasp, the 18-cylinder twin-row radial of the F6F Hellcat, the
F4U Corsair, the P-47 and, after the war, the Douglas DC-6. It is built from public sources, as a **C-series CB16**
(the DC-6B's engine, single-stage two-speed supercharger, 0.45 : 1 propeller gear), and it is not affiliated with
Pratt & Whitney. Where a figure is not public, the model uses a plausible value, listed below under **[E]**.

The letters match the comments in [`r2800-shared/engine.js`](r2800-shared/engine.js), the one file every pose,
gauge and sound reads its numbers from.

## Sources

- **[F]** FAA, Type Certificate Data Sheet **6A3**, Douglas DC-6A / DC-6B, revision 28
  ([copy on enginehistory.org](https://www.enginehistory.org/Operations/WaterInjServErrors/6A3Rev28.pdf)). Engine
  limits of the P&W Double Wasp CB-16: take-off (two minutes, dry) 2,050 hp at 2,700 rpm and 55.0 inHg; take-off wet
  (water-alcohol) 2,400 hp at 2,800 rpm and 59.5 inHg; maximum continuous 1,800 hp at 2,600 rpm and 48.5 inHg;
  impeller gear ratios 7.29 : 1 (low) and 8.58 : 1 (high); ".45:1 propeller reduction gearing". The film climbs to
  the dry take-off point.
- **[N]** Smithsonian National Air and Space Museum,
  [Pratt & Whitney Double Wasp R-2800 CB16](https://airandspace.si.edu/collection-objects/pratt-whitney-double-wasp-r-2800-cb16-2-row-radial-18-engine/nasm_A19580058000)
  (A19580058000): weight 1,068 kg (2,350 lb), diameter 52.8 in, length 81.4 in, gear-driven single-stage two-speed
  supercharger, 2,400 hp at 2,800 rpm.
- **[W]** K. McCutcheon, [Pratt & Whitney Double Wasp (R-2800)](https://enginehistory.org/Piston/P&W/R-2800/r-2800.shtml),
  Aircraft Engine Historical Society: bore 5.75 in, stroke 6.000 in, 2,804.5 in³; two master rod assemblies, each a
  one-piece master rod and eight "I"-section articulated rods on knuckle pins; a crankshaft of three steel forgings
  joined at the crankpins; forged aluminium heads screwed and shrunk on forged steel barrels, finned aluminium muffs;
  one inlet and one exhaust valve per cylinder; valve gear and ignition "substantially the same as the Twin Wasp".
  The C series' compression ratio, 6.75 : 1, is from the
  [R-2800 article](https://en.wikipedia.org/wiki/Pratt_%26_Whitney_R-2800_Double_Wasp) (Wikipedia, citing the
  manufacturer's data).
- **[H]** FAA, *Aviation Maintenance Technician Handbook, Powerplant* (FAA-H-8083-32), the chapters on radial
  engines: the firing order numbers of an 18-cylinder twin-row radial are **+11 and −7**, which gives
  1-12-5-16-9-2-13-6-17-10-3-14-7-18-11-4-15-8; cylinders numbered clockwise from the top of the rear row, seen from
  the rear, odd in the rear row; a nine-cylinder row's cam ring has 4 lobes per track and turns against the crank
  (a lobe every 90°, at ⅛ crank speed). Copies of those pages:
  [firing order](https://www.aircraftsystemstech.com/p/firingorder-firing-order-of-engine-is.html),
  [valve operating mechanism](https://aircraftsystemstech.com/p/valveoperating-mechanism-for.html).

The geometry was built against photographs of real engines (Wikimedia Commons):
[a sectioned R-2800](https://commons.wikimedia.org/wiki/File:Cross_Section_of_a_Pratt_and_Whitney_R2800_Double_Wasp.JPG)
(the profile in section: nose case and reduction gear, both rows, master rods, crank, impeller),
[an R-2800 on its stand](https://commons.wikimedia.org/wiki/File:HARP_Pratt_%26_Whitney_R-2800_Double_Wasp.JPG)
(nose, magnetos, harness ring, pushrod tubes, baffles),
[the R-2800-21 at the National Museum of the USAF](https://commons.wikimedia.org/wiki/File:Pratt_%26_Whitney_R-2800-21_USAF.jpg)
(the star from the front, black intake pipes, aluminium rocker boxes) and
[an R-2800 in profile](https://commons.wikimedia.org/wiki/File:20-09-083-R_2800.jpg) (the long supercharger and
accessory section). They belong to their authors and are not in this repository.

## Estimates **[E]**

Not public, or not found in a primary source; chosen to be plausible:

| Figure | Value | Why |
|---|---|---|
| Master rod, crankpin to piston pin | 292 mm (11.5 in) | about 3.8 crank throws; fits the 1,341 mm diameter with the heads and rocker boxes |
| Knuckle-pin circle | 60.3 mm (2.375 in) | just outside the 92 mm crankpin and its bearing |
| Articulated rod | 231.7 mm (master − knuckle circle) | the usual first choice; the knuckle pins sit at exactly 40° steps (see below) |
| Master rods in cylinders | 13 (rear row), 8 (front row) | not found in the sources above |
| Row spacing along the axis | 210 mm | the reference photos |
| Valve timing | inlet 20° BTDC – 60° ABDC, exhaust 50° BBDC – 20° ATDC | typical of the period; lift 15.9 mm |
| Spark | 25° before top centre | typical |
| Idle, starter cranking | 700 rpm, 140 rpm | typical |
| Propeller | three blades, 4.0 m | a Hamilton Standard of the DC-6B's size |
| Power at other speeds | the propeller absorbs P ∝ N³ through the run, 2,050 hp at 2,700 rpm | a fixed-pitch law; inertia neglected |
| Manifold pressure | bmep = k · MAP − friction (1.2 + 0.6 (N/2,700)² bar) − pumping | k set so that 2,050 hp needs 55.0 inHg exactly; the same law gives 1,702 hp at the METO point (1,800 hp [F], −5.4 %) |
| Reduction gear layout | sun 72 teeth on the crank, ring 88 fixed, carrier on the shaft | gives 0.45 exactly; P&W's tooth counts are not public |

## The model, by hand

- π/4 × 5.75² × 6 × 18 = **2,804.5 in³** (45.96 L).
- 2,050 hp = 1,528.7 kW at 2,700 rpm (282.7 rad/s): **5,407 N·m** at the crank, a brake mean effective pressure of
  14.8 bar.
- 18 firings in two turns: 9 × 2,700 / 60 = **405 firings a second**, one every 40° of crank.
- Mean piston speed 2 × 0.1524 m × 45 rev/s = **13.7 m/s**. Propeller 0.45 × 2,700 = 1,215 rpm; impeller
  7.29 × 2,700 = 19,683 rpm.
- The cam ring: each tappet needs one lift in 720° of crank; 4 lobes on a ring turning at ⅛ crank speed against it
  bring one every 90° × 8 = 720°. The model reads every valve's lift off the turning ring and check.mjs verifies it
  equals the valve timing for all 36 valves.
- **The articulated rods.** The master rod's piston follows the plain slider-crank law: stroke 152.40 mm, top centre
  when its crankpin points at it. An articulated rod hangs on a knuckle pin that orbits on the master rod's big end,
  an ellipse rather than a circle, so its piston does not: with the knuckle pins at exact 40° steps the model gives
  strokes from 152.41 to **153.08 mm**, top centres up to **3.7°** early or late and up to 2.45 mm lower, so a
  compression ratio down to 6.27 against the master's 6.75. Real engines trim the knuckle-pin positions to even this
  out; how P&W did it for the R-2800 is not in the public sources, so the page shows the uncorrected geometry and
  says so.

`node machines/radial/check.mjs` recomputes each of these from the code.
