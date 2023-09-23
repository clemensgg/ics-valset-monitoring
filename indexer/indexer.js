import db from './db/db.js';
import {
  getChainInfosFromDB,
  getStakingValidatorsFromDB,
  saveChainInfos,
  saveStakingValidators,
  updateConsensusStateDB
} from './db/update.js';
import { ConsumerChainInfo, ProviderChainInfo } from '../src/models/ChainInfo.js';
import { StakingValidators } from '../src/models/StakingValidators.js';
import {
  fetchConsumerSigningKeys,
  getConsensusState,
  getProviderChainInfos,
  getStakingValidators,
  validateConsumerRpcs
} from './utils/utils.js';

// Mainnet Endpoints
//
// const PROVIDER_RPC = 'http://5.9.72.212:2001';
const PROVIDER_RPC = 'http://162.55.92.114:2012';
const PROVIDER_REST = 'http://162.55.92.114:2011';
const CONSUMER_RPCS = ['http://148.251.183.254:2102', 'http://148.251.183.254:2202'];

// RS Testnet Endpoints
//
// const PROVIDER_RPC = "http://65.108.127.249:2001";
// const PROVIDER_REST = "http://65.108.127.249:2004"
// const CONSUMER_RPCS = ["https://rpc-palvus.pion-1.ntrn.tech:443"];

const RPC_DELAY_MS = 45;
const UPDATE_DB_FREQUENCY_MS = 600000;
const CONSENSUS_POLL_FREQENCY_MS = 500;
const PREFIX = 'cosmos';

async function validateRPCEndpoints() {
  const providerChainInfos = await getProviderChainInfos(PROVIDER_RPC);
  const consumerChainInfos = await validateConsumerRpcs(PROVIDER_RPC,
    CONSUMER_RPCS);

  if (providerChainInfos && providerChainInfos.chainId != '') {
    await saveChainInfos([providerChainInfos],
      'provider');
    console.log('[DB] updated ChainInfos for provider chain.');
  }
  if (consumerChainInfos && consumerChainInfos.length > 0) {
    await saveChainInfos(consumerChainInfos,
      'consumer');
    console.log('[DB] updated ChainInfos for consumerChains.');
  }
  return [providerChainInfos, consumerChainInfos];
}

async function updateDatabaseData () {
  console.log('Updating database data...');

  let [providerChainInfos, consumerChainInfos] = await validateRPCEndpoints();

  const stakingValidators = await getStakingValidators(PROVIDER_REST);
  if (providerChainInfos && providerChainInfos.chainId != '' && consumerChainInfos && consumerChainInfos.length > 0 && stakingValidators && stakingValidators.length > 0) {
    const allChainIds = consumerChainInfos.map(chain => chain.chainId);
    const stakingValidatorsWithSigningKeys = await fetchConsumerSigningKeys(stakingValidators,
      PROVIDER_RPC,
      allChainIds,
      PREFIX,
      RPC_DELAY_MS);

    await saveStakingValidators(stakingValidatorsWithSigningKeys);

    console.log('[DB] updated stakingValidators.');
  } else {
    console.warn('[DB] Error updating stakingValidators!');
  }
}

async function pollConsensus (chains) {
  console.time('pollConsensus Execution Time');
  for (const chain of chains) {
    console.time('updateConsensusState Execution Time');
    console.log(`Processing ${chain.type} chain with ID: ${chain.chainId}`);
    const consensusState = await getConsensusState(chain.rpcEndpoint,
      chain.chainId);
    console.log("Consensus State for " + chain.chainId, consensusState);
    if (consensusState) {

    /* ---> this needs to go in querier
    const matchedValidators = await matchConsensusValidators(
      stakingValidators.validators,
      consensusState,
      chain.chainId,
      chain.type,
      PREFIX);
    const matchedLastValidators = await matchConsensusLastValidators(
      stakingValidators.validators,
      consensusState,
      chain.chainId,
      chain.type,
      PREFIX);

    chain.matchedValidators = matchedValidators;
    chain.matchedLastValidators = matchedLastValidators;
    */
    
      await updateConsensusStateDB(consensusState);
      console.log(`[DB] updated consensusState for chain ${chain.chainId}`);
      console.timeEnd('updateConsensusState Execution Time');
    }
  }
  console.log('------------------------------------------------------------');
  console.timeEnd('pollConsensus Execution Time');
  console.log('------------------------------------------------------------');
}

function startConsensusPolling (chains, stakingValidators) {
  const startTime = Date.now();

  pollConsensus(chains,
    stakingValidators)
    .then(() => {
      const endTime = Date.now();
      const executionTime = endTime - startTime;

      // Calculate the delay for the next execution
      const delay = executionTime > CONSENSUS_POLL_FREQENCY_MS ? 0 : CONSENSUS_POLL_FREQENCY_MS - executionTime;

      setTimeout(() => startConsensusPolling(chains,
        stakingValidators),
      delay);
    })
    .catch(error => {
      console.error('Error during monitoring:',
        error);
      // Even if there's an error, we'll try to restart the monitoring after CONSENSUS_POLL_FREQENCY_MS
      setTimeout(() => startConsensusPolling(chains,
        stakingValidators),
      CONSENSUS_POLL_FREQENCY_MS);
    });
}
async function main () {
  console.log('starting ics-valset-monitoring');

  await validateRPCEndpoints();

  let providerChainInfos;
  let consumerChainInfos;
  let stakingValidators;

  try {
    providerChainInfos = await getChainInfosFromDB('provider');
    console.log('[DB] loaded ' + providerChainInfos.length + ' providerChains');
    consumerChainInfos = await getChainInfosFromDB('consumer');
    console.log('[DB] loaded ' + consumerChainInfos.length + ' consumerChains');
    stakingValidators = await getStakingValidatorsFromDB();
    if (stakingValidators.hasOwnProperty('validators')) {
      console.log('[DB] loaded ' + stakingValidators.validators.length + ' stakingValidators');
    } else {
      console.log('[DB] loaded 0 stakingValidators');
    }
  } catch (error) {
    console.error('[DB] Error fetching data:',
      error);
  }

  if (!consumerChainInfos || !providerChainInfos || !stakingValidators || consumerChainInfos.length === 0 || providerChainInfos.length === 0 || stakingValidators.length === 0) {
    console.log('running STARTUP...');
    await updateDatabaseData();
    setInterval(updateDatabaseData,
      UPDATE_DB_FREQUENCY_MS);
    providerChainInfos = await getChainInfosFromDB('provider');
    console.log('[DB] loaded ' + providerChainInfos.length + ' providerChains');
    consumerChainInfos = await getChainInfosFromDB('consumer');
    console.log('[DB] loaded ' + consumerChainInfos.length + ' consumerChains');
    stakingValidators = await getStakingValidatorsFromDB();
    if (stakingValidators.hasOwnProperty('validators')) {
      console.log('[DB] loaded ' + stakingValidators.validators.length + ' stakingValidators');
    } else {
      console.log('[DB] loaded 0 stakingValidators');
    }
  } else {
    setTimeout(() => {
      setInterval(updateDatabaseData,
        UPDATE_DB_FREQUENCY_MS);
    },
    UPDATE_DB_FREQUENCY_MS);
  }

  providerChainInfos = new ProviderChainInfo(providerChainInfos[0]);
  stakingValidators = new StakingValidators(stakingValidators.validators);

  const chains = [providerChainInfos];
  consumerChainInfos.forEach((chain) => {
    chains.push(new ConsumerChainInfo(chain));
  });

  console.log(JSON.stringify(chains));

  startConsensusPolling(chains,
    stakingValidators);
}

main();

process.on('uncaughtException',
  (err) => {
    console.error('Uncaught error: ',
      err);
    process.exit(1);
  });

process.on('exit',
  (code) => {
    db.close((err) => {
      if (err) {
        console.error(err.message);
      }
      console.log('Closed the database connection.');
    });
  });
