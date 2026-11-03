// The site's languages, shared by every machine: English (the default), French and Spanish. The language comes from
// ?lang=, else the capture's config ({lang}), else <html lang> (the build writes one page per language), else English.
// Numbers are formatted in the same locale: 7,200 / 7 200 / 7200, 8.33 / 8,33.
//
// Each machine keeps its own dictionary and builds its T() with makeT(); the strings of the page's header and footer
// (chrome.js) are here, so every machine says them the same way.
export const LANGS = ['en', 'fr', 'es'];
export const LANG = (() => {
  let l = null;
  try {
    l = new URLSearchParams(location.search).get('lang') || window.__SIM_CONFIG?.lang || document.documentElement.lang;
  } catch {
    l = 'en';
  }
  return LANGS.includes(l) ? l : 'en';
})();
const LOCALE = {en: 'en-US', fr: 'fr-FR', es: 'es-ES'}[LANG];
/** a number in the page's language; thin spaces for French thousands */
export const nf = (x, d = 0) => Number(x).toLocaleString(LOCALE, {minimumFractionDigits: d, maximumFractionDigits: d, useGrouping: LANG === 'es' ? 'min2' : true}).replace(/ /g, ' ');

export const SITE_STRINGS = {
  navLabel: {en: 'Menu', fr: 'Menu', es: 'Menú'},
  navMachines: {en: 'Machines', fr: 'Machines', es: 'Máquinas'},
  navAbout: {en: 'About', fr: 'À propos', es: 'Acerca de'},
  navProjects: {en: 'Projects', fr: 'Projets', es: 'Proyectos'},
  ghTitle: {en: 'Exploded on GitHub', fr: 'Exploded sur GitHub', es: 'Exploded en GitHub'},
  grpLang: {en: 'LANGUAGE', fr: 'LANGUE', es: 'IDIOMA'},
  footLicense: {en: 'Code under the MIT licence', fr: 'Code sous licence MIT', es: 'Código bajo licencia MIT'},
  footSources: {en: 'Sources', fr: 'Sources', es: 'Fuentes'},
};

/** T(key, ...args) over a machine's dictionary and the site's strings; extra arguments fill a templated string */
export const makeT = (S) => {
  const all = {...SITE_STRINGS, ...S};
  return (key, ...args) => {
    const e = all[key];
    if (!e) return key;
    const v = e[LANG] ?? e.en;
    return typeof v === 'function' ? v(...args) : v;
  };
};
