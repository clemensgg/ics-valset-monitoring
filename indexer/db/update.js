// src/db/update.js

import { ConsumerChainInfo, ProviderChainInfo } from '../../src/models/ChainInfo.js';
import { StakingValidators } from '../../src/models/StakingValidators.js';
import {
  ConsensusState,
  Validators,
  Validator
} from '../../src/models/ConsensusState.js';
import {
  pubKeyToValcons,
  decodeVoteData,
  fetchConsumerSigningKeys,
  getProviderChainInfos,
  getStakingValidators,
  validateConsumerRpcs,
} from '../utils/utils.js';

import {
  runDatabaseQuery
} from './db.js';

async function initializeData() {
  let providerChainInfos, consumerChainInfos, stakingValidators;

  try {
    providerChainInfos = await getChainInfosFromDB('provider');
    consumerChainInfos = await getChainInfosFromDB('consumer');

    if (providerChainInfos.length > 0) {
      console.log(`[DEBUG] loaded providerChainInfos for chain ${providerChainInfos[0].chainId}`)

      const stakingValidatorsMetaId = await getLastStakingValidatorsMetaFromDB(providerChainInfos[0].chainId);
      if (stakingValidatorsMetaId) {
        stakingValidators = await getStakingValidatorsFromDB(stakingValidatorsMetaId.id);
        console.log(`[DEBUG] loaded ${stakingValidators.validators.length} stakingValidators for chain ${providerChainInfos[0].chainId}`)
      } else {
        stakingValidators = [];
      }
    } else {
      stakingValidators = [];
    }

    if (consumerChainInfos.length > 0) {
      consumerChainInfos.forEach((chain) => {
        console.log(`[DEBUG] loaded providerChainInfos for chain ${chain.chainId}`)
      });
    }
  } catch (error) {
    console.error('Error fetching data from DB:', error);
    throw error;
  }

  if (!providerChainInfos || !consumerChainInfos || !stakingValidators) {
    throw new Error('Initialization failed!');
  }

  return [providerChainInfos, consumerChainInfos, stakingValidators];
}

function prepareChains(providerChainInfos, consumerChainInfos) {
  if (providerChainInfos.length > 0) {
    const chains = [new ProviderChainInfo(providerChainInfos[0])];
    consumerChainInfos.forEach((chain) => {
      chains.push(new ConsumerChainInfo(chain));
    });
    return chains;
  } else return [];
}

async function validateEndpointsAndSaveChains() {
  const providerChainInfos = await getProviderChainInfos(global.CONFIG.PROVIDER_RPC);
  const consumerChainInfos = await validateConsumerRpcs(global.CONFIG.PROVIDER_RPC, global.CONFIG.CONSUMER_RPCS);

  if (providerChainInfos && providerChainInfos.chainId != '') {
    await saveChainInfos(providerChainInfos);
    console.log('Updated ChainInfos for provider chain.');
  }

  if (consumerChainInfos && consumerChainInfos.length > 0) {
    for (const consumerChainInfo of consumerChainInfos) {
      await saveChainInfos(consumerChainInfo);
    }
    console.log('Updated ChainInfos for consumer chains.');
  }

  return [providerChainInfos, consumerChainInfos];
}

async function saveChainInfos(chainInfo) {
  try {
    const type = chainInfo.type;
    console.log(`Saving ${type} ChainInfo to DB:`, JSON.stringify(chainInfo));

    const insertQuery = `
      INSERT INTO "ChainInfo" ("chainId", "rpcEndpoint", "type", "clientIds") 
      VALUES ($1, $2, $3, $4)
      ON CONFLICT ("chainId") 
      DO UPDATE SET "rpcEndpoint" = EXCLUDED."rpcEndpoint", "type" = EXCLUDED."type", "clientIds" = EXCLUDED."clientIds"
      RETURNING "id";
    `;

    const clientIdsString = JSON.stringify(chainInfo.clientIds);
    const params = [chainInfo.chainId, chainInfo.rpcEndpoint, type, clientIdsString];

    await runDatabaseQuery(insertQuery, params, 'run');

    console.log(`Successfully inserted or replaced ${type} ChainInfo with chainId ${chainInfo.chainId}`);
  } catch (err) {
    console.error('Error saving ChainInfos to DB:', err);
  }
}


async function getChainInfosFromDB(type) {
  try {
    const rows = await runDatabaseQuery('SELECT * FROM "ChainInfo" WHERE "type" = $1', [type], 'all');
    return rows;
  } catch (error) {
    console.error('DB Error:', error);
    throw error;
  }
}

async function saveStakingValidators(stakingValidators) {
  try {
    await runDatabaseQuery('BEGIN TRANSACTION');
    console.log('Saving "stakingValidators" to DB:',
      stakingValidators);

    const metaQuery = 'INSERT INTO "StakingValidatorsMeta" ("chainId", "timestamp", "created_at", "updated_at") VALUES ($1, $2, $3, $4) RETURNING "id"';
    const metaParams = [stakingValidators.chainId, stakingValidators.timestamp, stakingValidators.created_at, stakingValidators.updated_at];
    const metaResult = await runDatabaseQuery(metaQuery,
      metaParams, 'run');

    console.log('Inserted into "StakingValidatorsMeta" with ID:',
      metaResult);

    const validatorQuery = `
          INSERT INTO "StakingValidator" (
              "stakingValidatorsMetaId", 
              "operator_address", 
              "consensus_pubkey_type", 
              "consensus_pubkey_key", 
              "consumer_signing_keys",
              "jailed", "status", "tokens", "delegator_shares", "moniker", 
              "identity", "website", "security_contact", "details", 
              "unbonding_height", "unbonding_time", "commission_rate", 
              "commission_max_rate", "commission_max_change_rate", 
              "min_self_delegation"
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
          RETURNING "id"
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
      await runDatabaseQuery(validatorQuery, validatorParams, 'run');
    }

    // prune
    const pruneOldMetaQuery = `
      DELETE FROM "StakingValidatorsMeta" 
      WHERE "id" NOT IN (
        SELECT MAX("id") 
        FROM "StakingValidatorsMeta" 
        WHERE "chainId" = $1
      ) 
      AND "chainId" = $1;
    `;
    await runDatabaseQuery(pruneOldMetaQuery, [stakingValidators.chainId], 'run');

    await runDatabaseQuery('COMMIT');
    console.log('All validators inserted successfully.');
  } catch (err) {
    console.error('Error saving stakingValidators to DB:', err);
    console.error('attempting DB rollback...')
    try {
      await runDatabaseQuery('ROLLBACK');
    } catch (rollbackErr) {
      console.error('Error on ROLLBACK', rollbackErr);
      throw rollbackErr;
    }
    //  throw err;
  }
}

async function getLastStakingValidatorsMetaFromDB(chainId) {
  const stakingValidatorsMetaId = await runDatabaseQuery('SELECT * FROM "StakingValidatorsMeta" WHERE "chainId" = $1 ORDER BY "id" DESC LIMIT 1', [chainId], 'get');
  if (!stakingValidatorsMetaId) {
    return null;
  } else return stakingValidatorsMetaId;
}

async function getStakingValidatorsFromDB(metaRowId) {
  try {
    const validatorRows = await runDatabaseQuery('SELECT * FROM "StakingValidator" WHERE "stakingValidatorsMetaId" = $1', [metaRowId], 'all');

    const result = {
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
    console.error('Error fetching "stakingValidators" from DB:',
      error);
    throw error;
  }
}

async function saveMatchedValidators(matchedValidators) {
  console.log('Saving matchedValidators to DB:',
    matchedValidators);

  try {
    // Insert into MatchedValidators table
    const matchedQuery = 'INSERT INTO "MatchedValidators" ("chainId", "timestamp", "created_at", "updated_at") VALUES ($1, $2, $3, $4) RETURNING "id"';
    const matchedParams = [matchedValidators.chainId, matchedValidators.timestamp, new Date().toISOString(), new Date().toISOString()];
    const matchedId = await runDatabaseQuery(matchedQuery,
      matchedParams, 'run'); // ID of the last inserted row

    // Now, insert each validator into MatchedValidatorDetail table
    const detailQuery = 'INSERT INTO "MatchedValidatorDetail" ("matchedValidatorsId", "operator_address", "consensus_address") VALUES ($1, $2, $3, $4) RETURNING "id"';
    for (const validator of matchedValidators.validators) {
      const detailParams = [matchedId, validator.operator_address, validator.consensus_address];
      await runDatabaseQuery(detailQuery,
        detailParams, 'run');
    }

    console.log('All matched validators inserted successfully.');
  } catch (error) {
    console.error('Error saving matchedValidators to DB:',
      error);
    throw error;
  }
}

async function getMatchedValidatorsFromDB() {
  try {
    // Get the latest MatchedValidators entry
    const matchedRow = await runDatabaseQuery('SELECT * FROM "MatchedValidators" ORDER BY "id" DESC LIMIT 1', [], 'get');

    if (!matchedRow) {
      return null;
    }

    // Get all MatchedValidatorDetail entries associated with the latest matched entry
    const validatorRows = await runDatabaseQuery('SELECT * FROM "MatchedValidatorDetail" WHERE "matchedValidatorsId" = $1', [matchedRow], 'all');

    const result = {
      chainId: matchedRow.chainId,
      timestamp: matchedRow.timestamp,
      validators: validatorRows
    };

    return result;
  } catch (error) {
    console.error('Error fetching "matchedValidators" from DB:',
      error);
    throw error;
  }
}

async function updateConsensusStateDB(consensusState, retainStates = 0) {
  try {
    await runDatabaseQuery('BEGIN TRANSACTION');

    const consensusStateId = await saveConsensusState(consensusState);

    // Fetch the IDs of the states that are older than the `retainStates` count
    const selectPruneIdsQuery = `
        SELECT "id" 
        FROM "ConsensusState" 
        WHERE "chainId" = $1
        AND "id" != $2
        ORDER BY "id" ASC
        OFFSET $3;
      `;
    const pruneIdsResult = await runDatabaseQuery(selectPruneIdsQuery, [consensusState.chainId, consensusStateId, retainStates], 'all');
    const pruneIds = pruneIdsResult.map(entry => entry.id);

    // Before pruning, ensure that the lastcommit data is correctly associated with the current state
    const currentConsensusState = await getConsensusStateByConsensusStateId(consensusStateId);
    if (currentConsensusState.validatorsGroupId && currentConsensusState.lastValidatorsGroupId) {
      if (pruneIds.length > 0) {
        await pruneConsensusStateDB(pruneIds, consensusState.chainId);
        await pruneHistoricSignatures(consensusState.chainId);
      }
    } else {
      console.error('Error: lastcommit data is not correctly associated with the current state.');
    }

    await runDatabaseQuery('COMMIT');
  } catch (err) {
    console.error('Error in updateConsensusStateDB:', err);
    console.error('attempting DB rollback...')
    try {
      await runDatabaseQuery('ROLLBACK');
    } catch (rollbackErr) {
      console.error('Error on ROLLBACK', rollbackErr);
      throw rollbackErr;
    }
    //      throw err;
  }
}


async function updateValidatorsGroupWithProposerId(validatorsGroupId, proposerId) {
  const query = `
      UPDATE "ValidatorsGroup"
      SET "proposerId" = $1
      WHERE "id" = $2
  `;
  await runDatabaseQuery(query, [proposerId, validatorsGroupId], 'run');
}

async function saveValidatorsAndVotes(consensusState, consensusStateId, type) {
  let validatorsGroupId;
  let proposer;

  if (type === 'current') {
    // Identify the proposer but don't save yet
    for (let i = 0; i < consensusState.validators.validators.length; i++) {
      const validator = consensusState.validators.validators[i];
      if (validator.address === consensusState.validators.proposer.address) {
        proposer = validator;
      }
    }

    // Save the validators group without the proposerId
    validatorsGroupId = await saveValidatorsGroup(consensusStateId, null, 'current');

    // Now, save the proposer with the correct validators group ID
    const proposerId = await saveValidator(proposer, validatorsGroupId);

    // Update the validators group with the correct proposerId
    await updateValidatorsGroupWithProposerId(validatorsGroupId, proposerId);

    // Save Rounds Group
    const roundsGroupId = await saveRoundsGroup(consensusStateId, 'current');

    for (let f = 0; f < consensusState.votes.length; f++) {

      // Save Round with roundsGroupId reference
      const roundId = await saveRound(roundsGroupId, f);

      // Continue with the rest of the logic for saving other validators and votes.
      // Votes reference validatorId and roundId
      for (let i = 0; i < consensusState.validators.validators.length; i++) {
        const validator = consensusState.validators.validators[i];
        let validatorId;
        if (validator.address !== consensusState.validators.proposer.address) {
          validatorId = await saveValidator(validator, validatorsGroupId);
        } else {
          validatorId = proposerId;
        }

        const votes = consensusState.votes[f];
        await saveVote(votes.prevotes[i], 'prevote', validatorId, roundId);
        await saveVote(votes.precommits[i], 'precommit', validatorId, roundId);
      }
    }
  }

  if (type === 'last') {
    // Identify the last proposer but don't save yet
    for (let i = 0; i < consensusState.last_validators.validators.length; i++) {
      const validator = consensusState.last_validators.validators[i];
      if (validator.address === consensusState.last_validators.proposer.address) {
        proposer = validator;
      }
    }

    // Save the last validators group without the proposerId
    validatorsGroupId = await saveValidatorsGroup(consensusStateId, null, 'last');

    // Now, save the last proposer with the correct validators group ID
    const proposerId = await saveValidator(proposer, validatorsGroupId);

    // Update the last validators group with the correct proposerId
    await updateValidatorsGroupWithProposerId(validatorsGroupId, proposerId);

    // Save finalized RoundsGroup and one Round
    const roundsGroupId = await saveRoundsGroup(consensusStateId, 'last');
    const roundId = await saveRound(roundsGroupId, -1);

    // Continue with the rest of the logic for saving other validators and last_commit votes
    for (let i = 0; i < consensusState.last_validators.validators.length; i++) {
      const validator = consensusState.last_validators.validators[i];
      let validatorId;
      if (validator.address !== consensusState.last_validators.proposer.address) {
        validatorId = await saveValidator(validator, validatorsGroupId);
      } else if (validator.address === consensusState.last_validators.proposer.address) {
        validatorId = proposerId;
      }

      // Save the vote
      const vote = consensusState.last_commit.votes[i];
      await saveVote(vote, 'lastcommit', validatorId, roundId);

      // Determine if the validator signed the last commit
      const signed = vote != 'nil-Vote';

      // Update the HistoricSignatures table with the signing information
      await updateHistoricSignature(validatorId, consensusState.chain_id, consensusState.height, signed);
    }
  }

  return validatorsGroupId;
}

async function saveConsensusState(consensusState) {
  const query = `
      INSERT INTO "ConsensusState" (
        "chainId", 
        "timestamp", 
        "height", 
        "round", 
        "step", 
        "start_time", 
        "commit_time", 
        "validatorsGroupId", 
        "lastValidatorsGroupId" 
--        "proposal", 
--        "proposal_block_parts_header", 
--        "locked_block_parts_header", 
--        "valid_block_parts_header", 
--        "votes", 
--        "last_commit"
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING "id";
  `;

  const params = [
    consensusState.chainId,
    consensusState.timestamp,
    consensusState.height,
    consensusState.round,
    consensusState.step,
    consensusState.start_time,
    consensusState.commit_time,
    null,
    null,
    //      JSON.stringify(consensusState.proposal),
    //      JSON.stringify(consensusState.proposal_block_parts_header),
    //      JSON.stringify(consensusState.locked_block_parts_header),
    //      JSON.stringify(consensusState.valid_block_parts_header),
    //      JSON.stringify(consensusState.votes),
    //      JSON.stringify(consensusState.last_commit),
  ];

  const consensusStateId = await runDatabaseQuery(query, params, 'run');

  const validatorsGroupId = await saveValidatorsAndVotes(consensusState, consensusStateId, 'current');
  const lastValidatorsGroupId = await saveValidatorsAndVotes(consensusState, consensusStateId, 'last');

  const updateQuery = `
      UPDATE "ConsensusState"
      SET "validatorsGroupId" = $1, 
      "lastValidatorsGroupId" = $2
      WHERE "id" = $3;
  `;

  const updateParams = [validatorsGroupId, lastValidatorsGroupId, consensusStateId];
  await runDatabaseQuery(updateQuery, updateParams, 'run');

  return consensusStateId;
}

async function saveRoundsGroup(consensusStateId, type = null) {
  const query = `
      INSERT INTO "RoundsGroup" ("consensusStateId", "type")
      VALUES ($1, $2)
      RETURNING "id";
  `;
  const params = [
    consensusStateId,
    type
  ];

  const roundsGroupId = await runDatabaseQuery(query, params, 'run');
  return roundsGroupId;
}

async function saveRound(roundsGroupId, roundNumber = -1) {
  const query = `
      INSERT INTO "Round" ("roundsGroupId", "roundNumber")
      VALUES ($1, $2)
      RETURNING "id";
  `;
  const params = [
    roundsGroupId,
    roundNumber
  ];

  const roundId = await runDatabaseQuery(query, params, 'run');
  return roundId;
}

async function saveValidatorsGroup(consensusStateId, proposerId = null, type) {
  const query = `
      INSERT INTO "ValidatorsGroup" ("type", "consensusStateId", "proposerId")
      VALUES ($1, $2, $3)
      RETURNING "id";
  `;
  const params = [
    type,
    consensusStateId,
    proposerId
  ];

  const validatorsGroupId = await runDatabaseQuery(query, params, 'run');
  return validatorsGroupId;
}


async function saveValidator(validator, validatorsGroupId) {
  const valconsAddress = pubKeyToValcons(validator.pub_key.value, 'cosmos');
  const query = `
      INSERT INTO "Validator" ("validatorsGroupId", "address", "pub_key", "consensusAddress", "voting_power", "proposer_priority")
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING "id";
  `;
  const params = [
    validatorsGroupId,
    validator.address,
    JSON.stringify(validator.pub_key),
    valconsAddress,
    validator.voting_power,
    validator.proposer_priority
  ];

  const validatorId = await runDatabaseQuery(query, params, 'run');

  return validatorId;
}


async function saveVote(vote, type, validatorId, roundId) {
  let voteString = vote;
  let voteHash, index, address, height, round, msgType, voteType, date;
  if (voteString !== 'nil-Vote') {
    [index, address, height, round, msgType, voteType, voteHash, date] = decodeVoteData(voteString);
  } else {
    voteHash = voteString;
  }
  const query = `
      INSERT INTO "Votes" ("validatorId", "roundId", "type", "vote", "voteString")
      VALUES ($1, $2, $3, $4, $5)
      RETURNING "id";
  `;

  const params = [
    validatorId,
    roundId,
    type,
    voteHash,
    voteString
  ];

  await runDatabaseQuery(query, params, 'run');
}

async function getConsensusStateByConsensusStateId(consensusStateId) {
  const query = `
      SELECT * FROM "ConsensusState"
      WHERE id = $1;
  `;
  const params = [consensusStateId];
  const result = await runDatabaseQuery(query, params, 'get');
  return result;
}

async function loadConsensusStateFromDB(chainId) {
  const consensusStateRow = await fetchConsensusState(chainId);
  if (!consensusStateRow) return null;

  const validatorsGroup = await fetchValidatorsGroup(consensusStateRow.validatorsGroupId);
  const lastValidatorsGroup = await fetchValidatorsGroup(consensusStateRow.lastValidatorsGroupId);

  return new ConsensusState({
    height: consensusStateRow.height,
    round: consensusStateRow.round,
    step: consensusStateRow.step,
    start_time: consensusStateRow.start_time,
    commit_time: consensusStateRow.commit_time,
    validators: validatorsGroup,
    last_validators: lastValidatorsGroup,
    proposal: consensusStateRow.proposal,
    proposal_block_parts_header: consensusStateRow.proposal_block_parts_header,
    locked_block_parts_header: consensusStateRow.locked_block_parts_header,
    valid_block_parts_header: consensusStateRow.valid_block_parts_header,
    votes: consensusStateRow.votes,
    last_commit: consensusStateRow.last_commit
  }, chainId, consensusStateRow.timestamp);
}

async function fetchConsensusState(chainId) {
  const query = 'SELECT * FROM "ConsensusState" WHERE "chainId" = $1';
  return await runDatabaseQuery(query, [chainId], 'get');
}

async function fetchValidatorsGroup(validatorsGroupId) {
  const query = 'SELECT * FROM "ValidatorsGroup" WHERE "id" = $1';
  const validatorsGroupRow = await runDatabaseQuery(query, [validatorsGroupId], 'get');

  const validatorsQuery = 'SELECT * FROM "Validator" WHERE "validatorsGroupId" = $1';
  const validatorsRows = await runDatabaseQuery(validatorsQuery, [validatorsGroupId], 'all');

  const validators = validatorsRows.map(validatorRow => new Validator(validatorRow));

  const proposerValidator = validators.find(v => v.id === validatorsGroupRow.proposerId);

  return new Validators({
    validators: validators,
    proposer: proposerValidator
  });
}

async function pruneConsensusStateDB(pruneIds, chainId) {
  const placeholders = pruneIds.map((_, i) => `$${i + 2}`).join(', ');
  const deleteConsensusStateQuery = `
      DELETE FROM "ConsensusState" 
      WHERE "chainId" = $1 
      AND id IN (${placeholders})
  `;
  await runDatabaseQuery(deleteConsensusStateQuery, [chainId, ...pruneIds], 'delete');
  return true;
}

const updateHistoricSignature = async (validatorId, chainId, height, signed) => {
  const query = `
    INSERT INTO "HistoricSignatures" ("validatorId", "chainId", "height", "signed")
    VALUES ($1, $2, $3, $4)
    ON CONFLICT ("validatorId", "chainId", "height")
    DO UPDATE SET "signed" = EXCLUDED.signed;
  `;
  try {
    await runDatabaseQuery(query, [validatorId, chainId, height, signed]);
    console.log(`Historic signature updated for validator ${validatorId} at height ${height}`);
  } catch (err) {
    console.error('Error updating historic signature:', err);
    throw err;
  }
};

async function pruneHistoricSignatures(chainId) {
  const query = `
    DELETE FROM "HistoricSignatures"
    WHERE "id" NOT IN (
      SELECT "id"
      FROM "HistoricSignatures"
      WHERE "chainId" = $1
      ORDER BY "height" DESC
      LIMIT 100
    )
    AND "chainId" = $1;
  `;

  await runDatabaseQuery(query, [chainId]);
  return true;
};

async function updateStakingValidatorsDB(providerChainInfo, consumerChainInfos) {
  console.time('updateDatabaseData Execution Time');
  const stakingValidators = await getStakingValidators(global.CONFIG.PROVIDER_REST);

  let sovereignStakingValidators;

  const hasSovereign = consumerChainInfos.some(obj => obj.type === 'sovereign');
  if (hasSovereign) {
    sovereignStakingValidators = new StakingValidators(await getStakingValidators(global.CONFIG.SOVEREIGN_REST));

    const sovereignChainInfo = consumerChainInfos.find(obj => obj.type === 'sovereign');
    const sovereignChainId = sovereignChainInfo ? sovereignChainInfo.chainId : null;

    if (sovereignStakingValidators && sovereignChainId) {
      sovereignStakingValidators.chainId = sovereignChainId;
    } else {
      console.error(`ERROR fetching sovereign staking validators from ${global.CONFIG.SOVEREIGN_REST}! Check your config!`);
      return;
    }
  }

  //  if (!providerChainInfo || !consumerChainInfos || consumerChainInfos.length == 0 || !stakingValidators || stakingValidators.length == 0) {
  const allChainIds = consumerChainInfos.map(chain => chain.chainId);
  const stakingValidatorsWithSigningKeys = await fetchConsumerSigningKeys(stakingValidators, global.CONFIG.PROVIDER_RPC, allChainIds, global.CONFIG.PREFIX, global.CONFIG.RPC_DELAY_MS);
  stakingValidatorsWithSigningKeys.chainId = providerChainInfo.chainId;

  await saveStakingValidators(stakingValidatorsWithSigningKeys);
  console.log('Updated stakingValidators.');

  if (hasSovereign) {
    sovereignStakingValidators.validators.forEach(validator => {
      validator.consumer_signing_keys = [];
    });
    await saveStakingValidators(sovereignStakingValidators);
  }
  //   }
  console.log('Chain and validator data updated.');
  console.timeEnd('updateDatabaseData Execution Time');
  return;
}

async function getLatestConsensusState(chainId) {
  const query = `
    SELECT "id" AS "consensusStateId", "validatorsGroupId"
    FROM "ConsensusState"
    WHERE "chainId" = $1
    ORDER BY "timestamp" DESC
    LIMIT 1;
  `;
  return await runDatabaseQuery(query, [chainId], 'get');
}

async function createRoundView(chainId) {
  const query = `
  CREATE VIEW CURRENTROUND AS
  WITH "LatestConsensusState" AS (
    SELECT MAX("id") AS "id"
    FROM "ConsensusState"
    WHERE "chainId" = $1
  )
  SELECT
    "SV"."moniker" AS "proposer_moniker",
    "VT"."vote" AS "prevote_vote",
    "VT2"."vote" AS "precommit_vote"
  FROM
    "LatestConsensusState" "LCS"
    JOIN "ConsensusState" "CS" ON "LCS"."id" = "CS"."id"
    JOIN "ValidatorsGroup" "VG" ON "CS"."id" = "VG"."consensusStateId"
    JOIN "Validator" "V" ON "VG"."proposerId" = "V"."id"
    LEFT JOIN "StakingValidator" "SV" ON
      CASE
        WHEN (SELECT "type" FROM "ChainInfo" WHERE "chainId" = $1 LIMIT 1) = 'provider'
          THEN "SV"."consensus_pubkey_key" = ("V"."pub_key"::json)->>'value'
        ELSE ("SV"."consumer_signing_keys"::json)->>$1::text = "V"."consensusAddress"
      END
    LEFT JOIN "Votes" "VT" ON "V"."id" = "VT"."validatorId" AND "VT"."type" = 'prevote'
    LEFT JOIN "Votes" "VT2" ON "V"."id" = "VT2"."validatorId" AND "VT2"."type" = 'precommit'
  WHERE
    "VG"."type" = 'current'
  LIMIT 1;
  `
  return await runDatabaseQuery(query, [chainId], 'get');
}

async function createCurrentRound() {
  const query = `
  CREATE OR REPLACE FUNCTION get_current_round(p_chain_id TEXT)
  RETURNS TABLE (
    proposer_moniker TEXT,
    prevote_vote TEXT,
    precommit_vote TEXT
  )
  AS $$
  BEGIN
    RETURN QUERY
    WITH "LatestConsensusState" AS (
      SELECT MAX("id") AS "id"
      FROM "ConsensusState"
      WHERE "chainId" = p_chain_id
    )
    SELECT
      "SV"."moniker" AS "proposer_moniker",
      "VT"."vote" AS "prevote_vote",
      "VT2"."vote" AS "precommit_vote"
    FROM
      "LatestConsensusState" "LCS"
      JOIN "ConsensusState" "CS" ON "LCS"."id" = "CS"."id"
      JOIN "ValidatorsGroup" "VG" ON "CS"."id" = "VG"."consensusStateId"
      JOIN "Validator" "V" ON "VG"."proposerId" = "V"."id"
      LEFT JOIN "StakingValidator" "SV" ON
        CASE
          WHEN (SELECT "type" FROM "ChainInfo" WHERE "chainId" = p_chain_id LIMIT 1) = 'provider'
            THEN "SV"."consensus_pubkey_key" = ("V"."pub_key"::json)->>'value'
          ELSE ("SV"."consumer_signing_keys"::json)->>p_chain_id = "V"."consensusAddress"
        END
      LEFT JOIN "Votes" "VT" ON "V"."id" = "VT"."validatorId" AND "VT"."type" = 'prevote'
      LEFT JOIN "Votes" "VT2" ON "V"."id" = "VT2"."validatorId" AND "VT2"."type" = 'precommit'
    WHERE
      "VG"."type" = 'current'
    LIMIT 1;
  END;
  $$ LANGUAGE plpgsql;
  `
  return await runDatabaseQuery(query, [], 'get');
}

async function createLastCommit() {
  const query = `
  CREATE OR REPLACE FUNCTION get_last_commit(p_chain_id TEXT)
  RETURNS TABLE (
    address TEXT,
    moniker TEXT,
    lastCommitVote TEXT,
    totalVotingPower BIGINT,
    totalAgreeingVotingPower BIGINT,
    totalNilVotingPower BIGINT,
    totalZeroVotingPower BIGINT,
    consensusPercentage DOUBLE PRECISION
  )
  AS $$
  BEGIN
  RETURN QUERY
  WITH "LatestConsensusState" AS (
      SELECT "id" AS "consensusStateId", "lastValidatorsGroupId", "chainId"
      FROM "ConsensusState"
      WHERE "chainId" = $1
      ORDER BY "timestamp" DESC
      LIMIT 1
    ),
    "LastProposerVote" AS (
        SELECT 
            "V"."address" AS "proposerAddress",
            "VT"."vote" AS "proposerLastCommitVote",
            "SV"."moniker" AS "proposerMoniker"
        FROM "LatestConsensusState" "LCS"
        JOIN "ValidatorsGroup" "VG" ON "LCS"."lastValidatorsGroupId" = "VG"."id"
        JOIN "Validator" "V" ON "VG"."proposerId" = "V"."id"
        JOIN "Votes" "VT" ON "V"."id" = "VT"."validatorId"
        LEFT JOIN "StakingValidator" "SV" ON 
            (
                (SELECT "type" FROM "ChainInfo" WHERE "chainId" = $1 LIMIT 1) = 'provider' 
                AND "SV"."consensus_pubkey_key" = ("V"."pub_key"::json)->>'value'
            ) 
            OR
            (
                (SELECT "type" FROM "ChainInfo" WHERE "chainId" = $1 LIMIT 1) != 'provider' 
                AND ("SV"."consumer_signing_keys"::json)->>$1::text = "V"."consensusAddress"
            )
        WHERE "VT"."type" = 'lastcommit'
        LIMIT 1
    )
    SELECT 
        MIN("LPV"."proposerAddress") AS "proposerAddress",
        MIN("LPV"."proposerMoniker") AS "proposerMoniker",
        MIN("LPV"."proposerLastCommitVote") AS "proposerLastCommitVote",
        (SELECT "PC"."total"q
         FROM "PreCommit" "PC"
         ORDER BY "PC"."id" DESC
         LIMIT 1) AS "totalVotingPowerForLastCommit",
         (SELECT "PC"."totalAgree"
         FROM "PreCommit" "PC"
         ORDER BY "PC"."id" DESC
         LIMIT 1) AS "totalAgreeingLastcommitVotingPower",
         (SELECT "PC"."totalNil"
         FROM "PreCommit" "PC"
         ORDER BY "PC"."id" DESC
         LIMIT 1) AS "totalNilvotingVotingPowerForLastCommit",
         (SELECT "PC"."totalZero"
         FROM "PreCommit" "PC"
         ORDER BY "PC"."id" DESC
         LIMIT 1) AS "totalZerovotingVotingPowerForLastCommit",
         (SELECT "PC"."consensusPercentage"
         FROM "PreCommit" "PC"
         ORDER BY "PC"."id" DESC
         LIMIT 1) AS "consensusPercentage"
    FROM "LatestConsensusState" "LCS"
    JOIN "ValidatorsGroup" "VG" ON "LCS"."lastValidatorsGroupId" = "VG"."id"
    JOIN "Validator" "V" ON "VG"."id" = "V"."validatorsGroupId"
    JOIN "Votes" "VT" ON "V"."id" = "VT"."validatorId"
    LEFT JOIN "LastProposerVote" "LPV" ON "VT"."vote" = "LPV"."proposerLastCommitVote"
    WHERE "VT"."type" = 'lastcommit';
    END;
    $$ LANGUAGE plpgsql;
    `
  return await runDatabaseQuery(query, [], 'get');
}

async function createCurrentValidatorsConsumer() {
  const query = `
  CREATE OR REPLACE FUNCTION get_current_validators_consumer(p_chain_id TEXT)
RETURNS TABLE (
    validatorId INT,
    votingPower BIGINT,
    pubKey TEXT,
    consensusAddress TEXT,
    proposerPriority BIGINT,
    id INT,
    stakingValidatorsMetaId BIGINT,
    operatorAddress TEXT,
    consensusPubkeyType TEXT,
    consumerSigningKeys TEXT,
    moniker TEXT,
    prevote TEXT,
    precommit TEXT,
    consumerSigningKey TEXT
)
AS $$
BEGIN
    RETURN QUERY
    WITH "LatestConsensusState" AS (
      SELECT cs."id" AS "latestConsensusStateId", cs."validatorsGroupId"
      FROM "ConsensusState" cs
      WHERE cs."chainId" = p_chain_id
      ORDER BY cs."timestamp" DESC
      LIMIT 1
  ),
  "LatestRoundsGroup" AS (
      SELECT rg."id" AS "latestRoundsGroupId"
      FROM "RoundsGroup" rg
      WHERE rg."consensusStateId" = (SELECT "latestConsensusStateId" FROM "LatestConsensusState")
      LIMIT 1
  ),
  "LatestRound" AS (
      SELECT MAX(r."id") AS "latestRoundId"
      FROM "Round" r
      WHERE r."roundsGroupId" = (SELECT "latestRoundsGroupId" FROM "LatestRoundsGroup")
  ),
  "LatestValidatorsGroupId" AS (
      SELECT cs."validatorsGroupId"
      FROM "ConsensusState" cs
      WHERE cs."id" = (SELECT "latestConsensusStateId" FROM "LatestConsensusState")
  )
  SELECT
      "V"."id" AS "validatorId",
      "V"."voting_power",
      "V"."pub_key",
      "V"."consensusAddress",
      "V"."proposer_priority",
      "SV"."id",
      "SV"."stakingValidatorsMetaId",
      "SV"."operator_address",
      "SV"."consensus_pubkey_type",
      "SV"."consumer_signing_keys",
      "SV"."moniker",
      (SELECT MAX("vote") FROM "Votes" WHERE "validatorId" = "V"."id" AND "type" = 'prevote' AND "roundId" = (SELECT "latestRoundId" FROM "LatestRound")) AS "prevote",
      (SELECT MAX("vote") FROM "Votes" WHERE "validatorId" = "V"."id" AND "type" = 'precommit' AND "roundId" = (SELECT "latestRoundId" FROM "LatestRound")) AS "precommit",
      ("SV"."consumer_signing_keys"::json)->>p_chain_id::text AS "consumer_signing_key"
  FROM
      "Validator" "V"
  JOIN
      "LatestValidatorsGroupId" "LVG" ON "V"."validatorsGroupId" = "LVG"."validatorsGroupId"
  LEFT JOIN
      "StakingValidator" "SV" ON ("SV"."consumer_signing_keys"::json)->>p_chain_id::text = "V"."consensusAddress"
  WHERE
      "V"."id" IN (
          SELECT DISTINCT "validatorId"
          FROM "Votes"
          WHERE "type" = 'prevote' AND "roundId" = (SELECT "latestRoundId" FROM "LatestRound")
      )
  GROUP BY
      "V"."id", "SV"."id", "SV"."stakingValidatorsMetaId", "SV"."operator_address"
  ORDER BY 
      "V"."voting_power" DESC;
  
END;
$$ LANGUAGE plpgsql;
`

  return await runDatabaseQuery(query, [], 'get');
}

async function createCurrentValidatorsProvider() {
  const query = `
  CREATE OR REPLACE FUNCTION get_current_validators_provider(p_chain_id TEXT)
RETURNS TABLE (
    validatorId INT,
    votingPower BIGINT,
    pubKey TEXT,
    consensusAddress TEXT,
    proposerPriority BIGINT,
    id INT,
    stakingValidatorsMetaId BIGINT,
    operatorAddress TEXT,
    consumerSigningKeys TEXT,
    moniker TEXT,
    prevote TEXT,
    precommit TEXT,
    proposerPrevote TEXT,
    proposerPrecommit TEXT,
    consensusPubkey TEXT
)
AS $$
BEGIN
    RETURN QUERY
    WITH "LatestConsensusState" AS (
        SELECT cs."id" AS "latestConsensusStateId", cs."validatorsGroupId"
        FROM "ConsensusState" cs
        WHERE cs."chainId" = p_chain_id
        ORDER BY cs."timestamp" DESC
        LIMIT 1
    ),
    "LatestRoundsGroup" AS (
        SELECT rg."id" AS "latestRoundsGroupId"
        FROM "RoundsGroup" rg
        WHERE rg."consensusStateId" = (SELECT "latestConsensusStateId" FROM "LatestConsensusState")
        LIMIT 1
    ),
    "LatestRound" AS (
        SELECT MAX(r."id") AS "latestRoundId"
        FROM "Round" r
        WHERE r."roundsGroupId" = (SELECT "latestRoundsGroupId" FROM "LatestRoundsGroup")
    ),
    "LatestValidatorsGroupId" AS (
        SELECT cs."validatorsGroupId"
        FROM "ConsensusState" cs
        WHERE cs."id" = (SELECT "latestConsensusStateId" FROM "LatestConsensusState")
    )
    SELECT
    "V"."id" AS "validatorId",
    "V"."voting_power",
    "V"."pub_key",
    "V"."consensusAddress",
    "V"."proposer_priority",
    "SV"."id",
    "SV"."stakingValidatorsMetaId",
    "SV"."operator_address",
    "SV"."consumer_signing_keys",
    "SV"."moniker",
    (SELECT MAX("vote") FROM "Votes" WHERE "validatorId" = "V"."id" AND "type" = 'prevote' AND "roundId" = (SELECT "latestRoundId" FROM "LatestRound")) AS "prevote",
    (SELECT MAX("vote") FROM "Votes" WHERE "validatorId" = "V"."id" AND "type" = 'precommit' AND "roundId" = (SELECT "latestRoundId" FROM "LatestRound")) AS "precommit",
    (SELECT MAX("vote") FROM "Votes" WHERE "validatorId" = "VG"."proposerId" AND "type" = 'prevote' AND "roundId" = (SELECT "latestRoundId" FROM "LatestRound")) AS "proposer_prevote",
    (SELECT MAX("vote") FROM "Votes" WHERE "validatorId" = "VG"."proposerId" AND "type" = 'precommit' AND "roundId" = (SELECT "latestRoundId" FROM "LatestRound")) AS "proposer_precommit",
    ("V"."pub_key"::json)->>'value' AS "consensus_pubkey"
FROM "Validator" "V"
JOIN "LatestValidatorsGroupId" "LVG" ON "V"."validatorsGroupId" = "LVG"."validatorsGroupId"
JOIN "ValidatorsGroup" "VG" ON "V"."validatorsGroupId" = "VG"."id"
LEFT JOIN "StakingValidator" "SV" ON "SV"."consensus_pubkey_key" = ("V"."pub_key"::json)->>'value'
WHERE "V"."id" IN (
    SELECT DISTINCT "validatorId"
    FROM "Votes"
    WHERE "type" = 'prevote' AND "roundId" = (SELECT "latestRoundId" FROM "LatestRound")
)
GROUP BY "V"."id", "SV"."id", "SV"."stakingValidatorsMetaId", "SV"."operator_address", "VG"."proposerId"
ORDER BY "V"."voting_power" DESC;
END;
$$ LANGUAGE plpgsql;
`

  return await runDatabaseQuery(query, [], 'get');
}

async function getCurrentRound(chainId) {
  const query = `
  SELECT * FROM get_current_round($1);
  `
}

async function getLastCommit(chainId) {
  const query = `
  SELECT * FROM get_last_commit($1);
  `
}

// async function getCurrentValidators(chainId) {
//   const query = `
//   SELECT * FROM get_current_validators($1);
//   `
// }

// async function getCurrentRoundFromView(chainId) {
//   const query = `
//   SELECT * FROM CURRENTROUND;
//   `
// }

async function calculatePreVoteMetrics(validatorsGroupId) {
  const query = `
    WITH "ProposerVote" AS (
        SELECT "R"."id" AS "roundId", "V"."vote" AS "proposerVote"
        FROM "Votes" "V"
        JOIN "Validator" "VL" ON "V"."validatorId" = "VL"."id"
        JOIN "ValidatorsGroup" "VG" ON "VL"."validatorsGroupId" = "VG"."id"
        JOIN "Round" "R" ON "V"."roundId" = "R"."id"
        WHERE "VG"."id" = $1
        AND "V"."type" = 'prevote'
        AND "V"."validatorId" = "VG"."proposerId"
    )
    SELECT 
        "R"."roundNumber",
        SUM("V"."voting_power") FILTER (WHERE "VT"."type" = 'prevote') AS "totalVotingPowerForPrevote",
        SUM("V"."voting_power") FILTER (WHERE "VT"."type" = 'prevote' AND "VT"."vote" = "PV"."proposerVote" AND "VT"."vote" NOT IN ('nil-Vote', '000000000000')) AS "totalAgreeingVotingPowerForPrevote",
        SUM("V"."voting_power") FILTER (WHERE "VT"."type" = 'prevote' AND "VT"."vote" = 'nil-Vote') AS "totalNilvotingVotingPowerForPrevote",
        SUM("V"."voting_power") FILTER (WHERE "VT"."type" = 'prevote' AND "VT"."vote" = '000000000000') AS "totalZerovotingVotingPowerForPrevote",
        (SUM("V"."voting_power") FILTER (WHERE "VT"."type" = 'prevote' AND "VT"."vote" = "PV"."proposerVote" AND "VT"."vote" NOT IN ('nil-Vote', '000000000000')) * 100.0 / NULLIF(SUM("V"."voting_power") FILTER (WHERE "VT"."type" = 'prevote'), 0)) AS "consensusPercentage"
      FROM "ValidatorsGroup" "VG" 
    JOIN "Validator" "V" ON "VG"."id" = "V"."validatorsGroupId" 
    JOIN "Votes" "VT" ON "V"."id" = "VT"."validatorId" 
    JOIN "Round" "R" ON "VT"."roundId" = "R"."id"
    LEFT JOIN "ProposerVote" "PV" ON "R"."id" = "PV"."roundId"
    WHERE "R"."roundNumber" != -1
    AND "VG"."id" = $1
    GROUP BY "R"."roundNumber", "PV"."proposerVote"
    ORDER BY "R"."roundNumber";
  `;
  return await runDatabaseQuery(query, [validatorsGroupId], 'all');
}

async function calculatePreCommitMetrics(validatorsGroupId) {
  const query = `
    WITH "ProposerVote" AS (
        SELECT "R"."id" AS "roundId", "V"."vote" AS "proposerVote"
        FROM "Votes" "V"
        JOIN "Validator" "VL" ON "V"."validatorId" = "VL"."id"
        JOIN "ValidatorsGroup" "VG" ON "VL"."validatorsGroupId" = "VG"."id"
        JOIN "Round" "R" ON "V"."roundId" = "R"."id"
        WHERE "VG"."id" = $1
        AND "V"."type" = 'prevote'
        AND "V"."validatorId" = "VG"."proposerId"
    )
    SELECT 
        "R"."roundNumber",
        SUM("V"."voting_power") FILTER (WHERE "VT"."type" = 'prevote') AS "totalVotingPowerForPrevote",
        SUM("V"."voting_power") FILTER (WHERE "VT"."type" = 'prevote' AND "VT"."vote" = "PV"."proposerVote" AND "VT"."vote" NOT IN ('nil-Vote', '000000000000')) AS "totalAgreeingVotingPowerForPrevote",
        SUM("V"."voting_power") FILTER (WHERE "VT"."type" = 'prevote' AND "VT"."vote" = 'nil-Vote') AS "totalNilvotingVotingPowerForPrevote",
        SUM("V"."voting_power") FILTER (WHERE "VT"."type" = 'prevote' AND "VT"."vote" = '000000000000') AS "totalZerovotingVotingPowerForPrevote",
        (SUM("V"."voting_power") FILTER (WHERE "VT"."type" = 'prevote' AND "VT"."vote" = "PV"."proposerVote" AND "VT"."vote" NOT IN ('nil-Vote', '000000000000')) * 100.0 / NULLIF(SUM("V"."voting_power") FILTER (WHERE "VT"."type" = 'prevote'), 0)) AS "consensusPercentage"
      FROM "ValidatorsGroup" "VG" 
    JOIN "Validator" "V" ON "VG"."id" = "V"."validatorsGroupId" 
    JOIN "Votes" "VT" ON "V"."id" = "VT"."validatorId" 
    JOIN "Round" "R" ON "VT"."roundId" = "R"."id"
    LEFT JOIN "ProposerVote" "PV" ON "R"."id" = "PV"."roundId"
    WHERE "R"."roundNumber" != -1
    AND "VG"."id" = $1
    GROUP BY "R"."roundNumber", "PV"."proposerVote"
    ORDER BY "R"."roundNumber";
  `;
  return await runDatabaseQuery(query, [validatorsGroupId], 'all');
}

async function updatePreVoteMetrics(chainId) {
  try {
    const { validatorsGroupId } = await getLatestConsensusState(chainId) || {};
    if (validatorsGroupId) {
      const currentRound = await getCurrentRound(chainId);
      console.log("Current Round: " + currentRound);
      const preVoteMetrics = await calculatePreVoteMetrics(validatorsGroupId);
      if (Array.isArray(preVoteMetrics) && preVoteMetrics.length) {
        for (let metric of preVoteMetrics) {
          await updatePreVote(metric, chainId);
        }
      } else {
        console.log("No pre-vote metrics found.");
      }

    } else {
      console.log("No latest consensus state found for chain ID.");
    }
  } catch (error) {
    console.error('Error updating PreVote metrics:', error);
    throw error;
  }
}

async function updatePreCommitMetrics(chainId) {
  try {
    const { validatorsGroupId } = await getLatestConsensusState(chainId) || {};
    if (validatorsGroupId) {
      const preCommitMetrics = await calculatePreCommitMetrics(validatorsGroupId);
      if (Array.isArray(preCommitMetrics) && preCommitMetrics.length) {
        for (let metric of preCommitMetrics) {
          await updatePreCommit(metric, chainId);
        }
      } else {
        console.log("No pre-commit metrics found.");
      }
    } else {
      console.log("No latest consensus state found for chain ID.");
    }
  } catch (error) {
    console.error('Error updating PreCommit metrics:', error);
    throw error;
  }
}

async function updateLastCommitMetrics(chainId) {
  try {
    const { validatorsGroupId } = await getLatestConsensusState(chainId);
    if (validatorsGroupId) {
      const lastCommitMetrics = await calculateLastCommitMetrics(chainId);
      if (Array.isArray(lastCommitMetrics) && lastCommitMetrics.length) {
        for (let metric of lastCommitMetrics) {
          await updateLastCommit(metric);
        }
      } else {
        console.log("No pre-commit metrics found.");
      }
    } else {
      console.log("No latest consensus state found for chain ID.");
    }
  } catch (error) {
    console.error('Error updating PreCommit metrics:', error);
    throw error;
  }
}

const updatePreVote = async (params, chainId) => {
  const round = params.roundNumber;
  const total = params.totalVotingPowerForPrevote;
  const totalAgree = params.totalAgreeingVotingPowerForPrevote;
  const totalNil = params.totalNilvotingVotingPowerForPrevote;
  const totalZero = params.totalZerovotingVotingPowerForPrevote;
  const consensusPercentage = params.consensusPercentage;
  console.log("Consensus Percentage: " + consensusPercentage)
  const query = `
  INSERT INTO "PreVote" ("round","total","totalAgree","totalNil","totalZero","consensusPercentage","chainId")
  VALUES ($1,$2,$3,$4,$5,$6,$7);
`;
  try {
    await runDatabaseQuery(query, [round, total, totalAgree, totalNil, totalZero, consensusPercentage, chainId], 'run');
    console.log(`Updated PreVote ${round}`);
  } catch (err) {
    console.error('Error updating PreVote:', err);
    throw err;
  }
};

const updatePreCommit = async (params, chainId) => {
  const round = params.roundNumber;
  const total = params.totalVotingPowerForPrevote;
  const totalAgree = params.totalAgreeingVotingPowerForPrevote;
  const totalNil = params.totalNilvotingVotingPowerForPrevote;
  const totalZero = params.totalZerovotingVotingPowerForPrevote;
  const consensusPercentage = params.consensusPercentage;
  console.log("Consensus Percentage: " + consensusPercentage)
  const query = `
  INSERT INTO "PreCommit" ("round","total","totalAgree","totalNil","totalZero","consensusPercentage","chainId")
  VALUES ($1,$2,$3,$4,$5,$6,$7);
`;
  try {
    await runDatabaseQuery(query, [round, total, totalAgree, totalNil, totalZero, consensusPercentage, chainId], 'run');
    console.log(`Updated PreCommit ${round}`);
  } catch (err) {
    console.error('Error updating PreCommit:', err);
    throw err;
  }
};


export {
  getStakingValidatorsFromDB,
  getLastStakingValidatorsMetaFromDB,
  saveMatchedValidators,
  initializeData,
  prepareChains,
  validateEndpointsAndSaveChains,
  getMatchedValidatorsFromDB,
  getChainInfosFromDB,
  saveChainInfos,
  updateConsensusStateDB,
  updateStakingValidatorsDB,
  loadConsensusStateFromDB,
  updatePreVoteMetrics,
  updatePreCommitMetrics,
  createLastCommit,
  createCurrentRound,
  createCurrentValidatorsProvider,
  createCurrentValidatorsConsumer,
  createRoundView
};
