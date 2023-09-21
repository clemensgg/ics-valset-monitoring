// src/models/ConsensusValidator.js

export class ConsensusValidators {
    constructor(data) {
        this.jsonrpc = data.jsonrpc;
        this.id = data.id;
        this.result = data.result ? new ValidatorsResult(data.result) : null;
    }
}

class ValidatorsResult {
    constructor(data) {
        this.block_height = data.block_height || null;
        this.validators = data.validators ? data.validators.map(validator => new Validator(validator)) : [];
        this.count = data.count || null;
        this.total = data.total || null;
    }
}

class Validator {
    constructor(data) {
        this.address = data.address || null;
        this.pub_key = data.pub_key ? new PubKey(data.pub_key) : null;
        this.voting_power = data.voting_power || null;
        this.proposer_priority = data.proposer_priority || null;
    }
}

class PubKey {
    constructor(data) {
        this.type = data.type || null;
        this.value = data.value || null;
    }
}