<script lang="ts">
  import Box from "$lib/box.svelte";
</script>

<title>JICC Dashboard</title>
<div class="grid">
  <Box title=Why>
    <p>Text describing what this dashboard is about and why this project exists</p>
  </Box>
</div>
<div class="twoColumnOffset">
  <Box title="Key Terms">
    <ul>
      <li>Node: a node definition</li>
      <li>Edge: an edge defintion</li>
    </ul>
  </Box>
  <Box title="Contributor">
    <h3>ONR</h3>
    <p>Kip</p>
    <h3>Colombia</h3>
    <p>Dan</p>
    <h3>Mines</h3>
    <ul>
      <li>Luke</li>
      <li>Brandon</li>
      <li>etc.</li>
    </ul>
  </Box>
</div>


<style>
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit,minmax(250px,1fr));
    gap: 1rem;
    padding: 1rem;
  }
  .twoColumnOffset {
    display: grid;
    grid-template-columns: 1fr 300px;
    gap: 1rem;
    padding: 1rem;
  }
</style>

