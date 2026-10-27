// Selected dataset scenario, shared across pages and persisted to localStorage.
// The data loaders build their fetch paths from this (e.g. /data/<scenario>/solution.json).
import { browser } from "$app/environment";
import { writable } from "svelte/store";
import { SCENARIOS } from "virtual:scenarios";

const KEY = "jicc.scenario";

export { SCENARIOS };
export const DEFAULT_SCENARIO = SCENARIOS[0] ?? "";

/** Current scenario — localStorage on the client, default during prerender. */
export function getScenario(): string {
  if (browser) {
    const saved = localStorage.getItem(KEY);
    if (saved && SCENARIOS.includes(saved)) return saved;
  }
  return DEFAULT_SCENARIO;
}

export const scenario = writable<string>(getScenario());

if (browser) {
  scenario.subscribe((v) => {
    if (v) localStorage.setItem(KEY, v);
  });
}
