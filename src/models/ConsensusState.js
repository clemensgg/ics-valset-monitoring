// src/models/ConsensusState.js

export class ConsensusState {
    constructor(data) {
        this.jsonrpc = data.jsonrpc;
        this.id = data.id;
        this.result = data.result ? new Result(data.result) : null;
    }
}

class Result {
    constructor(data) {
        this.round_state = data.round_state ? new RoundState(data.round_state) : null;
        this.peers = data.peers ? data.peers.map(peer => new Peer(peer)) : [];
    }
}

class RoundState {
    constructor(data) {
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

class Validators {
    constructor(data) {
        this.validators = data.validators.map(validator => new Validator(validator));
        this.proposer = data.proposer ? new Validator(data.proposer) : null;
    }
}

class Validator {
    constructor(data) {
        this.address = data.address;
        this.pub_key = data.pub_key;
        this.voting_power = data.voting_power;
        this.proposer_priority = data.proposer_priority;
    }
}

class Peer {
    constructor(data) {
        this.node_address = data.node_address;
        this.peer_state = new PeerState(data.peer_state);
    }
}

class PeerState {
    constructor(data) {
        this.round_state = new RoundState(data.round_state);
        this.stats = data.stats;
    }
}

