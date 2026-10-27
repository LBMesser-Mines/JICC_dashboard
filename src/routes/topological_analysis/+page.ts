import type { PageLoad } from "./$types";
import type { TopoAnalysis } from "$lib/types";
import { base } from "$app/paths";
import { error } from "@sveltejs/kit";
import { getScenario } from "$lib/scenario";

// The full network is large and loaded client-side; don't prerender (which would
// embed the whole payload in the page HTML).
export const prerender = false;

export const load: PageLoad = async ({ fetch, depends }) => {
  depends("app:scenario");
  const dir = encodeURIComponent(getScenario());
  const res = await fetch(`${base}/data/${dir}/topoAnalysis.json`);
  if (!res.ok) error(res.status, "Could not load topoAnalysis.json");
  const results: TopoAnalysis = await res.json();
  return { results };
};
