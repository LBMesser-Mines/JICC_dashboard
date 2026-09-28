<script lang="ts">
  import type { Network, Route, Centrality, Connectivity, NodeId, NodeRole } from '$lib/types';
  import StatCard from '$lib/stat_card.svelte';
  import PercentileBar from '$lib/percentile_bar.svelte';
  import Term from '$lib/term.svelte';
  import {
    METRIC_KEYS,
    METRIC_INFO,
    ROLE_COLORS,
    ROLE_DESCRIPTIONS,
    type MetricKey,
    type MetricStanding,
    deriveRole,
    deriveZone,
    buildAdjacency,
    computeConnectivityScores,
    metricValue,
    standingOf,
    ordinal,
    percentileTier,
    formatMetric,
    formatKm,
    formatNodeName,
  } from '$lib/network_graph';

  interface Props {
    network: Network;
    routes: Route[];
    centrality?: Centrality;
    connectivity?: Connectivity;
    /** Selected node (null = nothing selected). */
    selectedId: NodeId | null;
    /** Routes through the selected node. */
    nodeRoutes: Route[];
    /** Jump to a neighboring node. */
    onselectnode?: (id: NodeId) => void;
  }
  let { network, routes, centrality, connectivity, selectedId, nodeRoutes, onselectnode }: Props = $props();

  // ---- Network-wide baselines (computed once per dataset) ----
  const adj = $derived(buildAdjacency(network));
  const connScores = $derived(computeConnectivityScores(connectivity));

  /** Per metric: every node's value, plus the values split by role. */
  const metricValues = $derived.by(() => {
    const all = {} as Record<MetricKey, number[]>;
    const byRole = {} as Record<MetricKey, Record<NodeRole, number[]>>;
    for (const m of METRIC_KEYS) {
      all[m] = [];
      byRole[m] = { supply: [], demand: [], transshipment: [] };
      for (const n of network.nodes) {
        const v = metricValue(m, n.id, centrality, connScores);
        if (v == null) continue;
        all[m].push(v);
        byRole[m][deriveRole(n.id)].push(v);
      }
    }
    return { all, byRole };
  });

  /** Routes touching each node, for the "routes involved" baseline. */
  const routeCounts = $derived.by(() => {
    const counts = new Map<NodeId, number>();
    for (const r of routes) {
      for (const id of new Set(r.path)) counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    return network.nodes.map((n) => counts.get(n.id) ?? 0);
  });
  const neighborCounts = $derived(network.nodes.map((n) => adj.get(n.id)?.length ?? 0));

  const node = $derived.by(() => {
    if (!selectedId) return null;
    const id = selectedId;
    const role = deriveRole(id);
    const neighbors = adj.get(id) ?? [];

    const scores = METRIC_KEYS.flatMap((m) => {
      const v = metricValue(m, id, centrality, connScores);
      if (v == null) return [];
      return [
        {
          key: m,
          network: standingOf(v, metricValues.all[m]),
          role: standingOf(v, metricValues.byRole[m][role]),
        },
      ];
    });

    let asOrigin = 0;
    let asDestination = 0;
    let passThrough = 0;
    const commodities = new Map<string, number>();
    for (const r of nodeRoutes) {
      if (r.origin === id) asOrigin++;
      else if (r.destination === id) asDestination++;
      else passThrough++;
      commodities.set(r.commodity, (commodities.get(r.commodity) ?? 0) + 1);
    }

    return {
      id,
      role,
      zone: deriveZone(id),
      neighbors: standingOf(neighbors.length, neighborCounts),
      topNeighbors: neighbors
        .slice()
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 6),
      neighborTotal: neighbors.length,
      routes: standingOf(nodeRoutes.length, routeCounts),
      asOrigin,
      asDestination,
      passThrough,
      commodities: [...commodities].sort((a, b) => b[1] - a[1]),
      scores,
    };
  });

  function vsMedian(s: MetricStanding): string {
    if (s.median === 0) return s.value === 0 ? 'at median' : 'above median (0)';
    const ratio = s.value / s.median;
    if (Math.abs(ratio - 1) < 0.05) return 'at median';
    return ratio >= 1 ? `${ratio.toFixed(1)}× median` : `${Math.round(ratio * 100)}% of median`;
  }
  /** Dominant way routes use the node. */
  function routeRoleLabel(start: number, through: number, end: number): string {
    const total = start + through + end;
    if (!total) return 'Unused';
    if (through / total >= 0.6) return 'Corridor';
    if (start / total >= 0.6) return 'Origin';
    if (end / total >= 0.6) return 'Endpoint';
    return 'Mixed';
  }
</script>

<div class="details">
  {#if node}
    <div class="eyebrow">Node breakdown</div>
    <h3>{formatNodeName(node.id)}</h3>
    <div class="tags">
      <span class="role-chip" style="--c:{ROLE_COLORS[node.role]}"><Term id={node.role} /></span>
      <span class="tag">{node.zone === 'MX' ? 'Mexico' : 'United States'}</span>
      <code>{node.id}</code>
    </div>
    <p class="role-desc">{ROLE_DESCRIPTIONS[node.role]}</p>

    <div class="stats">
      <StatCard label="Direct connections" value={String(node.neighborTotal)} standing={node.neighbors} />
      <StatCard label="Routes involved" value={String(nodeRoutes.length)} standing={node.routes} />
      <StatCard
        label="Route role"
        value={routeRoleLabel(node.asOrigin, node.passThrough, node.asDestination)}
        sub={`${node.asOrigin} start · ${node.passThrough} pass through · ${node.asDestination} end`}
      />
      <StatCard label="Commodities">
        {#if node.commodities.length}
          <div class="commodities">
            {#each node.commodities as [c, n]}<span class="tag">{c} <b>{n}</b></span>{/each}
          </div>
        {:else}
          <div class="muted">none</div>
        {/if}
      </StatCard>
    </div>

    <h4><Term id="centrality">Centrality</Term> scores <span class="hint">· bar = percentile across all {network.nodes.length} nodes, tick = median</span></h4>
    <div class="table-wrap">
      <table class="scores">
        <thead>
          <tr>
            <th>Metric</th>
            <th class="num">Value</th>
            <th>vs. network</th>
            <th class="num">Rank</th>
            <th>vs. other <Term id={node.role}>{node.role}</Term> nodes</th>
          </tr>
        </thead>
        <tbody>
          {#each node.scores as s}
            {@const t = percentileTier(s.network.percentile)}
            <tr>
              <td>
                <div class="metric-name"><Term id={s.key} /></div>
                <div class="metric-desc">{METRIC_INFO[s.key].description}</div>
              </td>
              <td class="num mono">{formatMetric(s.network.value)}</td>
              <td class="bar-cell">
                <PercentileBar percentile={s.network.percentile} />
                <span class="verdict {t.cls}">{t.label}</span>
                <span class="muted">{ordinal(s.network.percentile)} pct · {vsMedian(s.network)}</span>
              </td>
              <td class="num mono">
                {s.network.ties ? 'tied ' : ''}#{s.network.rank}<span class="muted"> / {s.network.count}</span>
              </td>
              <td>
                {ordinal(s.role.percentile)} pct
                <span class="muted">· {s.role.ties ? 'tied ' : ''}#{s.role.rank} of {s.role.count} · {vsMedian(s.role)}</span>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
    {#if !node.scores.some((s) => s.key === 'connectivity')}
      <p class="muted small">Path redundancy is only measured for ports of entry and demand cities.</p>
    {/if}

    {#if node.topNeighbors.length}
      <h4>Nearest neighbors <span class="hint">· {node.topNeighbors.length} of {node.neighborTotal} · click to jump</span></h4>
      <div class="neighbors">
        {#each node.topNeighbors as n}
          <button class="neighbor" onclick={() => onselectnode?.(n.id)}>
            <i style="background:{ROLE_COLORS[deriveRole(n.id)]}"></i>{formatNodeName(n.id)}
            <span class="muted">{formatKm(n.distance)}</span>
          </button>
        {/each}
      </div>
    {/if}
  {:else}
    <div class="eyebrow">Details</div>
    <p class="empty">
      Click a node on the map to see its role, scores, and how it compares to the rest of the network. Pick a route
      from the sidebar to break it down hop by hop.
    </p>
  {/if}
</div>

<style>
  .details {
    font-size: 0.9rem;
  }
  .eyebrow {
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #888;
    font-weight: 600;
  }
  h3 {
    margin: 0.15rem 0 0.4rem;
    font-size: 1.25rem;
  }
  h4 {
    margin: 1.25rem 0 0.5rem;
    font-size: 0.95rem;
  }
  .hint,
  .muted {
    color: #888;
    font-weight: 400;
    font-size: 0.8rem;
  }
  .small {
    margin: 0.4rem 0 0;
  }
  .tags {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.4rem;
  }
  .tag {
    padding: 0.1rem 0.5rem;
    border-radius: 999px;
    background: #f1f1f1;
    font-size: 0.78rem;
    text-transform: capitalize;
  }
  code {
    font-size: 0.75rem;
    color: #777;
  }
  .role-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    font-size: 0.78rem;
    text-transform: capitalize;
  }
  .role-chip::before {
    content: '';
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--c);
    box-shadow: 0 0 0 1px #ccc;
  }
  .role-desc {
    margin: 0.5rem 0 0;
    color: #444;
  }
  .stats {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
    gap: 0.75rem;
    margin-top: 1rem;
  }
  .commodities {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
    margin-top: 0.3rem;
  }
  .verdict {
    display: inline-block;
    margin: 0.3rem 0.35rem 0 0;
    padding: 0 0.4rem;
    border-radius: 3px;
    font-size: 0.72rem;
    font-weight: 600;
    color: #333;
  }
  .verdict.hi2 { background: #bd0026; color: #fff; }
  .verdict.hi { background: #f03b20; color: #fff; }
  .verdict.mid { background: #fd8d3c; }
  .verdict.lo { background: #fecc5c; }
  .verdict.lo2 { background: #d9d9a0; }

  /* scores table */
  .table-wrap {
    overflow-x: auto;
  }
  .scores {
    width: 100%;
    border-collapse: collapse;
  }
  .scores th {
    text-align: left;
    font-size: 0.75rem;
    color: #666;
    font-weight: 600;
    border-bottom: 1px solid #ddd;
    padding: 0.35rem 0.5rem;
    white-space: nowrap;
  }
  .scores td {
    padding: 0.5rem;
    border-bottom: 1px solid #f0f0f0;
    vertical-align: top;
  }
  .scores .num {
    text-align: right;
    white-space: nowrap;
  }
  .mono {
    font-variant-numeric: tabular-nums;
  }
  .bar-cell {
    min-width: 200px;
  }
  .metric-name {
    font-weight: 600;
  }
  .metric-desc {
    font-size: 0.75rem;
    color: #888;
    max-width: 300px;
  }

  /* neighbors */
  .neighbors {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }
  .neighbor {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.2rem 0.55rem;
    border: 1px solid #e5e5e5;
    border-radius: 999px;
    background: #fff;
    font: inherit;
    cursor: pointer;
  }
  .neighbor:hover {
    background: #f3f4f6;
    border-color: #ccc;
  }
  .neighbor i {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    display: inline-block;
  }
  .empty {
    color: #666;
    margin: 0.3rem 0 0;
  }
</style>
