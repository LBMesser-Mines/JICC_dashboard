<script lang="ts">
  import { onMount } from 'svelte';
  import * as maplibregl from 'maplibre-gl';
  import type { MapLayerMouseEvent, CircleLayerSpecification, ExpressionSpecification } from 'maplibre-gl';
  import 'maplibre-gl/dist/maplibre-gl.css';

  import type { Network, Route, Centrality, Connectivity, NodeId } from '$lib/types';
  import {
    ROLE_COLORS,
    METRIC_RAMP,
    ROUTE_NODE_COLORS,
    EMPTY_FC,
    type ColorMode,
    type Zone,
    buildPosLookup,
    buildNodeGeoJSON,
    buildEdgeGeoJSON,
    routesForNode,
    buildRouteHighlightGeoJSON,
    buildRouteNodesGeoJSON,
    computeConnectivityScores,
    computeMetricDomains,
  } from '$lib/network_graph';

  interface Props {
    network: Network;
    routes: Route[];
    centrality?: Centrality;
    connectivity?: Connectivity;
    /** How nodes are colored/sized: 'role' or a numeric metric. */
    metric?: ColorMode;
    /** Visible geographic zones. Nodes/edges outside the set are hidden. */
    zones?: Zone[];
    /** Routes of the selected node, drawn as faint highlight lines. */
    highlightRoutes?: Route[];
    /** A single route to further highlight (drawn bold on top). */
    focusRoute?: Route | null;
    onselect?: (info: { id: NodeId | null; routes: Route[] }) => void;
  }
  let {
    network,
    routes,
    centrality,
    connectivity,
    metric = 'role',
    zones = ['US', 'MX'],
    highlightRoutes = [],
    focusRoute = null,
    onselect,
  }: Props = $props();

  let container: HTMLDivElement;
  let map: maplibregl.Map | undefined;
  let mapReady = $state(false);

  // Derived data — network/centrality/connectivity are effectively static, but $derived
  // keeps these correct if props change and silences state_referenced_locally warnings.
  const posLookup = $derived(buildPosLookup(network));
  const connScores = $derived(computeConnectivityScores(connectivity));
  const domains = $derived(computeMetricDomains(network, centrality, connScores));

  /** Node paint. Radius is constant (zoom-scaled) in all modes; only color changes. */
  function nodePaint(mode: ColorMode): NonNullable<CircleLayerSpecification['paint']> {
    // Fixed, readable node size regardless of the selected metric.
    const radius: ExpressionSpecification = ['interpolate', ['linear'], ['zoom'], 3, 3, 12, 8];
    const stroke = { 'circle-stroke-width': 0.75, 'circle-stroke-color': '#fff' } as const;

    if (mode === 'role') {
      return {
        'circle-radius': radius,
        'circle-color': [
          'match', ['get', 'role'],
          'supply', ROLE_COLORS.supply,
          'demand', ROLE_COLORS.demand,
          'transshipment', ROLE_COLORS.transshipment,
          '#888',
        ],
        ...stroke,
      };
    }

    const [min, max] = domains[mode];
    // Degenerate domain (all equal): fall back to a flat mid-ramp color.
    if (!(max > min)) {
      return { 'circle-radius': radius, 'circle-color': METRIC_RAMP[2], ...stroke };
    }

    const span = max - min;
    const colorRamp: ExpressionSpecification = [
      'interpolate', ['linear'], ['get', mode],
      min, METRIC_RAMP[0],
      min + span * 0.25, METRIC_RAMP[1],
      min + span * 0.5, METRIC_RAMP[2],
      min + span * 0.75, METRIC_RAMP[3],
      max, METRIC_RAMP[4],
    ];
    return { 'circle-radius': radius, 'circle-color': colorRamp, ...stroke };
  }

  function onNodeClick(e: MapLayerMouseEvent) {
    const id = e.features?.[0]?.properties?.id as NodeId | undefined;
    if (!id) return;
    onselect?.({ id, routes: routesForNode(routes, id) });
  }

  onMount(() => {
    map = new maplibregl.Map({
      container,
      style: 'https://tiles.openfreemap.org/styles/liberty',
      center: [-98, 39], // US/Mexico border span
      zoom: 3.5,
    });

    map.on('load', () => {
      const m = map!;

      // Sources
      m.addSource('edges', { type: 'geojson', data: buildEdgeGeoJSON(network, posLookup) });
      m.addSource('highlight', { type: 'geojson', data: EMPTY_FC });
      m.addSource('focus', { type: 'geojson', data: EMPTY_FC });
      m.addSource('nodes', { type: 'geojson', data: buildNodeGeoJSON(network, centrality, connScores) });
      m.addSource('route-nodes', { type: 'geojson', data: EMPTY_FC });

      // Layer insert order (bottom -> top): edges -> highlight -> focus -> nodes -> route-nodes.
      m.addLayer({
        id: 'edges-layer',
        type: 'line',
        source: 'edges',
        paint: { 'line-color': '#9aa0a6', 'line-width': 0.5, 'line-opacity': 0.25 },
      });

      m.addLayer({
        id: 'highlight-layer',
        type: 'line',
        source: 'highlight',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#1d4ed8', 'line-width': 2, 'line-opacity': 0.55 },
      });

      m.addLayer({
        id: 'focus-layer',
        type: 'line',
        source: 'focus',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#ef4444', 'line-width': 4, 'line-opacity': 0.95 },
      });

      m.addLayer({
        id: 'nodes-layer',
        type: 'circle',
        source: 'nodes',
        paint: nodePaint(metric),
      });

      // Recolored nodes along a focused route: source=green, via=blue, demand=red.
      m.addLayer({
        id: 'route-nodes-layer',
        type: 'circle',
        source: 'route-nodes',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, 5, 12, 10],
          'circle-color': [
            'match', ['get', 'routePos'],
            'source', ROUTE_NODE_COLORS.source,
            'via', ROUTE_NODE_COLORS.via,
            'demand', ROUTE_NODE_COLORS.demand,
            '#888',
          ],
          'circle-stroke-width': 1.5,
          'circle-stroke-color': '#fff',
        },
      });

      m.on('click', 'nodes-layer', onNodeClick);
      m.on('mouseenter', 'nodes-layer', () => (m.getCanvas().style.cursor = 'pointer'));
      m.on('mouseleave', 'nodes-layer', () => (m.getCanvas().style.cursor = ''));

      // Click on empty map clears the selection.
      m.on('click', (e) => {
        if (m.queryRenderedFeatures(e.point, { layers: ['nodes-layer'] }).length) return;
        onselect?.({ id: null, routes: [] });
      });

      mapReady = true;
    });

    return () => {
      map?.remove();
      map = undefined;
    };
  });

  // Repaint nodes when the metric changes.
  $effect(() => {
    const paint = nodePaint(metric);
    if (!mapReady || !map) return;
    map.setPaintProperty('nodes-layer', 'circle-radius', paint['circle-radius']!);
    map.setPaintProperty('nodes-layer', 'circle-color', paint['circle-color']!);
  });

  // Matches features whose `prop` equals one of the active zones. Uses plain
  // equality (not `in`/`literal`) so a Svelte $state proxy can't break it.
  function zoneExpr(prop: string, active: Zone[]): unknown[] {
    if (active.length === 0) return ['==', ['literal', 0], ['literal', 1]]; // matches nothing
    return ['any', ...active.map((z) => ['==', ['get', prop], z])];
  }

  // Zone subdivision: show only nodes in the active zones, and edges whose
  // endpoints are both in active zones.
  $effect(() => {
    const active = [...zones]; // snapshot proxy -> plain array
    if (!mapReady || !map) return;
    map.setFilter('nodes-layer', zoneExpr('zone', active) as unknown as maplibregl.FilterSpecification);
    map.setFilter(
      'edges-layer',
      ['all', zoneExpr('originZone', active), zoneExpr('destZone', active)] as unknown as maplibregl.FilterSpecification,
    );
  });

  // Highlight all routes of the selected node (reactive to the prop, so the page
  // can clear the selection and the map updates).
  $effect(() => {
    const hr = highlightRoutes;
    const lookup = posLookup;
    if (!mapReady || !map) return;
    (map.getSource('highlight') as maplibregl.GeoJSONSource).setData(
      hr.length ? buildRouteHighlightGeoJSON(hr, lookup) : EMPTY_FC,
    );
  });

  // Focus a single route: draw it bold and fit the map to it.
  $effect(() => {
    const fr = focusRoute;
    const lookup = posLookup;
    if (!mapReady || !map) return;
    const src = map.getSource('focus') as maplibregl.GeoJSONSource | undefined;
    const nodeSrc = map.getSource('route-nodes') as maplibregl.GeoJSONSource | undefined;
    if (!src || !nodeSrc) return;

    // Hide the rest of the network while a single route is focused, for readability.
    const baseLayers = ['edges-layer', 'highlight-layer', 'nodes-layer'];
    const setBaseVisibility = (v: 'visible' | 'none') =>
      baseLayers.forEach((l) => map!.setLayoutProperty(l, 'visibility', v));

    if (!fr) {
      src.setData(EMPTY_FC);
      nodeSrc.setData(EMPTY_FC);
      setBaseVisibility('visible');
      return;
    }
    src.setData(buildRouteHighlightGeoJSON([fr], lookup));
    nodeSrc.setData(buildRouteNodesGeoJSON(fr, lookup));
    setBaseVisibility('none');

    const coords = fr.path.map((id) => lookup.get(id)).filter((p): p is [number, number] => !!p);
    if (coords.length) {
      const b = new maplibregl.LngLatBounds();
      for (const [lat, lon] of coords) b.extend([lon, lat]);
      map.fitBounds(b, { padding: 60, maxZoom: 9, duration: 600 });
    }
  });
</script>

<div bind:this={container} style="height: 600px; width: 100%;"></div>
