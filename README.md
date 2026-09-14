# Commune Video

A small SvelteKit + JavaScript app for a shared Halloween movie collection. Browse by year, add movies, and record movie nights. Multiple viewings—even of the same movie on the same day—are separate records. There is no authentication in this version.

## Run locally

Requires Node.js 22+.

```sh
npm install
cp .env.example .env # only if .env does not already exist
npm run dev
```

Open http://localhost:5173. A prepared `.env` is included in the local workspace but excluded from Git.

### Try it without credentials

`DEMO_MODE=true` uses a fixed sample movie catalog and original placeholder covers. Changes persist in `.data/demo.json`. The sample shelf starts with seven unwatched movies in the current year. Search for “The Shining” or “Psycho” to add more. Demo data is separate from MongoDB and never copied into Atlas automatically. The local JSON store is intended for a single local server process only.

### Connect real services

In `.env`, set:

```dotenv
DEMO_MODE=false
MONGODB_URI=your-atlas-connection-string
MONGODB_DATABASE=commune_movie_tracker
TMDB_READ_ACCESS_TOKEN=your-tmdb-api-read-access-token
```

Restart the development server. Use a TMDB **API Read Access Token**, not the shorter API key. Configure an Atlas database user and allow your development machine’s IP in Atlas Network Access. The app uses Atlas transactions for related writes; a standalone non-replica-set MongoDB server is not supported. With demo mode off, missing or invalid credentials produce an explicit error; the app never silently falls back to demo storage.

Credentials are read only by server modules. Do not add a PUBLIC_ prefix or commit `.env`.

## Data model

- `movies`: TMDB ID, title, release date, poster path, runtime, metadata fetch timestamp. Unique `tmdbId`.
- `yearEntries`: movie ID, collection year, added timestamp. Unique `(year, movieId)`.
- `viewings`: year entry ID, `watchedOn` calendar date, creation timestamp. Indexed by year entry and date. Multiple records on the same date are allowed.

Watched status and counts are derived from viewing records for that year. Dates are calendar strings (`YYYY-MM-DD`), not midnight timestamps. Viewing dates must belong to the entry’s collection year. Removing the final viewing returns the movie to Unwatched. Removing a year entry also removes its viewing records, after an explicit UI confirmation; other years remain intact.

Movie metadata is cached locally and refreshed on collection access after 150 days. If refresh fails past six months, stale metadata is cleared while your year membership and viewing records are preserved. Posters use TMDB’s image CDN. TMDB attribution is in About & credits. Search uses only TMDB search data and a genre-ID mapping stored in MongoDB’s `metadata` collection (`tmdb-movie-genres-en-US`). This mapping survives cold starts, refreshes after 24 hours, and falls back to the saved mapping on refresh failure (retrying after five minutes, with a six-month maximum cache age). No per-result detail calls are made. Browser requests time out after 20 seconds with a retry message; details are cached in server memory for one hour (up to 200 movies). Full details include up to 12 cast members, runtime, a TMDB user score when votes exist, and a synopsis excerpt. Adding from either search view clears and refocuses the search field.

## Routes

- `GET /?year=2026` — collection, server-loaded
- `GET /?year=2026&view=history` — history grouped by day
- `GET /api/search?q=Halloween` — movie results with genres and TMDB user scores
- `GET /api/movies/:id` — synopsis, runtime, genres, up to 12 cast members, and TMDB user score
- `POST /api/entries` — `{ year, tmdbId }`
- `DELETE /api/entries/:id` — removes the entry and its viewings
- `POST /api/viewings` — `{ yearEntryId, watchedOn }`
- `PATCH /api/viewings/:id` — `{ watchedOn }`
- `DELETE /api/viewings/:id` — removes only that viewing

Writes require a matching Origin header. This is cross-origin request protection, not authentication: everyone who can access the app can edit.

## Checks

```sh
npm run check
npm test
npm run build
```

Browser smoke tests start an isolated **demo** server on port 5174, with separate data in `.data/browser-tests.json`. Your running app and Atlas data are not used:

```sh
npx playwright test
```

They use a temporary collection year and remove the entries they create. Install Playwright’s Chromium (`npx playwright install chromium`) if needed.

## Production on Vercel

The Vercel adapter builds Node.js functions with `npm run build`. Import `RonakR/CommuneMovieTracker` into Vercel using the SvelteKit preset and deploy `main` to production. GitHub pushes automatically deploy through the Vercel Git integration.

Set `DEMO_MODE=false`, `MONGODB_URI`, `MONGODB_DATABASE`, and `TMDB_READ_ACCESS_TOKEN` in Vercel's production environment settings. Credentials stay out of Git. Configure Atlas network access for the deployment. No custom `HOST`, `PORT`, `ORIGIN`, or start command is needed.

Movie data and the genre cache persist in MongoDB Atlas across function cold starts. The local demo JSON store is only for local development; use `npm run dev` or `npm run preview` locally.
