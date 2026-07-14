// Zet de kleurmodus (licht/donker) VOORDAT de pagina zichtbaar wordt, zodat er geen
// flits van het verkeerde thema is. Staat als losse string omdat dit script buiten
// React om rechtstreeks in <head> wordt geplakt (zie app/layout.tsx).
export const THEME_STORAGE_KEY = "nuvlo-theme";

export const themeInitScript = `
(function () {
  try {
    var stored = localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
    var isDark = stored ? stored === "dark" : true;
    document.documentElement.classList.toggle("dark", isDark);
  } catch (e) {}
})();
`;
