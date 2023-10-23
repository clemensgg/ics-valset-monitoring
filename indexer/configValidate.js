import Joi from 'joi';

const CONFIGSchema = Joi.object({
    PROVIDER_RPC: Joi.string().required(),
    PROVIDER_REST: Joi.string().required(),
    SOVEREIGN_REST: Joi.string().required(),
    CONSUMER_RPCS: Joi.array().items(Joi.string()).required(),
    RPC_DELAY_MS: Joi.number().required(),
    UPDATE_DB_FREQUENCY_MS: Joi.number().required(),
    CONSENSUS_POLL_FREQENCY_MS: Joi.number().required(),
    NUM_WORKERS: Joi.number().required(),
    RETAIN_STATES: Joi.number().required(),
    PREFIX: Joi.string().required(),
    pg: Joi.object({
        port: Joi.number().required(),
        user: Joi.string().required(),
        password: Joi.string().required(),
        database: Joi.string().required(),
        statement_timeout_ms: Joi.number().required(),
    }).required()
}).required();

export function validateCONFIG(config) {
    const { error, value } = CONFIGSchema.validate(config);
    
    if (error) {
        throw new Error(`Config validation error: ${error.message}`);
    }
    return value;
}