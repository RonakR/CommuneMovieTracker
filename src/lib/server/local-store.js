import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { catalog } from './catalog.js';
import { addEntry } from './domain.js';

export function createLocalStore(path) {
  let queue = Promise.resolve();
  async function read() {
    try {
      return JSON.parse(await readFile(path, 'utf8'));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      const state = { movies: [], yearEntries: [], viewings: [] };
      for (const movie of catalog.slice(0, 7)) addEntry(state, new Date().getFullYear(), movie);
      return state;
    }
  }
  return {
    async read() {
      await queue;
      return read();
    },
    mutate(fn) {
      const task = queue.then(async () => {
        const state = await read();
        const result = fn(state);
        await mkdir(dirname(path), { recursive: true });
        await writeFile(`${path}.tmp`, JSON.stringify(state, null, 2));
        await rename(`${path}.tmp`, path);
        return result;
      });
      queue = task.catch(() => {});
      return task;
    }
  };
}
