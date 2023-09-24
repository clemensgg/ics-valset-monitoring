// src/db/update.js

import { ConsumerChainInfo, ProviderChainInfo } from '../../src/models/ChainInfo.js';
import {
  ConsensusState,
  Peer,
  PeerState,
  RoundState,
  Validators,
  Validator
} from '../../src/models/ConsensusState.js';
import { StakingValidators } from '../../src/models/StakingValidators.js';

import {
  queryDatabase,
  runDatabaseQuery
} from './db.js';

async function saveStakingValidators (stakingValidators) {
  console.log('Saving stakingValidators to DB:',
    stakingValidators);

  try {
    // First, insert into StakingValidatorsMeta table
    const metaQuery = 'INSERT INTO StakingValidatorsMeta (timestamp, created_at, updated_at) VALUES (?, ?, ?)';
    const metaParams = [stakingValidators.timestamp, stakingValidators.created_at, stakingValidators.updated_at];
    const metaResult = await runDatabaseQuery(metaQuery,
      metaParams);

    console.log('Inserted into StakingValidatorsMeta with ID:',
      metaResult);

    // Now, insert each validator into StakingValidator table
    const validatorQuery = `
          INSERT INTO StakingValidator (
              stakingValidatorsMetaId, 
              operator_address, 
              consensus_pubkey_type, 
              consensus_pubkey_key, 
              consumer_signing_keys,
              jailed, status, tokens, delegator_shares, moniker, 
              identity, website, security_contact, details, 
              unbonding_height, unbonding_time, commission_rate, 
              commission_max_rate, commission_max_change_rate, 
              min_self_delegation
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

    for (const validator of stakingValidators.validators) {
      const validatorParams = [
        metaResult,
        validator.operator_address,
        validator.consensus_pubkey.type,
        validator.consensus_pubkey.key,
        JSON.stringify(validator.consumer_signing_keys),
        validator.jailed,
        validator.status,
        validator.tokens,
        validator.delegator_shares,
        validator.description.moniker,
        validator.description.identity,
        validator.description.website,
        validator.description.security_contact,
        validator.description.details,
        validator.unbonding_height,
        validator.unbonding_time,
        validator.commission.commission_rates.rate,
        validator.commission.commission_rates.max_rate,
        validator.commission.commission_rates.max_change_rate,
        validator.min_self_delegation
      ];
      await runDatabaseQuery(validatorQuery,
        validatorParams);
    }

    console.log('All validators inserted successfully.');
  } catch (error) {
    console.error('Error saving stakingValidators to DB:',
      error);
  }
}

async function getStakingValidatorsFromDB () {
  try {
    // Get the latest StakingValidatorsMeta entry
    const metaRow = await queryDatabase('SELECT * FROM StakingValidatorsMeta ORDER BY id DESC LIMIT 1');

    if (!metaRow) {
      return [];
    }

    // Get all StakingValidator entries associated with the latest meta entry
    const validatorRows = await queryDatabase('SELECT * FROM StakingValidator WHERE stakingValidatorsMetaId = ?',
      [metaRow.id],
      true);

    const result = {
      timestamp: metaRow.timestamp,
      validators: validatorRows
    };

    result.validators.forEach((validator) => {
      validator.consensus_pubkey = {
        '@type': validator.consensus_pubkey_type,
        key: validator.consensus_pubkey_key
      };
      validator.description = {
        moniker: validator.moniker,
        identity: validator.identity,
        website: validator.website,
        security_contact: validator.security_contact,
        details: validator.details
      };
      validator.commission = {
        commission_rates: {
          rate: validator.commission_rate,
          max_rate: validator.commission_max_rate,
          max_change_rate: validator.commission_max_change_rate
        },
        update_time: validator.commission_update_time || null
      };
    });

    return result;
  } catch (error) {
    console.error('Error fetching stakingValidators from DB:',
      error);
    throw error;
  }
}

async function saveMatchedValidators (matchedValidators) {
  console.log('Saving matchedValidators to DB:',
    matchedValidators);

  try {
    // Insert into MatchedValidators table
    const matchedQuery = 'INSERT INTO MatchedValidators (chainId, timestamp, created_at, updated_at) VALUES (?, ?, ?, ?)';
    const matchedParams = [matchedValidators.chainId, matchedValidators.timestamp, new Date().toISOString(), new Date().toISOString()];
    const matchedId = await runDatabaseQuery(matchedQuery,
      matchedParams); // ID of the last inserted row

    // Now, insert each validator into MatchedValidatorDetail table
    const detailQuery = 'INSERT INTO MatchedValidatorDetail (matchedValidatorsId, operator_address, consensus_address) VALUES (?, ?, ?)';
    for (const validator of matchedValidators.validators) {
      const detailParams = [matchedId, validator.operator_address, validator.consensus_address];
      await runDatabaseQuery(detailQuery,
        detailParams);
    }

    console.log('All matched validators inserted successfully.');
  } catch (error) {
    console.error('Error saving matchedValidators to DB:',
      error);
    throw error;
  }
}

async function getMatchedValidatorsFromDB () {
  try {
    // Get the latest MatchedValidators entry
    const matchedRow = await queryDatabase('SELECT * FROM MatchedValidators ORDER BY id DESC LIMIT 1');

    if (!matchedRow) {
      return null;
    }

    // Get all MatchedValidatorDetail entries associated with the latest matched entry
    const validatorRows = await queryDatabase('SELECT * FROM MatchedValidatorDetail WHERE matchedValidatorsId = ?',
      [matchedRow.id],
      true);

    const result = {
      chainId: matchedRow.chainId,
      timestamp: matchedRow.timestamp,
      validators: validatorRows
    };

    return result;
  } catch (error) {
    console.error('Error fetching matchedValidators from DB:',
      error);
    throw error;
  }
}

async function saveChainInfos (chainInfos, type) {
  console.log(`Saving ${type}ChainInfos to DB:`,
    chainInfos);

  try {
    const insertQuery = 'INSERT OR REPLACE INTO ChainInfo (chainId, rpcEndpoint, type, clientIds) VALUES (?, ?, ?, ?)';

    for (const info of chainInfos) {
      // Convert clientIds array to a JSON string for storage
      const clientIdsString = JSON.stringify(info.clientIds);
      const params = [info.chainId, info.rpcEndpoint, type, clientIdsString];
      await runDatabaseQuery(insertQuery,
        params);
      console.log(`Successfully inserted ${type}ChainInfo with chainId ${info.chainId}`);
    }

    console.log('All chainInfos inserted successfully.');
  } catch (error) {
    console.error(`Error saving ${type}ChainInfos to DB:`,
      error);
    throw error;
  }
}

async function getChainInfosFromDB (type) {
  try {
    const rows = await queryDatabase('SELECT * FROM ChainInfo WHERE type = ?',
      [type],
      true);
    return rows;
  } catch (error) {
    console.error('DB Error:',
      error);
    throw error;
  }
}

/// ///////////////////////////////////// TODO

async function updateConsensusStateDB (consensusState) {
  console.log('updateConsensusStateDB called with consensusState:',
    consensusState);
  try {
    console.log('Starting DB Transaction...');
    await runDatabaseQuery('BEGIN TRANSACTION');
    console.log('Started DB Transaction.');

    let roundStateId;
    try {
      roundStateId = await saveRoundState(consensusState.round_state);
      console.log('[DEBUG] RoundStateId for chain',
        consensusState.chainId,
        ':',
        roundStateId);
    } catch (err) {
      console.error('Error in saveRoundState:',
        err);
      throw err;
    }

    const query = `
          INSERT INTO ConsensusState (chainId, timestamp, round_stateId)
          VALUES (?, ?, ?);
      `;
    const params = [
      consensusState.chainId,
      consensusState.timestamp,
      roundStateId
    ];

    console.log('Inserting into ConsensusState...');
    await runDatabaseQuery(query,
      params);
    console.log('Inserted into ConsensusState.');

    // Commit the transaction to persist the changes
    console.log('Committing DB Transaction...');
    await runDatabaseQuery('COMMIT');
    console.log('Committed DB Transaction.');

    // Get the last inserted row ID using the last_insert_rowid() function
    const lastInsertedRow = await queryDatabase('SELECT last_insert_rowid() as lastID');
    const lastInsertedRowID = lastInsertedRow.lastID;
    console.log('Last inserted row ID:',
      lastInsertedRowID);

    let lastInsertedTimestamp = null;

    if (lastInsertedRowID) {
      const timestampRow = await queryDatabase('SELECT timestamp FROM ConsensusState WHERE id = ?',
        [lastInsertedRowID]);
      lastInsertedTimestamp = timestampRow.timestamp;
      console.log('Timestamp for last inserted row:',
        lastInsertedTimestamp);
    }

    if (lastInsertedTimestamp) {
      console.log('deleting old entries');
      await deleteOldEntries(lastInsertedTimestamp,
        consensusState.chainId);
    }
  } catch (err) {
    console.error('Error in updateConsensusStateDB:',
      err);
    try {
      await runDatabaseQuery('ROLLBACK');
    } catch (rollbackErr) {
      console.error('[DEBUG] Error on ROLLBACK',
        rollbackErr);
      throw rollbackErr;
    }
    throw err;
  }
}

async function saveVotesAndCommits (roundState, roundStateId) {
  // Save votes for each validator
  for (let i = 0; i < roundState.validators.length; i++) {
    const validator = roundState.validators[i];
    const vote = roundState.votes[i];
    await saveVote(validator,
      vote,
      'prevote',
      roundStateId);
  }

  // Save last_commit votes for each validator
  for (let i = 0; i < roundState.last_validators.length; i++) {
    const validator = roundState.last_validators[i];
    const vote = roundState.last_commit.votes[i];
    await saveVote(validator,
      vote,
      'precommit',
      roundStateId);
  }

  const last_commit_height = roundState.height - 1;
  await saveCommit(roundState.last_commit,
    roundStateId,
    last_commit_height);
}

async function saveValidators (validators, roundStateId) {
  console.log('Starting saveValidators...');

  const validatorsGroupId = await saveValidatorsGroup(validators,
    roundStateId);

  for (const validator of validators.validators) {
    await saveValidator(validator,
      validatorsGroupId);
  }

  return validatorsGroupId;
}

async function saveRoundState (roundState) {
  console.log('Starting saveRoundState...');

  // Define the query for inserting into RoundState
  const query = `
      INSERT INTO RoundState (chainId, timestamp, height, round, step, start_time, commit_time, validatorsGroupId, proposal, proposal_block_parts_header, locked_block_parts_header, valid_block_parts_header, votes, last_commit, lastValidatorsGroupId)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
  `;

  // Initialize the params
  const params = [
    roundState.chainId,
    roundState.timestamp,
    roundState.height,
    roundState.round,
    roundState.step,
    roundState.start_time,
    roundState.commit_time,
    null, // Temporarily set to null, will update later
    JSON.stringify(roundState.proposal),
    JSON.stringify(roundState.proposal_block_parts_header),
    JSON.stringify(roundState.locked_block_parts_header),
    JSON.stringify(roundState.valid_block_parts_header),
    JSON.stringify(roundState.votes),
    JSON.stringify(roundState.last_commit),
    null // Temporarily set to null, will update later
  ];

  const roundStateId = await runDatabaseQuery(query,
    params);

  const validatorsGroupId = await saveValidators(roundState.validators,
    roundStateId);
  const lastValidatorsGroupId = await saveValidators(roundState.last_validators,
    roundStateId);

  // Update the RoundState with the correct validatorsGroupId and lastValidatorsGroupId
  const updateQuery = `
      UPDATE RoundState
      SET validatorsGroupId = ?, lastValidatorsGroupId = ?
      WHERE id = ?;
  `;

  const updateParams = [validatorsGroupId, lastValidatorsGroupId, roundStateId];
  await runDatabaseQuery(updateQuery,
    updateParams);

  // Save votes and commits
  await saveVotesAndCommits(roundState,
    roundStateId);

  return roundStateId;
}

async function saveValidatorsGroup (validators, roundStateId) {
  const query = `
      INSERT INTO ValidatorsGroup (chainId, timestamp, roundStateId)
      VALUES (?, ?, ?);
  `;
  const params = [
    validators.chainId,
    validators.timestamp,
    roundStateId
  ];

  const validatorsGroupId = await runDatabaseQuery(query,
    params);
  return validatorsGroupId;
}

async function saveValidator (validator, validatorsGroupId) {
  const query = `
      INSERT INTO Validator (validatorsGroupId, chainId, timestamp, address, pub_key, voting_power, proposer_priority)
      VALUES (?, ?, ?, ?, ?, ?, ?);
  `;
  const params = [
    validatorsGroupId,
    validator.chainId,
    validator.timestamp,
    validator.address,
    JSON.stringify(validator.pub_key),
    validator.voting_power,
    validator.proposer_priority
  ];

  await runDatabaseQuery(query,
    params);
}

async function saveVote (validator, vote, type, roundStateId) {
  const query = `
      INSERT INTO Votes (validatorId, type, vote, roundStateId)
      VALUES (?, ?, ?, ?);
  `;
  const params = [
    validator.address, // Using the address as the unique identifier
    type,
    JSON.stringify(vote), // Assuming vote is an object
    roundStateId
  ];

  await runDatabaseQuery(query,
    params);
}

async function saveCommit (commit, roundStateId, height) {
  const query = `
      INSERT OR REPLACE INTO Commits (height, votes_bit_array, roundStateId)
      VALUES (?, ?, ?);
  `;
  const params = [
    height,
    JSON.stringify(commit.votes_bit_array),
    roundStateId
  ];

  await runDatabaseQuery(query,
    params);
}

async function savePeer (peer) {
  const query = `
      INSERT INTO Peer (chainId, timestamp, node_address, peer_stateId)
      VALUES (?, ?, ?, ?);
  `;
  const peerStateId = await savePeerState(peer.peer_state);
  const params = [
    peer.chainId,
    peer.timestamp,
    peer.node_address,
    peerStateId
  ];

  await runDatabaseQuery(query,
    params);
}

async function savePeerState (peerState) {
  const query = `
      INSERT INTO PeerState (chainId, timestamp, round_stateId, stats)
      VALUES (?, ?, ?, ?);
  `;
  const roundStateId = await saveRoundState(peerState.round_state);
  const params = [
    peerState.chainId,
    peerState.timestamp,
    roundStateId,
    peerState.stats
  ];

  await runDatabaseQuery(query,
    params);
  return roundStateId; // Return the ID of the inserted PeerState
}

async function loadConsensusStateFromDB (chainId) {
  const query = 'SELECT * FROM ConsensusState WHERE chainId = ?';
  const row = await queryDatabase(query,
    [chainId]);
  if (row) {
    const roundState = await loadRoundState(row.round_stateId);
    const peers = await loadPeers(chainId);
    const consensusStateData = {
      round_state: roundState,
      peers: peers
    };
    return new ConsensusState(consensusStateData,
      chainId,
      row.timestamp);
  }
  return null;
}

async function loadRoundState (id) {
  const query = 'SELECT * FROM RoundState WHERE id = ?';
  const row = await queryDatabase(query,
    [id]);
  const validators = await loadValidators(row.validatorsId);
  const lastValidators = await loadValidators(row.last_validatorsId);
  const roundStateData = {
    height: row.height,
    round: row.round,
    step: row.step,
    start_time: row.start_time,
    commit_time: row.commit_time,
    validators: validators,
    proposal: JSON.parse(row.proposal),
    proposal_block_parts_header: JSON.parse(row.proposal_block_parts_header),
    locked_block_parts_header: JSON.parse(row.locked_block_parts_header),
    valid_block_parts_header: JSON.parse(row.valid_block_parts_header),
    votes: JSON.parse(row.votes),
    last_commit: JSON.parse(row.last_commit),
    last_validators: lastValidators
  };
  return new RoundState(roundStateData,
    row.chainId,
    row.timestamp);
}

async function loadValidators (id) {
  const query = 'SELECT * FROM Validators WHERE id = ?';
  const row = await queryDatabase(query,
    [id],
    true);
  const validatorsList = await loadValidatorList(row.chainId);
  const proposer = validatorsList.find(validator => validator.id === row.proposerId);
  const validatorsData = {
    validators: validatorsList,
    proposer: proposer
  };
  return new Validators(validatorsData,
    row.chainId,
    row.timestamp);
}

async function loadValidatorList (chainId) {
  const query = 'SELECT * FROM Validator WHERE chainId = ?';
  const rows = await queryDatabase(query,
    [chainId],
    true);
  return rows.map(row => new Validator({
    address: row.address,
    pub_key: JSON.parse(row.pub_key),
    voting_power: row.voting_power,
    proposer_priority: row.proposer_priority
  },
  row.chainId,
  row.timestamp));
}

async function loadPeers (chainId) {
  const query = 'SELECT * FROM Peer WHERE chainId = ?';
  const rows = await queryDatabase(query,
    [chainId],
    true);
  const peers = [];
  for (const row of rows) {
    const peerState = await loadPeerState(row.peer_stateId);
    const peer = new Peer({
      node_address: row.node_address,
      peer_state: peerState
    },
    row.chainId,
    row.timestamp);
    peers.push(peer);
  }
  return peers;
}

async function loadPeerState (id) {
  const query = 'SELECT * FROM PeerState WHERE id = ?';
  const row = await queryDatabase(query,
    [id]);
  const roundState = await loadRoundState(row.round_stateId);
  const peerStateData = {
    round_state: roundState,
    stats: row.stats
  };
  return new PeerState(peerStateData,
    row.chainId,
    row.timestamp);
}

async function deleteOldEntries (olderThanTimestamp, chainId) {
  console.log(`Deleting entries older than: ${olderThanTimestamp} for chainId: ${chainId}`);

  // Fetch old RoundState IDs to be pruned
  const selectOldRoundStateIdsQuery = `
      SELECT id 
      FROM RoundState 
      WHERE timestamp < ? AND chainId = ?
  `;

  const oldRoundStateIdsResult = await queryDatabase(selectOldRoundStateIdsQuery,
    [olderThanTimestamp, chainId],
    true);
  const oldRoundStateIds = oldRoundStateIdsResult.map(entry => entry.id);
  if (oldRoundStateIds.length === 0) {
    console.log('No old RoundState entries found');
    return;
  }
  console.log(`Deleting RoundState entries with IDs: ${oldRoundStateIds.join(', ')}`);

  const relatedTables = {
    Votes: 'roundStateId',
    Commits: 'roundStateId',
    Validator: 'validatorsGroupId',
    ValidatorsGroup: 'roundStateId'
  };

  // Delete entries from related tables
  for (const [table, foreignKey] of Object.entries(relatedTables)) {
    const deleteRelatedQuery = `
          DELETE FROM ${table}
          WHERE ${foreignKey} IN (${oldRoundStateIds.join(',')})
      `;

    const result = await runDatabaseQuery(deleteRelatedQuery);
    const deletedCount = result.changes || 0;
    console.log(`Deleted ${deletedCount} old entries from ${table}`);
  }

  // Delete old RoundState entries
  const deleteRoundStateQuery = `
      DELETE FROM RoundState 
      WHERE id IN (${oldRoundStateIds.join(',')})
  `;
  await runDatabaseQuery(deleteRoundStateQuery);
  console.log(`Deleted old RoundState entries with IDs: ${oldRoundStateIds.join(', ')}`);

  // Handle ConsensusState
  // Fetch old ConsensusState IDs to be pruned
  const selectOldConsensusIdsQuery = `
      SELECT id 
      FROM ConsensusState 
      WHERE timestamp < ? AND chainId = ?
  `;
  const oldConsensusIdsResult = await queryDatabase(selectOldConsensusIdsQuery,
    [olderThanTimestamp, chainId],
    true);
  const oldConsensusIds = oldConsensusIdsResult.map(entry => entry.id);

  if (oldConsensusIds.length > 0) {
    console.log(`Deleting ConsensusState entries with IDs: ${oldConsensusIds.join(', ')}`);
    // Delete old ConsensusState entries
    const deleteConsensusStateQuery = `
          DELETE FROM ConsensusState 
          WHERE id IN (${oldConsensusIds.join(',')})
      `;
    await runDatabaseQuery(deleteConsensusStateQuery);
    console.log(`Deleted old ConsensusState entries with IDs: ${oldConsensusIds.join(', ')}`);
  } else {
    console.log('No old ConsensusState entries found');
  }
}

export {
  saveStakingValidators,
  getStakingValidatorsFromDB,
  saveMatchedValidators,
  getMatchedValidatorsFromDB,
  getChainInfosFromDB,
  saveChainInfos,
  updateConsensusStateDB,
  loadConsensusStateFromDB
};
