import type { PageLoad } from "./$types";
import type { Solution, DeploymentReport } from "$lib/types";
import { base } from "$app/paths";
import { error } from "@sveltejs/kit";
import { getScenario } from "$lib/scenario";

// The full-network backdrop is large and loaded client-side; don't prerender
// (which would embed the payload in the page HTML).
export const prerender = false;

interface Coverage {
  /** Nodes within a deployed sensor's radius. [lat, lon]. */
  covered: [number, number][];
  /** The rest of the network — a non-interactive grey backdrop. [lat, lon]. */
  uncovered: [number, number][];
}

export const load: PageLoad = async ({ fetch, depends }) => {
  depends("app:scenario");
  const dir = encodeURIComponent(getScenario());

  const [solRes, repRes, covRes] = await Promise.all([
    fetch(`${base}/data/${dir}/solution.json`),
    fetch(`${base}/data/${dir}/deployment_report.json`),
    fetch(`${base}/data/${dir}/coverage.json`),
  ]);
  for (const [res, name] of [
    [solRes, "solution.json"],
    [repRes, "deployment_report.json"],
    [covRes, "coverage.json"],
  ] as const) {
    if (!res.ok) error(res.status, `Could not load ${name}`);
  }

  const solution: Solution = await solRes.json();
  const report: DeploymentReport = await repRes.json();
  const coverage: Coverage = await covRes.json();

  const sensors = report.deployments.map((d) => ({ id: d.node, lat: d.lat, lon: d.lon }));
  return { solution, report, covered: coverage.covered, uncovered: coverage.uncovered, sensors };
};
