<script lang="ts">
  import { glossary, type TermID } from '$lib/glossary';
  import { getUsedTerms } from '$lib/glossary_context';

  let { onlyUsed = false }: { onlyUsed?: boolean } = $props();
  const used = getUsedTerms();

  const entries = $derived(
    Object.entries(glossary)
      .filter(([id]) => !onlyUsed || used?.has(id as TermID))
      .sort(([, a], [, b]) => a.term.localeCompare(b.term))
  );
</script>

<ul class="glossary">
  {#each entries as [id, { term, definition }] (id)}
    <li id={`term-${id}`}><strong>{term}</strong>: {definition}</li>
  {/each}
</ul>
