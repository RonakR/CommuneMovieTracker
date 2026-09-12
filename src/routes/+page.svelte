<script>
  import { onMount, tick } from 'svelte';
  import { goto, invalidate } from '$app/navigation';
  import { page } from '$app/state';
  import Asterisk from '$lib/components/Asterisk.svelte';
  import { requestJson } from '$lib/request-json.js';
  import Poster from '$lib/components/Poster.svelte';
  import Modal from '$lib/components/Modal.svelte';
  import { localDate, formatDate } from '$lib/dates.js';

  let { data } = $props();
  let filter = $state('unwatched');
  let search = $state('');
  let sort = $state('added');
  let modal = $state(null);
  let selected = $state(null);
  let viewing = $state(null);
  let watchedOn = $state('');
  let pending = $state(false);
  let error = $state('');
  let toast = $state('');
  let today = $state(localDate());
  let catalogQuery = $state('');
  let results = $state([]);
  let searching = $state(false);
  let didSearch = $state(false);
  let searchController;
  let detailController;
  let searchSequence = 0;
  let detailSequence = 0;
  let catalogMovie = $state(null);
  let detailsLoading = $state(false);
  let detailsError = $state('');
  let addedNotice = $state('');
  let catalogInput = $state();
  let detailsHeading = $state();
  let detailsTrigger;

  let newYear = $state(new Date().getFullYear() + 1);
  let credits = $state(false);
  const isHistory = $derived(page.url.searchParams.get('view') === 'history');
  const watchedCount = $derived(data.entries.filter((e) => e.viewings.length).length);
  const filtered = $derived.by(() => {
    const entries = data.entries.filter(
      (e) =>
        (filter === 'all' || (filter === 'watched' ? e.viewings.length > 0 : !e.viewings.length)) &&
        e.movie.title.toLowerCase().includes(search.toLowerCase())
    );
    if (sort === 'title') entries.sort((a, b) => a.movie.title.localeCompare(b.movie.title));
    if (sort === 'release')
      entries.sort((a, b) => (b.movie.releaseDate || '').localeCompare(a.movie.releaseDate || ''));
    return entries;
  });
  const history = $derived(
    data.entries
      .flatMap((entry) => entry.viewings.map((v) => ({ ...v, entry })))
      .sort(
        (a, b) => b.watchedOn.localeCompare(a.watchedOn) || b.createdAt.localeCompare(a.createdAt)
      )
  );
  const days = $derived(
    [...new Set(history.map((v) => v.watchedOn))].map((date) => ({
      date,
      items: history.filter((v) => v.watchedOn === date)
    }))
  );
  onMount(() => {
    today = localDate();
  });
  function close() {
    if (!pending) {
      searchController?.abort();
      detailController?.abort();
      modal = null;
      error = '';
      searchSequence++;
      detailSequence++;
      searching = false;
    }
  }
  function openAdd() {
    searchController?.abort();
    searchSequence++;
    searching = false;
    error = '';
    catalogQuery = '';
    results = [];
    didSearch = false;
    catalogMovie = null;
    detailsError = '';
    addedNotice = '';
    detailSequence++;
    modal = 'add';
  }
  function record(entry, existing = null) {
    selected = entry;
    viewing = existing;
    watchedOn =
      existing?.watchedOn ||
      (Number(today.slice(0, 4)) === data.year ? today : `${data.year}-10-31`);
    error = '';
    modal = 'record';
  }
  async function api(url, method, payload) {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: payload ? JSON.stringify(payload) : undefined
    });
    const value = await res.json();
    if (!res.ok) throw new Error(value.message || 'Your change could not be saved.');
    return value;
  }
  async function mutate(fn, message, dismiss = true) {
    if (pending) return;
    pending = true;
    error = '';
    toast = '';
    try {
      await fn();
      await invalidate('app:collection');
      toast = message;
      if (dismiss) modal = null;
      return true;
    } catch (err) {
      error = err.message || 'Could not connect. Please try again.';
      return false;
    } finally {
      pending = false;
    }
  }
  async function findMovies(event) {
    event?.preventDefault();
    searchController?.abort();
    searchController = new AbortController();
    const signal = searchController.signal;
    const sequence = ++searchSequence;
    searching = true;
    results = [];
    addedNotice = '';
    error = '';
    didSearch = false;
    try {
      const value = await requestJson(`/api/search?q=${encodeURIComponent(catalogQuery)}`, {
        signal
      });
      if (sequence !== searchSequence) return;
      results = value.movies;
      didSearch = true;
    } catch (err) {
      if (sequence === searchSequence) error = err.message;
    } finally {
      if (sequence === searchSequence) searching = false;
    }
  }
  function changeYear(year) {
    modal = null;
    toast = '';
    error = '';
    goto(`/?year=${year}${isHistory ? '&view=history' : ''}`, { keepFocus: true });
  }
  async function showMovie(movie, trigger) {
    detailController?.abort();
    detailController = new AbortController();
    detailsTrigger = trigger || detailsTrigger;
    catalogMovie = movie;
    detailsLoading = true;
    detailsError = '';
    error = '';
    const sequence = ++detailSequence;
    await tick();
    detailsHeading?.focus();
    try {
      const value = await requestJson(`/api/movies/${movie.tmdbId}`, {
        signal: detailController.signal
      });
      if (sequence !== detailSequence) return;
      catalogMovie = value.movie;
    } catch (err) {
      if (sequence === detailSequence)
        detailsError = err.message || 'Could not load movie details.';
    } finally {
      if (sequence === detailSequence) detailsLoading = false;
    }
  }
  async function backToResults() {
    detailController?.abort();
    detailSequence++;
    catalogMovie = null;
    detailsError = '';
    error = '';
    await tick();
    document.getElementById(detailsTrigger)?.focus();
  }
  async function addCatalogMovie(movie) {
    const message = `${movie.title} added to ${data.year}.`;
    const saved = await mutate(
      () => api('/api/entries', 'POST', { year: data.year, tmdbId: movie.tmdbId }),
      message,
      false
    );
    if (!saved) return;
    searchController?.abort();
    detailController?.abort();
    searchSequence++;
    detailSequence++;
    catalogQuery = '';
    results = [];
    didSearch = false;
    catalogMovie = null;
    searching = false;
    detailsLoading = false;
    addedNotice = message;
    await tick();
    catalogInput?.focus();
  }
  function excerpt(text) {
    return text.length > 600 ? `${text.slice(0, 600).replace(/\s+\S*$/, '')}…` : text;
  }
</script>

<svelte:head
  ><title>Commune Video · {data.year}</title><meta
    name="description"
    content="A shared shelf for your Halloween movie nights. Pick a movie. Make a night of it."
  /></svelte:head
>

<div class="site-shell">
  <div class="utility">
    <span>YOUR NEIGHBORHOOD HALLOWEEN MOVIE CLUB</span><span class="utility-right"
      ><i></i> OPEN AFTER DARK</span
    >
  </div>
  <header>
    <a class="brand" href={`/?year=${data.year}`} aria-label="Commune Video home"
      ><span>COMMUNE<span class="brand-star"><Asterisk /></span>VIDEO</span><small
        >GOOD MOVIES. BETTER COMPANY.</small
      ></a
    >
    <div class="header-right">
      <div class="pumpkin-stamp">
        <img src="/favicon.svg" alt="" /><span>SAME FRIENDS.<br />NEW NIGHTMARES.</span>
      </div>
      <nav aria-label="Main navigation">
        <a class:active={!isHistory} href={`/?year=${data.year}`}>Collection</a><a
          class:active={isHistory}
          href={`/?year=${data.year}&view=history`}>Viewing history</a
        >
      </nav>
    </div>
  </header>

  {#if data.demo}<div class="demo-banner">
      <span><b>DEMO SHELF</b> Sample movies · changes saved locally</span><span
        >Add your credentials to <code>.env</code> to connect your real collection.</span
      >
    </div>{/if}
  {#if data.setupError}<div class="setup-error" role="alert">
      <h2>Let’s get the projector running.</h2>
      <p>{data.setupError}</p>
      <button onclick={() => invalidate('app:collection')}>Retry connection</button>
    </div>{/if}
  {#if data.metadataWarning}<p class="notice">
      Some movie details could not be refreshed. Your collection and viewing history are safe.
    </p>{/if}
  <main id="main">
    <div class="page-heading">
      <div>
        <div class="eyebrow">
          {isHistory ? 'THE NIGHTS WE MADE OF IT' : 'SEPTEMBER NIGHTS. OCTOBER FRIGHTS.'}
        </div>
        <h1>
          {isHistory ? 'The watch log.' : 'Something good'}{#if !isHistory}<br /><span
              >after dark.</span
            >{/if}
        </h1>
        <p class="intro">
          {isHistory
            ? 'Every movie night, back on the record.'
            : 'A shelf full of possibilities. What’s on tonight?'}
        </p>
      </div>
      <div class="heading-actions">
        <label class="year-label"
          >YOUR COLLECTION<select
            aria-label="Collection year"
            value={data.year}
            onchange={(event) => {
              const value = event.target.value;
              if (value === 'new') {
                modal = 'year';
                error = '';
                event.target.value = String(data.year);
              } else changeYear(value);
            }}
            >{#each data.years as year}<option value={year}>{year}</option>{/each}<option
              value="new">+ Another year</option
            ></select
          ></label
        ><button class="primary add-button" onclick={openAdd} disabled={!!data.setupError}
          ><span>＋</span> Add movie</button
        >
      </div>
    </div>
    {#if toast}<div class="toast" role="status">
        <span>✓ {toast}</span><button
          class="icon-button"
          aria-label="Dismiss notification"
          onclick={() => (toast = '')}>×</button
        >
      </div>{/if}
    {#if error && !modal}<p class="error" role="alert">{error}</p>{/if}
    {#if !data.setupError}
      {#if !isHistory}
        <section aria-label="Movie collection">
          <div class="collection-toolbar">
            <div class="tabs" aria-label="Filter movies">
              {#each [['unwatched', 'Unwatched', data.entries.length - watchedCount], ['watched', 'Watched', watchedCount], ['all', 'All movies', data.entries.length]] as [key, label, count]}<button
                  class:active={filter === key}
                  aria-pressed={filter === key}
                  onclick={() => (filter = key)}>{label}<span>{count}</span></button
                >{/each}
            </div>
            <div class="browse-tools">
              <label class="search-field"
                ><span aria-hidden="true">⌕</span><input
                  aria-label="Search your collection"
                  placeholder="Search the shelf…"
                  bind:value={search}
                /></label
              ><select aria-label="Sort movies" bind:value={sort}
                ><option value="added">Date added</option><option value="title">Title A–Z</option
                ><option value="release">Release date</option></select
              >
            </div>
          </div>
          <div class="shelf-caption">
            <span
              >{filter === 'unwatched'
                ? 'WAITING FOR THEIR NIGHT'
                : filter === 'watched'
                  ? 'WORTH REMEMBERING. MAYBE REWATCHING.'
                  : 'THE WHOLE COLLECTION'}</span
            ><span
              >{filtered.length} {filtered.length === 1 ? 'TITLE' : 'TITLES'} / {data.year}</span
            >
          </div>
          {#if filtered.length}
            <div class="movie-grid">
              {#each filtered as entry (entry._id)}<article class="movie-card">
                  <button
                    class="poster-button"
                    aria-label={`Details for ${entry.movie.title}`}
                    onclick={() => {
                      selected = entry;
                      modal = 'details';
                      error = '';
                    }}
                    ><Poster movie={entry.movie} />{#if entry.viewings.length}<span
                        class="watched-sticker"
                        >✓ WATCHED{entry.viewings.length > 1
                          ? ` ×${entry.viewings.length}`
                          : ''}</span
                      >{/if}</button
                  >
                  <div class="movie-heading">
                    <h2>{entry.movie.title}</h2>
                    <button
                      class="more-button"
                      aria-label={`More options for ${entry.movie.title}`}
                      onclick={() => {
                        selected = entry;
                        modal = 'details';
                        error = '';
                      }}>···</button
                    >
                  </div>
                  <p class="movie-meta">
                    {entry.movie.releaseDate?.slice(0, 4) || 'Release unknown'}<span>
                      /
                    </span>{entry.movie.runtimeMinutes
                      ? `${entry.movie.runtimeMinutes} MIN`
                      : 'FEATURE FILM'}
                  </p>
                  <button class="record-button" onclick={() => record(entry)}
                    >{entry.viewings.length ? '↺  Watch again' : '＋  Record viewing'}</button
                  >
                </article>{/each}
            </div>
          {:else}<div class="empty-state">
              <span class="empty-icon"><Asterisk /></span>
              <h2>
                {!data.entries.length
                  ? 'A fresh shelf. A new season.'
                  : filter === 'watched'
                    ? 'The first night is still ahead.'
                    : 'Nothing on this shelf.'}
              </h2>
              <p>
                {!data.entries.length
                  ? 'Find a movie and give it a place in this year’s collection.'
                  : search
                    ? 'Try another title or clear your search.'
                    : filter === 'watched'
                      ? 'Record a viewing and it’ll show up here.'
                      : 'Try All movies to revisit a favorite, or add something new.'}
              </p>
              {#if !data.entries.length}<button class="primary" onclick={openAdd}
                  >＋ Add your first movie</button
                >{:else}<button
                  onclick={() => {
                    filter = 'all';
                    search = '';
                  }}>See all movies</button
                >{/if}
            </div>{/if}
        </section>
      {:else}
        <section aria-label="Viewing history">
          <div class="collection-toolbar">
            <span class="history-label">All days</span><span class="history-year"
              >THE {data.year} TAPES</span
            >
          </div>
          {#if days.length}<div class="history-days">
              {#each days as day}<section class="history-day">
                  <div class="day-label">
                    <span>{formatDate(day.date, { weekday: 'long' }).split(',')[0]}</span>
                    <h2>{formatDate(day.date)}</h2>
                    <small>{day.items.length} {day.items.length === 1 ? 'MOVIE' : 'MOVIES'}</small>
                  </div>
                  <div class="day-movies">
                    {#each day.items as item}<article class="history-row">
                        <div class="history-poster"><Poster movie={item.entry.movie} small /></div>
                        <div class="history-title">
                          <h3>{item.entry.movie.title}</h3>
                          <p>
                            {item.entry.movie.releaseDate?.slice(0, 4)}{item.entry.movie
                              .runtimeMinutes
                              ? ` · ${item.entry.movie.runtimeMinutes} min`
                              : ''}
                          </p>
                        </div>
                        <button
                          onclick={() => record(item.entry, item)}
                          aria-label={`Edit viewing of ${item.entry.movie.title} on ${day.date}`}
                          >Edit date</button
                        ><button
                          class="icon-button"
                          aria-label={`Remove viewing of ${item.entry.movie.title} on ${day.date}`}
                          onclick={() => {
                            selected = item.entry;
                            viewing = item;
                            modal = 'deleteViewing';
                            error = '';
                          }}>×</button
                        >
                      </article>{/each}
                  </div>
                </section>{/each}
            </div>{:else}<div class="empty-state">
              <span class="empty-icon">◷</span>
              <h2>Every season starts with a movie.</h2>
              <p>Record your first viewing to start your movie-night history.</p>
              <a class="button" href={`/?year=${data.year}`}>Browse the collection →</a>
            </div>{/if}
        </section>
      {/if}
    {/if}
    <div class="bottom-note">
      <span>BE KIND. REWATCH.</span><span>A LITTLE TRADITION, ONE MOVIE AT A TIME.</span><span
        aria-hidden="true">▥ ▥ ▥</span
      >
    </div>
  </main>
  <footer>
    <span>COMMUNE VIDEO <span class="footer-divider">/</span> FRIENDS. MOVIES. HALLOWEEN.</span
    ><button class="text-button" onclick={() => (credits = true)}>About & credits ↗</button>
  </footer>
</div>

{#if modal === 'add'}
  <Modal title="Find your next movie." onclose={close} wide>
    {#if catalogMovie}
      {@const added = data.entries.some((entry) => entry.movie.tmdbId === catalogMovie.tmdbId)}
      <button class="text-button back-to-results" onclick={backToResults} disabled={pending}
        >← Back to results</button
      >
      <div class="catalog-detail-top">
        <div class="detail-poster"><Poster movie={catalogMovie} /></div>
        <div class="catalog-detail-heading">
          <h3 tabindex="-1" bind:this={detailsHeading}>{catalogMovie.title}</h3>
          <p class="dialog-copy">
            {catalogMovie.releaseDate
              ? formatDate(catalogMovie.releaseDate, { year: 'numeric' })
              : 'Release date unknown'}
          </p>
          <p class="genre-list">{catalogMovie.genres?.join(' · ') || 'Genres unavailable'}</p>
          {#if !detailsLoading && !detailsError}
            <p class="detail-runtime">
              {catalogMovie.runtimeMinutes
                ? `${catalogMovie.runtimeMinutes} min`
                : 'Runtime unavailable'}
            </p>
            <div class="tmdb-score">
              <span>TMDB user score</span><strong
                >{catalogMovie.rating != null
                  ? `${catalogMovie.rating.toFixed(1)} / 10`
                  : 'Not yet rated'}</strong
              >{#if catalogMovie.voteCount > 0}<small
                  >{catalogMovie.voteCount.toLocaleString('en-US')} votes</small
                >{/if}
            </div>
          {/if}
        </div>
      </div>
      {#if detailsLoading}<p class="dialog-copy" role="status">Loading movie details…</p>
      {:else if detailsError}<p class="error" role="alert">{detailsError}</p>
        <button onclick={() => showMovie(catalogMovie)}>Retry details</button>
      {:else}
        <section class="catalog-overview" aria-label="Synopsis">
          <h4>The story</h4>
          <p>{catalogMovie.overview ? excerpt(catalogMovie.overview) : 'No synopsis available.'}</p>
        </section>
        <section class="catalog-cast" aria-label="Cast">
          <h4>Cast</h4>
          {#if catalogMovie.cast?.length}<ul>
              {#each catalogMovie.cast as actor}<li>
                  <span>{actor.name}</span>{#if actor.character}<small>{actor.character}</small
                    >{/if}
                </li>{/each}
            </ul>{:else}<p class="dialog-copy">Cast information unavailable.</p>{/if}
        </section>
        {#if !data.demo}<a
            class="tmdb-details-link"
            href={`https://www.themoviedb.org/movie/${catalogMovie.tmdbId}`}
            target="_blank"
            rel="noreferrer">More on TMDB ↗</a
          >{/if}
      {/if}
      {#if error}<p class="error" role="alert">{error}</p>{/if}
      <div class="dialog-actions">
        <button onclick={backToResults} disabled={pending}>Back to results</button><button
          class="primary"
          disabled={added || pending}
          onclick={() => addCatalogMovie(catalogMovie)}
          >{added
            ? '✓ Already on your shelf'
            : pending
              ? 'Saving…'
              : `＋ Add to ${data.year}`}</button
        >
      </div>
    {:else}
      <p class="dialog-copy">
        Add a title to the {data.year} shelf. {data.demo
          ? 'Search the sample catalog: try “Halloween” or “The Shining”.'
          : 'Search movies on TMDB.'}
      </p>
      {#if addedNotice}<p class="added-notice" role="status">
          ✓ {addedNotice} Search for another?
        </p>{/if}
      <form class="catalog-search" onsubmit={findMovies}>
        <input
          bind:this={catalogInput}
          aria-label="Search movie catalog"
          placeholder="Movie title…"
          bind:value={catalogQuery}
          disabled={pending}
          required
          minlength="2"
          maxlength="150"
        />
        <button class="primary" disabled={searching || pending || catalogQuery.trim().length < 2}
          >{searching ? 'Searching…' : 'Search'}</button
        >
      </form>
      {#if error}<p class="error" role="alert">{error}</p>{/if}
      <div class="search-results" aria-live="polite" aria-busy={searching}>
        {#each results as movie}
          {@const added = data.entries.some((entry) => entry.movie.tmdbId === movie.tmdbId)}
          <article class="search-result">
            <button
              class="search-result-details"
              id={`search-movie-${movie.tmdbId}`}
              aria-label={`View details for ${movie.title} (${movie.releaseDate?.slice(0, 4) || 'unknown year'})`}
              disabled={pending}
              onclick={() => showMovie(movie, `search-movie-${movie.tmdbId}`)}
            >
              <div class="result-poster"><Poster {movie} small /></div>
              <div class="search-result-copy">
                <h3>
                  {movie.title}
                  <span class="result-year"
                    >{movie.releaseDate?.slice(0, 4) || 'Release date unknown'}</span
                  >
                </h3>
                <p class="genre-list">{movie.genres?.join(' · ') || 'Genres unavailable'}</p>
                <p class="search-score">
                  {movie.rating != null ? `TMDB ${movie.rating.toFixed(1)} / 10` : 'Not yet rated'}
                </p>
                <span class="view-details-label">View details →</span>
              </div>
            </button>
            <button
              class:primary={!added}
              disabled={added || pending}
              onclick={() => addCatalogMovie(movie)}
              >{added ? '✓ Added' : pending ? 'Saving…' : '＋ Add'}</button
            >
          </article>
        {:else}
          {#if searching}<p class="dialog-copy">Finding movies…</p>{:else if didSearch}<p
              class="dialog-copy"
            >
              No movies found. Try another title.
            </p>{:else}<div class="search-hint">THE NEXT GOOD NIGHT STARTS HERE.</div>{/if}
        {/each}
      </div>
      <div class="dialog-actions"><button onclick={close} disabled={pending}>Done</button></div>
    {/if}
  </Modal>
{:else if modal === 'record'}
  <Modal title={viewing ? 'Edit viewing date.' : 'Record a viewing.'} onclose={close}
    ><div class="selected-movie">
      <div class="result-poster"><Poster movie={selected.movie} small /></div>
      <div>
        <h3>{selected.movie.title}</h3>
        <p>{selected.movie.releaseDate?.slice(0, 4)}</p>
      </div>
    </div>
    <form
      onsubmit={(event) => {
        event.preventDefault();
        mutate(
          () =>
            api(
              viewing ? `/api/viewings/${viewing._id}` : '/api/viewings',
              viewing ? 'PATCH' : 'POST',
              { yearEntryId: selected._id, watchedOn }
            ),
          viewing
            ? 'Viewing date updated.'
            : `${selected.movie.title} recorded for ${formatDate(watchedOn)}.`
        );
      }}
    >
      <label class="form-label"
        >Watched on<input
          type="date"
          bind:value={watchedOn}
          required
          min={`${data.year}-01-01`}
          max={`${data.year}-12-31`}
        /></label
      >
      <p class="dialog-copy">
        {viewing
          ? 'This updates only this viewing.'
          : 'Each viewing is saved separately. Favorites deserve another night.'}
      </p>
      {#if error}<p class="error" role="alert">{error}</p>{/if}
      <div class="dialog-actions">
        <button type="button" onclick={close} disabled={pending}>Cancel</button><button
          class="primary"
          disabled={pending}>{pending ? 'Saving…' : 'Save viewing'}</button
        >
      </div>
    </form></Modal
  >
{:else if modal === 'details'}
  <Modal title={selected.movie.title} onclose={close}
    ><div class="selected-movie">
      <div class="detail-poster"><Poster movie={selected.movie} /></div>
      <div>
        <div class="eyebrow">ON THE {data.year} SHELF</div>
        <p>
          {selected.movie.releaseDate
            ? formatDate(selected.movie.releaseDate, { year: 'numeric' })
            : 'Release date unknown'}
        </p>
        <p>{selected.movie.runtimeMinutes ? `${selected.movie.runtimeMinutes} minutes` : ''}</p>
        <button class="primary" onclick={() => record(selected)}
          >{selected.viewings.length ? 'Watch again' : 'Record viewing'}</button
        >
      </div>
    </div>
    <h3 class="viewings-title">
      {selected.viewings.length ? 'Viewing records' : 'Still waiting for its night.'}
    </h3>
    {#each selected.viewings as item}<div class="viewing-line">
        <span>{formatDate(item.watchedOn, { year: 'numeric' })}</span><button
          onclick={() => record(selected, item)}>Edit</button
        >
      </div>{/each}
    <div class="dialog-actions">
      <button
        class="danger-text"
        onclick={() => {
          modal = 'deleteEntry';
          error = '';
        }}>Remove from {data.year}</button
      ><button onclick={close}>Done</button>
    </div></Modal
  >
{:else if modal === 'deleteEntry' || modal === 'deleteViewing'}
  <Modal
    title={modal === 'deleteEntry' ? 'Remove from the shelf?' : 'Remove this viewing?'}
    onclose={close}
    ><p class="dialog-copy">
      {modal === 'deleteEntry'
        ? `Remove ${selected.movie.title} from ${data.year}? This also removes its ${selected.viewings.length} viewing record(s) in this year. Other years are unaffected.`
        : `Remove the ${formatDate(viewing.watchedOn)} viewing of ${selected.movie.title}? The movie stays in your collection.`}
    </p>
    {#if error}<p class="error" role="alert">{error}</p>{/if}
    <div class="dialog-actions">
      <button onclick={close} disabled={pending}>Cancel</button><button
        class="danger"
        disabled={pending}
        onclick={() =>
          mutate(
            () =>
              api(
                modal === 'deleteEntry'
                  ? `/api/entries/${selected._id}`
                  : `/api/viewings/${viewing._id}`,
                'DELETE'
              ),
            modal === 'deleteEntry' ? 'Movie removed from this year.' : 'Viewing removed.'
          )}>{pending ? 'Removing…' : 'Remove'}</button
      >
    </div></Modal
  >
{:else if modal === 'year'}
  <Modal title="Another year, another shelf." onclose={close}
    ><form
      onsubmit={(event) => {
        event.preventDefault();
        changeYear(newYear);
      }}
    >
      <label class="form-label"
        >Collection year<input
          type="number"
          min="1900"
          max="2200"
          step="1"
          bind:value={newYear}
          required
        /></label
      >
      <p class="dialog-copy">
        Start fresh, or return to an older collection. Movies stay in the year you add them to.
      </p>
      <div class="dialog-actions">
        <button type="button" onclick={close}>Cancel</button><button class="primary"
          >Open collection</button
        >
      </div>
    </form></Modal
  >
{/if}
{#if credits}<Modal title="About Commune Video" onclose={() => (credits = false)}
    ><p class="dialog-copy">
      A shared shelf for friends who spend the fall watching movies together. No accounts
      yet—everyone with access can edit the collection.
    </p>
    {#if data.demo}<p class="dialog-copy">
        Demo mode uses a small sample catalog and original typographic placeholder covers. Your
        changes are saved locally.
      </p>{:else}<a href="https://www.themoviedb.org/" target="_blank" rel="noreferrer"
        ><img
          class="tmdb-logo"
          src="https://www.themoviedb.org/assets/2/v4/logos/v2/blue_long_1-8ba2ac31f354005783fab473602c34c3f4fd207150182061e425d366e4f34596.svg"
          alt="TMDB"
        /></a
      >
      <p class="dialog-copy">
        This product uses the TMDB API but is not endorsed or certified by TMDB.
      </p>{/if}
    <div class="dialog-actions">
      <button onclick={() => (credits = false)}>Back to the movies</button>
    </div></Modal
  >{/if}
