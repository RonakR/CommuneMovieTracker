<script>
  let { movie, small = false } = $props();
  let failed = $state(false);
</script>

<div class:small class="poster {movie.artwork || 'unknown'}">
  {#if movie.posterPath && !failed}
    <img
      src={`https://image.tmdb.org/t/p/w500${movie.posterPath}`}
      alt={`${movie.title} poster`}
      loading="lazy"
      onerror={() => (failed = true)}
    />
  {:else}
    <div class="tape-label"><span>COMMUNE VIDEO</span><span>FEATURE FILM</span></div>
    <div class="cover-title">{movie.title}</div>
    <div class="cover-art" aria-hidden="true">
      <div class="orb"></div>
      <div class="beam"></div>
    </div>
    <div class="cover-bottom">
      <span>{movie.tagline || 'A place on the shelf.'}</span><b>VHS</b>
    </div>
  {/if}
</div>
