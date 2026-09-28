<script lang="ts">
  import Box from '$lib/box.svelte';
  import NetworkMap from '$lib/network_map.svelte';
  import NodeDetails from '$lib/node_details.svelte';
  import RouteDetails from '$lib/route_details.svelte';
  import Term from '$lib/term.svelte';
  import {
    ROLE_COLORS,
    METRIC_OPTIONS,
    METRIC_RAMP,
    ZONE_OPTIONS,
    type ColorMode,
    type MetricKey,
    type Zone,
    computeConnectivityScores,
    routesForNode,
    buildAdjacency,
    pathLength,
    formatKm,
    computeMetricDomains,
    formatMetric,
  } from '$lib/network_graph';
  import type { PageProps } from './$types';
  import type { Route, NodeId, NodeRole } from '$lib/types';

  let { data }: PageProps = $props();

  let selectedId = $state<NodeId | null>(null);
  // Raw: routes are never mutated, and selectNode() matches them by identity.
  let selectedRoutes = $state.raw<Route[]>([]);
  let focusRoute = $state.raw<Route | null>(null);
  let colorMode = $state<ColorMode>('role');
  let zones = $state<Zone[]>(['US', 'MX']);
  /** Commodity filter for the route list; 'all' shows every route. */
  let commodity = $state<string>('all');

  const commodities = $derived([...new Set(data.results.routes.map((r) => r.commodity))].sort());

  // Total km of every route, for the route list.
  const routeKm = $derived.by(() => {
    const adj = buildAdjacency(data.results.network);
    return new Map(data.results.routes.map((r) => [r, pathLength(r.path, adj)]));
  });

  const SORT_OPTIONS = [
    { key: 'default', label: 'Default' },
    { key: 'drug-desc', label: 'Drug amount: high → low' },
    { key: 'drug-asc', label: 'Drug amount: low → high' },
    { key: 'dist-desc', label: 'Distance: long → short' },
    { key: 'dist-asc', label: 'Distance: short → long' },
  ] as const;
  let sortKey = $state<(typeof SORT_OPTIONS)[number]['key']>('default');

  const visibleRoutes = $derived.by(() => {
    const list =
      commodity === 'all' ? selectedRoutes.slice() : selectedRoutes.filter((r) => r.commodity === commodity);
    const km = (r: Route) => routeKm.get(r) ?? 0;
    switch (sortKey) {
      case 'drug-desc': return list.sort((a, b) => b.commodity_count - a.commodity_count);
      case 'drug-asc': return list.sort((a, b) => a.commodity_count - b.commodity_count);
      case 'dist-desc': return list.sort((a, b) => km(b) - km(a));
      case 'dist-asc': return list.sort((a, b) => km(a) - km(b));
      default: return list;
    }
  });

  // Domains for the gradient legend (cheap; mirrors what the map computes).
  const connScores = $derived(computeConnectivityScores(data.results.connectivity));
  const domains = $derived(
    computeMetricDomains(data.results.network, data.results.centrality, connScores),
  );
  const rampGradient = `linear-gradient(to right, ${METRIC_RAMP.join(', ')})`;

  /** Map click: a node (keeps the focused route if the node is on it) or empty map. */
  function handleSelect(info: { id: NodeId | null; routes: Route[] }) {
    if (info.id) selectNode(info.id);
    else clearSelection();
  }

  function clearSelection() {
    selectedId = null;
    selectedRoutes = [];
    focusRoute = null;
  }

  /** Select a node from the map or the details panels. The focused route stays focused when the node is on it. */
  function selectNode(id: NodeId) {
    selectedId = id;
    selectedRoutes = routesForNode(data.results.routes, id);
    if (focusRoute && !selectedRoutes.includes(focusRoute)) focusRoute = null;
  }

  function selectRoute(r: Route) {
    focusRoute = focusRoute === r ? null : r; // toggle
  }

  function setCommodity(c: string) {
    commodity = c;
    if (focusRoute && c !== 'all' && focusRoute.commodity !== c) focusRoute = null;
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
      highlightRoutes={visibleRoutes}
      {focusRoute}
      {selectedId}
      onselect={handleSelect}
    />

    {#if colorMode === 'role'}
      <div class="legend">
        <span class="metric-name"><Term id="role" /></span>
        {#each Object.entries(ROLE_COLORS) as [role, color]}
          <span class="chip"><i style="background:{color}"></i><Term id={role as NodeRole} /></span>
        {/each}
      </div>
    {:else}
      <div class="legend legend-metric">
        <span class="metric-name"><Term id={colorMode as MetricKey} /></span>
        <span class="bound">{formatMetric(domains[colorMode as MetricKey][0])}</span>
        <span class="ramp" style="background:{rampGradient}"></span>
        <span class="bound">{formatMetric(domains[colorMode as MetricKey][1])}</span>
      </div>
    {/if}
  </Box>

  <Box title={selectedId ? `Routes through ${selectedId}` : 'Select a node'}>
    {#if selectedId}
      <div class="list-controls">
        <button class="clear" onclick={clearSelection}>Clear selection</button>
        <label class="filter">
          Drug
          <select value={commodity} onchange={(e) => setCommodity(e.currentTarget.value)}>
            <option value="all">All</option>
            {#each commodities as c}<option value={c}>{c}</option>{/each}
          </select>
        </label>
        <label class="filter">
          Sort
          <select bind:value={sortKey}>
            {#each SORT_OPTIONS as o}<option value={o.key}>{o.label}</option>{/each}
          </select>
        </label>
      </div>
    {/if}
    {#if visibleRoutes.length}
      <p class="count">
        {visibleRoutes.length}{visibleRoutes.length !== selectedRoutes.length ? ` of ${selectedRoutes.length}` : ''}
        route{selectedRoutes.length === 1 ? '' : 's'}
        <span class="hint">· click one to focus it</span>
      </p>
      <ul class="routes">
        {#each visibleRoutes as r}
          <li>
            <button class="route" class:active={focusRoute === r} onclick={() => selectRoute(r)}>
              <b>{r.commodity}</b> · {r.vehicle_type} ×{r.vehicle_count}<br />
              <span class="od">{r.origin} → {r.destination}</span><br />
              <span class="meta">{r.commodity_count.toLocaleString()} {r.commodity} · {formatKm(routeKm.get(r))}</span>
            </button>
          </li>
        {/each}
      </ul>
    {:else if selectedRoutes.length}
      <p>No {commodity} routes pass through this node.</p>
    {:else if selectedId}
      <p>No routes pass through this node.</p>
    {:else}
      <p>Click a node on the map to see the routes it participates in.</p>
    {/if}
  </Box>

  {#if focusRoute}
    <div class="full route-box">
      <Box>
        <RouteDetails
          network={data.results.network}
          routes={data.results.routes}
          centrality={data.results.centrality}
          connectivity={data.results.connectivity}
          route={focusRoute}
          {selectedId}
          onselectnode={selectNode}
          onclose={() => (focusRoute = null)}
        />
      </Box>
    </div>
  {/if}

  <div class="full">
    <Box>
      <NodeDetails
        network={data.results.network}
        routes={data.results.routes}
        centrality={data.results.centrality}
        connectivity={data.results.connectivity}
        {selectedId}
        nodeRoutes={selectedRoutes}
        onselectnode={selectNode}
      />
    </Box>
  </div>
</div>

<style>
  .display {
    display: grid;
    grid-template-columns: minmax(0, 3fr) minmax(260px, 1fr);
    gap: 1rem;
    padding: 1rem;
  }
  .full {
    grid-column: 1 / -1;
  }
  .route-box :global(.box) {
    border-left: 4px solid #ef4444;
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
  .legend .metric-name {
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
  .list-controls {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.6rem;
  }
  .filter {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.8rem;
    color: #666;
  }
  .filter select {
    padding: 0.25rem 0.4rem;
    border: 1px solid #ccc;
    border-radius: 6px;
    background: #fff;
    font-size: 0.8rem;
    text-transform: capitalize;
  }
  .clear {
    display: inline-block;
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
