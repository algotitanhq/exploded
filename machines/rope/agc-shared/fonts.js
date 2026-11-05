// Barlow Condensed (SIL Open Font License, @fontsource/barlow-condensed), the console's technical-drawing capitals:
// the latin subset in three weights, inlined so the page opens offline. Both builds (the site's and the teardown
// skill's) load .woff2 as base64.
import w500 from '@fontsource/barlow-condensed/files/barlow-condensed-latin-500-normal.woff2';
import w600 from '@fontsource/barlow-condensed/files/barlow-condensed-latin-600-normal.woff2';
import w700 from '@fontsource/barlow-condensed/files/barlow-condensed-latin-700-normal.woff2';

const buf = (b64) => {
  const s = atob(b64);
  const u = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
  return u.buffer;
};
export const FAMILY = "'Barlow Condensed', 'Arial Narrow', sans-serif";
/** registers the three weights; resolves when they are ready to draw with */
export async function loadFonts() {
  const faces = [
    [w500, '500'],
    [w600, '600'],
    [w700, '700'],
  ].map(([b, weight]) => new FontFace('Barlow Condensed', buf(b), {weight, style: 'normal'}));
  for (const f of faces) {
    document.fonts.add(f);
    await f.load().catch(() => {});
  }
}
