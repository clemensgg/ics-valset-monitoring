// src/models/ConsensusState.js

export class ConsensusState {
  constructor (data, chainId = null, timestamp = new Date().toISOString()) {
    this.chainId = chainId;
    this.timestamp = timestamp;
    this.jsonrpc = data.jsonrpc;
    this.result = data.result
      ? new Result(data.result,
        chainId,
        timestamp)
      : null;
    this.created_at = timestamp;
    this.updated_at = timestamp;
  }
}

class Result {
  constructor (data, chainId, timestamp) {
    this.chainId = chainId;
    this.timestamp = timestamp;
    this.round_state = data.round_state
      ? new RoundState(data.round_state,
        chainId,
        timestamp)
      : null;
    this.peers = data.peers
      ? data.peers.map(peer => new Peer(peer,
        chainId,
        timestamp))
      : [];
  }
}

class RoundState {
  constructor (data, chainId, timestamp) {
    this.chainId = chainId;
    this.timestamp = timestamp;
    this.height = data.height;
    this.round = data.round;
    this.step = data.step;
    this.start_time = data.start_time;
    this.commit_time = data.commit_time;
    this.validators = data.validators
      ? new Validators(data.validators,
        chainId,
        timestamp)
      : null;
    this.proposal = data.proposal;
    this.proposal_block_parts_header = data.proposal_block_parts_header;
    this.locked_block_parts_header = data.locked_block_parts_header;
    this.valid_block_parts_header = data.valid_block_parts_header;
    this.votes = data.votes;
    this.last_commit = data.last_commit;
    this.last_validators = data.last_validators
      ? new Validators(data.last_validators,
        chainId,
        timestamp)
      : null;
  }
}

class Validators {
  constructor (data, chainId, timestamp) {
    this.chainId = chainId;
    this.timestamp = timestamp;
    this.validators = data.validators.map(validator => new Validator(validator,
      chainId,
      timestamp));
    this.proposer = data.proposer
      ? new Validator(data.proposer,
        chainId,
        timestamp)
      : null;
  }
}

class Validator {
  constructor (data, chainId, timestamp) {
    this.chainId = chainId;
    this.timestamp = timestamp;
    this.address = data.address;
    this.pub_key = data.pub_key;
    this.voting_power = data.voting_power;
    this.proposer_priority = data.proposer_priority;
  }
}

class Peer {
  constructor (data, chainId, timestamp) {
    this.chainId = chainId;
    this.timestamp = timestamp;
    this.node_address = data.node_address;
    this.peer_state = new PeerState(data.peer_state,
      chainId,
      timestamp);
  }
}

class PeerState {
  constructor (data, chainId, timestamp) {
    this.chainId = chainId;
    this.timestamp = timestamp;
    this.round_state = new RoundState(data.round_state,
      chainId,
      timestamp);
    this.stats = data.stats;
  }
}
