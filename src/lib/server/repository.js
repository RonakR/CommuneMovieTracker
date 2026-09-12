import { database } from './db.js';
import { randomUUID } from 'node:crypto';
import { env } from '$env/dynamic/private';
import { resolve } from 'node:path';
import { createLocalStore } from './local-store.js';
import * as domain from './domain.js';
import { getMovie, isDemo } from './tmdb.js';

const local = createLocalStore(resolve(env.DEMO_DATA_FILE || '.data/demo.json'));
async function transaction(fn) {
  const { client, db } = await database();
  const session = client.startSession();
  try {
    return await session.withTransaction(() => fn(db, session));
  } finally {
    await session.endSession();
  }
}
export async function collection(yearValue) {
  const year = domain.parseYear(yearValue);
  if (isDemo()) return domain.projectCollection(await local.mutate((state) => state), year);
  const { db } = await database();
  const [yearEntries, years] = await Promise.all([
    db.collection('yearEntries').find({ year }).toArray(),
    db.collection('yearEntries').distinct('year')
  ]);
  const [movies, viewings] = await Promise.all([
    db
      .collection('movies')
      .find({ _id: { $in: yearEntries.map((e) => e.movieId) } })
      .toArray(),
    db
      .collection('viewings')
      .find({ yearEntryId: { $in: yearEntries.map((e) => e._id) } })
      .toArray()
  ]);
  let metadataWarning = false;
  const refreshBefore = Date.now() - 150 * 86400000;
  await Promise.all(
    movies.map(async (movie, index) => {
      if (new Date(movie.metadataFetchedAt).valueOf() > refreshBefore) return;
      try {
        const fresh = {
          ...(await getMovie(movie.tmdbId)),
          metadataFetchedAt: new Date().toISOString()
        };
        await db.collection('movies').updateOne({ _id: movie._id }, { $set: fresh });
        movies[index] = { ...movie, ...fresh };
      } catch {
        metadataWarning = true;
        // Do not continue serving provider metadata past its cache lifetime.
        const cutoff = new Date();
        cutoff.setMonth(cutoff.getMonth() - 6);
        if (!movie.metadataFetchedAt || new Date(movie.metadataFetchedAt) <= cutoff) {
          await db
            .collection('movies')
            .updateOne(
              { _id: movie._id },
              { $unset: { title: '', posterPath: '', releaseDate: '', runtimeMinutes: '' } }
            );
          movies[index] = {
            _id: movie._id,
            tmdbId: movie.tmdbId,
            title: 'Movie details unavailable',
            posterPath: null
          };
        }
      }
    })
  );
  const result = domain.projectCollection({ movies, yearEntries, viewings }, year);
  return {
    ...result,
    years: [...new Set([...result.years, ...years])].sort((a, b) => b - a),
    metadataWarning
  };
}
export async function createEntry(yearValue, tmdbId) {
  const year = domain.parseYear(yearValue);
  const movie = await getMovie(tmdbId);
  if (isDemo()) return local.mutate((state) => domain.addEntry(state, year, movie));
  const { db } = await database();
  const movieId = String(movie.tmdbId);
  await db
    .collection('movies')
    .updateOne(
      { _id: movieId },
      { $set: { ...movie, metadataFetchedAt: new Date().toISOString() } },
      { upsert: true }
    );
  const entry = { _id: randomUUID(), year, movieId, addedAt: new Date().toISOString() };
  try {
    await db.collection('yearEntries').insertOne(entry);
    return { entry, alreadyAdded: false };
  } catch (error) {
    if (error.code !== 11000) throw error;
    return {
      entry: await db.collection('yearEntries').findOne({ year, movieId }),
      alreadyAdded: true
    };
  }
}
export async function createViewing(yearEntryId, watchedOn) {
  if (typeof yearEntryId !== 'string' || !/^[a-f0-9-]{36}$/.test(yearEntryId))
    throw new domain.AppError('Choose a valid movie entry.');
  if (isDemo()) return local.mutate((state) => domain.addViewing(state, yearEntryId, watchedOn));
  return transaction(async (db, session) => {
    // Touch the parent inside the transaction, serializing against removal.
    const entry = await db
      .collection('yearEntries')
      .findOneAndUpdate(
        { _id: yearEntryId },
        { $inc: { revision: 1 } },
        { session, returnDocument: 'after' }
      );
    if (!entry) throw new domain.AppError('Movie not found.', 404);
    domain.validateViewingDate(watchedOn, entry.year);
    const viewing = {
      _id: randomUUID(),
      yearEntryId,
      watchedOn,
      createdAt: new Date().toISOString()
    };
    await db.collection('viewings').insertOne(viewing, { session });
    return viewing;
  });
}
export async function updateViewing(id, watchedOn) {
  if (isDemo()) return local.mutate((state) => domain.editViewing(state, id, watchedOn));
  return transaction(async (db, session) => {
    const viewing = await db.collection('viewings').findOne({ _id: id }, { session });
    if (!viewing) throw new domain.AppError('Viewing not found.', 404);
    const entry = await db
      .collection('yearEntries')
      .findOneAndUpdate(
        { _id: viewing.yearEntryId },
        { $inc: { revision: 1 } },
        { session, returnDocument: 'after' }
      );
    if (!entry) throw new domain.AppError('Movie not found.', 404);
    domain.validateViewingDate(watchedOn, entry.year);
    await db.collection('viewings').updateOne({ _id: id }, { $set: { watchedOn } }, { session });
    return { ...viewing, watchedOn };
  });
}
export async function deleteViewing(id) {
  if (isDemo()) return local.mutate((state) => domain.removeViewing(state, id));
  const { db } = await database();
  const result = await db.collection('viewings').deleteOne({ _id: id });
  if (!result.deletedCount) throw new domain.AppError('Viewing not found.', 404);
}
export async function deleteEntry(id) {
  if (isDemo()) return local.mutate((state) => domain.removeEntry(state, id));
  return transaction(async (db, session) => {
    const result = await db.collection('yearEntries').deleteOne({ _id: id }, { session });
    if (!result.deletedCount) throw new domain.AppError('Movie not found.', 404);
    await db.collection('viewings').deleteMany({ yearEntryId: id }, { session });
  });
}
