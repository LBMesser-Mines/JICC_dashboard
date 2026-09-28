<script lang="ts">
  import type { Network, Route, Centrality, Connectivity, NodeId } from '$lib/types';
  import StatCard from '$lib/stat_card.svelte';
  import {
    ROLE_COLORS,
    ROUTE_NODE_COLORS,
    deriveRole,
    buildAdjacency,
    pathLegDistances,
    pathLength,
    standingOf,
    ordinal,
    formatKm,
    formatNodeName,
  } from '$lib/network_graph';

  interface Props {
    network: Network;
    /** All routes — the baseline this route is compared against. */
    routes: Route[];
    centrality?: Centrality;
    connectivity?: Connectivity;
    route: Route;
    /** Currently selected node, highlighted in the path. */
    selectedId: NodeId | null;
    /** Jump to a node on the path. */
    onselectnode?: (id: NodeId) => void;
    onclose?: () => void;
  }
  let { network, routes, centrality, connectivity, route, selectedId, onselectnode, onclose }: Props = $props();

  // ---- Baselines across every route (computed once per dataset) ----
  const adj = $derived(buildAdjacency(network));
  const routeDistances = $derived(routes.map((r) => pathLength(r.path, adj)));
  const routeHops = $derived(routes.map((r) => r.distance));
  const routeIntervals = $derived(routes.map((r) => r.departure_interval));
  const betweennessValues = $derived(Object.values(centrality?.betweenness_subset ?? {}));

  const info = $derived.by(() => {
    const r = route;
    const legs = pathLegDistances(r.path, adj);
    const total = legs.reduce<number>((s, d) => s + (d ?? 0), 0);

    // Redundancy between the POE this route crosses and its destination.
    const poeIndex = r.path.findIndex((id) => deriveRole(id) === 'transshipment');
    const poe = poeIndex >= 0 ? r.path[poeIndex] : null;
    const pair = poe ? connectivity?.poe_to_demand.results[poe]?.[r.destination] : undefined;
    const band = (connectivity?.poe_to_demand.percents[0] ?? 10).toFixed(1);
    const poeLeg =
      poeIndex >= 0 ? legs.slice(poeIndex).reduce<number>((s, d) => s + (d ?? 0), 0) : null;

    return {
      legs,
      total,
      hops: standingOf(r.distance, routeHops),
      distance: standingOf(total, routeDistances),
      interval: standingOf(r.departure_interval, routeIntervals),
      poe,
      pair,
      band,
      poeLeg,
      steps: r.path.map((id, i) => ({
        id,
        role: deriveRole(id),
        pos: (i === 0 ? 'source' : i === r.path.length - 1 ? 'demand' : 'via') as keyof typeof ROUTE_NODE_COLORS,
        betweenness: centrality
          ? standingOf(centrality.betweenness_subset[id] ?? 0, betweennessValues).percentile
          : null,
      })),
    };
  });
</script>

<div class="details">
  <header>
    <div>
      <div class="eyebrow">Route breakdown</div>
      <h3>
        {formatNodeName(route.origin)}
        <span class="arrow">→</span>
        {formatNodeName(route.destination)}
      </h3>
      <div class="tags">
        <span class="tag strong">{route.commodity}</span>
        <span class="tag">{route.vehicle_type.replace(/_/g, ' ')} ×{route.vehicle_count}</span>
        {#if route.error}<span class="tag error">{route.error}</span>{/if}
      </div>
    </div>
    <button class="close" onclick={() => onclose?.()} aria-label="Close route breakdown">✕ Close</button>
  </header>

  <div class="stats">
    <StatCard label="Hops" value={String(route.distance)} standing={info.hops} />
    <StatCard
      label="Total distance"
      value={formatKm(info.total)}
      standing={info.distance}
      formatMedian={formatKm}
      sub="sum of edge distances"
    />
    <StatCard
      label="Departs every"
      value={`${route.departure_interval}h`}
      standing={info.interval}
      formatMedian={(v) => `${v}h`}
    />
    <StatCard
      label="Cargo"
      value={`${route.commodity_count.toLocaleString()} ${route.commodity}`}
      sub={`${route.vehicle_count} vehicle${route.vehicle_count === 1 ? '' : 's'}`}
    />
    {#if info.poe}
      <StatCard
        label="Alternatives from POE"
        value={info.pair ? String(info.pair.routes_within_range[info.band] ?? 0) : '—'}
        sub={info.pair
          ? `paths within ${parseFloat(info.band)}% of shortest ${formatNodeName(info.poe)} → destination${info.pair.capped ? ' (capped)' : ''}`
          : 'no connectivity data for this pair'}
      />
    {/if}
    {#if info.pair && info.poeLeg != null}
      {@const extra = (info.poeLeg / info.pair.shortest_distance - 1) * 100}
      <StatCard
        label="POE → destination"
        value={formatKm(info.poeLeg)}
        sub={Math.abs(extra) < 0.5
          ? 'matches the shortest path'
          : `${extra.toFixed(0)}% longer than shortest (${formatKm(info.pair.shortest_distance)})`}
      />
    {/if}
  </div>

  <h4>Path <span class="hint">· click a stop to jump to it</span></h4>
  <ol class="path">
    {#each info.steps as step, i}
      <li>
        <button class="step" class:current={step.id === selectedId} onclick={() => onselectnode?.(step.id)}>
          <span class="dot" style="background:{ROUTE_NODE_COLORS[step.pos]}"></span>
          <span class="step-body">
            <span class="step-name">
              {formatNodeName(step.id)}
              {#if step.id === selectedId}<span class="you">selected</span>{/if}
            </span>
            <span class="step-meta">
              <span class="role-chip" style="--c:{ROLE_COLORS[step.role]}">{step.role}</span>
              {#if step.betweenness != null}
                <span title="Betweenness percentile across the network">betweenness {ordinal(step.betweenness)} pct</span>
              {/if}
            </span>
          </span>
        </button>
        {#if i < info.legs.length}
          <span class="leg">↓ {formatKm(info.legs[i])}</span>
        {/if}
      </li>
    {/each}
  </ol>
</div>

<style>
  .details {
    font-size: 0.9rem;
  }
  header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1rem;
    flex-wrap: wrap;
  }
  .eyebrow {
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #b91c1c;
    font-weight: 600;
  }
  h3 {
    margin: 0.15rem 0 0.4rem;
    font-size: 1.25rem;
  }
  h3 .arrow {
    color: #999;
    margin: 0 0.3rem;
  }
  h4 {
    margin: 1.25rem 0 0.5rem;
    font-size: 0.95rem;
  }
  .hint {
    color: #888;
    font-weight: 400;
    font-size: 0.8rem;
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
  .tag.strong {
    background: #333;
    color: #fff;
  }
  .tag.error {
    background: #fee2e2;
    color: #b91c1c;
  }
  .close {
    padding: 0.3rem 0.7rem;
    border: 1px solid #ccc;
    border-radius: 6px;
    background: #fff;
    font-size: 0.8rem;
    cursor: pointer;
  }
  .close:hover {
    background: #f0f0f0;
  }
  .stats {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
    gap: 0.75rem;
    margin-top: 1rem;
  }
  .role-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
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

  /* path stepper */
  .path {
    list-style: none;
    margin: 0;
    padding: 0;
    columns: 250px;
    column-gap: 1.5rem;
  }
  .path li {
    break-inside: avoid;
    display: flex;
    flex-direction: column;
  }
  .step {
    display: grid;
    grid-template-columns: 14px 1fr;
    column-gap: 0.6rem;
    width: 100%;
    padding: 0.3rem 0.4rem;
    border: none;
    border-radius: 6px;
    background: none;
    font: inherit;
    text-align: left;
    cursor: pointer;
  }
  .step:hover {
    background: #f3f4f6;
  }
  .step.current {
    background: #fef9c3;
  }
  .dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    margin-top: 0.2rem;
    border: 2px solid #fff;
    box-shadow: 0 0 0 1px #bbb;
  }
  .step-body {
    display: flex;
    flex-direction: column;
  }
  .step-name {
    font-weight: 600;
  }
  .step:hover .step-name {
    text-decoration: underline;
  }
  .step-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    font-size: 0.78rem;
    color: #777;
  }
  .you {
    margin-left: 0.4rem;
    font-size: 0.7rem;
    font-weight: 600;
    color: #a16207;
    text-transform: uppercase;
  }
  .leg {
    padding-left: calc(0.4rem + 14px + 0.6rem);
    font-size: 0.75rem;
    color: #999;
    margin: 0.1rem 0;
  }
</style>
