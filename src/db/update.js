// src/db/update.js

import db from "./db.js";

async function updateConsensusData(consensusState, consensusValidators) {
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
};

export {
    updateConsensusData
}