// src/main.js

import cron from 'node-cron';

import { updateConsensusData } from './tasks/tasks.js';
import { 
    validateConsumerRpcs,
    getConsensusState,
    getConsensusValidators
 } from './utils/utils.js';
import app from './server.js';

const PROVIDER_RPC = "YOUR_PROVIDER_RPC_ENDPOINT";
const CONSUMER_RPCS = ["YOUR_CONSUMER_RPC_ENDPOINTS"];

// Validate consumer RPCs
validateConsumerRpcs(PROVIDER_RPC, CONSUMER_RPCS);

// Schedule tasks
cron.schedule('*/10 * * * *', () => {
    updateConsensusData(PROVIDER_RPC);
    CONSUMER_RPCS.forEach(rpc => updateConsensusData(rpc));
});