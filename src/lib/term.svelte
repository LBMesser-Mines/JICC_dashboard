<script lang="ts">
  import type { Snippet } from 'svelte';
  import { glossary, type TermID } from '$lib/glossary';
  import { getUsedTerms } from '$lib/glossary_context';

  /** `children` overrides the displayed text (defaults to the glossary term). */
  let { id, children }: { id: TermID; children?: Snippet } = $props();
  const entry = $derived(glossary[id]);

  const used = getUsedTerms();
  $effect(() => {
    used?.add(id);
  });

  const popupId = $props.id();
  const WIDTH = 280;
  const GAP = 8;
  let anchor: HTMLAnchorElement;
  let pos = $state<{ left: number; top: number; below: boolean } | null>(null);

  // Fixed positioning so the popup escapes scrolling/overflow containers.
  function show() {
    const r = anchor.getBoundingClientRect();
    const left = Math.min(Math.max(r.left + r.width / 2 - WIDTH / 2, GAP), window.innerWidth - WIDTH - GAP);
    const below = r.top < 160; // not enough room above (sticky nav)
    pos = { left, top: below ? r.bottom + GAP : r.top - GAP, below };
  }
  function hide() {
    pos = null;
  }
</script>

<svelte:window onscroll={hide} />

<a
  bind:this={anchor}
  class="term"
  href={`#term-${id}`}
  aria-describedby={pos ? popupId : undefined}
  onmouseenter={show}
  onmouseleave={hide}
  onfocus={show}
  onblur={hide}
>{#if children}{@render children()}{:else}{entry.term}{/if}</a>

{#if pos}
  <span
    id={popupId}
    role="tooltip"
    class="popup"
    class:below={pos.below}
    style="left:{pos.left}px; top:{pos.top}px; width:{WIDTH}px"
  >
    <strong>{entry.term}</strong>
    <span>{entry.definition}</span>
  </span>
{/if}

<style>
  .term {
    color: inherit;
    text-decoration: underline dotted #888;
    text-underline-offset: 3px;
    cursor: help;
  }
  .term:hover,
  .term:focus-visible {
    text-decoration-color: currentColor;
  }
  .popup {
    position: fixed;
    z-index: 100;
    transform: translateY(-100%);
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding: 0.6rem 0.75rem;
    border-radius: 6px;
    background: #1f2937;
    color: #f9fafb;
    font-size: 0.8rem;
    font-weight: 400;
    line-height: 1.4;
    text-align: left;
    text-transform: none;
    letter-spacing: normal;
    white-space: normal;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    pointer-events: none;
  }
  .popup.below {
    transform: none;
  }
  .popup strong {
    font-weight: 600;
  }
</style>
