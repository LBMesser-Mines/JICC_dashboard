// Ambient declaration for the `virtual:scenarios` module provided by the
// scenariosPlugin in vite.config.ts. Kept as a script (no import/export) so the
// declaration is global.
declare module "virtual:scenarios" {
  /** Dataset folder names under static/data, discovered at build time. */
  export const SCENARIOS: string[];
}
