import { updateConsensusStateDB,
  initializeData,
  prepareChains,
  validateEndpointsAndSaveChains,
  updateStakingValidatorsDB
} from './db/update.js';
import { initializeDb } from './db/db.js';
import { getConsensusState } from './utils/utils.js';
import { workers } from './setupWorkers.js'
import { loadConfig } from './configLoader.js';
import { initializeTriggerClient } from './middleware/trigger.js';

async function updateChainAndValidatorData() {
  setInterval(() => {
    console.log('Updating chain and validator data...');
    workers.forEach((worker) => {
      worker.postMessage('updateStakingValidatorsDB');
    });
  }, global.CONFIG.UPDATE_DB_FREQUENCY_MS);
}

async function startupRoutine() {
  console.log('Running startup routine...');
  const [providerChainInfos, consumerChainInfos] = await validateEndpointsAndSaveChains();
  await updateStakingValidatorsDB(providerChainInfos, consumerChainInfos);
  console.log('Startup routine completed.');
  return true;
}

// Monitor Consensus State
async function consensusStateMonitor(chains, stakingValidators) {
  while (true) {
    await pollConsensus(chains, stakingValidators);
  }
}

// Main Function
async function main() {
  await loadConfig();
  console.log(JSON.stringify(CONFIG));
  await initializeDb(CONFIG);
  await initializeTriggerClient();
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
      await updateConsensusStateDB(consensusState, global.CONFIG.RETAIN_STATES);
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


