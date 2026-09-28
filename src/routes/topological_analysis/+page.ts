import type { PageLoad } from "./$types";
import type { TopoAnalysis } from "$lib/types";
import { asset } from "$app/paths";
import { error } from "@sveltejs/kit";

export const load: PageLoad = async ({ fetch }) => {
  const res = await fetch(asset("/data/topoAnalysis.json"));
  if (!res.ok) error(res.status, "Could not load topoAnalysis.json");
  const results: TopoAnalysis = await res.json();
  return { results };
};
