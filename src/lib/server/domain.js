import { randomUUID } from 'node:crypto';
import { validDate } from '../dates.js';

export class AppError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
export function parseYear(value) {
  const year = Number(value);
  if (!/^\d{4}$/.test(String(value)) || year < 1900 || year > 2200)
    throw new AppError('Choose a year between 1900 and 2200.');
  return year;
}
export function validateViewingDate(date, year) {
  if (!validDate(date)) throw new AppError('Choose a valid viewing date.');
  if (Number(date.slice(0, 4)) !== year)
    throw new AppError(`Choose a date in ${year}, the year of this collection.`);
}
export function addEntry(state, yearValue, movie) {
  const year = parseYear(yearValue);
  let entry = state.yearEntries.find((e) => e.year === year && e.movieId === String(movie.tmdbId));
  if (entry) return { entry, alreadyAdded: true };
  const metadata = {
    ...movie,
    _id: String(movie.tmdbId),
    metadataFetchedAt: new Date().toISOString()
  };
  const index = state.movies.findIndex((m) => m._id === metadata._id);
  if (index >= 0) state.movies[index] = metadata;
  else state.movies.push(metadata);
  entry = { _id: randomUUID(), year, movieId: metadata._id, addedAt: new Date().toISOString() };
  state.yearEntries.push(entry);
  return { entry, alreadyAdded: false };
}
export function addViewing(state, yearEntryId, watchedOn) {
  const entry = state.yearEntries.find((e) => e._id === yearEntryId);
  if (!entry) throw new AppError('This movie is no longer in the collection.', 404);
  validateViewingDate(watchedOn, entry.year);
  const viewing = {
    _id: randomUUID(),
    yearEntryId,
    watchedOn,
    createdAt: new Date().toISOString()
  };
  state.viewings.push(viewing);
  return viewing;
}
export function editViewing(state, id, watchedOn) {
  const viewing = state.viewings.find((v) => v._id === id);
  if (!viewing) throw new AppError('Viewing not found.', 404);
  const entry = state.yearEntries.find((e) => e._id === viewing.yearEntryId);
  if (!entry) throw new AppError('Movie not found.', 404);
  validateViewingDate(watchedOn, entry.year);
  viewing.watchedOn = watchedOn;
  return viewing;
}
export function removeViewing(state, id) {
  if (!state.viewings.some((v) => v._id === id)) throw new AppError('Viewing not found.', 404);
  state.viewings = state.viewings.filter((v) => v._id !== id);
}
export function removeEntry(state, id) {
  if (!state.yearEntries.some((e) => e._id === id)) throw new AppError('Movie not found.', 404);
  state.yearEntries = state.yearEntries.filter((e) => e._id !== id);
  state.viewings = state.viewings.filter((v) => v.yearEntryId !== id);
}
export function projectCollection(state, year) {
  const entries = state.yearEntries
    .filter((e) => e.year === year)
    .map((e) => ({
      ...e,
      movie: state.movies.find((m) => m._id === e.movieId),
      viewings: state.viewings
        .filter((v) => v.yearEntryId === e._id)
        .sort(
          (a, b) => b.watchedOn.localeCompare(a.watchedOn) || b.createdAt.localeCompare(a.createdAt)
        )
    }))
    .filter((e) => e.movie)
    .sort((a, b) => a.addedAt.localeCompare(b.addedAt));
  return {
    year,
    years: [
      ...new Set([year, new Date().getFullYear(), ...state.yearEntries.map((e) => e.year)])
    ].sort((a, b) => b - a),
    entries
  };
}
