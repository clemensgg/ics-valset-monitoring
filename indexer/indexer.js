
// Import statements
import { updateConsensusStateDB,
  initializeData,
  prepareChains,
  validateEndpointsAndSaveChains,
  updateStakingValidatorsDB
} from './db/update.js';
import { getConsensusState } from './utils/utils.js';

import { Worker } from 'worker_threads';
import { fileURLToPath } from 'url';
import path from 'path';

import { CONFIG } from './config.js'

// Init Workers
const currentFilePath = fileURLToPath(import.meta.url);
const workerFilePath = path.resolve(path.dirname(currentFilePath), './db/updateStakingDatabaseWorker.js');

const updateStakingDatabaseWorker = new Worker(workerFilePath);

updateStakingDatabaseWorker.on('message', (message) => {
  if (message === 'Done') {
    console.log('Database update completed');
  } else if (message.startsWith('Error:')) {
    console.error(`Worker Error: ${message}`);
  }
});

updateStakingDatabaseWorker.on('error', (error) => {
  console.error(`Worker Thread Error: ${error.message}`);
});

async function startupRoutine() {
  console.log('Running startup routine...');
  const [providerChainInfos, consumerChainInfos] = await validateEndpointsAndSaveChains();
  await updateStakingValidatorsDB(providerChainInfos, consumerChainInfos);
  console.log('Startup routine completed.');
  return true;
}

// Update Chain and Validator Data
async function updateChainAndValidatorData() {
  setInterval(async () => {
    console.log('Updating chain and validator data...');
    updateStakingDatabaseWorker.postMessage('updateStakingValidatorsDB');
    console.log('Chain and validator data updated.');
  }, CONFIG.UPDATE_DB_FREQUENCY_MS);
}

// Monitor Consensus State
async function consensusStateMonitor(chains, stakingValidators) {
  while (true) {
    console.log('Monitoring consensus state...');
    await pollConsensus(chains, stakingValidators);
    console.log('Consensus state monitored.');
  }
}

// Main Function
async function main() {
  console.log('Starting ics-valset-monitoring');

  // Initialize Data
  let [providerChainInfos, consumerChainInfos, stakingValidators] = await initializeData();

  if (providerChainInfos.length === 0 || consumerChainInfos.length === 0 || stakingValidators.hasOwnProperty('validators') !== true || stakingValidators.validators.length === 0) {
    // Startup Routine
    await startupRoutine();
    // Re-initialize ChainInfos from DB after Startup
    [providerChainInfos, consumerChainInfos, stakingValidators] = await initializeData();
  }

  // Update Chain and Validator Data
  updateChainAndValidatorData();

  // Monitor Consensus State
  const chains = prepareChains(providerChainInfos, consumerChainInfos);
  consensusStateMonitor(chains, stakingValidators);
}

// Poll Consensus
async function pollConsensus(chains) {
  for (const chain of chains) {
    console.time(`[${chain.chainId}] pollConsensus Execution Time`);
    const consensusState = await getConsensusState(chain.rpcEndpoint, chain.chainId);
    
    if (consensusState) {
      await updateConsensusStateDB(consensusState, CONFIG.RETAIN_STATES);
      console.log(`Updated consensusState for chain ${chain.chainId}`);
    } else {
      console.warn(`Error updating consensusState for chain ${chain.chainId}`);
    }
    console.timeEnd(`[${chain.chainId}] pollConsensus Execution Time`);
  }
}

// Main function error handling
main().catch((err) => {
  console.error('Uncaught error:', err);
  process.exit(1);
});
