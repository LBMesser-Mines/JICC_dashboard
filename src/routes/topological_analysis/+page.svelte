<script lang="ts">
  import Box from '$lib/box.svelte';
  import NetworkMap from '$lib/network_map.svelte';
  import {
    ROLE_COLORS,
    METRIC_OPTIONS,
    METRIC_RAMP,
    ZONE_OPTIONS,
    type ColorMode,
    type MetricKey,
    type Zone,
    computeConnectivityScores,
    computeMetricDomains,
    formatMetric,
  } from '$lib/network_graph';
  import type { PageProps } from './$types';
  import type { Route, NodeId } from '$lib/types';

  let { data }: PageProps = $props();

  let selectedId = $state<NodeId | null>(null);
  let selectedRoutes = $state<Route[]>([]);
  let selectedRouteIndex = $state<number | null>(null);
  let colorMode = $state<ColorMode>('role');
  let zones = $state<Zone[]>(['US', 'MX']);

  const focusRoute = $derived(
    selectedRouteIndex != null ? (selectedRoutes[selectedRouteIndex] ?? null) : null,
  );

  // Domains for the gradient legend (cheap; mirrors what the map computes).
  const connScores = $derived(computeConnectivityScores(data.results.connectivity));
  const domains = $derived(
    computeMetricDomains(data.results.network, data.results.centrality, connScores),
  );
  const rampGradient = `linear-gradient(to right, ${METRIC_RAMP.join(', ')})`;

  function handleSelect(info: { id: NodeId | null; routes: Route[] }) {
    selectedId = info.id;
    selectedRoutes = info.routes;
    selectedRouteIndex = null; // reset route focus on new node
  }

  function clearSelection() {
    selectedId = null;
    selectedRoutes = [];
    selectedRouteIndex = null;
  }

  function selectRoute(i: number) {
    selectedRouteIndex = selectedRouteIndex === i ? null : i; // toggle
  }

  function toggleZone(z: Zone) {
    zones = zones.includes(z) ? zones.filter((x) => x !== z) : [...zones, z];
  }
</script>

<title>JICC Dashboard</title>

<div class="display">
  <Box>
    <div class="toolbar">
      <span class="toolbar-label">Color by</span>
      {#each METRIC_OPTIONS as opt}
        <button
          class="toggle"
          class:active={colorMode === opt.key}
          onclick={() => (colorMode = opt.key)}
        >{opt.label}</button>
      {/each}

      <span class="separator"></span>

      <span class="toolbar-label">Zones</span>
      {#each ZONE_OPTIONS as opt}
        <button
          class="toggle"
          class:active={zones.includes(opt.key)}
          onclick={() => toggleZone(opt.key)}
        >{opt.label}</button>
      {/each}
    </div>

    <NetworkMap
      network={data.results.network}
      routes={data.results.routes}
      centrality={data.results.centrality}
      connectivity={data.results.connectivity}
      metric={colorMode}
      {zones}
      highlightRoutes={selectedRoutes}
      {focusRoute}
      onselect={handleSelect}
    />

    {#if colorMode === 'role'}
      <div class="legend">
        {#each Object.entries(ROLE_COLORS) as [role, color]}
          <span class="chip"><i style="background:{color}"></i>{role}</span>
        {/each}
      </div>
    {:else}
      <div class="legend legend-metric">
        <span class="metric-name">{METRIC_OPTIONS.find((o) => o.key === colorMode)?.label}</span>
        <span class="bound">{formatMetric(domains[colorMode as MetricKey][0])}</span>
        <span class="ramp" style="background:{rampGradient}"></span>
        <span class="bound">{formatMetric(domains[colorMode as MetricKey][1])}</span>
      </div>
    {/if}
  </Box>

  <Box title={selectedId ? `Routes through ${selectedId}` : 'Select a node'}>
    {#if selectedId}
      <button class="clear" onclick={clearSelection}>Clear selection</button>
    {/if}
    {#if selectedRoutes.length}
      <p class="count">
        {selectedRoutes.length} route{selectedRoutes.length === 1 ? '' : 's'}
        <span class="hint">· click one to focus it</span>
      </p>
      <ul class="routes">
        {#each selectedRoutes as r, i}
          <li>
            <button class="route" class:active={selectedRouteIndex === i} onclick={() => selectRoute(i)}>
              <b>{r.commodity}</b> · {r.vehicle_type} ×{r.vehicle_count}<br />
              <span class="od">{r.origin} → {r.destination}</span><br />
              <span class="meta">{r.distance} hops · every {r.departure_interval}h</span>
            </button>
          </li>
        {/each}
      </ul>
    {:else if selectedId}
      <p>No routes pass through this node.</p>
    {:else}
      <p>Click a node on the map to see the routes it participates in.</p>
    {/if}
  </Box>
</div>

<style>
  .display {
    display: grid;
    grid-template-columns: minmax(0, 3fr) minmax(260px, 1fr);
    gap: 1rem;
    padding: 1rem;
  }
  .toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.4rem;
    margin-bottom: 0.75rem;
  }
  .toolbar-label {
    font-size: 0.8rem;
    color: #666;
    margin-right: 0.25rem;
  }
  .separator {
    width: 1px;
    align-self: stretch;
    background: #ddd;
    margin: 0 0.5rem;
  }
  .toggle {
    padding: 0.3rem 0.7rem;
    border: 1px solid #ccc;
    border-radius: 6px;
    background: #fff;
    font-size: 0.8rem;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s;
  }
  .toggle:hover {
    background: #f0f0f0;
  }
  .toggle.active {
    background: #333;
    border-color: #333;
    color: #fff;
    font-weight: 600;
  }
  .legend {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 1rem;
    margin-top: 0.75rem;
    font-size: 0.9rem;
  }
  .legend .chip {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    text-transform: capitalize;
  }
  .legend .chip i {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    display: inline-block;
    border: 1px solid #fff;
    box-shadow: 0 0 0 1px #ccc;
  }
  .legend-metric {
    gap: 0.5rem;
  }
  .legend-metric .metric-name {
    font-weight: 600;
    margin-right: 0.25rem;
  }
  .legend-metric .ramp {
    width: 160px;
    height: 12px;
    border-radius: 3px;
    border: 1px solid #ccc;
  }
  .legend-metric .bound {
    font-size: 0.8rem;
    color: #555;
  }
  .clear {
    display: inline-block;
    margin-bottom: 0.6rem;
    padding: 0.3rem 0.7rem;
    border: 1px solid #ccc;
    border-radius: 6px;
    background: #fff;
    font-size: 0.8rem;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s;
  }
  .clear:hover {
    background: #f0f0f0;
    border-color: #999;
  }
  .count {
    margin: 0 0 0.5rem;
    font-weight: 600;
  }
  .count .hint {
    font-weight: 400;
    color: #888;
    font-size: 0.8rem;
  }
  .routes {
    list-style: none;
    margin: 0;
    padding: 0;
    max-height: 560px;
    overflow-y: auto;
  }
  .routes li {
    border-bottom: 1px solid #eee;
  }
  .route {
    display: block;
    width: 100%;
    text-align: left;
    background: none;
    border: none;
    border-left: 3px solid transparent;
    padding: 0.5rem 0.5rem;
    font-size: 0.85rem;
    line-height: 1.4;
    cursor: pointer;
  }
  .route:hover {
    background: #f6f6f6;
  }
  .route.active {
    background: #fef2f2;
    border-left-color: #ef4444;
  }
  .route .od {
    color: #1d4ed8;
    word-break: break-all;
  }
  .route .meta {
    color: #666;
  }
  @media (max-width: 720px) {
    .display {
      grid-template-columns: 1fr;
    }
  }
</style>
