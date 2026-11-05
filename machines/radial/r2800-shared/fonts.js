// Radial's own type, inlined (latin subsets, SIL Open Font License): Barlow Condensed, a condensed grotesque in the
// spirit of the period's technical manuals, and Saira Stencil One for the title, the stencil of a crate or a cowling.
// Both builds (the skill's and the site's) load .woff2 as base64.
import b500 from '@fontsource/barlow-condensed/files/barlow-condensed-latin-500-normal.woff2';
import b700 from '@fontsource/barlow-condensed/files/barlow-condensed-latin-700-normal.woff2';
import stencil from '@fontsource/saira-stencil-one/files/saira-stencil-one-latin-400-normal.woff2';

export const FONT = {cond: "'Barlow Condensed', 'Arial Narrow', sans-serif", stencil: "'Saira Stencil One', 'Barlow Condensed', sans-serif"};

let ready = null;
/** registers the faces and resolves when they are usable (the first frame waits on it) */
export function loadFonts() {
  if (ready) return ready;
  const face = (family, b64, weight) => {
    const bin = atob(b64);
    const buf = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
    const f = new FontFace(family, buf, {weight: String(weight), display: 'block'});
    document.fonts.add(f);
    return f.load();
  };
  ready = Promise.all([face('Barlow Condensed', b500, 500), face('Barlow Condensed', b700, 700), face('Saira Stencil One', stencil, 400)]).catch(() => {});
  return ready;
}
