<script lang="ts">
  import Box from "$lib/box.svelte";

  import Contact from '$lib/contact.svelte';
  import {emails} from '$lib/config.json'

  import Glossary from '$lib/glossary.svelte';
</script>

<title>JICC Dashboard</title>
<div class="grid">
  <Box title=Why>
    <p>This dashboard was developed by the Mines/Colombia Office of Naval Research (ONR) team in collaboration with the JICC to help users identify when and where to allocate resources for maximum disruption of the drug network. It is currently under development, and its final outputs are still being refined.</p>
  </Box>
</div>
<div class="twoColumnOffset">
  <Box title="Key Terms">
    <Glossary /> 
  </Box>
  <Box title="Contributor">
    <h3>ONR</h3>
    <p>Dr. Krebs</p>
    <h3>Colombia</h3>
    <p> Dr. Bienstock </p>
    <h3>Mines</h3>
    <ul>
      <li>Dr. Newman</li>
      <li>Luke Messer </li>
      <li>Brandon Werling</li>
      <li>Justin Kilb</li>
      <li>Jordan Ida</li>
      <li>Jeremey Reynolds</li>
      <li>Nich Buch</li>
    </ul>
    <Contact name={emails.Luke.name} email={emails.Luke.email} subject={"JICC Dashboard Questions"}></Contact>
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

