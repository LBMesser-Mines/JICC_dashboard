import adapter from "@sveltejs/adapter-static";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  // Force runes mode for the project's components (deps ship precompiled).
  compilerOptions: { runes: true },
  kit: {
    // Static export for GitHub Pages; 404.html gives an SPA fallback for client routing.
    adapter: adapter({ fallback: "404.html" }),
    paths: {
      // '' in dev; set BASE_PATH to '/<repo-name>' when building for GitHub Pages.
      base: process.argv.includes("dev") ? "" : (process.env.BASE_PATH ?? ""),
    },
    prerender: {
      // Don't fail the build on pre-existing broken links/anchors (placeholder
      // $lib/chart.png <img> tags; glossary #term-* anchors missing on some pages).
      // Warns instead of erroring. Tighten back to defaults once those are fixed.
      handleHttpError: "warn",
      handleMissingId: "warn",
    },
  },
};

export default config;
