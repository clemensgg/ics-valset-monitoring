import pkg from 'pg';
import { updatePreCommitMetrics, updatePreVoteMetrics } from './update.js';
let client;

const createClient = () => {
  return new pkg.Client({
    host: CONFIG.pg.host,
    port: CONFIG.pg.port,
    user: CONFIG.pg.user,
    password: CONFIG.pg.password,
    database: CONFIG.pg.database,
    statement_timeout: CONFIG.pg.statement_timeout_ms
  });
};

const initializeClient = async () => {
  client = createClient();
  await client.connect()
    .then(() => {
      console.log('Connected to PostgreSQL database.');
      return client.query('SET CONSTRAINTS ALL IMMEDIATE;');
    })
    .catch(err => {
      console.error('Database connection failed:', err);
      process.exit(1);
    });
};

const initializeTriggerClient = async () => {
  client = createClient();
  await client.connect()
      .then(() => {
          console.log('Connected to PostgreSQL database.');
          return client.query('SET CONSTRAINTS ALL IMMEDIATE;');
      })
      .catch(err => {
          console.error('Database connection failed on trigger:', err);
          process.exit(1);
      });
  client.query('LISTEN data_change_channel');

  // Listen for notifications from PostgreSQL
  client.on('notification', async (msg) => {
      const payload = JSON.parse(msg.payload);
      console.log('Received Consensus notification:', payload);
      updatePreVoteMetrics("cosmoshub-4");
      updatePreCommitMetrics("cosmoshub-4");
  });
};

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

    // HistoricSignatures Table
    await runDatabaseQuery(`
      CREATE TABLE IF NOT EXISTS "HistoricSignatures" (
        "id" SERIAL PRIMARY KEY,
        "validatorId" BIGINT REFERENCES "Validator"("id") ON DELETE CASCADE,
        "chainId" TEXT REFERENCES "ChainInfo"("chainId") ON DELETE CASCADE,
        "height" BIGINT NOT NULL,
        "signed" BOOLEAN NOT NULL,
        "timestamp" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE ("validatorId", "chainId", "height")
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

    // Prevote Table
    await runDatabaseQuery(`
      CREATE TABLE IF NOT EXISTS "PreVote" (
        "id" SERIAL PRIMARY KEY,
        "round" INT,
        "total" BIGINT,
        "totalAgree" BIGINT,
        "totalNil" BIGINT,
        "totalZero" BIGINT,
        "consensusPercentage" FLOAT
      );
    `);

    // PreCommit Table
    await runDatabaseQuery(`
      CREATE TABLE IF NOT EXISTS "PreCommit" (
        "id" SERIAL PRIMARY KEY,
        "round" INT,
        "total" BIGINT,
        "totalAgree" BIGINT,
        "totalNil" BIGINT,
        "totalZero" BIGINT,
        "consensusPercentage" FLOAT
      );
    `);

    // Commits Table
    await runDatabaseQuery(`
      CREATE TABLE IF NOT EXISTS "Commit" (
        "id" SERIAL PRIMARY KEY,
        "proposer_address" TEXT,
        "proposer_vote" TEXT,
        "total_voting_power" BIGINT,
        "total_agree" BIGINT,
        "total_nil" BIGINT,
        "total_zero" BIGINT,
        "consensus_percentage" FLOAT
      );
    `)

  await addConstraintIfNotExists('fk_validatorsgroup1', 'ConsensusState', `
    ALTER TABLE "ConsensusState" ADD CONSTRAINT fk_validatorsgroup1
    FOREIGN KEY ("validatorsGroupId") REFERENCES "ValidatorsGroup"("id") ON DELETE CASCADE;
  `);
  
  await addConstraintIfNotExists('fk_validatorsgroup2', 'ConsensusState', `
    ALTER TABLE "ConsensusState" ADD CONSTRAINT fk_validatorsgroup2
    FOREIGN KEY ("lastValidatorsGroupId") REFERENCES "ValidatorsGroup"("id") ON DELETE CASCADE;
  `);

    console.log('All tables created successfully!');
  } catch (err) {
    console.error('Table creation failed:', err);
    throw err;
  }
  return true;
};

const createFunctionAndTrigger = async () => {
  try {
    // SQL to create a function that notifies on data change
    const createFunctionSQL = `
      CREATE OR REPLACE FUNCTION notify_change() RETURNS TRIGGER AS $$
      BEGIN
        PERFORM pg_notify('data_change_channel', row_to_json(NEW)::text);
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `;

    // SQL to create a trigger that calls the notify_change function after an insert operation
    const createTriggerSQL = `
      DROP TRIGGER IF EXISTS ConsensusState_after_insert ON "ConsensusState";
      CREATE TRIGGER ConsensusState_after_insert
      AFTER INSERT ON "ConsensusState"
      FOR EACH ROW EXECUTE FUNCTION notify_change();
    `;

    // Execute the SQL to create the function
    await client.query(createFunctionSQL);
    console.log('Function created successfully.');

    // Execute the SQL to create the trigger
    await client.query(createTriggerSQL);
    console.log('Trigger created successfully.');
  } catch (err) {
    console.error('Error creating function and trigger:', err);
  }
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
  'StakingValidator',
  'historicSignatures'
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

const doesConstraintExist = async (constraintName, tableName, schemaName = 'public') => {
  const query = `
    SELECT EXISTS (
        SELECT 1
        FROM pg_constraint con
        INNER JOIN pg_class rel ON rel.oid = con.conrelid
        INNER JOIN pg_namespace nsp ON nsp.oid = connamespace
        WHERE nsp.nspname = $1
        AND rel.relname = $2
        AND con.conname = $3
    );
  `;
  try {
    const result = await runDatabaseQuery(query, [schemaName, tableName, constraintName]);
    if (result && result.hasOwnProperty('exists')) {
      return result.exists;
    } else {
      console.error('No result returned from query');
      return false;
    }
  } catch (error) {
    console.error('Error checking constraint existence:', error);
    throw error;
  }
};

const addConstraintIfNotExists = async (constraintName, tableName, constraintSql) => {
  const exists = await doesConstraintExist(constraintName, tableName);
  if (!exists) {
    await runDatabaseQuery(constraintSql);
  }
};

// Create Tables
async function initializeDb() {
  await initializeClient()
  await createTables().catch(err => console.error('Failed to create tables:', err));
  await createFunctionAndTrigger()
}

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
  initializeDb,
  initializeTriggerClient,
  deleteAllTables,
  runDatabaseQuery,
  createFunctionAndTrigger
};