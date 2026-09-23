<script lang="ts">
  import Box from "$lib/box.svelte";
  import LineChart from '$lib/line_chart.svelte';
  import results from '$lib/data/results.json';
  import resultsTwo from '$lib/data/resultsTwo.json';
 
  import NetworkMap, { type Point } from '$lib/NetworkMap.svelte';
    import NetworkMap from "$lib/NetworkMap.svelte";

  const points: Point[] = [
    { lat: 39.74, lon: -104.99, name: 'Denver', type: 'supply' },
    { lat: 38.83, lon: -104.82, name: 'Colorado Springs', type: 'transshipment' },
    { lat: 40.59, lon: -105.08, name: 'Fort Collins', type: 'demand' }
  ];

	let count = $state(0);
  const items = [
  {title: 'Supply', value: 42},
  {title: 'Demand', value: 35},
  ];
  let scenario = $state("base");
  
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
    <p>Current Scenario {scenario}</p>
    <select bind:value={scenario}>
      <option value="base">Base Case</option>
      <option value="contested">Contested</option>
    </select>
    <button onclick={()=>count++}>Solved scearnio: {scenario}: {count} times</button>
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

<div class="grid">
  <Box title="Chart Testing">
    <LineChart x="iteration" series={[
      {rows: results, y:'cost',label:'Incumbent'},
      {rows: results, y:'lower_bound',label:'Lower Bound'},
      {rows: results, y:'gap_pct',label:'Gap(%)',axis:'right'},
      ]}
    />
  </Box>
</div>
<div class="grid">
  <Box title="Chart Testing">
    <LineChart x="iteration" series={[
      {rows: results, y:'cost',label:'Run 1'},
      {rows: resultsTwo, y:'lower_bound',label:'Run 2'},
      ]}
    />
  </Box>
</div>
<div class="grid">
  <NetworkMap {points}/>
</div>

<style>
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit,minmax(250px,1fr));
  gap: 1rem;
  padding: 1rem;
}
</style>
