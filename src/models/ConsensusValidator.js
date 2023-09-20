// src/models/ConsensusValidator.js

export class ConsensusValidators {
    constructor(data) {
        this.jsonrpc = data.jsonrpc;
        this.id = data.id;
        this.result = new ValidatorsResult(data.result);
    }
}

class ValidatorsResult {
    constructor(data) {
        this.block_height = data.block_height;
        this.validators = data.validators.map(validator => new Validator(validator));
        this.count = data.count;
        this.total = data.total;
    }
}

class Validator {
    constructor(data) {
        this.address = data.address;
        this.pub_key = new PubKey(data.pub_key);
        this.voting_power = data.voting_power;
        this.proposer_priority = data.proposer_priority;
    }
}

class PubKey {
    constructor(data) {
        this.type = data.type;
        this.value = data.value;
    }
}
