import {
  getChainInfosFromDB,
  getMatchedValidatorsFromDB,
  getStakingValidatorsFromDB,
  saveChainInfos,
  saveMatchedValidators,
  saveStakingValidators
} from './db/update.js';
import {
  fetchConsumerSigningKeys,
  getConsensusState,
  getProviderChainInfos,
  getStakingValidators,
  matchConsensusValidators,
  matchConsensusLastValidators,
  sleep,
  validateConsumerRpcs
} from './utils/utils.js';

import { ConsensusState } from './models/ConsensusState.js';
import { ConsumerChainInfo, ProviderChainInfo } from './models/ChainInfo.js';
import { StakingValidators } from './models/StakingValidators.js';

import db from './db/db.js';

import app from './server.js';

// Mainnet Endpoints
//
const PROVIDER_RPC = 'http://5.9.72.212:2001';
const PROVIDER_REST = 'http://162.55.92.114:2011';
const CONSUMER_RPCS = ['http://148.251.183.254:2102', 'http://148.251.183.254:2202'];

// RS Testnet Endpoints
//
// const PROVIDER_RPC = "http://65.108.127.249:2001";
// const PROVIDER_REST = "http://65.108.127.249:2004"
// const CONSUMER_RPCS = ["https://rpc-palvus.pion-1.ntrn.tech:443"];

const RPC_DELAY = 45;
const UPDATE_DATABASE_FREQUENCY = 600000;
const PREFIX = 'cosmos';

async function updateDatabaseData () {
  console.log('Updating database data...');

  const consumerChainInfos = await validateConsumerRpcs(PROVIDER_RPC,
    CONSUMER_RPCS);
  const providerChainInfos = await getProviderChainInfos(PROVIDER_RPC);

  await saveChainInfos(consumerChainInfos,
    'consumer');
  await saveChainInfos([providerChainInfos],
    'provider');

  const stakingValidators = await getStakingValidators(PROVIDER_REST);

  const allChainIds = consumerChainInfos.map(chain => chain.chainId);
  const stakingValidatorsWithSigningKeys = await fetchConsumerSigningKeys(stakingValidators,
    PROVIDER_RPC,
    allChainIds,
    PREFIX,
    RPC_DELAY);

  await saveStakingValidators(stakingValidatorsWithSigningKeys);

  console.log('Database data updated.');
}

async function main () {
  console.time("Main Execution Time");
  console.log('starting ics-valset-monitoring');

  // Load the necessary data from the database
  let providerChainInfos;
  let consumerChainInfos;
  let stakingValidators;

  try {
    providerChainInfos = await getChainInfosFromDB('provider');
    console.log("loaded " + providerChainInfos.length + "providerChains");
    consumerChainInfos = await getChainInfosFromDB('consumer');
    console.log("loaded " + consumerChainInfos.length + "consumerChains");
    stakingValidators = await getStakingValidatorsFromDB();
    console.log("loaded " + stakingValidators.length + "stakingValidators");
  } catch (error) {
    console.error("Error fetching data:", error);
  }  
   
  if (!consumerChainInfos || !providerChainInfos || !stakingValidators || consumerChainInfos.length === 0 || providerChainInfos.length === 0 || stakingValidators.length === 0) {
    console.log('running STARTUP...');
    await updateDatabaseData();
    setInterval(updateDatabaseData,
      UPDATE_DATABASE_FREQUENCY);
    consumerChainInfos = await getChainInfosFromDB('consumer');
    providerChainInfos = await getChainInfosFromDB('provider');
    stakingValidators = await getStakingValidatorsFromDB();
  } else {
    sleep(UPDATE_DATABASE_FREQUENCY);
    setInterval(updateDatabaseData,
      UPDATE_DATABASE_FREQUENCY);
  }

  providerChainInfos = new ProviderChainInfo(providerChainInfos[0]);  
  stakingValidators = new StakingValidators(stakingValidators.validators);

  let chains = [providerChainInfos];
  consumerChainInfos.forEach((chain) => {
    chains.push(
      new ConsumerChainInfo(chain)
    )
  });

  console.log(JSON.stringify(chains));

  for (const chain of chains) {
    console.log(JSON.stringify('-------------------------------------------------'));
    console.log(`Processing ${chain.type} chain with ID: ${chain.chainId}`);
    const consensusState = await getConsensusState(chain.rpcEndpoint, chain.chainId);
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

//    await saveMatchedValidators(matchedValidators);
//    await saveMatchedValidators(matchedLastValidators);
  }

  chains.forEach((chain) => {
//    console.log(JSON.stringify('-------------------------------------------------'));
//    console.log(JSON.stringify(matchedValidators));
//    console.log(JSON.stringify('-------------------------------------------------'));
//    console.log(JSON.stringify(matchedLastValidators));
    console.log(JSON.stringify('-------------------------------------------------'));
    console.log(`Matched ${chain.matchedValidators.length} validators for chain ${chain.chainId}`);
    console.log(`Matched ${chain.matchedLastValidators.length} lastValidators for chain ${chain.chainId}`);
  });
  console.log(JSON.stringify('-------------------------------------------------'));
  console.timeEnd("Main Execution Time");
}

main().then(
  console.log('done')
);

process.on('uncaughtException', (err) => {
  console.error('There was an uncaught error', err);
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


