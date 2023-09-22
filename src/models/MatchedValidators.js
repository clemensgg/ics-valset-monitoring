// src/models/MatchedValidators.js

export class matchedValidators {
  constructor (stakingValidators, consensusState, chainId = null, timestamp = new Date().toISOString()) {
    this.stakingValidators = stakingValidators;
    this.consensusState = consensusState;
    this.chainId = chainId;
    this.timestamp = timestamp;

    this.matchedValidators = this.matchValidators();
    this.matchedLastValidators = this.matchLastValidators();
  }

  matchValidators () {
    return this.stakingValidators.validators.filter(stakingValidator => {
      const valcons = pubKeyToValcons(stakingValidator.consensus_pubkey.key, 'cosmos'); // Assuming "cosmos" as prefix
      return this.consensusState.result.round_state.validators.some(consensusValidator =>
        stakingValidator.consumer_signing_keys[this.chainId] === valcons
      );
    }).map(validator => ({ ...validator, timestamp: this.timestamp }));
  }

  matchLastValidators () {
    return this.stakingValidators.validators.filter(stakingValidator => {
      const valcons = pubKeyToValcons(stakingValidator.consensus_pubkey.key, 'cosmos'); // Assuming "cosmos" as prefix
      return this.consensusState.result.round_state.last_validators.some(consensusLastValidator =>
        stakingValidator.consumer_signing_keys[this.chainId] === valcons
      );
    }).map(validator => ({ ...validator, timestamp: this.timestamp }));
  }
}
