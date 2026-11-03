# Quantum: references

Quantum is a model of a photonic quantum computer built from the public figures of Quandela's Belenos (MosaiQ-12)
and of the Ascella platform paper. It is not affiliated with Quandela, and it is not a description of their internal
design: where a figure is not public, the model uses a plausible value and the page marks it (`*`, "est.").

The letters match the comments in [`qpu-shared/photonics.js`](qpu-shared/photonics.js), where each number is used.

## Sources

- **[A]** N. Maring et al., "A versatile single-photon-based quantum computing platform", *Nature Photonics* 18,
  603–609 (2024). [arXiv:2306.00874](https://arxiv.org/abs/2306.00874). The Ascella machine (6 photons, 12 modes):
  the quantum-dot source (928 nm, 92 ps lifetime, g²(0) = 0.0073, indistinguishability 94.4 %), the 80 MHz clock,
  the transmission of each stage (first lens 55 %, demultiplexer 70 %, chip 45 %, SNSPD 92 %, 8.4 % in all), the
  dark counts, the 1 ns coincidence window, the ~4 Hz six-photon rate.
- **[C]** Quandela, [Belenos – MosaiQ 12](https://www.quandela.com/qpus/belenos/),
  [MosaiQ](https://quandela.com/mosaiq) and the
  [product catalogue](https://www.quandela.com/wp-content/uploads/2024/05/Product-catalogue_Quandela_V6_spreads.pdf):
  12 photonic qubits, a 24-mode chip, dual-rail encoding, a closed-cycle cryostat for the source and the detectors.
- **[L]** Quandela, [Lucy, the photonic quantum computer for EuroHPC](https://www.quandela.com/newsroom-posts/lucy-ordinateur-quantique-photonique-eurohpc/)
  (October 2025): the two-cabinet machine at CEA's TGCC, 12 qubits, attocube cryogenics.
- [Perceval](https://github.com/Quandela/Perceval), Quandela's open-source framework (Apache 2.0): the code shown in
  the Perceval panel follows its API (`RemoteProcessor`, `Unitary`, `BasicState`, `Sampler`).

## Estimates **[E]**

Not public, chosen to be plausible and marked on screen:

| Figure | Value | Why |
|---|---|---|
| Fibre coupling + spectral filter | 53 % | what makes the product of the published stages equal the published 8.4 % |
| Detector stage temperature | ~2.5 K | typical for SNSPDs in a closed-cycle cryostat |
| Fibre lengths in the racks | 3 m, 0.5 m, 1 m, 0.6 m, 2 m | the cabinets' size; only the 2.55 m step between delay lines is fixed (12.5 ns of fibre) |
| Mesh length, group index | 24 mm, 1.9 | a silicon-nitride chip of this size |
| Detector pulse to the time tagger | 5 ns | 1 m of coax |

## The model, by hand

- 12.5 ns between pulses × 0.2042 m/ns (fibre, group index 1.468) = 2.55 m of fibre per slot: photon k waits
  (n − 1 − k) slots more than the last one, so the n photons reach the chip together.
- (80 MHz / n) · 0.084ⁿ: 4.7 Hz for n = 6 (Ascella measured ~4 Hz), 996 Hz for the film's n = 4.
- A Clements mesh on 24 modes has 24 × 23 / 2 = 276 Mach-Zehnder interferometers, 552 phase shifters.
- Hong-Ou-Mandel: P(1,1) = ½(1 − M e^(−|δ|/τ)) = 2.8 % at δ = 0.

`node machines/quantum/check.mjs` recomputes each of these from the code.

## Study material

The photographs and documents the geometry was built against (the Lucy cabinets, the catalogue, the paper's
figures) belong to their authors and are not in this repository; the links above lead to them.
