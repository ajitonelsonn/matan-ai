/**
 * Self-hosted fonts (via @fontsource packages) so builds and dev never depend
 * on fonts.googleapis.com being reachable. Files are served from /_next/static.
 */
import localFont from "next/font/local";

export const inter = localFont({
  variable: "--font-inter",
  display: "swap",
  src: [
    { path: "../../node_modules/@fontsource-variable/inter/files/inter-latin-standard-normal.woff2", style: "normal" },
    { path: "../../node_modules/@fontsource-variable/inter/files/inter-latin-ext-standard-normal.woff2", style: "normal" },
  ],
});

export const caveat = localFont({
  display: "swap",
  src: [
    { path: "../../node_modules/@fontsource/caveat/files/caveat-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "../../node_modules/@fontsource/caveat/files/caveat-latin-600-normal.woff2", weight: "600", style: "normal" },
  ],
});
