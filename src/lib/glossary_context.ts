import { getContext, setContext } from "svelte";
import { SvelteSet } from "svelte/reactivity";
import type { TermID } from "./glossary";

const KEY = Symbol("used-terms");

export function createUsedTerms() {
  return setContext(KEY, new SvelteSet<TermID>());
}

export function getUsedTerms() {
  return getContext<SvelteSet<TermID> | undefined>(KEY);
}
