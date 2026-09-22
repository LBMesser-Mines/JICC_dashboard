<script lang="ts">
  import type {Snippet} from 'svelte';

  interface Props {
    title?: string;
    children?: Snippet;
    footer?: Snippet;
  }

	let {title = '', children,footer= undefined}: Props = $props();
</script>

<div class="box">
  {#if title}<h3>{title}</h3>{/if}
  {@render children?.()}
  {@render footer?.()}
</div>

<style>
.box {
  border: 1px solid #ccc;
  border-radius: 8px;
  padding: 1rem;
  background: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}
h3 {margin-top: 0;}
</style>


