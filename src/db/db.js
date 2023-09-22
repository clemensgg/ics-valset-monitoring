import sqlite3 from 'sqlite3';

const sqlite = sqlite3.verbose();
const db = new sqlite.Database('./icsValsetMonitoring.db', (err) => {
  if (err) {
    console.error(err.message);
  }
  console.log('Connected to the ics-valset-monitoring database.');
});

db.serialize(() => {
  // ChainInfo Table
  db.run(`
        CREATE TABLE ChainInfo (
            chainId TEXT PRIMARY KEY,
            rpcEndpoint TEXT
        );
    `);

  // ConsensusState Table
  db.run(`
        CREATE TABLE ConsensusState (
            chainId TEXT REFERENCES ChainInfo(chainId),
            timestamp TEXT,
            jsonrpc TEXT,
            resultId INTEGER,
            created_at TEXT,
            updated_at TEXT
        );
    `);

  // Result Table
  db.run(`
        CREATE TABLE Result (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            chainId TEXT REFERENCES ChainInfo(chainId),
            timestamp TEXT,
            round_stateId INTEGER,
            FOREIGN KEY (round_stateId) REFERENCES RoundState(id)
        );
    `);

  // RoundState Table
  db.run(`
        CREATE TABLE RoundState (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            chainId TEXT REFERENCES ChainInfo(chainId),
            timestamp TEXT,
            height INTEGER,
            round INTEGER,
            step TEXT,
            start_time TEXT,
            commit_time TEXT,
            validatorsId INTEGER,
            proposal TEXT,
            proposal_block_parts_header TEXT,
            locked_block_parts_header TEXT,
            valid_block_parts_header TEXT,
            votes TEXT,
            last_commit TEXT,
            last_validatorsId INTEGER,
            FOREIGN KEY (validatorsId) REFERENCES Validators(id),
            FOREIGN KEY (last_validatorsId) REFERENCES Validators(id)
        );
    `);

  // Validators Table
  db.run(`
        CREATE TABLE Validators (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            chainId TEXT REFERENCES ChainInfo(chainId),
            timestamp TEXT,
            proposerId INTEGER,
            FOREIGN KEY (proposerId) REFERENCES Validator(id)
        );
    `);

  // Validator Table
  db.run(`
        CREATE TABLE Validator (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            chainId TEXT REFERENCES ChainInfo(chainId),
            timestamp TEXT,
            address TEXT,
            pub_key TEXT,
            voting_power INTEGER,
            proposer_priority INTEGER
        );
    `);

  // Peer Table
  db.run(`
        CREATE TABLE Peer (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            chainId TEXT REFERENCES ChainInfo(chainId),
            timestamp TEXT,
            node_address TEXT,
            peer_stateId INTEGER,
            FOREIGN KEY (peer_stateId) REFERENCES PeerState(id)
        );
    `);

  // PeerState Table
  db.run(`
        CREATE TABLE PeerState (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            chainId TEXT REFERENCES ChainInfo(chainId),
            timestamp TEXT,
            round_stateId INTEGER,
            stats TEXT,
            FOREIGN KEY (round_stateId) REFERENCES RoundState(id)
        );
    `);

  // StakingValidators Table
  db.run(`
        CREATE TABLE StakingValidatorsMeta (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            chainId TEXT REFERENCES ChainInfo(chainId),
            timestamp TEXT,
            created_at TEXT,
            updated_at TEXT
        );
    `);

  // StakingValidator Table
  db.run(`
        CREATE TABLE StakingValidator (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            stakingValidatorsMetaId INTEGER REFERENCES StakingValidatorsMeta(id),
            operator_address TEXT,
            consensus_pubkey_type TEXT,
            consensus_pubkey_key TEXT,
            jailed BOOLEAN,
            status TEXT,
            tokens INTEGER,
            delegator_shares REAL,
            moniker TEXT,
            identity TEXT,
            website TEXT,
            security_contact TEXT,
            details TEXT,
            unbonding_height INTEGER,
            unbonding_time TEXT,
            commission_rate REAL,
            commission_max_rate REAL,
            commission_max_change_rate REAL,
            min_self_delegation INTEGER
        );
    `);

  // ConsensusValidator Table
  db.run(`
        CREATE TABLE ConsensusValidator (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            roundStateId INTEGER REFERENCES RoundState(id),
            address TEXT,
            pub_key TEXT,
            voting_power INTEGER,
            proposer_priority INTEGER
        );
    `);

  console.log('All tables created successfully!');
});

export default db;