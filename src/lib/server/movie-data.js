// Keep provider response handling independent of the server runtime for focused tests.
export function normalizeMovie(movie) {
  const voteCount = Number.isFinite(movie.vote_count) ? movie.vote_count : 0;
  return {
    tmdbId: movie.id,
    title: movie.title,
    releaseDate: movie.release_date || '',
    posterPath: movie.poster_path || null,
    runtimeMinutes: movie.runtime || null,
    genres: (movie.genres || []).map((genre) => genre.name),
    cast: [...(movie.credits?.cast || [])]
      .sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity))
      .slice(0, 12)
      .map(({ name, character }) => ({ name, character: character || '' })),
    overview: movie.overview || '',
    rating: voteCount > 0 && Number.isFinite(movie.vote_average) ? movie.vote_average : null,
    voteCount
  };
}
export function moviePreview(movie) {
  const {
    tmdbId,
    title,
    releaseDate,
    posterPath,
    genres,
    cast,
    detailsUnavailable,
    artwork,
    tagline
  } = movie;
  return {
    tmdbId,
    title,
    releaseDate,
    posterPath,
    genres,
    cast: cast.slice(0, 3),
    detailsUnavailable,
    artwork,
    tagline
  };
}
