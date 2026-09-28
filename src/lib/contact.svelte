<script lang="ts">
  let {name, email, subject = ''} = $props();
  const href = $derived(`mailto:${email}` + (subject ? `?subject=${encodeURIComponent(subject)}` : ''));
</script>

<p class="contract">
  Contact: <a {href}>{name}</a>
</p>
