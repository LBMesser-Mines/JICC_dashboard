<script lang="ts">
  import Box from "$lib/box.svelte";
	let count = $state(0);
  const items = [
  {title: 'Supply', value: 42},
  {title: 'Demand', value: 35},
  ];
</script>

<title>JICC Dashboard</title>
<div class="grid">
  <Box title="Stats">
    <p>Showing Stats</p>
    <button onclick={() => count++}>clicked {count} times</button>
  </Box>
  <Box title="Chart?">
    <img src="$lib/chart.png" alt="Chart" />
    <button onclick={() => count++}>clicked {count} times</button>
  </Box>
  <Box>
    <ul><li>Me</li></ul>
  </Box> 
</div>

<div class="grid">
  {#each items as item}
    <Box title={item.title}>
      <p>{item.value}</p>
    </Box>
  {/each}
  <Box>
    {#snippet footer()}<small>Updated today</small>{/snippet}
    <p>Main Content</p>
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
