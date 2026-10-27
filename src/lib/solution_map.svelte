<script lang="ts">
  import { onMount } from 'svelte';
  import * as maplibregl from 'maplibre-gl';
  import type { MapLayerMouseEvent } from 'maplibre-gl';
  import 'maplibre-gl/dist/maplibre-gl.css';
  // MapLibre locates its worker at runtime, which the production bundle misses;
  // import it explicitly so Vite bundles it (with its shared chunk) and emits a URL.
  import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
  maplibregl.setWorkerUrl(workerUrl);

  import { EMPTY_FC, SOLUTION_COLORS, buildCoverageGeoJSON } from '$lib/network_graph';
  import type { FeatureCollection } from 'geojson';

  interface Sensor {
    id: string;
    lat: number;
    lon: number;
  }
  interface Props {
    /** Nodes within a sensor's radius (green). [lat, lon]. */
    covered: [number, number][];
    /** The rest of the network, as a non-interactive grey backdrop. [lat, lon]. */
    uncovered: [number, number][];
    /** Deployed sensors — the only interactive, labeled nodes. */
    sensors: Sensor[];
    /** Coverage radius in km. */
    radiusKm: number;
    /** Selected sensor id (ringed + centered). */
    selectedId?: string | null;
    onselect?: (id: string | null) => void;
  }
  let { covered, uncovered, sensors, radiusKm, selectedId = null, onselect }: Props = $props();

  let container: HTMLDivElement;
  let map: maplibregl.Map | undefined;
  let mapReady = $state(false);

  /** A short coordinate label — the only meaningful id for road-waypoint sensors. */
  const label = (lat: number, lon: number) => `${lat.toFixed(3)}, ${lon.toFixed(3)}`;

  const pointsFC = (pts: [number, number][]): FeatureCollection => ({
    type: 'FeatureCollection',
    features: pts.map(([lat, lon]) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [lon, lat] },
      properties: {},
    })),
  });

  const sensorsFC = (): FeatureCollection => ({
    type: 'FeatureCollection',
    features: sensors.map((s) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [s.lon, s.lat] },
      properties: { id: s.id, label: label(s.lat, s.lon) },
    })),
  });

  const sensorCenters = $derived(sensors.map((s) => ({ lat: s.lat, lon: s.lon })));
  const posById = $derived(new Map(sensors.map((s) => [s.id, [s.lat, s.lon] as [number, number]])));

  function onSensorClick(e: MapLayerMouseEvent) {
    const id = e.features?.[0]?.properties?.id as string | undefined;
    if (id) onselect?.(id);
  }

  onMount(() => {
    map = new maplibregl.Map({
      container,
      style: 'https://tiles.openfreemap.org/styles/liberty',
      center: [-110, 28],
      zoom: 4,
    });

    map.on('load', () => {
      const m = map!;

      m.addSource('coverage', { type: 'geojson', data: buildCoverageGeoJSON(sensorCenters, radiusKm) });
      m.addSource('uncovered', { type: 'geojson', data: pointsFC(uncovered) });
      m.addSource('covered', { type: 'geojson', data: pointsFC(covered) });
      m.addSource('sensors', { type: 'geojson', data: sensorsFC() });
      m.addSource('selected', { type: 'geojson', data: EMPTY_FC });

      // Coverage radius discs (bottom of the stack).
      m.addLayer({
        id: 'coverage-fill',
        type: 'fill',
        source: 'coverage',
        paint: { 'fill-color': SOLUTION_COLORS.deployed, 'fill-opacity': 0.08 },
      });
      m.addLayer({
        id: 'coverage-outline',
        type: 'line',
        source: 'coverage',
        paint: { 'line-color': SOLUTION_COLORS.deployed, 'line-width': 1, 'line-opacity': 0.4, 'line-dasharray': [2, 2] },
      });

      // Whole-network backdrop — non-interactive.
      const dotRadius = ['interpolate', ['linear'], ['zoom'], 3, 1.2, 12, 4] as unknown as number;
      m.addLayer({
        id: 'uncovered-layer',
        type: 'circle',
        source: 'uncovered',
        paint: { 'circle-radius': dotRadius, 'circle-color': SOLUTION_COLORS.uncovered, 'circle-opacity': 0.85 },
      });
      m.addLayer({
        id: 'covered-layer',
        type: 'circle',
        source: 'covered',
        paint: { 'circle-radius': dotRadius, 'circle-color': SOLUTION_COLORS.covered, 'circle-opacity': 0.95 },
      });

      // Sensors — interactive, drawn large, labeled by coordinates.
      m.addLayer({
        id: 'sensors-layer',
        type: 'circle',
        source: 'sensors',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, 6, 12, 12],
          'circle-color': SOLUTION_COLORS.deployed,
        },
      });
      m.addLayer({
        id: 'sensor-labels',
        type: 'symbol',
        source: 'sensors',
        layout: {
          'text-field': ['get', 'label'],
          'text-size': 11,
          'text-offset': [0, 1.2],
          'text-anchor': 'top',
          'text-allow-overlap': false,
        },
        paint: { 'text-color': '#1e3a8a', 'text-halo-color': '#fff', 'text-halo-width': 1.5 },
      });

      const ring = ['interpolate', ['linear'], ['zoom'], 3, 9, 12, 17] as unknown as number;
      m.addLayer({
        id: 'selected-halo',
        type: 'circle',
        source: 'selected',
        paint: { 'circle-radius': ring, 'circle-opacity': 0, 'circle-stroke-width': 6, 'circle-stroke-color': '#fff', 'circle-stroke-opacity': 0.9 },
      });
      m.addLayer({
        id: 'selected-ring',
        type: 'circle',
        source: 'selected',
        paint: { 'circle-radius': ring, 'circle-opacity': 0, 'circle-stroke-width': 3, 'circle-stroke-color': '#111827' },
      });

      // Only sensors are interactive.
      m.on('click', 'sensors-layer', onSensorClick);
      m.on('mouseenter', 'sensors-layer', () => (m.getCanvas().style.cursor = 'pointer'));
      m.on('mouseleave', 'sensors-layer', () => (m.getCanvas().style.cursor = ''));
      m.on('click', (e) => {
        if (m.queryRenderedFeatures(e.point, { layers: ['sensors-layer'] }).length) return;
        onselect?.(null);
      });

      mapReady = true;
    });

    return () => {
      map?.remove();
      map = undefined;
    };
  });

  // Ring + center the selected sensor.
  $effect(() => {
    const p = selectedId ? posById.get(selectedId) : undefined;
    if (!mapReady || !map) return;
    (map.getSource('selected') as maplibregl.GeoJSONSource | undefined)?.setData(
      p
        ? { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [p[1], p[0]] }, properties: {} }] }
        : EMPTY_FC,
    );
    if (p) map.easeTo({ center: [p[1], p[0]], zoom: Math.max(map.getZoom(), 7), duration: 600 });
  });
</script>

<div bind:this={container} style="height: 600px; width: 100%;"></div>
