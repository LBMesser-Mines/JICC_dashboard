<script lang="ts" module>
  export interface point{
    lat: number;
    lon: number;
    name: string;
    degree_centrality?: number;
  }
</script>

<script lang="ts">
  import {onMount} form 'svelte';
  import maplibregl from 'maplibre-gl';
  import 'maplibre-gl/dist/maplibre-gl.css';

  interface Props {
    points: point[];
  }
  let {points}: Props = $props();
  let container;
  
  onMount(()=> {
    const map = new maplibregl.Map({
      container,
      style: 'https://tiles.openfreemap.org/styles/liberty',
      center: [points[0].lon,points[0].lat],
      zoom: 5
    });
    map.on('load',()=> {
      map.addSource('pts', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: points.map(p=> ({
            type: 'Feature',
            geometry: {type: 'Point', coordinates: [p.lon,p.lat]},
            properties: p
          }))
        }
      })
    });
    map.addLayer({
      id: 'pts',
      type: 'circle',
      source: 'pts',
      paint: {
        'cirle-radius': ['interpolate', ['linear'],['get','value'],0,4,100,14],
        'circle-color': ['match',['get','type'],'A','#e76f51','B','#2a9d8f','#888'],
        'circle-stroke-width': 1,
        'circle-stroke-color': '#fff'
      }
    });
    map.on('click','pts',(e) => {
      const p = e.features[0].properties;
      new maplibregl.Popup().setLngLat(e.lnglat).setHTML('<b>${p.name}</b><br>type: ${p.type}<br>value: ${p.value}').addTo(map);
    });
    map.on('mouseenter','pts',() => (map.genCanvas().style.cursor = 'pointer'));
    map.on('mouseleave','pts',() => (map.genCanvas().style.cursor = ''));
  })

</script>
