// src/models/ConsensusState.js

export class ConsensusState {
  constructor (data, chainId = null, timestamp = new Date().toISOString()) {
    this.chainId = chainId;
    this.timestamp = timestamp;
    this.height = data.height;
    this.round = data.round;
    this.step = data.step;
    this.start_time = data.start_time;
    this.commit_time = data.commit_time;
    this.validators = data.validators ? new Validators(data.validators) : null;
    this.proposal = data.proposal;
    this.proposal_block_parts_header = data.proposal_block_parts_header;
    this.locked_block_parts_header = data.locked_block_parts_header;
    this.valid_block_parts_header = data.valid_block_parts_header;
    this.votes = data.votes;
    this.last_commit = data.last_commit;
    this.last_validators = data.last_validators ? new Validators(data.last_validators) : null;
  }
}

export class Validators {
  constructor (data) {
    this.validators = data.validators.map(validator => new Validator(validator));
    this.proposer = data.proposer ? new Validator(data.proposer) : null;
  }
}

export class Validator {
  constructor (data) {
    this.address = data.address;
    this.pub_key = data.pub_key;
    this.voting_power = data.voting_power;
    this.proposer_priority = data.proposer_priority;
  }
}
