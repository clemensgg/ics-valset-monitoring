// src/tasks/tasks.js

import { 
    fetchConsensusState, 
    fetchConsensusValidators, 
    matchData 
} from './utils';

import db from './database';

async function updateConsensusData(chainRpc) {
    const consensusState = await fetchConsensusState(chainRpc);
    const consensusValidators = await fetchConsensusValidators(chainRpc);

    // Save to database
    db.run(`INSERT INTO consensusState (
        chainId, 
        height, 
        timestamp, 
        validators
    ) VALUES (
        ?, 
        ?, 
        ?, 
        ?
    )`, [
        consensusState.chainId, 
        consensusState.height, 
        consensusState.timestamp, 
        JSON.stringify(consensusState.validators)
    ]);
    
    db.run(`INSERT INTO consensusValidators (
        chainId, 
        height, 
        validators
    ) VALUES (
        ?, 
        ?, 
        ?
    )`, [
        consensusValidators.chainId, 
        consensusValidators.height, 
        JSON.stringify(consensusValidators.validators)
    ]);

    // Match data (if necessary)
    matchData(consensusState, consensusValidators);
};

export { 
    updateConsensusData 
};
