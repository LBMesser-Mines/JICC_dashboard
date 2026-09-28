<script lang="ts">
  import type { Snippet } from 'svelte';
  import PercentileBar from '$lib/percentile_bar.svelte';
  import { ordinal, formatMetric, type MetricStanding } from '$lib/network_graph';

  interface Props {
    label: string;
    value?: string;
    /** When set, shows a percentile bar and median against the baseline. */
    standing?: MetricStanding | null;
    /** Formats the median (e.g. to add units). */
    formatMedian?: (v: number) => string;
    sub?: string;
    children?: Snippet;
  }
  let { label, value, standing = null, formatMedian = formatMetric, sub, children }: Props = $props();
</script>

<div class="stat">
  <div class="stat-label">{label}</div>
  {#if value != null}<div class="stat-value">{value}</div>{/if}
  {@render children?.()}
  {#if standing}
    <PercentileBar percentile={standing.percentile} />
    <div class="stat-sub">{ordinal(standing.percentile)} pct · median {formatMedian(standing.median)}</div>
  {/if}
  {#if sub}<div class="stat-sub">{sub}</div>{/if}
</div>

<style>
  .stat {
    border: 1px solid #eee;
    border-radius: 6px;
    padding: 0.6rem 0.7rem;
    background: #fafafa;
  }
  .stat-label {
    font-size: 0.75rem;
    color: #666;
  }
  .stat-value {
    font-size: 1.2rem;
    font-weight: 600;
    margin: 0.1rem 0 0.3rem;
  }
  .stat-sub {
    font-size: 0.75rem;
    color: #888;
    margin-top: 0.2rem;
  }
</style>
