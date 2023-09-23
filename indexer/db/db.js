import sqlite3 from 'sqlite3';

const sqlite = sqlite3.verbose();
const db = new sqlite.Database('./icsValsetMonitoring.db',
  (err) => {
    if (err) {
      console.error(err.message);
    }
    console.log('Connected to the ics-valset-monitoring database.');
  });

db.on('error',
  err => {
    console.error('Database error:',
      err);
  });

db.serialize(() => {
  // ChainInfo Table
  db.run(`
    CREATE TABLE IF NOT EXISTS ChainInfo (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chainId TEXT UNIQUE NOT NULL,
      rpcEndpoint TEXT NOT NULL,
      type TEXT CHECK(type IN ('provider', 'consumer', NULL)),
      clientIds TEXT
    );
  `);

  // ConsensusState Table
  db.run(`
  CREATE TABLE IF NOT EXISTS ConsensusState (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chainId TEXT REFERENCES ChainInfo(chainId),
    timestamp TEXT,
    round_stateId INTEGER REFERENCES RoundState(id)
  );
  `);

  // RoundState Table
  db.run(`
  CREATE TABLE IF NOT EXISTS RoundState (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    consensusStateId INTEGER REFERENCES ConsensusState(id),
    height INTEGER,
    round INTEGER,
    step TEXT,
    start_time TEXT,
    commit_time TEXT,
    validatorsId INTEGER REFERENCES Validators(id),
    last_validatorsId INTEGER REFERENCES Validators(id),
    proposal TEXT,
    proposal_block_parts_header TEXT,
    locked_block_parts_header TEXT,
    valid_block_parts_header TEXT,
    votes TEXT,
    last_commit TEXT
  );
  `);

  // Validators Table
  db.run(`
  CREATE TABLE IF NOT EXISTS Validators (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chainId TEXT REFERENCES ChainInfo(chainId),
    timestamp TEXT,
    roundStateId INTEGER REFERENCES RoundState(id),
    proposerId INTEGER REFERENCES Validator(id)
  );
  `);

  // Validator Table
  db.run(`
  CREATE TABLE IF NOT EXISTS Validator (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    validatorsId INTEGER REFERENCES Validators(id),
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
  CREATE TABLE IF NOT EXISTS Peer (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    consensusStateId INTEGER REFERENCES ConsensusState(id),
    chainId TEXT REFERENCES ChainInfo(chainId),
    timestamp TEXT,
    node_address TEXT
  );
  `);

  // PeerState Table
  db.run(`
  CREATE TABLE IF NOT EXISTS PeerState (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    peerId INTEGER REFERENCES Peer(id),
    chainId TEXT REFERENCES ChainInfo(chainId),
    timestamp TEXT,
    stats TEXT
  );
  `);

  // StakingValidators Table
  db.run(`
        CREATE TABLE IF NOT EXISTS StakingValidatorsMeta (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT,
            created_at TEXT,
            updated_at TEXT
        );
    `);

  // StakingValidator Table
  db.run(`
        CREATE TABLE IF NOT EXISTS StakingValidator (
            id INTEGER PRIMARY KEY,
            stakingValidatorsMetaId INTEGER REFERENCES StakingValidatorsMeta(id),
            operator_address TEXT,
            consensus_pubkey_type TEXT,
            consensus_pubkey_key TEXT,
            consumer_signing_keys TEXT,
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
        CREATE TABLE IF NOT EXISTS ConsensusValidator (
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