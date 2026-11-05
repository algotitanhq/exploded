# Rope: references

Rope is a model of the Apollo Guidance Computer Block II and its DSKY, as flown in the lunar module of Apollo 11
(Luminary 099), built from public sources: the MIT Instrumentation Lab's documents and code as preserved by the
Virtual AGC project, NASA's mission records, and the restoration work of Ken Shirriff and Marc Verdiell. It is not
affiliated with NASA, MIT or Draper. Where a figure is not public or could not be found, the model uses a plausible
value and marks it `[E]` below and in [`agc-shared/machine.js`](agc-shared/machine.js), where every number lives.

## Sources

- **[W]** [Apollo Guidance Computer](https://en.wikipedia.org/wiki/Apollo_Guidance_Computer), Wikipedia, and the
  documents it cites: 16-bit word (15 data bits + odd parity), ones' complement, 36,864 words of core rope and 2,048
  of erasable core, 2.048 MHz clock, 11.72 µs memory cycle, ~2,800 flat-packs of dual 3-input NOR gates, 32 kg
  (70 lb), 55 W, 61 × 32 × 17 cm (24 × 12.5 × 6.5 in), green electroluminescent seven-segment digits.
- **[S]** Ken Shirriff, [Software woven into wire: core rope and the Apollo Guidance Computer](https://www.righto.com/2019/07/software-woven-into-wire-core-rope-and.html)
  (2019): 6 rope modules of 6,144 words, 512 cores each (two layers of 256), 12 words per core on 192 sense lines
  (12 strands of 16), inhibit lines that select one core, set and reset pulses, a wire through the core reads 1 and
  a wire around it reads 0; the photographs of the opened AGC (trays A and B), of tray B's modules B7-B17, of the
  inside of a rope module, and the simplified rope diagram the geometry was built against.
- **[L]** Luminary 099 (Apollo 11 LM), as transcribed by the [Virtual AGC project](https://www.ibiblio.org/apollo/)
  ([listings](https://www.ibiblio.org/apollo/listings/Luminary099/), [chrislgarry/Apollo-11](https://github.com/chrislgarry/Apollo-11)):
  - `EXECUTIVE.agc`: NOVAC2, NOVAC3, NEXTCORE, and `TC BAILOUT1` / `OCT 1202`; the assembled words and their
    addresses shown in the rope (`01,2625` to `01,2703`) are copied from the listing.
  - `ERASABLE_ASSIGNMENTS.agc`: "EIGHT SETS OF 12 REGISTERS EACH" (the core sets), five VAC areas.
  - `PINBALL_NOUN_TABLES.agc`: Noun 63 (absolute velocity, altitude rate, computed altitude), Noun 64 (time left
    for redesignation and LPD angle, altitude rate, altitude), Noun 68 (slant range to the landing site, time to go in
    the braking phase, LR altitude minus computed altitude), Noun 60.
  - `LUNAR_LANDING_GUIDANCE_EQUATIONS.agc`, `THE_LUNAR_LANDING.agc`: V06N63 in P63, V06N64 in P64, DELTAH for V16N68.
  - `ALARM_AND_ABORT.agc`: BAILOUT1's `INDEX Q` / `CAF 0`, which fetches the alarm code from the rope.
- **[E1]** Don Eyles, [Tales from the Lunar Module Guidance Computer](https://www.doneyles.com/LM/Tales.html)
  (AAS, 2004): the duty-cycle margins (over 15 % in braking, about 13 % once the landing radar's data come in, 10 %
  or less with Verb 16 Noun 68 up, below 10 % in P64), the radar's TLOSS (2 angles × up to 6,400 pulses per second,
  13 % assumed, 13.36 % measured after the flight), SERVICER every 2 s, 8 core sets and 5 VAC areas, the restart
  that keeps only the newest SERVICER and drops the uncompleted ones and the Noun 68 monitor, high gate at
  102:41:32 and 7,400 ft, P66 at 102:43:08.
- **[J]** [Apollo 11 Lunar Surface Journal](https://apollojournals.org/alsj/a11/a11.landing.html), the landing:
  the crew's altitude and speed call-outs from 5,000 ft to contact, "Delta-H is minus 2,900", the ALT light out at
  102:38:11, the altitude and velocity lights near the surface, "Contact light" at 102:45:40.
- **[R]** Apollo 11 Mission Report and NASA timeline: PDI at 102:33:05, alarms at 102:38:22 (1202), 102:39:02
  (1202), 102:42:18 (1201), 102:42:43 (1202), 102:42:58 (1202).
- **[G]** [Apollo descent guidance](https://www.nasa.gov/wp-content/uploads/static/history/alsj/ApolloDescentGuidnce.pdf) (report on the ALSJ):
  the braking phase ends about 7,800 m in slant range from the landing site.
- **[D]** The LM DSKY: the photographs at the Computer History Museum and NASM (Wikimedia Commons, below), the
  Luminary lamp list; 8 × 8 × 7 in.
- **[H]** The AGC's instruction timing (Virtual AGC, "Assembly language manual"): 12 timing pulses per MCT, AD in
  2 MCT, TC and TCF in 1, DXCH in 3.
- **[P]** Pinball (the DSKY program in Luminary): a Verb 16 monitor redisplays once a second.
- **[Q]** [Quindar tones](https://www.nasa.gov/wp-content/uploads/static/history/alsj/quindar.html), ALSJ:
  2,525 Hz to key the ground transmitter, 2,475 Hz to release it, 250 ms each.
- **[A]** Apollo Operations Handbook, Block II spacecraft, vol. 1, section 2.10, caution and warning
  ([ibiblio](https://www.ibiblio.org/apollo/ApolloProjectOnline/Documents/SMA2A-03-BLOCK%20II%20Volume%201%2019691015/aoh-v1-2-10-c+w.pdf)):
  the master alarm tone is a square wave alternately 750 and 2,000 Hz. That is the command module's handbook; the
  score assumes the LM's tone was the same.

## Estimates and simplifications **[E]**

| What | In the model | Why |
|---|---|---|
| Job mix of the Executive | SERVICER every 2 s (needs a VAC area), a Verb 16 monitor job every second at lower priority, an LPD display job every 2 s in P64 from 12 s after high gate, one keyboard job per key | the real Luminary job list is longer; this is the smallest mix that shows the mechanism Eyles describes |
| Priorities | relative only (keyboard > SERVICER > monitor, LPD) | the numbers are not shown on screen; the priority word in the erasable view uses PRIO20 / PRIO10 and an estimated low-9-bit pointer (`0154`) |
| Radar data load | +1.5 % (ramping over 24 s once the landing radar locks at 102:38:11) | Eyles gives "perhaps 13 %" margin; 1.5 % instead of 2 % keeps the braking phase from drifting into overload between the second alarm and P64, as it did not in flight |
| P64 duty | 83.5 % rising to 90 % at P66 | Eyles: margin below 10 % in P64; the ramp places the model's P64 alarms near the flown ones |
| Crew keystrokes | V16 N68 entered at PDI + 305 s, V05 N09 after the first alarm, V16 N68 again at PDI + 350 s, RSETs | the keystroke times are not in the transcript; they are set so the model's first two 1202s land at 317.4 s and 356.4 s after PDI (flown: 317 and 357) |
| Descent profile before high gate | a smooth braking profile through 50,000 ft at PDI, 33,500 ft at the first alarm, 7,400 ft at high gate; horizontal speed 5,560 ft/s at PDI | nobody called numbers in the braking phase; the call-outs after high gate are the crew's [J] |
| Delta-H | −2,900 ft when the radar locks [J], then decaying with a 38 s time constant | the shape of its incorporation is not published |
| Rope strand mapping | word w of a module sits on core w mod 512, strand ⌊w / 512⌋ | the real mapping (address bits to core and strand) is more involved; this one puts consecutive addresses on neighbouring cores, so the 9 cores shown hold the real words `01,2623` to `01,2633` |
| Phases inside the memory cycle | inhibit, set, reset, strobe drawn over the 12 pulses; the 16 bits drawn one after the other | the sense amplifiers read all 16 at once; the drawing staggers them so the eye can follow |
| Erasable plane | 34 × 11 cores of one bit plane (bit 14), coincident-current X / Y lines, one sense line | the AGC's erasable module packs 32,768 cores; the plane is a window onto one of them |
| Inside tray B | the rope bay at one end (3 across, 2 deep), B7-B17 standing across the middle, the X-ribbed plate at the other end | after the photographs of the opened trays; the exact positions are approximate |
| Model's P64 alarms | three 1201s at 577, 586 and 598 s | flown: a 1201 at 553 s and two 1202s at 578 and 593 s; the model's VAC areas run out before its core sets |
| The instruction-per-second figure | 85,333 MCT/s; additions take 2 MCT, so 42,667 additions/s | "about 85,000 instructions per second" holds only for one-MCT instructions (TC, TCF) |

## The model, by hand

- 2.048 MHz ÷ 2 = 1.024 MHz; 12 pulses = 11.72 µs per memory cycle; 85,333 cycles a second.
- 6 modules × 512 cores × 12 words = 36,864 words of rope = 36 banks of 1,024; × 16 bits = 589,824 bits.
- 2,048 erasable words × 16 bits = 32,768 cores.
- The radar's two angles at 6,400 pulses per second each steal 12,800 MCT a second: 15.0 % at most; 13 % in the model.
- At the first alarm: 85 % braking + 1.5 % radar data + 3 % Noun 68 + 13 % stolen = 102.5 % of the machine.
- CAF NO.CORES at `01,2627` is `32634` octal = `011 010 110 011 100`, eight ones; the parity bit is 1.

`node machines/rope/check.mjs` recomputes each of these from the code, runs the Executive's log and compares its
alarms with Apollo 11's.

## Study material

The photographs and documents the geometry was built against belong to their authors and are not in this
repository (they sit in `machines/rope/ref/`, which git ignores):

- Ken Shirriff's photographs in [S]: the AGC closed, the two trays opened, tray B, a rope module opened, the rope
  diagram.
- [Apollo DSKY at the Computer History Museum](https://commons.wikimedia.org/wiki/File:Apollo_DSKY_CHM.agr.jpg)
  (Arnold Reinhold, CC BY-SA), [Apollo Guidance Computer at NASM](https://commons.wikimedia.org/wiki/File:Apollo_Guidance_Computer_(NASM).JPG),
  [AGC logic module](https://commons.wikimedia.org/wiki/File:AGClogicmodule.agr.jpg),
  [core rope memory](https://commons.wikimedia.org/wiki/File:Apollo_guidiance_computer_ferrit_core_memory.jpg).
- The Luminary 099 source files listed in [L].

The console's lettering is Barlow Condensed (SIL Open Font License, [@fontsource/barlow-condensed](https://fontsource.org/fonts/barlow-condensed)).
