<script lang="ts">
  import { ordinal, percentileTier } from '$lib/network_graph';

  /** 0–100; the tick marks the median (50th percentile). */
  let { percentile }: { percentile: number } = $props();
</script>

<span class="bar" title="{ordinal(percentile)} percentile">
  <span class="fill {percentileTier(percentile).cls}" style="width:{Math.max(percentile, 1)}%"></span>
  <span class="median-tick"></span>
</span>

<style>
  .bar {
    position: relative;
    display: block;
    height: 6px;
    border-radius: 3px;
    background: #e8e8e8;
    min-width: 80px;
  }
  .fill {
    position: absolute;
    inset: 0 auto 0 0;
    border-radius: 3px;
  }
  .median-tick {
    position: absolute;
    left: 50%;
    top: -2px;
    bottom: -2px;
    width: 1px;
    background: #555;
  }
  .hi2 { background: #bd0026; }
  .hi { background: #f03b20; }
  .mid { background: #fd8d3c; }
  .lo { background: #fecc5c; }
  .lo2 { background: #d9d9a0; }
</style>
