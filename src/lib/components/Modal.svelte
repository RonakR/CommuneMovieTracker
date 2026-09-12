<script>
  import { onMount } from 'svelte';
  let { title, onclose, children, wide = false } = $props();
  let dialog;
  onMount(() => {
    const previous = document.activeElement;
    dialog.showModal();
    const old = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = old;
      if (previous instanceof HTMLElement) previous.focus();
    };
  });
</script>

<dialog
  bind:this={dialog}
  class:wide
  oncancel={(event) => {
    event.preventDefault();
    onclose();
  }}
  aria-label={title}
>
  <div class="dialog-head">
    <h2>{title}</h2>
    <button class="icon-button" onclick={onclose} aria-label="Close dialog">×</button>
  </div>
  {@render children()}
</dialog>
