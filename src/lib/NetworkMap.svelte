<script lang="ts" module>
  export interface Point {
    lat: number;
    lon: number;
    name: string;
    type: 'supply' | 'demand' | 'transshipment';
  }
</script>

<script lang="ts">
  import { onMount } from 'svelte';
  import * as maplibregl from 'maplibre-gl';
  import type { MapLayerMouseEvent } from 'maplibre-gl';
  import type { FeatureCollection } from 'geojson'
  import 'maplibre-gl/dist/maplibre-gl.css';

  interface Props {
    points: Point[];
  }
  let { points }: Props = $props();
  let container: HTMLDivElement;

  function toGeoJson(rows: Point[]): FeatureCollection {
    return {
      type: 'FeatureCollection',
      features: rows
        .filter(r => Number.isFinite(r.lat) && Number.isFinite(r.lon))
        .map(({ lat, lon, ...props }) => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [lon, lat] },
          properties: props
        }))
    };
  }

  onMount(() => {
    const map = new maplibregl.Map({
      container,
      style: 'https://tiles.openfreemap.org/styles/liberty',
      center: points.length ? [points[0].lon, points[0].lat] : [-105.2, 39.75],
      zoom: 5
    });

    map.on('load', () => {
      map.addSource('pts', { type: 'geojson', data: toGeoJson(points) });

      map.addLayer({
        id: 'pts-layer',
        type: 'circle',
        source: 'pts',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 4, 12, 10],
          'circle-color': ['match', ['get', 'type'],
            'supply', '#2a9d8f',
            'demand', '#e76f51',
            'transshipment', '#e9c46a',
            '#888'
          ],
          'circle-stroke-width': 1,
          'circle-stroke-color': '#fff'
        }
      });

      map.on('click', 'pts-layer', (e: MapLayerMouseEvent) => {
        const p = e.features?.[0]?.properties;
        if (!p) return;
        new maplibregl.Popup()
          .setLngLat(e.lngLat)
          .setHTML(`<b>${p.name}</b><br>type: ${p.type}`)
          .addTo(map);
      });

      map.on('mouseenter', 'pts-layer', () => (map.getCanvas().style.cursor = 'pointer'));
      map.on('mouseleave', 'pts-layer', () => (map.getCanvas().style.cursor = ''));
    });

    return () => map.remove();
  });
</script>

<div bind:this={container} style="height: 600px; width: 100%;"></div>
