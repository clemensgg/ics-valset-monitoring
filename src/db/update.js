// src/db/update.js

import db from './db.js';

async function saveStakingValidators(stakingValidators) {
  console.log('Saving stakingValidators to DB:', stakingValidators);

  try {
      // First, insert into StakingValidatorsMeta table
      const stmtMeta = db.prepare('INSERT INTO StakingValidatorsMeta (timestamp, created_at, updated_at) VALUES (?, ?, ?)');
      
      const metaResult = await new Promise((resolve, reject) => {
          stmtMeta.run(stakingValidators.timestamp, stakingValidators.created_at, stakingValidators.updated_at, function(err) {
              if (err) reject(err);
              else resolve(this.lastID);
          });
      });

      console.log('Inserted into StakingValidatorsMeta with ID:', metaResult);

      await stmtMeta.finalize((finalizeErr) => {
        if (finalizeErr) {
            console.error('Error finalizing stmtMeta:', finalizeErr.message);
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
                console.error('Error finalizing statement:', finalizeErr.message);
            } else {
                console.log('Statement finalized successfully.');
            }
        });
      } catch (error) {
        console.error('Error finalizing VALIDATOR statement:', error);
      } 

  } catch (error) {
      console.error('Error finalizing META statement:', error);
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
                  "@type": validator.consensus_pubkey_type,
                  "key": validator.consensus_pubkey_key
                }
                validator.description = {
                  moniker: validator.moniker,
                  identity: validator.identity,
                  website: validator.website,
                  security_contact: validator.security_contact,
                  details: validator.details
                }
                validator.commission = {
                  commission_rates: {
                    rate: validator.commission_rate,
                    max_rate: validator.commission_max_rate,
                    max_change_rate: validator.commission_max_change_rate
                  },
                  update_time: validator.commission_update_time || null,
                }
              });
              resolve(result);
            });
        } else {
          resolve(null);
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
    const stmt = db.prepare('INSERT INTO ChainInfo (chainId, rpcEndpoint, type, clientIds) VALUES (?, ?, ?, ?)');

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

function getChainInfosFromDB(type) {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM ChainInfo WHERE type = ?', [type], (err, rows) => {
      if (err) {
        console.error("DB Error:", err);
        reject(err);
        return;
      }
      resolve(rows);
    });
  });
}

export {
  saveStakingValidators,
  getStakingValidatorsFromDB,
  saveMatchedValidators,
  getMatchedValidatorsFromDB,
  getChainInfosFromDB,
  saveChainInfos
};
