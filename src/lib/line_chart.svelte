<script lang="ts" module>
  export type Row = Record<string, number | string>;
  export interface Series {
    rows: Row[]
    y: string;
    label?: string;
    axis?: 'left' | 'right';
  }
</script>

<script lang="ts">
  import Chart from 'chart.js/auto';
   
  
  interface Props {
    series: Series[];
    x: string;
  }
  
  let {series, x}: Props = $props();
  let canvas: HTMLCanvasElement;
  
  $effect(() => {
      const hasRight = series.some((s)=>s.axis==='right');
      const chart = new Chart(canvas, {
        type: 'line',
        data: {
          datasets: series.map((s)=> ({
            label: s.label ?? s.y, 
            data: s.rows.map((r)=> ({x: Number(r[x]), y: Number(r[s.y])})), 
            yAxisID: s.axis === 'right'?'y1':'y'
          })),
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: {mode: 'nearest',axis:'x',intersect:false},
          scales: {
            x: {type:'linear',title:{display:true,text:x}},
            y: {position: 'left'},
            y1: {position: 'right',display:hasRight, grid:{drawOnChartArea:false}},
          },
        },
      });
      return () => chart.destroy();
    });
</script>

<div class="chart">
  <canvas bind:this={canvas}></canvas>
</div>

<style>
  .chart {
    position: relative;
    height: 300px
  }
</style>
