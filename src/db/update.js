// src/db/update.js

import db from './db.js';

function saveStakingValidators (stakingValidators) {
  console.log('Saving stakingValidators to DB:', stakingValidators);
  return new Promise((resolve, reject) => {
    const stmt = db.prepare('INSERT INTO stakingValidators (data) VALUES (?)');
    stmt.run(JSON.stringify(stakingValidators), (err) => {
      if (err) {
        reject(err);
        return;
      }
      stmt.finalize((finalizeErr) => {
        if (finalizeErr) {
          reject(finalizeErr);
          return;
        }
        resolve();
      });
    });
  });
}

function getStakingValidatorsFromDB () {
  return new Promise((resolve, reject) => {
    db.get('SELECT data FROM stakingValidators ORDER BY id DESC LIMIT 1', [], (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      if (row && row.data) {
        const result = {
          stakingValidators: JSON.parse(row.data)
        };
        resolve(result);
      } else {
        resolve(null);
      }
    });
  });
}

function saveMatchedValidators (matchedValidators) {
  return new Promise((resolve, reject) => {
    const stmt = db.prepare('INSERT INTO matchedValidators (stakingValidator, consensusValidator) VALUES (?, ?)');

    db.serialize(() => {
      db.run('BEGIN TRANSACTION', (err) => {
        if (err) {
          reject(err);
          return;
        }

        matchedValidators.forEach(validator => {
          stmt.run(JSON.stringify(validator.stakingValidator), JSON.stringify(validator.consensusValidator));
        });

        db.run('COMMIT', (commitErr) => {
          if (commitErr) {
            reject(commitErr);
            return;
          }
          stmt.finalize((finalizeErr) => {
            if (finalizeErr) {
              reject(finalizeErr);
              return;
            }
            resolve();
          });
        });
      });
    });
  });
}

function getMatchedValidatorsFromDB () {
  return new Promise((resolve, reject) => {
    db.all('SELECT stakingValidator, consensusValidator FROM matchedValidators', [], (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      const matchedValidators = rows.map(row => ({
        stakingValidator: JSON.parse(row.stakingValidator),
        consensusValidator: JSON.parse(row.consensusValidator)
      }));
      resolve(matchedValidators);
    });
  });
}

function saveConsumerChainInfos (data) {
  return new Promise((resolve, reject) => {
    const stmt = db.prepare('INSERT INTO consumerChainInfos (data) VALUES (?)');
    stmt.run(JSON.stringify(data), (err) => {
      if (err) {
        reject(err);
        return;
      }
      stmt.finalize((finalizeErr) => {
        if (finalizeErr) {
          reject(finalizeErr);
          return;
        }
        resolve();
      });
    });
  });
}

function getConsumerChainInfosFromDB () {
  return new Promise((resolve, reject) => {
    db.get('SELECT data FROM consumerChainInfos ORDER BY id DESC LIMIT 1', [], (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(row ? JSON.parse(row.data) : null);
    });
  });
}

function saveProviderChainInfos (data) {
  return new Promise((resolve, reject) => {
    const stmt = db.prepare('INSERT INTO providerChainInfos (data) VALUES (?)');
    stmt.run(JSON.stringify(data), (err) => {
      if (err) {
        reject(err);
        return;
      }
      stmt.finalize((finalizeErr) => {
        if (finalizeErr) {
          reject(finalizeErr);
          return;
        }
        resolve();
      });
    });
  });
}

function getProviderChainInfosFromDB () {
  return new Promise((resolve, reject) => {
    db.get('SELECT data FROM providerChainInfos ORDER BY id DESC LIMIT 1', [], (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(row ? JSON.parse(row.data) : null);
    });
  });
}

export {
  saveStakingValidators,
  getStakingValidatorsFromDB,
  saveMatchedValidators,
  getMatchedValidatorsFromDB,
  getConsumerChainInfosFromDB,
  getProviderChainInfosFromDB,
  saveConsumerChainInfos,
  saveProviderChainInfos
};
