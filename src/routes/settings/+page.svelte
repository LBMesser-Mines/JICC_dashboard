<script lang="ts">
  import Box from '$lib/box.svelte';
  import StatCard from '$lib/stat_card.svelte';
  import SolutionMap from '$lib/solution_map.svelte';
  import { ROLE_COLORS, SOLUTION_COLORS } from '$lib/network_graph';
  import type { PageProps } from './$types';
  import type { NodeId, Deployment } from '$lib/types';

  let { data }: PageProps = $props();

  const sol = $derived(data.solution.solution);
  const config = $derived(data.solution.config);

  let selectedId = $state<NodeId | null>(null);

  // Deployed sensors, highest total utility (coverage value) first.
  const sensors = $derived(
    [...data.report.deployments].sort((a, b) => b.coverage_value_G_n - a.coverage_value_G_n),
  );
  const selected = $derived(sensors.find((s) => s.node === selectedId) ?? null);

  /** Coordinate label — the meaningful identifier for road-waypoint sensors. */
  const coord = (lat: number, lon: number) => `${lat.toFixed(3)}, ${lon.toFixed(3)}`;

  // Share of routes that at least one deployed asset covers.
  const routeCoverage = $derived.by(() => {
    const counts = Object.values(data.solution.route_asset_counts);
    const touched = counts.filter((c) => c > 0).length;
    return { touched, total: counts.length };
  });

  const WEIGHT_METRICS = [
    { key: 'degree', label: 'Degree' },
    { key: 'closeness', label: 'Closeness' },
    { key: 'betweenness', label: 'Betweenness' },
    { key: 'katz', label: 'Katz' },
  ] as const;

  const pct = (v: number) => `${(v * 100).toFixed(0)}%`;
  const num = (v: number, d = 2) => v.toLocaleString(undefined, { maximumFractionDigits: d });

  function selectSensor(id: NodeId) {
    selectedId = selectedId === id ? null : id;
  }

  // Largest single-metric contribution, to scale the derivation bars.
  function maxContribution(s: Deployment) {
    return Math.max(...WEIGHT_METRICS.map((m) => s.derivation[m.key].contribution), 0.0001);
  }
</script>

<title>JICC Dashboard · Sensor Assignment</title>

<div class="display">
  <div class="full intro">
    <h2>Sensor Assignment</h2>
  </div>

  <!-- Headline solution metrics -->
  <div class="full stats">
    <StatCard label="Status" value={sol.status} />
    <StatCard label="Coverage utility" value={num(sol.coverage_utility)} />
    <StatCard label="Sensors deployed" value={`${sol.n_deployed} / ${num(config.budget, 0)}`} />
    <StatCard label="Nodes covered" value={`${num(sol.n_covered, 0)} / ${num(data.solution.model_summary.nodes, 0)}`} />
    <StatCard label="Routes touched" value={`${num(routeCoverage.touched, 0)} / ${num(routeCoverage.total, 0)}`} />
  </div>

  <!-- Map of the deployment -->
  <Box title="Deployment map">
    <SolutionMap
      covered={data.covered}
      uncovered={data.uncovered}
      sensors={data.sensors}
      radiusKm={config.radius_km}
      {selectedId}
      onselect={(id) => (selectedId = id)}
    />
    <div class="legend">
      <span class="chip"><i style="background:{SOLUTION_COLORS.deployed}"></i>Sensor</span>
      <span class="chip"><i style="background:{SOLUTION_COLORS.covered}"></i>Covered</span>
      <span class="chip"><i style="background:{SOLUTION_COLORS.uncovered}"></i>Rest of network</span>
      <span class="chip ring"><i></i>{num(config.radius_km, 0)} km radius</span>
    </div>
  </Box>

  <!-- Sensor list -->
  <Box title="Deployed sensors">
    <p class="hint">Sorted by total utility · click to focus on the map</p>
    <ul class="sensors">
      {#each sensors as s}
        <li>
          <button class="sensor" class:active={selectedId === s.node} onclick={() => selectSensor(s.node)}>
            <span class="dot" style="background:{ROLE_COLORS[s.role]}"></span>
            <span class="sensor-main">
              <b>{coord(s.lat, s.lon)}</b>
              <span class="sensor-meta">{s.role} · covers {s.covers_nodes} nodes · total utility {num(s.coverage_value_G_n)}</span>
            </span>
          </button>
        </li>
      {/each}
    </ul>
  </Box>

  <!-- Selected sensor detail -->
  <div class="full">
    <Box title={selected ? `Why the sensor at ${coord(selected.lat, selected.lon)}?` : 'Sensor detail'}>
      {#if selected}
        <div class="detail-head">
          <span class="dot" style="background:{ROLE_COLORS[selected.role]}"></span>
          <span class="detail-id">{selected.node}</span>
          <span class="tag">{selected.role}</span>
          <button class="clear" onclick={() => (selectedId = null)}>Clear</button>
        </div>

        <div class="detail-stats">
          <StatCard label="Utility uₙ" value={num(selected.utility_u_n, 4)} sub="blended centrality score" />
          <StatCard label="Nodes covered" value={num(selected.covers_nodes, 0)} sub={`within ${num(config.radius_km, 0)} km`} />
          <StatCard label="Total utility" value={num(selected.coverage_value_G_n)} sub="= sum of covered node utilities" />
          <StatCard label="Cost" value={num(selected.cost, 0)} sub="budget units" />
          <StatCard label="Location" value={`${selected.lat.toFixed(2)}, ${selected.lon.toFixed(2)}`} sub="lat, lon" />
        </div>

        <h4>Utility derivation</h4>
        <p class="hint">Utility = sum of (each centrality's weight × its percentile score).</p>
        <table class="derivation">
          <thead>
            <tr><th>Metric</th><th>Percentile aₖₙ</th><th>Weight wₖ</th><th>Contribution</th></tr>
          </thead>
          <tbody>
            {#each WEIGHT_METRICS as m}
              {@const d = selected.derivation[m.key]}
              <tr>
                <td>{m.label}</td>
                <td>{pct(d.a_kn)}</td>
                <td>{num(d.weight)}</td>
                <td>
                  <span class="bar-wrap">
                    <span class="bar" style="width:{(d.contribution / maxContribution(selected)) * 100}%"></span>
                    <span class="bar-val">{num(d.contribution, 4)}</span>
                  </span>
                </td>
              </tr>
            {/each}
            <tr class="total">
              <td>Total</td><td></td><td></td><td>{num(selected.utility_u_n, 4)}</td>
            </tr>
          </tbody>
        </table>
      {:else}
        <p>Select a sensor from the list or map to see why it was chosen and what it covers.</p>
      {/if}
    </Box>
  </div>

  <!-- Solver configuration (always shown) -->
  <div class="full">
    <Box title="Solver configuration">
      <div class="config-grid">
        {#each WEIGHT_METRICS as m}
          <StatCard label={`${m.label} weight`} value={num(config.weights[m.key])} />
        {/each}
        <StatCard label="Coverage radius" value={`${num(config.radius_km, 0)} km`} />
        <StatCard label="Budget" value={num(config.budget, 0)} sub="max assets" />
        <StatCard label="Asset cost" value={num(config.cost, 0)} sub="per sensor" />
      </div>
    </Box>
  </div>
</div>

<style>
  .display {
    display: grid;
    grid-template-columns: minmax(0, 3fr) minmax(280px, 1fr);
    gap: 1rem;
    padding: 1rem;
  }
  .full {
    grid-column: 1 / -1;
  }
  .intro h2 {
    margin: 0;
  }
  .stats,
  .detail-stats,
  .config-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 0.6rem;
  }
  .detail-stats,
  .config-grid {
    margin-bottom: 1rem;
  }
  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    margin-top: 0.75rem;
    font-size: 0.85rem;
  }
  .legend .chip {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
  }
  .legend .chip i {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    display: inline-block;
    border: 1px solid #fff;
    box-shadow: 0 0 0 1px #ccc;
  }
  .legend .ring i {
    background: transparent;
    border: 1px dashed #1d4ed8;
    box-shadow: none;
  }
  .hint {
    color: #888;
    font-size: 0.8rem;
    margin: 0 0 0.6rem;
  }
  .sensors {
    list-style: none;
    margin: 0;
    padding: 0;
    max-height: 560px;
    overflow-y: auto;
  }
  .sensors li {
    border-bottom: 1px solid #eee;
  }
  .sensor {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    text-align: left;
    background: none;
    border: none;
    border-left: 3px solid transparent;
    padding: 0.5rem;
    cursor: pointer;
    font-size: 0.85rem;
  }
  .sensor:hover {
    background: #f6f6f6;
  }
  .sensor.active {
    background: #eff6ff;
    border-left-color: #1d4ed8;
  }
  .sensor-main {
    display: flex;
    flex-direction: column;
    min-width: 0;
    flex: 1;
  }
  .sensor-meta {
    color: #666;
    font-size: 0.75rem;
    text-transform: capitalize;
  }
  .dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex: none;
    box-shadow: 0 0 0 1px #ccc;
  }
  .detail-head {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.8rem;
  }
  .detail-id {
    font-family: ui-monospace, monospace;
    font-size: 0.9rem;
  }
  .tag {
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #555;
    background: #f0f0f0;
    border-radius: 4px;
    padding: 0.1rem 0.4rem;
  }
  .clear {
    margin-left: auto;
    padding: 0.3rem 0.7rem;
    border: 1px solid #ccc;
    border-radius: 6px;
    background: #fff;
    font-size: 0.8rem;
    cursor: pointer;
  }
  .clear:hover {
    background: #f0f0f0;
  }
  h4 {
    margin: 0.5rem 0 0.3rem;
  }
  .derivation {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.85rem;
  }
  .derivation th,
  .derivation td {
    text-align: left;
    padding: 0.4rem 0.6rem;
    border-bottom: 1px solid #eee;
  }
  .derivation th {
    color: #666;
    font-weight: 600;
  }
  .derivation .total td {
    font-weight: 700;
    border-top: 2px solid #ddd;
    border-bottom: none;
  }
  .bar-wrap {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .bar {
    display: inline-block;
    height: 10px;
    min-width: 2px;
    background: #1d4ed8;
    border-radius: 2px;
  }
  .bar-val {
    font-variant-numeric: tabular-nums;
    color: #333;
  }
  @media (max-width: 820px) {
    .display {
      grid-template-columns: 1fr;
    }
  }
</style>
