# Pepper: references

Pepper is a model of the Curta Type I mechanical calculator (Curt Herzstark, Contina AG, Mauren, Liechtenstein, from
1948), built from public sources: encyclopedias, a period article, a teaching page and drawings of the internals. It
is not affiliated with any maker or rights holder, and it is not a measured reproduction: where a figure is not
public, the model uses a plausible value, listed below as an estimate.

The letters match the comments in [`curta-shared/machine.js`](curta-shared/machine.js) (the figures and the
arithmetic) and [`curta-shared/curta.js`](curta-shared/curta.js) (the geometry).

## Sources

- **[W]** Wikipedia, [Curta](https://en.wikipedia.org/wiki/Curta). Type I: 8 setting sliders, a 6-digit revolution
  counter, an 11-digit result; Type II: 11 / 8 / 15. 230 g (Type I), 360 g (Type II). About 80,000 Type I and
  60,000 Type II made; introduced 1948 (Type II 1954), the last one in 1972 according to Herzstark. German patent
  DE 747073 (filed 19 August 1938). Pulling the crank up before turning subtracts; subtraction by nines' complement.
- **[F]** Wikipédia, [Curta](https://fr.wikipedia.org/wiki/Curta). Type 1: 8.5 cm high, 5.3 cm across, 230 g,
  ~600 parts; made 1948–1970, ~80,000 Type 1. The drum carries a second set of teeth, interleaved, each row with the
  nine's complement of its digit, engaged by moving the drum (and the crank, which is fixed to it) a few millimetres
  in height; the first column takes the ten's complement. Carries: a pin on each result wheel presses a carry lever
  as the wheel passes 9 → 0, the lever shifts a pinion on the next column's shaft into the path of the single tooth
  of the carry bell, fixed to the drum; a cascade propagates during the turn; a reset cam lifts the levers at the
  start of the next turn; a ratchet stops the crank turning backwards. Clearing: a top disc with a fold-out lever,
  two racks, the carriage lifted to disengage the wheels. The carriage lifts, turns, and drops into a position.
- **[V]** "The Curta", a period article reprinted at [vcalc.net](https://vcalc.net/cu-pe-mag.htm): 19 rows of teeth
  on the drum (9 for addition, 9 complementary, 1 row of ten teeth for the first digit's true complement, met by an
  extra cog on that column's axle), the handle extended to raise the drum for subtraction, the carry by transfer
  pin, slide and pinion against a single tooth above the drum; capacity 8 × 6 × 11; 6 carriage positions.
- **[H]** E. Hamann, [Curta](https://public.beuth-hochschule.de/hamann/curta/index.html), Beuth Hochschule Berlin:
  53 mm across, 105 mm high (with the crank), 230 g; the carriage turns only when lifted; the crank turns clockwise
  only; a negative result shows as the complement of the next power of ten (−12 as 99…9988).
- **[M]** Wikimedia Commons, [Category: Curta Internal Details](https://commons.wikimedia.org/wiki/Category:Curta_Internal_Details)
  (drawings by Manuco, CC0): the carry lever's actuation and reset cam, carry propagation, the reset racks, the
  doubly stepped drum. The geometry of the carry levers, the digit drums lying on their sides and the racks follows
  these drawings.
- Photographs used to build the outside (not redistributed here): Wikimedia Commons
  [Curta01.JPG](https://commons.wikimedia.org/wiki/File:Curta01.JPG) (a Type I in the hand) and
  [Curta Mechanical computer img 1651.jpg](https://commons.wikimedia.org/wiki/File:Curta_Mechanical_computer_img_1651.jpg)
  (front view: knurled base and carriage, slotted body with its sliders and rods, the CURTA band, the crank and the
  clearing lever).

Not consulted: the service manuals collected at curta.org (Rick Furr) and Herzstark's patent text, which would
settle the estimates below.

## Checked in `check.mjs`

The registers' capacity (99,999,999,999 / 999,999 / 99,999,999), the film's multiplication (1,234 × 56 = 69,104 in
6 + 5 turns, the counter reading 56), the subtraction by the ten's complement (one turn back in position 2 adds
10¹¹ − 12,340, 10 − 4 teeth on the first column, 9 − d on the others, and leaves 56,764 = 1,234 × 46), the carry
cascade of that turn (columns 5 to 11 in order, and one off the top), …999 + 1 = 0 with 10 carries, the timing of the
carries over a turn, and 3,000 random turns against plain arithmetic modulo 10¹¹ and 10⁶.

## Estimates **[E]**

| Figure | Value | Why |
|---|---|---|
| Stations around the drum | 16, 22.5° apart: 8 slider shafts, 3 carry-only shafts, 5 parked places | The model needs every result wheel to sit over a shaft or a parked place in all 6 carriage positions; the real machine spreads its 8 sliders over a wider arc than the model's 157°. |
| Columns above the 8th slider in subtraction | take 9 teeth, as a slider set to 0 would | The sources say only that a negative result reads as the complement of 10¹¹ (99…9988); how the mechanism feeds those 9s is not described in what was read. The arithmetic is exact either way. |
| Timing over a turn | teeth from 15°, 10° apart; the carry tooth meets station s at 105° + 22.5°·(s − 1); the counter steps at 338° | Chosen so each station's teeth end before its carry and the carries run in order; the sources say only that carries are sequential, during the turn. |
| Row pitch, drum shift | 2.4 mm, 1.2 mm (half a row) | "A few millimetres" [F]; the shift is half the pitch by construction [V]. |
| Carriage lift | 3.2 mm | Not given. |
| Ratchet teeth | 12 per turn | The ratchet is described [F], not its count; it sets the ratchet ticks of the sound. |
| Counter carries | in the same step as its digit | The counter's own carry train is not modelled. |
| Interior proportions | drum Ø 12 mm, shafts on a 9.7 mm radius, digit drums Ø 8.4 mm | Scaled to fit the 53 mm body; not measured. |

The brief asked for the drum to move down when the crank is pulled; the sources say it rises with the crank [V][F],
so it rises here.
