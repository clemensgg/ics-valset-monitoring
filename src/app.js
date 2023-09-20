// src/main.js

import cron from 'node-cron';
import { updateConsensusData, matchStakingValidators } from './tasks';
import { validateConsumerRpcs, getConsumerChainInfos } from './utils';
import app from './server';
import db from './database';

const PROVIDER_RPC = "YOUR_PROVIDER_RPC_ENDPOINT";
const CONSUMER_RPCS = ["YOUR_CONSUMER_RPC_ENDPOINTS"];

// Initialize the database
db.serialize(() => {
    // ... (as previously provided)
});

// Validate consumer RPCs and get consumer chain info
const initialize = async () => {
    await validateConsumerRpcs(PROVIDER_RPC, CONSUMER_RPCS);
    await getConsumerChainInfos(PROVIDER_RPC);
};

initialize().then(() => {
    // Schedule tasks for consensus data
    cron.schedule('*/10 * * * *', () => {
        updateConsensusData(PROVIDER_RPC);
        CONSUMER_RPCS.forEach(rpc => updateConsensusData(rpc));
    });

    // Schedule tasks for staking validators (second worker thread)
    cron.schedule('0 0 * * *', () => {
        matchStakingValidators(PROVIDER_RPC, CONSUMER_RPCS);
    });
});

app.listen(3000, () => {
    console.log('Server is running on port 3000');
});
