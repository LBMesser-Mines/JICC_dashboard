<script lang="ts">
  import { glossary, type TermID } from '$lib/glossary';
  import { getUsedTerms } from '$lib/glossary_context';

  let { id }: { id: TermID } = $props();
  const entry = $derived(glossary[id]);

  getUsedTerms()?.add(id)
</script>

<a class="term" href={`#term-${id}`} title={entry.definition}>{entry.term}</a>
