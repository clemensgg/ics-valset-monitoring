// src/tasks/tasks.js

import { 
    getConsensusState, 
    getConsensusValidators, 
    matchValidators 
} from '../utils/utils.js';

import db from '../db/db.js';

async function updateConsensusData(chainRpc) {
    const consensusState = await getConsensusState(chainRpc);
    const consensusValidators = await getConsensusValidators(chainRpc);

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
    matchValidators(consensusState, consensusValidators);
};

export { 
    updateConsensusData 
};
