import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig, type Plugin } from "vite";
import fs from "node:fs";
import path from "node:path";

// Exposes `virtual:scenarios` -> { SCENARIOS: string[] }, the list of dataset
// sub-directories under static/data (one folder per scenario). Auto-discovered
// at build time; the dev server reloads when a folder is added or removed.
function scenariosPlugin(): Plugin {
  const virtualId = "virtual:scenarios";
  const resolvedId = "\0" + virtualId;
  const dataDir = path.resolve("static/data");

  const list = () => {
    try {
      return fs
        .readdirSync(dataDir, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name)
        .sort();
    } catch {
      return [];
    }
  };

  return {
    name: "scenarios",
    resolveId(id) {
      if (id === virtualId) return resolvedId;
    },
    load(id) {
      if (id === resolvedId) return `export const SCENARIOS = ${JSON.stringify(list())};`;
    },
    configureServer(server) {
      server.watcher.add(dataDir);
      const reload = (file: string) => {
        if (!file.startsWith(dataDir)) return;
        const mod = server.moduleGraph.getModuleById(resolvedId);
        if (mod) server.moduleGraph.invalidateModule(mod);
        server.ws.send({ type: "full-reload" });
      };
      server.watcher.on("addDir", reload);
      server.watcher.on("unlinkDir", reload);
    },
  };
}

// SvelteKit config (adapter, runes, paths) lives in svelte.config.js.
export default defineConfig({
  plugins: [scenariosPlugin(), sveltekit()],
  optimizeDeps: { exclude: ["maplibre-gl"] },
  // MapLibre's worker is an ES module (see network_map.svelte).
  worker: { format: "es" },
});
