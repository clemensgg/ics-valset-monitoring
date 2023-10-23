import { Worker } from 'worker_threads';
import { fileURLToPath } from 'url';
import path from 'path';

import { loadConfig } from './configLoader.js';
await loadConfig();

const currentFilePath = fileURLToPath(import.meta.url);
const workerFilePath = path.resolve(path.dirname(currentFilePath), './db/updateStakingDatabaseWorker.js');

function spawnWorker(workerFilePath) {
  const worker = new Worker(workerFilePath);

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

export const workers = Array.from({ length: global.CONFIG.NUM_WORKERS }, () => spawnWorker(workerFilePath));