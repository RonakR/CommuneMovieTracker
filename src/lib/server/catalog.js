// Local demo fixtures only. Artwork is a typographic placeholder, not TMDB imagery.
export const catalog = [
  [1091, 'The Thing', '1982-06-25', 109, 'ice', 'Man is the warmest place to hide.'],
  [348, 'Alien', '1979-05-25', 117, 'alien', 'In space no one can hear you scream.'],
  [790, 'The Fog', '1980-02-08', 89, 'fog', 'Something is out there.'],
  [11906, 'Suspiria', '1977-02-01', 99, 'red', 'A spell you cannot escape.'],
  [310131, 'The Witch', '2015-01-27', 92, 'witch', 'A New England folktale.'],
  [764, 'The Evil Dead', '1981-09-10', 85, 'dead', 'The woods are waiting.'],
  [948, 'Halloween', '1978-10-25', 91, 'halloween', 'The night he came home.'],
  [9552, 'The Exorcist', '1973-12-26', 122, 'fog', 'Some doors should stay closed.'],
  [694, 'The Shining', '1980-05-23', 144, 'red', 'All work and no play.'],
  [539, 'Psycho', '1960-06-22', 109, 'witch', 'A room for the night.'],
  [923, 'Dawn of the Dead', '1978-09-02', 127, 'dead', 'When there is no more room.'],
  [335984, 'Blade Runner 2049', '2017-10-04', 164, 'halloween', 'Find your kind.']
].map(([tmdbId, title, releaseDate, runtimeMinutes, artwork, tagline]) => ({
  tmdbId,
  title,
  releaseDate,
  runtimeMinutes,
  artwork,
  tagline,
  posterPath: null,
  genres: [],
  cast: [],
  overview: '',
  rating: null,
  voteCount: 0
}));

// Example detail content for exercising the demo UI. Scores are intentionally absent.
Object.assign(
  catalog.find((movie) => movie.tmdbId === 948),
  {
    genres: ['Horror', 'Thriller'],
    cast: [
      { name: 'Donald Pleasence', character: 'Dr. Sam Loomis' },
      { name: 'Jamie Lee Curtis', character: 'Laurie Strode' },
      { name: 'Nancy Kyes', character: 'Annie Brackett' },
      { name: 'P. J. Soles', character: 'Lynda van der Klok' },
      { name: 'Charles Cyphers', character: 'Sheriff Leigh Brackett' }
    ],
    overview:
      'On Halloween night, a masked killer returns to his hometown, where a teenage babysitter and her friends find themselves in danger.'
  }
);
