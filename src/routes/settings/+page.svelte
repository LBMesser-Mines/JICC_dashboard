<script lang="ts">
  import Box from "$lib/box.svelte";
	let count = $state(0);
 
  import Term from '$lib/term.svelte';
  import { createUsedTerms } from '$lib/glossary_context'; 
  createUsedTerms();
</script>

<title>JICC Dashboard</title>
<div class="grid">
  <Box>
  	<p>WIP</p>
  </Box>
</div>


<style>
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit,minmax(250px,1fr));
  gap: 1rem;
  padding: 1rem;
}
</style>


