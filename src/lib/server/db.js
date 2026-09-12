import { MongoClient } from 'mongodb';
import { env } from '$env/dynamic/private';
import { AppError } from './domain.js';

let connection;
export async function database() {
  if (!env.MONGODB_URI)
    throw new AppError(
      'Add your MongoDB Atlas connection string to .env and restart the server, or enable DEMO_MODE.',
      503
    );
  if (!connection) {
    connection = (async () => {
      const client = new MongoClient(env.MONGODB_URI, { serverSelectionTimeoutMS: 6000 });
      try {
        await client.connect();
        const db = client.db(env.MONGODB_DATABASE || 'commune_movie_tracker');
        await Promise.all([
          db.collection('movies').createIndex({ tmdbId: 1 }, { unique: true }),
          db.collection('yearEntries').createIndex({ year: 1, movieId: 1 }, { unique: true }),
          db.collection('viewings').createIndex({ yearEntryId: 1, watchedOn: -1 })
        ]);
        return { client, db };
      } catch (error) {
        await client.close();
        throw error;
      }
    })().catch(() => {
      connection = null;
      throw new AppError(
        'Could not connect to MongoDB. Check your connection string and Atlas network access, then retry.',
        503
      );
    });
  }
  return connection;
}
