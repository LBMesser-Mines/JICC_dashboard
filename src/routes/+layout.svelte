<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
  import {page} from '$app/state';
  import {resolve} from '$app/paths';

	let { children } = $props();

  const tabs = [
    {label: 'Overview', href: '/'},
    {label: 'Topological', href: '/topological_analysis'},
    {label: 'Predictive', href: '/historical_analysis'},
    {label: 'Interdict', href: '/settings'},
  ] as const;

  // Links carry the base path (e.g. /JICC_dashboard on GitHub Pages); ignore a trailing slash when matching.
  const trim = (p: string) => p.replace(/\/$/, '') || '/';
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<nav class="tabbar">
  <span class="site-title">Drug Interdiction Dashboard</span>
  {#each tabs as tab}
    <a href={resolve(tab.href)} class:active={trim(page.url.pathname) === trim(resolve(tab.href))}>{tab.label}</a>
  {/each}
</nav>

<main>{@render children()}</main>

<style>
  .tabbar {
    display: flex;
    gap: 1rem;
    padding: 1rem 1rem;
    border-bottom: 2px solid #ccc;
    background: #fafafa;
    position: sticky;
    top: 0;
    z-index: 10;
    align-items: center;
    flex-wrap: wrap;
  }
  .site-title {
    margin-right: auto;
    font-size: 1.25rem;
    font-weight: 700;
  }
  .tabbar a {
    padding: .5rem 1.25rem;
    border: 1px solid #ccc;
    border-radius: 6px;
    background: #fff;
    color: inherit;
    text-decoration: none;
    transition: background 0.15s, border-color 0.15s;
  }
  .tabbar a:hover {
    background: #f0f0f0;
    border-color: #999;
  }
  .tabbar a.active {
    background: #333;
    border-color: #333;
    color: #fff;
    font-weight: 600;
  }
  main {
    padding: 1rem;
  }
</style>
