// The collection: one entry per machine, newest first (the gallery's order). Each machine lives in machines/<slug>/,
// its live page's entry point is `entry`, its share card `og` (1200 x 630, also the gallery's thumbnail).
export const MACHINES = [
  {
    slug: 'radial',
    name: 'Radial',
    entry: 'machines/radial/r2800-live/main.js',
    og: 'machines/radial/og.png',
    meta: {
      en: {
        title: 'Radial · the R-2800 Double Wasp, taken apart',
        line: 'An 18-cylinder twin-row radial: the starter, the firing order round the star, a master rod and its eight articulated rods, the cam rings, take-off rpm.',
        description:
          'The Pratt & Whitney R-2800 Double Wasp you can take apart in the browser: 18 cylinders in two rows, a master rod and eight articulated rods per row, cam rings instead of a camshaft, the run from the starter to 2,700 rpm. A C-series R-2800 after public sources; not affiliated with Pratt & Whitney.',
        locale: 'en_US',
      },
      fr: {
        title: 'Radial · le R-2800 Double Wasp, démonté',
        line: 'Un moteur en étoile à 18 cylindres sur deux rangées : le démarreur, l’ordre d’allumage autour de l’étoile, une bielle maîtresse et ses huit biellettes, les anneaux à cames, le régime de décollage.',
        description:
          'Le Pratt & Whitney R-2800 Double Wasp à démonter dans le navigateur : 18 cylindres sur deux rangées, une bielle maîtresse et huit biellettes par rangée, des anneaux à cames au lieu d’un arbre à cames, la marche du démarreur à 2 700 tr/min. Un R-2800 de série C d’après les sources publiques ; sans lien avec Pratt & Whitney.',
        locale: 'fr_FR',
      },
      es: {
        title: 'Radial · el R-2800 Double Wasp, desmontado',
        line: 'Un motor radial de 18 cilindros en dos filas: el arranque, el orden de encendido alrededor de la estrella, una biela maestra y sus ocho articuladas, los anillos de levas, el régimen de despegue.',
        description:
          'El Pratt & Whitney R-2800 Double Wasp para desmontar en el navegador: 18 cilindros en dos filas, una biela maestra y ocho articuladas por fila, anillos de levas en lugar de árbol de levas, la marcha del arranque a 2700 rpm. Un R-2800 de la serie C según fuentes públicas; sin relación con Pratt & Whitney.',
        locale: 'es_ES',
      },
    },
  },
  {
    slug: 'pepper',
    name: 'Pepper',
    entry: 'machines/pepper/curta-live/main.js',
    og: 'machines/pepper/og.png',
    meta: {
      en: {
        title: 'Pepper · the Curta calculator, taken apart',
        line: 'The Curta Type I, the mechanical calculator you hold in one hand: one stepped drum, carries that run column after column.',
        description:
          'The Curta Type I mechanical calculator to take apart in the browser: one stepped drum for all eight sliders, subtraction by the ten’s complement, carries that run column after column, the carriage that shifts to multiply. A model after the public sources; not affiliated with any maker or rights holder.',
        locale: 'en_US',
      },
      fr: {
        title: 'Pepper · la calculatrice Curta, démontée',
        line: 'La Curta Type I, la calculatrice mécanique qui tient dans la main : un seul tambour à gradins, des reports qui passent colonne après colonne.',
        description:
          'La calculatrice mécanique Curta Type I à démonter dans le navigateur : un seul tambour à gradins pour les huit curseurs, la soustraction par complément à dix, les reports colonne après colonne, le chariot qui se décale pour multiplier. Modèle d’après les sources publiques ; sans lien avec un fabricant ni un ayant droit.',
        locale: 'fr_FR',
      },
      es: {
        title: 'Pepper · la calculadora Curta, desmontada',
        line: 'La Curta Tipo I, la calculadora mecánica que cabe en la mano: un solo tambor escalonado, acarreos que pasan columna tras columna.',
        description:
          'La calculadora mecánica Curta Tipo I para desmontar en el navegador: un solo tambor escalonado para los ocho cursores, la resta por complemento a diez, los acarreos columna tras columna, el carro que se desplaza para multiplicar. Modelo según las fuentes públicas; sin relación con ningún fabricante ni titular de derechos.',
        locale: 'es_ES',
      },
    },
  },
  {
    slug: 'quantum',
    name: 'Quantum',
    entry: 'machines/quantum/qpu-live/main.js',
    og: 'machines/quantum/og.png',
    meta: {
      en: {
        title: 'Quantum · a photonic quantum computer, taken apart',
        line: 'A photonic quantum computer: single photons from a quantum dot, 276 interferometers on a chip, detectors at 2.5 K.',
        description:
          'A photonic quantum computer you can take apart in the browser: a quantum dot emits one photon per laser pulse, fibre delay lines bring them to a 24-mode chip together, superconducting detectors click. Modelled on the public figures of Quandela’s Belenos; not affiliated with Quandela.',
        locale: 'en_US',
      },
      fr: {
        title: 'Quantum · un ordinateur quantique photonique, démonté',
        line: 'Un ordinateur quantique photonique : des photons uniques issus d’une boîte quantique, 276 interféromètres sur une puce, des détecteurs à 2,5 K.',
        description:
          'Un ordinateur quantique photonique à démonter dans le navigateur : une boîte quantique émet un photon par impulsion laser, des lignes à retard en fibre les amènent ensemble sur une puce à 24 modes, des détecteurs supraconducteurs cliquent. D’après les chiffres publics du Belenos de Quandela ; sans lien avec Quandela.',
        locale: 'fr_FR',
      },
      es: {
        title: 'Quantum · un ordenador cuántico fotónico, desmontado',
        line: 'Un ordenador cuántico fotónico: fotones individuales de un punto cuántico, 276 interferómetros en un chip, detectores a 2,5 K.',
        description:
          'Un ordenador cuántico fotónico para desmontar en el navegador: un punto cuántico emite un fotón por pulso láser, líneas de retardo de fibra los llevan juntos a un chip de 24 modos, detectores superconductores hacen clic. Basado en las cifras públicas del Belenos de Quandela; sin relación con Quandela.',
        locale: 'es_ES',
      },
    },
  },
  {
    slug: 'spindl',
    name: 'Spindl',
    entry: 'machines/spindl/hdd-live/main.js',
    og: 'machines/spindl/og.png',
    meta: {
      en: {
        title: 'Spindl · a 3.5″ 7,200 rpm hard drive, taken apart',
        line: 'A 3.5″ desktop hard drive: spin-up, a seek drawn live, a head flying 3 nm above the platter, the emergency park.',
        description:
          'A desktop hard drive you can take apart in the browser: spin-up, head load, a seek drawn live, the rotational wait, the 3 nm flying height, the emergency park. Every gauge reads the model that moves the parts.',
        locale: 'en_US',
      },
      fr: {
        title: 'Spindl · un disque dur 3,5″ 7 200 tr/min, démonté',
        line: 'Un disque dur de bureau 3,5″ : le démarrage, un seek tracé en direct, une tête qui vole à 3 nm du plateau, le parking d’urgence.',
        description:
          'Un disque dur de bureau à démonter dans le navigateur : démarrage, chargement des têtes, un seek tracé en direct, l’attente rotationnelle, le vol à 3 nm, le parking d’urgence. Chaque jauge lit le modèle qui fait bouger les pièces.',
        locale: 'fr_FR',
      },
      es: {
        title: 'Spindl · un disco duro de 3,5″ y 7200 rpm, desmontado',
        line: 'Un disco duro de escritorio de 3,5″: el arranque, un seek dibujado en vivo, un cabezal que vuela a 3 nm del plato, el aparcamiento de emergencia.',
        description:
          'Un disco duro de escritorio para desmontar en el navegador: arranque, carga de los cabezales, un seek dibujado en vivo, la espera rotacional, el vuelo a 3 nm, el aparcamiento de emergencia. Cada indicador lee el modelo que mueve las piezas.',
        locale: 'es_ES',
      },
    },
  },
];

export const GALLERY = {
  en: {
    title: 'Exploded · machines taken apart in the browser',
    lead: 'Real machines, built from code with their real numbers, that you can take apart in the browser.',
    sub: 'Every gauge reads the same model that moves the parts. Left alone, each one plays a guided tour; any click hands control over.',
    open: 'Open',
    description: 'Real machines, built from code with their real numbers, that you can take apart in the browser: a hard drive, a photonic quantum computer.',
    locale: 'en_US',
  },
  fr: {
    title: 'Exploded · des machines démontées dans le navigateur',
    lead: 'De vraies machines, construites en code avec leurs vrais chiffres, à démonter dans le navigateur.',
    sub: 'Chaque jauge lit le modèle qui fait bouger les pièces. Laissée seule, chacune joue une visite guidée ; un clic suffit pour prendre la main.',
    open: 'Ouvrir',
    description: 'De vraies machines, construites en code avec leurs vrais chiffres, à démonter dans le navigateur : un disque dur, un ordinateur quantique photonique.',
    locale: 'fr_FR',
  },
  es: {
    title: 'Exploded · máquinas desmontadas en el navegador',
    lead: 'Máquinas reales, construidas en código con sus cifras reales, para desmontar en el navegador.',
    sub: 'Cada indicador lee el mismo modelo que mueve las piezas. Si la dejas sola, cada una hace una visita guiada; cualquier clic te da el control.',
    open: 'Abrir',
    description: 'Máquinas reales, construidas en código con sus cifras reales, para desmontar en el navegador: un disco duro, un ordenador cuántico fotónico.',
    locale: 'es_ES',
  },
};
