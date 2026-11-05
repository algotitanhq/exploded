// Seven-segment digits drawn by code, for the DSKY's electroluminescent panel (a canvas texture in 3D) and for every
// figure of the console (SVG). Segments a-g, plus the DSKY's sign (a vertical bar crossing g makes +).
//
//    aaa
//   f   b
//    ggg
//   e   c
//    ddd
const SEG = {
  0: 'abcdef', 1: 'bc', 2: 'abdeg', 3: 'abcdg', 4: 'bcfg', 5: 'acdfg', 6: 'acdefg', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg',
  '-': 'g', '+': 'g+', ' ': '', E: 'adefg', r: 'eg', o: 'cdeg', P: 'abefg', A: 'abcefg', L: 'def', H: 'bcefg', F: 'aefg', C: 'adef',
};
/** the segment polygons of one digit in a w x h box at (x, y), as [[x, y], ...] lists; slant in fractions of w */
export function digitPolys(ch, x, y, w, h, slant = 0.08) {
  const segs = SEG[ch] ?? '';
  const t = Math.max(1, w * 0.17);
  const g = t * 0.22;
  const sk = (px, py) => [x + px + (h / 2 - py) * slant * (w / h) * 2, y + py];
  const H = (px0, px1, py) => [sk(px0 + g, py), sk(px0 + t / 2 + g, py - t / 2), sk(px1 - t / 2 - g, py - t / 2), sk(px1 - g, py), sk(px1 - t / 2 - g, py + t / 2), sk(px0 + t / 2 + g, py + t / 2)];
  const V = (px, py0, py1) => [sk(px, py0 + g), sk(px + t / 2, py0 + t / 2 + g), sk(px + t / 2, py1 - t / 2 - g), sk(px, py1 - g), sk(px - t / 2, py1 - t / 2 - g), sk(px - t / 2, py0 + t / 2 + g)];
  const P = {
    a: H(t / 2, w - t / 2, t / 2),
    g: H(t / 2, w - t / 2, h / 2),
    d: H(t / 2, w - t / 2, h - t / 2),
    f: V(t / 2, t / 2, h / 2),
    b: V(w - t / 2, t / 2, h / 2),
    e: V(t / 2, h / 2, h - t / 2),
    c: V(w - t / 2, h / 2, h - t / 2),
    '+': V(w / 2, h / 2 - w * 0.36, h / 2 + w * 0.36),
  };
  const all = 'abcdefg+'.split('');
  return all.map((k) => ({k, on: segs.includes(k), pts: P[k]})).filter((s) => s.k !== '+' || s.on);
}
/** draws a string of digits on a 2D canvas context; off segments in `off` (null: not drawn) */
export function drawDigits(ctx, str, x, y, w, h, gap, on, off = null, slant = 0.08) {
  [...str].forEach((ch, i) => {
    for (const s of digitPolys(ch, x + i * (w + gap), y, w, h, slant)) {
      if (!s.on && !off) continue;
      ctx.fillStyle = s.on ? on : off;
      ctx.beginPath();
      s.pts.forEach(([px, py], j) => (j ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
      ctx.closePath();
      ctx.fill();
    }
  });
}
/** the same as SVG paths (one string), for the console; '.' and ':' take a narrow cell of their own */
export function svgDigits(str, x, y, w, h, gap, on, off = null, slant = 0.08) {
  let out = '';
  let cx = x;
  const r = Math.max(1, w * 0.1);
  const dot = (px, py) => `<rect x="${(px - r).toFixed(1)}" y="${(py - r).toFixed(1)}" width="${(2 * r).toFixed(1)}" height="${(2 * r).toFixed(1)}" fill="${on}"/>`;
  for (const ch of str) {
    if (ch === '.' || ch === ':') {
      const px = cx + w * 0.12;
      out += ch === '.' ? dot(px, y + h - r) : dot(px, y + h * 0.3) + dot(px, y + h * 0.7);
      cx += w * 0.24 + gap;
      continue;
    }
    for (const s of digitPolys(ch, cx, y, w, h, slant)) {
      if (!s.on && !off) continue;
      out += `<path d="M${s.pts.map(([px, py]) => `${px.toFixed(1)},${py.toFixed(1)}`).join('L')}Z" fill="${s.on ? on : off}"/>`;
    }
    cx += w + gap;
  }
  return out;
}
/** width of a string drawn by svgDigits */
export const digitsWidth = (str, w, gap) => [...str].reduce((a, ch) => a + (ch === '.' || ch === ':' ? w * 0.24 : w) + gap, 0) - gap;
