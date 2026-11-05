// Every word on screen, in English (the default), French and Spanish. The language itself, the number format and the
// strings of the page's header and footer are shared by the collection (../../../shared/i18n.js).
import {LANG, LANGS, makeT, nf} from '../../../shared/i18n.js';

export {LANG, LANGS, nf};

const b = (x) => `<b>${x}</b>`;
const S = {
  // ------------------------------------------------------------ the sheet
  title: {en: 'Pepper', fr: 'Pepper', es: 'Pepper'},
  subtitle: {en: 'CURTA TYPE I · CURT HERZSTARK · 1948', fr: 'CURTA TYPE I · CURT HERZSTARK · 1948', es: 'CURTA TIPO I · CURT HERZSTARK · 1948'},
  model: {
    en: 'A model after the public sources · not affiliated with any maker or rights holder',
    fr: 'Modèle d’après les sources publiques · sans lien avec un fabricant ni un ayant droit',
    es: 'Modelo según las fuentes públicas · sin relación con ningún fabricante ni titular de derechos',
  },
  sheet: {en: 'Technical sheet', fr: 'Fiche technique', es: 'Ficha técnica'},
  specReg: {en: 'Setting · counter · result', fr: 'Inscription · tours · totalisateur', es: 'Inscripción · vueltas · totalizador'},
  specDia: {en: 'Diameter', fr: 'Diamètre', es: 'Diámetro'},
  specH: {en: 'Height', fr: 'Hauteur', es: 'Altura'},
  specHv: {en: (h, c) => `${h} mm · ${c} with crank`, fr: (h, c) => `${h} mm · ${c} avec manivelle`, es: (h, c) => `${h} mm · ${c} con manivela`},
  specMass: {en: 'Mass', fr: 'Masse', es: 'Masa'},
  specMade: {en: 'Made', fr: 'Fabriquées', es: 'Fabricadas'},
  specMadev: {en: (n, a, z) => `~${n} · ${a}–${z}`, fr: (n, a, z) => `~${n} · ${a}–${z}`, es: (n, a, z) => `~${n} · ${a}–${z}`},
  specII: {en: 'Type II, for comparison', fr: 'Type II, pour comparer', es: 'Tipo II, para comparar'},
  // ------------------------------------------------------------ the turn
  turnTitle: {en: 'One turn of the crank', fr: 'Un tour de manivelle', es: 'Una vuelta de manivela'},
  chartLegend: {
    en: (a) => `Rows: the 11 result columns. <span style="color:#8d7a52">▮</span> a drum tooth turning the column’s gear &nbsp;<span style="color:${a}">●</span> its carry, taken from the column below. The counter steps at 338°.`,
    fr: (a) => `Lignes : les 11 colonnes du totalisateur. <span style="color:#8d7a52">▮</span> une dent du tambour qui tourne la roue de la colonne &nbsp;<span style="color:${a}">●</span> son report, reçu de la colonne d’en dessous. Le compteur avance à 338°.`,
    es: (a) => `Filas: las 11 columnas del totalizador. <span style="color:#8d7a52">▮</span> un diente del tambor que gira la rueda de la columna &nbsp;<span style="color:${a}">●</span> su acarreo, recibido de la columna de abajo. El contador avanza a 338°.`,
  },
  modeAdd: {en: 'ADDITION', fr: 'ADDITION', es: 'SUMA'},
  modeSub: {en: 'SUBTRACTION', fr: 'SOUSTRACTION', es: 'RESTA'},
  turnOf: {en: (n, m) => `TURN ${n} OF ${m}`, fr: (n, m) => `TOUR ${n} SUR ${m}`, es: (n, m) => `VUELTA ${n} DE ${m}`},
  posN: {en: (p) => `POSITION ${p}`, fr: (p) => `POSITION ${p}`, es: (p) => `POSICIÓN ${p}`},
  crankDown: {en: 'CRANK DOWN · ADDS', fr: 'MANIVELLE BASSE · ADDITIONNE', es: 'MANIVELA ABAJO · SUMA'},
  crankUp: {en: 'CRANK UP · SUBTRACTS', fr: 'MANIVELLE HAUTE · SOUSTRAIT', es: 'MANIVELA ARRIBA · RESTA'},
  overflow: {en: 'OFF THE TOP', fr: 'HORS CAPACITÉ', es: 'FUERA DE CAPACIDAD'},
  // ------------------------------------------------------------ the hand
  grpHand: {en: 'YOUR HAND', fr: 'VOTRE MAIN', es: 'TU MANO'},
  'act:turn': {en: '↻ Turn', fr: '↻ Un tour', es: '↻ Una vuelta'},
  'act:pull': {en: 'Crank up', fr: 'Manivelle haute', es: 'Manivela arriba'},
  'act:carL': {en: '◂ Carriage', fr: '◂ Chariot', es: '◂ Carro'},
  'act:carR': {en: 'Carriage ▸', fr: 'Chariot ▸', es: 'Carro ▸'},
  'act:clear': {en: 'Clear', fr: 'Effacer', es: 'Borrar'},
  'act:pause': {en: 'Pause', fr: 'Pause', es: 'Pausa'},
  'act:play': {en: 'Play', fr: 'Lecture', es: 'Seguir'},
  handFilm: {
    en: 'Set a digit by clicking the setting drums (top, right), turn, shift, clear. Keys: space turn, U crank, ← → carriage.',
    fr: 'Inscrivez un chiffre en cliquant les tambours d’inscription (en haut à droite), tournez, décalez, effacez. Touches : espace tour, U manivelle, ← → chariot.',
    es: 'Inscribe una cifra haciendo clic en los tambores de inscripción (arriba a la derecha), gira, desplaza, borra. Teclas: espacio vuelta, U manivela, ← → carro.',
  },
  handFull: {en: 'The carriage holds 6 positions.', fr: 'Le chariot a 6 positions.', es: 'El carro tiene 6 posiciones.'},
  // ------------------------------------------------------------ registers
  regResult: {en: 'Result', fr: 'Totalisateur', es: 'Totalizador'},
  regCtr: {en: 'Turns counter', fr: 'Compteur de tours', es: 'Contador de vueltas'},
  regSet: {en: 'Setting', fr: 'Inscription', es: 'Inscripción'},
  opTitle: {en: 'The operation, by hand', fr: 'L’opération, à la main', es: 'La operación, a mano'},
  opAddSide: {en: (p) => `SETTING × 10^${p - 1}`, fr: (p) => `INSCRIPTION × 10^${p - 1}`, es: (p) => `INSCRIPCIÓN × 10^${p - 1}`},
  opSubSide: {en: 'TEN’S COMPLEMENT', fr: 'COMPLÉMENT À DIX', es: 'COMPLEMENTO A DIEZ'},
  addNote: {
    en: (s, p, v) => `Each column takes as many teeth as its slider shows: ${s} in position ${p} adds ${b(v)}.`,
    fr: (s, p, v) => `Chaque colonne reçoit autant de dents que son curseur l’indique : ${s} en position ${p} ajoute ${b(v)}.`,
    es: (s, p, v) => `Cada columna recibe tantos dientes como marca su cursor: ${s} en posición ${p} suma ${b(v)}.`,
  },
  compNote: {
    en: (v, a) => `To take away ${b(v)} it adds 10<sup>11</sup> − ${v}: <b>9 − d</b> teeth in every column, <b style="color:${a}">10 − d</b> in the first (the 9’s complement + 1). The 1 that falls off the top is lost.`,
    fr: (v, a) => `Pour retrancher ${b(v)}, elle ajoute 10<sup>11</sup> − ${v} : <b>9 − d</b> dents par colonne, <b style="color:${a}">10 − d</b> sur la première (le complément à 9, plus 1). Le 1 qui sort par le haut est perdu.`,
    es: (v, a) => `Para quitar ${b(v)} suma 10<sup>11</sup> − ${v}: <b>9 − d</b> dientes por columna, <b style="color:${a}">10 − d</b> en la primera (el complemento a 9, más 1). El 1 que sale por arriba se pierde.`,
  },
  upNote: {
    en: (a) => `Crank up: the drum has risen <b style="color:${a}">1.2 mm</b>, its complement rows face the gears.`,
    fr: (a) => `Manivelle haute : le tambour est monté de <b style="color:${a}">1,2 mm</b>, ses rangées de complément font face aux roues.`,
    es: (a) => `Manivela arriba: el tambor ha subido <b style="color:${a}">1,2 mm</b>, sus filas de complemento quedan frente a las ruedas.`,
  },
  histTurns: {en: (n, p) => `${n} turn${n > 1 ? 's' : ''} · pos. ${p}`, fr: (n, p) => `${n} tour${n > 1 ? 's' : ''} · pos. ${p}`, es: (n, p) => `${n} vuelta${n > 1 ? 's' : ''} · pos. ${p}`},
  // ------------------------------------------------------------ buttons
  grpSub: {en: 'SUBSYSTEMS', fr: 'SOUS-SYSTÈMES', es: 'SUBSISTEMAS'},
  'sub:crank': {en: 'Crank', fr: 'Manivelle', es: 'Manivela'},
  'sub:sliders': {en: 'Setting sliders', fr: 'Curseurs d’inscription', es: 'Cursores de inscripción'},
  'sub:drum': {en: 'Stepped drum', fr: 'Tambour à gradins', es: 'Tambor escalonado'},
  'sub:gears': {en: 'Counting gears', fr: 'Roues de comptage', es: 'Ruedas de conteo'},
  'sub:carry': {en: 'Carries', fr: 'Reports', es: 'Acarreos'},
  'sub:carriage': {en: 'Carriage & counters', fr: 'Chariot & compteurs', es: 'Carro y contadores'},
  'sub:reset': {en: 'Clearing', fr: 'Remise à zéro', es: 'Puesta a cero'},
  grpCut: {en: 'BODY', fr: 'CORPS', es: 'CUERPO'},
  'cut:solid': {en: 'Solid', fr: 'Pleine', es: 'Entera'},
  'cut:glass': {en: 'Glass', fr: 'Verre', es: 'Cristal'},
  'cut:section': {en: 'Axial section', fr: 'Section axiale', es: 'Sección axial'},
  'cut:explode': {en: 'Exploded', fr: 'Éclatée', es: 'Despiece'},
  grpView: {en: 'VIEW', fr: 'VUE', es: 'VISTA'},
  'view:hero': {en: 'In the hand', fr: 'En main', es: 'En la mano'},
  'view:top': {en: 'Top', fr: 'Dessus', es: 'Arriba'},
  'view:macro': {en: 'Drum macro', fr: 'Macro tambour', es: 'Macro tambor'},
  'view:axial': {en: 'Axial cut', fr: 'Coupe axiale', es: 'Corte axial'},
  hint: {en: 'DRAG TO TURN IT · WHEEL TO ZOOM · H HIDES THE SHEET', fr: 'GLISSER POUR TOURNER · MOLETTE POUR ZOOMER · H MASQUE LA FICHE', es: 'ARRASTRA PARA GIRAR · RUEDA PARA ACERCAR · H OCULTA LA FICHA'},
  // ------------------------------------------------------------ callouts [name, sub]
  cCrank: {en: ['Crank', 'CLOCKWISE ONLY · PULL UP TO SUBTRACT'], fr: ['Manivelle', 'SENS HORAIRE · TIRÉE POUR SOUSTRAIRE'], es: ['Manivela', 'SOLO HORARIO · ARRIBA PARA RESTAR']},
  cCarriage: {en: ['Carriage', 'RESULT 11 · COUNTER 6 · 6 POSITIONS'], fr: ['Chariot', 'TOTALISATEUR 11 · COMPTEUR 6 · 6 POSITIONS'], es: ['Carro', 'TOTALIZADOR 11 · CONTADOR 6 · 6 POSICIONES']},
  cSliders: {en: ['Setting sliders', '8 · 0 AT THE TOP, 9 AT THE BOTTOM'], fr: ['Curseurs', '8 · 0 EN HAUT, 9 EN BAS'], es: ['Cursores', '8 · 0 ARRIBA, 9 ABAJO']},
  cSlider: {en: (d) => ['Slider 3', `SET TO ${d}: ITS GEAR ON ROW ${d}`], fr: (d) => ['Curseur 3', `SUR ${d} : SA ROUE SUR LA RANGÉE ${d}`], es: (d) => ['Cursor 3', `EN ${d}: SU RUEDA EN LA FILA ${d}`]},
  cTape: {en: ['Setting windows', 'THE DIGIT EACH SLIDER SETS'], fr: ['Fenêtres d’inscription', 'LE CHIFFRE DE CHAQUE CURSEUR'], es: ['Ventanas de inscripción', 'LA CIFRA DE CADA CURSOR']},
  cDrum: {en: ['Stepped drum', '9 ADD ROWS · 9 COMPLEMENT · 1 OF TEN'], fr: ['Tambour à gradins', '9 RANGS ADDITION · 9 COMPLÉMENT · 1 DE DIX'], es: ['Tambor escalonado', '9 FILAS SUMA · 9 COMPLEMENTO · 1 DE DIEZ']},
  cGear: {en: ['Counting gear', 'SLIDES ON ITS SQUARE SHAFT'], fr: ['Roue de comptage', 'GLISSE SUR SON AXE CARRÉ'], es: ['Rueda de conteo', 'SE DESLIZA EN SU EJE CUADRADO']},
  cResultWheel: {en: ['Result drum, column 1', 'ONE TOOTH = ONE DIGIT'], fr: ['Tambour du totalisateur, colonne 1', 'UNE DENT = UN CHIFFRE'], es: ['Tambor del totalizador, columna 1', 'UN DIENTE = UNA CIFRA']},
  cLever: {en: (j) => ['Carry lever', `9 → 0 BELOW · COLUMN ${j} TAKES 1`], fr: (j) => ['Bras de report', `9 → 0 EN DESSOUS · LA COLONNE ${j} PREND 1`], es: (j) => ['Palanca de acarreo', `9 → 0 DEBAJO · LA COLUMNA ${j} TOMA 1`]},
  cBell: {en: ['Carry bell', 'ONE TOOTH, COLUMN AFTER COLUMN'], fr: ['Cloche des reports', 'UNE DENT, COLONNE APRÈS COLONNE'], es: ['Campana de acarreos', 'UN DIENTE, COLUMNA TRAS COLUMNA']},
  cResult: {en: ['Result', '11 DIGITS'], fr: ['Totalisateur', '11 CHIFFRES'], es: ['Totalizador', '11 CIFRAS']},
  cCounter: {en: ['Turns counter', '6 DIGITS · COUNTS AT THE CARRIAGE’S POSITION'], fr: ['Compteur de tours', '6 CHIFFRES · COMPTE À LA POSITION DU CHARIOT'], es: ['Contador de vueltas', '6 CIFRAS · CUENTA EN LA POSICIÓN DEL CARRO']},
  cRise: {en: ['The drum, raised 1.2 mm', 'COMPLEMENT ROWS ENGAGED'], fr: ['Le tambour, monté de 1,2 mm', 'RANGÉES DE COMPLÉMENT EN PRISE'], es: ['El tambor, subido 1,2 mm', 'FILAS DE COMPLEMENTO ENGRANADAS']},
  cRing: {en: ['Clearing ring', 'ONE TURN CLEARS BOTH REGISTERS'], fr: ['Anneau de remise à zéro', 'UN TOUR EFFACE LES DEUX REGISTRES'], es: ['Anillo de puesta a cero', 'UNA VUELTA BORRA LOS DOS REGISTROS']},
  // ------------------------------------------------------------ captions
  'c:hero': {en: 'A whole calculator in one hand: 8 sliders, 6 counter digits, 11 result digits.', fr: 'Une calculatrice entière dans la main : 8 curseurs, 6 chiffres de tours, 11 de résultat.', es: 'Una calculadora entera en la mano: 8 cursores, 6 cifras de vueltas, 11 de resultado.'},
  'c:set': {en: (f) => `The sliders set ${nf(f.set)}: each takes its gear to the row of its digit.`, fr: (f) => `Les curseurs inscrivent ${nf(f.set)} : chacun mène sa roue à la rangée de son chiffre.`, es: (f) => `Los cursores inscriben ${nf(f.set)}: cada uno lleva su rueda a la fila de su cifra.`},
  'c:drum': {en: 'One stepped drum for every column: the gear on 4 meets 4 teeth.', fr: 'Un seul tambour à gradins pour toutes les colonnes : la roue sur 4 rencontre 4 dents.', es: 'Un solo tambor escalonado para todas las columnas: la rueda en 4 encuentra 4 dientes.'},
  'c:drum2': {en: 'It serves the gears one after another; one tooth, one digit.', fr: 'Il sert les roues l’une après l’autre ; une dent, un chiffre.', es: 'Sirve las ruedas una tras otra; un diente, una cifra.'},
  'c:turns': {en: (f) => `Six turns in position 1: ${nf(f.set)} × ${nf(f.m1)}. The counter counts them.`, fr: (f) => `Six tours en position 1 : ${nf(f.set)} × ${nf(f.m1)}. Le compteur les compte.`, es: (f) => `Seis vueltas en posición 1: ${nf(f.set)} × ${nf(f.m1)}. El contador las cuenta.`},
  'c:carriage': {en: 'Lift the carriage, one notch, drop it: each turn now counts ten.', fr: 'Le chariot soulevé, tourné d’un cran, reposé : chaque tour compte dix.', es: 'El carro levantado, girado una muesca, bajado: cada vuelta cuenta diez.'},
  'c:turns2': {en: (f) => `Five turns in position 2: ${nf(f.set)} × ${nf(f.m2)} = ${nf(f.r1)}.`, fr: (f) => `Cinq tours en position 2 : ${nf(f.set)} × ${nf(f.m2)} = ${nf(f.r1)}.`, es: (f) => `Cinco vueltas en posición 2: ${nf(f.set)} × ${nf(f.m2)} = ${nf(f.r1)}.`},
  'c:pull': {en: 'Crank pulled up: the drum rises half a row, its complement teeth engage.', fr: 'Manivelle tirée : le tambour monte d’une demi-rangée, les dents de complément engrènent.', es: 'Manivela arriba: el tambor sube media fila, engranan los dientes de complemento.'},
  'c:sub': {en: 'It subtracts by adding: 9 − d teeth in each column, 10 − d in the first.', fr: 'Elle soustrait en additionnant : 9 − d dents par colonne, 10 − d sur la première.', es: 'Resta sumando: 9 − d dientes por columna, 10 − d en la primera.'},
  'c:cascade': {en: 'Each 9 → 0 drops the next lever; the carry tooth takes them in order.', fr: 'Chaque 9 → 0 abaisse le bras suivant ; la dent de report les prend dans l’ordre.', es: 'Cada 9 → 0 baja la palanca siguiente; el diente de acarreo las toma en orden.'},
  'c:sum': {en: (f) => `${nf(f.r1)} − ${nf(f.sub)} = ${nf(f.r2)}. The counter went back to ${nf(f.c2)}.`, fr: (f) => `${nf(f.r1)} − ${nf(f.sub)} = ${nf(f.r2)}. Le compteur est revenu à ${nf(f.c2)}.`, es: (f) => `${nf(f.r1)} − ${nf(f.sub)} = ${nf(f.r2)}. El contador volvió a ${nf(f.c2)}.`},
  'c:clear': {en: 'Lift the carriage, one turn of the ring: both registers back to zero.', fr: 'Chariot soulevé, un tour d’anneau : les deux registres reviennent à zéro.', es: 'Carro levantado, una vuelta del anillo: los dos registros vuelven a cero.'},
  'c:end': {en: (f) => `${nf(f.set)} × ${nf(f.c2)} = ${nf(f.r2)}: six turns, five turns, one back.`, fr: (f) => `${nf(f.set)} × ${nf(f.c2)} = ${nf(f.r2)} : six tours, cinq tours, un en arrière.`, es: (f) => `${nf(f.set)} × ${nf(f.c2)} = ${nf(f.r2)}: seis vueltas, cinco vueltas, una atrás.`},
  // live captions
  'l:idle': {en: 'Set a number, then turn the crank.', fr: 'Inscrivez un nombre, puis tournez la manivelle.', es: 'Inscribe un número y gira la manivela.'},
  'l:add': {en: (n) => `Adding ${n}.`, fr: (n) => `Addition de ${n}.`, es: (n) => `Sumando ${n}.`},
  'l:sub': {en: (n) => `Subtracting ${n} by its ten’s complement.`, fr: (n) => `Soustraction de ${n} par son complément à dix.`, es: (n) => `Restando ${n} por su complemento a diez.`},
  'l:carriage': {en: (p) => `The carriage to position ${p}.`, fr: (p) => `Le chariot en position ${p}.`, es: (p) => `El carro a la posición ${p}.`},
  'l:clear': {en: 'Clearing both registers.', fr: 'Remise à zéro des deux registres.', es: 'Puesta a cero de los dos registros.'},
  'l:slide': {en: 'Setting.', fr: 'Inscription.', es: 'Inscripción.'},
  'l:crank': {en: 'The crank changes mode.', fr: 'La manivelle change de mode.', es: 'La manivela cambia de modo.'},
  // ------------------------------------------------------------ the live page
  tourOn: {en: 'AUTO TOUR · CLICK TO TAKE OVER', fr: 'VISITE AUTO · CLIQUER POUR PRENDRE LA MAIN', es: 'VISITA AUTOMÁTICA · CLIC PARA TOMAR EL CONTROL'},
  tourOff: {en: '▶ RESUME THE TOUR', fr: '▶ REPRENDRE LA VISITE', es: '▶ REANUDAR LA VISITA'},
  turnPhone: {en: 'Turn your phone sideways for the full sheet', fr: 'Tournez le téléphone pour la fiche complète', es: 'Gira el teléfono para ver la ficha completa'},
  docTitle: {en: 'Pepper · the Curta calculator, taken apart', fr: 'Pepper · la calculatrice Curta, démontée', es: 'Pepper · la calculadora Curta, desmontada'},
  footCredit: {
    en: 'A Curta Type I after the public sources, not affiliated with any maker or rights holder',
    fr: 'Une Curta Type I d’après les sources publiques, sans lien avec un fabricant ni un ayant droit',
    es: 'Una Curta Tipo I según las fuentes públicas, sin relación con ningún fabricante ni titular de derechos',
  },
};

/** the string for key in the page's language; extra arguments fill a templated one */
export const T = makeT(S);
export const STRINGS = S;
