export const CONFIG = {
    PROVIDER_RPC: "https://rpc.provider-sentry-01.rs-testnet.polypore.xyz:443",
    PROVIDER_REST: "https://rest.provider-sentry-01.rs-testnet.polypore.xyz:443",
    SOVEREIGN_REST: "",
    CONSUMER_RPCS: ["https://rpc-palvus.pion-1.ntrn.tech:443", "http://juno.rpc.m.stavr.tech:1067"],
    RPC_DELAY_MS: 45,
    UPDATE_DB_FREQUENCY_MS: 600000,
    CONSENSUS_POLL_FREQENCY_MS: 500,
    NUM_WORKERS: 1,
    RETAIN_STATES: 0,
    PREFIX: 'cosmos',
    pg: {
        host: 'localhost',
        port: 5432,
        user: 'monitoring',
        password: 'monitoring',
        database: 'icsValsetMonitoring',
        statement_timeout_ms: 2000
    }
};