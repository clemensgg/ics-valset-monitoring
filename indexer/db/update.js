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

import db from './db.js';

async function saveStakingValidators (stakingValidators) {
  console.log('Saving stakingValidators to DB:',
    stakingValidators);

  try {
    // First, insert into StakingValidatorsMeta table
    const stmtMeta = db.prepare('INSERT INTO StakingValidatorsMeta (timestamp, created_at, updated_at) VALUES (?, ?, ?)');

    const metaResult = await new Promise((resolve, reject) => {
      stmtMeta.run(stakingValidators.timestamp,
        stakingValidators.created_at,
        stakingValidators.updated_at,
        function (err) {
          if (err) reject(err);
          else resolve(this.lastID);
        });
    });

    console.log('Inserted into StakingValidatorsMeta with ID:',
      metaResult);

    await stmtMeta.finalize((finalizeErr) => {
      if (finalizeErr) {
        console.error('Error finalizing stmtMeta:',
          finalizeErr.message);
      } else {
        console.log('stmtMeta finalized successfully.');
      }
    });

    // Now, insert each validator into StakingValidator table
    const stmtValidator = db.prepare(`
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
      `);

    for (const validator of stakingValidators.validators) {
      await new Promise((resolve, reject) => {
        stmtValidator.run(
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
          validator.min_self_delegation,
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });
    }

    try {
      stmtValidator.finalize((finalizeErr) => {
        if (finalizeErr) {
          console.error('Error finalizing statement:',
            finalizeErr.message);
        } else {
          console.log('Statement finalized successfully.');
        }
      });
    } catch (error) {
      console.error('Error finalizing VALIDATOR statement:',
        error);
    }
  } catch (error) {
    console.error('Error finalizing META statement:',
      error);
  }
}

function getStakingValidatorsFromDB () {
  return new Promise((resolve, reject) => {
    // Get the latest StakingValidatorsMeta entry
    db.get('SELECT * FROM StakingValidatorsMeta ORDER BY id DESC LIMIT 1',
      [],
      (err, metaRow) => {
        if (err) {
          reject(err);
          return;
        }
        if (metaRow) {
        // Get all StakingValidator entries associated with the latest meta entry
          db.all('SELECT * FROM StakingValidator WHERE stakingValidatorsMetaId = ?',
            [metaRow.id],
            (err, validatorRows) => {
              if (err) {
                reject(err);
                return;
              }
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
              resolve(result);
            });
        } else {
          resolve([]);
        }
      });
  });
}

function saveMatchedValidators (matchedValidators) {
  console.log('Saving matchedValidators to DB:',
    matchedValidators);
  return new Promise((resolve, reject) => {
    // Insert into MatchedValidators table
    const stmt = db.prepare('INSERT INTO MatchedValidators (chainId, timestamp, created_at, updated_at) VALUES (?, ?, ?, ?)');
    stmt.run(matchedValidators.chainId,
      matchedValidators.timestamp,
      new Date().toISOString(),
      new Date().toISOString(),
      (err) => {
        if (err) {
          reject(err);
          return;
        }
        const matchedId = this.lastID; // ID of the last inserted row

        // Now, insert each validator into MatchedValidatorDetail table
        const stmtDetail = db.prepare('INSERT INTO MatchedValidatorDetail (matchedValidatorsId, operator_address, consensus_address) VALUES (?, ?, ?)');
        matchedValidators.validators.forEach(validator => {
          stmtDetail.run(matchedId,
            validator.operator_address,
            validator.consensus_address,
            (err) => {
              if (err) {
                reject(err);
              }
            });
        });

        stmtDetail.finalize((finalizeErr) => {
          if (finalizeErr) {
            reject(finalizeErr);
            return;
          }
          resolve();
        });
      });
  });
}

function getMatchedValidatorsFromDB () {
  return new Promise((resolve, reject) => {
    // Get the latest MatchedValidators entry
    db.get('SELECT * FROM MatchedValidators ORDER BY id DESC LIMIT 1',
      [],
      (err, matchedRow) => {
        if (err) {
          reject(err);
          return;
        }
        if (matchedRow) {
        // Get all MatchedValidatorDetail entries associated with the latest matched entry
          db.all('SELECT * FROM MatchedValidatorDetail WHERE matchedValidatorsId = ?',
            [matchedRow.id],
            (err, validatorRows) => {
              if (err) {
                reject(err);
                return;
              }
              const result = {
                chainId: matchedRow.chainId,
                timestamp: matchedRow.timestamp,
                validators: validatorRows
              };
              resolve(result);
            });
        } else {
          resolve(null);
        }
      });
  });
}

function saveChainInfos (chainInfos, type) {
  console.log(`Saving ${type}ChainInfos to DB:`,
    chainInfos);
  return new Promise((resolve, reject) => {
    const stmt = db.prepare('INSERT OR REPLACE INTO ChainInfo (chainId, rpcEndpoint, type, clientIds) VALUES (?, ?, ?, ?)');

    chainInfos.forEach(info => {
      // Convert clientIds array to a JSON string for storage
      const clientIdsString = JSON.stringify(info.clientIds);

      stmt.run(info.chainId,
        info.rpcEndpoint,
        type,
        clientIdsString,
        (err) => {
          if (err) {
            console.error(`Error inserting ${type}ChainInfo with chainId ${info.chainId}:`,
              err.message);
            reject(err);
          // Exit the loop on encountering an error
          } else {
            console.log(`Successfully inserted ${type}ChainInfo with chainId ${info.chainId}`);
          }
        });
    });

    stmt.finalize((finalizeErr) => {
      if (finalizeErr) {
        console.error('Error finalizing statement:',
          finalizeErr.message);
        reject(finalizeErr);
      } else {
        console.log('Statement finalized successfully.');
        resolve();
      }
    });
  });
}

function getChainInfosFromDB (type) {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM ChainInfo WHERE type = ?',
      [type],
      (err, rows) => {
        if (err) {
          console.error('DB Error:',
            err);
          reject(err);
          return;
        }
        resolve(rows);
      });
  });
}

/// ///////////////////////////////////// TODO

async function updateConsensusStateDB(consensusState) {
  console.log("updateConsensusStateDB called with consensusState:", consensusState);
  try {
    console.log("Starting DB Transaction...");
    await db.run('BEGIN TRANSACTION');
    console.log("Started DB Transaction.");

    let roundStateId;
    try {
      roundStateId = await saveRoundState(consensusState.round_state);
      console.log("[DEBUG] RoundStateId for chain", consensusState.chainId, ":", roundStateId);
    } catch (err) {
      console.error("Error in saveRoundState:", err);
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

    console.log("Inserting into ConsensusState...");
    try {
      await db.run(query, params);
    } catch (err) {
      console.error("[DEBUG] Error on QUERY:", query, params);
      throw err;
    }
    console.log("Inserted into ConsensusState.");

    // Commit the transaction to persist the changes
    console.log("Committing DB Transaction...");
    try {
      await db.run('COMMIT');
    } catch (err) {
      console.error("[DEBUG] Error on COMMIT");
      throw err;
    }
    console.log("Committed DB Transaction.");

    // Get the last inserted row ID using the last_insert_rowid() function
    const lastInsertedRowID = await new Promise((resolve, reject) => {
      db.get('SELECT last_insert_rowid() as lastID', (err, row) => {
        if (err) {
          console.error("Error getting last inserted row ID:", err);
          resolve(null);
        } else {
          const lastID = row.lastID;
          console.log("Last inserted row ID:", lastID);
          resolve(lastID);
        }
      });
    });

    let lastInsertedTimestamp = null;

    if (lastInsertedRowID) {
      const timestampQuery = `SELECT timestamp FROM ConsensusState WHERE id = ?`;
      lastInsertedTimestamp = await new Promise((resolve, reject) => {
        db.get(timestampQuery, [lastInsertedRowID], (err, row) => {
          if (err) {
            console.error("Error getting timestamp for last inserted row:", err);
            resolve(null);
          } else {
            console.log("Timestamp for last inserted row:", row.timestamp);
            resolve(row.timestamp);
          }
        });
      });
    }

    if (lastInsertedTimestamp) {
      console.log('deleting old entries');
      await deleteOldEntries(lastInsertedTimestamp, consensusState.chainId);
    }

  } catch (err) {
    console.error("Error in updateConsensusStateDB:", err);
    try {
      await db.run('ROLLBACK');
    } catch (err) {
      console.error("[DEBUG] Error on ROLLBACK");
      throw err;
    }
    throw err;
  }
}

async function saveVotesAndCommits(roundState, roundStateId) {
  // Save votes for each validator
  for (let i = 0; i < roundState.validators.length; i++) {
      const validator = roundState.validators[i];
      const vote = roundState.votes[i];
      await saveVote(validator, vote, 'prevote', roundStateId);
  }

  // Save last_commit votes for each validator
  for (let i = 0; i < roundState.last_validators.length; i++) {
      const validator = roundState.last_validators[i];
      const vote = roundState.last_commit.votes[i];
      await saveVote(validator, vote, 'precommit', roundStateId);
  }

  const last_commit_height = roundState.height - 1;
  await saveCommit(roundState.last_commit, roundStateId, last_commit_height);
}

async function saveRoundState(roundState) {
  console.log("Starting saveRoundState...");

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
      null,  // Temporarily set to null, will update later
      JSON.stringify(roundState.proposal),
      JSON.stringify(roundState.proposal_block_parts_header),
      JSON.stringify(roundState.locked_block_parts_header),
      JSON.stringify(roundState.valid_block_parts_header),
      JSON.stringify(roundState.votes),
      JSON.stringify(roundState.last_commit),
      null   // Temporarily set to null, will update later
  ];

  const roundStateId = await new Promise((resolve, reject) => {
      db.run(query, params, function(err) {
          if (err) {
              console.error("Error in saveRoundState:", err);
              reject(err);
          } else {
              console.log("RoundState ID:", this.lastID);
              resolve(this.lastID);
          }
      });
  });

  const validatorsGroupId = await saveValidators(roundState.validators, roundStateId);
  const lastValidatorsGroupId = await saveValidators(roundState.last_validators, roundStateId);

  // Update the RoundState with the correct validatorsGroupId and lastValidatorsGroupId
  const updateQuery = `
      UPDATE RoundState
      SET validatorsGroupId = ?, lastValidatorsGroupId = ?
      WHERE id = ?;
  `;

  const updateParams = [validatorsGroupId, lastValidatorsGroupId, roundStateId];

  await new Promise((resolve, reject) => {
      db.run(updateQuery, updateParams, function(err) {
          if (err) {
              console.error("Error updating RoundState:", err);
              reject(err);
          } else {
              console.log("Updated RoundState ID:", this.lastID);
              resolve();
          }
      });
  });

  // Save votes and commits
  await saveVotesAndCommits(roundState, roundStateId);

  return roundStateId;
}


async function saveValidators(validators, roundStateId) {
  console.log("Starting saveValidators...");

  const validatorsGroupId = await saveValidatorsGroup(validators, roundStateId);

  for (let validator of validators.validators) {
      await saveValidator(validator, validatorsGroupId);
  }

  return validatorsGroupId;
}

async function saveValidatorsGroup(validators, roundStateId) {
  const query = `
      INSERT INTO ValidatorsGroup (chainId, timestamp, roundStateId)
      VALUES (?, ?, ?);
  `;
  const params = [
      validators.chainId,
      validators.timestamp,
      roundStateId
  ];

  const validatorsGroupId = await new Promise((resolve, reject) => {
      db.run(query, params, function(err) {
          if (err) {
              console.error("Error in saveValidatorsGroup:", err);
              reject(err);
          } else {
              console.log("ValidatorsGroup ID:", this.lastID);
              resolve(this.lastID);
          }
      });
  });

  return validatorsGroupId;
}

async function saveValidator(validator, validatorsGroupId) {
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

  await new Promise((resolve, reject) => {
      db.run(query, params, function(err) {
          if (err) {
              console.error("Error in saveValidator:", err);
              reject(err);
          } else {
              resolve(this.lastID);
          }
      });
  });
}

async function saveVote(validator, vote, type, roundStateId) {
  const query = `
      INSERT INTO Votes (validatorId, type, vote, roundStateId)
      VALUES (?, ?, ?, ?);
  `;
  const params = [
      validator.address,  // Using the address as the unique identifier
      type,
      JSON.stringify(vote),  // Assuming vote is an object
      roundStateId
  ];

  await new Promise((resolve, reject) => {
      db.run(query, params, function(err) {
          if (err) {
              console.error("Error in saveVote:", err);
              reject(err);
          } else {
              resolve(this.lastID);
          }
      });
  });
}

async function saveCommit(commit, roundStateId, height) {
  const query = `
      INSERT OR REPLACE INTO Commits (height, votes_bit_array, roundStateId)
      VALUES (?, ?, ?);
  `;
  const params = [
      height,
      JSON.stringify(commit.votes_bit_array),
      roundStateId
  ];

  await new Promise((resolve, reject) => {
      db.run(query, params, function(err) {
          if (err) {
              console.error("Error in saveCommit:", err);
              reject(err);
          } else {
              resolve(this.lastID);
          }
      });
  });
}

async function savePeer (peer) {
  const query = `
    INSERT INTO Peer (chainId, timestamp, node_address, peer_stateId)
    VALUES (?, ?, ?, ?);
  `;
  const peerStateId = savePeerState(peer.peer_state);
  const params = [
    peer.chainId,
    peer.timestamp,
    peer.node_address,
    peerStateId
  ];
  try {
    await db.run(query, params);
  } catch (err) {
    console.error("[DEBUG] Error on QUERY:", query, params);
    throw err;
  }
}

async function savePeerState (peerState) {
  const query = `
    INSERT INTO PeerState (chainId, timestamp, round_stateId, stats)
    VALUES (?, ?, ?, ?);
  `;
  const roundStateId = saveRoundState(peerState.round_state);
  const params = [
    peerState.chainId,
    peerState.timestamp,
    roundStateId,
    peerState.stats
  ];
  try {
    await db.run(query, params);
  } catch (err) {
    console.error("[DEBUG] Error on QUERY:", query, params);
    throw err;
  }
  return db.lastID; // Return the ID of the inserted PeerState
}

async function loadConsensusStateFromDB (chainId) {
  return new Promise((resolve, reject) => {
    const query = 'SELECT * FROM ConsensusState WHERE chainId = ?';
    db.get(query,
      [chainId],
      async (err, row) => {
        if (err) {
          reject(err);
        } else if (row) {
          const roundState = await loadRoundState(row.round_stateId);
          const peers = await loadPeers(chainId);
          const consensusStateData = {
            round_state: roundState,
            peers: peers
          };
          resolve(new ConsensusState(consensusStateData,
            chainId,
            row.timestamp));
        } else {
          resolve(null);
        }
      });
  });
}

async function loadRoundState (id) {
  return new Promise((resolve, reject) => {
    const query = 'SELECT * FROM RoundState WHERE id = ?';
    db.get(query,
      [id],
      async (err, row) => {
        if (err) {
          reject(err);
        } else {
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
          resolve(new RoundState(roundStateData,
            row.chainId,
            row.timestamp));
        }
      });
  });
}

async function loadValidators (id) {
  return new Promise((resolve, reject) => {
    const query = 'SELECT * FROM Validators WHERE id = ?';
    db.get(query,
      [id],
      async (err, row) => {
        if (err) {
          reject(err);
        } else {
          const validatorsList = await loadValidatorList(row.chainId);
          const proposer = validatorsList.find(validator => validator.id === row.proposerId);
          const validatorsData = {
            validators: validatorsList,
            proposer: proposer
          };
          resolve(new Validators(validatorsData,
            row.chainId,
            row.timestamp));
        }
      });
  });
}

async function loadValidatorList (chainId) {
  return new Promise((resolve, reject) => {
    const query = 'SELECT * FROM Validator WHERE chainId = ?';
    db.all(query,
      [chainId],
      (err, rows) => {
        if (err) {
          reject(err);
        } else {
          const validators = rows.map(row => new Validator({
            address: row.address,
            pub_key: JSON.parse(row.pub_key),
            voting_power: row.voting_power,
            proposer_priority: row.proposer_priority
          },
          row.chainId,
          row.timestamp));
          resolve(validators);
        }
      });
  });
}

async function loadPeers (chainId) {
  return new Promise((resolve, reject) => {
    const query = 'SELECT * FROM Peer WHERE chainId = ?';
    db.all(query,
      [chainId],
      async (err, rows) => {
        if (err) {
          reject(err);
        } else {
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
          resolve(peers);
        }
      });
  });
}

async function loadPeerState (id) {
  return new Promise((resolve, reject) => {
    const query = 'SELECT * FROM PeerState WHERE id = ?';
    db.get(query,
      [id],
      async (err, row) => {
        if (err) {
          reject(err);
        } else {
          const roundState = await loadRoundState(row.round_stateId);
          const peerStateData = {
            round_state: roundState,
            stats: row.stats
          };
          resolve(new PeerState(peerStateData,
            row.chainId,
            row.timestamp));
        }
      });
  });
}

async function deleteOldEntries(olderThanTimestamp, chainId) {
  console.log(`Deleting entries older than: ${olderThanTimestamp} for chainId: ${chainId}`);

  // Fetch old RoundState IDs to be pruned
  const selectOldRoundStateIdsQuery = `
      SELECT id 
      FROM RoundState 
      WHERE timestamp < ? AND chainId = ?
  `;

  const oldRoundStateIdsResult = await queryDatabase(selectOldRoundStateIdsQuery, [olderThanTimestamp, chainId], true);
  const oldRoundStateIds = oldRoundStateIdsResult.map(entry => entry.id);
  if (oldRoundStateIds.length === 0) {
      console.log("No old RoundState entries found");
      return;
  }
  console.log(`Deleting RoundState entries with IDs: ${oldRoundStateIds.join(", ")}`);

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
          WHERE ${foreignKey} IN (${oldRoundStateIds.join(",")})
      `;

      const result = await runDatabaseQuery(deleteRelatedQuery);
      const deletedCount = result.changes || 0;
      console.log(`Deleted ${deletedCount} old entries from ${table}`);
  }

  // Delete old RoundState entries
  const deleteRoundStateQuery = `
      DELETE FROM RoundState 
      WHERE id IN (${oldRoundStateIds.join(",")})
  `;
  await runDatabaseQuery(deleteRoundStateQuery);
  console.log(`Deleted old RoundState entries with IDs: ${oldRoundStateIds.join(", ")}`);

  // Handle ConsensusState
  // Fetch old ConsensusState IDs to be pruned
  const selectOldConsensusIdsQuery = `
      SELECT id 
      FROM ConsensusState 
      WHERE timestamp < ? AND chainId = ?
  `;
  const oldConsensusIdsResult = await queryDatabase(selectOldConsensusIdsQuery, [olderThanTimestamp, chainId], true);
  const oldConsensusIds = oldConsensusIdsResult.map(entry => entry.id);
  
  if (oldConsensusIds.length > 0) {
      console.log(`Deleting ConsensusState entries with IDs: ${oldConsensusIds.join(", ")}`);
      // Delete old ConsensusState entries
      const deleteConsensusStateQuery = `
          DELETE FROM ConsensusState 
          WHERE id IN (${oldConsensusIds.join(",")})
      `;
      await runDatabaseQuery(deleteConsensusStateQuery);
      console.log(`Deleted old ConsensusState entries with IDs: ${oldConsensusIds.join(", ")}`);
  } else {
      console.log("No old ConsensusState entries found");
  }
}



async function queryDatabase(query, params, all = false) {
  return new Promise((resolve, reject) => {
      const callback = (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
      };

      if (all) {
          db.all(query, params, callback);
      } else {
          db.get(query, params, callback);
      }
  });
}

async function runDatabaseQuery(query) {
  return new Promise((resolve, reject) => {
      db.run(query, function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
      });
  });
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
