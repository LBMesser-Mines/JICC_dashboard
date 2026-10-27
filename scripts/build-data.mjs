// Build-time data preprocessing.
//
// Reads each scenario folder under data_raw/ (the large, new-format solver
// output — hundreds of MB) and emits small, browser-friendly derived files into
// static/data/<scenario>/ that the SvelteKit app fetches:
//
//   solution.json           copied through (KB-sized optimizer result)
//   deployment_report.json  copied through (per-sensor derivations)
//   topoAnalysis.json        the FULL network for the Topological page — every
//                            node (incl. road waypoints) with explicit role/zone,
//                            full route paths, and edges synthesized from route
//                            legs. Large (100MB+); loaded client-side (not
//                            prerendered) so it isn't embedded in HTML.
//   coverage.json            positions of every node for the Sensor Assignment
//                            map: covered (green) vs uncovered backdrop (grey).
//
// data_raw/ is git-ignored and absent on CI; the derived static/data/ files are
// committed, so this script no-ops gracefully when a raw folder is missing.

import fs from "node:fs";
import path from "node:path";

const RAW = "data_raw";
const OUT = "static/data";

const round = (v, d = 5) => {
  const f = 10 ** d;
  return Math.round(v * f) / f;
};

/** Great-circle distance between [lat, lon] points, in km. */
function haversine(a, b) {
  const R = 6371;
  const toR = (x) => (x * Math.PI) / 180;
  const dLat = toR(b[0] - a[0]);
  const dLon = toR(b[1] - a[1]);
  const la1 = toR(a[0]);
  const la2 = toR(b[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Zone from role: supply ports are in Mexico, everything else US-side. */
const zoneOf = (role) => (role === "supply" ? "MX" : "US");

function findFile(dir, suffix) {
  const f = fs.readdirSync(dir).find((x) => x.endsWith(suffix));
  return f ? path.join(dir, f) : null;
}

const readJSON = (p) => JSON.parse(fs.readFileSync(p));
const writeJSON = (p, o) => fs.writeFileSync(p, JSON.stringify(o));

function dedupeConsecutive(arr) {
  return arr.filter((v, i) => i === 0 || v !== arr[i - 1]);
}

function processScenario(name) {
  const dir = path.join(RAW, name);
  const solF = findFile(dir, "_solution.json");
  const repF = findFile(dir, "_solution_report.json");
  const topoF = findFile(dir, "_topological.json");
  if (!solF || !repF || !topoF) {
    console.warn(`  skip "${name}": missing solution/report/topological file`);
    return false;
  }

  const solution = readJSON(solF);
  const report = readJSON(repF);
  const topo = readJSON(topoF);

  const nodes = topo.nodes ?? [];
  const coveredSet = new Set(solution.covered ?? []);
  const deployedSet = new Set(solution.deployed ?? []);

  // ---- coverage.json: every node's position, split covered vs backdrop ----
  // Positions only (non-sensor nodes aren't interactive), so this stays small.
  const covered = [];
  const uncovered = [];
  for (const n of nodes) {
    const p = [round(n.lat), round(n.lon)];
    if (coveredSet.has(n.name)) covered.push(p);
    else if (!deployedSet.has(n.name)) uncovered.push(p);
  }

  // ---- topoAnalysis.json: the FULL network, app-shaped ----
  const outNodes = nodes.map((n) => ({
    id: n.name,
    pos: [round(n.lat), round(n.lon)],
    role: n.role,
    zone: zoneOf(n.role),
  }));

  const srcRoutes = topo.routes ?? [];
  const outRoutes = srcRoutes.map((r) => ({ ...r, path: dedupeConsecutive(r.path ?? []) }));

  // Edges: unique consecutive pairs along the full route paths (the road geometry
  // the routes trace). Distance is the great-circle gap — per-leg distances aren't
  // in the format.
  const posByName = new Map(nodes.map((n) => [n.name, [n.lat, n.lon]]));
  const edgeMap = new Map();
  for (const r of outRoutes) {
    for (let i = 0; i < r.path.length - 1; i++) {
      const a = r.path[i];
      const b = r.path[i + 1];
      const key = `${a}|${b}`;
      if (edgeMap.has(key)) continue;
      const pa = posByName.get(a);
      const pb = posByName.get(b);
      edgeMap.set(key, { origin: a, destination: b, distance: pa && pb ? round(haversine(pa, pb), 2) : 0 });
    }
  }

  // Centrality: new key "betweenness" -> app's "betweenness_subset"; rounded to trim size.
  const srcCent = topo.centrality ?? {};
  const outCent = { betweenness_subset: {}, degree: {}, closeness: {}, katz: {} };
  const copyCent = (dst, srcKey) => {
    const s = srcCent[srcKey] ?? {};
    for (const k in s) dst[k] = round(s[k], 6);
  };
  copyCent(outCent.betweenness_subset, "betweenness");
  copyCent(outCent.degree, "degree");
  copyCent(outCent.closeness, "closeness");
  copyCent(outCent.katz, "katz");

  const roleCounts = { supply: 0, demand: 0, transshipment: 0 };
  for (const n of nodes) roleCounts[n.role] = (roleCounts[n.role] ?? 0) + 1;

  const topoAnalysis = {
    metadata: {
      source: topo.metadata?.source ?? name,
      name: topo.metadata?.name ?? name,
      nodes: outNodes.length,
      edges: edgeMap.size,
      role_counts: roleCounts,
    },
    network: { directed: true, multigraph: false, graph: {}, nodes: outNodes, edges: [...edgeMap.values()] },
    routes: outRoutes,
    centrality: outCent,
    connectivity: { poe_to_demand: { percents: [], max_paths: 0, results: {} } },
  };

  // ---- write ----
  const outDir = path.join(OUT, name.trim());
  fs.mkdirSync(outDir, { recursive: true });
  writeJSON(path.join(outDir, "solution.json"), solution);
  writeJSON(path.join(outDir, "deployment_report.json"), report);
  writeJSON(path.join(outDir, "topoAnalysis.json"), topoAnalysis);
  writeJSON(path.join(outDir, "coverage.json"), { covered, uncovered });

  console.log(
    `  built "${name.trim()}": ${outNodes.length} nodes, ${edgeMap.size} edges, ${outRoutes.length} routes, ${covered.length} covered, ${uncovered.length} backdrop`,
  );
  return true;
}

function main() {
  if (!fs.existsSync(RAW)) {
    console.log(`[build-data] ${RAW}/ not present — using committed static/data/ files.`);
    return;
  }
  const scenarios = fs
    .readdirSync(RAW, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
  if (!scenarios.length) {
    console.log(`[build-data] no scenario folders in ${RAW}/.`);
    return;
  }
  console.log(`[build-data] processing ${scenarios.length} scenario(s) from ${RAW}/`);
  for (const name of scenarios) {
    try {
      processScenario(name);
    } catch (err) {
      console.error(`  error in "${name}":`, err.message);
    }
  }
}

main();
