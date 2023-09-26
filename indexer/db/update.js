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
  pubKeyToValcons,
  decodeVoteData
} from '../utils/utils.js';

import {
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
    const metaRow = await runDatabaseQuery('SELECT * FROM StakingValidatorsMeta ORDER BY id DESC LIMIT 1', [], 'get');

    if (!metaRow) {
      return [];
    }

    // Get all StakingValidator entries associated with the latest meta entry
    const validatorRows = await runDatabaseQuery('SELECT * FROM StakingValidator WHERE stakingValidatorsMetaId = ?', [metaRow.id], 'all');

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
    const matchedRow = await runDatabaseQuery('SELECT * FROM MatchedValidators ORDER BY id DESC LIMIT 1', [], 'get');

    if (!matchedRow) {
      return null;
    }

    // Get all MatchedValidatorDetail entries associated with the latest matched entry
    const validatorRows = await runDatabaseQuery('SELECT * FROM MatchedValidatorDetail WHERE matchedValidatorsId = ?', [matchedRow.id], 'all');

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
    const rows = await runDatabaseQuery('SELECT * FROM ChainInfo WHERE type = ?', [type], 'all');
    return rows;
  } catch (error) {
    console.error('DB Error:',
      error);
    throw error;
  }
}

/// ///////////////////////////////////// TODO

async function updateConsensusStateDB(consensusState) {
  console.log('updateConsensusStateDB called with consensusState:', consensusState);
  try {
      console.log('Starting DB Transaction...');
      await runDatabaseQuery('BEGIN TRANSACTION');
      console.log('Started DB Transaction.');

      const query = `
          INSERT INTO ConsensusState (chainId, timestamp)
          VALUES (?, ?);
      `;
      const params = [
          consensusState.chainId,
          consensusState.timestamp,
      ];

      const consensusStateId = await runDatabaseQuery(query, params);
      console.log('[DEBUG] consensusStateId for chain', consensusState.chainId, ':', consensusStateId);

      const roundStateId = await saveRoundState(consensusState.round_state, consensusStateId);
      console.log('[DEBUG] RoundStateId for chain', consensusState.chainId, ':', roundStateId);

      // Fetch the IDs of the states that are older than the `retainStates` count
      const selectPruneIdsQuery = `
        SELECT id 
        FROM ConsensusState 
        WHERE chainId = ?
        AND id != ?
        ORDER BY id ASC
        LIMIT -1 OFFSET ?
      `;
      const RETAIN_STATES = 0;
      const pruneIdsResult = await runDatabaseQuery(selectPruneIdsQuery, [consensusState.chainId, consensusStateId, RETAIN_STATES], 'all');
      const pruneIds = pruneIdsResult.map(entry => entry.id);

      // Before pruning, ensure that the lastcommit data is correctly associated with the current state
      const currentRoundState = await getRoundStateByConsensusStateId(consensusStateId);
      if (currentRoundState.validatorsGroupId && currentRoundState.lastValidatorsGroupId) {
        if (pruneIds.length > 0) {
          await pruneConsensusStateDB(pruneIds, consensusState.chainId);
        }
      } else {
        console.error('Error: lastcommit data is not correctly associated with the current state.');
      }

      console.log('Committing DB Transaction...');
      await runDatabaseQuery('COMMIT');
      console.log('Committed DB Transaction.');
  } catch (err) {
      console.error('Error in updateConsensusStateDB:', err);
      try {
          await runDatabaseQuery('ROLLBACK');
      } catch (rollbackErr) {
          console.error('[DEBUG] Error on ROLLBACK', rollbackErr);
          throw rollbackErr;
      }
      throw err;
  }
}


async function updateValidatorsGroupWithProposerId(validatorsGroupId, proposerId) {
  const query = `
      UPDATE ValidatorsGroup
      SET proposerId = ?
      WHERE id = ?
  `;
  console.log('setting lastProposerId ' + proposerId + ' in ValidatorsGroup ' + validatorsGroupId)   
  await runDatabaseQuery(query, [proposerId, validatorsGroupId]);
}

async function saveValidatorsAndVotes(roundState, roundStateId, type) {
  let validatorsGroupId;
  let proposer;

  if (type === 'current') {
      // Identify the proposer but don't save yet
      for (let i = 0; i < roundState.validators.validators.length; i++) {
          const validator = roundState.validators.validators[i];
          if (validator.address === roundState.validators.proposer.address) {
              proposer = validator;
          }
      }

      // Save the validators group without the proposerId
      validatorsGroupId = await saveValidatorsGroup(roundState.validators.validators, roundStateId, null, 'current');

      // Now, save the proposer with the correct validators group ID
      const proposerId = await saveValidator(proposer, validatorsGroupId);

      // Update the validators group with the correct proposerId
      await updateValidatorsGroupWithProposerId(validatorsGroupId, proposerId);

      // Continue with the rest of the logic for saving other validators and votes
      for (let i = 0; i < roundState.validators.validators.length; i++) {
          const validator = roundState.validators.validators[i];
          let validatorId;
          if (validator.address !== roundState.validators.proposer.address) {
            validatorId = await saveValidator(validator, validatorsGroupId);
          }

          for (let f = 0; f < roundState.votes.length; f++) {
              const votes = roundState.votes[f];
              if (validator.address === roundState.validators.proposer.address) {
                validatorId = proposerId;
              }
              await saveVote(votes.prevotes[i], 'prevote', validatorId);
              await saveVote(votes.precommits[i], 'precommit', validatorId);
          }
      }
  }

  if (type === 'last') {
    // Identify the last proposer but don't save yet
    for (let i = 0; i < roundState.last_validators.validators.length; i++) {
        const validator = roundState.last_validators.validators[i];
        if (validator.address === roundState.last_validators.proposer.address) {
            proposer = validator;
        }
    }

    // Save the last validators group without the proposerId
    validatorsGroupId = await saveValidatorsGroup(roundState.last_validators.validators, roundStateId, null, 'last');

    // Now, save the last proposer with the correct validators group ID
    const proposerId = await saveValidator(proposer, validatorsGroupId);

    // Update the last validators group with the correct proposerId
    await updateValidatorsGroupWithProposerId(validatorsGroupId, proposerId);
    console.log('updated lastProposerId for validatorsGroupId ' + validatorsGroupId)

    // Continue with the rest of the logic for saving other validators and last_commit votes
    for (let i = 0; i < roundState.last_validators.validators.length; i++) {
        const validator = roundState.last_validators.validators[i];
        let validatorId;
        if (validator.address !== roundState.last_validators.proposer.address) {
          validatorId = await saveValidator(validator, validatorsGroupId);
        } else if (validator.address === roundState.last_validators.proposer.address) {
          validatorId = proposerId;
          console.log('saving vote for proposer id ' + validatorId + ": " + roundState.last_commit.votes[i])
        }
        await saveVote(roundState.last_commit.votes[i], 'lastcommit', validatorId);
    }
  }

  return validatorsGroupId;
}

async function saveRoundState(roundState, consensusStateId) {
  console.log('Starting saveRoundState...');

  const query = `
      INSERT INTO RoundState (consensusStateId, chainId, timestamp, height, round, step, start_time, commit_time, validatorsGroupId, lastValidatorsGroupId, proposal, proposal_block_parts_header, locked_block_parts_header, valid_block_parts_header, votes, last_commit)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
  `;

  const params = [
      consensusStateId,
      roundState.chainId,
      roundState.timestamp,
      roundState.height,
      roundState.round,
      roundState.step,
      roundState.start_time,
      roundState.commit_time,
      null,
      null,
      JSON.stringify(roundState.proposal),
      JSON.stringify(roundState.proposal_block_parts_header),
      JSON.stringify(roundState.locked_block_parts_header),
      JSON.stringify(roundState.valid_block_parts_header),
      JSON.stringify(roundState.votes),
      JSON.stringify(roundState.last_commit),
  ];

  const roundStateId = await runDatabaseQuery(query, params);

  const validatorsGroupId = await saveValidatorsAndVotes(roundState, roundStateId, 'current');
  const lastValidatorsGroupId = await saveValidatorsAndVotes(roundState, roundStateId, 'last');
  console.log('saved validatorsGroup and lastValidatorsGroup for consensusStateId: ' + consensusStateId)

  const updateQuery = `
      UPDATE RoundState
      SET validatorsGroupId = ?, lastValidatorsGroupId = ?
      WHERE id = ?;
  `;

  const updateParams = [validatorsGroupId, lastValidatorsGroupId, roundStateId];
  await runDatabaseQuery(updateQuery, updateParams);
  console.log('updated roundStateId ' + roundStateId + ' with validatorsGroupId: ' + validatorsGroupId + ' and lastValidatorsGroupId ' + lastValidatorsGroupId);

  return roundStateId;
}

async function saveValidatorsGroup(validators, roundStateId, proposerId = null, type) {
  const query = `
      INSERT INTO ValidatorsGroup (chainId, timestamp, type, roundStateId, proposerId)
      VALUES (?, ?, ?, ?, ?);
  `;
  const params = [
      validators.chainId,
      validators.timestamp,
      type,
      roundStateId,
      proposerId
  ];

  const validatorsGroupId = await runDatabaseQuery(query, params);
  return validatorsGroupId;
}


async function saveValidator(validator, validatorsGroupId) {
  const valconsAddress = pubKeyToValcons(validator.pub_key.value, 'cosmos');
  const query = `
      INSERT INTO Validator (validatorsGroupId, chainId, timestamp, address, pub_key, consensusAddress, voting_power, proposer_priority)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?);
  `;
  const params = [
      validatorsGroupId,
      validator.chainId,
      validator.timestamp,
      validator.address,
      JSON.stringify(validator.pub_key),
      valconsAddress,
      validator.voting_power,
      validator.proposer_priority
  ];

  const validatorId = await runDatabaseQuery(query, params);
  return validatorId;
}

async function saveVote(vote, type, validatorId) {
  let voteString = vote;
  let voteHash, index, address, height, round, msgType, voteType, date;
  if (!voteString.includes('nil-Vote')){
    [index, address, height, round, msgType, voteType, voteHash, date] = decodeVoteData(voteString);
  } else {
    voteHash = voteString;
  }
  const query = `
      INSERT INTO Votes (validatorId, type, vote, voteString)
      VALUES (?, ?, ?, ?);
  `;

  const params = [
      validatorId,
      type,
      voteHash,
      voteString
  ];

  await runDatabaseQuery(query, params);
}

async function getRoundStateByConsensusStateId(consensusStateId) {
  const query = `
      SELECT * FROM RoundState
      WHERE consensusStateId = ?;
  `;
  const params = [consensusStateId];
  const result = await runDatabaseQuery(query, params, 'get');
  return result;
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

async function loadConsensusStateFromDB(chainId) {
  const consensusStateQuery = 'SELECT * FROM ConsensusState WHERE chainId = ?';
  const consensusStateRow = await runDatabaseQuery(consensusStateQuery, [chainId], 'get');

  if (!consensusStateRow) {
    return null;
  }

  const roundStateQuery = 'SELECT * FROM RoundState WHERE consensusStateId = ?';
  const roundStatesRows = await runDatabaseQuery(roundStateQuery, [consensusStateRow.id], 'all');

  const roundStates = await Promise.all(roundStatesRows.map(async (roundStateRow) => {
    const validatorsGroupQuery = 'SELECT * FROM ValidatorsGroup WHERE roundStateId = ?';
    const validatorsGroupRow = await runDatabaseQuery(validatorsGroupQuery, [roundStateRow.id], 'get');
    const lastValidatorsGroupRow = await runDatabaseQuery(validatorsGroupQuery, [roundStateRow.lastValidatorsGroupId], 'get');

    const validatorsQuery = 'SELECT * FROM Validator WHERE validatorsGroupId = ?';
    const validatorsRows = await runDatabaseQuery(validatorsQuery, [validatorsGroupRow.id], 'all');
    const lastValidatorsRows = await runDatabaseQuery(validatorsQuery, [lastValidatorsGroupRow.id], 'all');

    const validators = validatorsRows.map(validatorRow => new Validator(validatorRow, chainId, validatorRow.timestamp));
    const lastValidators = lastValidatorsRows.map(validatorRow => new Validator(validatorRow, chainId, validatorRow.timestamp));

    const proposerValidator = validators.find(v => v.address === validatorsGroupRow.proposer);

    const validatorsGroup = new Validators({
      validators: validators,
      proposer: proposerValidator
    }, chainId, validatorsGroupRow.timestamp);

    const lastValidatorsGroup = new Validators({
      validators: lastValidators,
      proposer: lastValidators.find(v => v.address === lastValidatorsGroupRow.proposer)
    }, chainId, lastValidatorsGroupRow.timestamp);

    return new RoundState({
      height: roundStateRow.height,
      round: roundStateRow.round,
      step: roundStateRow.step,
      start_time: roundStateRow.start_time,
      commit_time: roundStateRow.commit_time,
      validators: validatorsGroup,
      proposal: roundStateRow.proposal,
      proposal_block_parts_header: roundStateRow.proposal_block_parts_header,
      locked_block_parts_header: roundStateRow.locked_block_parts_header,
      valid_block_parts_header: roundStateRow.valid_block_parts_header,
      votes: roundStateRow.votes,
      last_commit: roundStateRow.last_commit,
      last_validators: lastValidatorsGroup
    }, chainId, roundStateRow.timestamp);
  }));

  return new ConsensusState({
    round_state: roundStates
  }, chainId, consensusStateRow.timestamp);
}

async function pruneConsensusStateDB(pruneIds, chainId) {
  console.log(`Pruning entries with IDs: ${pruneIds.join(', ')} for chainId: ${chainId}`);

  const deleteConsensusStateQuery = `
      DELETE FROM ConsensusState 
      WHERE chainId = ? 
      AND id IN (${pruneIds.map(() => '?').join(', ')})
  `;
  await runDatabaseQuery(deleteConsensusStateQuery, [chainId, ...pruneIds], 'delete');
  
  // Log the pruned IDs
  console.log(`Pruned ConsensusState entries with IDs: ${pruneIds.join(', ')} for chainId: ${chainId}`);
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
