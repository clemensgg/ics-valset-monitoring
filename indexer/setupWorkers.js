import { Worker } from 'worker_threads';
import { fileURLToPath } from 'url';
import path from 'path';

import { loadConfig } from './configLoader.js'
await loadConfig();

const currentFilePath = fileURLToPath(import.meta.url);
const workerFilePath = path.resolve(path.dirname(currentFilePath), './db/updateStakingDatabaseWorker.js');

function spawnWorker(workerFilePath) {
  const worker = new Worker(workerFilePath, {
    workerData: CONFIG
  });

  worker.on('message', (message) => {
    if (message === 'Done') {
      console.log('Chain and validator data updated.');
    } else if (message.startsWith('Error:')) {
      console.error(`Worker Error: ${message}`);
    }
  });

  worker.on('error', (error) => {
    console.error(`Worker Thread Error: ${error.message}`);
  });

  return worker;
}

const numberOfWorkers = global.CONFIG.NUM_WORKERS ?? 1;
export const workers = Array.from({ length: numberOfWorkers }, () => spawnWorker(workerFilePath, global.CONFIG));