export const THEME_STORAGE_KEY = "matan.theme";

/** Inline, dependency-free script that applies the stored theme before hydration (used in the root layout). */
export const themeInitScript = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");var r=t==="light"||t==="dark"?t:(t==="system"&&window.matchMedia("(prefers-color-scheme: light)").matches?"light":"dark");document.documentElement.dataset.theme=r;document.documentElement.style.colorScheme=r;}catch(e){}})();`;
