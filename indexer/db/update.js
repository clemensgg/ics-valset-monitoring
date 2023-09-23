// src/db/update.js

import { ConsumerChainInfo, ProviderChainInfo } from '../models/ChainInfo.js';
import {
  ConsensusState,
  Peer,
  PeerState,
  RoundState,
  Validators,
  Validator
} from '../models/ConsensusState.js';
import { StakingValidators } from '../models/StakingValidators.js';

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

async function updateConsensusStateDB (consensusState) {
  // Save RoundState
  const roundStateId = await saveRoundState(consensusState.round_state);
  return new Promise(async (resolve, reject) => {
    // Start a transaction
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');

      // // Save Peers
      // consensusState.peers.forEach(peer => {
      //   savePeer(peer);
      // });

      // Save the main ConsensusState
      const query = `
        INSERT INTO ConsensusState (chainId, timestamp, round_stateId)
        VALUES (?, ?, ?);
      `;
      const params = [
        consensusState.chainId,
        consensusState.timestamp,
        roundStateId
      ];
      db.run(query,
        params,
        function (err) {
          if (err) {
            console.log(err);
            db.run('ROLLBACK');
            reject(err);
          } else {
            console.log('deleting old entries');
            // Delete old entries except the most recent one
            deleteOldEntries(consensusState.chainId,
              this.lastID)
              .then(() => {
                db.run('COMMIT');
                resolve();
              })
              .catch(err => {
                db.run('ROLLBACK');
                reject(err);
              });
          }
        });
    });
  });
}

async function saveRoundState (roundState) {
  const query = `
    INSERT INTO RoundState (chainId, timestamp, height, round, step, start_time, commit_time, validatorsId, proposal, proposal_block_parts_header, locked_block_parts_header, valid_block_parts_header, votes, last_commit, last_validatorsId)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
  `;
  const validatorsId = await saveValidators(roundState.validators);
  const lastValidatorsId = await saveValidators(roundState.last_validators);
  const params = [
    roundState.chainId,
    roundState.timestamp,
    roundState.height,
    roundState.round,
    roundState.step,
    roundState.start_time,
    roundState.commit_time,
    validatorsId,
    roundState.proposal,
    roundState.proposal_block_parts_header,
    roundState.locked_block_parts_header,
    roundState.valid_block_parts_header,
    roundState.votes,
    roundState.last_commit,
    lastValidatorsId
  ];
  db.run(query,
    params);
  return db.lastID; // Return the ID of the inserted RoundState
}

function saveValidators (validators) {
  const query = `
    INSERT INTO Validators (chainId, timestamp, proposerId)
    VALUES (?, ?, ?);
  `;
  const proposerId = saveValidator(validators.proposer);
  const params = [
    validators.chainId,
    validators.timestamp,
    proposerId
  ];
  db.run(query,
    params);
  return db.lastID; // Return the ID of the inserted Validators
}

function saveValidator (validator) {
  const query = `
    INSERT INTO Validator (chainId, timestamp, address, pub_key, voting_power, proposer_priority)
    VALUES (?, ?, ?, ?, ?, ?);
  `;
  const params = [
    validator.chainId,
    validator.timestamp,
    validator.address,
    JSON.stringify(validator.pub_key),
    validator.voting_power,
    validator.proposer_priority
  ];
  db.run(query,
    params);
  return db.lastID; // Return the ID of the inserted Validator
}

function savePeer (peer) {
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
  db.run(query,
    params);
}

function savePeerState (peerState) {
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
  db.run(query,
    params);
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
            proposal: row.proposal,
            proposal_block_parts_header: row.proposal_block_parts_header,
            locked_block_parts_header: row.locked_block_parts_header,
            valid_block_parts_header: row.valid_block_parts_header,
            votes: row.votes,
            last_commit: row.last_commit,
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

function deleteOldEntries (chainId, currentId) {
  return new Promise((resolve, reject) => {
    // Fetch the timestamp of the most recent ConsensusState entry
    const fetchTimestampQuery = 'SELECT timestamp FROM ConsensusState WHERE id = ?';
    db.get(fetchTimestampQuery,
      [currentId],
      (err, row) => {
        if (err) {
          reject(err);
          return;
        }
        const recentTimestamp = row.timestamp;

        // Delete older ConsensusState entries
        const deleteConsensusStateQuery = 'DELETE FROM ConsensusState WHERE chainId = ? AND timestamp < ?';
        db.run(deleteConsensusStateQuery,
          [chainId, recentTimestamp],
          (err) => {
            if (err) {
              reject(err);
              return;
            }

            // Delete related data in other tables that are related to older ConsensusState entries
            const relatedTables = {
              Peer: 'consensusStateId',
              PeerState: 'peerId',
              RoundState: 'consensusStateId',
              Validators: 'roundStateId',
              Validator: 'validatorsId'
            };

            for (const [table, foreignKey] of Object.entries(relatedTables)) {
              const deleteRelatedQuery = `
            DELETE FROM ${table}
            WHERE ${foreignKey} IN (
              SELECT id FROM ConsensusState WHERE chainId = ? AND timestamp < ?
            )
          `;
              db.run(deleteRelatedQuery,
                [chainId, recentTimestamp],
                (err) => {
                  if (err) {
                    reject(err);
                  }
                });
            }
            resolve();
          });
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
