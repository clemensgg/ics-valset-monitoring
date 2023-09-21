// src/main.js

// import cron from 'node-cron';

import { updateConsensusData } from './db/update.js';
import { 
    validateConsumerRpcs,
    getProviderChainInfos,
    getConsensusState,
    getConsensusValidators,
    getStakingValidators,
    matchValidators,
 } from './utils/utils.js';

import app from './server.js';

const PROVIDER_RPC = "http://148.251.183.254:2012";
const PROVIDER_REST = "http://162.55.92.114:2011"
const CONSUMER_RPCS = ["http://148.251.183.254:2102", "http://148.251.183.254:2202"];

async function main() {
    console.log('starting ics-valset-monitoring');

    let consumerChainInfos = await validateConsumerRpcs(PROVIDER_RPC, CONSUMER_RPCS);
    let providerChainInfos = await getProviderChainInfos(PROVIDER_RPC);
    let stakingValidators = await getStakingValidators(PROVIDER_REST);

    console.log(JSON.stringify(consumerChainInfos));
    console.log(JSON.stringify(providerChainInfos));
    console.log(JSON.stringify(stakingValidators));

    let allChainIds = consumerChainInfos.map(chain => chain.chainId);

    for (let chain of consumerChainInfos) {
        console.log(`Processing consumer chain with ID: ${chain.chainId}`);

        const consensusState = await getConsensusState(chain.rpcEndpoint);
        const consensusValidators = await getConsensusValidators(chain.rpcEndpoint);
        const consensusData = await updateConsensusData(consensusState, consensusValidators);
        const matchedValidators = await matchValidators(stakingValidators, consensusValidators, PROVIDER_RPC, allChainIds, 'cosmos');

        console.log(`Matched ${matchedValidators.length} validators for chain ${chain.chainId}`);
        console.log(JSON.stringify(matchedValidators));
        console.log(JSON.stringify(consensusData));
        console.log(JSON.stringify("-------------------------------------------------"));
    }

    console.log('ics-valset-monitoring completed');
}


main().then(
   console.log('done')
);