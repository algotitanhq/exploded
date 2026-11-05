// Pepper, the explorer film. Shared code in ../curta-shared. The kit's film build inlines Inter and JetBrains Mono
// only; Instrument Serif (the sheet's titles) comes in here, as the site build gives it to the live page.
import serif from '../../../node_modules/@fontsource/instrument-serif/files/instrument-serif-latin-400-normal.woff2';
import {run} from '../curta-shared/film.js';

const style = document.createElement('style');
style.textContent = `@font-face{font-family:'Instrument Serif';font-weight:400;font-style:normal;font-display:block;src:url(data:font/woff2;base64,${serif}) format('woff2');}`;
document.head.appendChild(style);
document.fonts.load("400 20px 'Instrument Serif'").finally(run);
