export const CONFIG = {
    PROVIDER_RPC: process.env.PROVIDER_RPC,
    PROVIDER_REST: process.env.PROVIDER_REST,
    SOVEREIGN_REST: process.env.SOVEREIGN_REST,
    CONSUMER_RPCS: JSON.parse(process.env.CONSUMER_RPCS),
    RPC_DELAY_MS: 45,
    UPDATE_DB_FREQUENCY_MS: 300000,
    CONSENSUS_POLL_FREQENCY_MS: 500,
    NUM_WORKERS: process.env.NUM_WORKERS ?? 1,
    RETAIN_STATES: 0,
    PREFIX: 'cosmos',
    pg: {
        port: 5432,
        user: 'monitoring',
        password: 'monitoring',
        database: 'icsValsetMonitoring',
        statement_timeout_ms: 2000
    }
};