import pkg from 'pg';
import { CONFIG } from '../config.js'

const { Client } = pkg;

const client = new Client({
  host: 'postgres-icsvalset',
  port: CONFIG.pg.port ?? 5432,
  user: CONFIG.pg.user ?? "monitoring",
  password: CONFIG.pg.password ?? "monitoring",
  database: CONFIG.pg.database ?? 'icsValsetMonitoring',
  statement_timeout: CONFIG.pg.statement_timeout_ms ?? 2000
});

client.connect()
  .then(() => {
    console.log('Connected to PostgreSQL database.');
    return client.query('SET CONSTRAINTS ALL IMMEDIATE;'); 
  })
  .catch(err => {
    console.error('Database connection failed:', err);
    process.exit(1); 
  });

const runDatabaseQuery = async (query, params = [], type = 'get') => {
  try {
    const result = await client.query(query, params);

    switch (type) {
      case 'all':
        return result.rows;
      case 'get':
        return result.rows[0];
      case 'full':
        return result;
      case 'delete':
        return { rowCount: result.rowCount };
      case 'run':
        if (result.command === 'INSERT' && result.rows[0] && result.rows[0].id) {
          return result.rows[0].id;
        } else {
          return { rowCount: result.rowCount, command: result.command };
        }
      case 'insert':
        if (result.rows[0] && result.rows[0].id) {
          return { lastInsertId: result.rows[0].id };
        } else {
          throw new Error('Insert did not return an id');
        }
      default:
        throw new Error(`Invalid query type: ${type}`);
    }
  } catch (err) {
    console.error('Database query failed:', err);
    return null;
  }
};
  

const createTables = async () => {
  try {
    const existingTables = await checkTablesExist();
    if (existingTables.length === tableNames.length) {
      console.log('All tables already exist. Skipping table creation.');
      return false;
    }

    // ChainInfo Table
    await runDatabaseQuery(`
      CREATE TABLE IF NOT EXISTS "ChainInfo" (
        "id" SERIAL PRIMARY KEY,
        "chainId" TEXT UNIQUE NOT NULL,
        "rpcEndpoint" TEXT NOT NULL,
        "type" TEXT CHECK("type" IN ('provider', 'consumer', NULL)),
        "clientIds" TEXT
      );
    `);

    // StakingValidatorsMeta Table
    await runDatabaseQuery(`
      CREATE TABLE IF NOT EXISTS "StakingValidatorsMeta" (
        "id" SERIAL PRIMARY KEY,
        "chainId" TEXT REFERENCES "ChainInfo"("chainId") ON DELETE CASCADE,
        "timestamp" TEXT,
        "created_at" TEXT,
        "updated_at" TEXT
      );
    `);

    // ConsensusState Table
    await runDatabaseQuery(`
      CREATE TABLE IF NOT EXISTS "ConsensusState" (
        "id" SERIAL PRIMARY KEY,
        "chainId" TEXT REFERENCES "ChainInfo"("chainId") ON DELETE CASCADE,
        "timestamp" TEXT,
        "height" BIGINT,
        "round" BIGINT,
        "step" TEXT,
        "start_time" TEXT,
        "commit_time" TEXT,
        "validatorsGroupId" BIGINT,
        "lastValidatorsGroupId" BIGINT,
        "proposal" TEXT,
        "proposal_block_parts_header" TEXT,
        "locked_block_parts_header" TEXT,
        "valid_block_parts_header" TEXT,
        "votes" TEXT,
        "last_commit" TEXT
      );
    `);

    // ValidatorsGroup Table
    await runDatabaseQuery(`
      CREATE TABLE IF NOT EXISTS "ValidatorsGroup" (
        "id" SERIAL PRIMARY KEY,
        "type" TEXT,
        "consensusStateId" BIGINT REFERENCES "ConsensusState"("id") ON DELETE CASCADE,
        "proposerId" BIGINT
      );
    `);

    // RoundsGroup Table
    await runDatabaseQuery(`
      CREATE TABLE IF NOT EXISTS "RoundsGroup" (
        "id" SERIAL PRIMARY KEY,
        "consensusStateId" BIGINT REFERENCES "ConsensusState"("id") ON DELETE CASCADE,
        "type" TEXT
      );
    `);

    // Validator Table
    await runDatabaseQuery(`
      CREATE TABLE IF NOT EXISTS "Validator" (
        "id" SERIAL PRIMARY KEY,
        "validatorsGroupId" BIGINT NOT NULL REFERENCES "ValidatorsGroup"("id") ON DELETE CASCADE,
        "address" TEXT NOT NULL,
        "pub_key" TEXT NOT NULL,
        "consensusAddress" TEXT NOT NULL,
        "voting_power" BIGINT NOT NULL,
        "proposer_priority" BIGINT NOT NULL
      );
    `);

    // Round Table
    await runDatabaseQuery(`
      CREATE TABLE IF NOT EXISTS "Round" (
        "id" SERIAL PRIMARY KEY,
        "roundsGroupId" BIGINT REFERENCES "RoundsGroup"("id") ON DELETE CASCADE,
        "roundNumber" BIGINT
      );
    `);

    // Votes Table
    await runDatabaseQuery(`
      CREATE TABLE IF NOT EXISTS "Votes" (
        "id" SERIAL PRIMARY KEY,
        "validatorId" BIGINT NOT NULL REFERENCES "Validator"("id") ON DELETE CASCADE,
        "roundId" BIGINT NOT NULL REFERENCES "Round"("id") ON DELETE CASCADE,
        "type" TEXT NOT NULL CHECK("type" IN ('prevote', 'precommit', 'lastcommit')),
        "vote" TEXT NOT NULL,
        "voteString" TEXT NOT NULL
      );
    `);

    // StakingValidator Table
    await runDatabaseQuery(`
      CREATE TABLE IF NOT EXISTS "StakingValidator" (
        "id" SERIAL PRIMARY KEY,
        "stakingValidatorsMetaId" BIGINT REFERENCES "StakingValidatorsMeta"("id") ON DELETE CASCADE,
        "operator_address" TEXT,
        "consensus_pubkey_type" TEXT,
        "consensus_pubkey_key" TEXT,
        "consumer_signing_keys" TEXT,
        "jailed" BOOLEAN,
        "status" TEXT,
        "tokens" BIGINT,
        "delegator_shares" REAL,
        "moniker" TEXT,
        "identity" TEXT,
        "website" TEXT,
        "security_contact" TEXT,
        "details" TEXT,
        "unbonding_height" BIGINT,
        "unbonding_time" TEXT,
        "commission_rate" REAL,
        "commission_max_rate" REAL,
        "commission_max_change_rate" REAL,
        "min_self_delegation" BIGINT
      );
    `);

    await runDatabaseQuery(`ALTER TABLE "ConsensusState" ADD CONSTRAINT fk_validatorsgroup1
      FOREIGN KEY ("validatorsGroupId") REFERENCES "ValidatorsGroup"("id") ON DELETE CASCADE;`);

    await runDatabaseQuery(`ALTER TABLE "ConsensusState" ADD CONSTRAINT fk_validatorsgroup2
      FOREIGN KEY ("lastValidatorsGroupId") REFERENCES "ValidatorsGroup"("id") ON DELETE CASCADE;`);

    console.log('All tables created successfully!');
  } catch (err) {
    console.error('Table creation failed:', err);
    throw err;
  }
  return true;
};

const tableNames = [
  'ChainInfo',
  'ConsensusState',
  'RoundsGroup',
  'Round',
  'ValidatorsGroup',
  'Validator',
  'Votes',
  'StakingValidatorsMeta',
  'StakingValidator'
];

const checkTablesExist = async () => {
  const query = `
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name IN (${tableNames.map((_, i) => `$${i + 1}`).join(', ')});
  `;
  const existingTables = await runDatabaseQuery(query, tableNames, 'all');
  return existingTables.map(row => row.table_name);
};

// Create Tables
await createTables().catch(err => console.error('Failed to create tables:', err));

const deleteAllTables = async () => {
  const dropTablesQuery = `
    DROP TABLE IF EXISTS 
      "StakingValidator", 
      "StakingValidatorsMeta", 
      "Votes", 
      "Validator", 
      "ValidatorsGroup", 
      "Round", 
      "RoundsGroup", 
      "ConsensusState", 
      "ChainInfo" 
    CASCADE;
  `;

  try {
    const result = await client.query(dropTablesQuery);
    console.log('query executed: ', result.command);
    console.log('All tables deleted successfully.');
  } catch (err) {
    console.error('Error deleting tables:', err);
  } finally {
    await client.end();
  }
};

process.on('exit', (code) => {
  client.end()
    .then(() => console.log('Closed PostgreSQL database connection.'))
    .catch(err => console.error('Error while closing PostgreSQL connection:', err));
});

export {
  deleteAllTables,
  runDatabaseQuery
};