export const CONFIG = {
    PROVIDER_RPC: "http://65.108.127.249:2001",
    PROVIDER_REST: "http://65.108.127.249:2004",
    SOVEREIGN_REST: "https://lcd-juno.validavia.me",
    CONSUMER_RPCS: ["http://65.108.127.249:3001", "http://juno.rpc.m.stavr.tech:1067"],
    RPC_DELAY_MS: 45,
    UPDATE_DB_FREQUENCY_MS: 60000,
    CONSENSUS_POLL_FREQENCY_MS: 500,
    NUM_WORKERS: 1,
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